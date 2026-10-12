# Authentication -- Advanced Topics

Edge cases, complex scenarios, and advanced patterns for the authentication system.

## Custom Permission Logic

The default permission system uses a flat role-to-actions mapping. For more complex rules (e.g., ownership checks, time-based access), create custom partials that combine role checks with additional logic.

### Ownership-based access

```liquid
{% comment %} app/views/partials/lib/helpers/can_edit_own.liquid {% endcomment %}
{% liquid
  if requester == blank
    return false
  endif

  comment Check if user has the required role/permission
  assign permissions = '{"admin": ["products.update", "products.create", "products.delete"], "editor": ["products.update"], "superadmin": []}' | parse_json
  assign has_permission = false
  for role in requester.roles
    if role == 'superadmin'
      assign has_permission = true
      break
    endif
    if permissions[role] contains do
      assign has_permission = true
      break
    endif
  endfor

  if has_permission
    return true
  endif

  comment Fall back to ownership check
  if object.user_id == requester.id
    return true
  endif

  return false
%}
```

Usage:

```liquid
{% function can_edit = 'lib/helpers/can_edit_own',
  requester: profile,
  do: 'products.update',
  object: product
%}
```

### Time-based access

```liquid
{% comment %} app/views/partials/lib/helpers/can_do_during_hours.liquid {% endcomment %}
{% liquid
  if requester == blank
    return false
  endif

  comment Check role-based permission first
  assign has_permission = false
  for role in requester.roles
    if role == 'superadmin'
      assign has_permission = true
      break
    endif
  endfor

  unless has_permission
    assign permissions = '{"admin": ["products.update", "products.create", "products.delete"], "editor": ["products.update"], "superadmin": []}' | parse_json
    for role in requester.roles
      if permissions[role] contains do
        assign has_permission = true
        break
      endif
    endfor
  endunless

  unless has_permission
    return false
  endunless

  assign hour = 'now' | date: '%H' | plus: 0
  if hour >= start_hour and hour < end_hour
    return true
  endif
  return false
%}
```

## Multi-Role Users

