# Background Jobs - API Reference

## Complete Tag Syntax

```liquid
{% background job_id = 'path/to/partial' [, delay: value] [, priority: 'level'] [, max_attempts: count] [, source_name: 'name'] [, name: value ...] %}
```

`job_id` is the variable the tag assigns; `'path/to/partial'` is the partial the job runs. Every argument that is not one of the four options becomes a variable inside the partial, and those are the only page variables the job can see.

The block form, `{% background ... %}...{% endbackground %}`, is listed as deprecated in the tag reference shipped with insites-cli 6.1.0. It has the same scope: the block sees only what is passed to the tag.

## Parameter Reference

### delay
```liquid
{% background job_id = 'jobs/example', delay: 0 %}
```
- **Type**: Float
- **Unit**: Minutes
- **Default**: 0
- **Range**: 0 to 65535
- **Precision**: Supports fractional minutes (e.g., 0.5 = 30 seconds)

### priority
```liquid
{% background job_id = 'jobs/example', priority: 'low' %}
```
- **Type**: String (quoted)
- **Values**: `'high'`, `'default'`, `'low'`
- **Default**: `'high'` (measured on an Insites v6 staging instance, 16 November 2026: a job queued with no `priority` is stored with `queue: "high"`; also documented by platformOS)
- **Maximum run time**: `high` 1 minute, `default` 5 minutes, `low` 4 hours (documented by platformOS, background-job-limitations, last edited 10 November 2026). The priority also decides how quickly the job is picked up.

