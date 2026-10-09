# Pages -- Gotchas & Troubleshooting

Common errors, limits, and debugging guidance for page files.

## Common Errors

### "Liquid error: undefined method 'graphql'"

**Cause:** You are calling `{% graphql %}` inside a partial instead of a page.

**Solution:** Move the GraphQL call to the page file and pass the result to the partial as a parameter.

### "404 Not Found" for a page that exists

**Cause:** The slug in front matter does not match the requested URL, or the file extension does not match the expected content type.

**Solution:** Verify the `slug:` in front matter matches the URL pattern. Check that `.json.liquid` files are requested as `/path.json`, not `/path`.

### "CSRF token is invalid" on POST/PUT/DELETE

**Cause:** The form submission is missing the `authenticity_token` field, or the token has expired.

**Solution:** Include `<input type="hidden" name="authenticity_token" value="{{ context.authenticity_token }}">` in every non-GET form.

### "Multiple pages match the same route"

**Cause:** Two page files define the same slug and method combination.

**Solution:** Ensure each slug + method pair is unique. Use `insites-cli audit` to detect conflicts before deploying.

### "Page renders blank content"

**Cause:** The page calls `{% render %}` but the partial path is wrong, or the partial is empty.

**Solution:** Verify the partial path matches a file at `app/views/partials/<path>.liquid`. Check for typos in the path string.

> **Module note:** If the page or partial is inside a module, check `modules/<module_name>/public/views/` or `private/views/` instead.

### "Variables from partial are not accessible in page"

**Cause:** Variables defined inside partials are local to that partial scope.

**Solution:** Use `{% function result = 'partial' %}` to capture a return value, or use `{% export %}` to make values available via `context.exports`.

### "Redirect loop detected"

**Cause:** A page redirects to a URL that resolves back to the same page, or an auth guard redirects to a login page that redirects back.

**Solution:** Add a condition before redirecting. Check `context.location.pathname` to avoid self-redirects.

### "Layout not found"

**Cause:** The `layout:` value in front matter references a layout file that does not exist in `app/views/layouts/`.

**Solution:** Create the layout file or fix the name. Use `layout: ""` for no layout.

## Content Type and Charset

- A page in a format other than `html` (`md`, `json`, `css`, `csv`, `ics`, `js`, `text`,
  `xml`) sends `; charset=utf-8` in its `Content-Type` since the 12 August 2026 platform
  release. Before that a bare `text/markdown` made clients fall back to latin-1 and
  mangle every non-ASCII character. A `Content-Type` set through `response_headers` wins.
- An error raised after the page committed its content type (its `format`, or
  `response_headers`) is answered in that type rather than renegotiated from `Accept`;
  an error on a `.js` page is a JSON string literal, not bare text (16 September 2026).
- A page with `format: txt`, `robots.txt` for one, is served as `text/plain` whatever the
  client's `Accept` header (6 October 2026 release; a v6 staging instance did not yet
  carry that release on 9 October 2026).
- `dynamic_cache` on a page with `layout: ""` served the first request and failed on
  every cache hit; fixed on 16 September 2026, which is what broke cached `sitemap.xml`
  pages.

## Limits

| Resource                     | Limit               | Notes                                         |
|------------------------------|----------------------|-----------------------------------------------|
| Front matter slug length     | 255 characters       | Includes dynamic segments                     |
| URL parameters per request   | ~100                 | Combined slug + query params                  |
| Page file size               | 1 MB                 | Keep pages thin -- use partials for content    |
| Nested partial depth         | Unverified           | Not the page's URL-nesting setting. See [routing gotchas](../routing/gotchas.md#a-static-slug-also-answers-deeper-paths) |
| GraphQL calls per page       | No hard limit        | Each call adds latency; minimize for performance|
| Redirect chain depth         | 10 hops              | Browser-enforced                              |
| Response body size           | 10 MB                | For large responses consider pagination        |

## Troubleshooting Flowchart

```
Page not working?
├── Getting 404?
│   ├── Check slug matches URL exactly
│   ├── Check method matches request method
│   ├── Check file is in app/views/pages/
│   └── Run insites-cli audit for conflicts
├── Getting blank page?
│   ├── Check partial path is correct
│   ├── Check partial file exists
│   ├── Add {% log %} statements to trace execution
│   └── Check layout is rendering {{ content_for_layout }}
├── CSRF error?
│   ├── Verify authenticity_token in form
│   ├── Check form method matches page method
│   └── Ensure session cookies are enabled
├── Data not loading?
│   ├── Check GraphQL file path is correct
│   ├── Test query in insites-cli gui GraphQL editor
│   ├── Verify variable names match between query and page
│   └── Check filter/argument values are correct types
└── Auth redirect loop?
    ├── Check can_do_or_unauthorized logic
    ├── Verify login page does not itself require auth
    └── Check return_url parameter handling
```

## See Also

- [Pages Overview](README.md) -- introduction and key concepts
- [Pages Configuration](configuration.md) -- front matter reference
- [Pages API](api.md) -- tags and context objects
- [Pages Advanced](advanced.md) -- edge cases and optimization
- [Routing Gotchas](../routing/gotchas.md) -- URL matching problems