Roles are stored as a `property_array` on user records, so users support multiple roles once the `roles` property is declared in `app/user.yml` (see [configuration](configuration.md#declare-the-roles-property-first)). The GraphQL query returns them as an array:

```graphql
query current($id: ID!) {
  users(per_page: 1, filter: { id: { value: $id } }) {
    results {
      id
      email
      roles: property_array(name: "roles")
    }
  }
}
```

### Assigning multiple roles

```graphql
mutation set_roles($id: ID!) {
  user_update(id: $id, user: {
    properties: [{ name: "roles", value_array: ["admin", "editor"] }]
  }) {
    id
  }
}
```

To choose the roles at run time, take `$roles: [String!]!` as in [configuration](configuration.md#assigning-roles-to-users) and build the list in Liquid with `split` (`'admin,editor' | split: ','`). An inline array literal as a `graphql` tag argument made a deploy fail in testing.

### Multi-role permission check

This iterates all of the user's roles and checks each against the permissions map:

```liquid
{% comment %} app/views/partials/lib/helpers/check_permission.liquid {% endcomment %}
{% liquid
  if requester == blank
    return false
  endif

  if requester.roles == blank
    return false
  endif

  assign permissions = '{"admin": ["products.create", "products.update", "products.delete"], "editor": ["products.create", "products.update"], "superadmin": []}' | parse_json

  for role in requester.roles
    if role == 'superadmin'
      return true
    endif
    assign role_actions = permissions[role]
    if role_actions contains do
      return true
    endif
  endfor

  return false
%}
```

## OAuth / External Authentication

When using an external identity provider (Google, GitHub, etc.), the flow is:

1. Redirect user to the provider's authorization URL
2. Provider redirects back with a code
3. Exchange the code for tokens via an API call
4. Find or create a local user record
5. Sign the user in with `{% sign_in %}`

### Callback handler

```liquid
---
slug: auth/callback
---
{% parse_json alert_flash %}
  { "alert": "app.auth.oauth_failed", "from": {{ context.location.pathname | json }} }
{% endparse_json %}
{% parse_json notice_flash %}
  { "notice": "app.auth.welcome", "from": {{ context.location.pathname | json }} }
{% endparse_json %}
{% liquid
  function result = 'lib/commands/auth/exchange_code', code: context.params.code

  if result.error
    assign flash_json = alert_flash | json
    session sflash = flash_json
    redirect_to '/login'
    break
  endif

  graphql existing = 'users/find_by_provider', provider: 'google', provider_id: result.provider_id

  if existing.records.results.first
    assign user = existing.records.results.first
  else
    graphql user = 'users/create_from_oauth', email: result.email, provider: 'google', provider_id: result.provider_id
  endif

  sign_in user_id: user.id, timeout_in_minutes: 1440
  assign flash_json = notice_flash | json
  session sflash = flash_json
  redirect_to '/'
%}
```

## API Token Authentication

For headless or mobile clients that cannot use cookie sessions, implement token-based auth.

### Token verification partial

```liquid
{% comment %} app/views/partials/lib/helpers/verify_api_token.liquid {% endcomment %}
{% liquid
  assign token = context.headers.HTTP_AUTHORIZATION | remove: 'Bearer '
  if token == blank
    return null
  endif

  graphql result = 'tokens/verify', token: token
  assign user = result.records.results.first
  return user
%}
```

### Protected API endpoint

```liquid
---
slug: api/v1/orders
layout: ""
---
{% liquid
  function profile = 'lib/helpers/verify_api_token'
  if profile == blank
    assign error = '{"error": "unauthorized"}' | parse_json
    render 'api/error', status: 401, body: error
    break
  endif

  graphql orders = 'orders/list', user_id: profile.id
  render 'api/orders/list', orders: orders
%}
```

## Remember Me / Extended Sessions

Implement "remember me" by varying the session timeout:

```liquid
{% liquid
  if context.params.remember_me == 'true'
    sign_in user_id: user.id, timeout_in_minutes: 43200
  else
    sign_in user_id: user.id, timeout_in_minutes: 60
  endif
%}
```

43200 minutes equals 30 days.

## Impersonation (Admin acting as another user)

Allow superadmins to sign in as another user for debugging:

```liquid
---
slug: admin/impersonate
method: post
authorization_policies:
  - require_superadmin
---
{% liquid
  assign target_id = context.params.user_id
  sign_in user_id: target_id, timeout_in_minutes: 30
  redirect_to '/'
%}
```

Or with an inline guard:

```liquid
---
slug: admin/impersonate
method: post
---
{% liquid
  if context.current_user
    graphql g = 'users/current', id: context.current_user.id
    assign profile = g.users.results.first
  else
    assign profile = null
  endif

  unless profile and profile.roles contains 'superadmin'
    response_status 403
    render 'errors/unauthorized'
    break
  endunless

  assign target_id = context.params.user_id
  sign_in user_id: target_id, timeout_in_minutes: 30
  redirect_to '/'
%}
```

**Warning:** Always restrict impersonation to `superadmin` or a dedicated admin action. Log every impersonation event.

## Rate Limiting Login Attempts

Insites does not have built-in rate limiting for login. Implement it using a record counter.

```liquid
{% comment %} In login handler, before authenticating {% endcomment %}
{% parse_json too_many_flash %}
  { "alert": "app.auth.too_many_attempts", "from": {{ context.location.pathname | json }} }
{% endparse_json %}
{% parse_json invalid_flash %}
  { "alert": "app.sessions.invalid_credentials", "from": {{ context.location.pathname | json }} }
{% endparse_json %}
{% liquid
  graphql attempts = 'auth/get_attempts', email: context.params.email
  assign count = attempts.records.results.first.properties.count | default: 0 | plus: 0

  if count >= 5
    assign flash_json = too_many_flash | json
    session sflash = flash_json
    render 'sessions/form'
    break
  endif

  graphql user = 'users/authenticate', email: context.params.email, password: context.params.password

  if user.user == blank
    graphql _ = 'auth/increment_attempts', email: context.params.email
    assign flash_json = invalid_flash | json
    session sflash = flash_json
    render 'sessions/form'
    break
  endif

  graphql _ = 'auth/clear_attempts', email: context.params.email
  sign_in user_id: user.user.id
  redirect_to '/'
%}
```

## Password Reset Flow

1. User submits email on a "forgot password" page
2. Generate a one-time token, store it on the user record
3. Send a reset email (via events/consumers) with a link containing the token
4. User clicks the link, lands on a reset page that validates the token
5. User submits a new password; update the record and sign them in

This pattern involves forms, emails, and auth working together. See [Emails-SMS Patterns](../emails-sms/patterns.md) for the email-sending portion.

## See Also

- [Authentication Overview](README.md) -- introduction and key concepts
- [Authentication Configuration](configuration.md) -- role definitions and session setup
- [Authentication API](api.md) -- tags, helpers, and mutations
- [Authentication Patterns](patterns.md) -- standard login and guard workflows
- [Authentication Gotchas](gotchas.md) -- common errors and limits
- [Emails-SMS Reference](../emails-sms/README.md) -- sending password reset emails
- [Background Jobs Reference](../background-jobs/README.md) -- async processing
