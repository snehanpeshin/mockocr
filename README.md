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
BETA_TABLE_NAME=cleanote-beta
BETA_LIMIT=50
BETA_TOKEN_TTL_HOURS=24
SES_FROM_EMAIL=hello@cleanote.com
APP_BASE_URL=https://cleanote.com
NOTE_TABLE_NAME=cleanote-notes
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
STRIPE_CLEANOTE_MONTHLY_PREMIUM_PRODUCT_ID=prod_cleanote_monthly_premium
STRIPE_CLEANOTE_MONTHLY_PREMIUM_PRICE_ID=price_cleanote_monthly_premium
STRIPE_CLEANOTE_ANNUAL_PREMIUM_PRODUCT_ID=prod_cleanote_annual_premium
STRIPE_CLEANOTE_ANNUAL_PREMIUM_PRICE_ID=price_cleanote_annual_premium
STRIPE_PAYMENT_TABLE_NAME=cleanote-payments
STRIPE_SUBSCRIPTION_TABLE_NAME=cleanote-subscriptions
ADMIN_DASHBOARD_TOKEN=replace_with_long_random_admin_token
```

Frontend environment variable:

```bash
NEXT_PUBLIC_API_BASE_URL=https://your-aws-backend-url
NEXT_PUBLIC_BETA_GATE=false
```

For production, create an IAM user or role with the least permission needed for the MVP:

```text
textract:DetectDocumentText
bedrock:InvokeModel if AI_CLEANUP_PROVIDER=bedrock
dynamodb:PutItem
dynamodb:GetItem
dynamodb:UpdateItem
dynamodb:Scan
dynamodb:Query
ses:SendEmail
```

### Stripe Billing

Stripe Checkout, Payment Links, webhooks, DynamoDB payment storage, and the admin revenue
dashboard are documented in:

```text
docs/stripe-setup.md
```

The frontend always submits uploads to the backend as `provider=textract`.

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

Cleanote keeps a browser-local archive by default. When a user has verified beta access and
`NOTE_TABLE_NAME` is configured, notes are also saved to DynamoDB and searched from the backend.

AWS resource needed for cloud search:

- DynamoDB table: `cleanote-notes`
- Partition key: `email` as a string
- Sort key: `note_id` as a string

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
native camera/photo import, Textract OCR, text editing, local saves, and optional cloud note
save/search using a verified beta email.

## API

- `POST /api/ocr` accepts `file` as multipart form data and returns extracted text.
- `POST /api/beta/request` accepts JSON `{ "name": "...", "email": "...", "role": "Student" }` and sends a verification link.
- `GET /api/beta/verify?token=...` verifies the email link.
- `POST /api/notes` saves a verified user's note to DynamoDB.
- `GET /api/notes/search?email=...&q=...` searches a verified user's saved notes.
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
