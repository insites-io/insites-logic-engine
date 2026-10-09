# Assets: V2 REST API

8 endpoints under `/asset/api/v2/...`, counted in module-v6-assets v6.1.0 on 9 October 2026. Each is one page under `private/views/pages/api/_external/v2/` that `{% include %}`s a controller; the HTTP response comes from the controller's call to `modules/insites_crm/functions/response_handler`.

Auth: every page lists `modules/insites_crm/has_valid_instance_api_authorization`. Send the raw instance API key in `Authorization` ([`../../api/authentication.md`](../../api/authentication.md)). No page uses an inline `api_key_guard`.

| Method | Path | Page file | Controller alias |
|---|---|---|---|
| `GET` | `/asset/api/v2/assets` | `assets/get_assets.liquid` | `assets/controller/assets/list` |
| `GET` | `/asset/api/v2/assets/:id` | `assets/get_asset.liquid` | `assets/controller/assets/get` |
| `POST` | `/asset/api/v2/assets` | `assets/add_asset.liquid` | `assets/controller/assets/create` |
| `DELETE` | `/asset/api/v2/assets/:id` | `assets/delete_asset.liquid` | `assets/controller/assets/delete` |
| `PATCH` | `/asset/api/v2/assets/:id/archive` | `assets/archive_asset.liquid` | `assets/controller/assets/archive` |
| `GET` | `/asset/api/v2/credentials` | `credentials/get.liquid` | none (see defect below) |
| `POST` | `/asset/api/v2/folders` | `folders/add_folder.liquid` | `assets/controller/folders/create` |
| `DELETE` | `/asset/api/v2/folders` | `folders/delete_folder.liquid` | `assets/controller/folders/delete` |

## Conventions

- **IDs are numeric.** Every lookup is `admin_assets(filter: { id: { value: $id } })` (`private/graphql/_external/v2/assets/get_asset_by_id.graphql`) and the controllers coerce with `| plus: 0`.
- **The asset object** (`private/views/partials/insites_api/external_api/assets/object.liquid`): `id`, `name`, `physical_file_path`, `url`, `metadata`, `created_at`, `updated_at`. `metadata` holds `is_archived` (string `"true"`/`"false"`), `tags` (array) and `administrator_uuid` (`external_api/metadata/object.liquid`), parsed into an object before responding.
- **Errors** are `{ "errors": [ { "code", "message" } ] }` with status 400 or 404; GraphQL failures pass the raw `errors` array through with 400. Codes seen in the controllers: `missing_parameter`, `no_asset`, `no_folder`, `invalid_folder_path`, `archive_failed`, `delete_failed`, plus the upload-restriction codes under Credentials.
- **`?format=json`.** The pages declare `format: json`, but each controller gates the response handler on `context.params.format == 'json'`. Source does not show whether the front-matter value reaches `context.params`, so append `?format=json` to every request.
- **No webhooks, no event stream.** No V2 controller includes `functions/event_stream/add_event`; only the admin controllers do.

## Assets

### List: `GET /asset/api/v2/assets`

Params (`controllers/_external/v2/assets/list.liquid`): `folder` (prefix match on `physical_file_path`), `tags` (switches to `get_assets_with_tags.graphql`, a `contains` match on `metadata.tags`), `page` (default 1), `per_page` (default **10**, capped at 100). The query excludes paths containing `system_pages`, paths ending in `/` (folders), and assets whose `is_archived` is `"true"`.

Response: `{ "total_entries", "total_pages", "results": [asset] }`. There is no `page` or `size` echo.

### Read one: `GET /asset/api/v2/assets/:id`

Returns the asset or `404 no_asset`. The page passes `uuid: context.params.id`; the controller reads `params.id | default: uuid`.

### Create: `POST /asset/api/v2/assets`

Registers a file that already sits in the upload bucket (`controllers/_external/v2/assets/create.liquid`, mutation `admin_assets_create`). Params from `external_api/assets/add_asset.liquid`: `name`, `physical_file_path`, `url` (all required), `metadata.tags`, `metadata.administrator_uuid`. `tags` may be nested or the dotted key.

Before writing it calls `modules/insites_crm/functions/validate_upload` with the last segment of `name` only (no content type, no size); a refused name answers 400 with a code from `functions/upload_restrictions/error_response.liquid`. A `physical_file_path` under `modules/<x>/` that lacks `public/assets` is rewritten to `modules/<x>/public/assets/<rest>`. `metadata.is_archived` defaults to `"false"`; `administrator_uuid` is filled from `context.current_user.external_id` when the request has a user.

Response 200: the created asset.

### Delete: `DELETE /asset/api/v2/assets/:id`

Looks the asset up (404 if missing), then `admin_asset_delete_all(filter: { id }, hard_delete: true)` (`delete_asset.graphql`). Returns the asset as it was before deletion. The controller also accepts `physical_file_path` instead of `id`, but the route always carries `:id`.

### Archive: `PATCH /asset/api/v2/assets/:id/archive`

Sets `metadata.is_archived` to `"true"` through `admin_asset_update` (`private/graphql/update_file.graphql`) and returns the updated asset. Archived assets drop out of the list. **There is no V2 restore**; restore is the admin-only `PATCH /insites/assets/files`.

## Credentials

### `GET /asset/api/v2/credentials`

Params: `file_name` (required; fails closed without it), `content_type`, `file_size_bytes`. `controllers/credentials/get_details.liquid` runs `modules/insites_crm/functions/validate_upload`, then presigns against table `modules/insites_assets/assets_upload`, property `asset` (`private/graphql/get_assets_credentials.graphql`), capping `content_length` at 614,400 KiB (600 MB) or the configured `max_file_size_mb` if lower.

Response 200: `{ "s3_upload": { "direct_upload_url", "form_data" } }`. POST the file to `direct_upload_url` as multipart with every `form_data` field plus `file`, and without the Insites `Authorization` header. 400 codes: `file_name_required`, `extension_not_allowed`, `mime_mismatch`, `file_too_large`.

**Known defect.** `private/views/partials/insites_api/external_api/assets_credentials/get_credentials.liquid` documents `controller_name` as `modules/insites_assets/controllers/credentials/get_details`. No partial declares that alias: `controllers/credentials/get_details.liquid` has no `path:` front matter and reads `context.params` directly, so the page includes it by file path and a `{% function %}` on the documented name fails with partial-not-found. Found with the Logic Engine's contract lint on 9 October 2026.

## Folders

### Create: `POST /asset/api/v2/folders`

Param `folder` (or `physical_file_path`), required, must start with `modules/` (`400 invalid_folder_path`). Creates a platform asset with `url: "-"` and `name` = `physical_file_path` = the folder string (`create_folder.graphql`). Returns `{ id, name, physical_file_path, created_at, updated_at }`.

### Delete: `DELETE /asset/api/v2/folders`

Param `folder`, required. Resolves the folder by exact `name` (404 `no_folder`), then `admin_asset_delete_all(filter: { name: { starts_with: $folder } }, hard_delete: true)` (`delete_folder.graphql`): the folder record and every asset whose name starts with that string are gone. Returns the folder record as it was.

## Admin-only surface

13 pages under `private/views/pages/api/`, slugs `insites/assets/{files, files/archive, folders, archives, credentials, reports, reports/summary, reports/check-file-sizes}`, all gated by `modules/insites_crm/insites_only_allowed_by_administrators`. They hold what the API lacks: edit metadata (`PUT files`), restore (`PATCH files`), the archived list, a one-shot list of every asset, and reports. None takes an API key.
