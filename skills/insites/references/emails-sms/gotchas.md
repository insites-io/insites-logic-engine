# Emails and SMS Gotchas

## Overview

Common pitfalls and troubleshooting tips for email and SMS implementation in Insites.

## Email Delivery Issues

### Front Matter Variables Not Interpolating

Front matter must be valid YAML. Use quotes for Liquid:

```yaml
---
to: '{{ data.to }}'
subject: "Order #{{ data.order_id }} Confirmed"
---
```

Without quotes, YAML parsing fails silently.

### Layout Not Found Error

`layout` is optional. When you set it, name a file in `app/views/layouts/` without the folder or extension:

```yaml
---
layout: 'mailer'
---
```

Not: `layout: 'app/views/layouts/mailer'`

### Template Variables Scope Issues

Data passed to email must be in `data` object:

```liquid
{%- assign mail = { "to": "user@example.com", "user_name": "John", "company": "Acme" } -%}
{%- graphql sent = 'emails/send_welcome', data: mail -%}
```

with `emails/send_welcome.graphql` holding `email_send(template: { name: "welcome" }, data: $data)`. A GraphQL object literal with `$variables` inside it as `data` is refused when the query is parsed (`argumentLiteralsIncompatible`); see [api](api.md#email_send).

Access as `{{ data.user_name }}`, not `{{ user_name }}`.

### A Refused Send Looks Sent

`email_send` answers `is_scheduled_to_send: true` for an email the mail server later refuses. Measured on 5 October 2026: a send refused with a 550 showed up only in the instance logs, as a `BackgroundJob Error` with no recipient, sender or subject, and no `admin_sent_notifications` record was written for it. The send cannot be told apart from a delivered one from the mutation's answer or the sent-notification list.

The 14 October release (live from 15 October 2026) says a refused email's `MailNotSent` log entry now carries the mail server's reason, the notification name, the recipients and the subject ([platform changes](../platform-changes-2026.md#14-october-stable-graphql-names-schema-descriptions-refused-emails)). That was not re-measured, and the release does not say that a refused send gets a sent-notification record.

A blank `to` or `from` is accepted the same way: `email_send` answers `true` and the email never leaves, with no error (recorded in module-v6-crm's `functions/emails/send_logged`, TW#26887904).

So when refusals have to be visible to someone, write your own row before you send, and mark it yourself:

1. Create the row (recipient, sender, subject, a `status`) and keep its id.
2. Refuse a blank `to` or `from` yourself, on the row, before sending.
3. Send with the row id in [`unique_args`](configuration.md#tagging-a-send-unique_args).
4. If `is_scheduled_to_send` is not `true`, store the mutation's `errors` on the row.
5. Let the email provider's delivery events (bounce, dropped, delivered) update the row by the id they echo back.

The v6 CRM module's Email Logs work this way (`functions/emails/send_logged`, with `unique_args` from v6.1.3). A 550 that only reaches the instance log still needs something that reads the log: for Email Logs, a log monitor in the Insites backend posts it to the CRM as a `refused` event (`controllers/emails/email_logs/record_events`).

### `unique_args` Written as a YAML Hash

`unique_args` is a JSON string, not a YAML mapping. This deploys:

```yaml
unique_args: '{"email_log_id":"{{ data.email_log_id }}"}'
```

and this is refused at deploy (measured 5 October 2026):

```yaml
unique_args:
  email_log_id: '{{ data.email_log_id }}'
```

See [configuration](configuration.md#tagging-a-send-unique_args).

### A Database-Stored Notification Cannot Carry `unique_args`

An email notification created with `admin_email_notification_create` or changed with `admin_email_notification_update`, which is how the Form Builder stores each form's emails, has no way to set `unique_args`. The input type has no such field, so sending one answers `argumentNotAccepted`, and a `unique_args` key inside `metadata` is ignored at send time (measured 19 October 2026). `EmailNotificationInputType` in the schema has no `unique_args` (introspected 20 October 2026). Every Form Builder email up to Forms v6.1.1 therefore leaves with empty `unique_args`, and its delivery events cannot be matched to a send.

The workaround the CRM and Forms modules use since 19 and 20 October 2026 is to send from the notification's `trigger_condition` and stop the platform's own send; see [advanced](advanced.md#logging-a-database-stored-notifications-send).

### Property Names to Avoid

A table property cannot be named `errors` or `model`: deploy refuses it with `Name not allowed name, list of restricted names: errors, model`. See [schema gotchas](../schema/gotchas.md#restricted-property-names-errors-and-model).

## Missing Context Variables

Variables undefined in templates render as empty strings. Always provide defaults:

```liquid
Hello {{ data.user.first_name | default: 'Customer' }},
```

## Email Authentication Issues

### SPF/DKIM/DMARC Failures

Send only from an address the instance is verified for: the domain set up in Insites Console, or an address at `insites.site`. Any other From is refused after `email_send` answers `true`, with no sent-notification record ([configuration](configuration.md#which-from-addresses-are-accepted)). The CRM module resolves it for you; see [configuration](configuration.md#sending-from-the-instances-verified-sender).

```yaml
---
from: 'noreply@yourdomain.com'
---
```

Not: `from: 'noreply@some-other-domain.com'`, a domain you do not control

### Reply-To on Another Domain

SPF, DKIM and DMARC check the `from` domain, not the Reply-To. Send from the instance's verified sender and put the customer's own address in `reply_to`, as the v6 CRM module's autoresponders and app-seedling 2.1.0 do; see [configuration](configuration.md#sending-from-the-instances-verified-sender):

```yaml
---
from: 'Acme <no-reply@insites.site>'
reply_to: 'hello@acme.example'
---
```

Whether a mailbox provider scores a Reply-To on another domain differently was not measured.

## SMS Specific Issues

### Character Encoding Problems

SMS has 160-character limit (or 153 with multi-part). Check encoding:

```liquid
{% assign message = "Your code: {{ data.code }}" %}
{% assign length = message | size %}
{% if length > 160 %}
  Warning: SMS will be split into multiple messages
{% endif %}
```

### Invalid Phone Numbers

Validate phone format before sending:

```graphql
mutation send_sms($data: HashObject) {
  sms_send(template: { name: "verification" }, data: $data) {
    is_scheduled_to_send
  }
}
```

Phone must include country code: `+1234567890`

## HTML Email Rendering

### Inline Styles Required

Many email clients strip external stylesheets. Use inline styles:

```html
<table style="width: 100%; border-collapse: collapse;">
  <tr style="background-color: #f0f0f0;">
    <td style="padding: 10px; border: 1px solid #ccc;">
      Content
    </td>
  </tr>
</table>
```

### Dark Mode Incompatibility

Use `preheader` text and test dark mode rendering:

```html
<div style="display:none; max-height:0; overflow:hidden;">
  Preview text shown in inbox list
</div>
```

## Event Consumer Timing

### Race Conditions with Events

Events are processed asynchronously. Ensure data exists before sending:

```liquid
{% graphql user_check = 'check_user_exists' user_id: event.payload %}
{% if user_check.user %}
  {%- assign mail = { "to": user_check.user.email } -%}
  {% graphql result = 'emails/send_welcome', data: mail %}
{% endif %}
```

### Consumer Not Triggering

Check consumer handle matches event name exactly:

```yaml
---
handle: user_welcome_event_consumer
events: ['user/welcome']
---
```

Event name must match: `send_event('user/welcome', payload)`

## Notifications on a New Instance

### A New v6 Instance Does Not Suppress Email

A new v6 instance sends email for real from the start. There is no suppression or sandbox mode. Data loaded into a production instance can fire autoresponders and workflow emails to real people, for example when a form submission or a record create triggers a notification. Load data with notifications switched off, or into an instance whose email recipients you control, and switch notifications on once the load is checked.

### Updating a Notification Resets Fields You Leave Out

`UpdateEmailNotificationInputType` is not a partial update: the schema gives `trigger_condition` a default of `"true"` and `delay_by` a default of `"0"`. When `trigger_condition` and `delay_by` are omitted, the update writes those defaults, so an update that changes only the subject switches a disabled notification back on. Attaching a form to a notification resets them the same way. Measured in September and October 2026.

```graphql
mutation {
  admin_email_notification_update(id: 123, email_notification: {
    subject: "New subject"
    trigger_condition: "false"   # send the current values back, every time
    delay_by: "0"
  }) { id trigger_condition delay_by }
}
```

Read `trigger_condition` and `delay_by` back after every update.

### API Call Notification Headers Cannot Be Written Through Admin GraphQL

`admin_api_call_notification_create` and `_update` store `headers` and `request_headers` as a Ruby hash string (`{"k" => "v"}`), in any form they are sent, and the save is refused with `headers invalid json`. If it is saved anyway, every send fails. Write the notification as a file (`app/notifications/api_call_notifications/<name>.liquid`, with `request_headers: |-` in front matter) and sync or deploy it. Measured in October 2026.

## Debugging Tips

### Enable Email Logs

Check Activity > Email Log in Insites dashboard for delivery status and errors.

### What a Staging Instance Sends

A staging instance sends email only to its test recipients. The list sits on the instance's platform record: no GraphQL field or constant exposes it, so it cannot be read from the instance.

The sent-notification record shows what was requested, not what left. Measured on a v6 staging instance on 20 October 2026: an `email_send` with `to`, `cc`, `bcc`, `from` (`Platform <no-reply@insites.site>`) and a subject answered `is_scheduled_to_send: true`, and its `admin_sent_notifications` record held exactly those values. Any rewrite on the way out happens after the record is written.

Reported, not visible from the instance: on staging the From is rewritten to `no-reply@staging.insites.site`, the real To and BCC are moved into the subject, and the message goes to the test recipients. So recipients, CC, BCC and the From cannot be tested on a staging instance; check them on the sent-notification record, and test delivery itself on production.

### Sent-Notification Records Hold API Call Headers

`admin_sent_notifications` lists API call sends (`API_CALL`) beside emails, and an API call's `options.headers` can hold a live `Authorization` token, readable by anyone with admin GraphQL access (seen on a v6 staging instance on 20 October 2026). When you read sent notifications, filter with `notification_type: { value: EMAIL }` or leave `options` out of the query, and never print or log that field.

### Validate Template Rendering

Pre-render templates in tests to catch Liquid syntax errors early.

## See Also

- [Configuration Guide](./configuration.md)
- [API Reference](./api.md)
- [Common Patterns](./patterns.md)
- [Advanced Techniques](./advanced.md)
