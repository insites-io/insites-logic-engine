# Alias inventory

Every controller alias on an instance with these modules installed, generated from
module source. **Check a name here before you call it.** An alias that does not exist
fails at render time with a partial-not-found error, and inventing plausible names is
the most common way a build is wasted.

**404 controller aliases** across 8 modules, plus 90 internal aliases listed at the end.

| Module | Controller aliases | Internal aliases | Version |
|---|---|---|---|
| `module-v6-pipelines` | 107 | 60 | v6.0.2 |
| `module-v6-ecommerce` | 105 | 0 | v6.0.2 |
| `module-v6-data` | 61 | 28 | v6.0.2 |
| `module-v6-crm` | 59 | 1 | v6.1.2 |
| `module-v6-events` | 37 | 1 | v6.0.2 |
| `module-v6-locator` | 23 | 0 | v6.0.2 |
| `module-v6-assets` | 7 | 0 | v6.1.0 |
| `module-v6-api` | 5 | 0 | v6.0.2 |

The version is the module's newest git tag. Release tooling does not bump the
`hook_module_info` partial, so the version a running instance reports can lag: `module-v6-cms` says v6.0.0 at v6.0.2, `module-v6-ecommerce` says v6.0.0 at v6.0.2, `module-v6-locator` says v6.0.0 at v6.0.2, `module-v6-permissions` says v6.0.0 at v6.0.2. Read the tag or the Console changelog for "which version"; use the hook only for "is it installed".

Modules that declare **no** controller aliases, so there is nothing to call in them:

`module-v6-cms`, `module-v6-forms`, `module-v6-permissions`

## Naming is not uniform

Three shapes exist, so do not filter on one of them:

- The short form, `<module>/controller/<resource>/<verb>`, is what most modules publish (`module-v6-ecommerce`, `module-v6-crm`, `module-v6-locator`, `module-v6-assets` and `module-v6-api` use nothing else).
- `module-v6-events` publishes short aliases **without** the word `controller`, such as `events/venues/list`, so a search for `controller` undercounts them.
- `module-v6-pipelines`, `module-v6-data` and `module-v6-events` also declare long-form controllers under `modules/<module>/controllers/...`. Those are controllers too, and they are listed below with the short ones.

Internal aliases (`modules/<module>/functions/...`, `graphql/...`, `schema/...`,
`insites_api/...`) are the module's own helpers. They answer a `{% function %}` call, but
they carry no published contract, their arguments change between releases, and some of
them write. Build on the controllers.

## module-v6-pipelines (107)

