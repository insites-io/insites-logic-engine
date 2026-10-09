# Ecommerce — Gotchas

Edges visible in module-v6-ecommerce v6.0.2 source, read on 9 October 2026. Each entry: **what bites**, **why**, **how to avoid**. File paths are relative to `pos/modules/insites_ecommerce/`.

---

## 1. Cart-item and cart-discount lists live at `/items`, not at the collection root

**Bites:** `GET /ecommerce/api/v2/cart-items` returns 404; so does `GET /ecommerce/api/v2/cart-discounts`.

**Why:** the list pages are `v2/cart_items/get_cart_items.liquid` with slug `ecommerce/api/v2/cart-items/items` and `v2/cart_discounts/get_cart_discounts.liquid` with slug `ecommerce/api/v2/cart-discounts/items`. Every other resource lists at its root.

**Avoid:** use `/cart-items/items?cart_uuid=…` and `/cart-discounts/items?cart_uuid=…`. Both controllers return `400 missing_cart_uuid` without the filter.

---

## 2. Cart discounts update by numeric `:id` with `PUT`; everything else by `:uuid` with `PATCH`

**Bites:** `PATCH /ecommerce/api/v2/cart-discounts/<uuid>` returns 404.

**Why:** `v2/cart_discounts/edit_cart_discount.liquid` declares `method: put` and slug `cart-discounts/:id`; the controller reads `params.id` and passes it to `cart_discounts/update_cart_discount` as the record id. Delete on the same resource is `DELETE /cart-discounts/:uuid`. The two cart-discount write paths use different identifiers.

**Avoid:** keep the numeric `id` from the create or list response for update; keep the `uuid` for delete. The on-instance API doc for this endpoint says `patch` and `:id` (`insites_api/external_api/cart_discounts/update_cart_discount.liquid`); the page says `put`. Trust the page.

---

## 3. The cart-discount update doc partial is not valid JSON

**Bites:** the admin API-docs page for "Update Cart Discount" renders nothing or errors.

**Why:** `insites_api/external_api/cart_discounts/update_cart_discount.liquid` line 9 reads `"uuid"` followed by `"cart_uuid"` with no comma inside `required_params`. It is the only one of 108 doc partials that fails to parse. The other 108 all name a `controller_name` that a partial declares, so the "phantom controller" problem seen in CRM does not occur here; the one alias no doc names is `ecommerce/controller/cart_discounts/update`, which is this broken file.

**Avoid:** read the endpoint from [`api.md`](api.md); do not wait for the admin page.

---

## 4. No single-record GET for cart discounts

**Bites:** `GET /ecommerce/api/v2/cart-discounts/:uuid` returns 404.

**Why:** the resource has four pages (create, list, update, delete). No `get_cart_discount` page or controller exists.

**Avoid:** list by `cart_uuid` and pick the row.

---

## 5. Custom fields use numeric `:id` and a table path with a different module prefix

**Bites:** deleting a custom field by uuid fails; reading the table name from the schema folder finds nothing.

**Why:** `GET|DELETE /custom-fields/{products,categories,orders}[/:id]` share two controllers (`custom_field/list`, `custom_field/delete`) that take a `type` argument from the page and address the table by literal path `modules/ins_ecommerce/public/schema/<type>_custom_field.yml`. The tables are created by migration, not by a file in `private/schema/`, and the prefix is `ins_ecommerce`, not `insites_ecommerce`. The delete controller rejects a non-integer `id` with `400 "id must be a valid integer"`.

**Avoid:** take `id` from the list response. Do not look for a `custom_field` schema file.

---

## 6. `cart/create` reads a raw `body` argument that the page never passes

**Bites:** calling `ecommerce/controller/cart/create` from Liquid with `body:` set to a JSON string behaves differently from the HTTP endpoint.

**Why:** the controller (`controllers/_external/v2/carts/add_cart.liquid`) parses an optional `body` argument and returns `400 malformed_json` when it is non-blank but unparsable, then merges `contact`, `company` and `session_id` from it into `params`. The page passes only `params: context.params`, so over HTTP `body` is always blank. The test page `private/views/pages/tests/_external/v2/carts/post_cart.liquid` is the only caller that sets it.

**Avoid:** send `contact.uuid`, `company.uuid` and `session_id` as ordinary params. Treat `body` as a test hook.

---

## 7. The response handler is gated, and it is CRM's handler

**Bites:** a JSON write that fails still returns HTTP 200 when the request has no `?format=json`.

**Why:** all 105 controllers wrap `modules/insites_crm/functions/response_handler` in `if context.params.format == 'json'`. The module's own `functions/response_handler.liquid` exists (prints `data`, defaults status to 400, sets headers) but the V2 controllers do not use it; the admin quote-PDF controller does.

**Avoid:** always send `?format=json`. Read `errors` in the body as the source of truth. From Liquid, use `{% function %}` and leave `format` out of the params hash when the page is HTML; see [`02-calling-a-controller.md`](../../building-on-insites/02-calling-a-controller.md).

---

