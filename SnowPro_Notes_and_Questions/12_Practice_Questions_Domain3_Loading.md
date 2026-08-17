# Practice Questions — Domain 3: Data Loading, Unloading & Connectivity (18%)

9 original questions covering subtopics 3.1-3.3, modeled on
[03_Domain3_Data_Loading_Unloading_Connectivity.md](03_Domain3_Data_Loading_Unloading_Connectivity.md).
Original content, not sourced from any exam-dump site. (For the official guide's own sample
question on this domain — the `PURGE` scenario — see
[09_Official_Sample_Questions_Analysis.md](09_Official_Sample_Questions_Analysis.md); the
questions below deliberately test different angles of the same domain rather than repeating it.)

---

**1.** A team needs a stage that multiple users can load into, with a custom file format and
directory table enabled, shareable via role grants. Which stage type fits?

A. User stage (`@~`)
B. Table stage (`@%table_name`)
C. A named internal stage
D. An external stage only

**2.** Which Snowflake object is the recommended way to let an external stage access an S3
bucket without embedding an AWS access key and secret directly in the stage definition?

A. A network policy
B. A storage integration
C. An API integration
D. A file format object

**3.** A `COPY INTO` job has already successfully loaded a set of files once. The same command is
re-run unmodified against the same stage the next night, with no new files added. What happens by
default?

A. All files are reloaded, duplicating the data
B. No files are reloaded — Snowflake's load history tracking (by file name + checksum,
   retained 64 days) treats them as already loaded
C. The job fails with an error because the files are still present
D. Only files modified in the last 24 hours are reloaded

**4.** A data engineer intentionally needs to reload a set of files that were already
successfully loaded, because a bug in an earlier run produced incorrect transformed output
downstream. Which `COPY INTO` option lets them force this?

A. `PURGE = TRUE`
B. `FORCE = TRUE`
C. `ON_ERROR = CONTINUE`
D. `VALIDATION_MODE = RETURN_ALL_ERRORS`

**5.** Which ingestion approach is best suited to sub-second to low-second latency, pushing rows
directly without first staging files, commonly paired with a Kafka producer?

A. A standard scheduled `COPY INTO` job on a Task
B. Snowpipe (file-based, event-triggered)
C. Snowpipe Streaming
D. An external table with automatic metadata refresh

**6.** A stream `orders_stream` on table `orders` has several thousand unconsumed change
records. A developer runs `CREATE TABLE orders_clone CLONE orders_schema` (cloning the whole
schema, stream included). Immediately after, they query the cloned stream. What should they
expect?

A. The same thousands of records as the original stream, since cloning is a full snapshot
B. Zero records — the cloned stream is re-initialized at the point of cloning, not carrying
   over pending records
C. An error, since streams cannot be cloned
D. Only the records added to `orders` after the clone completes, retroactively backfilled

**7.** A transformation is expressible as a single query over one or two source tables, and the
team wants Snowflake to handle incremental refresh automatically based on an acceptable staleness
window, without hand-writing stream-consumption or merge logic. Which feature is the best fit?

A. A Stream paired with a Task
B. A Dynamic Table with a target lag
C. Snowpipe Streaming
D. A materialized view on Standard edition

**8.** Which integration type authorizes a Snowflake account to call an external HTTP API
endpoint (for example, backing an external function or a webhook-based notification), without
embedding credentials directly in SQL?

A. Storage integration
B. API integration
C. Git integration
D. A file format object

**9.** A CSV file load using `ON_ERROR = SKIP_FILE` encounters three malformed rows in one file
out of a batch of fifty files being loaded together. What is the expected outcome?

A. The entire `COPY INTO` statement aborts and no files are loaded
B. Only the malformed rows are skipped; the rest of that file's valid rows still load, and
   all other 49 files load normally
C. The file containing malformed rows is skipped entirely; the other 49 files load normally
D. All fifty files are skipped since one contained an error

---

## Answer Key & Explanations

1. **C — A named internal stage.** User and table stages are single-purpose and not shareable;
   only a named stage supports custom file formats, directory tables, and role-based sharing.
2. **B — A storage integration.** The account-level object holding a cloud IAM role/identity —
   the secure-by-default way to connect an external stage without embedded credentials.
3. **B.** `COPY INTO` load history is tracked by file name + checksum for 64 days, making reruns
   idempotent by default — files aren't reloaded unless `FORCE = TRUE` is specified.
4. **B — `FORCE = TRUE`.** Explicitly overrides the default idempotency behavior to force a
   reload of already-loaded files. (`PURGE` deletes staged files after load and is unrelated to
   forcing reloads.)
5. **C — Snowpipe Streaming.** Purpose-built for low-latency row-level ingestion without a
   staging step first — Snowpipe (file-based) is micro-batch (seconds-to-minutes), not
   sub-second.
6. **B.** A cloned stream is re-initialized at the point of cloning — pending change records from
   the original are not carried over. This is a documented gotcha (also tested in the official
   guide's own sample questions).
7. **B — A Dynamic Table with a target lag.** Purpose-built for exactly this: declare the query
   and acceptable staleness, and Snowflake handles the incremental refresh automatically — no
   manual stream/task orchestration needed, and no edition gating like materialized views have.
8. **B — API integration.** Authorizes calling an external API endpoint; storage integration is
   for cloud storage access, Git integration is for repo-backed object deployment.
9. **C.** `SKIP_FILE` (as opposed to a row-level continue behavior) skips the *entire file*
   containing any error row, not just the offending rows — the other 49 well-formed files load
   normally. (Contrast with `CONTINUE`, which skips only the bad rows and keeps loading the rest
   of that same file.)
