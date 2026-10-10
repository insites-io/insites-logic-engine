# Platform changes in 2026

What the hosting platform under Insites changed this year that touches Liquid, GraphQL,
deploys and configuration, oldest first, with the reference page that carries the detail.
Everything a customer types into their own code is named as is; the platform itself is
not.

## What is live on Insites instances

Measured on a v6 staging instance on 9 October 2026 by running each feature:

| Release | State on the instance |
|---|---|
| 26 February to 26 August | **Live.** Hash and array literals, `<<`, multiline literals, backslash escapes, `escape_regex`, `hkdf`, `asset_name_to_raw_url`, idempotent `split`, `#` comments inside `{% liquid %}`, `options: { timeout, read_replica }` on `records` all work. `string_interpolation` is **off** there (it is a per-instance flag). `liquid_raise_mode` is on. |
| 9 and 16 September | Not exercisable from Liquid (deploy-time YAML strictness, content-type negotiation on errors, local-storage asset URLs). Assume live. |
| 6 October | **Not yet.** `admin_logs` answers "Field 'admin_logs' doesn't exist on type 'RootQuery'". Treat `form_data` on `api_call_send`, Server-Sent Events subscriptions, `.txt` as `text/plain` and the 404 for a missing asset as pending until the instance picks the release up. |

Instances on the Insites dedicated stack receive platform releases as the stack is
updated, so re-measure rather than assume a date.

## 26 February: config.yml

- A property missing from `app/config.yml` is logged as a warning and the application
  keeps running, where it used to raise. [configuration](configuration/README.md)

## 3 March: assign literals, clearer record errors

- **Breaking if enabled:** `{{ }}` inside double-quoted strings interpolates when
  `string_interpolation: true` is set (on by default for new instances, off for
  existing). Single quotes never interpolate. [types](liquid/types/api.md)
- `assign` takes hash and array literals (`{% assign foo = {} %}`, `{% assign h = { "k": var, var: "v", "arr": [1, var] } %}`),
  writes by dot and bracket notation, appends with `<<`, and nests to any depth.
  `hash_assign` is deprecated. `function` accepts the same left-hand targets.
  [types](liquid/types/api.md), [tags](liquid/tags/api.md)
- `record_update` and `record_destroy` on a missing id name the table they searched:
  `Can't find Boats with id=123`.
- Modules listed in the module lock file register as installed without being
  re-downloaded on every deploy; their files are expected in the deploy. Insites
  instances get their modules through the Console, so this does not change how a
  module arrives.

## 20 April: multiline arguments, background-job context, deploy validation

- `assign` and `function` arguments may span lines, a hash value may interpolate
  (`"{{ email | downcase }}"`, with the flag above), and `[]` / `{}` work as argument
  values: `{% assign arr = value | default: [] %}`. [types](liquid/types/api.md)
- Background jobs receive `context.environment` and `context.location.host`.
  [background jobs](background-jobs/gotchas.md)
- `api_call_send` accepts `options: { skip_ssl_verification: true }`. [api-calls](api-calls/api.md)
- Deploys: all validation errors reported together; a structured per-resource report;
  `--dry-run` covers assets; duplicate model names fail fast; duplicate translation keys
  name their files; an unknown `config.yml` property is a warning; a declared module
  whose files are missing from the deploy is warned about. Opt-in
  `auto_manage_public_only_modules` deletes removed files of public-only modules.
  [deployment](deployment/gotchas.md)
- Asset `raw_url` values that point at an instance path are rewritten for a cloned
  instance, which fixed broken asset URLs after cloning.

## 19 May: asset cache control, policies by name

- `cache_control` on `admin_assets_create` and `admin_asset_update` sets the stored
  object's `Cache-Control` header. The notes call the `url` argument of
  `admin_assets_create` deprecated and ignored, but the bundled schema still requires it:
  send it and do not rely on its value. [graphql](graphql/api.md), [assets](assets/api.md)
- `admin_page_create` and `admin_page_update` take `authorization_policies` as policy
  names, beside `authorization_policy_ids`. [graphql](graphql/api.md)
