# Ecommerce — V2 REST API

The Ecommerce module (machine name `insites_ecommerce`) exposes a V2 REST API at `/ecommerce/api/v2/...`. Counted in module-v6-ecommerce v6.0.2 on 9 October 2026: 109 endpoints across 22 resources, each a page under `modules/insites_ecommerce/private/views/pages/api/_external/v2/` that includes one controller alias. Method, path and policy below come from each page's front matter; required params, params and documented status codes come from the matching doc partial under `private/views/partials/insites_api/external_api/`; behaviour notes come from the controller under `private/views/partials/controllers/_external/v2/`.

For authentication, see [`../../api/authentication.md`](../../api/authentication.md). Send the raw instance API key as `Authorization`, no `Bearer` prefix.

---

## Conventions

### Auth guard

All 109 pages declare the same front matter policy:

```yaml
authorization_policies:
- modules/insites_crm/has_valid_instance_api_authorization
```

No V2 page uses an inline `api_key_guard`. The two Stripe-configuration pages declare the policy with a two-space indent, which is the same policy. A failed policy returns `401` before any controller runs.

### URL pattern

```
<method> /ecommerce/api/v2/<resource>[/<uuid>][/<action>]
```

Resources are kebab-case (`cart-items`, `order-shipping-packages`). Records are addressed by `uuid` with three exceptions: custom fields (`/custom-fields/<type>/:id`, numeric), the cart-discount update (`PUT /cart-discounts/:id`, numeric) and the discount lookup by code (`/discounts/by-code/:discount_code`). Update is `PATCH` everywhere except the cart-discount update, which is `PUT`.

### Request format

- **Body:** JSON. The controllers read `params`, so form-encoded bodies also work.
- **Bulk create** (`/cart-items/bulk`, `/order-items/bulk`, `/order-discounts/bulk`, `/quote-items/bulk`): the body is a JSON **array** of records (`params._json` in `order_items/add_order_items.liquid`); the response is an array in the same order, each element either the created record or `{ "errors": [...] }`.
- **Relations are dotted keys:** `order.uuid`, `quote.uuid`, `product.uuid`, `product_variant.uuid`, `discount.uuid`, `contact.uuid`, `company.uuid`, `freight_supplier.uuid`, `opportunity.uuid`, `brand.uuid`. `modules/insites_crm/functions/_external/payload_api` maps them through each controller's `models/payload_fields.liquid` to storage keys (`order_uuid`, `brand_uuid`, …). On read they come back nested (`"order": { "uuid": … }`).
- **Custom fields:** `custom_field.<name>` on write, a nested `custom_field` object on read (products, categories, orders, quotes).
- **`format=json`:** every controller runs `modules/insites_crm/functions/response_handler` only when `context.params.format == 'json'`. Without it the HTTP status is 200 whatever happened. Always send it.

### Response: success

The record at top level, with `id` (numeric, string-typed in examples), `uuid`, `created_at`, `updated_at` and the resource fields.

### Response: error

Controllers build `{ "errors": [ { "code": "…", "message": "…" } ] }`. The doc partials' examples show `{ "error": "…" }`. Accept both. Codes seen in source: `missing_cart_uuid`, `missing_id`, `missing_discount_code`, `malformed_json`, `invalid_contact`, `invalid_company`, `invalid_params`, `no_product`, `no_discount`, `no_configuration`, `creation_failed`, `update_failed`, `deletion_failed`. Status: `400` validation, `401` policy, `404` not found (GET by uuid, delete, update), `500` is the controllers' initial value and is what you get when the GraphQL call returns neither items nor errors.

### List envelope and query parameters

```json
{ "total_entries": 75, "total_pages": 8, "page": 1, "size": 10, "results": [ … ] }
```

| Param | Default | Notes |
|---|---|---|
| `page` | `1` | coerced with `times: 1` |
| `size` | `10` | same |
| `sort_by` | per resource (`product_name`, `product_sku`, `uuid`, …) | `created_at` / `updated_at` are system sorts; any other value is treated as a property. Most list controllers also accept `sort` as an alias. |
| `sort_order` | `ASC` | `ASC` or `DESC`; most controllers also accept `order` |
| `search_by` | per resource | property to match |
| `keyword` | | search value |

