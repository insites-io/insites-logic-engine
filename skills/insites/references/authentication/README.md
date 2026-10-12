# Authentication & Authorization

Authentication and authorization in Insites use `context.current_user`, role-based permission checks, and either `authorization_policies/` or inline guards. User identity comes from `context.current_user`, roles are stored as a `property_array` on user records (declare the `roles` property in `app/user.yml` first: a stock instance has none, see [configuration](configuration.md#declare-the-roles-property-first)), and permissions are enforced via authorization policies (for page-level protection) or inline role checks (for conditional UI).

## Key Purpose

The authentication system provides three core capabilities:

1. **User identity** -- retrieve the current logged-in user via `context.current_user` and a GraphQL lookup
2. **Permission checking** -- verify whether a user's roles allow a specific action
3. **Access enforcement** -- block unauthorized users via `authorization_policies/` or inline guards

The module ships with three built-in roles (`anonymous`, `authenticated`, `superadmin`) and a customizable permission matrix that maps roles to fine-grained action strings.

## When to Use

- **Protecting pages** -- guard any route that requires login or a specific role
- **Conditional UI** -- show or hide buttons, links, and sections based on permissions
- **Signing users in/out** -- after credential validation or OAuth callback
- **Defining custom roles** -- when the built-in roles are not granular enough

You do NOT need this module when:
- Serving fully public content with no role-dependent elements
- Working with API keys or external auth (handle those at the API-call level)

## How It Works

1. A page fetches the current user via `context.current_user` and a GraphQL query to load their profile (including roles)
2. The user's roles are checked against the required permission -- either via `authorization_policies/` in page front matter or an inline role check
3. If the role matches, access is granted; otherwise the page returns 403 or redirects

```
Request --> Load Profile (context.current_user + GraphQL) --> Check Roles --> Grant / Deny
```

### Quick example -- authorization policy (preferred for full-page guards)

```liquid
---
slug: admin/dashboard
authorization_policies:
  - modules/admin/policy
---
{% comment %} Page content only renders if the policy passes {% endcomment %}
```

### Quick example -- inline guard

```liquid
{% liquid
  if context.current_user
    graphql g = 'users/current', id: context.current_user.id
    assign profile = g.users.results.first
  else
    assign profile = null
  endif

  unless profile and profile.roles contains 'admin'
    response_status 403
    render 'errors/unauthorized'
    break
  endunless
%}
```

## Getting Started

1. At the top of every protected page, fetch the current user profile:

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

The `users/current` GraphQL query fetches the user's email, id, and roles:
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

2. Choose an enforcement strategy:

| Approach | Behavior | Best for |
|----------|----------|----------|
| `authorization_policies/` in front matter | Platform enforces before page renders | Full-page guards |
| Inline `unless profile.roles contains 'role'` | Manual guard with `response_status 403` | Page guards with custom logic |
| Inline `if profile.roles contains 'role'` | Conditional rendering | Showing/hiding UI elements |

3. Define custom roles in your permissions configuration (see [Configuration](configuration.md))

### Built-in roles

| Role | Description |
|------|-------------|
| `anonymous` | Unauthenticated visitors |
| `authenticated` | Any logged-in user |
| `superadmin` | Bypasses ALL permission checks |

## See Also

- [Authentication Configuration](configuration.md) -- role definitions, permission files, session setup
- [Authentication API](api.md) -- Liquid tags, helpers, and sign-in/sign-out interface
- [Authentication Patterns](patterns.md) -- common workflows for login, guards, and role-based UI
- [Authentication Gotchas](gotchas.md) -- common errors and platform limits
- [Authentication Advanced](advanced.md) -- multi-role users, custom permission logic, OAuth
- [Forms Reference](../forms/README.md) -- CSRF token handling for authenticated forms
- [Flash Messages](../flash-messages/README.md) -- feedback after login/logout actions