- `modules/insites_pipeline/controllers/custom_fields/create`
- `modules/insites_pipeline/controllers/custom_fields/data_sources/add_attachment`
- `modules/insites_pipeline/controllers/custom_fields/data_sources/delete_attachments`
- `modules/insites_pipeline/controllers/custom_fields/data_sources/get_attachments`
- `modules/insites_pipeline/controllers/custom_fields/data_sources/get_companies`
- `modules/insites_pipeline/controllers/custom_fields/data_sources/get_data_sources`
- `modules/insites_pipeline/controllers/custom_fields/data_sources/get_databases`
- `modules/insites_pipeline/controllers/custom_fields/data_sources/get_reference_fields`
- `modules/insites_pipeline/controllers/custom_fields/data_sources/get_users`
- `modules/insites_pipeline/controllers/custom_fields/export/get_fields`
- `modules/insites_pipeline/controllers/custom_fields/get_details`
- `modules/insites_pipeline/controllers/custom_fields/get_fields`
- `modules/insites_pipeline/controllers/custom_fields/save`
- `modules/insites_pipeline/controllers/opportunities/activities/add_activity`
- `modules/insites_pipeline/controllers/opportunities/activities/delete_activity`
- `modules/insites_pipeline/controllers/opportunities/activities/get_activities`
- `modules/insites_pipeline/controllers/opportunities/activities/import/import`
- `modules/insites_pipeline/controllers/opportunities/activities/update_activity`
- `modules/insites_pipeline/controllers/opportunities/add`
- `modules/insites_pipeline/controllers/opportunities/columns/get_columns`
- `modules/insites_pipeline/controllers/opportunities/columns/update_columns`
- `modules/insites_pipeline/controllers/opportunities/custom_fields/get`
- `modules/insites_pipeline/controllers/opportunities/custom_fields/get_details`
- `modules/insites_pipeline/controllers/opportunities/database_items/get_details`
- `modules/insites_pipeline/controllers/opportunities/edit`
- `modules/insites_pipeline/controllers/opportunities/export/export`
- `modules/insites_pipeline/controllers/opportunities/filters/get_filters`
- `modules/insites_pipeline/controllers/opportunities/filters/save`
- `modules/insites_pipeline/controllers/opportunities/get_details`
- `modules/insites_pipeline/controllers/opportunities/get_opportunities`
- `modules/insites_pipeline/controllers/opportunities/histories/get_histories`
- `modules/insites_pipeline/controllers/opportunities/import/import`
- `modules/insites_pipeline/controllers/opportunities/modify`
- `modules/insites_pipeline/controllers/opportunities/options/get_options`
- `modules/insites_pipeline/controllers/opportunities/order/get_orders`
- `modules/insites_pipeline/controllers/opportunities/quick_select/get_contacts`
- `modules/insites_pipeline/controllers/opportunities/related_contacts/assign_contact`
- `modules/insites_pipeline/controllers/opportunities/related_contacts/get_options`
- `modules/insites_pipeline/controllers/opportunities/related_contacts/get_related_contacts`
- `modules/insites_pipeline/controllers/opportunities/related_contacts/remove_contact`
- `modules/insites_pipeline/controllers/opportunities/remove`
- `modules/insites_pipeline/controllers/opportunities/reports/get_division_reports`
- `modules/insites_pipeline/controllers/opportunities/reports/get_owner_reports`
- `modules/insites_pipeline/controllers/opportunities/reports/get_referrer_reports`
- `modules/insites_pipeline/controllers/opportunities/reports/get_reports`
- `modules/insites_pipeline/controllers/opportunities/reports/sales_target/get_reports`
- `modules/insites_pipeline/controllers/opportunities/search_filters/get_filters`
- `modules/insites_pipeline/controllers/opportunities/search_filters/save`
- `modules/insites_pipeline/controllers/opportunities/stage/modify`
- `modules/insites_pipeline/controllers/opportunities/tasks/add_task`
- `modules/insites_pipeline/controllers/opportunities/tasks/delete_task`
- `modules/insites_pipeline/controllers/opportunities/tasks/get_task_details`
- `modules/insites_pipeline/controllers/opportunities/tasks/get_tasks`
- `modules/insites_pipeline/controllers/opportunities/tasks/update_task`
- `modules/insites_pipeline/controllers/opportunities/total/get_total_entries`
- `modules/insites_pipeline/controllers/opportunities/weighting/modify`
- `modules/insites_pipeline/controllers/pipelines/add`
- `modules/insites_pipeline/controllers/pipelines/columns/get_columns`
- `modules/insites_pipeline/controllers/pipelines/columns/get_pipeline_column`
- `modules/insites_pipeline/controllers/pipelines/columns/update_columns`
- `modules/insites_pipeline/controllers/pipelines/edit`
- `modules/insites_pipeline/controllers/pipelines/get_pipeline_details`
- `modules/insites_pipeline/controllers/pipelines/get_pipelines`
- `modules/insites_pipeline/controllers/pipelines/options/get_list`
- `modules/insites_pipeline/controllers/pipelines/remove`
- `modules/insites_pipeline/controllers/pipelines/stages/active/get_list`
- `modules/insites_pipeline/controllers/pipelines/stages/add`
- `modules/insites_pipeline/controllers/pipelines/stages/get_list`
- `modules/insites_pipeline/controllers/pipelines/stages/get_stage_options`
- `modules/insites_pipeline/controllers/pipelines/stages/remove`
- `modules/insites_pipeline/controllers/pipelines/update_status`
- `modules/insites_pipeline/controllers/pipelines/webhooks/add`
- `modules/insites_pipeline/controllers/pipelines/webhooks/edit`
- `modules/insites_pipeline/controllers/pipelines/webhooks/get_list`
- `modules/insites_pipeline/controllers/reports/sales_target/create`
- `modules/insites_pipeline/controllers/reports/sales_target/get_list`
- `modules/insites_pipeline/controllers/reports/sales_target/update`
- `modules/insites_pipeline/controllers/stages/delete`
- `modules/insites_pipeline/controllers/system_fields/create`
- `modules/insites_pipeline/controllers/system_fields/delete_system_fields`
- `modules/insites_pipeline/controllers/system_fields/get_list`
- `modules/insites_pipeline/controllers/system_fields/update`
- `pipeline/controller/custom_fields/delete`
- `pipeline/controller/custom_fields/list`
- `pipeline/controller/opportunities/create`
- `pipeline/controller/opportunities/delete`
- `pipeline/controller/opportunities/get`
- `pipeline/controller/opportunities/list`
- `pipeline/controller/opportunities/update`
- `pipeline/controller/pipelines/create`
- `pipeline/controller/pipelines/delete`
- `pipeline/controller/pipelines/get`
- `pipeline/controller/pipelines/list`
- `pipeline/controller/pipelines/update`
- `pipeline/controller/related_contacts/create`
- `pipeline/controller/related_contacts/delete`
- `pipeline/controller/related_contacts/list`
- `pipeline/controller/related_contacts/update`
- `pipeline/controller/stages/create`
- `pipeline/controller/stages/delete`
- `pipeline/controller/stages/list`
- `pipeline/controller/stages/update`
- `pipeline/controller/system_fields/create`
- `pipeline/controller/system_fields/delete`
- `pipeline/controller/system_fields/get`
- `pipeline/controller/system_fields/list`
- `pipeline/controller/system_fields/update`

