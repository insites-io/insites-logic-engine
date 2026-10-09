# Ecommerce — Configuration

What an instance administrator sets up in IIA, and what the module writes to an instance on its own when deployed. Source for this page: the module's `private/views/partials/insites_menu/`, the Vue router under `vue/src/router/`, `private/schema/`, `private/migrations/` and `private/notifications/` in module-v6-ecommerce v6.0.2, read on 9 October 2026.

For authentication of the API itself, see [`../../api/authentication.md`](../../api/authentication.md).

---

## IIA admin paths

The sidebar partial `insites_menu/insites_ecommerce_side_menu.liquid` adds an "Ecommerce" group; `insites_ecommerce_settings.liquid` adds `#/settings/ecommerce`; `insites_stripe_side_menu.liquid` adds `#/integrations/stripe`. The routes below come from the twelve route files in `vue/src/router/`.

| What | IIA path |
|---|---|
| Products list / add / edit | `<your-insites-instance>/admin/insites#/ecommerce/products`, `/add`, `/:uuid` |
| Product sub-tabs | `product-details`, `pricing`, `shipping`, `variants`, `gallery`, `media`, `metadata`, `open-graph`, `sitemap`, `schema`, `custom-field`, `history`, `system-info` (child routes of `/ecommerce/products/:uuid`) |
| Categories list / add / edit | `#/ecommerce/categories`, `/add`, `/:uuid` |
| Assign products to a category | `#/ecommerce/categories/:category_id/assign-products` |
| Carts list / add / view | `#/ecommerce/carts`, `/add`, `/:uuid` |
| Quotes list / add / edit | `#/ecommerce/quotes`, `/add`, `/:uuid` |
| Orders list / add / edit | `#/ecommerce/orders`, `/add`, `/:uuid` (child routes include `items`, `discounts`, `payments`, `shipping`, `order-pdfs`, `activities`, `notes`, `history`) |
| Discounts list / add / edit | `#/ecommerce/discounts`, `/add`, `/:uuid` (`restriction-details` child) |
| Freight suppliers | `#/ecommerce/freight-suppliers` |
| Custom fields | `#/ecommerce/custom-fields`, with `/products/configuration`, `/categories/configuration`, `/orders/configuration` |
| System fields | `#/ecommerce/system-fields` |
| Configuration (units) | `#/ecommerce/configuration` |
| Webhooks | `#/ecommerce/webhooks` |
| Stripe keys | `#/integrations/stripe` |

A "Notifications" entry exists in the side-menu partial but is commented out, so it does not render.

---

## Configuration row

One record in `modules/insites_ecommerce/configuration` (`private/schema/configuration.yml`): `uuid`, `measurement_unit` (default `mm`), `weight_unit` (default `kg`). The V2 update controller (`controllers/_external/v2/configurations/set_configuration.liquid`) accepts only `mm, cm, m, in, ft, yd` and `kg, g, lb, oz`, returns `invalid_params` otherwise, and creates the row if none exists. `GET /ecommerce/api/v2/configuration` answers `404 no_configuration` until something has written it.

---

## Stripe keys

The Stripe screen and `GET|PATCH /ecommerce/api/v2/configuration/stripe` do not use the configuration table. They read and write six named rows in the CRM instance-configuration store through `modules/insites_crm/instance_configurations/get_instance_configuration`: `stripe_account_id`, `stripe_publishable_test_key`, `stripe_secret_test_key`, `stripe_publishable_live_key`, `stripe_secret_live_key`, `stripe_live_mode` (`controllers/_external/v2/instance_configuration/get_instance_configuration.liquid`). The API returns them as `account_id`, `pk_test_key`, `sk_test_key`, `pk_live_key`, `sk_live_key`, `livemode`.

A second, separately named set is read by `private/views/partials/shared/api_credentials.liquid` for the outbound gateway calls: `stripe_sandbox_account_id`, `stripe_sandbox_pk_key`, `stripe_sandbox_sk_key`, `stripe_production_account_id`, `stripe_production_pk_key`, `stripe_production_sk_key`, chosen on `context.environment == "production"`. Source does not show what writes the `stripe_sandbox_*` / `stripe_production_*` rows; the admin screen writes the first set. Treat the two sets as unrelated until proven otherwise.

