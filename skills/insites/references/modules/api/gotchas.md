# API module gotchas

Edges visible in module-v6-api v6.0.2 source (read 9 October 2026). Each entry: what bites, why, how to avoid.

---

## 1. The file namespace is `ins_api`, not `insites_api`

**Bites:** `physical_file_path: "modules/insites_api/public/views/pages/x.liquid"` fails with "must start with modules/ins_api/public/views/pages/".

**Why:** `build_payload.liquid` compares the first 35 characters against that literal. Source does not say why the prefix differs from the module name.

**Avoid:** `modules/ins_api/public/views/pages/<name>.liquid`, no `..`.

## 2. Update resets fields outside the merge base, and PUT equals PATCH

**Bites:** a PATCH that sends only `content` puts `max_deep_level` back to 3, `searchable` to true, `format` to `json`, and clears `dynamic_cache_*`. PUT does exactly the same; both page files include the same controller.

**Why:** the merge base carries only `slug`, `physical_file_path`, `content`, `request_method`, `metadata`, `redirect_to`, `redirect_code` and policy ids. The rest falls to the defaults in `edit_api_endpoint.graphql` (`$searchable = true`, `$max_deep_level = 3`) or to blank.

**Avoid:** send every non-default field on every update.

## 3. Reserved first segments

`admin`, `api`, `insites`, `modules` and 16 module namespaces (`crm`, `data`, `databases`, `pipelines`, `forms`, `cms`, `permissions` with their singulars, `events`, `event`, `locator`, `asset`, `assets`, `ecommerce`) are rejected on the lowercased first segment, so `Admin/x` fails too. Pick a prefix of your own such as `tools/`.

## 4. The admin path validates nothing

`POST /insites/api/endpoints` (IIA session) hands the payload to `admin_page_create` with no allow-list, namespace rule or policy requirement. An endpoint saved with the `NONE` option is public. The guarantees in [`api.md`](api.md) hold for `/v2/` and the five aliases only.

## 5. `auth-policies-options` includes a partial that does not exist

`api/auth_policies/options/post.liquid` includes `modules/insites_api/controllers/auth_policies/options/get_options`; no such file is in the tree, so the page renders a Liquid error. Nothing under `vue/src` requests it.

## 6. An API Keys service with no backend

`vue/src/services/APIKeysServices.js` targets `/insites/api/keys` and `/insites/api/keys-histories`; no page serves either and no view imports the service. The `api_key` table is likewise unused. Both are leftovers of the v5.2.0 switch to policies.

## 7. Admin lists hide what modules ship

Policy and GraphQL lists filter `physical_file_path not_starts_with "modules/insites_"`; the endpoints list requires `format: json` and no `source_name` metadata key. A page without `format: json` works but IIA does not show it.

## 8. The Instance API Key policy: record or not?

`Details.vue` and `split_policy_selection.liquid` say `modules/insites_crm/has_valid_instance_api_authorization` is a private guard with no policy record, so the admin form attaches it by name. The doc-data in `external_api/endpoints/get_endpoint.liquid` shows it with id `116020`, and `build_payload.liquid` accepts ids only. Source does not settle it; list `admin_authorization_policies` on your instance before relying on the external path to attach that guard.

## 9. Response status defaults to 400

Admin controllers set 200 only when `result.items` is present, so an empty but successful list still answers 400. The policy and GraphQL `get_details` controllers use `insites_response_util` rather than `response_handler`.

## 10. The markdown docs print the instance key

`session_data.liquid` stores `instance_api_key` in the session for a signed-in viewer and `api.md.liquid` renders it. Do not share `/admin/api_md` output captured from a signed-in browser.

## 11. Themes POST trusts the payload's user id

`api/themes/post.liquid` updates the theme for `context.params.user`, not the session user; the source comment calls it cosmetic and defers it.
