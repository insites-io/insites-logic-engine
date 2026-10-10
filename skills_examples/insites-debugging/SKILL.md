---
name: insites-debugging
description: "Debugging & validation: run insites-cli audit linter and analyze instance logs."
---

# Debugging & Validation

Validate code with `insites-cli audit` and analyze runtime logs with `insites-cli logs`.

---

## Part 1: Code Validation (Audit)

### Exclusion Pattern Check (Mandatory)

Application directory should contain `.insites-audit.yml`:

```yaml
root: .

ignore:
  - node_modules/*
  - modules/*
```

### Commands

```bash
# Check all files
insites-cli audit

# Check specific file
insites-cli audit app/views/pages/articles/index.liquid

# Check specific directory
insites-cli audit app/views/pages/
```

### Error Categories

**CRITICAL (Must Fix)** — runtime failures:
- Liquid syntax errors
- Missing required tags
- Invalid filter usage
- Missing YAML frontmatter

**WARNING (Should Review)** — potential issues:
- Deprecated syntax
- Unused variables
- Performance concerns

**INFO (Optional)** — suggestions for improvement.

### Output Format

```
file:line:column - severity - ErrorCode: message
```

Example:
```
app/views/pages/articles/index.liquid:5:1 - error - SyntaxError: ...
app/views/partials/articles/show.liquid:12:5 - warning - UnusedVariable: ...
```

### Common Audit Errors

| Error | Cause | Fix |
|-------|-------|-----|
| LiquidSyntaxError | Line break in `{% liquid %}` block | Keep statements on single lines |
| UndefinedFilter | Using non-existent filter | Use only documented Insites filters |
| FormCsrfMissing | Form missing authenticity_token | Add CSRF hidden input |

### Acceptance Criteria

Code passes validation when:
- **0 critical errors**
- **0 blocking warnings**

---

## Part 2: Log Analysis

### Commands

```bash
# Stream live logs
insites-cli logs <environment>
insites-cli logs staging

# Stream with filter
insites-cli logs staging --filter error
```

### Log Levels

| Level | Description | Action Required |
|-------|-------------|-----------------|
| ERROR | Runtime failures | Must fix immediately |
| WARN | Potential issues | Should investigate |
| INFO | Normal operations | Informational |
| DEBUG | Detailed tracing | For debugging |

### Common Error Patterns

**Liquid Syntax Errors:**
```
Liquid error: undefined method `missing_method' for nil:NilClass
```
Fix: Add nil check before method call.

**Missing Partial:**
```
Liquid error: Could not find partial 'missing/partial'
```
Fix: Create the partial or fix the path.

**GraphQL Errors:**
```
GraphQL::Error: Field 'nonexistent' doesn't exist on type 'records'
```
Fix: Check GraphQL schema for valid fields.

**Authorization Errors:**
```
Unauthorized: User does not have permission 'action.name'
```
Fix: Add permission to role in authorization_policies/.

**HTTP Errors:**
- `500` — Unhandled exception in page. Check page code.
- `404` — Page doesn't exist or wrong slug/method.

### Debugging with Log Statements

Add log statements to your Liquid code:

```liquid
{% log variable, type: 'debug' %}
{% log result, type: 'info' %}
```

Then watch logs in another terminal:

```bash
insites-cli logs staging
```

---

## Combined Debugging Workflow

```bash
# 1. Validate code
insites-cli audit

# 2. Deploy
insites-cli deploy staging

# 3. Watch logs while testing
insites-cli logs staging

# 4. Run tests
insites-cli test run staging
```

### Analysis Process

1. **Run audit** — fix all critical errors first
2. **Deploy to staging** — get code on the instance
3. **Stream logs** — filter for ERROR and WARN levels
4. **Categorize errors** — Liquid, GraphQL, HTTP, or authorization
5. **Trace to source** — identify file/line from error message
6. **Fix and re-deploy** — iterate until clean
