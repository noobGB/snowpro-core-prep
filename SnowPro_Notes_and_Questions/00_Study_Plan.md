# Study Plan — SnowPro Core (COF-C03)

**A 7-day template, anchored on the 2026-08-13 → 2026-08-19 reference dates below.** The app
remaps every day relative to whatever exam date you set on the Dashboard — these are day offsets,
not a fixed schedule (see `CLAUDE.md` in this folder). Weekend-heavy by design (light on weekday
evenings, heavy on Sat/Sun).

Exam facts: 100 questions (multiple-choice/multiple-select), 115 minutes, pass mark 750/1000,
$175/attempt. Domains in weight order — study in this order, heaviest first:

| # | Domain | Weight | File |
|---|--------|--------|------|
| 1 | Snowflake AI Data Cloud Features & Architecture | ~31% | [01_Domain1_Architecture_and_Features.md](01_Domain1_Architecture_and_Features.md) |
| 2 | Performance Optimization, Querying & Transformation | ~21% | [04_Domain4_Performance_Querying_Transformation.md](04_Domain4_Performance_Querying_Transformation.md) |
| 3 | Account Management & Data Governance | ~20% | [02_Domain2_Account_Mgmt_and_Governance.md](02_Domain2_Account_Mgmt_and_Governance.md) |
| 4 | Data Loading, Unloading & Connectivity | ~18% | [03_Domain3_Data_Loading_Unloading_Connectivity.md](03_Domain3_Data_Loading_Unloading_Connectivity.md) |
| 5 | Data Collaboration | ~10% | [05_Domain5_Data_Collaboration.md](05_Domain5_Data_Collaboration.md) |

Domains 1 + 2 (Architecture + Performance) are 52% of the exam between them — if a day gets cut
short, protect those two first.

**Verified 2026-08-13 against the official Snowflake COF-C03 Exam Study Guide PDF** (in this
folder). Domain weights were already accurate; the official guide added several officially-tested
items folded into the domain files since — if you studied before this update, specifically
re-check: **Query Acceleration Service** (Domain 4), **Dynamic Tables** (Domain 3),
**`EXECUTE AS CALLER` vs `OWNER`** for stored procedures (Domain 2), **database vs. account
roles** (Domain 2), and that **Cloning/Time Travel/Fail-safe are Domain 5 topics**, not Domain 1.
Also see [09_Official_Sample_Questions_Analysis.md](09_Official_Sample_Questions_Analysis.md) —
the guide's 5 official sample questions, worth doing once as-is before touching any third-party
practice source.

**Added 2026-08-13**: 50 original, domain-tagged practice questions (with answer keys) now exist
per domain — files `10`-`14`, proportional to domain weight (15/10/9/11/5). Use these as your
domain-by-domain checks throughout the week (replacing the generic "20-25 practice questions"
placeholders below); save third-party/unofficial sources only as a supplement, and keep avoiding
anything branded as an exam "dump" (see `07_Resources.md`).

## Day-by-day

### Thu 2026-08-13 (tonight, ~2-3 hrs)
- [x] Downloaded the official exam guide PDF and verified the domain files against it.
- [ ] Read this whole plan + skim all 5 domain files once, just to see the shape of the exam.
- [ ] Set up Snowflake University (Community login) and a 30-day free trial account for
      hands-on labs — the guide asks you to do this before studying, and you'll want the trial
      account for scratch experimentation separate from any work Snowflake account.
- [ ] Domain 1: architecture layers (1.1), interfaces/tools (1.2), micro-partitions and virtual
      warehouse basics (1.4-1.5).
- [ ] Register/schedule the actual exam slot if not done yet (do this early — don't let
      logistics slip to the final day).

### Fri 2026-08-14 (evening, ~2-3 hrs)
- [ ] Domain 1: finish remaining sections — object hierarchy (1.3, don't skip Pipes/Sequences/
      ML models/Applications), table/view types (1.5), AI/ML & app-dev features (1.6: Notebooks,
      Streamlit, Snowpark, Cortex, Snowflake ML — these are confirmed officially tested).
- [ ] Do the 15 questions in
      [10_Practice_Questions_Domain1_Architecture.md](10_Practice_Questions_Domain1_Architecture.md),
      timed, then review every explanation (not just the ones you missed).
