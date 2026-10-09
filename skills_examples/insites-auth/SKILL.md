---
name: insites-auth
description: Protocols for implementing user authentication in Insites
---

## Overview

This skill provides **absolute, non-negotiable protocols** for implementing user authentication in Insites applications. YOU MUST follow every instruction precisely. Authentication is security-critical—deviations introduce vulnerabilities that compromise user data and system integrity.

Insites provides built-in authentication infrastructure including:
- User registration with bcrypt password hashing
- Session-based authentication with CSRF protection
- Login/logout flows with secure cookie management
- Password verification via GraphQL `authenticate` method
- `context.current_user` for accessing the logged-in user
- `authorization_policies/` for page-level access control

**CRITICAL:** Authentication code is NOT something you improvise. Every pattern in this skill exists because alternatives have known security flaws.

---

## Critical Prerequisites

**YOU MUST verify these prerequisites BEFORE writing any authentication code:**

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

---

## Phase 1: Understanding the Authentication Model

### 1.1 Core Concepts

**YOU MUST understand these concepts before writing any code:**

| Concept | Definition | Storage |
|---------|------------|---------|
| **User** | Identity record with email/password | Database with bcrypt hash |
| **Session** | Authenticated state | Secure HTTP-only cookie |
| **Profile** | Extended user data with roles | Linked to User |
| **CSRF Token** | Request forgery protection | `context.authenticity_token` |

### 1.2 Authentication vs Authorization

| Type | Question Answered | Implementation |
|------|-------------------|----------------|
| **Authentication** | "Who are you?" | `context.current_user` |
| **Authorization** | "What can you do?" | `authorization_policies/` with role checks |

**RULE:** Authentication MUST be implemented before authorization. Never check permissions without first verifying identity.

### 1.3 Security Guarantees

Insites provides these security features automatically:

- **Bcrypt password hashing** - Passwords are NEVER stored in plain text
- **CSRF protection** - Sessions invalidate without authenticity tokens
- **Session fixation prevention** - `sign_in` creates new sessions
- **Secure cookies** - HTTP-only, secure flags set automatically
- **Email uniqueness** - Enforced at database level (case-insensitive)

**NEVER attempt to implement these yourself. Use the built-in mechanisms.**

---

## Phase 2: Implementing Registration

### 2.1 Announce Your Implementation Plan

**YOU MUST announce your plan BEFORE writing code:**

```
ANNOUNCE: "I am implementing user registration. I will:
1. Create GraphQL mutation for user creation
2. Create registration endpoint with sign_in
3. Create registration form with CSRF token
4. Test registration flow end-to-end"
```

### 2.2 Create User Creation GraphQL Mutation

**File:** `app/graphql/user/create.graphql`

```graphql
mutation create_user($email: String!, $password: String!) {
  user_create(
    user: {
      email: $email
      password: $password
    }
  ){
    id
  }
}
```

**CRITICAL RULES:**
- Password is automatically hashed by Insites - NEVER hash it yourself
- Email uniqueness is enforced automatically - NEVER check manually
- Both fields are required (`!`) - NEVER make them optional

### 2.3 Create Registration Endpoint

**File:** `app/views/pages/user/create.liquid`

```liquid
---
method: post
---

{% liquid
  graphql result = 'user/create', email: context.params.email, password: context.params.password

  if result.user_create.id
    sign_in user_id: result.user_create.id
    redirect_to '/'
  else
    echo 'Registration failed'
    echo result.errors
  endif
%}
```

**MANDATORY ELEMENTS:**
- `method: post` in frontmatter - NEVER use GET for data modification
- `sign_in` after successful creation - Auto-login the user
- `redirect_to` after sign_in - Prevent form resubmission
- Error handling with `result.errors` - Never fail silently

### 2.4 Create Registration Form

**File:** `app/views/pages/sign-up.liquid`

```liquid
---
slug: sign-up
---

<h1>Create Account</h1>

<form action="/user/create" method="post">
  <input type="hidden" name="authenticity_token" value="{{ context.authenticity_token }}">

  <fieldset>
    <label for="email">Email</label>
    <input type="email" id="email" name="email" required autocomplete="email">
  </fieldset>

  <fieldset>
    <label for="password">Password</label>
    <input type="password" id="password" name="password" required autocomplete="new-password" minlength="6">
  </fieldset>

  <button type="submit">Sign Up</button>
</form>

<p>Already have an account? <a href="/sessions/new">Sign in</a></p>
```

**ABSOLUTE REQUIREMENTS:**
- `authenticity_token` hidden field - CSRF protection, NEVER omit
- `method="post"` - NEVER use GET
- `type="email"` - Browser validation
- `type="password"` - Masks input
- `required` attribute - Client-side validation
- `autocomplete` attributes - Password manager support
- `minlength="6"` - Minimum password length

---

## Phase 3: Implementing Login

### 3.1 Create Password Verification Query

**File:** `app/graphql/user/verify_password.graphql`

