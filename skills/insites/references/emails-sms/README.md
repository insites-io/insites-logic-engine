# Email & SMS Templates

## Location

- Emails: `app/emails/`
- SMS: `app/smses/`

> **Module path:** When building a module, use `modules/<module_name>/private/emails/` and `modules/<module_name>/private/smses/` for email/SMS templates. These are typically private since they are triggered internally by module logic.

## Email Template

```liquid
{% comment %} app/emails/order_confirmation.liquid {% endcomment %}
---
to: '{{ data.email }}'
from: 'Shop <no-reply@insites.site>'
reply_to: support@example.com
subject: "Order #{{ data.order_id }} Confirmed"
layout: mailer
---
<h1>Thank you for your order!</h1>
<p>Your order #{{ data.order_id }} has been confirmed.</p>
<p>Total: {{ data.total | pricify }}</p>
```

## Front Matter Fields

| Field | Required | Description |
|-------|----------|-------------|
| `to` | Yes | Recipient email |
| `from` | Yes | Sender email |
| `reply_to` | No | Reply-to address |
| `subject` | Yes | Email subject |
| `layout` | No | Name of a layout in `app/views/layouts/` (`mailer`). Leave it out and the body is sent as written |
| `cc` | No | CC recipients |
| `bcc` | No | BCC recipients |

## Sending Emails

### Via GraphQL
```graphql
# app/graphql/emails/send_order_confirmation.graphql
mutation send($data: HashObject) {
  email_send(template: { name: "order_confirmation" }, data: $data) {
    is_scheduled_to_send
  }
}
```

### Best Practice: Send from a Background Job

```liquid
{% comment %} In command after creating order {% endcomment %}
{%- assign mail = { "to": order.email, "order_id": order.id, "total": order.total } -%}
{% background job_id = 'jobs/send_order_confirmation', mail: mail, source_name: 'event:order_created', priority: 'default', max_attempts: 3 %}
```

```liquid
{% comment %} app/views/partials/jobs/send_order_confirmation.liquid {% endcomment %}
{% graphql _ = 'emails/send_order_confirmation', data: mail %}
```

The job sees only what is passed to the tag, so build `mail` on the page and pass it.

## SMS Template

```liquid
{% comment %} app/smses/order_shipped.liquid {% endcomment %}
---
to: '{{ data.phone }}'
---
Your order #{{ data.order_id }} has been shipped! Track at: {{ data.tracking_url }}
```

## Email Layout (optional)

```liquid
{% comment %} app/views/layouts/mailer.liquid {% endcomment %}
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; }
  </style>
</head>
<body>
  {{ content_for_layout }}
  <footer>
    <p>&copy; {{ 'now' | date: '%Y' }} Your Company</p>
  </footer>
</body>
</html>
```

## Rules

- Send through a registered template by name, with `data` built as one Liquid variable
- Send from a background job so the request does not wait
- A layout is optional; use one (for example `mailer`) when several emails share styling
- Access template data via `data.*` variables
- Use translations for email content when supporting multiple languages
