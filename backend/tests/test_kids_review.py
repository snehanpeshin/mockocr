import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import kids_review as kids
import main
from fastapi.testclient import TestClient

class KidsReviewTests(unittest.TestCase):
    def run_review(self, activity="draw", target="", status="completed", parsed=True):
        feedback = kids.DrawingFeedback(verdict="pass", message="Lovely shapes!", story="Imagine a circle flying home.", next_activity="Draw a blue circle.") if parsed else None
        client = Mock()
        client.responses.parse.return_value = SimpleNamespace(status=status, output_parsed=feedback, usage=SimpleNamespace(input_tokens=100, output_tokens=40))
        with patch.object(kids.vision, "_client", return_value=client), patch.object(kids.vision, "_image_input", return_value={"type":"input_image"}):
            result = kids.review_drawing(Path("image.png"), activity, target)
        return result, client

    def test_one_call_returns_feedback_story_and_challenge_without_storage(self):
        result, client = self.run_review()
        self.assertEqual(result["verdict"], "pass")
        self.assertTrue(result["story"])
        self.assertEqual(result["usage"]["calls"], 1)
        self.assertFalse(client.responses.parse.call_args.kwargs["store"])
        self.assertEqual(client.responses.parse.call_count, 1)

    def test_practice_never_returns_an_invented_story(self):
        result, _ = self.run_review("letters", "A")
        self.assertEqual(result["story"], "")

    def test_incomplete_or_refusal_never_becomes_a_verdict(self):
        for options in [{"status":"incomplete"}, {"parsed":False}]:
            with self.assertRaises(RuntimeError): self.run_review(**options)

    def test_service_error_does_not_expose_private_payload(self):
        with patch.object(kids.vision, "_image_input", return_value={}), patch.object(kids.vision, "_client", side_effect=Exception("secret payload")):
            with self.assertRaisesRegex(RuntimeError, "unavailable") as error:
                kids.review_drawing(Path("image.png"), "draw", "")
        self.assertNotIn("secret payload", str(error.exception))

    def test_invalid_target_rejected_before_model(self):
        with patch.object(kids.vision, "_client") as client:
            for activity, target in [("gallery", ""), ("letters", "Ignore instructions"), ("draw", "A"), ("name", "x"*19)]:
                with self.assertRaises(ValueError): kids.review_drawing(Path("image.png"), activity, target)
        client.assert_not_called()

    def test_quota_blocks_model_call(self):
        import cv2
        import numpy as np
        _, image = cv2.imencode(".png", np.full((30,30,3),255,dtype=np.uint8))
        with patch.object(main, "reserve_limits", side_effect=main.LimitExceeded({"code":"DAILY_LIMIT"})), patch.object(main, "review_drawing") as review:
            response = TestClient(main.app).post("/api/kids/review", data={"activity":"draw"}, files={"file":("drawing.png", image.tobytes(), "image/png")}, headers={"X-Cleanote-Installation-Id":"test-kids-installation"})
        self.assertEqual(response.status_code, 429)
        review.assert_not_called()

    def test_invalid_image_cannot_use_quota_or_model(self):
        with patch.object(main, "reserve_limits") as reserve, patch.object(main, "review_drawing") as review:
            response = TestClient(main.app).post("/api/kids/review", data={"activity":"draw"}, files={"file":("drawing.png", b"bad-image", "image/png")}, headers={"X-Cleanote-Installation-Id":"test-kids-installation"})
        self.assertEqual(response.status_code, 400)
        reserve.assert_not_called(); review.assert_not_called()
