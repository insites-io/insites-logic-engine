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

The tag also accepts a block, `{% background ... %}...{% endbackground %}`. The tag reference shipped with CLI 5.10.2 lists that form under "Deprecated", and the scope rule is the same: the block sees only the variables passed to the tag, not the page's. Some v6 modules still use the block form; use the partial form in new code.

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `delay` | Float | 0 | Minutes to delay execution |
| `priority` | String | `default` | `low`, `default`, or `high` |
| `max_attempts` | Integer | 1 | Retry count (1-5) |
| `source_name` | String | none | Your label for the job |

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
