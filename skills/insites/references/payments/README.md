# Payments (Stripe)

Insites integrates payments via Stripe using the `api_calls/` outbound-HTTP pattern + `constants/` for secrets. There is no built-in payments module — the integration is assembled from primitives.

> **Status:** lean stub. The full walkthrough (Checkout Sessions, webhooks, subscription lifecycle) is planned but not yet written; this document captures the canonical shape so new code lands in the right place.

## Building blocks

| Concern | Where it lives |
|---|---|
| Secret keys | `insites-cli constants set --name stripe_sk_live --value "sk_live_..." prod` (and `stripe_sk_test` for non-prod). See [`constants/`](../constants/README.md). |
| Outbound HTTP to Stripe | `modules/<name>/public/api_calls/stripe/<operation>.liquid`. See [`api-calls/`](../api-calls/README.md). |
| Webhook receiver | `.json.liquid` page under `modules/<name>/public/views/pages/api/_external/v2/stripe/webhook.json.liquid` with its own signing-secret check. |
| Form-driven payment flow | Form definition in `forms/<name>.liquid` whose `callback_actions` invoke the Stripe `api_call` and persist the resulting payment intent / charge. |

## Minimal Checkout Session call

The call that is measured working is the inline `api_call_send` mutation from a page (a v6 instance, 5 and 6 October 2026, TW#26855354). It needs no API call file:

```liquid
{%- capture body -%}mode=payment&line_items[0][price]={{ price_id }}&line_items[0][quantity]={{ quantity | default: 1 }}&success_url={{ success_url | url_encode }}&cancel_url={{ cancel_url | url_encode }}{%- endcapture -%}
{%- parse_json headers -%}
{ "Authorization": "Bearer {{ context.constants.stripe_sk_live }}", "Content-Type": "application/x-www-form-urlencoded" }
{%- endparse_json -%}
{%- graphql r, h: headers, b: body -%}
mutation ($h: HashObject, $b: String) {
  api_call_send(api_call: { url: "https://api.stripe.com/v1/checkout/sessions", method: "POST", headers: $h, body: $b }, options: { timeout: 5 }) {
    response { status body }
  }
}
{%- endgraphql -%}
{%- assign session = r.api_call_send.response.body | parse_json -%}
```

The same request as an API call **file** uses the file keys (`to`, `request_type`, `request_headers`), not `method:` and `headers:`; see [`api-calls/`](../api-calls/README.md). An earlier version of this stub mixed the two vocabularies.

Invoke from a form's `callback_actions`:

```liquid
{%- include 'modules/dashboard/api_calls/stripe/create_checkout_session',
    price_id: form.price_id,
    success_url: 'https://example.com/checkout/success',
    cancel_url: 'https://example.com/checkout/cancel' as session -%}
{%- if session.response.status >= 300 -%}
  {%- form_set_error 'Payment provider error: ' | append: session.response.body -%}
{%- else -%}
  {%- redirect_to session.response.body.url -%}
{%- endif -%}
```

## Webhook receiver

```liquid
{% comment %} modules/dashboard/public/views/pages/api/_external/v2/stripe/webhook.json.liquid {% endcomment %}
---
slug: api/_external/v2/stripe/webhook
method: post
---
{% liquid
  assign signature = context.headers.HTTP_STRIPE_SIGNATURE
  assign expected = context.constants.stripe_webhook_secret

  comment %} TODO: signature-verification helper — Stripe HMAC-SHA256 over (timestamp + . + body) {% endcomment

  case context.params.type
    when 'checkout.session.completed'
      graphql res = 'modules/dashboard/payments/mark_paid', session_id: context.params.data.object.id
    when 'invoice.payment_failed'
      graphql res = 'modules/dashboard/payments/mark_failed', invoice_id: context.params.data.object.id
  endcase

  response_status 200
  print '{"received":true}'
%}
```

The webhook page is unauthenticated by request token — its identity comes from the Stripe-signed `Stripe-Signature` header, which the page must verify against `stripe_webhook_secret`.

## Open work / known gaps

This stub does not yet cover: subscription lifecycle (trialing → active → past_due), refunds, customer portal links, multi-currency, Stripe Connect / marketplace flows, idempotency keys, webhook signature verification helper. Add as concrete walkthroughs are written from real production integrations.

## See Also

- [`api-calls/`](../api-calls/README.md) — outbound HTTP from Liquid
- [`constants/`](../constants/README.md) — storing Stripe keys per environment
- [`forms/`](../forms/README.md) — invoking payment flows via form definitions
- [`api-endpoints/`](../api-endpoints/README.md) — receiving webhooks
