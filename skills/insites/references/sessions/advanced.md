# Sessions Advanced Techniques

## Session Encryption

Encrypt sensitive session data:

```liquid
{% capture encrypted_token %}
  {{ params.auth_token | encrypt: context.session_key }}
{% endcapture %}
{% session auth_token = encrypted_token %}

<!-- Decrypt when needed -->
{% assign token = context.session.auth_token | decrypt: context.session_key %}
```

Store encryption key in environment variables for security.

## Session Expiration Control

Implement custom expiration logic:

```liquid
<!-- Track session creation time -->
{% unless context.session.created_at %}
  {% session created_at = 'now' | date: '%s' %}
{% endunless %}

<!-- Check if session expired (1 hour = 3600 seconds) -->
{% assign current_time = 'now' | date: '%s' %}
{% assign session_age = current_time | minus: context.session.created_at %}
{% if session_age > 3600 %}
  <!-- Session expired: clear your own fields. This does not end a sign-in; to sign the
       person out, send them through the sign-out page in authentication/patterns.md -->
  {% session created_at = null %}
{% endif %}
```

## Session Compression

Store multiple values in a compressed format:

```liquid
<!-- Store as delimited string to save space -->
{% capture session_data %}
{{ context.session.user_id }}|{{ context.session.role }}|{{ context.session.permissions }}
{% endcapture %}
{% session compressed = session_data %}

<!-- Decompress when needed -->
{% assign parts = context.session.compressed | split: '|' %}
{% assign user_id = parts[0] %}
{% assign role = parts[1] %}
{% assign permissions = parts[2] %}
```

## Cross-Domain Session Sharing

Share sessions across subdomains:

Cross-domain session sharing is managed through the Insites admin portal, not the `.insites` file. Configure domain, same_site, and secure settings in the instance dashboard. Use consistent domain settings across all subdomains.

## Session State Machine

Implement strict state transitions:

```liquid
{% assign valid_states = 'initial,pending,approved,rejected' | split: ',' %}

{% if params.transition %}
  {% assign current = context.session.workflow_state | default: 'initial' %}

  <!-- Only allow valid transitions -->
  {% if current == 'initial' and params.transition == 'pending' %}
    {% session workflow_state = 'pending' %}
  {% elsif current == 'pending' and params.transition == 'approved' %}
    {% session workflow_state = 'approved' %}
  {% elsif current == 'pending' and params.transition == 'rejected' %}
    {% session workflow_state = 'rejected' %}
  {% else %}
    <!-- Invalid transition, reject -->
    Invalid state transition
  {% endif %}
{% endif %}
```

Enforce state machine rules to prevent invalid workflows.

## Session Analytics

Track session behavior and patterns:

```liquid
<!-- Record session event -->
{% if params.action %}
  {% capture events %}{{ context.session.events | default: '' }}{% endcapture %}
  {% assign event_list = events | split: ';' %}
  {% assign new_event = params.action | append: '=' | append: 'now' | date: '%s' %}
  {% assign event_list = event_list | array_add: new_event %}
  {% session events = event_list | join: ';' %}
{% endif %}

<!-- Analyze session lifetime -->
{% assign events = context.session.events | split: ';' %}
<p>Session has {{ events | size }} recorded events</p>
```

## Rate Limiting with Sessions

Do not rate limit in the session: the visitor controls the cookie, so a client that drops it starts again at zero. Count in a table, keyed by email and by network address, as in [sign-in by emailed link or code](../authentication/patterns.md#sign-in-by-emailed-link-or-code).

## Session Mirroring to Database

Persist critical session data to database:

```liquid
{% if params.save_to_db %}
  <!-- Save the fields you set, by name. Never context.session whole: while someone is
       signed in it holds the platform's sign-in record, including part of the
       password hash -->
  {% assign saved = { "cart_id": context.session.cart_id, "wizard_step": context.session.wizard_step } %}
  {% assign saved_json = saved | json %}
  {% graphql res = 'save_session_data',
    user_id: context.current_user.id,
    data: saved_json,
    expires_at: 'now' | date: '%s' | plus: 86400
  %}

  <!-- Clear volatile session data, keep reference -->
  {% session db_record_id = res.record.id %}
{% endif %}
```

## Graduated Session Escalation

Escalate permissions based on session age:

```liquid
{% assign created_at = context.session.created_at | default: 'now' | date: '%s' %}
{% assign age = 'now' | date: '%s' | minus: created_at %}

<!-- Determine permission level based on session age -->
{% if age < 300 %}
  <!-- < 5 minutes: read-only -->
  {% assign permission_level = 'read' %}
{% elsif age < 1800 %}
  <!-- < 30 minutes: read+write -->
  {% assign permission_level = 'write' %}
{% else %}
  <!-- > 30 minutes: full access -->
  {% assign permission_level = 'admin' %}
{% endif %}

{% if params.action == 'delete' and permission_level != 'admin' %}
  Not authorized: insufficient session age
{% endif %}
```

## See Also

- [Configuration Guide](./configuration.md)
- [API Reference](./api.md)
- [Patterns Guide](./patterns.md)
- [Gotchas & Issues](./gotchas.md)
