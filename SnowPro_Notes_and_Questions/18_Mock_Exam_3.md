# Mock Exam 3 — Full-Length Practice Exam (100 Questions)

Same domain-weighted split as the real COF-C03 exam and the rest of this series: **Domain 1
(Architecture & Features): 31, Domain 2 (Account Mgmt & Governance): 20, Domain 3 (Data
Loading/Unloading/Connectivity): 18, Domain 4 (Performance & Transformation): 21, Domain 5 (Data
Collaboration): 10** (100 questions total), interleaved rather than blocked by domain.

Every question in this exam is new and original — it does **not** reuse any question from the
domain-authored practice files (`10`-`14`), from Mock Exam 1, or from any of the other mocks in
this series. All five mock exams are built to be mutually distinct: 500 different questions across
the 5 mocks. Every question is framed as a scenario an architect would actually face when designing
or troubleshooting a Snowflake account, not a bare definition lookup. Original content throughout,
verified against the domain notes and live Snowflake documentation — never sourced from or modeled
on an exam-dump site.

No official single-choice/multi-select ratio is published for the real exam, so this one uses a
reasonable, clearly-labeled mix, same as the rest of the series.

Take this closed-book, timed to 115 minutes, and log your score plus per-domain breakdown in
[06_Practice_Exam_Tracker.md](06_Practice_Exam_Tracker.md).

---

**1. [D1]** On a given day, an account's virtual warehouses collectively consume 420 credits. The Cloud Services layer consumes 55 credits that same day handling query compilation, auth, and metadata operations. Under Snowflake's standard Cloud Services billing model, how many Cloud Services credits are actually billed?

A. 0 credits — Cloud Services is always free
B. 13 credits
C. 42 credits
D. 55 credits

**2. [D2]** A platform team wants a role that can grant existing custom roles to new users and manage the broader role/grant hierarchy across the account, but should not itself own or directly manage the creation of warehouses and databases. Which system-defined role fits best?

A. SYSADMIN
B. SECURITYADMIN
C. USERADMIN
D. ORGADMIN

**3. [D3]** A data engineering team needs a stage that several different roles can load into, must support a custom named file format, and should expose a directory table for listing staged files via SQL. Which stage type fits?

A. The user stage (@~)
B. The table stage (@%table_name)
C. A named internal stage
D. An external stage on the cloud provider only

**4. [D4]** A monthly finance close job aggregates several years of transaction history with multiple large GROUP BY and window operations, running on a Small warehouse. Query Profile shows a large amount of bytes spilled to remote storage on one operator, and the job takes hours. What's the most direct fix?

A. Add a clustering key to the transaction table
B. Increase the warehouse size so the operation has enough memory, or rewrite the query to reduce intermediate result size
C. Enable the result cache
D. Switch the warehouse's scaling policy to Economy

**5. [D5]** A junior engineer accidentally drops a permanent table two hours ago. The table's DATA_RETENTION_TIME_IN_DAYS is 1 (the Standard-edition default), and nothing has been purged since. What's the correct, simplest recovery action?

A. UNDROP TABLE <table_name>, since the table is still within its Time Travel retention window
B. Contact Snowflake Support to restore the table from Fail-safe
C. Nothing — dropped tables are unrecoverable
D. Re-run the original load pipeline to recreate the table from source

**6. [D1]** A new platform engineer, ramping up on account structure, needs the correct top-down containment order to reason about where role grants and object ownership apply. Which sequence is correct?

A. Organization → Account → Database → Schema → object
B. Account → Organization → Database → Schema → object
C. Organization → Database → Account → Schema → object
D. Account → Database → Organization → Schema → object

**7. [D2]** An account has a network policy attached at the ACCOUNT level, allow-listing a corporate VPN's IP range. One specific user, who also needs to connect from a partner's office network, has a separate network policy attached directly to their USER object with a broader IP range. When that user logs in from the partner's office IP, which policy governs?

A. The account-level policy always wins, so the login from the partner's office is blocked
B. Both policies must independently allow the IP, or the login fails
C. Network policies cannot be set at both the account and user level simultaneously
D. The user-level network policy takes precedence over the account-level policy for that user, since the more specific level overrides the broader default

**8. [D3]** A team ingesting from a dozen Kafka topics doesn't want to hand-write CREATE TABLE and CREATE PIPE statements for each topic before data can land in Snowflake. Which connector handles this automatically?

A. An external function calling a custom Lambda
B. The Snowflake Python connector
C. The Kafka connector — it auto-creates the target table and pipe per topic (or uses ones you specify) and streams data in via Snowpipe or Snowpipe Streaming
D. The Spark connector

**9. [D4]** A team tries to load a single JSON document (one large nested object) that's 22MB compressed into a VARIANT column, and the load fails. What's the most likely cause, and the standard fix?

A. VARIANT values are capped at roughly 16MB compressed per value — the document must be split, restructured, or partially flattened into multiple rows/columns before loading
B. The warehouse is too small to hold a value that large in memory
C. VARIANT columns have no size limit; the failure must be unrelated to size
D. The file format must be switched from JSON to Avro, which has no size limit

**10. [D5]** Two companies want to run joint analysis on overlapping customer segments for a co-marketing campaign, without either party ever seeing the other's raw, row-level customer data. Which Snowflake capability is purpose-built for this kind of privacy-preserving joint analysis?

A. Cross-database replication
B. A Data Clean Room
C. A reader account
D. A private listing

**11. [D1]** A Large warehouse (8 credits/hour) auto-resumes to run a single query that takes 45 seconds, then sits idle until AUTO_SUSPEND (300 seconds) fires. Approximately how many credits does this entire resume-to-suspend cycle bill?

A. ≈0.13 credits
B. ≈0.77 credits
C. ≈1.33 credits
D. ≈8.00 credits

**12. [D2]** A company has grown to need multiple separate Snowflake accounts (one per region) under a single contract, with centralized visibility into usage across all of them and the ability to provision new accounts. Which role operates at this scope?

A. ACCOUNTADMIN
B. ORGADMIN
C. SECURITYADMIN
D. GLOBALADMIN

**13. [D3]** A team stages JSON files with inconsistent, evolving schemas — new optional fields appear from an upstream API without notice — and wants to load them without redefining the target table's columns every time a field changes. What's the standard Snowflake approach?

A. Pre-parse the JSON externally into a fixed relational schema before loading
B. Load each JSON document into a single VARIANT column and extract nested fields at query time
C. Reject the files until the upstream schema stabilizes
D. Use a CSV file format with a fixed delimiter to manually flatten the JSON

**14. [D4]** A multi-terabyte e-commerce orders table is loaded continuously via Snowpipe from several regional sources, arriving in load order rather than customer order. Dashboards filter heavily by customer_id, and Query Profile consistently shows over 95% of partitions scanned despite the filter's high selectivity. What's the most likely fix?

A. Resize the warehouse larger
B. Define a clustering key on customer_id so matching rows co-locate across micro-partitions as the table grows
C. Switch the loading method from Snowpipe to bulk COPY
D. Add QUALIFY to the dashboard queries

**15. [D5]** A QA team clones an entire production schema every night to refresh a test environment, including a table with an unconsumed stream tracking pending changes at the moment of cloning. The next morning, a task in the cloned schema that consumes that stream processes zero rows, even though the source table clearly had pending changes at clone time. Why?

A. Cloning is asynchronous and the stream simply hadn't caught up yet
B. Cloning re-initializes the stream at the point of cloning — pending change records from the original are not carried over into the clone
C. Streams cannot be cloned at all, so the clone silently has no stream object
D. The clone's stream inherited the original's offset, but the underlying data changed before the task ran

**16. [D1]** A government agency's compliance office requires infrastructure with no multi-tenant components at any layer — beyond even Business Critical's isolation, which still runs on Snowflake's shared (if hardened) multi-tenant infrastructure. Which edition is required?

A. Enterprise
B. Business Critical, with Tri-Secret Secure enabled
C. Virtual Private Snowflake (VPS)
D. Business Critical, with a private listing restricting Marketplace visibility

**17. [D2]** A platform team grants SELECT on a shared reference schema to role ANALYTICS_LEAD, and wants ANALYTICS_LEAD to be able to further grant that same SELECT privilege onward to other roles it manages, without involving SECURITYADMIN each time. What must the original grant include?

A. ANALYTICS_LEAD must instead be made the object's owner
B. The account-level MANAGE GRANTS privilege granted to ANALYTICS_LEAD, which is the only way to enable re-granting
C. Nothing extra — any role that holds a privilege can always re-grant it to another role
D. WITH GRANT OPTION appended to the original GRANT statement

**18. [D3]** A platform team manages 40 external stages across 5 different S3 buckets, all owned by the same AWS account. Do they need 40 separate storage integration objects — one per stage — to avoid embedding credentials?

