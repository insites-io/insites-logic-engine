# Authentication -- API Reference

This document covers the Liquid tags, context objects, authorization policies, and inline patterns used for authentication and authorization in Insites.

## Liquid Tags

### sign_in

Authenticates a user and creates a session.

```liquid
{% sign_in user_id: user.id %}
{% sign_in user_id: user.id, timeout_in_minutes: 60 %}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` | ID | Yes | The ID of the user record to sign in |
| `timeout_in_minutes` | Integer | No | Session timeout; omit for platform default |

**Behavior:** Sets a session cookie. After this tag, `context.current_user` is populated for subsequent requests.

**The session id rotates.** `sign_in` issues a new `_insites_session_id` cookie on the request that signs the user in; the cookie from before sign-in is not signed in. Measured on an instance on 15 October 2026 for password, emailed code and emailed link sign-in. Session fixation is therefore not possible: an attacker who plants a session id before the victim signs in holds a session that stays signed out.

### Signing out: there is no `sign_out` tag

There is a `sign_in` tag and no `sign_out` tag. Measured on a v6 staging instance on 15 October 2026 (TW#26876514): `insites-cli exec liquid` with `{% sign_out %}` failed with `Liquid syntax error (line 1): Unknown tag 'sign_out'`, `insites-cli check` reported `LiquidHTMLSyntaxError` `Unknown tag 'sign_out'` on the two pages that used it, and the tag reference the CLI ships lists `sign_in` and `session` but no `sign_out`.

**Sign out with the `user_session_destroy` mutation, run from a `method: post` page that receives the authenticity token.** The v6 CRM module (`graphql/sessions/logout.graphql`), app-seedling 2.1.0 and app-portal all sign out with this mutation, and app-seedling 2.1.0 runs it from a `method: post` page as below. The full recipe is in [patterns](patterns.md#sign-out).

```graphql
# app/graphql/sessions/sign_out.graphql
mutation sign_out {
  user_session_destroy
}
```

The schema marks it deprecated, `@deprecated(reason: "Use session tag")`, and returns a `HashObject`. No use of the `session` tag that the CLI's tag reference documents ends a sign-in (see the table), so `user_session_destroy` is the way to sign out until the platform documents another.

#### What ends a sign-in, measured

Measured on a v6 production and a v6 staging instance on 16 October 2026 (TW#26894310), with the same result on both. Each row started from a test user signed in with `sign_in`; "signed out" means the next request had no `context.current_user`.

| What the page did | Signed out | Notes |
|---|---|---|
| `user_session_destroy` on a `method: post` page, authenticity token sent | **Yes** | The recommended way |
| `user_session_destroy` on a `method: post` page, no token | **No** | The page saw no `context.current_user`, and the mutation did nothing even when run without an `if` around it (it answered `{"id": null}`). Another site cannot sign anyone out through this page |
| `user_session_destroy` on a `method: get` page | **Yes** | Works, but a link from another site can sign the person out: the session cookie is `SameSite=Lax`, which browsers send on a top-level GET navigation (the cookie attribute was measured; a second site was not used) |
| A legacy form (`resource: Session`, `{% form method: 'delete' %}`) posted to `/api/sessions` | **Yes, with or without the token** | Answered 204 both times. The authenticity token is not checked, so prefer the `method: post` page |
| `{% session user_id = null %}`, and the same for `user` and `current_user` | No | These are ordinary `context.session` fields. The sign-in is not stored in any of them |
| `{% sign_in user_id: '' %}` | No | `Liquid::Error: sign_in tag: no user found`, and the user stayed signed in |
| `{% session warden.user.user.key = null %}` | Yes | It deletes the platform's internal sign-in key from the session. That key is not documented anywhere: do not build on it |

#### What `user_session_destroy` leaves behind

Measured the same way, on both instances:

- **It takes effect on the next request.** In the request that runs it, `context.current_user` is still set and the mutation answers `{"user_session_destroy": {"id": "<user id>"}}`. Redirect straight after it.
- **The session id is not rotated, and that is safe.** Replaying a copy of the cookie taken before sign-out found no `context.current_user`: the session is held on the server, so signing out ends it for every copy of the cookie.
- **Every field set with `{% session %}` survives sign-out, and the next sign-in.** A field set while signed in was still in `context.session` after `user_session_destroy`, and still there after `sign_in` signed the user in again; the session id rotated on sign-in and the fields moved with it. This was measured with the same user signing in again. Clear per-login state yourself, on sign-out and on sign-in, and store anything that means "this person passed a check" against their user id, as app-seedling 2.1.0 does with `two_factor_user_id`. The CSRF token survives too.
- **Never print `context.session` whole.** While a user is signed in it holds the platform's sign-in record, `warden.user.user.key`, which is the user's id and the first 29 characters of their stored password hash (the bcrypt salt). Read the fields you set by name.

## Loading the Current User

The foundation of authentication is `context.current_user`, which is populated after a successful `sign_in`. To get the full profile (including roles), run a GraphQL query:

```liquid
{% liquid
  if context.current_user
    graphql g = 'users/current', id: context.current_user.id
    assign profile = g.users.results.first
  else
    assign profile = null
  endif
%}
```

The `users/current.graphql` query (the `roles` property must be declared in `app/user.yml` first, or it reads back `[]` for everyone; see [configuration](configuration.md#declare-the-roles-property-first)):

```graphql
query current($id: ID!) {
  users(per_page: 1, filter: { id: { value: $id } }) {
    results {
      email
      id
      roles: property_array(name: "roles")
    }
  }
}
```

| Field | Description |
|-------|-------------|
| `profile.id` | User record ID |
| `profile.email` | User email |
| `profile.roles` | Array of role strings (from `property_array`) |

## Authorization Policies (Preferred for Page Guards)

Authorization policies are the native platform way to protect entire pages. Define a policy file and reference it in page front matter.

### Define a policy

> **Strict true / false only.** A policy file's last printed value is the policy result, and the platform compares it to the literal strings `"true"` and `"false"`. Any other output — `"True"`, `"1"`, `""`, an HTML fragment, a stray newline, a Liquid object reference — is treated as a denial and the page returns 403. Don't rely on Liquid truthy/falsy semantics; always emit one of the two exact tokens.

```liquid
{% comment %} modules/dashboard/public/authorization_policies/admin_only.liquid {% endcomment %}
{%- if context.current_user == blank -%}false{%- break -%}{%- endif -%}
{%- graphql g = 'modules/dashboard/account/get_current_user', id: context.current_user.id -%}
{%- assign profile = g.users.results.first -%}
{%- if profile.roles contains 'admin' or profile.roles contains 'superadmin' -%}true{%- else -%}false{%- endif -%}
```

The `{%- ... -%}` whitespace-trim delimiters matter: a policy file that emits `true\n` instead of `true` will be denied because the platform's string compare sees `"true\n" != "true"`. Either trim aggressively or end the file with `| strip` if you must use a multi-line `{% liquid %}` block.

### Use in page front matter

```liquid
---
slug: admin/dashboard
authorization_policies:
  - admin_only
---
{% comment %} This page only renders if the policy returns true {% endcomment %}
```

The platform returns a 403 automatically when the policy emits anything other than the exact string `true`. No inline guard code needed.

## Inline Role Checks

For conditional UI or custom guard logic within a page, check roles directly on the profile.

### Inline permission check (conditional UI)

Does NOT block execution -- use for showing/hiding elements.

```liquid
{% if profile.roles contains 'admin' %}
  <a href="/products/new">Create Product</a>
{% endif %}
```

For more granular checks using a permissions map:

```liquid
{% liquid
  assign permissions = '{"admin": ["products.create", "products.update", "products.delete"], "editor": ["products.create", "products.update"], "superadmin": []}' | parse_json
  assign can_create = false
  for role in profile.roles
    if role == 'superadmin'
      assign can_create = true
      break
    endif
    if permissions[role] contains 'products.create'
      assign can_create = true
      break
    endif
  endfor
%}

{% if can_create %}
  <a href="/products/new">Create Product</a>
{% endif %}
```

### Inline guard (enforce with 403)

Halts page execution if the user lacks permission.

```liquid
{% liquid
  unless profile
    response_status 403
    render 'errors/unauthorized'
    break
  endunless
%}
```

For role-specific enforcement:

```liquid
{% liquid
  unless profile and profile.roles contains 'admin'
    response_status 403
    render 'errors/unauthorized'
    break
  endunless
%}
```

### Inline guard with login redirect

Redirect anonymous users to the login page instead of showing 403:

```liquid
{% liquid
  unless profile
    assign return_to = context.location.pathname | url_encode
    assign sign_in_url = '/sign-in?return_to=' | append: return_to
    redirect_to sign_in_url
    break
  endunless
%}
```

## Context Objects

### context.current_user

Available after authentication. Contains basic user fields. This is the foundation for loading the full user profile.

```liquid
{{ context.current_user.id }}
{{ context.current_user.email }}
```

**Note:** `context.current_user` is `null` when the CSRF token is missing on non-GET requests. Always include the `authenticity_token` in forms. For permission checks, load the full profile (with roles) via GraphQL as shown above.

### context.authenticity_token

The CSRF token for the current session. Include in every non-GET form.

```liquid
{{ context.authenticity_token }}
```

### context.session

Raw session data.

```liquid
{{ context.session }}
```

## GraphQL Mutations

### User creation (registration)

```graphql
mutation create_user($email: String!, $password: String!) {
  user_create(user: {
    email: $email,
    password: $password
  }) {
    id
    email
  }
}
```

### Password authentication

```graphql
query authenticate($email: String!, $password: String!) {
  user(
    filter: {
      email: { value: $email }
      password: { value: $password }
    }
  ) {
    id
    email
  }
}
```

Returns the user record if credentials match; `null` otherwise.

### User update (role assignment)

```graphql
mutation update_role($id: ID!, $role: String!) {
  user_update(id: $id, user: {
    properties: [{ name: "role", value: $role }]
  }) {
    id
  }
}
```

## Temporary Tokens

`temporary_token(expires_in: Float)` on a user returns a signed token for that account; `expires_in` is in **hours** (default 48). Check one with `authenticate { temporary_token(token: String!) }`, which answers `true` while the token is valid for that user and unexpired. The schema adds: "The token is invalidated when the password changes".

```liquid
{%- graphql found, em: email, h: 1.0 -%}
query ($em: String, $h: Float) {
  u: user(email: $em, is_deleted: false) { id temporary_token(expires_in: $h) }
}
{%- endgraphql -%}
{%- graphql chk, em: email, tok: token -%}
query ($em: String, $tok: String!) {
  u: user(email: $em, is_deleted: false) { id authenticate { temporary_token(token: $tok) } }
}
{%- endgraphql -%}
```

Measured on a v6 production instance on 13 October 2026:

- The token reads as base64 of `<user id>|<expiry as Unix time>`, then `--` and a signature. It is not secret in shape; only the signature protects it. Changing the id, the expiry or the signature makes it fail.
- It checks only against its own account: another user's live token answers `false`.
- `expires_in: 0.01` (36 seconds) was valid at 26 seconds and refused at 46.
- Minting and checking write nothing. Two tokens minted for one account are both valid; opening or checking a token does not use it up, so it stays valid until the password changes or it expires.
- Changing the password with `user_update` ended every token minted before it.

So a token is a reusable credential until then: keep `expires_in` short. The [password reset recipe](patterns.md#password-reset-by-emailed-link) and the [sign-in link](patterns.md#variant-2-an-emailed-link) use it.

## Two-Factor Codes (TOTP)

The schema offers time-based codes per user. None of this was measured for this page; it is the schema's contract.

- `otp(otp_name: String)` on a user returns `Otp { current_code, secret, secret_as_svg_qr_code(issuer, label) }`; leave `otp_name` blank for the default token. `otp_tokens` lists custom token names.
- `authenticate { otp_code(code: String!, drift: Int) }` checks a code; `drift` allows clock difference between the device and the server.
- `user_otp_secret_refresh(user_id:, otp_name:)` makes a new secret and `user_otp_delete_token(user_id:, otp_name:)` removes one.

Whether a person has switched two-factor on is a fact about them: store it on the user or profile. Whether this sign-in has passed the code is a fact about this login: store it in the session (see [Sessions](../sessions/README.md#session-state-or-profile-state)). Always look the account up from `context.current_user`, never from a submitted email or id.

## See Also

- [Authentication Overview](README.md) -- introduction and key concepts
- [Authentication Configuration](configuration.md) -- role definitions and session setup
- [Authentication Patterns](patterns.md) -- real-world login and guard patterns
- [Liquid Tags Reference](../liquid/tags/README.md) -- complete tag reference
- [GraphQL Reference](../graphql/README.md) -- query and mutation details
