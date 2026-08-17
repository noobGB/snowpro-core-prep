# Hands-On Snowflake Environment Setup Log

A chronological, tutorial-quality record of setting up local tooling (Snowflake CLI, later MCP)
against a real Snowflake trial account for hands-on SnowPro Core practice. Kept separate from
`technical_notes.md` (which logs scattered cross-project gotchas for this machine) because this
one has a specific second purpose: **seed material for the possible future open-source project**
— a Docker-based frontend that helps anyone set up this same environment to study for SnowPro
Core. See memory `project_snowpro_study_platform_idea.md` for that idea's status (not started).

Append new steps here in order as we go, don't rewrite history — this is meant to read like an
actual setup journey, mistakes and all, since that's exactly what a future onboarding flow needs
to anticipate.

## Status

- [x] Snowflake CLI installed and current
- [x] Bootstrap connection (password auth, `ACCOUNTADMIN`) working
- [x] Scoped sandbox role/warehouse/database created
- [x] Key-pair authentication generated and registered
- [x] Scoped, key-pair-based connection created for day-to-day use — **`claude_sandbox`
      is now the connection to use for everything going forward, not `snowpro_trial`**
- [x] Bootstrap connection's plaintext password removed once no longer needed
- [x] Recurring encoding-mismatch warning root-caused and fixed
- [x] MCP server object created in Snowflake (`CLAUDE_SANDBOX_MCP`, `SYSTEM_EXECUTE_SQL` tool only)
- [x] PAT generated (run directly by hand, not scripted)
- [x] Claude Code `.claude.json` entry added, connection + auth + network policy all verified working
- [x] **Blocked**: Cortex Agent (which MCP tool execution routes through) is unavailable on
      trial-tier Snowflake accounts — confirmed via Snowflake's own error code, not a config
      issue. MCP setup is complete and correct; tool *calls* just can't succeed on this account
      tier. Use the CLI (`claude_sandbox`) for all hands-on work until/unless this changes.

## Step 1 — Check for an existing Snowflake CLI install, don't assume

Ran `snow --version` before doing anything else and found `snow` already installed
(v3.10.0) — worth checking, since a stale existing install is easy to miss. Also checked for an
existing connection (`snow connection list`) and found one already configured from an earlier
trial signup (different account than the one we ended up using — worth watching for on a machine
that's been used for more than one trial).

## Step 2 — Verify the installed version against latest, don't trust an existing install

Checked PyPI/GitHub for the current release and found the installed 3.10.0 was **14 minor
versions behind** the actual latest (3.24.1, released one week earlier). This is now a standing
practice (see memory `feedback_verify_tool_versions.md`) — always check an installed tool's
version against the current release before relying on it, especially for a vendor that ships as
fast as Snowflake does.

**Install method matters for how you upgrade**: this machine's `snow` was installed via
Snowflake's **standalone Windows installer** (`C:\Program Files\Snowflake CLI\snow.exe`, bundling
its own Python runtime), not pip — this is the method Snowflake's own docs recommend for Windows.
`pip install --upgrade` does nothing for this kind of install; the fix is re-downloading and
re-running the latest installer from
`https://sfc-repo.snowflakecomputing.com/snowflake-cli/index.html`. Since it's a GUI installer,
it has to be run interactively by a human — it can't be scripted from a non-interactive shell
tool. After reinstalling, `snow --version` confirmed 3.24.1.

Also worth noting: the CLI's config file doesn't live where Snowflake's own docs describe as the
cross-platform default (`~/.snowflake/connections.toml`) — on this machine it was actually at
`C:\Users\<YOUR_USERNAME>\AppData\Local\snowflake\config.toml`. Found via `snow --info`'s
`default_config_file_path` field, not by trusting the docs-stated path. General lesson that
turned out to matter a lot later (see Step 7b): always check `snow --info` for the CLI's actual
current config path rather than assuming it matches documentation.

## Step 3 — Derive connection parameters from the trial account's URL

Snowflake gave a dedicated account URL on trial signup:
`https://<YOUR_ACCOUNT_IDENTIFIER>.snowflakecomputing.com`. This URL format (`<org>-<account>.
snowflakecomputing.com`, no region/cloud segment) is the **current recommended account
identifier format** — meaning the account identifier to use everywhere (CLI, connector, MCP
config) is exactly `<YOUR_ACCOUNT_IDENTIFIER>`, taken straight from the URL. (The older format embeds
region/cloud directly in the hostname instead — that's the legacy locator style, not what a new
trial account uses.)