A. Yes — one storage integration per bucket, but stages within a bucket can share it
B. No — but only if all 40 stages are internal, not external
C. No — a single storage integration (holding one cloud IAM role/identity) can back multiple stages across multiple buckets, as long as its IAM trust policy and allowed storage locations cover them
D. Yes, exactly one storage integration per stage is required

**19. [D4]** A team needs an approximate median (50th percentile) response time from a billions-of-rows event log table for a dashboard, and an exact `PERCENTILE_CONT` over that volume is too slow/expensive to run on every page load. Which function trades a small accuracy loss for dramatically less compute?

A. `QUALIFY` combined with `NTILE`
B. `MEDIAN` with a `SAMPLE` clause
C. `APPROX_COUNT_DISTINCT`
D. `APPROX_PERCENTILE`

**20. [D5]** A provider account on AWS us-east-1 wants to directly Secure-Data-Share a database with a consumer account that lives on Azure West Europe. Does a standard direct share work as-is?

A. No — cross-cloud data access is only possible via a Native App
B. Yes, but only if both accounts are on Business Critical edition
C. No — sharing only works within the same cloud region/provider; the provider must replicate the share/database to an account in the consumer's region/cloud first
D. Yes — Secure Data Sharing works across any region/cloud combination transparently

**21. [D1]** An architect wants to understand exactly what lets Snowflake skip scanning an entire micro-partition for a filtered query, without examining any of that partition's actual row data. Which mechanism is responsible?

A. A B-tree index built on the filtered column
B. Per-column min/max value ranges (plus null counts) recorded for each micro-partition, held in the metadata cache
C. A bloom filter maintained per micro-partition
D. A row-level checksum compared against the query predicate

**22. [D2]** A CI/CD pipeline needs to run automated SQL deployments against Snowflake with no human present to approve an MFA prompt or SSO redirect. Which authentication method is designed for this headless, service-account use case?

A. Password authentication with MFA enforced
B. Federated authentication via SAML2 SSO
C. Key-pair authentication
D. A network policy with IP allow-listing only

**23. [D3]** A trading platform needs individual trade events queryable in Snowflake within roughly a second of occurring. A separate nightly vendor drop of a large CSV file just needs to land in a table by 6am, and a third source pushes irregular file batches to cloud storage whenever an upstream job finishes, needing to load within a few minutes of arrival. Which ingestion method fits the trade-event requirement specifically?

A. Snowpipe with cloud storage event notifications
B. Snowpipe Streaming
C. A scheduled Task running COPY INTO on a cron schedule
D. A manually-triggered bulk COPY INTO each morning

**24. [D4]** A reporting query joins a 10-million-row orders fact table to a 'current promotions' table on promotion_code, and the result set comes back with over 800 million rows — far more than either input. Query Profile shows one join operator with output volume dwarfing both of its inputs. What's the most likely cause?

A. The result cache returned stale data
B. The promotions table isn't clustered
C. The join key isn't unique/selective enough on one side (e.g. duplicate promotion_code rows), producing a fan-out ('exploding') join
D. Query Acceleration Service wasn't enabled

**25. [D5]** A data provider shares a large sales dataset with a partner consumer account via Secure Data Sharing. The consumer runs a heavy aggregation query against the shared data every morning. Whose compute is billed for that query?

A. The provider's warehouse, since they own the underlying storage
B. The consumer's own warehouse — they query the provider's storage directly using their own compute
C. Both accounts automatically split the credit cost
D. Neither — Secure Data Sharing queries are compute-free

**26. [D1]** A multi-cluster Large warehouse (8 credits/hour per cluster) is configured with MIN_CLUSTER_COUNT=1, MAX_CLUSTER_COUNT=4. Over one particular hour of fluctuating concurrency, Snowflake's own metering shows an average of 2.2 clusters actually running (not the configured maximum). Approximately how many credits does that hour bill?

A. 8 credits — billing only ever counts the base cluster
B. 3.6 credits — 8 credits/hr ÷ 2.2 clusters
C. ≈17.6 credits — 8 credits/hr × the average of 2.2 clusters actually running
D. 32 credits — 8 credits/hr × the configured maximum of 4 clusters

**27. [D2]** A team wants Python stored-procedure handler code to emit structured log messages and OpenTelemetry-style trace spans during execution, queryable afterward with ordinary SQL like any other table. Which object captures this?

A. ACCOUNT_USAGE.ACCESS_HISTORY
B. An event table
C. QUERY_HISTORY
D. A resource monitor

**28. [D3]** An analyst runs a plain `SELECT * FROM orders_stream` to preview pending changes while investigating a data issue. A few hours later, a scheduled Task that's supposed to consume the same stream runs. Does the analyst's earlier SELECT affect what the Task sees?

A. It depends on whether the stream is append-only or standard
B. Yes, but only if the SELECT ran in the same session as the Task
C. Yes — the SELECT already consumed the stream, so the Task sees no pending rows
D. No — only consuming the stream inside a DML statement (e.g. `INSERT ... SELECT` from the stream, or a `CREATE TABLE ... AS SELECT`) advances its offset; a plain SELECT for preview purposes does not

**29. [D4]** A dashboard query includes `UUID_STRING()` in its SELECT list to generate a unique row identifier for downstream logging. Run twice in a row, back-to-back, with nothing else changed, does the second run hit the result cache?

A. No, but only because `UUID_STRING()` specifically is disabled account-wide by default
B. Yes, but only if the warehouse stayed running between the two calls
C. No — nondeterministic functions like `UUID_STRING()` and `RANDOM()` make a query ineligible for the result cache, since re-running it must produce a fresh value each time
D. Yes — result cache hits don't care what functions are used, only whether the underlying data changed

**30. [D5]** A provider wants to expose a proprietary risk-scoring calculation's output to data-sharing consumers, without letting them see the formula/logic itself — even though they can still call the function and use its result in their own queries. Which object fits?

A. An external function
B. A masking policy applied to the function's return value
C. A standard (non-secure) UDF
D. A secure function (`CREATE SECURE FUNCTION`), which hides the function definition from callers without ownership privilege — the same protection secure views provide

**31. [D1]** A company runs both latency-sensitive executive dashboards and long-running ad hoc data-science exploration queries on the same Medium warehouse. Dashboard users increasingly see multi-second delays during business hours. Following Snowflake warehouse best practice, what is the most direct fix?

A. Increase AUTO_SUSPEND so the warehouse stays warm longer
B. Split the two workloads onto separate warehouses, each sized and scaled for its own pattern
C. Enable Query Acceleration Service on the shared warehouse
D. Add a clustering key to the dashboard's underlying tables

**32. [D2]** An enterprise already manages all employee identity centrally through an external identity provider, including conditional-access rules and deprovisioning, and wants Snowflake logins to flow through that same system rather than maintaining separate Snowflake passwords. Which authentication approach fits?

A. Key-pair authentication for every user
B. Federated authentication / SSO via SAML2 with the external IdP
C. OAuth tokens issued directly by Snowflake for interactive users
D. MFA layered on native Snowflake passwords

**33. [D3]** An audit pipeline only needs to capture every new row inserted into a high-volume clickstream table — updates and deletes never occur on this table — and wants the lowest-overhead change-tracking option. Which stream type fits?

A. A standard (delta) stream
B. An append-only stream
C. An insert-only stream
D. A directory-table stream

**34. [D4]** A shared reporting warehouse handles month-end close queries from several finance sub-teams simultaneously. During the close window, users report queries taking far longer overall than their own Query Profile execution time suggests, with a large gap before execution actually begins. What does this indicate, and what's the fix?

A. Bytes are spilling to disk — increase warehouse size
B. The queries are queuing behind each other for warehouse capacity — enable multi-cluster (scale out) or split into dedicated warehouses per sub-team
C. Pruning is inefficient — add a clustering key
D. The result cache is being bypassed

**35. [D5]** A holding company with several independently operated subsidiary Snowflake accounts wants to distribute a shared reference dataset (e.g. a standardized product hierarchy) to only those specific internal subsidiary accounts — not the general public, and not discoverable by any external Snowflake customer. Which Marketplace mechanism fits?

A. A public listing
B. A private listing naming the specific subsidiary accounts
C. A Native App published publicly
D. A direct share only, since Marketplace listings can't restrict visibility

**36. [D1]** A pipeline needs to generate globally unique, monotonically-ascending numeric IDs across many concurrent loading sessions, without the row-locking contention a single shared counter row in a table would create under heavy concurrent INSERTs. Which Snowflake object is purpose-built for this?

A. A masking policy
B. A Stream
C. A resource monitor
D. A Sequence object (CREATE SEQUENCE)

**37. [D2]** A data-quality team wants a recurring, scheduled SQL check that automatically fires a notification the moment a source table's null-rate for a key column crosses 5%, with no human running the check manually. Which object fits, and what does it commonly pair with to deliver the notification?

A. A Dynamic Table, paired with a Stream
B. A resource monitor, paired with a network policy
C. A masking policy, paired with Trust Center
D. An ALERT object (CREATE ALERT) with a scheduled condition, commonly paired with a notification integration (and often an event table for the underlying logged data) to deliver the notification

