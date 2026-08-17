# Mock Exam 2 — Full-Length Practice Exam (100 Questions)

This exam mirrors the real COF-C03 domain weighting: **Domain 1 (Architecture & Features): 31,
Domain 2 (Account Mgmt & Governance): 20, Domain 3 (Data Loading/Unloading/Connectivity): 18,
Domain 4 (Performance & Transformation): 21, Domain 5 (Data Collaboration): 10** (100 questions
total). Questions are deliberately **not** grouped by domain block — they're interleaved
throughout, matching how the real exam mixes topics rather than blocking them.

Every question in this exam is new and original — it does **not** reuse any question from the
domain-authored practice files (`10`-`14`), from Mock Exam 1, or from any of the other mocks in
this series. All five mock exams are built to be mutually distinct: 500 different questions across
the 5 mocks, not one shared pool reused with different labels. Every question is framed as a
realistic architect-facing design or troubleshooting scenario rather than bare definitional recall,
and every technical claim was checked against the verified domain notes and, where useful, live
Snowflake documentation. Original content throughout — never sourced from or modeled on any
exam-dump/braindump site.

There's no official published ratio of single-choice to multiple-select questions on the real exam,
so this exam uses a reasonable, clearly-labeled mix rather than inventing a false ratio.

Take this closed-book, timed to 115 minutes, and log your score plus per-domain breakdown in
[06_Practice_Exam_Tracker.md](06_Practice_Exam_Tracker.md).

---

**1. [D1]** A healthcare analytics team is scoping a new Snowflake account. Their disaster-recovery requirement is cross-region replication with automatic failover, and nothing else exotic. Which is the *minimum* edition that satisfies just that DR requirement?

A. Standard
B. Enterprise
C. Business Critical
D. VPS

**2. [D2]** An architect is writing connection documentation for a new team and wants to hand out the current recommended account identifier format — human-readable and not tied to the underlying cloud region string. Which format should they use?

A. Account locator
B. Organization name + account name
C. A raw numeric account ID
D. An IP-based identifier

**3. [D3]** A team is staging files that were already encrypted client-side by the cloud provider before Snowflake ever reads them. What must the architect configure so Snowflake can correctly read/write that already-encrypted object?

A. Nothing — Snowflake ignores pre-existing encryption
B. The stage or `COPY` statement must specify the matching server-side encryption type/settings
C. The file must be manually decrypted before staging
D. A storage integration alone handles this automatically regardless of encryption type

**4. [D4]** An architect is deciding whether a nightly batch job that inserts a huge volume of new rows is a good Query Acceleration Service candidate. Which two general categories of query does QAS actually offload, per Snowflake's own documentation?

A. Small point lookups and DDL statements
B. Large scans with selective filters, and large-volume DML (INSERT/COPY/UPDATE/DELETE)
C. Any query using a window function
D. Queries that already hit the result cache

**5. [D5]** A compliance officer asks an architect what their recovery window looks like on Standard edition by default, and what it could be extended to if they upgraded to Enterprise. What's the accurate answer?

A. Default 7 days, max 30 days
B. Default 1 day, max 90 days
C. Default 0 days, max 7 days
D. Default 90 days, max unlimited

**6. [D1]** An account has been almost entirely idle on the compute side for a day — nearly all activity was lightweight `SHOW`/metadata queries and query compilation, with very little actual warehouse runtime to offset against. An architect reviewing the bill is surprised to see a nonzero Cloud Services charge for that day. Is that expected?

A. No — Cloud Services compute is always free regardless of warehouse usage
B. Yes — Cloud Services usage is only free up to 10% of that day's total warehouse (compute) credit consumption; with so little warehouse compute to offset against, the metadata-heavy activity crossed that threshold and got billed
C. No — Cloud Services is only ever billed on Business Critical edition and above
D. Yes, but only because resource monitors always bill Cloud Services separately

**7. [D2]** A security architect is reviewing role design and finds a custom role `REPORTING_ANALYST` granted directly to `ACCOUNTADMIN` instead of `SYSADMIN`. Why does the architect flag this as a violation of best practice?

A. It isn't a problem — granting custom roles to `ACCOUNTADMIN` is the documented best practice
B. Best practice grants custom/functional roles up to `SYSADMIN` (which owns warehouses/databases/most objects), preserving `ACCOUNTADMIN`'s narrow, tightly-controlled scope rather than diluting it with routine functional roles
C. It's a problem only because `REPORTING_ANALYST` should instead be granted directly to `PUBLIC`
D. It's a problem because `ACCOUNTADMIN` cannot legally have any roles granted to it

**8. [D3]** A team needs a shareable, role-grantable stage supporting a custom file format and a directory table, used by multiple engineers loading different file batches over time. Which stage type is the only one that supports all of these requirements together?

A. The user stage (`@~`)
B. The table stage (`@%table_name`)
C. A named internal stage, created explicitly via `CREATE STAGE`
D. An external stage pointed at cloud storage the team doesn't own

**9. [D4]** A warehouse is manually resized from Medium to Large mid-session to handle a temporary load spike, then resized back down afterward. A query that previously benefited from the warehouse's local disk cache on the same data runs again after the resize-and-back cycle. Does it still hit that local cache?

A. Yes — the local disk cache persists across any resize as long as the warehouse name doesn't change
B. No — the local (SSD) cache lives on that warehouse's specific physical compute nodes; resizing (or suspending) changes the underlying nodes, so the previously-warmed cache is lost and has to rebuild from remote storage again
C. Yes, but only the metadata cache persists, not the actual cached blocks
D. No, but only because resizing always clears the result cache too, which is unrelated to the local disk cache

**10. [D5]** A company on Standard edition wants to set up disaster-recovery capability where a secondary account's database copy can be promoted to primary if the primary region fails. What do they need to change first, and why?

A. Nothing — failover groups work on any edition
B. Upgrade to Business Critical edition or higher, since failover groups (which support promoting a secondary to primary) require Business Critical+ on both the primary and secondary accounts — plain replication (no promotion) is available on any edition, but promotion capability specifically is not
C. Upgrade to Enterprise edition, since that's sufficient for failover groups
D. Nothing beyond enabling a resource monitor on the secondary account

**11. [D1]** An architect is choosing a warehouse type for a routine BI/reporting workload and wants better price/performance without changing the declared size or switching to a specialized workload type. Which warehouse type should they pick?

A. Standard Gen 1
B. Standard Gen 2
C. Snowpark-Optimized
D. Multi-cluster Economy

**12. [D2]** A platform team wants their stored procedures' structured log and trace output to be queryable with ordinary SQL, not just visible in an ephemeral console. Which object should they configure to capture that?

A. `QUERY_HISTORY`
B. An event table
C. A resource monitor
D. `ACCOUNT_USAGE.LOGIN_HISTORY`

**13. [D3]** An engineer wants to programmatically list every file currently sitting in a stage — name, size, last-modified, file URL — without shelling out to the cloud provider's own console. What should they query?

A. A file format object
B. A directory table
C. Load history
D. A named stage's COPY history

**14. [D4]** A team enables QAS on their warehouse, but one otherwise-eligible, large-scan query calls `RANDOM()` in its `WHERE` clause and never gets accelerated. Why not?

A. QAS ignores function calls entirely
B. QAS excludes queries with nondeterministic functions like `RANDOM()` or `SEQ`
C. Randomness increases scan size, which disqualifies it
D. Eligibility only depends on table size, so this shouldn't matter

**15. [D5]** A consumer who received a share from Provider A wants to reshare that same data onward to Consumer B. An architect at Provider A is asked whether that's even possible. What's the accurate answer?

A. Never possible under any configuration
B. Possible in some configurations, governed by the same grant/privilege model — not automatic by default
C. Only Provider A itself can ever reshare
D. Only via a public Marketplace listing

**16. [D1]** A platform team is comparing Standard Gen2 against Snowpark-Optimized warehouses for a Python feature-engineering pipeline that regularly spills to local disk on a correctly-sized Standard Gen2 warehouse. Upsizing further helps but wastes credits on the pipeline's many lightweight steps. What's the better-targeted fix?

A. Switch to a Snowpark-Optimized warehouse, which provides more memory per node specifically for memory-intensive Snowpark/ML workloads, rather than simply upsizing a general-purpose Standard warehouse
B. Switch to Standard Gen1, which is cheaper per credit
C. Enable multi-cluster Economy scaling, since spilling is a concurrency problem
D. Enable Query Acceleration Service, since spilling is always a QAS-eligible symptom

