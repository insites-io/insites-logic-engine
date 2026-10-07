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

## `admin_asset_delete` by Path Deletes an Older Deleted Record, Not the Live One

`admin_asset_delete(physical_file_path:)` takes only a path; there is no id form. A delete keeps the record, with `deleted_at` set, for 30 days. So a path that has been deleted and then written again holds two records, the old deleted one and the live one, and a delete by that path picks the **deleted** record. It sets that record's `deleted_at` again, answers with the old id and no error, and the live asset stays where it was. This is how the mutation works today, so code that deletes by path has to allow for it.

Measured on a v6 instance on 7 October 2026 (TW#26851118), on one path:

| Step | Answered | Live at the path afterwards |
|---|---|---|
| Create | 51358 | 51358 |
| Delete by path | 51358 | none |
| Create again | 51359 | 51359 |
| Delete by path, three times | 51358 each time | 51359 |
| Delete by id: `admin_asset_delete_all` with `hard_delete: true` | `scheduled` | none, within seconds |

Clearing the old record first does not get round it. On the same path, `admin_asset_delete_all(filter: { id: { value_in: ["51358"] } }, hard_delete: true)` on the deleted record only stamped its `deleted_at` again. The record was still there after five minutes, and the next delete by path still answered 51358.

A path holding only a live record deletes as expected (control: 51357 created, deleted, gone from the listing). The same shape shows at scale: a rollback that deleted 267 files by path left 170 of them live, every one at a path holding an older deleted copy, and none of the 97 that went sat at such a path (6 October 2026). Earlier, 380 deletes in a row answered with one old id and removed nothing.

**To delete what is live at a path, delete it by id:**

1. Read the live id with `admin_assets(filter: { physical_file_path: { value: $p } })`. The default listing leaves deleted records out; add `deleted_at: { exists: true }` to see them.
2. Delete it with `admin_asset_delete_all(filter: { id: { value_in: [$id] } }, hard_delete: true)`. Filter by id: a path filter also matches the old deleted record (see below).
3. Read the path back until the listing is empty. The answer, `scheduled`, does not say when that has happened. The record stays, marked deleted, even with `hard_delete: true` (next section).

Do not treat the answer from `admin_asset_delete` as proof the file has gone. Read the path back.

## `admin_asset_delete_all` Runs as a Background Job

This is how the mutation works today. Code that deletes assets has to work with it.

- **It answers `scheduled` and does the work later.** The answer comes back in under a second and carries no job id. Nothing in the answer says when the delete has finished.
- **The job deletes about 3 to 4 assets a second on staging and 6 to 11 a second on production.** On a quiet instance every job ran to the end, up to 1,000 assets in one call.
- **A path prefix filter and an id filter run at the same speed.** Use whichever selects the assets you mean.
- **The filter also matches assets that are already deleted.** You do not need `deleted_at: { exists: true }` to reach them. A second delete over deleted assets stamps their `deleted_at` again and changes nothing else.
- **`hard_delete: true` makes no difference today.** With or without it, each asset is marked deleted, with `deleted_at` set to the time of the delete, and leaves the default listing. The record stays, and the file at its address keeps serving its old bytes. 90 minutes after a delete with `hard_delete: true`, nothing had been removed.
- **Two jobs run side by side**, each at about the speed of one job alone. They do not wait for each other.

**To know when a delete has finished**, poll `admin_assets(filter:)` with the same filter, leaving out `deleted_at`. The delete is done when `total_entries` reaches 0. The job also shows in `admin_background_jobs(filter: { type: RUNNING })` on the `long_running` queue while it works, and leaves when it is done. That entry has no arguments and no `source_name`, so it can only be matched to a call when nothing else is running.

**A running job leaves alone assets written after it started.** Assets written under the same prefix while a job was running were not deleted. Still wait for the count to reach 0 before writing to those paths. A job that starts late has not yet chosen what it deletes, and on 5 October 2026 one did start late and then ran during a load (see below).

**A deleted asset is kept for 30 days.** Insites keeps every deleted item for 30 days from its `deleted_at`, then removes it in an overnight job. So a deleted asset, and the file at its address, stays for about 30 days whether or not `hard_delete` was set. Until then the address keeps serving the file.

**`deleted_at` cannot be set on an asset.** `admin_asset_update` and `admin_asset_update_all` refuse it with `InputObject 'AssetUpdateInput' doesn't accept argument 'deleted_at'` (and the same for `AssetUpdateAllInput`). On a row it can be set, which is how a row is removed sooner (see `schema/api.md`).

Measured on two v6 instances on 7 October 2026, one on staging and one on production (TW#26851122). Times come from polls every 15 seconds. `hard_delete: true` stamped `deleted_at` with the time of the call, the same as a delete without it, on both instances:

| Run | Assets | Staging | Production |
|---|---|---|---|
| `hard_delete: true`, path prefix filter | 400 | 111 s | 48 s |
| `hard_delete: true`, id filter | 400 | 111 s | 48 s |
| Without `hard_delete`, path prefix filter | 200 | 64 s | 32 s |
| Without `hard_delete`, path prefix filter (second run) | 200 | 48 s | 32 s |
| `hard_delete: true`, path prefix filter | 1,000 | 270 s | 94 s |
| Two deletes with `hard_delete: true`, started together | 300 + 300 | 152 s | 57 s |

After 90 minutes, 2,200 of 2,200 deleted assets on each instance were still listed with `deleted_at` set. 20 of 20 sampled addresses on each instance still answered 200 with the original bytes, including with a cache-busting query string. A control on production deleted without `hard_delete` (50 assets) looked the same. On a set already deleted, a second delete re-stamped `deleted_at` on 50 of 50 assets, with no `deleted_at` filter in the call. 20 assets written under a prefix while a delete of 300 was running were all still live once it finished, 20 of 20 on each instance.

Earlier, slower runs: on 5 and 6 October 2026, on a migration destination, one delete left its assets in place for over an hour and one job stopped after 309 of 412 assets. Neither happened in the 14 runs on quiet instances: the 12 in the table and the 2 late-write runs. Loads were also running on that destination. That is the likely cause, but it was not measured. If a count stops falling, call the delete again.

## The File Host Keeps Serving Old Bytes at the Plain Address

After a file is uploaded again over an existing asset, `asset_url` (which appends `?updated=`) serves the new file, and the **plain** address keeps serving the old one: 532,808 old bytes at the bare path against 532,534 new ones at the same path with any query string (TW#26851120). Anything that loads by plain address, such as a webpack runtime asking for its chunks, can run an old chunk beside new code.

**An upload does not purge the file host's cache, and there is no short expiry to wait out.** The file host answers every asset with `cache-control: public, max-age=315576000, s-maxage=31536000`: one year at the edge, ten years in the browser. Measured on 7 October 2026 on one staging and one production instance: a file was synced, its plain address fetched until the edge answered `cf-cache-status: HIT`, and the file synced again with new content. `asset_url` and any query string returned the new content straight away; the plain address kept answering `HIT` with the old content on all 30 checks over the next 15 minutes, once a minute on each instance, and was still old eight hours later. A plain address only catches up when the edge happens to evict the copy, which is not a time you can plan for.

**A purge clears the edge, not the browser.** An edge purge of the exact URL, run by an Insites operator on the stack's CDN, made both plain addresses serve the new content within five seconds (same day, same two files). That is an operator action, not something an instance can do, and it does not reach a browser that has already loaded the plain address: that browser holds its copy for ten years and does not ask again. So the fix sits with the reference, not the platform:

- Reference every uploaded file through `asset_url`, so a changed file gets a new `?updated=` address.
- Where a runtime builds addresses itself (webpack chunks, dynamic `import()`), give each changed file a new path, such as a content hash in the file name, and never upload new content over an old path.

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