## 8. Two error shapes, as in CRM

**Bites:** a client that only checks `error` (string) misses failures.

**Why:** the controllers build `{ "errors": [ { "code": "…", "message": "…" } ] }` (for example `missing_cart_uuid`, `no_product`, `creation_failed`, `invalid_contact`). The doc partials' example responses show `{ "error": "…" }` for 400 and 401. The custom-field delete controller sets `errors` to a bare string.

**Avoid:** treat any non-2xx, or any body with an `error` or `errors` key of any type, as failure.

---

## 9. `sort_by` versus `sort`, `sort_order` versus `order`

**Bites:** a sort parameter is silently ignored on one list and honoured on another.

**Why:** `product/list` reads `params.sort | default: params.sort_by` and `params.order | default: params.sort_order`; `system_field/list` reads only `sort_by` and `sort_order`; `cart_items/list` reads `order | sort_order` and only supports `ASC`/`DESC` with `product_name`/`product_sku` search. The doc partial for product variants lists `sort, order`, the rest list `sort_by, sort_order`.

**Avoid:** send `sort_by` and `sort_order`; every controller that sorts accepts that pair. Sorting on `created_at` or `updated_at` is handled as a system sort; any other name is treated as a property.

---

## 10. Order and quote records join the pipelines `opportunity` table

**Bites:** on an instance without the pipelines module, order and quote queries can fail at the GraphQL layer.

**Why:** `graphql/_external/v2/orders/{add,edit,get,get_orders,delete}_order.graphql` and the quote equivalents select `related_records` from `modules/insites_pipeline/opportunity` (the `opportunity.uuid` field on the wire). Source shows the join; it does not show a guard for the table being absent. Whether the platform tolerates a related-record join to a missing table was not tested for this document.

**Avoid:** deploy pipelines alongside ecommerce, or test order and quote reads on the target instance before relying on them.

---

## 11. Stripe secret keys come back in a GET

**Bites:** `GET /ecommerce/api/v2/configuration/stripe` returns `sk_test_key` and `sk_live_key` in clear.

**Why:** `controllers/_external/v2/instance_configuration/get_instance_configuration.liquid` reads all six rows and returns them. The page is behind the instance API key only.

**Avoid:** treat the instance API key as a secret of the same grade as the Stripe secret key. Do not call this endpoint from a browser.

---

## 12. Three version strings, none of them the tag

**Bites:** "which ecommerce version is installed" gets three answers.

**Why:** `hook_module_info` says `6.0.0`; the generated admin dependency partials say `v6.0.1`; `vue/package.json` says `6.0.2`; the git tag is v6.0.2. Release tooling bumps the package and tag but not the hook.

**Avoid:** read the tag or the Console changelog for the version; use the hook only for "is it installed".

---

## 13. Deprecated fields still on the wire

**Bites:** a client writes a field the module no longer honours.

**Why:** schema comments mark `cart.discount_code_uuids` ("deprecated? 5.10.7"), `product.is_free_shipping` and `product.freight_amount` ("deprecated 5.10.4"), `freight_supplier.tracking_code` and `freight_supplier.status` ("deprecated"), `quote.quote_date` ("using quote_date_time"), and `order_shipping_package.shipping_tracking_code` / `quote_shipping_package.shipping_tracking_code` ("replaced by freight_tracking_code"). All still exist as columns and most still appear in the doc partials' `params`.

**Avoid:** prefer `quote_date_time`, `freight_tracking_code`, `order_discount` rows and the variant-level freight fields. Migration `99990117240320_create_order_discount` is the precedent: it moved `discount_code_uuids` into rows.

---

## 14. Variant `product_options` is an array of JSON strings

**Bites:** code that expects `[{label, value}]` gets `["{\"product_option_label\":\"Color\",...}"]`.

**Why:** `insites_api/external_api/cart_items/add_cart_item.liquid` shows the shape in its example: each element is a serialised object. `product_variant.yml` types it as an array.

**Avoid:** parse each element.

---

## 15. Webhooks fire on one URL per event, after the write, before the response

**Bites:** a slow webhook receiver slows every order and quote write; a second URL for the same event never fires.

**Why:** `functions/send_webhook.liquid` reads `results[0]` for the event type and calls `api_call_send` inline inside the controller, before `response_handler`. The payload is the already API-shaped `data`. There is no signature header and no retry.

**Avoid:** answer 2xx fast and queue the work. Use the event stream for anything that needs more than one subscriber.

---

## 16. Test pages ship with the module

**Bites:** two pages exist on every instance: `ecommerce/tests/v2/carts/post` and `ecommerce/tests/v2/products/cleanup-qa-duplicates`.

**Why:** `private/views/pages/tests/_external/v2/` holds them. Both are behind `has_valid_instance_api_authorization`. The second deletes products by four named QA SKUs and says it is safe to re-run.

**Avoid:** do not create products with SKUs `QA-CF-001`, `QA-V2-01`, `qa-batch-new-001` or `qa-tax-flags-import-r2` on a real instance.
