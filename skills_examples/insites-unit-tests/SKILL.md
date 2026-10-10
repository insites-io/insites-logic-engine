---
name: insites-unit-tests
description: "Write and run unit tests using the insites_test module and insites-cli test run."
---

## Overview

This skill provides **absolute, non-negotiable protocols** for working with the insites_test module. YOU MUST follow every instruction precisely. Deviation from these protocols results in broken tests, false positives, and production incidents.

The insites_test module is a Liquid-based testing framework featuring assertions, test execution, and email validation capabilities. Every test you write MUST adhere to the contract pattern and assertion library defined herein.

---

## Critical Prerequisites

**YOU MUST verify these prerequisites BEFORE writing any test code:**

### 1. Verify insites-cli Installation

```bash
insites-cli -v
```

**Expected:** Version number displayed. If command not found, install insites-cli first.

### 2. Verify Environment Configuration

```bash
cd project_directory && insites-cli env list
```

**Expected:** At least one staging/development environment listed.

### 3. The Test Module Ships with insites-cli

The `insites_test` module is bundled inside insites-cli. `insites-cli test run <env>` installs or updates it on the instance before it runs, so there is nothing to install by hand. Its partials live under `modules/insites_test/` (assertions under `modules/insites_test/assertions/`, the error helper at `modules/insites_test/helpers/register_error`).

---

## Phase 1: Test Planning

### 1.1 Announce Your Test Plan

**YOU MUST announce your test plan BEFORE writing any code.** State explicitly:

- What functionality you are testing
- Which assertions you will use
- What edge cases you will cover
- Expected success and failure scenarios

```
ANNOUNCE: "I am planning tests for [FEATURE]. I will test:
1. [SUCCESS SCENARIO] using [ASSERTION]
2. [FAILURE SCENARIO] using [ASSERTION]
3. [EDGE CASE] using [ASSERTION]"
```

### 1.2 Identify Test Location

**Every test file MUST be placed in:** `app/lib/test/` directory

**Every test file MUST end with:** `_test.liquid`

```
VALID:   app/lib/test/user_test.liquid
VALID:   app/lib/test/auth/login_test.liquid
INVALID: app/lib/tests/user.liquid
INVALID: app/tests/user_test.liquid
INVALID: tests/user_test.liquid
```

### 1.3 Map Assertions to Requirements

Before writing, map each requirement to an assertion:

| Requirement Type | Required Assertion |
|------------------|-------------------|
| Value equality | `equal` |
| Field must be empty/null | `blank` |
| Field must exist and have value | `presence` |
| Field must be null or missing | `not_presence` |
| Object validation passes | `valid_object` |
| Object validation fails | `not_valid_object` or `invalid_object` |
| Object contains specific key-value | `object_contains_object` |
| Boolean true check | `true` |
| Boolean false check | `not_true` |

### 1.4 Components That MUST Have Unit Tests

**YOU MUST identify testable components before writing any code.** The following components require unit tests in order of priority:

#### 1.4.1 Commands (HIGHEST PRIORITY)

Commands contain business logic. These are your PRIMARY test targets.

```
app/lib/commands/
├── users/
│   ├── create.liquid      → test/commands/users/create_test.liquid
│   ├── update.liquid      → test/commands/users/update_test.liquid
│   └── delete.liquid      → test/commands/users/delete_test.liquid
├── orders/
│   ├── place.liquid       → test/commands/orders/place_test.liquid
│   └── cancel.liquid      → test/commands/orders/cancel_test.liquid
```

**What to test in commands:**
- Valid input produces expected output
- Invalid input returns validation errors
- Edge cases (empty values, max lengths, special characters)
- Business rules are enforced
- Side effects occur correctly (records created, emails sent)

#### 1.4.2 Validators (HIGH PRIORITY)

Custom validation logic that commands depend on.

```
app/lib/validators/
├── email_format.liquid    → test/validators/email_format_test.liquid
├── phone_number.liquid    → test/validators/phone_number_test.liquid
├── unique_slug.liquid     → test/validators/unique_slug_test.liquid
```

**What to test in validators:**
- Valid inputs pass validation (return no errors)
- Invalid inputs fail with correct error messages
- Boundary conditions (min/max length, format edges)