## module-v6-ecommerce (105)

- `ecommerce/controller/cart/create`
- `ecommerce/controller/cart/delete`
- `ecommerce/controller/cart/get`
- `ecommerce/controller/cart/list`
- `ecommerce/controller/cart/update`
- `ecommerce/controller/cart_discounts/create`
- `ecommerce/controller/cart_discounts/delete`
- `ecommerce/controller/cart_discounts/list`
- `ecommerce/controller/cart_discounts/update`
- `ecommerce/controller/cart_items/add_bulk`
- `ecommerce/controller/cart_items/create`
- `ecommerce/controller/cart_items/delete`
- `ecommerce/controller/cart_items/get`
- `ecommerce/controller/cart_items/list`
- `ecommerce/controller/cart_items/update`
- `ecommerce/controller/category/create`
- `ecommerce/controller/category/delete`
- `ecommerce/controller/category/get`
- `ecommerce/controller/category/list`
- `ecommerce/controller/category/update`
- `ecommerce/controller/configuration/get`
- `ecommerce/controller/configuration/update`
- `ecommerce/controller/custom_field/delete`
- `ecommerce/controller/custom_field/list`
- `ecommerce/controller/discount/by_code`
- `ecommerce/controller/discount/create`
- `ecommerce/controller/discount/delete`
- `ecommerce/controller/discount/get`
- `ecommerce/controller/discount/list`
- `ecommerce/controller/discount/update`
- `ecommerce/controller/freight_supplier/create`
- `ecommerce/controller/freight_supplier/delete`
- `ecommerce/controller/freight_supplier/get`
- `ecommerce/controller/freight_supplier/list`
- `ecommerce/controller/freight_supplier/update`
- `ecommerce/controller/order/create`
- `ecommerce/controller/order/delete`
- `ecommerce/controller/order/get`
- `ecommerce/controller/order/list`
- `ecommerce/controller/order/update`
- `ecommerce/controller/order_discount/add_bulk`
- `ecommerce/controller/order_discount/create`
- `ecommerce/controller/order_discount/delete`
- `ecommerce/controller/order_discount/get`
- `ecommerce/controller/order_discount/list`
- `ecommerce/controller/order_discount/update`
- `ecommerce/controller/order_items/add_bulk`
- `ecommerce/controller/order_items/create`
- `ecommerce/controller/order_items/delete`
- `ecommerce/controller/order_items/get`
- `ecommerce/controller/order_items/list`
- `ecommerce/controller/order_items/update`
- `ecommerce/controller/order_shipping_packages/create`
- `ecommerce/controller/order_shipping_packages/delete`
- `ecommerce/controller/order_shipping_packages/get`
- `ecommerce/controller/order_shipping_packages/list`
- `ecommerce/controller/order_shipping_packages/update`
- `ecommerce/controller/payment/create`
- `ecommerce/controller/payment/delete`
- `ecommerce/controller/payment/get`
- `ecommerce/controller/payment/list`
- `ecommerce/controller/payment/update`
- `ecommerce/controller/product/create`
- `ecommerce/controller/product/delete`
- `ecommerce/controller/product/get`
- `ecommerce/controller/product/list`
- `ecommerce/controller/product/update`
- `ecommerce/controller/product_variant/create`
- `ecommerce/controller/product_variant/delete`
- `ecommerce/controller/product_variant/get`
- `ecommerce/controller/product_variant/list`
- `ecommerce/controller/product_variant/update`
- `ecommerce/controller/product_variant_options/create`
- `ecommerce/controller/product_variant_options/delete`
- `ecommerce/controller/product_variant_options/get`
- `ecommerce/controller/product_variant_options/list`
- `ecommerce/controller/product_variant_options/update`
- `ecommerce/controller/quote/create`
- `ecommerce/controller/quote/delete`
- `ecommerce/controller/quote/get`
- `ecommerce/controller/quote/list`
- `ecommerce/controller/quote/update`
- `ecommerce/controller/quote_discounts/create`
- `ecommerce/controller/quote_discounts/delete`
- `ecommerce/controller/quote_discounts/get`
- `ecommerce/controller/quote_discounts/list`
- `ecommerce/controller/quote_discounts/update`
- `ecommerce/controller/quote_items/add_bulk`
- `ecommerce/controller/quote_items/create`
- `ecommerce/controller/quote_items/delete`
- `ecommerce/controller/quote_items/get`
- `ecommerce/controller/quote_items/list`
- `ecommerce/controller/quote_items/update`
- `ecommerce/controller/quote_shipping_packages/create`
- `ecommerce/controller/quote_shipping_packages/delete`
- `ecommerce/controller/quote_shipping_packages/get`
- `ecommerce/controller/quote_shipping_packages/list`
- `ecommerce/controller/quote_shipping_packages/update`
- `ecommerce/controller/stripe/get`
- `ecommerce/controller/stripe/update`
- `ecommerce/controller/system_field/create`
- `ecommerce/controller/system_field/delete`
- `ecommerce/controller/system_field/get`
- `ecommerce/controller/system_field/list`
- `ecommerce/controller/system_field/update`

