# Liquid Tags -- API Reference

Complete syntax reference for all 25 Insites-specific Liquid tags.

## graphql

Execute a GraphQL query or mutation.

```liquid
{% graphql result = "query_name" %}
{% graphql result = "query_name", param1: value1, param2: value2 %}
{% graphql result = "query_name", args: hash_variable %}
```

Inline query (no file):

```liquid
{% graphql result %}
  mutation {
    record_create(record: { table: "orders", properties: [{ name: "status", value: "pending" }] }) {
      id
    }
  }
{% endgraphql %}
```

Result is a hash with query name as key, or `errors` on failure.

## function

Call a partial as a function, capturing its return value.

```liquid
{% function result = 'path/to/partial' %}
{% function result = 'path/to/partial', arg1: val1, arg2: val2 %}
```

The partial MUST use `{% return %}` to send data back. Only passed arguments are accessible inside the partial.

## render

Render a partial template inline. Output replaces the tag.

```liquid
{% render 'path/to/partial' %}
{% render 'path/to/partial', product: product, show_price: true %}
```

## background

Run a partial asynchronously. `job_id` is the variable the tag assigns, and every other argument that is not an option becomes a variable inside the partial.

```liquid
{% background job_id = 'jobs/send_email', email: email, source_name: 'send_email', delay: 0.1, priority: 'low', max_attempts: 3 %}
```

A job sees only the variables passed to the tag, so pass everything it needs. The block form (`{% background %}...{% endbackground %}`) is listed as deprecated in the tag reference shipped with insites-cli 6.1.0, and has the same scope.

## cache

Cache a rendered fragment.

```liquid
{% cache 'product_list', expire: 3600 %}
  {% graphql products = 'products/search' %}
  {% render 'products/grid', products: products.records.results %}
{% endcache %}
```

## parse_json

**Deprecated** for JSON written in the template: `{% assign car = { "type": "SUV" } %}`
produces the same hash with no string in between, and a value spliced in with the
`json` filter becomes a plain expression (`{ "color": color }`). Keep `parse_json` for a
JSON string that arrives at runtime. See [types](../types/api.md). Existing blocks keep
working.

Parse a JSON string literal into a hash or array variable.

```liquid
{% parse_json config %}
  { "per_page": 20, "sort": "created_at", "tags": ["featured", "new"] }
{% endparse_json %}
```

Use Liquid interpolation inside the JSON body:

```liquid
{% parse_json payload %}
  { "name": {{ name | json }}, "email": {{ email | json }} }
{% endparse_json %}
```

## redirect_to

Issue an HTTP redirect.

```liquid
{% redirect_to '/products' %}
{% redirect_to '/old-page', status: 301 %}
{% comment %} A request parameter is never passed to redirect_to unchecked: see routing/gotchas.md, Open redirects {% endcomment %}
```

`redirect_to` takes a single value, not a filter chain. A filter after it is dropped with
no error: inside `{% liquid %}`, a `redirect_to` of `'/sign-in?stale=1&next='` followed by
`| append: enc_go` redirected to `/sign-in?stale=1&next=` (measured on a v6 production instance on
8 October 2026). Build the URL first, then redirect to the variable:

```liquid
{% liquid
  assign order_url = '/orders/' | append: order.id
  redirect_to order_url
%}
```

## session

Set or clear session data.

```liquid
{% session cart_id = order.id %}
{% session user_token = token %}
{% session cart_id = null %}
```

## log

Write to environment logs.

```liquid
{% log variable %}
{% log data, type: 'debug' %}
{% log error_msg, type: 'error', env: 'staging' %}
```

## sign_in

Authenticate a user.

```liquid
{% sign_in user_id: user.id %}
{% sign_in user_id: user.id, timeout_in_minutes: 120 %}
```

## transaction / rollback

Atomic database operations with optional manual rollback.

```liquid
{% transaction timeout: 5 %}
  {% graphql order = 'orders/create', data: order_data %}
  {% graphql _ = 'inventory/decrement', product_id: pid, qty: qty %}
  {% if order.errors %}
    {% rollback %}
  {% endif %}
{% endtransaction %}
```

## try / catch

Exception handling.

```liquid
{% try %}
  {% graphql result = 'external/api_call', url: url %}
{% catch error %}
  {% log error, type: 'error' %}
  {% assign result = nil %}
{% endtry %}
```

The error variable contains the exception message string.

## export

Share a variable from a partial via `context.exports`.

```liquid
{% export my_data, namespace: 'products' %}
```