```graphql
query verify($email: String!, $password: String!){
  users(
    filter: { email: { value: $email } },
    per_page: 1
  ){
    results {
      id
      email
      authenticate {
        password(password: $password)
      }
    }
  }
}
```

**CRITICAL:** The `authenticate.password` field performs bcrypt comparison server-side. NEVER compare passwords in Liquid.

### 3.2 Create Login Endpoint

**File:** `app/views/pages/session/create.liquid`

```liquid
---
method: post
---

{% liquid
  graphql result = 'user/verify_password', email: context.params.email, password: context.params.password

  assign user = result.users.results.first

  if user.authenticate.password
    sign_in user_id: user.id
    redirect_to '/'
  else
    redirect_to '/sessions/new?error=invalid_credentials'
  endif
%}
```

**SECURITY RULES:**
- Check `user.authenticate.password` - NEVER check user existence separately
- Use generic error message - NEVER reveal if email exists
- `sign_in` creates new session - Prevents session fixation
- Always redirect after - NEVER render on POST

### 3.3 Create Login Form

**File:** `app/views/pages/sign-in.liquid`

```liquid
---
slug: sign-in
---

<h1>Sign In</h1>

{% if context.params.error == 'invalid_credentials' %}
  <div class="error">Incorrect email or password</div>
{% endif %}

<form action="/session/create" method="post">
  <input type="hidden" name="authenticity_token" value="{{ context.authenticity_token }}">

  <fieldset>
    <label for="email">Email</label>
    <input type="email" id="email" name="email" required autocomplete="email">
  </fieldset>

  <fieldset>
    <label for="password">Password</label>
    <input type="password" id="password" name="password" required autocomplete="current-password">
  </fieldset>

  <button type="submit">Sign In</button>
</form>

<p>Don't have an account? <a href="/sign-up">Create one</a></p>
```

**MANDATORY:**
- `authenticity_token` - CSRF protection
- Generic error message - Security best practice
- `autocomplete="current-password"` - Distinct from registration

---

## Phase 4: Implementing Logout

### 4.1 Create Session Destroy Mutation

**File:** `app/graphql/session/delete.graphql`

```graphql
mutation {
  user_session_destroy
}
```

### 4.2 Create Logout Endpoint

**File:** `app/views/pages/session/delete.liquid`

```liquid
---
method: delete
---

{% liquid
  graphql result = 'session/delete'
  redirect_to '/'
%}
```

### 4.3 Add Logout to Layout

**File:** `app/views/layouts/application.liquid`

```liquid
<!DOCTYPE html>
<html class="pos-app">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{ page.metadata.title | default: 'My App' }}</title>
</head>
<body>
  <nav>
    <a href="/">Home</a>

    {% if context.current_user %}
      <span>Logged in as {{ context.current_user.email }}</span>

      <form action="/session/delete" method="post" style="display: inline;">
        <input type="hidden" name="authenticity_token" value="{{ context.authenticity_token }}">
        <input type="hidden" name="_method" value="delete">
        <button type="submit">Log Out</button>
      </form>
    {% else %}
      <a href="/sessions/new">Login</a>
      <a href="/sign-up">Sign Up</a>
    {% endif %}
  </nav>

  <main>
    {{ content_for_layout }}
  </main>
</body>
</html>
```

**CRITICAL ELEMENTS:**
- `context.current_user` check - Determines auth state
- `_method: delete` - HTTP method override for forms
- `authenticity_token` - REQUIRED for all POST/DELETE
- Logout as form, not link - DELETE requires POST

---

## Phase 5: Using the User Module's Built-in Endpoints

### 5.1 Available Endpoints

The User Module provides these endpoints automatically:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/sessions/new` | GET | Login form (styled) |
| `/sessions` | POST | Process login |
| `/sessions` | DELETE | Process logout |
| `/users/new` | GET | Registration form (styled) |
| `/users` | POST | Process registration |
| `/passwords/reset` | GET | Password reset form |
| `/passwords` | POST | Send reset email |

### 5.2 Using Built-in vs Custom

**Use built-in endpoints when:**
- You want styled, ready-to-use forms
- Standard authentication flow is sufficient
- You're prototyping quickly

**Create custom endpoints when:**
- You need custom validation logic
- You're integrating with external systems
- You need custom redirects after auth
- You're building API-style authentication

### 5.3 Accessing Current Profile

The User Module provides a helper for the full user profile:

```liquid
{% liquid
  # Method 1: Direct from context (if already loaded)
  if context.exports.current_profile
    assign current_profile = context.exports.current_profile
  else
    # Method 2: Load via helper
    function current_profile = 'modules/user/helpers/current_profile'
  endif

  if current_profile
    echo current_profile.email
  endif
%}
```

---

## Phase 6: Testing Authentication

### 6.1 Test Registration Flow

**YOU MUST test these scenarios:**

| Test | Steps | Expected Result |
|------|-------|-----------------|
| Valid registration | Submit valid email/password | User created, auto-login, redirect to home |
| Duplicate email | Register with existing email | Error displayed, no duplicate created |
| Invalid email format | Submit malformed email | Form validation prevents submission |
| Empty password | Submit without password | Form validation prevents submission |
| Short password | Submit <6 char password | Validation error |

### 6.2 Test Login Flow

| Test | Steps | Expected Result |
|------|-------|-----------------|
| Valid login | Correct email/password | Session created, redirect to home |
| Wrong password | Correct email, wrong password | Generic error, no session |
| Non-existent email | Unregistered email | Generic error (same as wrong password) |
| Empty fields | Submit empty form | Form validation prevents submission |

### 6.3 Test Logout Flow

| Test | Steps | Expected Result |
|------|-------|-----------------|
| Logout while logged in | Click logout | Session destroyed, redirect to home |
| Access protected page after logout | Try /admin | Redirected to login |

### 6.4 Test Session Persistence

| Test | Steps | Expected Result |
|------|-------|-----------------|
| Session survives refresh | Login, refresh page | Still logged in |
| Session survives navigation | Login, navigate around | Still logged in |
| New tab shares session | Login, open new tab | Logged in on both tabs |

### 6.5 Verification Commands

```bash
# Deploy changes
insites-cli deploy staging