## module-v6-data (61)

- `databases/controller/database/items/add`
- `databases/controller/database/items/delete`
- `databases/controller/database/items/get`
- `databases/controller/database/items/list`
- `databases/controller/database/items/update`
- `databases/controller/databases/create`
- `databases/controller/databases/get`
- `databases/controller/databases/list`
- `databases/controller/deprecated/databases/list`
- `modules/insites_databases/controllers/database_items/add`
- `modules/insites_databases/controllers/database_items/add_attachment`
- `modules/insites_databases/controllers/database_items/columns/get_columns`
- `modules/insites_databases/controllers/database_items/columns/save_columns`
- `modules/insites_databases/controllers/database_items/companies/get_companies`
- `modules/insites_databases/controllers/database_items/companies/get_searched_companies`
- `modules/insites_databases/controllers/database_items/databases/get_databases`
- `modules/insites_databases/controllers/database_items/databases/get_searched_databases`
- `modules/insites_databases/controllers/database_items/delete`
- `modules/insites_databases/controllers/database_items/delete_attachments`
- `modules/insites_databases/controllers/database_items/delete_custom_attachment`
- `modules/insites_databases/controllers/database_items/delete_custom_image`
- `modules/insites_databases/controllers/database_items/duplicate`
- `modules/insites_databases/controllers/database_items/ecommerce/get_categories`
- `modules/insites_databases/controllers/database_items/ecommerce/get_orders`
- `modules/insites_databases/controllers/database_items/ecommerce/get_products`
- `modules/insites_databases/controllers/database_items/ecommerce/get_quotes`
- `modules/insites_databases/controllers/database_items/ecommerce/get_searched_categories`
- `modules/insites_databases/controllers/database_items/ecommerce/get_searched_orders`
- `modules/insites_databases/controllers/database_items/ecommerce/get_searched_products`
- `modules/insites_databases/controllers/database_items/ecommerce/get_searched_quotes`
- `modules/insites_databases/controllers/database_items/edit`
- `modules/insites_databases/controllers/database_items/export`
- `modules/insites_databases/controllers/database_items/filters/delete_filter`
- `modules/insites_databases/controllers/database_items/filters/get_filters`
- `modules/insites_databases/controllers/database_items/filters/save_filters`
- `modules/insites_databases/controllers/database_items/get_details`
- `modules/insites_databases/controllers/database_items/get_list`
- `modules/insites_databases/controllers/database_items/get_upload_media`
- `modules/insites_databases/controllers/database_items/histories/get_histories`
- `modules/insites_databases/controllers/database_items/import`
- `modules/insites_databases/controllers/database_items/insites/get_insites`
- `modules/insites_databases/controllers/database_items/insites/get_searched_insites`
- `modules/insites_databases/controllers/database_items/links/get_crm_contact`
- `modules/insites_databases/controllers/database_items/locator/get_locations`
- `modules/insites_databases/controllers/database_items/locator/get_searched_locations`
- `modules/insites_databases/controllers/database_items/restore`
- `modules/insites_databases/controllers/database_items/users/get_searched_users`
- `modules/insites_databases/controllers/database_items/users/get_users`
- `modules/insites_databases/controllers/databases/add`
- `modules/insites_databases/controllers/databases/delete`
- `modules/insites_databases/controllers/databases/edit`
- `modules/insites_databases/controllers/databases/empty`
- `modules/insites_databases/controllers/databases/get_details`
- `modules/insites_databases/controllers/databases/get_list`
- `modules/insites_databases/controllers/databases/get_paths`
- `modules/insites_databases/controllers/databases/get_reference_fields`
- `modules/insites_databases/controllers/databases/histories/get_histories`
- `modules/insites_databases/controllers/reports/get_reports`
- `modules/insites_databases/controllers/webhooks/add`
- `modules/insites_databases/controllers/webhooks/edit`
- `modules/insites_databases/controllers/webhooks/get_list`

