# API module endpoints

Every HTTP page the module serves, from `modules/insites_api/private/views/pages/` in module-v6-api v6.0.2 (read 9 October 2026). File paths are relative to that directory.

Three guard tiers:

- **Instance API key**: `modules/insites_crm/has_valid_instance_api_authorization`. Raw key in `Authorization`, no prefix ([`../../api/authentication.md`](../../api/authentication.md)).
- **Administrator session**: `modules/insites_crm/insites_only_allowed_by_administrators`. These pages serve the IIA SPA (`vue/src/services/*.js`).
- **Public**: no `authorization_policies:` key; the docs pages say why in a front-matter comment (TW#26617714).

JSON pages use `layout: modules/insites_crm/json` and `modules/insites_crm/functions/response_handler`, which defaults the status to 400 unless the controller set 200.

---

## External: Custom API Endpoints (`api/_external/v2/endpoints/`)

| Method | Path | Page file | Alias |
|---|---|---|---|
| `GET` | `/insites/api/v2/endpoints` | `get.liquid` | `insites/controller/endpoints/list` |
| `GET` | `/insites/api/v2/endpoints/:id` | `get_details.liquid` | `insites/controller/endpoints/get` |
| `POST` | `/insites/api/v2/endpoints` | `post.liquid` | `insites/controller/endpoints/create` |
| `PUT` | `/insites/api/v2/endpoints/:id` | `put.liquid` | `insites/controller/endpoints/update` |
| `PATCH` | `/insites/api/v2/endpoints/:id` | `patch.liquid` | `insites/controller/endpoints/update` |
| `DELETE` | `/insites/api/v2/endpoints/:id` | `delete.liquid` | `insites/controller/endpoints/delete` |

Six routes, five operations: PUT and PATCH include the same controller. All six carry `format: json` and the instance-key policy. Controllers live in `partials/controllers/_external/v2/endpoints/`.

### List

`params.page` (default 1), `params.size` (default 10); no keyword or sort. `get_api_endpoints.graphql` reads `admin_pages` with `format: json` and no `source_name` metadata key, sorted `updated_at DESC`. Returns `{ total_entries, total_pages, current_page, per_page, results: [ { id, created_at, updated_at, request_method, slug, metadata, format, physical_file_path } ] }`; failure 400 `{ message: "Failed to list endpoints.", errors }`.

### Get

Argument `id`. Returns `{ id, slug, metadata, physical_file_path, request_method, content, redirect_code, redirect_to, authorization_policies: [ { id, content, metadata, name, redirect_to, physical_file_path } ] }`. Unknown id: 404 `{ message: "Endpoint not found." }`.

### Create

`params` is a hash. `models/build_payload.liquid` applies:

| Rule | Detail |
|---|---|
| Allowed | `slug`, `physical_file_path`, `content`, `request_method`, `format`, `metadata`, `authorization_policy_ids`, `redirect_to`, `redirect_code`, `searchable`, `max_deep_level`, `dynamic_cache_expire`, `dynamic_cache_key`, `dynamic_cache_layout` |
| Rejected ("is not accepted on this endpoint") | `layout`, `layout_name`, `handler`, `manually_managed`, `subdomain`, `response_headers`, `static_cache_expire` |
| Required | `slug`, `physical_file_path`, `content` |
| Policies | at least one non-blank id in `authorization_policy_ids`; every id must exist (`get_policies_by_ids.graphql`, `per_page: 100`) |
| Slug | lowercased; first segment not in `admin api insites modules crm ecommerce events event locator asset assets database databases data pipeline pipelines form forms cms permission permissions`; no `..`, no leading `/` |
| `physical_file_path` | starts with `modules/ins_api/public/views/pages/`, ends `.liquid`, no `..` |
| `redirect_to` / `redirect_code` | starts with `/` / `MOVED_PERMANENTLY` or `MOVED_TEMPORARILY` |
| `max_deep_level` | 1 to 6 |
| `format` | `json` when blank |

Then `check_slug_availability.graphql` (`admin_pages` by exact slug, `per_page: 20`): a hit with the same `request_method` (default `get`) is a 409. `add_api_endpoint.graphql` (`admin_page_create`) returns `{ id, slug, physical_file_path, metadata, layout }` and an event-stream row is written.

Errors: 400 `{ message: "Validation failed.", errors: [ { field, error } ] }`; 409 `{ message: "Slug is not available.", errors }`; 400 `{ message: "Failed to create the endpoint.", errors }`.

### Update (PUT and PATCH)

Argument `id` plus `params`. Unknown id is 404. Merge base from the stored page: `slug`, `physical_file_path`, `content`, `request_method`, `metadata`, `redirect_to`, `redirect_code`, policy ids. Request fields overlay it; the create rules run on the result; the collision check skips the page's own id. `edit_api_endpoint.graphql` returns `{ id, slug, physical_file_path, metadata, layout, authorization_policies: [ { id, name } ] }`. Fields outside the merge base reset ([`gotchas.md`](gotchas.md)).

### Delete

Argument `id`. 404 when missing; otherwise `{ id, slug, physical_file_path }`.

---

## Admin: Custom API Endpoints (`api/api_endpoints/`)

Administrator session; bodies arrive as `context.params.payload`.

| Method | Path | Controller | Notes |
|---|---|---|---|
| `GET` | `/insites/api/endpoints` | `get_list` | `size`, `page`, `search`, `field` (`Custom API Endpoint Name`, `Slug`), `sort` (`Last Updated`, `Date Created`, `Slug`, `Custom API Endpoint Name`), `order` |
| `GET` | `/insites/api/endpoints/paths` | `get_paths` | every JSON page's `physical_file_path`, `per_page: 10000` |
| `GET` | `/insites/api/endpoints/:id` | `get_details` | same query as the external get |
| `POST` | `/insites/api/endpoints` | `add` | `payload` to `admin_page_create` after `split_policy_selection` |
| `PUT` | `/insites/api/endpoints/:id` | `edit` | same, `admin_page_update`; no merge, no validation |
| `PATCH` | `/insites/api/endpoints/:id` | `edit_metadata` | `payload` becomes `metadata` |
| `DELETE` | `/insites/api/endpoints/:id` | `delete` | |

`split_policy_selection.liquid` moves name-valued entries (containing `/`) from `authorization_policy_ids` into a comma-joined `authorization_policies` string and drops the `NONE` sentinel (TW#25429518).

## Admin: Authorization policies (`api/auth_policies/`)

| Method | Path | Controller | Notes |
|---|---|---|---|
| `GET` | `/insites/api/auth_policies` | `get_list`, or `get_details` with `?path=` | list hides paths starting `modules/insites_`; detail returns `name, metadata, content, flash_alert, http_status, physical_file_path, redirect_to` via `insites_response_util` |
| `GET` | `/insites/api/auth_policies/paths` | `get_paths` | `physical_file_path, metadata, id`, same filter |
| `POST` | `/insites/api/auth_policies` | `add` | `content`, `flash_alert`, `redirect_to`, `physical_file_path`, `metadata` |
| `PUT` | `/insites/api/auth_policies` | `edit` | adds `old_physical_file_path`; the path is the key |
| `DELETE` | `/insites/api/auth_policies` | `delete` | `physical_file_path` in the body |
| `POST` | `/insites/api/auth-policies-options` | `options/get_options` | **included partial missing from the tree** |

## Admin: GraphQL (`api/graphqls/`)

Same shape at `/insites/api/graphqls` (`GET` list or `?path=` detail, `GET .../paths`, `POST`, `PUT`, `DELETE`). Fields `body`, `physical_file_path`, `metadata`; detail returns `name, metadata, body, physical_file_path`. Lists hide `modules/insites_` paths.

## Admin: Reports (`api/reports/get.liquid`)

`GET /insites/api/reports?start_date=&end_date=`. Signs an HS256 JWT with a per-request secret, sets `Authorization: metrics|<double-base64 instance uuid>|<jwt>`, and runs `system/trigger_api_call.graphql` on `private/api_calls/get_reports.liquid` (target `https://api.insites.io/metrics`). Returns the remote body's `result.api_call` with the remote status; the shape (`[["2024-11-25", "1120"], ...]`) is described only in `vue/src/views/API/Reports/Reports.vue`.

## Admin: Themes (`api/themes/post.liquid`)

`POST /insites/api/themes` with `user` and `theme`; guard `insites_only_allowed_if_logged_in`. Runs `modules/insites_crm/themes/update_theme` and echoes `theme`.

## Public: API reference (`docs/`)

| Path | Page file | Serves |
|---|---|---|
| `/admin/api[/<module>/<feature>[/<endpoint>]]` | `api.liquid` | HTML; a `.md` suffix 301s to `/admin/api_md/...`; a fifth segment other than `overview` 301s to the `#anchor` form |
| `/admin/api_md/...` | `api.md.liquid` | `text/markdown` twin with the Controller Contract tables |
| `/admin/json/<module>/<feature>` | `json.liquid` | the feature's `object` partial as JSON |
| `/llms` | `llms.txt.liquid` | `text/plain` index of every markdown page |
| `/admin/api/js/test-request` | `js/test_request.js.liquid` | try-it panel script |
| `/admin/api/module-versions` | `module_versions.liquid` | signed-in only |

For a signed-in viewer, `session_data.liquid` copies `instance_api_key` from CRM instance configuration into the session key `insites_api`, and `api.md.liquid` prints it under Authentication.