`cart-items/items` and `cart-discounts/items` need `cart_uuid` as well.

### Webhooks

| Endpoint | Event | Payload |
|---|---|---|
| `POST /ecommerce/api/v2/orders` | `order_created` | the created order, API shape |
| `PATCH /ecommerce/api/v2/orders/:uuid` | `order_updated` | the updated order |
| `POST /ecommerce/api/v2/quotes` | `quote_created` | the created quote |
| `PATCH /ecommerce/api/v2/quotes/:uuid` | `quote_updated` | the updated quote |

Sender: `private/views/partials/functions/send_webhook.liquid`, one URL per event from the `webhook` table, enabled flag honoured, `POST` with `Content-Type: application/json`, no signature, no retry, sent synchronously before the response. The admin order and quote screens fire the same four events. Nothing else fires anything.

---

## Resources

The tables list required params (`req`) and the status codes the doc partial documents (`codes`). Full param lists for the large resources are in the doc partials and the `object.liquid` beside each.

### Products

Controllers `ecommerce/controller/product/{list,get,create,update,delete}`. 72 fields on the object, including pricing (`regular_price`, `sale_price`, `is_on_sale`, `effective_price`, `total_price`, tax flags), stock, dimensions, shipping dimensions, media (`product_image`, `gallery_1`, `gallery_2`, `media_1..4`), SEO (`meta_*`, `open_graph_*`, `sitemap_*`, `schema_content`), `category_uuids`, `brand_uuid` / `brand_name` (plain fields; no brand table exists in `private/schema/`), `status`, `product_weighting`, `is_product_variant_enabled`, `custom_field`.

| Method | Path | req | codes |
|---|---|---|---|
| `GET` | `/products` | | 200 400 401 |
| `GET` | `/products/:uuid` | uuid | 200 401 404 |
| `POST` | `/products` | product_name | 200 400 401 |
| `PATCH` | `/products/:uuid` | uuid | 200 400 401 404 |
| `DELETE` | `/products/:uuid` | uuid | 200 401 404 |

List defaults: `sort_by=product_name`, `search_by=product_name`.

### Product variants

`ecommerce/controller/product_variant/*`. Fields: `product.uuid`, `product_sku`, `product_image`, `stock_level`, `regular_price`, `cost_price`, `effective_price`, `compare_at_price`, `sale_price`, `is_on_sale`, `is_tax_included`, `is_variant_sale_price_tax_included`, `is_fixed_tax_amount`, `tax_amount`, `freight_amount`, `is_free_shipping`, `width`, `length`, `height`, `weight`, `product_options` (array of JSON strings).

| Method | Path | req | codes |
|---|---|---|---|
| `GET` | `/product-variants` | | 200 401 |
| `GET` | `/product-variants/:uuid` | uuid | 200 401 404 |
| `POST` | `/product-variants` | product.uuid, product_sku, regular_price | 200 400 401 |
| `PATCH` | `/product-variants/:uuid` | uuid | 200 400 401 404 |
| `DELETE` | `/product-variants/:uuid` | uuid | 200 401 404 |

List defaults: `sort_by=product_sku`, `search_by=product_sku`; the doc partial names the sort params `sort` and `order`, which the controller accepts beside `sort_by` / `sort_order`.

### Product variant options

`ecommerce/controller/product_variant_options/*`. Fields: `product_option_label`, `product_option_values` (array), `product.uuid`.

| Method | Path | req | codes |
|---|---|---|---|
| `GET` | `/product-variant-options` | | 200 400 401 |
| `GET` | `/product-variant-options/:uuid` | uuid | 200 401 404 |
| `POST` | `/product-variant-options` | product_option_label, product.uuid | 200 400 401 |
| `PATCH` | `/product-variant-options/:uuid` | uuid | 200 400 401 404 |
| `DELETE` | `/product-variant-options/:uuid` | uuid | 200 401 404 |

### Categories

