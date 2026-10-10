# Ecommerce — Advanced

Extension points, the public partials other code may render, and the module's cross-module dependencies in both directions. Source: module-v6-ecommerce v6.0.2 and the ten sibling v6 module trees, read on 9 October 2026. Paths are relative to `modules/insites_ecommerce/`.

---

## Module detection: `hook_module_info`

```
modules/insites_ecommerce/lib/hooks/hook_module_info
```

Source `public/views/partials/lib/hooks/hook_module_info.liquid`. It calls `modules/insites_crm/hook/get_implementations` to read its own `updated_at`, then returns `{ name: "Insites Ecommerce", machine_name: "insites_ecommerce", type: "module", version: "6.0.0", updated_at, slug: "ecommerce", label: "Ecommerce" }`. The version is hand-maintained and lags the tag (see [`gotchas.md#12`](gotchas.md)). Consume it; do not override it.

---

## Public partials

`public/views/partials/` is the only part of the module another module or app is meant to render. 15 files:

| Partial | Takes | Renders |
|---|---|---|
| `modules/insites_ecommerce/pdf_templates/tax_invoice` | `order_id` | an order as a tax invoice (`<page>` markup for the PDF renderer) |
| `modules/insites_ecommerce/pdf_templates/picking_slip` | `order_id` | picking slip for the same order |
| `modules/insites_ecommerce/pdf_templates/packaging_label` | `order_id` | packaging label, centred header |
| `modules/insites_ecommerce/pdf_templates/layout/{header,header_centered,title,footer,style,global_content_data}` | `heading` (title) | shared layout pieces the three templates include |
| `modules/insites_ecommerce/quote_templates/quote` | `query_params.payload.quote_uuid` | the quote PDF body (used by `controllers/quotes/pdf/create`) |
| `modules/insites_ecommerce/quote_templates/quote1` | same | the on-screen quote preview (used by `controllers/quotes/pdf/show`) |
| `modules/insites_ecommerce/quote_templates/layout/{header,footer,style}` | | shared quote layout |

Both template families read site-wide content through `modules/insites_cms/globals` (`quote.liquid`, `quote1.liquid`) or `modules/insites_cms/globals/get_global_content` (`pdf_templates/layout/global_content_data.liquid`). Rendering them on an instance without the CMS module will fail on that include.

The templates take an `order_id` (the numeric record id, passed to `modules/insites_ecommerce/orders/get_order`) and a quote `uuid` respectively. Override by shadowing the same path at app level; do not edit the module copies, which a module update replaces.

---

## Webhook receiver pattern

