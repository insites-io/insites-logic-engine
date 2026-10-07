# CRM — Gotchas

Edges and quirks of the CRM V2 REST API that bite. Each entry: **what bites**, **why**, **how to avoid**.

---

## 1. No `Bearer` prefix on the Authorization header

**Bites:** sending `Authorization: Bearer instance_xyz...` returns `401`.

**Why:** the auth policy compares the header value to the stored key with **string equality**. There is no scheme parsing.

**Avoid:** send the raw key only — `Authorization: instance_xyz...`. See [`../../api/authentication.md`](../../api/authentication.md). Treat this as legacy/intentional; "fixing" it would break every existing integration.

---

## 2. Error response shape is not standardized

**Bites:** client code that only handles `errors: [...]` (the array form) silently treats `error: "..."` (the string form) as success because the array key isn't present.

**Why:** auth-policy failures return `{ "error": "<string>" }` while controller-layer validation returns `{ "errors": [{code, message}, ...] }`. Both shapes appear in production.

**Avoid:** always check **both** keys:

```
if (body.error || (body.errors && body.errors.length)) { /* failure */ }
```

Don't rely on HTTP status alone — also inspect the body shape.

---

## 3. `format=json` is required for proper HTTP status codes

**Bites:** without `?format=json`, the controller returns the data shape but the HTTP status is whatever the host page lets through (often `200` even on validation failure).

**Why:** the `response_handler` function — which sets `Content-Type: application/json`, security headers, and the actual HTTP status code — is gated on `params.format == 'json'` in every controller.

**Avoid:** always include `?format=json` (or `&format=json`) on every API request. There is no harm in it for successful requests; it just becomes mandatory for reliable error detection.

---

## 4. Custom fields use `:id`, not `:uuid`

**Bites:** sending `DELETE /crm/api/v2/custom-fields/contacts/<some-uuid>` returns 404 because the route expects a numeric `id`.

**Why:** PlatformOS schema constraint — custom-field definition records cannot use the UUID convention used by every other CRM resource.

**Avoid:** when listing custom fields via `GET /crm/api/v2/custom-fields/contacts`, capture the numeric `id` of the row you want to delete; don't pass the resource UUID. This applies only to the *definitions* endpoints — custom-field values on contacts/companies are addressed by the parent resource's UUID as normal.

---

## 5. Custom-fields list is not paginated

**Bites:** code that loops `page=1..total_pages` against `/crm/api/v2/custom-fields/contacts` infinite-loops or fails because the response has no pagination keys.

**Why:** custom-field schemas are small (tens of definitions, not thousands), so the endpoint returns the full set as a single `results` array without an enclosing pagination envelope.

**Avoid:** treat that endpoint as returning the complete list in one call. Don't paginate.

---

## 6. Profiles in responses are filtered

**Bites:** writing a `profiles` key on a contact and then not finding it in subsequent GET responses.

**Why:** the controller strips any profile whose name matches `modules/insites_core/*` from the response — these are internal Insites profiles, not user-assignable. The base CRM contact profile (`modules/insites_core/crm_contact`) is also filtered.

**Avoid:** only user-assigned feature profiles (e.g., `modules/ins_permission_manager/<name>`) are surfaced, with `/` and `-` characters in the profile name replaced by `_` in the returned object key. If you wrote a profile under `modules/insites_core/...`, expect it to be invisible in API responses by design.

---

## 7. `last_updated DESC` is the default sort for contacts, not `uuid`

**Bites:** code that omits `sort_by` and `sort_order` from list calls expecting "natural" / insertion order gets "most-recently-updated first" instead.

**Why:** the canonical default for contacts list is `sort_by=last_updated`, `sort_order=DESC` — useful for "what changed recently" queries, surprising for "give me all contacts in stable order" queries.

**Avoid:** if you need a stable scroll-through of all contacts, pass an explicit deterministic sort: `sort_by=uuid&sort_order=ASC`.

---

## 8. `event-streams` uses `per_page`, not `size`

**Bites:** generic pagination wrappers that always send `size` get treated as default `per_page=10` on the event-streams endpoint, returning unexpectedly small pages.

**Why:** event streams diverge from the rest of CRM v2 list conventions — the param is `per_page` here only.

**Avoid:** when calling `/crm/api/v2/event-streams`, pass `per_page` instead of `size`. Every other CRM v2 list endpoint uses `size`.

---

## 9. Webhooks only fire on contact / company **create and update**

**Bites:** systems that depend on receiving a `contact_archived` or `company_deleted` event never get one.

**Why:** the webhook integration in CRM only fires `contact_created`, `contact_updated`, `company_created`, `company_updated` — there are no events for delete, archive, restore, assign-contacts, or sub-resource operations. See [`api.md`](api.md) Webhooks section for the audit.

**Avoid:** for state changes that don't fire a webhook, either poll the resource's `updated_at` field on a schedule, or hook into the V2 API at the call site of your own writes (in a wrapper service). For arbitrary application events, log into the event stream — see [`globals/event_streams.md`](globals/event_streams.md).

---

## 10. Delete cascades and cannot be undone

**Bites:** `DELETE /crm/api/v2/contacts/<uuid>` removes the contact's addresses, personal info, profiles, and relationships along with it. Confused with archive, this loses data.

**Why:** the V2 API has both archive (`PATCH /<resource>/<uuid>/archive`) and delete (`DELETE`). They are different verbs with different results. A delete cannot be undone via the API.

**Avoid:** default to archive. Reserve delete for genuinely-bad data (test records, GDPR right-to-erasure). When archive is what you want, use the lifecycle PATCH paths — they preserve data and are reversible with `/restore`.

---

## 11. Attachments are publicly readable

**Bites:** uploading anything sensitive (PII, contracts, financial documents) and assuming the URL is access-gated.

**Why:** attachment uploads use `acl: public-read` on S3 — anyone with the URL can fetch the file.

**Avoid:** treat attachments as public CDN content. Don't put confidential data here. If you need access-controlled file storage, build it outside CRM (e.g., your own bucket with signed URLs).

---

## 12. There is no bulk-create endpoint

**Bites:** code that POSTs 1000 contacts in parallel and trips a rate limit, or tries `POST /crm/api/v2/contacts/bulk` and gets 404.

**Why:** the v2 API is one-entity-per-request by design.

**Avoid:** loop sequentially with appropriate backoff if rate limits engage. For large initial imports, do them via the IIA admin UI (which has bulk-import affordances) rather than the API.