`ecommerce/controller/category/*`. 42 fields: `parent_category_uuids` (array), `category_name`, `category_slug`, `category_title`, `category_heading`, descriptions, media, SEO and sitemap fields, `status`, `category_weighting`, `custom_field`.

| Method | Path | req | codes |
|---|---|---|---|
| `GET` | `/categories` | | 200 400 401 |
| `GET` | `/categories/:uuid` | uuid | 200 401 404 |
| `POST` | `/categories` | category_name | 200 400 401 |
| `PATCH` | `/categories/:uuid` | uuid | 200 400 401 404 |
| `DELETE` | `/categories/:uuid` | uuid | 200 401 404 |

### Carts

`ecommerce/controller/cart/*`. Fields: `contact.uuid` (→ `contact_uuid`, nested `contact` on read), `company.uuid`, `session_id`. Create validates that the contact and company exist in CRM (`invalid_contact`, `invalid_company`). The schema also carries `discount_code_uuids`, marked deprecated.

| Method | Path | req | codes |
|---|---|---|---|
| `GET` | `/carts` | | 200 |
| `GET` | `/carts/:uuid` | uuid | 200 |
| `POST` | `/carts` | | 200 |
| `PATCH` | `/carts/:uuid` | uuid | 200 |
| `DELETE` | `/carts/:uuid` | uuid | 200 |

The cart doc partials document only 200; the controllers return 400 and 404 in the same way as the others.

### Cart items

`ecommerce/controller/cart_items/{list,get,create,add_bulk,update,delete}`. Stores references only (`cart_uuid`, `product_uuid`, `product_variant_uuid`, `quantity`); `product` and `variant` are joined on read and are read-only.

| Method | Path | req | codes |
|---|---|---|---|
| `GET` | `/cart-items/items` | cart_uuid | 200 400 401 |
| `GET` | `/cart-items/:uuid` | uuid | 200 401 404 |
| `POST` | `/cart-items` | cart_uuid, quantity | 200 400 401 |
| `POST` | `/cart-items/bulk` | per element: cart_uuid, quantity | 200 400 401 |
| `PATCH` | `/cart-items/:uuid` | uuid | 200 400 401 |
| `DELETE` | `/cart-items/:uuid` | uuid | 200 401 404 |

List: `search_by` is `product_name` (default) or `product_sku`; `order` / `sort_order` `ASC` or `DESC` only; no `sort_by`.

### Cart discounts

`ecommerce/controller/cart_discounts/{list,create,update,delete}`. A snapshot of a discount on a cart: `cart_uuid`, `discount_uuid`, `discount_name`, `discount_code`, `discount_type`, `discount_value`. No single GET.

| Method | Path | req | codes |
|---|---|---|---|
| `GET` | `/cart-discounts/items` | cart_uuid | 200 |
| `POST` | `/cart-discounts` | cart_uuid | 200 |
| `PUT` | `/cart-discounts/:id` | id (numeric), cart_uuid | (doc partial is malformed JSON) |
| `DELETE` | `/cart-discounts/:uuid` | uuid | 200 401 404 |

The list doc partial names `field` and `searchKeyword` as its search params, the only place that spelling appears.

### Orders

`ecommerce/controller/order/*`. 110 fields: `order_number`, `order_reference`, `order_status`, `order_payment_status`, `order_shipping_status`, `currency`, `date_time`, `notes`; billing and shipping address snapshots (`billing_*`, `shipping_*`, with `billing_address.uuid` / `shipping_address.uuid` to copy from CRM and `is_use_crm_*_address` flags); `order_company.uuid` + `order_company_*`, `order_contact.uuid` + `order_contact_*`; freight snapshot (`freight_uuid`, `freight_supplier_name`, `freight_method`, `freight_option`, `freight_tracking_code`, `freight_tracking_link`, dispatch / delivered dates); money (`subtotal_amount`, `total_tax_amount`, `total_shipping_amount`, `total_discount_amount`, `processing_fee`, `is_percentage_processing_fee`, `processing_fee_amount`, `total_amount`, `total_amount_paid`, `order_total`); `is_scheduled`, `is_recurring`, `recurring_group_id`; `opportunity.uuid` (pipelines), `quote.uuid`; `custom_field`.

