# API module configuration

What an administrator sets up in IIA, and which page each form writes to. Sources: `private/views/partials/insites_menu/insites_api_side_menu.liquid` (menu), `vue/src/router/APIRoute.js` (routes), `vue/src/services/*.js` (requests), read in module-v6-api v6.0.2 on 9 October 2026.

## IIA paths

| What | Path |
|---|---|
| API reference (opens in a new tab) | `<your-insites-instance>/admin/api` |
| Custom API Endpoints list | `<your-insites-instance>/admin/insites#/api/api-endpoints` |
| Add an endpoint (Details, then Body tab) | `.../#/api/api-endpoints/add` and `.../add/body` |
| Edit an endpoint | `.../#/api/api-endpoints/:id` and `.../:id/body` |
| Authorization policies list | `.../#/api/authorization-policies` |
| Add or edit a policy (Details, Body) | `.../#/api/authorization-policies/add`, `.../edit` |
| GraphQL list, add, edit | `.../#/api/graphql`, `.../graphql/add`, `.../graphql/edit` |
| Reports (API usage) | `.../#/api/reports` |
| Module versions | `<your-insites-instance>/admin/api/module-versions` (signed-in only) |

The side-menu item is labelled "API" with the icon `icon-cpu`.

## Custom API Endpoints

The form writes `slug`, `physical_file_path`, `request_method`, `content`, `metadata.api_endpoint_name` and the policy selection; Duplicate sets `format` to `json`, appends ` Duplicate` to the name and `-duplicate` to the slug (`ManageAPIEndpoint.vue`). When a page has no `metadata.api_endpoint_name`, the UI derives a name from the file name.

The Authorization Policies dropdown lists policy records plus one static option, "Instance API Key", whose value is the policy name `modules/insites_crm/has_valid_instance_api_authorization`, and a `NONE` sentinel (`Details.vue`). The backend splits names from ids before saving (`split_policy_selection.liquid`).

Only pages with `format: json` and no `source_name` metadata key appear in the list (`get_api_endpoints.graphql`). Pages created by the admin form are not run through the external validator; an endpoint with no policy can be saved here.

## Authorization policies and GraphQL

Both forms take a display name (`metadata.auth_policy_name`, `metadata.graphql_name`), a `physical_file_path` and a body (`content` for policies, with optional `flash_alert` and `redirect_to`; `body` for GraphQL). The path is the record key: editing sends `old_physical_file_path`. The lists exclude anything under `modules/insites_`, so module-shipped policies and queries are not editable here.

## Reports

The page takes a date range and calls `GET /insites/api/reports?start_date=&end_date=`, which proxies to `api.insites.io/metrics`. Nothing is configured on the instance for this; the remote is addressed by the instance uuid.

## Out of scope

- **The instance API key** is managed in Integrations, not here: [`../../api/authentication.md`](../../api/authentication.md).
- **Module install and version updates** happen through the Insites console.
- **Webhooks**: the module fires none.
