# Insites Liquid Tags: Common Gotchas & Troubleshooting

## Line-Wrapped Statements in {% liquid %} Blocks

**Error:** Syntax error or unexpected output when using multiple lines within a liquid block.

**Cause:** The `{% liquid %}` tag requires each statement to remain on a single line. Line wrapping breaks the parser. The one exception: a `{ }` or `[ ]` literal argument may continue across lines until it closes (measured on a v6 staging instance, 9 October 2026):

```liquid
{% liquid
  assign contact = {
    "email": email,
    "roles": ["member"]
  }
%}
```

Everything else, a long `graphql` or `function` call included, stays on its line. Outside a `{% liquid %}` block any tag may span lines.

**Solution:** Keep each statement on one line within liquid blocks:

```liquid
{% liquid
graphql get_user = 'modules/graphql/queries/user'
assign user_id = get_user.user.id
if user_id
  render 'partials/user_card', user: get_user.user
endif
%}
```

**Best Practice:** Use standard tag blocks for multi-line logic instead of liquid:

```liquid
{% graphql 'get_user' %}
  query GetUser($id: ID!) {
    user(id: $id) { id name email }
  }
{% endgraphql %}

{% assign user_id = get_user.user.id %}
{% if user_id %}
  {% render 'partials/user_card', user: get_user.user %}
{% endif %}
```

---

## A `%}` Inside a `#` Comment Closes the `{% liquid %}` Block

**Fixed.** Inside `{% liquid %}` a line starting with `#` is a comment to the end of that line, and since the 26 August 2026 platform release a `%}` on that line is comment content: only a `%}` outside a comment closes the tag (measured on a v6 staging instance, 9 October 2026). A block whose every `%}` is commented out is reported as `Tag '{%' was not properly terminated`, exactly like one with no `%}` at all.

---

## Errors Now Carry a File and Line

A Liquid error raised while rendering carries a stack trace naming the file and line, captured the way the `log` tag is, and a low-level error inside a filter (a frozen hash, an unsupported method) is wrapped into the same `Liquid error (path:line): ...` form rather than a bare message. A filter that rejects its arguments is reported with its line and the whole `include`/`function` stack that led there, once per distinct message per render rather than once per loop iteration. A parse error in a partial loaded via `render` points at the partial's own file. Read the instance logs (`insites-cli logs`) for the diagnostic; the page shows the message only.

---

## GraphQL Tag in Partial Fails

**Error:** GraphQL queries return empty or fail silently when called from partials.

**Cause:** The `graphql` tag should only be used in pages or layouts, not in partials. Partials execute in a limited context and may not have access to necessary variables or session data.

**Solution:** Execute GraphQL queries in the page and pass results to partials:

```liquid
{%- page -%}
  {% graphql get_products = 'modules/graphql/queries/products', category: page.category %}
  {% render 'partials/product_list', products: get_products.products %}
{%- endpage -%}
```

Then in the partial, use the passed variable:

```liquid
{%- if products.size > 0 -%}
  {%- for product in products -%}
    <div>{{ product.name }}</div>
  {%- endfor -%}
{%- endif -%}
```

---

## Function Returns nil Instead of Expected Value

**Error:** A function call returns `nil` or empty value even though logic looks correct.

**Cause:** Missing explicit `{% return %}` statement at the end of the function, or return path not reached.

**Solution:** Always use an explicit `{% return %}` statement:

```liquid
{% function process_order %}
  {% graphql order = 'get_order', id: id %}
  {% if order.order %}
    {% assign status = order.order.status %}
  {% else %}
    {% return nil %}
  {% endif %}
  {% return status %}
{% endfunction %}
```

Alternative: Use the function without explicit return (Insites will return the last assigned variable):

```liquid
{% function get_total %}
  {% assign total = item_price | times: quantity %}
{% endfunction %}

{% function get_total %}
  total
{% endfunction %}
```

---

## Render Partial Not Found Error

**Error:** `Partial not found` or template error when calling `{% render %}`.

**Cause:** Path mismatch, incorrect naming conventions, or partial not in expected directory.

**Solution:** Verify the path mapping:

- A path with no prefix reads `app/views/partials/`: `{% render 'header' %}` reads `app/views/partials/header.liquid`
- A path that starts `modules/<name>/` reads that module's `public/views/partials/` or `private/views/partials/`: `{% render 'modules/my_module/card' %}` reads `modules/my_module/public/views/partials/card.liquid`
- Leave out `views/partials/` and the `.liquid` extension

```liquid
{% render 'header' %}                      {% comment %} correct {% endcomment %}
{% render 'modules/my_module/card', item: product %} {% comment %} correct {% endcomment %}
{% render 'app/views/partials/header' %}   {% comment %} incorrect {% endcomment %}
{% render 'partials/header' %}             {% comment %} incorrect: reads app/views/partials/partials/header.liquid {% endcomment %}
{% render 'header.liquid' %}               {% comment %} incorrect, omit extension {% endcomment %}
```

See [`project-structure.md`](../../project-structure.md) for how paths resolve in both trees.

---

## parse_json Invalid JSON Error

**Error:** Liquid error: invalid JSON at position X when using `parse_json`.

**Cause:** JSON malformed—missing/trailing commas, unescaped quotes, invalid syntax.

**Solution:** Use the `json` filter to escape strings before parsing:

```liquid
{% assign data_string = product | json %}
{% assign parsed = data_string | parse_json %}
```

