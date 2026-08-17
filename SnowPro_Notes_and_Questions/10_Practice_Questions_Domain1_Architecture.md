# Practice Questions — Domain 1: Architecture & Features (31%)

15 original questions, written to mirror the official exam guide's sample-question style
(scenario-based, one precise mechanism per question) and covering subtopics 1.1-1.6. **Not**
sourced from any exam-dump site — these are original, modeled on the verified domain notes in
[01_Domain1_Architecture_and_Features.md](01_Domain1_Architecture_and_Features.md).

Take this closed-book, timed if possible (roughly 1.1 min/question = ~17 min for all 15), then
check the answer key at the bottom. Log your score in
[06_Practice_Exam_Tracker.md](06_Practice_Exam_Tracker.md).

---

**1.** A company needs their Snowflake data encrypted with a key they manage themselves, layered
on top of Snowflake's own encryption, and also needs HIPAA compliance support. Which is the
*minimum* edition that satisfies both requirements?

A. Standard
B. Enterprise
C. Business Critical
D. Virtual Private Snowflake (VPS)

**2.** Which Snowflake layer is responsible for query parsing, optimization, and access control
enforcement, and runs on infrastructure the customer does not directly provision or size?

A. Database Storage layer
B. Query Processing (Compute) layer
C. Cloud Services layer
D. Virtual warehouse layer

**3.** A team wants multiple business units to run large, independent workloads against the same
underlying tables at the same time, with zero contention between them and no need to duplicate
data. Which architectural property of Snowflake most directly enables this?

A. Micro-partition immutability
B. Shared storage with independent per-warehouse compute
C. The result cache
D. Time Travel

**4.** A developer wants to write and run SQL directly against a Snowflake account from within
their existing code editor, without switching to a browser. Which tool best fits?

A. Snowsight
B. Snowflake CLI only
C. An IDE integration such as the official VS Code extension
D. SnowSQL exclusively, since no editor integration exists

**5.** A session sets a parameter with `ALTER SESSION SET STATEMENT_TIMEOUT_IN_SECONDS = 300`,
while the account-level default is 3600 seconds. For the duration of that session, which value
is in effect, and why?

A. 3600 seconds, because account-level settings always override session-level settings
B. 300 seconds, because the most specific level set (session) takes precedence over the
   account default
C. Neither — parameter conflicts cause the session to fail
D. 3600 seconds, because session-level parameters only apply to warehouses, not statements

**6.** Which of the following is **not** one of the database object types explicitly listed in
the object hierarchy (Domain 1.3) alongside Tables, Views, and Stages?

A. Sequences
B. Pipes
C. Resource Monitors
D. ML models

**7.** A workload runs memory-intensive Snowpark Python transformations that regularly spill to
disk on a Standard Gen 2 warehouse of adequate size. Which warehouse type is purpose-built to
reduce this kind of spilling for memory-heavy workloads?

A. A larger Standard Gen 1 warehouse
B. A Snowpark-Optimized warehouse
C. A multi-cluster Standard warehouse in Economy mode
D. The default warehouse for Notebooks

**8.** A team wants queries to queue as little as possible during unpredictable concurrency
spikes, and cost is a secondary concern. Which multi-cluster scaling policy should they choose?

A. Economy, because it minimizes the number of active clusters
B. Standard, because it starts new clusters promptly once queries begin queueing
C. Economy, because it always keeps every configured cluster running
D. Neither — scaling policies only apply to single-cluster warehouses

**9.** Which table type allows Snowflake to act as a query and write engine over data stored in
an open, externally-manageable table format that other engines can also read?

A. Transient
B. External
C. Apache Iceberg
D. Dynamic

**10.** A team wants a table that behaves like the result of a query — automatically kept in
sync by Snowflake without them writing or scheduling any refresh logic themselves — but they are
not on an edition that supports Materialized Views. Which storage/table feature (covered under
automated ingestion in Domain 3) fits this need?

A. A standard view
B. A Dynamic Table
C. A Transient table
D. A Secure view

**11.** Why would a data provider define a **Secure View** on a table instead of sharing the
table directly?

