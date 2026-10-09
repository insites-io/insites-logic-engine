# Ecommerce Module

The Insites Ecommerce module (machine name `insites_ecommerce`, repo `module-v6-ecommerce`) holds the tables a shop needs and the admin screens to manage them: products with variants and variant options, categories, carts with cart items and cart discounts, quotes and orders with their line items, discounts and shipping packages, payments, freight suppliers, custom and system fields, webhooks and a per-instance configuration row. It exposes a V2 REST API for all of these and renders its admin UI inside IIA.

It does not ship a storefront. How a project shows its catalogue, builds a cart and takes payment is the project's decision; the starting points are listed in [`../../payments/README.md`](../../payments/README.md), which also covers the payment call itself. This reference covers the module's own surface.

## Where to look

| If you're… | Read |
|---|---|
| Building an external app that calls the ecommerce API | [`api.md`](api.md) |
| Calling the module's controllers from inside Liquid | [`patterns.md`](patterns.md) + [`../../building-on-insites/02-calling-a-controller.md`](../../building-on-insites/02-calling-a-controller.md) |
| Setting the module up in IIA, or wondering what a deploy migrates | [`configuration.md`](configuration.md) |
| Looking for worked curl and `{% function %}` examples | [`patterns.md`](patterns.md) |
| Hitting an API edge or a naming surprise | [`gotchas.md`](gotchas.md) |
| Rendering the module's PDF templates, reading its hook, or depending on its tables from another module | [`advanced.md`](advanced.md) |
| Taking payment | [`../../payments/README.md`](../../payments/README.md) |

## V2 REST API is the supported surface

The module exposes a V2 REST API at `/ecommerce/api/v2/...`. Counted in module-v6-ecommerce v6.0.2 on 9 October 2026: **109 pages** under `private/views/pages/api/_external/v2/`, every one a `.liquid` page whose body is a single `{% include %}` of a controller alias.

Beside `v2/` sit nine un-versioned folders (`brands`, `categories`, `discounts`, `instance_configurations`, `order_items`, `orders`, `payments`, `products`, `quotes`) holding 47 more pages. 45 of them answer on `ecommerce/api/v1/...` slugs; two (`orders/cart_items/get.liquid`, `orders/export.liquid`) answer on `insites/ecommerce/orders/...` admin slugs. These are the legacy v1 surface, behind the same API-key policy. They are not documented here. `CHANGELOG.md` v6.0.2 (24 September 2026) records that CI waives the external-API versioning rule until these folders move under `v2/`.

The module also serves 191 admin pages under `private/views/pages/api/` outside `_external/`, gated by `modules/insites_crm/insites_only_allowed_by_administrators`. Those back the IIA screens and are not an API contract.

## Surface at a glance

| Resource | Path prefix | Operations | Notes |
|---|---|---|---|
| Products | `/products` | list, get, create, update, delete | `uuid` on the wire |
| Product variants | `/product-variants` | list, get, create, update, delete | belong to a product via `product.uuid` |
| Product variant options | `/product-variant-options` | list, get, create, update, delete | label + values per product |
| Categories | `/categories` | list, get, create, update, delete | `parent_category_uuids` array |
| Carts | `/carts` | list, get, create, update, delete | `contact.uuid`, `company.uuid`, `session_id` |
| Cart items | `/cart-items` | list, get, create, bulk create, update, delete | list is `/cart-items/items?cart_uuid=` |
| Cart discounts | `/cart-discounts` | list, create, update, delete | no single GET; update is `PUT /:id` (numeric) |
| Orders | `/orders` | list, get, create, update, delete | fires `order_created` / `order_updated` webhooks |
| Order items | `/order-items` | list, get, create, bulk create, update, delete | |
| Order discounts | `/order-discounts` | list, get, create, bulk create, update, delete | |
| Order shipping packages | `/order-shipping-packages` | list, get, create, update, delete | freight snapshot fields |
| Quotes | `/quotes` | list, get, create, update, delete | fires `quote_created` / `quote_updated` webhooks |
| Quote items | `/quote-items` | list, get, create, bulk create, update, delete | |
| Quote discounts | `/quote-discounts` | list, get, create, update, delete | |
| Quote shipping packages | `/quote-shipping-packages` | list, get, create, update, delete | |
| Discounts | `/discounts` | list, get, get by code, create, update, delete | `/discounts/by-code/:discount_code` |
| Payments | `/payments` | list, get, create, update, delete | records only; the gateway call is elsewhere |
| Freight suppliers | `/freight-suppliers` | list, get, create, update, delete | |
| Custom fields | `/custom-fields/{products,categories,orders}` | list, delete | numeric `:id`; creation is admin-only |
| System fields | `/system-fields` | list, get, create, update, delete | key/value/logo rows |
| Configuration | `/configuration` | get, update | `measurement_unit`, `weight_unit` |
| Stripe configuration | `/configuration/stripe` | get, update | gateway keys held in CRM instance configuration |