#### 1.4.3 Queries (MEDIUM-HIGH PRIORITY)

GraphQL queries wrapped in Liquid functions.

```
app/lib/queries/
├── users/
│   ├── find.liquid        → test/queries/users/find_test.liquid
│   ├── search.liquid      → test/queries/users/search_test.liquid
│   └── list.liquid        → test/queries/users/list_test.liquid
```

**What to test in queries:**
- Query returns expected data structure
- Query handles missing records gracefully (returns nil or empty)
- Filters work correctly
- Pagination returns correct subsets
- Sorting produces expected order

#### 1.4.4 Authorization/Permissions (HIGH PRIORITY)

Access control logic that gates functionality.

```
app/lib/authorization/
├── can_edit.liquid        → test/authorization/can_edit_test.liquid
├── can_delete.liquid      → test/authorization/can_delete_test.liquid
├── can_view.liquid        → test/authorization/can_view_test.liquid
```

**What to test in authorization:**
- Authorized users CAN perform action (returns true)
- Unauthorized users CANNOT perform action (returns false)
- Edge cases: no user, suspended user, expired session
- Role-based access: admin vs regular user vs guest

#### 1.4.5 Helpers/Utilities (MEDIUM PRIORITY)

Reusable utility functions used across the application.

```
app/lib/helpers/
├── format_currency.liquid → test/helpers/format_currency_test.liquid
├── slugify.liquid         → test/helpers/slugify_test.liquid
├── truncate_text.liquid   → test/helpers/truncate_text_test.liquid
```

**What to test in helpers:**
- Correct output for typical inputs
- Edge cases: nil, empty string, special characters
- Boundary values (very long strings, zero, negative numbers)

#### 1.4.6 Background Jobs (MEDIUM PRIORITY)

Async processes triggered by events or schedules.

```
app/lib/jobs/
├── send_digest.liquid     → test/jobs/send_digest_test.liquid
├── cleanup_expired.liquid → test/jobs/cleanup_expired_test.liquid
```

**What to test in jobs:**
- Job executes successfully with valid data
- Job handles missing or invalid data gracefully
- Job produces expected side effects

### 1.5 Test Planning Matrix

**Use this matrix when planning tests for ANY component:**

| Scenario Type | Description | Priority | Required? |
|---------------|-------------|----------|-----------|
| **Happy Path** | Valid input, expected success | CRITICAL | MUST |
| **Validation Failure** | Invalid input rejected with correct error | CRITICAL | MUST |
| **Authorization Denied** | Permission denied when appropriate | HIGH | MUST |
| **Not Found** | Handling of missing/deleted records | HIGH | MUST |
| **Edge Cases** | Nil, empty, boundary values | MEDIUM | SHOULD |
| **Error Recovery** | External failures handled gracefully | MEDIUM | SHOULD |
| **Idempotency** | Repeated calls don't corrupt data | LOW | COULD |
| **Concurrency** | Parallel execution doesn't cause conflicts | LOW | COULD |

### 1.6 Test Planning Template

**Before writing tests for any component, YOU MUST complete this template:**

```
COMPONENT: [path/to/component.liquid]
PURPOSE: [What this component does]

SUCCESS SCENARIOS:
1. [Describe valid input scenario] → [assertion to use]
2. [Describe another success case] → [assertion to use]

FAILURE SCENARIOS:
3. [Describe invalid input] → [assertion: not_valid_object or presence on errors]
4. [Describe authorization failure] → [assertion to use]
5. [Describe not found case] → [assertion to use]

EDGE CASES:
6. [Describe edge case 1] → [assertion to use]
7. [Describe edge case 2] → [assertion to use]

TEST FILE: app/lib/test/[path]_test.liquid
```

### 1.7 Example: Complete Test Plan for User Registration

**COMPONENT:** `app/lib/commands/users/create.liquid`
**PURPOSE:** Creates a new user account with email and password

