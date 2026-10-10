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

**Answer the same for every address.** Whether or not the address is allowed a link, the page redirects to the same "check your email" result and writes a request row, so an attacker cannot learn who has access from the response. Limit requests per network address and live links per address, and read the address from the **last** `X-Forwarded-For` hop, the one the edge appended; the first entry is whatever the client chose to send.

**Invitations make the account.** An invited person has never signed in, so the link needs an account to belong to: create it with `user_create` and a long random password nobody is shown, then mint the link. Only a signed server-to-server request may do this; a session token or a page must not be able to create accounts for arbitrary addresses.

## Moving people and their passwords from another platform

A person moved from another platform can keep their password only if the instance can check it. **The instance checks bcrypt and nothing else**, so a hash in any other format has to be checked by the site's own sign-in, once, and replaced by the instance's own hash at that moment. Everything below was measured on a v6 production instance on 10 October 2026 with throwaway accounts (TW#26866602).

**What `import_users` does with `encrypted_password`.** It stores any string without checking it. Only bcrypt works afterwards:

| Hash format | Where it comes from | Imported as `encrypted_password` | `authenticate { password }` |
|---|---|---|---|
| `$2a$`, `$2b$`, `$2y$` (any cost) | Insites, Siteglide, WordPress bcrypt plugins, Laravel, most PHP `password_hash` | Works as it stands | `true` for the right password, `false` for a wrong one |
| `$wp$2y$...` | WordPress 6.8 and later | Remove the leading `$wp` and import the rest | `false` for the password itself; `true` for the WordPress pre-hash (below) |
| `$P$`, `$H$` (phpass) | WordPress before 6.8 (and every account not signed in since), phpBB | **Do not import it.** Keep it apart (below) | The whole query fails with `invalid hash` |
| 32 hex characters (MD5) | WordPress before 2.5, many old PHP sites | **Do not import it** | Fails with `invalid hash` |
| `$6$`, `$1$`, `$argon2id$`, `pbkdf2_sha256$...`, plain text | Linux crypt, Argon2, Django and others | **Do not import it** | Fails with `invalid hash` |

A non-bcrypt value is worse than no password. `authenticate { password }` on that person raises `invalid hash` and the **whole GraphQL result is lost**, so any sign-in page that checks a password the ordinary way breaks for them, and the deprecated `user_session_create` answers *"the password for this user is corrupted, most likely due to the manual import. Make sure that encrypted_password is a valid bcrypt hash"*. A person imported with **no** `encrypted_password` is safe: the check answers `false`.

`import_users` also did not keep a `properties` value for a key the user schema does not declare (`{"legacy_password_hash": ...}` read back as `{"roles": null}`), so a foreign hash cannot ride on the person. Keep it in a table of its own.

**WordPress 6.8 and later.** WordPress stores `'$wp' . password_hash(base64_encode(hash_hmac('sha384', $password, 'wp-sha384', true)), PASSWORD_BCRYPT)`. Strip `$wp`, import the bcrypt part, and at sign-in check the pre-hash, which `compute_hmac` produces exactly:

```liquid
{%- assign pre = password | compute_hmac: 'wp-sha384', 'sha384', 'base64' -%}
```

**phpass (`$P$`, `$H$`) and MD5.** Import the person with no password, write the hash to a table such as `legacy_password` (`user_id`, `hash`), and check it in Liquid. phpass is MD5 iterated `2^n` times, where `n` is the position of the fourth character in `./0-9A-Za-z`; WordPress uses `B`, 8,192 rounds, which took 76 ms in Liquid. `digest: 'md5', 'none'` gives the raw 16 bytes the rounds chain on, and raw bytes can be appended to a string. The function:

```liquid
{%- comment -%} app/lib/legacy_password_check.liquid  ->  { match, upgrade, kind } {%- endcomment -%}
{%- assign res = { "match": false, "upgrade": false, "kind": "unknown" } -%}
{%- assign pfx = stored | slice: 0, 3 -%}
{%- if pfx == '$P$' or pfx == '$H$' -%}
  {%- assign res["kind"] = 'phpass' -%}
  {%- assign itoa = './0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz' | split: '' -%}
  {%- assign hexd = '0123456789abcdef' | split: '' -%}
  {%- assign imap = {} -%}{%- for ch in itoa -%}{%- assign imap[ch] = forloop.index0 -%}{%- endfor -%}
  {%- assign hmap = {} -%}{%- for ch in hexd -%}{%- assign hmap[ch] = forloop.index0 -%}{%- endfor -%}
  {%- assign c = stored | slice: 3, 1 -%}
  {%- assign lg = imap[c] -%}
  {%- if lg >= 7 and lg <= 30 and stored.size == 34 -%}
    {%- assign cnt = 1 -%}{%- for i in (1..lg) -%}{%- assign cnt = cnt | times: 2 -%}{%- endfor -%}
    {%- assign salt = stored | slice: 4, 8 -%}
    {%- assign hh = salt | append: password | digest: 'md5', 'none' -%}
    {%- for i in (1..cnt) -%}
      {%- if forloop.last -%}{%- assign hx = hh | append: password | digest: 'md5' -%}
      {%- else -%}{%- assign hh = hh | append: password | digest: 'md5', 'none' -%}{%- endif -%}
    {%- endfor -%}
    {%- assign bytes = [] -%}
    {%- for j in (0..15) -%}
      {%- assign o = j | times: 2 -%}{%- assign c1 = hx | slice: o, 1 -%}
      {%- assign o2 = o | plus: 1 -%}{%- assign c2 = hx | slice: o2, 1 -%}
      {%- assign bv = hmap[c1] | times: 16 | plus: hmap[c2] -%}
      {%- assign bytes << bv -%}
    {%- endfor -%}
    {%- assign enc = '' -%}
    {%- for g in (0..5) -%}
      {%- assign i = g | times: 3 -%}{%- assign val = bytes[i] -%}
      {%- assign i1 = i | plus: 1 -%}{%- assign i2 = i | plus: 2 -%}
      {%- if i1 < 16 -%}{%- assign val = bytes[i1] | times: 256 | plus: val -%}{%- endif -%}
      {%- if i2 < 16 -%}{%- assign val = bytes[i2] | times: 65536 | plus: val -%}{%- endif -%}
      {%- assign q = val | modulo: 64 -%}{%- assign enc = enc | append: itoa[q] -%}
      {%- assign q = val | divided_by: 64 | modulo: 64 -%}{%- assign enc = enc | append: itoa[q] -%}
      {%- if i1 < 16 -%}
        {%- assign q = val | divided_by: 4096 | modulo: 64 -%}{%- assign enc = enc | append: itoa[q] -%}
        {%- assign q = val | divided_by: 262144 | modulo: 64 -%}{%- assign enc = enc | append: itoa[q] -%}
      {%- endif -%}
    {%- endfor -%}
    {%- assign computed = stored | slice: 0, 12 | append: enc -%}
    {%- if computed == stored -%}{%- assign res["match"] = true -%}{%- assign res["upgrade"] = true -%}{%- endif -%}
  {%- endif -%}
{%- elsif stored.size == 32 -%}
  {%- assign res["kind"] = 'md5' -%}
  {%- assign m5 = password | digest: 'md5' -%}
  {%- if m5 == stored -%}{%- assign res["match"] = true -%}{%- assign res["upgrade"] = true -%}{%- endif -%}
{%- endif -%}
{%- return res -%}
```

**The sign-in.** Check the password the ordinary way first. Only when that fails, look for the person's row in the legacy table (phpass, MD5) or try the WordPress pre-hash (6.8 and later). On a match, set the password with `user_update(id:, user: { password: })`, delete the legacy row, and sign in. The person's next sign-in is an ordinary one, and their hash reads back as the instance's own `$2a$10$`:

```liquid
{% liquid
  graphql u = 'users/authenticate', email: email, password: password
  if u.user == blank
    comment Not the ordinary password. Try the hash the person brought with them. endcomment
    graphql row = 'legacy_password/find', email: email
    if row
      function chk = 'legacy_password_check', stored: row.hash, password: password
    else
      assign pre = password | compute_hmac: 'wp-sha384', 'sha384', 'base64'
      graphql u2 = 'users/authenticate', email: email, password: pre
      assign chk = { "match": false }
      if u2.user != blank
        assign chk = { "match": true }
      endif
    endif
    if chk.match
      graphql _ = 'users/set_password', id: person_id, password: password
      graphql _ = 'legacy_password/delete', email: email
      comment then sign_in as usual endcomment
    endif
  endif
%}
```

Measured end to end for `$P$`, `$H$`, MD5 and `$wp$2y$`: the wrong password was refused and changed nothing; the right one signed in, replaced the hash, deleted the legacy row, and from then on `authenticate { password }` answered `true` for it and `false` for a wrong one. A person who never signs in keeps the old hash in the legacy table; offer them the ordinary reset.

Never log or print the hash, and delete the legacy table once no row is left.

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
