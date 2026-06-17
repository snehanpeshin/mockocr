# Stripe Setup For Cleanote

Cleanote uses one Stripe account owned by Karigari Home LLC. Checkout pages are branded as
Cleanote by setting the Checkout Session `branding_settings.display_name` to `Cleanote`.

## Stripe Products And Prices

Create these products in the same Stripe account:

1. Cleanote Monthly Premium
   - Price: $9.99 USD
   - Pricing type: recurring monthly
   - Copy the Product ID and Price ID.

2. Cleanote Annual Premium
   - Price: $99 USD
   - Pricing type: recurring yearly
   - Copy the Product ID and Price ID.

Set the IDs in the backend environment:

```bash
STRIPE_CLEANOTE_MONTHLY_PREMIUM_PRODUCT_ID=prod_...
STRIPE_CLEANOTE_MONTHLY_PREMIUM_PRICE_ID=price_...
STRIPE_CLEANOTE_ANNUAL_PREMIUM_PRODUCT_ID=prod_...
STRIPE_CLEANOTE_ANNUAL_PREMIUM_PRICE_ID=price_...
```

## Backend Environment Variables

```bash
STRIPE_SECRET_KEY=sk_live_or_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_CLEANOTE_MONTHLY_PREMIUM_PRODUCT_ID=prod_...
STRIPE_CLEANOTE_MONTHLY_PREMIUM_PRICE_ID=price_...
STRIPE_CLEANOTE_ANNUAL_PREMIUM_PRODUCT_ID=prod_...
STRIPE_CLEANOTE_ANNUAL_PREMIUM_PRICE_ID=price_...
STRIPE_PAYMENT_TABLE_NAME=cleanote-payments
STRIPE_SUBSCRIPTION_TABLE_NAME=cleanote-subscriptions
ADMIN_DASHBOARD_TOKEN=use_a_long_random_secret
FRONTEND_ORIGINS=https://cleanote.in,https://www.cleanote.in,https://main.d3vhgcrptn13ws.amplifyapp.com
```

Never expose `STRIPE_SECRET_KEY` or `STRIPE_WEBHOOK_SECRET` in frontend code.

## Frontend Environment Variables

```bash
NEXT_PUBLIC_API_BASE_URL=https://your-cleanote-backend-url
```

## DynamoDB Schema

### Payments Table

Table name: `cleanote-payments`

Primary key:

```text
stripe_session_id string partition key
```

Attributes saved for each completed checkout:

```text
customer_name
customer_email
stripe_customer_id
stripe_session_id
amount
amount_minor
currency
dba_name
product_name
product_key
payment_date
mode
stripe_subscription_id
created_at
```

### Subscriptions Table

Table name: `cleanote-subscriptions`

Primary key:

```text
stripe_subscription_id string partition key
```

Attributes:

```text
stripe_subscription_id
stripe_customer_id
customer_email
status
price_id
product_id
product_key
product_name
dba_name
current_period_start
current_period_end
cancel_at_period_end
latest_event_type
updated_at
```

## IAM Task Role Permissions

Add these permissions to the ECS task role:

```json
{
  "Effect": "Allow",
  "Action": [
    "dynamodb:PutItem",
    "dynamodb:GetItem",
    "dynamodb:Scan",
    "dynamodb:UpdateItem"
  ],
  "Resource": [
    "arn:aws:dynamodb:us-east-1:924225826927:table/cleanote-payments",
    "arn:aws:dynamodb:us-east-1:924225826927:table/cleanote-subscriptions"
  ]
}
```

## Webhook Endpoint

Create a Stripe webhook endpoint:

```text
https://your-cleanote-backend-url/api/stripe/webhook
```

Subscribe to:

```text
checkout.session.completed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
```

Copy the webhook signing secret into:

```bash
STRIPE_WEBHOOK_SECRET=whsec_...
```

The backend verifies the raw request body with the `Stripe-Signature` header before saving events.

## API Endpoints

Create Checkout Session:

```http
POST /api/stripe/checkout-session
```

```json
{
  "product_key": "cleanote_monthly_premium",
  "customer_email": "student@example.com",
  "success_url": "https://cleanote.in/billing?status=success",
  "cancel_url": "https://cleanote.in/billing?status=cancelled"
}
```

Create Payment Link:

```http
POST /api/stripe/payment-link
X-Admin-Token: your_admin_token
```

```json
{
  "product_key": "cleanote_annual_premium"
}
```

Admin revenue dashboard:

```http
GET /api/admin/revenue
X-Admin-Token: your_admin_token
```

Frontend pages:

```text
/billing
/admin
```
