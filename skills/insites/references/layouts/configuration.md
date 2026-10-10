# Layouts -- Configuration Reference

This document covers all configuration options for layout files in `app/views/layouts/`.

## File Location

Layouts live in `app/views/layouts/` or a module's `views/layouts/`. The filename (without extension) is the layout name referenced in page front matter.

> **Module path:** In modules, layouts live in `modules/<module_name>/public/views/layouts/` or `modules/<module_name>/private/views/layouts/`. Name them with the module prefix in page front matter: `layout: modules/<module_name>/dashboard_default` reads `modules/<module_name>/public/views/layouts/dashboard_default.liquid` or the same path under `private/`.

```
app/views/layouts/
├── application.liquid      # Default layout for all pages
├── admin.liquid             # Admin section layout
├── mailer.liquid            # Email layout
└── minimal.liquid           # Minimal layout (no nav/footer)
```

## Selecting a Layout from Pages

Pages select their layout via the `layout:` property in YAML front matter:

```yaml
---
layout: application
---
```

### Layout selection options

| Front Matter Value  | Layout File Used                          | Use Case              |
|---------------------|-------------------------------------------|-----------------------|
| *(omitted)*         | `app/views/layouts/application.liquid`    | Default behavior      |
| `layout: application` | `app/views/layouts/application.liquid`  | Explicit default      |
| `layout: admin`     | `app/views/layouts/admin.liquid`          | Admin section         |
| `layout: mailer`    | `app/views/layouts/mailer.liquid`         | Email templates       |
| `layout: ""`        | No layout (raw output)                    | API endpoints, AJAX   |

## Core Layout Elements

### content_for_layout (required)

Every layout must include exactly one `{{ content_for_layout }}` tag. This is where the page's rendered output is inserted.

```liquid
<body>
  {{ content_for_layout }}
</body>
```

Without this tag, page content will not appear in the response.

### yield (named slots)

`{% yield 'name' %}` renders content that pages or partials have stored via `{% content_for 'name' %}`.

```liquid
<head>
  {% yield 'head' %}
</head>
<body>
  {{ content_for_layout }}
  {% yield 'footer_scripts' %}
</body>
```

### Common yield slot conventions

| Slot Name          | Location        | Purpose                                   |
|--------------------|-----------------|-------------------------------------------|
| `head`             | Inside `<head>` | Page-specific CSS, meta tags, preloads    |
| `footer_scripts`   | Before `</body>`| Page-specific JavaScript                  |
| `breadcrumbs`      | Above content   | Page-specific breadcrumb navigation       |
| `sidebar`          | Beside content  | Page-specific sidebar content             |

## Stylesheets

Insites does not inject a CSS framework into your layout. Link the project's own stylesheet from `app/assets/` with the `asset_url` filter, which returns the CDN address:

```liquid
<html lang="en">
<head>
  <link rel="stylesheet" href="{{ 'styles/main.css' | asset_url }}">
</head>
```

The Insites module layouts work the same way: `system_pages.liquid` in module-v6-system-pages links `{{ 'css/system_pages.min.css' | asset_url }}` and sets `lang` on `<html>`. See [assets](../assets/README.md).

## Flash Message Configuration

Flash messages (toasts) are displayed via the layout, typically just before `</body>`:

```liquid
{% liquid
  assign flash = context.session.sflash | parse_json
  if context.location.pathname != flash.from or flash.force_clear
    session sflash = null
  endif
  render 'shared/toasts', params: flash
%}
```

The `from` check ensures the flash is only shown on the intended page and cleared after display.

### Flash message flow

1. A page sets a flash via `parse_json` and `session sflash = flash`
2. The page redirects to the target path
3. The layout reads the flash from `context.session.sflash | parse_json`
4. If `pathname != flash.from`, the flash is cleared via `session sflash = null`
5. The toast partial renders the notification

## Metadata in Layouts

Access page front matter metadata via `context.page.metadata`:

```liquid
<head>
  <title>{{ context.page.metadata.title | default: "My Application" }}</title>
  <meta name="description" content="{{ context.page.metadata.description }}">
  {% if context.page.metadata.og_image %}
    <meta property="og:image" content="{{ context.page.metadata.og_image | asset_url }}">
  {% endif %}
</head>
```

## Full Application Layout Example

```liquid
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{{ context.page.metadata.title | default: "My App" }}</title>
  <meta name="description" content="{{ context.page.metadata.description }}">
  <link rel="stylesheet" href="{{ 'styles/main.css' | asset_url }}">
  {% yield 'head' %}
</head>
<body>
  {% render 'shared/navigation' %}

  <main>
    {{ content_for_layout }}
  </main>

  {% render 'shared/footer' %}

  {% liquid
    assign flash = context.session.sflash | parse_json
    if context.location.pathname != flash.from or flash.force_clear
      session sflash = null
    endif
    render 'shared/toasts', params: flash
  %}

  {% yield 'footer_scripts' %}
</body>
</html>
```

## Email Layout Example

```liquid
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; }
  </style>
</head>
<body>
  {{ content_for_layout }}
  <footer>
    <p>Thank you for using our service.</p>
  </footer>
</body>
</html>
```

## See Also

- [Layouts Overview](README.md) -- introduction and key concepts
- [Layouts API](api.md) -- tags and objects available in layouts
- [Pages Configuration](../pages/configuration.md) -- how pages select layouts
- [Flash Messages](../flash-messages/README.md) -- toast notification details
- [Modules](../modules/template/README.md) -- module reference template
