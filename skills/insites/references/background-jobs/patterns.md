# Background Jobs - Patterns

## Common Use Cases and Best Practices

### 1. Async Email Sending

Send emails without delaying the user's response:

```liquid
{% background job_id = 'emails/welcome',
  source_name: 'send_welcome_email',
  user_id: user.id,
  email: user.email,
  name: user.name %}

Response returned to user immediately
```

**Benefits**:
- Faster response times
- Decoupled email service from request
- Automatic retry on failure
- Reduces timeout risk

**Best Practice**:
- Use `max_attempts: 2` for email jobs
- Set `priority: 'default'` (emails aren't urgent usually)
- Pass only necessary user data

### 2. Delayed Job Scheduling

Execute tasks after a delay:

```liquid
{% background job_id = 'notifications/reminder',
  delay: 30,
  source_name: 'send_reminder',
  user_id: user.id,
  message: 'Your session expires in 30 minutes' %}
```

**Use Cases**:
- Session timeout reminders
- Abandoned cart notifications
- Delayed confirmations
- Staggered notifications

**Pattern**:
- `delay` parameter controls execution time
- Delays stack in queue (multiple jobs at different times)
- Not suitable for precise scheduling (use cron jobs for that)

### 3. External API Calls with Retry

Call external services with built-in retry logic:

```liquid
{% background job_id = 'integrations/crm-sync',
  max_attempts: 3,
  priority: 'default',
  source_name: 'sync_to_crm',
  contact_id: contact.id,
  action: 'create',
  data: contact.data %}
```

**Advantages**:
- Handles temporary API failures automatically
- Exponential backoff between retries
- Each attempt shows in `insites-cli logs` if the job writes a `{% log %}` entry
- Non-blocking (doesn't slow down user request)

**Configuration**:
- Set `max_attempts: 3–5` for unreliable APIs
- Use `priority: 'high'` for critical integrations
- Short `delay: 0` for immediate execution

### 4. Heavy Computations

Move CPU-intensive tasks to background:

```liquid
{% background job_id = 'reports/pdf-generator',
  source_name: 'generate_pdf_report',
  data_id: data.id,
  format: 'pdf',
  include_charts: true %}
```

**Benefits**:
- Web request returns immediately
- Computation doesn't block other requests
- Server resources used more efficiently

**Example**: Report generation, image processing, data aggregation

### 5. Report Generation

Asynchronously create and store reports:

```liquid
{% background job_id = 'reports/monthly-analytics',
  delay: 1,
  priority: 'low',
  max_attempts: 1,
  source_name: 'monthly_report',
  account_id: account.id,
  period: 'monthly',
  month: month,
  year: year %}
```

**Pattern**:
- Low priority (reports aren't blocking users)
- Small delay to batch multiple requests
- Store results in database for later retrieval

### 6. Batch Processing

Process multiple items asynchronously:

```liquid
{% for item in items %}
  {% background job_id = 'processors/item-processor',
    source_name: 'process_item',
    item_id: item.id,
    item_data: item %}
{% endfor %}
```

**Considerations**:
- Creates multiple background jobs (one per item)
- Each job retries independently
- Monitor with `insites-cli logs` to track all jobs

### 7. Webhook Processing

Handle incoming webhooks asynchronously:

```liquid
{% background job_id = 'webhooks/process',
  max_attempts: 2,
  source_name: 'webhook_handler',
  event_type: webhook.event_type,
  payload: webhook.data,
  timestamp: webhook.timestamp %}
```

**Benefit**: Return success immediately while processing webhook asynchronously

## Background Jobs vs Events & Consumers

### Background Jobs

```liquid
{% background job_id = 'emails/transactional', source_name: 'send_email', user_id: user.id %}
```

**Pros**:
- Simple inline syntax
- Quick to implement
- Built-in retry mechanism
- Good for one-off async tasks

**Cons**:
- Limited scope (can't access full request context)
- No event-driven workflow
- Harder to chain dependent operations

### Events & Consumers

```liquid
{% trigger_event 'user.created', user_id: user.id %}
```

With consumer:
```liquid
{% trigger_event event: 'email.send_welcome', resource_id: user.id %}
```

**Pros**:
- Full request context available
- Decoupled event producers and consumers
- Easy to add multiple handlers
- Better for complex workflows
- Supports event chains

**Cons**:
- More setup required
- Need to create consumer modules
- Slightly more complex

### When to Use Each

| Use Background Jobs | Use Events & Consumers |
|---|---|
| Simple one-off tasks | Complex workflows |
| Email sending | Event-driven architecture |
| Report generation | Multiple handlers for one event |
| External API calls | Requires full request context |
| Fire-and-forget operations | Event chains/cascades |
| Quick async implementation | Post-action side effects |

### Combination Pattern

Use both for complex workflows:

```liquid
{% assign order = order %}

{% trigger_event 'order.created', order_id: order.id %}

{% background job_id = 'emails/order-confirmation',
  delay: 5,
  source_name: 'send_confirmation_email',
  order_id: order.id %}
```

**Flow**:
1. Event triggers (notifies all registered consumers)
2. Background job queued separately
3. Both execute asynchronously
4. Full decoupling achieved

## Queue Management Pattern

Prioritize jobs strategically:

```liquid
{% comment %} High priority - critical for user experience {% endcomment %}
{% background job_id = 'payments/process',
  priority: 'high',
  max_attempts: 5,
  source_name: 'payment_processing',
  order_id: order.id %}

{% comment %} Default priority - standard operations {% endcomment %}
{% background job_id = 'emails/transactional',
  priority: 'default',
  max_attempts: 2,
  source_name: 'send_email',
  user_id: user.id %}

{% comment %} Low priority - non-urgent tasks {% endcomment %}
{% background job_id = 'analytics/log-event',
  priority: 'low',
  max_attempts: 1,
  source_name: 'log_analytics',
  event_type: 'user_visit' %}
```

## Monitoring and Debugging

Write a log entry from inside the job with a type you can filter on, for example `{% log note, type: 'send_email' %}`, then stream it (until `Ctrl+C`):

```bash
insites-cli logs staging --filter send_email
```

`insites-cli logs` does not print `source_name`, so `grep` finds a job only by text its own entries contain.

## See Also

- [Background Jobs - Configuration](./configuration.md)
- [Background Jobs - API](./api.md)
- [Background Jobs - Gotchas](./gotchas.md)
- [Background Jobs - Advanced](./advanced.md)
- [insites-cli Documentation](../cli/api.md)
