# Emails and SMS API Reference

## Overview

Insites sends email and SMS with two GraphQL mutations, `email_send` and `sms_send`. Each one renders a template you registered in `app/emails/` or `app/smses/` and passes it a `data` hash. The signatures below are from the platform schema (`graphql/schema/schema.json`).

## GraphQL Mutations

### email_send

```graphql
mutation send_welcome($data: HashObject) {
  email_send(template: { name: "welcome" }, data: $data) {
    is_scheduled_to_send
  }
}
```

Build `data` as **one** Liquid variable and pass it whole:

```liquid
{%- assign mail = { "to": user.email, "first_name": user.first_name } -%}
{%- graphql sent = 'emails/send_welcome', data: mail -%}
```

The template reads it as `data`: `to: '{{ data.to }}'` in its front matter, `{{ data.first_name }}` in its body.

| Argument | Type | Description |
|---|---|---|
| `template` | `NotificationTemplateInput` | `{ name: "welcome" }`, the file name under `app/emails/` without `.liquid` |
| `data` | `HashObject` | Variables the template reads as `data` |
| `email` | `NotificationEmailInput` | Inline email: `to`, `from`, `subject`, `content` required; `cc`, `bcc`, `reply_to`, `delay` (minutes) optional |

The payload is `is_scheduled_to_send: Boolean!` (its `errors` field is deprecated).

**Send through a registered template.** Measured on Insites instances in October 2026: an inline `email: {...}` with no `template`, and a `data` written as a GraphQL object literal with variables inside it, both answer `is_scheduled_to_send: true` and send nothing. A template called by name with `data` passed as one variable delivered in 1 to 3 seconds. So `is_scheduled_to_send: true` is not proof of delivery.

### sms_send

```graphql
mutation send_code($data: HashObject) {
  sms_send(template: { name: "verification" }, data: $data) {
    is_scheduled_to_send
  }
}
```

| Argument | Type | Description |
|---|---|---|
| `template` | `NotificationTemplateInput` | `{ name: "verification" }`, a template under `app/smses/` |
| `data` | `HashObject` | Variables the template reads as `data` |
| `sms` | `SmsSendInput` | Inline SMS: `to` and `content` required, `delay` in minutes (default 0) |

The SMS path was not measured. Treat it like email until it is: template by name, `data` as one variable.

## Template Variable Access

Within email and SMS templates, read what you passed as `data`:

```liquid
Hello {{ data.first_name }},

Your order #{{ data.order_id }} has been confirmed.
```

## Sending Later

Neither mutation takes a delay for a template send. Run it in a background job, whose `delay` is in minutes:

```liquid
{% background delay: 1440, source_name: 'reminder_email' %}
  {%- graphql sent = 'emails/send_reminder', data: mail -%}
{% endbackground %}
```

## What the Schema Does Not Have

- **No attachment argument** on `email_send`.
- **No query for delivery status.** The mutation answers whether the send was queued, nothing more.

## See Also

- [Configuration Guide](./configuration.md)
- [Common Patterns](./patterns.md)
- [Known Gotchas](./gotchas.md)
- [Advanced Techniques](./advanced.md)
