# Assets Gotchas

## Cache Busting Surprises

### Forgetting the Filter

```liquid
<!-- WRONG: Direct path doesn't get version hash -->
<img src="/app/assets/images/logo.png" alt="Logo">

<!-- RIGHT: Use filter for CDN URL with cache busting -->
<img src="{{ 'images/logo.png' | asset_url }}" alt="Logo">
```

Without the filter, browsers may cache old versions and users won't see updates.

## Name and Path Are Both Unique, and the Name Decides the Record

`admin_assets_create` **updates** an asset when the `name` is already in use: a create with a name in use **moves that asset** to the new `physical_file_path`. A create with a **new** name for a path the instance already holds is refused with `Duplicate values. Key (instance_id, physical_file_path) ... already exists`, and the old file stays. So to replace the file at a path, read the name the instance holds for that path and send the new file under **that** name. Measured on 5 October 2026 (TW#26851119, 22 files in one rehearsal).

## `admin_asset_delete` by Path Can Delete the Wrong Record

`admin_asset_delete(physical_file_path:)` takes only a path. Where a path has a soft-deleted record **and** a live one, it answers the deleted one (success, the old id) and leaves the live asset in place. 380 deletes in a row reported success and removed nothing (TW#26851118). To remove what is actually there, use `admin_asset_delete_all(filter: { physical_file_path: { value: $p } }, hard_delete: true)`.

## `admin_asset_delete_all` with `hard_delete` Is a Background Job

It answers `scheduled` and runs later. Measured on 5 October 2026 (TW#26851122): the first call removed 309 of 412 assets after about six minutes and stopped; a second call removed the rest within two; a later call left 327 in place for 15 minutes, then ran while a load was writing to the same paths. Nothing reports when it has finished. Poll the count with `admin_assets(filter:)`, call again if it stalls, and do not write to the same paths until the count reaches zero.

**Filter by id, not by a path prefix.** On 6 October 2026 (TW#26851122) a call filtered by `physical_file_path: { starts_with: "assets/squarespace/" }` answered `scheduled` three times over 45 minutes, and two hours later nothing had gone: the same 354 live and 1,603 deleted assets. The same deletes filtered by `id: { value_in: [...] }`, in batches, were gone within about a minute. Read the ids with `admin_assets(filter:)` first, then delete by id.

## The File Host Keeps Serving Old Bytes at the Plain Address

After a file is uploaded again over an existing asset, `asset_url` (which appends `?updated=`) serves the new file, and the **plain** address keeps serving the old one until the cache expires: 532,808 old bytes at the bare path against 532,534 new ones at the same path with any query string (TW#26851120). Anything that loads by plain address, such as a webpack runtime asking for its chunks, can run an old chunk beside new code. Reference uploads through `asset_url`, or give a changed file a new path.

## Environment-Specific URLs

### Different CDN in Staging vs Production

The `asset_url` filter automatically uses the environment's CDN endpoint from `.insites`:

```liquid
<!-- Automatically picks staging or production CDN -->
{{ 'images/logo.png' | asset_url }}
```

Don't hardcode CDN URLs—always use filters to ensure proper environment handling.

## Asset Upload Timing

### Assets Must Deploy with Code

Assets are synced during `insites-cli deploy`. If you:

1. Upload assets manually without deploying code changes
2. Code references assets that haven't been deployed yet

Result: 404 errors and broken pages.

**Solution:** Always deploy together:

```bash
insites-cli deploy staging  # Deploys code AND assets atomically
```

## SVG Security

### Inline SVG Can Execute Scripts

```liquid
<!-- RISKY: User-uploaded SVG with script tags -->
{{ dynamic_svg_content }}

<!-- SAFE: SVG as image source (sandbox) -->
<img src="{{ 'icons/safe.svg' | asset_url }}" alt="Icon">
```

Only inline SVGs you control. User-uploaded SVGs should be served as image sources or sanitized.

## Large Asset Handling

### Size Limits Affect Upload Speed

- Assets over 100MB: Use separate CDN or chunked upload
- Many small files: Bundle to reduce HTTP requests
- Uncompressed CSS/JS: Minify before deployment

Check deployment logs for upload performance issues.

## Path Resolution Issues

### Asset Paths Are Relative to app/assets/

```liquid
<!-- app/assets/images/logo.png -->
{{ 'images/logo.png' | asset_url }}  <!-- Correct -->

{{ 'app/assets/images/logo.png' | asset_url }}  <!-- Wrong: double path -->

{{ '/images/logo.png' | asset_url }}  <!-- Wrong: leading slash -->
```

Always use relative paths from the `app/assets/` root.

> **Module path:** The same rules apply for module assets. Files in `modules/<module_name>/public/assets/images/logo.png` are referenced as `{{ 'images/logo.png' | asset_url }}` — do not include the module directory prefix in the filter argument.

## CORS with Cross-Domain Assets

### CDN Assets and Cross-Origin Requests

For fonts or resources needed across domains:

```liquid
<link rel="preload" href="{{ 'fonts/main.woff2' | asset_url }}" as="font" crossorigin>
```

The `crossorigin` attribute is required for fonts to load properly.

## Subdirectory Depth

### Asset Path Limits

Some browsers limit URL length. Keep asset paths reasonable:

```liquid
<!-- Acceptable -->
{{ 'images/icons/user/profile/avatar.png' | asset_url }}

<!-- Too deep - consider flatter structure -->
{{ 'images/a/b/c/d/e/f/g/h/file.png' | asset_url }}
```

## Browser Caching Issues

### Hard Refresh Required for Updates

After deploying new assets, users may need to hard-refresh (Ctrl+Shift+R) to see updates due to browser caching. The hash helps but old cache may persist.

**Best practice:** Educate users or use service workers for cache invalidation.

## See Also

- [Configuration Guide](./configuration.md)
- [API Reference](./api.md)
- [Patterns Guide](./patterns.md)
- [Advanced Techniques](./advanced.md)