**38. [D3]** An external table is configured with AUTO_REFRESH = TRUE so its metadata picks up new files landing in cloud storage automatically. Ownership of the table is then transferred to a different role as part of a governance cleanup. What happens to AUTO_REFRESH, and what's the operational risk if nobody notices?

A. AUTO_REFRESH is an account-level setting, unrelated to any individual table's ownership
B. Ownership transfer resets AUTO_REFRESH to FALSE by default; if unnoticed, new files silently stop being picked up until someone re-enables it or runs a manual REFRESH
C. Ownership transfer is blocked entirely while AUTO_REFRESH is enabled
D. Nothing — AUTO_REFRESH is unaffected by ownership transfer

**39. [D4]** A team defines `CLUSTER BY (region, order_date)` on a large orders table, but the overwhelming majority of dashboard filters are on order_date alone, rarely on region. Pruning on order_date-only queries stays weak. What's the most likely issue, and the fix?

A. Clustering keys can only ever contain one column total, so this multi-column key is invalid
B. Column order in `CLUSTER BY` is purely cosmetic and never affects pruning
C. Clustering key column order matters — Snowflake generally recommends ordering columns so the one most frequently filtered independently (here, order_date) leads, since a query filtering only on a trailing key column benefits far less than one filtering on the leading column(s)
D. The clustering key should be dropped entirely, since clustering never helps date-range filters

**40. [D5]** A provider wants to monetize a curated dataset by charging consumers directly for access, with billing handled through Snowflake rather than a separate invoicing process. Which mechanism supports this?

A. A reader account, since the provider always pays there
B. A direct share, which has no billing integration option
C. A paid Marketplace listing, which integrates with Snowflake's own billing so consumers can be charged for access
D. A private listing, which can never be monetized

**41. [D1]** A support team wants to automatically sort each incoming ticket's free-text description into one of five predefined categories (Billing, Bug, Feature Request, Account Access, Other), directly in a SQL pipeline, without training a custom model. Which Cortex AI SQL function fits?

A. AI_COMPLETE
B. AI_CLASSIFY
C. AI_SENTIMENT
D. AI_EMBED

**42. [D2]** A customer table's phone_number column should display in full to the CUSTOMER_SUPPORT role but show only the last 4 digits to the MARKETING_ANALYST role, both querying the exact same column on the exact same table. Which governance feature fits?

A. A row access policy
B. A masking policy
C. An aggregation policy
D. A network policy

**43. [D3]** An architect tries to create an INSERT_ONLY stream on a standard permanent Snowflake-managed table and the attempt is rejected. What's the correct explanation?

A. Insert-only streams require Business Critical edition
B. Insert-only streams are supported only on source types like external tables and externally-managed Iceberg tables — not on standard Snowflake-managed tables
C. Insert-only streams require the table to already have a clustering key
D. Insert-only streams can only be created by ACCOUNTADMIN

**44. [D4]** A 200-row currency-code lookup table is joined into nearly every query on the warehouse. An engineer proposes adding a clustering key to it to 'help performance.' Is this a good idea?

A. Yes — any table that's frequently joined benefits from a clustering key
B. No — the table is far too small to see any pruning benefit, and automatic reclustering would add ongoing credit cost with no real payoff
C. Yes, but only if the table is defined as transient
D. No — clustering keys can only be defined on fact tables, never dimension/lookup tables

**45. [D5]** A provider account exposes a stored procedure to data-sharing consumers that runs a lookup query. It's important that the procedure can only ever access data the specific calling role already has privileges on — never more, regardless of what the procedure's own creator can see. Which execution mode must this procedure use, and is it the default?

