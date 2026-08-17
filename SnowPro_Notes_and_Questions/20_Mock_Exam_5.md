# Mock Exam 5 — Full-Length Practice Exam (100 Questions)

Fifth and hardest in the series — same domain-weighted split as the real exam (**Domain 1
(Architecture & Features): 31, Domain 2 (Account Mgmt & Governance): 20, Domain 3 (Data
Loading/Unloading/Connectivity): 18, Domain 4 (Performance & Transformation): 21, Domain 5 (Data
Collaboration): 10**, 100 questions, interleaved rather than blocked), leaning deliberately into
comparative, easy-to-confuse pairs (e.g. masking vs. row access vs. aggregation policy, Dynamic
Table vs. materialized view, direct share vs. reader account vs. listing) rather than single-fact
recall — save this one for last.

Every question in this exam is new and original — it does **not** reuse any question from the
domain-authored practice files (`10`-`14`), from Mock Exam 1, or from any of the other mocks in
this series. All five mock exams are built to be mutually distinct: 500 different questions across
the 5 mocks. Original content throughout, verified against the domain notes and live Snowflake
documentation — never sourced from or modeled on an exam-dump site.

No official single-choice/multi-select ratio is published for the real exam, so this one uses a
reasonable, clearly-labeled mix, same as the rest of the series.

Take this closed-book, timed to 115 minutes, and log your score plus per-domain breakdown in
[06_Practice_Exam_Tracker.md](06_Practice_Exam_Tracker.md).

---

**1. [D1]** During an incident, Snowflake's Cloud Services layer in a region degrades while the underlying compute and storage layers remain healthy. A team is trying to determine what will actually break for their running pipelines. Which is the most accurate consequence of this specific failure mode?

A. Warehouses that are already running queries will fail mid-query, since Cloud Services executes all SQL
B. New query submissions, authentication, and access-control checks are impacted account-wide, even though warehouse compute clusters themselves are unaffected
C. Only the largest warehouse in the account is affected, since Cloud Services scales per warehouse
D. Storage durability is at risk, since Cloud Services also manages the physical replication of micro-partitions

**2. [D2]** A healthcare analytics table has a patient_ssn column. Analysts in ANALYTICS_ROLE should see it fully redacted (e.g. 'XXX-XX-1234'), while COMPLIANCE_ROLE should see the real value — same column, same query, different output depending on the querying role. Which governance feature directly fits?

A. A row access policy on the table
B. An aggregation policy requiring a minimum group size
C. A masking policy attached to the patient_ssn column, evaluated at query time based on the querying role
D. A secure view that omits the column entirely

**3. [D3] (Select TWO)** Select TWO change types that a standard stream tracks which an append-only stream deliberately does not.

A. Row inserts
B. Row updates (before/after versions)
C. Row deletes
D. Schema DDL changes to the source table

**4. [D4]** One report query on a shared BI warehouse routinely scans a multi-terabyte fact table with a moderately selective filter and takes far longer than every other query sharing that warehouse. Resizing the warehouse would speed up this one query but also raise the cost of every other (already-fast) query running on it. Which lever addresses just the outlier query?

A. Search Optimization Service, since it targets any large scan
B. Query Acceleration Service (QAS), which offloads eligible portions of an outlier query's scan to separate serverless compute without resizing the warehouse itself
C. A clustering key on the warehouse's default configuration
D. Materialized views, precomputing the report ahead of time regardless of the underlying data's change frequency

**5. [D5]** A provider wants to share data with a business partner who has no Snowflake account of their own and no plans to acquire one, but still needs the partner to run their own SQL queries against the shared data using compute the provider is willing to pay for on the partner's behalf. Which mechanism fits?

A. A public listing, since it requires no consumer account either
B. A reader account — a special account type the provider creates and pays the compute for, specifically for consumers without their own Snowflake account
C. A direct share, since direct shares work for any recipient with or without an account
D. A private listing, restricted to the partner's organization name

**6. [D1]** An architect is choosing between Cortex Analyst, Cortex Search, and a plain AI_COMPLETE call for a support-desk tool that needs to answer 'how many refunds did we process last quarter, broken down by region?' by generating and running real SQL against a defined semantic model of the sales schema. Which fits, and why do the other two fall short?

A. Cortex Search — it's the general-purpose AI feature, so it can also generate SQL if asked
B. Cortex Analyst — purpose-built for natural-language-to-SQL over a defined semantic model, producing an actual query and result rather than free-text retrieval or a single LLM completion
C. AI_COMPLETE alone — a generic LLM completion call can reliably generate correct SQL from a schema description with no other tooling needed
D. None of the three; this requires Snowflake ML instead

**7. [D2]** An architect must choose between a masking policy, a row access policy, an aggregation (privacy) policy, and a secure view to satisfy this requirement: 'analysts may only ever see results aggregated across at least 25 customers at once — never any single customer's row, no matter how the query is written.' Which one specifically enforces this, and why do the other three fall short?

A. A masking policy — it can be configured to hide any row below a threshold
B. An aggregation (privacy) policy — the only one of the four that enforces a minimum group size on query RESULTS regardless of query structure; masking alters column values but doesn't prevent row-level access, row access policies restrict which rows are visible but not the aggregation shape of the output, and a secure view only hides the view's own definition, not the underlying data's exposure pattern
C. A row access policy, since 'access' is literally in the requirement's phrasing
D. A secure view, since 'secure' matches the compliance-sounding requirement

**8. [D3]** A team is choosing between a standard stream and an append-only stream for a pure ELT pipeline that only ever needs newly-inserted rows (updates/deletes on the source table are irrelevant to this pipeline and should be ignored entirely). Which is the better-targeted choice, and what's the concrete benefit of picking correctly?

A. A standard stream, since it captures the most information and is therefore always the safer default
B. An append-only stream — since only inserts matter to this pipeline, it avoids tracking/joining update and delete records entirely, making it more performant for pure insert-driven ELT than a standard stream would be for the same workload
C. Neither works for this use case; only Snowpipe Streaming can filter to inserts only
D. A standard stream, since append-only streams cannot be consumed inside a MERGE or INSERT...SELECT statement

**9. [D4]** An architect must choose between a clustering key, Search Optimization Service, Query Acceleration Service, and a materialized view for four different symptoms observed in four unrelated tables. Table W has poor pruning on a range-filtered column across a huge, frequently-queried table. Table X gets random exact-match point lookups on a high-cardinality column. Table Y has one disproportionately expensive outlier query relative to its warehouse's other workload. Table Z has an expensive aggregation recomputed on every dashboard load over slowly-changing data. Match each to its fix.

A. All four should use Search Optimization Service, since it's the most broadly capable feature
B. W: clustering key (range-filter pruning on a large table); X: Search Optimization Service (point lookups on a non-clustering-friendly column); Y: Query Acceleration Service (one outlier query, avoid resizing the whole warehouse); Z: materialized view (precomputed, auto-maintained aggregation over slowly-changing data)
C. W: Query Acceleration Service; X: clustering key; Y: materialized view; Z: Search Optimization Service — the reverse-shuffled mapping
D. All four are solved equally well by simply upsizing the warehouse instead of using any of these four features

**10. [D5]** An architect is comparing Time Travel, Fail-safe, and a manual scheduled backup-table pattern (e.g. nightly `CREATE TABLE backup CLONE prod`) for a business requirement of 'must be able to recover any accidentally-deleted row from up to 60 days ago, self-service, without contacting Snowflake support.' Which approach(es) actually satisfy this, and why do the others fall short?

A. Time Travel alone satisfies this on any edition, since its default retention already covers 60 days
B. Only a manual backup-table pattern reliably satisfies a 60-day self-service requirement here — Time Travel tops out at 90 days self-service on Enterprise+ (so it COULD satisfy this on the right edition), but Fail-safe is support-only (not self-service) and only kicks in after Time Travel ends, making it unsuitable alone for a self-service requirement regardless of its 7-day duration
C. Fail-safe alone satisfies this, since 7 days plus 90 days of Time Travel comfortably covers 60 days
D. None of the three can ever satisfy a 60-day recovery requirement under any configuration

**11. [D1]** An architect is asked whether Snowflake's storage layer needs a manually configured cross-availability-zone replication strategy to protect against a single data center failure, the way they'd configure it for a self-managed database on a VM. What is the accurate answer for Snowflake-managed storage?

A. Yes — the customer must enable a replication group at the storage layer specifically, separate from database replication
B. No — the Database Storage layer sits on the cloud provider's own object storage, which the provider already redundantly stores across multiple availability zones, transparent to the customer
C. Yes — only Business Critical edition includes cross-AZ storage redundancy; Standard and Enterprise store a single copy
D. No, but only because Time Travel retention substitutes for cross-AZ redundancy

**12. [D2]** A multi-region sales table must ensure a regional sales rep's role only ever sees rows for their own assigned region, while a global sales director role sees all rows — enforced consistently regardless of which tool or query pattern is used to access the table. Which feature fits?

A. A masking policy on the region column
B. A row access policy that filters visible rows based on the querying role's assigned region
C. A projection policy on the region column
D. Restrict access via a separate table per region and grant selectively