- `asset_url`'s `?updated=` is one per-instance timestamp bumped whenever any asset
  changes, not a per-asset value. [assets](assets/api.md)
- `related_records` allocates less, up to 4x faster. Pages load in batches on deploy, for
  very large static-site deploys.

## 29 June: asset_name_to_raw_url, JWT hardening, aggregations

- `asset_name_to_raw_url` resolves an asset name to its raw URL or `nil`. [assets](assets/api.md)
- `User.jwt_token` takes `expires_in` (seconds, clamped to a year). Tokens from that field
  now expire (default: the session timeout), carry `iss` bound to the instance, and are
  revoked by a password change. Legacy tokens with no `iss` are still accepted; tokens
  with no `exp` are not. [filters gotchas](liquid/filters/gotchas.md)
- WebSocket connections resolve the instance from the host, so cross-origin clients
  connect; a channel with no `subscribed` partial requires one for cross-origin.
- `min` and `max` aggregations honour the requested field and return a scalar.
  [graphql](graphql/api.md)
- `hash_assign` parsing anchored and nested lookups fixed (the tag is deprecated anyway).
  Postgres cardinality errors on some deploys handled. Stale asset MD5 cache entries
  fixed. A single failed asset no longer aborts an instance clone.

## 15 July: multiline tags, JSON literal arguments, stack traces

- Any tag may span lines. JSON object and array literals, nested, with variables, go
  straight into tag and filter arguments. [types](liquid/types/api.md)
- Render errors carry a stack trace to the file and line. [tags gotchas](liquid/tags/gotchas.md)
- Every rejected WebSocket subscription gets a `subscription_error` message with a
  machine-readable `code` (`unauthorized`, `instance_not_found`,
  `subscribed_partial_error`, `internal`), a message and `retryable`, delivered before
  `reject_subscription`; a Liquid error in a `subscribed` partial is logged as
  `WebSocketSubscribeError`. New flag `websockets_require_subscribed_partial`, default
  `true`: a channel with no `subscribed` partial rejects everyone. [configuration](configuration/README.md)
- The file upload library was upgraded; no change required.

## 27 July: read replicas and query timeouts, Web Push filters, binary bodies

- `records`, `users`, `admin_versions` and `models` take `options: { read_replica, timeout }`.
  [graphql](graphql/api.md)
- `ecdh_compute` and `hkdf` filters; `encrypt` honours an explicit IV; `jwt_encode` takes
  raw EC private keys for ES256/384/512. Together they implement Web Push message
  encryption in Liquid. [filters](liquid/filters/api.md)
- A `body` given directly to `api_call_send` is sent byte for byte, unrendered.
  [api-calls](api-calls/api.md)
- A deploy auto-installs a module dependency missing from the archive when the module
  lock file records a trusted registry for it. Not how Insites modules are delivered.
- Archive extraction moved to a pure-Ruby unzipper that skips absolute, `..` and symlink
  entries. Low-level Ruby errors and filter argument errors render as located Liquid
  errors with full diagnostics; repeated errors log once per render.
  [tags gotchas](liquid/tags/gotchas.md)
- `split` is idempotent on arrays and refuses hashes. Syntax errors in a `render`ed
  partial point at the partial. `key: {{ my_var }}` inside a JSON literal is a targeted
  syntax error. Casting and sanitization are restored after an error caught by `try`.
  [filters](liquid/filters/api.md)

## 12 August: parse_json deprecated, boolean filters, charset

- `parse_json` (tag and filter) is deprecated in favour of an `assign` literal for JSON
  written in the template; it remains the way to parse a runtime string. Every deprecated
  tag names its successor; `context_rc`, `function_rc`, `return_rc`, `sign_in_rc`,
  `try_rc` and `render_form` are registered alternative spellings (the CLI 5.10.2 audit
  still lists `render_form` among its deprecated tags); `execute_query` and
  `query_graph` are deprecated for `graphql`. [tags](liquid/tags/api.md)