A. EXECUTE AS OWNER, which is the default
B. EXECUTE AS CALLER, which is not the default (OWNER's rights is the default) and must be explicitly specified
C. EXECUTE AS CALLER, which is the default
D. Neither execution mode applies to procedures exposed via data sharing

**46. [D1]** A team with deep existing Apache Spark/Scala expertise wants to write DataFrame-style transformations that push down and execute inside Snowflake's own compute, without rewriting all their logic in Python. Is this possible with Snowpark?

A. Yes — Snowpark provides Python, Java, and Scala APIs, all executing pushed-down inside Snowflake compute
B. No — Snowpark only supports Python
C. Yes, but only by routing through an external function calling a separate Scala runtime
D. No — Scala support was deprecated in favor of Python-only APIs

**47. [D2]** A governance team, investigating a data-quality incident, wants to see — without writing any custom SQL — every downstream view and table that consumes a specific upstream source table, several hops deep. Which Snowsight feature provides this?

A. Trust Center
B. ACCESS_HISTORY queried manually
C. Query Profile
D. The automatic data lineage graph

**48. [D3]** A team runs two Tasks: Task A on a dedicated user-managed Medium warehouse that also runs other workloads, and Task B configured as serverless. When each Task executes, whose compute is billed?

A. Serverless Tasks bill only against the free 10%-of-daily-compute Cloud Services allowance
B. Task B is always free since it's serverless
C. Both bill against the same warehouse, since all Tasks ultimately share compute
D. Task A bills the Medium warehouse's normal per-second warehouse credits (shared with whatever else runs there); Task B bills separately on Snowflake-managed serverless compute, sized automatically per run

**49. [D4]** Before committing a large, frequently-filtered table to an ongoing clustering key (and its background reclustering credit cost), an architect wants to check how well-clustered the table already is on a candidate column. Which function gives this diagnostic?

A. `SYSTEM$ESTIMATE_SEARCH_OPTIMIZATION_COSTS`
B. `SHOW TABLES`
C. `SYSTEM$ESTIMATE_QUERY_ACCELERATION`
D. `SYSTEM$CLUSTERING_INFORMATION('<table>', '(<column>)')` — returns clustering depth/overlap statistics for the candidate key

**50. [D5]** A Business Critical customer wants its DR region to have not just replicated databases, but also the same users, roles, warehouses, and resource monitors already in place — so failover doesn't require rebuilding RBAC and warehouse configuration from scratch under pressure. What accomplishes this, and in what state do the replicated warehouses arrive?

A. Account objects like users and roles can never be replicated — only databases and shares
B. A failover group configured to replicate account-level objects (users, roles, warehouses, resource monitors) alongside databases — replicated warehouses arrive suspended in the target account and must be resumed after failover
C. Plain database replication alone already includes users, roles, and warehouses
D. Replicated warehouses start already running in the target account, consuming credits even before failover

**51. [D1]** A global retailer wants product review text stored in a dozen languages converted to English inline in a SQL query for a unified analytics dashboard, without exporting data to an external translation service. Which Cortex AI SQL function is purpose-built for this?

A. AI_EXTRACT
B. AI_TRANSLATE
C. AI_SUMMARIZE_AGG
D. AI_PARSE_DOCUMENT

**52. [D2]** A multinational retailer stores all regional sales in one global orders table. Each region's sales manager, querying with their normal role, should see only rows for their own region — never other regions' rows, no matter which columns they select. Which governance feature fits?

A. A masking policy on the region column
B. A row access policy on the table
C. A projection policy
D. Object tagging with ALLOWED_VALUES restricted to their region

**53. [D3]** A nightly transformation runs on a warehouse that's otherwise idle roughly 22 hours a day, with unpredictable per-run resource needs. The platform team wants Snowflake to size compute automatically based on recent run history, rather than manually picking and maintaining a warehouse size. Which task configuration fits?

A. A user-managed task on a fixed Medium warehouse
B. A serverless task
C. A user-managed task on a multi-cluster warehouse
D. A Snowpipe object instead of a task

**54. [D4]** A team needs a continuously up-to-date table that joins three source tables and applies business logic, refreshed automatically to within about 5 minutes of source changes, without hand-writing incremental merge/change-capture logic. Which fits best?

A. A materialized view over the three joined tables
B. A standard view, queried directly each time
C. A Dynamic Table with TARGET_LAG = '5 minutes' defined as the three-way join query
D. A stream on each of the three tables, consumed manually

**55. [D1]** An insurance company receives scanned paper claim forms as PDFs and JPEGs and wants their text and layout extracted directly in a SQL pipeline — as a first step before further Cortex processing like classification — without a separate third-party OCR tool. Which Cortex AI SQL function fits?

A. AI_CLASSIFY
B. AI_PARSE_DOCUMENT
C. AI_EMBED
D. AI_EXTRACT

**56. [D2]** A FinOps team wants a single monthly credit quota shared across five warehouses used by one department, with threshold actions triggering once their combined usage crosses the limit, rather than managing five separate quotas. Is this possible with one resource monitor?

A. Yes, but only if all five warehouses are the same size
B. No — cost pooling across warehouses would require a separate Snowflake account per department
C. No — a resource monitor can only ever be assigned to exactly one warehouse
D. Yes — a single resource monitor can be assigned to multiple warehouses, and its threshold actions apply to their combined credit usage

**57. [D3]** A data science team on Databricks wants to read a large Snowflake table directly into a Spark DataFrame, with filter/predicate pushdown to Snowflake's own compute rather than pulling the full table into Spark first. Which integration fits?

A. A Native App
B. The Spark connector
C. Snowpipe
D. The Snowflake Python connector

**58. [D4]** A team enables Search Optimization Service with the SUBSTRING search method on a free-text notes column, expecting faster `LIKE '%ID%'` lookups. For a 2-character substring like 'ID', does the search access path actually get used?

A. No, because SUBSTRING search only works on numeric columns
B. Yes, but only if EQUALITY search is also enabled on the same column
C. No — the search optimization service's substring access paths aren't used for substrings shorter than 5 characters; very short substrings fall back to a normal scan
D. Yes, substring search paths accelerate searches of any length, including 2 characters

**59. [D1]** A data engineering team needs a SQL transformation to call a third-party address-validation REST API for each row, with the actual validation logic hosted and maintained outside Snowflake entirely. Which Snowflake feature is designed for this?

A. A Snowpark UDF
B. An external function, backed by an API integration
C. A stored procedure using EXECUTE AS CALLER
D. The Snowpipe REST API

**60. [D2]** A hospital's research team may run statistical queries against a patient-outcomes table, but compliance requires that no query — however it's written — can ever return results for a group smaller than 25 patients, to prevent re-identifying individuals. Which feature enforces this regardless of query phrasing?

A. A row access policy with a minimum-count WHERE clause
B. An aggregation (privacy) policy enforcing a minimum group size
C. A masking policy on all identifying columns
D. A secure view with a HAVING COUNT(*) >= 25 clause

**61. [D3]** A pipeline should process new change records from a stream as soon as they appear, without running the transformation task on a fixed schedule and wastefully finding nothing to do most of the time. Which task configuration achieves this?

A. A task scheduled every minute via CRON, regardless of stream state
B. A task with WHEN SYSTEM$STREAM_HAS_DATA('the_stream'), so it only executes its body when the stream actually has pending changes
C. A task chained AFTER another task with no condition at all
D. A Dynamic Table with TARGET_LAG = '1 minute' instead of a task

**62. [D4]** A dashboard query returns identical results overnight with no source-table changes, so it's expected to hit the result cache the next morning. Instead it recompiles and re-executes. Investigation shows the only overnight activity on the source table was Snowflake's automatic background reclustering. What explains the cache miss?

A. Reclustering always disables the result cache for 24 hours
B. The result cache is invalidated by background reclustering/partition consolidation alone, even without any logical data change
C. The query must have used a nondeterministic function
D. The result cache's retention window expired overnight

**63. [D1]** A team needs to condense a single 10-page contract's text into a short paragraph in one query, and separately wants one query that summarizes last month's several thousand support-ticket comments into an executive overview, grouped by product line. Which two Cortex functions respectively fit these two needs?

A. AI_EXTRACT for the contract; SNOWFLAKE.CORTEX.SUMMARIZE for the tickets
B. AI_SUMMARIZE_AGG for both
C. SNOWFLAKE.CORTEX.SUMMARIZE (legacy, single-text) for the contract; AI_SUMMARIZE_AGG (GA'd Jan 2026, multi-row aggregate with GROUP BY support) for the grouped ticket summary
D. Both needs require an external function, since Cortex only summarizes one document at a time

**64. [D2]** A partner web application needs to obtain short-lived, scoped access tokens to query Snowflake on behalf of a logged-in user, refreshable without the user re-entering their Snowflake password on every request, integrated through a standard authorization-code-style flow. Which authentication mechanism fits?

A. OAuth (Snowflake OAuth or an external OAuth provider)
B. Key-pair authentication
C. Federated SSO only
D. A network policy scoped to the partner's IP range

**65. [D3]** Before a `COPY INTO` can load a local CSV file sitting on a developer's laptop, that file first needs to land in a stage. Which command uploads it there?

A. Snowpipe's `insertFiles` REST call
B. `INSERT INTO @stage`
C. `PUT file://<local_path> @stage`
D. `COPY INTO @stage`

**66. [D4]** A nightly batch job runs `INSERT INTO archive_table SELECT ... FROM staging WHERE load_date = CURRENT_DATE` against a very large staging table, and this single INSERT disproportionately dominates the warehouse's runtime compared to the rest of the nightly workload. Is this a candidate for Query Acceleration Service, given it's a write rather than a read-only SELECT?

A. No — DML of any kind is categorically ineligible for QAS
B. Yes — QAS explicitly supports large scans that INSERT or COPY many new rows, not just standalone SELECT queries
C. No — QAS only ever accelerates SELECT queries
D. Yes, but only for COPY INTO, never a plain INSERT ... SELECT

**67. [D1]** A data scientist wants an interactive, cell-by-cell environment to iteratively write and re-run small chunks of mixed Python/SQL against live Snowflake compute while exploring a dataset. A separate analytics team wants to publish a polished, click-through interactive app for business users with no visible code. Which two Snowflake features respectively fit these two needs?

A. Streamlit in Snowflake for exploration; Snowflake Notebooks for the app
B. Snowflake Notebooks for exploration; Streamlit in Snowflake for the app
C. Snowsight worksheets for both needs
D. Snowpark for exploration; Snowflake CLI for the app

**68. [D2]** FinOps wants to attribute every warehouse's monthly credit consumption back to the specific business unit that owns it, without manually cross-referencing a spreadsheet, and wants that attribution to be queryable directly from Snowflake's own usage data. What's the right mechanism?

A. Rename each warehouse with the business unit's name as a prefix
B. Apply a COST_CENTER object tag to each warehouse and join ACCOUNT_USAGE metering views against TAG_REFERENCES
C. Create a completely separate Snowflake account per business unit
D. Configure a resource monitor per business unit

**69. [D3]** A BI tool that only supports generic, standards-based database connectivity (no native Snowflake plugin) needs to connect to Snowflake for live dashboards. Which connectivity option fits?

A. The Snowflake Python connector
B. An ODBC or JDBC driver
C. The Kafka connector
D. Snowpark

**70. [D4]** A team notices that a query re-run immediately after their warehouse auto-resumes from suspension runs noticeably slower — and consumes real compute credits again — than the same query run twice back-to-back while the warehouse stayed up, even with the result cache disabled for this test. Why?

A. The metadata cache is cleared on every resume
B. The warehouse's local disk (SSD) cache of recently-scanned micro-partitions is tied to specific physical compute nodes and is lost on suspend/resume (and on resize)
C. Auto-resume always forces a full table rescan by design
D. The query compiler recompiles the query from scratch after any suspend

**71. [D1]** A platform team wants to define Snowflake objects (warehouses, roles, grants) as version-controlled configuration and apply changes via a CI/CD pipeline, with no human clicking through worksheets. Which tool fits this DevOps-style workflow?

A. Cortex Analyst
B. Streamlit in Snowflake
C. Snowsight worksheets exclusively
D. Snowflake CLI (`snow`), scripted against config/SQL committed to a repo

**72. [D2]** A team wants to directly GRANT SELECT on just 2 of a 15-column customer table to an analyst role — without exposing the other 13 columns — using a plain GRANT statement scoped to those columns. Is this directly possible?

A. Yes — `GRANT SELECT (col1, col2) ON TABLE ... TO ROLE ...` is valid Snowflake syntax
B. Yes, but only on Business Critical edition
C. No — the only workaround is duplicating the table with fewer columns
D. No — Snowflake's GRANT privilege model operates at the table/view level, not individual columns; a secure view exposing only those 2 columns (or a masking policy on the other 13) is the standard approach

**73. [D3]** A business user without any BI tool access needs a CSV export of a query's results delivered as an actual file on their local machine. What's the standard two-step Snowflake workflow?

A. `CREATE TABLE ... AS SELECT`, then email the resulting table
B. Snowpipe Streaming run in reverse to stream rows to a local file
C. `COPY INTO` an internal stage from the query (unload), then `GET` the resulting file(s) from the stage down to the local machine
D. Select the data directly into a spreadsheet formula

**74. [D4]** A finance report needs each month's revenue shown alongside the prior month's revenue in the same row, to compute month-over-month change inline. Which window function is purpose-built for pulling a prior row's value into the current row?

A. `RANK()`
B. `APPROX_COUNT_DISTINCT()`
C. `ROW_NUMBER()`
D. `LAG()`

**75. [D1]** A stored procedure logs CURRENT_DATABASE() and CURRENT_SCHEMA() at the start of every run for audit purposes. A developer calls it from a brand-new worksheet session where no USE DATABASE / USE SCHEMA has been issued and the user has no default namespace configured. What do the logged values show?

A. The account's default database/schema
B. NULL for both, since no database/schema context has been set for the session
C. An error is raised before the procedure can execute
D. PUBLIC for schema, NULL for database

**76. [D2]** A Business Critical account continuously replicates its primary database to a secondary account in another region for disaster recovery. A regional outage takes down the primary. What action actually redirects production traffic to the secondary?

A. Replication automatically redirects traffic the moment the primary becomes unreachable
B. An explicit failover operation must be triggered to promote the secondary to primary
C. The consumer's warehouse automatically reconnects to whichever replica is healthy
D. Time Travel is used to reconstruct the primary in a brand-new account

**77. [D3]** A team needs Snowflake to call a third-party REST API (for an external function) without embedding API credentials directly in the function definition — distinct from the object used to grant an external stage access to a cloud storage bucket. Which object authorizes the API call?

A. A storage integration
B. An API integration
C. A notification integration
D. A Git integration

**78. [D4]** An orders table stores each order as one row with a VARIANT column holding a nested JSON array of line items. A report needs one output row per line item, with order_id carried through onto each item's row. What's the standard approach?

A. A window function partitioned by order_id
B. FLATTEN() on the line-items array, typically joined laterally back to the order row
C. A UNION ALL for each possible array position
D. CAST the VARIANT column directly to a table type

**79. [D1]** A team already knows a memory-spilling Python model-training job needs a Snowpark-optimized warehouse instead of Standard. Purely on cost: switching a Medium (4 credits/hour on Standard) to Snowpark-optimized changes the credit rate by approximately how much, and what do they get for it?

A. Roughly 1.5× the credit rate (≈6 credits/hour for a Medium) in exchange for substantially more memory per node — Snowflake documents roughly 16× the memory of a same-size Standard warehouse
B. No premium — Snowpark-optimized costs the same per hour as Standard
C. Roughly 4× the credit rate, with no memory difference from Standard
D. Snowpark-optimized warehouses are serverless and bill per query, not per hour

**80. [D2]** A schema receives new tables constantly from an automated ETL pipeline, and a reporting role needs SELECT on every one of them going forward, without a human re-running a GRANT after each new table appears. What's the standard mechanism?

A. Re-running `GRANT SELECT ON ALL TABLES IN SCHEMA` on a nightly scheduled Task
B. GRANT SELECT ON FUTURE TABLES IN SCHEMA <schema> TO ROLE <role> — a future grant defining the privileges new objects automatically receive at creation time
C. A Dynamic Table wrapping every table in the schema
D. A masking policy applied to the schema itself

**81. [D3]** A team loads Parquet files whose column names match the target table's columns but whose column order varies from file to file. Loaded naively, the target table ends up with a single VARIANT column instead of properly typed columns. What COPY INTO option (often paired with INFER_SCHEMA for initial table creation) fixes this?

A. `PURGE = TRUE`
B. `ON_ERROR = CONTINUE`
C. `VALIDATION_MODE = RETURN_ALL_ERRORS`
D. `MATCH_BY_COLUMN_NAME` (e.g. `CASE_INSENSITIVE`), matching Parquet columns to target table columns by name rather than positional order

**82. [D4]** A pipeline needs to, in one atomic statement, insert new customer records that don't yet exist and update existing ones that changed — based on matching customer_id — rather than running a separate DELETE followed by INSERT. Which statement fits?

A. `TRUNCATE TABLE` followed by `INSERT`
B. Two independent `UPDATE` and `INSERT` statements wrapped in a transaction
C. `COPY INTO` with `FORCE = TRUE`
D. `MERGE` (with `WHEN MATCHED` / `WHEN NOT MATCHED` clauses)

**83. [D1]** A warehouse has AUTO_SUSPEND = 60 seconds. A single query begins running on it and takes 12 minutes to finish, with nothing else queued. What happens to the warehouse during those 12 minutes?

A. It suspends after 60 seconds regardless, and the query fails
B. It suspends after 60 seconds, but the query keeps running on cached compute anyway
C. It stays running for the full 12 minutes, since auto-suspend only counts idle time with no active queries
D. It suspends and resumes repeatedly every 60 seconds while the query runs

**84. [D2]** A security team wants a single Snowsight view surfacing scanner findings and security-posture recommendations (misconfigurations, risky grants, etc.) across the whole account, without writing custom queries against ACCOUNT_USAGE. Which feature fits?

A. Query attribution views
B. Trust Center
C. Resource monitors
D. The automatic data lineage graph

**85. [D4]** An operations table with hundreds of millions of rows is queried two very different ways: (1) large batch scans over broad date ranges that occasionally run far longer than the rest of the workload on that warehouse, and (2) frequent single-row lookups by a high-cardinality ticket_id column that isn't naturally clustered. Which combination of features addresses each pattern respectively?

A. A clustering key for both patterns
B. Query Acceleration Service for pattern 1 (outlier large scans); Search Optimization Service for pattern 2 (selective point lookups)
C. Search Optimization Service for pattern 1; Query Acceleration Service for pattern 2
D. Materialized views for both patterns

**86. [D1]** A team's Apache Iceberg tables are managed by an external, engine-agnostic REST catalog (not Snowflake's own metadata store), so that Spark, Trino, and Snowflake can all read/write the same tables through one shared source of truth for table metadata. Which Snowflake object connects Snowflake to that external catalog?

A. An API integration
B. A catalog integration
C. A storage integration
D. A share

**87. [D2]** A Business Critical customer using Tri-Secret Secure decides, in response to a suspected breach, to revoke their customer-managed key from the composite master key. What happens to their Snowflake data and any currently-running queries?

A. Only new data written after the revocation is affected; existing data remains readable
B. Nothing changes until Snowflake's next scheduled key-rotation cycle
C. The data becomes undecryptable by Snowflake, and any currently-running queries against it are aborted — a deliberate, customer-controlled kill switch
D. Revoking the customer-managed key requires Snowflake Support to manually re-encrypt the account first

**88. [D4]** A report only needs 3 of a 200-column wide table's columns, but the query uses `SELECT *`. Query Profile shows far more bytes scanned than the report actually needs. What's the direct fix, and why does it help given Snowflake's storage model?

A. Enable Query Acceleration Service to compensate
B. Add a clustering key on the 3 needed columns
C. Project only the 3 needed columns explicitly — Snowflake's columnar micro-partition storage lets it skip reading the other 197 columns' data entirely when they aren't selected
D. Nothing can be done — `SELECT *` always scans full rows regardless of columnar storage

**89. [D1]** A financial services company needs multi-region database replication with the ability to fail over to a secondary region during a regional outage. They have no HIPAA/PCI requirement and don't need a customer-managed encryption key layered on top of Snowflake's own. What is the minimum edition required?

A. Standard
B. Enterprise
C. Business Critical
D. Virtual Private Snowflake (VPS)

**90. [D4]** A single-source aggregation needs to stay reasonably fresh (staleness up to ~10 minutes is fine) while minimizing ongoing background-maintenance credit spend. The team is deciding between a materialized view and a Dynamic Table with TARGET_LAG = '10 minutes'. Which is the more cost-appropriate choice, and why?

A. Neither — both cost exactly the same regardless of configuration
B. A materialized view, because Dynamic Tables are a Business Critical-only feature
C. A materialized view, since it's cheaper by design than any declaratively-refreshed table
D. A Dynamic Table — its TARGET_LAG lets Snowflake batch and schedule refreshes to just meet the staleness bound, rather than a materialized view's tighter, more continuous maintenance aimed at near-immediate consistency

**91. [D1]** A QA engineer needs an intermediate debugging table that other engineers in other sessions can also query while troubleshooting a failed pipeline, but the table is disposable and doesn't need Fail-safe protection once the investigation wraps up. Should they use a Temporary or a Transient table, and why?

A. Temporary, because Transient tables cannot be queried by any role other than the creator
B. Neither — both table types are always private to the creating session
C. Temporary — temporary tables are visible to any session that knows the table's name
D. Transient — unlike a Temporary table (session-scoped, invisible outside the creating session), a Transient table behaves like a normal table other users/sessions can see and query, just without Fail-safe

**92. [D1]** A mid-size analytics team needs multi-cluster warehouses for concurrency, materialized views for a slowly-changing aggregation, and up to 90 days of Time Travel for compliance audits — but has no cross-region DR or customer-managed-key requirement. What is the minimum edition?

A. Standard
B. Enterprise
C. Business Critical
D. Virtual Private Snowflake (VPS)

**93. [D1]** A FinOps analyst wants every query issued by a specific nightly ETL job labeled, so its cost/usage can later be filtered out of ACCOUNT_USAGE.QUERY_HISTORY — without creating a dedicated warehouse or role just for that job. Which mechanism fits?

A. A masking policy applied to QUERY_HISTORY
B. An object tag applied to the warehouse the job runs on
C. Setting the QUERY_TAG session parameter (e.g. `ALTER SESSION SET QUERY_TAG = '...'`) before the job's queries run
D. A resource monitor scoped to the job

**94. [D1]** An engineer runs an UPDATE that changes a single column value on one row inside a 500MB micro-partition. What actually happens at the storage layer?

A. Snowflake edits that one row's bytes in place within the existing micro-partition
B. Snowflake writes an entirely new micro-partition containing the updated row plus the partition's unaffected rows, and marks the old partition inactive
C. The changed row is moved into a separate 'delta' partition reserved for updates
D. Snowflake queues the change and applies it in bulk during the next background reclustering pass

**95. [D1]** During a concurrency spike, some queries sit queued behind others for a very long time before ever starting. The team would rather a query that's been queued too long fail explicitly (so the client can retry or alert) than wait indefinitely. Which parameter controls this, and how does it differ from STATEMENT_TIMEOUT_IN_SECONDS?

A. STATEMENT_QUEUED_TIMEOUT_IN_SECONDS — caps time spent waiting in queue before execution even starts, distinct from STATEMENT_TIMEOUT_IN_SECONDS, which caps execution time once a query is actually running
B. STATEMENT_TIMEOUT_IN_SECONDS — it already covers both queued and executing time
C. AUTO_SUSPEND — shortening it cancels queries that have been queued too long
D. There is no such parameter; only a resource monitor can stop a queued query

**96. [D1]** A team is training a Python ML model inside Snowpark that needs to hold a large in-memory working set per compute node, and a standard-sized warehouse keeps spilling to disk during training. Which warehouse type is purpose-built for this?

A. A larger Standard (Gen 2) warehouse
B. A Snowpark-optimized warehouse
C. A multi-cluster Standard warehouse
D. The default warehouse used for Notebooks

**97. [D1]** A cost-conscious team wants a warehouse that never automatically starts running a query the instant one is submitted — it should require an explicit manual RESUME action first, even if that means submitted queries wait until someone starts it. Which warehouse parameter controls this?

A. MIN_CLUSTER_COUNT = 0
B. INITIALLY_SUSPENDED = TRUE — but this only affects the warehouse's state at creation time, not later query submissions
C. AUTO_SUSPEND = 0
D. AUTO_RESUME = FALSE

**98. [D1]** A multi-cluster warehouse backs a customer-facing BI tool where concurrency spikes are sudden and unpredictable; the business would rather absorb some extra credit cost than let queries queue even briefly. Which scaling policy fits, and why?

A. Economy — it waits for at least 6 minutes of estimated queued work before starting a cluster, minimizing cost
B. Standard — it starts an additional cluster proactively the moment a query queues or a shortfall is predicted, prioritizing responsiveness over cost
C. Economy, because it starts clusters faster than Standard does
D. Neither — scaling policy only governs cluster shutdown, not startup

**99. [D1]** An architect must pick the right feature for three simultaneous needs: (1) answering natural-language business questions as SQL over a governed semantic model, (2) fast semantic retrieval over thousands of unstructured PDFs to ground a support chatbot, and (3) training and version-managing a custom churn-prediction model without exporting data out of Snowflake. Which trio of features respectively fits?

A. Snowpark for all three, since it underlies each feature
B. Cortex Search, Cortex Analyst, Snowflake ML — in that order
C. Cortex Analyst, Cortex Search, Snowflake ML — in that order
D. Snowflake ML, Cortex Analyst, Cortex Search — in that order

**100. [D1]** An account-level parameter sets STATEMENT_TIMEOUT_IN_SECONDS = 3600. That same user's own USER-level default is 1800. Within one session, the user runs ALTER SESSION SET STATEMENT_TIMEOUT_IN_SECONDS = 300. What timeout applies to queries in that session?

A. 3600 seconds, because account-level settings always win
B. 1800 seconds, because the user-level default is more specific than the account default
C. 300 seconds, because the session-level setting is the most specific level set and overrides both account and user defaults
D. The lowest of all three values is automatically enforced

---

## Answer Key & Explanations

1. **B — 13 credits.** Cloud Services usage is free up to 10% of that day's total warehouse compute credits (10% of 420 = 42). Only the amount above that threshold is billed: 55 - 42 = 13 credits.
2. **B — SECURITYADMIN.** SECURITYADMIN manages users, roles, and grants account-wide (and inherits USERADMIN's narrower user/role-only scope), without owning the warehouse/database object management that SYSADMIN handles.
3. **C — A named internal stage.** The user stage and table stage can't be shared across users/roles, and the table stage doesn't support a custom file format. A named internal stage is explicitly created, shareable via role grants, and supports both custom file formats and directory tables.
4. **B.** Spilling — especially to remote storage, the worse tier — means the warehouse ran out of memory for that operation. The direct fixes are more memory (a bigger warehouse) or a rewrite that shrinks intermediate result size; clustering and caching don't address a memory shortfall.
5. **A.** UNDROP restores a dropped object as long as it's still within its Time Travel retention window and hasn't been purged. Two hours into a 1-day window, a simple UNDROP TABLE is sufficient — Fail-safe (Support-only recovery) isn't needed yet.
6. **A.** Snowflake's object hierarchy runs Organization → Account(s) → Database → Schema → object (tables, views, etc.). Getting this top-down order backwards is a common early-career mix-up.
7. **D.** As with other Snowflake precedence rules, a network policy set at the more specific (user) level overrides the broader account-level default for that user — the partner-office IP is evaluated against the user-level policy.
8. **C.** The Kafka connector is purpose-built for this — auto-creating the destination table and pipe per topic and streaming the topic's data in through Snowpipe or Snowpipe Streaming, without hand-written DDL per topic.
9. **A.** A single VARIANT value is capped at roughly 16MB compressed. A document exceeding that must be restructured — split across rows, partially flattened, or trimmed — before it can load; switching container formats doesn't remove the VARIANT value size cap.
10. **B — A Data Clean Room.** Data Clean Rooms are Snowflake's purpose-built pattern for privacy-preserving joint analysis between two parties, built on secure views/UDFs plus strict governance so neither side's raw rows are ever exposed to the other.
11. **B — ≈0.77 credits.** Billing is per-second (after a 60-second minimum) for the full time the warehouse is up, including idle time before auto-suspend fires: 45s + 300s = 345s. At 8 credits/hr (0.002222 credits/sec), that's ≈0.77 credits.
12. **B — ORGADMIN.** ORGADMIN operates above individual accounts — managing the organization itself, including creating new accounts and viewing org-wide usage. ACCOUNTADMIN is scoped to a single account. (GLOBALADMIN is not a real Snowflake role.)
13. **B.** VARIANT is schema-on-read: semi-structured formats (JSON, Avro, ORC, Parquet, XML) load naturally into a VARIANT column, absorbing schema drift without altering the table. Fields are extracted with `:`/bracket notation or FLATTEN() at query time.
14. **B.** Poor pruning despite a selective filter signals the filter column isn't well-clustered — arrival-order loading scatters matching customer_id values across many partitions. A clustering key on customer_id restores pruning effectiveness, and is justified here by the table's large size and frequent filtering.
15. **B.** Cloning a schema/table containing a stream with unconsumed records produces a stream re-initialized at the point of cloning in the clone — pending records from the original don't carry over. A documented gotcha, distinct from any timing or async issue.
16. **B.** VPS is the top tier: fully isolated, dedicated infrastructure with no multi-tenancy at any layer. Business Critical (even with Tri-Secret Secure) still runs on Snowflake's standard multi-tenant infrastructure, just with additional security controls layered on top.
17. **D.** WITH GRANT OPTION lets a role that receives a privilege re-grant it onward to other roles. Without it, only the object's owner or a role holding the account-level MANAGE GRANTS privilege (by default only SECURITYADMIN/ACCOUNTADMIN) can grant that privilege to others.
18. **C.** A storage integration is an account-level object; one integration's IAM role/trust relationship can authorize access to many buckets and back many stages, as long as its configured allowed storage locations include them — there's no one-integration-per-stage requirement.
19. **D — APPROX_PERCENTILE.** `APPROX_PERCENTILE` (with incremental variants like `APPROX_PERCENTILE_ACCUMULATE`/`_ESTIMATE`) gives an approximate percentile at a fraction of the compute cost of an exact `PERCENTILE_CONT` at huge scale — the same accuracy-for-cost tradeoff `APPROX_COUNT_DISTINCT` makes for distinct counts, but for percentiles.
20. **C.** Secure Data Sharing only works within the same cloud region/provider. A provider and consumer on different clouds or regions requires the provider to first replicate the shared database/share to an account in the consumer's own region/cloud.
21. **B.** Snowflake's pruning relies on lightweight per-partition metadata — min/max values and null counts per column, per micro-partition — held in the Cloud Services metadata cache. It's not a traditional index or bloom filter.
22. **C — Key-pair authentication.** Key-pair authentication uses a public/private key pair with no interactive password/MFA/SSO step, making it the standard choice for service accounts and automated pipelines. A network policy restricts by IP but isn't itself an authentication method.
23. **B — Snowpipe Streaming.** Snowpipe Streaming pushes rows directly without staging files first, achieving sub-second to low-second latency. File-based Snowpipe (event-triggered) is micro-batch (seconds-minutes) — right for the irregular-batch case, not the ~1-second trade-event case; scheduled COPY fits the predictable nightly file.
24. **C.** Output far exceeding both inputs combined is the signature of an exploding join — typically a join key that isn't unique on one side, multiplying rows. The fix is correcting the join condition or de-duplicating the join key first, not caching, clustering, or QAS.
25. **B.** In Secure Data Sharing, the consumer queries the provider's storage directly with their own compute — the consumer's warehouse is billed, not the provider's. Only reader accounts (for consumers with no Snowflake account of their own) flip this, with the provider paying on the consumer's behalf.
26. **C.** Multi-cluster warehouse billing multiplies the size's per-hour rate by however many clusters were actually running during that period, not the configured MAX_CLUSTER_COUNT. 8 × 2.2 ≈ 17.6 credits.
27. **B — An event table.** Event tables are Snowflake's structured logging/tracing sink — handler code (stored procedures, UDFs, Native Apps) emits log messages and trace spans into an event table, queryable like any other table, for observability of code running inside the platform.
28. **D.** A stream's offset only advances when it's consumed inside a DML statement in an explicit or implicit transaction. A read-only preview `SELECT` doesn't touch the offset, so the pending records are still there for the Task to consume later.
29. **C.** Nondeterministic functions (`UUID_STRING()`, `RANDOM()`, `RANDSTR()`, etc.) explicitly invalidate result-cache eligibility, since a cached result would return the same 'fresh' value every time — defeating the whole point of the function.
30. **D.** The `SECURE` keyword on a UDF hides its definition from anyone without ownership privilege, while still letting authorized callers invoke it and use its result — mirroring what a secure view does for query logic, but for a function's formula.
31. **B.** Mixing heterogeneous workloads (latency-sensitive vs. long-running) on one warehouse causes contention and queuing. Best practice is isolating workloads by team/pattern onto dedicated warehouses, each sized/scaled for its own profile.
32. **B.** Federated authentication (SSO via SAML2) delegates login to an external IdP, centralizing identity management rather than maintaining Snowflake-native passwords per user.
33. **B — An append-only stream.** Append-only streams capture inserts only and are more performant than standard streams for insert-heavy workloads, since they skip the insert/delete reconciliation join standard streams perform. Insert-only streams are scoped to external/externally-managed source types, not standard tables.
34. **B.** A gap between submission and actual execution start (visible in query history/Query Profile) is queuing — a concurrency problem, not a query-plan problem. Fixed by scaling out (multi-cluster) or isolating workloads onto separate warehouses.
35. **B.** Private listings are visible only to specifically named consumer accounts — the invite-only equivalent of a public listing, well suited to internal/consortium-style distribution without public discoverability.
36. **D — A Sequence object (CREATE SEQUENCE).** Sequences are dedicated, low-contention auto-incrementing number generators, purpose-built for exactly this — avoiding the row-locking a manual counter-table approach would cause under concurrent access.
37. **D.** CREATE ALERT defines a scheduled SQL condition check that fires an action when true. Paired with a notification integration (email/webhook) — and often event tables for the data the condition checks — it automates exactly this kind of threshold-based data-quality monitoring.
38. **B.** Transferring ownership of an external table resets its AUTO_REFRESH parameter to FALSE by default — a documented, easy-to-miss gotcha. Left unnoticed, the table silently stops picking up new files until someone re-enables AUTO_REFRESH or manually runs `ALTER EXTERNAL TABLE ... REFRESH`.
39. **C.** For a multi-column clustering key, column order affects how much a single-column filter benefits — a filter on a trailing key column prunes less effectively than one on the leading column(s). Reordering to `CLUSTER BY (order_date, region)` would better match the actual query pattern.
40. **C.** Paid listings integrate with Snowflake's own billing infrastructure, letting a provider charge consumers for access directly through the platform rather than a separate out-of-band invoicing process.
41. **B — AI_CLASSIFY.** AI_CLASSIFY assigns text (or images) into user-defined categories from plain-language definitions, with no custom model training. AI_COMPLETE is general-purpose generation, AI_SENTIMENT scores emotional tone, and AI_EMBED produces vectors for similarity/clustering.
42. **B — A masking policy.** Masking policies are column-level security: the same column's displayed value can vary based on the querying role, with no data duplication. Row access policies control which rows are visible, not how a column's value renders.
43. **B.** Insert-only streams are scoped to external/externally-managed source types (external tables, externally managed Iceberg tables, and similar). Standard Snowflake-managed tables use standard or append-only streams instead.
44. **B.** Clustering keys pay off on large (multi-TB), frequently-filtered/joined tables where reclustering has real pruning benefit to offer. A 200-row table already fits in a handful of micro-partitions, so clustering only adds background recluster cost for no measurable gain.
45. **B.** EXECUTE AS CALLER runs the procedure with the calling role's own privileges, so it can never see more than the caller already could — the right choice when a shared/governed procedure must not become a privilege-escalation path. OWNER's rights, the actual default, runs with the creator's broader privileges instead — exactly what this scenario needs to avoid.
46. **A.** Snowpark exposes Python, Java, and Scala APIs, all of which push execution down into Snowflake's own compute rather than pulling data client-side — the Scala team's existing expertise transfers directly.
47. **D — The automatic data lineage graph.** Snowsight automatically tracks and visualizes object-to-object dependencies — which tables/views feed which downstream objects — with no manual instrumentation or custom querying required, directly answering this kind of multi-hop impact question.
48. **D.** A user-managed task runs on — and bills through — whichever warehouse it's assigned, contending with anything else scheduled there. A serverless task bills its own Snowflake-managed compute, sized automatically based on recent run history, entirely separate from any warehouse.
49. **D.** `SYSTEM$CLUSTERING_INFORMATION` reports clustering-quality metrics (depth, overlap) for a table on a given column expression — the diagnostic to run before committing to a clustering key, distinct from QAS's and Search Optimization's own cost/eligibility estimators.
50. **B.** A failover group can replicate account-level objects (users, roles, warehouses, resource monitors) in addition to databases — plain database replication alone doesn't carry these. Replicated warehouses land in a suspended state in the target account and must be explicitly resumed once failover actually occurs.
51. **B — AI_TRANSLATE.** AI_TRANSLATE converts text between supported languages inline in SQL. AI_EXTRACT pulls structured information out of text/documents, AI_SUMMARIZE_AGG condenses many rows into a single summary, and AI_PARSE_DOCUMENT OCRs/parses staged documents.
52. **B — A row access policy on the table.** Row access policies restrict which rows a role can see at query time. Masking only changes how a column's value renders — it doesn't hide entire rows.
53. **B — A serverless task.** Serverless tasks let Snowflake automatically size compute based on analysis of recent runs of the same task — well suited to under-utilized warehouses with unpredictable, infrequent workloads. User-managed tasks fit consistent, predictable load on an already-shared warehouse instead.
54. **C.** Materialized views in Snowflake support only a single source table, ruling that option out for a three-way join. A Dynamic Table declaratively expresses the join plus logic as one query and a target lag, with Snowflake handling incremental refresh automatically.
55. **B — AI_PARSE_DOCUMENT.** AI_PARSE_DOCUMENT converts digital-native or scanned documents (including images) into rich text while preserving layout — the standard first step before further Cortex processing such as classification or structured extraction. AI_EXTRACT instead pulls structured fields out of text that's already in a workable format.
56. **D.** A resource monitor isn't limited to one warehouse — it can be assigned to several, with quota and threshold actions evaluated against their combined credit consumption, exactly the pooled-budget scenario described.
57. **B — The Spark connector.** The Spark connector is purpose-built for reading/writing Snowflake tables as Spark DataFrames, with filter and other operation pushdown to Snowflake compute — distinct from the Python connector (general Python application code) or Snowpipe (continuous file ingestion).
58. **C.** Search Optimization's substring access paths require a minimum of 5 characters to be used — searches for shorter substrings fall back to a regular table scan, regardless of whether SUBSTRING search is enabled on the column.
59. **B.** External functions let SQL call out to code hosted outside Snowflake (e.g. a Lambda or Azure Function), authorized via an API integration object. A Snowpark UDF, by contrast, runs its logic inside Snowflake compute.
60. **B.** Aggregation policies enforce a minimum group size on any query against the protected object, regardless of how the query is written. A secure view's HAVING clause could be sidestepped by rewriting the query — exactly the gap aggregation policies close.
61. **B.** The WHEN SYSTEM$STREAM_HAS_DATA(...) condition lets a scheduled task skip execution entirely when the stream has no pending changes, avoiding wasted runs — the standard pattern for stream+task incremental ELT.
62. **B.** Background reclustering physically rewrites micro-partitions, which invalidates the result cache even though the logical query result is unchanged — a documented, easy-to-miss gotcha distinct from the cache's normal retention window.
63. **C.** SNOWFLAKE.CORTEX.SUMMARIZE is the legacy row-level function (condenses one text value, capped at 32K input / 4,096 output tokens). AI_SUMMARIZE_AGG reads across many rows and produces one combined summary, supporting GROUP BY for exactly the per-product-line rollup described.
64. **A.** OAuth (via Snowflake's own OAuth server or an external OAuth provider) is designed for exactly this — short-lived, scoped, refreshable tokens issued through a standard authorization flow, without repeatedly handling a raw password.
65. **C — PUT file://<local_path> @stage.** `PUT` uploads a local file to a stage (internal user, table, or named stage) — the necessary first step before `COPY INTO <table>` can bulk-load it. `COPY INTO @stage` (going the other direction) is used for unloading query results, not uploading local files.
66. **B.** QAS is eligible for two patterns: large scans with a selective filter, and large-volume INSERT/COPY operations. A large `INSERT ... SELECT` with a filter is squarely the second pattern, not excluded just because it's a write rather than a plain SELECT.
67. **B.** Snowflake Notebooks provide a cell-based, iterative development environment suited to exploration. Streamlit in Snowflake is for building and hosting polished, interactive data apps for end users.
68. **B.** Object tags (e.g. a COST_CENTER tag on each warehouse) combined with ACCOUNT_USAGE.TAG_REFERENCES let cost be attributed programmatically without renaming objects or splitting accounts. Resource monitors cap spend but don't attribute it.
69. **B — An ODBC or JDBC driver.** ODBC/JDBC are the standards-based drivers most third-party BI tools rely on when there's no native Snowflake integration. The Python connector is for Python application code, and the Kafka connector is for streaming topic ingestion.
70. **B.** The warehouse-local cache holds raw input micro-partition data on that warehouse's physical nodes. Suspending (or resizing) changes the underlying nodes, so the cache is lost — the resumed warehouse must re-fetch from remote storage, costing real compute again even without a result-cache hit.
71. **D.** The Snowflake CLI is the command-line, scriptable tool built for exactly this — connecting, running SQL, and managing object/project configuration from CI/CD, in contrast to Snowsight's browser-based, human-driven worksheets.
72. **D.** Snowflake has no column-level GRANT syntax — privileges like SELECT are granted at the table/view level. Column-level restriction requires a secure view projecting only the allowed columns, or a masking policy hiding the restricted ones.
73. **C.** Unloading uses `COPY INTO <stage>` to write query results out as files in a stage, then `GET` downloads those files from the stage to a local filesystem — the mirror image of the `PUT` + `COPY INTO <table>` loading workflow.
74. **D — LAG().** `LAG()` (and its counterpart `LEAD()`) reaches back (or forward) to a prior (or following) row's value within a window — exactly what's needed to bring the previous month's revenue into the current month's row for a period-over-period comparison.
75. **B.** CURRENT_DATABASE() and CURRENT_SCHEMA() return NULL whenever no database/schema context has been established for the session — via USE, a connection default, or a user's default namespace. A common gotcha for code relying on implicit context.
76. **B.** Replication keeps a secondary continuously in sync, but promoting it to primary — failover — is a deliberate, explicit operation. It is not automatic.
77. **B — An API integration.** An API integration authorizes Snowflake to call a specific external API endpoint (used by external functions and some webhook-style notification patterns) without embedded credentials. A storage integration is the analogous object for cloud storage access, not API calls.
78. **B.** FLATTEN() explodes a nested array/object in a VARIANT column into one row per element, typically used in a LATERAL join back to the source row so scalar columns like order_id carry through onto each exploded item row.
79. **A.** Snowpark-optimized warehouses carry roughly a 1.5× credit-rate premium over same-size Standard (a Medium runs ≈6 credits/hour vs. 4), in exchange for roughly 16× the memory per node — the tradeoff that makes them worth it specifically for memory-intensive Snowpark/ML training, not a default choice for ordinary SQL.
80. **B.** Future grants (`GRANT ... ON FUTURE <object_type> IN SCHEMA/DATABASE ...`) predefine privileges that new objects automatically receive the moment they're created — no scheduled re-run or manual re-granting needed, unlike a nightly Task re-issuing GRANT ON ALL.
81. **D.** By default, semi-structured formats like Parquet load into a single VARIANT column unless told otherwise. `MATCH_BY_COLUMN_NAME` maps Parquet columns to target table columns by name (regardless of file column order), commonly paired with `INFER_SCHEMA` to auto-generate the target table's column definitions in the first place.
82. **D.** `MERGE` performs a conditional insert-or-update (or delete) against a target table based on a join condition, in one atomic statement — the standard upsert pattern, avoiding a separate DELETE+INSERT or two disjoint statements.
83. **C.** Auto-suspend is driven by idle time (no executing queries), not wall-clock time since resume. A warehouse with an actively running query never suspends mid-query.
84. **B — Trust Center.** Trust Center is Snowsight's built-in security-posture dashboard, surfacing scanner findings and recommendations account-wide out of the box, with no custom querying required.
85. **B.** QAS targets disproportionately large/long outlier queries (large scans, big DML) by offloading to serverless compute. Search Optimization Service targets highly selective point lookups (equality, IN, substring) on columns that don't naturally benefit from clustering — different tools for different access patterns.
86. **B — A catalog integration.** A catalog integration is the object that connects Snowflake to an externally-managed Iceberg REST catalog (e.g. one built on Apache Polaris, such as Snowflake Open Catalog) — distinct from a storage integration (cloud object storage access) or API integration (calling an external API endpoint).
87. **C.** Tri-Secret Secure layers a customer-managed key into the composite master key. Revoking it makes the data undecryptable by Snowflake and aborts running queries against it — an intentional capability giving the customer a hard kill switch during an incident, not an accidental side effect.
88. **C.** Because storage is columnar, Snowflake only needs to read the columns actually referenced by the query. `SELECT *` forces it to read all 200 columns' data; projecting just the 3 needed columns lets it skip the other 197 entirely — a direct, low-effort fix, not something clustering or QAS addresses.
89. **C — Business Critical.** Database/account replication and failover are Business Critical+ features on their own — regardless of whether HIPAA/PCI or Tri-Secret Secure are also needed. Enterprise alone doesn't include replication/failover.
90. **D.** A materialized view is maintained close to continuously to stay near-real-time consistent with its base table. A Dynamic Table's TARGET_LAG gives Snowflake room to batch refreshes efficiently, which is generally the more cost-effective choice whenever a real (non-zero) staleness tolerance exists.
91. **D.** Temporary tables exist only for the creating session and are invisible elsewhere. A Transient table is visible account-wide like a normal permanent table (grantable, queryable by other sessions/roles) but skips Fail-safe — exactly what's needed here.
92. **B — Enterprise.** Multi-cluster warehouses, materialized views, search optimization, and up to 90-day Time Travel are all Enterprise-tier features. Nothing in this requirement list needs Business Critical-only capabilities like replication or Tri-Secret Secure.
93. **C.** QUERY_TAG is a session parameter that stamps a chosen label onto every query run in that session, queryable later in QUERY_HISTORY/ACCOUNT_USAGE — a lightweight way to attribute cost/usage without restructuring warehouses or roles.
94. **B.** Micro-partitions are immutable. Any DML rewrites the affected micro-partition(s) as new ones; the old partition becomes inactive but is retained (for Time Travel/Fail-safe) until it ages out.
95. **A.** STATEMENT_QUEUED_TIMEOUT_IN_SECONDS specifically bounds how long a query may wait in queue; STATEMENT_TIMEOUT_IN_SECONDS bounds execution time once running. They address different phases of a query's lifecycle.
96. **B — A Snowpark-optimized warehouse.** Snowpark-optimized warehouses provide substantially more memory per node, purpose-built for memory-intensive Snowpark/ML workloads that spill on standard warehouses.
97. **D — AUTO_RESUME = FALSE.** AUTO_RESUME (default TRUE) controls whether the warehouse automatically resumes the moment a query is submitted to it. Setting it FALSE means an explicit `ALTER WAREHOUSE ... RESUME` is required first — INITIALLY_SUSPENDED only governs the warehouse's state right after CREATE WAREHOUSE.
98. **B.** Standard reacts immediately — starting a new cluster the moment a query actually queues or Snowflake predicts an imminent shortfall. Economy instead requires an estimated 6+ minutes of queued work before starting a cluster, trading responsiveness for cost.
99. **C.** Cortex Analyst is purpose-built for natural-language-to-SQL over a defined semantic model; Cortex Search is Snowflake's retrieval/search feature for grounding RAG-style workflows over unstructured data; Snowflake ML covers in-platform model training, registry, and lifecycle management.
100. **C.** Parameter precedence follows most-specific-level-set-wins across account → user → session → object levels. A session-level ALTER SESSION overrides both the account and user defaults, but only for that session.