Four events, one URL each, registered in IIA (see [`configuration.md#webhooks`](configuration.md#webhooks)). The sender is `private/views/partials/functions/send_webhook.liquid` → `graphql/webhooks/send_webhook_api_call.graphql` → `private/api_calls/webhooks/send_webhook.liquid`, a `POST` with `Content-Type: application/json` and the record as body. There is no signature, no secret and no retry. The payload is the same shape the V2 GET for that resource returns, after `results_api` has nested `custom_field` and dropped `order_uuid`.

A receiver should answer 2xx quickly (the send is synchronous inside the write), de-duplicate on `uuid` + `updated_at`, and not trust the source without a shared secret of its own (for example a token in the registered URL's query string, which the module will echo back since it posts to the stored URL verbatim).

The admin screens fire the same events through a second path: `functions/orders/check_webhook.liquid` and `functions/quotes/check_webhook.liquid` re-read the record with `get_order_by_uuid_for_webhook` / `get_quote_by_uuid_for_webhook` before posting. The two paths produce the same shape; expect both.

---

## Event stream

Product, category and order writes from the admin screens append to the instance event stream: `functions/{products,categories,orders}/histories/*.liquid` build a payload (`module_source: "insites_ecommerce"`, `module_feature`, a description with admin links, a `log` object with the action and the record) and post it through `modules/insites_crm/_external/v1/event_stream/add_event`, authorising with `modules/insites_crm/functions/event_stream/get_api_key`. The module's own `private/api_calls/event_stream/{add_event,get_events}.liquid` post to `https://api.insites.io/v1/events`; a `TODO: update event stream endpoint` comment sits beside the call. The V2 API controllers do not write history; only the admin paths do. Read the stream through CRM: [`../crm/globals/event_streams.md`](../crm/globals/event_streams.md).

---

## Outbound dependencies (what ecommerce needs)

Counted by `grep -rho "modules/insites_[a-z_]+"` over the module on 9 October 2026, excluding self-references.

| Module | References | What for | Required? |
|---|---|---|---|
| `insites_crm` | 1,404 | every page's `layout: modules/insites_crm/json` and policy; `functions/response_handler`, `functions/_external/{results_api,payload_api,record_filter}`, `functions/{get_id,generate_sort}`; `crm_contact`, `crm_company`, `crm_address` tables for cart/order/quote contact and company lookups; `instance_configurations/*` for the Stripe keys; `users/get_current_user`; event stream; `hook/get_implementations` | Yes. Nothing in the module renders without it. |
| `insites_pipeline` | 25 | `related_records` join to `modules/insites_pipeline/opportunity` in every order and quote GraphQL file, surfacing `opportunity.uuid`; `get_opportunity_by_uuid.graphql` | Source shows no guard. Treat as required for orders and quotes. |
| `insites_stripe` | 25 | `modules/insites_stripe/set_constant` in the two gateway migrations (guarded on the registry); `modules/insites_stripe/shared/api_credentials` in all 15 payment notifications | Optional. The migrations skip when it is absent; the notifications would fail at include time if triggered. |
| `insites_payments` | 11 | log `type:` names in the notification callbacks (`modules/insites_payments/create_charge` and similar) | Only as a log label in source read; no partial from it is included. |
| `insites_cms` | 4 | `modules/insites_cms/globals` in the quote and PDF templates | Required to render the public templates. |
| `insites_databases` | 3 | `graphql/filters/get_data_source_{ids,users,uuids}` in `functions/filters/assign_filters.liquid` for admin list filters | Admin list filters only. |

The 15 files under `private/notifications/api_call_notifications/` (`capture_payment`, `create_account`, `create_card`, `create_customer`, `create_payment`, `create_person`, `create_refund`, `create_transfer`, `create_webhook_endpoint`, `delete_account`, `delete_credit_card`, `get_account`, `get_payout`, `get_persons`, `get_webhook_endpoints`) are outbound HTTPS calls to `https://api.stripe.com/v1/...` with `Authorization: Bearer {{ context.exports.payments.insites_key }}` and a `Stripe-Account` header. `private/views/partials/response_mapper/` holds the nine matching response mappers. Source does not show a V2 endpoint or controller that triggers them; the `payments` resource in the API records payments, it does not take them. For the measured working payment call, see [`../../payments/README.md`](../../payments/README.md).

---

## Inbound dependencies (who needs ecommerce)

Files in the sibling v6 module trees that reference `modules/insites_ecommerce`, counted on 9 October 2026:

| Module | Files | What they touch |
|---|---|---|
| `module-v6-events` | 17 | `order` table (most of the 32 `modules/insites_ecommerce/order` references), `product`, `category`, `order_item` |
| `module-v6-crm` | 13 | `order`, `quote`, `product`, `category` tables; `insites_menu/insites_ecommerce_{side_menu,settings}`; `insites_admin/insites_ecommerce_{dependencies,index_dependencies}` (the shell mounts the admin SPA through these) |
| `module-v6-pipelines` | 13 | `order`, `quote`, `functions/orders/get_orders`, `functions/generate_sort` |
| `module-v6-data` | 8 | `functions/response_handler`, `product`/`order`/`category` schema paths |
| `module-v6-forms` | 3 | `functions/response_handler` |
| `module-v6-cms` | 1 | `product` |
| `module-v6-api`, `module-v6-assets`, `module-v6-locator`, `module-v6-permissions` | 0 | |

What that makes a contract: the table names `order`, `order_item`, `quote`, `product`, `category`; the partials `functions/response_handler`, `functions/generate_sort`, `functions/orders/get_orders`; the four `insites_menu` / `insites_admin` partials; and the schema file paths `private/schema/{products/product,orders/order,category}.yml`, which the data module reads by path. Rename any of these only with the consumers in hand.

---

## Override points

- **PDF and quote templates**: shadow the public partial paths above at app level.
- **Webhook payload**: not configurable; `payload_schema` on the `webhook` table is stored but never read by `functions/send_webhook.liquid`.
- **Response handler**: the V2 controllers include CRM's handler, not the module's own `functions/response_handler.liquid`; override neither.
- **Admin list columns and filters**: per-administrator rows in the `*_column` and `*_filter` tables, written by the admin screens; four migrations wipe the column tables on deploy (see [`configuration.md`](configuration.md)).
- **Payload field mapping**: the `models/payload_fields.liquid` under each V2 controller folder maps dotted wire keys to storage keys (`"brand.uuid": "brand_uuid"` for products; `order.uuid`, `quote.uuid`, `product.uuid`, `contact.uuid`, `company.uuid` elsewhere) through `modules/insites_crm/functions/_external/payload_api`. This is where a new relation key would be added; it is module code and is replaced on update.

---

## What's intentionally not extensible

- **Endpoint set**: no app can add pages under `/ecommerce/api/v2/`; build your own resource in your app.
- **Auth**: instance API key only; the same policy on all 109 pages.
- **Event set**: four webhook events. For other events use the event stream.
- **Storefront**: none shipped; see [`../../payments/README.md`](../../payments/README.md) for the template repositories that build one on these tables.
