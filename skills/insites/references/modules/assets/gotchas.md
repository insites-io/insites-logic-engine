# Assets: Gotchas

Edges visible in module-v6-assets v6.1.0 source on 9 October 2026. Each: what bites, why, how to avoid.

## 1. The prefix is `/asset/api/v2/`, singular

**Bites:** `/assets/api/v2/...` never reaches the module. **Why:** every page slug is `asset/api/v2/...`; the v5.2.1 changelog records that the plural prefix is reserved by the platform's asset handler. **Avoid:** copy the slug from the page file.

## 2. Default page size is 10, the doc says 50

**Bites:** a client trusting `external_api/assets/object.liquid` (`per_page` default 50) gets 10 per page. **Why:** `controllers/_external/v2/assets/list.liquid` defaults `per_page` to 10 and clamps at 100. **Avoid:** always send `per_page`.

## 3. Folder delete is `starts_with` on `name`, hard delete

**Bites:** deleting `modules/m/public/assets/img` also removes `modules/m/public/assets/img-archive/...` and every file inside. **Why:** `delete_folder.graphql` filters `name: { starts_with: $folder }` with `hard_delete: true`. **Avoid:** pass the folder with its trailing slash and list it first.

## 4. Folder delete needs an exact-name folder record

**Bites:** 404 `no_folder` for a folder that visibly holds files. **Why:** `controllers/_external/v2/folders/delete.liquid` first runs `get_asset_by_name.graphql`, an equality match on `name`; folders created outside the API (or paths without a record) do not match. **Avoid:** create folders through the API or the admin UI, and reuse the exact string.

## 5. `create` trusts `url`

**Bites:** an asset whose `url` points anywhere. **Why:** `controllers/_external/v2/assets/create.liquid` stores `payload.url` unchanged; only the file name's extension is validated, not the content type or size. **Avoid:** always obtain the URL from the credentials step.

## 6. The documented credentials controller does not exist

`external_api/assets_credentials/get_credentials.liquid` names `modules/insites_assets/controllers/credentials/get_details`; no partial declares that `path:`. The partial reads `context.params` and has no front matter. Call the HTTP endpoint; do not `{% function %}` the name.

## 7. `assets/controller/assets/list` returns unparsed metadata to Liquid

**Bites:** `item.metadata.tags` is blank in a `{% for %}`. **Why:** the controller builds `items_with_parsed` for the HTTP body but `{% return data %}` returns the raw GraphQL hash. **Avoid:** `| parse_json` each `metadata` string yourself; `get` does not have this problem.

## 8. Three controllers call the response handler ungated on a missing parameter

`assets/get` without `id`, `assets/delete` without `id` or `physical_file_path`, `folders/delete` without `folder`: the `missing_parameter` branch includes `response_handler` without the `format == 'json'` check, so an HTML page that calls them with blank input gets its status and `Content-Type` rewritten. Pass the parameter.

## 9. API writes leave no event-stream trace

**Bites:** an audit reads the Event Stream screen and misses every API upload and delete. **Why:** only the admin controllers under `controllers/files/` and `controllers/folders/` include `functions/event_stream/add_event.liquid`; the V2 controllers never do, and there are no webhooks. **Avoid:** log on the client side.

## 10. `administrator_uuid` is blank on API-key creates unless you send it

`create.liquid` fills it from `context.current_user.external_id` only when a user is present; the API-key path has none in source. Send `metadata.administrator_uuid` if the "Updated By" column matters.

## 11. The API index points at a schema that does not exist

`private/views/partials/insites_api/external_api.liquid` cites `modules/insites_assets/private/schema/assets.yml`; the only schema is `assets_upload.yml`.

## 12. The credentials ceiling is 600 MB and the restriction can only lower it

`controllers/credentials/get_details.liquid` sets `content_length_lte` to 614,400 KiB and replaces it with `max_file_size_mb × 1024` only when that is smaller. A configured limit above 600 MB does nothing.

## 13. Lists hide `system_pages`, folders and archived files

`get_assets.graphql` and its siblings exclude paths containing `system_pages`, paths ending in `/`, and `is_archived: "true"`. Archived files are only visible through the admin `GET /insites/assets/archives`.

## 14. Dead partials

`private/graphql/get_modified_by.graphql`, `private/graphql/create_assets.graphql` and `functions/event_stream/edit_event_stream_api_key.liquid` are referenced by nothing in the module (grep, 9 October 2026).
