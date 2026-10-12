# Flash Messages API Reference

## Overview

Insites provides flash messages using the built-in `session` tag and `context.session` for setting and rendering temporary notifications.

## Setting Flash Messages

### Redirect with Flash Message

Set flash message and redirect:

```liquid
{% parse_json flash %}
  { "notice": "Profile updated", "from": {{ context.location.pathname | json }} }
{% endparse_json %}
{% liquid
  assign flash_json = flash | json
  session sflash = flash_json
  redirect_to '/dashboard'
  break
%}
```

The `notice` value accepts:

- Plain text: `'Profile updated'`
- Dynamic text: `'Welcome ' | append: user.name`

### Flash Message Properties

The flash JSON object supports these properties:

| Property | Type | Description |
|----------|------|-------------|
| `notice` | String | Success/info message (notice type) |
| `alert` | String | Error message (alert type) |
| `warning` | String | Warning message (warning type) |
| `info` | String | Informational message (info type) |
| `from` | String | Pathname to match for auto-clear |

### Set Flash Message Only (no redirect)

```liquid
{% parse_json flash %}
  { "notice": "Changes saved", "from": {{ context.location.pathname | json }} }
{% endparse_json %}
{% liquid
  assign flash_json = flash | json
  session sflash = flash_json
%}
```

### Simple redirect (no flash)

```liquid
{% redirect_to '/dashboard' %}
```

## Getting Flash Messages

### Retrieve Flash from Session

```liquid
{% liquid
  assign flash = context.session.sflash | parse_json
  if flash
    assign notice = flash.notice
    assign alert = flash.alert
  endif
%}
```

### Check Flash Existence

```liquid
{% liquid
  assign flash = context.session.sflash | parse_json
  if flash.notice
    assign notice_text = flash.notice
  endif
  if flash.alert
    assign error_text = flash.alert
  endif
%}
```

## Clearing Flash Messages

### Automatic Clearing

Flash messages automatically clear when:
- Page pathname changes (via layout flash handling)
- Session expires
- Explicit clear is called

### Manual Clear

Clear flash messages programmatically:

```liquid
{% session sflash = null %}
```

## Messages from JavaScript

Insites has no JavaScript toast helper. To show a message from a script, write it into the status region your `shared/toasts` partial renders in the layout. The region and the function below are project code, not a platform API:

```html
<!-- in app/views/partials/shared/toasts.liquid, rendered by the layout -->
<div id="flash" class="flash" role="status" aria-live="polite" hidden></div>
```

```javascript
// project code, for example app/assets/scripts/flash.js
function showFlash(type, message) {
  const el = document.getElementById('flash');
  el.className = 'flash ' + type;   // notice, alert, warning or info
  el.textContent = message;         // textContent, never innerHTML
  el.hidden = false;
}
```

Auto-dismiss, if you want it, is a timer in the same project code:

```javascript
function showFlashFor(type, message, ms) {
  showFlash(type, message);
  setTimeout(() => { document.getElementById('flash').hidden = true; }, ms);
}
```

## Flash Message Structure

Flash messages follow this structure in session:

```json
{
  "notice": "Your descriptive message here",
  "alert": null,
  "warning": null,
  "info": null,
  "pathname": "/current/path"
}
```

## Combining Multiple Flash Types

Set multiple flash messages in redirect:

```liquid
{% parse_json flash %}
  { "notice": "Partially saved", "warning": "Some fields are required", "from": {{ context.location.pathname | json }} }
{% endparse_json %}
{% liquid
  assign flash_json = flash | json
  session sflash = flash_json
  redirect_to '/form'
  break
%}
```

Only one message per type is supported simultaneously.

## Liquid Filters with Flash

Apply Liquid filters to flash messages:

```liquid
{%- assign flash = context.session.sflash | parse_json -%}
{% if flash.notice %}
  <div class="flash">
    {{ flash.notice | upcase }}
  </div>
{% endif %}
```

## Response Headers

When using `redirect_to`, HTTP headers are set:

```
Location: /dashboard
Set-Cookie: sflash={"notice":"Profile updated"}; ...
```

The cookie automatically manages flash lifecycle.

## See Also

- [Configuration Guide](./configuration.md)
- [Common Patterns](./patterns.md)
- [Known Gotchas](./gotchas.md)
- [Advanced Techniques](./advanced.md)