| Method | Path | req | codes |
|---|---|---|---|
| `GET` | `/orders` | | 200 400 401 |
| `GET` | `/orders/:uuid` | uuid | 200 401 404 |
| `POST` | `/orders` | | 200 400 401 |
| `PATCH` | `/orders/:uuid` | uuid | 200 400 401 404 |
| `DELETE` | `/orders/:uuid` | uuid | 200 401 404 |

Create and update fire webhooks; update recomputes `processing_fee_amount` and `order_total` before writing (`edit_order.liquid`).

### Order items

`ecommerce/controller/order_items/{list,get,create,add_bulk,update,delete}`. Fields: `order.uuid`, `product.uuid`, `product_variant.uuid`, `order_item_image`, `order_item_name`, `sku`, `quantity`, `unit_price`, `unit_price_includes_tax`, `item_tax`, `tax_amount`, `line_item_total`, `line_item_tax`, `item_price`, `is_fixed_tax_amount`. The bulk controller recalculates each touched order afterwards.

| Method | Path | req | codes |
|---|---|---|---|
| `GET` | `/order-items` | | 200 400 401 |
| `GET` | `/order-items/:uuid` | uuid | 200 401 404 |
| `POST` | `/order-items` | order.uuid, order_item_name, quantity, unit_price | 200 400 401 |
| `POST` | `/order-items/bulk` | per element, same four | 200 400 401 |
| `PATCH` | `/order-items/:uuid` | uuid | 200 400 401 404 |
| `DELETE` | `/order-items/:uuid` | uuid | 200 401 404 |

### Order discounts

`ecommerce/controller/order_discount/{list,get,create,add_bulk,update,delete}`. Fields: `order.uuid`, `discount.uuid`, `discount_name`, `discount_type`, `discount_value`, `discount_code`.

| Method | Path | req | codes |
|---|---|---|---|
| `GET` | `/order-discounts` | | 200 400 401 |
| `GET` | `/order-discounts/:uuid` | uuid | 200 401 404 |
| `POST` | `/order-discounts` | order.uuid, discount_name, discount_type, discount_value | 200 400 401 |
| `POST` | `/order-discounts/bulk` | per element, same four | 200 400 401 |
| `PATCH` | `/order-discounts/:uuid` | uuid | 200 400 401 404 |
| `DELETE` | `/order-discounts/:uuid` | uuid | 200 401 404 |

### Order shipping packages

`ecommerce/controller/order_shipping_packages/*`. Fields: `order.uuid`, `shipping_package_status`, `shipping_package_name`, `shipping_items_uuids` (order-item uuids), `shipping_package_fee`, `shipping_package_dispatch_date`, `shipping_package_delivered_date`, `freight_supplier.uuid`, `freight_supplier_name`, `freight_method`, `freight_option`, `freight_tracking_code`, and the deprecated `shipping_tracking_code`.

| Method | Path | req | codes |
|---|---|---|---|
| `GET` | `/order-shipping-packages` | | 200 400 401 |
| `GET` | `/order-shipping-packages/:uuid` | uuid | 200 401 404 |
| `POST` | `/order-shipping-packages` | order.uuid, shipping_package_name | 200 400 401 |
| `PATCH` | `/order-shipping-packages/:uuid` | uuid | 200 400 401 404 |
| `DELETE` | `/order-shipping-packages/:uuid` | uuid | 200 401 404 |

### Quotes

`ecommerce/controller/quote/*`. 98 fields, the order shape with `quote_` prefixes: `quote_number`, `quote_reference`, `quote_date` (deprecated) and `quote_date_time`, `quote_status`, `currency`, `opportunity.uuid`, `is_scheduled`, `is_recurring`, `recurring_group_id`, the money fields with `quote_total`, `quote_company.uuid` + `quote_company_*`, `quote_contact.uuid` + `quote_contact_*`, billing and shipping snapshots, `notes`, `custom_field`.

