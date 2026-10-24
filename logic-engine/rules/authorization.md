# Rules — Authorization

Rules that apply to files under `app/authorization_policies/` (or module-equivalent paths) and to pages that reference authorization policies.

---

```yaml
---
id: auth-policies-in-front-matter
applies_to: [page, policy]
severity: warning
evidence: real-project
evidence_source: "27+ pages across the canonical repos declare authorization_policies: in YAML front matter. Pattern is universal."
audit_ref: audit/v0-conflicts-batch3.md#rule-r-24
---
```

**Rule:** Pages that require authorization MUST declare their policies in YAML front matter via the `authorization_policies:` key. Policies run before the page body executes; unauthorized requests get a 403 (or the page's configured `redirect_to`) before any template logic runs.

**Why:** Front-matter policies are the platform's first-class auth layer — they short-circuit before any data is fetched or any HTML is generated. Inline auth checks (e.g. `{% if context.current_user == blank %}`) run AFTER initial template setup and may leak data via timing or partial rendering.

**How to apply:**
```liquid
---
slug: account/orders
authorization_policies:
  - is_user_logged_in
  - has_active_subscription
---
```

Inline auth checks are permitted as **secondary** guards (defense in depth), but the **primary** check MUST be in front matter.

**An inline check still ships the layout.** Measured on a v6 production instance on 20 August 2026: an anonymous GET of a page guarded only by an inline check answered 404 and still returned 40,210 bytes, the layout's full navigation with 32 internal URLs. The layout renders around the page body, so an inline check inside the body cannot stop it. A front-matter policy runs before either.

**Exception, proposed for review: JSON API pages called by machines.** A failed front-matter policy answers with a redirect to its `redirect_to`, not a 401 on the URL that was called, and a client that follows redirects re-issues a POST as a GET. The CRM V2 endpoints moved to an inline guard for this reason in May 2026 (TW#26083226): 88 pages call `modules/insites_crm/functions/auth/api_key_guard` as their first statement and answer 401 JSON on failure. For an API page, an inline guard that runs **before any data access** and fails closed is an acceptable primary check. See `api-endpoints.md` (`api-pages-declare-a-guard`).

**Verified by:**
- `app-portal/modules/portal/public/views/pages/overview.liquid:25-26` — declares `is_user_logged_in`
- `app-seedling/modules/dashboard/public/views/pages/dashboard.liquid` — declares dashboard policies

---

```yaml
---
id: auth-policy-explicit-true-false
applies_to: [policy]
severity: error
evidence: real-project
evidence_source: "6 of 7 policies compliant. 1 violation in addon-ecommerce/.../order_created_date_valid.liquid where the if branch produces no output when the condition fails (potential auth bypass)."
audit_ref: audit/v0-conflicts-batch1.md#rule-r-7
preship_action: "Fix addon-ecommerce/modules/ecommerce/public/authorization_policies/order_created_date_valid.liquid:14-16 before shipping. Add explicit else false branch."
---
```

**Rule:** Authorization policies MUST explicitly echo `true` or `false` in EVERY code path. Never let a code path produce no output (nil/blank).

**Why:** An empty output from an authorization policy relies on behavior nobody has documented. Measured on 26 September 2026: surrounding whitespace is trimmed (a policy printing a newline, spaces, `true` and a newline admits the request), and a request on which every policy printed nothing was denied with a redirect to `redirect_to`. So blank currently fails closed, but that is an observation, not a contract. An explicit `false` makes the deny path something a reviewer can see and a test can assert, and it does not depend on the platform continuing to treat blank as a denial.

Across the IIA module default branches, 12 of 31 policy files print no `false` anywhere, so they rely on blank meaning deny. That includes `has_valid_instance_api_authorization`, `insites_only_allowed_if_logged_in` and `insites_only_allowed_by_administrators`.

**How to apply:**
```liquid
{%- if user_logged_in -%}
  true
{%- else -%}
  false
{%- endif -%}
```

NOT this (silent fail when condition is false):
```liquid
{%- if user_logged_in -%}
  true
{%- endif -%}
```

For complex policies, use early-exit `{% return %}` after every echo:
```liquid
{% liquid
  if user == blank
    echo false
    return
  endif
  if user.suspended
    echo false
    return
  endif
  echo true
%}
```

**Verified by:**
- Compliant: `app-seedling/modules/dashboard/public/authorization_policies/is_user_logged_in.liquid:18-22` — explicit echo statements with confirming comment
- VIOLATION: `addon-ecommerce/modules/ecommerce/public/authorization_policies/order_created_date_valid.liquid:14-16` — `{%- if diff < 10 -%}true{%- endif -%}` — no echo when `diff >= 10`. **Pre-ship fix required.**

---

```yaml
---
id: auth-policies-handle-nil
applies_to: [policy]
severity: warning
evidence: real-project
evidence_source: "Most policies defensively check for nil. 1 violation in addon-ecommerce that calls time_diff on a potentially-nil value."
audit_ref: audit/v0-conflicts-batch2.md#rule-r-12
---
```

**Rule:** Authorization policies SHOULD explicitly check that data is present before accessing nested properties. Don't assume `context.current_user`, related records, or GraphQL results are non-nil.

**Why:** A nil-access in a policy can either crash (worst case: 500 error returned to user) or silently produce blank output (auth bypass — see `auth-policy-explicit-true-false`). Defensive nil checks prevent both.

**How to apply:**
```liquid
{% liquid
  graphql data = 'modules/dashboard/account/get_current_user'
  assign user = data.current_user.client | first

  comment
    Defensive nil check: if no user, no policy decision is possible — fail closed.
  endcomment
  if user == blank
    echo false
    return
  endif

  if user.suspended
    echo false
  else
    echo true
  endif
%}
```

**Verified by:**
- Compliant: `app-seedling/modules/dashboard/public/authorization_policies/is_user_logged_in.liquid:9-22`
- VIOLATION: `addon-ecommerce/.../order_created_date_valid.liquid:6-16` — calls `time_diff` on `order_details.created_at` without checking if `order_details` is blank

---

```yaml
---
id: auth-sign-out-post-with-token
applies_to: [page, form]
severity: warning
evidence: runtime-failure
evidence_source: "Measured on a v6 production and a v6 staging instance on 16 October 2026 (TW#26894310), same result on both. user_session_destroy on a method: post page signed out with the authenticity token and did nothing without it (the page saw no context.current_user). On a method: get page it signed out, and the session cookie is SameSite=Lax, so a link from another site can trigger it (cookie attribute measured; no second site used). A legacy resource: Session form posted to /api/sessions signed out with and without the token (204 both times). The mutation took effect on the next request and kept every {% session %} field. app-seedling v2.1.0 signs out this way."
related: [liquid-no-sign-out-tag]
---
```

**Rule:** Sign out from a `method: post` page that receives the authenticity token. The page checks `context.current_user`, clears the per-login fields it set with `{% session %}`, runs `user_session_destroy`, and redirects. Do not sign out from a `method: get` page, and do not use the legacy `resource: Session` form.

**Why:**
- **A `method: get` sign-out can be triggered by another site.** The session cookie is `SameSite=Lax`, which browsers send on a top-level GET navigation, so a link or redirect elsewhere signs the person out.
- **The legacy form does not check the token.** A `resource: Session` form posted to `/api/sessions` signed out with no authenticity token at all.
- **A `method: post` page without the token sees no `context.current_user`**, so the `if` makes it do nothing. That is what makes it safe without a token check of its own.
- **Sign-out keeps every `{% session %}` field, and so does the next sign-in.** A flag such as "passed two-factor" stays set for the next person to sign in on that browser unless the page clears it.
- **The mutation takes effect on the next request.** The page that runs it still sees the user, so redirect straight after it.

**How to apply:** Two pages at one slug, because a page carries one method (`pages-one-http-method`), plus a form that posts the token.

```liquid
---
slug: sign-out
method: post
layout: ''
---
{%- liquid
  if context.current_user
    session two_factor_user_id = null
    graphql signed_out = 'sessions/sign_out'
  endif
  redirect_to '/sign-out'
-%}
```

```liquid
<form action="/sign-out" method="post">
  <input type="hidden" name="authenticity_token" value="{{ context.authenticity_token }}">
  <button type="submit">Sign out</button>
</form>
```

The `method: get` page at the same slug only tells the person they are signed out. Never sign out by clearing `{% session user_id = null %}` (it is an ordinary field and does not end the sign-in), and never by writing the platform's internal session key (it works, and it is undocumented). The full recipe, run as written on a v6 staging instance, is in `skills/insites/references/authentication/patterns.md#sign-out`.

**Verified by:**
- `app-seedling` v2.1.0 `app/views/pages/account/sign_out_submit.liquid:1-21` — `method: post`, `if context.current_user`, clears its two-factor pass, runs the mutation, redirects
- `app-seedling` v2.1.0 `app/views/partials/account/sign_out_form.liquid:10-13` — the form that posts the authenticity token
- `app-seedling` v2.1.0 `app/views/pages/account/sign_out.liquid` — the `method: get` page at the same slug
