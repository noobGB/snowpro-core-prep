# Mock Exam 4 — Full-Length Practice Exam (100 Questions)

Fourth in the series, same domain-weighted split as the real exam: **Domain 1 (Architecture &
Features): 31, Domain 2 (Account Mgmt & Governance): 20, Domain 3 (Data Loading/Unloading/
Connectivity): 18, Domain 4 (Performance & Transformation): 21, Domain 5 (Data Collaboration): 10**
(100 questions), interleaved rather than blocked.

Every question in this exam is new and original — it does **not** reuse any question from the
domain-authored practice files (`10`-`14`), from Mock Exam 1, or from any of the other mocks in
this series. All five mock exams are built to be mutually distinct: 500 different questions across
the 5 mocks. Every question puts you in an architect's seat, choosing between two or more
plausible-sounding options for a stated design or troubleshooting requirement. Original content
throughout, verified against the domain notes and live Snowflake documentation — never sourced from
or modeled on an exam-dump site.

No official single-choice/multi-select ratio is published for the real exam, so this one uses a
reasonable, clearly-labeled mix, same as the rest of the series.

Take this closed-book, timed to 115 minutes, and log your score plus per-domain breakdown in
[06_Practice_Exam_Tracker.md](06_Practice_Exam_Tracker.md).

---

**1. [D1]** A DevOps engineer wants to embed Snowflake object deployment (tables, tasks, Snowpark projects) into a CI/CD pipeline that runs on a headless Linux build agent with no GUI, and needs first-class support for a version-controlled project definition file (snowflake.yml) rather than raw ad-hoc SQL scripts. Which tool should the pipeline invoke?

A. Snowsight
B. The Snowflake CLI (snow)
C. SnowSQL
D. The Snowflake JDBC driver wrapped in a custom Java build step

**2. [D2]** A custom role DATA_ENGINEER was granted SELECT on a schema-level future grant so it automatically receives SELECT on any table created in that schema going forward. A new table is created by a different role, ETL_LOADER, that owns the schema. Does DATA_ENGINEER automatically get SELECT on the new table?

A. No — future grants only apply to objects that already existed when the grant was created
B. Yes — a future grant applies automatically to matching objects created afterward by any role with rights in that schema, regardless of which role creates them
C. Only if ETL_LOADER explicitly re-grants SELECT to DATA_ENGINEER on the new table
D. Only if DATA_ENGINEER is also the owner of the schema

**3. [D3]** An architect is loading a CSV file where column order in the source file doesn't match the target table's column order, and one source column needs a simple expression applied (converting a string to a DATE) before landing in the target column. Standard COPY INTO with a plain file format and column-order matching won't handle this. What COPY INTO capability should be used?

A. A COPY INTO statement using a SELECT with explicit column references and expressions against the staged file, instead of a plain COPY INTO <table> FROM <stage>
B. PURGE = TRUE to reorder columns automatically during the copy
C. VALIDATION_MODE = 'RETURN_ALL_ERRORS' to fix mismatched columns
D. A file format option MATCH_BY_COLUMN_NAME = CASE_INSENSITIVE, which works for CSV without any column-name header

**4. [D4]** A customer-support application runs thousands of point lookups per minute of the form SELECT * FROM tickets WHERE ticket_id = ? against a multi-billion-row table, where ticket_id has extremely high cardinality and no natural correlation with insert order, so clustering on it wouldn't meaningfully improve pruning. Query Profile shows these lookups scanning far more partitions than a single ticket_id match should require. Which feature is the best fit?

A. A clustering key on ticket_id
B. Search Optimization Service on ticket_id
C. A materialized view over the tickets table
D. Query Acceleration Service

**5. [D5]** A company operating in two cloud regions for regulatory reasons needs a documented, low-RTO business continuity plan: if the primary region's account becomes unavailable, a secondary account in the other region should be promotable to serve production traffic with minimal data loss. Which Snowflake capability, and minimum edition, satisfies this?

A. Zero-copy cloning on Standard edition
B. Time Travel with 90-day retention on Enterprise edition
C. Database/account replication and failover on Business Critical edition or higher
D. Secure Data Sharing on Standard edition

**6. [D1]** A warehouse workload consumes 850 credits of compute in a single day (calculated in UTC). Cloud Services layer usage (query compilation, metadata operations, authentication, etc.) for that same day totals 100 credits. Under Snowflake's standard billing model, how many of those Cloud Services credits actually appear as a separate billed line item?

A. 15 credits — only the amount above 10% of that day's 850 compute credits (i.e., above 85) is billed separately; the rest is free
B. 100 credits — Cloud Services usage is always billed as a fully separate line item regardless of compute volume
C. 0 credits — Cloud Services usage is entirely free regardless of volume
D. 85 credits — the free portion is billed and the remainder is waived

**7. [D2]** A third-party BI tool used by dozens of business users needs to connect to Snowflake on each user's own behalf — enforcing that specific user's own RBAC privileges, not a shared service account's — without the BI tool ever storing that user's Snowflake password or a long-lived key. Which authentication approach fits?

A. A single shared key-pair credential embedded in the BI tool's connection config for all users
B. OAuth (Snowflake OAuth, or an external OAuth provider already trusted by the organization), so the BI tool obtains a short-lived, per-user access token instead of storing credentials
C. A single network policy scoped to the BI tool's IP range
D. A shared username/password service account used by the BI tool for all users

**8. [D3]** A geospatial analytics table receives inserts, updates, and occasional deletes. A team creates a standard (delta) stream on it and discovers some geometry-column changes aren't showing up correctly, even though non-geospatial column changes track fine. Separately, they need a second stream on an external table that only needs to track new files landing, never deletions. What should they do for each?

A. Switch the geospatial table's stream to append-only (recommended for objects with geospatial data, since standard streams can't retrieve change data for geometry/geography types) — though append-only only tracks inserts, not updates/deletes; for the external table, use an insert-only stream, a type that can only be created on external tables
B. Use a standard stream for both cases; no stream type distinction applies to geospatial or external-table data
C. Use insert-only streams for both — insert-only streams work on any table type, not just external tables
D. Use append-only for the external table and standard for the geospatial table — the reverse of the correct pairing

**9. [D4]** A query includes UUID_STRING() in its SELECT list to generate a unique identifier per row. The exact same query text is run twice in a row, with no underlying data change between runs. Does the second run hit the query result cache?

A. Yes — identical query text always guarantees a cache hit regardless of the functions used
B. No — queries containing non-deterministic functions like UUID_STRING() or RANDOM() are excluded from result-cache reuse, since re-running them is expected to (and should) produce different output each time
C. Yes, but only the UUID_STRING() column is recomputed; the rest of the row is served from cache
D. No — but only because UUID_STRING() specifically is deprecated and no longer supported in cached queries

**10. [D5]** A company wants disaster-recovery capability where a secondary account's copy of a critical database can be promoted to become the new primary if the primary region goes down. A separate, unrelated need: a read-only copy of a reference database replicated to three other regional accounts purely for local read performance, with no intention of ever promoting any of those copies to primary. Which object type fits each need, and what's the key capability difference?

A. Both needs should use Replication Groups; Failover Groups are being deprecated
B. The DR need requires a Failover Group (supports promotion of a secondary to primary, requires Business Critical edition or higher); the read-only regional copies need only Replication Groups (replicate data with fewer edition restrictions, but explicitly do NOT support failover/promotion to primary)
C. Both needs require Failover Groups; Replication Groups don't actually replicate any data
D. An object can belong to both a Failover Group and a Replication Group simultaneously to cover both needs with one object

**11. [D1]** A business analyst wants to run ad-hoc exploratory queries interactively, visualize results as charts on a dashboard, and browse the Marketplace for third-party datasets to enrich her analysis, all without installing anything locally. Which interface fits this requirement?

A. Snowsight
B. SnowSQL
C. The Snowflake CLI
D. The ODBC driver through a generic SQL IDE

**12. [D2]** An architect is deciding how to grant a reporting team read access to database-specific objects that need to travel along if that database is later replicated into another account for disaster recovery. A traditional account role's grants do not replicate with the database. Which role type should the objects' privileges be packaged into instead?

A. A secondary role
B. A database role
C. The PUBLIC role
D. A custom account role granted directly to SYSADMIN

**13. [D3]** A team is loading semi-structured JSON files where the source key names don't exactly match the target table's column names, but a header-like key-to-column mapping by name (case-insensitive) would otherwise work without hand-authoring column expressions. Which COPY INTO option is designed for this?

A. PURGE = TRUE
B. MATCH_BY_COLUMN_NAME = CASE_INSENSITIVE (or STRICT_CASE_SENSITIVE) in the COPY INTO statement
C. ON_ERROR = CONTINUE
D. FORCE = TRUE

**14. [D4]** A finance reporting warehouse runs the same complex multi-join aggregation query every 15 minutes against a table that only changes a few times per day via a nightly batch load. The query is expensive to recompute each time but the underlying data is slowly changing. Which feature reduces cost and latency here with the least engineering effort?

A. Query Acceleration Service
B. A materialized view over the aggregation
C. Search Optimization Service
D. Increasing MAX_CLUSTER_COUNT on the warehouse

**15. [D5]** A data provider wants to share a curated dataset with three named business partners, each of which already has its own Snowflake account, without publishing the dataset broadly or paying for the partners' compute. Which sharing approach fits best?

A. A public Marketplace listing
B. A direct share to each partner's named consumer account, where each partner queries using their own warehouse
C. A reader account created and paid for by the provider, for each partner
D. A private listing visible to the entire organization

**16. [D1]** A Small warehouse (2 credits/hour) auto-suspends after 60 seconds of inactivity and auto-resumes on the next query. Over one hour, five separate users each submit one quick query at well-spaced intervals, each completing in 10 seconds, with the warehouse fully suspending between each one. Given Snowflake's per-second billing with a 60-second minimum per resume, approximately how many credits does this usage pattern consume?

A. ~0.028 credits — only the actual query execution time (50 seconds total) is billed
B. ~0.167 credits — each of the 5 resumes bills at least a 60-second minimum (300 seconds total), even though actual combined query time was only 50 seconds
C. 2 credits — the full hourly rate applies any time the warehouse is used at all during that hour
D. ~0.417 credits — billing is per-minute, so 5 separate one-minute charges plus overhead round to this figure

**17. [D2]** A platform team wants every query run by a specific dbt job to be identifiable in ACCOUNT_USAGE.QUERY_HISTORY by a consistent label (e.g. 'dbt_nightly_run'), so cost and performance can later be attributed per job/pipeline rather than just per warehouse or per user. Which mechanism should the dbt job's connection set?

A. An object tag attached to the warehouse it runs on
B. The QUERY_TAG session parameter, set at the start of the session (or per-statement) to a consistent label
C. A resource monitor named after the job
D. A masking policy referencing the job name

**18. [D3]** A team runs two Tasks: Task A executes a short, simple SQL statement every 5 minutes with highly variable, unpredictable load, where sizing and babysitting a dedicated warehouse feels like overkill. Task B runs a heavy, consistent, resource-intensive transformation nightly, where the team already has a well-tuned, appropriately-sized warehouse they want the task to reuse for cost predictability. Which compute model should each Task use?

A. Task A: a serverless Task (Snowflake-managed compute, automatically right-sized, billed by actual usage, no warehouse to manage); Task B: a user-managed Task running on their existing, appropriately-sized warehouse
B. Both tasks should use serverless compute, since it's always cheaper regardless of workload shape
C. Both tasks should run on the same user-managed warehouse to simplify billing
D. Task A: user-managed warehouse; Task B: serverless — the reverse of the correct pairing

