# Flash Messages Gotchas

## Overview

Common pitfalls and troubleshooting tips for flash message implementation in Insites.

## Flash Not Appearing

### Missing Flash Handling in Layout

Flash won't display if the layout doesn't read from `context.session.sflash`:

```liquid
<!-- Add to app/views/layouts/application.liquid before </body> -->
{% liquid
  assign flash = context.session.sflash | parse_json
  if context.location.pathname != flash.from or flash.force_clear
    session sflash = null
  endif
  render 'shared/toasts', params: flash
%}
```

### Conditional Layout Application

Verify flash-enabled layout is used on redirect target page:

```liquid
{%- assign flash = context.session.sflash | parse_json -%}
{% if flash %}
  <div class="alert">{{ flash.notice }}</div>
{% endif %}
```

If layout doesn't read from session, flash data is ignored.

## Flash Persisting Across Pages

### Pathname Not Changing

Flash should clear when pathname changes. Check that URL actually changed:

```liquid
{%- assign flash = context.session.sflash | parse_json -%}
<!-- Debug: Check pathname -->
<!-- Current: {{ context.location.pathname }} -->
<!-- Flash from: {{ flash.from }} -->
```

If both are identical, flash persists (by design).

### Same URL with Different Anchors

URL anchors (#section) don't affect pathname, flash won't clear:

```
/page#section1 -> /page#section2
<!-- Same pathname, flash persists -->
```

Manually clear if needed:

```liquid
{% session sflash = null %}
```

## Flash Message Text Issues

### Use Descriptive Flash Messages

Flash messages hold plain text that is displayed directly to the user. Write it in the template, or look it up with the `t` filter when the site serves more than one language:

```liquid
{% comment %} Correct — use descriptive flash messages {% endcomment %}
{% liquid
  assign flash = '{"notice": "Profile updated", "from": "/dashboard"}' | parse_json
  assign flash_json = flash | json
  session sflash = flash_json
  redirect_to '/dashboard'
  break
%}

{% comment %} Incorrect — translation keys produce "translation missing:" errors {% endcomment %}
{% comment %} "notice": "user.profile_updated" {% endcomment %}
```

## Flash with Redirect Loop

### Incorrect URL in Redirect

Infinite redirect occurs if redirect URL points back to itself:

```liquid
{% comment %} WRONG: Creates redirect loop {% endcomment %}
{% parse_json flash %}
  { "notice": "saved", "from": {{ context.location.pathname | json }} }
{% endparse_json %}
{% liquid
  assign flash_json = flash | json
  session sflash = flash_json
  redirect_to context.location.pathname
  break
%}
```

Always redirect to a different URL:

```liquid
{% comment %} CORRECT {% endcomment %}
{% liquid
  assign flash = '{"notice": "saved", "from": "/dashboard"}' | parse_json
  assign flash_json = flash | json
  session sflash = flash_json
  redirect_to '/dashboard'
  break
%}
```

## Multiple Flash Types Not Working

### Only One Type Renders

Only one flash message per type displays at a time. The JSON object holds one value per key, so the last `session sflash` call wins.

Use a single `parse_json` call with the appropriate type or restructure logic.

### Mixed Types Work

Different types work together in the same flash object:

```liquid
{% liquid
  assign flash = '{"notice": "Saved", "warning": "Some fields are empty", "from": "/form"}' | parse_json
  assign flash_json = flash | json
  session sflash = flash_json
  redirect_to '/form'
  break
%}
```

Both `notice` and `warning` will display.

## Flash with Dynamic Content

### User Input in Flash

Never put user-provided content directly in flash messages. Always use localization keys:

```liquid
{% comment %} SAFE: Use descriptive flash messages {% endcomment %}
{% liquid
  assign flash = '{"notice": "Item created", "from": "/items"}' | parse_json
  assign flash_json = flash | json
  session sflash = flash_json
  redirect_to '/items'
  break
%}
```

Always use descriptive flash messages for user-facing text.

### Variable Interpolation

Variables don't interpolate inside JSON strings. Build the message before storing it:

```liquid
{% comment %} RIGHT: Build the message with the variable first {% endcomment %}
{% assign notice_msg = 'Created: ' | append: item_name %}
```

## JavaScript Toast Issues

### pos.modules Object Undefined

Toast requires pos module loading:

```javascript
// May fail if module not loaded yet
new pos.modules.toast('success', 'Message');

// Safe: wrap in load handler
document.addEventListener('posModulesReady', function() {
  new pos.modules.toast('success', 'Message');
});
```

### Toast Missing in Markup

Toast visual styles require CSS classes. Ensure styles are loaded:

```liquid
<link rel="stylesheet" href="{{ 'styles/toast.css' | asset_url }}">
```

Without CSS, toast displays as plain text or invisible.

## Session Flash Cleared Unexpectedly

### Session Timeout

Flash lives in session. Session timeout clears flash:

```liquid
{% comment %} If session expires, flash is lost {% endcomment %}
{%- assign flash = context.session.sflash | parse_json -%}
{% comment %} flash is null {% endcomment %}
```

Keep session timeout appropriate for expected redirect time.

### Cookie Handling

Verify cookies are enabled and not blocked:

```javascript
if (navigator.cookieEnabled) {
  // Flash will work
} else {
  // Flash won't work without cookies
}
```

## See Also

- [Configuration Guide](./configuration.md)
- [API Reference](./api.md)
- [Common Patterns](./patterns.md)
- [Advanced Techniques](./advanced.md)
