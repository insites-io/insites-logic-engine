# Emails and SMS Configuration

## Overview

An email or SMS is a template file. Its front matter sets who it goes to and how; its body is the message. It is sent by name with the `email_send` or `sms_send` mutation, which passes it one `data` hash (see [api.md](api.md)).

## Email Configuration

Emails are defined in `app/emails/` with front matter metadata:

> **Module path:** In modules, email templates live in `modules/<module_name>/private/emails/` and SMS in `modules/<module_name>/private/smses/`. These are typically private since they are triggered internally by module logic.

```yaml
---
to: '{{ data.to }}'
from: 'My Site <no-reply@insites.site>'
reply_to: 'help@example.com'
subject: 'Welcome, {{ data.first_name }}'
layout: 'mailer'
cc: 'manager@example.com'
bcc: 'archive@example.com'
---
```

The template sees only what the mutation passed as `data`, so every value comes from `data`.

### Front Matter Parameters

| Parameter | Required | Type | Description |
|-----------|----------|------|-------------|
| `to` | Yes | String | Recipient email address, usually `'{{ data.to }}'` |
| `from` | Yes | String | Sender address. It must be one the instance can send from (`no-reply@insites.site`, or an address at a connected domain). See [Sending from the instance's verified sender](#sending-from-the-instances-verified-sender) |
| `reply_to` | No | String | Reply-to email address |
| `subject` | Yes | String | Email subject line with Liquid support |
| `layout` | No | String | Name of a layout in `app/views/layouts/`, without the extension (`mailer` for `app/views/layouts/mailer.liquid`). Leave it out and the body is sent as written |
| `cc` | No | String/Array | Carbon copy recipients |
| `bcc` | No | String/Array | Blind carbon copy recipients |

## Sending from the instance's verified sender

The `from` must be an address the instance can authenticate. A customer's own domain that is not verified for the instance fails the receiving server's SPF, DKIM and DMARC checks, so do not put an address from CMS Globals or a form field in `from`. The v6 CRM module works out the instance's sender for you. These are internal functions of the CRM module, not published controllers, so their arguments and return keys can change between releases; read here from module-v6-crm v6.1.4:

```liquid
{%- function resolved = 'modules/insites_crm/functions/email_sender/resolve' -%}
{%- function customer = 'modules/insites_crm/functions/email_sender/customer_sender', sender: resolved -%}
```

| Key on `customer` | Meaning |
|---|---|
| `address` | The address to send from. The instance's verified domain sender when Insites Console has set one up; otherwise `no-reply@insites.site` |
| `is_sendable` | `true` when `address` can be used. `false` for a suspended instance (`validation_status` `suspended`), which gets no fallback |
| `name` | The sender's display name, when one is stored |
| `mode` | Where the address came from: `console`, `platform_default`, or the stored sender's mode (`custom_domain`, `own_sendgrid`, `fallback`, `unprovisioned`) |

`customer_sender` does not choose the display name or the Reply-To. The CRM module's own autoresponders use `company_name` from CMS Globals as the display name and `company_email_1` as the Reply-To, and app-seedling 2.1.0 does the same:

```liquid
{%- include 'modules/insites_cms/globals' -%}
{%- liquid
  assign global = context.exports.global
  assign from_name = global.company_name | default: customer.name | default: '' | strip
  assign reply_to = global.company_email_1 | default: '' | strip
  if customer.is_sendable != true or customer.address == blank
    log 'No sendable sender on this instance. Check its email sender in Insites Console.', type: 'error'
  endif
-%}
```

app-seedling puts this in partials that the email's front matter includes, one printing `Name < address >` and one printing the Reply-To:

```yaml
---
from: >
  {%- include 'emails/autoresponder_from' -%}
reply_to: >
  {%- include 'emails/autoresponder_reply_to' -%}
---
```

Measured on one v6 staging instance on 15 October 2026 (TW#26876514), whose sender resolved to `no-reply@insites.site`, by reading the instance's sent-email log: with no Globals record the sign-in email went `from` `< no-reply@insites.site >` with an empty `reply_to`; with `company_name` "Seedling QA" and `company_email_1` set, it went `from` `Seedling QA < no-reply@insites.site >` with that address as `reply_to`. Delivery to an inbox was not part of the measurement.

## Email Layouts

A layout is optional. When several emails share styling, put it in `app/views/layouts/`, commonly as `mailer.liquid`, and name it in each email's `layout`:

```liquid
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; }
  </style>
</head>
<body>
  {{ content_for_layout }}
</body>
</html>
```

`{{ content_for_layout }}` is where the email's body goes. Without it the layout is sent with no content.

## SMS Configuration

SMS messages are defined in `app/smses/`. The front matter needs `to`; the body is the message:

```liquid
---
to: '{{ data.phone }}'
---
Your code is {{ data.code }}.
```

### SMS Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `to` | Yes | Phone number with its country code, usually `'{{ data.phone }}'` |

Other SMS front matter keys were not measured.

## Data Access

Values reach the template through the mutation's `data` argument. Build it in Liquid as one variable and pass it whole:

```liquid
{%- assign mail = { "to": user.email, "order": { "id": order.id, "total": order.total } } -%}
{%- graphql sent = 'emails/send_order_confirmation', data: mail -%}
```

Read it in the template as `{{ data.order.id }}` or `{{ data.order.total }}`.

## File Structure

```
app/
├── emails/
│   ├── welcome.liquid
│   ├── password_reset.liquid
│   └── order_confirmation.liquid
├── smses/
│   ├── sms_verification.liquid
│   └── order_shipped.liquid
└── views/layouts/
    └── mailer.liquid      (optional)
```

## Best Practices

1. **Read every value from `data`**, in the front matter and the body
2. **Leverage Liquid filters** for date/currency formatting
3. **Keep layouts minimal** for email compatibility
4. **Test with real data** before production
5. **Version control templates** alongside code

## See Also

- [Emails and SMS API Reference](./api.md)
- [Common Patterns](./patterns.md)
- [Known Gotchas](./gotchas.md)
- [Advanced Techniques](./advanced.md)