## Step 4 — Walk through `snow connection add` (interactive wizard)

Ran `snow connection add` and answered each prompt as follows, with reasoning:

| Prompt | Value used | Why |
|---|---|---|
| Connection name | `snowpro_trial` | Arbitrary local label, just needs to be memorable — not sent to Snowflake. |
| Account name | `<YOUR_ACCOUNT_IDENTIFIER>` | Derived directly from the trial URL (see Step 3). |
| Username | (the login username chosen at trial signup) | Not derivable — check the Snowflake welcome email or trial signup form; often not the same as the signup email address. |
| Role | `ACCOUNTADMIN` | **Bootstrap-only choice.** On a brand-new trial account, nothing custom exists yet — `ACCOUNTADMIN` is the only role guaranteed to exist and be granted to the initial user. Not meant for ongoing use (see Step 6). |
| Warehouse | `COMPUTE_WH` | Every new Snowflake account auto-provisions this default X-Small warehouse. Also bootstrap-only. |
| Database / Schema | left blank (fallback: `SNOWFLAKE_SAMPLE_DATA` / `TPCH_SF1`) | A fresh trial account has no writable database yet — only the system `SNOWFLAKE` database and the read-only `SNOWFLAKE_SAMPLE_DATA` share. |
| Host | left blank | Derived automatically from the account identifier. |
| Port | left blank (default 443) | Standard HTTPS. |
| Protocol | left blank (default `https`) | Snowflake is always HTTPS. |
| Region | left blank | **Legacy field only**, for the older locator-style hostnames. Not applicable to the current org-account URL format — setting it could cause the CLI to build the wrong hostname. |
| Authenticator | `snowflake` | Standard username/password, since key-pair auth wasn't set up yet at this point. |
| Workload identity provider | left blank | For Workload Identity Federation — only applies when the CLI runs *inside* a recognized cloud workload (AWS/Azure/GCP/GitHub Actions) that can present its own identity token. A local Windows machine doesn't qualify. |
| Private key file | left blank | Only used when authenticator is `snowflake_jwt` (key-pair auth) — not this bootstrap connection. |

## Step 5 — Test the connection

`snow connection test -c snowpro_trial` returned `Status: OK`, confirming end-to-end connectivity
(host `<YOUR_ACCOUNT_IDENTIFIER>.snowflakecomputing.com`, role `ACCOUNTADMIN`, warehouse `COMPUTE_WH`,
database `SNOWFLAKE_SAMPLE_DATA`).

Two non-blocking things surfaced, worth tracking for a future onboarding flow to handle cleanly:
- Running `snow connection test` with **no** `-c` flag errors with `Connection default is not
  configured` — expected once more than one named connection exists; either always pass `-c`
  explicitly, or set one connection as default with `snow connection set-default`.
- A `UserWarning: Encoding mismatch detected` appeared on every `snow` invocation on this machine
  (suggested fix: `snow helpers detect-encoding`) — didn't block anything, not yet root-caused.

## Step 6 — Provision a scoped sandbox (least-privilege, not `ACCOUNTADMIN`)

Using the bootstrap connection once, created a dedicated role/warehouse/database so day-to-day
work never runs as `ACCOUNTADMIN`:

```sql
-- Dedicated role for Claude Code / automated work
CREATE ROLE IF NOT EXISTS CLAUDE_SANDBOX;
GRANT ROLE CLAUDE_SANDBOX TO USER <YOUR_USERNAME>;
GRANT ROLE CLAUDE_SANDBOX TO ROLE SYSADMIN;  -- keeps admin visibility, standard RBAC practice

-- Small, fast-auto-suspending warehouse so trial credits aren't burned sitting idle
CREATE WAREHOUSE IF NOT EXISTS CLAUDE_SANDBOX_WH
  WAREHOUSE_SIZE = 'XSMALL'
  AUTO_SUSPEND = 60
  AUTO_RESUME = TRUE
  INITIALLY_SUSPENDED = TRUE;
GRANT USAGE, OPERATE ON WAREHOUSE CLAUDE_SANDBOX_WH TO ROLE CLAUDE_SANDBOX;

-- Dedicated database, fully owned by the sandbox role so it can freely create/drop
-- tables, streams, tasks, etc. for practice without touching anything else
CREATE DATABASE IF NOT EXISTS CLAUDE_SANDBOX;
GRANT OWNERSHIP ON DATABASE CLAUDE_SANDBOX TO ROLE CLAUDE_SANDBOX;
GRANT OWNERSHIP ON SCHEMA CLAUDE_SANDBOX.PUBLIC TO ROLE CLAUDE_SANDBOX;

-- Let the sandbox role also read Snowflake's sample data for practice queries
GRANT IMPORTED PRIVILEGES ON DATABASE SNOWFLAKE_SAMPLE_DATA TO ROLE CLAUDE_SANDBOX;
```

