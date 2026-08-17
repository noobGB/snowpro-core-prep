# Mock Exam 1 — Full-Length Practice Exam (100 Questions)

A complete, domain-weight-proportional mock exam: **Domain 1 (Architecture & Features): 31,
Domain 2 (Account Mgmt & Governance): 20, Domain 3 (Data Loading/Unloading/Connectivity): 18,
Domain 4 (Performance & Transformation): 21, Domain 5 (Data Collaboration): 10** — matching the
official guide's weightings exactly. Questions are deliberately **not** grouped by domain block —
they're interleaved throughout, the way the real exam mixes domains unpredictably, so you can't
mentally switch into "performance-question mode" ahead of time.

50 of these questions are drawn from the existing single-domain practice files (`10`–`14`); the
other 50 are new, built from this week's hands-on-verified findings against a real Snowflake
account (`claude_sandbox`) and fresh, targeted checks against Snowflake's official documentation.
**Original content throughout — never sourced from or modeled on exam-dump/brain-dump sites.**

One honest caveat: no source (Snowflake's own docs, prep sites, community forums) publishes an
exact single-choice vs. multi-select ratio for the real COF-C03 exam — Snowflake states only
"multiple-choice and multiple-select," with no breakdown given anywhere. This mock uses a
reasonable, clearly-labeled mix (a few "Select TWO" items) rather than inventing a false ratio.

**Take this closed-book, timed to 115 minutes** (the real exam's limit), then check the answer
key at the bottom. Log your score — with a full per-domain breakdown — in
[06_Practice_Exam_Tracker.md](06_Practice_Exam_Tracker.md).

---

**1.** A company needs their Snowflake data encrypted with a key they manage themselves, layered
on top of Snowflake's own encryption, and also needs HIPAA compliance support. Which is the
*minimum* edition that satisfies both requirements?

A. Standard
B. Enterprise
C. Business Critical
D. Virtual Private Snowflake (VPS)

**2.** A newly created custom role `DATA_ANALYST` needs to be usable by warehouses and databases
created by the platform team. Following Snowflake best practice, which system-defined role should
`DATA_ANALYST` be granted to, so administrative visibility is retained?

A. `ACCOUNTADMIN` directly
B. `SYSADMIN`
C. `SECURITYADMIN`
D. `PUBLIC`

**3.** A team needs a stage that multiple users can load into, with a custom file format and
directory table enabled, shareable via role grants. Which stage type fits?

A. User stage (`@~`)
B. Table stage (`@%table_name`)
C. A named internal stage
D. An external stage only

**4.** In Query Profile, a query shows a large amount of **bytes spilled to local storage** at
one operator. What does this most directly indicate, and what's the most likely fix?

A. The filter predicate isn't pruning partitions — add a clustering key
B. The warehouse ran out of memory for that operation — consider a larger warehouse or
   rewriting the query to reduce intermediate result size
C. The query is waiting behind other queries — scale out to a multi-cluster warehouse
D. A join is producing far more rows than expected — check the join keys

**5.** Which Snowflake layer is responsible for query parsing, optimization, and access control
enforcement, and runs on infrastructure the customer does not directly provision or size?

A. Database Storage layer
B. Query Processing (Compute) layer
C. Cloud Services layer
D. Virtual warehouse layer

**6.** A permanent table has `DATA_RETENTION_TIME_IN_DAYS = 5`. A row is deleted today. For how
long, and through what mechanism, can Snowflake support recover that row if the customer's own
5-day Time Travel window has already passed, assuming no one has purged it?

A. It cannot be recovered — Fail-safe only applies to transient tables
B. An additional fixed 7 days, via Snowflake Support only (the customer cannot self-serve
   this recovery)
C. An additional 90 days, self-serve via `AT`/`BEFORE` clauses
D. Indefinitely, since permanent tables never lose data

**7.** Which system-defined role is responsible for creating and managing users and roles, but
does **not**, by itself, manage warehouses or databases?

A. `SYSADMIN`
B. `SECURITYADMIN`
C. `USERADMIN`
D. `ORGADMIN`

**8.** Which Snowflake object is the recommended way to let an external stage access an S3
bucket without embedding an AWS access key and secret directly in the stage definition?

A. A network policy
B. A storage integration
C. An API integration
D. A file format object

**9.** In Query Profile, a query scans 95% of a table's total micro-partitions despite having a
highly selective filter on one column. What does this most directly indicate, and what's the
most likely fix?

A. Bytes are spilling to disk — resize the warehouse larger
B. The filtered column isn't well-clustered — consider a clustering key on that column for a
   large, frequently-filtered table
C. The warehouse is queueing — scale out
D. The query needs `QUALIFY` instead of a `WHERE` clause

**10.** A team wants multiple business units to run large, independent workloads against the same
underlying tables at the same time, with zero contention between them and no need to duplicate
data. Which architectural property of Snowflake most directly enables this?

A. Micro-partition immutability
B. Shared storage with independent per-warehouse compute
C. The result cache
D. Time Travel

**11.** A developer wants to write and run SQL directly against a Snowflake account from within
their existing code editor, without switching to a browser. Which tool best fits?

A. Snowsight
B. Snowflake CLI only
C. An IDE integration such as the official VS Code extension
D. SnowSQL exclusively, since no editor integration exists

**12.** Snowflake's access control model lets the *owner* of a securable object decide who else
gets access to it via grants, rather than a central authority making that decision. What is this
model called?

A. Mandatory Access Control (MAC)
B. Role-Based Access Control (RBAC) exclusively
C. Discretionary Access Control (DAC)
D. Attribute-Based Access Control (ABAC)

**13.** A `COPY INTO` job has already successfully loaded a set of files once. The same command is
re-run unmodified against the same stage the next night, with no new files added. What happens by
default?

A. All files are reloaded, duplicating the data
B. No files are reloaded — Snowflake's load history tracking (by file name + checksum,
   retained 64 days) treats them as already loaded
C. The job fails with an error because the files are still present
D. Only files modified in the last 24 hours are reloaded

**14.** A query's Query Profile shows one join operator outputting far more rows than either of
its two inputs combined. What does this most likely indicate?

A. Inefficient pruning on the filter column
B. A missing or incorrect join key (an "exploding" join)
C. The result cache was bypassed
D. The warehouse needs Query Acceleration Service

**15.** A session sets a parameter with `ALTER SESSION SET STATEMENT_TIMEOUT_IN_SECONDS = 300`,
while the account-level default is 3600 seconds. For the duration of that session, which value
is in effect, and why?

A. 3600 seconds, because account-level settings always override session-level settings
B. 300 seconds, because the most specific level set (session) takes precedence over the
   account default
C. Neither — parameter conflicts cause the session to fail
D. 3600 seconds, because session-level parameters only apply to warehouses, not statements

**16.** A team clones a database at 2:00 PM. At clone time, the source database is 50TB. What is
the storage cost impact of the clone at the moment it's created, before either the clone or the
source diverges?

A. The clone immediately consumes another 50TB of storage
B. The clone consumes roughly half the source's storage, ~25TB
C. The clone consumes effectively no additional storage — it's a metadata-only operation
   until either copy starts to diverge (copy-on-write)
D. The clone operation is blocked until enough storage is provisioned

**17.** A service account used by an automated ETL job needs to authenticate without a password
and without any interactive login step. Which authentication method fits best?

A. Multi-Factor Authentication (MFA)
B. Key-pair authentication
C. Federated Authentication / SSO
D. A network policy

**18.** A data engineer intentionally needs to reload a set of files that were already
successfully loaded, because a bug in an earlier run produced incorrect transformed output
downstream. Which `COPY INTO` option lets them force this?

A. `PURGE = TRUE`
B. `FORCE = TRUE`
C. `ON_ERROR = CONTINUE`
D. `VALIDATION_MODE = RETURN_ALL_ERRORS`

**19.** Several dashboard queries wait for several seconds before starting, even though each
individual query, once running, completes quickly. Query Profile shows minimal time spent inside
each query's own execution plan. What does this pattern indicate, and what's the fix?

A. Bytes spilling to disk — resize the warehouse
B. Inefficient pruning — add a clustering key
C. Queuing due to insufficient concurrency — consider a multi-cluster warehouse (scale out)
D. An exploding join — review the join logic

**20.** Which of the following is **not** one of the database object types explicitly listed in
the object hierarchy (Domain 1.3) alongside Tables, Views, and Stages?

A. Sequences
B. Pipes
C. Resource Monitors
D. ML models

**21.** A workload runs memory-intensive Snowpark Python transformations that regularly spill to
disk on a Standard Gen 2 warehouse of adequate size. Which warehouse type is purpose-built to
reduce this kind of spilling for memory-heavy workloads?

A. A larger Standard Gen 1 warehouse
B. A Snowpark-Optimized warehouse
C. A multi-cluster Standard warehouse in Economy mode
D. The default warehouse for Notebooks

**22. (Select TWO)** Which two of the following are valid reasons to use a **database role**
instead of a standard account role?

A. Database roles can be granted privileges scoped to objects within a single database only
B. Database roles are automatically activated as secondary roles for every session
C. Database roles can travel with a database into a share or a replication target
D. Database roles replace the need for `USERADMIN` entirely

**23.** Which ingestion approach is best suited to sub-second to low-second latency, pushing rows
directly without first staging files, commonly paired with a Kafka producer?

A. A standard scheduled `COPY INTO` job on a Task
B. Snowpipe (file-based, event-triggered)
C. Snowpipe Streaming
D. An external table with automatic metadata refresh

**24.** An analytics team wants to know which specific warehouse and query tag drove the most
credit consumption last month, broken out by query. Which source should they use?

A. Query Profile for a single query
B. `SNOWFLAKE.ACCOUNT_USAGE` query attribution / `QUERY_HISTORY` views
C. A resource monitor's current threshold status
D. `SYSTEM$CLUSTERING_INFORMATION`

**25.** A team wants queries to queue as little as possible during unpredictable concurrency
spikes, and cost is a secondary concern. Which multi-cluster scaling policy should they choose?

A. Economy, because it minimizes the number of active clusters
B. Standard, because it starts new clusters promptly once queries begin queueing
C. Economy, because it always keeps every configured cluster running
D. Neither — scaling policies only apply to single-cluster warehouses

**26.** A consumer account queries a table shared with them via Secure Data Sharing by a provider
account. Whose compute resources are used, and who is billed for that query?

A. The provider's compute; the provider is billed
B. The consumer's own compute; the consumer is billed
C. Neither is billed — shared data queries are always free
D. Both accounts are billed equally, split 50/50

**27.** A session's primary role is `ANALYST`, but the user also needs simultaneous access granted
to role `REPORTING_VIEWER` within the same session, without switching roles mid-session. Which
feature enables this?

A. Discretionary Access Control
B. Secondary roles (`USE SECONDARY ROLES ALL`)
C. A network policy scoped to both roles
D. Object tagging

**28.** A stream `orders_stream` on table `orders` has several thousand unconsumed change
records. A developer runs `CREATE TABLE orders_clone CLONE orders_schema` (cloning the whole
schema, stream included). Immediately after, they query the cloned stream. What should they
expect?

A. The same thousands of records as the original stream, since cloning is a full snapshot
B. Zero records — the cloned stream is re-initialized at the point of cloning, not carrying
   over pending records
C. An error, since streams cannot be cloned
D. Only the records added to `orders` after the clone completes, retroactively backfilled

**29.** As a workload-management best practice, a company runs both latency-sensitive executive
dashboards and long-running ad-hoc analyst queries. What's the recommended approach?

A. Run both workloads on one large warehouse so they share the same cache
B. Group similar workloads onto separate, dedicated warehouses so one doesn't queue out the
   other
C. Always use Query Acceleration Service instead of separating warehouses
D. Disable auto-suspend on both workloads to avoid cold-start latency

**30.** Which table type allows Snowflake to act as a query and write engine over data stored in
an open, externally-manageable table format that other engines can also read?

A. Transient
B. External
C. Apache Iceberg
D. Dynamic

**31.** A team wants a table that behaves like the result of a query — automatically kept in
sync by Snowflake without them writing or scheduling any refresh logic themselves — but they are
not on an edition that supports Materialized Views. Which storage/table feature (covered under
automated ingestion in Domain 3) fits this need?

A. A standard view
B. A Dynamic Table
C. A Transient table
D. A Secure view

**32.** A finance team wants Social Security Numbers to display in full for the `PII_ADMIN` role
but masked (e.g. `XXX-XX-1234`) for every other role querying the same column, without
maintaining two copies of the data. Which feature fits?

A. A row access policy
B. Dynamic Data Masking (a masking policy)
C. Object tagging
D. A privacy (aggregation) policy

**33.** A transformation is expressible as a single query over one or two source tables, and the
team wants Snowflake to handle incremental refresh automatically based on an acceptable staleness
window, without hand-writing stream-consumption or merge logic. Which feature is the best fit?

A. A Stream paired with a Task
B. A Dynamic Table with a target lag
C. Snowpipe Streaming
D. A materialized view on Standard edition

**34.** A single ad-hoc analytical query is disproportionately large and slow compared to the rest
of the workload running on its warehouse. The team doesn't want to resize the warehouse
permanently just for this one outlier query. Which feature is designed for exactly this
situation?

A. Search Optimization Service
B. Query Acceleration Service (QAS)
C. A clustering key
D. A materialized view

**35.** Why would a data provider define a **Secure View** on a table instead of sharing the
table directly?

A. Secure views load data faster than base tables
B. Secure views hide the view's definition from viewers without privilege to see it,
   preventing logic reverse-engineering or row leakage via crafted queries
C. Secure views are required before Time Travel can be enabled
D. Secure views automatically encrypt data with a customer-managed key

**36.** A provider wants to share a dataset with a company that does not have its own Snowflake
account. Which mechanism lets the provider make this possible, while the provider bears the
compute cost on the recipient's behalf?

A. A public Marketplace listing
B. A reader account
C. A Native App
D. Direct sharing to a named consumer account (requires the consumer to already have an
   account)

**37.** A governance team wants to guarantee that any query against a sensitive table can only
return aggregated results above a minimum group size — never individual row-level detail —
regardless of how a caller writes their query. Which feature is designed for exactly this?

A. A masking policy
B. A row access policy
C. A privacy (aggregation) policy
D. Object tagging

**38.** Which integration type authorizes a Snowflake account to call an external HTTP API
endpoint (for example, backing an external function or a webhook-based notification), without
embedding credentials directly in SQL?

A. Storage integration
B. API integration
C. Git integration
D. A file format object

**39.** A support application performs frequent exact-match lookups (`WHERE ticket_id = ?`) on a
large table where the lookup column isn't naturally well-clustered and clustering isn't a good
fit. Which feature is best suited to accelerating these specific point lookups?

A. Query Acceleration Service
B. Search Optimization Service
C. A clustering key on `ticket_id`
D. The metadata cache

**40.** Which Snowflake Cortex sub-feature is specifically built for natural-language-to-SQL
querying over a defined semantic model?

A. Cortex Search
B. AI SQL functions
C. Cortex Analyst
D. Snowflake ML

**41.** A developer wants to train and register a machine learning model, and manage its
lifecycle (features, training, registry) without exporting data out of Snowflake to a separate ML
platform. Which feature covers this?

A. Snowpark
B. Snowflake ML
C. Streamlit in Snowflake
D. Cortex Search

**42.** A resource monitor is configured with three threshold actions as credit usage rises.
Which of the following correctly orders the actions from least to most disruptive to already
*running* queries?

A. Suspend Immediately → Suspend → Notify
B. Notify → Suspend → Suspend Immediately
C. Suspend → Notify → Suspend Immediately
D. Notify → Suspend Immediately → Suspend

**43.** A CSV file load using `ON_ERROR = SKIP_FILE` encounters three malformed rows in one file
out of a batch of fifty files being loaded together. What is the expected outcome?

A. The entire `COPY INTO` statement aborts and no files are loaded
B. Only the malformed rows are skipped; the rest of that file's valid rows still load, and
   all other 49 files load normally
C. The file containing malformed rows is skipped entirely; the other 49 files load normally
D. All fifty files are skipped since one contained an error

**44.** A dashboard aggregation over a large, slowly-changing table is expensive to recompute on
every page load. The team is on Enterprise edition. Which feature lets Snowflake precompute and
automatically maintain this result, at the cost of storage and background maintenance credits?

A. A standard view
B. A materialized view
C. The result cache alone
D. A Dynamic Table with no target lag

**45.** A table has `DATA_RETENTION_TIME_IN_DAYS = 0` and no clustering key defined. Roughly how
large is each of its micro-partitions expected to be, uncompressed?

A. 1-10MB
B. 50-500MB
C. 1-5GB
D. Exactly 128MB, fixed by Snowflake

**46.** An analyst wants to investigate which warehouse and user drove the highest credit
consumption over the last 30 days. Which source should they query, and what tradeoff should they
be aware of?

A. `INFORMATION_SCHEMA`, which is real-time but has a very limited retention window
B. `ACCOUNT_USAGE` views such as `WAREHOUSE_METERING_HISTORY`, which cover longer history
   but can lag by hours
C. Resource monitors, which store no historical data at all
D. Query Profile, which only shows data for a single query at a time

**47.** Which edition is the first (lowest) at which multi-cluster warehouses and materialized
views become available?

A. Standard
B. Enterprise
C. Business Critical
D. Virtual Private Snowflake (VPS)

**48. [D3]** A Dynamic Table is created over a source table the owner does not have write access to
(e.g., a table in a database shared read-only from another account). What refresh behavior
should be expected?

A. `INCREMENTAL` refresh, since Dynamic Tables never need write access to their source
B. The dynamic table creation fails outright
C. `FULL` refresh — `CHANGE_TRACKING` cannot be enabled on a source the owner can't modify,
   so Snowflake falls back to fully recomputing on each refresh
D. The dynamic table refreshes only once, at creation, and never again

**49.** A query returns instantly with **zero compute credits consumed**, even though the
warehouse that would normally run it is currently suspended. Which cache explains this?

A. The metadata cache
B. The local warehouse (SSD) cache
C. The query result cache
D. The search optimization cache

**50. [D1]** Which view type is precomputed and automatically kept in sync by Snowflake in the
background, at the cost of storage and maintenance credits?

A. A standard view
B. A secure view
C. A materialized view
D. An external view

**51. [D1]** A team wants to configure a multi-cluster warehouse with more than 10 clusters. Which
warehouse size allows the **highest** maximum cluster count?

A. 6X-Large
B. X-Large
C. X-Small
D. Large

**52. [D2]** Per Snowflake's documented access control model, which combination of privileges is
required for a role to successfully query a table via `SELECT`?

A. `SELECT` on the table alone is always sufficient
B. `SELECT` on the table, plus `USAGE` on its containing database and schema
C. `OWNERSHIP` on the table only
D. `USAGE` on the database alone, since it cascades to all contained objects

**53. [D3]** Which feature provides a queryable metadata catalog (file name, size, last-modified, a
file URL) of the files present in a stage?

A. A file format object
B. A directory table
C. A storage integration
D. A named stage's `COPY` history

**54.** A query needs to return each customer's single most recent order, using a window function
to rank orders per customer by date, without wrapping the query in an extra subquery or CTE just
to filter on the ranking. Which Snowflake SQL feature is purpose-built for this?

A. `FLATTEN()`
B. `QUALIFY`
C. `MERGE`
D. `APPROX_COUNT_DISTINCT`

**55. [D1]** Under the **Economy** scaling policy, what specific, quantified condition must be met
before Snowflake starts an additional cluster?

A. The existing clusters must be at 100% CPU utilization
B. Snowflake must estimate at least 6 minutes of queued work to keep the new cluster busy
C. A query must wait in the queue for more than 60 seconds
D. The `MAX_CLUSTER_COUNT` setting must be reached on the current cluster

**56. [D5]** What fundamentally happens to the underlying data when a provider sets up Secure Data
Sharing with a consumer account?

A. The data is copied into the consumer's own storage
B. Nothing is copied or moved — the consumer queries the provider's storage directly, live,
   using their own compute
C. The data is exported to a neutral third-party storage location
D. The data is duplicated into both accounts to speed up queries

**57. [D2]** A row access policy is applied to a `region` column so that a `REGIONAL_ANALYST` role can
query the table but only ever sees rows matching their assigned region. Rows outside that region
are:

A. Displayed with the `region` column masked but the rest of the row visible
B. Not present in the result set at all — they simply don't exist for that role's query
C. Displayed but flagged as restricted
D. Only visible via a special `SHOW RESTRICTED ROWS` command

**58. [D3]** When configuring an external stage over data already encrypted by the cloud provider,
which stage-level setting should be specified so Snowflake correctly reads/writes the
already-encrypted objects?

A. `DIRECTORY = TRUE`
B. A server-side encryption type/setting appropriate to the cloud provider
C. `AUTO_INGEST = TRUE`
D. `PURGE = TRUE`

**59. [D4]** `SYSTEM$ESTIMATE_QUERY_ACCELERATION()` returns `"status": "ineligible",
"ineligibleReason": "NO_LARGE_ENOUGH_SCAN"` for a query with a highly selective filter (well
under 1% of rows returned) over a small (~1GB) table. What does this indicate about QAS
eligibility?

A. Filter selectivity alone determines eligibility, regardless of table size
B. Eligibility also requires the underlying scan to be large in absolute terms — a small
   table's scan may not be worth offloading even with a very selective filter
C. QAS is never eligible for filtered queries, only full table scans
D. The query must be rewritten using `QUALIFY` before QAS can apply

**60. [D1]** A team wants a warehouse provisioned for better price/performance without switching to a
different warehouse type entirely. What should they check?

A. Whether Query Acceleration Service is enabled
B. Whether the warehouse is provisioned as Standard Gen 2 rather than Gen 1
C. Whether the warehouse is Snowpark-Optimized
D. Whether the warehouse has a clustering key defined

**61. [D1]** Which of the following pairs are **both** explicitly listed as database object types
under Snowflake's object hierarchy (Domain 1.3)?

A. Resource Monitors and Network Policies
B. Pipes and Sequences
C. Warehouses and Roles
D. Users and Organizations

**62. [D2]** A tag is created with `CREATE TAG data_class ALLOWED_VALUES 'PUBLIC', 'INTERNAL',
'RESTRICTED'`. An attempt is then made to assign the value `'SECRET'` to a column using this tag.
What happens?

A. The assignment succeeds; `ALLOWED_VALUES` is advisory only
B. The assignment fails — Snowflake rejects any value not in the allowed list
C. The tag is automatically updated to include `'SECRET'`
D. The assignment succeeds but logs a warning

**63. [D3]** A team needs to ingest files with sub-second to low-second latency, without a staging
step, from a Kafka producer. A different, unrelated batch job only needs to load a large file
once per night on a fixed schedule. Which pairing is correct?

A. Snowpipe for the Kafka case; Snowpipe Streaming for the nightly batch
B. Snowpipe Streaming for the Kafka case; a scheduled Task running `COPY INTO` for the
   nightly batch
C. A scheduled Task for both cases
D. Snowpipe for both cases

**64. [D4]** A `QUERY_ACCELERATION_MAX_SCALE_FACTOR` of 5 is set on a Medium warehouse (4 credits/hour).
What does this configure?

A. QAS can run for a maximum of 5 minutes per query
B. QAS can lease additional serverless compute costing up to 5x the warehouse's own rate
   (20 credits/hour here) — a cost ceiling, not a performance setting
C. Up to 5 warehouses can share QAS simultaneously
D. The warehouse will scale out to 5 clusters when QAS is triggered

**65. [D1]** A parameter is set at the ACCOUNT level, and a *different* value for the same parameter
is set at the USER level for a specific user, with no session-level override. Which value applies
when that user connects?

A. The account-level value always wins
B. The user-level value, since it's more specific than the account default
C. Neither — the connection fails due to a conflict
D. The values are averaged

**66. [D5]** A provider wants to share a dataset only with three specifically named partner companies,
not the general public. Which Marketplace mechanism fits?

A. A public listing
B. A private listing, visible only to specifically named consumer accounts
C. A Native App
D. A reader account

**67. [D2]** A masking policy is attached directly to a **tag** (via `ALTER TAG ... SET MASKING
POLICY ...`), not to any specific column. A column is tagged with that tag *after* the masking
policy was already attached to the tag. What happens to that column?

A. Nothing — the masking policy only applies to columns tagged before it was attached
B. The column automatically inherits the masking behavior, with no separate column-level
   masking-policy attachment needed
C. An error occurs, since a tag cannot have a masking policy and be applied to a column
   simultaneously
D. The column must also separately run `SET MASKING POLICY` for masking to take effect

**68. [D4]** `SYSTEM$ESTIMATE_SEARCH_OPTIMIZATION_COSTS()` is run against a table created minutes ago.
The `MaintenanceCosts` field returns `"computationMethod": "NotAvailable"` with a comment about
insufficient history. Why?

A. Search Optimization Service cannot be estimated on any table, ever
B. Maintenance-cost estimation requires observed write/query history over time (the guide
   states 7 days), which a brand-new table doesn't have yet
C. The table is too small to ever support Search Optimization Service
D. `BuildCosts` and `StorageCosts` also fail for the same reason

**69. [D1]** Which feature lets Snowflake objects (SQL scripts, Snowflake CLI-managed projects, Native
App source) be created/deployed directly from a version-controlled repository?

A. API integration
B. Storage integration
C. Git integration
D. A directory table

**70. [D1]** A developer wants a browser-based interface to build dashboards, monitor query history,
and manage account settings, all without installing anything locally. Which tool fits?

A. Snowflake CLI
B. The VS Code extension
C. Snowsight
D. SnowSQL

**71. [D1]** Which capability is available on **Business Critical** edition but **not** on Enterprise
edition?

A. Multi-cluster warehouses
B. 90-day Time Travel
C. Tri-Secret Secure customer-managed encryption keys
D. Materialized views

**72. [D2]** A custom role that owns its own database and warehouse attempts to run `CREATE ROLE
new_role`. What is the most likely outcome?

A. It succeeds, since the role owns objects in the account
B. It fails — creating roles is an account-level privilege, not implied by owning a
   database/warehouse
C. It succeeds only if the role also owns a schema
D. It succeeds, but the new role has no privileges by default

**73. [D5]** A consumer who received data via Secure Data Sharing wants to share that same data onward
to a further consumer account. Is this possible?

A. Never — shared data can only ever be consumed, not reshared
B. Yes, in some configurations, governed by the same grant/privilege model as any other
   share — not an automatic default
C. Only if the original provider deletes the original share first
D. Only via a Native App, never via direct sharing

**74. [D4]** Two queries are textually identical except that the second one adds a table alias not
present in the first (`FROM orders o` vs. `FROM orders`). Will the second query hit the result
cache from the first?

A. Yes — result cache matching is based on the query's semantic meaning, not exact text
B. No — Snowflake's own documentation states that any syntax difference, including adding a
   table alias, inhibits cache reuse
C. Yes, but only if both queries ran in the same session
D. No — but only because aliases specifically are never permitted with the result cache

**75. [D1]** A temporary table is created and populated within one CLI session. A completely separate,
new session (a fresh connection) then queries that same table by name. What happens?

A. The table is visible and returns the data, since temporary tables are account-wide
B. The table does not exist for the new session — temporary tables are scoped to the session
   that created them
C. The table is visible but returns zero rows
D. The new session must explicitly import the table first

**76. [D2]** A security team wants a single Snowsight dashboard surfacing security posture findings
and risk recommendations across the account. Which feature fits?

A. Data lineage
B. Trust Center
C. Resource monitors
D. `ACCOUNT_USAGE`

**77. [D1]** Which Cortex sub-feature is purpose-built for semantic/RAG-style search over unstructured
text data, as opposed to structured-data querying or direct SQL-callable functions?

A. Cortex Analyst
B. Cortex Search
C. AI SQL functions
D. Snowflake ML

**78. [D3]** A pipeline needs Task B to run immediately after Task A finishes successfully, rather than
on its own independent schedule. Which Task feature enables this?

A. `AFTER <task>` chaining
B. `CREATE TASK ... SCHEDULE = '5 MINUTE'` on both tasks
C. A Stream on Task A's output table
D. Tasks cannot depend on each other; only external orchestration can chain them

**79. [D4]** No user-initiated data change occurs on a table, but automatic reclustering is running in
the background due to a defined clustering key. Can this alone invalidate an otherwise-reusable
result cache entry for a query against that table?

A. No — only explicit `INSERT`/`UPDATE`/`DELETE` statements can invalidate the result cache
B. Yes — micro-partition changes from background reclustering/consolidation alone can
   invalidate the cache, even with no logical data change
C. No — reclustering only affects the metadata cache, never the result cache
D. Yes, but only if the clustering key itself is altered

**80. [D1]** A developer wants to write data transformations in Python that execute inside Snowflake's
own compute, rather than pulling data to a client machine first. Which feature fits?

A. Streamlit in Snowflake
B. Snowpark
C. SnowSQL
D. Snowflake CLI

**81. [D2]** A custom role that fully owns its own database attempts to run `CREATE SHARE`. What is
the most likely outcome, and why?

A. It succeeds, since the role owns a database
B. It fails — creating a Share is an account-level privilege, the same category of
   restriction as `CREATE ROLE`/`CREATE USER`
C. It succeeds, but the share cannot be used until an admin approves it
D. It fails because shares require Business Critical edition

**82. [D2]** Which governance feature restricts which IP addresses (or CIDR ranges) are allowed to
connect to a Snowflake account or a specific user?

A. A masking policy
B. A network policy
C. A row access policy
D. A resource monitor

**83. [D3]** A `COPY INTO` job is modified to add `PURGE = TRUE`, with all other options unchanged.
What is the direct effect on the files in the source stage after a successful load?

A. Files are automatically re-validated for errors
B. Files are deleted from the stage immediately after a successful load
C. Files are moved to a separate archive stage
D. Files are compressed further to save space

**84. [D4]** A query benefits from the warehouse's local SSD cache, avoiding a slow remote-storage
fetch for previously-scanned micro-partitions. Does this query consume warehouse compute credits?

A. No — any cache hit, local or result cache, is always free
B. Yes — the warehouse cache only skips the remote-storage fetch; the actual compute
   (filtering, joining, aggregating) still runs and is billed
C. No — the local cache eliminates all compute cost for that query
D. Only half the normal credits are billed

**85. [D1]** A team wants to build and host an interactive Python data application directly inside
their Snowflake account, without standing up separate hosting infrastructure. Which feature fits?

A. Snowpark
B. Cortex Analyst
C. Streamlit in Snowflake
D. Native Apps only

**86. [D5]** Within the Time Travel retention window, a table is accidentally dropped. Which command
restores it to exactly its state immediately before the drop?

A. `SELECT * FROM table AT(OFFSET => -60)`
B. `UNDROP TABLE table_name`
C. `CREATE TABLE table_name CLONE table_name`
D. Dropped tables cannot be restored, only queried historically

**87. [D2]** A human user who logs in interactively wants to add a second authentication factor beyond
their password. Which feature fits?

A. Key-pair authentication
B. Multi-Factor Authentication (MFA)
C. A Programmatic Access Token (PAT)
D. A network policy

**88. [D4]** Which statement about `APPROX_COUNT_DISTINCT` (HyperLogLog-based) is accurate, per
Snowflake's own documentation?

A. Its memory footprint scales linearly with the number of distinct values
B. It has an average relative error of roughly 1.6%, with a memory footprint that stays
   small and roughly fixed regardless of actual cardinality
C. It is always exactly accurate for cardinalities under 1 million
D. It requires more memory than exact `COUNT(DISTINCT)` in every case

**89. [D5]** A candidate studying Domain 1 (Architecture & Features) wants to know which of the
following is officially covered under a **different** domain (Data Collaboration) in the exam
guide, despite feeling like an architecture topic?

A. Micro-partitions
B. Virtual warehouses
C. Time Travel and zero-copy cloning
D. The Cloud Services layer

**90. [D4]** After a clustering key is defined on a large, frequently-updated table, who is
responsible for keeping the table well-clustered as new data arrives?

A. The user must periodically run a manual `RECLUSTER` command
B. Snowflake performs automatic reclustering in the background, consuming credits, with no
   manual command needed
C. Reclustering only happens if `AUTO_RECLUSTER = TRUE` is explicitly set at the account
   level
D. Clustering is a one-time operation at table creation; it never needs to be redone

**91. [D1]** Why does Snowflake define micro-partition size (50-500MB) in terms of **uncompressed**
data rather than the actual compressed bytes stored on disk?

A. Compressed size cannot be measured reliably
B. Measuring by uncompressed (logical) data volume keeps row-count-per-partition consistent
   regardless of how compressible any particular dataset happens to be
C. Uncompressed size is always exactly 3x the compressed size
D. Snowflake does not actually compress data at rest

**92. [D2]** Which account identifier format is the current recommended standard, being
human-readable and independent of cloud provider/region?

A. The legacy account locator
B. Organization name + account name
C. The account's internal UUID
D. The account's IP address

**93. [D3]** An MCP client can only send a static HTTP header on each request and cannot perform
per-request cryptographic signing. Which Snowflake authentication method fits this constraint?

A. RSA key-pair authentication, since it is the more secure option
B. A Programmatic Access Token (PAT), sent as a static bearer token in the header
C. Federated SSO
D. MFA

**94. [D4]** Which of the following is a **window function** rather than a plain aggregate function,
specifically because it operates over a defined partition/order without collapsing rows into a
single result?

A. `SUM()`
B. `COUNT(DISTINCT ...)`
C. `ROW_NUMBER() OVER (PARTITION BY ... ORDER BY ...)`
D. `APPROX_COUNT_DISTINCT()`

**95. [D1]** A Standard edition customer attempts to set `MAX_CLUSTER_COUNT` to a value greater than 1
on a warehouse. What happens?

A. It succeeds, but only Enterprise+ accounts can start the extra clusters
B. It fails — multi-cluster warehouses require Enterprise edition or higher
C. It succeeds with no restrictions
D. It succeeds, but billing for extra clusters is disabled on Standard

**96.** A provider wants to distribute not just data, but an entire packaged application — logic
and UI included — that runs *inside* the consumer's own account so the consumer's underlying data
never has to leave their account. Which mechanism fits?

A. A private listing of raw tables
B. A Native App
C. A reader account
D. A secure view shared directly

**97. [D3]** A data engineer wants to preview what errors a `COPY INTO` statement would encounter,
without actually loading any data yet. Which option should they use?

A. `ON_ERROR = CONTINUE`
B. `FORCE = TRUE`
C. `VALIDATION_MODE = RETURN_ERRORS` (dry-run preview)
D. `PURGE = TRUE`

**98. [D4]** An unfiltered `SELECT COUNT(*) FROM large_table` returns almost instantly, without a full
table scan. Which cache/mechanism explains this?

A. The query result cache, since `COUNT(*)` queries are always cached
B. The metadata cache, which holds micro-partition-level row counts Snowflake can sum
   without scanning the actual data
C. The warehouse local disk cache
D. Search Optimization Service

**99. [D3]** A named `FILE FORMAT` object defining CSV parsing rules is created once. What is the
primary benefit of defining it as a standalone object rather than specifying format options
inline on every `COPY INTO` statement?

A. It is required — inline format options are not supported at all
B. It can be reused across multiple stages and `COPY INTO` statements without repeating the
   same options each time
C. It automatically encrypts the files it parses
D. It doubles the load throughput compared to inline options

**100. [D1]** A developer wants a table that persists only for the duration of their current session
and is automatically dropped when the session ends — distinct from a Transient table, which
persists beyond the session. Which table type fits?

A. Transient
B. Temporary
C. External
D. Permanent

---

## Answer Key & Explanations

1. **C — Business Critical.** Tri-Secret Secure (customer-managed key) and HIPAA/PCI support are
   both Business Critical+ features; Enterprise alone doesn't include either.
2. **B — `SYSADMIN`.** Best practice grants custom/functional roles up to `SYSADMIN` rather than
   directly to `ACCOUNTADMIN`, so admins retain visibility without over-privileging the role.
3. **C — A named internal stage.** User and table stages are single-purpose and not shareable;
   only a named stage supports custom file formats, directory tables, and role-based sharing.
4. **B.** Spilling means the warehouse lacked memory for that operation — resize up or reduce
   intermediate result size; it's not a pruning, queueing, or join-key symptom.
5. **C — Cloud Services layer.** Parsing, optimization, and access control all live here, on
   Snowflake-managed compute the customer never sizes or sees directly.
6. **B.** Fail-safe is a fixed 7-day period after Time Travel ends, for permanent tables only,
   and is Snowflake-support-only recovery.
7. **C — `USERADMIN`.** Dedicated to users/roles only; `SECURITYADMIN` (which inherits
   `USERADMIN`) additionally manages broader grants — the trap is that `SECURITYADMIN` *can* also
   do this, but `USERADMIN` is the narrowly-scoped, dedicated answer.
8. **B — A storage integration.** The account-level object holding a cloud IAM role/identity —
   secure-by-default, no embedded credentials.
9. **B.** Scanning nearly all partitions despite a selective filter is the signature of poor
   clustering on the filtered column.
10. **B — Shared storage with independent per-warehouse compute.** Snowflake's core architectural
    differentiator: one copy of data, independent compute per warehouse.
11. **C — An IDE integration such as the official VS Code extension.** Snowsight is browser-based;
    Snowflake CLI is terminal-based.
12. **C — Discretionary Access Control (DAC).** Object owners decide who else gets access.
13. **B.** `COPY INTO` load history is tracked by file+checksum for 64 days — reruns are
    idempotent by default.
14. **B.** A join outputting far more rows than its inputs combined is the definition of an
    exploding join.
15. **B — 300 seconds.** The most specific level set (session) wins over the account default.
16. **C.** Zero-copy cloning is metadata-only at creation time regardless of source size.
17. **B — Key-pair authentication.** No password, no interactive step — standard for
    service/programmatic accounts.
18. **B — `FORCE = TRUE`.** Explicitly overrides the default idempotency behavior.
19. **C.** Fast individual execution but queued start time is a concurrency symptom — scale out.
20. **C — Resource Monitors.** An account-level cost-management object, not a database object
    listed under 1.3.
21. **B — A Snowpark-Optimized warehouse.** Purpose-built with extra memory per node for
    memory-intensive workloads.
22. **A and C.** Database roles are scoped to a single database (A) and can travel with it into
    a share or replication target (C).
23. **C — Snowpipe Streaming.** Purpose-built for low-latency row-level ingestion without a
    staging step.
24. **B.** `ACCOUNT_USAGE` query attribution/`QUERY_HISTORY` views are built for retrospective
    cost/warehouse/tag breakdowns.
25. **B — Standard.** Starts new clusters promptly once queueing begins, prioritizing latency.
26. **B.** The consumer queries shared data using their own warehouse/compute.
27. **B — Secondary roles.** `USE SECONDARY ROLES ALL` activates additional roles alongside the
    primary.
28. **B.** A cloned stream is re-initialized at the point of cloning — pending records are not
    carried over.
29. **B.** Grouping similar workloads onto dedicated warehouses is the explicit official best
    practice.
30. **C — Apache Iceberg.** Lets Snowflake read/write an open table format other engines can also
    access.
31. **B — A Dynamic Table.** Automatic declarative refresh, independent of Materialized View
    edition gating.
32. **B — Dynamic Data Masking.** Shows different results to different roles at query time, one
    underlying copy of data.
33. **B — A Dynamic Table with a target lag.** Declarative alternative to hand-rolled
    stream/task orchestration.
34. **B — Query Acceleration Service.** Targets one outlier query without resizing the warehouse
    for everyone.
35. **B.** Secure views hide the view definition and prevent query-based data leakage.
36. **B — A reader account.** Purpose-built for consumers without their own Snowflake account.
37. **C — A privacy (aggregation) policy.** Enforces a minimum group size on results regardless
    of query shape.
38. **B — API integration.** Authorizes calling an external API endpoint.
39. **B — Search Optimization Service.** Built for highly selective point-lookup/equality
    searches on columns clustering doesn't help.
40. **C — Cortex Analyst.** The natural-language-to-SQL-over-semantic-model feature.
41. **B — Snowflake ML.** In-platform model training/registry/feature-store without exporting
    data.
42. **B — Notify → Suspend → Suspend Immediately.** Increasing severity in that order.
43. **C.** `SKIP_FILE` skips the *entire file* containing any error row, not just the offending
    rows.
44. **B — A materialized view.** Enterprise+ feature, Snowflake-maintained, real storage +
    maintenance cost.
45. **B — 50-500MB.** Standard micro-partition size range.
46. **B.** `ACCOUNT_USAGE` views cover longer history but come with latency (up to hours).
47. **B — Enterprise.** Both multi-cluster warehouses and materialized views are Enterprise+.
48. **C — `FULL` refresh.** `CHANGE_TRACKING` can't be enabled on a source you can't modify, so
    Snowflake falls back to full recompute — verified hands-on this week against a real shared
    table.
49. **C — The query result cache.** Lives in Cloud Services, zero compute, works even with a
    suspended warehouse.
50. **C — A materialized view.** Enterprise+ feature, Snowflake-maintained precomputed result,
    with real storage + maintenance cost.
51. **C — X-Small.** Max cluster count scales *inversely* with size: XS/S/M = 300, L = 160,
    XL = 80, 2XL = 40, 3XL/4XL/5XL/6XL = 10.
52. **B.** Snowflake's documented rule: `SELECT` on the table *plus* `USAGE` on its database and
    schema — the documented/tested answer, regardless of any edge-case behavior.
53. **B — A directory table.** A queryable metadata catalog of a stage's files.
54. **B — `QUALIFY`.** Purpose-built to filter directly on a window function's result without an
    extra wrapping subquery/CTE (e.g.
    `QUALIFY ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date DESC) = 1`).
55. **B.** Economy requires an estimated ≥6 minutes of queued work before starting a new
    cluster — a specific, quantified threshold, not "wait until full."
56. **B.** Nothing is copied or moved — the consumer queries the provider's storage directly,
    live.
57. **B.** Rows outside the allowed region simply don't exist in the result — row access
    policies restrict *which rows* are visible, not what a visible row shows.
58. **B.** A server-side encryption type/setting appropriate to the cloud provider.
59. **B.** Eligibility requires the scan to be large in *absolute* terms, not just a selective
    filter — verified hands-on: a 0.04%-selective filter over a ~1GB table still returned
    `NO_LARGE_ENOUGH_SCAN`.
60. **B — Standard Gen 2.** Newer compute generation, better price/performance, same warehouse
    type.
61. **B — Pipes and Sequences.** Both explicitly listed as database objects under 1.3; the other
    pairs are account-level objects, not database objects.
62. **B.** Snowflake genuinely rejects an out-of-list value — verified hands-on, not just
    advisory.
63. **B.** Snowpipe Streaming for true low-latency row push; a Task-scheduled `COPY INTO` for a
    fixed nightly batch.
64. **B.** A hard cost multiplier on the warehouse's own rate, not a performance dial —
    verified: 4 credits/hr × 5 = 20 additional credits/hr ceiling.
65. **B.** The user-level value, more specific than the account default, wins.
66. **B — A private listing.** Visible only to specifically named consumer accounts.
67. **B.** The column automatically inherits the masking behavior — verified hands-on: a column
    tagged *after* the policy was attached to the tag still got masked correctly.
68. **B.** Maintenance-cost estimation needs real observed history over time — verified
    hands-on: a brand-new table returned exactly this "table is too young" message.
69. **C — Git integration.** Repo-backed object deployment.
70. **C — Snowsight.** Browser-based, no local install.
71. **C — Tri-Secret Secure.** Business Critical+ only; the other three are Enterprise+ already.
72. **B.** Creating roles is an account-level privilege — verified hands-on: `CLAUDE_SANDBOX`
    (owning its own database/warehouse) was rejected with "must have CREATE ROLE granted on
    ACCOUNT."
73. **B.** Resharing is possible in some configurations, governed by the same grant model — not
    an automatic default.
74. **B.** Snowflake's own docs: any syntax difference, including a table alias, inhibits cache
    reuse — stricter than semantic-equivalence matching.
75. **B.** Temporary tables are scoped to the session that created them — verified hands-on: a
    fresh session couldn't see a temp table from a prior session at all.
76. **B — Trust Center.** A Snowsight security-posture dashboard.
77. **B — Cortex Search.** Semantic/RAG-style search over unstructured data.
78. **A — `AFTER <task>` chaining.** Lets one task trigger on another's successful completion.
79. **B.** Background reclustering/consolidation alone can invalidate the result cache, even
    with no logical data change — one of the documented, easy-to-miss invalidation conditions.
80. **B — Snowpark.** Compute-pushdown execution inside Snowflake, not pulled to a client.
81. **B.** Creating a Share is an account-level privilege — verified hands-on: the same
    `CLAUDE_SANDBOX` role was rejected identically for `CREATE SHARE` as it was for
    `CREATE ROLE`/`CREATE USER`.
82. **B — A network policy.** IP allow/block list at the account or user level.
83. **B.** `PURGE = TRUE` deletes staged files immediately after a successful load.
84. **B.** The warehouse cache only skips the remote-storage fetch — actual compute still runs
    and is billed, unlike a result-cache hit.
85. **C — Streamlit in Snowflake.** Build/host Python apps directly inside the account.
86. **B — `UNDROP TABLE`.** Restores exactly the pre-drop state — verified hands-on: a table
    restored via `UNDROP` retained its latest (not an older) version.
87. **B — Multi-Factor Authentication (MFA).** A second factor beyond password, for interactive
    human login.
88. **B.** Average relative error ≈1.62%, memory footprint small and roughly fixed (max ~4096
    bytes, typically ~32 bytes per group) regardless of cardinality — verified hands-on and
    against Snowflake's own docs.
89. **C — Time Travel and zero-copy cloning.** Officially filed under Domain 5 (Data
    Collaboration) in the exam guide, not Domain 1, despite feeling architectural.
90. **B.** Snowflake performs automatic reclustering in the background — no manual command
    needed.
91. **B.** Measuring by uncompressed data volume keeps row-count-per-partition predictable
    regardless of how compressible any specific dataset is — verified against Snowflake's own
    docs, which state the range is explicitly uncompressed.
92. **B — Organization name + account name.** The current recommended, human-readable,
    region/cloud-independent format.
93. **B — A Programmatic Access Token (PAT).** Sent as a static bearer token — fits a client
    that can't do per-request signing, unlike key-pair auth.
94. **C — `ROW_NUMBER() OVER (...)`.** A window function operates over a partition/order without
    collapsing rows; `SUM()`/`COUNT(DISTINCT)`/`APPROX_COUNT_DISTINCT()` are plain aggregates.
95. **B.** Multi-cluster warehouses require Enterprise edition or higher — fails outright on
    Standard.
96. **B — A Native App.** Ships running application logic/UI into the consumer's account, not
    just data access.
97. **C — `VALIDATION_MODE = RETURN_ERRORS`.** Previews load errors without actually loading
    data.
98. **B.** The metadata cache holds micro-partition-level row counts, summed without scanning
    actual data.
99. **B.** Reusable across multiple stages/`COPY INTO` statements without repeating the same
    options.
100. **B — Temporary.** Session-scoped, auto-dropped at session end — distinct from Transient,
     which persists beyond the session but skips Fail-safe.
