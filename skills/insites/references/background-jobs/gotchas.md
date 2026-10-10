# Background Jobs - Gotchas and Troubleshooting

## Common Errors and Solutions

### Error 1: Variable Not Accessible in Background Job

**Symptom**: Job runs but a variable from the page is blank inside it.

```liquid
{% assign username = user.name %}
{% background job_id = 'jobs/greet', source_name: 'use_name' %}
```

`jobs/greet` prints `{{ username }}` and gets nothing.

**Cause**: A job sees only the variables passed to the tag. Page variables are never inherited, and this is the same in the deprecated block form.

**Solution**: Pass the value as a tag argument. Reassigning it inside the job does not work, because `user` is not visible there either:

```liquid
{% background job_id = 'jobs/greet', source_name: 'use_name', username: user.name %}
```

For a job that sends mail, pass everything the template needs:

```liquid
{% background job_id = 'emails/template',
  source_name: 'send_email',
  username: user.name,
  email: user.email %}
```

---

### Error 2: Job Not Executing

**Symptom**: Background job appears queued but never executes.

**Cause**: Job might be failing silently or infrastructure issue.

**Solution**: Check logs for execution status:

```bash
insites-cli logs staging --filter error
```

`insites-cli logs` has no `--source-name` option and does not print the source name. Add `{% log note, type: 'your_job_name' %}` inside the job and run `insites-cli logs staging --filter your_job_name` to see whether it runs.

If no logs appear, verify:
- Job source_name is spelled correctly
- Background tag syntax is valid (check for missing quotes/parameters)
- `insites-cli logs <environment>` shows other entries, so the stream itself works

---

### Error 3: Priority Misuse

**Symptom**: High-priority jobs cause queue congestion.

**Cause**: Over-using `priority: 'high'` fills queue with non-urgent jobs.

```liquid
{% comment %} WRONG: Everything marked high priority {% endcomment %}
{% background job_id = 'analytics/log', priority: 'high', source_name: 'analytics_log' %}
```

**Solution**: Reserve high priority for critical tasks only:

```liquid
{% comment %} Correct: Use appropriate priorities {% endcomment %}

{% comment %} Critical - payment processing {% endcomment %}
{% background job_id = 'payments/process', priority: 'high', source_name: 'payment', order_id: order.id %}

{% comment %} Standard - email notifications {% endcomment %}
{% background job_id = 'emails/notify', priority: 'default', source_name: 'email', user_id: user.id %}

{% comment %} Non-urgent - analytics {% endcomment %}
{% background job_id = 'analytics/log', priority: 'low', source_name: 'analytics', event: 'visit' %}
```

---

### Error 4: Scope Issues with Partials

**Symptom**: Partial included in background job can't find variables.

```liquid
{% background job_id = 'my/partial', source_name: 'include_partial' %}
```

Partial expects `user` variable but it's undefined.

**Cause**: Partials receive only explicitly passed parameters in background scope.

**Solution**: Pass all required parameters explicitly:

```liquid
{% background job_id = 'my/partial',
  source_name: 'include_partial',
  user_id: user.id,
  user_email: user.email,
  user_name: user.name %}
```

---

### Error 5: Job Exceeds Time Limit

**Symptom**: Complex operations fail in background job.

**Cause**: Background jobs have 5-minute execution limit.

**Solution**: Break into smaller jobs or use events for heavy operations:

```liquid
{% comment %} Instead of one long job {% endcomment %}
{% comment %} This might time out after 5 minutes {% endcomment %}
{% background job_id = 'reports/generate_100k_rows', source_name: 'heavy_computation' %}

{% comment %} Break into chunks {% endcomment %}
{% for batch in data_batches %}
  {% background job_id = 'processors/batch', source_name: 'process_batch', data: batch %}
{% endfor %}
```

---

### Error 6: Infinite Retry Loop

**Symptom**: Job keeps retrying indefinitely.

**Cause**: Partial always fails due to bug.

**Solution**: Identify and fix the root cause:

```liquid
{% comment %} Check logs for error details {% endcomment %}
{% comment %} insites-cli logs staging --filter error {% endcomment %}

{% comment %} Fix the partial, then requeue {% endcomment %}
{% background job_id = 'fixed/partial', max_attempts: 1, source_name: 'fixed_job' %}
```

Always set reasonable `max_attempts` limit:

```liquid
{% background job_id = 'jobs/safe', max_attempts: 3, source_name: 'safe_job' %}
```

---

## Common Mistakes

### Mistake 1: Assuming Execution Order

```liquid
{% background job_id = 'jobs/first', source_name: 'job_1' %}
{% background job_id = 'jobs/second', source_name: 'job_2' %}

{% comment %} ERROR: job_2 might execute before job_1 {% endcomment %}
```

**Fix**: If order matters, use delay:

```liquid
{% background job_id = 'jobs/first', source_name: 'job_1' %}
{% background job_id = 'jobs/second', delay: 1, source_name: 'job_2' %}
```

---

### Mistake 2: Not Passing Required Data

```liquid
{% comment %} The partial expects user data but receives nothing {% endcomment %}
{% background job_id = 'emails/template', source_name: 'send_email' %}
```

**Fix**: Explicitly pass all parameters:

```liquid
{% background job_id = 'emails/template',
  source_name: 'send_email',
  user_id: user.id,
  email: user.email %}
```

---

### Mistake 3: Reading the Request Inside the Job

```liquid
{% background job_id = 'jobs/use_params', source_name: 'use_params' %}
```

`jobs/use_params` reads `context.params.foo` and the current user's name, and cannot rely on either: the tag reference says a job has only the variables passed to it, and only a limited `context`.

**Fix**: Read the request on the page and pass the values:

```liquid
{% background job_id = 'jobs/use_params',
  source_name: 'use_params',
  foo: context.params.foo,
  name: context.current_user.name %}
```

Two context values no longer need passing: since the 20 April 2026 platform release a
background job receives the same `context.environment` and `context.location.host` as
the web request that queued it, so environment branching and host-aware URLs work
inside the job.

---

## Limits and Constraints

| Limit | Value | Impact |
|---|---|---|
| Max Job Duration | 5 minutes | Long operations timeout |
| Max Retry Attempts | 5 | Can't exceed 5 retries |
| Max Delay | 65535 minutes (~45 days) | Practical limit ~1 day |
| Parameter Count | ~20 | Too many params = complexity |
| Job Queue Size | Platform-dependent | High-priority queue might fill |
| Execution Latency | Seconds to minutes | Not real-time |

---

## Troubleshooting Flowchart

```
Is job executing?
├─ YES
│  └─ Check logs: insites-cli logs <env> --filter <type the job logs>
│     ├─ Its entries appear? → Job is running
│     └─ Errors? → Check error message, fix partial, retry
│
└─ NO
   ├─ Is syntax correct?
   │  └─ NO → Fix {% background %} tag syntax
   │  └─ YES → Continue
   │
   ├─ Are parameters valid?
   │  └─ NO → Fix source_name, delay, priority values
   │  └─ YES → Continue
   │
   ├─ Is background job available in environment?
   │  └─ NO → Contact platform support
   │  └─ YES → Check insites-cli logs for system errors
   │
   └─ Add {% log %} calls inside the job and watch insites-cli logs <env>
```

---

## Prevention Checklist

- [ ] Pass every value the job needs as a tag argument
- [ ] Pass what an included partial needs from inside the job
- [ ] Use descriptive `source_name` for debugging
- [ ] Set reasonable `max_attempts` (avoid infinite retries)
- [ ] Use appropriate `priority` levels
- [ ] Monitor with `insites-cli logs` regularly
- [ ] Test partials independently before background
- [ ] Don't rely on request context (params, session)
- [ ] Set realistic `delay` values
- [ ] Document expected parameters for partials

---

## See Also

- [Background Jobs - Configuration](./configuration.md)
- [Background Jobs - API](./api.md)
- [Background Jobs - Patterns](./patterns.md)
- [Background Jobs - Advanced](./advanced.md)
- [insites-cli Reference](../cli/api.md)
- [Liquid Scope and Variables](../liquid/variables/README.md)