## module-v6-crm (59)

- `crm/controller/activities/create`
- `crm/controller/activities/delete`
- `crm/controller/activities/get`
- `crm/controller/activities/list`
- `crm/controller/activities/update`
- `crm/controller/addresses/create`
- `crm/controller/addresses/delete`
- `crm/controller/addresses/get`
- `crm/controller/addresses/list`
- `crm/controller/addresses/update`
- `crm/controller/attachments/create`
- `crm/controller/attachments/credentials/get`
- `crm/controller/attachments/delete`
- `crm/controller/attachments/get`
- `crm/controller/attachments/list`
- `crm/controller/companies/archive`
- `crm/controller/companies/assign-contacts`
- `crm/controller/companies/create`
- `crm/controller/companies/delete`
- `crm/controller/companies/get`
- `crm/controller/companies/list`
- `crm/controller/companies/restore`
- `crm/controller/companies/update`
- `crm/controller/contact-profiles/assign`
- `crm/controller/contact-profiles/update-profile`
- `crm/controller/contacts/archive`
- `crm/controller/contacts/create`
- `crm/controller/contacts/delete`
- `crm/controller/contacts/get`
- `crm/controller/contacts/list`
- `crm/controller/contacts/restore`
- `crm/controller/contacts/update`
- `crm/controller/custom-fields/create`
- `crm/controller/custom-fields/delete`
- `crm/controller/custom-fields/list`
- `crm/controller/event-streams/create`
- `crm/controller/event-streams/list`
- `crm/controller/google_maps/get`
- `crm/controller/relationships/create`
- `crm/controller/relationships/delete`
- `crm/controller/relationships/get`
- `crm/controller/relationships/list`
- `crm/controller/relationships/update`
- `crm/controller/system-fields/create`
- `crm/controller/system-fields/delete`
- `crm/controller/system-fields/get`
- `crm/controller/system-fields/list`
- `crm/controller/system-fields/update`
- `crm/controller/task-comments/create`
- `crm/controller/task-comments/get`
- `crm/controller/task-comments/list`
- `crm/controller/task-comments/update`
- `crm/controller/tasks/complete`
- `crm/controller/tasks/create`
- `crm/controller/tasks/delete`
- `crm/controller/tasks/get`
- `crm/controller/tasks/list`
- `crm/controller/tasks/open`
- `crm/controller/tasks/update`

