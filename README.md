# Cleanote

MVP web app for uploading a handwritten image or PDF, preprocessing it, running OCR, editing extracted text, and exporting the result.

## Project Structure

```text
handwriting-ocr-app/
  frontend/   Next.js upload and editor UI
  mobile/     Expo iOS/Android app
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

## OpenAI OCR and verification

Cleanote transcribes original images and every PDF page through OpenAI, replacing
Textract and Bedrock. The backend returns ordered text/math/table/diagram blocks,
explicit uncertain readings, and an optional image-grounded verification pass.
See [migration and validation](docs/openai-migration.md) for deployment, cost controls,
known limits, and the evaluation requirements.

Install dependencies:

```bash
python -m pip install -r requirements.txt -r requirements-aws.txt
```

Set the server-side environment:

```bash
OCR_PROVIDER=openai
OPENAI_API_KEY=your_server_side_secret
OPENAI_OCR_MODEL=gpt-6-sol
OPENAI_OCR_MAX_OUTPUT_TOKENS=12000
OPENAI_OCR_TIMEOUT_SECONDS=90
OCR_CACHE_VERSION=openai-v1
OCR_CACHE_LEASE_SECONDS=1200
```

The frontend uses the same backend API. Existing installed clients sending
`provider=textract` and `cleanup_mode=bedrock` are routed to OpenAI.
AWS hosting, DynamoDB account data, and SES email remain supported.
Do not put the OpenAI key in frontend or mobile configuration.

### Stripe Billing

Stripe Checkout, Payment Links, webhooks, DynamoDB payment storage, and the admin revenue
dashboard are documented in:

```text
docs/stripe-setup.md
```

### Cleanote Beta Access

The landing page collects the first beta users at `/`, and the scanner app lives at `/app`.
Users enter name, email, and role, then receive a passwordless verification link by email.

AWS resources needed for beta access:

- DynamoDB table: `cleanote-beta`
- Partition key: `email` as a string
- SES verified sender: the email in `SES_FROM_EMAIL`

For launch, keep `NEXT_PUBLIC_BETA_GATE=false` until SES and DynamoDB are working. Set it to
`true` when you want `/app` to require a verified Cleanote email link.

### Cloud Note Search

Cleanote keeps a browser-local archive by default. When a user signs in with Firebase and
`NOTE_TABLE_NAME` is configured, notes can also be saved to DynamoDB and searched from the backend.
The frontend sends a Firebase ID token, and the backend verifies that the authenticated email
matches the note owner before save, search, or delete operations.

AWS resource needed for cloud search:

- DynamoDB table: `cleanote-notes`
- Partition key: `email` as a string
- Sort key: `note_id` as a string

### Scan Counting

When `SCAN_EVENTS_TABLE_NAME` is configured, every OCR request writes one scan event to
DynamoDB. Use this to count scans, successful scans, failed scans, subjects, providers, and
uploaded file sizes.

AWS resource needed for scan counting:

- DynamoDB table: `cleanote-scan-events`
- Partition key: `scan_id` as a string

ECS task role policy:

```json
{
  "Effect": "Allow",
  "Action": [
    "dynamodb:PutItem",
    "dynamodb:Scan"
  ],
  "Resource": "arn:aws:dynamodb:us-east-1:924225826927:table/cleanote-scan-events"
}
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

### Mobile

The mobile app is an Expo React Native app for iPhone and Android. It uses the same FastAPI
backend as the website.

```bash
cd mobile
cp .env.example .env
npm install
npm run android
```

For iPhone development on a Mac, use:

```bash
npm run ios
```

Set `EXPO_PUBLIC_API_BASE_URL` to the deployed ECS backend URL. The first mobile version supports
native camera/photo import, OpenAI OCR, text editing, local saves, and optional cloud note
save/search using a verified beta email.

## API

- `POST /api/ocr` accepts `file` as multipart form data and returns extracted text.
- `POST /api/beta/request` accepts JSON `{ "name": "...", "email": "...", "role": "Student" }` and sends a verification link.
- `GET /api/beta/verify?token=...` verifies the email link.
- `POST /api/notes` saves an authenticated user's note to DynamoDB and requires a Firebase bearer token.
- `GET /api/notes/search?email=...&q=...` searches an authenticated user's saved notes and requires a Firebase bearer token.
- `POST /api/stripe/checkout-session` creates a server-side Stripe Checkout Session.
- `POST /api/stripe/payment-link` creates an admin-protected Stripe Payment Link.
- `POST /api/stripe/webhook` receives and verifies Stripe webhook events.
- `GET /api/admin/revenue` returns token-protected revenue dashboard data.
- `POST /api/export/txt` accepts JSON `{ "text": "..." }` and returns a TXT file.
- `POST /api/export/docx` accepts JSON `{ "text": "..." }` and returns a DOCX file.

## Next Milestones

- Add camera capture on mobile.
- Store scan history in DynamoDB or S3.
- Add crop handles and manual deskew controls.
- Add authentication and per-user scan history.
