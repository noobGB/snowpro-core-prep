# SnowPro Core Study Content

This folder is the markdown source the content pipeline (`../pipeline/`) reads — domain notes, a
day-by-day plan, practice questions, a mock exam, and a hands-on setup log. It's not a code
project; read [00_Study_Plan.md](00_Study_Plan.md) first for the intended day-by-day structure.

## Context

- Exam version: **COF-C03**. If you're reading this later, re-verify against the current official
  guide before trusting these notes — Snowflake revises it periodically.
- **All domain files (01-05) are verified against the official Snowflake COF-C03 Exam Study Guide
  PDF** (kept locally as `SnowProCoreStudyGuideC03.pdf`, gitignored — copyrighted, not
  redistributed with this repo; download your own copy from Snowflake if you want to re-verify).
  See `07_Resources.md` for the verification note.

## Folder contents

- `00_Study_Plan.md` — a day-by-day schedule and checklist template. Dates in the day headings are
  source-of-truth *offsets* the app remaps against your own exam date (see the main README) — edit
  the task text, not the dates, unless you're deliberately reshaping the week.
- `01`–`05` — one file per exam domain, in weight order, following the official guide's own
  subtopic numbering. Each has key facts and gotchas likely to be tested.
- `06_Practice_Exam_Tracker.md` — a template for logging scores per attempt, per-domain breakdown,
  and recurring wrong-answer patterns. Starts empty; fill it in as you study.
- `07_Resources.md` — official docs, per-domain official study resources, hands-on setup, and
  practice-question guidance (including a caution against exam-dump sites).
- `08_Cheatsheet_Key_Numbers.md` — hard numbers/limits worth rote-memorizing right before the exam
  (retention windows, warehouse sizes, file size limits, exact mechanics like `EXECUTE AS CALLER`
  and `TRUNCATE` vs `DELETE`). This is also the flashcard deck's source.
- `09_Official_Sample_Questions_Analysis.md` — a mechanism-focused breakdown of the 5 official
  sample questions from the guide PDF.
- `10`-`14` — original, exam-style practice questions per domain (50 total: 15/10/9/11/5,
  proportional to domain weight), each with an answer key and explanation. Not sourced from any
  exam-dump site (see the caution in `07_Resources.md`).
- `15_Hands_On_Snowflake_Setup_Log.md` — a tutorial-quality walkthrough of setting up Snowflake CLI
  + key-pair auth + a scoped sandbox role against a trial account, written so it doubles as an
  onboarding guide. Placeholders like `<YOUR_ACCOUNT_IDENTIFIER>` mark where your own values go.
- `16_Mock_Exam_1.md` — full-length, 100-question mock exam (31/20/18/21/10 domain split matching
  official weights), interleaving the 50 questions from `10`-`14` with 50 new ones. Numbering
  leaves `17`+ open for a future second mock.

## Adding or editing content

See the main [README](../README.md#adding-or-editing-content) for the full guide — file naming
patterns, the exact question format the parser expects, and how to add a new mock exam.

## How to use this while studying

- Fill in gaps in the domain files as you hit them in the official docs or hands-on practice —
  treat them as living notes, not a finished reference.
- Log every practice attempt in the tracker, even partial ones — the per-domain breakdown is what
  tells you where to spend the remaining study days.