A. Secure views load data faster than base tables
B. Secure views hide the view's definition from viewers without privilege to see it,
   preventing logic reverse-engineering or row leakage via crafted queries
C. Secure views are required before Time Travel can be enabled
D. Secure views automatically encrypt data with a customer-managed key

**12.** Which Snowflake Cortex sub-feature is specifically built for natural-language-to-SQL
querying over a defined semantic model?

A. Cortex Search
B. AI SQL functions
C. Cortex Analyst
D. Snowflake ML

**13.** A developer wants to train and register a machine learning model, and manage its
lifecycle (features, training, registry) without exporting data out of Snowflake to a separate ML
platform. Which feature covers this?

A. Snowpark
B. Snowflake ML
C. Streamlit in Snowflake
D. Cortex Search

**14.** A table has `DATA_RETENTION_TIME_IN_DAYS = 0` and no clustering key defined. Roughly how
large is each of its micro-partitions expected to be, uncompressed?

A. 1-10MB
B. 50-500MB
C. 1-5GB
D. Exactly 128MB, fixed by Snowflake

**15.** Which edition is the first (lowest) at which multi-cluster warehouses and materialized
views become available?

A. Standard
B. Enterprise
C. Business Critical
D. Virtual Private Snowflake (VPS)

---

## Answer Key & Explanations

1. **C — Business Critical.** Tri-Secret Secure (customer-managed key) and HIPAA/PCI support are
   both Business Critical+ features; Enterprise alone doesn't include either.
2. **C — Cloud Services layer.** Parsing, optimization, and access control all live here, on
   Snowflake-managed compute the customer never sizes or sees directly.
3. **B — Shared storage with independent per-warehouse compute.** This is Snowflake's core
   architectural differentiator: one copy of data, but each virtual warehouse gets its own
   compute, so concurrent workloads don't contend.
4. **C — An IDE integration such as the official VS Code extension.** Snowsight is browser-based;
   Snowflake CLI is terminal-based; the VS Code extension is the fit for in-editor SQL.
5. **B — 300 seconds.** Parameter precedence: the most specific level set (session, here) wins
   over the account default.
6. **C — Resource Monitors.** Resource monitors are an account-level cost-management object
   (Domain 2), not one of the database objects listed under 1.3 (Stages, Schemas, Tables, Views,
   UDFs, File formats, Stored procedures, Pipes, Shares, Sequences, ML models, Applications).
7. **B — A Snowpark-Optimized warehouse.** Purpose-built with extra memory per node for
   memory-intensive Snowpark/ML workloads, reducing spill compared to a same-sized Standard
   warehouse.
8. **B — Standard.** Standard scaling policy starts new clusters promptly once queueing begins,
   prioritizing latency over cost — the opposite tradeoff from Economy.
9. **C — Apache Iceberg.** Iceberg tables let Snowflake read/write an open table format other
   engines can also access, distinct from External tables (metadata-only pointer, no write
   interoperability in the same sense) or Dynamic tables (declarative transformation output).
10. **B — A Dynamic Table.** Dynamic Tables give automatic, declarative refresh based on a target
    lag without hand-written stream/task orchestration, and are available independent of
    Materialized View edition gating.
11. **B.** Secure views specifically hide the view definition and prevent query-based data
    leakage — the standard reason to prefer them for shared or sensitive-derived data. (Not a
    performance feature, not required for Time Travel, and encryption is automatic/unrelated to
    view security.)
12. **C — Cortex Analyst.** Cortex Analyst is the natural-language-to-SQL-over-semantic-model
    feature; Cortex Search is retrieval/search, AI SQL functions are direct SQL-callable LLM
    functions (e.g. summarize, translate).
13. **B — Snowflake ML.** Purpose-built for in-platform model training/registry/feature-store
    without exporting data; Snowpark is the general compute-pushdown execution framework it's
    often built on top of, not the ML lifecycle feature itself.
14. **B — 50-500MB.** Standard micro-partition size range, regardless of retention/clustering
    settings.
15. **B — Enterprise.** Both multi-cluster warehouses and materialized views are Enterprise+
    features, not available on Standard.
