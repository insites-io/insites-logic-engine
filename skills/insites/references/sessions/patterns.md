# Sessions Patterns

## Shopping Cart Pattern

Track cart state across pages:

```liquid
<!-- Add to cart -->
{% capture cart_items %}{{ context.session.cart_items | default: '' }}{% endcapture %}
{% capture updated_items %}{{ cart_items }},{{ params.product_id }}{% endcapture %}
{% session cart_items = updated_items | split: ',' | uniq | join: ',' %}

<!-- Display cart -->
<div class="cart">
  {% assign items = context.session.cart_items | split: ',' %}
  <p>Items: {{ items | size }}</p>
</div>
```

## Multi-Step Wizard Pattern

Manage wizard state progression:

```liquid
<!-- Start wizard -->
{% unless context.session.wizard_active %}
  {% session wizard_step = 1 %}
  {% session wizard_active = true %}
  {% session wizard_start_time = 'now' %}
{% endunless %}

<!-- Check current step -->
{% if context.session.wizard_step == 1 %}
  {% include 'wizard/step-personal-info' %}
{% elsif context.session.wizard_step == 2 %}
  {% include 'wizard/step-address' %}
{% elsif context.session.wizard_step == 3 %}
  {% include 'wizard/step-payment' %}
{% endif %}

<!-- Next button handler -->
{% if params.next %}
  {% session wizard_step = context.session.wizard_step | plus: 1 %}
{% endif %}

<!-- Reset button handler -->
{% if params.reset %}
  {% session wizard_step = 1 %}
  {% session wizard_data = null %}
{% endif %}
```

## User Preferences Pattern

Store non-critical user settings:

```liquid
<!-- Store preferences from form -->
{% if params.preferences %}
  {% session theme = params.theme %}
  {% session language = params.language %}
  {% session font_size = params.font_size %}
{% endif %}

<!-- Apply preferences -->
<html lang="{{ context.session.language | default: 'en' }}">
  <head>
    <style>
      :root {
        --theme: {{ context.session.theme | default: 'light' }};
        --font-size: {{ context.session.font_size | default: 'normal' }};
      }
    </style>
  </head>
</html>
```

## Flash Message Pattern

Display one-time messages:

```liquid
<!-- Set flash message -->
{% if params.action == 'save' %}
  {% session flash_message = 'Settings saved successfully!' %}
  {% session flash_type = 'success' %}
{% endif %}

<!-- Display and clear flash -->
{% if context.session.flash_message %}
  <div class="flash flash--{{ context.session.flash_type }}">
    {{ context.session.flash_message }}
  </div>
  {% session flash_message = null %}
  {% session flash_type = null %}
{% endif %}
```

## Search History Pattern

Track recent searches:

```liquid
<!-- Record search -->
{% if params.q %}
  {% capture history %}{{ context.session.search_history | default: '' }}{% endcapture %}
  {% assign searches = history | split: '|' %}
  {% assign searches = searches | array_prepend: params.q %}
  {% assign searches = searches | slice: 0, 10 %}
  {% session search_history = searches | join: '|' %}
{% endif %}

<!-- Display history -->
<ul class="search-history">
  {% for search in context.session.search_history | split: '|' %}
    {% unless search == blank %}
      <li><a href="?q={{ search }}">{{ search }}</a></li>
    {% endunless %}
  {% endfor %}
</ul>
```

## Feature Flag Pattern

Toggle features per user:

```liquid
<!-- Admin sets feature flags -->
{% if context.user.is_admin %}
  {% session beta_new_ui = true %}
  {% session beta_advanced_search = false %}
{% endif %}

<!-- Use flags in templates -->
{% if context.session.beta_new_ui %}
  {% include 'components/new-ui' %}
{% else %}
  {% include 'components/legacy-ui' %}
{% endif %}
```

## Authentication State Pattern

A session field is not a sign-in. Sign people in with the `sign_in` tag and read `context.current_user`; a field such as `user_id` or `logged_in` signs nobody in, and setting it to `null` signs nobody out (measured on a v6 production and a v6 staging instance on 16 October 2026, see [authentication](../authentication/api.md#what-ends-a-sign-in-measured)).

Keep per-login state in the session, next to the sign-in, and tie it to the user it was set for:

```liquid
{%- comment -%} After the second factor passes for this user {%- endcomment -%}
{% session two_factor_user_id = user.id %}

{%- comment -%} Check it against the signed-in user, not only that it is set {%- endcomment -%}
{% if context.current_user and context.session.two_factor_user_id == context.current_user.id %}
  ...
{% endif %}
```

Sign-out does not clear these fields, and they are still there after the next sign-in, so clear them in both places. The sign-out page is in [authentication patterns](../authentication/patterns.md#sign-out).

## See Also

- [Configuration Guide](./configuration.md)
- [API Reference](./api.md)
- [Advanced Techniques](./advanced.md)
- [Gotchas & Issues](./gotchas.md)
