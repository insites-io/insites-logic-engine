# Layouts -- Gotchas & Troubleshooting

Common errors, limits, and debugging guidance for layout files.

## Common Errors

### "Page content not appearing"

**Cause:** The layout file is missing `{{ content_for_layout }}`.

**Solution:** Add `{{ content_for_layout }}` to the layout body. Every layout must include this exactly once.

### "Styles not applied"

**Cause:** The layout does not link the stylesheet, or the path passed to `asset_url` does not match a file under `app/assets/`.

**Solution:** Link the stylesheet in `<head>` with the path relative to `app/assets/`:
```liquid
<html lang="en">
<head>
  <link rel="stylesheet" href="{{ 'styles/main.css' | asset_url }}">
</head>
```

### "Flash messages not appearing after redirect"

**Cause:** The flash message handling code is missing from the layout, or the `from` parameter does not match the redirect target pathname.

**Solution:** Add the standard flash message block before `</body>`. Ensure the `from` value in `session/set` matches the pathname the user is redirected to.

### "yield renders nothing"

**Cause:** No `{% content_for 'name' %}` block matches the yield slot name, or the content_for block is in a partial that was not rendered.

**Solution:** Verify the slot name matches exactly between `{% yield 'name' %}` and `{% content_for 'name' %}`. Ensure the partial containing `content_for` is actually rendered during page execution.

### "Layout not found" error on deploy

**Cause:** A page references a layout name that does not exist as a file in `app/views/layouts/`.

**Solution:** Create the layout file or fix the `layout:` value in the page's front matter. Layout names map directly to filenames (e.g., `layout: admin` expects `app/views/layouts/admin.liquid`).

> **Module note:** If the layout is provided by a module, check `modules/<module_name>/public/views/layouts/` or `private/views/layouts/`.

### "Duplicate content appearing"

**Cause:** `{{ content_for_layout }}` appears more than once in the layout, or multiple `{% content_for %}` blocks with the same name are appending content unintentionally.

**Solution:** Include `{{ content_for_layout }}` exactly once. If content_for blocks are duplicating, check that partials using `content_for` are not rendered multiple times.

### Forms inside the layout act as if nobody is signed in

**Cause:** Forms in layout partials (e.g., search bar, logout button) are missing the CSRF token. The request is not rejected; it arrives with `context.current_user` null (rule `auth-sign-out-post-with-token` in `logic-engine/rules/authorization.md`).

**Solution:** Include the authenticity token in every non-GET form, even those rendered from the layout:
```liquid
<input type="hidden" name="authenticity_token" value="{{ context.authenticity_token }}">
```

### "Metadata is blank in layout"

**Cause:** The page front matter does not include a `metadata:` section, or the key name is misspelled.

**Solution:** Add metadata to the page front matter and access it via `context.page.metadata.key_name`. Use the `default` filter for fallbacks: `{{ context.page.metadata.title | default: "My App" }}`.

### A partial stored under `views/layouts/` is refused

`app/views/layouts/` holds layouts only. Saving a partial there through the admin API fails with "Physical file path is invalid" (measured October 2026). Move it to `app/views/partials/layouts/` and render it as `'layouts/<name>'`. See [partials gotchas](../partials/gotchas.md#physical-file-path-is-invalid-for-a-partial-under-viewslayouts).

### `layout: application` with no layout record renders a bare page

**Cause:** a new instance has no `application` layout record. A page that uses the default layout (no `layout:` key, or `layout: application`) still renders with status 200, but with no frame around it: no `<head>` assets, header or footer. Any other layout name that does not exist is refused when the page is saved, with "Could not find Layout". So the default is the one case where a missing layout is silent. Measured on v6 instances in October 2026.

**Solution:** create `app/views/layouts/application.liquid` before relying on the default, or name the layout the site actually has. After moving a site, open a page on the default layout and check it has its frame.

### `content_for` on a searchable page is refused at save time

A page with `searchable: true` cannot use `{% content_for %}`: the page is refused when it is saved. Either set `searchable: false`, or pass the value with `export` and write it in the layout with `print`:

```liquid
{%- comment %} page {%- endcomment %}
{% liquid
  assign page_title = 'Pricing'
  export page_title, namespace: 'page'
%}

{%- comment %} layout {%- endcomment %}
<title>{% print context.exports.page.page_title %}</title>
```

Measured on v6 instances in October 2026. See also [pages gotchas](../pages/gotchas.md#a-searchable-page-cannot-use-include_form-or-content_for).

## Limits

| Resource                          | Limit         | Notes                                      |
|-----------------------------------|---------------|--------------------------------------------|
| Layouts per application           | No hard limit | Keep it practical (3-5 covers most apps)   |
| Layout file size                  | 1 MB          | Keep layouts thin -- delegate to partials  |
| yield slots per layout            | No hard limit | Common: `head`, `footer_scripts`           |
| content_for blocks per page       | No hard limit | Each appends to the slot; no overwrite     |
| Nested render depth in layouts    | Unverified    | Not the page's URL-nesting setting. See [routing gotchas](../routing/gotchas.md#a-static-slug-also-answers-deeper-paths) |

## Troubleshooting Flowchart

```
Layout problem?
├── Page content not visible?
│   ├── Check {{ content_for_layout }} exists in layout
│   ├── Check page front matter layout value is correct
│   └── Check layout file exists in app/views/layouts/
├── Styling broken?
│   ├── Check the stylesheet <link> is in <head>
│   ├── Check the asset_url path matches a file in app/assets/
│   └── Check yield 'head' is in <head> for page CSS
├── Flash messages missing?
│   ├── Check flash handling block exists before </body>
│   ├── Check 'from' parameter matches redirect target
│   ├── Check the page set sflash with the session tag before redirecting
│   └── Check toasts partial is rendering correctly
├── yield slot empty?
│   ├── Verify content_for name matches yield name exactly
│   ├── Check content_for is in a partial that gets rendered
│   └── Check for typos in slot name strings
└── Layout not applying?
    ├── Check layout: value in page front matter
    ├── Check layout file exists with .liquid extension
    └── Check for layout: "" which skips layout entirely
```

## See Also

- [Layouts Overview](README.md) -- introduction and key concepts
- [Layouts Configuration](configuration.md) -- file structure and settings
- [Layouts API](api.md) -- tags and objects reference
- [Layouts Advanced](advanced.md) -- edge cases and optimization
- [Pages Gotchas](../pages/gotchas.md) -- page-level troubleshooting
