# CRM — Advanced

Extension and customization surfaces for the CRM module. The public surface is intentionally narrow — most "extending CRM" actually means *consuming* the V2 API (covered in [`api.md`](api.md) and [`patterns.md`](patterns.md)), not modifying CRM internals. This document covers the legitimate hooks: email layout overrides, webhook receivers, and module-detection.

---

## Overriding email layouts

CRM ships two public email layouts that other modules and your app can render:

| Layout | Purpose |
|---|---|
| `modules/insites_crm/external_email_layout` | Customer-facing emails (notifications to contacts) |
| `modules/insites_crm/internal_email_layout` | Admin-facing emails (notifications to instance staff) |

Reference them in your own email templates by the path above (or override them in your app by placing a same-named partial in your `app/views/layouts/`). Override resolution follows the standard Insites partial-shadowing rule: app-level files win over module-level files when paths match.

The CRM module's files are not in your repo, so shadowing is the only way to change a layout. Your own modules under `modules/` are yours to edit.

---

## Webhook receiver patterns

CRM fires four webhook events (see [`api.md`](api.md) Webhooks section). Subscribers register the destination URL in IIA at `<your-insites-instance>/admin/insites#/crm/webhooks`. The webhook delivery has a few configurable knobs:

| Property | Effect |
|---|---|
| `is_webhook_enabled` | Master switch per subscription |
| `webhook_url` | The destination URL Insites POSTs to |
| `payload_format` | Shape of the payload sent. Default is `full_object` (the entire resource as it was returned by the API on create/update). |

A receiver should:

1. **Idempotency.** Track the `evt_<id>` in the payload (or your own dedup key) and ignore duplicates. The CRM does not retry failed deliveries automatically as of this writing — but if it ever does, idempotency saves you.
2. **Authenticate the source.** The webhook subscription configuration in IIA is the only place to set up shared-secret HMAC verification (when supported by your subscription type). Before you trust a payload, verify it came from your instance.
3. **Reply quickly.** Respond `2xx` within a few seconds. Long synchronous work in a webhook handler will cause delivery timeouts on the Insites side. Queue the work, return fast.
4. **Handle the resource shape.** The default `full_object` payload shape mirrors the resource as returned by the V2 API GET endpoint — same fields, same nested object shapes for related records. Consume it the same way you would an API response.

For events not currently emitted (delete, archive/restore, sub-resource operations), you have two options: poll the affected resource's `updated_at` on a schedule, or hook into the V2 API at the call site of your own writes.

---

## Module detection — `hook_module_info`

CRM exposes one public hook partial for cross-module discovery:

```
modules/insites_crm/lib/hooks/hook_module_info
```

Rendering it returns a JSON object describing the module:

```json
{
  "name": "Insites Core",
  "machine_name": "insites_crm",
  "type": "module",
  "version": "6.1.2",
  "updated_at": "<timestamp>",
  "slug": "crm",
  "label": "CRM"
}
```

Other modules and apps use this to detect installed modules and gate behavior on the CRM being available. You should not override this partial — only consume it.

**The `version` field is not a release number.** Release tooling does not bump this partial, so it lags the module's git tag. Measured 5 October 2026 against the latest tags: `insites_cms`, `insites_assets`, `insites_ecommerce`, `insites_locator` and `insites_permissions` were tagged v6.0.2 while their hook still said `6.0.0`. Use the hook to answer *"is the module installed"*; for *"which version"*, read the git tag or the Console changelog.

**On v6 the CRM module is `insites_crm`, and `insites_core` is retired.** The hook moves to `modules/insites_crm/lib/hooks/hook_module_info`, and every `modules/insites_core/<table>` becomes `modules/insites_crm/<table>`. A v6 instance that lists **both** hooks has a leftover install of `insites_core` beside `insites_crm` (seen on a rehearsal instance on 5 October 2026: `insites_core` 6.0.0 beside `insites_crm` 6.1.2). Remove it with `insites-cli modules remove <env> insites_core`; the two modules sharing table names is not a supported state.

---

## Cross-module integration

Modules talk to CRM the same way an external app does — through the V2 REST API. There is no privileged in-process API for cross-module calls. This is intentional: the public V2 contract is the same regardless of caller, which means the CRM team can refactor internals without breaking integrators.

If you need to react to CRM events from another module, register a webhook (see *Webhook receiver patterns* above) — that is the supported integration boundary.

---

## What's intentionally not extensible

- **Schema** — contact and company schemas are fixed. To attach module-specific data, define **custom fields** in IIA (see [`configuration.md`](configuration.md)) rather than adding columns. Custom fields are stored in a separate properties record and don't pollute the core resource.
- **API endpoint set** — you cannot add new endpoints under `/crm/api/v2/` from your app. Build your own resource elsewhere (in your app or a separate module) if you need new API surface.
- **Auth model** — instance API key is the only auth at v2. Per-user, per-scope, or per-integration tokens are not currently supported. Audit access in your own application logic if needed.
- **Webhook event set** — you cannot define new event types. Use the event stream (see [`globals/event_streams.md`](globals/event_streams.md)) for arbitrary application events.
