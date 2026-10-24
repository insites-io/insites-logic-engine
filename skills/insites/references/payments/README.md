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

## Carts, orders and checkout

Insites is the backend. The Ecommerce module gives every instance the tables a shop needs, including `modules/insites_ecommerce/cart`, `cart_item`, `order`, `product` and `product_variant`. It does not ship a storefront: how a project shows its cart and takes payment is the project's decision, because every shop is different.

Two official Insites templates show one way to build it, and are the place to start:

- [`insites-io/app-portal`](https://github.com/insites-io/app-portal): the Insites Website & Portal template.
- [`insites-io/addon-ecommerce`](https://github.com/insites-io/addon-ecommerce): the Ecommerce add-on, which adds a catalog, cart, checkout and order history on top of the Website & Portal template, writing to the Ecommerce module's tables.

The rest of this page covers the payment call itself.

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

File: `modules/dashboard/public/views/pages/api/_external/v2/stripe/webhook.json.liquid`. The front matter comes first in the file; a comment above it stops it being read as front matter.

```liquid
---
slug: api/_external/v2/stripe/webhook
method: post
format: json
---
{% liquid
  comment
    Verify before acting. Stripe signs "<t>.<raw body>" with HMAC-SHA256 and sends
    Stripe-Signature: t=<unix seconds>,v1=<hex>[,v1=<hex>...]
  endcomment
  assign secret = context.constants.stripe_webhook_secret
  assign header = context.headers.HTTP_STRIPE_SIGNATURE
  assign raw = context.post_params
  assign t = ''
  assign given = '[]' | parse_json
  assign parts = header | default: '' | split: ','
  for part in parts
    assign kv = part | strip | split: '='
    if kv[0] == 't'
      assign t = kv[1]
    elsif kv[0] == 'v1'
      assign given = given | array_add: kv[1]
    endif
  endfor

  assign verified = false
  if secret != blank and t != blank and raw != blank
    assign signed_payload = t | append: '.' | append: raw
    assign expected = signed_payload | compute_hmac: secret
    comment
      Reject replays: refuse a timestamp more than five minutes from now.
    endcomment
    assign now = 'now' | strftime: '%s' | plus: 0
    assign age = now | minus: t
    if given contains expected and age <= 300 and age >= -300
      assign verified = true
    endif
  endif

  if verified
    assign event = raw | parse_json
    case event.type
      when 'checkout.session.completed'
        graphql res = 'modules/dashboard/payments/mark_paid', session_id: event.data.object.id
      when 'invoice.payment_failed'
        graphql res = 'modules/dashboard/payments/mark_failed', invoice_id: event.data.object.id
    endcase
    response_status 200
    print '{"received":true}'
  else
    response_status 400
    print '{"error":"invalid signature"}'
  endif
%}
```

This page was run on a v6 production instance on 24 October 2026, with a literal secret in place of the constant and the two `graphql` calls replaced by an `assign`. A correct signature, and a correct signature sent as the second of two `v1` values, answered 200. A signature made with another secret, a timestamp ten minutes old, no `Stripe-Signature` header, and a body changed after signing each answered 400.

What it rests on, measured the same day:

- **`context.post_params` is the raw request body**, byte for byte. A JSON POST with no authenticity token reached the page and `context.post_params` held the exact string sent. Stripe signs those bytes, so verify against them, never against `context.params` re-serialized.
- **`compute_hmac` with only the secret is HMAC-SHA256 as lowercase hex**, the format of Stripe's `v1` value. The instance's output matched a locally computed HMAC-SHA256 of the same body and key.
- **The header arrives as `context.headers.HTTP_STRIPE_SIGNATURE`**, keyed the CGI way (see [objects gotchas](../liquid/objects/gotchas.md)).

Rules that follow:

- **An empty secret must fail closed.** The `secret != blank` check is not optional: a missing constant would otherwise compare blank with blank.
- **Answer 400 on a mismatch and do nothing else.** Stripe retries a non-2xx delivery, so a real event that failed because of a misconfigured secret is not lost.
- **`stripe_webhook_secret` is the endpoint's signing secret** (`whsec_...`) from the Stripe dashboard, not the API secret key, and it differs between test and live mode.
- Only `v1` signatures count. Stripe may send several `v1` values while a secret is being rolled; accept any one of them.

## Open work / known gaps

This stub does not yet cover: subscription lifecycle (trialing → active → past_due), refunds, customer portal links, multi-currency, Stripe Connect / marketplace flows, idempotency keys. Add as concrete walkthroughs are written from real production integrations.

## See Also

- [`api-calls/`](../api-calls/README.md) — outbound HTTP from Liquid
- [`constants/`](../constants/README.md) — storing Stripe keys per environment
- [`forms/`](../forms/README.md) — invoking payment flows via form definitions
- [`api-endpoints/`](../api-endpoints/README.md) — receiving webhooks
