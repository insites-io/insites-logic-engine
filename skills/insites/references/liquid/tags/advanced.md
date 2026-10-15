# Insites Liquid Tags: Advanced Patterns

## Combining transaction + try/catch for Safe Multi-Step Operations

**Overview:** Use `transaction` for data consistency and `try/catch` for error recovery to safely execute complex, multi-step operations.

**Pattern:** Wrap transaction in try/catch to handle both committed state and rollback scenarios:

```liquid
{% try %}
  {% transaction timeout: 15 %}
    {% graphql create_order = 'mutations/create_order', items: cart_items %}
    {% assign order_id = create_order.order.id %}

    {% graphql charge = 'mutations/charge_payment', order_id: order_id, amount: total %}
    {% if charge.errors %}
      {% rollback %}
      {% return nil %}
    {% endif %}

    {% graphql update_inventory = 'mutations/update_inventory', items: cart_items %}
  {% endtransaction %}

  {% graphql send_confirmation = 'mutations/send_email', order_id: order_id, type: 'confirmation' %}

{% catch %}
  {% log level: 'error', message: 'Order failed', transaction_error: true %}
  {% return error %}
{% endtry %}
```

**Best Practices:**

- Keep transactions focused on data mutations (graphql)
- Use `rollback` to explicitly reverse partial state
- Post-transaction operations (emails, webhooks) go outside the transaction
- Handle GraphQL errors before they cascade to try/catch
- Set appropriate timeout based on operation complexity

**When to use each:**

| Scenario | Use transaction | Use try/catch |
|----------|-----------------|---------------|
| Multiple DB writes | Yes | Conditional |
| Payment processing | Yes | Yes (for error handling) |
| Parsing/type coercion | No | Yes |
| Email sending | No | Yes |
| Inventory updates | Yes | Conditional |

---

## Nested Function Calls and Performance Implications

**Overview:** Functions can call other functions, but excessive nesting impacts performance and readability.

**Optimal Pattern:** 2-3 levels of nesting maximum for production code:

```liquid
{% function process_checkout %}
  {% assign subtotal = cart | calculate_subtotal %}
  {% assign tax = subtotal | calculate_tax, state: address.state %}
  {% assign shipping = address | calculate_shipping, items: cart %}

  {% return subtotal | plus: tax | plus: shipping %}
{% endfunction %}

{% function calculate_subtotal %}
  {%- assign total = 0 -%}
  {%- for item in cart -%}
    {%- assign item_total = item.price | times: item.quantity -%}
    {%- assign total = total | plus: item_total -%}
  {%- endfor -%}
  {{ total }}
{% endfunction %}

{% function calculate_tax %}
  {%- assign rate = state | get_tax_rate -%}
  {%- return subtotal | times: rate -%}
{% endfunction %}
```

**Performance Considerations:**

- Function calls add ~1-5ms overhead per call
- Avoid recursion over large arrays; use filters instead
- Cache expensive function results in variables
- Prefer filter chaining over nested function calls

**Depth Limit:** Insites enforces a 50-level recursion limit to prevent infinite loops.

```liquid
{%- Anti-pattern: Deep recursion -%}
{% function factorial %}
  {% if n <= 1 %}
    {% return 1 %}
  {% else %}
    {% return n | times: factorial(n - 1) %}
  {% endif %}
{% endfunction %}

{%- Better: Use a loop -%}
{% function factorial %}
  {%- assign result = 1 -%}
  {%- for i in (1..n) -%}
    {%- assign result = result | times: i -%}
  {%- endfor -%}
  {%- return result -%}
{% endfunction %}
```

---

## Cache Key Strategies

**Overview:** Effective caching requires thoughtful key design to balance cache hits and data freshness.

### Per-User Caching

Cache variant per user to avoid serving other users' data:

```liquid
{% assign cache_key = 'user_dashboard_' | append: user.id %}
{% cache cache_key, expires: 3600 %}
  {% graphql user_stats = 'user_dashboard', user_id: user.id %}
  <div class="dashboard">
    {{ user_stats.stats.page_views }}
  </div>
{% endcache %}
```

**Invalidate** when user data changes:

```liquid
{% cache_clear key: 'user_dashboard_' | append: user.id %}
```

### Per-Page Caching

