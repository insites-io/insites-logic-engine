# Sessions API Reference

## session Tag

Write values to session storage.

**Syntax:**
```liquid
{% session key = value %}
```

**Examples:**

```liquid
<!-- Store string -->
{% session user_name = params.name %}

<!-- Store number -->
{% session cart_quantity = 5 %}

<!-- Store boolean -->
{% session is_logged_in = true %}

<!-- Store from variable -->
{% session last_search = params.query %}

<!-- Store array -->
{% session selected_filters = params.filters | split: ',' %}
```

## Reading Session Data

Access session values through `context.session`:

```liquid
{{ context.session.user_name }}
{{ context.session.cart_quantity }}
{{ context.session.last_search }}
```

## Clearing Session Data

Set value to `null` to clear:

```liquid
{% session user_name = null %}
{% session cart_items = null %}
```

Clear entire session:

```liquid
{% session = null %}
```

## Session Helpers

### session/get Helper

Retrieve session value with fallback:

```liquid
{% render 'session/get', key: 'cart_id', default: 'empty' %}
```

Returns session value or default if not set.

### session/clear Helper

Clear specific session keys:

```liquid
{% render 'session/clear', keys: 'cart_id,preferences' %}
```

Clears multiple session values atomically.

## Context Access

### Available Session Variables

Check if session key exists:

```liquid
{% if context.session.checkout_step %}
  Step: {{ context.session.checkout_step }}
{% endif %}
```

### Session Enumeration

Iterate over all session keys:

```liquid
{% for key in context.session %}
  {{ key }}: {{ context.session[key] }}
{% endfor %}
```

## Session Data Persistence

### Reading Previously Stored Values

Session persists across requests:

**Page 1 (Setup):**
```liquid
{% session wizard_step = 1 %}
```

**Page 2 (Later):**
```liquid
Current Step: {{ context.session.wizard_step }}
{% session wizard_step = 2 %}
```

## Type Conversion

### Converting Session Values

Sessions store strings by default:

```liquid
<!-- Store and retrieve number -->
{% session count = params.quantity | to_number %}
Quantity: {{ context.session.count | plus: 1 }}

<!-- Store and retrieve boolean -->
{% session enabled = params.enable | eq: 'true' %}
Status: {{ context.session.enabled | default: false }}
```

## Session Size Limits

Maximum session data per user: ~4KB

For larger data:
- Store object IDs, fetch full objects via GraphQL
- Use database persistence instead

## CLI Commands

The CLI has no `sessions` command. Read session state with `insites-cli exec liquid <env> "{{ context.session }}"` in a request context, or from a page while signed in.

## See Also

- [Configuration Guide](./configuration.md)
- [Patterns Guide](./patterns.md)
- [Advanced Techniques](./advanced.md)
- [Gotchas & Issues](./gotchas.md)
