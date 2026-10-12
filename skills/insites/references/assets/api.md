# Assets API Reference

## Filters

### asset_url

Generates a full CDN URL with cache-busting hash.

**Syntax:**
```liquid
{{ 'path/to/asset' | asset_url }}
```

**Example:**
```liquid
<img src="{{ 'images/hero.jpg' | asset_url }}" alt="Hero Image">
<link rel="stylesheet" href="{{ 'styles/main.css' | asset_url }}">
<script src="{{ 'scripts/app.js' | asset_url }}"></script>
```

**Output:**
```html
<img src="https://cdn.example.com/images/hero.jpg?updated=1774959340" alt="Hero Image">
<link rel="stylesheet" href="https://cdn.example.com/styles/main.css?updated=1774959340">
<script src="https://cdn.example.com/scripts/app.js?updated=1774959340"></script>
```

The file name is not rewritten. The `updated=` value is one per-instance timestamp,
bumped whenever any asset changes (19 May 2026 platform release), so every asset URL
is invalidated together and a browser that cached the old query-stringed URL keeps it
until the stamp moves. On an instance serving assets from local disk `asset_url` returns
a host-relative URL (16 September 2026 release). A missing asset answers 404, not 403
(6 October 2026 release).

### asset_name_to_raw_url

Resolves an asset by its **name** to its raw URL, or `nil` when no asset has that name;
live on a v6 staging instance, 9 October 2026.

```liquid
{{ 'logo.png' | asset_name_to_raw_url }}
{%- comment -%} https://<file host>/instances/1/assets/logo.png, or nothing {%- endcomment -%}
```

### asset_path

Generates a relative URL to asset.

**Syntax:**
```liquid
{{ 'path/to/asset' | asset_path }}
```

**Example:**
```liquid
<img src="{{ 'icons/user.svg' | asset_path }}" alt="User">
<video src="{{ 'videos/intro.mp4' | asset_path }}"></video>
```

## Asset Context Variables

### context.assets

Access asset metadata in Liquid:

```liquid
{% if context.assets.images.logo %}
  <img src="{{ 'images/logo.png' | asset_url }}" alt="Logo">
{% endif %}
```

### context.cdn_url

Global CDN base URL:

```liquid
CDN: {{ context.cdn_url }}
Image URL: {{ context.cdn_url }}/images/logo.png
```

## CLI Commands

There is no `assets` command. `insites-cli deploy <env>` uploads every asset, and `insites-cli sync <env>` uploads each one as it changes. To remove an asset, delete it through the admin API (`admin_asset_delete`; see `gotchas.md` for deleting by id rather than by path).

## Asset Types

### Images

Supported formats: PNG, JPEG, WebP, SVG, GIF

```liquid
<!-- Responsive image with srcset -->
<img
  src="{{ 'images/photo.jpg' | asset_url }}"
  srcset="{{ 'images/photo-small.jpg' | asset_url }} 480w,
          {{ 'images/photo-medium.jpg' | asset_url }} 1024w,
          {{ 'images/photo-large.jpg' | asset_url }} 1920w"
  alt="Photo"
>
```

### Stylesheets

```liquid
<link rel="stylesheet" href="{{ 'styles/main.css' | asset_url }}">
<link rel="stylesheet" href="{{ 'styles/print.css' | asset_url }}" media="print">
```

### Scripts

```liquid
<script src="{{ 'scripts/app.js' | asset_url }}"></script>
<script src="{{ 'scripts/vendor.js' | asset_url }}" async></script>
```

### Fonts

```liquid
<link rel="preload" href="{{ 'fonts/main.woff2' | asset_url }}" as="font" type="font/woff2">
```

## See Also

- [Configuration Guide](./configuration.md)
- [Patterns Guide](./patterns.md)
- [Advanced Techniques](./advanced.md)
- [Gotchas & Issues](./gotchas.md)
