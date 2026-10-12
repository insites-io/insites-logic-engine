# Forms & CSRF

Insites has two distinct concepts both called "forms":

1. **HTML `<form>` elements** in pages/partials — for browser-rendered submissions. Use plain HTML tags; do NOT use the `{% form %}` Liquid tag.
2. **Form definitions** at `modules/<name>/public/forms/<name>.liquid` — YAML-fronted Liquid files that declare the schema (fields, validation) and a `callback_actions` block that runs the GraphQL mutations and side effects when the form is submitted. **This is where state-changing logic lives in canonical Combinate** (replacing the older "command pattern").

This document covers the HTML side. For the form-definition / `callback_actions` pattern, see the section below.

## Form definitions and `callback_actions`

A form file at `modules/dashboard/public/forms/update_password.liquid` looks like:

```liquid
---
name: update_password
resource: User
fields:
  current_password:
    validation: { presence: true }
  password:
    validation: { presence: true, length: { minimum: 8 } }
  password_confirmation:
    validation: { presence: true }
callback_actions: >
  {% liquid
    if form.password != form.password_confirmation
      form_set_field_error 'password_confirmation', 'Passwords do not match'
      break
    endif
    graphql res = 'modules/dashboard/account/update_password',
      current_password: form.current_password,
      new_password: form.password
    if res.errors
      form_set_error res.errors.first.message
    endif
  %}
---
```

Key points:

- **Field-level validation** lives in YAML `validation:` blocks (e.g. `presence: true`, `length: { minimum: N }`, `format: ...`).
- **Cross-field checks and side effects** live in the `callback_actions` Liquid block (the example above checks password match before calling the mutation).
- Form definitions are invoked from pages/partials via the platform's form-rendering helpers; on submit, validations run first and `callback_actions` only runs if validation passes.
- There is **no `app/lib/commands/` directory** in canonical Combinate — what older docs described as commands is the `callback_actions` block of a form definition.

## Basic Form

```html
<form method="post" action="/products">
  <input type="hidden" name="authenticity_token" value="{{ context.authenticity_token }}">

  <label for="title">Title</label>
  <input type="text" id="title" name="product[title]" value="{{ product.title }}">

  <label for="price">Price</label>
  <input type="number" id="price" name="product[price]" step="0.01" value="{{ product.price }}">

  <button type="submit">Create Product</button>
</form>
```

## CSRF Protection

**All non-GET forms MUST include the CSRF token**, otherwise `context.current_user` will be `null`.

```html
<input type="hidden" name="authenticity_token" value="{{ context.authenticity_token }}">
```

## Field Naming Convention

Use bracket notation for structured data:

```html
<input name="product[title]" value="...">
<input name="product[price]" value="...">
<input name="product[tags][]" value="tag1">
<input name="product[tags][]" value="tag2">
```

Access in page: `context.params.product.title`, `context.params.product.price`

## PUT/DELETE Methods

HTML forms only support GET and POST. Use a hidden field for PUT/DELETE:

```html
<form method="post" action="/products/{{ product.id }}">
  <input type="hidden" name="authenticity_token" value="{{ context.authenticity_token }}">
  <input type="hidden" name="_method" value="put">
  <!-- fields -->
</form>

<form method="post" action="/products/{{ product.id }}">
  <input type="hidden" name="authenticity_token" value="{{ context.authenticity_token }}">
  <input type="hidden" name="_method" value="delete">
  <button type="submit">Delete</button>
</form>
```

## File Upload

There is no upload component to render. The browser uploads the file straight to storage with a presigned request, then your page saves the file's URL on the record. The v6 modules work this way.

1. **Presign on the server** with the `property_upload_presigned_url` mutation, naming the table and its `upload` property:

   ```graphql
   # app/graphql/products/presign_image.graphql
   mutation presign_image {
     s3_upload: property_upload_presigned_url(table: "product", property_name: "image") {
       upload_url
       upload_url_payload
     }
   }
   ```

   Return `upload_url` and `upload_url_payload` to the browser, for example from a JSON page.
2. **Upload from the browser**: POST a `multipart/form-data` body to `upload_url` holding every field of `upload_url_payload`, then the file.
3. **Save the URL**: storage answers with XML whose `Location` is the file's URL. Send it to your own page and store it in the `upload` property with `record_create` or `record_update`.

For a property declared in `app/user.yml` rather than a table, leave `table` out and pass `user: true`. Set `acl: private` on anything a visitor submits (see [schema configuration](../schema/configuration.md)).

For the schema, define an `upload` type property:

```yaml
# app/schema/product.yml
properties:
  - name: image
    type: upload
    options:
      acl: public
```

## Displaying Validation Errors

When a form definition's `callback_actions` block sets errors (via `form_set_error` / `form_set_field_error`), they're available as `form.errors` in the rendered template:

```liquid
{% if form.errors %}
  <div class="alert alert--error">
    {% for error in form.errors %}
      <p>{{ error[0] }}: {{ error[1] | join: ', ' }}</p>
    {% endfor %}
  </div>
{% endif %}
```

## AJAX Form Submission

Create a `.json.liquid` page endpoint:

```liquid
{% comment %} modules/dashboard/public/views/pages/api/products/create.json.liquid {% endcomment %}
---
slug: api/products
method: post
---
{% liquid
  graphql result = 'modules/dashboard/products/create',
    title: context.params.product.title,
    price: context.params.product.price

  assign response = result | json
  print response
%}
```

## Spam Protection

```liquid
{% spam_protection "recaptcha_v2" %}
{% spam_protection "recaptcha_v3", action: "signup" %}
{% spam_protection "hcaptcha" %}
```

Validate in page:
```liquid
{% assign valid = context.params | hcaptcha %}
{% assign valid = context.params | recaptchav3: 'signup' %}
```

## Rules

- Use HTML `<form>` tags, NOT `{% form %}`
- Always include CSRF token for non-GET requests
- Use bracket notation: `name="resource[field]"`
- Access form data via `context.params` (page handlers) or `form` (form-definition `callback_actions`)
- State-changing logic lives in `callback_actions` blocks of form definitions, **not** in `app/lib/commands/` — the latter does not exist in canonical Combinate