**17. [D2]** A team needs a role responsible only for creating and managing users and their role memberships, explicitly without the ability to create or manage warehouses and databases. Which system-defined role matches that exact scope?

A. `SYSADMIN`
B. `SECURITYADMIN`
C. `USERADMIN`
D. `ORGADMIN`

**18. [D3]** A data platform team wants their external stage on an S3 bucket to avoid embedding a long-lived AWS access key and secret directly in the stage's `CREATE STAGE` statement, for security-review reasons. Which account-level object is the recommended mechanism to avoid this?

A. A network policy scoped to the S3 IP range
B. A storage integration, which holds a cloud IAM role/identity at the account level so the stage definition itself never contains embedded credentials
C. An API integration, since it's the general-purpose credential broker
D. A file format object with an encrypted credential field

**19. [D4]** A finance team's month-end aggregation over a large, slowly-changing table takes 40 seconds to recompute on every dashboard page load, run by dozens of users daily. The team is on Enterprise edition. What's the tradeoff-aware fix, and what ongoing cost does it introduce that a standard view wouldn't have?

A. A materialized view — Snowflake precomputes and automatically maintains the result, at the cost of real storage plus background maintenance credits every time the source data changes, which a standard view (recomputed live, no storage/maintenance cost) doesn't incur
B. A standard view is always sufficient, since Snowflake caches all view results automatically regardless of edition
C. A Dynamic Table with `TARGET_LAG = '0 seconds'`, since that has zero cost by definition
D. Search Optimization Service, since it also precomputes aggregation results

**20. [D5]** An analyst needs to see a table's exact contents immediately before a specific erroneous statement executed, and they already know that statement's query ID from `QUERY_HISTORY`. Which Time Travel clause form is the most precise fit, compared to guessing an absolute timestamp?

A. `AT(TIMESTAMP => '...')`, using their best estimate of when the bad statement ran
B. `BEFORE(STATEMENT => '<query_id>')`, which reconstructs the table's state immediately before that specific statement executed, identified exactly by its query ID
C. `AT(OFFSET => -3600)`, a rough one-hour-ago approximation
D. `UNDROP TABLE`, since it restores historical state

**21. [D1]** A capacity-planning architect wants to set `MAX_CLUSTER_COUNT` on a 2X-Large multi-cluster warehouse as high as Snowflake will allow for that size. What's the ceiling they'll hit?

A. 300
B. 160
C. 80
D. 40

**22. [D2]** A governance architect creates a tag with `ALLOWED_VALUES 'PUBLIC','INTERNAL','CONFIDENTIAL'` and later an analyst tries to assign `'SECRET'` to a column using that tag. What should the architect expect to happen?

A. Snowflake silently accepts any value
B. The assignment is rejected because `'SECRET'` isn't in the allowed list
C. The tag is auto-updated to include `'SECRET'`
D. Assignment always succeeds — `ALLOWED_VALUES` is documentation only

**23. [D3]** An architect notices bulk `COPY INTO` loads are slower than expected because source files are being produced as many tiny 2MB fragments. What file-size range should they aim for instead, for good load parallelism?

A. 1-10MB
B. 100-250MB
C. 1-2GB
D. Exactly 500MB, fixed

**24. [D4]** A cost-conscious architect sets `QUERY_ACCELERATION_MAX_SCALE_FACTOR` on a warehouse before enabling QAS broadly. What is that parameter actually capping?

A. How much the warehouse itself can auto-resize
B. An upper bound on how much additional serverless compute QAS can lease relative to the warehouse's own size
C. How many queries can run concurrently
D. The number of separate warehouses provisioned

**25. [D5]** An architect is deciding between a direct share and a Marketplace listing to distribute a dataset. What's the key structural difference that should drive the decision?

A. Direct shares are always paid; listings are always free
B. A direct share targets a specific named consumer account; a listing publishes more broadly (or to named accounts, for a private listing) for discovery
C. Direct shares require a reader account; listings never do
D. There is no meaningful difference

**26. [D1]** A session sets `ALTER SESSION SET QUERY_TAG = 'nightly_etl'`. A specific statement inside that session then runs with `ALTER STATEMENT SET QUERY_TAG = 'critical_load'` scoped just to it (a more specific, statement-level override). For that one statement, which tag takes effect, and why?

A. 'nightly_etl', because session-level settings always take precedence over anything more specific
B. 'critical_load', because the most specific level set in the parameter hierarchy wins over a broader one
C. Neither — setting a parameter at two levels for the same session causes an error
D. Both simultaneously, concatenated

**27. [D2]** A compliance officer asks whether Snowflake's access-control model lets a central security team unilaterally decide who can access every object account-wide, or whether object owners retain that decision individually. Which describes Snowflake's actual model?

A. Mandatory Access Control — a central authority decides access for every object, with owners having no say
B. Discretionary Access Control — each securable object has an owner (a role) who decides who else gets access via grants, not a single central authority
C. Attribute-Based Access Control — access is computed dynamically from user/resource attributes at query time
D. There is no consistent model — it varies by object type

**28. [D3]** A team re-runs an unmodified `COPY INTO` command against the same stage the next morning, expecting no new data to load since nothing changed. Snowflake correctly skips reloading the already-loaded files. What underlying mechanism makes this idempotent by default, and for how long does it apply?

A. A manually-maintained log table the team must query and clear themselves
B. Snowflake's own load-history tracking, by file name plus checksum, retained for 64 days — files matching an already-recorded name+checksum are treated as already loaded and skipped
C. COPY INTO always deletes files after loading, so there's nothing left to reload
D. A resource monitor blocks reloading files that were loaded within the last 24 hours

**29. [D4]** A VARIANT column named event_payload stores nested JSON with an array field named tags per event. An analyst needs one output row per (event, tag) pair to compute tag-level metrics. Which function is purpose-built to explode that nested array into multiple rows?

A. `OBJECT_CONSTRUCT()`, which builds nested objects rather than exploding them
B. `FLATTEN()`, used typically via `LATERAL FLATTEN(input => event_payload:tags)` to produce one output row per array element
C. `ARRAY_AGG()`, which aggregates rows into an array — the reverse operation
D. `APPROX_COUNT_DISTINCT()`, which only counts distinct values, not exploding arrays

**30. [D5]** A provider's database lives in an AWS account in one region; a prospective consumer's account is on Azure in a different region entirely. The provider tries a standard direct share the same way they would within the same cloud/region, and it doesn't behave as expected. What's the underlying reason, and the necessary extra step?

A. Direct sharing works identically across any cloud/region combination; the provider must have made a configuration mistake
B. Secure Data Sharing works directly only within the same cloud region/provider, since the consumer queries the provider's storage location live; the data must first be replicated into an account in the consumer's own region/provider before a direct share (or listing) can be set up from there
C. Cross-cloud sharing requires the consumer to use a reader account instead, which is the only bridge between providers
D. Cross-cloud direct shares are only possible through a Native App, never through direct sharing

**31. [D1]** An architect enables multi-cluster on a brand-new Large warehouse but sets no explicit `MAX_CLUSTER_COUNT`. What is the actual out-of-the-box maximum cluster count they get, regardless of the 160 ceiling that size permits?

A. The size-based ceiling automatically (160)
B. 10
C. 1
D. Unlimited

**32. [D2]** To avoid re-attaching a masking policy to every new PII column by hand, an architect instead attaches it once to a tag via `ALTER TAG ... SET MASKING POLICY`. Six months later, a new column is tagged with that same tag. What happens to that new column?

A. Nothing — masking must be attached to each column individually
B. It automatically inherits the masking behavior from the tag
C. The tag assignment fails, since the tag already has a policy attached
D. The originally-tagged columns lose their masking

**33. [D3]** A junior engineer runs a `COPY INTO` with no `ON_ERROR` clause specified at all, and it hits one malformed row on file 3 of 10. What should the architect expect happened to the whole load?

A. Only that one row was skipped — `CONTINUE` is the default
B. Only file 3 was skipped — `SKIP_FILE` is the default
C. The entire load aborted — `ABORT_STATEMENT` is the default
D. Snowflake auto-triggered `VALIDATION_MODE`

**34. [D4]** Before enabling QAS account-wide, an architect wants hard evidence on a specific already-run query — would it actually have benefited, and at what scale factor? Which function should they call?

A. `SYSTEM$ESTIMATE_SEARCH_OPTIMIZATION_COSTS`
B. `SYSTEM$ESTIMATE_QUERY_ACCELERATION`
C. `SYSTEM$CLUSTERING_INFORMATION`
D. `QUERY_HISTORY`

