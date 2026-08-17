# Cheatsheet — Key Numbers & Hard Facts

Drill this the night before and the morning of. These are the specific, memorizable facts that
show up as direct recall questions rather than scenario-reasoning questions. Cross-checked
against the official COF-C03 Exam Study Guide (verified 2026-08-13).

## Exam logistics
- 100 questions, 115 minutes, pass mark **750/1000**, $175/attempt, ~6 months Snowflake
  experience recommended.

## Editions (strict superset order)
Standard → Enterprise → Business Critical → Virtual Private Snowflake (VPS)

## Time Travel / Fail-safe
- Standard edition: **1 day** Time Travel (default; can be set to 0).
- Enterprise+: up to **90 days** Time Travel (`DATA_RETENTION_TIME_IN_DAYS`).
- Fail-safe: fixed **7 days**, after Time Travel ends, Snowflake-support-only recovery, permanent
  tables only (transient/temporary skip Fail-safe entirely).

## Table types vs. Time Travel / Fail-safe
| Type | Time Travel | Fail-safe |
|---|---|---|
| Permanent | up to edition max | 7 days |
| Transient | 0 or 1 day | none |
| Temporary | 0 or 1 day, session-scoped | none |

## Micro-partitions
- ~**50-500MB** uncompressed per micro-partition, columnar, immutable.

## Warehouse sizing
- Credits/hour roughly doubles per size step: X-Small=1, Small=2, Medium=4, Large=8, X-Large=16,
  2X-Large=32 ... up to 6X-Large.
- Billing: **per-second, 60-second minimum** per warehouse resume.

## Caching
- **Result cache**: Cloud Services layer, **24 hours**, refreshed on reuse up to **31 days** max,
  zero compute cost when hit.
- **Local/warehouse (SSD) cache**: compute layer, lost on suspend/resize.
- **Metadata cache**: Cloud Services layer, drives pruning.

## VARIANT column
- Max ~**16MB** compressed per value.

## COPY INTO / load metadata
- Load history retained **64 days** for automatic dedup/idempotency of `COPY INTO`.
- Ideal bulk-load file size: roughly **100-250MB compressed**.

## Roles (broadest → narrowest, know the hierarchy)
`ORGADMIN` (org/multi-account) → `ACCOUNTADMIN` (encompasses SYSADMIN + SECURITYADMIN) →
`SECURITYADMIN` (users/roles/grants) → `USERADMIN` (users/roles only) → `SYSADMIN` (objects like
warehouses/DBs) → custom functional roles → `PUBLIC` (everyone).

## Resource monitor actions (at threshold %)
**Notify** → **Suspend** (lets running queries finish) → **Suspend Immediately** (kills running
queries too).

## Data sharing
- Consumer's own compute is billed for querying shared data — **not** the provider's.
- Sharing requires same cloud region/provider unless replicated first.
- Reader accounts: provider creates and pays for compute (used when consumer has no Snowflake
  account of their own).

## Scaling
- **Scale up** (bigger warehouse) → speeds up one complex query.
- **Scale out** (multi-cluster, Enterprise+) → handles more concurrent queries, not faster single
  queries.
- **Standard scaling policy**: starts a new cluster promptly once queries queue (favors latency).
- **Economy scaling policy**: waits until existing clusters are fully loaded before starting
  another (favors cost, tolerates some queueing) — exact official phrasing, asked directly.

## Stored procedure execution context
- Default: **`EXECUTE AS OWNER`** — runs with the procedure owner's privileges, not the caller's
  (why a low-privilege caller can succeed via a procedure touching tables they can't query
  directly).
- **`EXECUTE AS CALLER`**: runs with the calling role's own privileges instead.

## DELETE vs TRUNCATE
- `DELETE` (even unfiltered `WHERE`-less) is a logged row-level DML op — scales with table size.
- `TRUNCATE TABLE` removes all rows as a single **metadata-only** operation — near-instant
  regardless of size. Use when clearing an entire table, not `DELETE` with no filter.

## Streams survive cloning — but lose their state
- Cloning a table/schema with a stream containing unconsumed records creates a stream
  **re-initialized at the clone point** — pending records/offset do **not** carry over.

## Query Acceleration Service (QAS) vs Search Optimization Service
- **QAS**: offloads outlier-query scan work to serverless compute, without resizing the
  warehouse — helps one disproportionately large/long query.
- **Search Optimization Service** (Enterprise+): speeds up highly selective point-lookups
  (equality/substring) on columns clustering doesn't naturally help.

## COPY INTO option to remember precisely
- **`PURGE = TRUE`**: deletes staged files after a successful load — stops file accumulation
  without touching `ON_ERROR` behavior and without forcing reloads. (`FORCE = TRUE` does the
  opposite — forces a reload.)

## Roles: account role vs. database role
- **Account role**: account-wide scope, the "normal" role.
- **Database role**: scoped to one database, can be granted to an account role — travels with
  the database (e.g. into a share or replication target).
- **Secondary roles**: a session can activate secondary roles alongside its one primary role
  (`USE SECONDARY ROLES ALL`) — effective privileges become the union of all active roles.

## Account identifiers
- **Account locator**: legacy, system-generated, region/cloud-specific.
- **Organization name + account name**: current recommended form, human-readable,
  region/cloud-independent.

## Marketplace listing terminology (current, replaces "Data Exchange")
- **Public listing**: visible to any Snowflake customer.
- **Private listing**: visible only to specifically named consumer account(s).
- **Native App**: ships running application logic into the consumer's account, not just data.
