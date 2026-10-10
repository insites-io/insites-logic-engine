# Liquid Objects: Common Gotchas

Common pitfalls and how to avoid them when using Insites Liquid objects.

## context.current_user Gotcha

### Problem: Using Deprecated current_user
```liquid
{%- comment %} WRONG - This is deprecated {%- endcomment %}
{{ context.current_user.name }}
{{ context.current_user.email }}
```

**Why it's a problem:**
- Not guaranteed to be available
- Contains raw internal data structure
- May include sensitive information
- No guarantees about field availability

**Solution:** Always use context.exports with GraphQL:
```liquid
{%- comment %} CORRECT - Use exports {%- endcomment %}
{{ context.exports.user.name }}
{{ context.exports.user.email }}

{%- comment %} With proper fallback {%- endcomment %}
{%- if context.exports.user -%}
  {{ context.exports.user.name }}
{%- endif -%}
```

## Parameter Access Gotchas

### Problem: Assuming Parameters Always Exist
```liquid
{%- assign page = context.params.page -%}
{%- comment %} page is nil if not provided {%- endcomment %}
```

**Solution:** Always provide defaults:
```liquid
{%- assign page = context.params.page | default: 1 -%}
{%- assign page = context.params.page | plus: 0 -%}
{%- comment %} Convert to number if needed {%- endcomment %}
```

### Problem: String vs Number Parameters
```liquid
{%- assign limit = context.params.limit -%}
{%- assign products = all_products | slice: 0, limit -%}
{%- comment %} limit is a string, not a number {%- endcomment %}
```

**Solution:** Convert to proper type:
```liquid
{%- assign limit = context.params.limit | default: 10 | plus: 0 -%}
{%- assign products = all_products | slice: 0, limit -%}
```

### Problem: Parameter Pollution
```liquid
{%- comment %} Multiple values for same param: ?ids=1&ids=2&ids=3 {%- endcomment %}
{{ context.params.ids }}
{%- comment %} Behavior is undefined {%- endcomment %}
```

**Solution:** Handle as array explicitly:
```liquid
{%- assign ids = context.params.ids -%}
{%- if ids | type_of == 'array' -%}
  {%- for id in ids -%}
    {{ id }}
  {%- endfor -%}
{%- else -%}
  {%- assign ids = ids | split: ',' -%}
{%- endif -%}
```

## Session Management Gotchas

### Problem: Assuming Session Always Persists
```liquid
{%- assign cart = context.session.cart -%}
{%- comment %} Nil if session expired or cleared {%- endcomment %}
```

**Solution:** Check for nil:
```liquid
{%- if context.session.cart -%}
  {%- for item in context.session.cart -%}
    ...
  {%- endfor -%}
{%- else -%}
  <p>Cart is empty</p>
{%- endif -%}
```

### Problem: Session Not Automatically Saved
```liquid
{%- assign context.session.user_id = user.id -%}
{%- comment %} This may not persist {%- endcomment %}
```

**Solution:** Use GraphQL mutations to update session:
```graphql
mutation {
  setSessionVariable(key: "user_id", value: "123")
}
```

## Device Detection Gotchas

### Problem: Assuming Device Type Always Correct
```liquid
{%- if context.device.is_mobile -%}
  {%- comment %} May be inaccurate for some user agents {%- endcomment %}
{%- endif -%}
```

**Solution:** Use progressive enhancement:
```liquid
<div class="mobile-menu" style="display: none;">
  {%- comment %} CSS media queries override {%- endcomment %}
</div>
<style>
  @media (max-width: 768px) {
    .mobile-menu { display: block; }
  }
</style>
```

### Problem: Assuming Browser Type
```liquid
{%- if context.device.browser == 'Chrome' -%}
  {%- comment %} Detection can be spoofed {%- endcomment %}
{%- endif -%}
```

