# Domain 3 — Data Loading, Unloading & Connectivity (18%)

**Verified against the official Snowflake COF-C03 Exam Study Guide** — follows guide sections
3.1-3.3. Closest domain to your day job — should be the fastest review, but the exact
options/syntax below are exactly what gets tested (see the official sample question on `PURGE`).

## 3.1 Loading and unloading

### Stages
- **Internal stages**: user stage (`@~`, one per user, not shareable), table stage (`@%table`,
  tied to the table, not shareable, no custom file format), **named internal stage** (explicit
  `CREATE STAGE`, shareable, most flexible).
- **External stages**: point at S3/Azure Blob/GCS you own, ideally via a **storage integration**
  (account-level object holding a cloud IAM role/identity) rather than embedded credentials.
- **Server-side encryption**: files at rest in a stage are encrypted; for external stages you can
  specify the cloud provider's server-side encryption type/settings (e.g. `SNOWFLAKE_SSE` or
  customer-provided keys) as part of the stage or `COPY` statement so Snowflake correctly
  reads/writes already-encrypted objects.
- **Directory tables**: an optional metadata layer on a stage that catalogs the files present
  (name, size, last-modified, and a file URL) — enables querying "what files exist in this
  stage" via SQL and underlies unstructured-data file serving.

### File formats
- Named `FILE FORMAT` objects: CSV/delimited, JSON, Avro, ORC, Parquet, XML — reusable across
  multiple stages/`COPY` statements. Semi-structured formats load into `VARIANT` naturally.

### `COPY INTO` and error handling
- `COPY INTO <table>` bulk-loads staged files; tracks load history by file name + checksum for
  **64 days** so re-running the same load is idempotent by default (`FORCE = TRUE` overrides).
- **`PURGE = TRUE`**: deletes staged files automatically after a successful load — the fix when
  a stage is accumulating already-loaded files, *without* affecting `ON_ERROR` behavior or
  causing reloads (this exact scenario is one of the official guide's sample questions).
- Other key options: `ON_ERROR` (`CONTINUE`, `SKIP_FILE`, `SKIP_FILE_<n>`,
  `ABORT_STATEMENT` default), `PATTERN` (regex filter), `VALIDATION_MODE` (dry-run).
- Ideal bulk-load file size: roughly 100-250MB compressed, for good load parallelism.

## 3.2 Automated data ingestion

- **Snowpipe**: serverless continuous ingestion triggered by cloud storage event notifications
  (e.g. S3 → SQS) or the REST API (`insertFiles`). Billed per actual compute-second on
  Snowflake-managed compute (not a warehouse you size), micro-batch latency (seconds-minutes).
  Uses `COPY INTO` semantics under the hood, so the same idempotency rules apply.
- **Snowpipe Streaming**: lower-latency API for pushing rows directly without staging files first
  — true streaming ingestion (e.g. via the Kafka connector's streaming mode), sub-second to
  low-second latency instead of micro-batch.
- **Streams**: a change-tracking object on a table — records inserts/updates/deletes since the
  stream's offset was last advanced (consuming it inside a DML statement, e.g.
  `INSERT ... SELECT * FROM my_stream`, advances the offset). **Cloning behavior**: cloning a
  schema/table that has a stream with unconsumed records creates a stream that is *re-initialized
  at the point of cloning* — pending change records from the original are **not** carried over
  to the clone (a documented gotcha the official guide tests directly via sample question).
- **Tasks**: scheduled (cron-like) or chained (`AFTER <task>`) execution of a SQL
  statement/procedure — paired with a Stream to build incremental ELT: stream captures changes,
  task processes them on a schedule.
- **Dynamic Tables**: a *declarative* alternative to hand-rolled Stream+Task pipelines — you
  define a target table as a query over source table(s) plus a **target lag** (how stale the
  result is allowed to be), and Snowflake automatically figures out and runs the incremental
  refresh to hit that lag, without you writing the change-capture/merge logic yourself. Prefer
  Dynamic Tables over Streams+Tasks when the transformation is expressible as a single query and
  you don't need custom procedural logic.
  - **Incremental refresh runs on the exact same `CHANGE_TRACKING` metadata that Streams use** —
    verified hands-on: building a Dynamic Table over a table we didn't own (a shared database)
    silently fell back to `FULL` refresh (recompute everything, every time) with the explicit
    reason `"Change tracking cannot be enabled for secondaries"`. Dynamic Tables aren't a separate
    mechanism from Streams+Tasks under the hood — they're the same change-tracking foundation,
    wrapped in a declarative interface. Requires write access on the source to enable
    `CHANGE_TRACKING = TRUE`; a shared/read-only source can only ever refresh `FULL`.
  - `refresh_mode` can be requested as `AUTO` (Snowflake decides), or forced `INCREMENTAL`/`FULL`
    — `SHOW DYNAMIC TABLES` reports both the configured mode and the actual mode with a reason
    when they differ.
- **Openflow**: listed in the guide but explicitly *not tested until it reaches GA* — you can
  skip deep study here.

## 3.3 Connectors and integrations

- **Snowflake drivers**: ODBC, JDBC, Python connector, Node.js, Go, .NET — all built on the same
  underlying protocol.
- **Snowflake connectors**: purpose-built integrations, e.g. the **Kafka connector** (auto-creates
  tables/pipes, streams topic data in via Snowpipe or Snowpipe Streaming), Spark connector.
- **Storage integration**: account-level object storing a cloud IAM role so external stages don't
  need embedded credentials — the secure default for connecting to S3/Blob/GCS.
- **API integration**: account-level object authorizing Snowflake to call an external API
  endpoint (e.g. for external functions or webhook-style notification integrations) without
  embedding credentials inline.
- **Git integration**: connect a Snowflake account directly to a Git repository (e.g. for Native
  App source, Snowflake CLI-managed projects, or version-controlled SQL/Python) so objects can be
  created/deployed straight from a repo.

## Self-check before moving on

- [ ] Can you name the three internal stage types and one limitation of each?
- [ ] Can you explain exactly why `PURGE = TRUE` solves the "accumulating staged files" problem
      without touching `ON_ERROR` or reload behavior?
- [ ] Can you state what happens to a stream's pending records when its schema is cloned?
- [ ] Can you explain when to reach for a Dynamic Table instead of a Stream+Task pair?
- [ ] Can you distinguish storage integration, API integration, and Git integration by what each
      one authorizes Snowflake to do?
