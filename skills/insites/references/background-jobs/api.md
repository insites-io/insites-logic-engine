# Background Jobs - API Reference

## Complete Tag Syntax

```liquid
{% background job_id = 'path/to/partial' [, delay: value] [, priority: 'level'] [, max_attempts: count] [, source_name: 'name'] [, name: value ...] %}
```

`job_id` is the variable the tag assigns; `'path/to/partial'` is the partial the job runs. Every argument that is not one of the four options becomes a variable inside the partial, and those are the only page variables the job can see.

The block form, `{% background ... %}...{% endbackground %}`, is listed as deprecated in the tag reference shipped with CLI 5.10.2. It has the same scope: the block sees only what is passed to the tag.

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
{% background job_id = 'jobs/example', priority: 'default' %}
```
- **Type**: String (quoted)
- **Values**: `'low'`, `'default'`, `'high'`
- **Default**: `'default'`
- **Behavior**: Affects job queue ordering; does not affect performance within a priority level

### max_attempts
```liquid
{% background job_id = 'jobs/example', max_attempts: 1 %}
```
- **Type**: Integer
- **Range**: 1–5
- **Default**: 1
- **Behavior**: Total attempts = 1 (initial) + (max_attempts - 1) retries

| max_attempts | Initial | Retries | Total Runs |
|---|---|---|---|
| 1 | 1 | 0 | 1 |
| 2 | 1 | 1 | 2 |
| 3 | 1 | 2 | 3 |
| 5 | 1 | 4 | 5 |

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

The tag reference shipped with CLI 5.10.2 says a job has access only to the variables passed to the tag. `context` is available by default, with limits: page and layout metadata, the device and constants must be passed explicitly if the job uses them. Since 20 April 2026 a job receives `context.environment` and `context.location.host` from the request that queued it.

So pass what the job needs, including anything read from the request (`context.params`, the current user's id), as tag arguments. A variable assigned on the page is never visible inside the job unless it is passed.

## Monitoring with insites-cli logs

`insites-cli logs <environment>` streams the instance's log entries until you press `Ctrl+C`. It prints each one as `[time] - type: message`, with the path, page and partial underneath when the entry has them. It does not print `source_name`, its only filter is `--filter <type>`, and it has no `--source-name` or `--tail` option.

So give the job a log entry of its own, with a type you can filter on. Inside the job's partial:

```liquid
{%- assign note = 'sent welcome email to ' | append: email -%}
{%- log note, type: 'send_email' -%}
```

Then:

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
| Max Parameters | 20 |
| Max Delay | 65535 minutes (~45 days) |
| Max Attempts | 5 |
| Max Job Duration | 5 minutes |
| Priority Levels | 3 (low, default, high) |
| Parameter Name Length | 255 characters |

## Return Value

The `{% background %}` tag returns immediately and does not block execution:

```liquid
{% background job_id = 'jobs/example', source_name: 'async_task' %}

Response sent to user immediately (doesn't wait for background job)
```

## See Also

- [Background Jobs - Configuration](./configuration.md)
- [Background Jobs - Patterns](./patterns.md)
- [Background Jobs - Gotchas](./gotchas.md)
- [Background Jobs - Advanced](./advanced.md)
- [insites-cli Reference](../cli/api.md)
- [Liquid Filters & Tags](../liquid/tags/README.md)
