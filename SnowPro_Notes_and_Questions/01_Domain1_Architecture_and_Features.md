# Domain 1 — Snowflake AI Data Cloud Features & Architecture (31%)

**Verified against the official Snowflake COF-C03 Exam Study Guide (last updated 2026-07-08)** —
subtopics below follow the guide's own numbering (1.1-1.6). Biggest domain by far — protect your
best study time for this one.

## 1.1 Snowflake architecture & editions

- **Three layers**: Cloud Services (auth, metadata, query parsing/optimization, access control —
  Snowflake-managed compute you don't provision), Compute/query processing (virtual warehouses —
  independent MPP clusters, multiple can hit the same data with zero contention), Database
  Storage (compressed, columnar, encrypted, immutable **micro-partitions**, ~50-500MB
  uncompressed each; Snowflake manages partitioning automatically).
- Hybrid model: shared storage (one copy of data in cloud object storage) + independent
  per-warehouse compute — neither pure shared-disk nor pure shared-nothing.
- **Editions, strict superset order**: Standard → Enterprise (adds up to 90-day Time Travel,
  multi-cluster warehouses, materialized views, search optimization) → Business Critical (adds
  HIPAA/PCI, Tri-Secret Secure customer-managed keys, replication/failover) → Virtual Private
  Snowflake (VPS, fully isolated dedicated infrastructure).

## 1.2 Snowflake interfaces & tools

- **Snowsight**: the primary web UI — worksheets, dashboards, Query Profile, account/cost
  monitoring, marketplace browsing.
- **Snowflake CLI** (`snow`): command-line tool for connecting, running SQL, managing Snowpark/
  Native App projects, DevOps-style object management.
- **IDE integrations**: e.g. the official VS Code extension for writing/running SQL and Snowpark
  code against an account directly from the editor.
- (SnowSQL, the older CLI client, still exists but the current guide foregrounds the newer
  Snowflake CLI — know both names.)

## 1.3 Object hierarchy & types

- **Organization** → **Account(s)** → **Database** → **Schema** → object.
- **Database objects** to recognize by name (know what each is, not necessarily deep syntax):
  Stages, Schemas, Tables, Views, User-Defined Functions (UDFs), File formats, Stored procedures,
  **Pipes** (the object backing Snowpipe), Shares, **Sequences** (auto-incrementing number
  generators), **ML models** (registered model objects from Snowflake ML), **Applications**
  (installed Native Apps).
- **Session & context variables**: `CURRENT_ROLE()`, `CURRENT_WAREHOUSE()`, etc. — session
  context. **Parameter hierarchy**: account → user → session → object-level settings, each level
  can override the one above. **Parameter precedence**: the most specific level set wins (e.g. a
  session-level `ALTER SESSION SET` beats the account default for that session only).

## 1.4 Virtual warehouses

- **Types**: **Standard** (Gen 1 and Gen 2 — Gen 2 is newer compute with better price/performance
  for many workloads), **Snowpark-Optimized** (extra memory per node, for memory-intensive
  Snowpark/ML workloads), Default warehouse for Notebooks (flagged in the guide as *not tested
  until GA* — skip it).
