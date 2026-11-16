# Background Jobs - Recurring Work (a Schedule Without Cron)

Insites has no built-in scheduler and no cron. Build a schedule from background jobs: a
scheduler job that queues the next runs of the work and then queues itself again.

Source: platformOS documentation, "Scheduling Recurring Background Jobs"
(https://documentation.platformos.com/developer-guide/background-jobs/scheduling-recurring-background-jobs,
last edited 10 November 2026, read 16 November 2026). Insites instances run on platformOS. Every
statement on this page is **documented by platformOS** unless it says **measured**.

## Why a job that re-queues itself every day is not enough

Every chain of jobs is limited to 1000 steps. A job queued from a page or a form starts a new
chain; a job queued by another background job is the next step in that job's chain. When a chain
reaches the limit, the job that tries to queue the next one fails with `background stack call is
too deep` (in the logs), and the next job is not queued. The limit counts steps, not time: a
delayed job counts the same as an immediate one. Jobs queued by the same job do not count against
each other: a job that queues 30 jobs makes each of them one step further, not 30.

So a daily job that queues itself for tomorrow "stops after about 1000 days".
(Source: https://documentation.platformos.com/developer-guide/background-jobs/background-job-limitations,
last edited 10 November 2026, read 16 November 2026.)

**Measured on an Insites v6 staging instance, 16 November 2026:** a job queued from a page with
the `background` tag is stored with `arguments.context.background_ttl: 1000`
(`admin_background_jobs`, `type: SCHEDULED`). This matches the documented 1000-step chain. That the
counter falls by one per step was not measured.

## The pattern: one scheduler, one daily job

- **The scheduler** runs once a month. It queues itself for 30 days later **first**, then queues
  the daily job for each of the next 30 days. Only the scheduler queues itself, so the chain grows
  by one step a month, not one a day ("lasts for about 1000 months").
- **The daily job** does the work and queues nothing.
- **A schedule id** held in a constant starts and stops the schedule. Every job gets the id it was
  queued with and does nothing when that id is no longer the constant's value.

### Step 1: the daily job

```liquid
{% comment %}app/views/partials/jobs/daily_report.liquid{% endcomment %}
{% liquid
  if schedule_id == context.constants.DAILY_REPORT_SCHEDULE_ID
    # ... generate the report here
    log 'Report generated', type: 'daily-report'
  else
    log 'Skipped a job from an inactive schedule', type: 'daily-report'
  endif
%}
```

### Step 2: the scheduler

```liquid
{% comment %}app/views/partials/jobs/schedule_daily_report.liquid{% endcomment %}
{% liquid
  if schedule_id == context.constants.DAILY_REPORT_SCHEDULE_ID
    # Queue the next run of the scheduler first, so that an error below does not stop the schedule
    background job_id = 'jobs/schedule_daily_report', delay: 43200, priority: 'low', source_name: 'schedule-daily-report', schedule_id: schedule_id
    for day in (1..30)
      assign delay = day | minus: 1 | times: 1440
      background job_id = 'jobs/daily_report', delay: delay, priority: 'low', source_name: 'daily-report', schedule_id: schedule_id
    endfor
  endif
%}
```

`delay` is in minutes: `1440` is one day and `43200` is 30 days. The first daily job runs at once,
the last 29 days later; on day 30 the scheduler runs again.

### Step 3: start the schedule

From a page protected by an authorization policy. It makes a new schedule id, stores it in the
constant with `constant_set`, and queues the scheduler. A job queued from a page starts a new
chain, so the schedule starts with the full 1000 steps.

```graphql
# app/graphql/constants/set.graphql
mutation set_constant($name: String!, $value: String!) {
  constant_set(name: $name, value: $value) {
    name
  }
}
```

```liquid
{% comment %}app/views/pages/admin/start-daily-report.liquid{% endcomment %}
{% liquid
  assign schedule_id = '' | uuid
  graphql _ = 'constants/set', name: 'DAILY_REPORT_SCHEDULE_ID', value: schedule_id
  background job_id = 'jobs/schedule_daily_report', priority: 'low', source_name: 'schedule-daily-report', schedule_id: schedule_id
  echo 'Daily report scheduled'
%}
```

## Changing or stopping the schedule

- **Change:** edit the scheduler and visit the start page again. The new id replaces the old one,
  so jobs the old schedule already queued run, see an id that is no longer current, and do nothing.
- **Stop:** set the constant to a different value, or delete it.
- **Optional clean-up:** delete the inactive jobs with `admin_background_jobs_delete_all`, filtered
  by `source_name` (at most 100 per call; repeat until `results` is empty). See [api.md](api.md#managing-jobs-with-graphql).
- Stopping a **running** scheduler (`admin_background_job_stop`) ends only that run. Because it
  queued its next run first, the schedule goes on. Change the constant to end it.
- Alternative from the same page: keep schedules in a table and have the job check that its
  schedule's record still exists. Deleting the record cancels all its jobs.

## Make the daily job safe to run twice

Jobs can run more than once: a retried failure, a schedule started twice, a job run again after a
stop. Write the daily job so a second run does no harm, for example store the date of the last
report and skip the work when today's report exists.

## Rules for an agent

- Never tell a developer to use cron or an external scheduler for recurring work on Insites; use
  this pattern. An external system calling an Insites page on a timer is a valid alternative only
  when the developer already runs one and accepts that the page must be protected.
- Queue the next run at the **start** of any self-queuing job. A job that fails, or is stopped,
  before it queues its next run ends its chain.
- Pass ids and small values as job arguments, never result sets: keep the payload under 100KB.
- Use `priority: 'low'` for scheduled work unless it must start quickly; `low` may run 4 hours.