**13. [D3]** A team wants to create a change-tracking stream on a table that is an Apache Iceberg table managed by an external catalog (writes happening outside Snowflake's own engine). Which stream type must be used, and why?

A. A standard stream — Iceberg tables always support full standard-stream semantics regardless of catalog
B. An append-only stream, since Iceberg tables never support update/delete tracking
C. An insert-only stream (INSERT_ONLY = TRUE) — required when the source is an externally-managed Iceberg table, since Snowflake lacks full change-tracking visibility into writes made outside its own engine
D. No stream type is supported on any Iceberg table; use a Dynamic Table instead

**14. [D4]** A support application does frequent equality and IN-list point lookups on a ticket_id (non-sequential UUID) column of a large table, and these lookups are slow despite the column having a highly selective filter, because the column isn't naturally well-clustered. What's the right tool?

A. Query Acceleration Service, since QAS accelerates any slow query on a large table
B. Search Optimization Service, purpose-built to accelerate highly selective point-lookup/equality/IN/substring queries on columns that don't naturally benefit from clustering
C. A clustering key on ticket_id, since clustering always outperforms Search Optimization for equality filters
D. APPROX_COUNT_DISTINCT on the ticket_id column

**15. [D5]** A Business Critical edition account needs disaster recovery where a secondary region account can be promoted to become the new primary if the primary region has an outage — not just a read-only copy of the data. Which object should be used, and why not the alternative?

A. A replication group, since replication groups support promotion to primary just like failover groups
B. A failover group — unlike a replication group, which provides read-only replication only, a failover group specifically supports promoting the secondary to primary
C. Either works identically; the only difference is naming convention
D. Neither — promotion to primary requires Virtual Private Snowflake (VPS), not Business Critical

**16. [D1]** A team is choosing between a Standard Gen2 warehouse and a Snowpark-Optimized warehouse for a workload that's CPU-bound (heavy SQL joins/aggregations, minimal Python UDF usage) rather than memory-bound. Which is the better fit, and why would the other option be wasteful here?

A. Snowpark-Optimized, since it's always the newer, better warehouse type
B. Standard Gen2 — its price/performance improvements target general CPU-bound SQL workloads; Snowpark-Optimized's extra per-node memory is a cost premium specifically for memory-intensive Python/Snowpark workloads, which would go largely unused on a CPU-bound job
C. Standard Gen1, since Gen2 is only beneficial for memory-bound workloads
D. Neither — CPU-bound workloads require a multi-cluster Economy-policy warehouse specifically

**17. [D2]** A platform team must choose between an account role, a database role, and secondary roles for privileges that need to travel with a database into a replication target in another account, where the privileges apply only to objects within that one database. Which fits precisely, and why do the other two not fit?

A. An account role — account-wide scope makes it the most flexible choice for any privilege-portability need
B. A database role — scoped to objects within a single database and grantable to an account role, letting its privileges travel with the database into a share or replication target; an account role is account-wide (broader than needed) and doesn't travel with the database the same way, and secondary roles are a session-activation mechanism, not a privilege-packaging mechanism at all
C. Secondary roles, since they let multiple privilege sets combine at once
D. None of the three support this; only a resource monitor can be replicated alongside a database

**18. [D3]** A team needs change tracking on an externally-managed Iceberg table (not a Snowflake-managed one). They initially try to create a standard stream on it and it fails. Which stream type is actually required for this specific source, and why do standard and append-only streams not apply here?

A. An insert-only stream — required specifically for external tables and externally-managed Iceberg tables, whereas standard and append-only streams are supported on standard tables, Dynamic Tables, and Snowflake-MANAGED Iceberg tables (not externally-managed ones)
B. A standard stream should actually work; the failure must be an unrelated permissions issue
C. No stream type supports externally-managed Iceberg tables at all; Snowpipe Streaming must be used instead
D. An append-only stream, since it's the most restrictive and therefore the most broadly compatible type

**19. [D4]** Two queries return identical rows in identical order, one using `SELECT * FROM orders o` and the other `SELECT * FROM orders`. An architect claims both should hit the same result-cache entry since they're logically identical. Is that claim correct?

A. Yes — the result cache is based on logical query equivalence, so aliasing differences are irrelevant
B. No — Snowflake's documentation states any syntax difference, including the presence or absence of a table alias, inhibits 100% cache reuse; the two queries would NOT share a cache entry despite being logically identical
C. Yes, but only if both queries ran on the exact same warehouse
D. No, but only because one query is missing an explicit column list

**20. [D5]** A provider is choosing between zero-copy cloning a database daily for a stable dev/test snapshot, versus continuously replicating it via a replication group, versus a failover group. The dev/test environment (a) doesn't need real-time freshness, (b) never needs to be promoted to primary, and (c) should minimize ongoing storage cost until it actually diverges from prod. Which fits best, and why do the other two overshoot the requirement?

A. A failover group — since it's the most fully-featured option, it's always the safest default choice
B. Zero-copy cloning — a daily clone is metadata-only at creation (near-zero storage cost until the clone or source diverges via copy-on-write), matches the 'no real-time freshness needed' requirement, and needs no promotion capability; a replication group would keep the copy continuously in sync (unneeded freshness overhead) and a failover group additionally requires Business Critical edition for capability (promotion) this environment will never use
C. A replication group, since it's specifically designed for dev/test environments
D. All three are functionally and cost-wise identical for this scenario

**21. [D1]** An account has TIMEZONE set to 'UTC' at the account level. A specific user's profile has TIMEZONE set to 'America/New_York'. Within one worksheet session, that user runs ALTER SESSION SET TIMEZONE = 'Asia/Kolkata' and then queries CURRENT_TIMESTAMP(). Which timezone governs the result?

A. UTC, because account-level parameters always take precedence for consistency
B. America/New_York, because user-level settings override session-level settings for authenticated users
C. Asia/Kolkata, because session parameters resolve via the Account -> User -> Session hierarchy, and the most specific level set wins
D. It's undefined — Snowflake does not guarantee a resolution order across three levels

**22. [D2]** A research team may query a sensitive clinical-trial table, but compliance requires that no query can ever return individual patient-level rows — every result must be an aggregate covering at least 25 patients, no matter how the query is written (including attempts to filter down to a single row). Which mechanism enforces this specifically?

A. A row access policy with a WHERE-clause-style filter
B. A masking policy applied to every column in the table
C. An aggregation policy with MIN_GROUP_SIZE = 25, enforced regardless of how the query is constructed
D. A secure view with a hardcoded GROUP BY

**23. [D3]** A nightly ELT job must run at a precise, predictable start time with guaranteed compute availability, and the team already has a dedicated warehouse sized for it that they don't want competing for Snowflake-managed serverless capacity with other accounts' workloads. Which task model fits better?

A. A serverless task, since Snowflake automatically predicts and assigns optimal compute
B. A user-managed task, bound to their own dedicated virtual warehouse — giving predictable performance with no cold-start or serverless queuing risk, since the warehouse is already sized and available
C. Either model is functionally identical for this requirement
D. A serverless task with TASK_AUTO_RETRY_ATTEMPTS set very high to guarantee timing

**24. [D4]** A team runs SYSTEM$ESTIMATE_QUERY_ACCELERATION() against a query with a highly selective filter (matching 0.04% of rows) over a roughly 1GB sample table, expecting QAS eligibility given how selective the filter is. The function returns 'ineligible' with reason NO_LARGE_ENOUGH_SCAN. What does this reveal about QAS eligibility?

A. QAS eligibility is based purely on filter selectivity percentage, and 0.04% should have qualified — this is a bug
B. QAS eligibility depends on the absolute scan size being large enough to be worth splitting across additional compute, not just how selective the filter is — a small table stays ineligible regardless of selectivity
C. QAS only evaluates eligibility for DML statements, never SELECT queries with filters
D. The table needs a clustering key before QAS eligibility can be evaluated at all

**25. [D5]** A compliance requirement mandates the ability to self-service restore a specific table to its exact state as of 180 days ago, on demand, without contacting Snowflake Support. The account is on Enterprise edition. Which approach actually satisfies this?

A. Set DATA_RETENTION_TIME_IN_DAYS = 180 on the table, since Enterprise supports Time Travel up to that window
B. Rely on Fail-safe, since its 7-day window plus Time Travel's up-to-90-day window together cover 180 days
C. Neither Time Travel (capped at 90 days self-serve) nor Fail-safe (support-only, fixed 7 days after Time Travel ends) covers a 180-day self-service window — a manual pattern like scheduled periodic clones or backup tables into separate long-lived storage is needed instead
D. Upgrade to Business Critical edition, which raises the Time Travel maximum to 180 days

**26. [D1]** A team is deciding between an Iceberg table and a Dynamic Table for a use case where an external Spark job and Snowflake both need to write to the same underlying table concurrently, with no transformation logic involved — just shared, interoperable storage. Which fits, and why is the other a mismatch?

A. A Dynamic Table, since it automatically handles concurrent access from any engine
B. An Iceberg table, since it's built for open, cross-engine interoperable storage that multiple engines (including Spark) can read/write; a Dynamic Table is a declarative transformation output, not a general-purpose interoperable storage target
C. Either works identically for this use case
D. Neither; this requires an External table specifically, since Iceberg tables can't be written to at all

**27. [D2]** A support team needs a stored procedure that lets a low-privilege caller trigger a controlled row-deletion routine on a table they can't directly DELETE from, while a SEPARATE audit procedure needs to log actions using the calling user's own session variables and warehouse context. Which execution-rights model fits each, and why would swapping them break each use case?

A. Both should use EXECUTE AS CALLER, since that's the more secure default
B. The deletion procedure needs EXECUTE AS OWNER (runs with the procedure owner's higher privileges, letting a low-privilege caller succeed via controlled logic they couldn't run directly); the audit procedure needs EXECUTE AS CALLER (runs with the caller's own privileges/session context, so it can read the caller's own session variables) — swapping them would either over-privilege the audit logic or fail to grant the deletion procedure the elevated access it needs
C. Both should use EXECUTE AS OWNER, since that's Snowflake's only supported execution model for stored procedures
D. The distinction only affects performance, not which privileges or session context apply

**28. [D3]** A team is choosing between a serverless task and a user-managed task for two different pipelines: Pipeline A runs on a wildly unpredictable schedule (sometimes idle for days, sometimes bursty), while Pipeline B runs on a rock-solid five-minute cadence with high, predictable concurrency needs the team wants full control over. Which fits which, and why?

A. Both should use serverless tasks, since serverless is strictly better in every scenario
B. Pipeline A fits serverless (Snowflake auto-allocates/sizes compute based on recent run history — good for unpredictable, bursty, or light workloads with no warehouse to manage); Pipeline B fits user-managed (an explicitly-sized, dedicated warehouse gives direct control over compute for a stable, predictable, high-concurrency schedule)
C. Pipeline A fits user-managed and Pipeline B fits serverless — the reverse mapping
D. The serverless-vs-user-managed distinction only affects billing granularity, not which scenario each is better suited for

**29. [D4]** An architect is comparing the query result cache, the metadata cache, and the warehouse local (SSD) cache on one specific point: which of the three can serve a query with the warehouse fully suspended and zero compute credits consumed?

A. All three require an active, running warehouse to serve anything
B. Only the query result cache — it lives in the Cloud Services layer and requires no running warehouse or compute credits on a hit; the metadata cache also lives in Cloud Services but serves specific metadata-driven queries (like unfiltered COUNT(*)) rather than arbitrary cached results, while the warehouse local cache is physically tied to a running warehouse's compute nodes and is unavailable (and irrelevant) when suspended
C. Only the warehouse local cache, since it's the fastest of the three
D. The metadata cache and the warehouse local cache both work with the warehouse suspended, but the result cache requires an active warehouse

**30. [D5]** A provider currently has an active direct share with several named consumer accounts and now wants to reach a much broader audience via the Marketplace without rebuilding the underlying object grants from scratch. What's the actual migration path, and is it possible to preserve the existing consumers?

A. The provider must delete the direct share entirely and start over with a brand-new listing from scratch, losing all existing consumer relationships
B. A direct share can be attached to a listing, or converted to a listing while keeping its active consumers — Snowflake's own sharing model treats direct shares and listings as related, composable mechanisms built on the same underlying share object, not mutually exclusive starting points
C. Direct shares and listings are entirely separate systems with no supported migration path between them
D. Only a brand-new database (not the existing shared one) can ever be published as a listing

**31. [D1]** A database has DATA_RETENTION_TIME_IN_DAYS = 30. A schema inside it has DATA_RETENTION_TIME_IN_DAYS = 7 explicitly set. A table inside that schema has no explicit retention setting of its own. What Time Travel retention does that table actually have?

A. 30 days, inherited from the database, since object parameters always fall back to the database default
B. 7 days, inherited from the nearest ancestor with an explicit setting, per the Account -> Database -> Schema -> Object hierarchy
C. 1 day, the Standard edition default, since no explicit table-level value was set
D. 0 days — an unset table-level parameter disables Time Travel regardless of ancestor settings

**32. [D2]** A provider wants to share a derived, filtered subset of an internal table with an external consumer account, and specifically does not want the consumer to see the view's SQL definition or reverse-engineer the filtering/masking logic behind it. Which object should the share expose?

A. The base table directly, with a row access policy applied
B. A secure view — its definition is hidden from viewers without privilege to see it, preventing the underlying logic from being inspected or reverse-engineered
C. A standard (non-secure) view, since view type doesn't affect what a share's consumer can see
D. A materialized view, since materialization itself hides the query definition

**33. [D3]** A team has a lightweight data-quality check task that runs unpredictably (sometimes hourly, sometimes not for days) and specifically doesn't want to size, monitor, or pay for an idle dedicated warehouse just to run this occasionally. Which task model fits best?

A. A user-managed task on the smallest available warehouse size, left running continuously
B. A serverless task, where Snowflake automatically predicts and provisions the needed compute per run, without the team managing a warehouse
C. Neither — sporadic schedules require an external orchestrator instead of Snowflake tasks
D. A user-managed task with aggressive auto-suspend set to 1 second

**34. [D4]** A Medium warehouse (4 credits/hour) has QUERY_ACCELERATION_MAX_SCALE_FACTOR set to 5. What is the maximum additional QAS compute rate this configuration allows, and how is it billed?

A. Up to 5 credits/hour of QAS compute total, included in the warehouse's existing rate
B. Up to 20 additional credits/hour of QAS compute (5x the warehouse's 4 credits/hour rate), billed separately from warehouse credits, serverless, per-second, only while actually in use
C. Unlimited QAS compute, since any nonzero scale factor removes the cap entirely
D. Exactly 5 credits/hour flat, regardless of the warehouse's own size/rate

**35. [D5]** A table is cloned via zero-copy clone. Over the following months, both the original table and the clone receive independent, non-overlapping inserts and updates, with no further changes shared between them. What happens to storage cost over time as a result?

A. Storage cost stays flat forever, since clones never incur additional storage regardless of subsequent changes
B. Storage cost on each side diverges — the unchanged micro-partitions shared at clone time remain a single free-riding copy, but each side's new/modified micro-partitions after the clone are billed as separate storage, so total storage cost grows the more the two diverge
C. The clone is billed for 100% of the original's data volume immediately upon creation, regardless of subsequent changes
D. Only the original table accrues storage cost going forward; the clone remains permanently free

**36. [D1]** A prospective customer has three simultaneous requirements: multi-cluster warehouses for concurrency, materialized views for a reporting workload, and a self-service customer-managed encryption key layered on Snowflake's own encryption. What's the minimum edition satisfying all three, and which single requirement forces the jump past the otherwise-sufficient lower tier?

A. Enterprise is sufficient for all three requirements
B. Business Critical — multi-cluster warehouses and materialized views are both Enterprise+, but the customer-managed-key (Tri-Secret Secure) requirement is Business Critical+, which is the deciding factor forcing the higher tier
C. Standard is sufficient, since none of the three requirements are edition-gated
D. VPS is required, since customer-managed keys are a VPS-exclusive feature

**37. [D2]** An architect is deciding among Trust Center, Access History, and Data Lineage to answer three different questions: (1) 'what security-posture risks exist across our account right now,' (2) 'which specific columns did this particular query actually read,' and (3) 'which downstream tables/views depend on this source table.' Match each question to the right tool.

A. All three questions are answered by Trust Center alone, since it's the general security dashboard
B. (1) Trust Center — security-posture scanner findings/recommendations; (2) Access History — tracks actual column-level read/write access per query; (3) Data Lineage — visualizes object-to-object dependency relationships automatically
C. (1) Data Lineage, (2) Trust Center, (3) Access History — the reverse mapping
D. Access History alone answers all three, since it logs every account action

**38. [D3]** A task DAG has Task A as a predecessor to both Task B and Task C (both depend on A, run in parallel after A succeeds), and Task D depends on both B and C completing. If Task B fails during a given run, what happens to Task C and Task D by default?

A. Task C and Task D both still run normally, since Task B's failure is isolated to its own branch
B. Task C still runs (it only depends on A, which succeeded), but Task D does not run, since one of its two predecessor tasks (B) failed — by default, a task only runs after ALL of its predecessors complete successfully
C. The entire DAG is retried automatically from Task A
D. Task C and Task D are both automatically skipped the moment Task B fails, regardless of their own dependency chains

**39. [D4]** An architect is deciding between QUALIFY and a wrapping subquery/CTE with a WHERE clause to filter on a window function's result. Functionally, both can achieve the same filtered output. What's the actual reason QUALIFY is generally preferred beyond just 'it's shorter'?

A. QUALIFY produces different (more correct) results than an equivalent wrapping subquery in some cases
B. QUALIFY lets the filter be expressed directly against the window function's result within the same query, avoiding an extra layer of query nesting purely to apply a post-window filter — a readability/maintainability win with no functional difference in the correct result
C. QUALIFY is required because WHERE clauses cannot reference window functions under any circumstances, even in a wrapping subquery
D. QUALIFY always executes faster than a wrapping subquery due to a different execution plan

**40. [D5]** A team assumes zero-copy cloning means a clone will NEVER incur any storage cost, even years later, as long as no one runs an explicit ALTER on the clone. Is that assumption correct?

A. Yes — clones are permanently metadata-only with zero storage cost for their entire lifetime, regardless of any activity on either copy
B. No — the metadata-only, zero-extra-storage state only holds until either the clone or the original source diverges (via copy-on-write); ANY write activity on either the clone or the still-live original — not just explicit ALTERs on the clone itself — causes storage to start accumulating for whichever copy changed, since the two are no longer identical
C. No, because clones automatically incur full storage cost the instant Time Travel retention begins on either copy
D. Yes, but only for database-level clones; table-level clones always incur immediate storage cost

**41. [D1]** A Medium multi-cluster warehouse (4 credits/hour per cluster) runs with 2 clusters active for 20 minutes, then scales down to 1 cluster for the remaining 40 minutes of that hour. Approximately how many total credits does this hour of activity consume (ignoring per-resume minimums)?

A. 4 credits — Medium warehouses bill at a flat per-hour rate regardless of cluster count
B. 8 credits — 2 clusters x 4 credits/hour for the full hour
C. Approximately 5.3 credits — (2 clusters x 4 credits/hr x 20/60 hr) + (1 cluster x 4 credits/hr x 40/60 hr)
D. 2.7 credits — only the first 20-minute period is billed, since scaling down suspends billing for the reduced-capacity period

**42. [D2]** A platform team is packaging a set of privileges scoped entirely to objects within one database, specifically so that when that database is shared externally or replicated to another account, the associated access-control definitions travel with it. Which role type is designed for this?

A. An account role, since account roles are portable across databases by default
B. A database role — scoped to a single database, grantable to account roles, and designed to travel with the database into shares or replication targets
C. A secondary role, since secondary roles combine privileges from multiple sources
D. The SYSADMIN system role, since it has default visibility into every database

**43. [D3]** A task graph has task C configured with AFTER referencing both task A and task B as predecessors. Task A completes successfully; task B fails. What happens to task C by default?

A. Task C runs anyway, since only one of its two predecessors needs to succeed
B. Task C is skipped — by default, a child task with multiple predecessors runs only if all resumed predecessors complete successfully; since B failed, C does not run
C. Task C runs, but only processes the data associated with the successful predecessor (A)
D. The entire task graph is deleted automatically when any predecessor fails

**44. [D4]** A query returns identical output to one run an hour earlier, with byte-identical SQL text, but Snowflake recomputes it instead of serving the result cache, even though no rows in the underlying table logically changed. Background automatic reclustering ran on the table in the interim. What explains the cache miss?

A. Result cache hits require the warehouse to still be the exact same running warehouse instance
B. Background reclustering/partition consolidation invalidates the result cache even with no logical data change, since the underlying micro-partitions themselves changed
C. Result cache never persists longer than 5 minutes regardless of query repetition
D. This shouldn't happen — reclustering has no effect on result cache validity

**45. [D5]** Two competing retailers want to analyze customer overlap between their loyalty programs for a co-marketing deal, without either party ever seeing the other's raw customer-level records — only the joint aggregate insight should be visible to either side. Separately, an ISV wants to distribute a proprietary fraud-scoring application that runs entirely inside each customer's own Snowflake account against that customer's own data, without any of the ISV's code or data leaving to be inspected. Which pairing correctly matches pattern to mechanism?

A. Both scenarios are solved identically by a plain secure view shared bidirectionally
B. The retailer scenario needs a Data Clean Room (privacy-preserving joint analysis without raw row exposure to either party); the ISV scenario needs a Native App (ships running application logic into the consumer's own account/compute, not just data access)
C. The retailer scenario needs a Native App; the ISV scenario needs a Data Clean Room
D. Both scenarios require Reader Accounts, since neither party has a pre-existing data-sharing relationship

**46. [D1]** A multi-cluster warehouse runs 3 clusters simultaneously (each Large, 8 credits/hr) for exactly 20 minutes during a load spike, then scales back down to 1 cluster. Roughly how many total credits did that 20-minute multi-cluster period consume, and what's the key billing principle that makes this NOT simply '8 credits/hr × 20 minutes'?

A. ~2.67 credits — as if only one cluster ran, since multi-cluster billing is averaged across clusters
B. ~8 credits — 3 clusters × 8 credits/hr × (20/60) hr ≈ 8 credits; multi-cluster billing multiplies the per-cluster rate by however many clusters were ACTUALLY running during that period, not just the warehouse's single-cluster base rate
C. 24 credits, treating the 20 minutes as a full hour for billing purposes because multiple clusters were active
D. 0.089 credits, applying the 60-second minimum three separate times instead of the actual 20-minute duration

**47. [D2] (Select TWO)** (Select TWO) A FinOps architect designs a resource-monitor strategy for a 12-warehouse account. Which two statements about resource monitor mechanics are accurate?

A. A single resource monitor can have multiple threshold actions (e.g. Notify at 70%, Suspend at 90%, Suspend Immediately at 100%) configured on it at once
B. A single resource monitor can be attached to more than one warehouse simultaneously, tracking their combined credit usage against one shared quota
C. Each warehouse can only ever be tracked by exactly one resource monitor account-wide, with no exceptions
D. Resource monitors automatically reset their quota every 24 hours regardless of configuration

**48. [D3]** A team is deciding between Snowpipe, Snowpipe Streaming, and a Dynamic Table for a use case needing near-real-time (low-second) freshness on a single-query transformation over one source table, with the source itself already being loaded continuously via an upstream process. Which best fits the TRANSFORMATION step specifically, as distinct from the ingestion step already handled upstream?

A. Snowpipe, since it's the general-purpose ingestion tool for any latency requirement
B. A Dynamic Table with a short target lag — since the transformation is expressible as a single query and the raw ingestion is already handled upstream, a Dynamic Table declaratively keeps the transformed result fresh to the target lag without hand-written stream/task orchestration
C. Snowpipe Streaming, since it's always the lowest-latency option regardless of whether the task is ingestion or transformation
D. None of the three; only a Stream+Task pair can achieve low-second freshness for a transformation

**49. [D4]** A table has both a clustering key defined AND Search Optimization Service enabled. An architect wants to understand: do these two features compete, complement, or operate entirely independently of each other?

A. They compete — enabling one automatically disables the other
B. They operate independently and can be combined — a clustering key improves pruning for range-scan/large-filter queries by maintaining physical co-location, while Search Optimization Service maintains a separate access path structure that helps point-lookup/equality-style queries; neither depends on or interferes with the other
C. Search Optimization Service is simply a newer, strictly-superior replacement for clustering keys, making combining them redundant
D. Clustering keys are a prerequisite that must be enabled before Search Optimization Service can be added to a table

**50. [D5]** A provider is comparing a Data Clean Room against a Native App for two different scenarios: Scenario 1 needs two companies to jointly analyze overlapping customer data without either seeing the other's raw rows. Scenario 2 needs a provider to distribute a full packaged application (custom UI, business logic) that runs entirely inside each consumer's own account. Which fits which, and why would swapping them be a poor fit?

A. Both scenarios are equally well served by either mechanism, since both ultimately involve secure views
B. Scenario 1 fits a Data Clean Room (privacy-preserving joint analysis via secure views/UDFs and governance, with neither party seeing raw rows); Scenario 2 fits a Native App (ships actual application logic/UI that runs inside the consumer's own account) — a Native App doesn't inherently provide the mutual-privacy joint-analysis guarantees Scenario 1 needs, and a Data Clean Room doesn't ship a packaged UI/application the way Scenario 2 needs
C. Scenario 1 fits a Native App and Scenario 2 fits a Data Clean Room — the reverse mapping
D. Neither mechanism can be used for either scenario; both require a public Marketplace listing instead

**51. [D1]** An architect on a 4X-Large multi-cluster warehouse wants maximum burst concurrency and tries to set MAX_CLUSTER_COUNT = 300, expecting the same ceiling available on an X-Small warehouse. What actually happens, and why?

A. It succeeds identically — MAX_CLUSTER_COUNT ceilings are flat across all warehouse sizes
B. It's rejected or capped well below 300, because larger warehouse sizes have a much lower maximum cluster count ceiling (4XL tops out at 10, versus 300 for XS/S/M) — Snowflake bounds aggregate compute (size x cluster count), not cluster count alone
C. It succeeds, but Snowflake silently ignores clusters beyond 10 regardless of size
D. It's rejected because MAX_CLUSTER_COUNT can only be set on Standard-edition accounts

**52. [D2]** A user's primary role is ANALYST, but a specific ad-hoc task also requires privileges held only by REPORTING_ADMIN. The user doesn't want to switch their primary role mid-session, which would drop their ANALYST-specific context. What lets both privilege sets apply simultaneously in one session?

A. Granting REPORTING_ADMIN's privileges directly to the ANALYST role permanently
B. USE SECONDARY ROLES ALL, activating REPORTING_ADMIN as a secondary role so the session's effective privileges become the union of both roles without switching the primary
C. Creating a new custom role that is a superset of both, and switching to it for the session
D. Granting the user the SECURITYADMIN system role temporarily

**53. [D3]** A team is ingesting a high-throughput Kafka topic and needs individual rows to be queryable in Snowflake within low seconds of being produced, without first landing files in a stage. Which ingestion approach fits?

A. Snowpipe, using the REST API's insertFiles endpoint
B. Snowpipe Streaming, which pushes rows directly without a staging step, achieving sub-second to low-second latency (e.g. via the Kafka connector's streaming mode)
C. A Dynamic Table with TARGET_LAG = 'DOWNSTREAM' over an external stage
D. A standard COPY INTO run on a 1-minute scheduled Task

**54. [D4]** Two analysts run what they believe is 'the same query' against the same table one after another: one writes SELECT customer_id, SUM(amount) FROM orders GROUP BY customer_id, the other writes SELECT o.customer_id, SUM(o.amount) FROM orders o GROUP BY o.customer_id. Does the second query hit the first analyst's result cache?

A. Yes, since Snowflake normalizes queries to detect semantic equivalence before checking the result cache
B. No — the result cache requires an exact syntactic match, and the added table alias changes the query text enough to inhibit the cache hit, even though the queries are semantically identical
C. Yes, but only if both analysts are using the same role
D. It depends on warehouse size — larger warehouses use semantic-equivalence caching, smaller ones require exact match

**55. [D1]** An architect is deciding between a Dynamic Table, a materialized view, and a hand-rolled Stream+Task pair for three separate cases. Case P: a single-query transformation over two tables with an acceptable 10-minute staleness. Case Q: a complex, multi-step procedural transformation with conditional branching logic that can't be expressed as one query. Case R: an Enterprise-edition account needs an expensive aggregation kept fresh with Snowflake handling all maintenance automatically, and the source barely ever changes. Match each, and explain why a Dynamic Table doesn't fit Case Q.

A. All three cases should use a materialized view, since it's the most broadly capable of the three
B. P: Dynamic Table (single-query, declarative, target-lag-driven); Q: Stream+Task (Dynamic Tables only support a query-expressible transformation, not arbitrary procedural/conditional logic); R: materialized view (Enterprise+, precomputed, auto-maintained, ideal for infrequently-changing source data)
C. P: Stream+Task; Q: Dynamic Table; R: Stream+Task — Dynamic Tables handle any procedural logic a Task can
D. None of the three fit any of these cases; all three require Snowpipe Streaming instead

**56. [D2]** An architect is deciding whether a network policy or a masking policy is the right control for two separate requirements: (a) block all connection attempts from outside the corporate VPN's IP range, and (b) show full credit card numbers only to the FRAUD_ANALYST role. Which fits which, and why would swapping them fail?

A. Both requirements should use a masking policy, since it's the more general-purpose governance control
B. (a) needs a network policy — it operates at the connection/IP layer, before any query or role evaluation happens; (b) needs a masking policy — it operates at query time based on the querying role, evaluating column values, not connection origin. A masking policy cannot block a connection attempt, and a network policy cannot conditionally alter a column's displayed value by role
C. Both requirements should use a network policy, since IP-based and role-based access are functionally identical mechanisms
D. Neither control is appropriate; both requirements need a row access policy instead

**57. [D3]** An architect is deciding between a named internal stage and an external stage for a team that needs a custom file format, a directory table, and shared role-based access — but the team is debating whether an external stage could ALSO satisfy all three needs equally well, since it points at cloud storage. What's the accurate comparison?

A. External stages cannot support custom file formats, directory tables, or role-based sharing at all — only named internal stages support any of these three
B. A named internal stage and an external stage can BOTH support a custom file format, a directory table, and role-based sharing — the real distinguishing factor is where the underlying files live (Snowflake-managed storage vs. the team's own cloud storage bucket), not which of the three named features is available
C. Only external stages support directory tables; named internal stages never support them
D. Only named internal stages support role-based sharing; external stages are always account-wide

**58. [D4]** An architect is deciding between `APPROX_COUNT_DISTINCT` and exact `COUNT(DISTINCT)` for two different reporting needs: (1) a real-time executive dashboard tile showing roughly how many unique visitors hit the site today, and (2) a monthly regulatory compliance report requiring an exact count of unique affected customers for a legal filing. Which fits which, and why would swapping them be risky?

A. Both should use APPROX_COUNT_DISTINCT, since HyperLogLog's error rate is negligible enough for any use case including legal filings
B. (1) fits APPROX_COUNT_DISTINCT — a dashboard tile tolerates small estimation error in exchange for lower cost/latency at scale; (2) requires exact COUNT(DISTINCT) — a regulatory filing needs a precise, defensible number, where HyperLogLog's inherent estimation error is an unacceptable risk regardless of how small it usually is
C. Both should use exact COUNT(DISTINCT), since approximate functions are never appropriate in production reporting
D. The choice between the two functions has no relationship to accuracy requirements, only to query syntax preference

**59. [D1]** A data science team's Snowpark Python UDF performs a large in-memory join and repeatedly fails with out-of-memory / spilling errors on a Large Standard Gen2 warehouse, even though CPU utilization stays low throughout the job. What is the most targeted fix?

A. Switch to a Snowpark-Optimized warehouse, which provides substantially more memory per node (roughly 16x a standard warehouse) for memory-intensive workloads
B. Resize to a 2X-Large Standard Gen2 warehouse, since Gen2 always includes proportionally more memory at every size step
C. Enable multi-cluster scaling, since the issue is concurrency-driven memory pressure across clusters
D. Switch to a Snowpark-Optimized warehouse only if also enabling Query Acceleration Service

**60. [D2]** A support team's role has no direct SELECT privilege on a sensitive billing table. A stored procedure is being designed so support staff can run a controlled lookup (e.g. 'find invoice status by ID') against that table without being granted broad SELECT access. Which execution context should the procedure use, and why?

A. EXECUTE AS CALLER, so the procedure runs with the support role's own limited privileges
B. EXECUTE AS OWNER (the default), so the procedure runs with the procedure owner's privileges — letting the low-privilege caller perform this one controlled action without being granted direct table access
C. Neither — the support role must be granted SELECT on the table directly regardless of execution context
D. EXECUTE AS CALLER, combined with a secondary role granting SELECT

**61. [D3]** Files land in an S3 bucket every few minutes from an upstream batch export process. The team wants ingestion triggered automatically by each file's arrival, without managing a warehouse, and minutes-level latency is acceptable. Which ingestion approach fits best?

A. Snowpipe Streaming, since it's always the lower-latency and therefore strictly better choice
B. Snowpipe, triggered by cloud storage event notifications — serverless, billed per actual compute-second, well-suited to file-based, minutes-level-latency, event-driven ingestion
C. A user-managed Task on a Small warehouse polling the stage every minute
D. A Dynamic Table querying the external stage directly with TARGET_LAG = '1 minute'

**62. [D4]** A multi-terabyte events table is frequently filtered and joined on event_date using range predicates (BETWEEN, >, <), and query performance has degraded as the table has grown, with Query Profile showing a high ratio of partitions scanned vs. total partitions for these range-filtered queries. Which lever is the better fit?

A. Search Optimization Service, since it accelerates any filtered query on a large table
B. A clustering key on event_date, keeping matching rows co-located across micro-partitions so range-predicate pruning stays effective as the table grows
C. Query Acceleration Service, since QAS is the default fix for any pruning-related slowdown
D. An aggregation policy on event_date

**63. [D1]** A workload is memory-bound on a correctly-sized Standard Gen2 warehouse (frequent spilling despite an appropriately-sized warehouse for the query's row/partition count). An architect proposes simply doubling the warehouse size instead of switching to Snowpark-Optimized. Is that the more cost-effective fix, and why or why not?

A. Yes — doubling size always fixes spilling identically to switching warehouse types, and is simpler operationally
B. Not necessarily — doubling a Standard warehouse's size increases both CPU and memory proportionally (paying for compute capacity that may not be the bottleneck), whereas Snowpark-Optimized specifically increases memory per node for the same general size class, targeting the actual memory bottleneck more directly for memory-intensive Snowpark/ML workloads
C. No — Snowpark-Optimized warehouses cannot be resized at all once created
D. Yes, since Snowpark-Optimized warehouses are strictly more expensive than any Standard warehouse of an equivalent size

**64. [D2]** A team needs to decide between granting privileges to a custom account role directly, versus building a database role first and granting THAT to the account role, for a dataset that lives in one database and will eventually be shared to a partner account. What's the architecturally correct layering, and what breaks if the team skips the database role?

A. Grant privileges directly to the account role; database roles are purely cosmetic and provide no functional benefit
B. Build a database role scoped to the dataset's database, granting object-level privileges to it, then grant that database role to the account role — this lets the database role's privileges travel with the database into a future share or replication target; granting privileges directly to the account role instead ties them to the account-wide role object, which doesn't travel with the database the same way
C. Grant privileges to PUBLIC instead, since it automatically applies to every role including future ones
D. Database roles can only be used for warehouses, never for datasets intended for sharing

**65. [D3]** A team's COPY INTO job uses `ON_ERROR = SKIP_FILE_10` against a batch of 100 files, and one file contains 15 malformed rows. What happens to that specific file and the batch overall, and how does this differ from plain `SKIP_FILE`?

A. `SKIP_FILE_10` behaves identically to plain `SKIP_FILE` in every respect — the numeric suffix is purely cosmetic
B. `SKIP_FILE_10` skips a file only once it accumulates MORE than 10 errors (this file has 15, so it gets skipped, same end result as plain SKIP_FILE here) — but a file with, say, only 5 malformed rows would NOT be skipped under SKIP_FILE_10 (those 5 rows' valid siblings would still load, with just the bad rows excluded), whereas plain SKIP_FILE skips a file on its very first error regardless of count
C. SKIP_FILE_10 aborts the entire 100-file batch once any single file exceeds 10 errors
D. SKIP_FILE_10 only applies to the first 10 files in the batch, ignoring error counts entirely

**66. [D4]** Two architects disagree about whether enabling Search Optimization Service on a table also improves that table's clustering-based pruning for large range-scan queries. Who's right, and what's the precise relationship between the two features?

A. They're the same feature under different names, so enabling one always improves the other's target query pattern too
B. Search Optimization Service and clustering are independent — enabling Search Optimization Service does NOT improve range-scan pruning; it maintains its own separate access-path structure specifically for point-lookup/equality-style queries, an entirely different mechanism from micro-partition co-location that clustering keys maintain
C. Search Optimization Service actively disables automatic reclustering while it's enabled on a table
D. Clustering keys are a prerequisite that must exist before Search Optimization Service can be enabled at all

**67. [D1]** A different Snowpark job is CPU-bound (high utilization, no spilling, no memory pressure) and just needs to finish faster for the same cost. Which warehouse choice is most appropriate?

A. Snowpark-Optimized, since it should always be the default for any Snowpark workload
B. Standard Gen2, since its price/performance improvement targets general compute throughput, and the workload shows no memory pressure that would justify Snowpark-Optimized's premium
C. Snowpark-Optimized, resized down to X-Small to offset the extra memory cost
D. Neither — CPU-bound Snowpark workloads must run outside a virtual warehouse via external functions

**68. [D2]** A different stored procedure wraps a query against a table that has a row access policy filtering rows by the querying user's own department. The procedure must ensure each caller only ever sees their own department's rows when they run it — the row access policy needs to evaluate against the actual calling user's session context, not the procedure owner's. Which execution context is required?

A. EXECUTE AS OWNER, since row access policies always evaluate against the object owner regardless of caller
B. EXECUTE AS CALLER, so the procedure runs with the invoking user's own privileges and session context, letting the row access policy correctly filter by the actual caller's department
C. Neither matters, since row access policies are evaluated independently of stored procedure execution context
D. EXECUTE AS OWNER, combined with a masking policy instead of a row access policy

**69. [D3]** A file sales_2026_08.csv was successfully loaded via COPY INTO. Later, the source system corrects a data error and re-uploads a fixed version of the file to the same stage path under the identical file name, without setting FORCE = TRUE on the next COPY INTO run. What happens?

A. The file is skipped — Snowflake's load history tracking is keyed purely on file name, and an identical name is always treated as already-loaded
B. The file is loaded again automatically — Snowflake's load history tracks files by name and checksum together, and the corrected file has a different checksum despite the identical name, so it's treated as a new file
C. The load fails with an error, since COPY INTO rejects any file name that already exists in load history
D. The file is loaded again, but only if VALIDATION_MODE is also set

**70. [D4]** A reporting dashboard runs the same expensive multi-join aggregation query dozens of times a day against source tables that change only once nightly via a batch load. The team is on Enterprise edition and wants to cut both latency and repeated compute cost for this specific query. What's the most fitting lever?

A. A Materialized View — Snowflake precomputes and automatically maintains the result, and the once-nightly source change frequency keeps background maintenance cost low relative to the dozens of daily recomputations it avoids
B. A Standard view, since views never incur additional storage or maintenance cost
C. Query Acceleration Service, applied to each of the dozens of daily report executions individually
D. A clustering key on every join column across all source tables

**71. [D1]** An architect is choosing between an External table and an Iceberg table for a dataset that (a) needs to be queried by Snowflake, (b) needs its files periodically deleted/reorganized by an external process outside Snowflake's control, and (c) does NOT need Snowflake itself to ever write to it. Which fits better, and why would an Iceberg table be unnecessary machinery here?

A. An Iceberg table, since it's always the more modern, preferred choice regardless of write requirements
B. An External table — a metadata-only pointer to externally-managed files is sufficient when Snowflake only ever needs to read, and the external process retains full control over file layout/deletion without needing to coordinate through Iceberg's table-format metadata; an Iceberg table's transactional, multi-engine-write-coordination machinery is unneeded overhead for a read-only, externally-managed use case
C. Neither fits; this requires a Dynamic Table specifically
D. An External table cannot be queried directly by Snowflake at all, only Iceberg tables can

**72. [D2]** An architect reviewing tag-based governance finds a tag `pii_class` with `ALLOWED_VALUES 'LOW','MEDIUM','HIGH'` and a masking policy attached to the tag itself via `ALTER TAG pii_class SET MASKING POLICY mask_pii`. Six new columns get tagged `pii_class = 'HIGH'` over the following month. What masking behavior applies to those six new columns, and why is this a meaningful governance-scaling benefit over per-column policy attachment?

A. None of the six columns get masked, since the policy was only attached to columns that existed at the time of `ALTER TAG`
B. All six inherit the masking behavior automatically, since the policy is attached to the tag itself rather than to any specific column — new columns tagged afterward pick up the governance rule without anyone having to remember to attach the masking policy to each one individually
C. Only the first of the six gets masked; subsequent taggings require re-running ALTER TAG each time
D. The masking policy silently detaches from the tag once a sixth column is tagged, due to a scaling limit

**73. [D3]** A team needs their Snowflake account to authenticate to an external HTTP API for two different purposes: (1) an external function that calls out mid-query, and (2) a notification integration that posts to a webhook when an Alert fires. Do both of these require a separate API integration object each, or can one be shared, and why?

A. Each use case fundamentally requires its own dedicated integration TYPE (a storage integration for one, an API integration for the other) — they can never share the same kind of object
B. Both use cases are authorized via the same underlying object type — an API integration — and a single API integration CAN be reused across multiple external functions/notification configurations pointed at the same authorized endpoint pattern, rather than requiring a structurally different integration per use case
C. Neither use case requires an integration object at all; credentials must be embedded directly in the external function and the Alert definition
D. Only external functions require an API integration; notification integrations never need one

**74. [D4]** A query benefits from the warehouse's local SSD cache on one run, then the SAME warehouse (unchanged size, not suspended) runs the identical query again five minutes later. Is a compute credit still consumed on this second run, and why does the local cache not eliminate that cost the way a result-cache hit would?

A. No compute credit is consumed — the local cache hit makes the query entirely free, identical to a result-cache hit
B. Yes — a compute credit is still consumed, because the local (SSD) cache only speeds up DATA ACCESS by skipping a slow remote-storage fetch; the warehouse still has to actually execute the query (scan, filter, aggregate, etc.) using its compute, which is what's actually being billed, unlike a result-cache hit which returns pre-computed final rows with no execution needed at all
C. No credit is consumed only if the warehouse is a Snowpark-Optimized type
D. Yes, but only because the query changed slightly between the two runs

**75. [D1]** A finance team wants business analysts with no SQL skills to ask questions like 'what was Q2 revenue by region' directly against a governed, structured sales data model, and get back a reliable SQL query plus the answer. Which Cortex capability directly fits?

A. Cortex Search, since it retrieves the most relevant matching records for any query
B. AI SQL functions like AI_COMPLETE, prompted with the sales schema in context
C. Cortex Analyst, which translates natural language into SQL against a defined semantic model over structured data
D. Snowflake ML, since natural-language question answering is a model-serving problem

**76. [D2]** A security team wants a single Snowsight dashboard showing scanner-driven findings like CIS Benchmark violations, risky configuration settings, and suspicious login/privilege-escalation detections across the account, without building custom queries against audit views. Which feature fits?

A. Access History, since it logs which queries touched which objects
B. Data lineage, since it visualizes object dependencies
C. Trust Center — a Snowsight security-posture dashboard surfacing scanner findings and configuration/threat risks in one place
D. The ACCOUNT_USAGE.LOGIN_HISTORY view, queried manually

**77. [D3]** A team needs a stage that any user granted the appropriate role can load into, supports a custom file format definition, and can have a directory table enabled for file-listing queries. Which stage type fits all three requirements?

A. The user stage (@~), since every user already has one available
B. The table stage (@%table_name), since it's tied directly to the target table
C. A named internal stage, created explicitly and shareable via role grants, supporting custom file formats and directory tables
D. An external stage only, since internal stages never support directory tables

**78. [D4]** A dashboard needs a fast approximate count of distinct visitors from a multi-billion-row clickstream table, refreshed frequently, where being off by a fraction of a percent is acceptable but query latency and cost are not. Which approach fits better than exact COUNT(DISTINCT)?

A. APPROX_COUNT_DISTINCT, a HyperLogLog-based approximation that's far cheaper at this scale, trading small statistical error for significantly lower cost/latency
B. COUNT(DISTINCT), since exact counts should always be preferred whenever available
C. A clustering key on the visitor ID column, which makes COUNT(DISTINCT) itself run in constant time
D. Search Optimization Service on the visitor ID column

**79. [D1]** A team needs to enumerate 'every object type explicitly recognized in Snowflake's Domain 1.3 object hierarchy list' for a governance audit script, and is unsure whether Warehouses and Resource Monitors belong on that list alongside Tables, Views, and Stages. What's the accurate answer?

A. Yes, both Warehouses and Resource Monitors are database objects listed under 1.3
B. No — the 1.3 object hierarchy list (Stages, Schemas, Tables, Views, UDFs, File formats, Stored procedures, Pipes, Shares, Sequences, ML models, Applications) is specifically about database-level objects; Warehouses and Resource Monitors are account-level objects, not part of that database-object list
C. Only Warehouses belong on the list; Resource Monitors are database objects
D. Only Resource Monitors belong on the list; Warehouses are database objects

**80. [D2]** A team needs both a full audit trail of who queried which specific columns of a sensitive table, AND a real-time cost/credit-consumption view for that same table's warehouse. Which single source can answer the first, and why can't a resource monitor answer it too?

A. A resource monitor answers both; it tracks both credit usage and column-level access equally
B. Access History (an ACCOUNT_USAGE view) answers the column-level audit-trail question — it tracks actual object/column-level read/write access per query; a resource monitor only tracks and acts on aggregate credit usage against a quota, with no visibility into which specific columns or objects a query actually touched
C. QUERY_HISTORY alone, with no other view needed, since it stores raw SQL text including implied column access
D. Trust Center answers the column-level audit question, since it's the general security dashboard

**81. [D3]** A pipeline needs Task C to run only after BOTH Task A and Task B have completed successfully (not just one of them), but the team accidentally configures Task C with only `AFTER task_a` and forgets `task_b` entirely. What's the practical consequence of this misconfiguration?

A. Task C will still correctly wait for both A and B, since Snowflake automatically infers the full dependency graph from any downstream references
B. Task C will run as soon as Task A succeeds, regardless of whether Task B has finished or even succeeded — the missing predecessor means Snowflake has no way to know Task C should also wait on Task B, so it runs prematurely against Task B's actual completion state
C. The DAG will fail to deploy entirely, since Snowflake validates that all logical dependencies are declared
D. Task C will run only after BOTH A and B by default, regardless of which are explicitly declared as predecessors

**82. [D4]** An architect is comparing `FLATTEN()` and a lateral join against a normalized child table for exploding a repeating group in the data. When would a genuinely NORMALIZED relational child table be the better design choice over storing the repeating group as a VARIANT array and using FLATTEN at query time?

A. Never — VARIANT + FLATTEN is always strictly superior to a normalized child table in every scenario
B. When the repeating-group data needs its own independent constraints, indexes/clustering, frequent independent updates, or is queried far more often on its own than joined back to the parent — a genuinely normalized child table gives those relational capabilities directly, whereas VARIANT + FLATTEN is better suited to naturally nested, less independently-queried, schema-flexible data
C. FLATTEN() cannot be used in a WHERE clause under any circumstances, making normalization mandatory for any filtered query
D. VARIANT columns have a hard row-count limit that forces normalization once exceeded

**83. [D1]** A support organization has years of PDF manuals, call transcripts, and knowledge-base articles and wants an LLM-backed assistant to answer agent questions by retrieving and grounding on the most relevant passages from that unstructured corpus. Which Cortex capability is purpose-built for this?

A. Cortex Analyst, since it already handles natural-language questions
B. Cortex Search, which indexes unstructured/document sources and performs retrieval to ground LLM responses, without the team building custom RAG infrastructure
C. AI_CLASSIFY, since documents just need to be categorized first
D. A Dynamic Table over the documents with a target lag of 1 minute

**84. [D2] (Select TWO)** Select TWO accurate statements about Snowflake resource monitors.

A. A single resource monitor can be assigned to multiple warehouses simultaneously
B. A single warehouse can have multiple resource monitors assigned to it simultaneously
C. A single resource monitor can define multiple threshold actions (e.g. several Notify thresholds plus a Suspend and a Suspend Immediately) within one monitor
D. Resource monitors can only use a MONTHLY reset frequency, never DAILY or WEEKLY

**85. [D4]** A query needs to rank orders per customer with ROW_NUMBER() and then keep only rank = 1 per customer. Without QUALIFY, this requires wrapping the windowed query in a subquery or CTE just to filter on the window function's result. What does QUALIFY let the query do instead?

A. QUALIFY replaces GROUP BY entirely for all aggregate queries
B. QUALIFY lets the query filter directly on a window function's result in the same query, without needing to wrap it in a subquery or CTE
C. QUALIFY is a Snowflake-specific alternative to WHERE that only works on non-windowed queries
D. QUALIFY forces the query to use APPROX_COUNT_DISTINCT semantics for any aggregate present

**86. [D1]** An architect needs to explain the difference between Snowflake's hybrid storage/compute model and a pure shared-nothing architecture to a team evaluating the platform. What's the precise distinction, and why does it matter for concurrent multi-team workloads?

A. Snowflake is pure shared-nothing — each warehouse has its own private copy of the data, fully duplicated per warehouse
B. Snowflake is hybrid: one shared copy of data in cloud object storage (not duplicated per warehouse, unlike pure shared-nothing) combined with independent, isolated per-warehouse compute (unlike pure shared-disk, where compute nodes would contend for the same storage access) — this lets multiple teams run large concurrent workloads against the same data with zero compute contention and no data duplication
C. Snowflake is pure shared-disk, with all warehouses directly contending for the same compute resources
D. There is no meaningful architectural distinction; 'hybrid' is just marketing terminology with no technical difference from shared-nothing

**87. [D2]** An architect designs three separate resource monitors for a 12-warehouse account: one covering warehouses A-D with a shared 500-credit monthly quota, one covering warehouse E alone with its own 1000-credit monthly quota, and no monitor at all on the remaining seven warehouses. Is this a valid configuration, and what happens to those seven unmonitored warehouses?

A. This is invalid; every warehouse in an account must be covered by exactly one resource monitor
B. This is valid — resource monitors are opt-in per warehouse (or group of warehouses), and warehouses with no monitor attached simply have no credit-usage guardrail at all, running without a monitored quota until one is explicitly attached
C. This is valid, but the seven unmonitored warehouses automatically inherit the account's default resource monitor, which always exists implicitly
D. This is invalid because a single resource monitor can never cover more than one warehouse at once

**88. [D4]** A workload-management review finds that a single large warehouse serves both a nightly batch ELT job (long-running, resource-heavy, tolerant of queueing) and a customer-facing real-time API-backed lookup service (latency-critical, must never queue). An architect recommends splitting these onto separate warehouses even though it seems to 'use more resources.' What's the actual justification, beyond just 'best practice says so'?

A. Splitting warehouses always reduces total credit consumption, which is the primary justification
B. Splitting isolates the latency-critical lookup service's warehouse from ever queueing behind the batch ELT job's heavy queries — on a shared warehouse, a long-running batch query can force the latency-critical service to wait, directly violating its real-time requirement; separate warehouses guarantee that isolation at the cost of some potential idle capacity on each, a worthwhile tradeoff for a hard latency requirement
C. Splitting is purely a cost-optimization move with no effect on latency or queueing behavior
D. A single warehouse can only serve one workload type at a time by a hard Snowflake-enforced limit, making splitting mandatory rather than a choice

**89. [D1]** A team just needs to run sentiment scoring on a single review_text column across a batch of rows as part of an existing SQL transformation pipeline, with no need for retrieval, semantic modeling, or conversational context. What's the most cost-appropriate approach?

A. Stand up Cortex Analyst with a semantic model over the reviews table
B. Use a task-specific AI SQL function such as AI_SENTIMENT directly in the transformation query — cheaper and more optimized for this narrow task than a general-purpose completion call
C. Build a Cortex Search service indexed on the review_text column
D. Use AI_COMPLETE with a custom prompt, since it is functionally interchangeable with task-specific functions

**90. [D4]** An architect is deciding whether adding a clustering key to a table will also automatically improve that table's eligibility for Query Acceleration Service on large scans. What's the accurate relationship?

A. Yes — better clustering directly increases QAS eligibility, since QAS eligibility is computed purely from clustering quality
B. Not directly — QAS eligibility depends primarily on absolute scan size and selectivity characteristics of a given query (plus the absence of nondeterministic functions), not on how well-clustered the table is; better clustering instead reduces how MUCH data needs scanning in the first place (via pruning), which can change whether a query even needs QAS's help, but clustering quality isn't itself a QAS eligibility input
C. Yes, and a table must have a clustering key defined before QAS can be enabled at all
D. No relationship of any kind exists between clustering and QAS in any scenario

**91. [D1]** A team needs a query/write engine that can operate over a table format also readable by non-Snowflake engines like Spark or Trino, but they specifically want SNOWFLAKE to manage the table's metadata/catalog (not an external catalog), for simpler operational ownership. Which Iceberg table configuration fits, as distinct from an externally-managed Iceberg table?

A. A Snowflake-managed Iceberg table — Snowflake itself owns the catalog/metadata management while still writing data in the open Iceberg format other engines can read; an externally-managed Iceberg table instead relies on an external catalog (e.g. AWS Glue, a Iceberg REST catalog) that Snowflake reads from/writes to as one of potentially several engines
B. There is no such distinction; all Iceberg tables in Snowflake are externally managed by definition
C. A Dynamic Table, since it always manages its own metadata regardless of Iceberg involvement
D. An External table, since External tables are what Snowflake calls Iceberg tables it manages itself

**92. [D1]** A pipeline needs a target table that's a straightforward join-and-aggregate over two source tables, refreshed automatically to stay within roughly 5 minutes of the source, without the team hand-writing change-capture or MERGE logic. Which approach best fits, and why?

A. A Stream + Task pair, since only procedural pipelines can guarantee a specific freshness target
B. A Dynamic Table with TARGET_LAG = '5 minutes', since the transformation is expressible as a single declarative query and Snowflake handles the incremental refresh logic automatically
C. A Materialized View, since any precomputed result should default to a materialized view
D. A plain Standard View, recomputed on each query, since 5-minute freshness doesn't require precomputation

**93. [D1]** An architect is comparing Snowflake Notebooks and Streamlit in Snowflake for a data science team's workflow: exploring a dataset interactively during model development versus publishing a finished interactive tool for business stakeholders to self-serve against. Which fits each phase, and what's the actual functional distinction (not just 'one is newer')?

A. Both are functionally identical; the choice is purely aesthetic
B. Notebooks fit the exploratory phase (cell-by-cell interactive Python/SQL development against Snowflake compute); Streamlit in Snowflake fits the publishing phase (hosting a finished, polished interactive app for other users to open and use, not to edit cell-by-cell)
C. Streamlit in Snowflake fits exploration and Notebooks fit publishing — the reverse mapping
D. Neither is appropriate for either phase; both phases require Snowpark instead

**94. [D1]** A pipeline needs to process incoming change records with row-by-row conditional branching — different downstream actions depending on which columns changed and business-rule lookups against a separate reference table — that can't be expressed as a single declarative SELECT. Which mechanism actually fits?

A. A Dynamic Table, since TARGET_LAG can be tuned arbitrarily low to simulate procedural behavior
B. A Materialized View, since it can reference multiple source tables in its defining query
C. A Stream + Task pair, where the stream captures the changes and the task runs a stored procedure with the needed conditional/procedural logic against them
D. Cortex Analyst, since business-rule branching is best expressed in natural language

**95. [D1]** A team wants to know whether their nightly ETL job's heavy `SHOW TABLES`/`DESCRIBE`-style metadata scanning, run against a warehouse that's otherwise nearly idle that day, could realistically trigger a billable Cloud Services charge. What determines whether it does?

A. Metadata-only commands like SHOW/DESCRIBE are always entirely free regardless of warehouse activity
B. It depends on whether that day's Cloud Services usage exceeds 10% of that day's total warehouse (compute) credit consumption — with warehouse compute nearly idle that day, there's very little to offset against, making it more plausible (not guaranteed, but realistic) for heavy metadata activity to cross that threshold and get billed
C. Cloud Services charges only ever apply on Business Critical edition and above, regardless of usage pattern
D. Metadata commands are billed at a flat fixed rate per call, unrelated to the 10% threshold

**96. [D1]** A team wants to materialize an expensive daily-aggregation query, but the underlying source table is updated by a continuous stream of inserts roughly every second. What's the concern with using a Materialized View here, specifically?

A. Materialized Views cannot be created over tables that receive streaming inserts at all
B. Materialized Views are best suited to data that changes infrequently — background maintenance recomputation on a constantly-changing source can itself consume significant, ongoing credits, eroding the benefit
C. Materialized Views require the source table to be a Dynamic Table
D. There's no concern; Materialized Views are always cheaper than recomputing the query directly, regardless of source change frequency

**97. [D1]** An architect is deciding between granting `MAX_CLUSTER_COUNT = 300` on an XSmall multi-cluster warehouse versus using one larger Large warehouse with `MAX_CLUSTER_COUNT = 160` for a highly concurrent, individually-lightweight query workload (many small, fast queries, not a few large ones). Which configuration better matches the workload shape, and what's the underlying principle?

A. The Large warehouse configuration is always better, since a bigger warehouse size is universally preferable
B. The XSmall/high-cluster-count configuration better matches many small, lightweight, highly concurrent queries — Snowflake bounds total aggregate compute as size × cluster count, so for a workload of many small queries, more smaller clusters (higher parallel concurrency capacity at low per-cluster cost) fits better than fewer, larger clusters sized for individually-heavy queries
C. Both configurations provide mathematically identical aggregate compute and concurrency capacity, so the choice is irrelevant
D. MAX_CLUSTER_COUNT has no relationship to the size vs. cluster-count tradeoff; it only affects billing granularity

**98. [D1]** A defense-sector prospective client requires that their Snowflake account run on physically and logically isolated infrastructure not shared with any other Snowflake customer at all — beyond encryption key management or compliance certifications. Which is the minimum edition that satisfies this specific requirement?

A. Business Critical, since it already includes Tri-Secret Secure and HIPAA/PCI support
B. Enterprise, if combined with a private connectivity option like a cloud provider's private link
C. Virtual Private Snowflake (VPS) — the only edition offering fully isolated, dedicated infrastructure not shared with other accounts
D. Standard, since all editions run on logically isolated per-account infrastructure by default

**99. [D1]** A team needs to distinguish `CURRENT_ROLE()` from `CURRENT_AVAILABLE_ROLES()` when writing a stored procedure that must check not just which role is active right now, but which roles the calling user COULD switch to. Which function(s) answer each question?

A. Both functions return the same information; they're interchangeable
B. `CURRENT_ROLE()` returns only the single role active in the current session right now; `CURRENT_AVAILABLE_ROLES()` returns the full list of roles the calling user is entitled to switch into via USE ROLE, a broader set than just the one currently active
C. `CURRENT_ROLE()` returns all available roles, while `CURRENT_AVAILABLE_ROLES()` returns only the active one — the reverse of what the names suggest
D. Neither function exists; role introspection requires querying ACCOUNT_USAGE instead

**100. [D1]** A warehouse runs many short, bursty jobs (each a minute or two) with an Economy scaling policy configured for a multi-cluster warehouse. Users start noticing queries queuing during bursts even though MAX_CLUSTER_COUNT hasn't been reached. What's the most likely explanation tied to how Economy scaling actually works?

A. Economy scaling never starts additional clusters under any circumstances
B. Economy only starts a new cluster when Snowflake estimates there's at least 6 minutes of queued work to justify it — short bursts of 1-2 minute jobs may never cross that threshold, so queuing persists rather than triggering a scale-out
C. Economy scaling requires MAX_CLUSTER_COUNT to be set above 10 before any additional cluster can start
D. Economy scaling only evaluates scale-out decisions once per hour, on a fixed schedule

---

## Answer Key & Explanations

1. **B.** Cloud Services handles auth, metadata, query parsing/optimization, and access control — functions the whole account depends on to submit and authorize queries — while compute (warehouses) and storage are architecturally independent layers; a Cloud Services degradation is account-wide for query submission, not tied to one warehouse, and doesn't touch storage durability.
2. **C.** This is column-level dynamic data masking — a masking policy attached to a specific column that returns different output for the same underlying data depending on the querying role, evaluated at query time with no data duplication.
3. **B and C.** A standard stream tracks the full set of DML changes — inserts, updates, and deletes, including before/after row versions for updates. An append-only stream is optimized for insert-heavy workloads and tracks only inserts, skipping the update/delete bookkeeping a standard stream does.
4. **B.** QAS exists specifically for this scenario — a disproportionately large/long query relative to the rest of a warehouse's workload — offloading eligible scan work to serverless compute so only that outlier query pays for the extra horsepower, instead of resizing the whole warehouse for every query.
5. **B.** Reader accounts exist specifically for consumers who don't have their own Snowflake account — the provider creates and bears the compute cost on the recipient's behalf, unlike a direct share or listing, both of which require the consumer to already have (and pay compute for) their own Snowflake account.
6. **B.** Cortex Analyst is specifically built for natural-language-to-SQL grounded in a defined semantic model, producing a real, governed query and result — Cortex Search is retrieval/search over unstructured content (not SQL generation), and a bare AI_COMPLETE call has no semantic-model grounding or guaranteed correctness for structured analytical queries.
7. **B.** Only an aggregation (privacy) policy enforces a minimum group size on results at the query-execution level, regardless of how a caller structures their query — masking changes displayed values (not row-level exposure), row access policies restrict which rows are visible (not the aggregation shape of the final output), and secure views only hide the view's own definition, none of which guarantees a minimum-group-size result.
8. **B.** An append-only stream tracks only row inserts and is documented as more performant than a standard stream for insert-driven ELT scenarios specifically because it skips the delta-join work standard streams do to reconcile inserts against deletes — the right, more efficient choice when updates/deletes genuinely don't matter to the downstream pipeline.
9. **B.** Each of the four features targets a genuinely distinct symptom: clustering keys help range-scan pruning on large, frequently-filtered tables (W); Search Optimization Service accelerates point-lookup/equality-style access on columns that don't naturally cluster well (X); QAS offloads one outlier query without resizing the shared warehouse (Y); materialized views precompute and auto-maintain expensive aggregations over slowly-changing data (Z) — mixing these up (or reaching for warehouse upsizing as a universal fix) misses the targeted, cost-appropriate lever for each case.
10. **B.** Time Travel COULD satisfy a 60-day self-service requirement if the account is on Enterprise+ with retention configured up to 90 days — but on Standard (1-day default, no 90-day option), it can't, making a manual backup-table pattern the fallback that works regardless of edition. Fail-safe is explicitly support-only (never self-service) and only begins after Time Travel ends, so it can't independently satisfy a self-service requirement no matter its own duration.
11. **B.** Database Storage sits on the cloud provider's own object storage (S3/Blob/GCS), which the provider already replicates across AZs as part of its own durability guarantee — transparent infrastructure, not something Snowflake customers configure or that varies by edition.
12. **B.** Row access policies restrict which whole rows a role can see, via a boolean SQL expression evaluated against session/role context — exactly the 'same table, different visible row subset by role' requirement, without duplicating the table per region.
13. **C.** When the source is an externally-managed Iceberg table (external catalog, writes happening outside Snowflake's engine), Snowflake requires INSERT_ONLY = TRUE — insert-only is the consistently supported stream type for this externally-managed case, unlike standard/append-only which face version- and catalog-dependent restrictions.
14. **B.** Search Optimization Service specifically targets highly selective point-lookup patterns on columns that resist natural clustering benefit — a different tool from QAS (one outlier query's overall scan/DML cost) and from clustering keys (range scans/large filters, not point lookups on effectively-random values like UUIDs).
15. **B.** Failover groups specifically support promotion — turning a secondary into the new primary during a DR event — while replication groups only provide read-only replicated copies with no failover capability; an object can belong to a failover group or replication group(s), but not both, and failover groups require Business Critical edition or higher on both ends.
16. **B.** Standard Gen2 targets general CPU-bound SQL price/performance; Snowpark-Optimized carries a cost premium for extra per-node memory that specifically helps memory-intensive Snowpark/ML workloads — paying for that premium on a CPU-bound, minimal-Python workload wastes the differentiator without benefiting from it.
17. **B.** A database role is specifically scoped to one database and designed to travel with it into a share or replication target — an account role is account-wide (not database-scoped, doesn't travel the same way), and secondary roles are purely a same-session privilege-activation mechanism with no relationship to database portability.
18. **A.** Insert-only streams are specifically required for external tables and externally-managed Iceberg tables — standard and append-only stream support extends to standard tables, Dynamic Tables, and Snowflake-MANAGED Iceberg tables, but not externally-managed ones, which is exactly the restriction this scenario is hitting.
19. **B.** Per Snowflake's own documentation, the result cache requires an exact syntactic match, not semantic equivalence — 'any difference in syntax, including... the use of table aliases, will inhibit 100% cache reuse.' Two logically identical queries differing only by an alias are treated as distinct for caching purposes.
20. **B.** Zero-copy cloning is the cost-and-complexity-appropriate fit: near-zero storage cost at creation (copy-on-write), no need for continuous real-time sync, and no promotion capability required — a replication group would provide unneeded continuous freshness, and a failover group would additionally require Business Critical edition for a promotion capability (failover to primary) this dev/test environment will never actually use.
21. **C.** Session parameters resolve via a strict Account -> User -> Session hierarchy where the most specific level set wins; an explicit ALTER SESSION SET always beats both the user default and account default for that session.
22. **C.** Aggregation policies guarantee every result group meets a minimum size threshold, enforced by Snowflake at the policy level so it can't be bypassed by crafting the query differently — unlike a secure view's fixed GROUP BY, which a determined user could still work around via other query shapes against the same underlying grants.
23. **B.** User-managed tasks run on a warehouse the team controls directly, so performance is predictable as long as that warehouse is sized and running — serverless tasks, by contrast, have Snowflake dynamically predict and assign compute and can encounter queuing under high concurrency, the opposite of this predictability requirement.
24. **B.** QAS eligibility hinges on the scan being large enough in absolute terms to be worth splitting off to additional serverless compute — a highly selective filter over a genuinely large (multi-GB to TB) table is the real target; the same selectivity percentage over a small (~1GB) table doesn't generate enough absolute scan volume to qualify.
25. **C.** Time Travel tops out at 90 days even on Enterprise+ (Business Critical's additions are compliance/key-management/replication-related, not a longer Time Travel window), and Fail-safe is a fixed 7-day, Support-only recovery, not self-service — neither alone or combined reaches a self-service 180-day requirement, which requires a separate deliberate backup pattern.
26. **B.** Iceberg tables exist specifically for open, cross-engine interoperable storage that both Snowflake and external engines like Spark can read/write. A Dynamic Table is a declarative, query-driven transformation output — not a general-purpose shared storage target for arbitrary external writers, making it the wrong tool for this concurrent-multi-engine-write scenario.
27. **B.** EXECUTE AS OWNER (the default) runs with the procedure owner's privileges — the standard pattern for letting a low-privilege caller perform a controlled higher-privilege action without being granted that privilege directly. EXECUTE AS CALLER runs with the calling role's own privileges and session context instead — necessary when the procedure needs to see the caller's own session variables or act strictly within the caller's own access boundary, such as an audit routine. Swapping the two breaks the intended security model in each case.
28. **B.** Serverless tasks auto-allocate and size compute based on recent run history, which suits unpredictable/bursty/light workloads without warehouse management overhead — exactly Pipeline A's profile. User-managed tasks run on an explicitly-sized, dedicated warehouse, giving direct control appropriate for Pipeline B's stable, predictable, high-concurrency needs.
29. **B.** The query result cache lives entirely in the Cloud Services layer and can serve an identical repeated query with zero compute and even a suspended warehouse. The metadata cache also lives in Cloud Services and can answer certain metadata-driven queries without warehouse compute (e.g. unfiltered COUNT(*)), but it's a narrower mechanism than a general result cache. The warehouse local (SSD) cache is physically tied to that warehouse's running compute nodes — with the warehouse suspended, there's no local cache to serve from at all.
30. **B.** Snowflake explicitly supports attaching an existing share to a listing, or converting a direct share with active consumers into a listing — direct shares and listings are related, composable mechanisms built on the same underlying share object rather than mutually exclusive, separate systems requiring a rebuild from scratch.
31. **B.** Object parameters like DATA_RETENTION_TIME_IN_DAYS follow an independent Account -> Database -> Schema -> Object hierarchy, distinct from the session-parameter hierarchy; the table inherits from the nearest ancestor that actually set the value explicitly — the schema's 7 days, not the database's 30.
32. **B.** Secure views specifically hide the view definition from consumers who lack privilege to see it — the standard mechanism for sharing filtered/derived data externally without exposing the logic behind the filtering, which a plain view or materialized view does not provide.
33. **B.** Serverless tasks fit unpredictable, sporadic workloads specifically because Snowflake manages and sizes the compute per run automatically — avoiding the operational overhead of managing a dedicated warehouse purely for occasional bursts of light work.
34. **B.** QUERY_ACCELERATION_MAX_SCALE_FACTOR is a cost multiplier on the warehouse's own credit rate — a Medium (4 credits/hr) with a scale factor of 5 can lease up to 4x5=20 additional credits/hour of QAS compute, billed separately as serverless, per-second usage only while QAS is actually engaged.
35. **B.** Zero-copy cloning is copy-on-write — free and metadata-only at clone time, but as the original and the clone each accumulate independent changes, each side's new/modified micro-partitions become distinct, separately-billed storage, while only the still-shared, never-touched micro-partitions remain a single free-riding copy — total storage cost grows in proportion to how much the two have diverged.
36. **B.** Multi-cluster warehouses and materialized views are both satisfied at Enterprise, but Tri-Secret Secure (the customer-managed-key layer) is specifically Business Critical+ — that third requirement is what forces the account past Enterprise into Business Critical, even though the other two would have been satisfied at the lower tier alone.
37. **B.** Trust Center is the account-wide security-posture/risk-scanner dashboard; Access History (an ACCOUNT_USAGE view) tracks actual object/column-level access per query, useful for precise data-access auditing; Data Lineage automatically visualizes which downstream objects depend on a given source, with no manual instrumentation — each tool answers a genuinely distinct question, and conflating them is a common mistake.
38. **B.** Task C, whose only predecessor is A (which succeeded), still runs. Task D depends on both B and C — since B failed, Task D does not run by default, because a task's default trigger condition requires ALL of its predecessor tasks to have completed successfully, not just some of them.
39. **B.** QUALIFY and a correctly-written wrapping subquery/CTE achieve the same correct result — the real benefit of QUALIFY is avoiding the extra nesting layer purely to work around WHERE's inability to reference window-function results directly in the same SELECT, which is a readability/maintainability improvement rather than a difference in correctness or a guaranteed performance win.
40. **B.** Zero-copy cloning's metadata-only state holds only until the clone and the source diverge via copy-on-write — and that divergence can be triggered by writes to EITHER copy, not just the clone. If the original production table keeps changing after the clone is taken (a very common real-world case), the two copies diverge and each accumulates its own storage for the parts that changed, even if the clone itself is never directly written to.
41. **C.** Multi-cluster billing multiplies the warehouse size's per-hour rate by however many clusters were actually running during each period, per-second: (2x4x1/3) + (1x4x2/3) ~= 2.67 + 2.67 ~= 5.3 credits total — not a flat rate, and not dropping either period.
42. **B.** Database roles are scoped to one database and can be granted up into account roles — the mechanism built for packaging database-specific access so it can travel with the database itself into a share or a replication target, unlike account roles which are account-wide.
43. **B.** By default, a child task only executes once all of its resumed predecessor tasks have completed successfully — if any predecessor fails, dependent child tasks are skipped; handling partial failure differently requires explicit configuration (e.g. TASK_AUTO_RETRY_ATTEMPTS or custom error handling).
44. **B.** The result cache is invalidated by underlying data changes — and background reclustering/partition consolidation counts as exactly that, even when no row's logical value actually changed, because the physical micro-partitions backing the table were rewritten; this is a commonly missed cache-invalidation trigger.
45. **B.** Data Clean Rooms are the privacy-preserving joint-analysis pattern — built on secure views/UDFs and strict governance so neither party sees the other's raw rows, fitting the competing-retailers case; Native Apps distribute running application logic into the consumer's own account/compute, fitting the ISV's proprietary-application-distribution case.
46. **B.** Multi-cluster billing multiplies the per-cluster credit rate by the number of clusters actually running at a given time, not the warehouse's configured maximum or a flat single-cluster rate: 3 clusters × 8 credits/hr × (20/60 hr) = 8 credits — the key principle is 'actual concurrently-running clusters', not max configured or single-cluster assumptions.
47. **A and B.** A resource monitor supports multiple threshold actions at different usage percentages (A), and a single monitor can track combined usage across multiple warehouses under one shared quota (B) — both true and commonly used together for FinOps guardrails. A warehouse being trackable by only one monitor and a fixed 24-hour auto-reset are not accurate characterizations of how resource monitors actually work (quota reset frequency is configurable, e.g. daily/weekly/monthly/never, not fixed).
48. **B.** Snowpipe and Snowpipe Streaming are ingestion mechanisms (getting raw data into a table), not transformation mechanisms — since ingestion is already handled upstream and the need here is a single-query transformation kept fresh with low latency, a Dynamic Table with a short target lag is the right, declarative fit for the transformation step itself.
49. **B.** Clustering keys and Search Optimization Service are independent, complementary levers targeting different query patterns (range-scan/large-filter pruning vs. point-lookup/equality acceleration) — neither is a prerequisite for the other, neither disables the other, and a table can legitimately use both at once if its workload has both kinds of queries.
50. **B.** A Data Clean Room is purpose-built for privacy-preserving joint analysis where neither party sees the other's raw rows (Scenario 1) — a Native App instead ships a full packaged application (logic/UI) that runs inside the consumer's own account (Scenario 2), a fundamentally different distribution pattern. Neither substitutes well for the other's core guarantee.
51. **B.** Since a Feb 2025 release, the MAX_CLUSTER_COUNT ceiling scales inversely with warehouse size specifically because Snowflake bounds total aggregate compute a multi-cluster warehouse can burst to, not the raw cluster count — a bigger per-cluster size means fewer clusters are allowed (4XL/5XL/6XL cap at 10, versus 300 for XS/S/M).
52. **B.** Secondary roles let a session activate additional roles alongside its one primary role via USE SECONDARY ROLES ALL — the session's effective privilege set becomes the union of primary + all active secondary roles, without a permanent grant or a new custom role.
53. **B.** Snowpipe Streaming pushes rows directly into Snowflake without first staging files, achieving much lower latency (sub-second to low-second) than Snowpipe's micro-batch, file-based, COPY INTO-under-the-hood model — the fit for high-throughput low-latency Kafka ingestion.
54. **B.** Snowflake's own documentation is explicit that any difference in syntax — including a table alias — inhibits 100% result cache reuse; the cache match is syntactic, not semantic, so functionally identical queries with different text miss the cache and recompute.
55. **B.** A Dynamic Table is declarative and query-expressible only — it fits Case P directly but cannot handle Case Q's arbitrary procedural/conditional logic, which needs a Stream+Task pair (or a stored procedure on a Task) instead. A materialized view fits Case R specifically because it's built for precomputed, Snowflake-maintained results over infrequently-changing data on Enterprise+, a different tradeoff than either declarative incremental refresh (Dynamic Table) or fully custom procedural orchestration (Stream+Task).
56. **B.** A network policy operates at the connection/IP layer, controlling who can connect at all — it has no concept of column values or roles-based display logic. A masking policy operates entirely at query time, altering a column's displayed value based on the querying role — it has no mechanism to block a network connection. The two operate at fundamentally different layers and aren't interchangeable.
57. **B.** Both a named internal stage and an external stage can support a custom file format, a directory table, and role-based sharing — none of those three features is exclusive to one stage type. The real distinguishing factor is where the files physically live: Snowflake-managed internal storage versus the team's own cloud storage bucket (which then typically also involves a storage integration for secure external access).
58. **B.** APPROX_COUNT_DISTINCT trades a small, generally-acceptable estimation error for much lower cost/latency at scale — appropriate for a dashboard tile where precision isn't the point. A regulatory/legal filing needs an exact, defensible number; HyperLogLog's inherent (if usually small) estimation error is an unacceptable risk in that context regardless of its typical accuracy, making exact COUNT(DISTINCT) the correct, non-negotiable choice there.
59. **A.** Snowpark-Optimized warehouses provide substantially more memory per node than standard warehouses (Gen1 or Gen2) — Gen2's improvement is CPU/price-performance, not added memory — making them the right lever specifically for memory-bound (not CPU-bound) workloads showing spilling with low CPU use.
60. **B.** EXECUTE AS OWNER (Snowflake's default for stored procedures) runs with the procedure owner's privileges rather than the caller's — the standard pattern for letting a low-privilege caller perform one controlled, higher-privilege action without granting them broad direct access to the underlying table.
61. **B.** Snowpipe is built for this pattern — serverless, event-notification-triggered, file-based ingestion at micro-batch latency, billed per actual compute-second rather than requiring a managed warehouse; Snowpipe Streaming's lower latency isn't needed and adds unneeded complexity for a batch-file source.
62. **B.** Clustering keys are the tool for range scans/large filtered queries on tables where physical co-location of matching rows drives pruning effectiveness — Search Optimization instead targets highly selective point-lookup/equality patterns on columns clustering doesn't naturally help, the opposite of a range-predicate scenario.
63. **B.** Doubling a Standard warehouse's size scales both compute and memory together, which may overpay for CPU capacity that isn't actually the bottleneck in a memory-bound workload. Snowpark-Optimized warehouses specifically add memory per node for the same general size class, targeting the real bottleneck (memory) more directly for memory-intensive Snowpark/ML work — often the more cost-effective fix than blanket upsizing.
64. **B.** Layering a database role (scoped to the dataset's database) underneath an account role is the architecturally correct pattern specifically because the database role's privileges travel with the database into a future share or replication target — privileges granted directly to an account role instead stay tied to that account-wide object and don't automatically carry over the same way when the database itself moves or is shared.
65. **B.** `SKIP_FILE_<n>` sets an error-count THRESHOLD before a file is skipped entirely, rather than skipping on the very first error like plain `SKIP_FILE` does — a file with more than n errors gets skipped wholesale, but a file with fewer than n errors keeps loading its valid rows while just excluding the bad ones, a materially different (more forgiving) behavior than plain SKIP_FILE's zero-tolerance-per-file approach.
66. **B.** The two features are genuinely independent mechanisms targeting different query shapes: Search Optimization Service maintains a separate access-path structure for point-lookup/equality-style queries, while clustering keys maintain physical micro-partition co-location that benefits range-scan/large-filter pruning — enabling one has no improving (or degrading) effect on the other's target query pattern, and neither is a prerequisite for the other.
67. **B.** Snowpark-Optimized warehouses carry a cost premium for extra memory per node that's wasted on a CPU-bound, non-memory-constrained job; Standard Gen2 targets exactly this case (better price/performance for general compute) without paying for unused memory headroom.
68. **B.** EXECUTE AS CALLER runs the procedure using the invoking user's own privileges and session context — required so a row access policy keyed on session context (the caller's department) evaluates correctly per-caller, rather than always resolving against the procedure owner's context under EXECUTE AS OWNER.
69. **B.** COPY INTO's idempotency tracking keys on file name and checksum together, not name alone — a file with the same name but different content (a different checksum) is treated as a distinct, not-yet-loaded file and reloads automatically without needing FORCE = TRUE, which is for reloading a file whose checksum hasn't changed.
70. **A.** This is the ideal Materialized View case: expensive, frequently-repeated aggregation over infrequently-changing source data — the batch-load-once-nightly change pattern keeps background maintenance credits low while the query avoids dozens of daily full recomputations.
71. **B.** An External table (a metadata-only pointer, refreshed as files change) is the right, lighter-weight fit for a read-only use case where an external process fully controls file layout — Iceberg's open, transactional table-format metadata exists to coordinate consistent multi-engine reads AND writes, which is unneeded machinery when Snowflake only ever reads and never writes.
72. **B.** Tag-based masking policy attachment is exactly designed to scale this way — because the policy lives on the tag rather than any individual column, every column tagged with that tag (including ones tagged well after the policy was attached) automatically inherits the masking behavior, removing the risk of a governance rule being forgotten on newly-added sensitive columns.
73. **B.** Both an external function's outbound call and a webhook-based notification integration are authorized through the same underlying object type — an API integration — and a single API integration scoped to an appropriate endpoint pattern can be reused across multiple external functions or notification configurations, rather than requiring a structurally different integration type per use case.
74. **B.** The local (SSD) cache accelerates data ACCESS (skipping the slower remote-storage fetch) but the warehouse still has to perform actual compute — scanning, filtering, aggregating — which is what warehouse credits bill for. A result-cache hit is categorically different: it returns already-computed final output rows with no execution needed at all, which is why only a result-cache hit is genuinely free, not a local-cache hit.
75. **C.** Cortex Analyst is purpose-built for natural-language-to-SQL over structured data via a semantic model, aimed at self-service analytics for non-SQL business users — Cortex Search targets unstructured/document retrieval, and generic AI_COMPLETE prompting lacks Analyst's semantic-model-grounded SQL generation and governance.
76. **C.** Trust Center is a consolidated security-posture dashboard — out-of-the-box scanners (CIS Benchmark, Security Essentials, Threat Intelligence) surface violations and event-driven detections in one place, distinct from Access History (query-to-object usage auditing) and lineage (object dependency tracking).
77. **C.** The user stage and table stage are both fixed, non-shareable, single-purpose stages (the table stage also can't take a custom file format) — a named internal stage is the flexible, explicitly created, role-grantable option that supports a custom file format and an optional directory table.
78. **A.** APPROX_COUNT_DISTINCT uses a HyperLogLog-based algorithm that's dramatically cheaper than an exact COUNT(DISTINCT) at large scale, at the cost of small statistical approximation error — the right tradeoff for frequent, fast, 'close enough' distinct counts over billions of rows.
79. **B.** The Domain 1.3 object hierarchy enumerates database-scoped objects (Stages, Schemas, Tables, Views, UDFs, File formats, Stored procedures, Pipes, Shares, Sequences, ML models, Applications) — Warehouses and Resource Monitors are both account-level constructs sitting outside that database-object list entirely, a common point of confusion in governance audits that scope too broadly.
80. **B.** Access History is specifically built to record actual column/object-level read and write access per query, the right source for a precise audit trail — a resource monitor is purely a credit-usage/quota-management mechanism with no awareness of which specific columns or objects were touched by any given query, so it cannot answer the audit-trail half of this requirement at all.
81. **B.** A task's predecessor list must be explicitly and completely declared — Snowflake has no way to infer an intended dependency that isn't stated via `AFTER`. With only `task_a` declared, Task C runs as soon as Task A succeeds, with no awareness that it was also supposed to wait on Task B, which is a genuine, easy-to-make configuration mistake with real downstream-correctness consequences.
82. **B.** The right choice depends on the data's actual usage pattern: a normalized child table gives independent relational capabilities (its own clustering, constraints, easily-updated rows, standalone querying) that a VARIANT-array-plus-FLATTEN approach doesn't provide as naturally — VARIANT+FLATTEN shines for genuinely nested, schema-flexible, less-independently-queried data instead. Neither is universally superior; it's a real modeling tradeoff based on access patterns.
83. **B.** Cortex Search is the retrieval/RAG-oriented service — it indexes unstructured sources and handles ranking/retrieval so relevant passages ground an LLM's answer, avoiding hand-built RAG infrastructure; Cortex Analyst is specifically for structured-data NL-to-SQL, not document retrieval.
84. **A and C.** A resource monitor can cover multiple warehouses at once, and a single monitor supports several threshold actions (multiple Notify thresholds plus one Suspend and one Suspend Immediately) — but the reverse (multiple monitors on one warehouse) isn't allowed, and reset frequency options include Daily/Weekly/Monthly/Yearly/Never, not only Monthly.
85. **B.** QUALIFY is a Snowflake-specific clause that filters on the result of a window function directly within the same query — avoiding the common pattern of nesting the windowed SELECT inside a subquery/CTE purely to apply a WHERE-style filter on something like ROW_NUMBER() = 1.
86. **B.** Snowflake's architecture is genuinely hybrid: storage is shared (one copy of data, not duplicated per warehouse like pure shared-nothing would require) while compute is independent per warehouse (avoiding the contention pure shared-disk designs would introduce) — this combination is precisely what lets multiple teams run large, concurrent, isolated workloads against the same underlying data without duplicating it or contending for compute.
87. **B.** Resource monitors are entirely opt-in and can be attached to any number of warehouses (including a group sharing one combined quota, as with A-D) — warehouses left unattached to any monitor simply have no quota-based guardrail in place; there's no implicit default monitor that silently applies to everything else.
88. **B.** The core justification is queueing isolation, not raw cost savings: on a shared warehouse, a long-running batch query can force a latency-critical service to wait behind it in the queue, which directly violates a real-time requirement. Separate warehouses guarantee that isolation — the 'uses more resources' framing misses that some idle capacity is often the acceptable cost of meeting a hard latency SLA, not a pure waste.
89. **B.** Task-specific AI SQL functions (AI_SENTIMENT, AI_CLASSIFY, AI_TRANSLATE, etc.) are optimized and priced for their narrow task and are cheaper than routing the same work through a general-purpose AI_COMPLETE prompt — reaching for Cortex Analyst or Cortex Search here is unneeded machinery for a single-column batch scoring task.
90. **B.** QAS eligibility is evaluated based on a query's absolute scan size/selectivity characteristics and the absence of disqualifying nondeterministic functions — clustering quality isn't itself a direct QAS eligibility factor. Better clustering CAN indirectly change the picture by reducing how much data a query needs to scan via improved pruning (potentially making the query no longer need QAS's help at all), but that's a different, indirect effect rather than clustering quality being a QAS eligibility input.
91. **A.** Snowflake-managed Iceberg tables have Snowflake itself own the catalog/metadata lifecycle while still writing in the open Iceberg format readable by other engines — externally-managed Iceberg tables instead rely on an external catalog Snowflake participates with as one of potentially several writing/reading engines. This distinction also matters practically: some features (like standard/append-only streams) require the Snowflake-managed variant specifically.
92. **B.** Dynamic Tables are the declarative alternative to hand-rolled Stream+Task pipelines specifically when the transformation is a single query — you declare the target lag and Snowflake figures out the incremental refresh; Stream+Task is the right call only when custom procedural logic is needed beyond what one query expresses.
93. **B.** Notebooks are built for interactive, cell-by-cell exploratory development (the model-development phase); Streamlit in Snowflake is built for hosting a finished, polished, non-editable interactive app for other users to self-serve against (the publishing phase) — genuinely different tools for genuinely different stages of the same overall workflow, not interchangeable or merely newer-vs-older.
94. **C.** Dynamic Tables and Materialized Views are both bound to a single declarative defining query — neither can express row-by-row conditional branching; Stream+Task fits because the Task can execute a full stored procedure (with control flow) against the Stream's captured changes.
95. **B.** Cloud Services billing is governed by the 10%-of-daily-warehouse-compute free threshold — on a day with unusually little warehouse compute activity to offset against, heavy metadata-only workloads become more plausible candidates for actually crossing that threshold and appearing as a real (if still relatively rare) line-item charge.
96. **B.** Materialized Views are Snowflake-maintained precomputed results intended for expensive aggregations over slowly-changing data; a source updated near-continuously forces near-continuous background maintenance credits, which can erase or exceed the savings versus just running the query directly.
97. **B.** Since Snowflake bounds total aggregate compute as warehouse size × cluster count, a workload of many small, lightweight, highly concurrent queries is generally better matched by a smaller warehouse size with a higher cluster-count ceiling (more parallel concurrency capacity at lower per-cluster cost) than by fewer, larger clusters sized for individually-heavy queries — matching cluster/size configuration to actual query shape, not just picking 'bigger is better.'
98. **C.** Business Critical adds customer-managed keys and regulatory compliance support, but its underlying infrastructure is still the shared multi-tenant service; VPS is the edition that provides a completely separate, dedicated Snowflake environment isolated from all other accounts.
99. **B.** `CURRENT_ROLE()` returns just the one role active in the session right now, while `CURRENT_AVAILABLE_ROLES()` returns the broader list of every role the calling user is entitled to switch into — a meaningful distinction for authorization logic that needs to know the full scope of what a user COULD do, not just what's active at this instant.
100. **B.** Economy's scale-out trigger is a specific, quantified threshold — a new cluster starts only when Snowflake estimates queued work will keep it busy for at least 6 minutes — so many short, bursty jobs may keep queuing without ever justifying a new cluster, which is the cost/latency tradeoff Economy makes versus Standard's more proactive trigger.
