# Emails and SMS Patterns

## Overview

Common patterns and best practices for implementing emails and SMS in Insites applications.

## Sending from a Background Job

Send from a background job so the request does not wait. Build `data` on the page and pass it to the job:

```liquid
{% if user.email %}
  {%- assign mail = { "to": user.email, "name": user.first_name } -%}
  {% background job_id = 'jobs/send_welcome', mail: mail, source_name: 'user_welcome', priority: 'default', max_attempts: 3 %}
{% endif %}
```

The job, `app/views/partials/jobs/send_welcome.liquid`, sees only what the tag passes it:

```liquid
{%- graphql sent = 'emails/send_welcome', data: mail -%}
```

The mutation, `app/graphql/emails/send_welcome.graphql`:

```graphql
mutation send_welcome($data: HashObject) {
  email_send(template: { name: "welcome" }, data: $data) {
    is_scheduled_to_send
  }
}
```

`template` is an object naming a file in `app/emails/`, and `data` is one variable; see [api.md](api.md#email_send).

## Conditional Email Sending

Send different emails based on user context:

```liquid
{% if user.type == 'premium' %}
  {% background job_id = 'jobs/send_premium_notification', to: user.email, source_name: 'event:premium_user_notification', priority: 'default', max_attempts: 3 %}
{% else %}
  {% background job_id = 'jobs/send_notification', to: user.email, source_name: 'event:user_notification', priority: 'default', max_attempts: 3 %}
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

{%- assign message = { "phone": user.phone, "code": code } -%}
{%- graphql sms = 'smses/send_verification', data: message -%}
```

`app/graphql/smses/send_verification.graphql` holds `sms_send(template: { name: "verification" }, data: $data) { is_scheduled_to_send }`, and `app/smses/verification.liquid` reads `to: '{{ data.phone }}'`.

## Scheduled Email Dispatch

Schedule an email with a background job:

```liquid
{%- assign mail = { "to": user.email, "action_required": true } -%}
{% background job_id = 'jobs/send_reminder', mail: mail, delay: 1440, source_name: 'reminder_email' %}
```

The job partial runs `{%- graphql sent = 'emails/send_reminder', data: mail -%}` with the `mail` passed to the tag.

Sends the email after 24 hours: a background job's `delay` is in minutes. `email_send` itself takes no delay for a template send.

## Multi-Language Emails

Support multiple language templates:

```liquid
{% assign lang = user.preferred_language | default: 'en' %}
{% assign template_name = 'welcome_' | append: lang %}
{%- assign mail = { "to": user.email, "first_name": user.first_name } -%}

{%- graphql sent, name: template_name, d: mail -%}
mutation ($name: String!, $d: HashObject) {
  email_send(template: { name: $name }, data: $d) { is_scheduled_to_send }
}
{%- endgraphql -%}
```

Create separate templates: `welcome_en.liquid`, `welcome_es.liquid`, etc.

## Sending One Email to Many People

There is no email queue to build. `email_send` schedules each message and answers `is_scheduled_to_send`, so a batch is one `email_send` per recipient through a registered template. Run the loop in a background job so the request that starts it does not wait.

The template, `app/emails/batch_notification.liquid`:

```liquid
---
to: '{{ data.to }}'
from: 'support@example.com'
subject: 'An update for you'
layout: 'mailer'
---
Hello {{ data.first_name }},
```

The mutation, `app/graphql/emails/send_batch_notification.graphql`:

```graphql
mutation send_batch_notification($data: HashObject) {
  email_send(template: { name: "batch_notification" }, data: $data) {
    is_scheduled_to_send
  }
}
```

The job, `app/views/partials/emails/send_batch.liquid`. It sees only what the `background` tag passes it:

```liquid
{%- for r in recipients -%}
  {%- assign mail = { "to": r.email, "first_name": r.first_name } -%}
  {%- graphql sent = 'emails/send_batch_notification', data: mail -%}
{%- endfor -%}
```

Start it from the page:

```liquid
{% background job_id = 'emails/send_batch', source_name: 'batch_notification', max_attempts: 1, recipients: recipients %}
```

Pass `data` as one variable, never as a GraphQL object literal: the literal form answers `is_scheduled_to_send: true` and sends nothing (see [api.md](api.md#email_send)). `insites-cli check run` flags the query inside the loop (`NestedGraphQLQuery`); here that is expected, because `email_send` takes one message per call. Keep `max_attempts: 1` unless the job records who it has already sent to, or a retry sends the whole batch again.

## See Also

- [Configuration Guide](./configuration.md)
- [API Reference](./api.md)
- [Known Gotchas](./gotchas.md)
- [Advanced Techniques](./advanced.md)
