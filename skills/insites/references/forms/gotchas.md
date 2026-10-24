# Forms: Gotchas

Common mistakes, errors, and edge cases when working with Insites forms.

## Missing CSRF Token

**Problem:** Form submission succeeds but `context.current_user` is always `null`.

**Cause:** State-changing forms (POST, PUT, DELETE) require an authenticity token. Without it, the user context is not populated.

**Solution:** Always include the authenticity token in forms:

```html
<form method="POST" action="/products">
  <input type="hidden" name="authenticity_token" value="{{ context.authenticity_token }}">
  <!-- rest of form -->
</form>
```

Test:
```liquid
{% if context.current_user %}
  User authenticated: {{ context.current_user.email }}
{% else %}
  Token missing or invalid
{% endif %}
```

## Comparing the Authenticity Token Yourself

`{{ context.authenticity_token }}` prints a **different value every time**, even twice in one request, and none of them equals the value a genuine form posts back. The token is masked per render (the same scheme Rails uses), so a POST page cannot check the posted token against anything it can read.

The platform checks it. **An invalid token does not refuse the post; it empties the session.** So the supported check on a POST page is the session, not the token:

```liquid
{%- comment -%} the form page {%- endcomment -%}
{% session my_form = 'on' %}

{%- comment -%} the POST page {%- endcomment -%}
{% unless context.session.my_form == 'on' %}
  {% response_status 422 %}
  {% break %}
{% endunless %}
```

