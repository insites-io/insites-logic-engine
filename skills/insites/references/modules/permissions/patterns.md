# Permissions — Patterns

Worked HTTP examples against the admin endpoints in [`api.md`](api.md). Every request rides an administrator session cookie; there is no API-key form. Bodies and params below are the ones the controllers read in `private/views/partials/controllers/profiles/` (module-v6-permissions v6.0.2, 9 October 2026). Response bodies are the raw GraphQL result, so the top-level key is `items`.

## 1. Find a profile by name

```http
GET /insites/permissions/profiles?page=1&size=10&field=Profile%20Name&search=vendor&sort=Last%20Updated&order=DESC HTTP/1.1
```

`field` must be `Profile Name` (matches `metadata.label`) or `Schema Name` (matches `parameterized_name`); any other value is ignored and the search does nothing. Each row carries `assigned_contacts`, counted per row.

```json
{ "items": { "total_entries": 1, "results": [ { "id": 1, "name": "modules/ins_profiles/vendor", "schema_name": "modules/ins_profiles/vendor", "physical_file_path": "modules/ins_profiles/public/user_profile_types/vendor.yml", "metadata": { "label": "Vendor" }, "assigned_contacts": 3 } ] } }
```

## 2. Read a profile, then the contacts holding it

```http
GET /insites/permissions/profiles/1 HTTP/1.1
```

Take `items.results[0].name` and pass it as `schema_name`:

```http
GET /insites/permissions/profiles/contacts?schema_name=modules/ins_profiles/vendor&page=1&size=50&sort=Name&order=ASC HTTP/1.1
```

Rows are `id`, `date_added`, `updated_at`, `email`, `name`. Filter by `field=Email&search=@example.com` or `field=Contact%20Name&search=jane`.

## 3. Create a profile

```http
POST /insites/permissions/profiles HTTP/1.1
Content-Type: application/json

{ "payload": { "user_profile_schema": {
    "physical_file_path": "modules/ins_profiles/public/user_profile_types/vendor.yml",
    "metadata": { "label": "Vendor" },
    "properties": [ { "name": "category", "attribute_type": "string" } ] } } }
```

Expect 201 and the created schema. The event stream gets an `add_profile` entry linking the administrator and the new profile.

## 4. Remove one contact, or every contact, from a profile

```http
PATCH /insites/permissions/profiles/contacts HTTP/1.1
Content-Type: application/json

{ "payload": { "id": "<user id>", "profile": "modules/ins_profiles/vendor" } }
```

```http
DELETE /insites/permissions/profiles/contacts HTTP/1.1
Content-Type: application/json

{ "payload": { "id": "1", "label": "Vendor", "profile": "modules/ins_profiles/vendor" } }
```

`id` means the **user** on `PATCH` and the **profile** on `DELETE`. Only the `DELETE` writes an event (`empty_profile`). Passing `modules/insites_crm/crm_contact` or any `modules/insites_` name returns 400 with GraphQL errors.

## 5. Checking a profile from Liquid

This module ships no partial or alias for "does this user hold profile X". The only in-source model is `private/graphql/profiles/count_contacts.graphql`, which queries `users` with `filter: { profiles: { name: $profile } }`. Write your own GraphQL file on that shape; nothing under `modules/insites_permissions/` is callable from Liquid ([alias inventory](../../building-on-insites/reference/alias-inventory.md)). Over HTTP, the CRM v2 contact endpoints return non-Insites profiles under `profiles` ([`../crm/gotchas.md`](../crm/gotchas.md) section 6).

## What is intentionally not here

- Assigning a profile to a contact: that is CRM's `POST /crm/api/v2/contacts/:contact_uuid/profiles` ([`../crm/api.md`](../crm/api.md)).
- Roles, groups, secure zones: no endpoint exists.
- Webhooks: none fire.
