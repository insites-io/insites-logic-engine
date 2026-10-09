# Emails and SMS Patterns

## Overview

Common patterns and best practices for implementing emails and SMS in Insites applications.

## Asynchronous Email Delivery via Events

The recommended pattern uses events and consumers for non-blocking email delivery:

```liquid
{% if user.email %}
  {% background source_name: 'event:user_welcome', priority: 'default', max_attempts: 3 %}
    {% graphql _ = 'emails/send_welcome', to: user.email, user_name: user.first_name %}
  {% endbackground %}
{% endif %}
```

Create an event consumer in `app/events/user_welcome_event_consumer.liquid`:

```liquid
---
handle: user_welcome_event_consumer
events: ['user/welcome']
---

{% graphql result = 'send_welcome_email'
  user_id: event.payload
%}
```

GraphQL query in `app/graphql/send_welcome_email.graphql`:

```graphql
mutation send_welcome($data: HashObject) {
  email_send(template: { name: "welcome" }, data: $data) {
    is_scheduled_to_send
  }
}
```

Build `data` in Liquid as one variable (`{ "to": user.email, "name": user.name }`) and pass it whole; see [api.md](api.md#email_send).

## Conditional Email Sending

Send different emails based on user context:

```liquid
{% if user.type == 'premium' %}
  {% background source_name: 'event:premium_user_notification', priority: 'default', max_attempts: 3 %}
    {% graphql _ = 'emails/send_premium_notification', to: user.email %}
  {% endbackground %}
{% else %}
  {% background source_name: 'event:user_notification', priority: 'default', max_attempts: 3 %}
    {% graphql _ = 'emails/send_notification', to: user.email %}
  {% endbackground %}
{% endif %}
```

## Flash Messages with Redirect

Send flash message while redirecting:

```liquid
{% parse_json flash %}
  { "notice": "user.welcome_sent", "from": {{ context.location.pathname | json }} }
{% endparse_json %}
{% liquid
  assign flash_json = flash | json
  session sflash = flash_json
  redirect_to '/dashboard'
  break
%}
```

Renders localized flash message on next request.

## Transactional SMS Pattern

Send verification codes via SMS:

```liquid
{% assign code = '' | random_string: 6, 'numeric' %}
{% assign ttl = 'now' | date: '%s' | plus: 600 %}

{% graphql result = 'create_verification'
  code: code,
  ttl: ttl,
  phone: user.phone
%}

{% graphql sms = 'send_sms'
  phone: user.phone,
  code: code
%}
```

## Scheduled Email Dispatch

Schedule an email with a background job:

```liquid
{% background delay: 1440, source_name: 'reminder_email' %}
  {%- assign mail = { "to": user.email, "action_required": true } -%}
  {%- graphql sent = 'emails/send_reminder', data: mail -%}
{% endbackground %}
```

Sends the email after 24 hours: a background job's `delay` is in minutes. `email_send` itself takes no delay for a template send.

## Multi-Language Emails

Support multiple language templates:

```liquid
{% assign lang = user.preferred_language | default: 'en' %}
{% assign template_name = 'welcome_' | append: lang %}

{% graphql result = 'send_email'
  template: template_name,
  to: user.email
%}
```

Create separate templates: `welcome_en.liquid`, `welcome_es.liquid`, etc.

## Email Queuing Pattern

Queue emails for batch processing:

```graphql
mutation QueueEmail($user_id: ID!) {
  model_create(
    model: {
      model_name: "email_queue"
      properties: {
        user_id: $user_id
        template: "batch_notification"
        status: "pending"
        created_at: "now"
      }
    }
  ) {
    success
  }
}
```

Process queue with scheduled event consumer.

## See Also

- [Configuration Guide](./configuration.md)
- [API Reference](./api.md)
- [Known Gotchas](./gotchas.md)
- [Advanced Techniques](./advanced.md)
