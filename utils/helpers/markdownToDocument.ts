/**
 * Markdown mínimo → documento de `@keystone-6/fields-document`.
 * Cubre lo que traen los posts armados en ClickUp: párrafos, **negritas**,
 * listas `- ` y `1. `, links, y una línea que es solo negrita (heading 3).
 */

type TextNode = { text: string; bold?: true };
type LinkNode = { type: "link"; href: string; children: TextNode[] };

export type InlineNode = TextNode | LinkNode;

export type ListItemNode = {
  type: "list-item";
  children: [{ type: "list-item-content"; children: InlineNode[] }];
};

export type DocumentNode =
  | { type: "paragraph"; children: InlineNode[] }
  | { type: "heading"; level: 3; children: InlineNode[] }
  | { type: "unordered-list"; children: ListItemNode[] }
  | { type: "ordered-list"; children: ListItemNode[] };

const UNORDERED_ITEM = /^-\s+(.+)$/;
const ORDERED_ITEM = /^\d+\.\s+(.+)$/;
const EXCERPT_MAX = 280;

function isLink(node: InlineNode): node is LinkNode {
  return "type" in node && node.type === "link";
}

/** Slate exige un nodo de texto al borde y entre dos links. */
function padInlines(nodes: InlineNode[]): InlineNode[] {
  if (nodes.length === 0) return [{ text: "" }];
  const padded: InlineNode[] = [];
  nodes.forEach((node, index) => {
    const prev = padded[padded.length - 1];
    if (isLink(node) && (!prev || isLink(prev))) padded.push({ text: "" });
    padded.push(node);
    if (isLink(node) && index === nodes.length - 1) padded.push({ text: "" });
  });
  return padded;
}

function readLink(
  input: string,
  start: number,
  bold: boolean,
): { node: LinkNode; next: number } | null {
  if (input[start] !== "[") return null;
  const labelEnd = input.indexOf("]", start + 1);
  if (labelEnd === -1 || input[labelEnd + 1] !== "(") return null;
  const hrefEnd = input.indexOf(")", labelEnd + 2);
  if (hrefEnd === -1) return null;
  const label = input.slice(start + 1, labelEnd);
  const href = input.slice(labelEnd + 2, hrefEnd).trim();
  if (!label || !href || label.includes("[") || label.includes("]")) return null;
  const text: TextNode = bold ? { text: label, bold: true } : { text: label };
  return { node: { type: "link", href, children: [text] }, next: hrefEnd + 1 };
}

function parseInlines(input: string, bold = false): InlineNode[] {
  const nodes: InlineNode[] = [];
  let buffer = "";

  const flush = () => {
    if (!buffer) return;
    const last = nodes[nodes.length - 1];
    if (last && !isLink(last) && Boolean(last.bold) === bold) {
      last.text += buffer;
    } else {
      nodes.push(bold ? { text: buffer, bold: true } : { text: buffer });
    }
    buffer = "";
  };

  for (let i = 0; i < input.length; ) {
    if (!bold && input.startsWith("**", i)) {
      const close = input.indexOf("**", i + 2);
      if (close !== -1) {
        flush();
        nodes.push(...parseInlines(input.slice(i + 2, close), true));
        i = close + 2;
        continue;
      }
    }
    const link = readLink(input, i, bold);
    if (link) {
      flush();
      nodes.push(link.node);
      i = link.next;
      continue;
    }
    buffer += input[i];
    i += 1;
  }
  flush();
  return nodes.length > 0 ? nodes : [{ text: "" }];
}

/** Línea cuyo único contenido es `**texto**` (puede incluir un link). */
function boldOnlyInner(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("**") || !trimmed.endsWith("**") || trimmed.length < 5) return null;
  const inner = trimmed.slice(2, -2);
  if (!inner.trim() || inner.includes("**")) return null;
  return inner.trim();
}

function listItem(text: string): ListItemNode {
  return {
    type: "list-item",
    children: [{ type: "list-item-content", children: padInlines(parseInlines(text.trim())) }],
  };
}

/** Convierte el markdown de la descripción de ClickUp al JSON del campo `content`. */
export function markdownToDocument(markdown: string): DocumentNode[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: DocumentNode[] = [];
  let paragraphLines: string[] = [];
  let list: { ordered: boolean; items: ListItemNode[] } | null = null;

  const flushParagraph = () => {
    const text = paragraphLines.join(" ").replace(/\s+/g, " ").trim();
    paragraphLines = [];
    if (!text) return;
    blocks.push({ type: "paragraph", children: padInlines(parseInlines(text)) });
  };

  const flushList = () => {
    if (!list || list.items.length === 0) {
      list = null;
      return;
    }
    blocks.push({
      type: list.ordered ? "ordered-list" : "unordered-list",
      children: list.items,
    });
    list = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    const unordered = line.match(UNORDERED_ITEM);
    const ordered = line.match(ORDERED_ITEM);
    if (unordered || ordered) {
      flushParagraph();
      const orderedItem = Boolean(ordered);
      if (!list || list.ordered !== orderedItem) {
        flushList();
        list = { ordered: orderedItem, items: [] };
      }
      list.items.push(listItem((unordered ?? ordered)![1]));
      continue;
    }

    const heading = boldOnlyInner(line);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({ type: "heading", level: 3, children: padInlines(parseInlines(heading)) });
      continue;
    }

    flushList();
    paragraphLines.push(line);
  }

  flushParagraph();
  flushList();
  return blocks;
}

function inlineToText(nodes: InlineNode[]): string {
  return nodes
    .map((node) => (isLink(node) ? node.children.map((child) => child.text).join("") : node.text))
    .join("");
}

/** Primer párrafo en texto plano, cortado en una palabra completa. */
export function excerptFromDocument(nodes: DocumentNode[], max = EXCERPT_MAX): string {
  for (const node of nodes) {
    if (node.type !== "paragraph") continue;
    const text = inlineToText(node.children).replace(/\s+/g, " ").trim();
    if (!text) continue;
    if (text.length <= max) return text;
    const slice = text.slice(0, max);
    const lastSpace = slice.lastIndexOf(" ");
    if (lastSpace <= 0) return slice.trimEnd();
    return slice.slice(0, lastSpace).trimEnd();
  }
  return "";
}
