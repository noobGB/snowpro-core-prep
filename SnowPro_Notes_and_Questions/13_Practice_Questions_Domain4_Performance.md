# Practice Questions — Domain 4: Performance Optimization, Querying & Transformation (21%)

11 original questions covering subtopics 4.1-4.4, modeled on
[04_Domain4_Performance_Querying_Transformation.md](04_Domain4_Performance_Querying_Transformation.md).
Original content, not sourced from any exam-dump site.

---

**1.** In Query Profile, a query shows a large amount of **bytes spilled to local storage** at
one operator. What does this most directly indicate, and what's the most likely fix?

A. The filter predicate isn't pruning partitions — add a clustering key
B. The warehouse ran out of memory for that operation — consider a larger warehouse or
   rewriting the query to reduce intermediate result size
C. The query is waiting behind other queries — scale out to a multi-cluster warehouse
D. A join is producing far more rows than expected — check the join keys

**2.** In Query Profile, a query scans 95% of a table's total micro-partitions despite having a
highly selective filter on one column. What does this most directly indicate, and what's the
most likely fix?

A. Bytes are spilling to disk — resize the warehouse larger
B. The filtered column isn't well-clustered — consider a clustering key on that column for a
   large, frequently-filtered table
C. The warehouse is queueing — scale out
D. The query needs `QUALIFY` instead of a `WHERE` clause

**3.** A query's Query Profile shows one join operator outputting far more rows than either of
its two inputs combined. What does this most likely indicate?

A. Inefficient pruning on the filter column
B. A missing or incorrect join key (an "exploding" join)
C. The result cache was bypassed
D. The warehouse needs Query Acceleration Service

**4.** Several dashboard queries wait for several seconds before starting, even though each
individual query, once running, completes quickly. Query Profile shows minimal time spent inside
each query's own execution plan. What does this pattern indicate, and what's the fix?

A. Bytes spilling to disk — resize the warehouse
B. Inefficient pruning — add a clustering key
C. Queuing due to insufficient concurrency — consider a multi-cluster warehouse (scale out)
D. An exploding join — review the join logic

**5.** An analytics team wants to know which specific warehouse and query tag drove the most
credit consumption last month, broken out by query. Which source should they use?

A. Query Profile for a single query
B. `SNOWFLAKE.ACCOUNT_USAGE` query attribution / `QUERY_HISTORY` views
C. A resource monitor's current threshold status
D. `SYSTEM$CLUSTERING_INFORMATION`

**6.** As a workload-management best practice, a company runs both latency-sensitive executive
dashboards and long-running ad-hoc analyst queries. What's the recommended approach?

A. Run both workloads on one large warehouse so they share the same cache
B. Group similar workloads onto separate, dedicated warehouses so one doesn't queue out the
   other
C. Always use Query Acceleration Service instead of separating warehouses
D. Disable auto-suspend on both workloads to avoid cold-start latency

**7.** A single ad-hoc analytical query is disproportionately large and slow compared to the rest
of the workload running on its warehouse. The team doesn't want to resize the warehouse
permanently just for this one outlier query. Which feature is designed for exactly this
situation?

A. Search Optimization Service
B. Query Acceleration Service (QAS)
C. A clustering key
D. A materialized view

**8.** A support application performs frequent exact-match lookups (`WHERE ticket_id = ?`) on a
large table where the lookup column isn't naturally well-clustered and clustering isn't a good
fit. Which feature is best suited to accelerating these specific point lookups?

A. Query Acceleration Service
B. Search Optimization Service
C. A clustering key on `ticket_id`
D. The metadata cache

**9.** A dashboard aggregation over a large, slowly-changing table is expensive to recompute on
every page load. The team is on Enterprise edition. Which feature lets Snowflake precompute and
automatically maintain this result, at the cost of storage and background maintenance credits?

A. A standard view
B. A materialized view
C. The result cache alone
D. A Dynamic Table with no target lag

**10.** A query returns instantly with **zero compute credits consumed**, even though the
warehouse that would normally run it is currently suspended. Which cache explains this?

A. The metadata cache
B. The local warehouse (SSD) cache
C. The query result cache
D. The search optimization cache

**11.** A query needs to return each customer's single most recent order, using a window function
to rank orders per customer by date, without wrapping the query in an extra subquery or CTE just
to filter on the ranking. Which Snowflake SQL feature is purpose-built for this?

A. `FLATTEN()`
B. `QUALIFY`
C. `MERGE`
D. `APPROX_COUNT_DISTINCT`

---

## Answer Key & Explanations

1. **B.** Spilling means the warehouse lacked memory for that operation — resize up or reduce
   intermediate result size; it's not a pruning, queueing, or join-key symptom.
2. **B.** Scanning nearly all partitions despite a selective filter is the signature of poor
   clustering on the filtered column — a clustering key (on a large, frequently-filtered table)
   is the standard fix.
3. **B.** A join outputting far more rows than its inputs combined is the definition of an
   exploding join — almost always a join-key problem.
4. **C.** Fast individual execution but queued start time is a concurrency symptom, not a
   query-plan problem — multi-cluster (scale out) addresses queueing; scaling up a single
   warehouse doesn't help queries that haven't started yet.
5. **B.** `ACCOUNT_USAGE` query attribution/`QUERY_HISTORY` views are built for exactly this
   retrospective cost/warehouse/tag breakdown; Query Profile is per-query, not aggregate.
6. **B.** Grouping similar workloads onto dedicated warehouses is the explicit official best
   practice — prevents one workload's queueing from affecting an unrelated one.
7. **B — Query Acceleration Service.** Targets exactly this scenario: one outlier query, offload
   its eligible scan-heavy portions to serverless compute without resizing the warehouse for
   everyone.
8. **B — Search Optimization Service.** Built for highly selective point-lookup/equality/
   substring searches on columns that don't naturally benefit from clustering — a different lever
   from a clustering key, which helps range scans/large filtered scans.
9. **B — A materialized view.** Enterprise+ feature, Snowflake-maintained precomputed result,
   with real storage + maintenance cost — exactly matches the tradeoff described.
10. **C — The query result cache.** Lives in Cloud Services, works with zero compute and even a
    suspended warehouse, for an identical query on unchanged data within its retention window.
11. **B — `QUALIFY`.** Purpose-built to filter directly on a window function's result without an
    extra wrapping subquery/CTE — exactly the described use case (e.g.
    `QUALIFY ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date DESC) = 1`).
