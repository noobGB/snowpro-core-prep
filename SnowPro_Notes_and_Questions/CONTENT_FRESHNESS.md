# Content Freshness — Is This Still Accurate?

This is a study app built from a snapshot of the official SnowPro Core (COF-C03) exam guide plus
Snowflake's own documentation, **as verified on specific dates**. Snowflake revises both the exam
guide and its docs regularly — a feature gets renamed, an edition boundary shifts, a service's
defaults change. If you're opening this repo more than a couple of months after the dates below,
some notes or questions here could be quietly wrong. This file exists so you don't have to
re-verify everything from scratch to find out — check the tripwire first, then use the checklist
below only where it points you.

## 1. Run the automated tripwire first

```
cd pipeline
npm run check:freshness
```

This fetches the ~12 specific Snowflake documentation pages that this session's content updates
were verified against (`pipeline/scripts/freshness-baseline.json`), hashes each page's visible
content, and compares against the hash stored the last time someone verified this repo. It reports
three states per page:

- **✓ unchanged** — that page's content is byte-for-byte the same (after stripping scripts/styles)
  as when it was last checked. Not proof nothing you care about changed elsewhere on
  docs.snowflake.com, but a real, cheap signal for the pages this content actually cites.
- **⚠ CHANGED** — the page's content differs. This does **not** mean the study material is wrong —
  Snowflake edits pages for typos, formatting, and unrelated additions constantly. It means: open
  that page and read the specific claim(s) listed against it in the table below, by hand.
- **✗ unreachable** — couldn't fetch it (network issue, or the URL moved/404s). A moved/404 URL is
  itself a signal worth investigating — Snowflake does reorganize its docs site periodically.

Exit code is nonzero if anything changed, so it's CI-friendly if you ever want to wire it into a
scheduled check. After manually re-verifying whatever it flagged, reset the baseline with:

```
npm run check:freshness -- --update
```

**This mechanism has a real, known limitation**: it only covers the specific pages someone
happened to cite while writing or updating content. It will never flag a change to a Snowflake
feature nobody has sourced a fact from yet, and it says nothing about whether the *exam guide
itself* (a PDF, not a web page — see §3) has been revised. Treat a clean run as "the pages we know
we depend on haven't moved," not "this repo is definitely current."

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
