/**
 * Parses resources (07) into Resource records. The file has six "##" sections (Verification
 * status, Official / primary sources, Official study resources by domain, Hands-on practice,
 * Practice questions — a caution, Logistics) — this is an explicit heading allowlist, not a
 * generic "walk every H2" loop, since a generic walk would turn e.g. "## Logistics" bullets like
 * "Cost: $175 per attempt" into garbage resource entries with no real title/URL.
 *
 * Only two sections produce entries, both real gaps against the spec's example schema (which
 * shows every resource with a real URL): "Official / primary sources" has bold-label + raw URL
 * per bullet (no domain) -> {domainId: null, url, official: true}. "Official study resources, by
 * domain" has one semicolon-separated course-list bullet per domain with NO URLs at all -> each
 * course name becomes its own entry sharing that bullet's domainId, url: null. Both domainId and
 * url are nullable fields — an additive schema extension driven by what the source contains.
 * The remaining four sections are recognized but intentionally produce no entries (logged as
 * notices, not errors) so a future new section degrades safely.
 */

import type { Heading, List } from "mdast";
import type { Resource } from "../types.js";
import { domainId } from "../util/ids.js";
import { flattenText, headingText, parseMd } from "../util/markdown.js";

const OFFICIAL_SOURCES_HEADING = "Official / primary sources (use these first)";
const BY_DOMAIN_HEADING = 'Official study resources, by domain (from the guide\'s own "Study Resources" sections)';
const KNOWN_NON_PRODUCING_HEADINGS = new Set([
  "Verification status",
  "Hands-on practice (recommended given your work access)",
  "Practice questions — a caution",
  "Logistics",
]);

const LABEL_URL_RE = /^(.+?):\s*(https?:\/\/\S+)/;
const DOMAIN_BULLET_RE = /^Domain (\d)\s*\([^)]*\):\s*(.+)$/;

export interface ResourcesParseResult {
  resources: Resource[];
  notices: string[];
}

function bulletTexts(node: List): string[] {
  return node.children.map((item) => flattenText(item));
}

export function parseResources(raw: string): ResourcesParseResult {
  const root = parseMd(raw);
  const resources: Resource[] = [];
  const notices: string[] = [];

  let currentHeading = "";

  for (const node of root.children) {
    if (node.type === "heading" && (node as Heading).depth === 2) {
      currentHeading = headingText(node as Heading);
      if (
        currentHeading !== OFFICIAL_SOURCES_HEADING &&
        currentHeading !== BY_DOMAIN_HEADING &&
        !KNOWN_NON_PRODUCING_HEADINGS.has(currentHeading)
      ) {
        notices.push(`07_Resources.md: unrecognized section "${currentHeading}" — no resources extracted from it`);
      }
      continue;
    }

    if (node.type !== "list") continue;

    if (currentHeading === OFFICIAL_SOURCES_HEADING) {
      for (const text of bulletTexts(node as List)) {
        const m = text.match(LABEL_URL_RE);
        if (!m) {
          notices.push(`07_Resources.md: no URL found in "${text.slice(0, 60)}..." — skipped`);
          continue;
        }
        resources.push({ domainId: null, title: m[1]!.trim(), url: m[2]!, official: true });
      }
      continue;
    }

    if (currentHeading === BY_DOMAIN_HEADING) {
      for (const text of bulletTexts(node as List)) {
        const m = text.match(DOMAIN_BULLET_RE);
        if (!m) {
          notices.push(`07_Resources.md: could not parse domain-resource bullet "${text.slice(0, 60)}..." — skipped`);
          continue;
        }
        const domain = domainId(Number(m[1]));
        const courses = (m[2] ?? "").split(";").map((s) => s.trim().replace(/\.$/, ""));
        for (const title of courses) {
          if (!title) continue;
          resources.push({ domainId: domain, title, url: null, official: true });
        }
      }
    }
  }

  return { resources, notices };
}
