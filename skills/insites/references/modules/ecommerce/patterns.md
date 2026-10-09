# Ecommerce — Patterns

Worked examples against the V2 REST API and the same operations as in-Liquid `{% function %}` calls. Conventions (auth, envelope, dotted keys, error shape) are in [`api.md`](api.md). The calling rules for controllers are in [`02-calling-a-controller.md`](../../building-on-insites/02-calling-a-controller.md); the facts that matter here, checked in module-v6-ecommerce v6.0.2 on 9 October 2026, are that **all 105 ecommerce controllers gate their response handler on `context.params.format == 'json'` and all 105 return a value**, so a `{% function %}` call from an HTML page is safe as long as you do not pass `format=json` through.

The curl examples omit the host. Add `-H "Authorization: <instance api key>"` to every one; there is no `Bearer` prefix.

---

## 1. Find a product, then its variants

```bash
curl -G "/ecommerce/api/v2/products" \
  --data-urlencode "search_by=sku" --data-urlencode "keyword=TSHIRT-XYZ" \
  --data-urlencode "size=1" --data-urlencode "format=json"
```

`results[0].uuid` is the product. Variants are a separate resource filtered by search, not nested:

```bash
curl -G "/ecommerce/api/v2/product-variants" \
  --data-urlencode "search_by=product_uuid" --data-urlencode "keyword=<product uuid>" \
  --data-urlencode "format=json"
```

The same two reads from Liquid (`product/list` reads `search_by`, `keyword`, `page`, `size`, `sort_by`, `sort_order` from the `params` hash; `product/get` takes `uuid`):

```liquid
{%- parse_json q -%}{ "search_by": "sku", "keyword": "TSHIRT-XYZ", "size": 1 }{%- endparse_json -%}
{%- function products = "ecommerce/controller/product/list", params: q -%}
{%- function product = "ecommerce/controller/product/get", uuid: products.results[0].uuid -%}
{{ product.product_name }} {{ product.effective_price }}
```

---

## 2. Build a cart for a known contact

Create the cart with dotted relation keys, then add lines by reference only. Prices are not stored on the cart item; they resolve from the product and variant on read (`insites_api/external_api/cart_items/add_cart_item.liquid`).

```bash
curl -X POST "/ecommerce/api/v2/carts?format=json" -H "Content-Type: application/json" \
  -d '{ "contact.uuid": "<crm contact uuid>", "session_id": "sess-123" }'
```

The controller checks that `contact.uuid` (and `company.uuid`, if sent) exists in CRM and returns `400 invalid_contact` / `invalid_company` otherwise. Then:

```bash
curl -X POST "/ecommerce/api/v2/cart-items?format=json" -H "Content-Type: application/json" \
  -d '{ "cart_uuid": "<cart uuid>", "product_uuid": "<product uuid>", "product_variant_uuid": "<variant uuid>", "quantity": 2 }'
```

Read the cart's lines (the list path is `/items`, and `cart_uuid` is required):

```bash
curl -G "/ecommerce/api/v2/cart-items/items" --data-urlencode "cart_uuid=<cart uuid>" --data-urlencode "format=json"
```

In Liquid, on a page that already knows the signed-in contact:

```liquid
{%- parse_json cart_params -%}{ "contact.uuid": {{ contact_uuid | json }}, "session_id": {{ session_id | json }} }{%- endparse_json -%}
{%- function cart = "ecommerce/controller/cart/create", params: cart_params -%}
{%- parse_json line -%}{ "cart_uuid": {{ cart.uuid | json }}, "product_uuid": {{ product_uuid | json }}, "quantity": 1 }{%- endparse_json -%}
{%- function item = "ecommerce/controller/cart_items/create", params: line -%}
{%- parse_json list_q -%}{ "cart_uuid": {{ cart.uuid | json }} }{%- endparse_json -%}
{%- function lines = "ecommerce/controller/cart_items/list", params: list_q -%}
```

`cart_items/create` returns `400 missing_cart_uuid` when the cart is absent; check `item.errors` before trusting `item.uuid`.

---

## 3. Apply a discount code to a cart

Look the code up first; the endpoint returns `404 no_discount` for an unknown code and `400 missing_discount_code` for an empty one.

```bash
curl -G "/ecommerce/api/v2/discounts/by-code/SPRING10" --data-urlencode "format=json"
```

Then attach a snapshot of it to the cart. `cart_uuid` is the only required field; the rest copies what the discount said so a later change to the discount does not change the cart:

```bash
curl -X POST "/ecommerce/api/v2/cart-discounts?format=json" -H "Content-Type: application/json" \
  -d '{ "cart_uuid": "<cart uuid>", "discount_uuid": "<discount uuid>", "discount_name": "Spring", "discount_code": "SPRING10", "discount_type": "percentage", "discount_value": 10 }'
```

Liquid (`discount/by_code` takes `discount_code` as a named argument):