The migrations `99990401101010_add_gateway_keys.liquid` and `99990401101040_add_stripe_account_id.liquid` push deploy-time template values (`<%= insites_stripe_account_id =%>` and friends) into `modules/insites_stripe/set_constant`, but only when the registry says `insites_stripe` is installed. On an instance without that optional module they log a skip and do nothing. The comment in the first file records why: the unguarded version failed the whole deploy of all eleven v6 modules to a fresh instance.

---

## Custom fields

Custom-field definitions for products, categories and orders are created on the IIA configuration screens listed above. The tables that hold them are not in `private/schema/`; migrations `99990204443087`, `...88` and `...89` call `admin_table_create` for `modules/ins_ecommerce/public/schema/{product,category,order}_custom_field.yml`, each seeded with one `string` property (`product_uuid`, `category_uuid`, `order_uuid`). The API can list and delete definitions (`GET|DELETE /ecommerce/api/v2/custom-fields/<type>[/:id]`) but not create them.

Custom-field values travel on the parent resource as dotted keys (`custom_field.<name>`) on write and a nested `custom_field` object on read, exactly as in CRM.

---

## Webhooks

The Webhooks screen (`vue/src/views/Webhooks/Webhooks.vue`) shows one row per event for a fixed list: `order_created`, `order_updated`, `quote_created`, `quote_updated`. Each row writes a record in `modules/insites_ecommerce/webhook` with `event_type`, `webhook_url`, `is_webhook_enabled` and `payload_schema` (`private/schema/webhook.yml`). Only `webhook_url` and `is_webhook_enabled` are read when sending (`private/views/partials/functions/send_webhook.liquid`); `payload_schema` is stored and never consulted. The sender takes `results[0]` for the event type, so one URL per event.

---

## What a deploy migrates

19 files under `private/migrations/`, in the order the platform runs them (timestamp prefix):

| Migration | Does |
|---|---|
| `20250701174960_delete_quote_custom_col` | `records_delete_all` on `quote_column` |
| `20250730975133_delete_product_custom_columns` | `records_delete_all` on `product_column` |
| `20250811205614_products_populate_effective_price` | computes `effective_price` on every product, 500 per page |
| `20250811205628_variants_populate_effective_price` | same for `product_variant` |
| `20250901224312_update_quote_total` | recomputes each quote's totals from its quote items |
| `20251123175422_delete_order_custom_col` | `records_delete_all` on `order_column` |
| `20251127215280_populate_product_total_price` | computes `total_price` on products |
| `20251130214852_populate_quote_total` | `quote_total` = subtotal + shipping + processing_fee + tax − discount |
| `20251130220809_populate_order_total` | `order_total` = subtotal + tax + processing_fee + shipping − discount |
| `20251203215951_delete_discount_custom_col` | `records_delete_all` on `discount_column` |
| `20260129120000_update_order_total` | recomputes order totals from order items |
| `20260530120000_products_repopulate_effective_price` | re-runs the effective-price computation on products |
| `20260530120001_variants_repopulate_effective_price` | same for variants |
| `99990117240320_create_order_discount` | converts legacy `order.discount_code_uuids` arrays into `order_discount` rows |
| `99990204443087_add_product_custom_field_schema` | `admin_table_create` for the product custom-field table |
| `99990204443088_add_category_custom_field_schema` | same for categories |
| `99990204443089_add_orders_custom_field_schema` | same for orders |
| `99990401101010_add_gateway_keys` | Stripe constants, guarded on `insites_stripe` being installed |
| `99990401101040_add_stripe_account_id` | Stripe account id constant, same guard |

Four of these wipe the per-administrator column-preference tables outright. The total-recomputation migrations read up to 10,000 records in one GraphQL page (`per_page: 10000`); on a large instance that is the slow step of a deploy. The module seeds no products, categories or other business rows.

---

## Out of scope for this document

- **Module install and version updates**: through the Insites console.
- **The payment call** (checkout session, charge): [`../../payments/README.md`](../../payments/README.md).
- **Roles**: per-instance access is `authorization_policies`; the module's admin pages use `modules/insites_crm/insites_only_allowed_by_administrators` and its API pages `modules/insites_crm/has_valid_instance_api_authorization`.