## module-v6-events (37)

- `events/event_expenses/create`
- `events/event_expenses/delete`
- `events/event_expenses/list`
- `events/event_expenses/update`
- `events/event_faqs/create`
- `events/event_faqs/delete`
- `events/event_faqs/list`
- `events/event_faqs/update`
- `events/event_speakers/create`
- `events/event_speakers/delete`
- `events/event_speakers/list`
- `events/event_speakers/update`
- `events/event_sponsors/create`
- `events/event_sponsors/delete`
- `events/event_sponsors/list`
- `events/event_sponsors/update`
- `events/event_tickets/assign_contact`
- `events/event_tickets/create`
- `events/event_tickets/delete`
- `events/event_tickets/list`
- `events/event_tickets/update`
- `events/events/create`
- `events/events/delete`
- `events/events/get`
- `events/events/list`
- `events/events/update`
- `events/events/update_event_status`
- `events/system_fields/create`
- `events/system_fields/delete`
- `events/system_fields/get_options`
- `events/system_fields/list`
- `events/system_fields/update`
- `events/system_fields/update_configuration`
- `events/venues/create`
- `events/venues/list`
- `modules/insites_events/controllers/user_preferences/get`
- `modules/insites_events/controllers/user_preferences/upsert`

## module-v6-locator (23)

- `locator/controller/categories/create`
- `locator/controller/categories/delete`
- `locator/controller/categories/get`
- `locator/controller/categories/list`
- `locator/controller/categories/update`
- `locator/controller/custom_fields/delete`
- `locator/controller/custom_fields/get`
- `locator/controller/enquiries/create`
- `locator/controller/enquiries/delete`
- `locator/controller/enquiries/filters/get_filter_options`
- `locator/controller/enquiries/get`
- `locator/controller/enquiries/list`
- `locator/controller/enquiries/update`
- `locator/controller/locations/create`
- `locator/controller/locations/delete`
- `locator/controller/locations/get`
- `locator/controller/locations/list`
- `locator/controller/locations/update`
- `locator/controller/system_fields/create`
- `locator/controller/system_fields/delete`
- `locator/controller/system_fields/get`
- `locator/controller/system_fields/list`
- `locator/controller/system_fields/update`

## module-v6-assets (7)