```liquid
{%- function discount = "ecommerce/controller/discount/by_code", discount_code: code -%}
{%- if discount.errors == blank -%}
  {%- parse_json cd -%}{ "cart_uuid": {{ cart_uuid | json }}, "discount_uuid": {{ discount.uuid | json }}, "discount_name": {{ discount.discount_name | json }}, "discount_code": {{ discount.discount_code | json }}, "discount_type": {{ discount.discount_type | json }}, "discount_value": {{ discount.discount_value | json }} }{%- endparse_json -%}
  {%- function applied = "ecommerce/controller/cart_discounts/create", params: cd -%}
{%- endif -%}
```

---

## 4. Place an order with its lines in one pass

An order carries its own billing and shipping snapshot (90-odd optional fields; none required). Lines go in a second call to the bulk endpoint, which takes an array where each element needs `order.uuid`, `order_item_name`, `quantity` and `unit_price`.

```bash
curl -X POST "/ecommerce/api/v2/orders?format=json" -H "Content-Type: application/json" \
  -d '{ "order_contact.uuid": "<contact uuid>", "order_status": "pending", "currency": "AUD", "shipping_address_1": "1 Example St", "shipping_city": "Sydney", "shipping_country_code": "AU", "custom_field.po_number": "PO-778" }'
```

```bash
curl -X POST "/ecommerce/api/v2/order-items/bulk?format=json" -H "Content-Type: application/json" \
  -d '[ { "order.uuid": "<order uuid>", "product.uuid": "<product uuid>", "order_item_name": "Basic Cotton T-Shirt", "sku": "TSHIRT-XYZ", "quantity": 2, "unit_price": 29.99 } ]'
```

Creating the order fires the `order_created` webhook (if one is registered and enabled) before the HTTP response returns; adding lines fires nothing. Re-read the order afterwards: the totals migrations and the edit controller recompute `order_total` from the lines, the create call does not know them yet.

```bash
curl -G "/ecommerce/api/v2/orders/<order uuid>" --data-urlencode "format=json"
```

---

## 5. Convert a quote into an order (admin only)

The API has no quote-to-order endpoint. The conversion lives in the admin controller `private/views/partials/controllers/quotes/to_order/quote_to_order.liquid`, reached from the quote screen in IIA, and it fires `order_created` on completion. Over the API, the equivalent is pattern 4 with `quote.uuid` set on the new order so the link is kept:

```bash
curl -X POST "/ecommerce/api/v2/orders?format=json" -H "Content-Type: application/json" \
  -d '{ "quote.uuid": "<quote uuid>", "order_contact.uuid": "<contact uuid>", "order_status": "pending" }'
```

---

## 6. Record a payment against an order

The `payments` resource stores what happened; it does not charge a card. `order.uuid` and `amount` are required.

```bash
curl -X POST "/ecommerce/api/v2/payments?format=json" -H "Content-Type: application/json" \
  -d '{ "order.uuid": "<order uuid>", "amount": 59.98, "currency": "AUD", "status": "Paid", "source": "stripe", "payment_gateway_name": "stripe", "card_brand": "visa", "card_last_four_digits": "4242", "date_time": "2026-10-09T03:00:00Z" }'
```

The status words the schema comment lists for `payment.yml` are `Paid, Part Paid, Pending Funds, No Charge, Waived Fees, Unpaid, Declined, Failed, Refunded, Other`. The controller does not validate against them. For taking the money, see [`../../payments/README.md`](../../payments/README.md).

---

## 7. Drain a list

Every list returns `{ total_entries, total_pages, page, size, results }`. Loop `page` to `total_pages`; the default `size` is 10 and the controllers coerce `size` and `page` with `times: 1`, so non-numeric values become 0.

```bash
for p in 1 2 3; do
  curl -G "/ecommerce/api/v2/orders" --data-urlencode "page=$p" --data-urlencode "size=100" \
    --data-urlencode "sort_by=updated_at" --data-urlencode "sort_order=DESC" --data-urlencode "format=json"
done
```

---

## 8. Keep an HTML page from being hijacked

Because every controller reads `context.params.format`, a visitor can append `?format=json` to any page that passes `context.params` straight through, and the controller will set a JSON `Content-Type` on your HTML. Build the hash yourself:

```liquid
{%- parse_json q -%}
  { "page": {{ context.params.page | default: 1 | plus: 0 }}, "size": 24, "sort_by": "product_name", "sort_order": "ASC" }
{%- endparse_json -%}
{%- function catalogue = "ecommerce/controller/product/list", params: q -%}
```

This is the same rule as for CRM; the difference from the data module (whose controllers are ungated) does not apply here.

---

## What's intentionally not here

- **Custom-field definition creation**: admin only (`#/ecommerce/custom-fields/<type>/configuration`); the API lists and deletes.
- **PDFs** (tax invoice, picking slip, packaging label, quote): admin controllers and public partials; see [`advanced.md`](advanced.md).
- **Order export**: `insites/ecommerce/orders/export`, an admin page.
- **The Stripe calls** under `private/notifications/`: no API endpoint triggers them in source.
- **v1 endpoints** under the un-versioned `_external/*` folders.