Ran via `snow sql -c snowpro_trial -f setup_sandbox.sql` — all 8 statements succeeded on the
first attempt, no interactive password prompt (the CLI appears to cache a session after the
first successful auth in Step 5, at least for a while — not yet confirmed how long).

**Why this shape**: `CLAUDE_SANDBOX` owns its own warehouse and database outright (so it can do
real hands-on practice — create/drop tables, streams, tasks, clustering keys, whatever a domain
file calls for) but has zero reach into anything else in the account. This is the same
least-privilege pattern taught in `02_Domain2_Account_Mgmt_and_Governance.md` — worth noting this
setup is itself a live example of the exam content, not just infrastructure incidental to it.

## Step 7 — Key-pair authentication

### 7a. Generate the key pair

No `openssl` on the plain Windows PowerShell PATH, but Git Bash bundles its own
(`openssl 3.2.3`) — used that instead of installing anything new:

```bash
mkdir -p ~/.snowflake/keys && cd ~/.snowflake/keys
openssl genrsa -out temp_rsa.pem 2048
openssl pkcs8 -topk8 -inform PEM -outform PEM -in temp_rsa.pem -out claude_sandbox_rsa_key.p8 -nocrypt
rm temp_rsa.pem   # don't leave the intermediate raw key sitting around as a second copy of the secret
openssl rsa -in claude_sandbox_rsa_key.p8 -pubout -out claude_sandbox_rsa_key.pub
```

Chose **unencrypted** private key (`-nocrypt`) for this sandbox — no passphrase to manage for an
automated/non-interactive client, security instead resting on filesystem permissions:

```powershell
icacls "$env:USERPROFILE\.snowflake\keys\claude_sandbox_rsa_key.p8" /inheritance:r
icacls "$env:USERPROFILE\.snowflake\keys\claude_sandbox_rsa_key.p8" /grant:r "$($env:USERNAME):(R,W)"
```

(For a production/real-work setup rather than a trial sandbox, encrypt the private key with a
passphrase and use a proper secrets manager instead of relying on file ACLs alone.)

### 7b. ⚠️ Gotcha: creating `~/.snowflake/keys/` silently broke the existing connection

