# Emails and SMS Advanced Techniques

## Overview

Advanced patterns and techniques for sophisticated email and SMS workflows in Insites.

## Webhook Integration for Delivery Status

Track email opens, clicks, and bounces using webhooks:

```liquid
---
handle: email_webhook_receiver
method: post
path: /webhooks/email-status
---

{% case request.body.event_type %}
  {% when 'email.opened' %}
    {% graphql update = 'update_email_opened'
      email_id: request.body.email_id,
      opened_at: request.body.timestamp
    %}
  {% when 'email.bounced' %}
    {% graphql mark_bounced = 'update_email_bounced'
      email_id: request.body.email_id,
      bounce_type: request.body.bounce_type
    %}
{% endcase %}
```

## Dynamic Template Selection

Choose templates based on user attributes:

```liquid
{% assign template_map = 'welcome_standard|welcome_premium|welcome_vip' | split: '|' %}
{% assign user_tier_index = user.tier_level | default: 0 %}
{% assign template_name = template_map[user_tier_index] %}
{%- assign mail = { "to": user.email, "first_name": user.first_name } -%}

{%- graphql sent, name: template_name, d: mail -%}
mutation ($name: String!, $d: HashObject) {
  email_send(template: { name: $name }, data: $d) { is_scheduled_to_send }
}
{%- endgraphql -%}
```

`template` is an object, `{ name: ... }`, never a plain string, and the recipient goes in `data`, not in an argument of its own.

## Liquid Filters for Email Content

Create custom filters for email formatting:

```liquid
{% capture email_footer %}
  {% if user.locale == 'en' %}
    Best regards, The Team
  {% elsif user.locale == 'es' %}
    Saludos cordiales, El Equipo
  {% endif %}
{% endcapture %}

{{ email_footer }}
```

## Email Template Inheritance

Use Liquid includes for shared email sections:

```liquid
---
layout: 'mailer'
---

{% include 'emails/partials/header' %}

<h1>Welcome {{ data.user.name }}!</h1>

{% include 'emails/partials/footer' %}
```

## Complex Data Structures in Emails

Pass nested objects to templates:

```liquid
{%- assign mail = { "to": "user@example.com", "order": { "id": order.id, "items": order.items, "total": order.total } } -%}
{%- graphql sent = 'emails/send_order_confirmation', data: mail -%}
```

Access in template:

```liquid
{% for item in data.order.items %}
  <tr>
    <td>{{ item.name }}</td>
    <td>{{ item.qty }}</td>
    <td>{{ item.price | money }}</td>
  </tr>
{% endfor %}
```

## Batch Email Processing

Process emails in bulk with event consumers:

```liquid
---
handle: batch_email_processor
source: scheduled
cron: '0 2 * * *'
---

{% graphql pending_users = 'get_pending_email_users' %}

{% for user in pending_users.users %}
  {% background job_id = 'jobs/send_batch_notification', to: user.email, source_name: 'event:email_batch_send', priority: 'default', max_attempts: 3 %}
{% endfor %}
```

## A/B Testing Email Content

Create variants and track performance:

```liquid
{%- assign template_name = 'newsletter_' | append: variant -%}
{%- assign mail = { "to": "user@example.com", "user_id": user_id, "variant": variant, "test_id": "nl_2024_01" } -%}
{%- graphql sent, name: template_name, d: mail -%}
mutation ($name: String!, $d: HashObject) {
  email_send(template: { name: $name }, data: $d) { is_scheduled_to_send }
}
{%- endgraphql -%}
```

GraphQL does not run Liquid, so a template name built from a variable goes in as a GraphQL variable.

## SMS with Conversation Context

Maintain SMS conversation history:

```graphql
mutation send_contextual_sms($data: HashObject) {
  sms_send(template: { name: "contextual_reply" }, data: $data) {
    is_scheduled_to_send
  }
}
```

with `data` built in Liquid: `{ "to": phone, "conversation_id": conversation_id, "previous_context": "user_requested_support" }`.

## Email Retry Logic

Implement retry mechanism for failed sends:

