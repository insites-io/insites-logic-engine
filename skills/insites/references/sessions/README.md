# Sessions

> **CLI STATUS:** `insites-cli sessions` (debug/clear) does not exist. Do not suggest any `insites-cli sessions` subcommands to users.

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
- Per-visit choices, such as a filter
- Flash messages (via session tag)
- Per-login flags: two-factor passed on this sign-in, or a flag a form page sets for its POST page to check

## Session State or Profile State

`{% session key = value %}` stores a value for this visitor's session only (GraphQL: `session_create_field`, `session_delete_field`). Use it for state that belongs to one login on one device.

Store a durable fact about the person on the user or profile record (`user_update`): "two-factor is switched on", a preference that should follow them to another device. Per-login state kept on the profile applies to every device at once: one device passing two-factor would mark them all as passed.

## Rules

- Session data persists across requests for the same user
- Use `null` or `blank` to clear a session key
- Don't store large objects in session
- Session is server-side (not accessible from client JS)
