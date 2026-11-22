# Testing Liquid on an Insites instance

Insites ships a Liquid test framework, the **`insites_test`** module. You write tests as
Liquid partials, run them with `insites-cli test run`, and gate CI on the exit code. Tests
run against a real instance — there is no local mock — so they exercise your actual GraphQL,
commands, and data.

- **Module slug:** `insites_test` — partials live under `modules/insites_test/…`
- **Runs on:** `staging` and `development` only. Both runners refuse production.
- **The module ships inside `insites-cli`** — `test run` installs or updates it for you, so
  there is nothing to fetch.

## Write a test

A test is any partial whose file name **ends `_test.liquid`**. It receives a `contract`
object from the runner, calls assertions that mutate it, and that is the whole shape:

```liquid
{% liquid
  assign payload = '{ "email": "person@example.com", "roles": ["admin","editor"] }' | parse_json

  function contract = 'modules/insites_test/assertions/presence',     contract: contract, object: payload, field_name: 'email'
  function contract = 'modules/insites_test/assertions/match',        contract: contract, given: payload.email, pattern: '.+@.+\..+', field_name: 'email shape'
  function contract = 'modules/insites_test/assertions/includes',     contract: contract, given: payload.roles, expected: 'admin', field_name: 'has admin role'
  function contract = 'modules/insites_test/assertions/equal',        contract: contract, given: payload.roles.size, expected: 2, field_name: 'role count'
  function contract = 'modules/insites_test/assertions/not_includes', contract: contract, given: payload.roles, expected: 'owner', field_name: 'not an owner'
%}
```

Save it, deploy, and run it (next section). Testing your own code — a command, a query, a
private partial — is never restricted: a test anywhere can call any partial by path.

### Where the file goes

| Location | Runnable by |
|---|---|
| `app/lib/test/<name>_test.liquid` (an app) | CLI and the `/_tests` pages |
| `modules/insites_<name>/private/lib/test/<name>_test.liquid` (a module) | **CLI only** |
| `modules/insites_<name>/public/views/partials/lib/test/<name>_test.liquid` (a module) | CLI and the pages |

Put a module's tests wherever its internals live (`private/`) and run them with the CLI.
Use `public/` only if a test must also be openable from `/_tests` in a browser. The reason:
the pages discover tests with a GraphQL query that cannot see a module's `private/` tree —
the CLI has no such limit because it addresses each test by path.

## Four rules that prevent silent passes

Break any of these and the test reports success while asserting nothing. All four are
platform behaviours, not style.

1. **File name ends `_test.liquid`.** Both runners key off the suffix. `test_user.liquid`
   and `user_tests.liquid` are found by neither.
2. **Never create your own `contract`.** The runner builds it, passes it in, and reads that
   same object back. Rebinding it to a fresh hash (`assign contract = {}`) points every
   later assertion at an object the runner never sees. Use the one you were given.
3. **Reassign `contract` on every assertion.** `function contract = '…/assertions/equal', contract: contract, …`.
   Assigning the result to any other variable discards that assertion.
4. **Reading a property of nil does not raise.** `user.profile.email` on a nil `user` is
   nil, not an error, and a test built on it passes quietly. Assert the object exists first
   with `assertions/presence`.

Sanity check: the JSON report gives an `assertions` count per test. A test showing `0`
asserted nothing, whatever its status says.

## Run with insites-cli

```bash
insites-cli test run <env>                 # every test in this project
insites-cli test run <env> -n <NAME>       # only paths containing NAME
insites-cli test run <env> --min-tests 12  # fail unless at least 12 tests run
insites-cli test run <env> --isolate       # roll back every DB write the tests make
insites-cli test run <env> --via-pages     # run what the instance has, not your checkout
```

`test run` globs `**/*_test.liquid` in your checkout, maps each to the partial path the
instance knows it by, and runs them. A test in your checkout but not yet on the instance is
listed with the deploy command to fix it — so **deploy first** (`insites-cli deploy <env>`),
or run `insites-cli sync <env>` while you iterate.

Before running anything it reads `context.environment` from the instance and refuses unless
it is `staging` or `development`. That check is on what the *instance* reports, not your
local env name: an entry called `prod-copy` pointing at staging runs; one called `staging`
pointing at production does not.

### HTTP endpoints (browser / curl)

The same suite is reachable over HTTP — useful for a quick look or to see sent emails:

| Endpoint | Purpose |
|---|---|
| `/_tests` | HTML index of discovered tests |
| `/_tests/run` | run all (HTML); `?formatter=text` for plain text |
| `/_tests/run.js` | run all (JSON) |
| `/_tests/run?name=<file>_test` | run one |
| `/_tests/sent_mails` | emails sent during tests |

