# Authorization

**Read this before your page has real data on it.** The failure mode here is not an error
message, it is a page that works and publishes more than you meant.

## Your page carries its own access control

A page with no `authorization_policies` in its front matter is **public**. There is no
inherited default.

```liquid
---
slug: team/contacts
format: html
authorization_policies:
  - modules/insites_crm/insites_only_allowed_if_logged_in
---
```

## Calling a controller bypasses the REST endpoint's policy

This is the one that costs people a data breach rather than a bug.

`GET /crm/api/v2/contacts` is protected by a guard on **the endpoint page** (an inline
`api_key_guard` function on CRM V2 pages; an authorization policy elsewhere), not on the
controller. When you call
`crm/controller/contacts/list` directly with `{% function %}`, **that endpoint page is
never involved, so its policy never runs.**

So the protection you can see when you read the REST reference does not travel with the
controller. Your page is responsible for its own access control, always.

A page that omits its policy and calls the contacts controller **publishes the entire
contact database** to anyone with the URL, and renders perfectly while doing it.

## `insites_only_allowed_if_logged_in` is weaker than it sounds

It admits **any signed-in user on the instance**, which on an instance with public
registration or many staff accounts is a much larger set than you intend.

For anything customer-facing, write your own policy rather than reusing it. Use it for an
internal page where every signed-in user is genuinely allowed to see the data.

## A policy that returns a redirect is a policy that leaks

Consider what an unauthorised caller learns. A redirect to a login page confirms that the
page exists and roughly what it is for. If a page should be invisible rather than merely
protected, have it answer 404 rather than redirecting.

## A JSON endpoint whose policy fails answers with a redirect

When a front-matter policy fails, the platform redirects to the policy's `redirect_to`
(`api/401` for `has_valid_instance_api_authorization`). A browser follows that happily. An
API client gets a 302 where it expected a 401, and a client that follows redirects re-issues
a POST as a GET. That is why the CRM V2 pages moved to an inline guard function that answers
401 JSON on the URL that was called. If your endpoint is called by machines, test its failure
path with the client that will call it.

## Reading an API key from a header

Headers are keyed the CGI way: `X-Api-Key` arrives as `context.headers.HTTP_X_API_KEY`, and
`context.headers['X-Api-Key']` is **blank**. A guard that compares a blank header with a
blank expected value passes for everyone, so check the expected value is present first. See
[liquid/objects](../liquid/objects/README.md#contextheaders).

## Checklist before a page goes live

1. Does the front matter declare `authorization_policies`? If not, the page is public.
2. Is the policy narrower than "any signed-in user"?
3. Does the page call a controller whose REST endpoint is protected? Then that protection
   is **not** applying here. Confirm your own policy covers it.
4. Load the page while signed out and confirm you get what you intended.

Step 4 is the only one that is evidence. The first three are intentions.
