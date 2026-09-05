/**
 * The legal and disclosure pages: /privacy/, /terms/, /about/, /accessibility/, /security/ and
 * /.well-known/security.txt.
 *
 * WHY A SEPARATE FILE FROM staticPages.ts, which renders the other generated pages: the two obey
 * opposite rules. `staticPages.ts` exists to publish numbers derived from content.json — question
 * counts, domain weights, durations — precisely so they cannot go stale. These pages must carry no
 * numbers from the bundle at all. The figures here (400 days, 1 hour, 7 days) are retention
 * periods, and each one is pinned to the constant in the code that actually enforces it, named in
 * a comment beside it. If you change one of those constants, this file is wrong until you change
 * it too, and a privacy policy that misstates retention is worse than one that omits it.
 *
 * NOTHING HERE MAY HARDCODE AN IDENTITY. Operator, contact, jurisdiction, product name and origin
 * all arrive via `LegalConfig`; see legalConfig.ts for why the repository being public makes that a
 * correctness requirement rather than a nicety.
 *
 * NOT LEGAL ADVICE, and these documents don't pretend otherwise. They are accurate, plain-language
 * descriptions of what the code verifiably does, which is the right bar for a free service and more
 * than most manage. Anything that takes payment needs a lawyer.
 *
 * WHY THERE IS NO COOKIE BANNER, recorded here so nobody adds one later believing it was an
 * oversight: the complete client-side storage inventory is two cookies (`snowprep_session`,
 * `snowprep_oauth_state`) and one localStorage key (`snowprep.progress`). Every one is strictly
 * necessary for a service the visitor explicitly requested, which is the ePrivacy Art. 5(3)
 * exemption. There is no analytics, no advertising and no third-party tracking anywhere in the
 * client. GDPR Art. 13 still requires that this be *disclosed*, which is what /privacy/#cookies
 * does. Disclosure is owed; consent is not. A banner here would be friction on the exact path guest
 * mode exists to remove, in exchange for nothing.
 */

import type { LegalConfig } from "./legalConfig.js";
import { esc, layout, type StaticFile } from "./staticPages.js";

/** Session cookie / server-side session lifetime. Pinned to `SESSION_MAX_AGE_MS` in db.ts. */
const SESSION_DAYS = 400;
/** Pinned to `PASSWORD_RESET_TOKEN_TTL_MS` in server.ts. */
const RESET_TOKEN_HOURS = 1;
/** Pinned to `DEFAULT_TTL_DAYS` in guestMode.ts. Operator-overridable via SNOWPRO_GUEST_TTL_DAYS,
 *  so this is stated as the default rather than as an absolute. */
const GUEST_TTL_DAYS = 7;
/** RFC 9116 requires an Expires in the future and recommends under a year. Regenerated on every
 *  boot, so this only goes stale if a container runs untouched for longer than this. */
const SECURITY_TXT_VALID_DAYS = 365;

/** Shared footer for the legal pages. Cross-links the set so any one of them is one click from the
 *  others — a privacy policy that doesn't lead to the terms makes someone hunt. */
function legalFooter(cfg: LegalConfig): string {
  return `<nav class="crumbs" style="margin-top:40px">
<a href="/privacy/">Privacy</a> · <a href="/terms/">Terms</a> · <a href="/about/">About</a> ·
<a href="/accessibility/">Accessibility</a> · <a href="/security/">Security</a> ·
<a href="${esc(cfg.siteOrigin)}/">${esc(cfg.productName)}</a></nav>`;
}

