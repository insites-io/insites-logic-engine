# Globals — Activities

Activities log interactions with contacts, companies, and opportunities — calls, meetings, emails, notes, etc. Each activity is attached to a "feature" (the entity it relates to) via `feature.uuid` + `feature_type`.

**Full field reference:** `<your-insites-instance>/admin/api/globals/activities/overview`

For shared conventions, see [`../api.md`](../api.md).

---

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/crm/api/v2/activities` | Create an activity |
| `GET` | `/crm/api/v2/activities` | List activities (paginated) |
| `GET` | `/crm/api/v2/activities/:uuid` | Read one |
| `PATCH` | `/crm/api/v2/activities/:uuid` | Update an activity |
| `DELETE` | `/crm/api/v2/activities/:uuid` | Delete an activity |

**Required fields on create:** `type`, `feature_type`, `feature.uuid`.

**Validation (CRM 6.1.5+).** `type` must be one of `call`, `chat`, `email`, `event`, `file_note`, `meeting`, `sms`, `other`; `feature_type` one of `contact`, `company`, `opportunity`; and `feature.uuid` must be an existing record of that type (a contact uuid sent with `feature_type: opportunity` is refused). A failure answers **422** with `type: validation_error` and one `errors[]` entry per failing field (`errors[].field` is `type`, `feature_type` or `feature.uuid`), and creates nothing, event stream entry included. PATCH checks only the fields sent, each falling back to the stored value, and moves the activity to the new record's Activities tab when `feature_type` changes; an unknown activity uuid is 404. A successful create answers **200**, not 201. Read from module-v6-crm v6.1.5, `functions/activities/validate` and the Add/Update Activity API definitions.

**List filters (CRM 6.1.5+).** `GET /crm/api/v2/activities` accepts `page`, `size`, `sort_by`, `sort_order`, `search_by`, `keyword`, `has_pagination`, exactly one of `opportunity_uuid` / `contact_uuid` / `company_uuid`, `type`, and `created_from` / `created_to` (`YYYY-MM-DD`, inclusive, on `created_at`). `search_by` defaults to `type`. **Any other parameter answers 400** naming it (`functions/_external/unknown_params`), as do a blank value, a malformed date, and more than one relation param. `format` and the platform's `slug`/`slugs`/`slug2`... params are always allowed. A caller that used to send an extra or misspelled param and got the unfiltered list now gets 400.

## Example — log a call activity against a contact

```http
POST /crm/api/v2/activities?format=json HTTP/1.1
Authorization: instance_aB3xK9pQ7mN2vL8wR4tY1zE6cF5sJ0hG
Content-Type: application/json

{
  "type": "call",
  "subject": "Follow up with prospect",
  "notes": "Discussed pricing and next steps.",
  "start_date_time": "2025-05-02T11:00:00.000Z",
  "end_date_time": "2025-05-02T11:30:00.000Z",
  "feature.uuid": "98765432-10fe-dcba-9876-543210fedcba",
  "feature_type": "contact",
  "related_contact.uuids": ["01234567-89ab-cdef-0123-456789abcdef"],
  "last_updated_by.uuid": "b7e8a123-f4d5-46c7-9a8b-0e1234567890"
}
```

```json
HTTP/1.1 200 OK
Content-Type: application/json

{
  "id": 256,
  "uuid": "256fabcd-54d7-453a-b576-79115bddb0c4",
  "type": "call",
  "subject": "Follow up with prospect",
  "notes": "Discussed pricing and next steps.",
  "start_date_time": "2025-05-02T11:00:00.000Z",
  "end_date_time": "2025-05-02T11:30:00.000Z",
  "feature_type": "contact",
  "contact": {
    "uuid": "abcdef01-2345-6789-abcd-ef0123456789",
    "name": "John Doe",
    "email": "john.doe@example.com"
  },
  "related_contacts": [
    { "uuid": "bcdefa01-...", "name": "Jane Smith", "email": "jane.smith@example.com" }
  ],
  "attachments": null,
  "last_updated_by": {
    "uuid": "defabc01-...",
    "name": "Admin User",
    "email": "admin@example.com"
  },
  "created_at": "2025-04-25T04:56:41.642Z",
  "updated_at": "2025-04-25T04:56:41.642Z"
}
```

## Notes

- **`feature_type`** identifies which kind of entity the activity is attached to: `contact`, `company`, `opportunity`. The response inflates the matching field (e.g., when `feature_type=contact`, the response includes a populated `contact` object).
- **`related_contact.uuids`** (array) optionally links additional contacts to the activity.
- **`attachments.uuids`** (array) optionally links uploaded attachments — see [attachments.md](attachments.md) for the upload flow.