**35. [D5]** Two competing retailers want to jointly analyze combined transaction data to measure overlap in customers, but neither will accept the other seeing their raw row-level data. What Snowflake pattern should the architect propose?

A. A public Marketplace listing
B. Data Clean Rooms, built on secure views/UDFs plus governance controls
C. A reader account
D. Standard Secure Data Sharing with no additional controls

**36. [D1]** A team needs Time Travel extended up to 90 days on a permanent table, but their account is currently on Standard edition, which defaults to 1 day and doesn't support the extended window. Which edition is the minimum required to configure `DATA_RETENTION_TIME_IN_DAYS` up to 90 for a permanent table?

A. Standard, with a manual override flag
B. Enterprise
C. Business Critical
D. VPS only

**37. [D2]** An automated CI/CD service account needs to connect to Snowflake with no interactive login step and no password stored anywhere in the pipeline configuration. Which authentication method is the standard fit, and why?

A. Password authentication with a strong, rotated password stored as a CI secret
B. Key-pair authentication, since it requires neither a password nor any interactive/MFA step, and is the conventional choice for service/programmatic accounts
C. SSO/SAML2 federated authentication, since it requires no local credentials at all
D. MFA via Duo, since it's Snowflake's strongest authentication option

**38. [D3]** A file that was already successfully loaded is later modified (same file name, different content) and re-staged. The team re-runs the same `COPY INTO` command. Does Snowflake's checksum-based load-history tracking reload this file, given the file name matches a prior load?

A. No — matching file name alone is enough to skip the file regardless of content changes
B. Yes — load history is tracked by file name *plus* checksum together, so a changed checksum under the same file name is treated as a new, not-yet-loaded file and gets reloaded
C. Only if `PURGE = TRUE` is also specified
D. Only if the file is renamed first, since Snowflake can't detect content changes under an unchanged name

**39. [D4]** A company runs both a latency-sensitive executive dashboard and a set of long-running, resource-heavy ad-hoc analyst queries. Both currently share one warehouse, and dashboard users complain of inconsistent load times whenever an analyst kicks off a heavy query. What's the recommended architectural fix, as a workload-management best practice, before reaching for a more exotic feature like QAS?

A. Enable Query Acceleration Service on the shared warehouse instead of separating workloads, since QAS is designed to solve exactly this contention
B. Separate the two workloads onto their own dedicated warehouses, so the heavy ad-hoc analyst queries no longer queue out or contend with the latency-sensitive dashboard queries sharing the same compute
C. Disable auto-suspend on the shared warehouse so it's always warm for the dashboard
D. Increase MAX_CLUSTER_COUNT on the shared warehouse without changing anything else about workload separation

**40. [D5]** A provider wants to distribute a dataset to a partner organization that has no Snowflake account of its own and has no plans to sign up for one. Which mechanism lets the provider make the data accessible anyway, with the provider bearing the compute cost on the recipient's behalf?

A. A direct share, since it works for any recipient regardless of whether they have an account
B. A reader account — a special account type the provider creates and pays the compute for, specifically for consumers without their own Snowflake account
C. A public listing, since anyone can access a public listing without an account
D. A Native App, since it doesn't require the consumer to have an account either

**41. [D1]** A cost-conscious team runs a Small warehouse (2 credits/hr) for ad-hoc queries; a typical session resumes, runs a 20-second query, then auto-suspends. Roughly how many credits does one such session cost, given Snowflake's per-second billing model?

A. Exactly 2 credits (a full hour)
B. ~0.011 credits (billed for the actual 20 seconds only)
C. ~0.033 credits (the 60-second minimum applies since actual usage was under it)
D. Zero credits, since it suspended almost immediately

**42. [D2]** A security team wants one central Snowsight dashboard surfacing posture-scanner findings and risk recommendations across the whole account, instead of hunting through several separate views. What should they open?

A. Trust Center
B. Query Profile
C. Resource Monitors
D. Data lineage

**43. [D3]** A stage holds files for a dozen different source systems, but tonight's load should only pick up the ones matching a specific naming convention. Which `COPY INTO` option lets an architect filter by file path/name?

A. `VALIDATION_MODE`
B. `PATTERN`
C. `ON_ERROR`
D. `FORCE`

**44. [D4]** Right after running `ALTER TABLE ... ADD SEARCH OPTIMIZATION`, an architect immediately benchmarks a qualifying point-lookup query and sees no improvement. What's the most likely explanation, and where should they check?

A. Search optimization only applies on the next full table rebuild
B. It builds asynchronously in the background; they should check `search_optimization_progress` in `SHOW TABLES` before benchmarking
C. The feature requires a manual `REFRESH` command they forgot to run
D. It only ever applies the first time a qualifying query runs, retroactively

**45. [D5]** A data vendor wants to distribute a dataset only to a named consortium of partner accounts, not the general public, while still getting listing-style discovery mechanics (versioning, auto-fulfillment) instead of a one-off manual share. Which mechanism fits?

A. A public listing
B. A private listing
C. A reader account
D. A Native App is required for this

**46. [D1]** A data engineering lead wants their team to train a fraud-detection model and manage its full lifecycle — feature engineering, training, versioned registry — without ever exporting the underlying transaction data out of Snowflake to a separate ML platform. Which feature is purpose-built for this, as distinct from the general-purpose compute-pushdown framework it's often built on top of?

A. Snowpark alone, since it's the general execution framework
B. Snowflake ML, which layers feature-store/training/model-registry lifecycle management on top of in-platform compute
C. Streamlit in Snowflake, for visualizing the model's predictions
D. Cortex Analyst, since it's Snowflake's other AI-branded feature

**47. [D2] (Select TWO)** (Select TWO) A platform team is deciding whether to grant privileges via a database role instead of a standard account role for a dataset that will eventually be shared into another account. Which two statements about database roles are accurate?

A. A database role's granted privileges are scoped to objects within a single database only
B. A database role is automatically activated as a secondary role in every session, with no configuration needed
C. A database role can be granted to an account role, letting its privileges travel with the database into a share or a replication target
D. A database role permanently replaces the need for the `USERADMIN` system role

**48. [D3]** A team needs to ingest rows from a continuous Kafka topic with sub-second to low-second end-to-end latency, pushing data directly rather than first landing files in a stage. Which ingestion approach fits, as distinct from file-based Snowpipe?

A. A scheduled Task running `COPY INTO` every minute
B. Snowpipe Streaming, which pushes rows directly without a staging step, achieving sub-second to low-second latency instead of Snowpipe's file-based micro-batch latency
C. A Dynamic Table with a very short target lag
D. An external table with automatic metadata refresh

**49. [D4]** A Query Profile shows one operator spilling a very large volume of bytes to remote (not local) storage. How should an architect interpret the severity of remote spilling compared to local spilling, and what's the implication for warehouse sizing?

A. Remote spilling is less severe than local spilling, since remote storage is more durable
B. Remote spilling is worse than local spilling — it means the warehouse ran out of both memory and local disk for that operation, pointing to an even more significant undersizing (or query-rewrite) need than local-only spilling would indicate
C. Remote vs. local spilling makes no practical difference to query performance
D. Remote spilling only happens on multi-cluster warehouses, never single-cluster ones

**50. [D5]** A provider wants to share a proprietary scoring calculation as reusable, callable logic with a consumer account, without exposing the underlying formula the consumer could otherwise inspect via the object's definition. Beyond a secure view (which protects query logic, not a callable function), what object type protects a shared function's definition the same way?

A. A secure UDF, whose definition is hidden from consumers without privilege to see it, the same protection a secure view provides for query logic
B. A plain UDF, since function definitions are always private by default
C. A Stream, since it can encapsulate transformation logic
D. A masking policy applied to the function's output

**51. [D1]** An architect configures a multi-cluster warehouse on the Economy scaling policy to hold costs down during off-peak hours. At what point will Snowflake actually mark one of its running clusters for shutdown?

A. Immediately once it goes idle
B. When estimated remaining queued work drops below 6 minutes
C. After exactly 10 minutes with no queries
D. Only when MAX_CLUSTER_COUNT is lowered manually

**52. [D2]** A prospective customer on Standard edition asks an architect whether their data will be encrypted at rest and in transit without buying up to a higher tier. What's the accurate answer?

A. No — encryption at rest requires Business Critical and above
B. No — encryption at rest requires Enterprise and above
C. Yes — encryption at rest/in transit is automatic on every edition, including Standard
D. Only if Tri-Secret Secure is explicitly enabled