| Method | Path | req | codes |
|---|---|---|---|
| `GET` | `/quotes` | | 200 400 401 |
| `GET` | `/quotes/:uuid` | uuid | 200 401 404 |
| `POST` | `/quotes` | | 200 400 401 |
| `PATCH` | `/quotes/:uuid` | uuid, quote_number | 200 400 401 404 |
| `DELETE` | `/quotes/:uuid` | uuid | 200 401 404 |

Create and update fire webhooks.

### Quote items, quote discounts, quote shipping packages

Mirror the order sub-resources with `quote.uuid` in place of `order.uuid`. Controllers `ecommerce/controller/quote_items/{list,get,create,add_bulk,update,delete}`, `quote_discounts/{list,get,create,update,delete}`, `quote_shipping_packages/{list,get,create,update,delete}`.

| Method | Path | req | codes |
|---|---|---|---|
| `GET` | `/quote-items` | | 200 401 |
| `GET` | `/quote-items/:uuid` | uuid | 200 401 404 |
| `POST` | `/quote-items` | quote.uuid, quote_item_name, quantity, unit_price | 200 400 401 |
| `POST` | `/quote-items/bulk` | per element, same four | 200 400 401 |
| `PATCH` | `/quote-items/:uuid` | uuid | 200 400 401 404 |
| `DELETE` | `/quote-items/:uuid` | uuid | 200 401 404 |
| `GET` | `/quote-discounts` | | 200 401 |
| `GET` | `/quote-discounts/:uuid` | uuid | 200 401 404 |
| `POST` | `/quote-discounts` | quote.uuid | 200 400 401 |
| `PATCH` | `/quote-discounts/:uuid` | uuid | 200 401 404 |
| `DELETE` | `/quote-discounts/:uuid` | uuid | 200 401 404 |
| `GET` | `/quote-shipping-packages` | | 200 401 |
| `GET` | `/quote-shipping-packages/:uuid` | uuid | 200 401 404 |
| `POST` | `/quote-shipping-packages` | quote.uuid, shipping_package_name | 200 400 401 |
| `PATCH` | `/quote-shipping-packages/:uuid` | uuid | 200 401 404 |
| `DELETE` | `/quote-shipping-packages/:uuid` | uuid | 200 401 404 |

Quote items add `is_use_sale_price` to the order-item field set. There is no quote-to-order endpoint; that is an admin controller (`controllers/quotes/to_order/quote_to_order.liquid`).

### Discounts

`ecommerce/controller/discount/{list,get,by_code,create,update,delete}`. Fields: `discount_name`, `status`, `discount_code`, `auth_policy_id`, `usage_limit`, `usage_count`, `usage_limit_per_user`, `discount_type`, `discount_value`, `minimum_cart_value`, `applicable_to`, `is_applicable_to_all_products`, `is_applicable_to_all_categories`, `category_uuids`, `product_uuids`, `event_uuids`, `is_applicable_to_all_events`, `allocations`.

| Method | Path | req | codes |
|---|---|---|---|
| `GET` | `/discounts` | | 200 400 401 |
| `GET` | `/discounts/:uuid` | uuid | 200 401 404 |
| `GET` | `/discounts/by-code/:discount_code` | discount_code | 200 400 401 404 |
| `POST` | `/discounts` | discount_name, discount_type, applicable_to | 200 400 401 |
| `PATCH` | `/discounts/:uuid` | uuid | 200 400 401 404 |
| `DELETE` | `/discounts/:uuid` | uuid | 200 401 404 |

The by-code controller also falls back to `context.params.discount_code` when called without the argument.

### Payments

`ecommerce/controller/payment/*`. Records a payment against an order; does not charge. Fields: `order.uuid`, `source`, `status`, `amount`, `notes`, `date_time`, `payment_gateway_details`, `payment_gateway_name`, `card_last_four_digits`, `card_brand`, `card_expiry_month`, `card_expiry_year`, `currency`, `bank_name`, `bank_bsb`, `bank_last_four_digits`, `payment_method_name`.

| Method | Path | req | codes |
|---|---|---|---|
| `GET` | `/payments` | | 200 401 |
| `GET` | `/payments/:uuid` | uuid | 200 401 404 |
| `POST` | `/payments` | order.uuid, amount | 200 400 401 |
| `PATCH` | `/payments/:uuid` | uuid | 200 401 404 |
| `DELETE` | `/payments/:uuid` | uuid | 200 401 404 |