**19. [D4]** User A (role ANALYST_A) runs a query and its result is cached. User B, holding a completely different role (ANALYST_B) that also happens to have SELECT on the exact same underlying tables, runs the textually identical query shortly after. Does User B's query hit User A's cached result?

A. No — the result cache is scoped per-user, never shared across different users under any circumstances
B. Yes, potentially — result cache access is privilege-gated (the querying role must hold the required privileges on the underlying objects), not user-identity-gated, so a different role with equivalent access can still hit a cache entry created under another role/user, for ordinary SELECT-type queries
C. Yes, always, with no privilege check at all
D. No — cached results are only reusable within the exact same session that created them

**20. [D5]** An analyst needs to query a table's exact state immediately before a specific known query_id ran an erroneous UPDATE, rather than at a specific wall-clock timestamp or a relative time offset. Which Time Travel clause form fits this specific requirement?

A. AT(OFFSET => -3600), a relative time offset in seconds before now
B. AT(TIMESTAMP => '2026-03-15 09:00:00'), an absolute wall-clock timestamp
C. BEFORE(STATEMENT => '<query_id>'), which reconstructs the table's state immediately before a specific statement executed, identified by its query ID rather than a time value
D. UNDROP TABLE, which restores a dropped table rather than querying historical state

**21. [D1]** A legacy nightly batch script, already standardized on a lightweight command-line SQL client for over five years, needs one more scripted step added: run a parameterized SQL file and exit with a status code the surrounding shell script can check. The team does not want to introduce Snowpark/Native App project tooling for this single change. Which client satisfies this with the least disruption?

A. SnowSQL
B. Snowsight
C. A brand-new Snowpark Python script
D. The Snowflake Terraform provider

**22. [D2]** An account has an account-level network policy allowing only corporate office IP ranges. A single service-account user, used by an external ETL vendor, needs to connect from the vendor's own static IP range outside the corporate network. A network policy is attached directly to that user allowing the vendor's IP range. What happens when the vendor connects?

A. The connection is blocked, because the account-level policy always takes precedence over any user-level policy
B. The connection succeeds, because a user-level network policy takes precedence over the account-level policy for that specific user
C. The connection is blocked unless the account-level policy is also updated to include the vendor's range
D. Both policies are merged, and the connection is allowed only if it satisfies both simultaneously

**23. [D3]** A team needs to export a large table to Parquet files in an external S3 stage, splitting the output into multiple reasonably-sized files in parallel (rather than one giant file) to speed up both the unload and any downstream consumer that reads the files in parallel. Which COPY INTO <location> option controls this?

A. SINGLE = TRUE
B. MAX_FILE_SIZE, left at its default or tuned down from the max, so the warehouse's compute nodes each write a separate file in parallel
C. PURGE = TRUE
D. VALIDATION_MODE = 'RETURN_ROWS'

**24. [D4]** A single ad-hoc analyst query occasionally scans several terabytes of a fact table with a moderately selective filter, dramatically longer than the warehouse's typical workload, and the team doesn't want to permanently upsize the warehouse just to cover this occasional outlier. SYSTEM$ESTIMATE_QUERY_ACCELERATION confirms eligibility. Which feature directly addresses this without resizing the warehouse?

A. Query Acceleration Service
B. A clustering key on the filter column
C. A dynamic table wrapping the query
D. Increasing the warehouse's auto-suspend timeout

**25. [D5]** Two companies want to jointly analyze overlapping customer segments for a co-marketing campaign, but neither is willing to expose their own raw customer-level rows to the other, and any output must be restricted to aggregated results above a minimum group size to prevent re-identification. Which Snowflake pattern is designed for this?

A. A direct share of each company's raw customer table to the other
B. A Data Clean Room, built on secure views/UDFs plus governance (e.g. aggregation/privacy policies) so only privacy-preserving joint results are ever returned
C. A Native App installed by both companies independently
D. Cross-account replication of both companies' customer tables into a shared account

**26. [D1]** A data scientist wants an interactive, cell-by-cell environment inside Snowsight to iteratively explore a dataset with mixed Python and SQL cells, visualizing intermediate results as she goes — not yet ready to ship a finished, polished multi-page application to business stakeholders. Which feature fits her immediate need, as distinct from the tool she'd reach for once ready to package a finished app?

A. Snowflake Notebooks for her iterative exploration; Streamlit in Snowflake once she's ready to package a polished app for stakeholders
B. Streamlit in Snowflake for her iterative exploration; Snowpark for the packaged app
C. Snowpark alone covers both needs; Notebooks and Streamlit are redundant with it
D. SnowSQL for her iterative exploration, since it supports Python cells natively

**27. [D2]** A data quality team wants Snowflake to automatically check, every morning, whether yesterday's row count in a critical fact table fell below an expected minimum threshold, and if so, trigger a notification — without a human running the check manually or an external orchestrator polling Snowflake. Which native Snowflake object is purpose-built for this?

A. A Task running an unconditional SQL statement on a schedule
B. An Alert (CREATE ALERT), which evaluates a scheduled SQL condition and fires a defined action only when that condition is true
C. A resource monitor with a Notify threshold action
D. A Stream on the fact table

**28. [D3]** A team wants to create their first Apache Iceberg table in Snowflake, pointing at Parquet data files and Iceberg metadata/manifest files they already manage in their own S3 bucket. Before CREATE ICEBERG TABLE will succeed, what account-level object must already exist to give Snowflake secure access to that storage location?

A. A storage integration alone is sufficient; no other object is needed for Iceberg tables specifically
B. An External Volume — a named, account-level object storing the IAM entity Snowflake uses to securely connect to the external storage location holding the table data, Iceberg metadata, and manifest files
C. A named internal stage pointing at the same S3 path
D. A Dynamic Table wrapping the external location

**29. [D4]** A query returns a 400KB result set and is served from the result cache on a repeat run five hours later. The client's session had previously fetched the initial access token for that large result four and a half hours earlier. What should the architect expect?

A. Nothing changes — the same access token works indefinitely as long as the result stays in cache
B. The security token used to access a large (>100KB) cached result expires after 6 hours; at 4.5 hours the original token is likely still valid, but shortly after 6 hours from its issuance a new token would need to be retrieved to keep accessing the same cached result
C. Large results are never eligible for the result cache at all, only exact-match small results under 100KB
D. The result is automatically re-executed instead of reusing the cache once it exceeds 100KB

**30. [D5]** A provider account in AWS us-east-1 wants to share a database with a consumer account in Azure West Europe. The provider attempts a direct share the same way they would with another AWS us-east-1 consumer account, and it doesn't work as expected. What extra step is required for cross-region/cross-cloud-provider sharing, and why?

A. Nothing — Secure Data Sharing works identically across any region or cloud provider combination with no extra step
B. The database must first be replicated into an account within the consumer's own region/cloud provider; Secure Data Sharing itself only works directly within the same cloud region and provider, since the consumer needs to query the provider's storage location live and that mechanism doesn't span cloud regions/providers on its own
C. The consumer must instead use a reader account, which is the only way to bridge different cloud providers
D. Cross-cloud sharing is only possible via a Native App, never via direct sharing or a listing

**31. [D1]** An architect is documenting which object types live directly inside a schema versus which are account-level objects that sit above the database/schema hierarchy. Which of the following does NOT belong under a schema?

A. Pipes
B. Sequences
C. Virtual warehouses
D. User-defined functions (UDFs)

**32. [D2]** A security architect has an account-level network policy, a user-level network policy on a specific service account, and is now also configuring a network policy directly on a security integration (e.g. an external OAuth integration) that the same service account authenticates through. If all three are present for one connection attempt, which one governs?

A. The account-level policy, since it is evaluated first and is authoritative
B. The user-level policy always wins over any other policy
C. The network policy attached to the security integration takes precedence over both the user-level and account-level policies
D. Whichever policy was created most recently applies

**33. [D3]** A team created an external table over an S3 bucket without configuring cloud event notifications (e.g. no SQS/SNS setup), and new files have been landing in the bucket for two days. Querying the external table still doesn't show the new files. What is the correct fix, and why did this happen?

A. Run ALTER EXTERNAL TABLE ... REFRESH manually — without an event-notification integration configured, Snowflake has no way to auto-detect new files, so metadata sync must be triggered explicitly (or scheduled)
B. Nothing is needed — external table metadata always refreshes automatically on every query
C. Drop and recreate the external table, since external table metadata cannot be refreshed after creation
D. Increase the external table's Time Travel retention period

**34. [D4]** A data engineering team currently maintains a hand-written Stream+Task pair that incrementally merges new rows from a staging table into a curated table on a 10-minute schedule. The transformation logic is a single straightforward SQL query with no procedural branching, but the team is spending real effort maintaining the MERGE statement and schedule by hand. Which change reduces engineering overhead the most?

A. Replace the Stream+Task pair with a Dynamic Table defined directly as that query, with an appropriate target lag
B. Add Search Optimization Service to the staging table
C. Convert the curated table to an external table
D. Replace the Task's schedule with a resource monitor

**35. [D5]** An ISV wants to distribute a packaged analytics application — including its processing logic and UI — to customers via the Snowflake Marketplace, such that the application runs entirely inside each customer's own account on their own compute, and the customer's underlying data never has to leave their account. Which distribution mechanism fits?

A. A public data listing containing exported extracts of the ISV's own reference data
B. A Native App, installed and run inside the consumer's own account
C. A direct share of the ISV's processing views to each customer account
D. A reader account provisioned per customer

**36. [D1]** A platform team wants their Snowflake object definitions (tables, tasks, a Snowpark project) to live in a GitHub repository as the single source of truth, with a CI job that pulls the latest commit and deploys it to a Snowflake account automatically on merge to main, without manually re-uploading files to a stage first. Which pairing of Snowflake features enables this repo-as-source-of-truth deployment model?

A. SnowSQL alone, scripting file uploads from the CI runner's local checkout
B. A Git integration connecting the Snowflake account directly to the repository, combined with the Snowflake CLI's project-based deploy operations reading straight from the linked repo
C. The Snowflake JDBC driver, wrapped in a custom deployment script
D. Snowsight's worksheet import feature, run manually after each merge

**37. [D2]** An Alert is configured to fire when a data-quality condition is breached, and the team wants that firing to actually deliver a message to a webhook endpoint via a cloud messaging service, rather than just logging internally. What object must be configured to define that outbound delivery channel?

A. A Notification Integration, an account-level object configuring the destination channel (email, cloud messaging/webhook) that Alerts, Tasks, or other Snowflake events can push to
B. A second Stream chained to the first
C. A masking policy attached to the Alert
D. A storage integration pointed at the messaging service

**38. [D3]** A COPY INTO statement is written with MATCH_BY_COLUMN_NAME = CASE_INSENSITIVE against a batch of CSV files that, it turns out, have no header row at all — just raw data starting on line 1. What is the most likely outcome?

A. It works fine — MATCH_BY_COLUMN_NAME infers column names from the target table's own column order when no header is present
B. The load fails or behaves unexpectedly, because MATCH_BY_COLUMN_NAME for CSV depends on a header row to know the source column names to match against; without a header, there's nothing to match target columns by name to
C. MATCH_BY_COLUMN_NAME only applies to JSON/Parquet/Avro; for CSV it silently falls back to positional matching
D. SKIP_HEADER = 1 is automatically inferred and applied regardless of whether a header actually exists

