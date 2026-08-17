# Official Sample Questions — Analysis

The official COF-C03 study guide includes 5 sample questions. Their real value isn't the specific
answers — it's the *question style*: scenario-based, testing precise mechanics rather than
definitions, often with plausible-sounding wrong answers that are subtly off. Study the pattern,
not just the facts.

## Q1 — Stored procedure execution context

**Scenario**: A procedure queries a restricted table. The caller's role only has `EXECUTE` on the
procedure, not `SELECT` on the underlying table — but it works anyway, because by default a
procedure runs with the **owner's** privileges. Requirement: make it fail for callers lacking
direct `SELECT`.

**Answer**: Re-create the procedure with **`EXECUTE AS CALLER`**.

**Concept to know**: stored procedures default to **`EXECUTE AS OWNER`** — they run with the
privileges of whoever *owns* the procedure, not whoever calls it. This is why a low-privilege
caller can successfully run a procedure that touches tables they can't query directly — the
procedure's owner-level access is what's actually being used. Declaring `EXECUTE AS CALLER`
flips this so the procedure runs with the *calling* role's own privileges instead. Not in the
Domain 2 file's original draft — added there now under RBAC.

## Q2 — Cloning a schema with an unconsumed stream

**Scenario**: Clone a schema containing a table + a stream with thousands of unconsumed change
records. The stream in the clone returns zero records.

**Answer**: A cloned stream is **initialized at the point of cloning** — it does not inherit the
original's pending records or offset.

**Concept to know**: covered in [Domain 5](05_Domain5_Data_Collaboration.md) and
[Domain 3](03_Domain3_Data_Loading_Unloading_Connectivity.md). Don't assume cloning is a perfect
snapshot of *everything* — object structure clones, but a stream's change-tracking state resets.

## Q3 — Multi-cluster scaling policy

**Scenario**: Occasional short query queueing is *acceptable*; the priority is minimizing active
cluster count (cost).

**Answer**: **Economy** — waits until existing clusters are fully loaded before starting an
additional cluster.

**Concept to know**: Standard prioritizes low latency (starts new clusters promptly on any
queueing); Economy prioritizes cost (tolerates some queueing, starts clusters later). Match the
policy to which side of the latency/cost tradeoff the scenario says is acceptable — the exam
tests this by describing the acceptable tradeoff, not by naming the policy.

## Q4 — Fast full-table cleanup

**Scenario**: A nightly `DELETE FROM staging_table` (no `WHERE`) has grown slow as the table
grew. `DATA_RETENTION_TIME_IN_DAYS = 0`, Time Travel not needed.

**Answer**: **`TRUNCATE TABLE`** — removes all rows as a single metadata operation instead of
row-by-row deletion.

**Concept to know**: `DELETE` (even unfiltered) is logged as a row-level DML operation and scales
with table size; `TRUNCATE TABLE` just drops the data via metadata (near-instant regardless of
size). Distractors to recognize: `DROP`+`CREATE` loses grants/settings on the table and is not
"the same object" afterward; a clustering key doesn't help a full-table delete since there's no
filter to prune on; batching by a `WHERE` clause on a date column is strictly slower than
`TRUNCATE` when you're removing *everything* anyway.

## Q5 — Stopping stage file accumulation in `COPY INTO`

**Scenario**: A nightly `COPY INTO` from a named internal stage never removes already-loaded
files; need one option that stops accumulation without changing error handling or causing
reloads.

**Answer**: **`PURGE = TRUE`**.

**Concept to know**: already in [Domain 3](03_Domain3_Data_Loading_Unloading_Connectivity.md).
Distractors: `FORCE = TRUE` would cause *reloading*, the opposite of what's wanted; `ON_ERROR =
SKIP_FILE` changes error handling, which the scenario explicitly rules out; `AUTO_INGEST` is a
Snowpipe/pipe-object setting, not a `COPY INTO` option at all.

## Pattern takeaway for your remaining study time

Every one of these 5 questions hinges on a **specific mechanism**, not a surface-level definition
— default execution context of a stored procedure, exact state-reset behavior of a cloned stream,
the precise tradeoff a scaling policy makes, the operational difference between `DELETE` and
`TRUNCATE`, and one exact `COPY INTO` option among several plausible-looking ones. When you hit a
practice question you get wrong, ask "what's the underlying mechanism I didn't actually know,"
not just "what was the right letter" — that's what separates a passing score from a comfortable
one on this exam.
