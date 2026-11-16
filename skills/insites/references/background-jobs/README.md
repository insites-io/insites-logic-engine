# Background Jobs

Background jobs execute code asynchronously using the `{% background %}` tag.

## Syntax

Put the job's code in a partial and name it in the tag. Every other argument becomes a variable inside that partial:

```liquid
{% background job_id = 'jobs/process_order', order_id: order.id, delay: 1, priority: 'high', max_attempts: 3, source_name: 'process_order' %}
```

`job_id` is the variable name the tag assigns, and `'jobs/process_order'` is the partial at `app/views/partials/jobs/process_order.liquid`. Nothing the partial outputs is rendered on the page.

## What a Job Can See

A job sees **only the variables passed to the tag**. A variable assigned earlier on the page is not visible inside the job unless it is passed as an argument. `context` is available, with limits: page and layout metadata, the device and constants have to be passed explicitly if the job needs them. Since 20 April 2026 a job also receives `context.environment` and `context.location.host` from the request that queued it.

```liquid
{% liquid
  assign greeting = 'hello'
  background job_id = 'jobs/greet', name: user.name
%}
```

Inside `jobs/greet`, `name` is set and `greeting` is blank.

## The Block Form Is Deprecated

The tag also accepts a block, `{% background ... %}...{% endbackground %}`. The tag reference shipped with insites-cli 6.1.0 lists that form under "Deprecated", and the scope rule is the same: the block sees only the variables passed to the tag, not the page's. Some v6 modules still use the block form; use the partial form in new code.

**Unresolved: what `context` a job sees.** The platformOS guide (Creating a Background Job in
Liquid, last edited 10 November 2026) says that with the block (inline) form "the job gets a copy of
most of the context of the code that scheduled it, as it was at that moment, for example
`context.current_user` and `context.params`", and (Background Jobs page) that a partial job gets
`context.constants` and `context.location` but not `context.current_user` or `context.params`. The
tag description says constants "need to be explicitly passed". The paragraph above, from the
insites-cli tag reference, says the same. Neither has been measured on an Insites instance. Until it
is, pass every value a job needs, constants and the user id included, as tag arguments.

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `delay` | Float | 0 | Minutes to wait before the job runs. `0.5` is 30 seconds |
| `priority` | String | `high` | `high` (runs up to 1 minute), `default` (5 minutes), `low` (4 hours) |
| `max_attempts` | Integer | 0 | How many times a failed job is retried. Maximum 9; a larger value is treated as 9. `0` means a failed job is not retried |
| `source_name` | String | none | Your label for the job; filter `admin_background_jobs` by it |

Sources: platformOS "Creating a Background Job in Liquid"
(https://documentation.platformos.com/developer-guide/background-jobs/creating-background-job-liquid)
and "Background Jobs" (.../developer-guide/background-jobs/background-jobs), both last edited
10 November 2026, read 16 November 2026: **documented by platformOS**.

**Measured on an Insites v6 staging instance, 16 November 2026** (`admin_background_jobs`, three
delayed jobs, deleted afterwards): a job queued with no `priority` was stored with `queue: "high"`,
and one with `priority: 'default'` with `queue: "default"`, so the default priority is `high`, not
`default`. A job with no `max_attempts` was stored with `attempts: 0`; one with `max_attempts: 12`
was stored with `attempts: 9`, which matches the documented cap of 9. Retries themselves were not
watched.

**Conflicting source:** the tag reference shipped with insites-cli 6.4.1
(`insites-check-docs-updater/data/tags.json`) still says "Default is 1, maximum is 5" for
`max_attempts`. The platformOS reference
(https://documentation.platformos.com/api-reference/liquid/platformos-tags#background, last edited
20 October 2026) says "Default is 0 (a failed job is not retried), maximum is 9". The measurement
above agrees with platformOS; trust it over the CLI text.

## Limits

Documented by platformOS (https://documentation.platformos.com/developer-guide/background-jobs/background-job-limitations,
last edited 10 November 2026, read 16 November 2026):

- **Run time** per priority: `high` 1 minute, `default` 5 minutes, `low` 4 hours. A longer job "can
  be stopped before it finishes"; split it into batches.
- **API calls from a job** time out after 8 seconds by default; raise it to at most 180 seconds with
  the call's `timeout` option.
- **Payload:** keep everything passed to a job under 100KB. Pass ids, not records.
- **Scheduled jobs:** expect "up to a few thousand" queued for the future at once; batch items per job.
- **Chains:** 1000 steps. A job queued by a job is one step further; a job queued from a page or form
  starts a new chain. Past the limit the queuing job fails with `background stack call is too deep`.
  This is why a daily job that re-queues itself stops after about 1000 days; see
  [recurring.md](recurring.md).
- **Retries:** none unless `max_attempts` is set. A self-queuing job that fails before it queues its
  next run ends its chain, so queue the next run first.
- **Transactions:** a job queued inside `{% transaction %}` is queued only on commit, and never if
  the transaction rolls back
  (https://documentation.platformos.com/developer-guide/background-jobs/creating-background-job-liquid).

## Recurring Work

There is no cron. Use the scheduler pattern in [recurring.md](recurring.md).

## Use Cases

- Sending emails/SMS after an action
- Processing payments
- Calling external APIs
- Heavy computations
- Report generation
- Data synchronization

## Example: Delayed Email

```liquid
{% background job_id = 'emails/send_welcome', email: user.email, name: user.name, source_name: 'welcome_email', delay: 5, priority: 'low' %}
```

## Example: API Call with Retry

```liquid
{% comment %} app/views/partials/jobs/sync_inventory.liquid {% endcomment %}
{% graphql result = 'api/sync_inventory', product_id: product_id %}
{% if result.errors %}
  {% log result.errors, type: 'sync_inventory' %}
{% endif %}
```

```liquid
{% background job_id = 'jobs/sync_inventory', product_id: product.id, source_name: 'sync_inventory', priority: 'high', max_attempts: 3 %}
```

## Important Notes

- Pass every value the job needs as a tag argument
- Use `source_name` to label the job; `insites-cli logs` does not print it, so log from inside the job with a `type:` you can filter on
- Monitor via `insites-cli logs`
- Events + consumers are the preferred pattern for post-action side effects
