/**
 * Renders the small inline-markdown subset (bold/code/italic) that appears in question stems,
 * option text, and explanations — real React elements, not dangerouslySetInnerHTML, since this
 * content is author-controlled markdown fed straight through from the source files (see
 * pipeline's questionCore.ts), not pre-rendered HTML like Notes' sections are. The state-machine
 * parser only ever captures single-paragraph text spans here, so links/headings/lists never
 * appear in practice — anything unrecognized is left as literal text rather than mis-parsed.
 */

import type { ReactNode } from "react";

const TOKEN_RE = /\*\*(.+?)\*\*|`(.+?)`|\*(.+?)\*/g;

export function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  for (const match of text.matchAll(TOKEN_RE)) {
    const index = match.index ?? 0;
    if (index > lastIndex) nodes.push(text.slice(lastIndex, index));
    const [full, bold, code, italic] = match;
    if (bold !== undefined) nodes.push(<strong key={key++}>{bold}</strong>);
    else if (code !== undefined) nodes.push(<code key={key++}>{code}</code>);
    else if (italic !== undefined) nodes.push(<em key={key++}>{italic}</em>);
    lastIndex = index + full.length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}
