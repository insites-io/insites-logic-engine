# Assets Module

The Insites Assets module (machine name `insites_assets`, repo `module-v6-assets`, git tag v6.1.0) is the admin's file manager: upload files, put them in folders, tag and archive them, read storage reports. It wraps the platform's own asset records (`admin_assets` in every file under `private/graphql/`) and adds a V2 REST API for the same files and folders.

The platform-level `asset_url` filter, the file host and cache busting are a separate reference, [`../../assets/README.md`](../../assets/README.md), and are not repeated here.

Every source path below is relative to `pos/modules/insites_assets/` in `module-v6-assets` at tag v6.1.0, read on 9 October 2026.

## Where to look

| If you're… | Read |
|---|---|
| Building an external app that uploads, lists, archives or deletes assets | [`api.md`](api.md) |
| Calling the seven controllers from inside Liquid | [`patterns.md`](patterns.md) + [`../../building-on-insites/02-calling-a-controller.md`](../../building-on-insites/02-calling-a-controller.md) |
| Setting up upload restrictions in IIA, or wondering what the module seeds | [`configuration.md`](configuration.md) |
| Looking for the three-step upload or the curl flows | [`patterns.md`](patterns.md) |
| Hitting an edge | [`gotchas.md`](gotchas.md) |
| Hooks, partials other modules render, what it borrows from CRM | [`advanced.md`](advanced.md) |

## Surface at a glance

8 V2 pages under `private/views/pages/api/_external/v2/`, counted in module-v6-assets v6.1.0 on 9 October 2026, all under the `/asset/api/v2/...` prefix (singular `asset`).

| Resource | Operations | Notes |
|---|---|---|
| **Assets** | List, read one, create, delete, archive | Create registers a file you already put in the upload bucket. No update, no restore via API. |
| **Credentials** | Read | Presigned-POST form for the upload bucket; the first step of every upload. |
| **Folders** | Create, delete | Delete hard-deletes everything in the folder. |

Seven controller aliases back these pages (`assets/controller/assets/{list,get,create,delete,archive}`, `assets/controller/folders/{create,delete}`), each declared in `path:` front matter under `private/views/partials/controllers/_external/v2/`. They are listed under `module-v6-assets` in the [alias inventory](../../building-on-insites/reference/alias-inventory.md). The credentials page has no alias; it includes `controllers/credentials/get_details` by file path (see the defect in [`api.md`](api.md)).

A further 13 pages under `private/views/pages/api/` (slugs `insites/assets/...`) serve the admin UI only: edit, restore, the archive list, the all-assets list and three report endpoints. They carry `modules/insites_crm/insites_only_allowed_by_administrators` and have no API-key equivalent.

**Tables.** One schema, `private/schema/assets_upload.yml` (table `modules/insites_assets/assets_upload`: `uuid` string, `asset` upload), used to presign uploads. Asset records are platform assets, not rows here. One migration, `private/migrations/20251110103359_move_all_invalid_assets.liquid`.

**Module info.** `public/views/partials/lib/hooks/hook_module_info.liquid` reports `machine_name` `insites_assets`, `slug` `assets`, `version` `"6.1.0"`, which matches the git tag.

## Layout map

```
modules/assets/
├── README.md            ← you are here
├── api.md               ← the 8 V2 endpoints, params, responses, errors
├── configuration.md     ← IIA screens, upload restrictions, what deploy seeds
├── patterns.md          ← curl flows and {% function %} calls
├── gotchas.md           ← edges visible in source
└── advanced.md          ← hooks, shared partials, CRM dependencies
```

## Auth, in one sentence

All 8 V2 pages carry `authorization_policies: modules/insites_crm/has_valid_instance_api_authorization`, so send the raw instance API key as the `Authorization` header with no `Bearer` prefix, as in [`../../api/authentication.md`](../../api/authentication.md).

## Webhooks, in one sentence

**Assets fires no webhooks:** a grep for `webhook` across the module source finds nothing (9 October 2026); admin-UI controllers write to the CRM event stream, V2 controllers write nothing.
