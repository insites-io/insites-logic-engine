# Emails and SMS Configuration

## Overview

An email or SMS is a template file. Its front matter sets who it goes to and how; its body is the message. It is sent by name with the `email_send` or `sms_send` mutation, which passes it one `data` hash (see [api.md](api.md)).

## Email Configuration

Emails are defined in `app/emails/` with front matter metadata:

> **Module path:** In a module, emails live in `modules/<module_name>/private/notifications/email_notifications/<name>.liquid` with `name:` in the front matter. See [Emails in a module](#emails-in-a-module).

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
| `from` | Yes | String | Sender address. It must be one the instance can send from: any address at `insites.site`, or an address at a connected domain with email live. Any other address is refused after `email_send` answers `true`. See [Which From addresses are accepted](#which-from-addresses-are-accepted) |
| `reply_to` | No | String | Reply-to email address |
| `subject` | Yes | String | Email subject line with Liquid support |
| `layout` | No | String | Name of a layout in `app/views/layouts/`, without the extension (`mailer` for `app/views/layouts/mailer.liquid`). Leave it out and the body is sent as written |
| `cc` | No | String/Array | Carbon copy recipients |
| `bcc` | No | String/Array | Blind carbon copy recipients |
| `unique_args` | No | String | A JSON object written as a string, Liquid allowed, sent to the email provider so it comes back on every delivery event. See [Tagging a send: `unique_args`](#tagging-a-send-unique_args) |

## Emails in a module

The IIA v6 modules keep every email in `private/notifications/email_notifications/`, one file per email, with `name:` in the front matter. Read on master on 20 October 2026: module-v6-crm v6.1.4 has `insites_internal_email`, `insites_external_email` and `test_send` (`email_invitation_accepted` and `email_new_administrator` sat in the same folder until v6.1.3 removed them, when invitations moved to Insites Console); module-v6-forms has `test_email_default_template`, `test_email_cms_layout` and `test_email_visual_editor`. No v6 module has a `private/emails/` directory.

`modules/insites_crm/private/notifications/email_notifications/insites_internal_email.liquid` (v6.1.4) opens:

```yaml
---
name: insites_internal_email
enabled: true
delay: 0
trigger_condition: true
```

and is followed by `subject`, `to`, `from`, `reply_to`, `cc`, `bcc` and `layout`. A module sends its email with the module prefix, `modules/<module_name>/<name>`, as in the CRM's `private/graphql/emails/send_test.graphql`:

```graphql
mutation send_test($data: HashObject!) {
  email_send(
    data: $data
    template: { name: "modules/insites_crm/test_send" }
  ) {
    errors {
      message
    }
    is_scheduled_to_send
  }
}
```

The platform accepts `emails/<name>.liquid` as well: the schema describes an email's `physical_file_path` as `emails/<name>.liquid` "(or legacy `notifications/email_notifications/<name>.liquid`), optionally prefixed with `modules/<module_name>/public/` or `modules/<module_name>/private/`", and marks `name` deprecated because it is derived from the path. The IIA modules use the second form and still set `name:`; follow them when you add an email to an IIA module. SMS works the same way (`smses/<name>.liquid` or `notifications/sms_notifications/<name>.liquid`); no v6 module sends SMS.

## Tagging a send: `unique_args`

`unique_args` in an email's front matter is sent to SendGrid as the `unique_args` of the message's `X-SMTPAPI` header, and SendGrid echoes those keys on every delivery event (delivered, bounce, open, click). Use it to tie an event back to your own record of the send.

Write it as a JSON object inside a YAML string. Liquid inside the string renders with the email's `data`. A YAML hash is refused at deploy. Measured on an Insites instance on 5 October 2026.

The v6 CRM module stamps the id of its Email Logs row this way from v6.1.3. `modules/insites_crm/private/notifications/email_notifications/test_send.liquid` in v6.1.4 (release/v6.1.5 adds `cc` and `bcc`):

```yaml
---
name: test_send
to: '{{ data.to }}'
delay: 0
enabled: true
trigger_condition: true
from: '{{ data.from }}'
reply_to: '{{ data.reply_to }}'
# TW#26847666: the prefix is set by functions/emails/send_logged: '[Test] ' for a test send, empty for a resend.
subject: '{{ data.subject_prefix }}{{ data.subject }}'
# TW#26847666: SendGrid echoes unique_args on every delivery event, so the event finds its
# Email Logs row. A JSON string, never a YAML hash (the platform refuses that with a 422).
unique_args: '{"email_log_id":"{{ data.email_log_id }}"}'
layout: >
  {%- if data.layout != blank -%}
  {{ data.layout }}
  {%- else -%}
  modules/insites_crm/insites_external_email_layout
  {%- endif -%}
---
```

The value comes from `data`. `functions/emails/send_logged` creates the Email Logs row first, adds its id to the data, then sends:

```liquid
graphql log_result = 'modules/insites_crm/email_logs/create_email_log', uuid: log_uuid, sent_at: sent_at, email_name: email_name, module: module, to: data.to, ...
assign log_id = log_result.items.id | append: ''
...
assign send_data = data | add_hash_key: 'email_log_id', log_id | add_hash_key: 'subject_prefix', prefix
graphql result = 'modules/insites_crm/emails/send_test', data: send_data
```

`send_test.graphql`, shown [above](#emails-in-a-module), sends it. On the way back, the CRM's event receiver (`controllers/emails/email_logs/record_events`) reads `email_log_id` as a top-level key of each SendGrid event, where SendGrid puts custom arguments, and falls back to a nested `unique_args` object.

Only a file-based email can carry `unique_args`. An email notification stored in the database, such as a Form Builder notification, cannot; see [gotchas](gotchas.md#a-database-stored-notification-cannot-carry-unique_args).

`unique_args` is not in the GraphQL schema: `EmailNotification` and `EmailNotificationInputType` have no such field (introspected 20 October 2026), so it cannot be read back through the admin API.

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

### Which From addresses are accepted

Measured on a v6 production instance on 20 October 2026, with four `email_send` calls that differed only in `from`, each to the same recipient:

| `from` | `is_scheduled_to_send` | Sent-notification record |
|---|---|---|
| `Insites <no-reply@insites.site>` | `true` | Written |
| `Migrations <migrations@insites.site>` | `true` | Written |
| `Probe <probe-tw26904307@insites.site>`, a local part never set up anywhere | `true` | Written |
| `Probe <probe@example.com>`, a domain not connected to the instance | `true` | **None**: refused after scheduling |

So any address at `insites.site` is accepted on a production instance, and so, per the Insites docs, is an address at a connected domain with email live (not tested here). Any other From is refused silently: `email_send` has already answered `true`, and no record is written ([gotchas](gotchas.md#a-refused-send-looks-sent)). Delivery past the record, whether SendGrid accepted or bounced the message, was not checked.


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
