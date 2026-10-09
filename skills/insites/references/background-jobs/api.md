# Background Jobs - API Reference

## Complete Tag Syntax

```liquid
{% background [delay: value] [priority: 'level'] [max_attempts: count] [source_name: 'name'] %}
  [job content]
{% endbackground %}
```

## Parameter Reference

### delay
```liquid
{% background delay: 0 %}...{% endbackground %}
```
- **Type**: Float
- **Unit**: Minutes
- **Default**: 0
- **Range**: 0 to 65535
- **Precision**: Supports fractional minutes (e.g., 0.5 = 30 seconds)

### priority
```liquid
{% background priority: 'default' %}...{% endbackground %}
```
- **Type**: String (quoted)
- **Values**: `'low'`, `'default'`, `'high'`
- **Default**: `'default'`
- **Behavior**: Affects job queue ordering; does not affect performance within a priority level

### max_attempts
```liquid
{% background max_attempts: 1 %}...{% endbackground %}
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
{% background source_name: 'my_job_name' %}...{% endbackground %}
```
- **Type**: String (quoted)
- **Default**: Auto-generated (not recommended for production)
- **Format**: Alphanumeric, hyphens, underscores
- **Visibility**: Names the job. `insites-cli logs` does not print it, so log from inside the job with a `type:` you can filter on (see Monitoring below)

## Full API Example

```liquid
{% background delay: 2.5, priority: 'high', max_attempts: 3, source_name: 'process_payment' %}
  {% assign customer_id = order.customer_id %}
  {% assign amount = order.total %}

  Processing payment for customer {{ customer_id }}: ${{ amount }}
{% endbackground %}
```

## Calling Partials from Background

### Basic Partial Call

```liquid
{% background source_name: 'email_job' %}
  {% include 'emails/transactional', user_id: user.id, email: user.email %}
{% endbackground %}
```

### Partial with Multiple Parameters

```liquid
{% background max_attempts: 2, source_name: 'generate_invoice' %}
  {% include 'invoicing/create',
    order_id: order.id,
    customer_id: customer.id,
    amount: order.total,
    currency: 'USD' %}
{% endbackground %}
```

### Nested Includes

Partials called from background jobs can themselves include other partials:

```liquid
{% background source_name: 'complex_workflow' %}
  {% include 'workflows/multi-step',
    entity_id: entity.id,
    context: 'background_job' %}
{% endbackground %}
```

**Note**: All nested includes operate in the same limited background job scope.

## Accessing Variables in Background Jobs

### Direct Assignment

```liquid
{% background source_name: 'use_variables' %}
  {% assign username = user.name %}
  {% assign created_at = user.created_at %}

  User: {{ username }}
  Joined: {{ created_at }}
{% endbackground %}
```

### From Passed Parameters

```liquid
{% background source_name: 'param_job' %}
  {% include 'processor',
    data: my_collection,
    config: job_config %}
{% endbackground %}
```

### Available Context

Background jobs have access to:
- Model data passed explicitly via parameters
- Liquid variables assigned within the background block
- Filters and tags (standard Liquid)

Background jobs do **not** have access to:
- Request parameters (`params`)
- Session data (`context.current_user`)
- Cookies or headers
- Parent page variables (must be reassigned)

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
{% background max_attempts: 3, source_name: 'api_call' %}
  {% include 'integrations/external-api', endpoint: 'https://api.example.com' %}
{% endbackground %}
```

If the included partial fails:
1. The attempt fails
2. Wait: Exponential backoff
3. Retry: Attempt 2/3 begins
4. If all attempts fail, the job stops (whether the platform logs that was not measured)

### Job Success

```liquid
{% background source_name: 'completed_job' %}
  Job execution completes successfully
{% endbackground %}
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
{% background source_name: 'async_task' %}
  This executes asynchronously
{% endbackground %}

Response sent to user immediately (doesn't wait for background job)
```

## See Also

- [Background Jobs - Configuration](./configuration.md)
- [Background Jobs - Patterns](./patterns.md)
- [Background Jobs - Gotchas](./gotchas.md)
- [Background Jobs - Advanced](./advanced.md)
- [insites-cli Reference](../cli/api.md)
- [Liquid Filters & Tags](../liquid/tags/README.md)
