# Permissions — Configuration

What an administrator does in IIA. Everything the module manages is a profile schema; there is no settings page, no environment variable and no instance configuration of its own.

## Install

Install `insites_permissions` with `insites-cli`. CRM then renders the Permissions menu and loads the SPA because its admin partials test `context.modules.insites_permissions` (CRM v6.1.2, `insites_admin/insites_side_menu_controller.liquid` and `insites_index_module_dependencies.liquid`). CRM is a hard dependency: the page policy, JSON layout, response handler and event-stream templates all come from it.

## IIA paths

Routes from `vue/src/router/permissions.js`; the side menu (`private/views/partials/insites_menu/insites_permissions_side_menu.liquid`) shows one item, **Profiles**. Groups and Secure Zones are commented out there.

| What | IIA path |
|---|---|
| Profiles list | `<your-insites-instance>/admin/insites#/permissions/profiles` |
| Add a profile (Details, then Fields) | `<your-insites-instance>/admin/insites#/permissions/profiles/add` |
| View a profile: Contacts (default tab) | `<your-insites-instance>/admin/insites#/permissions/profiles/:id` |
| Details / Fields / Event Stream tabs | `.../permissions/profiles/:id/details`, `/fields`, `/event-stream` |

## Creating a profile

The Details form (`vue/src/views/Permissions/Profiles/sections/Details/Details.vue`) snake-cases the profile name and builds the profile path as `modules/ins_profiles/<snake_name>`. The file-path picker is fixed to module `ins_profiles`, folder `user_profile_types`, extension `yml`, and lists existing paths from `GET /insites/permissions/profiles/paths`. The Fields tab builds `properties[]`; the save posts `payload.user_profile_schema` with `physical_file_path`, `metadata` and `properties` (see [`api.md`](api.md)). The data-sources and reference-fields endpoints exist to serve the Fields tab; the source does not say which field control consumes them.

## Event stream

The Event Stream tab and every write depend on CRM's instance configuration `event_stream_api_key` (`modules/insites_crm/functions/event_stream/get_api_key`). Without it the stream reads return 400 and writes still succeed but log nothing.

## What you cannot configure here

- **Roles, groups, secure zones, permission lists.** The four tables exist (see [`README.md`](README.md)) but no screen or endpoint touches them.
- **Insites-owned profiles.** Anything under `modules/insites_` is hidden from the list and refused by edit, delete and contact removal.
- **Who may use the module.** Access is the CRM administrator policy; there is no per-profile permission.