**39. [D4]** An architect defines a clustering key as CLUSTER BY (region, event_date) on a large events table. Most queries filter tightly on event_date alone, with region rarely used as a filter. Query Profile shows pruning is worse than expected for these event_date-only queries. What is the most likely issue with the clustering key's column order?

A. Clustering key column order doesn't matter at all; pruning is identical regardless of order
B. Leading-column order matters — with region listed first, rows are co-located by region first and event_date second, so a query filtering only on event_date (skipping the leading column) prunes far less effectively; reordering to (event_date, region) would likely improve pruning for the actual query pattern
C. The clustering key needs a third column added to fix pruning, regardless of order
D. Pruning issues here can only be fixed by Search Optimization Service, not by changing the clustering key

**40. [D5]** A provider wants to share not just filtered row-level data, but a piece of reusable derived business logic (e.g. a proprietary risk-scoring calculation) with a consumer account, without exposing the underlying formula/implementation the consumer could otherwise reverse-engineer by inspecting the function definition. Beyond a secure view, what other object type is specifically designed to be shared this way?

A. A secure UDF (user-defined function), whose definition is likewise hidden from viewers without privilege to see it — letting a provider share callable derived logic without exposing its implementation
B. A plain (non-secure) UDF, since UDF definitions are always hidden from other accounts by default
C. A Stream, since it can encapsulate transformation logic
D. A masking policy, applied to the output of the calculation

**41. [D1]** While reviewing SHOW OBJECTS output for a schema, an architect finds an object type she doesn't recognize that is described as backing a running Snowpipe ingestion process. What object type is this?

A. A Pipe
B. A Stage
C. A Stream
D. A Task

**42. [D2]** An architect is designing authentication for a new Snowflake service account that will run unattended nightly ELT jobs with no human present to approve an MFA push. The design also needs to support rotating the credential without any pipeline downtime during the changeover. Which authentication approach best satisfies both constraints?

A. Username/password with MFA enforced via a Duo push
B. Key-pair authentication, using Snowflake's dual public-key-slot rotation (RSA_PUBLIC_KEY / RSA_PUBLIC_KEY_2)
C. SSO via an external SAML2 identity provider requiring interactive browser login
D. A shared personal user account borrowed from a team member

**43. [D3]** An architect is setting up an external stage pointing at an S3 bucket and wants to avoid embedding a long-lived AWS access key and secret directly in the CREATE STAGE statement, since that credential would then be visible to anyone with SELECT-equivalent privilege on stage metadata and would need manual rotation. What is the recommended alternative?

A. Use a storage integration — an account-level object holding a cloud IAM role reference that Snowflake assumes, referenced by the stage instead of embedded credentials
B. Store the access key and secret in a Snowflake table and reference them via a UDF at query time
C. Use a file format object instead of a stage, since file formats don't require credentials
D. Encrypt the access key with Tri-Secret Secure before including it in the CREATE STAGE statement

**44. [D4]** An analytics team needs an approximate count of distinct daily active users across a multi-billion-row event table for a dashboard refreshed every few minutes, and can tolerate a small statistical margin of error in exchange for dramatically lower compute cost and latency versus an exact count. Which function should they use?

A. COUNT(DISTINCT user_id)
B. APPROX_COUNT_DISTINCT(user_id)
C. COUNT(user_id) with a GROUP BY on date only
D. SUM(user_id)

**45. [D5]** A platform team wants to give each developer a full-fidelity copy of the multi-terabyte production database for a personal dev/test environment, refreshed weekly, without multiplying storage cost by the number of developers or waiting for a lengthy copy operation each time. Which approach fits best?

A. A nightly COPY INTO unload/reload cycle per developer
B. Zero-copy cloning (CREATE DATABASE ... CLONE ...) per developer, refreshed weekly by re-cloning
C. Granting each developer direct SELECT access to the production database
D. Setting up cross-region replication for each developer's personal account

**46. [D1]** An account administrator sets STATEMENT_TIMEOUT_IN_SECONDS = 600 (10 minutes) at the ACCOUNT level as a cost-control guardrail. A data engineer, wanting more headroom for one long-running session, runs ALTER SESSION SET STATEMENT_TIMEOUT_IN_SECONDS = 7200 (2 hours) before starting a query in that session. What happens to a query that runs for 20 minutes in that session?

A. The query is canceled at 10 minutes — for this specific parameter, Snowflake enforces the LOWEST value set across any level (account/user/session/warehouse), not the most specific level, so the account's stricter cap still wins
B. The query runs for the full 2 hours, because the session-level setting is more specific and overrides the account default, like most other session parameters
C. The query fails immediately with a parameter-conflict error, since the two levels disagree
D. The two values are averaged, canceling the query at 65 minutes

**47. [D2]** A team's stored procedures and UDFs run entirely inside Snowflake with no client-side visibility into what's happening mid-execution. They want structured log statements and OpenTelemetry-style trace spans emitted from that handler code to land somewhere queryable with ordinary SQL, without standing up a separate external logging platform. What Snowflake mechanism supports this?

A. Query Profile, since it already shows execution details for every query
B. An Event Table — a Snowflake table object that logging/tracing output from handler code (stored procs, UDFs, Native Apps) is routed into, queryable like any other table
C. The ACCOUNT_USAGE.QUERY_HISTORY view
D. A Stream on the procedure's underlying tables

**48. [D3]** A pipeline lands files in an S3 bucket with cloud-event notifications already wired up (S3 to SQS) for Snowpipe. A separate, unrelated pipeline writes files to an internal Snowflake stage instead of external cloud storage, and still needs near-continuous Snowpipe-style ingestion. Which triggering mechanism should each pipeline use, and why does the second one need a different approach?

A. Both should use auto-ingest via cloud event notifications — internal stages also support S3-style event notifications
B. The S3 pipeline uses auto-ingest (SQS event notifications trigger Snowpipe automatically); the internal-stage pipeline must use the REST API (insertFiles) instead, since cloud storage event notifications aren't available for an internal stage, and REST-API-triggered Snowpipe is the auto-ingest-equivalent option for files landing on an internal stage
C. Both should use the REST API, since auto-ingest doesn't actually improve on manual triggering in either case
D. The internal-stage pipeline should switch to a scheduled Task running COPY INTO, since Snowpipe cannot target internal stages at all

**49. [D4]** Before committing to a specific clustering key for a large, expensive-to-recluster table, an architect wants to check how well-clustered the table already is on a candidate column, quantitatively rather than by eyeballing Query Profile pruning ratios on one sample query. Which built-in function is designed for this diagnostic?

A. SYSTEM$ESTIMATE_QUERY_ACCELERATION
B. SYSTEM$CLUSTERING_INFORMATION(<table>, '(<column(s)>)'), which returns clustering depth and other statistics quantifying how well-clustered the table currently is on the specified column(s)
C. SYSTEM$ESTIMATE_SEARCH_OPTIMIZATION_COSTS
D. SHOW WAREHOUSES

**50. [D5]** A data provider wants to distribute a premium dataset via the Snowflake Marketplace and have consumers billed directly through their existing Snowflake account relationship for accessing it, rather than the provider setting up a separate billing/invoicing system outside of Snowflake. Which Marketplace capability supports this?

A. Paid listings — Marketplace listings that integrate with Snowflake's own billing, so consumers can be charged for access as part of their normal Snowflake billing relationship
B. Private listings, which are always free by definition
C. Reader accounts, which handle all billing arrangements for Marketplace consumers
D. Native Apps, since only application logic (not data) can ever be monetized on the Marketplace

**51. [D1]** A teammate claims that a registered Snowflake ML model object and an installed Native App both live inside a database schema, just like a table does, and can be enumerated the same way (e.g. via SHOW <objects> IN SCHEMA). Is this accurate?

A. Yes — both ML models and installed Applications are schema-scoped database objects
B. No — ML models are schema-scoped but Applications are account-level, like warehouses
C. No — Applications are schema-scoped but ML models are account-level
D. No — both are account-level objects, outside any database

**52. [D2]** A team currently authenticates a legacy automated pipeline using a plain username/password service-account user. Given Snowflake's own move to phase out password-only authentication for service-type accounts, what should the architect do?

A. Leave it as-is, since password authentication remains fully supported indefinitely for all account types
B. Migrate the service account to key-pair (or OAuth/PAT/WIF) authentication before password-based service account logins are disabled
C. Switch the service account to interactive MFA, since that is the only alternative to passwords
D. Convert the service account into a reader account, which does not require authentication

**53. [D3]** A security-conscious team is choosing between a user stage, a table stage, and a named internal stage for a shared ELT landing zone that multiple pipelines and multiple roles need to read from and write to, with a custom file format attached by default. Which stage type fits?

A. The user stage (@~)
B. The table stage (@%table)
C. A named internal stage created via CREATE STAGE
D. Either the user stage or table stage — both support custom file formats and sharing across roles

**54. [D4]** An architect needs to select, per customer, only the single most recent order row, ranked by order_date descending, without wrapping the ranking logic in a subquery or CTE just to filter on it afterward. Which Snowflake-specific SQL construct is designed for this?

A. GROUP BY customer_id HAVING MAX(order_date)
B. QUALIFY ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date DESC) = 1
C. WHERE ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date DESC) = 1
D. DISTINCT ON (customer_id) ORDER BY order_date DESC

**55. [D1]** A stored procedure needs to apply different logic depending on which role invoked it — for example, skipping a sensitive branch of logic unless called by an ADMIN-tier role — without relying on a masking policy or row access policy, since the difference is about which code path executes, not which rows/columns are visible in a result. Which mechanism should the procedure's own logic use?

A. CURRENT_ROLE(), a session context function returning the currently active primary role, checked with a conditional inside the procedure body
B. A network policy scoped to the ADMIN role
C. A resource monitor threshold check
D. The QUERY_TAG session parameter

**56. [D2]** Before dropping a column from a widely-used base table, an architect wants to see, without manually inspecting every downstream view/table definition, which specific views, dynamic tables, and other downstream objects actually depend on that column, to assess blast radius first. Which Snowsight feature is built for this?

A. Trust Center
B. Data lineage — Snowsight's automatic tracking and visualization of object-to-object dependencies, requiring no manual instrumentation
C. ACCOUNT_USAGE.ACCESS_HISTORY alone
D. A resource monitor

**57. [D3]** A team's Parquet ingestion pipeline occasionally receives files with a new column that didn't exist in earlier files, and they want Snowflake to automatically add that new column to the target table during COPY INTO, rather than the load failing or the new field being silently dropped. What must be true for Snowflake's automatic schema evolution to do this?

A. Nothing extra is needed — Snowflake always evolves table schema automatically for any semi-structured format
B. The target table must have ENABLE_SCHEMA_EVOLUTION = TRUE set, the COPY INTO statement must include MATCH_BY_COLUMN_NAME, and the loading role must hold the EVOLVE SCHEMA (or OWNERSHIP) privilege on the table
C. The file format object alone needs SCHEMA_EVOLUTION = TRUE; no table or COPY INTO setting is required
D. Schema evolution only works for CSV files, not Parquet

**58. [D4]** A junior engineer, having read that clustering keys help query performance, adds a clustering key to a 50MB reference/lookup table that's queried frequently but almost always fully scanned (no selective filtering) anyway. What should a senior reviewer point out about this decision?