- `assets/controller/assets/archive`
- `assets/controller/assets/create`
- `assets/controller/assets/delete`
- `assets/controller/assets/get`
- `assets/controller/assets/list`
- `assets/controller/folders/create`
- `assets/controller/folders/delete`

## module-v6-api (5)

- `insites/controller/endpoints/create`
- `insites/controller/endpoints/delete`
- `insites/controller/endpoints/get`
- `insites/controller/endpoints/list`
- `insites/controller/endpoints/update`

## Internal aliases (90)

Callable, undocumented, not a contract. Listed so a name you meet in module source can be placed.

### module-v6-pipelines (60)

- `modules/insites_pipeline/functions/custom_fields/get_custom_field`
- `modules/insites_pipeline/functions/database_items/get_details`
- `modules/insites_pipeline/functions/export_custom_fields_mapper`
- `modules/insites_pipeline/functions/generate_advanced_custom_filters`
- `modules/insites_pipeline/functions/generate_advanced_filters`
- `modules/insites_pipeline/functions/opportunities/get_opportunities`
- `modules/insites_pipeline/functions/opportunities/histories/add_activity`
- `modules/insites_pipeline/functions/opportunities/histories/add_opportunity`
- `modules/insites_pipeline/functions/opportunities/histories/add_task`
- `modules/insites_pipeline/functions/opportunities/histories/assign_contact`
- `modules/insites_pipeline/functions/opportunities/histories/delete_activity`
- `modules/insites_pipeline/functions/opportunities/histories/delete_opportunity`
- `modules/insites_pipeline/functions/opportunities/histories/delete_task`
- `modules/insites_pipeline/functions/opportunities/histories/edit_activity`
- `modules/insites_pipeline/functions/opportunities/histories/edit_opportunity`
- `modules/insites_pipeline/functions/opportunities/histories/modify_opportunity`
- `modules/insites_pipeline/functions/opportunities/histories/modify_stage`
- `modules/insites_pipeline/functions/opportunities/histories/modify_weighting`
- `modules/insites_pipeline/functions/opportunities/histories/remove_contact`
- `modules/insites_pipeline/functions/opportunities/histories/update_task`
- `modules/insites_pipeline/functions/pipelines/custom_fields/get_pipeline_custom_fields`
- `modules/insites_pipeline/functions/pipelines/custom_fields/get_pipeline_custom_fields_for_export`
- `modules/insites_pipeline/graphql/custom_fields/data_sources/get_databases`
- `modules/insites_pipeline/graphql/custom_fields/data_sources/get_selected_databases`
- `modules/insites_pipeline/insites_api/external_api`
- `modules/insites_pipeline/insites_api/external_api/custom_fields_opportunities/object`
- `modules/insites_pipeline/insites_api/external_api/lost_reasons/object`
- `modules/insites_pipeline/insites_api/external_api/opportunities/add_opportunity`
- `modules/insites_pipeline/insites_api/external_api/opportunities/delete_opportunity`
- `modules/insites_pipeline/insites_api/external_api/opportunities/get_opportunities`
- `modules/insites_pipeline/insites_api/external_api/opportunities/get_opportunity`
- `modules/insites_pipeline/insites_api/external_api/opportunities/object`
- `modules/insites_pipeline/insites_api/external_api/opportunities/update_opportunity`
- `modules/insites_pipeline/insites_api/external_api/opportunity_custom_fields/delete_opportunity_custom_field`
- `modules/insites_pipeline/insites_api/external_api/opportunity_custom_fields/get_opportunity_custom_fields`
- `modules/insites_pipeline/insites_api/external_api/opportunity_custom_fields/object`
- `modules/insites_pipeline/insites_api/external_api/opportunity_related_contacts/add_related_contact`
- `modules/insites_pipeline/insites_api/external_api/opportunity_related_contacts/delete_related_contact`
- `modules/insites_pipeline/insites_api/external_api/opportunity_related_contacts/get_related_contacts`
- `modules/insites_pipeline/insites_api/external_api/opportunity_related_contacts/object`
- `modules/insites_pipeline/insites_api/external_api/opportunity_related_contacts/update_related_contact`
- `modules/insites_pipeline/insites_api/external_api/pipeline_stages/add_stage`
- `modules/insites_pipeline/insites_api/external_api/pipeline_stages/delete_stage`
- `modules/insites_pipeline/insites_api/external_api/pipeline_stages/get_stages`
- `modules/insites_pipeline/insites_api/external_api/pipeline_stages/object`
- `modules/insites_pipeline/insites_api/external_api/pipeline_stages/update_stage`
- `modules/insites_pipeline/insites_api/external_api/pipelines/add_pipeline`
- `modules/insites_pipeline/insites_api/external_api/pipelines/delete_pipeline`
- `modules/insites_pipeline/insites_api/external_api/pipelines/get_pipeline`
- `modules/insites_pipeline/insites_api/external_api/pipelines/get_pipelines`
- `modules/insites_pipeline/insites_api/external_api/pipelines/object`
- `modules/insites_pipeline/insites_api/external_api/pipelines/update_pipeline`
- `modules/insites_pipeline/insites_api/external_api/system_fields/add_system_field`
- `modules/insites_pipeline/insites_api/external_api/system_fields/delete_system_field`
- `modules/insites_pipeline/insites_api/external_api/system_fields/edit_system_field`
- `modules/insites_pipeline/insites_api/external_api/system_fields/get_system_field`
- `modules/insites_pipeline/insites_api/external_api/system_fields/get_system_fields`
- `modules/insites_pipeline/insites_api/external_api/system_fields/object`
- `modules/insites_pipeline/insites_api/external_api/won_reasons/object`
- `modules/insites_pipeline/schema/opportunity`