- [ ] Read [09_Official_Sample_Questions_Analysis.md](09_Official_Sample_Questions_Analysis.md)
      once — sets expectations for exact question style before you hit a full practice exam.

### Sat 2026-08-15 (full day — the big one)
- [ ] Morning: Domain 4 (Performance) end to end — warehouse sizing/scaling, caching, clustering,
      query profile, SQL transformation features.
- [ ] Afternoon: Domain 2 (Account Mgmt & Governance) end to end — RBAC, roles hierarchy, account
      structure, resource monitors, masking/row access policies, cost management.
- [ ] Evening: [11_Practice_Questions_Domain2_Governance.md](11_Practice_Questions_Domain2_Governance.md)
      (10 Qs) and [13_Practice_Questions_Domain4_Performance.md](13_Practice_Questions_Domain4_Performance.md)
      (11 Qs), timed. Log results in [06_Practice_Exam_Tracker.md](06_Practice_Exam_Tracker.md).

### Sun 2026-08-16 (full day)
- [ ] Morning: Domain 3 (Data Loading/Unloading/Connectivity) end to end — stages, file formats,
      COPY INTO, Snowpipe, connectors/drivers. Then
      [12_Practice_Questions_Domain3_Loading.md](12_Practice_Questions_Domain3_Loading.md) (9 Qs).
- [ ] Afternoon: Domain 5 (Data Collaboration) — Secure Data Sharing, Marketplace, listings. Then
      [14_Practice_Questions_Domain5_Collaboration.md](14_Practice_Questions_Domain5_Collaboration.md)
      (5 Qs).
- [ ] Evening: **First full-length timed practice exam** —
      [16_Mock_Exam_1.md](16_Mock_Exam_1.md), 100 questions, closed-book, timed to 115 min. Log
      score + full per-domain breakdown in the tracker. This is the single most useful diagnostic
      you'll get all week — don't skip it or split it up.

### Mon 2026-08-17 (evening, ~2-3 hrs)
- [ ] Review every wrong/guessed answer from Sunday's practice exam — for each, write in the
      relevant domain file *why* you got it wrong (misread the question vs. genuine knowledge
      gap vs. never covered).
- [ ] Re-study whichever domain(s) scored weakest.
- [ ] Drill [08_Cheatsheet_Key_Numbers.md](08_Cheatsheet_Key_Numbers.md).

### Tue 2026-08-18 (evening, ~2-3 hrs)
- [ ] **Second full-length timed practice exam.** Compare score/domain breakdown to Sunday's —
      confirm the weak domains actually improved.
- [ ] Light targeted review only on anything still shaky. Do not cram new topics this late.
- [ ] Re-read the cheatsheet once more before bed.

### Wed 2026-08-19 — Exam day
- [ ] Light review only: cheatsheet + your own wrong-answer notes. No new material.
- [ ] Confirm exam logistics (online proctoring requirements: ID, webcam, quiet room, valid
      photo ID matching registration name) the night before, not the morning of.
- [ ] Take the exam.

## Progress tracker

A template — this is separate from the app's own analytics (which scores your actual quiz
attempts); use this for the qualitative, hands-on side of studying that a quiz score doesn't
capture.

- [ ] Domain 1 — Architecture & Features (___/15 practice questions; notes on any hands-on
      verification you did — sessions, warehouse config, cloning, scaling, credit pricing, etc.)
- [ ] Domain 2 — Account Mgmt & Governance (___/10 practice questions; notes on hands-on
      verification — masking/row access policy, securable object hierarchy, RBAC boundaries.)
- [ ] Domain 3 — Data Loading/Unloading/Connectivity (___/9 practice questions; notes on hands-on
      verification — stream/stage mechanics, Dynamic Table refresh behavior.)
- [ ] Domain 4 — Performance & Transformation (___/11 practice questions; notes on hands-on
      verification — caching layers, Query Acceleration Service, Search Optimization.)
- [ ] Domain 5 — Data Collaboration (___/5 practice questions; notes on hands-on verification —
      Time Travel, Secure Data Sharing.)

- [ ] Practice exam #1 taken — score: ___/1000
- [ ] Practice exam #2 taken — score: ___/1000
- [ ] Exam scheduled
- [ ] Exam taken — result: ___
