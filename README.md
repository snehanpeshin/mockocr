# Cleanote

MVP web app for uploading a handwritten image or PDF, preprocessing it, running OCR, editing extracted text, and exporting the result.

## Project Structure

```text
handwriting-ocr-app/
  frontend/   Next.js upload and editor UI
  backend/    FastAPI OCR API
  outputs/    generated TXT/DOCX exports
```

## Quick Start

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn main:app --reload --reload-dir . --port 8000
```

If your venv is using Python 3.14 and a package tries to compile from source, use Python 3.11-3.13 for this MVP backend. Those versions have the broadest prebuilt wheel support for OpenCV and OCR-related packages.

By default, OCR runs in `mock` mode for local development unless `OCR_PROVIDER` is set. The production UI is configured for Amazon Textract.

To use Amazon Textract:

```bash
python -m pip install -r requirements-aws.txt
export OCR_PROVIDER=textract
export AWS_REGION=us-east-1
export AWS_ACCESS_KEY_ID=your_access_key_id
export AWS_SECRET_ACCESS_KEY=your_secret_access_key
python -m uvicorn main:app --reload --reload-dir . --port 8000
```

Textract is the best option here if you expect forms, tables, or structured handwritten records later. The backend uses Textract `DetectDocumentText` for the MVP text extraction path.

To add AWS Bedrock AI cleanup after Textract:

```bash
export AI_CLEANUP_PROVIDER=bedrock
export BEDROCK_REGION=us-east-1
export BEDROCK_MODEL_ID=amazon.nova-lite-v1:0
python -m uvicorn main:app --reload --reload-dir . --port 8000
```

If Bedrock is not enabled or the model is unavailable, the app falls back to rule-based cleanup unless `AI_CLEANUP_STRICT=true`.

## AWS-Only Deployment

Recommended live setup for `mockocr.com`:

- Frontend: AWS Amplify Hosting
- Backend: Amazon ECS Express Mode using `backend/Dockerfile`
- OCR: Amazon Textract
- AI cleanup: optional Amazon Bedrock
- Domain: point the Wix-managed domain DNS records to Amplify

Backend environment variables:

```bash
OCR_PROVIDER=textract
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
AI_CLEANUP_PROVIDER=rules
BEDROCK_REGION=us-east-1
BEDROCK_MODEL_ID=amazon.nova-lite-v1:0
FRONTEND_ORIGINS=https://mockocr.com,https://www.mockocr.com
```

Frontend environment variable:

```bash
NEXT_PUBLIC_API_BASE_URL=https://your-aws-backend-url
```

For production, create an IAM user or role with the least permission needed for the MVP:

```text
textract:DetectDocumentText
bedrock:InvokeModel if AI_CLEANUP_PROVIDER=bedrock
```

The frontend always submits uploads to the backend as `provider=textract`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

## API

- `POST /api/ocr` accepts `file` as multipart form data and returns extracted text.
- `POST /api/export/txt` accepts JSON `{ "text": "..." }` and returns a TXT file.
- `POST /api/export/docx` accepts JSON `{ "text": "..." }` and returns a DOCX file.

## Next Milestones

- Add camera capture on mobile.
- Store scan history in DynamoDB or S3.
- Add crop handles and manual deskew controls.
- Add authentication and per-user scan history.
