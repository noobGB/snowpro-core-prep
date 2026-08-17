/**
 * Thin wrapper around the unified/remark/rehype ecosystem, used by every parser except the
 * practice-question ones (which use a custom line-based state machine instead — see
 * questionCore.ts for why). Two pipelines are exposed: one that only parses to an mdast tree
 * (for walking headings/lists/tables structurally), and one that renders a slice of that tree
 * back to HTML (for the notes reader's prose bodies).
 */

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import { toString as mdastToString } from "mdast-util-to-string";
import type { Root, RootContent, Heading } from "mdast";

const parser = unified().use(remarkParse).use(remarkGfm);

export function parseMd(raw: string): Root {
  return parser.parse(raw) as Root;
}

const htmlRenderer = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeStringify);

/** Renders a slice of mdast nodes (e.g. everything between one heading and the next) to HTML by
 *  wrapping them in a synthetic root and running the full remark->rehype->HTML pipeline. */
export function nodesToHtml(nodes: RootContent[]): string {
  const root: Root = { type: "root", children: nodes };
  return String(htmlRenderer.stringify(htmlRenderer.runSync(root) as Parameters<typeof htmlRenderer.stringify>[0]));
}

/** Flattens any node's inline content (text, inlineCode, strong, emphasis, links) to plain text,
 *  collapsing whitespace — including literal newlines mdast preserves for a soft line-wrap
 *  within a paragraph, which otherwise break any regex anchored with `.`/`$` on the result. */
export function flattenText(node: RootContent): string {
  return mdastToString(node).replace(/\s+/g, " ").trim();
}

/** Flattens a heading's inline children — used both as slugify() input and as search-index
 *  heading text. */
export function headingText(node: Heading): string {
  return flattenText(node);
}

export function headingDepth(node: RootContent): number | null {
  return node.type === "heading" ? (node as Heading).depth : null;
}
