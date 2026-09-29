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

### Problem: Treating Secure Headers as Trustworthy
```liquid
{{ context.headers.HTTP_X_FORWARDED_FOR }}
{%- comment %} Can be spoofed by clients {%- endcomment %}
```

**Solution:** Only trust headers from reverse proxy:
```liquid
{%- comment %} Validate that request came through trusted proxy {%- endcomment %}
{% if context.headers.HTTP_X_FORWARDED_FOR %}
  {%- assign ip = context.headers.HTTP_X_FORWARDED_FOR | split: ',' | first -%}
{% else %}
  {%- assign ip = context.visitor.ip -%}
{% endif %}
```

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

### Problem: Query String Not Parsed
```liquid
{{ context.location.search }}
{%- comment %} Returns raw string: "?page=1&sort=name" {%- endcomment %}
```

**Solution:** Use context.params instead:
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