Immediately after creating `~/.snowflake/keys/` (which is `C:\Users\<YOUR_USERNAME>\.snowflake\keys\` on
Windows), `snow connection list` started returning **"No data"** and `snow sql -c snowpro_trial`
failed with `Connection snowpro_trial is not configured` — even though that connection had been
working moments earlier and nothing about it had been touched.

**Root cause**: `snow`'s config-file resolution prefers `~/.snowflake/config.toml` over
`%LOCALAPPDATA%\snowflake\config.toml` *whenever the `~/.snowflake` directory exists at all* —
even if it contains no `config.toml` yet. Creating `~/.snowflake/keys/` was enough to flip that
preference. The CLI then silently auto-created a fresh, empty `config.toml` at
`C:\Users\<YOUR_USERNAME>\.snowflake\config.toml` (confirmed via `snow --info`'s
`default_config_file_path`, which changed between checks) — our actual connection details were
still intact, just in the now-deprioritized old file, unrelated to anything we'd changed on
purpose. Confirmed by diffing `snow --info` output before/after and reading both config.toml
files directly.

**This is exactly the kind of trap a future onboarding flow needs to avoid**: don't create
`~/.snowflake/` (or any subfolder under it) *before* connections are configured, or configure
connections only after any such directory already exists — ordering matters here in a way that
isn't obvious from the CLI's own docs.

**Fix used**: `snow` has a global `--config-file <path>` option (must come *before* the
subcommand, e.g. `snow --config-file "<path>" sql ...`, not after — global options are
positional in this CLI). Used it once to reach the still-intact old connection:

```powershell
snow --config-file "C:\Users\<YOUR_USERNAME>\AppData\Local\snowflake\config.toml" sql -c snowpro_trial -f register_key.sql
```

Then set up the *new* key-pair connection directly in the now-canonical `~/.snowflake/
config.toml`, rather than fighting to restore the old path as default — consolidating on the
standard `~/.snowflake/` location going forward (it's also where the key files already live,
which is a natural, idiomatic pairing, same as `~/.ssh/`).

**Known residual state**: the original `snowpro_trial` (`ACCOUNTADMIN`, password auth) connection
still exists, but only in the *old*, no-longer-default config file — reachable only via
`--config-file` if ever needed again for genuine account-admin work. Not fixed further
deliberately: needing an explicit extra flag to reach `ACCOUNTADMIN` is arguably a feature, not a
bug, given it should be rare/deliberate anyway. A future onboarding flow should just write
directly to `~/.snowflake/config.toml` from the start and never create this split in the first
place.

### 7c. Register the public key on the Snowflake user

```sql
ALTER USER <YOUR_USERNAME> SET RSA_PUBLIC_KEY='<public key body, header/footer and newlines stripped>';
```

Extracting the key body: `grep -v -- "-----" claude_sandbox_rsa_key.pub | tr -d '\n'`. Ran via
the recovered `snowpro_trial` connection (see 7b). Confirmed via `DESC USER <YOUR_USERNAME>`:
`HAS_KEYPAIR: true`, `RSA_PUBLIC_KEY_FP: SHA256:<YOUR_KEY_FINGERPRINT>`.

**Verified independently rather than just trusting Snowflake's report** — recomputed the same
fingerprint locally from the public key file and confirmed an exact match:

```bash
openssl rsa -pubin -in claude_sandbox_rsa_key.pub -outform DER | openssl dgst -sha256 -binary | openssl enc -base64
# → <YOUR_KEY_FINGERPRINT>  (matches Snowflake's report exactly)
```

### 7d. Create the scoped, key-pair connection (non-interactive this time)

`snow connection add` supports full non-interactive creation via flags (`--no-interactive`) —
faster and more scriptable than the interactive wizard from Step 4, now that all the values are
already known:

```powershell
snow connection add `
  --connection-name claude_sandbox `
  --account <YOUR_ACCOUNT_IDENTIFIER> `
  --user <YOUR_USERNAME> `
  --role CLAUDE_SANDBOX `
  --warehouse CLAUDE_SANDBOX_WH `
  --database CLAUDE_SANDBOX `
  --schema PUBLIC `
  --authenticator SNOWFLAKE_JWT `
  --private-key "C:\Users\<YOUR_USERNAME>\.snowflake\keys\claude_sandbox_rsa_key.p8" `
  --no-interactive
```

`snow connection test -c claude_sandbox` → `Status: OK`, zero password prompt anywhere in the
flow. Functional test (create table → insert → select → drop, all via `claude_sandbox`) passed —
confirms the role's actual privileges work, not just that authentication succeeds.

**`claude_sandbox` is now the connection to use for all routine work.** `snowpro_trial` should
only be reached again (via `--config-file`) for genuine account-admin tasks.

## Step 9 — Cleanup: remove the plaintext-password bootstrap connection

Once `claude_sandbox` was confirmed working, the `snowpro_trial` connection (still holding a
plaintext password in the old, now-orphaned config file) served no further purpose and was a
needless secret sitting on disk. Removed via the CLI's own command rather than hand-editing TOML:

```powershell
snow --config-file "C:\Users\<YOUR_USERNAME>\AppData\Local\snowflake\config.toml" connection remove snowpro_trial
```

Note: `connection remove` takes the connection name as a **positional argument**, not a `-c`
flag (unlike `sql`/`test`, which do use `-c`) — `snow connection remove --help` if unsure.
Confirmed removed by reading the file directly afterward: `snowpro_trial`'s whole block, password
included, was gone; the untouched `<STALE_ACCOUNT_IDENTIFIER>` connection (never had a stored password) was
initially left alone, since removing it wasn't part of the original request.

**Follow-up**: `<STALE_ACCOUNT_IDENTIFIER>` turned out to predate this whole session — it was already
present the very first time `snow connection list` was run, before any setup work started, under
an older-style account identifier (no hyphenated org prefix, unlike the current
`<YOUR_ACCOUNT_IDENTIFIER>` trial). Confirmed it was stale/no longer relevant, so removed it the
same way:

```powershell
snow --config-file "C:\Users\<YOUR_USERNAME>\AppData\Local\snowflake\config.toml" connection remove <STALE_ACCOUNT_IDENTIFIER>
```

The old config file now contains only its `[cli.logs]` section — no connections left at all.
(The encoding-mismatch warning briefly reappeared during this command, since the Step 10 fix
lives only in the new canonical config file, not this old one — expected, and moot now that the
old file has nothing left to connect with.)

## Step 10 — Fix the recurring "Encoding mismatch" warning

Every `snow` command had been printing:

```
UserWarning: Encoding mismatch detected. Run 'snow helpers detect-encoding' for more details.
```

Running the suggested diagnostic explained it precisely:

```powershell
snow helpers detect-encoding
```
```
Encoding mismatch detected:
  Filesystem: utf-8
  Default:    utf-8
  Locale:     cp1252

This may cause file corruption when sharing projects across platforms.
```

**Root cause**: the CLI does its own file I/O in UTF-8, but this machine's PowerShell locale
encoding is `cp1252` (a legacy Windows codepage). Harmless for plain-ASCII SQL, but exactly the
kind of thing that would corrupt non-ASCII content (accented names, special characters) — worth
fixing properly rather than ignoring, especially for anything meant to be reproducible
cross-platform later.

Of the three fixes the diagnostic suggested (a global `PYTHONUTF8=1` env var, a scoped
`[cli.encoding]` config-file setting, or three `SNOWFLAKE_CLI_ENCODING_*` env vars), chose the
**scoped config-file option** — doesn't affect Python behavior outside `snow`, and lives right
next to the connection config it's related to:

```toml
# added to C:\Users\<YOUR_USERNAME>\.snowflake\config.toml
[cli.encoding]
file_io = "utf-8"
subprocess = "utf-8"
stdout = "utf-8"
```

Verified fixed: `snow connection test -c claude_sandbox` afterward printed no warning at all, and
the connection still worked.

## Step 8 — MCP server: architecture correction

Initial research (during the CLI setup work) pointed at `Snowflake-Labs/mcp`, a locally-run
server installed via `uvx`, authenticating with the same connector-based auth as the CLI
(key-pair, password, etc.) — a local stdio process Claude Code/Desktop spawns itself.

**That entire model is now deprecated.** Re-verified directly before installing anything (good
thing — the first research pass was already stale). The current official mechanism is a
**Snowflake-hosted MCP server**: a first-class object created *inside* the Snowflake account via
SQL (`CREATE MCP SERVER`), exposed at an HTTPS URL under the account's own domain, which an MCP
client connects to **remotely** rather than spawning locally. Authentication is OAuth by default
(interactive browser consent) or a **Programmatic Access Token (PAT)** for non-interactive use —
not the connector auth (key-pair/password) the CLI uses. The `claude_sandbox` key-pair connection
doesn't carry over to this layer; it was built for a different auth handshake. Tools execute under
normal Snowflake RBAC on the backend regardless.

## Step 9 — Create the MCP server object

Full tool-spec syntax (from Snowflake's own getting-started guide) supports five tool types —
`SYSTEM_EXECUTE_SQL`, `CORTEX_ANALYST_MESSAGE`, `CORTEX_SEARCH_SERVICE_QUERY`,
`CORTEX_AGENT_RUN`, and `GENERIC` (wraps a stored procedure). Only `SYSTEM_EXECUTE_SQL` needs
zero prerequisite setup — the others each need a real Snowflake object to exist first (a semantic
view, a Cortex Search Service, a Cortex Agent, or a stored procedure respectively). Started
minimal, deliberately:

```sql
CREATE OR REPLACE MCP SERVER claude_sandbox_mcp FROM SPECIFICATION
$$
tools:
  - name: "SQL_Execution_Tool"
    type: "SYSTEM_EXECUTE_SQL"
    description: "Executes SQL against the connected Snowflake database."
    title: "SQL Execution Tool"
$$;
```

Ran via `snow sql -c claude_sandbox -f create_mcp_server.sql` (had to write it to a file — the
`$$...$$` YAML-in-SQL delimiter plus embedded quotes/newlines made inline `-q` escaping in
PowerShell unreliable; same lesson as every other multi-statement script this session).

**Worked directly with the least-privilege `claude_sandbox` connection — no elevated/ACCOUNTADMIN
access needed.** `CREATE MCP SERVER` follows the same ownership model as tables/views: since
`CLAUDE_SANDBOX` already owns its own database/schema, it could create the object there without
any extra grant. Confirmed via `SHOW MCP SERVERS` (owner: `CLAUDE_SANDBOX`) and
`SHOW GRANTS ON MCP SERVER claude_sandbox_mcp` (shows `OWNERSHIP` already held by the role that
created it — no separate `GRANT USAGE` needed for the owner; that would only matter if a
*different* role needed access to this same server later). Minor naming detail: Snowflake's
internal object-type label for this is `CORTEX_AGENT_SERVER`, not literally "MCP SERVER" — shows
up that way in `granted_on`.

## Step 10 — Programmatic Access Token (in progress)

SQL path confirmed to exist (no need for the Snowsight UI, though that works too):

```sql
ALTER USER <YOUR_USERNAME> ADD PROGRAMMATIC ACCESS TOKEN claude_mcp_token
  ROLE_RESTRICTION = 'CLAUDE_SANDBOX'
  DAYS_TO_EXPIRY = 90
  COMMENT = 'Claude Code MCP access, sandbox-scoped';
```

`ROLE_RESTRICTION` hard-locks the token to only ever act as `CLAUDE_SANDBOX`, regardless of what
else the underlying user account can do. **Deliberately run by hand, not scripted** —
the token value is shown exactly once, in the SQL result at creation time, never retrievable
again, and having it pass through an AI assistant's tool output would put it in a persisted
transcript unnecessarily. Same reasoning applied to the private key and passwords throughout this
session. Gotcha worth remembering: a PAT cannot be modified/rotated/revoked in a session that
used that same PAT to authenticate — rotation has to go through a different auth method (e.g. the
key-pair `claude_sandbox` connection).

## Step 11 — Configure Claude Code, connect (pending)

Plan: add an entry to `~/.claude.json` using HTTP transport with a static bearer-token header,
which the docs confirm makes Claude Code skip the OAuth flow entirely:

```json
{
  "mcpServers": {
    "snowflake": {
      "type": "http",
      "url": "https://<YOUR_ACCOUNT_IDENTIFIER>.snowflakecomputing.com/api/v2/databases/CLAUDE_SANDBOX/schemas/PUBLIC/mcp-servers/CLAUDE_SANDBOX_MCP",
      "headers": {
        "Authorization": "Bearer ${SNOWFLAKE_MCP_PAT}"
      }
    }
  }
}
```

PAT goes into a local environment variable (`SNOWFLAKE_MCP_PAT`), never hardcoded in the file.

**Endpoint URL confirmed** against the official docs pattern
(`https://<account_url>/api/v2/databases/{database}/schemas/{schema}/mcp-servers/{name}`):

```
https://<YOUR_ACCOUNT_IDENTIFIER>.snowflakecomputing.com/api/v2/databases/CLAUDE_SANDBOX/schemas/PUBLIC/mcp-servers/CLAUDE_SANDBOX_MCP
```

Added to `C:\Users\<YOUR_USERNAME>\.claude.json` at the top-level (user-scope) `mcpServers` key, alongside
the existing `ha-mcp`-era `"Home Assistant"` entry — same `{"type": "http", "url": "..."}` shape,
this one with a `headers` block added:

```json
"Snowflake": {
  "type": "http",
  "url": "https://<YOUR_ACCOUNT_IDENTIFIER>.snowflakecomputing.com/api/v2/databases/CLAUDE_SANDBOX/schemas/PUBLIC/mcp-servers/CLAUDE_SANDBOX_MCP",
  "headers": {
    "Authorization": "Bearer ${SNOWFLAKE_MCP_PAT}"
  }
}
```

**Restart gotcha, worth remembering for next time**: setting a new Windows user environment
variable via `[System.Environment]::SetEnvironmentVariable(...)` does **not** propagate into a
VS Code process that was already running — env vars are captured once at OS process launch. A
simple "Reload Window" only restarts the extension host inside the same process, so it still
won't see the new variable. VS Code has to be **fully closed and reopened** (a genuinely new
process) for `SNOWFLAKE_MCP_PAT` to be visible to Claude Code. Same underlying reasoning as the
already-documented "Electron apps don't fully quit on window close" Claude Desktop gotcha, just
the inverse case (needing a real restart rather than avoiding a fake one).

