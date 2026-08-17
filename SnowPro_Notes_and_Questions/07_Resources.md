# Resources & Compilation Notes

## Verification status

The domain files in this folder (01-05) are now **verified against the official Snowflake
COF-C03 Exam Study Guide PDF** (`SnowProCoreStudyGuideC03.pdf`, in this folder, last updated by
Snowflake 2026-07-08 — you downloaded and supplied it on 2026-08-13). Domain weightings matched
what was initially compiled from third-party sources exactly (31/20/18/21/10); the official
guide's own subtopic list (sections 1.1-5.3) surfaced several officially-tested items that were
missing from the first draft — Query Acceleration Service, Dynamic Tables, `EXECUTE AS CALLER`
semantics, database vs. account roles, and more — all now folded into the domain files. See
[09_Official_Sample_Questions_Analysis.md](09_Official_Sample_Questions_Analysis.md) for a
breakdown of the guide's 5 official sample questions.

Two items the guide explicitly flags as **not yet tested** (skip deep study on these): Openflow,
and the default warehouse for Notebooks. Don't spend time on either.

## Official / primary sources (use these first)

- **Exam guide & registration**: https://learn.snowflake.com/en/certifications/snowpro-core-c03/
- **Snowflake Documentation**: https://docs.snowflake.com — the ground truth for every fact in
  this folder. When a domain file's claim feels off or too vague, check it here.
- **Official practice exam**: the PDF guide links a "Practice exam" (page 3, item 4) but the text
  extraction here couldn't preserve the hyperlink target — open the PDF yourself
  (`SnowProCoreStudyGuideC03.pdf` in this folder) and click that link directly. This is the
  single best practice-question source since it's Snowflake's own.
- **Snowflake Community / quickstarts**: https://quickstarts.snowflake.com for hands-on labs —
  genuinely useful given you have real Snowflake access at work; running the concepts (clone a
  table, set up a stream+task, create a masking policy) will stick better than reading about them.
- Before either: the guide asks you to first set up (1) a **Snowflake University** account (via
  Community login) and (2) a **Snowflake 30-day free trial** account for hands-on labs — do both
  on day 1, the trial account matters for the hands-on practice below.

## Official study resources, by domain (from the guide's own "Study Resources" sections)

Short, targeted, and free — worth using over generic third-party content given the time crunch.
All are Snowflake University on-demand courses/modules; find them via learn.snowflake.com once
logged in with your Community account.

- **Domain 1** (Architecture): Snowflake Foundations On-Demand Training; Badge 1 — Data
  Warehousing Workshop; Level Up: Snowflake's Key Concepts / Snowflake Ecosystem / Container
  Hierarchy / Accounts & Assurances; Snowflake x GenAI: LLM Functions; "Getting Started With
  Snowflake" Modules 1-2.
- **Domain 2** (Governance): Level Up: Resource Monitoring; FinOps for Snowflake; "Getting
  Started" Module 9 (Roles, Account Admin & Account Usage); article "Quickly Visualize
  Snowflake's Roles, Grants and Privileges."
- **Domain 3** (Loading): Level Up: Data Loading; "Getting Started" Modules 4-5 (CSV/JSON
  loading).
- **Domain 4** (Performance): Badge 3 — Data Application Builders Workshop; Level Up: Query
  History & Caching / Context; "Getting Started" Module 7 (Querying, Result Cache, Cloning);
  video "Accelerating BI Queries with Caching."
- **Domain 5** (Collaboration): Badge 2 — Collaboration, Marketplace & Cost Estimation Workshop;
  Level Up: Native App Development for Beginners; "Getting Started" Modules 6, 8, 10 (Marketplace,
  Time Travel, Secure Sharing).

## Hands-on practice (recommended given your work access)

If you have a live Snowflake account through work, use it. Nothing cements Domain 1/4 concepts
(caching, clustering, zero-copy clone, Time Travel, streams/tasks) like running them yourself in
a scratch database. If your work account has role restrictions, ask whether a free 30-day trial
account (signup at signup.snowflake.com) makes more sense for experimentation without touching
anything production-adjacent.

## Practice questions — a caution

Several free/paid third-party sites surfaced in search (exam-dump style sites offering "leaked"
or verbatim question banks). **Avoid anything claiming to be actual exam questions or a "dump"** —
Snowflake's candidate agreement (like most vendor certs) explicitly prohibits sharing or using
real exam content, and using dumps risks certification revocation even after passing. Stick to
sites that clearly present *original* practice questions modeled on the exam guide's topics
(clearly labeled as unofficial practice, not "real exam questions"), or better, the official
Snowflake practice material if/when available on the certification page.

## Logistics

- Cost: $175 per attempt.
- Format: 100 questions (multiple-choice/multiple-select), 115 minutes, online proctored or
  test-center — confirm which when registering.
- Passing score: 750/1000 (scaled scoring, not a flat percentage of 100 questions).
- Online-proctored exams require: valid government photo ID matching the registration name
  exactly, a quiet private room, webcam, and no notes/second monitor/phone in reach — worth
  reading Snowflake's proctoring policy in full a day or two before, not the morning of.
- Certification is valid **2 years** from issue date; renewable via Snowflake's Continuing
  Education program (eligible instructor-led training, or earning an equal/higher SnowPro cert).
- The official guide PDF states its contents are **for internal/personal use only and not for
  redistribution to third parties** — keep it to your own study, don't post/share it externally.
