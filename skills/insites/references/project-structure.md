# Project structure

Detailed reference for the canonical Combinate project layout. Insites projects organise code by **module**, not by a flat root layout. This document covers what each directory holds, naming conventions, and the cross-cutting rules.

## High-level shape

```
project-root/
├── app.yml                       # Project-level configuration
├── package.json                  # (optional) Node.js dependencies
├── package-lock.json
├── docs/                         # Optional human-facing documentation
└── modules/
    ├── <module-a>/
    │   ├── public/               # Everything reachable by other modules / runtime
    │   ├── private/              # Optional: internal to this module (same layout as public/)
    │   └── test/                 # Module-level test fixtures (optional)
    └── <module-b>/
        ├── public/
        └── test/
```

Each project has at least one module. Examples seen in real Combinate projects: `dashboard`, `website`, `portal`, `ecommerce`, `events`. Module names are lowercase, hyphenless, and used as a path prefix throughout the codebase.

## Per-module layout

Every `modules/<name>/public/` follows this structure, and `modules/<name>/private/` uses the same layout when you want a file kept internal to the module. Public vs private is your choice per file. Only directories that the module actually uses appear — there's no requirement to create empty ones.

```
modules/<name>/public/
├── views/
│   ├── pages/                    # Routed Liquid pages (URL-addressable controllers)
│   ├── layouts/                  # Page wrappers (e.g. dashboard_default, portal_form)
│   └── partials/                 # Reusable HTML/data snippets
├── forms/                        # Form definitions (YAML + Liquid callback_actions)
├── graphql/                      # Queries + mutations grouped by domain
│   ├── <domain-a>/
│   └── <domain-b>/
├── authorization_policies/       # Access control rules referenced by pages
├── api_calls/                    # Third-party API integrations grouped by service
│   ├── <service-a>/
│   └── <service-b>/
├── schema/                       # Database table definitions (YAML)
├── user_profile_types/           # Custom user-profile schemas (e.g. crm_contact)
├── emails/                       # Email templates
│   └── autoresponders/
├── smses/                        # SMS templates (when used)
├── migrations/                   # Data seeding and schema migrations
└── assets/                       # Module-scoped static files
    ├── styles/
    ├── scripts/
    └── images/
```

## Path conventions for module-aware code

Every render, include, and graphql call uses a module-prefixed path. The first segment is the module name; subsequent segments mirror the directory structure under `modules/<name>/public/`.

### Render and include

```liquid
{% render 'modules/dashboard/account/profile_card' %}
{% include 'modules/dashboard/shared/header' %}
```

The platform's partial-resolution rule looks up `modules/<name>/public/views/partials/<remainder>.liquid`.

### GraphQL

```liquid
{% graphql user = 'modules/dashboard/account/get_current_user' %}
```

Resolves to `modules/dashboard/public/graphql/account/get_current_user.graphql`. The `<domain>/<operation>` shape under `graphql/` is convention; the platform doesn't enforce a specific domain-grouping but every reference repo uses it.

### API calls

```liquid
{%- include 'modules/dashboard/events/track_login', payload: data -%}
```

Each `api_calls/<service>/<operation>.liquid` file describes one outbound HTTP call (URL, method, headers, body) plus optional Liquid for response handling. Callers `include` the file with parameters.

### Authorization policies

Pages reference policies by full path in their front-matter:

```liquid
---
slug: account/dashboard
authorization_policies:
  - modules/dashboard/is_user_logged_in
---
```

Each policy file at `modules/<name>/public/authorization_policies/<policy>.liquid` returns truthy/falsy. See the Authorization reference for the contract.

## File naming

| Type | Pattern | Example |
|---|---|---|
| Page | snake_case `.liquid` | `sign_in.liquid`, `forgot_password.liquid` |
| Layout | snake_case, namespaced by module | `dashboard_default.liquid`, `portal_form.liquid` |
| Partial | snake_case `.liquid`, no leading underscore | `account_card.liquid` (NOT `_account_card.liquid`) |
| Form | snake_case `.liquid` | `update_password.liquid` |
| GraphQL | snake_case `.graphql`, grouped by domain | `account/get_user.graphql` |
| Schema | snake_case `.yml`, one type per file | `crm_contact.yml`, `crm_address.yml` |
| Authorization policy | snake_case `.liquid` | `is_user_logged_in.liquid`, `is_admin.liquid` |
| Migration | timestamp-prefixed `.liquid` | `20260101120000_add_user_status.liquid` |
| Email | snake_case `.liquid`, optionally under `autoresponders/` | `welcome.liquid`, `autoresponders/forgot_password.liquid` |

## Patterns the existing skill historically described that DON'T exist in canonical Combinate

These were sourced from the underlying platform's generic docs and don't appear in real Combinate projects. Don't generate code at these paths:

| Skill said | Reality |
|---|---|
| `app/lib/commands/<resource>/<action>.liquid` | No such directory in any reference repo. State-changing logic lives in `forms/<name>.liquid` `callback_actions` blocks instead. |
| `app/lib/queries/<name>.liquid` | No such directory. GraphQL files live at `modules/<name>/public/graphql/<domain>/<operation>.graphql` and are called directly from pages or forms. |
| `app/lib/validations/<name>.liquid` | No such directory. Field-level validation lives in form YAML `validation:` blocks; cross-field checks live inline in `callback_actions`. |
| `app/lib/helpers/<name>.liquid` | No such directory. Helpers are partials at `modules/<name>/public/views/partials/<helper>.liquid` invoked via `{% function %}`. |
| Flat `app/views/...` layout at project root | Real layout is `modules/<name>/public/views/...`. The flat structure is the underlying platform's generic convention; Combinate has always used the modules-based layout. |

## Multi-module projects

A project can contain multiple modules with non-overlapping responsibilities. Common splits:

- **`website/`** — public marketing site
- **`dashboard/`** — authenticated user portal
- **`portal/`** — admin / staff interface
- **`ecommerce/`**, **`events/`** — feature add-ons

Modules are siblings, not nested. Each module's code is self-contained: a `website` page that wants to link into the dashboard does so by URL, not by including dashboard partials directly.

## Where this convention came from

The modules-based layout reflects how the team actually builds Combinate products in `app-portal`, `app-seedling`, `addon-ecommerce`, and `addon-events`. The previous skill content described a flat `app/views/...` layout sourced from the underlying platform's generic docs; the v0 corpus audit (logged as TW-26193603) found this didn't match real production code, and the rewrite aligned the skill to reality.