**53. [D3]** Before a risky production load, an architect wants to know exactly what would happen — including which rows would error — without actually committing any data. Which option enables that dry run?

A. `PATTERN`
B. `FORCE`
C. `VALIDATION_MODE`
D. `PURGE`

**54. [D4]** A support-ticket lookup table gets exact-ID lookups, substring searches on ticket titles, and geospatial filters on incident coordinates. An architect is evaluating whether Search Optimization Service covers all three patterns. What does Snowflake's own documentation say it supports?

A. Only exact-equality predicates
B. Equality, IN-list, substring/regex (LIKE/RLIKE), NULL checks, geospatial, and semi-structured VARIANT/OBJECT/ARRAY lookups
C. Only range-scan predicates like `BETWEEN`
D. Only JOIN predicates

**55. [D1]** A team needs a queryable, cross-engine-interoperable table where both Snowflake and an external Spark job can read and write the same underlying files in an open table format, without Snowflake being the sole owner of the data's format. Which table type is purpose-built for this?

A. A standard permanent table
B. An Apache Iceberg table
C. An External table
D. A Dynamic Table

**56. [D2]** A user's primary role is `ANALYST`, and they need the combined privileges of both `ANALYST` and `REPORTING_VIEWER` active at once in the same session, without ever running a `USE ROLE` switch mid-session. Which feature achieves this, and what's the resulting effective privilege set?

A. Database roles, which auto-combine with the primary role
B. Secondary roles (`USE SECONDARY ROLES ALL`) — the session's effective privileges become the union of the primary role plus every active secondary role
C. Object tagging, applied to the session itself
D. A network policy scoped to both roles

**57. [D3]** A team's Snowflake CLI-managed deployment project is currently stored as a local ZIP uploaded manually before each release. They want deployments to instead pull source directly from a version-controlled repository whenever a release runs, without a separate CI artifact-copy step. Which Snowflake feature connects an account directly to that repository?

A. A storage integration, since deployment artifacts are technically files
B. A Git integration, which connects a Snowflake account directly to a Git repository so CLI-managed projects and Native App source can deploy straight from the repo
C. An API integration, since it's the general-purpose external-connectivity object
D. A file format object configured for source-code files

**58. [D4]** An architect compares two Query Profiles for the same recurring report: today's run scans 90% of the table's micro-partitions despite a selective filter, while a run from last month (before a recent large batch of new data landed unsorted) scanned only 15%. What single change most plausibly explains the regression, and what's the standard fix for a large, frequently-filtered table like this?

A. The warehouse must have been resized down between the two runs
B. New data landed without preserving co-location on the filtered column, degrading clustering quality over time; defining (or verifying) a clustering key on that column is the standard fix for a large, frequently-filtered table
C. The result cache expired, which always causes a full table scan on the next run
D. Search Optimization Service must have been disabled between runs

**59. [D1]** A warehouse is configured with `MAX_CLUSTER_COUNT = 50` under the Standard scaling policy to absorb a monthly reporting spike. When that spike hits, what's true about how new clusters can start?

A. Only one cluster can ever start at a time, regardless of MAX_CLUSTER_COUNT
B. Multiple clusters can start simultaneously if the estimated shortfall calls for it
C. Clusters only start once per hour
D. This configuration isn't legal above 10

**60. [D2]** A data-quality team wants a scheduled SQL condition check that automatically fires a notification the moment a threshold is breached, without them having to poll a dashboard. Which object type fits?

A. A Task
B. An Alert
C. A Stream
D. A resource monitor

**61. [D3]** A dynamic table sits in the middle of a multi-stage transformation chain, and the architect wants its own refresh cadence to be driven by the freshness needs of the dynamic tables that consume it downstream, rather than a fixed duration. Which `TARGET_LAG` setting achieves that?

A. A fixed interval like `'5 minutes'`
B. `DOWNSTREAM`
C. `0 seconds`
D. It's not configurable — target lag is always a fixed duration

**62. [D4]** A junior engineer proposes adding a clustering key to a small lookup table (a few thousand rows) that's rarely filtered on that column, believing it can only help. What should the architect warn them about?

A. Guaranteed significant performance improvement
B. Little to no benefit, plus needless ongoing reclustering credit cost
C. The table becomes read-only once clustered
D. Clustering keys are rejected outright on small tables

**63. [D1]** A reporting team wants an expensive, frequently-run aggregation kept automatically fresh by Snowflake without any hand-written refresh scheduling, but their account is on Standard edition, which doesn't support Materialized Views. Which feature still lets them achieve automatic, declarative freshness on a target table, independent of the Materialized View edition gate?

A. A Dynamic Table with a target lag
B. A standard view, since it always re-runs live
C. A Transient table with a scheduled Task
D. Query Acceleration Service

**64. [D2]** A finance team needs full-precision Social Security Numbers visible only to the `PII_ADMIN` role, with every other querying role seeing a masked form (e.g. `XXX-XX-1234`), while maintaining a single physical copy of the underlying data. Which mechanism is purpose-built for this exact requirement?

A. A row access policy, since it restricts row-level visibility
B. Dynamic Data Masking, via a masking policy attached to the column that renders differently depending on the querying role, evaluated at query time against one underlying copy of the data
C. Object tagging alone, without any policy attached
D. A privacy (aggregation) policy, since it also touches sensitive columns

**65. [D3]** An external function needs to call a third-party HTTP API endpoint from inside a SQL statement, without the calling role or the function definition ever containing the API's credentials directly. Which integration type authorizes this outbound call securely?

A. A storage integration, since it's the general external-connectivity object
B. An API integration, which authorizes Snowflake to call the external HTTP endpoint without embedding credentials inline
C. A Git integration, since it also connects to external systems
D. A file format object configured with an authorization header

**66. [D4]** A recurring analytical query on a multi-terabyte table takes disproportionately long compared to the rest of the workload sharing its warehouse, but resizing the warehouse permanently would waste credits on the other, much lighter queries also running there. What's the targeted fix that avoids resizing the shared warehouse?

A. Enable Query Acceleration Service, which offloads the eligible portions of just that outlier query to additional serverless compute, without resizing the warehouse for every other query sharing it
B. Add a clustering key, since that always fixes disproportionate runtime regardless of the underlying symptom
C. Switch the entire warehouse to Snowpark-Optimized
D. Disable auto-suspend on the warehouse

**67. [D1]** A new hire is being onboarded onto a Snowflake account and asks an architect to explain the containment hierarchy so they know where to create their first schema. What's the correct top-to-bottom order?

A. Account → Organization → Database → Schema
B. Organization → Account → Database → Schema
C. Organization → Database → Account → Schema
D. Database → Schema → Organization → Account

**68. [D2]** An architect has just built an Alert that should email the on-call team when it fires. Which object still needs to be configured to define that outbound email channel?

A. A storage integration
B. A notification integration
C. An API integration
D. A network policy

**69. [D3]** A streaming-platform team wants their Kafka topic data to land in Snowflake with the target tables and load objects auto-provisioned, rather than hand-building pipes and tables themselves. Which connector should they adopt?

A. The Spark connector
B. The Kafka connector
C. The Python connector
D. The JDBC driver

**70. [D4]** Two dashboards issue logically-identical queries, but one dashboard's SQL generator happens to alias a table in lowercase while the other uses uppercase. An architect expects the second to hit the first's result-cache entry — should it?

A. Yes — the cache is based on logical equivalence
B. No — any syntax difference, including aliasing or casing, prevents 100% cache reuse
C. Only if both ran on the same warehouse
D. Only on Enterprise+ editions

**71. [D1]** An architect needs to know, for a given session, which warehouse is actively bound to that session (so a stored procedure can branch logic based on it), as distinct from which user is logged in or which role is active. Which function returns that specific piece of session context?

A. `CURRENT_USER()`
B. `CURRENT_ROLE()`
C. `CURRENT_WAREHOUSE()`
D. `CURRENT_ACCOUNT()`

**72. [D2]** A governance architect wants a guarantee that queries against a sensitive customer table can never return fewer than 50 rows aggregated together — never individual row-level detail — no matter how creatively a caller writes their SQL (subqueries, joins, filters). Which feature enforces that guarantee at the query-execution level rather than relying on careful query-writing discipline?

A. A masking policy on each sensitive column
B. A row access policy limiting which rows are visible
C. A privacy (aggregation) policy, which enforces a minimum group size on query results regardless of how the query is structured
D. Object tagging combined with a data classification label

