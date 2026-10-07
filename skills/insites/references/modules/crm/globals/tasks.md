# Globals — Tasks & Task Comments

Two related global resources for tracking work and discussion threads attached to it.

**Full field reference:**
- Tasks: `<your-insites-instance>/admin/api/globals/tasks/overview`
- Task comments: `<your-insites-instance>/admin/api/globals/task-comments/overview`

For shared conventions (auth, URL pattern, response envelope, list envelope, status codes), see [`../api.md`](../api.md).

---

## Tasks

CRUD plus `complete` / `open` lifecycle PATCH actions. A task can be associated with a contact, company, or opportunity (the "feature").

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/crm/api/v2/tasks` | Create a task |
| `GET` | `/crm/api/v2/tasks` | List tasks (paginated) |
| `GET` | `/crm/api/v2/tasks/:uuid` | Read one task |
| `PATCH` | `/crm/api/v2/tasks/:uuid` | Update a task |
| `DELETE` | `/crm/api/v2/tasks/:uuid` | Delete a task |
| `PATCH` | `/crm/api/v2/tasks/:uuid/complete` | Mark complete |
| `PATCH` | `/crm/api/v2/tasks/:uuid/open` | Re-open a completed task |

**Required field on create:** `task_name`.

### Example — create a task

```http
POST /crm/api/v2/tasks?format=json HTTP/1.1
Authorization: instance_aB3xK9pQ7mN2vL8wR4tY1zE6cF5sJ0hG
Content-Type: application/json

{
  "task_name": "Follow up with prospect",
  "description": "Send a follow-up email and schedule a call.",
  "assignee.uuid": "admin-uuid-456",
  "contact.uuid": "contact-uuid-789",
  "due_date": "2025-04-26"
}
```

```json
HTTP/1.1 201 Created
Content-Type: application/json

{
  "id": 117,
  "uuid": "generated-uuid-for-new-task",
  "task_name": "Follow up with prospect",
  "status": "open",
  "description": "Send a follow-up email and schedule a call.",
  "completed_by_datetime": null,
  "due_date": "2025-04-26",
  "company": null,
  "contact": { "uuid": "contact-uuid-789", "name": null, "email": null },
  "opportunity": null,
  "assignee": { "uuid": "admin-uuid-456", "name": null, "email": null },
  "completed_by": null,
  "created_at": "2025-04-28T18:25:00.000Z",
  "updated_at": "2025-04-28T18:25:00.000Z"
}
```

### Lifecycle PATCH — complete / open

`PATCH /crm/api/v2/tasks/:uuid/complete` toggles the task's `status` to `completed` and records `completed_by_datetime` and `completed_by.uuid`. `/open` reverses it.

No request body is required for these actions; the `:uuid` in the path is the only input.

---

## Task comments

Threaded comments attached to a task. CRUD without delete (comments cannot be deleted via the API as of this writing).

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/crm/api/v2/tasks/comments` | Add a comment to a task |
| `GET` | `/crm/api/v2/tasks/comments` | List comments (paginated) |
| `GET` | `/crm/api/v2/tasks/comments/:uuid` | Read one |
| `PATCH` | `/crm/api/v2/tasks/comments/:uuid` | Update a comment |

Filter the list by parent task UUID via standard list query params.