```
SUCCESS SCENARIOS:
1. Valid email and password creates user → valid_object
2. Created user has correct email stored → equal
3. Created user has generated ID → presence
4. Created user has hashed password (not plaintext) → not_equal
5. Welcome email is triggered → valid_object on email result

FAILURE SCENARIOS:
6. Missing email returns validation error → not_valid_object
7. Invalid email format rejected → not_valid_object
8. Password too short rejected → not_valid_object
9. Password missing rejected → not_valid_object
10. Duplicate email rejected → not_valid_object
11. Error message mentions 'email' for email errors → presence on errors.email

EDGE CASES:
12. Email with leading/trailing whitespace is trimmed → equal (trimmed value)
13. Email is lowercased for storage → equal (lowercase value)
14. Very long valid email (254 chars) works → valid_object
15. Email at max+1 length rejected → not_valid_object
16. Unicode in password accepted → valid_object
17. SQL injection attempt in email safely rejected → not_valid_object

TEST FILE: app/lib/test/commands/users/create_test.liquid
```

### 1.8 What NOT to Test

**DO NOT write unit tests for these components:**

| Component | Reason |
|-----------|--------|
| Static pages/layouts | No logic to test; visual inspection only |
| Pure HTML partials | No business logic |
| GraphQL schema definitions | Tested implicitly through queries |
| Third-party modules | Not your responsibility; assume they work |
| CSS/JavaScript | Requires different testing tools (Jest, Cypress) |
| Insites core functions | Already tested by the platform team |
| Configuration files | No executable logic |
| Translations/i18n files | Tested through integration tests |

### 1.9 Test Prioritization Order

**When adding tests to an existing codebase or starting fresh, prioritize in this order:**

1. **Commands that handle money/transactions** - Bugs here cause financial loss
2. **Commands that create/modify user data** - Bugs here cause data corruption
3. **Authorization/permission logic** - Bugs here cause security vulnerabilities
4. **Validators used by multiple commands** - High impact, many dependents
5. **Commands that send external communications** - Emails, SMS, webhooks
6. **Complex queries with business logic** - Filtering, aggregation, calculations
7. **Helpers used across the application** - High reuse means high impact
8. **Background jobs** - Failures may go unnoticed without tests

**RULE: Start with components where bugs cause the most damage.**

### 1.10 Test Coverage Requirements

**Minimum coverage requirements by component type:**

| Component Type | Minimum Scenarios | Required Scenario Types |
|----------------|-------------------|------------------------|
| Commands | 5+ | Happy path, 2+ validation failures, 1+ edge case |
| Validators | 3+ | Valid input, invalid input, boundary |
| Queries | 3+ | Found, not found, filtered |
| Authorization | 4+ | Allowed, denied, no user, edge case |
| Helpers | 3+ | Normal input, nil/empty, edge case |

---

## Phase 2: Writing Tests

### 2.1 Example Test File


```liquid
{% comment %}
  Test: Invalid email - should be invalid
{% endcomment %}
{% liquid
  assign data = '{ "email": "invalid-email", "body": "This is a valid message body." }' | parse_json
  function contact = 'commands/contacts/create', object: data

  function contract = 'modules/insites_test/assertions/not_valid_object', contract: contract, object: contact, field_name: 'contact'
  function contract = 'modules/insites_test/assertions/presence', contract: contract, object: contact.errors, field_name: 'email'
%}
```

### 2.1.1 How to Structure Multi-Test Files

```liquid
{% comment %}
  Test: Valid input - should be considered valid
{% endcomment %}

{% liquid
  assign data = '{ "email": "USER@example.com", "body": "This is a valid message body." }' | parse_json
  function contact = 'commands/contacts/create', object: data

  # 1. Contact should be valid
  function contract = 'modules/insites_test/assertions/valid_object', contract: contract, object: contact, field_name: 'contact'

  # 2. Email should be downcased
  assign expected_email = 'user@example.com'
  assign given_email = contact.email
  function contract = 'modules/insites_test/assertions/equal', contract: contract, expected: expected_email, given: given_email, field_name: 'contact.email'

  # 3. Body should match
  assign expected_body = 'This is a valid message body.'
  assign given_body = contact.body
  function contract = 'modules/insites_test/assertions/equal', contract: contract, expected: expected_body, given: given_body, field_name: 'contact.body'

  # 4: Assert the contact.valid is true
  function contract = 'modules/insites_test/assertions/true', contract: contract, object: contact, field_name: 'valid'

  # 5: Errors should be blank
  function contract = 'modules/insites_test/assertions/blank', contract: contract, object: contact, field_name: 'errors'
%}
```

