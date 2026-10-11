from __future__ import annotations
import base64, io, sys, unittest
from pathlib import Path
from unittest.mock import Mock, patch
import cv2, numpy as np, pypdfium2
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import scrapbook_service as scrapbook


def image_bytes():
    image = np.full((500, 700, 3), 245, dtype=np.uint8)
    cv2.putText(image, "My little garden", (45, 95), cv2.FONT_HERSHEY_SIMPLEX, 1.2, (30, 80, 50), 2)
    cv2.rectangle(image, (90, 250), (240, 420), (40, 145, 230), 4)
    cv2.circle(image, (420, 230), 95, (80, 180, 60), 5)
    return cv2.imencode(".png", image)[1].tobytes()


class ScrapbookTests(unittest.TestCase):
    def page(self, identifier="1"):
        return {"id": identifier, "title": "Garden drawing", "createdAt": "2026-10-11T12:00:00Z",
                "text": "A tiny house beside a bright green tree.", "imageData": "data:image/png;base64,"+base64.b64encode(image_bytes()).decode()}

    def test_all_cloud_query_pages_are_loaded_and_sorted(self):
        import hashlib
        email = "parent@example.com"
        prefix = "notes/"+hashlib.sha256(email.encode()).hexdigest()[:24]+"/"
        table=Mock(); table.name="notes"
        table.meta.client.get_paginator.return_value.paginate.return_value=[
            {"Items":[{"note_id":"new","created_at":"2026-10-11","image_key":prefix+"new.png"}]},
            {"Items":[{"note_id":"old","created_at":"2026-01-01","image_key":prefix+"old.png"}]}]
        s3=Mock(); s3.get_object.side_effect=lambda **kwargs: {"Body":io.BytesIO(image_bytes())}
        with patch.object(scrapbook.notes,"_ensure_configured"), patch.object(scrapbook.notes,"_table",return_value=table), patch.object(scrapbook.notes,"_s3_client",return_value=s3):
            result=scrapbook.cloud_pages(email)
        self.assertEqual([p["id"] for p in result],["old","new"])
        self.assertEqual(s3.get_object.call_count,2)

    def test_foreign_image_key_cannot_be_read(self):
        table=Mock(); table.name="notes"
        table.meta.client.get_paginator.return_value.paginate.return_value=[{"Items":[{"note_id":"foreign","image_key":"notes/another-account/image.png"}]}]
        s3=Mock()
        with patch.object(scrapbook.notes,"_ensure_configured"), patch.object(scrapbook.notes,"_table",return_value=table), patch.object(scrapbook.notes,"_s3_client",return_value=s3):
            with self.assertRaisesRegex(ValueError,"does not belong"):
                scrapbook.cloud_pages("parent@example.com")
        s3.get_object.assert_not_called()

    def test_duplicate_local_and_cloud_pages_are_not_printed_twice(self):
        existing={**self.page(),"image":image_bytes()}
        with patch.object(scrapbook,"cloud_pages",return_value=[existing]):
            data,count=scrapbook.export_scrapbook("parent@example.com",[self.page(),self.page("2")])
        self.assertEqual(count,2)
        document=pypdfium2.PdfDocument(data)
        self.assertEqual(len(document),2)
        document.close()

    def test_caption_is_plain_text_and_excludes_correction_logs(self):
        self.assertEqual(scrapbook.caption("Original text\nCorrections made\nnew text","Title"),"Original text")
        self.assertLessEqual(len(scrapbook.caption("a"*500,"Title")),180)

    def test_invalid_local_image_fails_whole_export(self):
        page=self.page(); page["imageData"]="https://untrusted.example/image.png"
        with self.assertRaises(ValueError): scrapbook.export_scrapbook(None,[page])

    def test_cloud_export_requires_matching_authentication(self):
        import main
        from fastapi.testclient import TestClient
        with patch.object(main,"require_matching_email",side_effect=PermissionError("Sign in required")), patch.object(main,"export_scrapbook") as export:
            response=TestClient(main.app).post("/api/scrapbook/export",json={"email":"someone@example.com"})
        self.assertEqual(response.status_code,401)
        export.assert_not_called()

    def test_local_pdf_response_has_page_count_and_no_store(self):
        import main
        from fastapi.testclient import TestClient
        response=TestClient(main.app).post("/api/scrapbook/export",json={"pages":[self.page()]})
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.headers["x-scrapbook-pages"],"1")
        self.assertEqual(response.headers["cache-control"],"no-store")
        self.assertTrue(response.content.startswith(b"%PDF"))

if __name__=="__main__":
    unittest.main()
