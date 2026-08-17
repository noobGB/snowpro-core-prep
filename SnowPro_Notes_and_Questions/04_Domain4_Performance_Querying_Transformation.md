# Domain 4 — Performance Optimization, Querying & Transformation (21%)

**Verified against the official Snowflake COF-C03 Exam Study Guide** — follows guide sections
4.1-4.4. Streams/Tasks/Dynamic Tables moved to
[Domain 3](03_Domain3_Data_Loading_Unloading_Connectivity.md) to match the official guide's own
filing (they're under "automated data ingestion" there, not performance).

## 4.1 Evaluate query performance

- **Query Profile / Query Insights** — the primary diagnostic tool (Snowsight → query history →
  a query's profile), a visual execution-plan graph. Watch for:
  - **Bytes spilled to storage**: warehouse ran out of memory for an operation and spilled to
    local disk (bad) or remote storage (worse) — usually means the warehouse is undersized for
    that query, or the query needs rewriting to reduce intermediate result size.
  - **Inefficient pruning**: high ratio of partitions scanned vs. total partitions for a filtered
    query — signals the filter column isn't well-clustered.
  - **Exploding joins**: a join producing far more output rows than either input (missing/wrong
    join key) — inflates every downstream operator's cost.
  - **Queuing**: query waited before executing at all — a warehouse/concurrency problem, not a
    query-plan problem; consider multi-cluster scaling out.
- **`SNOWFLAKE.ACCOUNT_USAGE` views**: `QUERY_HISTORY` (execution details, retained longer than
  `INFORMATION_SCHEMA`'s version) and **query attribution** views (which warehouse/user/query tag
  drove which cost) — the go-to source for retrospective performance/cost analysis.
- **Workload management best practice**: group similar workloads (by latency/concurrency profile)
  onto dedicated warehouses rather than mixing, e.g., heavy ad-hoc analyst queries with
  latency-sensitive dashboard queries on the same warehouse.

## 4.2 Optimize query performance

- **Query Acceleration Service (QAS)**: offloads eligible portions of an *outlier* query (one
  that's disproportionately large/long relative to the rest of the workload on that warehouse) to
  additional serverless compute, transparently, without resizing the warehouse itself. Different
  lever from warehouse sizing — QAS helps one anomalous query without paying for a bigger
  warehouse all the time.
  - Eligible for two patterns: large scans with selective filters, and large-volume DML
    (`INSERT`/`COPY`/`UPDATE`/`DELETE`). Requires enough partitions to be worth splitting and no
    nondeterministic functions (`RANDOM()`, `SEQ`) in the query.
  - **Eligibility is about *absolute* scan size, not just filter selectivity** — verified
    hands-on: a highly selective filter (0.04% of rows) over a ~1GB sample table still came back
    `"ineligible", "ineligibleReason": "NO_LARGE_ENOUGH_SCAN"` from
    `SYSTEM$ESTIMATE_QUERY_ACCELERATION()`. A selective filter over a genuinely large (many
    GB-TB) production table is the real target, not GB-scale data regardless of selectivity.
  - `QUERY_ACCELERATION_MAX_SCALE_FACTOR`: a hard **cost multiplier** on the warehouse's own
    rate, not a performance dial — e.g. a Medium warehouse (4 credits/hr) with scale factor 5 can
    lease up to 20 additional credits/hr of QAS compute. `0` = no upper bound. Billed separately
    from warehouse credits, serverless, per-second, only while in use. **Default scale factor**
    (verified against current docs): **8** when QAS is explicitly enabled by hand, but only **2**
    when it's auto-enabled (Gen2/multi-cluster warehouses can auto-enable QAS) — worth knowing the
    auto-enabled default is deliberately more conservative than the manual one.
  - Check eligibility *before* running a query for real: `SYSTEM$ESTIMATE_QUERY_ACCELERATION
    (query_id)`. Check what actually happened *after*: `QUERY_ACCELERATION_BYTES_SCANNED` /
    `_PARTITIONS_SCANNED` / `_UPPER_LIMIT_SCALE_FACTOR` columns in `QUERY_HISTORY`. Two more
    monitoring surfaces worth knowing by name: the **`QUERY_ACCELERATION_ELIGIBLE`** view
    (identifies which queries/warehouses would benefit most from turning QAS on) and the
    **`QUERY_ACCELERATION_HISTORY`** view/table function (historical QAS billing/usage, separate
    from ordinary warehouse credit consumption).
- **Search Optimization Service** (Enterprise+, confirmed hands-on to actually work on this trial
  account, unlike Cortex): accelerates highly selective point-lookup queries on columns that don't
  naturally benefit from clustering — a different tool from clustering keys, which help range
  scans/large filters. **Predicate coverage is broader than just equality/`IN`/`LIKE`** (verified
  against current docs) — it also covers: substring and regex matches (`LIKE`/`ILIKE`/`RLIKE`),
  `NULL` checks, geospatial predicates on `GEOGRAPHY` values, full-text search via the
  `SEARCH`/`SEARCH_IP` functions, and lookups into semi-structured `VARIANT`/`OBJECT`/`ARRAY`
  columns — not just simple scalar-column equality.
  - Enable: `ALTER TABLE <table> ADD SEARCH OPTIMIZATION;` — builds a specialized access path
    **asynchronously in the background**, not instantly; check `search_optimization_progress` in
    `SHOW TABLES` output (0-100) to see build status, and `search_optimization_bytes` for the
    access path's storage footprint once built.
  - Estimate cost *before* enabling: `SYSTEM$ESTIMATE_QUERY_ACCELERATION`'s sibling function,
    `SYSTEM$ESTIMATE_SEARCH_OPTIMIZATION_COSTS('<table>')` — returns JSON with `BuildCosts`
    (credits) and `StorageCosts` (TB/month) estimates. Verified hands-on: `MaintenanceCosts` came
    back `"NotAvailable" — "Table is too young. Requires 7 day(s) of history"` on a brand-new
    table — ongoing maintenance-cost estimation needs real observed query/write history over
    time, not just the table's current size.
- **Clustering keys**: `ALTER TABLE ... CLUSTER BY (...)` — keeps specified column(s) co-located
  across micro-partitions as a table grows/churns, preserving pruning effectiveness. Snowflake
  performs **automatic reclustering** in the background (consumes credits); only worth it on
  large (multi-TB), frequently-filtered/joined tables — small tables see no benefit and add
  needless reclustering cost.
- **Materialized views** (Enterprise+): precomputed, Snowflake-maintained results for expensive,
  frequently-run aggregations over data that changes infrequently — costs storage + background
  maintenance credits, so not a default choice for every view.

## 4.3 Snowflake caching

- **Query result cache**: Cloud Services layer, caches the *final output rows*, not input data.
  24h retention (refreshed to 31 days max on reuse; large results >100KB get a separate access
  token expiring after 6h). Zero compute credits on a hit — warehouse doesn't need to be running.
  - **Requires exact syntactic match**, not semantic equivalence — verified from Snowflake's own
    docs: *"Any difference in syntax, including lowercase versus uppercase, or the use of table
    aliases, will inhibit 100% cache reuse."* A table alias or a casing change breaks the hit.
  - **Access is privilege-gated, not freely account-wide**: the querying role must hold the
    required privileges on the underlying objects; for `SHOW`-type queries specifically, the role
    must exactly match the role that generated the cached result.
  - **Invalidated by**: underlying data changes, non-reusable functions (`UUID_STRING`, `RANDOM`,
    `RANDSTR`), external functions, hybrid table queries, result-affecting config changes, and —
    easy to miss — **background reclustering/partition consolidation alone**, even with no
    logical data change.
- **Metadata cache**: Cloud Services layer, holds micro-partition metadata (min/max, counts),
  drives pruning — explains "instant" unfiltered `COUNT(*)`-style results.
- **Warehouse (local disk/SSD) cache**: compute layer, holds recently-scanned raw *input*
  micro-partition data (not output rows) on that warehouse's physical compute nodes — helps *any*
  query touching overlapping data blocks, not just an identical repeat. Still consumes real
  compute credits on a hit (skips the slow remote-storage fetch, not the compute itself). Lost on
  suspend/resize, since the underlying physical nodes change.

## 4.4 Data transformation techniques

- **Structured/semi-structured/unstructured data**: standard SQL types + `VARIANT` (max ~16MB
  compressed/value, `:`/bracket notation, `FLATTEN()` to explode nested arrays/objects) +
  unstructured file handling via stages/directory tables (see
  [Domain 3](03_Domain3_Data_Loading_Unloading_Connectivity.md)).
- **Aggregate functions**: standard (`SUM`, `COUNT`, `AVG`, `MIN`/`MAX`) plus Snowflake extras
  like `APPROX_COUNT_DISTINCT` (HyperLogLog-based, much cheaper than exact `COUNT(DISTINCT)` on
  huge tables) and semi-structured-aware aggregates.
- **Window functions**: `ROW_NUMBER()`, `RANK()`, `LAG`/`LEAD`, running totals via
  `OVER (PARTITION BY ... ORDER BY ...)`; **`QUALIFY`** lets you filter directly on a window
  function's result without wrapping the query in a subquery/CTE — a Snowflake-specific
  convenience worth knowing by name.
- **Applying SQL for query optimization**: e.g. filtering as early as possible (predicate
  pushdown — Snowflake mostly does this automatically, but poorly-written queries can defeat it),
  avoiding `SELECT *` on wide tables, using `QUALIFY` instead of nested subqueries, and preferring
  set-based operations over row-by-row procedural logic.

## Self-check before moving on

- [ ] Can you distinguish Query Acceleration Service from Search Optimization Service by what
      kind of query each one targets?
- [ ] Given a Query Profile showing spilling, inefficient pruning, or queuing, can you say what
      each symptom implies and the likely fix?
- [ ] Can you explain why `APPROX_COUNT_DISTINCT` might be preferred over exact
      `COUNT(DISTINCT)` at scale?
- [ ] Can you name all three caches and what invalidates each one (see also
      [Domain 1](01_Domain1_Architecture_and_Features.md))?
- [ ] Can you explain what `QUALIFY` does and why it exists?