### module-v6-data (28)

- `modules/insites_databases/functions/_external/v2/databases/add_database`
- `modules/insites_databases/functions/database_items/add`
- `modules/insites_databases/functions/database_items/build_data_sources`
- `modules/insites_databases/functions/database_items/edit`
- `modules/insites_databases/functions/database_items/get_details`
- `modules/insites_databases/functions/database_items/get_list`
- `modules/insites_databases/functions/database_items/histories/add_item`
- `modules/insites_databases/functions/database_items/histories/delete_item`
- `modules/insites_databases/functions/database_items/histories/duplicate_item`
- `modules/insites_databases/functions/database_items/histories/edit_item`
- `modules/insites_databases/functions/database_items/histories/restore_item`
- `modules/insites_databases/functions/databases/histories/add_database`
- `modules/insites_databases/functions/databases/histories/delete_database`
- `modules/insites_databases/functions/databases/histories/edit_database`
- `modules/insites_databases/functions/databases/histories/empty_database`
- `modules/insites_databases/functions/databases/validate_properties`
- `modules/insites_databases/functions/filters/assign_filters`
- `modules/insites_databases/functions/generate_advanced_filters`
- `modules/insites_databases/functions/generate_sort`
- `modules/insites_databases/functions/send_webhook`
- `modules/insites_databases/functions/webhooks/format_payload`
- `modules/insites_databases/graphql/database_items/get_databases`
- `modules/insites_databases/graphql/database_items/get_insites_databases`
- `modules/insites_databases/graphql/database_items/get_selected_databases`
- `modules/insites_databases/graphql/database_items/get_selected_insites_databases`
- `modules/insites_databases/graphql/filters/get_data_source_ids`
- `modules/insites_databases/graphql/filters/get_data_source_users`
- `modules/insites_databases/graphql/filters/get_data_source_uuids`

### module-v6-crm (1)

- `modules/insites_crm/functions/auth/api_key_guard`

### module-v6-events (1)

- `modules/insites_events/functions/events/pricing/upsert_tier_from_import`

---

Generated from module source by tools/generate-alias-inventory.mjs. Counts are per
scanned module version, so they move between releases: regenerate rather than trusting
a copied figure.
