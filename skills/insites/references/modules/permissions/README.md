# Permissions Module

The Insites Permissions module (machine name `insites_permissions`, repo `module-v6-permissions`, git tag v6.0.2) manages **profiles**: the platform's user profile schemas that the admin assigns to CRM contacts. Despite the name, on v6 it holds no roles, groups or permission lists that anything reads. It creates, edits and deletes profile schemas, lists the contacts that hold one, removes contacts from one, and writes each change to the event stream.

Source: `modules/insites_permissions/` at master `fc4c3dc` (tag v6.0.2 plus two release-workflow commits that touch nothing in the module tree). Counts are as counted in module-v6-permissions v6.0.2 on 9 October 2026.

## Where to look

| If you're… | Read |
|---|---|
| Calling the admin endpoints (list, create, edit, delete profiles, contacts, event stream) | [`api.md`](api.md) |
| Setting up profiles in IIA | [`configuration.md`](configuration.md) |
| Looking for worked HTTP examples | [`patterns.md`](patterns.md) |
| Hitting an edge | [`gotchas.md`](gotchas.md) |
| Hooks, partials other modules render, what it borrows from CRM | [`advanced.md`](advanced.md) |
| How CRM filters profiles on its own API | [`../crm/gotchas.md`](../crm/gotchas.md) section 6, [`../crm/schema.md`](../crm/schema.md) "Contact Profiles" |

## Admin API only

12 page files under `private/views/pages/api/profiles/`, all on `insites/permissions/...` slugs and all guarded by `modules/insites_crm/insites_only_allowed_by_administrators`. No `_external/` directory, no v2 surface, no instance-API-key route, and **no controller aliases** ([alias inventory](../../building-on-insites/reference/alias-inventory.md)), so nothing in it is callable by alias from Liquid.

## Surface at a glance

| Resource | Operations | Backed by |
|---|---|---|
| **Profiles** | List, read one, create, update, delete, list file paths | `admin_user_profile_schemas` queries and `admin_user_profile_schema_*` mutations in `private/graphql/profiles/` |
| **Profile contacts** | List, remove one, remove all | `users` query, `user_profile_delete`, `user_profiles_delete_all` |
| **Data sources / reference fields** | Read | `admin_tables` query |
| **Event stream** | Read per profile | CRM's `get_events` API call template |

Total: 12 endpoints, 14 GraphQL files, 12 controller partials.

## Tables

Four schema files in `private/schema/`: `insites_admin_roles`, `insites_groups`, `insites_permissions_list` and `insites_history_logs`. No GraphQL file, partial or Vue file in the repo reads or writes any of them. The CHANGELOG records that v5.2.0 (18 December 2023) removed Secure Zones and Groups; the tables stayed.

## Who consumes it

Grep of the other ten v6 worktrees on 9 October 2026 for `insites_permissions`, `ins_permission_manager` and `ins_profiles`:

- **CRM** renders the side menu and SPA loader when `context.modules.insites_permissions` is set (`insites_admin/insites_side_menu_controller.liquid`, `insites_module_dependencies.liquid`, `insites_index_module_dependencies.liquid`).
- **CRM** reads `modules/insites_permissions/insites_groups` in `graphql/contacts/get_contacts_groups.graphql` (slug `insites/core/contacts/groups`). Nothing in this module writes that table.
- **CRM** `controllers/contacts/get_contact_permissions.liquid` calls `modules/insites_permissions/contact_permissions/insites_get_contact_permissions`, a GraphQL file this module does not ship; CRM returns 501 when the module is absent.
- **CRM** v2 contact controllers keep profiles not under `modules/insites_crm/`; their comments say `modules/ins_permission_manager/*`, but this module writes under `modules/ins_profiles/` (see `advanced.md`).
- **CMS** migration `20220428012358_system_api_endpoints_v5.0.0.liquid` names the v5 table `modules/insites_permission_manager/insites_permissions_list`.
- api, assets, data, ecommerce, events, forms, locator, pipelines: no references.

## hook_module_info

`public/views/partials/lib/hooks/hook_module_info.liquid` returns `machine_name: insites_permissions`, `version: "6.0.0"`. Release tooling does not bump it, so it lags the v6.0.2 tag ([`../crm/advanced.md`](../crm/advanced.md) records the same lag). Use the hook for "is it installed", the tag for "which version".

## Layout map

```
modules/permissions/
├── README.md            ← you are here
├── api.md               ← 12 admin endpoints + the GraphQL behind them
├── configuration.md     ← IIA walkthrough
├── patterns.md          ← worked HTTP examples
├── gotchas.md           ← edges visible in source
└── advanced.md          ← hook, partials, CRM dependencies
```

## Auth, in one sentence

Every endpoint needs a signed-in administrator session (`insites_only_allowed_by_administrators`, which reads `sessions/current_user_authorization` and requires `administrator.status == "active"`); the instance API key is not accepted anywhere in this module. Platform-level auth: [`../../authentication/README.md`](../../authentication/README.md).

## Webhooks, in one sentence

**Permissions fires no webhooks.** Create, update, delete and empty-profile each post one event to the event stream through CRM's `add_event` API call template; read it back with the per-profile event-stream endpoint.
