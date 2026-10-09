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
