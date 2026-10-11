# OpenAI transcription migration

Cleanote now sends original page images to the OpenAI Responses API. AWS continues
to host the app and support account data, email, and usage storage. Textract and
Bedrock are not called by the OCR path.

## Pipeline

1. Render each PDF page at the existing PDF resolution, or decode the uploaded image.
2. Send original colour pixels at high image detail; preserve spelling, equations,
   tables, diagrams and repeated lines as ordered blocks.
3. Return uncertain spans and alternatives explicitly. Do not treat model confidence
   percentages as measured accuracy.
4. For the existing paid AI-cleanup option, review the draft against the same image.
   Apply only corrections whose block IDs and original text match. Reject an invalid
   patch atomically. Keep both original and corrected blocks.
5. Preserve the first transcription with a visible warning if verification fails.
   Incomplete/refused initial transcription fails the request instead of returning
   partial text. All PDF pages use the same pipeline.
6. Cache by source, model, pipeline version, token budget and request options.
   Do not cache results whose verification failed. Record returned token usage.

Old mobile clients sending provider=textract and cleanup_mode=bedrock are mapped to
OpenAI; the legacy names never invoke AWS AI. Basic scanning remains under the
basic OCR policy and daily/monthly caps. Optional verification stays under the
AI cleanup payment policy. Set APP_KILL_SWITCH=OPENAI_DISABLED to pause all AI
scanning; OCR_DISABLED also applies. BEDROCK_DISABLED is retained as an alias that
pauses optional cleanup for older operational configurations.

## Backend configuration

Install backend/requirements.txt and backend/requirements-aws.txt. Configure:
- OCR_PROVIDER=openai
- OPENAI_API_KEY: server-side secret, never in frontend/mobile variables or Git.
- OPENAI_OCR_MODEL=gpt-6-sol (configurable; benchmark alternatives before changing).
- OPENAI_OCR_MAX_OUTPUT_TOKENS=12000
- OPENAI_OCR_TIMEOUT_SECONDS=90
- OCR_CACHE_VERSION=openai-v1
- OCR_CACHE_LEASE_SECONDS=1200 (covers bounded sequential multi-page review).
- ALLOW_FREE_AI_FOR_TESTING=false

OpenAI usage is billed through the API project. Set current input/output prices
in OPENAI_INPUT_MICRO_USD_PER_MILLION_TOKENS and
OPENAI_OUTPUT_MICRO_USD_PER_MILLION_TOKENS. Defaults are zero/unknown and the usage
report marks pricing as unconfigured. Estimates do not include retry or failed
request charges, and cached-input discounts are conservatively ignored.
store=False disables Responses object storage; it does not itself establish
zero data retention. Review the project's data controls before making retention claims.

## Validation and rollout

Run .venv/Scripts/python.exe -m unittest discover -s backend/tests -v.
Tests cover multi-page review, legacy client routing, source preservation, refusals,
truncation, atomic correction patches, redacted API errors and usage accounting.

Before switching production, evaluate representative consented handwriting, math,
table and diagram pages against manually checked reference transcriptions. Compare
character/word error rates, formula symbol errors, omitted blocks, latency, and
actual cost with the existing implementation. The synthetic smoke test checks
connectivity and basic behavior; it does not prove improved handwriting accuracy.

Build/deploy the backend image, configure the server secret, test staging, then
deploy the web client. Update mobile clients through their normal release workflow.
Rollback by redeploying the previous image and client release with prior settings.
No production infrastructure has been changed by this source migration.

Official references:
- https://developers.openai.com/api/docs/guides/images-vision
- https://developers.openai.com/api/docs/guides/structured-outputs

