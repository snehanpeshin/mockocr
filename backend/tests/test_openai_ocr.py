from __future__ import annotations
import os
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import openai_ocr as vision
import ocr_service
import cost_control

def block(text="protien = x²", **kwargs):
    return vision.Block(id="b1", kind="math", text=text, uncertain=False, alternatives=[], **kwargs)

def response(parsed, status="completed"):
    return SimpleNamespace(status=status, output_parsed=parsed,
                           usage=SimpleNamespace(input_tokens=100, output_tokens=20))

class VisionTests(unittest.TestCase):
    def run_page(self, responses, verify=False):
        client = Mock()
        client.responses.parse.side_effect = responses
        with patch.object(vision, "_client", return_value=client), patch.object(
                vision, "_image_input", return_value={"type": "input_image", "detail": "high"}):
            result = vision.transcribe_page(Path("page.png"), "math", "hints", verify)
        return result, client

    def test_spelling_math_and_repeated_source_lines_survive(self):
        page = vision.Page(blocks=[block(), vision.Block(id="b2", kind="text", text="protien = x²",
                                                        uncertain=False, alternatives=[])])
        result, client = self.run_page([response(page)])
        self.assertEqual(result["text"], "protien = x²\n\nprotien = x²")
        self.assertFalse(client.responses.parse.call_args.kwargs["store"])

    def test_ambiguities_remain_explicit(self):
        page = vision.Page(blocks=[vision.Block(id="b1", kind="text", text="[unclear]",
                                                uncertain=True, alternatives=["a", "6"])])
        result, _ = self.run_page([response(page)])
        self.assertTrue(result["needs_review"])
        self.assertIn("a / 6", result["text"])

    def test_incomplete_response_is_never_accepted(self):
        with self.assertRaises(RuntimeError):
            self.run_page([response(vision.Page(blocks=[block()]), status="incomplete")])

    def test_refusal_is_not_treated_as_blank_page(self):
        with self.assertRaises(RuntimeError):
            self.run_page([response(None)])

    def test_verification_failure_preserves_first_pass(self):
        result, _ = self.run_page([response(vision.Page(blocks=[block()])), Exception("private payload")], True)
        self.assertEqual(result["blocks"][0]["text"], "protien = x²")
        self.assertTrue(result["warnings"])
        self.assertNotIn("private payload", result["text"])

    def test_invalid_review_does_not_apply_partial_corrections(self):
        changes = vision.Review(corrections=[
            vision.Correction(block_id="b1", original="protien = x²", corrected="protein = x²", reason="pixels"),
            vision.Correction(block_id="missing", original="x", corrected="y", reason="pixels")])
        result, _ = self.run_page([response(vision.Page(blocks=[block()])), response(changes)], True)
        self.assertEqual(result["blocks"][0]["text"], "protien = x²")
        self.assertEqual(result["corrections"], [])

    def test_review_cannot_resolve_alternatives_even_without_uncertain_flag(self):
        page = vision.Page(blocks=[vision.Block(id="b1", kind="text", text="a",
                                               uncertain=False, alternatives=["a", "6"])])
        review = vision.Review(corrections=[vision.Correction(
            block_id="b1", original="a", corrected="6", reason="pixels")])
        result, _ = self.run_page([response(page), response(review)], True)
        self.assertEqual(result["blocks"][0]["text"], "a")
        self.assertEqual(result["corrections"], [])
        self.assertTrue(result["needs_review"])

    def test_valid_correction_keeps_original_and_tracks_usage(self):
        review = vision.Review(corrections=[vision.Correction(
            block_id="b1", original="protien = x²", corrected="protien = x³", reason="visible superscript")])
        result, _ = self.run_page([response(vision.Page(blocks=[block()])), response(review)], True)
        self.assertEqual(result["raw_blocks"][0]["text"], "protien = x²")
        self.assertEqual(result["blocks"][0]["text"], "protien = x³")
        self.assertEqual(result["usage"], {"calls": 2, "input_tokens": 200, "output_tokens": 40})

    def test_duplicate_block_ids_are_rejected(self):
        with self.assertRaises(RuntimeError):
            self.run_page([response(vision.Page(blocks=[block(), block()]))])

    def test_sdk_error_is_redacted(self):
        with self.assertRaisesRegex(RuntimeError, "^OpenAI transcription is unavailable"):
            self.run_page([Exception("secret-key-and-document")])

    def test_legacy_clients_use_openai_without_aws_calls(self):
        with patch.object(ocr_service, "transcribe_page", return_value={"text": "ok"}) as call:
            result = ocr_service.extract_text([Path("threshold.png")], "textract", fast_mode=True,
                                             cleanup_mode="openai", original_image_path=Path("original.png"))
        self.assertEqual(result["text"], "ok")
        self.assertEqual(call.call_args.args[0], Path("original.png"))
        self.assertTrue(call.call_args.kwargs["verify"])

    def test_document_cleanup_preserves_line_breaks_and_spelling(self):
        self.assertEqual(ocr_service.clean_ocr_text("protien\nx²\nx²"), "protien\nx²\nx²")

    def test_model_change_invalidates_cache(self):
        identity = cost_control.ScanIdentity("anonymous", "installation", "hash")
        kwargs = dict(identity=identity, upload_bytes=b"image", provider="openai",
                      cleanup_mode="rules", subject="math", options={})
        with patch.dict(os.environ, {"OPENAI_OCR_MODEL": "model-a"}):
            first = cost_control.cache_key_for(**kwargs)
        with patch.dict(os.environ, {"OPENAI_OCR_MODEL": "model-b"}):
            second = cost_control.cache_key_for(**kwargs)
        self.assertNotEqual(first.cache_key, second.cache_key)

    def test_openai_usage_never_counts_textract(self):
        identity = cost_control.ScanIdentity("anonymous", "installation", "hash")
        access = cost_control.EffectiveAccess(False, "anonymous", "free", "payment_required", "rules", False)
        args = dict(identity=identity, access=access, filename="page", file_type="png",
                    upload_bytes=1, page_count=1, provider="openai:model", status="success",
                    cache_hit=False, idempotency_key=None,
                    openai_usage={"calls": 1, "input_tokens": 100, "output_tokens": 20})
        with patch.dict(os.environ, {"OPENAI_INPUT_MICRO_USD_PER_MILLION_TOKENS": "1000000",
                                    "OPENAI_OUTPUT_MICRO_USD_PER_MILLION_TOKENS": "2000000"}):
            event = cost_control.usage_event(**args)
        self.assertEqual(event["textract_calls"], 0)
        self.assertEqual(event["bedrock_input_tokens"], 0)
        self.assertEqual(event["estimated_openai_micro_usd"], 140)
        args["cache_hit"] = True
        self.assertEqual(cost_control.usage_event(**args)["openai_calls"], 0)

    def test_multipage_upload_verifies_each_page(self):
        import main
        from fastapi.testclient import TestClient
        page_result = {"provider": "openai:test", "text": "page",
                       "usage": {"calls": 2, "input_tokens": 100, "output_tokens": 20}}
        access = cost_control.EffectiveAccess(True, "paid", "free", "payment_required", "openai", True)
        with patch.object(main, "_render_pdf_pages", return_value=[Path("a.png"), Path("b.png")]), \
             patch.object(main, "extract_text", return_value=page_result) as extract, \
             patch.object(main, "effective_access", return_value=access), \
             patch.object(main, "record_scan_event") as event, \
             patch.dict(os.environ, {"OCR_PROVIDER": "openai", "MONETIZATION_POLICY_TABLE_NAME": "",
                                    "OCR_CACHE_TABLE_NAME": "", "USAGE_COUNTER_TABLE_NAME": "",
                                    "IDEMPOTENCY_TABLE_NAME": "", "APP_KILL_SWITCH": ""}):
            with TestClient(main.app) as client:
                result = client.post("/api/ocr", files={"file": ("pages.pdf", b"pdf", "application/pdf")},
                                     data={"provider": "textract", "cleanup_mode": "openai"},
                                     headers={"X-Cleanote-Installation-Id": "installation-1234567890"})
        self.assertEqual(result.status_code, 200, result.text)
        self.assertEqual(extract.call_count, 2)
        self.assertTrue(all(c.kwargs["cleanup_mode"] == "openai" for c in extract.call_args_list))
        self.assertEqual(len(result.json()["pages"]), 2)
        self.assertEqual(event.call_args.args[0]["openai_calls"], 4)

if __name__ == "__main__":
    unittest.main()

