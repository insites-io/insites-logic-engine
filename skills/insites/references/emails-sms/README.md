# Email & SMS Templates

## Location

- Emails: `app/emails/`
- SMS: `app/smses/`

> **Module path:** When building a module, use `modules/<module_name>/private/emails/` and `modules/<module_name>/private/smses/` for email/SMS templates. These are typically private since they are triggered internally by module logic.

## Email Template

```liquid
{% comment %} app/emails/order_confirmation.liquid {% endcomment %}
---
to: {{ data.email }}
from: shop@example.com
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
| `layout` | No | Layout template name |
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

### Best Practice: Send via Events

```liquid
{% comment %} In command after creating order {% endcomment %}
{% background source_name: 'event:order_created', priority: 'default', max_attempts: 3 %}
  {% comment %} Consumer: app/lib/consumers/order_created/send_email.liquid {% endcomment %}
  {%- assign mail = { "to": order.email, "order_id": order.id, "total": order.total } -%}
  {% graphql _ = 'emails/send_order_confirmation', data: mail %}
{% endbackground %}
```

## SMS Template

```liquid
{% comment %} app/smses/order_shipped.liquid {% endcomment %}
---
to: {{ data.phone }}
---
Your order #{{ data.order_id }} has been shipped! Track at: {{ data.tracking_url }}
```

## Email Layout

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

- Use events + consumers for async email sending
- Always define a `mailer` layout for consistent email styling
- Access template data via `data.*` variables
- Use translations for email content when supporting multiple languages