Cache by page slug for static or semi-static content:

```liquid
{% assign cache_key = 'page_content_' | append: page.slug %}
{% cache cache_key, expires: 7200 %}
  {% render 'partials/page_hero', page: page %}
  {% render 'partials/page_content', body: page.body %}
{% endcache %}
```

### Versioned Caching

Include version number to bust cache on content updates:

```liquid
{% assign version = settings.cache_version | default: '1' %}
{% assign cache_key = 'product_' | append: product.id | append: '_v' | append: version %}

{% cache cache_key, expires: 86400 %}
  {% render 'partials/product_card', product: product %}
{% endcache %}

{%- To bust cache, update settings.cache_version -%}
```

### Multi-Key Strategy

Combine multiple factors for granular cache control:

```liquid
{% assign user_segment = user.tier | default: 'guest' %}
{% assign cache_key = 'feed_' | append: user_segment | append: '_page_' | append: page.current %}

{% cache cache_key, expires: 1800 %}
  {% graphql feed = 'feed_by_tier', tier: user_segment, page: page.current %}
  {% for item in feed.items %}
    {% render 'partials/feed_item', item: item %}
  {% endfor %}
{% endcache %}
```

**Cache Key Best Practices:**

- Keep keys under 256 characters (longer keys are hashed)
- Include version number for bust-ability
- Use user/page/segment identifiers
- Avoid secrets or sensitive data in keys
- Log cache_key during development for debugging

---

## Background Job Patterns

**Overview:** Background jobs enable asynchronous processing. Master patterns for common use cases.

### Delayed Execution Pattern

Run a partial after a delay, given in minutes:

```liquid
{% background job_id = 'jobs/send_welcome_email', user_id: user.id, delay: 5 %}
```

```liquid
{% comment %} app/views/partials/jobs/send_welcome_email.liquid {% endcomment %}
{% graphql user = 'get_user', id: user_id %}
```

The job sees `user_id` because it was passed. It does not see `user`.

### Retry Pattern

Let the platform retry: `max_attempts` (1 to 5) reruns a job that fails.

```liquid
{% background job_id = 'jobs/process_payment', user_id: user_id, amount: amount, max_attempts: 3 %}
```

### Priority Management Pattern

`priority` takes `low`, `default` or `high`:

```liquid
{% liquid
  assign priority = 'default'
  if order.tier == 'vip'
    assign priority = 'high'
  endif
  background job_id = 'jobs/process_order', order_id: order.id, priority: priority
%}
```

**Job Execution Guarantees:**

- Jobs execute at least once (no guarantee of exactly-once)
- Execution not guaranteed within specified time window
- `delay` is in minutes and may be fractional (`0.5` is 30 seconds)
- Jobs may be retried on transient failure

---

## Export: hand values out of a partial

`{% export a, b, namespace: 'ns' %}` stores `a` and `b` under `context.exports.ns` for the rest of the request (insites-cli 6.1.0 tag reference). It creates no variables in the caller: read them from `context.exports`. With no `namespace`, the v6 CMS module's `globals` partial ends `{% export global %}` and its callers read `context.exports.global`.

```liquid
{%- comment -%} app/views/partials/pricing/compute.liquid {%- endcomment -%}
{% assign price = product.price | times: tax_multiplier %}
{% assign discount = price | times: discount_rate %}
{% assign final_price = price | minus: discount %}
{% export final_price, discount, namespace: 'pricing' %}

{%- comment -%} in the page {%- endcomment -%}
{% include 'pricing/compute', product: product, tax_multiplier: 1.1, discount_rate: 0.1 %}
Final price: {{ context.exports.pricing.final_price }}
```

For one value, prefer `{% function x = 'path' %}` with `{% return %}`: the caller gets it as a variable and nothing is left in `context.exports`.

## content_for with flush:true for Replacement

**Overview:** By default, `content_for` appends to blocks. Use `flush: true` to replace instead.

**Default Behavior (Append):**

```liquid
{%- Layout -%}
{% content_for header %}
  <h1>Default Header</h1>
{% endcontent_for %}

<main>
  {% yield header %}
</main>

{%- Page (appends to header block) -%}
{% content_for header %}
  <h2>Page-specific subtitle</h2>
{% endcontent_for %}

{%- Output: -%}
<h1>Default Header</h1>
<h2>Page-specific subtitle</h2>
```

