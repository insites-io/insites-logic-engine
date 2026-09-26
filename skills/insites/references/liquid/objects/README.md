# Insites Liquid Objects

## context (Global Object)

The primary global object accessible everywhere in Insites.

### context.params
HTTP parameters from query string and request body.

```liquid
{{ context.params.id }}
{{ context.params.product.title }}
{{ context.params.page }}
```

### context.session
Server-side session storage. Set via `{% session %}` tag.

```liquid
{{ context.session.cart_id }}
```

### context.location
URL information for the current request.

```liquid
{{ context.location.pathname }}   → /products/123
{{ context.location.search }}     → ?page=2
{{ context.location.host }}       → example.com
{{ context.location.href }}       → full URL
```

### context.environment
Returns `"staging"` or `"production"`.

```liquid
{% if context.environment == 'staging' %}
  {% log data, type: 'debug' %}
{% endif %}
```

### context.is_xhr
Boolean `true` for AJAX/XMLHttpRequest; `null` otherwise.

```liquid
{% if context.is_xhr %}
  {% render 'products/list_partial', products: products %}
{% else %}
  {% render 'products/list_page', products: products %}
{% endif %}
```

### context.authenticity_token
CSRF token for non-GET forms.

```liquid
<input type="hidden" name="authenticity_token" value="{{ context.authenticity_token }}">
```

### context.current_user
User data (id, email, first_name, last_name, slug). Use this to check authentication and fetch the full user profile via GraphQL:

```liquid
{% liquid
  if context.current_user
    graphql g = 'users/current', id: context.current_user.id
    assign profile = g.users.results.first
  else
    assign profile = null
  endif
%}
```

### context.constants
Environment constants (API keys, secrets). Hidden from `{{ context }}` output for security.

```liquid
{{ context.constants.STRIPE_SK_KEY }}
{{ context.constants.API_BASE_URL }}
```

### context.headers
The raw request environment, keyed the CGI way (RFC 3875, section 4.1.18). A request header is **not** stored under its HTTP name. Its name is uppercased, every hyphen becomes an underscore, and `HTTP_` is added in front:

| Header sent | Read it as |
|---|---|
| `User-Agent` | `context.headers.HTTP_USER_AGENT` |
| `Authorization` | `context.headers.HTTP_AUTHORIZATION` |
| `X-Api-Key` | `context.headers.HTTP_X_API_KEY` |
| `instance_api_key` | `context.headers.HTTP_INSTANCE_API_KEY` |

This applies to custom headers as much as to standard ones. The object also carries request values that are not headers: `REQUEST_METHOD`, `REQUEST_URI`, `PATH_INFO`, `QUERY_STRING`, `SERVER_NAME`, `SERVER_PORT`.

```liquid
{{ context.headers.HTTP_USER_AGENT }}
{{ context.headers.HTTP_X_API_KEY }}
{{ context.headers.SERVER_NAME }}
{{ context.headers.REQUEST_METHOD }}
```

**Bracket reads by HTTP name return blank.** `context.headers['User-Agent']`, `['user-agent']` and `['Authorization']` are all empty, because no key of that form exists. Bracket notation works only with the transformed key: `context.headers['HTTP_USER_AGENT']`.

`HTTP_ACCEPT` is not reliable. A request that sent `Accept: application/json` produced no `HTTP_ACCEPT` key; the platform appears to consume `Accept` to choose the page format. Use `format:` in the page front matter for content negotiation instead.

### context.cookies
All site cookies.

```liquid
{{ context.cookies.my_cookie }}
```

### context.device
UserAgent-based device info.

```liquid
{{ context.device.device_type }}   → desktop, smartphone, tablet
```

### context.page
Current page metadata.

```liquid
{{ context.page.id }}
{{ context.page.slug }}
{{ context.page.layout }}
{{ context.page.metadata.title }}
```

### context.language
ISO language code for the current request.

```liquid
{{ context.language }}   → "en"
```

### context.flash
Flash messages from form submissions.

```liquid
{{ context.flash.notice }}
{{ context.flash.alert }}
```

### context.modules
Information about installed modules (version, subscription status).

### context.visitor
Browser visitor info.

```liquid
{{ context.visitor.ip }}
```

### context.exports
Variables exported from partials via the `export` tag.

```liquid
{{ context.exports.namespace.variable_name }}
```

## forloop Object

Available inside `{% for %}` loops.

| Property | Description |
|----------|-------------|
| `forloop.first` | `true` on first iteration |
| `forloop.last` | `true` on last iteration |
| `forloop.index` | Current index (1-based) |
| `forloop.index0` | Current index (0-based) |
| `forloop.rindex` | Reverse index (1-based) |
| `forloop.rindex0` | Reverse index (0-based) |
| `forloop.length` | Total iterations |
| `forloop.parentloop` | Access parent loop in nested loops |

## tablerowloop Object

Available inside `{% tablerow %}` loops. Same properties as forloop plus:

| Property | Description |
|----------|-------------|
| `tablerowloop.col` | Current column (1-based) |
| `tablerowloop.col0` | Current column (0-based) |
| `tablerowloop.col_first` | `true` if first column |
| `tablerowloop.col_last` | `true` if last column |
