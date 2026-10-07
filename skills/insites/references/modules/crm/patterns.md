# CRM — Patterns

Worked examples for the most common multi-step flows against the CRM V2 REST API. **HTTP examples only.** For in-Liquid use, see [`../../api/calling-from-liquid.md`](../../api/calling-from-liquid.md) — the same operations are reachable from inside Insites without an HTTP round-trip.

For conventions (auth, response shape, dotted-path nested references, list envelope), see [`api.md`](api.md). Auth header is `Authorization: instance_<token>` — no `Bearer` prefix — and is omitted from the snippets below for brevity.

---

## 1. Create a contact, then add an address

A new contact is registered with a single `POST /contacts`. Addresses are a separate resource — once you have the contact UUID, attach addresses with `POST /contacts/addresses`.

```http
POST /crm/api/v2/contacts?format=json HTTP/1.1
Content-Type: application/json

{
  "first_name": "Jane",
  "last_name": "Smith",
  "email": "jane.smith@example.com",
  "company.uuid": "abcdef12-3456-7890-abcd-ef1234567890"
}
```

Returns `201` with the new contact (including `uuid`). Then:

```http
POST /crm/api/v2/contacts/addresses?format=json HTTP/1.1
Content-Type: application/json

{
  "contact.uuid": "<new-contact-uuid>",
  "address_label": "Primary Office",
  "street_1": "123 Market St",
  "city": "San Francisco",
  "country": "US"
}
```

The `contact.uuid` dotted key links the address to the contact you just created. The address resource follows the same conventions as the parent (UUID-keyed, dotted nested references, `created_at` / `updated_at` on the response).

---

## 2. Set and read custom-field values

Custom fields are **defined** in IIA (see [`configuration.md`](configuration.md)) and **valued** via the contact/company endpoints using the dotted-path key style.

Set values when creating or updating:

```http
PATCH /crm/api/v2/contacts/<uuid>?format=json HTTP/1.1
Content-Type: application/json

{
  "custom_field.region": "EMEA",
  "custom_field.lifecycle_stage": "qualified"
}
```

Read values from any GET response — they come back nested:

```json
{
  "uuid": "<uuid>",
  "first_name": "Jane",
  "custom_field": {
    "region": "EMEA",
    "lifecycle_stage": "qualified"
  }
}
```

To list the *definitions* available (names, attribute types, options), call:

```http
GET /crm/api/v2/custom-fields/contacts?format=json HTTP/1.1
```

This returns the schema (not a paginated list — see [`api.md`](api.md) for the envelope difference).

---

## 3. Assign multiple contacts to a company

Use the `assign-contacts` lifecycle PATCH:

```http
PATCH /crm/api/v2/companies/<company-uuid>/assign-contacts?format=json HTTP/1.1
Content-Type: application/json

{
  "contact_uuids": [
    "123e4567-e89b-12d3-a456-426614174000",
    "f0e1d2c3-b4a5-6789-0abc-def123456789"
  ]
}
```

Returns `200` with the full updated company object. This is the only place in CRM v2 where you pass an array of UUIDs at the top level — most other resources take one entity per call.

---

## 4. Filter and paginate a large contact list

Combine `page`, `size`, `sort_by`, `sort_order`, `search_by`, `keyword`, `exact`:

```http
GET /crm/api/v2/contacts?page=1&size=50&sort_by=last_updated&sort_order=DESC&search_by=email&keyword=@acme.com&format=json HTTP/1.1
```

The list envelope tells you whether you need to paginate further:

```json
{
  "total_entries": 142,
  "total_pages": 3,
  "page": 1,
  "size": 50,
  "results": [ /* 50 contacts */ ]
}
```

Loop `page=1..total_pages` to drain. The default sort for contacts is `last_updated DESC` — useful for "show me what changed recently" without explicit sort args.

For exact-match instead of substring search, add `exact=true`. The match becomes case-sensitive.

---

## 5. Archive vs delete

There are two destructive verbs and they mean different things:

```http
PATCH /crm/api/v2/contacts/<uuid>/archive?format=json HTTP/1.1
```

Sets `is_archived=true`. The contact is hidden from default IIA views but the record (and its sub-resources) remain. Reversible with:

```http
PATCH /crm/api/v2/contacts/<uuid>/restore?format=json HTTP/1.1
```

Versus:

```http
DELETE /crm/api/v2/contacts/<uuid> HTTP/1.1
```

Delete. Cannot be undone via the API. Sub-resources are cascade-deleted (addresses, personal info, profiles, relationships).

**Which to use:** archive is appropriate for "no longer active" — preserves history, restorable if it was a mistake. Delete is for genuinely-bad data (test records, GDPR right-to-erasure, etc.). When in doubt, archive.

The same pair exists for companies (`/companies/<uuid>/archive`, `/restore`, `DELETE /companies/<uuid>`). **Archive/restore do NOT fire webhooks** — only create and update do. If your downstream system depends on knowing about archive events, read it from the next update or poll.

---

## 6. Log a call activity with an attachment

Attaching a file is a **two-step upload** (see [`globals/attachments.md`](globals/attachments.md) for the full credentials flow), then a normal activity create with the attachment UUID:

```http
POST /crm/api/v2/activities?format=json HTTP/1.1
Content-Type: application/json

{
  "type": "call",
  "subject": "Discovery call with Acme",
  "notes": "Discussed pricing and timeline.",
  "start_date_time": "2025-05-02T11:00:00.000Z",
  "end_date_time": "2025-05-02T11:30:00.000Z",
  "feature_type": "contact",
  "feature.uuid": "<contact-uuid>",
  "attachments.uuids": ["<attachment-uuid-from-upload-flow>"]
}
```

`feature_type` + `feature.uuid` is how every activity is anchored — to a contact, company, or opportunity. `attachments.uuids` is an array; pass an empty list (or omit the key) if there's nothing to attach.

---

## 7. Drain the event stream for an audit trail

The event stream gives you an append-only log of changes across the system. Useful for syncing a downstream audit log or building "recent activity" UI.

```http
GET /crm/api/v2/event-streams?page=1&per_page=50&start_date=2025-05-01T00:00:00Z&format=json HTTP/1.1
```

Note this resource uses `per_page` (not `size`) — see [`globals/event_streams.md`](globals/event_streams.md). Filter by `start_date` / `end_date`, `module_source`, `module_feature`, or `administrator_uuid`. Iterate through `total_pages` to drain.

Events have a `description` field with markdown emphasis, a structured `log` JSON field with the change details, and an icon hint for IIA — useful for both human-readable and machine-readable consumers.

---

## What's intentionally not here

- **Bulk create / batch operations** — V2 endpoints are one-entity-per-request. If you need to create 1000 contacts, loop. There is no `POST /contacts/bulk`.
- **Search by custom-field value** — the `search_by` / `keyword` list params target top-level fields. Searching by custom-field value is not currently a documented v2 capability; query and filter client-side, or use GraphQL where exposed.
- **Unsubscribe / disable a webhook via API** — webhook subscriptions are managed in IIA only.
