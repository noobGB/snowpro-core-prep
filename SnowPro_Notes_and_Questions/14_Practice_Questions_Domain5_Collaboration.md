# Practice Questions — Domain 5: Data Collaboration (10%)

5 original questions covering subtopics 5.1-5.3, modeled on
[05_Domain5_Data_Collaboration.md](05_Domain5_Data_Collaboration.md). Original content, not
sourced from any exam-dump site.

---

**1.** A permanent table has `DATA_RETENTION_TIME_IN_DAYS = 5`. A row is deleted today. For how
long, and through what mechanism, can Snowflake support recover that row if the customer's own
5-day Time Travel window has already passed, assuming no one has purged it?

A. It cannot be recovered — Fail-safe only applies to transient tables
B. An additional fixed 7 days, via Snowflake Support only (the customer cannot self-serve
   this recovery)
C. An additional 90 days, self-serve via `AT`/`BEFORE` clauses
D. Indefinitely, since permanent tables never lose data

**2.** A team clones a database at 2:00 PM. At clone time, the source database is 50TB. What is
the storage cost impact of the clone at the moment it's created, before either the clone or the
source diverges?

A. The clone immediately consumes another 50TB of storage
B. The clone consumes roughly half the source's storage, ~25TB
C. The clone consumes effectively no additional storage — it's a metadata-only operation
   until either copy starts to diverge (copy-on-write)
D. The clone operation is blocked until enough storage is provisioned

**3.** A consumer account queries a table shared with them via Secure Data Sharing by a provider
account. Whose compute resources are used, and who is billed for that query?

A. The provider's compute; the provider is billed
B. The consumer's own compute; the consumer is billed
C. Neither is billed — shared data queries are always free
D. Both accounts are billed equally, split 50/50

**4.** A provider wants to share a dataset with a company that does not have its own Snowflake
account. Which mechanism lets the provider make this possible, while the provider bears the
compute cost on the recipient's behalf?

A. A public Marketplace listing
B. A reader account
C. A Native App
D. Direct sharing to a named consumer account (requires the consumer to already have an
   account)

**5.** A provider wants to distribute not just data, but an entire packaged application — logic
and UI included — that runs *inside* the consumer's own account so the consumer's underlying data
never has to leave their account. Which mechanism fits?

A. A private listing of raw tables
B. A Native App
C. A reader account
D. A secure view shared directly

---

## Answer Key & Explanations

1. **B.** Fail-safe is a fixed 7-day period after Time Travel ends, for permanent tables only,
   and is Snowflake-support-only recovery — the customer cannot query or restore it themselves.
2. **C.** Zero-copy cloning is metadata-only at creation time regardless of source size — storage
   cost only appears once the clone or original starts to diverge (copy-on-write), which is why
   cloning a 50TB database is still instant.
3. **B.** The consumer queries shared data using their own warehouse/compute — the provider is
   never billed for consumer query activity, only for their own usage and (if applicable) storage.
4. **B — A reader account.** Purpose-built for consumers without their own Snowflake account; the
   provider creates and pays for the reader account's compute on the recipient's behalf.
5. **B — A Native App.** Distinct from a plain listing (which shares data access) because it
   ships running application logic/UI that executes inside the consumer's own account, keeping
   their data in place.
