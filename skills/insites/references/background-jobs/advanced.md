# Background Jobs - Advanced Techniques

## Retry Strategies

### Exponential Backoff

Insites automatically implements exponential backoff between retries. The wait time increases with each attempt:

```liquid
{% background job_id = 'integrations/flaky-service',
  max_attempts: 5,
  source_name: 'unreliable_api',
  endpoint: 'https://api.example.com' %}
```

**Backoff Schedule** (approximate):
- Attempt 1: Initial execution
- Attempt 2: ~5 second wait
- Attempt 3: ~30 second wait
- Attempt 4: ~2 minute wait
- Attempt 5: ~10 minute wait

**When to Use**:
- External API integrations
- Database operations
- Network-dependent tasks

### Strategic Retry Configuration

```liquid
{% comment %} Critical operation - maximum retries {% endcomment %}
{% background job_id = 'payments/process-charge',
  max_attempts: 5,
  priority: 'high',
  source_name: 'payment_gateway',
  order_id: order.id %}

{% comment %} Standard operation - moderate retries {% endcomment %}
{% background job_id = 'emails/transactional',
  max_attempts: 3,
  priority: 'default',
  source_name: 'send_email',
  user_id: user.id %}

{% comment %} Non-critical - single attempt {% endcomment %}
{% background job_id = 'analytics/track-event',
  max_attempts: 1,
  priority: 'low',
  source_name: 'analytics_log',
  event: 'page_view' %}
```

### Detecting and Handling Failures

To watch attempts, log from inside the job with a type you can filter on, for example `{% log note, type: 'processing_order' %}`, then:

```bash
insites-cli logs staging --filter processing_order
```

`insites-cli logs` prints each entry as `[time] - type: message`. Whether the platform logs each attempt itself was not measured.

---

## Delayed Scheduling Patterns

### Staggered Job Execution

Execute jobs at intervals to prevent queue overload:

```liquid
{% for user in users_to_notify %}
  {% background job_id = 'emails/bulk_notification', delay: forloop.index, source_name: 'send_batch_email', user_id: user.id %}
{% endfor %}
```

**Result**: Jobs spread across multiple minutes (1 minute per user).

### Time-Based Scheduling

Schedule jobs for specific times:

```liquid
{% assign now = 'now' | date: '%s' | plus: 0 %}
{% assign scheduled_time = scheduled_at | date: '%s' | plus: 0 %}
{% assign delay_seconds = scheduled_time | minus: now %}
{% assign delay_minutes = delay_seconds | divided_by: 60.0 %}

{% if delay_minutes > 0 %}
  {% background job_id = 'notifications/send',
    delay: delay_minutes,
    source_name: 'scheduled_notification',
    message: message %}
{% endif %}
```

### Delayed Action Chains

Sequence operations with delays:

```liquid
{% comment %} Step 1: Process order immediately {% endcomment %}
{% background job_id = 'orders/process', source_name: 'process_order', order_id: order.id %}

{% comment %} Step 2: Send confirmation after 1 minute {% endcomment %}
{% background job_id = 'emails/order-confirmation',
  delay: 1,
  source_name: 'send_confirmation',
  order_id: order.id %}

{% comment %} Step 3: Follow-up after 24 hours {% endcomment %}
{% background job_id = 'emails/order-followup',
  delay: 1440,
  source_name: 'send_followup',
  order_id: order.id %}
```

(Note: For precise scheduling, consider external cron-based systems)

---

## Combining Background Jobs + Events

### Complementary Approaches

Use background jobs for fire-and-forget async tasks, events for event-driven workflows:

```liquid
{% comment %} Trigger event for all registered consumers {% endcomment %}
{% trigger_event 'order.created', order_id: order.id %}

{% comment %} Queue background job for specific async task {% endcomment %}
{% background job_id = 'emails/confirmation',
  delay: 5,
  source_name: 'send_order_confirmation',
  order_id: order.id %}
```

**Advantages**:
- Events notify all consumers
- Background job runs independently
- Decoupled architecture
- Full request context available in event handlers

### Complex Workflow Pattern

```liquid
{% comment %} Event triggers inventory sync (via consumer) {% endcomment %}
{% trigger_event 'order.created', order_id: order.id %}

{% comment %} Background job handles email (fire-and-forget) {% endcomment %}
{% background job_id = 'emails/order-notification',
  priority: 'default',
  source_name: 'send_email',
  order_id: order.id %}

{% comment %} Background job handles analytics (non-urgent) {% endcomment %}
{% background job_id = 'analytics/log-conversion',
  priority: 'low',
  source_name: 'track_conversion',
  order_id: order.id %}
```

---

## Monitoring and Debugging

### Structured Logging in Background Jobs

```liquid
{% comment %} app/views/partials/jobs/monitored.liquid, queued with {% background job_id = 'jobs/monitored', source_name: 'monitored_job' %} {% endcomment %}
{% liquid
  assign start_time = 'now' | date: '%s' | plus: 0
  # ... the job's work ...
  assign end_time = 'now' | date: '%s' | plus: 0
  assign duration = end_time | minus: start_time
  assign note = 'job completed in ' | append: duration | append: ' seconds'
  log note, type: 'monitored_job'
%}
```

### Filtering Logs by Status

`--filter` matches a type. Give success and failure different types in the job (`{% log note, type: 'job_failed' %}`), then:

