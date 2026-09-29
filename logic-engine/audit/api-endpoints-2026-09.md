# API endpoint conventions: census, September 2026

Grounding for `rules/api-endpoints.md` and for the header and auth corrections in the same release.

## Population

The default branch of all 14 IIA modules (`module-ai` through `module-system-pages`), read on 26 September 2026. 3,931 Liquid files; **1,368 API pages**, meaning every `.liquid` file under a `views/pages/api/` directory. Nothing is excluded: empty files and preflight pages are counted and classed, not dropped.

## Guards

| Class | Pages |
|---|---|
| `authorization_policies` in front matter | 1,256 |
| Inline guard function (`{% function x = '...guard...' %}`, CRM V2) | 88 |
| `method: options` preflight | 2 |
| Empty file | 7 |
| No guard visible in the page | reported to the module owners separately |

So 1,344 of 1,368 carry a guard. The `api-pages-declare-a-guard` validator was run over the same 1,368 pages and flags exactly the pages this census classes as having no visible guard, so the rule's evidence is the validator's own behavior, not a separate count.

## Slugs

0 of 1,368 API pages put `.json` in the slug. 304 of 1,368 set `format: json` in front matter; the rest use a JSON layout such as `modules/insites_core/json`. No API page file in any module is named `*.json.liquid`.

## Credentials

0 of 1,368 API pages take a credential as a slug segment or read one from a GET query string.

## Status codes and error bodies

8 of 1,368 API pages call `response_status` directly. The modules set status through `modules/insites_core/functions/response_handler` instead, so a validator requiring `response_status` in the page would flag nearly every module endpoint. No such validator is proposed.

The V2 error bodies do not match the documented `{ "errors": [{ "message", "field" }] }` shape: `respond_bad_request` returns `{ "error": "<message>" }` and `respond_401` returns `{ "error", "message", "type" }`. Which shape is canonical is an open decision, recorded in the release notes rather than settled here.

## Headers

Every `context.headers` read in module source uses dot notation: 130 reads, 0 bracket reads. On two instances, a read-only Liquid probe returned the same value for `context.headers.HTTP_USER_AGENT` and `context.headers['HTTP_USER_AGENT']`, and blank for `['User-Agent']`, `['user-agent']`, `['USER-AGENT']` and `['Authorization']`. A browser request carrying custom headers showed the transformation: `X-Probe-Hyphen` arrived as `HTTP_X_PROBE_HYPHEN`, `probe_underscore` as `HTTP_PROBE_UNDERSCORE`.

## Policies

12 of 31 policy files in the modules print no `false` on any path (a proxy for `auth-policy-explicit-true-false`: a file may print `false` on some paths and still miss one).
