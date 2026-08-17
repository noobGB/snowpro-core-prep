# Domain 5 — Data Collaboration (10%)

**Verified against the official Snowflake COF-C03 Exam Study Guide** — follows guide sections
5.1-5.3. Smallest domain by weight, but note it's *where the official guide files* Cloning, Time
Travel, and Fail-safe (not under Architecture) — don't under-study this section just because it
looks small.

## 5.1 Data collaboration and protection

- **Cloning (zero-copy clone)**: `CREATE TABLE/SCHEMA/DATABASE ... CLONE ...`. Metadata-only
  operation at clone time — instant regardless of source size, no extra storage consumed until
  either the clone or the original diverges (copy-on-write). **Gotcha**: cloning a schema/table
  that contains a **stream** with unconsumed change records creates a stream re-initialized *at
  the point of cloning* — pending records from the original do **not** carry over to the clone
  (a documented official sample-question scenario; see
  [09_Official_Sample_Questions_Analysis.md](09_Official_Sample_Questions_Analysis.md)).
- **Time Travel**: query/restore historical data via `AT`/`BEFORE` clauses and `UNDROP`. Default
  1 day on Standard edition, configurable up to 90 days on Enterprise+
  (`DATA_RETENTION_TIME_IN_DAYS`). Applies to tables, schemas, databases.
- **Fail-safe**: additional fixed **7-day** period *after* Time Travel ends, Snowflake-support-
  only recovery (you cannot query/restore it yourself). Permanent tables only — transient and
  temporary tables skip Fail-safe entirely. Sequence: live data → Time Travel (0/1 up to 90 days)
  → Fail-safe (7 days, permanent tables only) → purged.
- **Data replication and failover**: replicate databases/accounts across regions for disaster
  recovery (Business Critical+); **failover** promotes a secondary to primary. See also
  [Domain 2](02_Domain2_Account_Mgmt_and_Governance.md) for the account-management framing of the
  same feature.
- **Secure data sharing features**: see 5.2 below — the umbrella term for everything that follows.

## 5.2 Snowflake's data sharing capabilities

- **Secure Data Sharing** — the core mechanism: a **provider** account shares *live, read-only*
  access to database objects with a **consumer** account, with zero data copying/movement. The
  consumer queries the provider's storage directly using their **own compute** — the consumer's
  warehouse is billed for their queries, not the provider's. Changes on the provider side are
  visible to the consumer instantly. Only works within the same cloud region/provider unless the
  share is replicated first.
- **Accounts involved**:
  - **Provider**: creates the Share object, grants `USAGE`/`SELECT`, adds consumer accounts.
  - **Consumer**: gets a read-only database created from the inbound share, queries it like any
    other database.
  - **Reader accounts**: a special account type a provider creates and *pays the compute for*,
    on behalf of a consumer who has no Snowflake account of their own.
- **Sharing and resharing**: a consumer with appropriate privileges can, in some configurations,
  **reshare** data they've received onward to a further consumer — know this is possible and
  governed by the same grant/privilege model, not an automatic default.
- **Direct shares**: the straightforward provider→specific-named-consumer-account sharing pattern
  (as opposed to publishing broadly via a Marketplace listing) — the baseline mechanism before
  you add Marketplace/listing distribution on top.
- **Secure views / secure UDFs**: prefer these over sharing raw tables when the share should
  expose a filtered/masked/derived subset — the view definition itself is hidden from the
  consumer, preventing reverse-engineering the underlying logic or leaking rows via crafted
  queries.
- **Data Clean Rooms**: privacy-preserving joint analysis pattern — two parties run combined
  analysis without either seeing the other's raw rows, built on secure views/UDFs plus strict
  governance. Awareness-level only, given the domain's overall 10% weight.

## 5.3 Snowflake Marketplace and listings

- **Snowflake Marketplace**: the public marketplace where providers publish **listings**,
  discoverable and directly queryable by any Snowflake consumer with zero data movement.
- **Listings** — two visibility types (this is the guide's own terminology; supersedes the older
  "Data Exchange" branding):
  - **Public listings**: visible to any Snowflake customer via the Marketplace.
  - **Private listings**: visible only to specifically named consumer account(s) — the
    invite-only equivalent, for sharing within a company or a defined consortium.
  - Paid listings integrate with Snowflake billing so consumers can be charged for access.
- **Native Apps**: applications a provider builds and distributes *through the Marketplace*,
  which run entirely inside the consumer's own account (their compute, their data never leaves)
  — distinct from a plain data listing because it ships logic/UI, not just data.

## Self-check before moving on

- [ ] Can you state, precisely, whose compute is billed when a consumer queries shared data?
- [ ] Can you explain what happens to a stream's pending records across a clone, and why?
- [ ] Can you state Time Travel's default/max retention and how Fail-safe differs (duration,
      who can restore it, which table types skip it)?
- [ ] Can you distinguish a public listing, a private listing, and a Native App by what each one
      actually distributes (data access vs. running application)?
- [ ] Can you explain why a provider would use a secure view instead of sharing a table directly?