Access later: `{{ context.exports.products.my_data }}`. `export` takes a list of variable names and an optional `namespace`; it creates no variables in the caller. Global Content is read this way: `{% include 'modules/insites_cms/globals' %}` exports `global`, then `{{ context.exports.global.company_name }}` (the v6 CMS module's `globals` partial; app-portal's layouts read it the same way). See [advanced](advanced.md#export-hand-values-out-of-a-partial).

## return

Return a value from a `function`-invoked partial. Stops execution of the partial.

```liquid
{% return result %}
{% return null %}
```

Since the 26 August 2026 platform release a `return` inside a `for` or `tablerow` loop
returns the value of the iteration it ran in, stops the loop and propagates out of nested
loops; `redirect_to` inside a loop stops the loop and the rest of the template. A
`return` inside an `include`d partial still goes nowhere: only `function` collects a
returned value.

## content_for / yield

Store markup in a named block (page/partial), render it in a layout.

```liquid
{% content_for 'page_scripts' %}
  <script src="{{ 'app.js' | asset_url }}"></script>
{% endcontent_for %}
```

In layout:

```liquid
{% yield 'page_scripts' %}
```

## response_status

Set the HTTP response status code.

```liquid
{% response_status 404 %}
{% response_status 201 %}
{% response_status 503 %}
```

`response_status` inside a partial called with `{% render %}` sets the page's status, and the partial's output is emitted. So two pages (a GET and a POST, since a page takes one method) can each be two lines that render one shared partial, and that partial can answer a 400. Measured on an instance in September 2026.

## response_headers

Set custom HTTP response headers. Pass a JSON string.

```liquid
{% response_headers '{"Content-Type": "application/json"}' %}
{% response_headers '{"Cache-Control": "no-store", "X-Robots-Tag": "noindex"}' %}
```

## hash_assign

**Deprecated.** `assign` now writes by dot and bracket notation and appends with `<<`
(`{% assign cart["items"] << new_item %}`), so there is one syntax for every
assignment; see [types](../types/api.md). `hash_assign` still works.

The equivalent `assign` forms (supports nested keys):

```liquid
{% assign user["name"] = "Alice" %}
{% assign config["settings"]["theme"] = "dark" %}
{% assign cart["items"] = cart["items"] | array_add: new_item %}
```

## print

Output without HTML escaping (unescaped). Writes the string exactly as it is. Not the same as `| html_safe`, which also decodes HTML entities (`&quot;` becomes `"`).

```liquid
{% print rendered_html %}
{% print svg_content %}
```

**Warning:** Never `print` user-supplied input as it arrives. To put a value in an HTML attribute, escape it first and then `print` the escaped string; `{{ }}` is not HTML-escaped, and `value="{{ x | escape }}"` was broken out of on a v6 staging instance on 15 October 2026. See [gotchas](gotchas.md#output-tags-are-not-html-escaped-an-escaped-quote-breaks-out-of-an-attribute).

```liquid
{%- assign email_attr = email | escape -%}
<input type="hidden" name="email" value="{% print email_attr %}">
```

## spam_protection

Render CAPTCHA markup for form spam protection.

```liquid
{% spam_protection "recaptcha_v2" %}
{% spam_protection "recaptcha_v3", action: "login" %}
{% spam_protection "hcaptcha" %}
```

## context (tag)

Set the locale for the current request.

```liquid
{% context language: 'en' %}
{% context language: 'de' %}
{% context language: context.params.lang %}
```

## theme_render_rc

Render a theme partial with configurable search paths.

```liquid
{% theme_render_rc 'header' %}
{% theme_render_rc 'components/button' %}
```

## form / include_form

Form rendering tags. Neither is deprecated: the tag reference shipped with insites-cli 6.1.0 marks both current, the CLI audit does not flag them (it flags `form_tag`), and the v6 CRM module uses `{% form %}` in `private/forms/sessions/lock_admin.liquid`. The Logic Engine still prefers plain HTML forms (rule `forms-no-form-tag`) for control over the markup.

```liquid
{% form %}
  <input name="name" value="">
{% endform %}

{% include_form 'contact_form' %}
```

## Output Escaping Summary

Measured on one v6 staging instance on 15 October 2026 (TW#26876514); see [gotchas](gotchas.md#output-tags-are-not-html-escaped-an-escaped-quote-breaks-out-of-an-attribute).

| Method | Escaped | Use For |
|--------|---------|---------|
| `{{ var }}` | No, unless the instance sets `escape_output_instead_of_sanitize: true` (it read `false` on two new v6 instances; see [configuration](../../configuration/README.md)). Output goes through a sanitizer, which removed an injected tag, kept an allowed `<b>` tag and did not keep a quote inside an attribute | Text you trust. Never untrusted text, in an attribute or between tags |
| `{{ var \| escape }}` | No, inside an attribute: the `&quot;` reached the browser as `"` and the attribute was broken out of | Not an attribute value |
| `{% print escaped %}`, where `escaped` was set with `\| escape` | Yes. The escaped string is written as it is | Any untrusted value, inside an HTML attribute or between tags |
| `{% print var %}` | No (raw) | Pre-sanitized HTML, SVG, trusted markup |
| `{{ var \| html_safe }}` | No, and it decodes entities: an `&quot;` in the value becomes a real `"`, which breaks out of an attribute | Trusted markup with no entities that must stay encoded. Not the same as `print` |

## See Also

- [Tags Overview](README.md) -- introduction and categories
- [Tags Configuration](configuration.md) -- detailed parameter tables
- [Tags Patterns](patterns.md) -- real-world usage examples
- [Tags Gotchas](gotchas.md) -- common errors and limits
- [Tags Advanced](advanced.md) -- optimization and edge cases
- [Liquid Filters API](../filters/api.md) -- filter syntax reference
- [Liquid Objects API](../objects/api.md) -- global object reference
