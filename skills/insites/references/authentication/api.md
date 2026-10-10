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

### sign_out

Destroys the current session.

```liquid
{% sign_out %}
```

No parameters. The session is invalidated immediately. Typically followed by a redirect.

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
    assign return_to = context.location.pathname
    redirect_to '/sign-in?return_to=' | append: return_to
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

## See Also

- [Authentication Overview](README.md) -- introduction and key concepts
- [Authentication Configuration](configuration.md) -- role definitions and session setup
- [Authentication Patterns](patterns.md) -- real-world login and guard patterns
- [Liquid Tags Reference](../liquid/tags/README.md) -- complete tag reference
- [GraphQL Reference](../graphql/README.md) -- query and mutation details
