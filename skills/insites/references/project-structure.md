# Project structure

**A project has two code trees, and both are valid. `app/` holds the site itself. `modules/<name>/` holds code you want to reuse or package.** A project can use either or both. This document covers what each directory holds, how paths resolve in each tree, and naming.

## High-level shape

```
project-root/
├── app/                          # The site itself
├── modules/                      # Code to reuse or package
│   ├── <module-a>/
│   │   ├── public/               # Callable from app/ and other modules
│   │   ├── private/              # Optional: internal to this module
│   │   └── test/                 # Module-level tests (optional)
│   └── <module-b>/
│       └── public/
├── package.json                  # (optional) Node.js dependencies
└── docs/                         # Optional human-facing documentation
```

`insites-cli sync` and `insites-cli deploy` read `app/` and `modules/` and nothing else. Either one is enough: the CLI stops only when neither exists. Module names are lowercase and used as a path prefix (`dashboard`, `website`, `portal`).

## Directory layout

`app/`, `modules/<name>/public/` and `modules/<name>/private/` share one layout. Public or private is your choice per file. Only create the directories you use.

```
app/                              # or modules/<name>/public/ or modules/<name>/private/
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
├── user.yml                      # Properties on the user record itself, e.g. roles (seen as app/user.yml)
├── user_profile_types/           # Custom user-profile schemas (e.g. crm_contact)
├── emails/                       # Email templates
│   └── autoresponders/
├── smses/                        # SMS templates (when used)
├── translations/                 # One YAML file per language (en.yml, de.yml)
├── migrations/                   # Data seeding and schema migrations
└── assets/                       # Static files
    ├── styles/
    ├── scripts/
    └── images/
```

## How paths resolve

A path with no prefix reads `app/`. A path that starts `modules/<name>/` reads that module's `public/` or `private/` tree. The rest of the path mirrors the directory under it.

### Render, function and include

| Call | Reads |
|---|---|
| `{% render 'account/profile_card' %}` | `app/views/partials/account/profile_card.liquid` |
| `{% render 'modules/dashboard/account/profile_card' %}` | `modules/dashboard/public/views/partials/account/profile_card.liquid` or `modules/dashboard/private/views/partials/account/profile_card.liquid` |
| `{% function r = 'modules/dashboard/account/get_user' %}` | the same two places, as `account/get_user.liquid` |

`{% include %}` resolves the same way.

### GraphQL

```liquid
{% graphql user = 'account/get_current_user' %}
{% graphql user = 'modules/dashboard/account/get_current_user' %}
```

The first resolves to `app/graphql/account/get_current_user.graphql`, the second to `modules/dashboard/public/graphql/account/get_current_user.graphql` (or `private/graphql/...`). The `<domain>/<operation>` shape under `graphql/` is convention; the platform does not enforce it.

### Layouts

`layout: application` reads `app/views/layouts/application.liquid`. `layout: modules/dashboard/dashboard_default` reads `modules/dashboard/public/views/layouts/dashboard_default.liquid` (or `private/views/layouts/...`).

### API calls

```liquid
{%- include 'modules/dashboard/events/track_login', payload: data -%}
```

Each `api_calls/<service>/<operation>.liquid` file describes one outbound HTTP call (URL, method, headers, body) plus optional Liquid for response handling. Callers `include` the file with parameters.

### Authorization policies

Pages reference policies in their front matter, by name for `app/` and with the module prefix for a module:

```liquid
---
slug: account/dashboard
authorization_policies:
  - require_login
  - modules/dashboard/is_user_logged_in
---
```

`require_login` is `app/authorization_policies/require_login.liquid`. `modules/dashboard/is_user_logged_in` is `modules/dashboard/public/authorization_policies/is_user_logged_in.liquid`. Each policy returns `true` or `false`. See the Authorization reference for the contract.

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
| Translation | language code `.yml` | `en.yml`, `de.yml` |

## Directories the skill once described that do not exist

Don't generate code at these paths, in either tree:

| Skill said | Reality |
|---|---|
| `app/lib/commands/<resource>/<action>.liquid` | No such directory in any reference repo. State-changing logic lives in `forms/<name>.liquid` `callback_actions` blocks instead. |
| `app/lib/queries/<name>.liquid` | No such directory. GraphQL files live at `app/graphql/<domain>/<operation>.graphql` or `modules/<name>/public/graphql/<domain>/<operation>.graphql` and are called directly from pages or forms. |
| `app/lib/validations/<name>.liquid` | No such directory. Field-level validation lives in form YAML `validation:` blocks; cross-field checks live inline in `callback_actions`. |
| `app/lib/helpers/<name>.liquid` | No such directory. Helpers are partials under `views/partials/` invoked via `{% function %}`. |

## Multi-module projects

A project can contain several modules with separate jobs. Common splits:

- **`website/`**: public marketing site
- **`dashboard/`**: signed-in user portal
- **`portal/`**: admin or staff interface
- **`ecommerce/`**, **`events/`**: feature add-ons

Modules are siblings, not nested. Each module's code is self-contained: a `website` page that wants to link into the dashboard does so by URL, not by including dashboard partials directly.

## Where this came from

The reference repos (`app-portal`, `app-seedling`, `addon-ecommerce`, `addon-events`) keep their code in `modules/`, and the v0 corpus audit (TW-26193603) aligned this page to them. On 9 October 2026 the page was corrected to say `app/` is equally valid: the public Codebase guide documents `app/`, the CLI reads both trees, and the partial, GraphQL and layout references above resolve paths in both.