```bash
curl -s "https://<instance>/_tests/run.js" | jq '.'
```

Two limits the CLI does not have: the pages cannot see a module's `private/` tests, and
they run the whole suite in one render, so a test that *raises* can misreport the tests
after it. Prefer the CLI; reach for the pages when you need `--isolate` rollback or the
browser view.

## Gate CI on the exit code

```bash
insites-cli test run staging --min-tests 12
```

`test run` exits non-zero when a test fails **and** when no test ran at all. Guard that
second case: a suite that discovered nothing is not a pass — it happens when tests were not
deployed, a file was misnamed (rule 1), or the page runner was pointed at private tests.
`--min-tests <n>` sets a floor. Gating on the HTTP endpoint means checking the counts
yourself, because it returns 200 with `total_tests: 0`:

```bash
curl -s "https://<instance>/_tests/run.js" | jq -e '.success and .total_tests > 0 and .total_assertions > 0'
```

In zsh, `echo "$json"` turns a `\n` inside a JSON string into a real newline and corrupts the JSON. Pipe with `printf '%s\n' "$json"` or write the response to a file first (measured 22 November 2026).

## Assertions

All take `contract` and `field_name` and return the updated contract.

| Group | Assertions |
|---|---|
| Equality | `equal`, `not_equal`, `object_equal` (deep, key-order-independent) |
| Ordering | `greater_than`, `less_than` |
| Presence | `blank`, `presence`, `not_presence`, `empty`, `not_empty` |
| Booleans | `true`, `not_true` (pass `value:`, or `object:` + `field_name`) |
| Object validity | `valid_object`, `not_valid_object`, `invalid_object` (reports `object.errors`) |
| Collections / strings | `includes`, `not_includes`, `starts_with`, `ends_with`, `match` (regex), `object_contains_object` |
| Types | `type` (compares against `given | type_of`) |

`presence`/`blank`/`not_presence`/`true`/`not_true` take either a bare `given`/`value` or an
`object:` plus the `field_name` key to read from it. `blank` is nil/false/`''`; `empty` only
checks size, so `false` is not empty. When unsure of a `type` name, print `{{ value | type_of }}`
once rather than guessing. The real values are capitalized (`Hash`, `Array`, `String`, `Integer`,
`Float`, `Boolean`, `null`; a posted object is `ActiveSupport::HashWithIndifferentAccess`), measured
on 17 November 2026: see [filters gotchas](../liquid/filters/gotchas.md).

Need a check no assertion covers? Fail one by hand:

```liquid
{% liquid
  if value.size < 5
    function contract = 'modules/insites_test/helpers/register_error', contract: contract, field_name: 'string_length', message: 'must be at least 5 characters'
  endif
%}
```

## Gotchas worth knowing

- **Tests are not rolled back by default.** A test that creates a record leaves it on the
  instance — there are no fixtures and no teardown. Pass `--isolate` (page runner) to wrap
  each test in a transaction that rolls back. Trade-off: `--isolate` cannot see a module's
  private tests, so today it is private tests *or* rollback, not both. Things outside the
  database (an email actually sent, an external API called) are never rolled back.
- **No mocking.** Every test hits the real instance and real GraphQL. Make tests
  self-contained — build the data they need — so they pass the same way in CI.
- **A deleted test can still run** if it was left on the instance and you use the pages. The
  CLI ignores such orphans; the pages do not. Run with the CLI, or do a full deploy.
- **A raising test does not stop a CLI run** — it is recorded as a `runtime_error` against
  itself and the rest continue. On the `/_tests` pages a raise can corrupt the reporting of
  later tests (a platform quirk the CLI works around), another reason to prefer the CLI.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Test not listed at `/_tests` | it is under a module's `private/` | run it with `insites-cli test run` |
| Found by neither runner | name does not end `_test.liquid`, or not deployed | rename, then `insites-cli deploy <env>` |
| "in this project but not on the instance" | written but not deployed | `insites-cli deploy <env>` |
| Passes but validates nothing | `contract` not reassigned (rule 3) or rebound (rule 2) | check the `assertions` count is > 0 |
| `runtime_error` in output | the file raised, usually a nil property read | guard with `if x != blank` |
| `can't find partial 'modules/insites_test/…'` | module not installed there | `insites-cli test run <env>` installs it |
| Nothing runs, no error | instance is not staging/development | tests cannot run elsewhere by design |
| Passes locally, fails in CI | different data / missing constants | make the test self-contained; set constants on the CI env |

---

The authoritative, exhaustive reference (all 22 assertions in detail, the transaction /
rollback mechanics, and every measured platform behaviour) is `TESTING.md` in the
`insites-test` module repository. This page is the working subset: write a test, run it with
the CLI, gate CI.