Measured on a v6 instance on 5 October 2026 (TW#26851117): a post without the visitor's session wrote nothing and answered 422; a genuine post kept the session and went through. A signed-in page can check `context.current_user` the same way.

## Using {% form %} Instead of HTML

**Problem:** A page or partial uses `{% form %}` for a hand-written form.

**Cause:** `{% form %}` exists and is current, but it renders a form definition through the `form_builder` variable, so it belongs in the body of a `forms/<name>.liquid` file (insites-cli 6.1.0 tag reference: "Use within form configuration"). Render a defined form from a page with `{% include_form 'name' %}`. For a hand-written form in a page or partial, use a plain `<form>` with the authenticity token, which is the `forms-no-form-tag` convention.

**Against the convention (in a page or partial):**
```liquid
{% form method: 'post' %}
  <input type="text" name="product[title]">
{% endform %}
```

**Correct:**
```html
<form method="POST" action="/products">
  <input type="hidden" name="authenticity_token" value="{{ context.authenticity_token }}">
  <input type="text" name="product[title]">
</form>
```

## Wrong Field Naming Convention

**Problem:** Form values accessible as `context.params.product_title` instead of expected nested structure.

**Cause:** Not using bracket notation for nested parameters. Using underscore or dot notation instead.

**Solution:** Use bracket notation for nested field names:

```html
<!-- Wrong: underscore-separated -->
<input type="text" name="product_title">
<!-- Access: context.params.product_title -->

<!-- Correct: bracket notation -->
<input type="text" name="product[title]">
<!-- Access: context.params.product.title -->
```

Complex nesting:

```html
<input name="user[profile][first_name]">
<input name="tags[0]">
<input name="tags[1]">

<!-- Access -->
{{ context.params.user.profile.first_name }}
{{ context.params.tags[0] }}
{{ context.params.tags[1] }}
```

## File Upload Not Working

**Problem:** File upload field doesn't accept files or uploaded file is not accessible.

**Cause:** Missing `enctype="multipart/form-data"` or schema doesn't define upload field type.

**Solution:**

1. Add form encoding:
```html
<form method="POST" action="/products" enctype="multipart/form-data">
  <!-- required for file uploads -->
</form>
```

2. Define schema with upload type:
```yaml
name: product
fields:
  - name: image
    type: upload
```

3. Use upload component:
```liquid
{% include 'components/upload',
  name: 'product[image]',
  accept: 'image/*'
%}
```

## Missing _method Field for PUT/DELETE

**Problem:** Form submission with `method="PUT"` or `method="DELETE"` doesn't work; form acts like POST.

**Cause:** HTML forms only support GET and POST. PUT/DELETE require hidden `_method` field.

**Incorrect:**
```html
<form method="PUT" action="/products/123">
  <!-- HTML doesn't support PUT -->
</form>
```

**Correct:**
```html
<form method="POST" action="/products/123">
  <input type="hidden" name="_method" value="PUT">
  <input type="hidden" name="authenticity_token" value="{{ context.authenticity_token }}">
  <!-- rest of form -->
</form>
```

## Form Parameters Ignored in GraphQL

**Problem:** Form parameters not passed to GraphQL mutation; mutation receives null values.

**Cause:** Not mapping `context.params` to GraphQL variables correctly.

**Solution:**

```liquid
{% graphql CreateProduct, product: context.params.product %}
  mutation CreateProduct($product: ProductInput!) {
    product_create(product: $product) {
      product { id title }
      errors
    }
  }
{% endgraphql %}
```

Or explicitly map parameters:

```liquid
{% assign product = context.params.product | default: {} %}
{% assign title = product.title %}
{% assign price = product.price %}
```

## Validation Errors Not Displayed

**Problem:** Form submits but validation errors from GraphQL mutation don't appear in form.

**Cause:** Not capturing mutation response or conditional logic for error display is missing.

**Solution:** Capture mutation result and display errors:

```liquid
{% graphql %}
  mutation CreateProduct($product: ProductInput!) {
    product_create(product: $product) {
      product { id }
      errors
    }
  }
{% endgraphql %}

{% if graphql.product_create.errors %}
  <div class="alert-error">
    {% for error in graphql.product_create.errors %}
      <p>{{ error.message }}</p>
    {% endfor %}
  </div>
{% endif %}
```

## AJAX Form Not Sending CSRF Token

**Problem:** AJAX form submission fails with authentication error.

**Cause:** CSRF token not included in AJAX request headers or body.

**Solution:**

Include token in request:

```javascript
const formData = new FormData(form);
const response = await fetch('/products/create.json', {
  method: 'POST',
  body: formData,
  headers: {
    'X-Requested-With': 'XMLHttpRequest'
  }
});
```

Or include in form data:

```html
<input type="hidden" name="authenticity_token" value="{{ context.authenticity_token }}">
```

## Spam Protection Not Validating

**Problem:** Spam protection tag renders but doesn't validate submissions.

**Cause:** The instance has no CAPTCHA keys. reCAPTCHA keys are not read from a module manifest or from environment variables: each instance holds its own, entered in the Integrations screen of the IIA admin (also reachable from Console). Until they are entered, a form that uses `{% spam_protection "recaptcha_v2" %}` or `"recaptcha_v3"` fails, and the instance logs `can't find configuration for CAPTCHA`. Measured on new v6 instances in October 2026. `hcaptcha` is different: it works on a new instance with no setup, because it uses the platform's own key.

**Solution:**

1. In the Integrations screen of the instance, enter the reCAPTCHA site key and secret key.
2. In the Google reCAPTCHA console, add the instance's domain to the key's allowed domains. A key that does not list the domain fails on that site even when it is entered.
3. Submit the form once and check the logs for the CAPTCHA error.

### Moving a site to a new instance: CAPTCHA keys never move with it

The keys belong to the instance, so nothing copies them: not a deploy, not a data copy. The secret key cannot be read back once saved (not through GraphQL, not in the admin), so it cannot be copied from the old instance either. Before forms go live on the new instance:

- Get the secret key from the Google reCAPTCHA console, or create a new key pair there.
- Add the new domain to the key in Google.
- Enter both keys in the new instance's Integrations screen, then test a submission.

## Posted Values Arrive HTML-Entity-Decoded

**Problem:** A posted field holding `&quot;` arrives in `context.params` as a bare `"`. `&#34;` and `&#x22;` decode the same way, and `&amp;` becomes `&`. JSON sent as a text field then fails `parse_json` whenever one of its strings contains an entity, and text that passes is silently changed. Measured on a v6 instance in September 2026.

**Solution:** escape `&`, `<` and `>` as JSON escapes on the sending side, so nothing is left to decode. The JSON stays valid and parses to the same values:

```javascript
const body = JSON.stringify(state)
  .replace(/&/g, '\\u0026').replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
```

On the receiving side, check before parsing and answer 400 rather than raising a Liquid error:

```liquid
{% liquid
  if context.params.state | is_json_valid
    assign state = context.params.state | parse_json
  else
    response_status 400
  endif
%}
```

## Form Limits and Constraints

| Aspect | Limit | Notes |
|--------|-------|-------|
| Max form size | 10 MB | Total multipart request size |
| Max file size | 5 MB | Individual file upload (configurable) |
| Max param depth | 10 levels | Nested bracket notation |
| Max array size | 1000 items | Array parameters |
| Field name length | 256 chars | HTML input name attribute |
| Parameter name length | 256 chars | Single parameter name |

## Troubleshooting Flowchart

```
Form submission fails
├─ No response or timeout
│  ├─ Check form action URL
│  └─ Check server logs
├─ User is null
│  ├─ Add authenticity_token
│  └─ Verify token value is not empty
├─ 404 Not Found
│  ├─ Verify page/endpoint exists
│  └─ Check routing configuration
├─ Validation errors
│  ├─ Check GraphQL mutation response
│  └─ Display errors in template
└─ File upload fails
   ├─ Add enctype="multipart/form-data"
   ├─ Verify schema has upload type
   └─ Check file size limits
```

## See Also

- [Forms: Configuration](configuration.md)
- [Forms: API Reference](api.md)
- [Forms: Patterns](patterns.md)
- [Forms: Advanced Techniques](advanced.md)
