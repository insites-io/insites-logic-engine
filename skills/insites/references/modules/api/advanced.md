# API module advanced

Hooks, the partials other modules render, cross-module dependencies and override points. From module-v6-api v6.0.2 (read 9 October 2026).

## Hooks the module implements

One: `public/views/partials/lib/hooks/hook_module_info.liquid`. It queries `modules/insites_crm/hook/get_implementations` for its own `updated_at` and returns the module info hash (name, machine_name, version, slug, label). This is the only file under `public/`; everything else is private.

## Partials CRM renders on the module's behalf

- `insites_menu/insites_api_side_menu.liquid`: the "API" sidebar group. Rendered by `insites_admin/insites_side_menu_controller.liquid` in `module-v6-crm`.
- `insites_admin/insites_api_dependencies.liquid` and `insites_api_index_dependencies.liquid`: the SPA's CSS and JS preload tags and the `<div id="insites-api">` mount. Rendered by CRM's `insites_module_dependencies.liquid` and `insites_index_module_dependencies.liquid`. Generated files; do not edit by hand.

## Doc-data partials: how a module joins `/admin/api`

The reference discovers modules through `hook_module_info` and then calls `modules/<machine_name>/insites_api/external_api` (see README). A module takes part by shipping, under `private/views/partials/insites_api/`:

1. `external_api.liquid`, returning an array of features. This module's own entry (`insites_api/external_api.liquid`) has `table`, `physical_file_path`, `label`, `description`, `slug: "endpoints"` and an `external_api` list of `{ title, slug, method }`.
2. `external_api/<feature>/object.liquid`, returning the field list (`name`, `label`, `description`, `field_type`, `ui_element`, `required`, `default_value`). A field with `data_source: { module, object, fields }` pulls child rows from another module's `object` partial; one with `data_source.file_path` and `belongs_to` resolves columns through `docs/get_public_schema.graphql` (`admin_tables`).
3. `external_api/<feature>/<endpoint_slug>.liquid` per endpoint, returning `title`, `description`, `method`, `url`, `controller_name`, `required_params`, `params`, `example_payload`, `example_response` and the `contract` block the [controller contract spec](../../building-on-insites/reference/controller-contract-spec.md) defines. `docs/content/methods.liquid` renders `contract` as the Controller Contract section; `api.md.liquid` renders it as tables.

Partial names come from the URL, `/admin/api/<slug>/<feature>/<endpoint-slug>`, hyphens turned to underscores. The module slug comes from the hook; without one, `sidebar_menu.liquid` uses `machine_name` minus `insites_`, and the lookups accept singular and plural forms. Globals are not discovered: `session_data.liquid` calls `modules/insites_crm/insites_api/external_api/_globals/external_api` directly.

On the v6 module checkouts in `iia-v6` on 9 October 2026, eight modules ship an `external_api.liquid` (api, assets, crm, data, ecommerce, events, locator, pipelines); cms, forms and permissions do not and so are absent from the reference.

## Cross-module dependencies (all on `insites_crm`)

Counted by grepping `modules/insites_crm/` in the module tree:

| Used for | CRM asset |
|---|---|
| JSON layout | `modules/insites_crm/json` |
| Status and headers | `functions/response_handler`, `functions/insites_response_util` |
| Guards | `has_valid_instance_api_authorization`, `insites_only_allowed_by_administrators`, `insites_only_allowed_if_logged_in` |
| Audit rows | `functions/event_stream/add_event` |
| Docs session | `sessions/current_user`, `instance_configurations/get_instance_configuration`, `insites_admin/insites_cms_data`, `themes/get_theme`, `themes/update_theme` |
| Discovery | `hook/get_implementations`, `insites_api/external_api/_globals/external_api` |

No other module is referenced. The module cannot run without CRM installed.

## Outbound call

`private/api_calls/get_reports.liquid` (`name: get_reports`) sends `GET https://api.insites.io/metrics?instance_uuid=&secret_uuid=&start_date=&end_date=` with a JWT in `Authorization`. It is the only API call definition in the module. The general mechanism is documented in [`../../api-calls/README.md`](../../api-calls/README.md).

## Override points

- **Custom API Endpoints are the override point.** Anything the admin surface cannot do, you build as an endpoint page under `modules/ins_api/public/views/pages/` with its own policies ([`../../api-endpoints/README.md`](../../api-endpoints/README.md)).
- **Reserved slugs** are a literal list in `build_payload.liquid`; adding a namespace means a module change.
- `private/views/layouts/docs/api.liquid` emits `rel="alternate"` links to the JSON and markdown twins of every docs page.

## Tests

Four Liquid tests under `private/lib/test/` (`build_payload`, `check_slug_availability`, `split_policy_selection`, `get_public_schema`), plus `tests/verify_external_endpoints.sh <env> <policy_id>`, which drives the five aliases through `insites-cli exec liquid` on a non-production instance and deletes what it creates.
