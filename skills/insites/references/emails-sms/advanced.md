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

{% graphql result = 'send_email'
  template: template_name,
  to: user.email,
  data: user
%}
```

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
  {% background source_name: 'event:email_batch_send', priority: 'default', max_attempts: 3 %}
    {% graphql _ = 'emails/send_batch_notification', to: user.email %}
  {% endbackground %}
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

## See Also

- [Configuration Guide](./configuration.md)
- [API Reference](./api.md)
- [Common Patterns](./patterns.md)
- [Known Gotchas](./gotchas.md)