```bash
insites-cli logs staging --filter job_failed
```

### Performance Analysis

Log the duration from inside the job (as in the example above), then stream it. `insites-cli logs` never ends on its own, so `| tail` never prints; save to a file and read it after `Ctrl+C`:

```bash
insites-cli logs staging | grep send_email | tee send_email.log
```

### Debugging Failed Jobs

When a job fails:

1. Check logs for error message:
   ```bash
   insites-cli logs staging --filter error
   ```

2. Review the included partial for syntax errors

3. Verify every value the job needs is passed to the tag. The job sees nothing else from the page:
   ```liquid
   {% background job_id = 'email', user_id: user.id, email: user.email %}
   ```

4. Test the partial outside background context first

5. Increase `max_attempts` if failure is intermittent:
   ```liquid
   {% background job_id = 'email', max_attempts: 3, source_name: 'retry_job', user_id: user.id %}
   ```

---

## Performance Tuning

### Queue Management

Balance priority distribution to prevent queue starvation:

```liquid
{% comment %} Don't create too many high-priority jobs {% endcomment %}
{% assign high_priority_count = 0 %}
{% for job in jobs %}
  {% if job.critical %}
    {% background job_id = 'processors/critical',
      priority: 'high',
      source_name: 'critical_' | append: job.id,
      job_id: job.id %}
    {% assign high_priority_count = high_priority_count | plus: 1 %}
  {% else %}
    {% background job_id = 'processors/standard',
      priority: 'default',
      source_name: 'standard_' | append: job.id,
      job_id: job.id %}
  {% endif %}
{% endfor %}
```

### Batch Processing Efficiency

Process multiple items efficiently:

```liquid
{% comment %} Batch 100 items into one job {% endcomment %}
{% assign batch_size = 100 %}
{% assign item_index = 0 %}

{% for item in large_collection %}
  {% assign item_index = item_index | plus: 1 %}

  {% if item_index == 1 %}
    {% capture batch_items %}{{ item.id }}{% endcapture %}
  {% else %}
    {% capture batch_items %}{{ batch_items }},{{ item.id }}{% endcapture %}
  {% endif %}

  {% if item_index == batch_size or forloop.last %}
    {% background job_id = 'processors/batch-handler',
      source_name: 'process_batch',
      item_ids: batch_items %}
    {% assign item_index = 0 %}
  {% endif %}
{% endfor %}
```

**Benefit**: Reduces job queue size and improves throughput.

### Delayed Batch Aggregation

Aggregate requests and process them together:

```liquid
{% comment %} Queue job 1 second in future (allows other jobs to be added) {% endcomment %}
{% background job_id = 'processors/batch-all-pending-items',
  delay: 0.016,
  source_name: 'aggregated_batch' %}
```

Allows requests in the next second to batch together before processing.

---

## Idempotency and Safety

### Idempotent Job Design

Design jobs to safely execute multiple times:

```liquid
{% background job_id = 'payments/charge-with-idempotency',
  max_attempts: 3,
  source_name: 'idempotent_charge',
  order_id: order.id,
  idempotency_key: order.id | append: '-' | append: order.created_at %}
```

**Pattern**: Use unique identifiers to prevent duplicate operations.

### State Verification

Check state before executing:

```liquid
{% background job_id = 'state-manager/update-if-needed',
  source_name: 'safe_state_change',
  entity_id: entity.id,
  expected_state: 'pending',
  new_state: 'processing' %}
```

The included partial verifies state hasn't changed before updating.

### Cleanup on Failure

Define cleanup actions:

```liquid
{% background job_id = 'operations/risky-operation',
  max_attempts: 1,
  source_name: 'operation_with_cleanup',
  operation_id: operation.id,
  with_cleanup: true %}
```

The partial includes cleanup logic in error handlers.

---

## Production Best Practices

### Source Name Convention

Use descriptive, hierarchical names:

```liquid
{% comment %} Good {% endcomment %}
{% background job_id = 'emails/welcome', source_name: 'email_send_welcome', user_id: user.id %}
{% background job_id = 'payments/charge', source_name: 'payment_process_charge', order_id: order.id %}
{% background job_id = 'analytics/track', source_name: 'analytics_track_event', event: 'signup' %}

{% comment %} Avoid single words or auto-generated names: not descriptive {% endcomment %}
{% background job_id = 'emails/welcome', source_name: 'job', user_id: user.id %}
```

### Testing Jobs

Test partials in isolation before wrapping in background:

```liquid
{% comment %} Test in normal context first {% endcomment %}
{% include 'emails/welcome', user_id: 123, email: 'user@example.com' %}

{% comment %} Then wrap in background {% endcomment %}
{% background job_id = 'emails/welcome',
  source_name: 'test_email',
  user_id: 123,
  email: 'user@example.com' %}
```

### Monitoring Alerts

Set up alerts for failed jobs:

```bash
# Watch for failures the job logs itself, e.g. {% log note, type: 'send_email_failed' %}
insites-cli logs production --filter send_email_failed
```

If pattern detected, investigate and fix.

---

## See Also

- [Background Jobs - Configuration](./configuration.md)
- [Background Jobs - API](./api.md)
- [Background Jobs - Patterns](./patterns.md)
- [Background Jobs - Gotchas](./gotchas.md)
- [insites-cli Reference](../cli/api.md)
- [Liquid Filters](../liquid/filters/README.md)
