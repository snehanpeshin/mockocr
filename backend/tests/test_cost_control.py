from __future__ import annotations

import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import cost_control


class CostControlTests(unittest.TestCase):
    def setUp(self) -> None:
        cost_control._POLICY_CACHE = {"loaded_at": 0.0, "value": None}

    def test_anonymous_identity_requires_installation_id(self) -> None:
        with self.assertRaises(ValueError):
            cost_control.identify_scan_request(None, None)

        identity = cost_control.identify_scan_request(None, "installation-1234567890")
        self.assertEqual(identity.identity_type, "anonymous")
        self.assertEqual(len(identity.identity_hash), 64)

    def test_ai_cleanup_requires_payment_by_default(self) -> None:
        identity = cost_control.identify_scan_request(None, "installation-1234567890")
        with patch.dict(os.environ, {"AI_CLEANUP_POLICY": "payment_required"}, clear=False):
            with self.assertRaises(cost_control.MonetizationRequired):
                cost_control.effective_access(identity, "bedrock")

    def test_paid_user_can_request_bedrock_cleanup(self) -> None:
        identity = cost_control.ScanIdentity(
            identity_type="authenticated",
            identity_value="firebase:user",
            identity_hash="hash",
            email="paid@example.com",
            uid="user",
        )
        with patch.object(cost_control, "has_paid_entitlement", return_value=True):
            access = cost_control.effective_access(identity, "bedrock")

        self.assertTrue(access.is_paid)
        self.assertEqual(access.cleanup_mode, "bedrock")

    def test_kill_switch_blocks_ocr(self) -> None:
        identity = cost_control.identify_scan_request(None, "installation-1234567890")
        access = cost_control.EffectiveAccess(
            is_paid=False,
            tier="anonymous",
            basic_policy="free",
            ai_policy="payment_required",
            cleanup_mode="rules",
            bedrock_allowed=False,
        )
        with patch.dict(os.environ, {"APP_KILL_SWITCH": "OCR_DISABLED"}, clear=False):
            with self.assertRaises(cost_control.ServiceDisabled):
                cost_control.enforce_kill_switch(identity, access)

    def test_estimated_cost_uses_configured_micro_usd_values(self) -> None:
        with patch.dict(
            os.environ,
            {
                "EST_TEXTRACT_MICRO_USD_PER_PAGE": "2000",
                "EST_BEDROCK_MICRO_USD_PER_CALL": "3000",
                "EST_STORAGE_MICRO_USD_PER_MB_MONTH": "100",
            },
            clear=False,
        ):
            estimate = cost_control.estimate_cost_micro_usd(
                textract_pages=3,
                bedrock_calls=1,
                upload_bytes=2 * 1024 * 1024,
            )

        self.assertEqual(estimate["textract"], 6000)
        self.assertEqual(estimate["bedrock"], 3000)
        self.assertEqual(estimate["storage"], 200)
        self.assertEqual(estimate["total"], 9200)


if __name__ == "__main__":
    unittest.main()