For raw JSON strings, ensure proper escaping:

```liquid
{% assign json_str = '{"name":"John","email":"john@example.com"}' %}
{% assign data = json_str | parse_json %}
```

Common mistakes:

```liquid
{%- Wrong: trailing comma -%}
{% assign data = '{"name":"John",}' | parse_json %}

{%- Wrong: unescaped quotes inside string -%}
{% assign data = '{"quote":"He said "hello""}' | parse_json %}

{%- Correct: escape quotes -%}
{% assign data = '{"quote":"He said \"hello\""}' | parse_json %}
```

---

## Session Values Persist Unexpectedly

**Error:** Session data remains after logout or should be cleared but isn't.

**Cause:** Session values must be explicitly cleared; setting to a non-nil value persists.

**Solution:** Clear session values using `null` or blank assignment:

```liquid
{%- Login -%}
{% session user_id = user.id %}

{%- Logout -%}
{% session user_id = nil %}
```

Or use blank string (context-dependent):

```liquid
{% session user_id = '' %}
```

To verify session state:

```liquid
{% if session.user_id %}
  User: {{ session.user_id }}
{% else %}
  Not logged in
{% endif %}
```

---

## Background Job Variables Not Accessible

**Error:** Variables used in a `background` job are nil or undefined at execution time.

**Cause:** A background job only has the variables passed to the tag, not the calling page's. `context` is available with limits.

**Solution:** Pass every value the job needs as a tag argument:

```liquid
{% background job_id = 'jobs/send_order_notification', order_id: order.id, user_email: order.user_email %}
```

Inside `app/views/partials/jobs/send_order_notification.liquid`, `order_id` and `user_email` are plain variables:

```liquid
{% graphql order = 'get_order', id: order_id %}
```

---

## Transaction Timeout

**Error:** Transaction exceeds maximum execution time.

**Cause:** Complex operations, nested database calls, or external API calls within transaction.

**Solution:** Increase timeout or simplify operations:

```liquid
{% transaction timeout: 30 %}
  {% graphql create_order = 'mutations/create_order', items: cart_items %}
  {% graphql update_inventory = 'mutations/update_inventory', product_ids: product_ids %}
{% endtransaction %}
```

If still timing out, break into smaller transactions:

```liquid
{% transaction %}
  {% graphql create_order = 'mutations/create_order', items: cart_items %}
{% endtransaction %}

{% transaction %}
  {% graphql update_inventory = 'mutations/update_inventory', product_ids: product_ids %}
{% endtransaction %}
```

---

## try/catch Not Catching Expected Error

**Error:** An error occurs but the `catch` block doesn't execute.

**Cause:** Not all errors are catchable. Some (like GraphQL errors) may not throw exceptions.

**Solution:** Verify GraphQL response status instead of relying on try/catch:

```liquid
{% try %}
  {% graphql get_user = 'get_user', id: user_id %}
{% catch %}
  {%- comment -%}This may not trigger for GraphQL errors{%- endcomment -%}
{% endtry %}

{%- Instead, check the response: -%}
{% if get_user.errors %}
  Handle GraphQL error: {{ get_user.errors[0].message }}
{% endif %}
```

Use try/catch for safe operations (parsing, type coercion):

```liquid
{% try %}
  {% assign count = item_count | plus: 0 %}
{% catch %}
  {% assign count = 0 %}
{% endtry %}
```

---

## Limits & Performance Table

| Feature | Limit | Notes |
|---------|-------|-------|
| Liquid execution time | 30 seconds | Per request; use background jobs for long operations |
| Transaction timeout | 10 seconds (default) | Configurable via `timeout` param; max 60 seconds |
| GraphQL query depth | 10 levels | Prevent circular queries |
| Rendered partials per page | 100+ | Avoid excessive nesting |
| Session data size | 1 MB | Total per session |
| Background job delay | 1 minute minimum | Execution not guaranteed within time window |
| Cache key length | 256 characters | Hashed if exceeded |
| Function recursion depth | 50 levels | Prevent infinite loops |

---

## Troubleshooting Flowchart

1. **Does your code use `{% liquid %}`?**
   - Yes → Check each statement is on one line
   - No → Continue to step 2

2. **Are you using `graphql` tag?**
   - In a partial → Move to page/layout
   - In a page → Check GraphQL query syntax and variables
   - Continue to step 3

3. **Are you calling `{% render %}`?**
   - Partial not found → Verify path in `app/views/partials/` or `modules/<name>/{public,private}/views/partials/`
   - Partial found → Continue to step 4

4. **Are you using `parse_json` or `session`?**
   - JSON parse error → Validate JSON syntax, use `json` filter
   - Session persisting → Use `nil` to clear
   - Continue to step 5

5. **Is your code timing out or slow?**
   - Transaction timeout → Increase timeout or break into smaller txns
   - Slow rendering → Profile with {% log %}, use caching
   - Continue to step 6

6. **Are you using `try/catch` or `background` jobs?**
   - Error not caught → Check if error is catchable; verify response status
   - Background job variables nil → Pass variables explicitly
   - Check logs for more details

---

## See Also

- [Liquid Tags — overview](README.md)
- [Liquid Tags — API reference](api.md) (covers `graphql`, `function`, `render`, `transaction`, `try`/`catch`, `session`, `background`, etc.)
- [Liquid Tags — patterns](patterns.md)
- [Liquid Filters — `parse_json`](../filters/api.md)