A. This is a good practice — clustering keys should be added to every frequently-queried table regardless of size
B. This is likely a net negative — clustering keys are only worth the cost on large (multi-TB), frequently-filtered/joined tables; a small table like this sees no meaningful pruning benefit while still incurring ongoing automatic-reclustering credit cost as the table changes
C. Clustering keys have no ongoing cost at all, so there's no downside to adding one regardless of table size or query pattern
D. Clustering keys are free to define but only take effect once Search Optimization Service is also enabled

**59. [D1]** A data platform team ingests data that must remain queryable by both Snowflake and an external Spark job reading the exact same physical files, with the underlying Parquet files staying in the team's own S3 bucket under their own catalog rather than being copied into Snowflake-managed storage. Which table type satisfies this interoperability requirement?

A. A permanent table loaded via COPY INTO
B. An Apache Iceberg table (externally managed)
C. A transient table
D. A dynamic table

**60. [D2]** An architect is designing a resource monitor shared across three teams' warehouses. The requirement: at 80% of quota, alert the team leads by email but let running work continue; at 100%, stop any new queries from starting but let already-running queries finish normally; there is no requirement to forcibly kill in-flight work at any threshold. Which set of threshold actions matches this design?

A. 80% → Suspend Immediately, 100% → Notify
B. 80% → Notify, 100% → Suspend
C. 80% → Suspend, 100% → Suspend Immediately
D. 80% → Notify, 100% → Suspend Immediately

**61. [D3]** A team loading Avro files notices that some fields silently load as NULL, and investigation shows the Avro schema embedded in the files uses a union type for optional fields (e.g. ['null', 'string']), which Snowflake's Avro reader handles differently than a plain scalar field. What is the most likely root cause the architect should investigate first?

A. Avro is not a supported semi-structured format for COPY INTO
B. The VARIANT column's 16MB size limit was exceeded for those rows
C. A mismatch between how Snowflake's Avro parser resolves the union/nullable-field schema and the actual data, causing those specific fields to not map into VARIANT as expected
D. PURGE = TRUE deleted the files before the union fields could be parsed

**62. [D4]** A JSON payload loaded into a VARIANT column contains a nested array of line-item objects per order, and the team needs one output row per line item (exploded), each carrying the parent order's order_id alongside the line item's own fields. Which construct is designed for this?

A. A LATERAL FLATTEN(input => order_payload:line_items) join against the source table
B. CAST(order_payload AS ARRAY)
C. GROUP BY order_payload:line_items
D. A UNION ALL of one SELECT per possible line-item field

**63. [D1]** An architect is choosing warehouse configurations for three workloads: (1) a standard SQL-heavy BI/reporting workload where better price/performance on the same warehouse type would help, (2) a memory-intensive Snowpark Python feature-engineering job that regularly spills to disk even at adequate size, and (3) a plain ad-hoc analyst workload with nothing unusual about it. Which pairing is correct?

A. (1) Standard Gen 2, (2) Snowpark-Optimized, (3) Standard Gen 1 or Gen 2 — either works, sized to the workload
B. (1) Snowpark-Optimized, (2) Standard Gen 2, (3) Standard Gen 1
C. All three should use Snowpark-Optimized, since it is a strict superset of Standard's capabilities
D. (1) Standard Gen 1, (2) Standard Gen 2, (3) Snowpark-Optimized

**64. [D2]** A masking policy needs to show a customer's full email address to roles ANALYTICS_ADMIN and PII_ADMIN, a partially-redacted version to CUSTOMER_SUPPORT, and a fully masked placeholder to every other role — all as one policy body evaluated at query time against a single underlying column. Which construct does the masking policy's body typically use to express this role-dependent branching?

A. Three separate masking policies, one per role, all attached to the same column simultaneously
B. A CASE WHEN CURRENT_ROLE() IN (...) THEN ... ELSE ... END expression inside the single masking policy's body, returning different output per branch
C. A row access policy layered on top of the masking policy
D. Three physical copies of the column, one per access tier

**65. [D3]** An architect is comparing the cost model of a nightly batch load (a Task running COPY INTO on a dedicated warehouse) against Snowpipe for a different, continuously-arriving-files workload. What is the fundamental difference in how each is billed?

A. Both are billed identically — per-second warehouse compute credits, since Snowpipe internally uses a hidden warehouse too
B. The Task/COPY INTO approach bills standard per-second virtual warehouse compute credits (sized and controlled by the customer); Snowpipe bills for actual serverless compute-seconds consumed on Snowflake-managed compute the customer doesn't size or provision, appropriate for continuous, variable-volume ingestion
C. Snowpipe is entirely free; only warehouse-based COPY INTO incurs any charge
D. The Task/COPY INTO approach is always cheaper regardless of workload shape, since Snowpipe adds a fixed per-file surcharge

**66. [D4]** A leaderboard query ranks customers by total_spend descending. Three customers are tied for the second-highest total_spend. The team wants the tied customers to all show rank '2', and the very next distinct customer to show rank '3' (not '5'), with no gaps in the rank sequence. Which window function produces this behavior?

A. ROW_NUMBER() — assigns strictly unique, sequential numbers with no ties possible, so the three tied customers would incorrectly get 2, 3, and 4
B. RANK() — the tied customers would all get rank 2, but the next distinct customer would jump to rank 5 (skipping 3 and 4, to account for the 3 tied rows)
C. DENSE_RANK() — the tied customers all get rank 2, and the next distinct customer gets rank 3, with no gap in the rank sequence
D. LAG() — returns a prior row's value, not a rank at all

**67. [D1]** An architect needs a table to hold intermediate ETL staging results that must survive session end and be queryable by a downstream task the next morning, but the data is fully reproducible from source and the team wants to avoid paying for the extra 7-day Fail-safe retention period that applies to permanent tables. Which table type fits best?

A. Temporary table
B. Transient table
C. Permanent table with DATA_RETENTION_TIME_IN_DAYS = 0
D. External table

**68. [D2]** A cost-conscious platform team wants an absolute hard stop that kills even currently-running queries the instant a runaway warehouse hits 150% of its monthly credit quota, to cap a worst-case billing incident regardless of what's mid-execution. Which resource monitor action achieves this?

A. Notify
B. Suspend
C. Suspend Immediately
D. A tag-based masking policy on the warehouse

**69. [D3]** A team is building a real-time inventory dashboard with a Node.js backend service that needs to query Snowflake directly and stream results to a web frontend, on infrastructure where installing and managing an ODBC driver manager is not desired. Which connectivity option fits best?

A. The Snowflake ODBC driver, wrapped via a generic Node.js ODBC bridge library
B. The Snowflake Node.js driver, which talks to Snowflake's REST-based protocol natively without an ODBC driver manager
C. SnowSQL invoked as a child process from the Node.js service
D. The Snowflake Kafka connector

**70. [D4]** A pipeline loading VARIANT data starts failing on a subset of source records, and investigation shows the failing values are individual JSON documents exceeding roughly 16MB after compression. What is the correct explanation?

A. VARIANT columns have a maximum size per value of approximately 16MB compressed, and oversized documents must be restructured (e.g. split, or moved to unstructured file storage) before loading
B. VARIANT has no size limit; the failure must be an unrelated file-format misconfiguration
C. The 16MB limit applies only to ARRAY-typed columns, not VARIANT
D. Increasing the warehouse size raises the per-value VARIANT size limit

**71. [D1]** A BI warehouse serving hundreds of concurrent dashboard users must never run with fewer than 3 active clusters, even during quiet periods, because cold-starting a new cluster from zero adds a few seconds of latency the team wants to avoid entirely for any burst of traffic. Which multi-cluster warehouse setting directly enforces this 'always at least N clusters running' floor?

A. MAX_CLUSTER_COUNT, set to 3
B. MIN_CLUSTER_COUNT, set to 3
C. The Standard scaling policy alone, with no explicit cluster-count setting
D. AUTO_SUSPEND, set to 0

**72. [D2]** A sales table needs row-level security so each REGIONAL_MANAGER role only sees rows for their own assigned region(s), where the region-to-role assignment itself is maintained in a separate control table that changes over time as managers are reassigned — without hard-coding region names into the policy's SQL text. Which pattern should the row access policy's body use?

A. The policy body hard-codes each region name in a long CASE statement, updated manually whenever an assignment changes
B. The policy body joins/looks up CURRENT_ROLE() (or CURRENT_USER()) against a separate mapping table of role-to-region assignments, returning TRUE only for rows whose region matches an assignment found in that table
C. A masking policy is layered underneath the row access policy to handle reassignment
D. A new row access policy is created and re-attached every time a manager's region assignment changes

**73. [D3]** A data scientist is building a feature-engineering pipeline over a multi-billion-row table: heavy transformations, joins, and aggregations far too large to pull to a client machine. She's deciding between the Snowflake Python connector and Snowpark for Python. Which should she use for the transformation logic itself, and why?

A. The Python connector, since it's the official, general-purpose driver for any Python-Snowflake interaction
B. Snowpark for Python, since its DataFrame API pushes transformation logic down to execute inside Snowflake's own compute, avoiding pulling the multi-billion-row dataset to the client at all — unlike the Python connector, which is built around executing SQL and fetching result sets back to the client
C. Either works identically for this use case; the choice is purely stylistic
D. The Python connector, because Snowpark requires exporting data to an external Spark cluster first

**74. [D4]** A VARIANT column line_items contains a nested array of items per order, but some orders legitimately have an empty array (a valid business state, not missing data). A LATERAL FLATTEN(input => order_payload:line_items) join explodes line items per order, but orders with an empty array disappear entirely from the output, when every order actually needs to appear at least once (with NULLs for the line-item fields on empty-array orders). What FLATTEN option fixes this?

A. FLATTEN's default behavior already includes empty-array rows; the issue must be elsewhere
B. OUTER => TRUE on the FLATTEN call, which performs an outer-join-style flatten, preserving one output row (with NULL exploded fields) for input rows where the array is empty or NULL, instead of dropping them entirely
C. RECURSIVE => TRUE, which handles nested empty arrays specifically
D. MODE => 'OUTER', a file-format-level setting unrelated to FLATTEN

**75. [D1]** A reporting team wants a target table that automatically stays refreshed from a join of two source tables, expressed as a single declarative SQL query, with Snowflake handling the incremental refresh logic so no custom Stream+Task procedural code has to be written or maintained. Which table type should they use?

A. Materialized view
B. Dynamic Table
C. External table
D. Transient table

**76. [D2]** An architect needs to audit login activity from 45 days ago for a security investigation. A query against INFORMATION_SCHEMA.LOGIN_HISTORY returns no rows for that period. What is the most likely explanation and correct fix?

A. LOGIN_HISTORY doesn't track failed logins, only successful ones — use LOGIN_HISTORY_BY_USER instead
B. INFORMATION_SCHEMA has a limited retention window; the architect should query SNOWFLAKE.ACCOUNT_USAGE.LOGIN_HISTORY instead, which retains much longer history
C. The account's Time Travel retention has expired for that data
D. Login history is only available at the ORGADMIN level, not to a standard investigator role

**77. [D3]** A company streams high-volume clickstream events from Kafka topics and wants the lowest-latency path into Snowflake, avoiding intermediate file staging before the data becomes queryable. Which connector configuration should the architect choose?

A. The Kafka connector configured to use Snowpipe (file-based micro-batch) ingestion, since it is the only mode the connector supports
B. The Kafka connector configured to use Snowpipe Streaming mode, which pushes rows directly without first staging files
C. The Spark connector reading from Kafka and batch-writing via COPY INTO every hour
D. The JDBC driver with a custom polling loop against the Kafka topic

