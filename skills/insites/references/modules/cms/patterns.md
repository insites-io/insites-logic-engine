# CMS — Patterns

Liquid-side consumption patterns for CMS-managed content. CMS objects are files in the project tree; from your Insites Liquid code you reference them by path. **No HTTP API examples** — CMS does not expose a V2 REST API. **No GraphQL examples** — the supported consumption surface is Liquid.

For the field shapes of each object type, see [`metadata.md`](metadata.md). For IIA admin paths, see [`configuration.md`](configuration.md).

---

## 1. Reference a layout from a page

Pages declare their wrapping layout via the `layout:` front-matter key:

```liquid
---
slug: about-us
method: get
layout: default
format: html
---

{% render 'about/intro' %}
{% render 'about/team' %}
```

The layout file at `app/views/layouts/default.liquid` will wrap the page output. The page body's render output replaces the `{{ content_for_layout }}` placeholder inside the layout.

---

## 2. Render a partial as HTML

`{% render %}` invokes a partial and emits its output into the current rendering position:

```liquid
{% render 'shared/header' %}

<main>
  {% render 'products/list', products: products %}
</main>

{% render 'shared/footer' %}
```

Arguments after the path become local variables inside the partial. The partial only sees what you pass — it does not inherit parent locals (use `export` inside the partial or `assign` outside if you need crossover).

---

## 3. Call a partial as a function

Use `{% function %}` when you want a partial's return value, not its rendered output:

```liquid
{% function product_count = 'shared/count_products', collection: 'featured' %}

<p>You have {{ product_count }} featured products.</p>
```

Inside the partial, `{% return value %}` sets the function result. Functions are useful for encapsulating data lookups, validations, or computed values without rendering anything.

---

## 4. Fetch global content

Global content is a single shared record. Read it with a function:

```liquid
{% function globals = 'modules/insites_cms/get_globals' %}

<header>
  <img src="{{ globals.company_logo | asset_url }}" alt="{{ globals.company_name }}">
  <p>{{ globals.company_slogan }}</p>
</header>

<footer>
  <a href="{{ globals.facebook_link }}">Facebook</a>
  <a href="{{ globals.linkedin_link }}">LinkedIn</a>
</footer>
```

The exact partial name varies by module version; in IIA-bootstrapped contexts the `globals` variable may already be available without the function call. The full set of fields (locations, opening hours, contact info, etc.) is enumerated in [`metadata.md#global-content`](metadata.md#global-content).

---

## 5. Reference a web-files asset

Static assets under `app/assets/` are addressed by path through the `asset_url` filter, which returns a CDN-served URL:

```liquid
<link rel="stylesheet" href="{{ 'css/site.css' | asset_url }}">
<script src="{{ 'js/app.js' | asset_url }}"></script>
<img src="{{ 'images/hero.png' | asset_url }}" alt="">
```

`asset_url` handles cache-busting and CDN routing. Don't hardcode `/assets/...` paths — always go through the filter.

---

## 6. Apply an authorization policy to a page

Reference policies by name in the page front-matter:

```liquid
---
slug: admin/dashboard
method: get
layout: admin
authorization_policies:
  - modules/insites_crm/insites_only_allowed_if_logged_in
  - modules/insites_crm/insites_only_allowed_by_administrators
---

{% render 'admin/dashboard' %}
```

If any policy fails, the request is denied — the user is redirected per the policy's `redirect_to` and shown its `flash_alert`. Policies are evaluated in order; the first failure short-circuits.

To write a custom policy, see [`metadata.md#authorization-policies`](metadata.md#authorization-policies).

---

## 7. Send a CMS-managed email

Email templates are referenced by path; the platform handles the actual delivery:

```liquid
{% include 'modules/insites_crm/functions/send_email',
   template: 'emails/welcome',
   to: contact.email,
   variables: { name: contact.first_name, contact_uuid: contact.uuid } %}
```

The `welcome` email template at `app/emails/welcome.liquid` renders with the `variables` available in its body. Wrap it in an email layout for consistent branding (`modules/insites_crm/external_email_layout` for customer-facing emails, `internal_email_layout` for admin notifications).

The exact send-email function path varies by module version — check your project's email helpers.

---

## What's intentionally not here

- **HTTP API examples** — CMS exposes no V2 REST API. CMS objects are files; consumption is Liquid-side only.
- **GraphQL examples** — although CMS data lives behind GraphQL internally, the supported way to consume it is through the partials and filters above.
- **Editing CMS objects programmatically** — that happens through IIA, the platform CLI's file sync, or direct file commits — not from inside Liquid.