**Replace Behavior (flush: true):**

```liquid
{%- Page (replaces header block) -%}
{% content_for header, flush: true %}
  <h1>Page-specific Header Only</h1>
{% endcontent_for %}

{%- Output: -%}
<h1>Page-specific Header Only</h1>
{%- (Default header is discarded) -%}
```

**Use Cases:**

- Override layout defaults completely
- Multi-step form progression (replace form on each step)
- Dynamic sidebars (replace instead of append)
- Modal content replacement

---

## Response Headers for CORS, CSP, and Custom Headers

**Overview:** Use `response_headers` tag to set HTTP response headers for CORS, security policies, and custom headers.

**CORS Headers:**

```liquid
{% response_headers set: true %}
  Access-Control-Allow-Origin: *
  Access-Control-Allow-Methods: GET, POST, OPTIONS
  Access-Control-Allow-Headers: Content-Type, Authorization
{% endresponse_headers %}
```

**Content Security Policy (CSP):**

```liquid
{% response_headers set: true %}
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' cdn.example.com; style-src 'self' 'unsafe-inline'
  X-Frame-Options: SAMEORIGIN
  X-Content-Type-Options: nosniff
{% endresponse_headers %}
```

**Custom Headers:**

```liquid
{% response_headers set: true %}
  X-Custom-Header: custom-value
  X-Request-ID: {{ request.id }}
  Cache-Control: public, max-age=3600
{% endresponse_headers %}
```

**Conditional Headers:**

```liquid
{% if user.is_premium %}
  {% response_headers set: true %}
    X-Premium-User: true
    Cache-Control: private, max-age=7200
  {% endresponse_headers %}
{% else %}
  {% response_headers set: true %}
    Cache-Control: public, max-age=300
  {% endresponse_headers %}
{% endif %}
```

**Best Practices:**

- Set headers early in the page/layout lifecycle
- Avoid setting conflicting headers multiple times
- Use `set: true` to replace existing headers; `set: false` to append
- Test header output with browser DevTools or curl

---

## Using print vs html_safe for Unescaped Output

**Overview:** Both `print` and `html_safe` output unescaped content, but usage contexts differ.

**print Tag:** Output unescaped HTML directly:

```liquid
{% assign markup = '<strong>Bold text</strong>' %}
{% print markup %}
{%- Output: <strong>Bold text</strong> -%}
```

**html_safe Filter:** Mark a string as safe from escaping:

```liquid
{% assign markup = '<em>Italic</em>' %}
{{ markup | html_safe }}
{%- Output: <em>Italic</em> -%}
```

**When to Use Each:**

| Scenario | Use print | Use html_safe |
|----------|-----------|---------------|
| Output raw HTML | Yes | No |
| Filter on a variable | No | Yes |
| Conditionally output markup | Either | Either |
| JSON or data structures | Yes | No |
| User-generated content | Neither (security risk) | Neither (security risk) |

**Security Warning:** Only use unescaped output for trusted content. Never use it on user input, and do not treat `{{ }}` as escaping: on v6 instances it sanitizes, which keeps allowed tags (see [gotchas](gotchas.md#output-tags-are-not-html-escaped-an-escaped-quote-breaks-out-of-an-attribute)).

```liquid
{% comment %} UNSAFE: user input written raw {% endcomment %}
{{ user.bio | html_safe }}

{% comment %} UNSAFE: {{ }} sanitizes rather than escapes, so allowed tags survive {% endcomment %}
{{ user.bio }}

{% comment %} SAFE: escaped into a variable, then printed as it is {% endcomment %}
{%- assign bio_text = user.bio | escape -%}
{% print bio_text %}
```

**Performance:** `print` and `html_safe` have negligible performance difference; prefer `html_safe` for consistency with Liquid idioms.

---

## See Also

- [Liquid Tags — overview](README.md)
- [Liquid Tags — API reference](api.md) (covers `transaction`, `try`/`catch`, `rollback`, `cache`, `function`, `export`, `content_for`, `response_headers`, `print`, `background`, etc.)
- [Liquid Tags — patterns](patterns.md)
- [Liquid Tags — gotchas](gotchas.md)
