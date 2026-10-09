# API module patterns

Worked examples against the Custom API Endpoint surface. The Liquid examples are the shape the module's own verification script uses (`tests/verify_external_endpoints.sh`, module-v6-api v6.0.2). HTTP examples omit the `Authorization: instance_<key>` header; see [`../../api/authentication.md`](../../api/authentication.md).

All five aliases gate the response handler on `context.params.format == 'json'` and return a value, so a `{% function %}` call from an HTML page leaves the response headers alone. Background: [`../../building-on-insites/02-calling-a-controller.md`](../../building-on-insites/02-calling-a-controller.md).

---

## 1. Create an endpoint from Liquid

Build the hash, then call the alias with `params:`.

```liquid
{% parse_json params %}
{
  "slug": "tools/hello",
  "physical_file_path": "modules/ins_api/public/views/pages/hello.liquid",
  "content": "Hello from a custom endpoint",
  "request_method": "get",
  "authorization_policy_ids": ["116020"]
}
{% endparse_json %}
{% function created = "insites/controller/endpoints/create", params: params %}
```

`created.id` is set on success. On failure `created.errors` is an array of `{ field, error }` and `created.message` says which stage failed ("Validation failed." or "Slug is not available."). The policy id must be a real `admin_authorization_policies` id on the instance; a blank or unknown id is rejected before anything is written.

## 2. Read one, then list

```liquid
{% function endpoint = "insites/controller/endpoints/get", id: "512" %}
{{ endpoint.slug }} {{ endpoint.authorization_policies | map: "id" | json }}
```

```liquid
{% parse_json query %}{ "page": 1, "size": 50 }{% endparse_json %}
{% function page = "insites/controller/endpoints/list", params: query %}
{% for e in page.results %}{{ e.slug }} ({{ e.request_method }}){% endfor %}
```

`get` returns `message: "Endpoint not found."` for an unknown id; the HTTP twin answers 404. `list` accepts only `page` and `size`.

## 3. Change the body without touching anything else

```liquid
{% parse_json patch %}{ "content": "updated body" }{% endparse_json %}
{% function updated = "insites/controller/endpoints/update", id: "512", params: patch %}
```

The controller merges `content` over the stored `slug`, `physical_file_path`, `request_method`, `metadata`, redirects and policy ids, then re-validates. Sending `"authorization_policy_ids": [""]` fails with "at least one authorization policy is required"; you cannot strip the last policy. Fields outside the merge base reset; see [`gotchas.md`](gotchas.md).

## 4. Delete

```liquid
{% function gone = "insites/controller/endpoints/delete", id: "512" %}
```

Returns `{ id, slug, physical_file_path }`, or `message: "Endpoint not found."`.

## 5. The same create over HTTP

```http
POST /insites/api/v2/endpoints?format=json HTTP/1.1
Content-Type: application/json

{
  "slug": "tools/hello",
  "physical_file_path": "modules/ins_api/public/views/pages/hello.liquid",
  "content": "Hello from a custom endpoint",
  "request_method": "get",
  "authorization_policy_ids": ["116020"]
}
```

```json
HTTP/1.1 200 OK
{ "id": "512", "slug": "tools/hello", "physical_file_path": "modules/ins_api/public/views/pages/hello.liquid", "metadata": {}, "layout": null }
```

A second POST with the same slug and method answers `409 { "message": "Slug is not available.", "errors": [ { "field": "slug", "error": "a page with this slug and request method already exists" } ] }`. The same slug with a different `request_method` is allowed.

## 6. Check what an instance documents

`GET https://<host>/llms` lists every markdown doc page; `/admin/api_md/api/endpoints` is this module's resource page. No session needed.

## What is intentionally not here

- Creating policies or GraphQL files over the API: admin-session pages only ([`api.md`](api.md)).
- Building the endpoint's body: [`../../api-endpoints/README.md`](../../api-endpoints/README.md).