### 2.2 The Contract Comes from the Runner

**The contract object is MANDATORY, and you never create it.** The runner builds it, passes it into every test as `contract`, and reads that same object back. Every test MUST:

1. Use the `contract` it was given. Never `assign contract = {}` or build a new one: later assertions would write to an object the runner never sees
2. Pass `contract` to every assertion
3. Assign every assertion's result back to `contract` (`function contract = 'modules/insites_test/assertions/...', contract: contract, ...`)

**FAILURE MODE:** Rebinding `contract`, or assigning an assertion's result to any other variable, makes the test pass while validating nothing. Check the `assertions` count in the JSON report: a test showing `0` asserted nothing.

### 2.3 Using Assertions

#### 2.3.1 Equal Assertion

**Use when:** Comparing two values for exact equivalence

```liquid
{% liquid
  assign expected = "hello"
  assign actual = "hello"

  function contract = 'modules/insites_test/assertions/equal',
    contract: contract,
    expected: expected,
    given: actual,
    field_name: 'greeting_value'

%}
```

#### 2.3.2 Blank Assertion

**Use when:** Field must be absent, null, or empty string

```liquid
{% liquid
  assign user = null | hash
  assign user['email'] = null

  function contract = 'modules/insites_test/assertions/blank',
    contract: contract,
    object: user,
    field_name: 'email'

%}
```

#### 2.3.3 Presence Assertion

**Use when:** Field MUST exist and have a non-null value

```liquid
{% liquid
  assign user = null | hash
  assign user['id'] = 123

  function contract = 'modules/insites_test/assertions/presence',
    contract: contract,
    object: user,
    field_name: 'id'

%}
```

#### 2.3.4 Not Presence Assertion

**Use when:** Field must be null or absent

```liquid
{% liquid
  assign response = null | hash
  assign response['error'] = null

  function contract = 'modules/insites_test/assertions/not_presence',
    contract: contract,
    object: response,
    field_name: 'error'

%}
```

#### 2.3.5 Valid Object Assertion

**Use when:** Testing that object.valid returns true

```liquid
{% liquid
  # Create/fetch an object that has validation
  function user = 'lib/commands/users/create', email: 'test@example.com'

  function contract = 'modules/insites_test/assertions/valid_object',
    contract: contract,
    object: user,
    field_name: 'user_creation'

%}
```

#### 2.3.6 Not Valid Object / Invalid Object Assertions

**Use when:** Testing that validation FAILS as expected

```liquid
{% liquid
  # Create object with invalid data
  function user = 'lib/commands/users/create', email: 'invalid-email'

  function contract = 'modules/insites_test/assertions/not_valid_object',
    contract: contract,
    object: user,
    field_name: 'invalid_user_rejected'

%}
```

#### 2.3.7 Object Contains Object Assertion

**Use when:** Validating specific key-value pairs exist in object

```liquid
{% liquid
  assign response = null | hash
  assign response['status'] = 'success'
  assign response['code'] = 200

  assign expected_subset = null | hash
  assign expected_subset['status'] = 'success'

  function contract = 'modules/insites_test/assertions/object_contains_object',
    contract: contract,
    object: response,
    subset: expected_subset,
    field_name: 'response_status'

%}
```

#### 2.3.8 True / Not True Assertions

**Use when:** Evaluating boolean conditions

```liquid
{% liquid
  assign is_admin = true

  function contract = 'modules/insites_test/assertions/true',
    contract: contract,
    value: is_admin,
    field_name: 'admin_flag'

  assign is_deleted = false

  function contract = 'modules/insites_test/assertions/not_true',
    contract: contract,
    value: is_deleted,
    field_name: 'not_deleted'

%}
```

### 2.4 Custom Assertions

**Use when:** Built-in assertions are insufficient

