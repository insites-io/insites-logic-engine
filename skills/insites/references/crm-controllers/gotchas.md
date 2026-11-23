# CRM Controller Gotchas

Traps when calling the CRM and Pipelines controllers from Liquid, or their V2 REST endpoints from outside the instance. Several of them answer 200 and change nothing, so a success status is not evidence that a write worked. After any write, GET the record by uuid and check every field, not only the ones you sent.

Unless an entry says otherwise, these were measured by probing one production instance between June and November 2026. The CRM module version on that instance was not recorded. Newer CRM releases may have changed some of them; entries that a later release is known to have changed say so.

## Calling Controllers From Liquid

### A Hash Passed Without `params:` Is Ignored

**Cause:** a controller reads its arguments from `params`. A hash passed positionally, or as `query_params:`, `object:` or `data:`, is discarded with no error. A `list` then returns its default first page of 10 unfiltered rows, and a `create` writes nothing and reports success. Tested five ways on 12 August 2026; only `params:` worked.

**Solution:** use the argument form each action expects.

| Action | Argument form |
|---|---|
| `list`, `create` | `params: <hash>` |
| `get` | bare `uuid:`. Wrapping it in `params:` answers **400 "The provided UUID is not a valid UUID format"** about a valid uuid |
| `update` | both: `uuid: x, params: body` |

```liquid
{% parse_json params %}
{"page":1,"size":100,"status":"open","sort_by":"name","sort_order":"ASC"}
{% endparse_json %}
{% function data = "pipeline/controller/opportunities/list", params: params %}

{% function one = "crm/controller/contacts/get", uuid: "<contact-uuid>" %}
```

### The Docs Path and the Controller Path Disagree

Activities and tasks are documented under `globals/` (`/admin/api_md/globals/activities`), but their controllers are `crm/controller/activities/*` and `crm/controller/tasks/*`. Opportunities are `pipeline/controller/opportunities/*`, matching their docs. Over HTTP the paths are `/crm/api/v2/...` and `/pipeline/api/v2/...`; `globals` is only a docs grouping, and `/globals/api/v2/...` answers 404. Measured 12 August 2026.

### `opportunities/list` Takes More Filters Than It Documents

Measured 12 August 2026 on `pipeline/controller/opportunities/list`:

- The documented arguments are `page`, `size`, `sort_by`, `sort_order`, `search_by` and `keyword`. These undocumented filters also worked: `status`, `stage`, `owner`, `division`, `pipeline_uuid`, `pipeline_status`, `target_conversion_date_from` and `target_conversion_date_to`.
- `sort_by` and `sort_order` work. `sort` and `order`, which appear in the module source, are ignored when passed from outside.
- `total_entries` is documented but was never returned.

## Writes That Answer 200 and Change Nothing

### Custom Fields Need the Dotted Key

**Cause:** only the dotted form writes: `{"custom_field.<key>": "value"}`. The nested `{"custom_field": {"<key>": "value"}}`, the flat `{"<key>": "value"}` and the plural `{"custom_fields": {...}}` all answer 200 and change nothing. A GET returns `custom_field` as a nested object, so a read-modify-write that sends the record back in the shape it was read is exactly the shape that fails.

**Solution:** always write `custom_field.<key>`, then GET and check. Measured on CRM companies on 2 August 2026 and on Pipelines opportunities on 13 August 2026, retested from a cleared field so no result was masked.

On opportunities, two further defects answered 200 on 13 August 2026: `GET /pipeline/api/v2/custom-fields/opportunities` returned `{"results": null}`, and a single-select custom field stored any string sent to it verbatim (`"Not A Real Option"`).

### Company PATCH Resets the Alert Flags

**Cause:** `PATCH /crm/api/v2/companies/{uuid}` sets `has_alert_message_on_view` and `has_alert_message_on_edit` to `false` when they are absent from the body. The alert text survives, so the record looks fine while the alert stops displaying. Measured 2 August 2026.

**Solution:** read both flags first and send them back on every company PATCH.

### A Contact's `name` Only Recomputes When `first_name` Changes

**Cause:** `name` is stored, not computed on read. Changing only `last_name` leaves the old `name` in place, so the admin still shows the old value. Writing `name` directly is ignored, and a trailing-space change to `first_name` is trimmed and reads as no change. Measured 2 August 2026.

**Solution:** two writes: a genuinely different temporary `first_name`, then the real value.

### Contact PATCH Requires `email`

A contact PATCH without `email` in the body fails GraphQL validation, even when the email is unchanged. Contact PATCH also trims whitespace from `first_name` and `last_name` on the server, and the trimmed name flows into `assigned_to.name` on other records. Measured 2 August 2026.

### Completing a Task

`PATCH /crm/api/v2/tasks/{uuid}` with `status: "completed"` answered 200 and changed nothing on 13 November 2026. `POST /crm/api/v2/tasks/{uuid}/complete` with an empty body worked. GET the task and check `status` afterwards.

### A Task's Assignee Is Written and Read Under Different Names

Written with `assignee_administrator_uuid` on POST and PATCH; read back as a nested `assignee` object (`{uuid, name, email}`), not `assignee_administrator`. Checking for `assignee_administrator` reports a missing assignee that is there.

### The Create Response Is Not the Record

The POST response for tasks and activities comes back with flat fields such as `feature_type` and the assignee set to null, even when they were stored. GET the record by uuid to confirm the opportunity, assignee and due date stuck.

## Activities

### The Body Field Depends on the Type

The admin shows one body field per activity type. Verified on 15 June 2026 against the module's `Activities.vue` timeline and `ActivityForm.vue` edit form, which disagree with the `/admin/api` field descriptions:

| Type | Body field |
|---|---|
| `email`, `sms` | `message`. For `email`, `notes` also shows as a second block if set; for `sms`, `notes` is never shown |
| `call`, `chat`, `meeting`, `event`, `file_note`, `other` | `notes`. `message` is not shown, so a body sent there looks blank |

Set only the field that matches the type. Setting both shows the body twice. Plain text renders; HTML works in `message` on an email.

At the same date the API accepted `type: "note"`, which renders as an untyped activity; use `file_note`. CRM 6.1.5 and later refuse any type outside the eight listed (see [activities](../modules/crm/globals/activities.md)).

### Linking Contacts to an Activity

Measured 12 August 2026: `contact_uuid` is ignored on create, and the activity reads back with `contact: null` and an empty `related_contacts`. `related_contact_uuids` (an array) linked correctly on create, and a later PATCH with it also linked an existing activity.

The link target goes in `feature` with `feature_type` (`contact`, `company` or `opportunity`). `feature` is write-only: read the activity back and it is null, with the link shown as a nested `contact`, `company` or `opportunity` object. There is no `related_uuid` field; sending one does not link anything.

### Times Are Stored in UTC

`start_date_time` sent as `2026-08-06T14:03:00+08:00` is stored and returned as `2026-08-06T06:03:00.000Z`. Send an explicit offset and convert on display. Measured 12 August 2026.

### The List Endpoint Before CRM 6.1.5

Measured in June 2026 on an older CRM: `GET /crm/api/v2/activities` ignored filter parameters, sorted by `uuid` rather than by date, and did not hydrate the `opportunity` relation on list rows (it always read null there). A scan with `size=50` and an early stop missed records on later pages. Walk every page to `total_pages` (with `size=1000`), and confirm a link with a GET by uuid. CRM 6.1.5 added list filters and refuses unknown parameters (see [activities](../modules/crm/globals/activities.md)).

### A Deleted Activity Cannot Be Seen or Restored Through the API

The platform keeps a deleted record for 30 days before removing it, and a query with `deleted_at: { exists: true }` still finds it (see [storing data](../building-on-insites/05-storing-data.md)). The CRM API gives no way to reach that window. On 28 August 2026 `DELETE /crm/api/v2/activities/{uuid}` answered 204 and a GET by uuid then answered 404 `no_activity`. A plain admin GraphQL `records` query for that uuid on the activity table also returned 0 records, while the same query for a live uuid returned 1; that query did not add the `deleted_at` filter, so it does not show the row was gone from the table.

Activities have no `archive` controller: `crm/controller/activities/` offers `list`, `get`, `create`, `update` and `delete`. Contacts and companies have `archive` and `restore`. Save the full record before deleting an activity; restoring needs the platform side.

## Reading

### Rows Are at Top-Level `results`

`/crm/api/v2/companies`, `/contacts` and `/activities` return `{total_entries, total_pages, page, size, results: [...]}`. Reading `items.results`, as some other modules return, gives an empty list that looks like no records rather than an error. `size=1200` on companies returned 1,157 rows in one call. Measured 12 August 2026.

### Finding a Contact by Any Email

`search_by=email` matches the primary `email` only. `search_by=email_2` matches the secondary address (measured 3 July 2026). Run both to find a contact by any address.

### Phone Fields

Contact phones are digits only, with no leading zeros, and the country code in a separate field. A contact has three pairs (`mobile_phone`, `work_phone`, `home_phone`); a company has four (`mobile_phone`, `phone_1` to `phone_3`). Each contact phone field works as a `search_by` target; a generic `search_by=phone` returns nothing. Measured 12 August 2026.

### Picklists: Company and Contact Use Different Lists

`GET /crm/api/v2/system-fields` holds the CRM picklists in groups (`company_category`, `company_type`, `contact_category`, `contact_type`, `industry`, `lead_source`, `relationship`). The company and contact categories are separate picklists with different uuids for the same label, so a `company_category` uuid on a contact is a silent mismatch. The list is paged: read `total_pages`, because `size=50` returned page 1 of 2. Measured 12 August 2026. Pipelines keeps its own `system-fields`; see [forms rules](../../../../logic-engine/rules/forms.md).

On create, flat `*_uuid` keys worked for `category_uuid`, `lead_source_uuid`, `industry_uuid` and `company_uuid` (contact to company), and read back as nested objects.

### No Activities Schema at `/admin/json`

`/admin/json/crm/activities` returned non-JSON on 12 August 2026. `companies` and `contacts` returned schemas there.

### DELETE and PATCH Do Not Fill `query_params.payload` From a JSON Body

Measured 10 September 2026 with an instance API key: on a CRM API `DELETE` or `PATCH`, a JSON body did not reach `query_params.payload` (the value was null). In the same test, `/insites/api/core/instance-url` answered 200 with an HTML login page instead of JSON.

## Pipelines

### Moving an Opportunity Keeps Its Status

PATCH an opportunity with `{"stage": {"uuid": "..."}}` to move it. A `lost` or `withdrawn` opportunity stays lost after the move; the status is not reset to open. A stage can be deleted only once it holds no opportunities. Measured 16 July 2026.

### `lead_referred_by` Shapes

Measured 3 August 2026: flat `lead_referred_by_uuid` and dotted `lead_referred_by.uuid` both set the field. The bare string `"lead_referred_by": "<uuid>"` and the key `referred_by_uuid` were ignored with a 200. This field was not settable when tested in June 2026.

## See Also

- [CRM Controllers](./README.md)
- [CRM module gotchas](../modules/crm/gotchas.md)
- [Pipelines module gotchas](../modules/pipelines/gotchas.md)
- [`crm/controller/contacts/list` contract](../building-on-insites/reference/crm-contacts-list.md)
