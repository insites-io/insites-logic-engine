# Assets: Patterns

Worked flows against the V2 endpoints and the seven controllers. Conventions, shapes and error codes are in [`api.md`](api.md). The `Authorization: instance_<key>` header is implied on every curl.

## 1. Upload a file in three steps

The API never takes file bytes. The flow is credentials, bucket, register (`external_api/assets_credentials/get_credentials.liquid` spells it out).

```bash
# 1. Credentials. file_name is checked against the upload restrictions first.
curl -G "https://<your-insites-instance>/asset/api/v2/credentials" \
  -H "Authorization: instance_<key>" \
  --data-urlencode "file_name=hero-banner.png" \
  --data-urlencode "content_type=image/png" \
  --data-urlencode "file_size_bytes=482133" \
  --data-urlencode "format=json"
# -> { "s3_upload": { "direct_upload_url": "...", "form_data": { "key": "...", "policy": "...", ... } } }

# 2. Post the file to direct_upload_url. Every form_data field becomes a -F, the file goes last.
#    Do not send the Insites Authorization header here.
curl -X POST "<direct_upload_url>" \
  -F "key=<form_data.key>" -F "acl=<form_data.acl>" -F "Content-Type=image/png" \
  -F "policy=<...>" -F "x-amz-credential=<...>" -F "x-amz-algorithm=<...>" \
  -F "x-amz-date=<...>" -F "x-amz-signature=<...>" \
  -F "file=@hero-banner.png"

# 3. Register the asset record.
curl -X POST "https://<your-insites-instance>/asset/api/v2/assets?format=json" \
  -H "Authorization: instance_<key>" -H "Content-Type: application/json" \
  -d '{
    "name": "modules/my_module/public/assets/images/hero-banner.png",
    "physical_file_path": "modules/my_module/public/assets/images/hero-banner.png",
    "url": "<the bucket URL of the object you just posted>",
    "metadata.tags": ["hero", "homepage"]
  }'
```

Step 3 validates the last segment of `name` against the upload restrictions again, then stores `url` as given.

## 2. List a folder, filter by tag, page through

```bash
curl -G "https://<your-insites-instance>/asset/api/v2/assets" \
  -H "Authorization: instance_<key>" \
  --data-urlencode "folder=modules/my_module/public/assets/images/" \
  --data-urlencode "tags=hero" \
  --data-urlencode "page=1" --data-urlencode "per_page=100" \
  --data-urlencode "format=json"
```

Loop `page` to `total_pages`. `per_page` above 100 is clamped to 100; omit it and you get 10.

## 3. Archive, and know you cannot unarchive here

```bash
curl -X PATCH "https://<your-insites-instance>/asset/api/v2/assets/123/archive?format=json" \
  -H "Authorization: instance_<key>"
```

The asset drops out of the list. Restore is admin-only (`PATCH /insites/assets/files`, `controllers/files/restore.liquid`).

## 4. Folders: create, then delete everything inside

```bash
curl -X POST "https://<your-insites-instance>/asset/api/v2/folders?format=json" \
  -H "Authorization: instance_<key>" -H "Content-Type: application/json" \
  -d '{ "folder": "modules/my_module/public/assets/reports/" }'

curl -X DELETE "https://<your-insites-instance>/asset/api/v2/folders?format=json" \
  -H "Authorization: instance_<key>" -H "Content-Type: application/json" \
  -d '{ "folder": "modules/my_module/public/assets/reports/" }'
```

Delete matches the folder by exact `name`, then hard-deletes every asset whose name starts with that string (`private/graphql/_external/v2/folders/delete_folder.graphql`). Pass the same string you created with, trailing slash included.

## 5. In Liquid: list assets on a page

```liquid
{%- function assets = "assets/controller/assets/list", params: context.params -%}
{{ assets.total_entries }}
```

Response-handler facts, checked in `private/views/partials/controllers/_external/v2/` on 9 October 2026: all seven controllers gate `modules/insites_crm/functions/response_handler` on `context.params.format == 'json'` on their main path and all seven `{% return %}` a value. Three (`assets/get`, `assets/delete`, `folders/delete`) call the handler **ungated** in their missing-required-parameter branch, so pass the id or folder and that branch never runs. Why `{% function %}` and not `{% include %}`, and why `format` should not leak in from the URL on an HTML page, is in [`02-calling-a-controller.md`](../../building-on-insites/02-calling-a-controller.md).

One difference from the HTTP body: `list` returns the raw GraphQL hash to Liquid, so each `results[].metadata` is still a JSON **string**; only the HTTP body gets it parsed.

## 6. In Liquid: read one asset by id

```liquid
{%- function asset = "assets/controller/assets/get", params: context.params, uuid: context.params.id -%}
{{ asset.name }}
```

`get` reads `params.id | default: uuid`, and here the return value does have `metadata` parsed into a hash. A missing asset returns `{ "errors": [ { "code": "no_asset", ... } ] }` rather than blank, so test `asset.errors`.

## Intentionally not here

Edit metadata, restore, the archive list and the reports are admin-only pages with no alias. The credentials controller has no alias and reads `context.params` directly, so `{% function %}` cannot pass it arguments (the defect in [`api.md`](api.md)).