```liquid
{% liquid
  # Custom validation logic
  assign value = "test string"
  assign length = value | size

  if length < 5
    function contract = 'modules/insites_test/helpers/register_error',
      contract: contract,
      field_name: 'string_length',
      message: 'String must be at least 5 characters'
  endif

%}
```

### 2.5 Multiple Assertions Per Test

**Every test MUST have at least one assertion.** Multiple assertions are permitted and encouraged for comprehensive coverage:

```liquid
{% liquid
  function user = 'lib/commands/users/create',
    email: 'test@example.com',
    name: 'Test User'

  # Assertion 1: Creation succeeded
  function contract = 'modules/insites_test/assertions/valid_object',
    contract: contract,
    object: user,
    field_name: 'user_valid'

  # Assertion 2: Email is set
  function contract = 'modules/insites_test/assertions/presence',
    contract: contract,
    object: user,
    field_name: 'email'

  # Assertion 3: ID was generated
  function contract = 'modules/insites_test/assertions/presence',
    contract: contract,
    object: user,
    field_name: 'id'

%}
```

---

## Phase 3: Running Tests

### 3.1 Deployment Before Testing

**YOU MUST deploy before running tests. Every time. No exceptions.**

```bash
# MANDATORY before any test run
insites-cli deploy staging
```

### 3.2 Running Tests via CLI

**Primary method for CI/CD and local development:**

```bash
# Run ALL tests
insites-cli test run staging

# Run specific test file
insites-cli test run staging -n test/user_test

# Run tests in subdirectory
insites-cli test run staging -n test/auth/login_test
```

**Exit codes:**
- `0` = All tests passed
- Non-zero = Test failures occurred

### 3.3 Running via curl

```bash
# Run all tests and get JSON response
curl https://<instance>/_tests/run.js

# Run a specific test
curl "https://<instance>/_tests/run.js?name=test/examples/assertions_test"

# List all available tests as JSON
curl https://<instance>/_tests.js
```

### 3.4 Running Tests via Browser

**For debugging and manual inspection:**

| Endpoint | Purpose |
|----------|---------|
| `/_tests` | List all available test files |
| `/_tests.js` | List tests as JSON |
| `/_tests/run` | Execute all tests (HTML output) |
| `/_tests/run.js` | Execute all tests (JSON output) |
| `/_tests/run?name=test/user_test` | Run specific test |

### 3.5 Async Test Execution

**For long-running test suites:**

```
GET /_tests/run_async
```

This initiates background execution. Monitor via logs:

```bash
insites-cli logs staging
```

### 3.6 Real-Time Development

**For active development, use sync mode:**

```bash
# Terminal 1: Start sync
insites-cli sync staging

# Terminal 2: Watch logs
insites-cli logs staging

# Terminal 3: Run tests as needed
insites-cli test run staging -n test/your_test
```

---

## Phase 4: Email Testing

### 4.1 Accessing Sent Emails

**Navigate to:** `/_tests/sent_mails`

This endpoint displays paginated email records from test execution.

### 4.2 Inspecting Individual Emails

**Navigate to:** `/_tests/sent_mails/:id`

Replace `:id` with the email record ID to view full email details including:
- Recipients
- Subject
- Body content
- Headers
- Attachments

### 4.3 Email Assertions in Tests

```liquid
{% liquid
  # Trigger email sending
  function result = 'lib/commands/notifications/send_welcome_email',
    user_id: user.id

  # Verify email was sent successfully
  function contract = 'modules/insites_test/assertions/valid_object',
    contract: contract,
    object: result,
    field_name: 'welcome_email_sent'

%}
```

---

## Phase 5: Fixing Failing Tests

### 5.1 Diagnostic Protocol

**When a test fails, YOU MUST execute this protocol IN ORDER:**

1. **Read the error message completely**
2. **Identify the failing assertion by field_name**
3. **Check the actual vs expected values**
4. **Trace back to the source of incorrect data**
5. **Fix the root cause, not the symptom**

### 5.2 Common Failures and Fixes

#### Contract Not Initialized

**Symptom:** Test runs but no assertions execute

**Fix:**
```liquid
{% liquid
  # ADD THIS AS FIRST LINE
  # ... rest of test ...

%}
```

#### Contract Not Returned

**Symptom:** Test appears to pass but results aren't collected

