# Practice Questions — Domain 2: Account Management & Data Governance (20%)

10 original questions covering subtopics 2.1-2.3, modeled on
[02_Domain2_Account_Mgmt_and_Governance.md](02_Domain2_Account_Mgmt_and_Governance.md). Original
content, not sourced from any exam-dump site.

---

**1.** A newly created custom role `DATA_ANALYST` needs to be usable by warehouses and databases
created by the platform team. Following Snowflake best practice, which system-defined role should
`DATA_ANALYST` be granted to, so administrative visibility is retained?

A. `ACCOUNTADMIN` directly
B. `SYSADMIN`
C. `SECURITYADMIN`
D. `PUBLIC`

**2.** Which system-defined role is responsible for creating and managing users and roles, but
does **not**, by itself, manage warehouses or databases?

A. `SYSADMIN`
B. `SECURITYADMIN`
C. `USERADMIN`
D. `ORGADMIN`

**3.** Snowflake's access control model lets the *owner* of a securable object decide who else
gets access to it via grants, rather than a central authority making that decision. What is this
model called?

A. Mandatory Access Control (MAC)
B. Role-Based Access Control (RBAC) exclusively
C. Discretionary Access Control (DAC)
D. Attribute-Based Access Control (ABAC)

**4.** A service account used by an automated ETL job needs to authenticate without a password
and without any interactive login step. Which authentication method fits best?

A. Multi-Factor Authentication (MFA)
B. Key-pair authentication
C. Federated Authentication / SSO
D. A network policy

**5. (Select TWO)** Which two of the following are valid reasons to use a **database role**
instead of a standard account role?

A. Database roles can be granted privileges scoped to objects within a single database only
B. Database roles are automatically activated as secondary roles for every session
C. Database roles can travel with a database into a share or a replication target
D. Database roles replace the need for `USERADMIN` entirely

**6.** A session's primary role is `ANALYST`, but the user also needs simultaneous access granted
to role `REPORTING_VIEWER` within the same session, without switching roles mid-session. Which
feature enables this?

A. Discretionary Access Control
B. Secondary roles (`USE SECONDARY ROLES ALL`)
C. A network policy scoped to both roles
D. Object tagging

**7.** A finance team wants Social Security Numbers to display in full for the `PII_ADMIN` role
but masked (e.g. `XXX-XX-1234`) for every other role querying the same column, without
maintaining two copies of the data. Which feature fits?

A. A row access policy
B. Dynamic Data Masking (a masking policy)
C. Object tagging
D. A privacy (aggregation) policy

**8.** A governance team wants to guarantee that any query against a sensitive table can only
return aggregated results above a minimum group size — never individual row-level detail —
regardless of how a caller writes their query. Which feature is designed for exactly this?

A. A masking policy
B. A row access policy
C. A privacy (aggregation) policy
D. Object tagging

**9.** A resource monitor is configured with three threshold actions as credit usage rises.
Which of the following correctly orders the actions from least to most disruptive to already
*running* queries?

A. Suspend Immediately → Suspend → Notify
B. Notify → Suspend → Suspend Immediately
C. Suspend → Notify → Suspend Immediately
D. Notify → Suspend Immediately → Suspend

**10.** An analyst wants to investigate which warehouse and user drove the highest credit
consumption over the last 30 days. Which source should they query, and what tradeoff should they
be aware of?

A. `INFORMATION_SCHEMA`, which is real-time but has a very limited retention window
B. `ACCOUNT_USAGE` views such as `WAREHOUSE_METERING_HISTORY`, which cover longer history
   but can lag by hours
C. Resource monitors, which store no historical data at all
D. Query Profile, which only shows data for a single query at a time

---

## Answer Key & Explanations

1. **B — `SYSADMIN`.** Best practice grants custom/functional roles up to `SYSADMIN` (owner of
   warehouses/databases/most objects) rather than directly to `ACCOUNTADMIN`, so admins retain
   visibility and control without over-privileging the custom role.
2. **C — `USERADMIN`.** Dedicated to users/roles only; `SYSADMIN` owns objects like warehouses/
   databases, and `SECURITYADMIN` (which inherits `USERADMIN`) additionally manages broader
   grants.
3. **C — Discretionary Access Control (DAC).** Snowflake's model: object owners decide who else
   gets access. RBAC describes *how* privileges are grouped (via roles), DAC describes *who
   decides* to grant them.
4. **B — Key-pair authentication.** No password, no interactive/MFA step required — the standard
   choice for service/programmatic accounts.
5. **A and C.** Database roles are scoped to a single database (A) and can be granted to an
   account role, letting them travel with the database into a share or replication target (C).
   They are not auto-activated as secondary roles (B) and have nothing to do with replacing
   `USERADMIN` (D).
6. **B — Secondary roles.** `USE SECONDARY ROLES ALL` activates additional roles alongside the
   one primary role, so the session's effective privileges are the union of all active roles.
7. **B — Dynamic Data Masking.** A masking policy on the column shows different results to
   different roles at query time, with a single underlying copy of the data — exactly the
   scenario described.
8. **C — A privacy (aggregation) policy.** Distinct from masking (which alters what a column
   shows) and row access policies (which restrict which rows are visible) — an aggregation
   policy enforces a *minimum group size* on results regardless of query shape.
9. **B — Notify → Suspend → Suspend Immediately.** Notify only alerts; Suspend lets running
   queries finish but blocks new ones; Suspend Immediately kills running queries too — increasing
   severity in that order.
10. **B.** `ACCOUNT_USAGE` views like `WAREHOUSE_METERING_HISTORY` are the right source for
    historical credit analysis, but come with latency (up to hours, sometimes longer depending on
    the view) versus `INFORMATION_SCHEMA`'s real-time-but-short-retention data.
