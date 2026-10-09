# V2 API Authentication

Every Insites V2 REST API endpoint (any path under `/<module>/api/v2/...`) is gated by the **same** authentication mechanism: an instance-wide API key passed in the `Authorization` header.

## Auth header format

```
Authorization: instance_<50 alphanumeric characters>
```

The token is the raw key value. **There is no `Bearer ` prefix**, no `Token ` prefix, no scheme. The header value is compared for direct equality against the stored instance key.

Example request:

```
GET /crm/api/v2/contacts/abc-123 HTTP/1.1
Host: example.insites.io
Authorization: instance_aB3xK9pQ7mN2vL8wR4tY1zE6cF5sJ0hG
```

## Acquiring the key

The instance API key is auto-generated when the instance is provisioned. To view the key, or generate a fresh one to replace it, an instance administrator opens the IIA admin UI:

```
<your-insites-instance>/admin/insites#/integrations/instance-api-key
```

(The path inside IIA is **Integrations → Instance API Key**.)

Only administrators can reach this page; non-admin sessions are blocked.

From this page the admin can:

- Read the current key
- Generate the initial key (if not yet set)
- Replace the existing key with a freshly generated one

## Token format

The key always starts with the literal prefix `instance_` followed by 50 alphanumeric characters from `[A-Za-z0-9]`. Use this as a sanity check when storing or transmitting the key — anything that doesn't match this shape is not a valid Insites instance API key.

## Failure response

What a caller without a matching `Authorization` header gets depends on how the endpoint page is guarded:

| Guard | Response on failure |
|---|---|
| Front-matter policy `modules/insites_crm/has_valid_instance_api_authorization` | **302 redirect to `api/401`**, flash alert `"401 - Unauthorised"` |
| Inline `modules/insites_crm/functions/auth/api_key_guard` + `respond_401` (CRM V2 pages since May 2026) | **401 on the original URL**, body `{ "error": "unauthorized", "message": "Invalid or revoked API key", "type": "authentication_error" }` |

A client that follows redirects on a POST will re-issue it as a GET to `api/401`, so test the failure path of each module you integrate with rather than assuming one shape.

## Scope and lifetime

- **Scope:** instance-wide. There is one key per Insites instance. There are no per-user, per-module, or per-scope API keys at the V2 level.
- **Lifetime:** the key is valid until replaced. There is no expiration.
- **Replacing the key:** generating a new key invalidates every client still using the old value. Update all integrations before generating a replacement, or expect downtime for clients using the old key.

## Common pitfalls

- **Adding `Bearer `** — the comparison is direct string equality. `Authorization: Bearer instance_xyz...` will fail with 401. Send the raw key only.
- **Header capitalization in clients** — most HTTP clients normalize `Authorization` correctly. If you build the request manually, ensure the header name matches exactly.
- **Mixing instance keys across environments** — staging and production have different auto-generated keys. Use environment-specific configuration; don't reuse keys.
- **Logging the key** — treat it like a long-lived shared secret. Don't log raw `Authorization` headers in application logs.

## Cross-references

- Module API references (e.g., `references/modules/crm/api.md`) link here for auth and do not duplicate it.
