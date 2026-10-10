# Flash Messages Patterns

## Overview

Common patterns for implementing flash messages in Insites applications.

## Basic Form Submission with Success Message

After successful form submission, redirect with confirmation:

```liquid
{% parse_json success_flash %}
  { "notice": "User created successfully", "from": {{ context.location.pathname | json }} }
{% endparse_json %}
{% parse_json error_flash %}
  { "alert": "Validation failed. Please check the form.", "from": {{ context.location.pathname | json }} }
{% endparse_json %}
{% liquid
  function result = 'lib/commands/users/create', params: context.params
  if result.errors == blank
    assign flash_json = success_flash | json
    session sflash = flash_json
    redirect_to '/users'
    break
  endif
  assign flash_json = error_flash | json
  session sflash = flash_json
%}
```

## Conditional Alerts Based on Action

Show different messages for different outcomes:

```liquid
{% liquid
  if action == 'delete'
    if deletion_successful
      assign flash = '{"notice": "Item deleted", "from": "/items"}' | parse_json
      assign flash_json = flash | json
      session sflash = flash_json
      redirect_to '/items'
      break
    else
      assign flash = '{"alert": "Item could not be deleted", "from": "/items"}' | parse_json
      assign flash_json = flash | json
      session sflash = flash_json
      redirect_to '/items'
      break
    endif
  endif
%}
```

## Multi-Step Form with Warnings

Warn users during multi-step processes:

```liquid
{% liquid
  if current_step == 2
    if incomplete_required_fields.size > 0
      assign flash = '{"warning": "Some required fields are incomplete", "from": "/form/step-2"}' | parse_json
      assign flash_json = flash | json
      session sflash = flash_json
      redirect_to '/form/step-2'
      break
    else
      assign flash = '{"notice": "Step 2 complete", "from": "/form/step-3"}' | parse_json
      assign flash_json = flash | json
      session sflash = flash_json
      redirect_to '/form/step-3'
      break
    endif
  endif
%}
```

## Displaying Flash Messages

Render flash messages in layout:

```liquid
{%- assign flash = context.session.sflash | parse_json -%}

{% if flash %}
  {% if flash.notice %}
    <div class="alert alert-success">
      <i class="icon-check"></i>
      {{ flash.notice }}
    </div>
  {% endif %}

  {% if flash.alert %}
    <div class="alert alert-danger">
      <i class="icon-error"></i>
      {{ flash.alert }}
    </div>
  {% endif %}

  {% if flash.warning %}
    <div class="alert alert-warning">
      <i class="icon-warning"></i>
      {{ flash.warning }}
    </div>
  {% endif %}

  {% if flash.info %}
    <div class="alert alert-info">
      <i class="icon-info"></i>
      {{ flash.info }}
    </div>
  {% endif %}
{% endif %}
```

## Flash Rendered by the Layout Partial

Render the flash from session in the `shared/toasts` partial the layout calls, with no script at all:

```liquid
{% comment %} app/views/partials/shared/toasts.liquid {% endcomment %}
{% if params.notice %}
  <div class="flash notice" role="status">{{ params.notice }}</div>
{% endif %}
{% if params.alert %}
  <div class="flash alert" role="alert">{{ params.alert }}</div>
{% endif %}
```

## Persistent Flash Across Pages

Keep flash visible until user manually closes:

```liquid
{%- assign flash = context.session.sflash | parse_json -%}

{% if flash %}
  <div class="alert" id="flash-message" role="alert">
    <button type="button" class="close" aria-label="Close">
      <span aria-hidden="true">&times;</span>
    </button>
    <div class="alert-content">
      {{ flash.notice | default: flash.alert }}
    </div>
  </div>

  <script>
    document.querySelector('.close').addEventListener('click', function() {
      document.getElementById('flash-message').style.display = 'none';
    });
  </script>
{% endif %}
```

## Contextual Flash Messages

Show different messages based on user role:

```liquid
{%- assign flash = context.session.sflash | parse_json -%}

{% if context.current_user.role == 'admin' %}
  {% assign flash_key = flash.notice | append: '.admin' %}
{% else %}
  {% assign flash_key = flash.notice %}
{% endif %}

{{ flash_key }}
```

## AJAX Request Flash Messages

Handle flash after AJAX form submissions:

```javascript
fetch('/api/form-submit', {
  method: 'POST',
  body: formData
})
.then(response => response.json())
.then(data => {
  if (data.success) {
    showFlash('notice', data.message);   // project code, see api.md
  } else {
    showFlash('alert', data.error);
  }
});
```

## Flash Message Counter

Show notification with count:

```liquid
{% liquid
  assign flash = '{"notice": "Items imported successfully", "from": "/dashboard"}' | parse_json
  assign flash_json = flash | json
  session sflash = flash_json
  redirect_to '/dashboard'
  break
%}
```

Use in layout:

```liquid
{%- assign flash = context.session.sflash | parse_json -%}
{% if flash.notice %}
  {{ flash.notice }}
{% endif %}
```

## See Also

- [Configuration Guide](./configuration.md)
- [API Reference](./api.md)
- [Known Gotchas](./gotchas.md)
- [Advanced Techniques](./advanced.md)
