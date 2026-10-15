# Flash Messages Advanced Techniques

## Overview

Advanced patterns and techniques for sophisticated flash message implementations in Insites.

## Custom Flash Styling Based on Context

Apply dynamic CSS classes based on flash type and user preferences:

```liquid
{%- assign flash = context.session.sflash | parse_json -%}

{% if flash %}
  {% assign theme = context.current_user.theme_preference | default: 'light' %}
  {% assign flash_type = flash.notice | default: flash.alert | default: flash.warning %}
  {% assign flash_class = 'flash-' | append: flash_type | append: '-' | append: theme %}

  <div class="flash {{ flash_class }}" role="alert">
    {{ flash_type }}
  </div>
{% endif %}
```

## Flash Message Queuing

Queue multiple messages to display sequentially:

```liquid
---
handle: flash_queue_helper
---

{% if request.method == 'POST' %}
  {% assign queue = session.flash_queue | default: '[]' | parse_json %}
  {% assign new_message = 'message' | append: queue.size %}

  {% assign queue = queue | array_add: new_message %}
  {% assign session.flash_queue = queue | json %}
{% endif %}
```

Render in layout:

```liquid
{% assign queue = session.flash_queue | parse_json %}
{% for message in queue %}
  <div class="flash queued-{{ forloop.index }}">
    {{ message }}
  </div>
{% endfor %}
```

## Animated Flash Dismissal

Implement JavaScript-based flash animation and auto-dismiss:

```liquid
<script>
  {%- assign flash = context.session.sflash | parse_json -%}
  {% if flash.notice %}
    const flash = document.querySelector('.flash');
    flash.addEventListener('animationend', function() {
      flash.remove();
    });
    setTimeout(() => {
      flash.classList.add('dismiss-animation');
    }, 3000);
  {% endif %}
</script>

<style>
  @keyframes slideOut {
    to {
      transform: translateX(-100%);
      opacity: 0;
    }
  }

  .flash.dismiss-animation {
    animation: slideOut 0.3s ease-out forwards;
  }
</style>
```

## Conditional Flash Based on User Segments

Show different messages based on user attributes:

```liquid
{%- assign flash = context.session.sflash | parse_json -%}

{% if context.current_user.is_premium? %}
  {% assign flash_prefix = 'premium' %}
{% elsif context.current_user.is_trial? %}
  {% assign flash_prefix = 'trial' %}
{% else %}
  {% assign flash_prefix = 'free' %}
{% endif %}

{% assign message_key = flash.notice | prepend: flash_prefix | append: '_message' %}
{{ message_key }}
```

## Flash with Deep Links

Combine flash messages with deep linking:

```liquid
{% assign deep_link = '/items/' | append: item.id | append: '#details' %}
{% parse_json flash_data %}
  { "notice": "Item saved", "from": {{ deep_link | json }} }
{% endparse_json %}
{% liquid
  assign flash_json = flash_data | json
  session sflash = flash_json
  redirect_to deep_link
  break
%}
```

## Flash Message Persistence Across Domain Changes

When redirecting between subdomains, ensure flash persists:

```liquid
<!-- Flash by default doesn't persist across subdomains -->
<!-- Solution: Store in session with longer TTL -->

{% session persistent_flash = flash | json %}
{% assign ttl = 'now' | date: '%s' | plus: 3600 %}
{% session persistent_flash_ttl = ttl %}

{% redirect_to 'https://other-subdomain.example.com/page' %}
```

## Flash Analytics and Tracking

Log flash messages for analytics:

```liquid
{%- assign flash = context.session.sflash | parse_json -%}

{% if flash %}
  {% assign flash_type = 'notice' | default: 'alert' %}
  {% graphql log = 'log_flash_event'
    type: flash_type,
    message_key: flash.notice | default: flash.alert,
    user_id: context.current_user.id,
    timestamp: 'now'
  %}
{% endif %}
```

## Flash with Error Details

Display detailed error information in flash:

```liquid
{% assign error_list = form.errors | map: 'message' | join: ', ' %}
{% parse_json flash_data %}
  { "alert": "Validation error", "error_details": {{ error_list | json }}, "from": {{ context.location.pathname | json }} }
{% endparse_json %}
{% liquid
  assign flash_json = flash_data | json
  session sflash = flash_json
  redirect_to context.location.pathname
  break
%}

<!-- In layout -->
{% if flash.alert %}
  <div class="alert">
    <p>{{ flash.alert }}</p>
    {% if sflash.error_details %}
      <ul>
        {% for error in sflash.error_details | split: ', ' %}
          <li>{{ error }}</li>
        {% endfor %}
      </ul>
    {% endif %}
  </div>
{% endif %}
```

## Progressive Enhancement with Flash

Enhance user experience with progressive flash enhancements:

```liquid
<!-- No JavaScript fallback -->
<noscript>
  <div class="flash-static">
    {%- assign flash = context.session.sflash | parse_json -%}
    {{ flash.notice }}
  </div>
</noscript>

<!-- JavaScript enhancement -->
<script>
  {%- assign flash = context.session.sflash | parse_json -%}
  if ('{% if flash %}true{% else %}false{% endif %}' === 'true') {
    initializeEnhancedFlash('{{ flash.notice | escape_javascript }}');
  }
</script>
```

## Flash Message Accessibility

Implement accessible flash messages:

```liquid
<div class="flash"
     role="alert"
     aria-live="polite"
     aria-atomic="true">
  {%- assign flash = context.session.sflash | parse_json -%}
  {{ flash.notice }}
</div>

<style>
  /* Ensure visible focus for keyboard navigation */
  .flash:focus {
    outline: 2px solid #0066cc;
    outline-offset: 2px;
  }
</style>
```

## See Also

- [Configuration Guide](./configuration.md)
- [API Reference](./api.md)
- [Common Patterns](./patterns.md)
- [Known Gotchas](./gotchas.md)
