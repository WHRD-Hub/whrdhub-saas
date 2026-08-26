import { Fragment, type ReactNode } from "react";

/**
 * A tiny, dependency-free, XSS-safe Markdown renderer for chat messages.
 * It renders to React elements (never dangerouslySetInnerHTML) and supports the
 * common subset LLMs produce: headings, bold, italic, inline code, links,
 * unordered/ordered lists, and paragraphs. Anything it doesn't recognise is
 * rendered as plain text.
 */

// ── inline: **bold**, *italic*, `code`, [text](url) ──────────────────────────
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // Order matters: code first (so ** inside code is literal), then links, bold, italic.
  const pattern = /(`[^`]+`)|(\[[^\]]+\]\((?:https?:\/\/|mailto:|tel:)[^)\s]+\))|(\*\*[^*]+\*\*)|(\*[^*]+\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) nodes.push(<Fragment key={`${keyPrefix}-t${i}`}>{text.slice(last, m.index)}</Fragment>);
    const tok = m[0];
    const key = `${keyPrefix}-m${i}`;
    if (tok.startsWith("`")) {
      nodes.push(<code key={key} className="px-1 py-0.5 rounded bg-black/10 font-mono text-[0.85em]">{tok.slice(1, -1)}</code>);
    } else if (tok.startsWith("[")) {
      const mm = /\[([^\]]+)\]\(([^)]+)\)/.exec(tok);
      if (mm) {
        nodes.push(
          <a key={key} href={mm[2]} target="_blank" rel="noopener noreferrer" className="underline text-purple break-words">{mm[1]}</a>,
        );
      }
    } else if (tok.startsWith("**")) {
      nodes.push(<strong key={key}>{tok.slice(2, -2)}</strong>);
    } else {
      nodes.push(<em key={key}>{tok.slice(1, -1)}</em>);
    }
    last = m.index + tok.length;
    i++;
  }
  if (last < text.length) nodes.push(<Fragment key={`${keyPrefix}-tend`}>{text.slice(last)}</Fragment>);
  return nodes;
}

// ── block level ──────────────────────────────────────────────────────────────
export function MarkdownLite({ content }: { content: string }) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  const isUl = (l: string) => /^\s*[-*]\s+/.test(l);
  const isOl = (l: string) => /^\s*\d+\.\s+/.test(l);

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") { i++; continue; }

    // Headings
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      const cls = level === 1 ? "text-base font-bold mt-1" : level === 2 ? "text-sm font-bold mt-1" : "text-sm font-semibold mt-1";
      blocks.push(<p key={key++} className={cls}>{renderInline(h[2], `h${key}`)}</p>);
      i++;
      continue;
    }

    // Unordered list
    if (isUl(line)) {
      const items: ReactNode[] = [];
      while (i < lines.length && isUl(lines[i])) {
        const txt = lines[i].replace(/^\s*[-*]\s+/, "");
        items.push(<li key={items.length}>{renderInline(txt, `ul${key}-${items.length}`)}</li>);
        i++;
      }
      blocks.push(<ul key={key++} className="list-disc pl-5 space-y-1">{items}</ul>);
      continue;
    }

    // Ordered list
    if (isOl(line)) {
      const items: ReactNode[] = [];
      while (i < lines.length && isOl(lines[i])) {
        const txt = lines[i].replace(/^\s*\d+\.\s+/, "");
        items.push(<li key={items.length}>{renderInline(txt, `ol${key}-${items.length}`)}</li>);
        i++;
      }
      blocks.push(<ol key={key++} className="list-decimal pl-5 space-y-1">{items}</ol>);
      continue;
    }

    // Paragraph (gather consecutive non-blank, non-structural lines)
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !isUl(lines[i]) && !isOl(lines[i]) && !/^#{1,3}\s/.test(lines[i])) {
      para.push(lines[i]);
      i++;
    }
    blocks.push(<p key={key++}>{renderInline(para.join("\n"), `p${key}`)}</p>);
  }

  return <div className="space-y-2 [&_p]:whitespace-pre-wrap">{blocks}</div>;
}
