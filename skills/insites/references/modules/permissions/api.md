# Permissions — Admin API

12 endpoints, all under `/insites/permissions/...`, all page files in `private/views/pages/api/profiles/` of `module-v6-permissions` (counted at v6.0.2 on 9 October 2026). Every page lists one policy, `modules/insites_crm/insites_only_allowed_by_administrators`, so a request needs an active administrator session. A denied request redirects to `admin/401` (policy front matter). No endpoint accepts the instance API key.

Each page includes one controller from `private/views/partials/controllers/profiles/`, which runs a GraphQL file from `private/graphql/` and ends with `modules/insites_crm/functions/response_handler`. The handler prints the GraphQL result as the body, sets `Content-Type: application/json` and sets the controller's status, **defaulting to 400 when none was set**. So the top-level key is `items`, and GraphQL failures arrive as an `errors` array beside it.

## Endpoints

| Method | Path | Controller | GraphQL |
|---|---|---|---|
| `GET` | `/insites/permissions/profiles` | `get_list` | `profiles/get_profiles` + `profiles/count_contacts` per row |
| `GET` | `/insites/permissions/profiles/:id` | `get_details` | `profiles/get_profile` + `count_contacts` |
| `POST` | `/insites/permissions/profiles` | `add_profile` | `profiles/add_profile` (`admin_user_profile_schema_create`) |
| `PUT` | `/insites/permissions/profiles` | `edit_profile` | `profiles/get_profile` then `profiles/edit_profile` (`admin_user_profile_schema_update`) |
| `DELETE` | `/insites/permissions/profiles` | `delete_profile` | `profiles/delete_profile` (`admin_user_profile_schema_delete`) |
| `GET` | `/insites/permissions/profiles/paths` | `get_paths` | `profiles/get_profile_paths` |
| `GET` | `/insites/permissions/profiles/contacts` | `get_contacts` | `profiles/get_contacts` (`users`) |
| `PATCH` | `/insites/permissions/profiles/contacts` | `remove_contact` | `profiles/remove_contact` (`user_profile_delete`) |
| `DELETE` | `/insites/permissions/profiles/contacts` | `remove_contacts` | `profiles/remove_contacts` (`user_profiles_delete_all`) |
| `GET` | `/insites/permissions/profiles-data-sources` | `get_data_sources` | `profiles/get_data_sources` (`admin_tables`) |
| `GET` | `/insites/permissions/profiles/:id/reference-fields` | `get_reference_fields` | `profiles/get_reference_fields` (`admin_tables`) |
| `GET` | `/insites/permissions/profiles/:id/event-stream` | `get_event_stream` | `event_stream/get_events` (CRM `get_events` API call) |

Seven pages declare `layout: modules/insites_crm/json`; the five without it are profiles `GET`, paths `GET` and the three `contacts` pages. The `:id` pages read the id with `extract_url_params` and skip the controller entirely when it is missing, which leaves an empty body.

## Reads

### List profiles

Query params read by `get_list.liquid`: `page` (default 1), `size` (default 10), `search` (lowercased), `field` (`Profile Name` or `Schema Name`), `sort` (`Schema Name`, `Date Created`, `Last Updated` or `Profile Name`), `order`. The filter always adds `parameterized_name: { not_starts_with: "modules/insites_" }`, so Insites-owned profiles never appear. Each row gets `assigned_contacts` from a `count_contacts` query.

Row shape from `get_profiles.graphql`: `id`, `date_created`, `last_updated`, `name`, `schema_name`, `physical_file_path`, `metadata`, plus `assigned_contacts`. Envelope: `items.total_entries`, `items.results[]`. Status 200 when `items` is present, else 400.

### Read one profile

`GET /insites/permissions/profiles/:id`. `get_profile.graphql` returns `id`, `created_at`, `updated_at`, `name`, `parameterized_name`, `physical_file_path`, `metadata` and `properties[]` (`id`, `name`, `attribute_type`, `default_value`, `metadata`); the controller adds `assigned_contacts`. Status 400 when `items` is blank.

### List contacts on a profile

`GET /insites/permissions/profiles/contacts?schema_name=<profile name>`. Params: `page`, `size`, `search`, `field` (`Contact Name` or `Email`), `sort` (`Name`, `Email`, `Date Added`), `order`. Rows: `id`, `date_added`, `updated_at`, `email`, `name`. Without `schema_name` the required `$filter` is empty, so expect `errors` and 400.

### Profile paths

Returns `physical_file_path` for every schema whose path starts with `modules/ins_profiles/public/user_profile_types/` (`get_profile_paths.graphql`). Feeds the file-path picker.

### Data sources and reference fields

`profiles-data-sources` lists tables not under `modules/insites_`, not archived and without the `insites_databases_hidden` metadata key (1000 per page): `id`, `name`, `table_name`, `physical_file_path`, `metadata`, `no_of_items`, `date_created`, `last_updated`. `profiles/:id/reference-fields` returns that table's `properties[]` (`id`, `name`, `metadata`). Both return 200 when `errors` is blank.

### Event stream

`GET /insites/permissions/profiles/:id/event-stream`. The controller forwards the raw query string plus `log.profile_id=<id>`, `module_source=insites_permissions`, `module_feature=profiles`, `request_type=internal` to CRM's `get_events` API call template, authorised by the instance configuration `event_stream_api_key`. On upstream 200 the body is the upstream response passed through; otherwise 400.

## Writes

Write bodies are JSON with one top-level `payload` object (the Vue services in `vue/src/services/ProfilesServices.js` send it that way and the controllers read `query_params.payload`).

| Endpoint | `payload` keys | Result |
|---|---|---|
| `POST /profiles` | `user_profile_schema: { physical_file_path, metadata, properties[] }` | 201, event `add_profile` |
| `PUT /profiles` | `id`, `physical_file_path`, `user_profile_schema` | 200, event `edit_profile` with `before` |
| `DELETE /profiles` | `physical_file_path` | 200, event `delete_profile` |
| `PATCH /profiles/contacts` | `id` (user id), `profile` (profile name) | 200, no event |
| `DELETE /profiles/contacts` | `id` (profile id), `label`, `profile` (profile name) | 200, event `empty_profile` |

`edit_profile` runs `payload` through `parse_json` before use; the other writes do not. The create and update mutations return `id`, `name`, `parameterized_name`, `metadata`, `physical_file_path`, `properties[]`.

### Protected profiles

`edit_profile`, `delete_profile`, `remove_contact` and `remove_contacts` blank the target when it starts with `modules/insites_` or matches a hard-coded CRM list (file paths `modules/insites_crm/private/user_profile_types/{administrator,crm_contact,token}.yml` for edit and delete; names `modules/insites_crm/{administrator,crm_contact,token}` for contact removal). The mutation then runs with a blank required argument: the caller gets GraphQL `errors` and 400, not a "protected" message.

## Errors

- Policy failure: redirect to `admin/401` with the flash "Please login as administrator to access this page."
- Controller set no status: 400 with the GraphQL result, typically `{"items": null, "errors": [...]}`.
- Missing `:id` on a parameterised page: empty body.
