# Globals — Attachments

Attachments are file uploads stored on S3 and addressable via UUID. The upload is **two-step**: first request temporary credentials from the credentials endpoint, then upload directly to S3, then register the attachment with the API.

**Full field reference:**
- Attachments: `<your-insites-instance>/admin/api/globals/attachments/overview`
- Credentials: `<your-insites-instance>/admin/api/globals/attachment-credentials/overview`

For shared conventions, see [`../api.md`](../api.md).

---

## Endpoints

### Attachment credentials

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/crm/api/v2/attachments/credentials` | Generate temporary upload credentials |

### Attachments

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/crm/api/v2/attachments` | Register an uploaded attachment with the system |
| `GET` | `/crm/api/v2/attachments` | List attachments (paginated) |
| `GET` | `/crm/api/v2/attachments/:uuid` | Read one |
| `DELETE` | `/crm/api/v2/attachments` | Delete attachments (body specifies UUIDs) |

There is no PATCH/update — attachments are immutable once uploaded.

---

## The upload flow

1. **Request credentials.** `GET /crm/api/v2/attachments/credentials` returns a temporary S3 policy bundle:

   ```json
   {
     "direct_upload_url": "https://s3.us-west-2.amazonaws.com/uploads...",
     "success_action_status": "201",
     "acl": "public-read",
     "Content-Disposition": "inline",
     "x-amz-meta-versions": "{}",
     "x-amz-meta-acl": "public-read",
     "x-amz-meta-content-disposition": "inline",
     "key": "instances/12277/property_uploads/modules/insites_crm/attachment/file/<uuid>/${filename}",
     "policy": "<base64-encoded policy>",
     "x-amz-credential": "AKIA.../20250416/us-west-2/s3/aws4_request",
     "x-amz-algorithm": "AWS4-HMAC-SHA256",
     "x-amz-date": "20250416T115101Z",
     "x-amz-signature": "<signature>"
   }
   ```

2. **Upload to S3 directly** using those credentials. The credentials are scoped to a single uploaded file and expire shortly. (The team's `InsitesS3Uploader` plugin wraps this step.)

3. **Register the attachment** with the API:

   ```http
   POST /crm/api/v2/attachments?format=json HTTP/1.1
   Authorization: instance_aB3xK9pQ7mN2vL8wR4tY1zE6cF5sJ0hG
   Content-Type: application/json

   {
     "uuid": "aaaaaaaa-bbbb-cccc-1234-567890abcdef",
     "file": "https://<file host>/instances/.../<uuid>/<filename>"
   }
   ```

   ```json
   HTTP/1.1 200 OK
   Content-Type: application/json

   {
     "id": 256,
     "uuid": "aaaaaaaa-bbbb-cccc-1234-567890abcdef",
     "file": "https://cdn.<your-instance>.../<uuid>/<filename>",
     "created_at": "2025-04-15T12:25:02.474Z",
     "updated_at": "2025-04-15T12:25:02.474Z"
   }
   ```

The returned `uuid` can then be used in `attachments.uuids` arrays on activities and other resources.

---

## Notes

- The `uuid` in the registration call is the same UUID the credentials endpoint scoped the upload to. Pass it back to claim the file.
- Direct browser-to-S3 upload avoids a round-trip through Insites — keep large files off the application servers.
- Attachments are **publicly readable** (`acl: public-read`) once uploaded. Do not put confidential content here.
