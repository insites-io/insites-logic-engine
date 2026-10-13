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

## Password reset by emailed link

A reset link built on the platform's own token: `temporary_token(expires_in:)` mints it, `authenticate { temporary_token(token:) }` checks it, and changing the password ends it. No token is stored. Every file below ran as written on a v6 production instance on 13 October 2026, where all eight cases passed: a valid link resets the password and the new password signs in; the same link after the reset is refused; a token past its expiry is refused; one account's token is refused for another; two links issued before a reset both work and the reset ends both; an unknown address gets the identical answer and no email; the per-address and per-network limits stop requests; a tampered token is refused. A POST without the form page's session, or with a forged authenticity token, was refused and changed nothing.

**A link works until the password changes or it expires.** Opening it does not use it up, and asking again does not end the older link. The recipe keeps the lifetime to **one hour** and says so in the email. See [Temporary Tokens](api.md#temporary-tokens) for the measured token behavior.

What it shares with [sign-in by emailed link or code](#sign-in-by-emailed-link-or-code): the same answer for every address, limits counted on every row, a session flag on every POST, and mail through a registered template with `data` as one variable.

**Build the link from a constant, not the request.** A link built from the request's host lets anyone who can change that header send a reset email pointing at their own site. Set `SITE_ORIGIN` once (for example `https://www.example.com`) with `constant_set`.

**Decide who may reset.** On an instance with the CRM, every contact is a user record, so this recipe as written lets any contact set a password and sign in. If only some people may sign in, check their role, or an allow-list, in the send page before minting a token, the same way the [email allow-list](#sign-in-by-emailed-link-or-code) does for sign-in.

The table, `app/schema/password_reset.yml`. It holds one row per request, for the limits only:

```yaml
name: password_reset
properties:
  - name: email
    type: string
  - name: ip
    type: string
  - name: status
    type: string
```

The visitor's address, `app/views/partials/password_reset/client_ip.liquid`:

```liquid
{%- comment -%}
  The visitor network address, for rate limits. Called with:
    function ip = 'password_reset/client_ip'
  X-Real-IP and the FIRST X-Forwarded-For entry hold the address the edge saw. The LAST
  X-Forwarded-For entry is an internal address, so never limit on it.
{%- endcomment -%}
{%- liquid
  assign ip = context.headers.HTTP_X_REAL_IP
  if ip == blank
    assign xff = context.headers.HTTP_X_FORWARDED_FOR | default: 'unknown'
    assign ip = xff | split: ',' | first | strip
  endif
  assign ip = ip | truncate: 60, ''
  return ip
-%}
```

The token check, `app/views/partials/password_reset/check_token.liquid`:

```liquid
{%- comment -%}
  Called with:
    function user_id = 'password_reset/check_token', email: email, token: token
  Returns the id of the account with that email when the token is live for that account,
  or blank. The platform refuses a token once it has expired or the password has changed.
{%- endcomment -%}
{%- assign user_id = '' -%}
{%- if email != blank and token != blank -%}
  {%- graphql chk, em: email, tok: token -%}
  query ($em: String, $tok: String!) {
    u: user(email: $em, is_deleted: false) { id authenticate { temporary_token(token: $tok) } }
  }
  {%- endgraphql -%}
  {%- if chk.u.authenticate.temporary_token == true -%}
    {%- assign user_id = chk.u.id -%}
  {%- endif -%}
{%- endif -%}
{%- return user_id -%}
```

**The form page**, `app/views/pages/password-reset.liquid`, sets the session flag both POST pages check:

```liquid
---
slug: password-reset
---
{%- session reset_form = 'on' -%}
{%- if context.params.sent == '1' -%}
  <p>If that address has an account, a reset link is on its way. It works for one hour.</p>
{%- elsif context.params.stale == '1' -%}
  <p>That link has expired or has already been used. Enter your email address for a new one.</p>
{%- endif -%}
<form method='post' action='/password-reset/send'>
  <input type='hidden' name='authenticity_token' value='{{ context.authenticity_token }}'>
  <label for='email'>Email address</label>
  <input id='email' name='email' type='email' autocomplete='email' required>
  <button type='submit'>Email me a reset link</button>
</form>
```

**Send the link**, `app/views/pages/password-reset/send.liquid`. Same redirect for every address; 5 requests per address and 20 per network address in 15 minutes; the link lasts one hour:

```liquid
---
slug: password-reset/send
method: post
layout: ''
---
{%- liquid
  unless context.session.reset_form == 'on'
    redirect_to '/password-reset'
  endunless
  assign email = context.params.email | default: '' | strip | downcase
  assign valid = false
  if email contains '@' and email.size > 5 and email.size < 255
    assign valid = true
  endif
  if email contains ' '
    assign valid = false
  endif
  function ip = 'password_reset/client_ip'
  assign now_unix = 'now' | date: '%s' | plus: 0
  assign since_iso = now_unix | minus: 900 | date: '%Y-%m-%dT%H:%M:%SZ'
-%}
{%- graphql look, t: 'password_reset', f_email: 'email', f_ip: 'ip', em: email, ip: ip, since: since_iso -%}
query ($t: String, $f_email: String!, $f_ip: String!, $em: String, $ip: String, $since: String) {
  for_email: records(per_page: 1, filter: { table: { value: $t }, created_at: { gte: $since }, properties: [{ name: $f_email, value: $em }] }) { total_entries }
  for_ip: records(per_page: 1, filter: { table: { value: $t }, created_at: { gte: $since }, properties: [{ name: $f_ip, value: $ip }] }) { total_entries }
  account: users(per_page: 1, filter: { email: { value: $em } }) { results { id } }
}
{%- endgraphql -%}
{%- if valid and look.for_email.total_entries < 5 and look.for_ip.total_entries < 20 -%}
  {%- liquid
    assign row_status = 'miss'
    if look.account.results.size > 0
      assign row_status = 'sent'
    endif
  -%}
  {%- graphql row, t: 'password_reset', f_email: 'email', f_ip: 'ip', f_status: 'status', em: email, ip: ip, st: row_status -%}
  mutation ($t: String!, $f_email: String!, $f_ip: String!, $f_status: String!, $em: String!, $ip: String!, $st: String!) {
    record_create(record: { table: $t, properties: [
      { name: $f_email, value: $em }
      { name: $f_ip, value: $ip }
      { name: $f_status, value: $st }
    ] }) { id }
  }
  {%- endgraphql -%}
  {%- if row_status == 'sent' -%}
    {%- graphql found, em: email, h: 1.0 -%}
    query ($em: String, $h: Float) {
      u: user(email: $em, is_deleted: false) { id temporary_token(expires_in: $h) }
    }
    {%- endgraphql -%}
    {%- liquid
      assign enc_e = email | url_encode
      assign enc_t = found.u.temporary_token | url_encode
      assign link = context.constants.SITE_ORIGIN | append: '/password-reset/link?e=' | append: enc_e | append: '&t=' | append: enc_t
      assign mail = {}
      assign mail.to = email
      assign mail.link = link
    -%}
    {%- graphql sent, tpl: 'password_reset_link', d: mail -%}
    mutation ($tpl: String!, $d: HashObject) {
      email_send(template: { name: $tpl }, data: $d) { is_scheduled_to_send }
    }
    {%- endgraphql -%}
  {%- endif -%}
{%- endif -%}
{%- redirect_to '/password-reset?sent=1' -%}
```

The email, `app/emails/password_reset_link.liquid`:

```liquid
---
to: '{{ data.to }}'
from: My Site <no-reply@insites.site>
subject: Reset your password
---
<p>Someone asked to reset the password for this address. Use this link to choose a new one. It works for one hour, and stops working once the password has been changed.</p>
<p><a href='{{ data.link | escape }}'>Choose a new password</a></p>
<p>If you did not ask for this, ignore this email. Your password stays as it is.</p>
```

**Open the link**, `app/views/pages/password-reset/link.liquid`. It checks the token and shows the form; it changes nothing, so a mail scanner opening it does no harm. The `referrer` meta keeps the token out of the `Referer` header of anything the page loads:

```liquid
---
slug: password-reset/link
---
{%- session reset_form = 'on' -%}
{%- liquid
  assign em = context.params.e | default: '' | strip | downcase
  assign tok = context.params.t | default: ''
  function user_id = 'password_reset/check_token', email: em, token: tok
-%}
<meta name='referrer' content='no-referrer'>
{%- if user_id == blank -%}
  <p>That link has expired or has already been used. <a href='/password-reset'>Ask for a new one</a>.</p>
{%- else -%}
  {%- if context.params.short == '1' -%}
    <p>Use between 10 and 72 characters.</p>
  {%- endif -%}
  <form method='post' action='/password-reset/save'>
    <input type='hidden' name='authenticity_token' value='{{ context.authenticity_token }}'>
    <input type='hidden' name='e' value='{{ em | escape }}'>
    <input type='hidden' name='t' value='{{ tok | escape }}'>
    <label for='password'>New password</label>
    <input id='password' name='password' type='password' autocomplete='new-password' minlength='10' maxlength='72' required>
    <button type='submit'>Save new password</button>
  </form>
{%- endif -%}
```

**Save the password**, `app/views/pages/password-reset/save.liquid`. It checks the session flag and the token again, saves with `user_update`, which ends the token, and signs the person in:

```liquid
---
slug: password-reset/save
method: post
layout: ''
---
{%- liquid
  unless context.session.reset_form == 'on'
    redirect_to '/password-reset?stale=1'
  endunless
  assign em = context.params.e | default: '' | strip | downcase
  assign tok = context.params.t | default: ''
  assign pw = context.params.password | default: ''
  function user_id = 'password_reset/check_token', email: em, token: tok
  if user_id == blank
    redirect_to '/password-reset?stale=1'
  endif
  if pw.size < 10 or pw.size > 72
    assign enc_e = em | url_encode
    assign enc_t = tok | url_encode
    assign back = '/password-reset/link?short=1&e=' | append: enc_e | append: '&t=' | append: enc_t
    redirect_to back
  endif
-%}
{%- graphql saved, id: user_id, pw: pw -%}
mutation ($id: ID!, $pw: String!) {
  user_update(id: $id, user: { password: $pw }) { id }
}
{%- endgraphql -%}
{%- liquid
  if saved.user_update.id == blank
    redirect_to '/password-reset?stale=1'
  endif
  sign_in user_id: user_id, timeout_in_minutes: 720
  redirect_to '/'
-%}
```

`redirect_to` ends the page, so nothing after a refusal runs. The page caps passwords at 72 characters because bcrypt, the only hash the instance checks, uses only the first 72 bytes.

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
