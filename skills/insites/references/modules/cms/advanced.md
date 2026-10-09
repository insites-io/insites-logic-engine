# CMS — Advanced

Extension and customization surfaces for the CMS module. The legitimate hooks are layout/partial overrides, the `hook_module_info` partial for module detection, and partial-path aliasing.

For object-type field shapes see [`metadata.md`](metadata.md). For Liquid-side consumption see [`patterns.md`](patterns.md).

---

## Layout and partial overrides

Insites resolves `{% render %}`, `{% function %}`, and `layout:` references against multiple roots in order:

1. `app/views/...` (your app)
2. `modules/<name>/public/views/...` (module's public surface)
3. `modules/<name>/private/views/...` (module's private surface — internal only, not normally a fallback for app code)

The **first match wins**, so to override a module-supplied layout or partial, place a file at the same path under `app/`.

**Override examples:**

| Goal | Place file at |
|---|---|
| Override the default email layout | `app/views/layouts/external_email_layout.html.liquid` (matches `modules/insites_crm/public/views/layouts/external_email_layout.html.liquid`) |
| Override a CMS-provided header partial | `app/views/partials/shared/header.liquid` (matching whatever path the module ships) |
| Override `hook_module_info` for a custom module identification | Don't — see *hook_module_info* below |

**Don't edit files under `modules/`.** Module updates overwrite that tree wholesale; your changes are lost on the next deploy.

---

## Partial path aliases

A partial can declare a `path:` front-matter key that publishes it under an alias decoupled from its filesystem location. When `{% render "the/alias/path" %}` is invoked, Insites resolves to the partial whose `path:` matches — the actual file location is irrelevant.

**Example** (CRM V2 controller):

```liquid
---
path: crm/controller/contacts/get
---

{%- graphql results = '...' -%}
{# ... #}
{% return data %}
```

This file lives at `partials/controllers/_external/v2/contacts/get_contact.liquid` but is invoked as `{% render "crm/controller/contacts/get" %}`.

**When to use this:** when you want the include path to express *intent* (the controller for this resource action) rather than *location* (where the file happens to sit on disk). Used pervasively by the CRM V2 layer.

**Caveat:** path aliases make grep-based code navigation harder. If you can't find a referenced partial by direct path lookup, grep for the include string inside `path:` front-matter of partial files.

---

## `hook_module_info`

CMS exposes one public hook partial for cross-module discovery:

```
modules/insites_cms/lib/hooks/hook_module_info
```

Rendering it returns a JSON object describing the module:

```json
{
  "name": "Insites CMS",
  "machine_name": "insites_cms",
  "type": "module",
  "version": "<current>",
  "updated_at": "<timestamp>",
  "slug": "cms",
  "label": "CMS"
}
```

Other modules and apps consume this for "is CMS installed?" checks. Don't override it; only consume.

**The `version` field is not a release number.** Release tooling does not bump this partial, so it lags the module's git tag. Measured 5 October 2026 against the latest tags: `insites_cms`, `insites_assets`, `insites_ecommerce`, `insites_locator` and `insites_permissions` were tagged v6.0.2 while their hook still said `6.0.0`. Use the hook to answer *"is the module installed"*; for *"which version"*, read the git tag or the Console changelog.

---

## Email layout overrides

CMS uses two named email layouts that any outbound email can wrap with:

| Layout | Purpose |
|---|---|
| `external_email_layout` | Customer-facing emails. |
| `internal_email_layout` | Admin/internal notifications. |

These layouts are owned by the `insites_crm` module (not CMS), and the override path is on the core module — see [`../crm/advanced.md#overriding-email-layouts`](../crm/advanced.md). CMS-managed email *templates* (under `app/emails/...`) reference these layouts by the `layout:` front-matter key.

---

## Cross-module integration

Modules that need to render templated content (HTML emails, in-app pages) consume CMS-managed layouts and partials by name. There is no special privileged in-process API — the same `{% render %}` and `{% function %}` calls work the same regardless of caller.

If your module needs to react to CMS content changes, there is no webhook — see [`gotchas.md#12-cms-does-not-fire-webhooks`](gotchas.md). Watch git history (if you sync files to a repo) or log application-level events to the event stream.

---

## What's intentionally not extensible

- **The page rendering pipeline** — pages are controllers; you cannot insert new lifecycle hooks between fetch and render. Use partials for composition instead.
- **Front-matter schema** — the recognized front-matter keys per object type are platform-defined. Adding custom keys is silently ignored. Use the `metadata:` object for free-form key/value pairs at the page level.
- **Global Content schema** — the field set in `globals/global.yml` is platform-defined. To attach app-specific data, use the data module's user-definable databases instead of extending globals.
- **Authorization policy DSL** — policies are pure Liquid files returning truthy/falsy. There is no separate policy DSL; the language is just Liquid.