```liquid
---
handle: email_retry_consumer
events: ['email/send_failed']
---

{% assign retry_count = event.metadata.retry_count | default: 0 %}
{% if retry_count < 3 %}
  {% assign delay = 300 | times: retry_count %}
  {% graphql retry = 'retry_email_send'
    email_id: event.payload,
    delay: delay,
    retry_count: retry_count | plus: 1
  %}
{% endif %}
```

## Logging a Database-Stored Notification's Send

A notification stored with `admin_email_notification_create`, such as a Form Builder email, cannot carry `unique_args` ([gotchas](gotchas.md#a-database-stored-notification-cannot-carry-unique_args)), so its delivery events cannot be matched to a row. The CRM and Forms modules get round this from the notification's `trigger_condition`, the one field the platform renders first with the submitted form in scope. Read from module-v6-forms release/v6.1.2 (`functions/notifications/logged_trigger`) and module-v6-crm release/v6.1.5 (`lib/emails/send_notification`) on 20 October 2026, TW#26887904.

The trigger:

1. Asks `admin_liquid_partials` whether `modules/insites_crm/lib/emails/send_notification` exists. That partial is public on purpose, because private partials are not listed there.
2. If it exists, captures the notification's own fields (Reply-To, To, CC, BCC, From, subject, body, layout, name) with the same Liquid the notification stores, resets every variable the header partials assigned so the body renders in the scope the platform would give it, and calls the partial. The CRM writes the Email Logs row, stamps its id into `unique_args` and sends through its file-based `test_send` email.
3. Renders `false`, so the platform does not send a second, unlogged copy.
4. If the partial does not exist (a CRM older than 6.1.5, or a downgrade), renders `true` and nothing else, so the platform sends the stored fields itself, unlogged, as before. A missing partial never stops an email.

The shape Forms writes into `trigger_condition` (the `@@...@@` markers are filled with the notification's stored fields on every save):

```liquid
{%- graphql email_log_check -%}query email_log_check { admin_liquid_partials(per_page: 1, filter: { path: { value: "modules/insites_crm/lib/emails/send_notification" } }) { total_entries } }{%- endgraphql -%}
{%- if email_log_check.admin_liquid_partials.total_entries > 0 -%}
{%- capture email_log_to -%}<stored to>{%- endcapture -%}
{%- capture email_log_from -%}<stored from>{%- endcapture -%}
...
{%- function email_log_sent = 'modules/insites_crm/lib/emails/send_notification', to: email_log_to, cc: email_log_cc, bcc: email_log_bcc, reply_to: email_log_reply_to, from: email_log_from, subject: email_log_subject, content: email_log_content, layout: email_log_layout, email_name: email_log_name, module: 'Insites Forms' -%}
false
{%- else -%}true{%- endif -%}
```

The notification's fields stay as they are, so the Form Builder still edits them, and every save writes the trigger again from them. An edit made anywhere else does not reach the trigger. Measured on a v6 staging instance on 19 October 2026: the trigger rendered once per submission, a few seconds after it, and the email that left had the same To, From, Reply-To, CC, BCC, subject, layout and body as the stored notification.

**Only the Form Builder writes the trigger.** Forms 6.1.2's migration (`20261019000000_log_form_notifications`) converts each switched-on notification whose `trigger_condition` is exactly `true` once, when the module is installed or upgraded. A notification written afterwards with `admin_email_notification_create` or `admin_email_notification_update` and `trigger_condition: "true"` (a deploy, an import, a migration tool) sends unlogged, through the platform, until somebody saves it in the Form Builder. To log it from the start, write the same trigger the Form Builder writes, built from the notification's final fields, and rebuild it whenever To, From, subject or body change: the trigger holds them as literal text, so changing the notification's `to` alone still emails the old recipients. The Form Builder recognizes a logged trigger by the comment marker `insites_forms:logged_notification` at its start (`functions/notifications/present`) and shows it as switched on; anything reading `trigger_condition == "true"` to mean "on" needs the same check. The email name it carries is the form's label then `: admin notification` or `: autoresponder` (`functions/notifications/email_name`).

The CRM's own form notifications (`insites_internal_email`, `insites_external_email`) do the same from release/v6.1.5, calling the private `functions/emails/send_notification` directly.

## See Also

- [Configuration Guide](./configuration.md)
- [API Reference](./api.md)
- [Common Patterns](./patterns.md)
- [Known Gotchas](./gotchas.md)
