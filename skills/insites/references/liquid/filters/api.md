# Liquid Filters: API Reference

Complete API documentation for all Insites Liquid filters.

## Array Filters API

### array_add
```liquid
{%- assign result = array | array_add: element -%}
{%- assign result = array | array_add: other_array -%}
```
Adds element(s) to array, returns new array.

### array_select
```liquid
{%- assign result = array | array_select: property, value -%}
{%- assign result = array | array_select: property -%}
```
Returns array elements matching condition.

### array_reject
```liquid
{%- assign result = array | array_reject: property, value -%}
```
Returns array elements NOT matching condition.

### array_sort_by
```liquid
{%- assign result = array | array_sort_by: property -%}
```
Sorts array by property value (ascending).

### array_group_by
```liquid
{%- assign result = array | array_group_by: property -%}
```
Returns object with elements grouped by property.

### array_uniq
```liquid
{%- assign result = array | array_uniq -%}
{%- assign result = array | array_uniq: property -%}
```
Removes duplicate elements or duplicates by property.

### array_flatten
```liquid
{%- assign result = nested_array | array_flatten -%}
{%- assign result = nested_array | array_flatten: depth -%}
```
Flattens nested arrays to specified depth (default unlimited).

### array_compact
```liquid
{%- assign result = array | array_compact -%}
```
Removes nil/null and empty string values.

## Hash Filters API

### hash_merge
```liquid
{%- assign result = hash1 | hash_merge: hash2 -%}
```
Merges two hashes, second overwrites first.

### hash_dig
```liquid
{%- assign value = hash | hash_dig: 'key' -%}
{%- assign value = hash | hash_dig: 'parent', 'child', 'key' -%}
```
Extracts nested value, returns nil if missing.

### hash_keys
```liquid
{%- assign keys = hash | hash_keys -%}
```
Returns array of all hash keys.

### hash_values
```liquid
{%- assign values = hash | hash_values -%}
```
Returns array of all hash values.

### hash_delete
```liquid
{%- assign result = hash | hash_delete: 'key' -%}
```
Removes key from hash, returns new hash.

## Date Filters API

### add_to_time
```liquid
{%- assign result = date | add_to_time: amount, unit -%}
{%- assign result = 'now' | add_to_time: 7, 'days' -%}
{%- assign result = 'now' | add_to_time: 2, 'hours' -%}
```
Units: seconds, minutes, hours, days, weeks, months, years.

### localize
```liquid
{%- assign result = date | localize: format -%}
{%- assign result = date | localize: 'long' -%}
```
Formats date per user locale. Formats: short, medium, long, full.

### strftime
```liquid
{%- assign result = date | strftime: '%Y-%m-%d %H:%M:%S' -%}
{%- assign result = date | strftime: '%B %d, %Y' -%}
```
Uses standard strftime format codes.

### time_diff
```liquid
{%- assign seconds = date1 | time_diff: date2 -%}
{%- assign seconds = date1 | time_diff: 'now' -%}
```
Returns difference in seconds.

### iso8601
```liquid
{%- assign result = date | iso8601 -%}
```
Formats as ISO 8601 string.

## String Filters API

### slugify
```liquid
{%- assign slug = string | slugify -%}
{%- assign slug = 'Hello World!' | slugify -%}
```
Converts to lowercase, dashes, URL-safe string.

### parameterize
```liquid
{%- assign param = string | parameterize -%}
{%- assign param = string | parameterize: '_' -%}
```
Converts to parameter format (default separator: dash).

### matches
```liquid
{%- if string | matches: 'pattern' -%}
{%- if email | matches: '^[^@]+@[^@]+$' -%}
```
Tests if string matches regex pattern.

### replace_regex
```liquid
{%- assign result = string | replace_regex: 'pattern', 'replacement' -%}
{%- assign result = string | replace_regex: '\d+', 'NUM' -%}
```
Replaces pattern matches with replacement.

### escape_regex
```liquid
{%- assign safe = mention | escape_regex -%}
{%- assign pattern = '@\[' | append: safe | append: '\]' -%}
{%- assign output = body | replace_regex: pattern, link -%}
```
Escapes every character with a meaning in a regular expression, so the result matches
the input literally: `'Jane.Doe' | escape_regex` is `Jane\.Doe`. Use it on any value that
goes into `replace_regex`, `matches` or `regex_matches`. Measured on a v6 staging
instance, 9 October 2026.

### split (arrays)
`split` applied to a value that is already an array returns it unchanged, so re-applying
it in a loop no longer corrupts the values; applied to a hash it raises an argument error.
(26 July 2026 platform release; measured 9 October 2026.)

### markdown
```liquid
{%- assign html = markdown_string | markdown -%}
{%- assign html = markdown_string | markdown: 'simple' -%}
```
Renders Markdown to HTML. Types: simple, extended.

## JSON Filters API

### json
```liquid
{%- assign json_string = object | json -%}
{%- assign json_string = hash | json -%}
```
Converts to JSON string representation.