- Deploys touching more than 250 partials no longer leave stale compiled templates;
  deleting a partial expires its `path:` alias; `Duplicate pk` is warned across batches.
  Two files claiming one Table or Form name are rejected. [deployment](deployment/gotchas.md)
- With `liquid_raise_mode` off, the boolean filters return `false` on a rejected
  argument instead of a truthy `''`. Keep raise mode on. [filters gotchas](liquid/filters/gotchas.md)
- Non-HTML page formats send `charset=utf-8`. [pages gotchas](pages/gotchas.md)
- `context.params.channel` in a channel partial is the name the client subscribed with,
  and channel state written in `subscribed` is readable in `unsubscribed`.

## 26 August: backslash escapes (breaking), escape_regex, return in loops

- **Breaking for one spelling:** `\` escapes the next character in a string literal, so
  `'\'` no longer parses; write `'\\'`. `\"`, `\'` and `\\` are the only escapes; every
  other `\X` is unchanged. [types gotchas](liquid/types/gotchas.md)
- `escape_regex` filter. [filters](liquid/filters/api.md)
- Deploy-time Liquid errors name their line. Every filter alias is published as a
  deprecated spelling (`compact`, `select`, `translate`, `localize` and more); `t`,
  `t_escape` and `l` are canonical. Filter and tag arguments publish their types.
  [filters](liquid/filters/api.md)
- The platform runs on Ruby 4. A deploy reports `asset_status` for its asset phase.
- `return` and `redirect_to` work inside `for` and `tablerow`. A `%}` inside a `#`
  comment no longer closes a `{% liquid %}` block. [tags](liquid/tags/api.md)
- Percent-encoded asset names load. Uniqueness locks left by a crashed deploy, export,
  import or clone are reaped, with a one-hour cap. An unparseable request body answers
  400 (malformed) or 501 (undecoded transfer coding) and is logged without the body.

## 9 September: strict YAML

- The YAML parser behind every front matter and `.yml` file refuses `:symbol` values,
  `!ruby/object` tags and dangling `*aliases`, all of which used to deploy as a value
  other than the one written. [deployment](deployment/gotchas.md)
- An unparseable JSON body declared as `application/json` answers the JSON envelope
  `{"status":400,"error":"There was a problem in the JSON you submitted: ..."}`.

## 16 September: content type on errors, two-factor tokens

- An API token owned by an account with two-factor authentication enabled needs a
  two-factor session before the CLI or a custom client can use it against an instance;
  the client receives `{"error":"two_factor_required", ...}` with a 401. API keys issued
  by the instance itself are unaffected. Whether this applies to you depends on the
  account that owns your token.
- Error responses keep the content type the page committed. A presigned-upload request
  on an instance with no object storage answers 501 `direct_upload_unavailable`.
  `asset_url` returns host-relative URLs when assets are served from local disk.
  `dynamic_cache` with `layout: ""` works on cache hits. [pages gotchas](pages/gotchas.md)

## 6 October: Server-Sent Events, multipart API calls, admin_logs

Not yet on the instance measured on 9 October 2026.

- A channel can be subscribed to over Server-Sent Events at `/anycable-events`, with the
  whole identifier URL-encoded as JSON, the CSRF token in the query string as
  `authenticity_token`, read-only, and a refused subscription ending the stream with
  401. The same `subscribed` partial and config flags apply.
- `form_data` on `api_call_send` sends `multipart/form-data`. [api-calls](api-calls/api.md)
- `admin_logs` reads the `log` tag's entries from GraphQL. [graphql](graphql/api.md)
- The instance answers 503 with `Retry-After` and `partner_portal_unavailable` while the
  token-checking service is briefly unreachable, instead of a 401 that looked like a
  revoked token. `download_file`'s `max_size` is enforced on bytes received.
- A WebSocket client that passed the CSRF token in the consumer URL no longer has its
  first message refused. An API key shared across instances is verified by each one.
  `.txt` pages are `text/plain`. A missing asset is 404. `admin_background_jobs` refuses
  a timestamp filter that is not a date. `log` entries no longer go missing after one
  failed delivery.
