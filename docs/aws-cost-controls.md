# Cleanote AWS Cost Controls

This plan hardens scanning before live AWS resource changes are made. Apply these settings in ECS only after the code is deployed.

## Runtime Protection

Cleanote now identifies each scan by Firebase user when signed in, otherwise by `X-Cleanote-Installation-Id`.

Server-side controls:

- Reject unsupported files and uploads larger than `MAX_UPLOAD_BYTES` before Textract.
- Reject PDFs with more than `MAX_PAGES_PER_UPLOAD` rendered pages before Textract.
- Rate-limit anonymous, signed-in free, and paid usage with DynamoDB counters.
- Deduplicate identical uploads with `OCR_CACHE_TABLE_NAME`.
- Make retries safe with `IDEMPOTENCY_TABLE_NAME` and the `Idempotency-Key` header.
- Default to rules-only cleanup unless the request asks for AI cleanup and policy allows it.
- Record estimated Textract, Bedrock, and storage cost in `SCAN_EVENTS_TABLE_NAME`.

## DynamoDB Tables

Create these on-demand tables:

| Table | Partition key | Sort key | Notes |
| --- | --- | --- | --- |
| `cleanote-usage-counters` | `counter_key` string | none | Daily/monthly usage counters. |
| `cleanote-ocr-cache` | `owner_hash` string | `cache_key` string | Cached OCR responses and in-progress leases. Enable TTL on `expires_at`. |
| `cleanote-idempotency` | `owner_hash` string | `idempotency_key` string | Retry-safe response cache. Enable TTL on `expires_at`. |
| `cleanote-monetization-policy` | `policy_id` string | none | Optional remote policy row. |
| `cleanote-scan-events` | existing `scan_id` string | none | Existing table, now stores cost fields too. |

Optional policy item:

```json
{
  "policy_id": "cleanote-default",
  "basic_ocr_policy": "free",
  "ai_cleanup_policy": "payment_required"
}
```

Supported policy values:

- `free`
- `rewarded_ad_required`
- `payment_required`
- `service_disabled`

## ECS Environment Variables

Minimum safe launch values:

```bash
USAGE_COUNTER_TABLE_NAME=cleanote-usage-counters
OCR_CACHE_TABLE_NAME=cleanote-ocr-cache
IDEMPOTENCY_TABLE_NAME=cleanote-idempotency
MONETIZATION_POLICY_TABLE_NAME=cleanote-monetization-policy
MONETIZATION_POLICY_ID=cleanote-default
BASIC_OCR_POLICY=free
AI_CLEANUP_POLICY=payment_required
APP_KILL_SWITCH=
ANON_FREE_SCANS_PER_DAY=5
ANON_FREE_SCANS_PER_MONTH=25
AUTH_FREE_SCANS_PER_DAY=20
AUTH_FREE_SCANS_PER_MONTH=200
PAID_SCANS_PER_DAY=250
PAID_SCANS_PER_MONTH=5000
MAX_UPLOAD_BYTES=10485760
MAX_PAGES_PER_UPLOAD=3
OCR_CACHE_TTL_SECONDS=604800
IDEMPOTENCY_TTL_SECONDS=86400
ALLOW_FREE_BEDROCK_FOR_TESTING=false
```

Emergency kill switch values:

```bash
APP_KILL_SWITCH=OCR_DISABLED
APP_KILL_SWITCH=BEDROCK_DISABLED
APP_KILL_SWITCH=ANONYMOUS_DISABLED
APP_KILL_SWITCH=FREE_TIER_DISABLED
```

Multiple modes can be comma-separated.

## IAM Task Role Additions

Add these permissions to the ECS task role used by the backend:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Scan"
      ],
      "Resource": [
        "arn:aws:dynamodb:us-east-1:924225826927:table/cleanote-usage-counters",
        "arn:aws:dynamodb:us-east-1:924225826927:table/cleanote-ocr-cache",
        "arn:aws:dynamodb:us-east-1:924225826927:table/cleanote-idempotency",
        "arn:aws:dynamodb:us-east-1:924225826927:table/cleanote-monetization-policy",
        "arn:aws:dynamodb:us-east-1:924225826927:table/cleanote-scan-events",
        "arn:aws:dynamodb:us-east-1:924225826927:table/cleanote-payments",
        "arn:aws:dynamodb:us-east-1:924225826927:table/cleanote-subscriptions"
      ]
    }
  ]
}
```

Keep existing Textract and Bedrock permissions:

```json
{
  "Effect": "Allow",
  "Action": [
    "textract:DetectDocumentText",
    "bedrock:InvokeModel"
  ],
  "Resource": "*"
}
```

## AWS Budget Guardrails

Create AWS Budgets for the account:

- Monthly actual cost alarm at `$25`, `$50`, and `$100`.
- Service filter for Amazon Textract with alarms at `$10`, `$25`, and `$50`.
- Service filter for Amazon Bedrock with alarms at `$10`, `$25`, and `$50`.

Recommended response if an alarm fires:

1. Set `APP_KILL_SWITCH=BEDROCK_DISABLED`.
2. If spend continues, set `APP_KILL_SWITCH=ANONYMOUS_DISABLED`.
3. If needed, set `APP_KILL_SWITCH=OCR_DISABLED`.
4. Redeploy the ECS service with the new environment variable.

## Admin Checks

Use:

```bash
curl -H "X-Admin-Token: $ADMIN_DASHBOARD_TOKEN" \
  "https://YOUR_BACKEND/api/admin/usage?days=7"
```

The response includes scan count, cache hit rate, free vs paid usage, estimated cost, and status breakdown.

## Notes

- Cost numbers are estimates using environment variable assumptions, not AWS billing records.
- Payment entitlement lookup currently scans payment/subscription tables. Add a `customer_email` GSI before high-volume usage.
- Mobile installation IDs are currently session-scoped to avoid a new native dependency. Use SecureStore later for stricter per-install limits.