- **Scaling policies** (multi-cluster, Enterprise+), precise mechanism (verified against
  Snowflake's own docs, not just paraphrased):
  - **Standard**: starts a new cluster the moment *either* (a) a query is actually queued, *or*
    (b) Snowflake estimates the running clusters won't have enough resources for additional
    incoming queries — proactive, before a real queue even forms. For `MAX_CLUSTER_COUNT > 10`
    (only possible on XS/S/M, given the size-based caps above), multiple clusters can start
    simultaneously, not just one at a time. Shuts down least-loaded clusters "after a sustained
    period of low load," once their current queries finish — no fixed timing given.
  - **Economy**: a new cluster starts only if Snowflake estimates there's enough queued work to
    keep it busy for **at least 6 minutes** — a specific, quantified threshold, not just "wait
    until full." Shutdown uses the same 6-minute threshold symmetrically: a cluster is marked for
    shutdown once estimated remaining work drops **below 6 minutes**.
  - A sample question in the official guide tests this precisely — know it's "reacts to any
    predicted shortfall immediately" vs. "requires a 6-minute sustained-load estimate," not a
    vague latency/cost vibe.
- **Match warehouse type/config to use case**: ad-hoc queries (small-medium, auto-suspend
  aggressively), data loading (sized to file parallelism, not necessarily huge), BI/reporting
  (multi-cluster for concurrency, moderate size per query).
- **Best practices**: size *up/down* for a single query's complexity, scale *in/out*
  (multi-cluster) for concurrency; aggressive **auto-suspend** to avoid idle billing; separate
  warehouses per team/workload type so heavy queries from one group don't queue out another
  (isolate high-concurrency dashboards from complex ad-hoc analyst queries, for example).
- Billing: per-second, 60-second minimum per resume. Credits/hr roughly double per size step
  (XS=1, S=2, M=4, L=8, XL=16, 2XL=32...).
- **Cloud Services layer billing**: usage is only billed if it exceeds **10% of that day's total
  warehouse (compute) credit consumption** — under that threshold, Cloud Services compute is free.
  This is why light query-compilation/auth/metadata overhead essentially never shows up as a line
  item for normal workloads, but an account doing almost nothing except heavy `SHOW`/metadata-only
  querying (little warehouse compute to offset against) could actually see a Cloud Services charge.
- **Max cluster count scales *inversely* with warehouse size** (changed via a Feb 2025 release —
  older sources assume a flat cap of 10 for every size): XS/S/M → 300, L → 160, XL → 80,
  2XL → 40, 3XL → 20, 4XL/5XL/6XL → 10. Bigger warehouse = fewer clusters allowed, since Snowflake
  bounds total aggregate compute (size × cluster count), not cluster count alone. **Default is
  still 10 regardless of size** — these are ceilings you opt into via
  `ALTER WAREHOUSE ... SET MAX_CLUSTER_COUNT = ...`, not the out-of-the-box behavior; Snowsight's
  UI picker still tops out at 10 either way.

## 1.5 Storage concepts

- **Micro-partitions**: immutable, ~50-500MB uncompressed, columnar, metadata (min/max, distinct
  counts) drives pruning.
- **Data clustering**: how well co-located matching rows are across micro-partitions; drives
  pruning effectiveness. See [Domain 4](04_Domain4_Performance_Querying_Transformation.md) for
  clustering keys as a performance lever.
- **Table types**: Permanent (default, full Time Travel + Fail-safe), Temporary (session-scoped),
  Transient (Time Travel only, no Fail-safe), **Apache Iceberg** (Snowflake as a query/write
  engine over externally-managed open Iceberg format tables — interoperable with other engines
  reading the same files), **External** (metadata-only pointer to files in external cloud
  storage, not ingested), **Dynamic** (declarative, auto-refreshed transformation tables — see
  [Domain 3](03_Domain3_Data_Loading_Unloading_Connectivity.md), where the guide files this under
  automated ingestion).
- **View types**: **Standard** (just a saved query, recomputed each time), **Materialized**
  (Enterprise+, precomputed and automatically kept in sync by Snowflake, for expensive
  aggregations over slowly-changing data), **Secure** (definition hidden from viewers without
  privilege to see it; required when sharing a filtered/derived view outside the account — see
  [Domain 5](05_Domain5_Data_Collaboration.md)).
- **Cloning, Time Travel, and Fail-safe** are grouped by the official guide under Domain 5.0
  (Data Collaboration & Protection) rather than here — full detail lives in
  [05_Domain5_Data_Collaboration.md](05_Domain5_Data_Collaboration.md). Don't skip them just
  because they feel like an architecture topic — the exam weights them as Domain 5 questions.

## 1.6 AI/ML & application development features

Officially in scope (guide section 1.6) — not a maybe:

- **Snowflake Notebooks**: notebook-style development environment inside Snowsight (Python/SQL
  cells) running on Snowflake compute.
- **Streamlit in Snowflake**: build/host Python data apps directly inside a Snowflake account.
- **Snowpark**: write transformations in Python/Java/Scala that push down and execute inside
  Snowflake compute (not pulled client-side).
- **Snowflake Cortex**: built-in AI functions callable from SQL — **AI SQL functions** (direct
  SQL-callable LLM calls: completion, classification, translation, sentiment, summarization),
  **Cortex Search** (retrieval/search over enterprise data), **Cortex Analyst**
  (natural-language-to-SQL over a semantic model). **Naming update, worth knowing if you studied
  from older material**: Snowflake GA'd a renamed, `AI_`-prefixed set of these functions in
  November 2025 (`AI_COMPLETE`, `AI_CLASSIFY`, `AI_TRANSLATE`, `AI_SENTIMENT`,
  `AI_SUMMARIZE_AGG`, etc.), superseding the older `SNOWFLAKE.CORTEX.*`/bare
  `SUMMARIZE`/`TRANSLATE`/`SENTIMENT` naming. The exam guide may still reference the older names in
  places — know both, but treat the `AI_`-prefixed names as current.
- **Snowflake ML**: built-in ML model training/registry/feature-store capabilities inside
  Snowflake, without exporting data to a separate ML platform.

Know what each one *is* and *why it exists* at a functional level — implementation depth is
unlikely to be tested heavily given this is Core (not the Data Engineer/ML specialty tracks).

## Self-check before moving on

- [ ] Can you explain, in one sentence each, what the storage / compute / cloud-services layers
      each own?
- [ ] Can you state the Economy vs. Standard scaling-policy tradeoff in the guide's own terms
      (fully-loaded-clusters-first vs. prompt-new-cluster)?
- [ ] Can you list the six table types and which two skip Fail-safe entirely?
- [ ] Can you name all objects under "database objects" in 1.3 without missing Pipes, Sequences,
      ML models, or Applications?
- [ ] Can you name Cortex's three named sub-features (AI SQL functions, Search, Analyst)?