function updated(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Every legal page shares this shell so "last updated" and the cross-links can't drift between
 *  them. `jsonLd` is empty throughout: a privacy policy has no structured-data type worth claiming,
 *  and inventing one would be schema noise. */
function legalPage(cfg: LegalConfig, opts: { title: string; description: string; path: string; body: string }): StaticFile {
  return {
    relPath: `${opts.path}/index.html`,
    contents: layout({
      title: `${opts.title} — ${cfg.productName}`,
      description: opts.description,
      canonicalPath: `${opts.path}/`,
      jsonLd: "",
      origin: cfg.siteOrigin,
      author: cfg.operatorName,
      body: `<nav class="crumbs"><a href="/">${esc(cfg.productName)}</a> › ${esc(opts.title)}</nav>
<h1>${esc(opts.title)}</h1>
<p class="lede">Last updated ${updated()}.</p>
${opts.body}
${legalFooter(cfg)}`,
    }),
  };
}

function renderPrivacy(cfg: LegalConfig): StaticFile {
  const rows = cfg.subprocessors
    .map((s) => `<tr><td><strong>${esc(s.name)}</strong></td><td>${esc(s.purpose)}</td></tr>`)
    .join("\n");

  return legalPage(cfg, {
    title: "Privacy",
    description: `How ${cfg.productName} handles your personal data: what is collected, why, how long it is kept, and how to delete it.`,
    path: "privacy",
    body: `<p>${esc(cfg.productName)} is operated by ${esc(cfg.operatorName)}, ${esc(cfg.operatorForm)}, based in
${esc(cfg.jurisdiction)}. This page describes exactly what the application does with your data. It is written to be
checked against the software rather than to be reassuring.</p>

<p><strong>The short version.</strong> Your study data is yours. It is never sold, never shared with advertisers, and
never used to train anything. There is no analytics, no advertising, and no third-party tracking of any kind in this
application. You can export everything, and you can delete everything, from Settings, without asking anyone.</p>

<h2>What is collected</h2>
<p>Only what the application needs to work:</p>
<dl class="facts">
<dt>Email address</dt><dd>Your identity. It is how you sign in, and how a password reset reaches you.</dd>
<dt>Display name</dt><dd>Shown to you in the interface. Never used for lookups.</dd>
<dt>Password</dt><dd>Stored only as a <strong>scrypt hash</strong>. The password itself is never written down and cannot be recovered from what is stored — not by anyone, including the operator.</dd>
<dt>Google account ID</dt><dd>Only if you sign in with Google, and only Google's stable identifier for you. Never your Google password.</dd>
<dt>Your study data</dt><dd>Practice and mock attempts and their scores, flashcard grades, checklist state, your study plan and your exam date.</dd>
</dl>

<p><strong>What is deliberately not collected.</strong> No location, no device fingerprint, no browsing history, no
contact list, no behavioural profile. Your IP address is used, in memory only, to rate-limit sign-ups and sign-in
attempts so the service cannot be flooded — it is <em>never written to the database</em> and does not survive a
restart.</p>

<h2>Why, and on what legal basis</h2>
<p>Under the UK/EU GDPR the basis is <strong>performance of a contract</strong>: you asked for an account and the
application cannot provide one without storing an identity and the progress attached to it. Security measures such as
rate limiting rest on <strong>legitimate interests</strong> — keeping the service available for everyone. Under India's
Digital Personal Data Protection Act the equivalent basis is the <strong>certain legitimate use</strong> of data you
voluntarily provided for exactly this purpose.</p>
<p>No processing here relies on consent, which is why there is no consent banner. See
<a href="#cookies">cookies and local storage</a> below.</p>

<h2>How long it is kept</h2>
<dl class="facts">
<dt>Your account</dt><dd>Until you delete it. There is no automatic expiry on a real account.</dd>
<dt>Sign-in sessions</dt><dd>${SESSION_DAYS} days, then they expire on both the cookie and the server.</dd>
<dt>Password reset links</dt><dd>${RESET_TOKEN_HOURS} hour, then the token is void.</dd>
<dt>Demo (guest) accounts</dt><dd>Deleted automatically after ${GUEST_TTL_DAYS} days of inactivity, by default.</dd>
</dl>
<p>Deletion is real deletion — the database rows are removed, not flagged as hidden. There is no archive and no backup
copy the operator can restore from, which is the same reason deletion is irreversible for you.</p>

<h2>Who else is involved</h2>
<p>The service runs on infrastructure operated by other companies. They process data strictly to provide their service,
and nothing here is sold or shared for any other purpose:</p>
<table><thead><tr><th>Provider</th><th>What they do</th></tr></thead><tbody>
${rows}
</tbody></table>
<p>Because the service is hosted in a single region, data may be processed outside your own country. If you are in the
UK or EU that is an international transfer, made under the hosting provider's own standard contractual clauses.</p>

<h2 id="cookies">Cookies and local storage</h2>
<p>This is the complete list. There are no others, and none of them track you.</p>
<table><thead><tr><th>Name</th><th>Kind</th><th>Purpose</th><th>Lifetime</th></tr></thead><tbody>
<tr><td><code>snowprep_session</code></td><td>Cookie</td><td>Keeps you signed in. <code>HttpOnly</code>, <code>SameSite=Lax</code>, and <code>Secure</code> over HTTPS, so it cannot be read by scripts or sent from another site.</td><td>${SESSION_DAYS} days</td></tr>
<tr><td><code>snowprep_oauth_state</code></td><td>Cookie</td><td>Set only during a Google sign-in, to prove the reply came back from the request you started (CSRF protection). Deleted the moment sign-in completes.</td><td>10 minutes</td></tr>
<tr><td><code>snowprep.progress</code></td><td>Local storage</td><td>Your progress, and your light/dark preference, when the app is used without a server account. On this site it is read to apply your theme before the page paints, so the interface does not flash.</td><td>Until you clear it</td></tr>
</tbody></table>
<p><strong>Why you are not asked to consent.</strong> Consent is required for storage that is not necessary for a
service you asked for — analytics, advertising, cross-site tracking. Every item above is strictly necessary: without
them you cannot stay signed in, cannot sign in with Google safely, and the interface flashes the wrong theme. There is
nothing here to opt out of, so a banner would be a box to dismiss rather than a choice to make. Clearing your browser's
cookies for this site signs you out; nothing else breaks.</p>

<h2>Your rights, and how to actually use them</h2>
<p>You do not need to ask permission or wait for a reply to exercise the two that matter most:</p>
<dl class="facts">
<dt>Access and portability</dt><dd><strong>Settings → Export</strong> downloads your entire progress as one JSON file, immediately.</dd>
<dt>Erasure</dt><dd><strong>Settings → Delete my account</strong> removes your account and everything in it, immediately and permanently. It asks for your password again first, because it cannot be undone.</dd>
<dt>Rectification</dt><dd>Change your display name or password in Settings at any time.</dd>
</dl>
<p>For anything else — a correction you cannot make yourself, a restriction or objection request, or a question about
any of this — write to <a href="mailto:${esc(cfg.contactEmail)}">${esc(cfg.contactEmail)}</a>. Expect a reply within 30
days; in practice it will be much sooner. This is a personal project run by one person, not a support desk.</p>
<p>If you are in the UK or EU you have the right to complain to your national data protection authority. In India you
may complain to the Data Protection Board. Raising it directly first is usually faster.</p>

<h2>Children</h2>
<p>This service is intended for people preparing for a professional certification and is not directed at children. If
you are under 16, please do not create an account. If you believe a child has, write to the address above and it will
be deleted.</p>

<h2>Security</h2>
<p>Passwords are hashed with scrypt. Sessions use <code>HttpOnly</code> cookies. Traffic is served over HTTPS with
HSTS, and the application sets a Content Security Policy that forbids loading code from anywhere but itself. No system
is perfectly secure, and this one is maintained by one person in their spare time — that is stated plainly rather than
implied away. See <a href="/security/">Security</a> to report a vulnerability.</p>

<h2>Changes</h2>
<p>Material changes will be reflected here with a new date at the top of the page. There is no mailing list to notify,
because no marketing email is ever sent.</p>`,
  });
}

function renderTerms(cfg: LegalConfig): StaticFile {
  return legalPage(cfg, {
    title: "Terms of use",
    description: `The terms you accept by using ${cfg.productName}, including what the practice content does and does not promise.`,
    path: "terms",
    body: `<p>By using ${esc(cfg.productName)} you agree to these terms. They are deliberately short. The service is
free, and it is operated by ${esc(cfg.operatorName)}, ${esc(cfg.operatorForm)}, based in ${esc(cfg.jurisdiction)}.</p>

<h2>What this is</h2>
<p>A free study application for the Snowflake SnowPro Core (COF-C03) certification. There is no charge, no trial and no
paid tier. Nothing is sold through this site and no payment details are ever collected.</p>

<h2>No guarantee of passing — read this one</h2>
<p>The notes and practice questions are <strong>original work</strong>, written independently and checked against
Snowflake's publicly available exam guide and documentation. They are <strong>not</strong> real exam questions, not
sourced from any exam, and not endorsed by anyone.</p>
<p>The readiness score is an estimate produced by this application from your answers to <em>its own</em> questions. It
is not a prediction and carries no weight with anyone. <strong>Scoring well here does not mean you will pass, and
scoring badly does not mean you will fail.</strong> Certification requirements change; content here may be out of date
relative to the current exam. Verify anything that matters against Snowflake's own documentation.</p>
<p>The service is provided “as is”, without warranties of any kind. To the fullest extent the law allows, the operator
is not liable for any loss arising from your use of it — including exam outcomes, exam fees, or lost study data.</p>

<h2>Acceptable use</h2>
<ul>
<li>Use it to study. Personal, non-commercial use.</li>
<li>Do not attempt to break, overload, or gain unauthorised access to the service or to other people's accounts.</li>
<li>Do not scrape or bulk-download the content in order to republish or sell it.</li>
<li>Do not upload anything unlawful, and do not use the service to harm anyone.</li>
<li>One account per person. Do not share credentials.</li>
</ul>
<p>Accounts that break these terms may be suspended or removed. For a free service with no payment relationship this is
the only remedy available, and it will be used sparingly.</p>

<h2>Your account and your content</h2>
<p>You are responsible for keeping your password secure. Your study data belongs to you: export it whenever you like,
and delete it whenever you like, both from Settings. Deleting your account is immediate and permanent — see
<a href="/privacy/">Privacy</a>.</p>
<p>The service may change or be discontinued at any time. It is a personal project, offered for free, with no service
level promised. If it is ever shut down, reasonable notice will be given on this site so you can export your data.</p>

<h2>Age</h2>
<p>This service is not directed at children and you must be at least 16 to create an account.</p>

<h2>Trademarks</h2>
<p>This is an independent, unofficial project. It is <strong>not affiliated with, endorsed by, or sponsored by
Snowflake Inc.</strong> “Snowflake”, “SnowPro” and related marks are trademarks of Snowflake Inc., used here only to
describe what the study material covers — nominative use, no claim of ownership or association is made.</p>

<h2>Governing law</h2>
<p>These terms are governed by the laws of ${esc(cfg.jurisdiction)}. Nothing here removes any consumer right you have
under the law of your own country that cannot be waived by agreement.</p>

<h2>Contact</h2>
<p><a href="mailto:${esc(cfg.contactEmail)}">${esc(cfg.contactEmail)}</a></p>`,
  });
}

function renderAbout(cfg: LegalConfig): StaticFile {
  return legalPage(cfg, {
    title: "About",
    description: `Who operates ${cfg.productName}, and how to get in touch.`,
    path: "about",
    body: `<p>${esc(cfg.productName)} is a free study application for the Snowflake SnowPro Core (COF-C03)
certification. It exists because the alternatives were a paywalled question bank you cannot inspect, or a folder of
notes with no way to test yourself against them.</p>

<h2>Who runs it</h2>
<dl class="facts">
<dt>Operator</dt><dd>${esc(cfg.operatorName)}</dd>
<dt>Status</dt><dd>${esc(cfg.operatorForm)}</dd>
<dt>Based in</dt><dd>${esc(cfg.jurisdiction)}</dd>
<dt>Contact</dt><dd><a href="mailto:${esc(cfg.contactEmail)}">${esc(cfg.contactEmail)}</a></dd>
</dl>
<p>This is a personal project maintained by one person. There is no company behind it, no team, and no support desk —
which is stated here so expectations are set correctly rather than discovered later. Email reaches a real person and is
usually answered within a few days.</p>

<h2>Money</h2>
<p>There is none. The service is free, carries no advertising, has no paid tier, and collects no payment details. It is
not funded by selling or sharing your data — see <a href="/privacy/">Privacy</a>, which describes exactly what happens
to it.</p>

<h2>The content</h2>
<p>Every note and every practice question is original work, written independently and checked against Snowflake's
publicly available exam guide and documentation. None of it is taken from a real exam. It reflects the author's own
understanding, and where that understanding is wrong the fastest way to fix it is to say so — corrections are welcome
at the address above.</p>

<h2>The unofficial part, plainly</h2>
<p>This project is not affiliated with, endorsed by, or sponsored by Snowflake Inc. “Snowflake” and “SnowPro” are
trademarks of Snowflake Inc. Nothing here is an official study resource, and passing this application's mock exams
confers nothing.</p>`,
  });
}

function renderAccessibility(cfg: LegalConfig): StaticFile {
  return legalPage(cfg, {
    title: "Accessibility",
    description: `Accessibility of ${cfg.productName}: the standard aimed for, what is known to fall short, and how to report a barrier.`,
    path: "accessibility",
    body: `<p>This statement covers ${esc(cfg.productName)}, operated by ${esc(cfg.operatorName)}. It is written to be useful
rather than reassuring: it says what has actually been done, and names what has not.</p>

<h2>The standard aimed for</h2>
<p><strong>WCAG 2.2 Level AA.</strong> That is the target, not a claim of conformance. No independent audit has been
carried out, and no automated tool has been treated as if it were one, so this page claims <em>partial</em> conformance
and nothing more. A blanket claim would be easy to write and impossible to stand behind.</p>

<h2>What has been done</h2>
<ul>
<li>Every interactive control is a real button, link or input, reachable and operable by keyboard.</li>
<li>Text alternatives on images that carry meaning, and empty alternatives on ones that are decorative.</li>
<li>Colour is never the only way information is conveyed — a wrong answer is labelled, not merely tinted red.</li>
<li>A light and a dark theme, both checked for contrast on body text.</li>
<li>Layouts reflow to narrow screens without a horizontal scrollbar, and tolerate browser zoom.</li>
<li>Form fields have real labels, and errors are described in words rather than by colour alone.</li>
</ul>

<h2>Known gaps</h2>
<p>Stated honestly, because a person deciding whether this tool will work for them deserves to know before they invest
time in it:</p>
<ul>
<li><strong>No screen-reader testing has been done</strong> with NVDA, JAWS or VoiceOver. Semantic markup gets some of
the way there by construction, but that is not the same as having been used.</li>
<li>The timed mock-exam runner is the most complex screen in the application, and its keyboard order and live
announcements have not been verified against assistive technology.</li>
<li>The analytics charts convey their meaning visually. Underlying numbers appear in adjacent tables, but the charts
themselves are not separately described.</li>
<li>No formal audit has been commissioned. This is a free project maintained by one person.</li>
</ul>

<h2>If something blocks you</h2>
<p>Please write to <a href="mailto:${esc(cfg.contactEmail)}">${esc(cfg.contactEmail)}</a> and describe what you were
trying to do, which page, and what assistive technology you were using. Accessibility reports are treated as bugs, not
as feature requests, and specific ones get fixed fastest.</p>
<p>If you need something on this site in a different format in order to use it, ask — it will be provided.</p>`,
  });
}

function renderSecurity(cfg: LegalConfig): StaticFile {
  return legalPage(cfg, {
    title: "Security",
    description: `How to report a security vulnerability in ${cfg.productName}.`,
    path: "security",
    body: `<p>If you have found a security problem, thank you — please report it privately using the address below
rather than posting it publicly, and give it a reasonable chance to be fixed before disclosing it.</p>

<h2>How to report</h2>
<p>Email <a href="mailto:${esc(cfg.contactEmail)}">${esc(cfg.contactEmail)}</a>. Include what you found, the steps to
reproduce it, and what an attacker could actually do with it. A proof of concept helps enormously.</p>
<p>Expect an acknowledgement within a few days. This is a personal project maintained by one person in their own time,
so fixes are best-effort and there is <strong>no bug bounty</strong> — that is said up front rather than after you have
spent your evening on it.</p>

<h2>In scope</h2>
<ul>
<li>Authentication and session handling.</li>
<li>Anything that lets one account read or modify another account's data.</li>
<li>The demo (guest) sign-in path, which is the one endpoint that writes to the database without authentication.</li>
<li>Privilege escalation to an administrator role.</li>
</ul>

<h2>Out of scope</h2>
<ul>
<li><strong>The study content being publicly readable.</strong> The notes and the practice bundle are served without
authentication deliberately — the demo mints a session in one click, so an authentication gate there would stop no
determined scraper while costing every genuine visitor a round trip. This is a decision, not an access-control bug.</li>
<li>Missing rate limits on read-only endpoints. Write paths are limited; reads are not, and that is accepted at this
scale.</li>
<li>Anything requiring physical or already-privileged access to the server.</li>
<li>Automated scanner output with no demonstrated impact.</li>
<li>Reports that amount to a missing hardening header with no exploitable consequence.</li>
</ul>

<h2>Safe harbour</h2>
<p>Research conducted in good faith under this policy — without degrading the service for others, without accessing or
modifying data belonging to anyone else, and without publicly disclosing before a fix — is welcome, and no legal action
will be pursued over it. If in doubt about whether something crosses that line, ask first.</p>

<p>A machine-readable version of this policy is at
<a href="/.well-known/security.txt"><code>/.well-known/security.txt</code></a>.</p>`,
  });
}

/** RFC 9116. `Expires` is mandatory and must be in the future; it is computed at render time, which
 *  is container boot, so a redeployed instance always ships a fresh one. */
function renderSecurityTxt(cfg: LegalConfig): StaticFile {
  const expires = new Date(Date.now() + SECURITY_TXT_VALID_DAYS * 86_400_000).toISOString().replace(/\.\d{3}Z$/, "Z");
  return {
    relPath: ".well-known/security.txt",
    contents: `# Security contact for ${cfg.productName} (${cfg.siteOrigin})
# https://www.rfc-editor.org/rfc/rfc9116

Contact: mailto:${cfg.contactEmail}
Expires: ${expires}
Policy: ${cfg.siteOrigin}/security/
Preferred-Languages: en
Canonical: ${cfg.siteOrigin}/.well-known/security.txt
`,
  };
}

/** Paths, without leading or trailing slashes, of the legal pages that belong in the sitemap.
 *  Exported so `renderSitemap()` in staticPages.ts lists exactly what was generated rather than
 *  keeping a second hand-maintained list that can disagree with reality. */
export const LEGAL_PAGE_PATHS = ["privacy", "terms", "about", "accessibility", "security"] as const;

/** Every legal file, or an empty array when this deployment has not declared an operator. Callers
 *  can concatenate unconditionally. */
export function renderLegalPages(cfg: LegalConfig | null): StaticFile[] {
  if (!cfg) return [];
  return [
    renderPrivacy(cfg),
    renderTerms(cfg),
    renderAbout(cfg),
    renderAccessibility(cfg),
    renderSecurity(cfg),
    renderSecurityTxt(cfg),
  ];
}