**73. [D3]** Before a scheduled production load window, an engineer wants to know exactly what a `COPY INTO` statement would report — including which specific rows would fail and why — without committing a single row to the target table, so any format issues can be fixed ahead of time. Which option achieves this dry run?

A. `FORCE = TRUE`, since it forces the load to run in a safe mode
B. `VALIDATION_MODE`, which runs the load logic and reports what would happen (including row-level errors) without actually loading any data
C. `PATTERN`, since it filters which files would be considered
D. `PURGE = TRUE`, since it previews file cleanup

**74. [D4]** A support-lookup table gets frequent exact-match queries on a `ticket_id` column that has high cardinality and no natural clustering benefit (lookups are effectively random across the whole table). An architect is deciding between a clustering key and Search Optimization Service. Which is the better-targeted choice, and why?

A. A clustering key, since it always outperforms Search Optimization Service
B. Search Optimization Service, since it's purpose-built for highly selective point-lookup/equality queries on columns that don't naturally benefit from clustering — a different lever from clustering keys, which help range scans/large filtered scans instead
C. Neither — point lookups can't be accelerated by any Snowflake feature
D. A materialized view, since it precomputes lookup results

**75. [D1]** An architect is debugging why a session's query timeout doesn't match either the account default or what a user swears they set. Which order correctly reflects Snowflake's parameter hierarchy from broadest to most specific, so the architect knows which level to check last (and which wins)?

A. Session → User → Account → Object
B. Account → User → Session → Object
C. Object → Session → User → Account
D. User → Account → Object → Session

**76. [D2]** A governance team wants to answer "which downstream tables and views depend on this source table" without asking every team to manually document their pipelines. Which Snowsight feature answers that automatically?

A. Data lineage
B. Trust Center
C. Query Profile
D. A resource monitor

**77. [D3]** A platform team wants Snowflake CLI-managed projects and their Native App source to deploy straight from a version-controlled repository, without a separate CI artifact-copy step. Which integration should the architect set up?

A. API integration
B. Storage integration
C. Git integration
D. A file format object

**78. [D4]** A team is puzzled that a dashboard query stops hitting the result cache overnight even though no user touched the underlying table. An architect investigates and finds automatic background reclustering ran on it. Does that alone explain the cache miss?

A. No — reclustering doesn't change logical row content, so the cache should still be valid
B. Yes — reclustering/partition consolidation alone invalidates the result cache, even with no logical data change
C. Only the metadata cache would be affected, not the result cache
D. Reclustering has no relationship to caching at all

**79. [D1]** A support engineer wants to summarize a long customer-support transcript, translate a product description into another language, and classify incoming tickets by category — all directly from SQL, without standing up a separate ML pipeline. If they studied from slightly older material, which naming convention should they now expect Snowflake's current Cortex AI SQL functions to use?

A. The functions are still only accessible as `SNOWFLAKE.CORTEX.*` fully-qualified calls with no other naming option
B. Snowflake GA'd a renamed, `AI_`-prefixed set of these functions (e.g. `AI_SUMMARIZE_AGG`, `AI_TRANSLATE`, `AI_CLASSIFY`) in November 2025, superseding the older bare `SUMMARIZE`/`TRANSLATE`/`SENTIMENT` naming
C. These three capabilities were removed from Cortex entirely and replaced by Cortex Analyst
D. Only Cortex Search covers summarization and classification; AI SQL functions only handle translation

**80. [D2]** A resource monitor is nearing its configured quota and its three threshold actions all fire in sequence as usage climbs. In what order, from least to most disruptive to already-running queries, do Notify, Suspend, and Suspend Immediately actually apply?

A. Suspend Immediately, then Suspend, then Notify
B. Notify (just alerts, no effect on running or new queries), then Suspend (running queries finish, no new queries start), then Suspend Immediately (running queries are killed too)
C. Suspend, then Suspend Immediately, then Notify
D. All three apply simultaneously with no meaningful ordering

**81. [D3]** A team is loading Avro files where the producing system occasionally adds a new optional field to the schema between batches (schema evolution). Loading into a `VARIANT` column, does this kind of upstream schema drift typically break the load, and why or why not?

A. Yes — any schema change in the source Avro file always breaks the load and requires a new FILE FORMAT object
B. No — since the data lands in a flexible VARIANT column rather than being mapped to fixed relational columns at load time, an added optional field is simply captured as part of the semi-structured value, without requiring a target schema change
C. Yes, but only for Avro specifically — Parquet and JSON are immune to this issue
D. No, but only if PURGE = TRUE is also specified

**82. [D4]** A team observes that an identical query, run twice in a row with no data changes in between, does NOT hit the result cache the second time. Investigation shows automatic background reclustering ran on the underlying table between the two runs, with no user-initiated data change. Does that fully explain the cache miss?

A. No — reclustering can't affect the result cache since it doesn't change any row's logical value
B. Yes — background reclustering/partition consolidation alone invalidates the result cache, even though no logical data value changed, because the underlying micro-partitions themselves changed
C. No — only the metadata cache would be affected by reclustering, never the result cache
D. Yes, but only if the reclustering was manually triggered rather than automatic

**83. [D1]** A stored procedure needs to branch its logic based on which role is currently active in the calling session — not the procedure owner's role. Which function should it call?

A. `CURRENT_WAREHOUSE()`
B. `CURRENT_ROLE()`
C. `CURRENT_USER()`
D. `CURRENT_ACCOUNT()`

**84. [D2]** A FinOps architect wants a single resource monitor to track and cap combined credit usage across three separate warehouses used by one team, rather than building three separate monitors. Is that possible?

A. No — a resource monitor only ever tracks a single warehouse
B. Yes — a resource monitor can be attached to one or more warehouses
C. Only if the three warehouses are merged into one
D. Only on Business Critical and above

**85. [D4]** An architect needs a rough distinct-customer count over a multi-billion-row clickstream table for a dashboard tile, where exact precision isn't required and an exact `COUNT(DISTINCT)` is too slow/expensive at that scale. What should they reach for, and why is it cheaper?

A. `COUNT(DISTINCT)` — no alternative exists
B. `APPROX_COUNT_DISTINCT`, based on HyperLogLog
C. `SUM(DISTINCT)`, a Snowflake-specific extension
D. `QUALIFY`, applied to a count

**86. [D1]** A team needs a warehouse for a BI/reporting workload with unpredictable concurrency spikes throughout the business day, and wants Snowflake to add compute capacity for that spike as promptly as possible even before a real queue forms, accepting higher cost as the tradeoff. Which scaling policy fits, and what's its actual trigger mechanism?

A. Economy — starts a cluster once there's an estimated 6 minutes of queued work
B. Standard — starts a new cluster the moment a query actually queues, or as soon as Snowflake estimates existing clusters won't have enough resources for additional incoming queries, proactively before a queue even forms
C. Neither — scaling policies only apply to single-cluster warehouses
D. Economy — always keeps every configured cluster running regardless of load

**87. [D2]** A security architect is deciding how to protect a fleet of service accounts running scheduled ETL jobs, given that account-level network policies apply broadly to everyone. If a specific service account needs a tighter IP allow-list than the rest of the account, which level should the architect configure, and what happens if both levels are set for that user?

A. Only account-level policies exist; per-user restriction isn't possible
B. A user-level network policy on that service account — user-level policies override the account-level policy for that specific user, letting it have a tighter allow-list than everyone else
C. Both levels always apply simultaneously and the connection is rejected if either one blocks it
D. The account-level policy always wins regardless of any user-level policy

**88. [D4]** An architect needs a rough estimate of distinct customers touching a multi-billion-row event table for a real-time dashboard tile, where sub-1% estimation error is acceptable and query cost/latency matters far more than exact precision. Beyond just being 'approximate,' what specific algorithm underlies the recommended function for this, and why does that make it cheaper than an exact count?

A. `COUNT(DISTINCT)`, which is already efficient enough at any scale
B. `APPROX_COUNT_DISTINCT`, based on the HyperLogLog algorithm — a probabilistic sketch that estimates cardinality using bounded memory, avoiding the need to actually materialize and compare every distinct value the way an exact COUNT(DISTINCT) must
C. `SUM(DISTINCT)`, which uses a similar sketch-based algorithm
D. There is no algorithmic difference; APPROX_COUNT_DISTINCT is just COUNT(DISTINCT) run on a random sample

**89. [D1]** A knowledge-management team wants employees to type natural-language questions and get back the most relevant internal document passages, to feed into a downstream summarization step. Which Cortex sub-feature is purpose-built for that retrieval step?

