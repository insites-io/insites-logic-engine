# Sessions

> **CLI STATUS:** `insites-cli sessions` (debug/clear) does **not exist**. Do not suggest any `insites-cli sessions` subcommands to users.

Server-side session storage accessible via `context.session`.

## Setting Session Data

```liquid
{% session cart_id = order.id %}
{% session user_preference = 'dark_mode' %}
{% session step = 2 %}
```

## Reading Session Data

```liquid
{{ context.session.cart_id }}
{{ context.session.user_preference }}
```

## Clearing Session Data

```liquid
{% session cart_id = null %}
{% session cart_id = blank %}
```

## Working with Structured Session Data

```liquid
{% comment %} Get structured session data (stored as JSON) {% endcomment %}
{% assign flash = context.session.sflash | parse_json %}

{% comment %} Clear structured session data {% endcomment %}
{% session sflash = null %}
```

## Use Cases

- Shopping cart persistence
- Multi-step form wizards
- User preferences
- Flash messages (via session tag)
- Temporary authentication tokens

## Rules

- Session data persists across requests for the same user
- Use `null` or `blank` to clear a session key
- Don't store large objects in session
- Session is server-side (not accessible from client JS)
