# Rules — Liquid syntax

Rules about Liquid block formatting, tag usage, and template structure.

---

```yaml
---
id: liquid-blocks-line-wrapping
applies_to: [page, partial, command, policy]
severity: info
evidence: skill-only
evidence_source: "All 81 inspected liquid blocks comply. No violations and no enforcement found, but the convention is universally observed."
audit_ref: audit/v0-conflicts-batch3.md#rule-r-19
---
```

**Rule:** Inside `{% liquid %}...{% endliquid %}` blocks, each statement MUST occupy a single complete line. Do not wrap multi-line statements (e.g. long filter chains, long function calls) inside a `{% liquid %}` block.

**Why:** The `{% liquid %}` block parser is line-oriented — each line is a separate statement. A statement that wraps onto a second line breaks the parse. If you need a multi-line expression, either split into multiple `{% liquid %}` blocks, use `{% capture %}` outside the block, or use individual `{% assign %}` / `{% echo %}` tags.

**How to apply:**

✅ **Correct:**
```liquid
{% liquid
  assign user_id = context.current_user.id
  assign user_email = context.current_user.email
  graphql user = 'crm/get_user', id: user_id
  if user.client == blank
    echo false
    return
  endif
  echo true
%}
```

❌ **Wrong (statement wraps):**
```liquid
{% liquid
  assign user = context.current_user
                | dig: 'profile'
                | first
%}
```

For long expressions, break out:
```liquid
{% capture user %}
  {{- context.current_user
    | dig: 'profile'
    | first -}}
{% endcapture %}
{% liquid
  assign user_processed = user
%}
```

**Verified by:** `app-seedling/modules/dashboard/public/authorization_policies/allow_2fa_verification.liquid:9-31` — well-formed `{% liquid %}` block, each statement on its own line.

---

```yaml
---
id: liquid-no-sign-out-tag
applies_to: [page, partial, layout, command, form, policy]
severity: error
evidence: cli-audit
evidence_source: "Measured on a v6 staging instance on 15 October 2026 (TW#26876514): insites-cli check reported LiquidHTMLSyntaxError Unknown tag 'sign_out' on the two pages that used it, insites-cli exec liquid failed with Liquid syntax error: Unknown tag 'sign_out', and the CLI's tag reference lists sign_in and session but no sign_out."
validator: liquid-no-sign-out-tag
related: [auth-sign-out-post-with-token]
---
```

**Rule:** There is no `sign_out` tag. Do not write `{% sign_out %}`, or `sign_out` as a statement inside a `{% liquid %}` block. Sign out with the `user_session_destroy` mutation instead.

**Why:** The platform has a `sign_in` tag and no matching `sign_out`, so the pair looks complete and gets guessed. The guess fails the whole template: `Unknown tag 'sign_out'` is a syntax error, so the page renders nothing, not just a page that leaves the person signed in.

**How to apply:**

✅ **Correct:**
```graphql
# app/graphql/sessions/sign_out.graphql
mutation sign_out {
  user_session_destroy
}
```
```liquid
{%- liquid
  if context.current_user
    graphql signed_out = 'sessions/sign_out'
  endif
  redirect_to '/sign-out'
-%}
```

❌ **Wrong:**
```liquid
{% sign_out %}
```

The schema marks `user_session_destroy` deprecated with "Use session tag", but no use of the `session` tag that the CLI's tag reference documents ends a sign-in, so the mutation is still the way to sign out. Run it from a `method: post` page: see `auth-sign-out-post-with-token`. The measurements and the full recipe are in `skills/insites/references/authentication/api.md` and `authentication/patterns.md`.

**Verified by:**
- `app-seedling` v2.1.0 `app/graphql/account/sign_out.graphql:5-7` runs `user_session_destroy`, with a comment at lines 3-4 that there is no `sign_out` tag
- The v6 CRM module signs out with the same mutation (`graphql/sessions/logout.graphql`)