A. Cortex Analyst
B. Cortex Search
C. AI SQL functions
D. Snowflake ML

**90. [D4]** A dashboard runs a window-function query to rank each customer's orders by date and needs only the single most recent order per customer in the final result — no other ranks. Rewriting with a wrapping subquery just to filter `WHERE rn = 1` works but adds unnecessary query complexity. Which Snowflake-specific SQL feature avoids the extra wrapping layer entirely?

A. `FLATTEN()`, applied to the ranked result
B. `QUALIFY`, which filters directly on a window function's result in the same query, without an extra wrapping subquery or CTE
C. `MERGE`, since it can conditionally filter rows
D. `APPROX_COUNT_DISTINCT`, applied per customer

**91. [D1]** A governance-minded architect is enumerating every object type explicitly recognized under Snowflake's object hierarchy (Domain 1.3) so nothing gets missed in an access-review script. Which pairing below correctly identifies two object types from that list that are easy to forget alongside the obvious ones (Tables, Views, Stages)?

A. Warehouses and Organizations, since both sit above the database level
B. Sequences (auto-incrementing number generators) and ML models (registered model objects from Snowflake ML)
C. Roles and Users, since access control objects are part of the object hierarchy list
D. Resource Monitors and Network Policies, both account-level governance objects

**92. [D1]** A data scientist wants an interactive, cell-by-cell Python/SQL development environment for exploring a dataset and iterating on a model, running directly against Snowflake compute — not a polished dashboard meant for other people to open later. Which feature fits that exploratory-development use case, as distinct from an app-hosting feature?

A. Streamlit in Snowflake
B. Snowflake Notebooks
C. Cortex Analyst
D. Snowflake CLI

**93. [D1]** A 3X-Large warehouse is configured with the maximum `MAX_CLUSTER_COUNT` Snowflake allows for that specific size. What is that ceiling, and why is it lower than a Large warehouse's ceiling despite being a bigger warehouse?

A. 20 — because max cluster count scales inversely with warehouse size, since Snowflake bounds total aggregate compute (size × cluster count), not cluster count alone
B. 160 — the same ceiling as Large, since ceilings only change at the 2X-Large boundary
C. 300 — every warehouse size shares the same ceiling
D. 10 — the ceiling never changes regardless of configuration

**94. [D1]** An engineering team wants to write their transformation logic in Python and have it execute inside Snowflake's own compute, rather than pulling data out to a client process to run the same logic. Which feature should the architect point them to?

A. Snowflake ML
B. Snowpark
C. Cortex
D. SnowSQL

**95. [D1]** A developer needs to write and iterate on SQL from inside their existing code editor's own window, with inline autocomplete and the ability to run Snowpark code against the same session, rather than switching to a browser tab or a separate terminal application. Which tool category fits best?

A. Snowsight, since it has the most features
B. SnowSQL, the terminal-based CLI client
C. An IDE integration, such as the official VS Code extension
D. Snowflake CLI (`snow`), since it also supports Snowpark project management

**96. [D1]** An architect needs a scratch table for an ETL job's intermediate results that should vanish automatically the moment the session ends, with no manual cleanup step. Which table type fits?

A. Transient
B. Temporary
C. External
D. Permanent

**97. [D1]** An architect is deciding between a Secure View and a plain Standard view for a dataset that will eventually be shared outside the account. What specific protection does the Secure variant add that a Standard view lacks?

A. Secure views execute faster than standard views on identical queries
B. Secure views hide the view's own definition from consumers without privilege to see it, preventing logic reverse-engineering or row-leakage via specially-crafted queries against the underlying base tables
C. Secure views are the only view type that can be defined over more than one base table
D. Secure views automatically apply a masking policy to every column

**98. [D1]** A reporting team wants a view over a rarely-queried table, with zero ongoing storage or maintenance cost, that simply re-runs its defining query every time someone references it. Which view type matches that requirement exactly?

A. Materialized view
B. Secure view
C. Standard view
D. Dynamic view

**99. [D1]** A team wants to explore and iterate on a dataset cell-by-cell in Python and SQL, running directly against Snowflake compute, before eventually productionizing the logic — not to publish a finished dashboard for other business users to open. Which feature matches this exploratory, not-yet-productionized use case?

A. Streamlit in Snowflake, for hosting the finished app
B. Snowflake Notebooks, for interactive cell-by-cell exploratory development
C. Cortex Analyst, for natural-language querying
D. Snowflake CLI, for terminal-based scripting

**100. [D1]** An automation engineer is scripting a CI pipeline that needs to run SQL from a terminal with no browser involved, and wants to use whichever CLI tool Snowflake's current documentation treats as the modern path (an older equivalent tool still exists but isn't the featured one). Which should they reach for?

A. SnowSQL
B. Snowflake CLI (`snow`)
C. Snowsight
D. The VS Code extension

---

## Answer Key & Explanations