**78. [D4]** A single shared warehouse runs both a nightly heavy transformation job (long-running, resource-intensive) and a live customer-facing dashboard that must stay consistently fast. On nights the transformation job runs, dashboard queries slow down noticeably even though total credit spend is a concern the team doesn't want to just throw more compute at blindly. What is the most appropriate first fix?

A. Increase QUERY_ACCELERATION_MAX_SCALE_FACTOR on the shared warehouse
B. Split the workloads onto separate, independently-sized warehouses, so the heavy transformation job can no longer contend with the dashboard's warehouse for compute
C. Enable Search Optimization Service on the dashboard's underlying tables
D. Increase the shared warehouse's auto-suspend timeout

**79. [D1]** A single, moderately complex query runs on an X-Large warehouse noticeably faster than the identical query on an X-Small warehouse, even though both are a single warehouse running one query at a time (no concurrency involved). What internal mechanism explains this?

A. An X-Large warehouse is a single, more powerful physical machine with a faster clock speed
B. An X-Large warehouse is a cluster of more/larger compute nodes; the single query's work (scans, joins, aggregations) is split and executed in parallel — MPP, massively parallel processing — across those nodes rather than run on one node alone
C. Warehouse size only affects concurrency (how many queries run at once), never the speed of any single query
D. The extra size is used entirely for caching more data, with no effect on execution parallelism

**80. [D2]** A platform team wants: (a) one hard account-wide credit ceiling covering everything in the account, and (b) three of their dozen warehouses (the heaviest ETL warehouses) sharing one additional, tighter pooled quota among just those three. Is this combination of monitor scopes possible, and how many account-level monitors can exist?

A. Not possible — an account can only have one resource monitor total, of either type
B. Possible — an account can have exactly one account-level resource monitor (covering the whole account) plus any number of warehouse-level monitors, each assignable to one or more warehouses sharing a single pooled quota (though each warehouse can only belong to one monitor at a time)
C. Possible, but only if all monitors are account-level; warehouse-level monitors don't support multiple warehouses
D. Not possible — resource monitors can only ever be scoped to exactly one warehouse each

**81. [D3]** A lightweight serverless function (e.g. an AWS Lambda) needs to submit a single parameterized SQL statement to Snowflake and get results back over plain HTTPS, without installing a full driver/connector library or maintaining a persistent session inside the function's minimal runtime. Which Snowflake connectivity option fits best?

A. The Snowflake SQL API — a REST API for submitting SQL statements and retrieving results over stateless HTTPS requests, without needing a driver installed
B. The JDBC driver, since Java-based drivers work in any serverless runtime
C. SnowSQL, invoked as a subprocess inside the Lambda's execution environment
D. The Kafka connector, reconfigured for one-off statement submission

**82. [D4]** After flattening line items out of a nested VARIANT structure to apply row-level transformations, a downstream consumer needs the data re-nested back into one JSON array-of-objects per order (the reverse of FLATTEN) before being written to an output file. Which pair of functions is designed to rebuild that nested structure from flat rows?

A. FLATTEN() called a second time, in reverse mode
B. OBJECT_CONSTRUCT() to build each line item back into a JSON object, combined with ARRAY_AGG() to collect those objects back into one array per order (grouped by order_id)
C. TO_VARIANT() alone, applied to the whole result set
D. QUALIFY, applied with an OVER (PARTITION BY order_id) clause

**83. [D1]** A single nightly transformation query is taking too long to complete and Query Profile shows heavy bytes spilled to local disk during a large sort/join step, but concurrency on that warehouse is low (only one query runs at a time). What is the correct lever?

A. Enable multi-cluster scaling with a higher MAX_CLUSTER_COUNT
B. Increase the warehouse size (scale up)
C. Switch the scaling policy from Standard to Economy
D. Add a resource monitor with a NOTIFY action

**84. [D2]** A compliance team wants to guarantee that any column classified as containing PII — regardless of which table it's added to in the future, and without anyone having to remember to attach a masking policy manually each time — is automatically masked for roles without a data-steward privilege. Which approach delivers this without per-column manual work?

A. Attach a masking policy directly to every existing PII column today, and remind engineers to repeat this manually on any new PII column
B. Create a tag with an allowed-values constraint, attach a masking policy to the tag itself via ALTER TAG ... SET MASKING POLICY, then simply apply the tag to any column classified as PII
C. Create a row access policy on every table that might contain PII
D. Rely on Time Travel to redact PII columns after 90 days

**85. [D4]** An architect isolates a heavy nightly ELT warehouse from a BI dashboard warehouse, as recommended, but during the day sees the BI warehouse's local disk cache providing little benefit even though the same underlying tables are queried repeatedly with slightly different filter predicates each time. What most likely explains the low cache benefit, if the warehouse was recently resized?

A. The query result cache was disabled account-wide
B. The warehouse's local disk/SSD cache is tied to its underlying physical compute nodes and is lost on suspend or resize, so a recent resize would have discarded previously cached micro-partition data
C. Local disk caching only works for identical repeated queries, not queries touching overlapping data with different filters
D. BI warehouses are ineligible for local disk caching by design

**86. [D1]** A team's requirements are: (a) Search Optimization Service on a high-cardinality lookup column, (b) up to 45 days of Time Travel retention for point-in-time recovery, and (c) no need for HIPAA/PCI compliance support or customer-managed encryption keys. What is the minimum edition that satisfies all of this?

A. Standard
B. Enterprise
C. Business Critical
D. Virtual Private Snowflake (VPS)

**87. [D2]** A role needs to run queries against a warehouse day-to-day, but must NOT be able to manually suspend it, resume it, or abort another user's running query on it — that level of control should stay with the platform team only. Which privilege should be granted to the analyst role, and which one should specifically be withheld?

A. Grant USAGE (lets the role run queries on/using the warehouse); withhold OPERATE (which allows suspending, resuming, and aborting queries on the warehouse)
B. Grant OPERATE; withhold USAGE — OPERATE alone is sufficient to run queries
C. Grant MODIFY; withhold USAGE
D. Both USAGE and OPERATE must always be granted together — they can't be separated

**88. [D4]** A nightly batch job runs a single large DELETE statement removing tens of millions of rows from a multi-terabyte table based on a moderately selective filter, and it disproportionately dominates the runtime of its warehouse's nightly workload. The team doesn't want to permanently upsize the warehouse just for this one statement. Is Query Acceleration Service a valid option here, given it's a DML statement rather than a SELECT?

A. No — QAS only accelerates SELECT queries; DML statements are never eligible
B. Yes — QAS is eligible for two patterns: large scans with selective filters, and large-volume DML (INSERT/COPY/UPDATE/DELETE), so a large, disproportionately long-running DELETE like this is a legitimate QAS candidate, not just SELECT-based analytical queries
C. Yes, but only for INSERT statements, never DELETE or UPDATE
D. No — only TRUNCATE-style full-table clears are eligible, not filtered DELETEs

**89. [D1]** A BI dashboard warehouse is seeing queries queue during peak morning hours because many analysts run similar dashboard queries concurrently, even though each individual query completes quickly once it starts. What is the correct lever?

A. Increase the warehouse size (scale up)
B. Enable multi-cluster warehouses (scale out)
C. Enable Search Optimization Service on the underlying tables
D. Increase the query result cache retention period

**90. [D4]** A support-desk table gets frequent substring searches on a free-text `notes` column (`WHERE notes LIKE '%refund%'`), plus occasional geospatial radius filters on a `last_known_location` GEOGRAPHY column for a separate field-service table. An engineer assumes Search Optimization Service only helps the first case, since 'search' implies text. Is that assumption correct?

A. Yes — Search Optimization Service is limited to text/substring predicates only; geospatial filtering needs a different feature entirely
B. No — Search Optimization Service's predicate coverage extends beyond text to geospatial GEOGRAPHY predicates as well, alongside equality, IN-lists, substring/regex matches, NULL checks, and semi-structured VARIANT/OBJECT/ARRAY lookups — both scenarios described are within its scope
C. Yes, but only if the geospatial column is first converted to a VARIANT type
D. No — Search Optimization Service only helps geospatial queries, not text substring searches

**91. [D1]** A query filters WHERE event_date = '2026-03-15' against a multi-terabyte, well-clustered events table. Query Profile shows only a small fraction of total micro-partitions were scanned. What per-partition metadata, stored automatically, is what makes this pruning possible — without Snowflake reading the actual data blocks of the excluded partitions?

A. A full row-level index of every value in the partition, similar to a B-tree index
B. Per-partition metadata including the min/max values and distinct-value counts for each column, checked against the filter before any data block is read
C. A bloom filter automatically built for every column on every table
D. The query result cache, which remembers which partitions matched a similar filter previously

**92. [D1]** An architect configures a multi-cluster warehouse with the Economy scaling policy for a workload with bursty but short-lived spikes. A burst of queries arrives that Snowflake estimates will keep an additional cluster busy for only about 3 minutes before demand subsides. What happens?

A. A new cluster starts immediately because any queued query triggers scale-out under Economy
B. No new cluster starts, because Economy only spins one up when estimated queued work would keep it busy for at least 6 minutes
C. A new cluster starts, but only after the queries have waited in queue for exactly 6 minutes
D. Economy policy ignores estimated duration and always waits for the current clusters to be 100% saturated before adding a cluster

**93. [D1]** An engineer needs to add a column to an existing SQL query returning a one-sentence summary of each row's free-text support_ticket_body column, callable inline in a SELECT statement with no separate model training, semantic model definition, or retrieval index to build first. Which Snowflake AI feature fits this exact, lowest-friction requirement?

A. Cortex Analyst, since it's Snowflake's general-purpose AI entry point
B. Snowflake ML, by training a custom summarization model on the ticket text
C. AI SQL functions (e.g. SNOWFLAKE.CORTEX.SUMMARIZE), directly callable inline in SQL with no setup beyond having the data
D. Cortex Search, by indexing the ticket bodies and querying the index per row

**94. [D1]** An architect wants to guarantee that no single team's queries can ever queue behind another team's heavy ad-hoc analytical workload, while keeping each team's own warehouse aggressively auto-suspended to avoid idle billing. Which design best satisfies this?

A. One large multi-cluster warehouse shared by all teams, sized for peak combined load
B. Separate warehouses per team/workload type, each individually sized and auto-suspended
C. A single warehouse with MAX_CLUSTER_COUNT raised to the maximum allowed for its size
D. A single Snowpark-Optimized warehouse shared by all teams for better memory headroom

**95. [D1]** A team currently has an External table over Parquet files in their own S3 bucket, giving Snowflake a read-only, metadata-driven view of those files. A new requirement: a Snowflake job must now WRITE its transformed output back into that same open file format, in that same bucket, so both Snowflake and an external Spark job can read the updated files afterward. Can the existing External table satisfy this, and if not, what should replace it?

A. Yes — External tables support INSERT/MERGE natively; no change is needed
B. No — External tables are read-only, metadata-only pointers to externally-produced files; the team needs an Apache Iceberg table instead, which lets Snowflake act as both a query and write engine over the open format
C. No — the team must abandon the open format entirely and load the data into a permanent Snowflake-managed table
D. Yes, but only after enabling CHANGE_TRACKING on the External table

