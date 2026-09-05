/**
 * Who operates this deployment — resolved from the environment, never hardcoded.
 *
 * WHY THIS IS CONFIG AND NOT PROSE, and why it is the one thing in this codebase that must not
 * carry a default: this repository is public. A privacy policy names a real operator, a real
 * contact address and a real jurisdiction, and it is a statement that person is legally answerable
 * for. If any of that were baked into the source, everyone who deploys this image would publish a
 * policy naming somebody else as the controller of *their* users' data — which is worse than
 * publishing no policy at all, because it is confidently wrong and points data-subject requests at
 * a stranger.
 *
 * So: `resolveLegalConfig()` returns `null` unless the operator identity is explicitly declared,
 * and `legalPages.ts` generates nothing when it does. An unconfigured deployment has no legal
 * pages, which is the honest state. Deliberately *not* modelled on `guestMode.ts`'s "default off
 * for safety" — this is "no default is possible", a stronger condition.
 *
 * This is also the template seam. Standing up a different product on this codebase means setting
 * these variables, not editing five documents.
 */

/** Named subprocessors, disclosed in the privacy policy. Derived from configuration rather than
 *  listed in prose so a deployment that has (say) no mailer configured doesn't claim to share data
 *  with a mail provider it never calls. */
export interface Subprocessor {
  name: string;
  purpose: string;
}

export interface LegalConfig {
  /** The natural or legal person answerable for this deployment. */
  operatorName: string;
  /** How the operator is constituted, e.g. "an individual, not a registered company". Free text
   *  because "sole trader"/"private limited company"/"individual" differ by jurisdiction and a
   *  fixed enum would be wrong somewhere. */
  operatorForm: string;
  /** Where the operator is based — sets the governing law and the supervisory authority a
   *  complaint would go to. */
  jurisdiction: string;
  /** A monitored address for privacy, erasure and security-disclosure requests. Published in
   *  plain text: `security.txt` is machine-parsed, so obfuscation would break it. */
  contactEmail: string;
  /** Product name as it appears in the documents. */
  productName: string;
  /** Absolute origin, no trailing slash — canonicals, `security.txt` Canonical, sitemap entries.
   *  Required, with no default, for the same reason the operator is: a canonical URL is a claim
   *  about *where this document lives*, and defaulting it would point every self-hoster's policy at
   *  somebody else's domain. */
  siteOrigin: string;
  subprocessors: Subprocessor[];
}

const DEFAULT_PRODUCT_NAME = "SnowPro Core Prep";
const DEFAULT_OPERATOR_FORM = "an individual, not a registered company";

/** Loose on purpose. This is a typo check, not validation — the address is the operator's own and
 *  the cost of a false rejection (no legal pages ship at all) is far higher than the cost of
 *  accepting something odd. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(raw: string | undefined): string {
  return raw?.trim() ?? "";
}

/** Resolves the operator identity, or `null` if this deployment hasn't declared one.
 *
 *  `null` is a normal, expected state — a LAN or localhost instance has no public audience and
 *  nothing to disclose to. It is not an error and must not be treated as one beyond a boot-time
 *  notice, because failing the build here would mean a self-hoster's container refuses to start
 *  over paperwork it doesn't need. */
export function resolveLegalConfig(env: NodeJS.ProcessEnv = process.env): LegalConfig | null {
  const operatorName = clean(env.SNOWPRO_LEGAL_OPERATOR);
  const contactEmail = clean(env.SNOWPRO_LEGAL_CONTACT);
  const siteOrigin = clean(env.SNOWPRO_SITE_ORIGIN).replace(/\/+$/, "");

  // All three are required together. A policy with a named operator and no way to reach them cannot
  // satisfy a data-subject request; a contact address with no named controller doesn't say who is
  // answerable; and a canonical URL pointing at someone else's domain makes the document claim to
  // live somewhere it doesn't. Any one missing yields a page that looks compliant and isn't.
  if (operatorName === "" || !EMAIL_RE.test(contactEmail)) return null;
  if (!/^https?:\/\/[^\s/]+$/.test(siteOrigin)) return null;

  // Built from what is actually configured. Google appears only when OAuth is wired up, and the
  // mail provider only when a key exists -- claiming to share data with a processor this instance
  // never contacts is its own kind of inaccuracy, and the opposite error (omitting one that IS in
  // use) is the one that actually matters, so both are keyed off the same variables the code
  // itself checks.
  const subprocessors: Subprocessor[] = [
    { name: "Railway", purpose: "Hosting and database storage for this application." },
  ];
  if (clean(env.SNOWPRO_GOOGLE_CLIENT_ID) !== "") {
    subprocessors.push({
      name: "Google",
      purpose:
        "Sign-in, and only if you choose “Continue with Google”. Google confirms your identity to us; we never receive your Google password.",
    });
  }
  if (clean(env.SNOWPRO_EMAIL_API_KEY) !== "") {
    subprocessors.push({
      name: "Brevo",
      purpose:
        "Delivering transactional email — a welcome message and password-reset links. No marketing email is sent, ever.",
    });
  }

  return {
    operatorName,
    operatorForm: clean(env.SNOWPRO_LEGAL_OPERATOR_FORM) || DEFAULT_OPERATOR_FORM,
    jurisdiction: clean(env.SNOWPRO_LEGAL_JURISDICTION) || "India",
    contactEmail,
    productName: clean(env.SNOWPRO_LEGAL_PRODUCT_NAME) || DEFAULT_PRODUCT_NAME,
    siteOrigin,
    subprocessors,
  };
}