### max_attempts
```liquid
{% background job_id = 'jobs/example', max_attempts: 3 %}
```
- **Type**: Integer
- **Default**: 0, a failed job is not retried
- **Maximum**: 9; a larger value is treated as 9
- **Meaning**: the number of **retries** after a failure, not total runs
- Documented by platformOS (creating-background-job-liquid, last edited 10 November 2026; tag reference, last edited 20 October 2026). Measured on an Insites v6 staging instance, 16 November 2026: `max_attempts: 12` is stored as `attempts: 9`, and no `max_attempts` as `attempts: 0`. Retries were not watched. The insites-cli 6.4.1 tag reference still says "Default is 1, maximum is 5"; see [README.md](README.md#parameters).
- A job stopped with `admin_background_job_stop` is never retried and does not become `DEAD`.

### source_name
```liquid
{% background job_id = 'jobs/example', source_name: 'my_job_name' %}
```
- **Type**: String (quoted)
- **Default**: Auto-generated (not recommended for production)
- **Format**: Alphanumeric, hyphens, underscores
- **Visibility**: Names the job. `insites-cli logs` does not print it, so log from inside the job with a `type:` you can filter on (see Monitoring below)

## Full API Example

```liquid
{% background job_id = 'payments/process',
  delay: 2.5,
  priority: 'high',
  max_attempts: 3,
  source_name: 'process_payment',
  customer_id: order.customer_id,
  amount: order.total %}
```

Inside `app/views/partials/payments/process.liquid`, `customer_id` and `amount` are set. `order` is not, because it was not passed.

## Calling Partials from Background

### Basic Partial Call

```liquid
{% background job_id = 'emails/transactional',
  source_name: 'email_job',
  user_id: user.id,
  email: user.email %}
```

### Partial with Multiple Parameters

```liquid
{% background job_id = 'invoicing/create',
  max_attempts: 2,
  source_name: 'generate_invoice',
  order_id: order.id,
  customer_id: customer.id,
  amount: order.total,
  currency: 'USD' %}
```

### Nested Includes

Partials called from background jobs can themselves include other partials:

```liquid
{% background job_id = 'workflows/multi-step',
  source_name: 'complex_workflow',
  entity_id: entity.id,
  mode: 'background_job' %}
```

**Note**: A nested include sees what the job partial passes to it, and the job partial sees only what the tag passed.

## Accessing Variables in Background Jobs

### Only Passed Variables

```liquid
{% assign username = user.name %}
{% background job_id = 'jobs/welcome', name: user.name, joined: user.created_at %}
```

In `jobs/welcome`, `name` and `joined` are set. `username` is blank: it was assigned on the page and not passed.

### From Passed Parameters

```liquid
{% background job_id = 'processor',
  source_name: 'param_job',
  data: my_collection,
  config: job_config %}
```

### Available Context

The tag reference shipped with insites-cli 6.1.0 says a job has access only to the variables passed to the tag. `context` is available by default, with limits: page and layout metadata, the device and constants must be passed explicitly if the job uses them. Since 20 April 2026 a job receives `context.environment` and `context.location.host` from the request that queued it.

So pass what the job needs, including anything read from the request (`context.params`, the current user's id), as tag arguments. A variable assigned on the page is never visible inside the job unless it is passed.

## Monitoring with insites-cli logs

`insites-cli logs <environment>` streams the instance's log entries until you press `Ctrl+C`. It prints each one as `[time] - type: message`, with the path, page and partial underneath when the entry has them:

```
[2026-10-12 14:32:45.123Z] - error: Liquid error: undefined method 'size'
```

It does not print `source_name`, its only filter is `--filter <type>`, and it has no `--source-name` or `--tail` option. With `--json`, each entry is one JSON object per line with `id`, `created_at`, `error_type`, `message` and `data`.

So give the job a log entry of its own, with a type you can filter on. Inside the job's partial:

```liquid
{%- assign note = 'sent welcome email to ' | append: email -%}
{%- log note, type: 'send_email' -%}
```

Then watch for it. `logs` always follows new entries until you stop it:

```bash
insites-cli logs staging --filter send_email
insites-cli logs staging | grep process_payment
```

Whether the platform writes an entry of its own for each attempt or failure was not measured. Do not rely on one.

## Error Scenarios

### Job Failure and Retry

```liquid
{% background job_id = 'integrations/external-api',
  max_attempts: 3,
  source_name: 'api_call',
  endpoint: 'https://api.example.com' %}
```

If the included partial fails:
1. The attempt fails
2. Wait: Exponential backoff
3. Retry: Attempt 2/3 begins
4. If all attempts fail, the job stops (whether the platform logs that was not measured)

### Job Success

```liquid
{% background job_id = 'jobs/example', source_name: 'completed_job' %}
```

Nothing appears in `insites-cli logs` unless the job writes a `{% log %}` entry itself.

## Constraints

| Constraint | Value |
|---|---|
| Max Parameters | 20 (not in the platformOS documentation; unverified) |
| Max Delay | 65535 minutes (~45 days) (not in the platformOS documentation; unverified. The documented scheduler uses `delay: 43200`) |
| Max Attempts | 9 retries (documented by platformOS; stored as 9 for `max_attempts: 12`, measured 16 November 2026) |
| Max Job Duration | `high` 1 minute, `default` 5 minutes, `low` 4 hours (documented by platformOS) |
| Payload | under 100KB (documented by platformOS) |
| Chain of jobs queued by jobs | 1000 steps (documented by platformOS); see [recurring.md](recurring.md) |
| Priority Levels | 3 (low, default, high) |
| Parameter Name Length | 255 characters |

## Return Value

The `{% background %}` tag returns immediately and does not block execution:

```liquid
{% background job_id = 'jobs/example', source_name: 'async_task' %}

Response sent to user immediately (doesn't wait for background job)
```

## Managing Jobs with GraphQL

Documented by platformOS, "Managing Background Jobs with GraphQL"
(https://documentation.platformos.com/developer-guide/background-jobs/managing-background-jobs-graphql,
last edited 10 November 2026, read 16 November 2026), unless marked measured.

| Operation | Use |
|---|---|
| `admin_background_jobs` | List jobs. `filter.type`: `SCHEDULED` (the default), `RUNNING`, `RETRY`, `DEAD` |
| `admin_background_job_delete(id)` | Delete one `SCHEDULED`, `RETRY` or `DEAD` job. A running job cannot be deleted |
| `admin_background_jobs_delete_all(filter)` | Delete matching jobs, **at most 100 per call**; call again until `results` is empty |
| `admin_background_job_stop(id)` | Stop a `RUNNING` job |
| `admin_background_job_retry(id)` | Run a `DEAD` job again. Only `DEAD` jobs |

- **No mutation creates a job.** Queue jobs with the `background` tag; to run GraphQL in the
  background, put the `graphql` tag inside the job.
- The `id` is the value the tag assigns (`job_id` in `background job_id = ...`).
- A job queued without `delay` goes straight to the queue and is never listed as `SCHEDULED`.
- Only `type`, `id`, `source_name`, `timestamp` and `or` filter. "The other fields of the filter
  have no effect." `source_name` is case-sensitive. `timestamp` means `run_at` for `SCHEDULED`,
  `retry_at` for `RETRY`, `dead_at` for `DEAD`, and start time for `RUNNING`.
- Up to 100 jobs a page and 50 pages.
- Why a job failed: query `DEAD` jobs for `error_class` and `error_message`.
- **Stopping:** the job stops within a few seconds, wherever it is. An unfinished `{% transaction %}`
  rolls back (and jobs queued inside it are never queued); everything else stays done. `try`'s
  `catch` does not run, its `ensure` does. A stopped job is not retried and does not become `DEAD`.
  The log gets a `BackgroundJobStopped` entry. The running list can be 10 seconds old, so a job that
  just started answers `Job not found` until it is listed. Deploys, imports, exports and instance
  copies are listed as running jobs but cannot be stopped.
- **Measured on an Insites v6 staging instance, 16 November 2026:** `admin_background_job_stop` is
  a field of `RootMutation` there. The bundled `graphql/schema/schema.json` (introspected
  16 October 2026) does not list it, so the schema has changed since; regenerate it.
- **Measured, same instance and day:** `admin_background_jobs_delete_all` with
  `filter: { type: SCHEDULED, source_name: { contains: "..." } }` deleted three delayed jobs, and a
  second `admin_background_jobs` read returned `total_entries: 0`. Results carry `queue`,
  `attempts`, `arguments` (the tag arguments plus `context.location` and `context.background_ttl`)
  and `run_at`.

```graphql
query search_background_jobs($source_name: String!) {
  admin_background_jobs(
    per_page: 100
    filter: { type: SCHEDULED, source_name: { value: $source_name } }
  ) {
    total_entries
    results { id source_name queue run_at arguments }
  }
}
```

## See Also

- [Background Jobs - Configuration](./configuration.md)
- [Background Jobs - Patterns](./patterns.md)
- [Background Jobs - Gotchas](./gotchas.md)
- [Background Jobs - Advanced](./advanced.md)
- [insites-cli Reference](../cli/api.md)
- [Liquid Filters & Tags](../liquid/tags/README.md)