**Solution:** Use feature detection instead:
```liquid
<script>
  if (typeof WebAssembly !== 'undefined') {
    {%- comment %} WebAssembly is supported {%- endcomment %}
  }
</script>
```

## Headers and Cookies Gotchas

### Problem: Reading a Header by Its HTTP Name Returns Blank
```liquid
{{ context.headers['user-agent'] }}
{{ context.headers['User-Agent'] }}
{{ context.headers['USER-AGENT'] }}
{%- comment %} All three are blank. No error is raised. {%- endcomment %}
```

`context.headers` is keyed the CGI way, not by HTTP header name, so none of these keys exist. The failure is silent, which makes it dangerous in an auth check: a presence check (`if context.headers['X-Api-Key']`) is always false, and an equality check against a secret fails for every caller, **unless the expected value is also blank, in which case it passes for everyone**. Always check the expected value is not blank before comparing.

**Solution:** Uppercase the name, turn hyphens into underscores, and prefix `HTTP_`:
```liquid
{%- assign user_agent = context.headers.HTTP_USER_AGENT -%}
{%- assign api_key = context.headers.HTTP_X_API_KEY -%}
```

### Problem: Cookies Might Not Be Set
```liquid
{{ context.cookies.session_id }}
{%- comment %} Nil if cookie not set {%- endcomment %}
```

**Solution:** Check and provide fallback:
```liquid
{%- assign session = context.cookies.session_id | default: 'anonymous' -%}
```

### Problem: Reading the Visitor's Address from the Wrong Header

For a rate limit or an audit row you need the address the request came from. Read
`X-Real-IP`, or the **first** `X-Forwarded-For` entry, which holds the same value:

```liquid
{%- liquid
  assign ip = context.headers.HTTP_X_REAL_IP
  if ip == blank
    assign ip = context.headers.HTTP_X_FORWARDED_FOR | default: '' | split: ',' | first | strip
  endif
-%}
```

Measured on 9 October 2026 on a production and a staging instance, from one known address:

| Request | `HTTP_X_FORWARDED_FOR` | `HTTP_X_REAL_IP` |
|---|---|---|
| plain | `<visitor>, 10.244.1.70` | `<visitor>` |
| forged `X-Forwarded-For: 203.0.113.7` | `<visitor>, 10.244.0.122` | `<visitor>` |
| forged `X-Forwarded-For: 203.0.113.7, 198.51.100.9` | `<visitor>, 10.244.2.91` | `<visitor>` |
| forged `X-Real-IP: 203.0.113.8` | `<visitor>, ...` | `<visitor>` |

- **The edge replaces** a client-sent `X-Forwarded-For` and `X-Real-IP`. It does not append to them, so the first entry cannot be forged.
- **Never use the last entry.** It is an internal proxy address that changes from request to request (`10.244.3.102`, `10.244.2.91`, `10.244.1.70` across six plain calls). A limit keyed on it counts per proxy, not per visitor.
- A forged `Client-IP` or `CF-Connecting-IP` header is refused with a 403 before the page runs.
- **`True-Client-IP` and `Forwarded` pass through with whatever the client sent** (`HTTP_TRUE_CLIENT_IP=203.0.113.10`, `HTTP_FORWARDED=for=203.0.113.12`). Never trust either.
- `context.ip` is null. `context.visitor.ip` was not measured; the CLI's object reference lists `ip` as its only property, but what it holds is unverified, so read the header.
- The measurement covers one stack's edge. A stack without that edge may behave differently; check with a probe that returns these headers before relying on them.

## Location Object Gotchas

### Problem: Location Properties Are Strings
```liquid
{%- assign current_page = context.location.pathname -%}
{%- if current_page == '/products' -%}
  {%- comment %} This works, but watch for trailing slashes {%- endcomment %}
{%- endif -%}
```

**Solution:** Normalize paths:
```liquid
{%- assign path = context.location.pathname | replace: '//', '/' -%}
{%- assign path = path | split: '/' | join: '/' -%}
```