A `payment_method` table exists (`private/schema/payment_method.yml`: tokenised card and bank details per contact or company) with no V2 endpoint.

### Freight suppliers

`ecommerce/controller/freight_supplier/*`. Fields: `freight_supplier_name`, `freight_methods`, `tracking_link`, `freight_options`.

| Method | Path | req | codes |
|---|---|---|---|
| `GET` | `/freight-suppliers` | | 200 400 401 |
| `GET` | `/freight-suppliers/:uuid` | uuid | 200 401 404 |
| `POST` | `/freight-suppliers` | freight_supplier_name | 200 400 401 |
| `PATCH` | `/freight-suppliers/:uuid` | uuid | 200 400 401 404 |
| `DELETE` | `/freight-suppliers/:uuid` | uuid | 200 401 404 |

### Custom fields

Two controllers, `ecommerce/controller/custom_field/{list,delete}`, shared by six pages; the page passes `type` as `product`, `category` or `order`. Definition objects: `id`, `name`, `attribute_type`, `belongs_to`, `metadata`. Creation is admin-only.

| Method | Path | req | codes |
|---|---|---|---|
| `GET` | `/custom-fields/products` | | 200 401 |
| `DELETE` | `/custom-fields/products/:id` | id (integer) | 200 401 404 |
| `GET` | `/custom-fields/categories` | | 200 401 |
| `DELETE` | `/custom-fields/categories/:id` | id | 200 401 404 |
| `GET` | `/custom-fields/orders` | | 200 401 |
| `DELETE` | `/custom-fields/orders/:id` | id | 200 400 401 404 |

### System fields

`ecommerce/controller/system_field/*`. Rows of `system_field` (key), `value`, `logo` (upload). Fields on the wire include the `upload` object shape `file_name`, `extension`, `url`.

| Method | Path | req | codes |
|---|---|---|---|
| `GET` | `/system-fields` | | 200 400 401 |
| `GET` | `/system-fields/:uuid` | uuid | 200 400 401 404 |
| `POST` | `/system-fields` | system_field, value | 200 400 401 |
| `PATCH` | `/system-fields/:uuid` | uuid | 200 400 401 404 |
| `DELETE` | `/system-fields/:uuid` | uuid | 200 401 404 |

List accepts a `system_field` filter beside the common params; defaults `sort_by=uuid`, `search_by=value`.

### Configuration

`ecommerce/controller/configuration/{get,update}`. One row: `measurement_unit` (`mm, cm, m, in, ft, yd`), `weight_unit` (`kg, g, lb, oz`).

| Method | Path | req | codes |
|---|---|---|---|
| `GET` | `/configuration` | | 200 401 404 |
| `PATCH` | `/configuration` | | 200 400 401 |

### Stripe configuration

`ecommerce/controller/stripe/{get,update}`. Reads and writes six CRM instance-configuration rows and returns `account_id`, `pk_test_key`, `sk_test_key`, `pk_live_key`, `sk_live_key`, `livemode`. The GET returns the secret keys in clear.

| Method | Path | req | codes |
|---|---|---|---|
| `GET` | `/configuration/stripe` | | 200 401 404 |
| `PATCH` | `/configuration/stripe` | | 200 400 401 |

---

## Notes for the LLM consumer

- **`?format=json` on every request**, or the status is always 200.
- **Lists for cart items and cart discounts are at `/items`** and need `cart_uuid`.
- **Cart-discount update is `PUT /:id`** with the numeric id; its delete is by uuid; it has no single GET.
- **Bulk bodies are arrays**; responses are arrays with per-element errors.
- **Relations are dotted keys on write, nested objects on read**; custom fields likewise.
- **Four webhook events**, orders and quotes, create and update, one URL each.
- **Payments are records, not charges.** The Stripe outbound calls under `private/notifications/` have no V2 trigger in source.
- **105 controller aliases, all gated, all returning**; call them with `{% function %}` per [`patterns.md`](patterns.md).
