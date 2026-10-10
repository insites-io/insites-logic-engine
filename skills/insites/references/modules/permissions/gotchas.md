# Permissions — Gotchas

Edges visible in `modules/insites_permissions/` at module-v6-permissions v6.0.2 (read 9 October 2026). Each entry: **what bites**, **why**, **how to avoid**.

## 1. The name promises roles; the code manages profile schemas

**Bites:** looking for a roles or groups endpoint. **Why:** the four tables in `private/schema/` are declared and never queried; every controller works on `admin_user_profile_schemas`. The repo's own CLAUDE.md describes "role-based access control", which the Liquid does not implement. **Avoid:** treat this module as "Profiles"; enforcement lives in CRM's `authorization_policies`.

## 2. Four version strings, three values

**Bites:** reading the running version from the hook. **Why:** `hook_module_info` says `6.0.0`, the generated `insites_admin/*_dependencies.liquid` partials say v6.0.1, `vue/package.json` and the git tag say 6.0.2. **Avoid:** tag or Console changelog for the version; hook for presence only.

## 3. Protected profiles fail as a GraphQL error, not a refusal

**Bites:** a 400 with no explanation on edit, delete or contact removal. **Why:** the controllers blank the path or name for `modules/insites_*` and the three CRM types (two different lists, see [`api.md`](api.md)), then still run the mutation with a blank required argument. **Avoid:** check the name client-side; a 400 whose `errors` mention a missing variable is the protection firing.

## 4. `id` changes meaning across the contacts endpoints

**Bites:** emptying a profile when you meant to remove one contact. **Why:** `PATCH /profiles/contacts` reads `payload.id` as the **user** id; `DELETE /profiles/contacts` reads it as the **profile** id and only uses it for the event-stream link. The profile name in `payload.profile` drives both mutations.

## 5. The list runs one count query per row

**Bites:** slow profile lists. **Why:** `get_list.liquid` calls `count_contacts` once per profile to add `assigned_contacts`. **Avoid:** keep `size` small.

## 6. Event stream is an outbound HTTP call

**Bites:** writes succeed but the Event Stream tab is empty, or reads return 400. **Why:** events go through CRM's `api_calls/event_stream/add_event.liquid` and `get_events.liquid` to `https://api.insites.io/v1/events`, authorised by the instance configuration `event_stream_api_key`. `add_profile` also `{% log %}`s the call result under type `add_event`. **Avoid:** set the key before testing writes.

## 7. Profile paths only come from one folder

**Bites:** a profile created outside `modules/ins_profiles/public/user_profile_types/` never shows in the picker. **Why:** `get_profile_paths.graphql` filters on that prefix; the list endpoint, by contrast, shows every schema not under `modules/insites_`.

## 8. Two pages claim slug `api/401`

**Bites:** confusion over which 401 body serves. **Why:** `public/views/pages/api_401.html.liquid` here and CRM's `private/views/pages/system_pages/api_401.html.liquid` both declare `slug: api/401`. The permissions copy also names layout `modules/insites_crm/insites_empty`, which no v6 worktree contains on 9 October 2026. Source does not say which page the platform serves.

## 9. CRM calls a GraphQL file this module does not have

**Bites:** `GET /insites/core/contacts/:id/permissions` never works. **Why:** CRM's `get_contact_permissions.liquid` calls `modules/insites_permissions/contact_permissions/insites_get_contact_permissions`; this module's `private/graphql/` holds only `event_stream/` and `profiles/`. CRM returns 501 without the module and a GraphQL failure with it.

## 10. The three public policy partials guard nothing

**Bites:** editing `public/views/partials/api/ins_*_api_authorization_policy.liquid` expecting an effect. **Why:** each returns `true` and no page in this or any other v6 module references them (grep of all eleven worktrees, 9 October 2026).