### Problem: search Is JSON, and href Is the Path
Measured on a v6 instance (prod01) on 6 October 2026, for `/docs?a=1&b=2`:

| Property | Renders |
|---|---|
| `context.location.search` | `{"a":"1","b":"2"}`, and `{}` with no query. The parsed parameters as JSON, **not** the raw `?a=1&b=2` |
| `context.location.href` | `/docs?a=1&b=2`. The path and the raw query, with no scheme or host |
| `context.location.host` | the host the request came in on, such as `example.com` |

So a redirect target built as `origin | append: pathname | append: search` is not an address.
`redirect_to` refuses it with `RedirectToTagError: invalid target in redirect_to tag`, and the
page renders that error **with a 200**, so nothing upstream notices. Build it from `href`:

```liquid
{%- assign target = 'https://new.example.com' | append: context.location.href -%}
{%- redirect_to target -%}
```

`redirect_to` works from a layout as well as a page, so one line at the top of a layout moves
every page that uses it. A page whose own body redirects first wins.

**To read one parameter**, use context.params:
```liquid
{{ context.params.page }}
{{ context.params.sort }}
{%- comment %} Already parsed and available {%- endcomment %}
```

## forloop Gotchas

### Problem: Using Incorrect forloop Index
```liquid
{%- for item in items limit: 5 offset: 10 -%}
  {{ forloop.index }}
  {%- comment %} Starts at 1, not 11 {%- endcomment %}
{%- endfor -%}
```

**Solution:** Calculate actual index if needed:
```liquid
{%- assign offset = 10 -%}
{%- for item in items limit: 5 offset: 10 -%}
  {{ forloop.index | plus: offset | minus: 1 }}
{%- endfor -%}
```

### Problem: parentloop Not Available Outside Nested Loop
```liquid
{%- for item in items -%}
  {{ forloop.parentloop }}
  {%- comment %} Nil - not in nested loop {%- endcomment %}
{%- endfor -%}
```

**Solution:** Only access in actually nested loop:
```liquid
{%- for category in categories -%}
  {%- for product in category.products -%}
    {{ forloop.parentloop.index }}
    {%- comment %} Now it's available {%- endcomment %}
  {%- endfor -%}
{%- endfor -%}
```

## tablerowloop Gotchas

### Problem: Incorrect Column Calculations
```liquid
{%- tablerow product in products cols:3 -%}
  {%- comment %} Column numbers restart at 1 for each row {%- endcomment %}
  Column: {{ tablerowloop.col }}
{%- endtablerow -%}
```

**Solution:** Calculate global column if needed:
```liquid
{%- tablerow product in products cols:3 -%}
  {%- assign global_col = tablerowloop.index | minus: 1 | modulo: 3 | plus: 1 -%}
{%- endtablerow -%}
```

## Environment Gotchas

### Problem: Assuming Staging URLs Match Production
```liquid
<img src="/images/logo.png">
{%- comment %} Path might be different in staging {%- endcomment %}
```

**Solution:** Use context.location for absolute URLs:
```liquid
<img src="{{ context.location.origin }}/images/logo.png">
```

### Problem: Accessing Production Constants in Staging
```liquid
{{ context.constants.production_api_key }}
{%- comment %} Might not be set in staging {%- endcomment %}
```

**Solution:** Check environment first:
```liquid
{%- if context.environment.is_production -%}
  {{ context.constants.production_api_key }}
{%- endif -%}
```

## Flash Messages Gotchas

### Problem: Flash Messages Persist Too Long
```liquid
{{ context.flash.notice }}
{%- comment %} Displayed, but may appear again if not cleared {%- endcomment %}
```

**Solution:** Flash messages auto-clear after display (framework handles this).

## See Also

- [Objects Configuration](configuration.md)
- [Objects API Reference](api.md)
- [Objects & Patterns](patterns.md)
- [Advanced Techniques](advanced.md)