**96. [D1]** A healthcare analytics company needs formal HIPAA compliance support and wants to layer a customer-managed encryption key on top of Snowflake's own encryption (Tri-Secret Secure). Which is the minimum edition that satisfies both requirements?

A. Standard
B. Enterprise
C. Business Critical
D. Virtual Private Snowflake (VPS)

**97. [D1]** A company runs five separate Snowflake accounts (dev, staging, prod-US, prod-EU, sandbox) under one Snowflake organization. An administrator needs to provision a brand-new sixth account and view aggregate credit consumption rolled up across all six. Which system-defined role is scoped for this — one that ACCOUNTADMIN in any single account cannot perform, since ACCOUNTADMIN's authority stops at its own account's boundary?

A. SYSADMIN
B. SECURITYADMIN
C. ORGADMIN
D. ACCOUNTADMIN in the sandbox account, since sandbox accounts have elevated cross-account rights

**98. [D1]** A finance team needs materialized views for a set of expensive recurring aggregations, plus the ability to run multi-cluster warehouses to absorb concurrent BI load during month-end close. They do not need HIPAA/PCI support or customer-managed keys. Which is the minimum edition that meets both stated requirements?

A. Standard
B. Enterprise
C. Business Critical
D. Virtual Private Snowflake (VPS)

**99. [D1]** A team notices a Large warehouse retains noticeably more previously-scanned micro-partitions in its local cache before eviction than a same-workload X-Small warehouse did, even running the identical repeated query pattern. What architectural fact explains this?

A. The local disk (SSD) cache's available capacity scales with warehouse size, since a bigger warehouse has more/larger compute nodes and therefore more aggregate local SSD storage to cache data on
B. Warehouse size has no effect on caching; the difference must be due to the result cache instead
C. Larger warehouses receive a longer cache retention window (in hours) than smaller ones
D. The metadata cache, not the local disk cache, is what scales with warehouse size

**100. [D1]** An architect is asked to justify why an account should move to Virtual Private Snowflake (VPS) rather than staying on Business Critical, given that the workload already has HIPAA support, Tri-Secret Secure, and cross-region replication/failover in place. Which additional requirement would actually justify the VPS jump?

A. Needing up to 90-day Time Travel retention
B. Needing multi-cluster warehouses for concurrency
C. Needing a fully isolated, dedicated virtual server instance separate from Snowflake's multi-tenant infrastructure, for regulatory reasons
D. Needing row access policies for row-level security

---

## Answer Key & Explanations

