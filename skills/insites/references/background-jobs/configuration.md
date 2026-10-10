# Background Jobs - Configuration

## Overview

The `{% background %}` tag enables asynchronous job execution in Insites. Jobs run outside the immediate request-response cycle, allowing you to defer expensive operations and improve application responsiveness.

## Basic Syntax

The job's code lives in a partial, named in the tag. The block form (`{% background %}...{% endbackground %}`) is listed as deprecated in the tag reference shipped with CLI 5.10.2.

### Calling a Partial

```liquid
{% background job_id = 'emails/welcome',
  delay: 5,
  priority: 'high',
  max_attempts: 3,
  source_name: 'send_email',
  user: user,
  email: user.email %}
```

## Parameters

### delay
- **Type**: Float
- **Unit**: Minutes
- **Default**: 0
- **Description**: Time to wait before executing the job
- **Example**: `delay: 2.5` schedules job 2.5 minutes from now

### priority
- **Type**: String
- **Allowed Values**: `low`, `default`, `high`
- **Default**: `default`
- **Description**: Job execution priority in queue
- **Behavior**: High-priority jobs execute before low-priority ones
- **Note**: Don't overuse high priority to avoid queue congestion

### max_attempts
- **Type**: Integer
- **Range**: 1–5
- **Default**: 1
- **Description**: Maximum retry attempts if job fails
- **Behavior**: Job runs once by default; retries on failure up to max_attempts times
- **Backoff**: Automatic exponential backoff between retries

### source_name
- **Type**: String
- **Default**: Generated automatically if omitted
- **Description**: Identifier for the job in logs and monitoring
- **Best Practice**: Use descriptive, snake_case names (e.g., `send_welcome_email`, `generate_report`)
- **Tip**: `insites-cli logs` does not print it. To find a job's entries there, write a `{% log ..., type: 'send_welcome_email' %}` inside the job and run `insites-cli logs <environment> --filter send_welcome_email`

## Scope Limitations

A job sees **only the variables passed to the tag**. Nothing assigned on the page is visible inside it. `context` is available with limits: page and layout metadata, the device and constants must be passed explicitly. Since 20 April 2026 a job receives `context.environment` and `context.location.host` from the request that queued it.

### Passing Variables

Pass every value the job needs as a tag argument, evaluated on the page:

```liquid
{% background job_id = 'orders/process', source_name: 'process_order', order_id: order.id, customer_email: order.customer.email %}
```

```liquid
{% comment %} app/views/partials/orders/process.liquid {% endcomment %}
{% liquid
  assign note = 'processing order ' | append: order_id | append: ' for ' | append: customer_email
  log note, type: 'process_order'
%}
```

Reassigning inside the job does not help: `{% assign order_id = order.id %}` in the job reads a blank `order`, because `order` was not passed.

## Partial Inclusion

```liquid
{% background job_id = 'notifications/email',
  delay: 1,
  source_name: 'send_notification',
  recipient_id: user.id,
  message: "Your order has shipped",
  order_id: order.id %}
```

**Key Points**:
- Pass required data as partial parameters
- Partial executes with passed parameters, not parent scope
- A partial the job includes sees what the job passes to it

## Error Handling

Jobs that encounter errors will retry based on `max_attempts`:

```liquid
{% background job_id = 'operations/external-api-call',
  max_attempts: 3,
  source_name: 'risky_operation',
  endpoint: 'https://api.example.com' %}
```

Whether a job that runs out of attempts writes a log entry was not measured. Log from inside the job if you need to see it in `insites-cli logs`.

## Performance Considerations

- Jobs are non-blocking; response returns immediately
- No guarantee of execution order for same-priority jobs
- Execution latency depends on queue load and delay value
- Use appropriate priority levels to manage queue efficiently

## Examples

### Send Email in Background

```liquid
{% background job_id = 'emails/welcome',
  delay: 0,
  priority: 'default',
  max_attempts: 2,
  source_name: 'send_welcome_email',
  user_id: user.id,
  email: user.email %}
```

### Delayed Report Generation

```liquid
{% background job_id = 'reports/monthly',
  delay: 60,
  priority: 'low',
  max_attempts: 1,
  source_name: 'generate_monthly_report',
  account_id: account.id %}
```

### High-Priority Task with Retries

```liquid
{% background job_id = 'integrations/sync-data',
  priority: 'high',
  max_attempts: 5,
  source_name: 'critical_sync',
  tenant_id: tenant.id %}
```

## See Also

- [Background Jobs - API](./api.md)
- [Background Jobs - Patterns](./patterns.md)
- [Background Jobs - Gotchas](./gotchas.md)
- [Background Jobs - Advanced](./advanced.md)
- [insites-cli Documentation](../cli/api.md)
