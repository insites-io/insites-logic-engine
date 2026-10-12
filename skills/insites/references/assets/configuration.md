# Assets Configuration

## Overview

Static assets in Insites are stored in `app/assets/` and served via CDN with automatic cache-busting. Subdirectories organize assets by type: `images/`, `fonts/`, `styles/`, and `scripts/`. All assets are synced to the CDN during deployment and referenced through Liquid filters.

## Directory Structure

```
app/assets/
├── images/
│   ├── logo.png
│   ├── icons/
│   └── backgrounds/
├── fonts/
│   ├── custom-font.woff2
│   └── fallbacks/
├── styles/
│   ├── main.css
│   └── vendor/
└── scripts/
    ├── app.js
    └── vendor/
```

## Configuration Files

### Asset CDN Configuration

The CDN endpoint is automatically determined by the platform based on your instance's `url` in the `.insites` file. There is no separate CDN configuration — the `asset_url` filter automatically generates the correct CDN URL for each environment.

### Asset Manifest (Optional)

For custom asset mapping and versioning:

```yaml
assets:
  cache_control: 'public, max-age=31536000'
  gzip: true
  minify: true
```

## Asset Serving

### CDN URLs

Use the `asset_url` filter to generate full CDN URLs:

```liquid
<img src="{{ 'images/logo.png' | asset_url }}" alt="Logo">
```

### Relative Paths

Use `asset_path` filter for relative URLs:

```liquid
<link rel="stylesheet" href="{{ 'styles/main.css' | asset_path }}">
```

## Cache Busting

The file name does not change. `asset_url` appends an `?updated=` stamp, and the stamp changes each time the file is uploaded again:

```
Uploaded:     scripts/app.js
asset_url:    https://files.<stack>/instances/<id>/assets/scripts/app.js?updated=1791323249
Plain address: https://files.<stack>/instances/<id>/assets/scripts/app.js
```

Measured on 7 October 2026 on one staging and one production instance. The plain address is cached for a year at the edge and ten years in the browser, and an upload does not purge it, so only the `asset_url` form is cache busted. See [The File Host Keeps Serving Old Bytes at the Plain Address](gotchas.md#the-file-host-keeps-serving-old-bytes-at-the-plain-address).

## Deploy Configuration

### Automatic Sync

Assets sync automatically on `insites-cli deploy`:

```bash
insites-cli deploy staging
# Compiles, uploads, and registers all assets in app/assets/
```

### Uploading Without a Full Deploy

`insites-cli sync <env>` uploads each asset as it changes. There is no separate `assets` command.

## Performance Best Practices

- Use CDN URLs with `asset_url` in production
- Serve fonts from `fonts/` with proper cache headers
- Minify CSS and JS before deployment
- Organize images logically with subdirectories
- Use webp format where supported with fallbacks

## MIME Type Configuration

Insites automatically detects MIME types:

- CSS: `text/css`
- JS: `application/javascript`
- Fonts: `font/woff2`, `font/woff`
- Images: `image/png`, `image/jpeg`, `image/webp`

## See Also

- [API Reference](./api.md)
- [Patterns Guide](./patterns.md)
- [Advanced Techniques](./advanced.md)
- [Gotchas & Issues](./gotchas.md)