1. **B — The Snowflake CLI (snow).** The Snowflake CLI is the DevOps-oriented client with native support for Snowpark/Native App project definitions and deploy-style workflows; SnowSQL is a plain scripted SQL client and Snowsight is a browser UI, neither built for project-based deployment automation.
2. **B.** A future grant is registered against the container (the schema) and applies to any qualifying object type created in it afterward, independent of which specific role performs the CREATE — that's the entire point of future grants versus one-off grants on existing objects.
3. **A.** COPY INTO supports a SELECT-based transformation form (COPY INTO <table> FROM (SELECT $1, TO_DATE($3), $2 FROM @stage/file.csv)) that lets you reorder columns and apply expressions during the load — plain positional COPY INTO with no SELECT can't reorder or transform columns, and MATCH_BY_COLUMN_NAME depends on header-driven semi-structured/CSV-with-header matching, not arbitrary expressions.
4. **B — Search Optimization Service on ticket_id.** Search Optimization Service is purpose-built for highly selective equality/point-lookup queries on columns that don't naturally benefit from clustering — exactly this pattern — building a specialized access path rather than relying on micro-partition co-location, which clustering can't achieve for a high-cardinality, insert-order-independent key.
5. **C.** Cross-region/cross-account database or account replication, with failover promoting a secondary to primary, is the disaster-recovery mechanism for exactly this scenario, and it requires Business Critical edition or higher — cloning and Time Travel address accidental data loss/point-in-time recovery within one account, not cross-region failover.
6. **A.** Snowflake waives Cloud Services charges up to 10% of that day's total virtual warehouse compute credit consumption, calculated daily in UTC; only usage above that 10% threshold bills separately at the same credit rate as compute. Here 10% of 850 is 85, so of the 100 Cloud Services credits, the first 85 are free and the remaining 15 bill separately.
7. **B.** OAuth is designed for exactly this delegated-access pattern — a third-party application obtains a short-lived, per-user access token (via Snowflake's own built-in OAuth authorization server, or an external OAuth provider like an existing corporate IdP) rather than storing a long-lived credential, while sessions still run under that specific user's own role/privileges. A shared key-pair or service account would collapse every user down to one identity, losing per-user RBAC enforcement and audit trail.
8. **A.** Standard (delta) streams cannot retrieve change data for geospatial data, so append-only streams are the documented recommendation for objects with geometry/geography columns — though append-only only tracks row inserts, not updates/deletes/truncates. Separately, INSERT_ONLY = TRUE streams are a distinct type that can only be created on external tables, tracking only new file-backed row inserts and explicitly not tracking removals.
9. **B.** The result cache is invalidated (not used) for queries involving non-reusable/non-deterministic functions such as UUID_STRING() and RANDOM() — since the whole point of those functions is to produce a different value on every call, reusing a stale cached result would be actively wrong, so Snowflake always re-executes such queries rather than serving a cached row set.
10. **B.** A Failover Group specifically supports promoting a secondary to primary in a disaster-recovery scenario, and requires Business Critical edition or higher; a Replication Group provides read-only replicated copies without failover/promotion support, and carries fewer edition restrictions — the right fit for read-only regional copies with no intent to ever promote them. An object can be in multiple Replication Groups (each replicated to a different target account) but cannot be in both a Failover Group and a Replication Group at once, and cannot belong to more than one Failover Group.
11. **A — Snowsight.** Snowsight is Snowflake's web UI, purpose-built for interactive worksheets, dashboards/visualizations, and Marketplace browsing in one place; the other options are scripted or driver-level tools with no built-in visualization or Marketplace browsing.
12. **B — A database role.** Database roles are scoped to a single database and can be granted privileges on objects within it; because they're defined inside the database itself, they travel with it into a share or a replicated copy, unlike account roles which live independently of any one database.
13. **B.** MATCH_BY_COLUMN_NAME tells COPY INTO to map source fields (JSON keys, or CSV columns with a header) to target table columns by name rather than strict positional order, avoiding a hand-written SELECT/expression list for a simple name-based mapping.
14. **B — A materialized view over the aggregation.** A materialized view precomputes and automatically keeps in sync an expensive aggregation over data that changes infrequently — exactly the stated profile — so repeat executions read the precomputed result instead of recomputing the full join/aggregation every 15 minutes.
15. **B.** A direct share to specific named consumer accounts is the baseline provider-to-consumer sharing pattern; since each partner already has its own Snowflake account, they can query with their own compute (their own bill), which rules out reader accounts (for consumers without a Snowflake account, billed to the provider) and avoids the broader, unnecessary visibility of a Marketplace listing.
16. **B.** Each resume-from-suspend bills a minimum of 60 seconds of warehouse time regardless of how short the actual query is, then per-second thereafter. Five resumes here means 5x60=300 billed seconds even though total actual execution was only 50 seconds. At 2 credits/hour (2/3600 credits per second), 300 seconds is about 0.167 credits — exactly why frequent, disconnected tiny queries against an aggressively auto-suspended warehouse can be less credit-efficient than batching or a slightly longer suspend window for bursty-but-frequent access patterns.
17. **B.** QUERY_TAG is a session (or statement-level) parameter designed to stamp a free-text label onto every query run under it, which then shows up in QUERY_HISTORY/ACCOUNT_USAGE for exactly this kind of per-job/per-pipeline cost and performance attribution — distinct from object tagging (which classifies persistent objects like tables/warehouses, not individual query executions) or a resource monitor (which governs credit thresholds, not per-query labeling).
18. **A.** Serverless Tasks use Snowflake-managed compute automatically sized to the workload and billed only for actual usage — a good fit for small, variable, unpredictable workloads where manually sizing/managing a dedicated warehouse isn't worth the overhead. A user-managed Task runs on a warehouse the team specifies and controls, fitting a heavy, consistent, predictable workload where they've already tuned a warehouse and want billing tied to that familiar resource.
19. **B.** Result cache eligibility is gated by whether the querying role holds the necessary privileges on the objects involved (plus other invalidation conditions like exact syntax match and unchanged underlying data) — it is not tied to the specific user or session that first ran the query. A different user/role with equivalent privileges on the same objects can legitimately hit a cache entry another user generated, for ordinary queries.
20. **C.** Time Travel's BEFORE(STATEMENT => '<query_id>') clause is built for exactly this case — reconstructing a table's state immediately before a known statement (identified by query ID, from QUERY_HISTORY) executed, more precise than guessing a wall-clock timestamp or offset when the exact triggering statement is already known. AT(OFFSET/TIMESTAMP) clauses work relative to time values instead, and UNDROP restores a dropped object entirely, not a mid-history state query.
21. **A — SnowSQL.** SnowSQL remains a fully supported, simple scripted CLI client for exactly this kind of file-based batch execution; it doesn't force adoption of the newer Snowflake CLI's project-management model when none of that is needed.
22. **B.** A network policy attached to an individual user overrides the account-level network policy for that user's sessions — this lets an architect set a broad account-wide baseline while carving out specific, narrower exceptions per user without loosening the account-wide default for everyone else.
23. **B.** COPY INTO <location> unloads in parallel across the warehouse's compute nodes by default, producing multiple files up to MAX_FILE_SIZE each; SINGLE = TRUE would force exactly one output file, which is the opposite of what's wanted here.
24. **A — Query Acceleration Service.** Query Acceleration Service transparently offloads eligible portions of an outlier query — large scans with selective filters, or large-volume DML — to additional serverless compute without resizing the warehouse itself, which is exactly the 'occasional outlier, don't permanently upsize' scenario described.
25. **B.** A Data Clean Room is exactly this pattern — privacy-preserving joint analysis where neither party sees the other's raw rows, enforced via secure views/UDFs and governance policies (such as aggregation policies enforcing a minimum group size) rather than by sharing raw tables directly.
26. **A.** Snowflake Notebooks is the cell-by-cell, mixed Python/SQL, iterative development environment inside Snowsight, purpose-built for live exploratory workflows; Streamlit in Snowflake is for building and hosting a polished, multi-page interactive application once the logic is finalized. Snowpark is the underlying Python/Java/Scala pushdown execution framework both can build on, not itself an interactive UI; SnowSQL is a plain scripted CLI client with no notebook or Python-cell support.
27. **B.** An Alert is a scheduled condition-check object — it evaluates a SQL expression on a schedule and only fires its action (e.g. sending a notification) when the condition evaluates true, exactly the 'check a threshold, notify only if breached' pattern. A plain Task would need custom procedural logic to replicate this itself; a resource monitor only tracks credit usage; a Stream tracks row-level changes, not aggregate threshold checks.
28. **B.** An External Volume is the account-level object specifically required for Iceberg tables — it stores the IAM/identity reference Snowflake uses to securely reach the external storage location holding the table's data files and Iceberg metadata/manifest files. A single external volume can back multiple Iceberg tables, but it must exist before CREATE ICEBERG TABLE can succeed for an externally-managed table.
29. **B.** Results larger than 100KB use a separate access token to retrieve the cached data, and that token specifically expires after 6 hours — independent of the underlying result's own 24-hour, extendable-to-31-day cache retention. A client can request a fresh token to keep accessing the same still-cached large result past that 6-hour token window.
30. **B.** Secure Data Sharing works directly only within the same cloud region and provider, since the mechanism relies on the consumer querying the provider's storage location live with zero data movement — that doesn't span cloud regions/providers on its own. To share across regions or clouds, the data must first be replicated into an account that sits in the consumer's own region/provider, after which a direct share (or listing) can be set up from there — replication and sharing are two distinct, composable mechanisms.
31. **C — Virtual warehouses.** Virtual warehouses are account-level compute objects, not contained in any database or schema. Pipes, Sequences, and UDFs are all schema-scoped objects.
32. **C.** Snowflake's network policy precedence, most specific to least specific, is: security-integration-level policy, then user-level policy, then account-level policy. A policy on the security integration overrides even a user-level policy for connections made through that integration.
33. **A.** Automatic external table refresh depends on cloud storage event notifications being wired up (e.g. S3 event → SQS); without that integration, the external table's file-list metadata is only synchronized when ALTER EXTERNAL TABLE ... REFRESH is run, manually or on a schedule via a task.
34. **A.** A Dynamic Table is the declarative alternative to exactly this pattern — a single-query transformation with a staleness tolerance — letting Snowflake compute and run the incremental refresh automatically instead of the team hand-maintaining a Stream, a MERGE statement, and a Task schedule.
35. **B.** A Native App is distributed through the Marketplace but installs and runs entirely inside the consumer's own account — their compute, their data staying put — which is what distinguishes it from a plain data listing (which only distributes data access, not running application logic/UI).
36. **B.** A Git integration lets a Snowflake account connect directly to a version-controlled repository so objects can be created/deployed straight from it, and the Snowflake CLI is the DevOps-oriented client built around project definitions for exactly this kind of deploy workflow — together they enable genuine repo-as-source-of-truth CI/CD without a manual stage-upload step. SnowSQL and the JDBC driver have no native Git-repo awareness, and Snowsight's worksheet import is a manual, UI-driven action, not CI-automatable.
37. **A.** A Notification Integration is the account-level object that defines and authorizes an outbound delivery channel (email, or a cloud provider's messaging/webhook service) that Alerts, Tasks, and other Snowflake-native event sources can push through — the piece that actually gets a message out of Snowflake to an external destination, as opposed to the Alert object, which only decides when to fire.
38. **B.** MATCH_BY_COLUMN_NAME works by matching source field names to target table column names — for CSV, JSON, Parquet, and Avro files with headers, that requires an actual header row (or equivalent embedded schema) to read the names from. Without a header row present in the CSV, there's no source column name to compare against the target's column names, so the option can't do its job as intended — it isn't a fallback-to-positional or auto-inferred mechanism.
39. **B.** Clustering key column order determines the co-location hierarchy — the leading column is the primary sort/grouping dimension across micro-partitions. A query filtering only on a non-leading column doesn't benefit from that primary co-location the way filtering on the leading column does — matching the clustering key's column order to the dominant filter pattern (event_date first, here) is the standard fix, not adding an unrelated column or reaching for Search Optimization Service.
40. **A.** A secure UDF works the same way a secure view does — its definition is hidden from consumers who lack privilege to see it — letting a provider share reusable derived logic (a scoring function, a business calculation) as a callable object without exposing the underlying implementation. A plain UDF's definition is visible to anyone with USAGE privilege by default, unlike a secure UDF's hidden-definition guarantee; Streams and masking policies serve entirely different purposes.
41. **A — A Pipe.** A Pipe is the schema-level object that wraps a COPY INTO statement and is the object Snowpipe actually executes against; stages hold the files, but the Pipe is what drives the ingestion.
42. **B.** Key-pair authentication needs no interactive MFA step, making it suited to unattended automation, and Snowflake supports two public-key slots per user specifically so a new key can be registered and cut over to before the old one is removed — zero-downtime rotation. MFA and SSO both assume an interactive human step.
43. **A.** A storage integration lets Snowflake assume a cloud-provider IAM role rather than embedding static credentials in the stage DDL — the credential itself never appears in SQL text, isn't tied to any one stage, and role-based cloud IAM handles the security boundary instead of a shared secret needing manual rotation.
44. **B — APPROX_COUNT_DISTINCT(user_id).** APPROX_COUNT_DISTINCT uses a HyperLogLog-based algorithm that is much cheaper than an exact COUNT(DISTINCT) at large scale, trading a small, well-understood margin of error for significantly less compute — the right tradeoff for a frequently-refreshed dashboard where exact precision isn't required.
45. **B.** Zero-copy cloning is a metadata-only operation that completes instantly regardless of source size and consumes no extra storage until the clone diverges from the source (copy-on-write) — exactly the low-cost, low-latency full-fidelity dev/test copy pattern described; a COPY INTO unload/reload would be slow and fully duplicate storage immediately.
46. **A.** Unlike most Snowflake parameters, where the most specific level set simply overrides broader ones, STATEMENT_TIMEOUT_IN_SECONDS is documented to enforce the lowest configured value across every level where it's set (account, user, session, and warehouse) — a deliberate safety/cost-control design so a session can't unilaterally grant itself more runway than an administrator's cap allows. The account's 600-second cap still wins here even though the session tried to set a much higher value.
47. **B.** Snowflake supports structured logging and tracing emitted directly from handler code, routed into an Event Table — an ordinary, SQL-queryable table that becomes the destination for observability data, letting a team debug in-platform code without exporting to an external logging system. Query Profile shows per-query execution-plan diagnostics, not custom log/trace output; QUERY_HISTORY tracks query metadata, not custom log statements; Streams track table row changes.
48. **B.** Auto-ingest relies on the cloud provider's own event-notification service (S3->SQS, Azure Event Grid, GCP Pub/Sub) watching an external stage's cloud storage location — that mechanism doesn't exist for an internal stage, which isn't backed by the customer's own cloud storage account. For files landing on an internal stage, explicitly calling the Snowpipe REST API (insertFiles) to trigger ingestion is the standard approach — Snowpipe does support internal stages, just not via cloud-event auto-ingest.
49. **B.** SYSTEM$CLUSTERING_INFORMATION returns quantitative clustering statistics (including clustering depth — roughly how many micro-partitions on average must be scanned to find all rows matching a given value) for a table on a candidate column set, letting an architect evaluate clustering quality objectively before committing to a clustering key — distinct from SYSTEM$ESTIMATE_QUERY_ACCELERATION (QAS eligibility) and SYSTEM$ESTIMATE_SEARCH_OPTIMIZATION_COSTS (Search Optimization Service cost estimation).
50. **A.** Paid listings are Marketplace listings configured to integrate with Snowflake's own billing, letting a provider charge consumers for access without standing up a separate external billing/invoicing system — the consumer's charge flows through their existing Snowflake account relationship. Private listings can be paid or free independent of their visibility scope; reader accounts are an unrelated no-Snowflake-account sharing mechanism where the provider (not a billing system) pays compute; Native Apps can also be monetized via paid listings.
51. **A.** Both registered ML model objects and installed Native App Applications are schema-level database objects in Snowflake's object hierarchy, alongside tables, pipes, and sequences — not account-level objects like warehouses or resource monitors.
52. **B.** Snowflake has been phasing out username/password login for service-type accounts in favor of key-pair, OAuth, programmatic access tokens (PAT), or workload identity federation (WIF) — an architect should proactively migrate rather than wait for the credential to stop working. MFA is designed for interactive human logins, not unattended jobs, and reader accounts are an unrelated concept (a data-sharing construct, not an auth method).
53. **C.** Only a named internal stage is shareable across roles/pipelines and supports an attached custom file format; the user stage is private to one user and the table stage is tied to a single table, neither is shareable, and the table stage in particular doesn't support a custom file format.
54. **B.** QUALIFY lets you filter directly on a window function's result in the same query, without wrapping it in a subquery or CTE first — a WHERE clause can't reference a window function directly since window functions are evaluated after WHERE, which is exactly the gap QUALIFY closes.
55. **A.** CURRENT_ROLE() (alongside similar session-context functions like CURRENT_WAREHOUSE() and CURRENT_USER()) returns live session state that procedural code can branch on directly — the right tool when the decision is about which code path executes, not which rows/columns a query result may contain (that's what masking/row-access policies govern). Network policies control connection-level IP access, resource monitors govern credit thresholds, and QUERY_TAG is a cost-attribution label — none drive in-procedure conditional logic.
56. **B.** Data lineage is Snowsight's built-in, automatic tracking and visualization of which objects feed which downstream objects — exactly the 'what depends on this before I break it' impact-analysis need, with no manual tagging or instrumentation required. Trust Center is a security-posture dashboard, unrelated to dependency graphs; ACCESS_HISTORY records what was accessed but doesn't give the same visual object-dependency graph lineage provides.
57. **B.** Automatic schema evolution requires all three pieces together: the target table configured with ENABLE_SCHEMA_EVOLUTION = TRUE, the COPY INTO statement including MATCH_BY_COLUMN_NAME so Snowflake can identify new fields by name, and the executing role holding EVOLVE SCHEMA or OWNERSHIP privilege on the table. This is supported for Parquet, Avro, CSV, JSON, and ORC — not just CSV.
58. **B.** Automatic reclustering runs in the background and consumes real credits to maintain a clustering key's co-location as a table changes — a cost only worth paying on large, frequently-filtered/joined tables where it meaningfully improves pruning. A small table that's mostly fully scanned anyway gains little to no pruning benefit, so the ongoing reclustering credit spend is pure overhead — the textbook clustering-key anti-pattern.
59. **B — An Apache Iceberg table (externally managed).** An Iceberg table lets Snowflake act as a query/write engine over externally-managed open Iceberg-format files, so the same physical files stay readable by other engines like Spark — a permanent or transient table would ingest a Snowflake-proprietary copy instead.
60. **B — 80% → Notify, 100% → Suspend.** Notify sends an alert without stopping anything (fits the 80% requirement), and Suspend stops new queries from starting while letting already-running queries finish (fits the 100% requirement) — Suspend Immediately would additionally kill in-flight queries, which the requirement explicitly rules out.
61. **C.** Avro is a fully supported semi-structured file format, but its typed schema (including union types for nullable/optional fields) means schema-resolution mismatches between the embedded Avro schema and Snowflake's parser are a real, specific class of loading issue — worth investigating directly rather than assuming a generic size or support-level problem.
62. **A.** FLATTEN (typically used with LATERAL) explodes a nested VARIANT array or object into one row per element while preserving access to the outer row's other columns like order_id — exactly the one-row-per-line-item-with-parent-context pattern described.
63. **A.** Standard Gen 2 offers better price/performance than Gen 1 for typical SQL workloads on the same warehouse type; Snowpark-Optimized warehouses add extra memory per node specifically to reduce spilling on memory-intensive Snowpark/ML workloads; a plain ad-hoc workload has no reason to pay the Snowpark-Optimized premium — either Standard generation, sized appropriately, is the right (and cheaper) fit.
64. **B.** A masking policy body is itself a SQL expression (typically a CASE statement) evaluated per row at query time; branching on CURRENT_ROLE() (or a role-hierarchy check) inside that single CASE expression is the standard way to return different masked/unmasked output per calling role, all from one policy object and one underlying copy of the data — not multiple policies or physical duplicates, which would defeat the point of dynamic masking.
65. **B.** A Task running COPY INTO on a customer-managed warehouse bills standard virtual-warehouse compute credits, which the customer sizes and controls (and pays for even if underutilized); Snowpipe runs on Snowflake-managed serverless compute billed by actual compute-seconds consumed, with no warehouse to size — a better cost fit for continuous, unpredictable-volume ingestion where a dedicated always-on warehouse would often sit idle or be mis-sized.
66. **C.** DENSE_RANK() assigns the same rank to tied rows and leaves no gap in the sequence afterward — exactly the 'tied customers all show 2, next distinct value shows 3' requirement. RANK() also ties rows together but then skips ahead by the number of tied rows; ROW_NUMBER() never produces ties, arbitrarily breaking them into distinct sequential numbers; LAG() is an entirely different window function for accessing a preceding row's value.
67. **B — Transient table.** A transient table persists beyond a session (unlike a temporary table) but skips Fail-safe entirely, which is exactly the cost tradeoff wanted for reproducible, non-critical intermediate data; a permanent table still incurs Fail-safe regardless of its Time Travel setting.
68. **C — Suspend Immediately.** Suspend Immediately is the only action that terminates already-running queries in addition to blocking new ones — the strictest of the three threshold actions, appropriate for a true hard-stop/worst-case-cap scenario.
69. **B.** The Snowflake Node.js driver connects natively over Snowflake's own protocol, avoiding the extra operational dependency of installing and maintaining an ODBC driver manager just to bridge into a JavaScript runtime; the Kafka connector and SnowSQL-as-subprocess are both the wrong tool for a request/response application backend.
70. **A.** VARIANT values have a documented maximum size of roughly 16MB compressed; a document exceeding that must be restructured before it can load into a VARIANT column — this is a hard per-value limit, not something a bigger warehouse can raise.
71. **B — MIN_CLUSTER_COUNT, set to 3.** MIN_CLUSTER_COUNT sets the floor — the minimum number of clusters Snowflake keeps running at all times for that multi-cluster warehouse, regardless of current load — exactly the 'never scale below N, avoid any cold-start latency' requirement. MAX_CLUSTER_COUNT is the ceiling (how high it can scale up to), not a floor; the scaling policy governs when to add/remove clusters within the min/max range, not the floor itself.
72. **B.** The standard, maintainable row access policy pattern joins the calling context (CURRENT_ROLE()/CURRENT_USER()) against a separate mapping/control table inside the policy body, so updating access is just an UPDATE/INSERT on the mapping table — no policy redefinition needed as assignments change. Hard-coding values into the policy, or recreating it on every change, both defeat the point of externalizing the assignment logic.
73. **B.** Snowpark for Python's DataFrame API compiles operations down into SQL/expressions that execute inside Snowflake's own compute (pushdown), so even multi-billion-row transformations never leave the platform or get pulled to the client. The Python connector is a general-purpose driver built around submitting SQL and fetching result sets back to the client process — right for smaller result sets or general query execution, not for avoiding a client-side pull of huge data volumes.
74. **B.** By default, FLATTEN behaves like an inner join against the array elements — an order with a genuinely empty (or NULL) array contributes zero output rows and vanishes from the result. OUTER => TRUE changes this to outer-join semantics, producing one row per input value even when the array is empty or NULL, exactly the 'every order must appear at least once' requirement.
75. **B — Dynamic Table.** A Dynamic Table is defined as a query over source tables plus a target lag, with Snowflake automatically computing and running the incremental refresh — the declarative alternative to hand-rolled Stream+Task pipelines. A materialized view is also automatically maintained but is scoped to a single query over one object and doesn't support the same join/multi-source declarative pipeline pattern Dynamic Tables are built for.
76. **B.** INFORMATION_SCHEMA table functions are real-time but cover only a limited recent window; ACCOUNT_USAGE views hold much longer historical retention (at the cost of some latency), making it the correct source for a 45-day-old investigation.
77. **B.** The Kafka connector supports two ingestion modes: the classic Snowpipe (file-staging, micro-batch) mode, and Snowpipe Streaming mode, which pushes rows directly with sub-second-to-low-second latency and no intermediate file staging — the correct choice when the requirement is explicitly the lowest latency path.
78. **B.** Workload isolation — separate warehouses per workload type — is the standard fix for one workload degrading another's latency on shared compute; scaling levers like QAS or Search Optimization Service address different symptoms (single-query outliers or point-lookup selectivity), not cross-workload contention on one warehouse.
79. **B.** A virtual warehouse is a cluster of compute nodes, not a single machine; larger sizes provide more (and/or larger) nodes, and a single query's execution plan is split into parallel units of work distributed across those nodes — true MPP execution. This is exactly why scaling up (a bigger warehouse) speeds up one complex query, not just concurrency, which is instead what scaling out (multi-cluster) addresses.
80. **B.** Snowflake resource monitors come in two scopes: exactly one account-level monitor per account, and any number of warehouse-level monitors, each assignable to one or more warehouses that then share a single pooled quota — though a given warehouse can only be assigned to one monitor at a time. This exactly supports the described setup: one account-wide ceiling plus a separate shared, tighter pool for just the three heavy ETL warehouses.
81. **A.** The Snowflake SQL API is a REST interface purpose-built for exactly this kind of stateless, HTTP-only integration — submitting a SQL statement and retrieving results via plain HTTPS calls, with no driver library, connection pooling, or persistent session required, which fits a minimal serverless-function runtime far better than a full driver or a shelled-out CLI subprocess.
82. **B.** OBJECT_CONSTRUCT() builds a VARIANT object from column/value pairs (re-forming each flattened line item back into a JSON-object shape), and ARRAY_AGG() (typically with GROUP BY or a window) collects those per-order objects back into a single array-per-order — together the standard re-nesting pair, the semantic inverse of FLATTEN. FLATTEN has no 'reverse mode,' TO_VARIANT() only casts a type, and QUALIFY filters on window-function results rather than building nested structures.
83. **B — Increase the warehouse size (scale up).** Spilling from a single complex query is a memory/size problem for that one query, not a concurrency problem — scaling up (bigger warehouse, more memory per node) fixes it. Multi-cluster scaling only adds more clusters for concurrent queries, which doesn't help a single query that's still undersized.
84. **B.** Tag-based masking attaches the masking policy to the tag object itself, not to individual columns — so any column tagged (now or later) automatically inherits the masking behavior with zero additional per-column setup, which is exactly the 'classify once, enforce everywhere' governance pattern this scenario calls for.
85. **B.** The warehouse (local disk/SSD) cache lives on the physical compute nodes assigned to that warehouse; a resize (or suspend/resume) changes the underlying nodes and discards that cache, unlike the result cache or metadata cache which live in the Cloud Services layer. This cache does help queries touching overlapping — not just identical — data, so option C misdescribes it.
86. **B — Enterprise.** Search Optimization Service and Time Travel retention beyond Standard's 1-day default (up to 90 days) are both Enterprise-tier features. Since the team explicitly doesn't need HIPAA/PCI support or Tri-Secret Secure (both Business Critical+), jumping past Enterprise would add cost with no corresponding benefit here.
87. **A.** USAGE is the privilege that lets a role actually use a warehouse to run queries; OPERATE is a separate, more administrative privilege letting a role suspend/resume the warehouse or abort other users' queries on it, independent of whether that role can query with it. Granting USAGE without OPERATE is exactly how to let an analyst role use a shared warehouse day-to-day without handing them the ability to disrupt it for everyone else.
88. **B.** Query Acceleration Service is explicitly eligible for two distinct query shapes: large scans with selective filters (the classic outlier-SELECT case), and large-volume DML operations (INSERT, COPY, UPDATE, DELETE). A large, disproportionately expensive DELETE against a multi-terabyte table with tens of millions of affected rows is exactly the kind of large-volume DML QAS is built to help with.
89. **B — Enable multi-cluster warehouses (scale out).** Queuing with individually fast queries is a concurrency problem, not a per-query performance problem — multi-cluster (scale out) warehouses add parallel clusters to absorb concurrent load, whereas scaling up only helps a single query's own resource needs.
90. **B.** Search Optimization Service's documented predicate coverage is broader than plain text search: equality, IN-lists, substring/regex (LIKE/ILIKE/RLIKE), NULL checks, geospatial predicates on GEOGRAPHY values, and semi-structured VARIANT/OBJECT/ARRAY lookups are all covered — both the substring-search case and the geospatial-radius-filter case fall within its scope, not just the text one.
91. **B.** Snowflake stores lightweight metadata for every micro-partition — including per-column min/max value ranges and distinct-value counts — and the optimizer checks a filter against that metadata to eliminate (prune) any partition whose range can't possibly match, without touching the partition's actual data. This is metadata-driven pruning, not a row-level index (which Snowflake doesn't build) or a bloom filter, and it's independent of the result cache (which caches output rows of a specific prior query).
92. **B.** Economy's defining, quantified threshold is that a new cluster only starts if Snowflake estimates at least 6 minutes of queued work to justify it — a 3-minute burst falls below that bar and queries simply wait rather than triggering scale-out, favoring credit conservation over immediate responsiveness.
93. **C.** AI SQL functions are pre-built, directly SQL-callable Cortex functions (summarize, translate, sentiment, complete) requiring no model training, no semantic model, and no search index — exactly the 'just call it inline' requirement. Cortex Analyst is for natural-language-to-SQL over a defined semantic model, Cortex Search is for retrieval/RAG-style search requiring an index built first, and Snowflake ML is for training/registering custom models — all adding setup this requirement doesn't need.
94. **B.** Workload isolation — separate warehouses per team or workload type — is the standard best practice for preventing one group's heavy queries from queuing out another's, while still letting each warehouse auto-suspend independently based on its own usage pattern; a single shared warehouse (however scaled) still lets workloads compete for the same clusters.
95. **B.** An External table is a metadata-only pointer to files Snowflake doesn't manage or write to — read-only by design. An Iceberg table is purpose-built for Snowflake to act as a full query AND write engine over an open, externally-readable table format, exactly meeting the write-back requirement here without giving up interoperability with tools like Spark.
96. **C — Business Critical.** HIPAA/PCI compliance support and Tri-Secret Secure customer-managed keys are both Business Critical features; Enterprise alone includes neither, and VPS is a further isolation tier beyond what this requirement actually calls for.
97. **C — ORGADMIN.** ORGADMIN operates at the organization level, above any individual account — scoped for cross-account operations like provisioning new accounts and viewing usage rolled up across every account in the organization. ACCOUNTADMIN (and everything beneath it: SYSADMIN, SECURITYADMIN, USERADMIN) is confined to the single account it lives in, with no inherent authority over sibling accounts regardless of which account it's granted in.
98. **B — Enterprise.** Materialized views and multi-cluster warehouses are both Enterprise-tier features; jumping to Business Critical would add compliance/key-management capabilities the team explicitly doesn't need, at extra cost with no benefit for this requirement.
99. **A.** The warehouse's local disk/SSD cache lives on its own physical compute nodes; a larger warehouse size means more (and/or larger) compute nodes and therefore more aggregate local SSD capacity to hold recently-scanned micro-partitions before eviction — a direct consequence of warehouse sizing, distinct from the Cloud-Services-layer result and metadata caches, which aren't tied to warehouse compute nodes at all.
100. **C.** VPS's distinguishing feature above Business Critical is complete dedicated-infrastructure isolation from Snowflake's standard multi-tenant environment — 90-day Time Travel, multi-cluster warehouses, and row access policies are all already available at Enterprise or Business Critical and don't require VPS.