Total: 109 endpoints across 22 resources. Full method, path, policy, parameter and error detail is in [`api.md`](api.md).

## Controllers you can call from Liquid

Every V2 page delegates to a controller partial declared with a `path:` front matter under `private/views/partials/controllers/_external/v2/`. There are **105 controller aliases**, all of the short form `ecommerce/controller/<resource>/<verb>`. The full list is in the [alias inventory](../../building-on-insites/reference/alias-inventory.md#module-v6-ecommerce-105); do not copy it here. Ten are new on v6: the six `ecommerce/controller/cart_items/*` and four `ecommerce/controller/cart_discounts/*` aliases.

Two facts hold for all 105 (checked by grep on 9 October 2026): each gates its response handler on `context.params.format == 'json'`, and each ends in `{% return data %}`. The calling convention in [`02-calling-a-controller.md`](../../building-on-insites/02-calling-a-controller.md) therefore applies without exceptions; see [`patterns.md`](patterns.md) for calls.

## `hook_module_info`

`public/views/partials/lib/hooks/hook_module_info.liquid` returns:

```json
{ "name": "Insites Ecommerce", "machine_name": "insites_ecommerce", "type": "module", "version": "6.0.0", "slug": "ecommerce", "label": "Ecommerce" }
```

plus an `updated_at` read from the CRM hook registry. **The version lags the release.** The newest git tag is v6.0.2, `vue/package.json` says `6.0.2`, the generated admin dependency partials say `v6.0.1`, and the hook says `6.0.0`. Use the hook only to answer "is it installed".

## Tables

35 schema files under `private/schema/` define the tables `modules/insites_ecommerce/<name>`: `cart`, `cart_column`, `cart_discount`, `cart_filter`, `cart_item`, `category`, `category_filter`, `configuration`, `discount`, `discount_column`, `ecommerce_system_field`, `freight_supplier`, `freight_supplier_column`, `freight_supplier_filter`, `order_item`, `order`, `order_column`, `order_discount`, `order_filter`, `order_shipping_package`, `payment`, `payment_method`, `product`, `product_column`, `product_filter`, `product_variant`, `product_variant_option`, `quote`, `quote_column`, `quote_discount`, `quote_filter`, `quote_item`, `quote_pdf`, `quote_shipping_package`, `webhook`. The `*_column` and `*_filter` tables store per-administrator list preferences for the admin UI, not business data.

Three more tables are created at deploy time by migrations, not schema files: `modules/ins_ecommerce/public/schema/product_custom_field.yml`, `category_custom_field.yml` and `order_custom_field.yml` (`private/migrations/99990204443087..89_*`). Note the `ins_ecommerce` prefix; the custom-field controllers address them by that literal path. See [`configuration.md`](configuration.md) for the full migration list.

## Layout map

```
modules/ecommerce/
├── README.md            ← you are here
├── api.md               ← V2 REST endpoints, by resource
├── configuration.md     ← IIA admin paths, what a deploy seeds and migrates
├── patterns.md          ← curl and {% function %} worked examples
├── gotchas.md           ← naming oddities, id versus uuid, ungated edges
└── advanced.md          ← hook, public PDF templates, cross-module dependencies
```

## Auth, in one sentence

Every V2 page carries `authorization_policies: [modules/insites_crm/has_valid_instance_api_authorization]` in its front matter, so send the raw instance API key as the `Authorization` header with no `Bearer` prefix; the full reference is [`../../api/authentication.md`](../../api/authentication.md).

## Webhooks, in one sentence

The module fires four events, `order_created`, `order_updated`, `quote_created` and `quote_updated`, from the V2 order and quote create/update controllers and from the matching admin screens, to one URL per event registered in the `webhook` table through IIA; delivery is a plain `POST` of the API-shaped record with a `Content-Type: application/json` header and nothing else (`private/api_calls/webhooks/send_webhook.liquid`). Nothing fires on delete, on any line-item or discount change, or on carts, products or payments. Detail in [`api.md#webhooks`](api.md#webhooks).
