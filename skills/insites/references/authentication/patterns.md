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

## Sign-in by emailed link or code

For a tool whose users are invited rather than registered, a one-time emailed link or a six-digit code replaces the password. Both variants below are proven on Insites: the link on two products (Nucleus, September 2026; the Insites Migration Tool, October 2026), and the code on a production instance on 9 October 2026, where all nine test cases passed (right code, wrong code, five wrong then right, expired, reuse, another address's code, unknown address, request limit, post without a valid token).

### What both variants share

- **The allow-list is the users that exist.** An address may sign in when a `user` with that email exists. Invitations make the account (see the end of this section).
- **The same answer for every address.** A request for an address with no account writes a row with status `miss`, sends nothing, and answers exactly like a real one, so the response never tells an attacker who has access. Measured: 0.31 to 0.35 s for an unknown address against 0.33 to 0.40 s for a known one. The known address is 50 to 80 ms slower because mail is queued; the gap is small and is not removed.
- **Limits count every row**, allowed or not: per email and per network address over a window. Read the address from `X-Real-IP` or the **first** `X-Forwarded-For` entry; the last entry is an internal proxy address (see [objects gotchas](../liquid/objects/gotchas.md#problem-reading-the-visitors-address-from-the-wrong-header)).
- **POST pages check a session flag.** A POST without a valid `authenticity_token` is not refused; it arrives with an **empty session**. A sign-in endpoint never reads `context.current_user`, so the token check does nothing for it unless the page looks. The form page sets a flag and the POST page refuses without it ([forms gotchas](../forms/gotchas.md#comparing-the-authenticity-token-yourself)). Measured: no token, no session cookie, and a forged token each got 403 and wrote no row.
- **Email through a registered template only.** `email_send(template: { name: "..." }, data: $d)` with `data` built as one Liquid variable. An inline `email: {...}` with no template, or a GraphQL object literal holding variables as `data`, answers `is_scheduled_to_send: true` and sends nothing.

Shared partials (`app/views/partials/signin/`):

```liquid
{%- comment -%} signin/client_ip.liquid. Called as: function ip = 'signin/client_ip' {%- endcomment -%}
{%- liquid
  assign ip = context.headers.HTTP_X_REAL_IP
  if ip == blank
    assign ip = context.headers.HTTP_X_FORWARDED_FOR | default: 'unknown' | split: ',' | first | strip
  endif
  assign ip = ip | truncate: 60, ''
  return ip
-%}
```

```liquid
{%- comment -%}
  signin/take_slot.liquid. Claims one of `count` slots for `key`, atomically.
  Called as: function won = 'signin/take_slot', key: row_id, label: 'try', count: 5
  Returns the slot number won (1 to count), or 0 when every slot is taken.
  external_id is unique per table, so when requests race for one slot exactly one create succeeds.
{%- endcomment -%}
{%- assign won = 0 -%}
{%- for n in (1..count) -%}
  {%- if won == 0 -%}
    {%- assign ext = key | append: '-' | append: label | append: '-' | append: n -%}
    {%- graphql slot, ext: ext -%}
    mutation ($ext: String) {
      record_create(record: { table: "signin_code", external_id: $ext, properties: [{ name: "status", value: "slot" }] }) { id }
    }
    {%- endgraphql -%}
    {%- if slot.record_create.id != blank -%}
      {%- assign won = n -%}
    {%- endif -%}
  {%- endif -%}
{%- endfor -%}
{%- return won -%}
```

**Why slots and not a counter.** Sixteen sessions posting at once, measured on 9 October 2026:

| How the limit was kept | Test | Result |
|---|---|---|
| Read the count, then `records_update_all` with a `value` filter on the old count | 16 wrong guesses, limit 5 | **14 evaluated** |
| Same | 8 right codes at once | **2 signed in** |
| `increment: 1`, then read back | 16 right codes, twice | **2 signed in each time** |
| One row per slot, unique `external_id` | 16 wrong guesses, limit 5 | **5 evaluated**, 11 refused |
| Same | 16, 8 and 4 right codes at once | **exactly 1 signed in each time** |

Reading a counter and writing it back is not atomic, and neither is `increment`. A unique `external_id` is: the losing creates fail with "External has already been taken". The cost is that anyone who knows an address can use up its five slots, which ends that code; the person asks for a new one, the same as after five wrong guesses.

### Variant 1: a six-digit code

The table, `app/schema/signin_code.yml`. Only a keyed hash of the code is stored, never the code:

```yaml
name: signin_code
properties:
  - name: email        # lowercased
    type: string
  - name: code_hash    # HMAC-SHA256 of "email:code", keyed with the SIGNIN_HMAC_KEY constant
    type: string
  - name: expires_at
    type: datetime
  - name: status       # pending, consumed, killed, miss (no account), slot (see take_slot)
    type: string
  - name: ip
    type: string
```

The hash binds the email in, so a code issued to one address can never match another address's row. It returns blank when the key is not set, and every caller treats blank as a refusal:

```liquid
{%- comment -%} signin/code_hash.liquid. Called as: function h = 'signin/code_hash', email: email, code: code {%- endcomment -%}
{%- liquid
  assign h = ''
  assign key = context.constants.SIGNIN_HMAC_KEY
  if key != blank
    assign msg = email | append: ':' | append: code
    assign h = msg | compute_hmac: key
  endif
  return h
-%}
```

**The form page** sets the session flag the two endpoints check:

```liquid
---
slug: sign-in-code
---
{%- session signin_form = 'on' -%}
<form method="post" action="/sign-in-code/request">
  <input type="hidden" name="authenticity_token" value="{{ context.authenticity_token }}">
  <input name="email" type="email" autocomplete="email" required>
  <button type="submit">Email me a code</button>
</form>
<form method="post" action="/sign-in-code/verify">
  <input type="hidden" name="authenticity_token" value="{{ context.authenticity_token }}">
  <input name="email" type="email" autocomplete="email" required>
  <input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" required>
  <button type="submit">Sign in</button>
</form>
```

Both endpoints answer JSON (`{"code": "..."}`), so post the forms with `fetch` and show a message per code.

**Request a code.** Same answer for every address; 5 requests per email and 20 per network address in 15 minutes; a code lives 10 minutes:

```liquid
---
slug: sign-in-code/request
method: post
format: json
layout: ""
---
{%- comment -%} public endpoint: anyone may ask for a code. Answers code_sent, invalid, too_many or blocked. {%- endcomment -%}
{%- liquid
  assign status = 200
  assign result = 'code_sent'
  assign email = context.params.email | default: '' | strip | downcase
  assign valid = false
  if email contains '@'
    assign valid = true
  endif
  if email contains ' ' or email.size < 6 or email.size > 254
    assign valid = false
  endif
  if context.session.signin_form != 'on'
    assign status = 403
    assign result = 'blocked'
  elsif valid == false
    assign status = 422
    assign result = 'invalid'
  endif
-%}
{%- if result == 'code_sent' -%}
  {%- liquid
    function ip = 'signin/client_ip'
    assign now = 'now' | date: '%s' | plus: 0
    assign since = now | minus: 900 | date: '%Y-%m-%dT%H:%M:%SZ'
  -%}
  {%- graphql look, em: email, ip: ip, since: since -%}
  query ($em: String, $ip: String, $since: String) {
    by_email: records(per_page: 1, filter: { table: { value: "signin_code" }, created_at: { gte: $since }, properties: [{ name: "email", value: $em }] }) { total_entries }
    by_ip: records(per_page: 1, filter: { table: { value: "signin_code" }, created_at: { gte: $since }, properties: [{ name: "ip", value: $ip }] }) { total_entries }
    user: users(per_page: 1, filter: { email: { value: $em } }) { results { id } }
  }
  {%- endgraphql -%}
  {%- if look.by_email.total_entries >= 5 or look.by_ip.total_entries >= 20 -%}
    {%- assign status = 429 -%}
    {%- assign result = 'too_many' -%}
  {%- endif -%}
{%- endif -%}
{%- if result == 'code_sent' -%}
  {%- liquid
    comment
      random_string is alphanumeric: keep its digits and top up until there are six.
    endcomment
    assign code = ''
    for i in (1..10)
      assign digits = 32 | random_string | replace_regex: '[^0-9]', ''
      assign code = code | append: digits
      if code.size >= 6
        break
      endif
    endfor
    assign code = code | slice: 0, 6
    function h = 'signin/code_hash', email: email, code: code
    assign row_status = 'miss'
    if look.user.results.size > 0
      assign row_status = 'pending'
    endif
    assign expires = now | plus: 600 | date: '%Y-%m-%dT%H:%M:%SZ'
  -%}
  {%- if h == blank -%}
    {%- assign status = 503 -%}
    {%- assign result = 'blocked' -%}
  {%- else -%}
    {%- graphql row, em: email, h: h, exp: expires, st: row_status, ip: ip -%}
    mutation ($em: String!, $h: String!, $exp: String!, $st: String!, $ip: String!) {
      record_create(record: { table: "signin_code", properties: [
        { name: "email", value: $em } { name: "code_hash", value: $h } { name: "expires_at", value: $exp }
        { name: "status", value: $st } { name: "ip", value: $ip }
      ] }) { id }
    }
    {%- endgraphql -%}
    {%- if row_status == 'pending' -%}
      {%- assign mail = { "to": email, "code": code } -%}
      {%- graphql sent, d: mail -%}
      mutation ($d: HashObject) { email_send(template: { name: "signin_code" }, data: $d) { is_scheduled_to_send } }
      {%- endgraphql -%}
    {%- endif -%}
  {%- endif -%}
{%- endif -%}
{%- response_status status -%}
{%- assign out = { "code": result } -%}
{{ out | json }}
```

The email, `app/emails/signin_code.liquid`:

```liquid
---
to: '{{ data.to }}'
from: My App <no-reply@example.com>
subject: 'Your sign-in code: {{ data.code }}'
---
<p>Your sign-in code is <strong>{{ data.code | escape }}</strong>. It works once, for 10 minutes.</p>
```

**Check the code.** Only the newest request for the address counts, and it must be pending and unexpired. Every guess first claims one of five `try` slots; a right code then claims the single `use` slot, so neither the guess limit nor "works once" can be beaten by sending many requests at once:

```liquid
---
slug: sign-in-code/verify
method: post
format: json
layout: ""
---
{%- comment -%} public endpoint: checks a code and signs the person in. Answers ok, invalid, expired, too_many or blocked. {%- endcomment -%}
{%- liquid
  assign status = 401
  assign result = 'invalid'
  assign checked = false
  assign guess = 0
  assign email = context.params.email | default: '' | strip | downcase
  assign code = context.params.code | default: '' | remove: ' ' | strip
  if context.session.signin_form != 'on'
    assign status = 403
    assign result = 'blocked'
  endif
-%}
{%- if result == 'invalid' and email != blank and code != blank -%}
  {%- graphql look, em: email -%}
  query ($em: String) {
    req: records(per_page: 1, sort: [{ created_at: { order: DESC } }], filter: { table: { value: "signin_code" }, properties: [{ name: "email", value: $em }] }) {
      results { id status: property(name: "status") code_hash: property(name: "code_hash") expires_at: property(name: "expires_at") }
    }
    user: users(per_page: 1, filter: { email: { value: $em } }) { results { id } }
  }
  {%- endgraphql -%}
  {%- liquid
    assign r = look.req.results | first
    assign now = 'now' | date: '%s' | plus: 0
    if r.status == 'killed'
      assign status = 429
      assign result = 'too_many'
    elsif r.status == 'pending'
      assign exp = r.expires_at | date: '%s' | plus: 0
      if exp <= now
        assign status = 410
        assign result = 'expired'
      else
        assign checked = true
      endif
    endif
  -%}
{%- endif -%}
{%- if checked -%}
  {%- function guess = 'signin/take_slot', key: r.id, label: 'try', count: 5 -%}
  {%- function h = 'signin/code_hash', email: email, code: code -%}
  {%- if guess == 0 -%}
    {%- assign status = 429 -%}
    {%- assign result = 'too_many' -%}
  {%- elsif h != blank and h == r.code_hash and look.user.results.size > 0 -%}
    {%- function use = 'signin/take_slot', key: r.id, label: 'use', count: 1 -%}
    {%- if use == 1 -%}
      {%- graphql used, id: r.id -%}
      mutation ($id: ID!) {
        records_update_all(table: "signin_code", sync: true, filter: { id: { value: $id } }, record: { properties: [{ name: "status", value: "consumed" }] }) { count }
      }
      {%- endgraphql -%}
      {%- assign user_id = look.user.results.first.id -%}
      {%- sign_in user_id: user_id, timeout_in_minutes: 720 -%}
      {%- assign status = 200 -%}
      {%- assign result = 'ok' -%}
    {%- endif -%}
  {%- endif -%}
{%- endif -%}
{%- if result == 'too_many' or result == 'invalid' and guess == 5 -%}
  {%- graphql killed, id: r.id -%}
  mutation ($id: ID!) {
    records_update_all(table: "signin_code", sync: true, filter: { id: { value: $id }, properties: [{ name: "status", value: "pending" }] }, record: { properties: [{ name: "status", value: "killed" }] }) { count }
  }
  {%- endgraphql -%}
  {%- assign status = 429 -%}
  {%- assign result = 'too_many' -%}
{%- endif -%}
{%- response_status status -%}
{%- assign out = { "code": result } -%}
{{ out | json }}
```

Liquid groups `and` and `or` from the right, so the kill condition reads `too_many or (invalid and guess == 5)`, which is what it means here. A wrong fifth guess ends the request, so the right code after it answers `too_many`; a newer request makes every older code answer `invalid`.

### Variant 2: an emailed link

**Mint the link.** `temporary_token(expires_in:)` on the `user` query gives a short-lived token for one account; `expires_in` is in **hours**, as a Float. Pair it with a random nonce stored in a request table (`signin_link`: email, nonce, expires_at, status), and email both in one URL. Only the nonce is stored. The platform token is never written anywhere.

```liquid
{%- graphql found, em: email, h: 0.25 -%}
query ($em: String, $h: Float) {
  u: user(email: $em, is_deleted: false) { id temporary_token(expires_in: $h) }
}
{%- endgraphql -%}
{%- assign nonce = 40 | random_string -%}
{%- comment -%} record_create a signin_link row: email, nonce, expires_at, status "pending" {%- endcomment -%}
```

**Check the link** on both requests. All four must hold: the nonce is a pending request, the request belongs to this address, it has not expired, and the platform confirms the token belongs to that address's account and is still live:

```liquid
{%- graphql chk, em: email, non: nonce, tok: token -%}
query ($em: String, $non: String, $tok: String!) {
  req: records(per_page: 1, filter: { table: { value: "signin_link" }, properties: [{ name: "nonce", value: $non }, { name: "status", value: "pending" }] }) {
    results { id email: property(name: "email") expires_at: property(name: "expires_at") }
  }
  u: user(email: $em, is_deleted: false) { id authenticate { temporary_token(token: $tok) } }
}
{%- endgraphql -%}
{%- liquid
  assign r = chk.req.results | first
  assign ok = false
  if r != blank and r.email == email and chk.u.authenticate.temporary_token == true
    assign exp = r.expires_at | date: '%s' | plus: 0
    assign now = 'now' | date: '%s' | plus: 0
    if exp > now
      assign ok = true
    endif
  endif
-%}
```

**Opening the link changes nothing.** Email scanners and link-preview bots open every link before the person does. The link page (`GET`) runs the check and shows a button; the button posts to a second page that runs the check again, uses the link, and only then signs the person in. A link that signed in on `GET` would be used up by the scanner. Use it with the same claim as the code: `function use = 'signin/take_slot', key: r.id, label: 'use', count: 1`, and sign in only when `use == 1`. The Migration Tool marks the row consumed with `record_update` instead; the race measurement above shows a read-then-write step can let two concurrent posts through.

**Same answer, and limits.** Whether or not the address is allowed a link, the request page redirects to the same "check your email" result and writes a row. The Migration Tool allows 30 requests per network address in 10 minutes and 5 live links per email.

**Invitations make the account.** An invited person has never signed in, so the link needs an account to belong to: create it with `user_create` and a long random password nobody is shown (`48 | random_string`), then mint the link. Only a signed server-to-server request may do this; a session token or a page must not be able to create accounts for arbitrary addresses.

### Traps measured while building it

- **A property written through `value` is stored as text**, so a later `value_int` filter does not match it. Written through `value_int` or `increment`, both filters match. Filter the way you wrote.
- **A number passed as a property `value` fails the whole mutation with no exception.** The result carries only an `errors` key and nothing is written. Pass a string: `{%- assign n_text = n | append: '' -%}`.
- **`records_update_all` with a filter on the old value is not a compare-and-swap**, and `increment: 1` loses updates under concurrency. Claim with a unique `external_id` instead (`signin/take_slot` above).
- **`{% liquid %}` cannot hold a `graphql` block.** Each query needs its own tag, so a loop over queries goes in a partial called with `function`.

## Best Practices

1. **Always load the profile from `context.current_user`** -- every protected page starts by checking `context.current_user` and loading the full profile with roles via GraphQL (the `roles` property must be declared in `app/user.yml` first; see [configuration](configuration.md#declare-the-roles-property-first))
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