**Fix:**
```liquid
{% liquid
  # ... test code ...

  # ADD THIS AS LAST LINE
%}
```

#### Wrong File Location

**Symptom:** Test not discovered by runner

**Fix:** Move file to `app/lib/test/` with `_test.liquid` suffix

#### Assertion Receives Nil Contract

**Symptom:** Error about nil contract in assertion

**Fix:** Ensure contract is passed through every assertion:
```liquid
# WRONG - contract not updated
function result = 'modules/insites_test/assertions/equal',
  contract: contract,
  expected: expected,
  given: actual,
  field_name: 'test'

# CORRECT - contract reassigned
function contract = 'modules/insites_test/assertions/equal',
  contract: contract,
  expected: expected,
  given: actual,
  field_name: 'test'
```

#### Object Property Access Errors

**Symptom:** Cannot access property of nil

**Fix:** Add presence checks or use blank/presence assertions:
```liquid
{% liquid
  if user != blank
    function contract = 'modules/insites_test/assertions/equal',
      contract: contract,
      expected: expected_email,
      given: user.email,
      field_name: 'user_email'
  else
    function contract = 'modules/insites_test/helpers/register_error',
      contract: contract,
      field_name: 'user_exists',
      message: 'User object is nil'
  endif
%}
```

### 5.3 Debugging with Logs

```bash
# Watch logs while running tests
insites-cli logs staging

# In another terminal
insites-cli test run staging -n test/failing_test
```

### 5.4 Debugging with Browser

1. Navigate to `/_tests/run?name=test/failing_test`
2. Examine HTML output for detailed error messages
3. Check `/_tests/run.js?path=test/failing_test` for structured JSON errors

---

## Security Constraints

**ABSOLUTE RULES - NO EXCEPTIONS:**

1. **NEVER run tests in production environments**
2. **The test runner ONLY operates on staging or development**
3. **Test data MUST be isolated and cleaned up**
4. **Credentials in tests MUST use environment variables or test fixtures**
5. **Email testing MUST use test recipients, never real addresses**

---

## Verification Checklist

**Before committing any test, YOU MUST verify:**

- [ ] File is in `app/lib/test/` directory
- [ ] File ends with `_test.liquid`
- [ ] Contract is initialized as first operation
- [ ] Contract is returned as last operation
- [ ] Every assertion updates the contract variable
- [ ] At least one assertion exists
- [ ] Test runs successfully via `insites-cli test run staging`
- [ ] Test fails appropriately when expected conditions aren't met
- [ ] No hardcoded credentials or production data

---

## Quick Reference Card

### File Location
```
app/lib/test/*_test.liquid
```

### Essential Commands
```bash
insites-cli deploy staging              # Deploy before testing
insites-cli test run staging            # Run all tests
insites-cli test run staging -n test/name  # Run specific test
insites-cli sync staging                # Real-time sync
insites-cli logs staging                  # View logs
```

### Browser Endpoints
```
/_tests                 # List tests
/_tests/run             # Run all tests
/_tests/run?path=X      # Run specific test
/_tests/sent_mails      # View sent emails
/_tests/sent_mails/:id  # View specific email
```

### Test Template
```liquid
{% liquid
  # Setup and execution here

  function contract = 'modules/insites_test/assertions/equal',
    contract: contract,
    expected: expected_value,
    given: actual_value,
    field_name: 'test_name'

%}
```

### Available Assertions
```
equal              - Compare two values
blank              - Field is empty/null
presence           - Field exists with value
not_presence       - Field is null/missing
valid_object       - object.valid is true
not_valid_object   - object.valid is not true
invalid_object     - object.valid is falsy
object_contains_object - Object has key-value subset
true               - Value is truthy
not_true           - Value is falsy
```

### Custom Error Registration
```liquid
function contract = 'modules/insites_test/helpers/register_error',
  contract: contract,
  field_name: 'identifier',
  message: 'Error description'
```

---

## References

- [Insites Documentation](https://docs.insites.io/)
- [Testing reference](https://github.com/insites-io/insites-logic-engine/blob/master/skills/insites/references/testing/README.md) in the Insites Logic Engine