### parse_json
```liquid
{%- assign object = json_string | parse_json -%}
```
Parses JSON string to object/array.

### base64_encode
```liquid
{%- assign encoded = string | base64_encode -%}
```
Encodes string to base64.

### base64_decode
```liquid
{%- assign decoded = encoded | base64_decode -%}
```
Decodes base64 string.

## Crypto Filters API

### encrypt
```liquid
{%- assign encrypted = string | encrypt: key -%}
{%- assign encrypted = padded_plaintext | encrypt: 'aes-128-gcm', cek, nonce -%}
```
Encrypts with AES-256-CBC, returns base64. An explicit initialization vector passed after
the key is honoured for symmetric algorithms (it used to be accepted and ignored, a
random IV always generated): pass raw bytes of the algorithm's IV length, 12 for
`aes-128-gcm`, 16 for `aes-256-cbc`. Omit it and a random IV is generated as before.
Asymmetric algorithms (RSA, RSA-OAEP) refuse an IV.

### decrypt
```liquid
{%- assign decrypted = encrypted | decrypt: key -%}
```
Decrypts AES-256-CBC encrypted string.

### jwt_encode
```liquid
{%- assign token = data | jwt_encode: 'HS256', secret -%}
{%- assign vapid_jwt = claims | jwt_encode: 'ES256', vapid_private_key -%}
```
Creates a JWT from a hash. The algorithm comes first and is required: `jwt_encode: secret` is
refused with "second argument must be one of following algorithms". For ES256, ES384 and
ES512 the key may be a PEM private key or a Base64url-encoded raw private key scalar, the
form VAPID keys are distributed in.

### jwt_decode
```liquid
{%- assign decoded = token | jwt_decode: 'HS256', secret -%}
{%- assign payload = decoded.first -%}
```
Verifies and decodes a JWT. Returns an **array of two hashes, `[payload, header]`**, not the
payload on its own, so read the claims from `decoded.first`. A bad signature raises
"Signature verification failed" and a past `exp` raises "Signature has expired". The filter also
accepts `none` as the algorithm, which skips verification: always name the algorithm you signed
with.

### compute_hmac
```liquid
{%- assign signature = string | compute_hmac: secret -%}
{%- assign signature = string | compute_hmac: secret, 'sha256', 'base64' -%}
```
Creates an HMAC signature. With only the secret it is HMAC-SHA256 as lowercase hex. Pass
`'sha256', 'base64'` for base64, as some webhook providers send it. There is no `hmac_sha256`
filter: it answers "undefined filter".

### hkdf
```liquid
{%- assign ikm   = shared_secret | hkdf: auth_secret, key_info, 32 -%}
{%- assign cek   = ikm | hkdf: message_salt, cek_info, 16 -%}
{%- assign nonce = ikm | hkdf: message_salt, nonce_info, 12 -%}
```
Derives a key with HKDF (RFC 5869). Arguments, all optional: salt, info, output length in
bytes (default 32), hash algorithm (default `sha256`). Input and output are raw bytes, so
pipe through `base64_encode` to print one. Live on a v6 staging instance, 9 October 2026.

### ecdh_compute
```liquid
{%- assign shared_secret = sender_private_key | ecdh_compute: subscription.keys.p256dh -%}
{%- assign hex = sender_private_key | ecdh_compute: peer_public_key, 'hex' -%}
```
Computes an ECDH shared secret from your EC private key and a peer's EC public key, given
as PEM or as a Base64url raw uncompressed point (what a browser's
`PushSubscription.getKey('p256dh')` returns). Raw bytes by default, ready for `hkdf`;
pass `'hex'` or `'base64'` (URL-safe) for an encoded result. With `hkdf` and the `encrypt`
IV argument this is enough to implement Web Push message encryption (RFC 8291) in Liquid.

### Deprecated aliases
Every alias of a filter is now published as a deprecated spelling with the canonical
filter's arity, so an editor lint may start flagging names it used to accept: `compact`,
`select`, `reject`, `detect`, `any`, `sort_by`, `group_by`, `flatten`, `dig`, `fetch`,
`to_json`, `markdownify`, `nl2br`, `translate`, `localize`, `to_hash` and others. All keep
working. `t`, `t_escape` and `l` are the canonical translation and localization spellings;
`translate`, `translate_escape` and `localize` are the aliases, though their error
messages still say "translate filter".

## Utility Filters API

### type_of
```liquid
{%- assign type = variable | type_of -%}
```
Returns: string, number, array, hash, boolean, nil.

### default
```liquid
{%- assign value = variable | default: 'fallback' -%}
```
Returns fallback if variable is nil/false/empty.

### inspect
```liquid
{%- assign debug = variable | inspect -%}
```
Returns debug representation for console.

## See Also

- [Filter Configuration](configuration.md)
- [Filter Patterns & Examples](patterns.md)
- [Common Gotchas](gotchas.md)
- [Advanced Techniques](advanced.md)
