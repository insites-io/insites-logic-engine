# Flash Messages Configuration

## Overview

Flash messages in Insites are temporary notifications displayed to users. They persist across a single redirect and are automatically cleared. Flash data is stored in the session via the `session` tag and read via `context.session`.

## Setup

### Include Flash Handling in Layout

Add to your layout file (`app/views/layouts/application.liquid`) before `</body>`:

```liquid
{% liquid
  assign flash = context.session.sflash | parse_json
  if context.location.pathname != flash.from or flash.force_clear
    session sflash = null
  endif
  render 'shared/toasts', params: flash
%}
```

This reads the flash from session, clears it after display, and renders the toast partial.

## Flash Message Types

Insites supports four flash message types:

| Type | CSS Class | Use Case |
|------|-----------|----------|
| `notice` / `success` | `.notice` | Positive confirmation, success messages |
| `alert` / `error` | `.alert` | Error messages, warnings |
| `warning` | `.warning` | Non-critical warnings |
| `info` | `.info` | Informational messages |

## Session Flash Management

Flash messages are stored in the session and cleared based on page navigation:

```liquid
{% liquid
  assign flash = context.session.sflash | parse_json
  if flash
    if context.location.pathname != flash.from
      session sflash = null
    endif
  endif
%}
```

## Flash Storage Structure

Flash data is stored in session with the following structure:

```json
{
  "notice": "Profile updated",
  "alert": null,
  "warning": null,
  "info": null,
  "pathname": "/dashboard"
}
```

Flash values are plain strings displayed directly to the user. Write them in the template, or look them up with the `t` filter when the site serves more than one language.

## Layout Pattern

Recommended layout structure for flash messages:

```liquid
<!DOCTYPE html>
<html class="pos-app">
<head>
  <title>{{ context.page.metadata.title | default: "My App" }}</title>
  {% render 'modules/common-styling/init' %}
</head>
<body>
  {{ content_for_layout }}

  {% liquid
    assign flash = context.session.sflash | parse_json
    if flash
      if context.location.pathname != flash.from or flash.force_clear
        session sflash = null
      endif
    endif
    render 'shared/toasts', params: flash
  %}
</body>
</html>
```

## CSS Classes

Standard CSS for flash styling:

```css
.flash-container {
  position: relative;
  z-index: 1000;
}

.flash {
  padding: 16px;
  margin-bottom: 16px;
  border-radius: 4px;
  font-size: 14px;
}

.flash.notice,
.flash.success {
  background-color: #d4edda;
  border: 1px solid #c3e6cb;
  color: #155724;
}

.flash.alert,
.flash.error {
  background-color: #f8d7da;
  border: 1px solid #f5c6cb;
  color: #721c24;
}

.flash.warning {
  background-color: #fff3cd;
  border: 1px solid #ffeeba;
  color: #856404;
}

.flash.info {
  background-color: #d1ecf1;
  border: 1px solid #bee5eb;
  color: #0c5460;
}
```

## JavaScript Integration

Access flash messages from JavaScript:

```javascript
const flashMessage = document.querySelector('.flash.notice');
if (flashMessage) {
  console.log('Flash message:', flashMessage.textContent);
}
```

## File Structure

```
app/
├── views/layouts/
│   └── application.liquid
├── modules/
│   └── module.yml
└── graphql/
    └── mutations/
```

Flash messages use the built-in `session` tag and `context.session` object.

## Best Practices

1. **Always redirect after setting flash** for best UX
2. **Use localization keys** for multi-language support
3. **Clear flash after showing** to prevent persistence
4. **Validate flash type** before rendering
5. **Use semantic types** (notice for success, alert for errors)

## See Also

- [Flash Messages API Reference](./api.md)
- [Common Patterns](./patterns.md)
- [Known Gotchas](./gotchas.md)
- [Advanced Techniques](./advanced.md)