# Watch logs for errors
insites-cli logs staging

# Open GUI to inspect users
insites-cli gui serve staging
# Navigate to localhost:3333 → Database → users
```

---

## Phase 7: Writing Unit Tests

### 7.1 Plan and Write Tests

Plan and Write all necessary unit tests to comprehensively check authorization.
Use `insites-unit-tests` skill for that task.

### 7.2 Running Tests

```bash
# Run all auth tests
insites-cli test run staging

# Run specific test
insites-cli test run staging test/user_test

# Run with logs visible
insites-cli logs staging &
insites-cli test run staging test/auth
```
Verify that all tests passed.

---

## Security Checklist

**Before deploying authentication, YOU MUST verify:**

- [ ] All forms include `authenticity_token`
- [ ] Registration uses `type="password"` input
- [ ] Login uses generic error messages
- [ ] Logout uses POST with `_method=delete`
- [ ] No passwords logged or displayed
- [ ] `sign_in` called after registration
- [ ] Redirects follow all POST actions
- [ ] HTTPS enabled on production
- [ ] Session timeout configured appropriately
- [ ] Password minimum length enforced

---

## Common Errors and Fixes

### "Invalid authenticity token"

**Cause:** Missing or incorrect CSRF token

**Fix:**
```liquid
<input type="hidden" name="authenticity_token" value="{{ context.authenticity_token }}">
```

### "User not found after registration"

**Cause:** `sign_in` not called

**Fix:** Add `sign_in user_id: result.user_create.id` after successful creation

### "Login always fails"

**Cause:** Checking user existence instead of password

**Fix:** Check `user.authenticate.password`, not just `user`

### "Logout doesn't work"

**Cause:** Using GET instead of POST/DELETE

**Fix:** Use form with `method="post"` and `_method="delete"`

### "Session lost on page refresh"

**Cause:** Cookie not set (usually HTTPS issue)

**Fix:** Ensure staging uses HTTPS, check browser cookie settings

---

## File Structure Summary

```
app/
├── graphql/
│   ├── user/
│   │   ├── create.graphql
│   │   └── verify_password.graphql
│   └── session/
│       └── delete.graphql
├── views/
│   ├── layouts/
│   │   └── application.liquid
│   └── pages/
│       ├── sign-up.liquid
│       ├── sign-in.liquid
│       ├── user/
│       │   └── create.liquid
│       └── session/
│           ├── create.liquid
│           └── delete.liquid
└── lib/
    └── test/
        └── auth/
            ├── registration_test.liquid
            └── login_test.liquid
```

---

## Quick Reference

### Essential Tags

```liquid
{% sign_in user_id: user.id %}                    # Create session
{% sign_in user_id: user.id, timeout_in_minutes: 60 %}  # With timeout

{{ context.current_user }}                         # Current user object
{{ context.current_user.id }}                      # User ID
{{ context.current_user.email }}                   # User email
{{ context.authenticity_token }}                   # CSRF token
```

### Essential GraphQL

```graphql
# Create user
mutation { user_create(user: { email: $email, password: $password }) { id } }

# Verify password
query { users(filter: { email: { value: $email } }) {
  results { id authenticate { password(password: $password) } }
}}

# Destroy session
mutation { user_session_destroy }

# Delete user
mutation { user_delete(id: $id) { id } }
```

### Essential Endpoints

```
GET  /sessions/new     # Login form
POST /sessions         # Process login
DELETE /sessions       # Logout

GET  /users/new        # Registration form
POST /users            # Process registration

GET  /passwords/reset  # Password reset form
```

---

## References

- [User Authentication Guide](https://documentation.platformos.com/get-started/build-your-first-app/user-authentication)
- [User Module Documentation](https://documentation.platformos.com/developer-guide/modules/user-module)
- [Security Best Practices](https://documentation.platformos.com/best-practices/security)
- [Session Management](https://documentation.platformos.com/api-reference/liquid/tags/sign_in)