## Step 12 — Debugging the connection: three distinct failures, in order

First `/mcp` attempt: `Status: failed`, HTTP 401. Diagnosed by testing the PAT directly against
Snowflake's general REST API (`Invoke-WebRequest` to `/api/v2/databases`), independent of Claude
Code's MCP client — isolates "is the token bad" from "is something else wrong":

1. **First test, no `Accept` header**: got HTTP 400, `"Unsupported Accept header null"` — a
   business-logic error, not an auth error. Since Snowflake's REST API auth middleware runs
   *before* this check, reaching a 400 here proved the PAT itself was valid — ruling out a bad/
   malformed token as the cause of the original 401.
2. **Second test, with `Accept: application/json`**: got a *different* HTTP 401:
   `"Fail : Network policy is required."` (error code 390432). Root cause: Snowflake requires
   PAT-based REST API auth to have an **active network policy attached to the user** — not
   evaluated against our IP, just a hard precondition that *some* policy exist at all, and
   `<YOUR_USERNAME>` had none. This is a different, more specific error than the original opaque 401 from
   the MCP client itself, and only surfaced by testing the raw REST API directly.
3. **Fix (temporary, for testing)**: recreated the PAT with
   `MINS_TO_BYPASS_NETWORK_POLICY_REQUIREMENT = 60` — a token-level, time-boxed waiver
   specifically of the "a policy must exist" precondition (confirmed from docs: does **not**
   bypass an actual policy's IP restrictions if one exists — narrower than it sounds). Real fix
   for ongoing use would be `CREATE NETWORK POLICY ... ALLOWED_IP_LIST = ('<public IP>/32')` +
   `ALTER USER <YOUR_USERNAME> SET NETWORK_POLICY = ...` — not yet applied, since it would also gate
   Snowsight logins and the `claude_sandbox` CLI connection for that user, and public IP isn't
   guaranteed stable. Deferred until MCP is actually usable (see Step 13).
   - Own public IP for reference at time of testing: `<YOUR_PUBLIC_IP>` (via `api.ipify.org`).
   - `ALTER USER ... ADD/REMOVE PROGRAMMATIC ACCESS TOKEN` requires elevated privilege
     `CLAUDE_SANDBOX` doesn't have — run directly by hand each time, not scripted, both because
     of the privilege gap and because the token value is shown exactly once at creation.

After the fix: `/mcp` showed `connected`, and `mcp__Snowflake__SQL_Execution_Tool` became callable.

## Step 13 — Final blocker: Cortex Agent is unavailable on trial-tier accounts

Calling the tool (`SELECT CURRENT_USER(), ...`) failed with:
`Agent error (code 399504): Access denied for trial accounts.`

**This is a genuine, documented Snowflake product/licensing restriction, not a config problem.**
Confirmed independently: MCP tool *execution* routes through **Cortex Agent** orchestration
under the hood (independently corroborated by our own earlier `SHOW GRANTS ON MCP SERVER` output,
which showed the object's internal type as `CORTEX_AGENT_SERVER` — noted at the time without
realizing its significance), and Cortex Agent is blocked account-wide on trial-tier Snowflake
accounts. Tool *discovery* (listing available tools, connecting, auth, network policy) all
succeed normally, since that's pure metadata/config — only actual tool *invocation* is blocked.
No configuration change fixes this; it requires upgrading off the trial tier.

**Status: MCP setup is functionally complete and correctly configured, but unusable on this
account until/unless it moves off the trial tier.** Fall back to the CLI (`claude_sandbox`
connection, already fully verified working) for all hands-on Snowflake work going forward. Worth
retesting if this account is ever upgraded, or against a different (e.g. work-provided) Snowflake
account where this restriction likely doesn't apply.

**Resolved (tested during Domain 1 study)**: it's not just Cortex Agent/MCP — plain Cortex SQL
functions are blocked too. `SELECT SNOWFLAKE.CORTEX.COMPLETE('llama3.1-8b', '...')` via CLI
returned `399258 (0A000): AI function COMPLETE is not available for trial accounts.` So the
restriction is Cortex-wide on this account tier, not specific to the Agent orchestration path —
no hands-on Cortex testing possible on this trial account at all, for any Cortex feature.
