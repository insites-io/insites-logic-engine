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
| `from` | Yes | String | Sender address. It must be one the instance can send from (`no-reply@insites.site`, or an address at a connected domain) |
| `reply_to` | No | String | Reply-to email address |
| `subject` | Yes | String | Email subject line with Liquid support |
| `layout` | No | String | Name of a layout in `app/views/layouts/`, without the extension (`mailer` for `app/views/layouts/mailer.liquid`). Leave it out and the body is sent as written |
| `cc` | No | String/Array | Carbon copy recipients |
| `bcc` | No | String/Array | Blind carbon copy recipients |

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
