# Authentication -- Patterns & Best Practices

Common workflows and real-world patterns for authentication and authorization in Insites.

## Login Flow

### Login form page (GET)

```liquid
---
slug: sessions/new
---
{% liquid
  if context.current_user
    redirect_to '/'
    break
  endif
  render 'sessions/form'
%}
```

### Login form partial

```html
<form method="post" action="/sessions">
  <input type="hidden" name="authenticity_token" value="{{ context.authenticity_token }}">

  <label for="email">Email</label>
  <input type="email" id="email" name="email" required>

  <label for="password">Password</label>
  <input type="password" id="password" name="password" required>

  <button type="submit">Sign In</button>
</form>
```

### Login handler (POST)

```liquid
---
slug: sessions
method: post
---
{% liquid
  graphql user = 'users/authenticate', email: context.params.email, password: context.params.password
%}
{% parse_json alert_flash %}
  { "alert": "app.sessions.invalid_credentials", "from": {{ context.location.pathname | json }} }
{% endparse_json %}
{% parse_json notice_flash %}
  { "notice": "app.sessions.signed_in", "from": {{ context.location.pathname | json }} }
{% endparse_json %}
{% liquid
  if user.user == blank
    assign flash_json = alert_flash | json
    session sflash = flash_json
    render 'sessions/form'
    break
  endif

  sign_in user_id: user.user.id, timeout_in_minutes: 1440
  assign flash_json = notice_flash | json
  session sflash = flash_json
  redirect_to '/'
%}
```

## Logout Flow

```liquid
---
slug: sessions
method: delete
---
{% parse_json flash %}
  { "notice": "app.sessions.signed_out", "from": {{ context.location.pathname | json }} }
{% endparse_json %}
{% liquid
  sign_out
  assign flash_json = flash | json
  session sflash = flash_json
  redirect_to '/'
%}
```

The logout form uses a hidden `_method` field:

```html
<form method="post" action="/sessions">
  <input type="hidden" name="authenticity_token" value="{{ context.authenticity_token }}">
  <input type="hidden" name="_method" value="delete">
  <button type="submit">Sign Out</button>
</form>
```

## Registration Flow

### Registration page (POST)

```liquid
---
slug: registrations
method: post
---
{% liquid
  function result = 'lib/commands/registrations/create', params: context.params
  if result.errors != blank
    render 'registrations/form', errors: result.errors, params: context.params
    break
  endif

  sign_in user_id: result.id, timeout_in_minutes: 1440
%}
{% parse_json flash %}
  { "notice": "app.registrations.welcome", "from": {{ context.location.pathname | json }} }
{% endparse_json %}
{% liquid
  assign flash_json = flash | json
  session sflash = flash_json
  redirect_to '/'
%}
```

## Page Guard Pattern

The most common auth pattern: protect a page so only authorized users can access it.

### Option 1: Authorization policy (preferred for full-page guards)

Define a policy file:

```liquid
{% comment %} app/authorization_policies/require_admin.liquid {% endcomment %}
---
name: require_admin
---
{% liquid
  if context.current_user == blank
    return false
  endif

  graphql g = 'users/current', id: context.current_user.id
  assign profile = g.users.results.first

  if profile.roles contains 'admin' or profile.roles contains 'superadmin'
    return true
  endif

  return false
%}
```

Reference it in the page front matter:

```liquid
---
slug: admin/dashboard
authorization_policies:
  - require_admin
---
{% comment %} Page content here -- only renders if policy passes {% endcomment %}
```

### Option 2: Inline guard

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

### Guard with login redirect for anonymous users

```liquid
{% liquid
  if context.current_user
    graphql g = 'users/current', id: context.current_user.id
    assign profile = g.users.results.first
  else
    redirect_to '/sign-in?return_to=' | append: context.location.pathname
    break
  endif

  unless profile.roles contains 'admin'
    response_status 403
    render 'errors/unauthorized'
    break
  endunless
%}
```

## Conditional UI Based on Role

Show or hide elements depending on the user's roles.

```liquid
{% liquid
  if context.current_user
    graphql g = 'users/current', id: context.current_user.id
    assign profile = g.users.results.first
  else
    assign profile = null
  endif
%}

<h1>{{ product.title }}</h1>

{% if profile.roles contains 'admin' or profile.roles contains 'editor' %}
  <a href="/products/{{ product.id }}/edit">Edit</a>
{% endif %}

{% if profile.roles contains 'admin' %}
  <form method="post" action="/products/{{ product.id }}">
    <input type="hidden" name="authenticity_token" value="{{ context.authenticity_token }}">
    <input type="hidden" name="_method" value="delete">
    <button type="submit">Delete</button>
  </form>
{% endif %}
```

## Admin Section Pattern

An entire area restricted to admin users.

### Option A: Authorization policy (cleanest)

```liquid
{% comment %} app/authorization_policies/require_admin.liquid {% endcomment %}
---
name: require_admin
---
{% liquid
  if context.current_user == blank
    return false
  endif
  graphql g = 'users/current', id: context.current_user.id
  assign profile = g.users.results.first
  if profile.roles contains 'admin' or profile.roles contains 'superadmin'
    return true
  endif
  return false
%}
```

