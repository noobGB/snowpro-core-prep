# Domain 2 — Account Management & Data Governance (20%)

**Verified against the official Snowflake COF-C03 Exam Study Guide** — follows guide sections
2.1-2.3.

## 2.1 Security model & principles

- **RBAC**: privileges → roles → users (or role→role). Users never hold privileges directly.
- **Securable object hierarchy**: every object (warehouse, database, schema, table, etc.) is a
  securable, nested under its parent container; privileges can be granted at any level and
  inherited via role grants, not object nesting.
- **Discretionary Access Control (DAC)**: the underlying model — each securable object has an
  **owner** (a role), and that owner decides who else gets access via grants. Contrast with
  mandatory access control (a central authority decides) — Snowflake is DAC, ownership-driven.
- **Network Policies**: IP allow/block lists (CIDR ranges), account-wide or per-user.
- **Authentication**: password, **MFA** (Duo-based), **Federated Authentication** / **SSO**
  (SAML2 with an external IdP), **OAuth** (Snowflake OAuth or external OAuth), **key-pair
  authentication** (common for service/programmatic accounts, no password).
- **System-defined roles** (broadest → narrowest): `ORGADMIN` → `ACCOUNTADMIN` (encompasses
  `SYSADMIN` + `SECURITYADMIN`) → `SECURITYADMIN` (users/roles/grants, inherits `USERADMIN`) →
  `USERADMIN` (users/roles only) → `SYSADMIN` (warehouses/DBs/most objects) → `PUBLIC` (implicit,
  everyone).
- **Functional roles** — three distinct kinds, don't conflate them:
  - **Account roles**: traditional roles, account-wide scope, hierarchical (what "roles" usually
    means unless stated otherwise).
  - **Database roles**: scoped *to a single database*, can be granted privileges on objects
    within that database only, and can in turn be granted to account roles — useful for
    packaging database-specific access that travels with the database (e.g. into a share or
    another account via replication).
  - **Custom roles**: any role you define beyond the system-defined set, typically named for a
    function (`DATA_ENGINEER`, `ANALYST_READONLY`) and granted up to `SYSADMIN`.
- **Secondary roles**: a session has exactly one *primary* role active, but can additionally
  activate **secondary roles** (`USE SECONDARY ROLES ALL`) so the session's *effective* privilege
  set is the union of primary + all secondary roles — useful when a user needs combined access
  from multiple roles in one session without switching.
- **Account identifiers**: an account can be referenced by its **account locator** (system-
  generated, region/cloud-specific, legacy) or by **organization name + account name** (the
  current recommended, human-readable, cloud/region-independent form) — know that the
  org.account form is preferred for connection strings, URLs, replication.
- **Logging and tracing**: Snowflake supports structured **logging** (`log.info`, etc.) and
  **tracing** (OpenTelemetry-style event/span data) emitted from handlers (stored procs, UDFs,
  Native Apps) into an **event table**, queryable like any other table — this is Snowflake's
  observability mechanism for code running inside the platform.

## 2.2 Data governance features

- **Data masking**: **column-level security** via masking policies (same column shows differently
  depending on querying role) and **row-level security** via row access policies (restricts which
  rows a role can see). Both are policy objects attached to columns/tables, evaluated at query
  time, no data duplication.
- **Object tagging**: key-value tags on almost any object (databases, schemas, tables, columns,
  warehouses, users, roles...) for classification/cost-attribution/governance.
  - `CREATE TAG <name> ALLOWED_VALUES 'a', 'b', ...` — optional enum-style constraint; verified
    hands-on that Snowflake genuinely rejects an out-of-list value at assignment time
    (`ALTER TABLE ... MODIFY COLUMN ... SET TAG <tag> = '<value>'`), not just a suggestion.
  - Discoverable programmatically via `INFORMATION_SCHEMA.TAG_REFERENCES(...)` / the
    `ACCOUNT_USAGE.TAG_REFERENCES` view — how a compliance process finds "every column tagged
    CONFIDENTIAL" without knowing in advance which tables have PII.
  - **Tag-based masking** — the real scale lever: `ALTER TAG <tag> SET MASKING POLICY <policy>`
    attaches a masking policy to the *tag itself*, not to any specific column. Verified hands-on:
    a column tagged after the fact inherited the masking behavior automatically, with the
    column's own masking-policy attachment never touched directly — classify once, governance
    rule applies everywhere that classification is used, including columns tagged later.
- **Privacy policies**: policy objects (e.g. aggregation policies, projection policies) that
  enforce privacy-preserving query patterns — for example, requiring queries against a sensitive
  table to return only aggregated results above a minimum group size, rather than row-level
  detail, regardless of how the query is written.
- **Trust Center**: a Snowsight security-posture dashboard — surfaces scanner findings and
  security risks/recommendations across the account in one place.
- **Encryption key management**: all data encrypted at rest/in transit by default on every
  edition; automatic key rotation; **Tri-Secret Secure** (Business Critical+) layers a
  customer-managed key on top of Snowflake's own key.
- **Alerts**: `CREATE ALERT` objects — a scheduled SQL condition check that fires an action
  (e.g. send a notification) when true, useful for data-quality or threshold monitoring.
- **Notifications**: **Notification Integrations** — configured channels (email, cloud
  messaging/webhooks) that alerts, tasks, or other Snowflake events can push to.
- **Data replication and failover**: replicate databases (or entire accounts) across
  regions/accounts for disaster recovery (Business Critical+); **failover** promotes a secondary
  to primary. Full mechanics/consumer-facing implications are also covered under
  [Domain 5](05_Domain5_Data_Collaboration.md).
- **Data lineage**: Snowsight automatically tracks and visualizes object-to-object dependencies
  (which tables/views feed which downstream objects) — no manual instrumentation required.

## 2.3 Monitoring and cost management

- **Resource monitors**: track credit usage against a quota for one or more warehouses; threshold
  actions in order of severity: **Notify** → **Suspend** (running queries finish, no new ones
  start) → **Suspend Immediately** (running queries killed too).
- **Calculating virtual warehouse credit usage**: credits = warehouse size's per-hour rate ×
  hours run (billed per-second, 60s minimum per resume); multi-cluster warehouses multiply this
  by however many clusters were actually running, not just the max configured.
- **`ACCOUNT_USAGE` schema**: system database views (e.g. `WAREHOUSE_METERING_HISTORY`,
  `QUERY_HISTORY`, `LOGIN_HISTORY`) for historical account activity/cost analysis — note it has
  **latency** (data can lag up to ~2 hours to 3 days depending on the view) versus
  `INFORMATION_SCHEMA`, which is real-time but only covers a limited retention window.

## Self-check before moving on

- [ ] Can you explain the difference between an account role and a database role, and why you'd
      use a database role specifically?
- [ ] Can you explain what secondary roles let a session do that a single primary role can't?
- [ ] Can you name the two forms of account identifier and which is currently recommended?
- [ ] Can you distinguish a masking policy, a row access policy, and a privacy (aggregation)
      policy in one sentence each?
- [ ] Can you name the three resource-monitor threshold actions in severity order?
