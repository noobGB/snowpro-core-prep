# Content Freshness — Is This Still Accurate?

This is a study app built from a snapshot of the official SnowPro Core (COF-C03) exam guide plus
Snowflake's own documentation, **as verified on specific dates**. Snowflake revises both the exam
guide and its docs regularly — a feature gets renamed, an edition boundary shifts, a service's
defaults change. If you're opening this repo more than a couple of months after the dates below,
some notes or questions here could be quietly wrong. This file exists so you don't have to
re-verify everything from scratch to find out — check the tripwire first, then use the checklist
below only where it points you.

## 1. How the mechanism actually works

The idea: the study content makes factual claims sourced from specific Snowflake documentation
pages. Rather than re-reading all of it by hand on a schedule, a script re-fetches those same
pages and fingerprints their content, so you only get pointed at the ones that actually moved.

Mechanically (`pipeline/scripts/check-content-freshness.mjs`):

1. `pipeline/scripts/freshness-baseline.json` stores one `{label, url, hash}` entry per Snowflake
   doc page that was cited while verifying a fact in this content — currently ~12 pages (see the
   table in §2).
2. `npm run check:freshness` (from `pipeline/`) re-fetches each URL live, strips
   `<script>`/`<style>` tags and all remaining HTML markup down to visible text, and computes a
   SHA-256 hash of that text.
3. Compares the fresh hash against the one stored in the baseline. Three outcomes per page:
   - **✓ unchanged** — hash matches. A real, cheap signal that page hasn't been edited since the
     baseline was taken — not proof nothing changed anywhere else on docs.snowflake.com.
   - **⚠ CHANGED** — hash differs. Open that page and read the specific claim(s) listed against it
     in §2's table, by hand.
   - **✗ unreachable** — couldn't fetch it (network issue, or the URL moved/404s). A moved/404 URL
     is itself worth investigating — Snowflake reorganizes its docs site periodically.
4. Once you've manually re-read whatever got flagged and confirmed the notes still hold up, reset
   the baseline: `npm run check:freshness -- --update`. Exit code is nonzero if anything changed,
   so it's CI-friendly if you ever want it on a schedule.

### What it catches

Any edit to the *visible content* of the ~12 tracked pages — a renamed function, a changed
default value, a reworded eligibility rule, a newly-added paragraph. This was validated
end-to-end: the baseline was populated from live fetches, then a second run against the same live
pages reported a clean 12/12 unchanged.

### What it does NOT catch — read this before trusting a clean run

- **Two structural blind spots get their own full explanation in §3, not repeated here**: the exam
  guide PDF itself (not a URL this script can fetch or diff at all), and any feature still in
  preview graduating to GA (nothing to fingerprint until it exists as a stable page).
- **Facts from pages nobody has cited yet.** The tracked list is exactly the pages *this session's*
  research happened to touch, not comprehensive coverage of every Snowflake feature these notes
  describe. Most of the original content (written before this mechanism existed) has no
  corresponding tracked page at all — a clean run says nothing about whether *that* material is
  still accurate.
- **Cosmetic, unrelated edits producing false positives.** Snowflake fixing a typo, reformatting a
  code sample, or adding an unrelated paragraph elsewhere on a tracked page all flip that page's
  hash to "changed" even though nothing this repo actually tests moved. A ⚠ CHANGED result means
  "go look," not "something here is now provably wrong" — don't skip the manual read.

Bottom line: treat a clean run as "the pages we know we depend on haven't moved," never as "this
repo is definitely current."

## 2. What each tracked page backs

| Page (see `freshness-baseline.json` for the live URL) | Backs |
|---|---|
| Editions feature matrix | Domain 1's edition ladder (§1.1), Domain 2's replication/failover edition gating |
| Multi-cluster warehouse scaling policies | Domain 1 §1.4 (Standard/Economy scaling mechanics, max cluster count table) |
| Access control / RBAC role hierarchy | Domain 2 §2.1 (system role hierarchy, DAC/RBAC) |
| Network policies | Domain 2 §2.1 (account- vs. user-level precedence) |
| Account replication & failover groups | Domain 2 §2.2 and Domain 5 §5.1 (replication group vs. failover group distinction) |
| CREATE FAILOVER GROUP reference | Same as above — edition requirement specifics |
| Streams introduction | Domain 3 §3.2 (standard/append-only/insert-only stream types and restrictions) |
| Tasks introduction | Domain 3 §3.2 (serverless vs. user-managed tasks, `WHEN SYSTEM$STREAM_HAS_DATA`) |
| Stored procedure execution rights | Cross-referenced from `08_Cheatsheet_Key_Numbers.md` (`EXECUTE AS CALLER`/`OWNER`) |
| Query Acceleration Service | Domain 4 §4.2 (eligibility, scale factor defaults, monitoring views) |
| Search Optimization Service | Domain 4 §4.2 (predicate coverage, async build) |
| Time Travel | Domain 5 §5.1 (default/max retention by edition) |

## 3. Things a hash check can't catch — check these by hand periodically

- **The exam guide itself.** `SnowProCoreStudyGuideC03.pdf` (gitignored — download your own from
  Snowflake) is the actual source of truth for domain weights, subtopic numbering, and what's
  in/out of scope. Compare its "last updated" date against the one recorded in
  `01_Domain1_Architecture_and_Features.md`'s header. If Snowflake has published a newer guide
  version, **re-read it before trusting anything else** — a domain-weight change or a subtopic
  reshuffle invalidates the *proportions* this whole content bank was built around (see
  `00_Study_Plan.md`'s own note about this happening once already, verified 2026-08-13).
- **High-churn features — worth a targeted re-check even between guide revisions**, since these
  are the kind of thing Snowflake ships/renames on its own schedule, independent of the exam guide:
  - Cortex AI SQL function naming (already renamed once — `SNOWFLAKE.CORTEX.*`/bare
    `SUMMARIZE`/`TRANSLATE` → `AI_`-prefixed functions, GA'd Nov 2025; check
    docs.snowflake.com's Cortex AI SQL functions page for the current names).
    Any newly-GA'd Cortex/Snowflake ML/Snowpark capability not yet reflected in Domain 1 §1.6.
  - Query Acceleration Service's default `MAX_SCALE_FACTOR` values, and Search Optimization
    Service's predicate coverage — both are the kind of implementation detail Snowflake expands
    over time.
  - Anything currently flagged in these notes as "not tested until GA" (Openflow, the Notebooks
    default warehouse) — once GA'd, it likely becomes fair game and these notes have zero
    coverage of it.
  - New editions, new regions/deployment models, or a changed encryption/compliance certification
    list (HIPAA/PCI/etc.) at a given edition tier.

## 4. If you find something wrong

Fix the domain note or question directly, note the correction and the date in the relevant
domain file (they already carry a "verified against the official guide (as of DATE)" header —
update it), and re-run `cd pipeline && npm run build:content` to confirm nothing else broke. If a
mock-exam question's *answer* is now wrong because a fact changed, fix it in place in that mock's
markdown — don't just delete the question, since the file's `domainSplit` validation expects the
declared count to stay intact (see the repo's `CLAUDE.md` for the mock-exam question format).