1. **C — Business Critical.** Replication/failover for DR is a Business Critical+ feature, same tier as Tri-Secret Secure and HIPAA/PCI support.
2. **B — Organization name + account name.** Organization name + account name is the current recommended, human-readable identifier format, replacing the older region-coupled account locator style for new connections.
3. **B.** Server-side encryption settings must be explicitly matched on the stage/COPY definition so Snowflake can correctly read an already-encrypted object.
4. **B.** Per Snowflake's own QAS documentation, the two eligible categories are large, selective scans and large-volume DML operations.
5. **B — Default 1 day, max 90 days.** Standard edition's default retention is 1 day (24 hours), automatically enabled; Enterprise+ permanent objects can be configured up to 90 days.
6. **B.** Cloud Services usage is billed only for the portion exceeding 10% of that day's total warehouse compute credits. A day with unusually little warehouse runtime but heavy metadata/compilation activity can genuinely cross that 10% threshold and produce a real (if usually rare) Cloud Services charge.
7. **B.** Best practice keeps `ACCOUNTADMIN` narrowly scoped to a small number of trusted administrators by routing custom/functional roles up through `SYSADMIN` instead — granting routine functional roles directly to `ACCOUNTADMIN` dilutes that intentional narrowness without a good reason.
8. **C.** Only a named internal stage supports custom file formats, directory tables, and role-based sharing across multiple users — user and table stages are single-purpose, tied to one user or one table respectively, and not shareable in the same way.
9. **B.** The warehouse-local (SSD) cache lives on the specific physical compute nodes backing that warehouse at a point in time; a resize (or suspend/resume) swaps out those underlying nodes, so the previously-warmed local cache is lost and needs to rebuild from remote storage on subsequent access — distinct from the Cloud-Services-layer result and metadata caches, which aren't tied to specific compute nodes.
10. **B.** Failover groups — which add the promote-to-primary capability on top of plain replication — require Business Critical edition or higher on both sides. Plain database/share replication without promotion capability is available on any edition via a replication group, but that's a materially different (lesser) capability than failover.
11. **B — Standard Gen 2.** Standard Gen 2 is newer compute offering better price/performance for many workloads over Gen 1, at the same declared size — no workload-type change needed.
12. **B — An event table.** An event table is the object that captures structured logging/tracing output from procedures and functions, queryable with ordinary SQL.
13. **B — A directory table.** A directory table is the queryable file-metadata catalog for a stage.
14. **B.** Snowflake's documentation explicitly lists nondeterministic functions (e.g. `SEQ`, `RANDOM()`) as a disqualifier for QAS eligibility.
15. **B.** Resharing is governed by the same underlying grant model rather than being either universally blocked or automatically allowed.
16. **A.** Snowpark-Optimized warehouses provide extra memory per node specifically to reduce spilling on memory-intensive Snowpark/ML workloads — a more targeted fix than blanket upsizing a Standard warehouse, and unrelated to concurrency (multi-cluster) or QAS, which addresses outlier query latency, not memory pressure.
17. **C — USERADMIN.** `USERADMIN` is scoped specifically to user/role management (`CREATE USER`, `CREATE ROLE`) and does not, by itself, manage warehouses or databases — that's `SYSADMIN`'s scope; `SECURITYADMIN` inherits `USERADMIN` plus broader grant-management privileges.
18. **B.** A storage integration is the account-level object that holds a cloud IAM role/identity, letting a stage authenticate to cloud storage without embedding an access key/secret directly in the stage definition — the secure-by-default pattern.
19. **A.** A materialized view is the tradeoff-aware fix for an expensive, frequently-run aggregation over slowly-changing data — Snowflake precomputes and automatically maintains the result, but that comes with real ongoing costs (storage for the materialized result, background maintenance credits as source data changes) that a standard view, recomputed live with no storage cost, doesn't have.
20. **B.** `BEFORE(STATEMENT => '<query_id>')` is the precise fit when the exact triggering statement's query ID is already known — it reconstructs the table's state immediately before that statement ran, more exact than guessing a timestamp or offset, and distinct from `UNDROP` (which restores a dropped object entirely, not a mid-history state).
21. **D — 40.** Max cluster count scales inversely with size: XS/S/M=300, L=160, XL=80, 2XL=40, 3XL=20, 4XL-6XL=10.
22. **B.** `ALLOWED_VALUES` is enforced, not just documentation — an out-of-list value assignment is rejected.
23. **B — 100-250MB.** Roughly 100-250MB compressed per file is the recommended range for good load parallelism — too small wastes overhead per file, too large limits parallel processing.
24. **B.** The scale factor caps how much extra serverless QAS compute can be leased on top of the warehouse's own size — setting it to 0 removes the upper limit entirely.
25. **B.** A direct share is a point-to-point grant to one named consumer account; a listing is a discovery mechanism, public or private, that a consumer can find and request/accept.
26. **B.** Snowflake's parameter precedence rule is that the most specific level actually set wins over broader levels — a statement-scoped override beats the session-level default for that one statement, without erroring or requiring anything special.
27. **B.** Snowflake's underlying model is Discretionary Access Control: each object's owning role decides who else gets access via grants. RBAC describes how those privileges are grouped and assigned (via roles); DAC describes who has the authority to decide the grant itself.
28. **B.** COPY INTO's load history is tracked automatically by file name plus checksum for a 64-day window, making unmodified reruns idempotent by default without any manual bookkeeping — `FORCE = TRUE` is the explicit override when a genuine reload is needed.
29. **B.** `FLATTEN()` (typically used via `LATERAL FLATTEN(input => ...)`) is purpose-built to explode a nested VARIANT array or object into multiple output rows, one per element — `OBJECT_CONSTRUCT`/`ARRAY_AGG` do the semantic reverse (building nested structures from flat rows), and `APPROX_COUNT_DISTINCT` is an unrelated aggregate function.
30. **B.** Secure Data Sharing's live, zero-copy mechanism only works within the same cloud region/provider. Bridging a different cloud/region requires first replicating the data into an account in the consumer's own region/provider, after which a normal direct share (or listing) can be set up from that replicated copy.
31. **B — 10.** The size-based ceilings (300/160/80/40/20/10) are opt-in maximums configured via ALTER WAREHOUSE — the out-of-the-box default is still 10 for every size.
32. **B.** Tag-based masking policy assignment propagates to any column carrying that tag, including columns tagged after the policy was attached — this is the point of attaching masking at the tag level instead of per-column.
33. **C.** `ABORT_STATEMENT` is the default: the first error aborts the entire COPY INTO, unless a different `ON_ERROR` is specified.
34. **B — SYSTEM$ESTIMATE_QUERY_ACCELERATION.** `SYSTEM$ESTIMATE_QUERY_ACCELERATION` returns estimated execution times at different scale factors for a previously-run query.
35. **B.** Data Clean Rooms are purpose-built for privacy-preserving joint analysis, layering secure views/UDFs and governance on top of sharing so raw rows never cross the boundary.
36. **B — Enterprise.** Extended Time Travel (up to 90 days) is an Enterprise+ feature; Standard is capped at 1 day with no override, and Business Critical/VPS also include it (as supersets of Enterprise) but aren't the minimum required tier.
37. **B.** Key-pair authentication needs no password and no interactive step, making it the standard choice for automated service accounts; SSO/SAML2 is built around interactive human login flows, and MFA adds an interactive second factor — neither fits a headless CI/CD pipeline.
38. **B.** Load-history tracking keys on file name AND checksum together, not name alone — a file whose content (and therefore checksum) changed under an unchanged name is treated as a distinct, not-yet-loaded file and gets reloaded on the next COPY INTO run.
39. **B.** The documented, foundational workload-management best practice is to group similar workloads onto separate, dedicated warehouses — heavy ad-hoc queries contending with latency-sensitive dashboards on one shared warehouse is the textbook case this practice addresses, and is the first lever to reach for before more specialized features like QAS.
40. **B.** A reader account is purpose-built for exactly this case: a consumer with no Snowflake account of their own, where the provider creates and pays for the reader account's compute on the recipient's behalf. Direct shares, listings, and Native Apps all still require the consumer to have (or set up) their own Snowflake account.
41. **C.** Billing is per-second with a 60-second minimum per resume. Since 20 seconds is under that floor, it's billed as if 60 seconds ran: 2 credits/hr × (60/3600) ≈ 0.033 credits.
42. **A — Trust Center.** Trust Center is the dedicated security-posture/risk-scanner dashboard in Snowsight.
43. **B — PATTERN.** `PATTERN` accepts a regular expression matched against staged file paths to filter which files are loaded.
44. **B.** Search optimization builds asynchronously; you check build completion via the `search_optimization_progress` column in `SHOW TABLES` output.
45. **B — A private listing.** A private listing uses the same listing mechanics as a public one, but is scoped to named accounts instead of being discoverable publicly.
46. **B.** Snowflake ML is the dedicated feature covering the ML lifecycle (features, training, registry) inside Snowflake; Snowpark is the underlying general-purpose Python/Java/Scala compute-pushdown framework it's commonly built on top of, not the lifecycle-management feature itself.
47. **A and C.** Database roles are scoped to a single database (A) and can be granted to an account role so their privileges travel with the database into a share or replication target (C) — a key reason to prefer them for shareable datasets. They are not auto-activated as secondary roles by default (B is false) and have nothing to do with replacing `USERADMIN` (D is false).
48. **B.** Snowpipe Streaming is purpose-built for direct, low-latency row-level ingestion without a file-staging step first — genuinely faster than file-based Snowpipe's seconds-to-minutes micro-batch latency, which still requires files to land in a stage first.
49. **B.** Local spilling (to the warehouse's local SSD) is already a sign of memory pressure; spilling further out to remote storage is worse still, since it means local disk was also insufficient — a stronger signal that the warehouse needs to be sized up or the query needs to be rewritten to reduce intermediate result size.
50. **A.** A secure UDF mirrors a secure view's protection — its definition is hidden from consumers lacking privilege to view it — letting a provider share reusable derived logic as a callable object without exposing the implementation. A plain UDF's definition is visible to anyone with USAGE privilege by default.
51. **B.** Economy's shutdown trigger mirrors its start trigger: a cluster is marked for shutdown once Snowflake estimates it has less than 6 minutes of remaining work.
52. **C.** Encryption at rest/in transit is automatic on every edition, including Standard — it's Tri-Secret Secure (customer-managed key layer) that's gated to Business Critical+.
53. **C — VALIDATION_MODE.** `VALIDATION_MODE` runs the load logic and reports what would happen/what errors would occur, without committing any rows.
54. **B.** Search Optimization covers a broad set: equality, IN lists, substring/regex matches, NULL checks, geospatial GEOGRAPHY predicates, and semi-structured data lookups — not just exact-equality.
55. **B — An Apache Iceberg table.** Iceberg tables let Snowflake act as a query and (depending on configuration) write engine over an open, externally-manageable table format that other engines like Spark can also read/write — distinct from External tables (metadata-only pointer, not natively writable in the same interoperable sense).
56. **B.** Secondary roles let a session activate additional roles alongside its one primary role; with `USE SECONDARY ROLES ALL`, the effective privilege set is the union of the primary role and all active secondary roles, all without switching roles.
57. **B.** A Git integration is purpose-built to connect a Snowflake account directly to a Git repository, letting Snowflake CLI-managed projects and Native App source deploy straight from the repo — distinct from a storage integration (cloud object storage access) or an API integration (authorizing calls to external HTTP endpoints).
58. **B.** A rising scan ratio over time on a large, frequently-filtered table is the classic signature of clustering quality degrading as new data lands without preserving co-location on the filtered column — defining or maintaining a clustering key is the standard fix, distinct from warehouse sizing, the result cache, or Search Optimization Service (which targets different symptoms).
59. **B.** For MAX_CLUSTER_COUNT > 10, Standard can start multiple clusters at once rather than one at a time — a real distinction from warehouses capped at 10 or below.
60. **B — An Alert.** An Alert is purpose-built for a scheduled condition check plus an automatic action/notification when the condition is met.
61. **B — DOWNSTREAM.** `TARGET_LAG = DOWNSTREAM` lets a dynamic table's refresh cadence be driven by the freshness needs of dependent dynamic tables downstream, rather than a fixed duration.
62. **B.** Clustering keys pay off on large, frequently-filtered tables; on a small, rarely-filtered table they add background reclustering cost with little benefit.
63. **A — A Dynamic Table with a target lag.** Dynamic Tables provide automatic, declarative refresh based on a target lag and are available regardless of Materialized View edition gating — a standard view has no caching/freshness benefit at all, and QAS accelerates individual queries rather than maintaining a refreshed table.
64. **B.** A masking policy is specifically designed to alter what a column's value displays as, based on the querying role, evaluated at query time — with no duplication of the underlying data. A row access policy instead controls which whole rows are visible, and an aggregation policy enforces minimum group sizes on results rather than masking individual values.
65. **B.** An API integration is the account-level object specifically designed to authorize outbound calls to an external API endpoint (backing external functions or webhook-style notifications) without embedding credentials directly in SQL — storage and Git integrations serve different, unrelated connectivity purposes.
66. **A.** Query Acceleration Service is designed exactly for this situation: an outlier query disproportionately large relative to the rest of a warehouse's workload gets its eligible portions offloaded to serverless compute, without needing to permanently resize the warehouse (and therefore without wasting credits on every other, lighter query sharing it).
67. **B — Organization → Account → Database → Schema.** Organization sits above Account, which contains Databases, which contain Schemas, which contain the actual objects (tables, views, etc.).
68. **B — A notification integration.** A notification integration configures the outbound channel (email, cloud pub/sub, etc.) that Alerts/Tasks send to.
69. **B — The Kafka connector.** The Kafka connector auto-provisions the tables/pipes needed and streams topic data in via Snowpipe or Snowpipe Streaming.
70. **B.** The result cache requires the query text (not just its logical meaning) to match; a syntax-level difference like alias casing breaks the exact match needed for reuse.
71. **C — CURRENT_WAREHOUSE().** `CURRENT_WAREHOUSE()` returns the warehouse currently bound to the session, distinct from `CURRENT_USER()` (logged-in user), `CURRENT_ROLE()` (active role), and `CURRENT_ACCOUNT()` (the account identifier).
72. **C.** An aggregation (privacy) policy is specifically designed to enforce a minimum group size on results at the query-execution level, regardless of how a caller structures their SQL — distinct from masking (alters displayed values) and row access policies (restricts which rows are visible), neither of which guarantees a minimum aggregation threshold.
73. **B.** `VALIDATION_MODE` (e.g. `RETURN_ERRORS` or `RETURN_ALL_ERRORS`) runs the COPY INTO logic and surfaces exactly what would happen — including specific row-level errors — without committing any rows, making it the purpose-built pre-flight dry-run option.
74. **B.** Search Optimization Service specifically targets highly selective point-lookup/equality-style queries on columns that don't naturally benefit from clustering, while clustering keys help range scans and large filtered scans — the right tool depends on the query pattern, and this scenario (random exact-match lookups) is squarely Search Optimization Service's use case.
75. **B — Account → User → Session → Object.** Account is the broadest level, then User, then Session, then Object — each more specific level can override the one above it, and the most specific level set wins.
76. **A — Data lineage.** Snowsight's data lineage view automatically visualizes object-to-object dependencies with no manual instrumentation required.
77. **C — Git integration.** Git integration is purpose-built to connect a Snowflake account directly to a Git repository for source-controlled deployment.
78. **B.** Even background reclustering, which doesn't change logical row content, invalidates the result cache because the underlying micro-partitions changed.
79. **B.** Snowflake GA'd `AI_`-prefixed AI SQL functions (AI_COMPLETE, AI_CLASSIFY, AI_TRANSLATE, AI_SENTIMENT, AI_SUMMARIZE_AGG, etc.) in November 2025, superseding the older naming — worth knowing if prior study material still references the old names, since exam content may lag behind the rename.
80. **B.** Notify only alerts with no query impact; Suspend lets currently-running queries finish but blocks new ones from starting; Suspend Immediately additionally kills already-running queries — strictly increasing severity in that order.
81. **B.** Loading semi-structured formats into a VARIANT column defers schema mapping — the file's structure, including newly-added optional fields, is captured as-is in the VARIANT value rather than requiring a rigid, pre-declared target schema, which is exactly why VARIANT is the standard landing zone for schema-evolving semi-structured sources.
82. **B.** Result cache invalidation is tied to the underlying micro-partitions changing, not just logical row values — even automatic background reclustering, which reorganizes physical partitions without altering any row's logical content, is enough to invalidate a previously-cached result.
83. **B — CURRENT_ROLE().** `CURRENT_ROLE()` returns the session's active role; the other three return the active warehouse, the logged-in user, and the account identifier respectively.
84. **B.** A resource monitor can track and act on credit usage across one or more warehouses, not just a single one.
85. **B — APPROX_COUNT_DISTINCT, based on HyperLogLog.** `APPROX_COUNT_DISTINCT` uses a HyperLogLog sketch to estimate cardinality far more cheaply than an exact `COUNT(DISTINCT)` at massive scale.
86. **B.** Standard scaling policy reacts as promptly as possible: it starts a new cluster either the instant a query is actually queued, or proactively once Snowflake estimates the running clusters won't handle additional incoming queries — the opposite tradeoff from Economy's 6-minute sustained-load threshold.
87. **B.** Network policies can be set at both account and user level; a user-level policy overrides the account-level one for that specific user — Snowflake's own guidance is to use user-level policies for service accounts specifically, layered under an account-level catch-all for everyone else.
88. **B.** APPROX_COUNT_DISTINCT is based on HyperLogLog, a probabilistic sketch algorithm that estimates cardinality using bounded memory rather than materializing and comparing every distinct value — fundamentally cheaper at massive scale than an exact COUNT(DISTINCT), and not simply a random sample (which would introduce different, less-controlled error characteristics).
89. **B — Cortex Search.** Cortex Search is the retrieval/search sub-feature; Cortex Analyst is natural-language-to-SQL over a semantic model, and AI SQL functions are direct SQL-callable LLM calls.
90. **B.** `QUALIFY` is purpose-built to filter directly on a window function's result (e.g. `QUALIFY ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date DESC) = 1`) in the same query, eliminating the need for a wrapping subquery or CTE just to apply that filter.
91. **B.** Sequences and ML models are both explicitly listed database object types under 1.3, alongside Stages, Schemas, Tables, Views, UDFs, File formats, Stored procedures, Pipes, Shares, and Applications — easy to forget since they're less commonly discussed than tables/views. Warehouses/Organizations sit outside the database-object list; Roles/Users and Resource Monitors/Network Policies are account-level governance constructs, not database objects under 1.3.
92. **B — Snowflake Notebooks.** Snowflake Notebooks are the interactive, cell-by-cell exploratory development environment; Streamlit in Snowflake is for hosting a finished, polished app for other users to open.
93. **A.** 3X-Large's ceiling is 20 (XS/S/M=300, L=160, XL=80, 2XL=40, 3XL=20, 4XL-6XL=10) — inversely related to size, because Snowflake bounds total aggregate compute (warehouse size × cluster count) rather than letting cluster count scale independently of size.
94. **B — Snowpark.** Snowpark pushes the transformation logic down into Snowflake's compute layer rather than moving data out to a client process.
95. **C.** An IDE integration (e.g. the official VS Code extension) is specifically the in-editor tool; Snowsight is browser-based and SnowSQL/Snowflake CLI are terminal-based — neither runs inside the developer's own code-editor window.
96. **B — Temporary.** Temporary tables are session-scoped and auto-dropped at session end; Transient tables persist across sessions but skip Fail-safe.
97. **B.** The defining protection a Secure view adds is hiding its own definition from unauthorized viewers, which prevents both reverse-engineering the derivation logic and certain query-crafting techniques that could otherwise leak filtered-out rows — it has no inherent performance advantage, isn't required for multi-table views, and doesn't auto-apply masking.
98. **C — Standard view.** A standard view has no stored result and no maintenance cost — it just re-runs its defining query on every reference, unlike a materialized view.
99. **B.** Snowflake Notebooks are built for interactive, cell-by-cell exploratory development running on Snowflake compute; Streamlit in Snowflake is the app-hosting feature for finished, polished apps meant for other users — the opposite end of the same workflow.
100. **B — Snowflake CLI (snow).** Snowflake CLI (`snow`) is the newer, actively-developed terminal tool; SnowSQL still exists but is the older of the two.
