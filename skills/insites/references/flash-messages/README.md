# Flash Messages & Toasts

Flash messages provide user feedback after actions (success, error notifications).

## Layout Setup

Add before `</body>` in your layout:

```liquid
{% liquid
  assign flash = context.session.sflash | parse_json
  if context.location.pathname != flash.from or flash.force_clear
    session sflash = null
  endif
  render 'shared/toasts', params: flash
%}
```

## Server-Side Flash Messages

### Set flash and redirect
```liquid
{% parse_json flash %}
  { "notice": "app.products.created", "from": {{ context.location.pathname | json }} }
{% endparse_json %}
{% liquid
  assign flash_json = flash | json
  session sflash = flash_json
  redirect_to '/products'
  break
%}
```

### Set flash with alert and redirect
```liquid
{% parse_json flash %}
  { "alert": "app.products.error", "from": {{ context.location.pathname | json }} }
{% endparse_json %}
{% liquid
  assign flash_json = flash | json
  session sflash = flash_json
  redirect_to '/products'
  break
%}
```

### Simple redirect (no flash)
```liquid
{% redirect_to '/products' %}
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

```javascript
showFlash('notice', 'Saved successfully!');
showFlash('alert', 'Something went wrong');
```

## Flash Message Types

| Type | Usage |
|------|-------|
| `notice` | Success messages |
| `alert` | Error messages |
| `warning` | Warning messages |
| `info` | Informational messages |