Every admin page references the policy:

```liquid
---
slug: admin/users
authorization_policies:
  - require_admin
---
{% liquid
  graphql g = 'users/current', id: context.current_user.id
  assign profile = g.users.results.first
  graphql users = 'admin/users/list'
  render 'admin/users/index', users: users.records.results, profile: profile
%}
```

### Option B: Shared guard partial

Place the check in a shared partial rendered at the top of every admin page:

```liquid
{% comment %} app/views/partials/admin/guard.liquid {% endcomment %}
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

  return profile
%}
```

### Admin page using the guard partial

```liquid
---
slug: admin/users
---
{% liquid
  function profile = 'admin/guard'
  graphql users = 'admin/users/list'
  render 'admin/users/index', users: users.records.results, profile: profile
%}
```

## Multi-Role Permission Check

Check multiple permissions using the permissions map and pass results to a partial:

```liquid
{% liquid
  if context.current_user
    graphql g = 'users/current', id: context.current_user.id
    assign profile = g.users.results.first
  else
    assign profile = null
  endif

  assign can_create = false
  assign can_export = false

  if profile
    for role in profile.roles
      if role == 'superadmin'
        assign can_create = true
        assign can_export = true
        break
      endif
    endfor

    unless can_create
      assign permissions = '{"admin": ["products.create", "products.update", "products.delete", "products.export"], "editor": ["products.create", "products.update"], "superadmin": []}' | parse_json
      for role in profile.roles
        if permissions[role] contains 'products.create'
          assign can_create = true
        endif
        if permissions[role] contains 'products.export'
          assign can_export = true
        endif
      endfor
    endunless
  endif

  render 'products/toolbar', can_create: can_create, can_export: can_export
%}
```

## Sign-in by emailed link

For a tool whose users are invited rather than registered, a one-time emailed link replaces the password. The pattern below is the one proven on two Insites products (Nucleus, September 2026; the Insites Migration Tool, October 2026).

**Mint the link.** `temporary_token(expires_in:)` on the `user` query gives a short-lived token for one account; pair it with a random nonce stored in a request table, and email both in one URL. Only the nonce is stored. The platform token is never written anywhere.

```liquid
{%- graphql found, em: email, h: 0.25 -%}
query ($em: String, $h: Float) {
  u: user(email: $em, is_deleted: false) { id temporary_token(expires_in: $h) }
}
{%- endgraphql -%}
{%- assign nonce = 40 | random_string -%}
{%- comment -%} record_create a row: email, nonce, expires_at, status "pending" {%- endcomment -%}
```

**Opening the link changes nothing.** Email scanners and link-preview bots open every link before the person does. The link page checks the token and nonce and shows a button; a second request (`POST`) checks both again, marks the nonce consumed, and only then signs the person in. A link that signed in on `GET` would be consumed by the scanner.

**Answer the same for every address.** Whether or not the address is allowed a link, the page redirects to the same "check your email" result and writes a request row, so an attacker cannot learn who has access from the response. Limit requests per network address and live links per address, and read the address from `X-Real-IP` or the **first** `X-Forwarded-For` entry. The edge replaces both headers, so a client cannot forge them; the last entry is an internal proxy address that changes from request to request (see [objects gotchas](../liquid/objects/gotchas.md#problem-reading-the-visitors-address-from-the-wrong-header)).

**Invitations make the account.** An invited person has never signed in, so the link needs an account to belong to: create it with `user_create` and a long random password nobody is shown, then mint the link. Only a signed server-to-server request may do this; a session token or a page must not be able to create accounts for arbitrary addresses.

## Best Practices

1. **Always load the profile from `context.current_user`** -- every protected page starts by checking `context.current_user` and loading the full profile with roles via GraphQL
2. **Use `authorization_policies/` for full-page guards** -- this is the cleanest, most maintainable approach
3. **Use inline role checks for conditional UI** -- `profile.roles contains 'role'` for showing/hiding elements
4. **Authenticate before fetching data** -- check permissions before running GraphQL queries
5. **Use the permissions map for fine-grained actions** -- when simple role checks are not enough, use a permissions JSON map
6. **Keep action strings consistent** -- use `resource.verb` format (e.g., `products.create`, `orders.view`)
7. **Redirect after sign-in/sign-out** -- always redirect to prevent form resubmission
8. **Include CSRF token** -- every non-GET form must have the `authenticity_token` field

## See Also

- [Authentication Overview](README.md) -- introduction and key concepts
- [Authentication Configuration](configuration.md) -- role definitions and permission files
- [Authentication API](api.md) -- tags, helpers, and context objects
- [Authentication Gotchas](gotchas.md) -- common errors and limits
- [Pages Patterns](../pages/patterns.md) -- page-level guard and CRUD patterns
- [Forms Patterns](../forms/patterns.md) -- form submission with auth
