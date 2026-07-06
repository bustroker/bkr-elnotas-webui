import DOMPurify from "dompurify";
import { marked } from "marked";

const renderer = new marked.Renderer();
renderer.link = ({ href, title, tokens }) => {
  const text = renderer.parser.parseInline(tokens);
  if (href === undefined) {
    return text;
  }

  const titleAttribute = title === null || title === undefined ? "" : ` title="${escapeHtmlAttribute(title)}"`;
  return `<a href="${escapeHtmlAttribute(href)}"${titleAttribute} target="_blank" rel="noopener noreferrer">${text}</a>`;
};

export function renderMarkdown(markdown: string): string {
  return DOMPurify.sanitize(marked.parse(markdown, { async: false, renderer }), {
    ADD_ATTR: ["target", "rel"]
  });
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("\"", "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
