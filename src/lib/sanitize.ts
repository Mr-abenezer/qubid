// Tiny, dependency-free HTML sanitizer for admin-authored broadcast messages.
// Keeps formatting tags/attributes, strips anything executable.

const ALLOWED_TAGS = new Set([
  "a", "b", "i", "u", "em", "strong", "small", "br", "p", "div", "span",
  "ul", "ol", "li", "h1", "h2", "h3", "h4", "mark", "sub", "sup", "blockquote",
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "target", "rel"]),
  span: new Set(["style"]),
  div: new Set(["style"]),
  p: new Set(["style"]),
};

function cleanStyle(style: string): string {
  // only allow color / font-weight / text-decoration style hints
  return style
    .split(";")
    .map((s) => s.trim())
    .filter((s) => /^(color|font-weight|text-decoration)\s*:/i.test(s) && !/url\(|expression\(|javascript:/i.test(s))
    .join("; ");
}

export function sanitizeHtml(html: string): string {
  if (typeof DOMParser === "undefined") return escapeHtml(html);
  const doc = new DOMParser().parseFromString(html, "text/html");
  const walk = (node: Element): Element | null => {
    const tag = node.tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) {
      // drop the tag but keep its text children
      const frag = document.createElement("span");
      node.childNodes.forEach((c) => frag.appendChild(c.cloneNode(true)));
      return frag;
    }
    const out = document.createElement(tag);
    const allowed = ALLOWED_ATTRS[tag];
    for (const attr of Array.from(node.attributes)) {
      const name = attr.name.toLowerCase();
      if (!allowed?.has(name)) continue;
      let val = attr.value;
      if (name === "href") {
        if (!/^(https?:|mailto:|tg:)/i.test(val.trim())) continue;
        out.setAttribute("target", "_blank");
        out.setAttribute("rel", "noopener noreferrer");
      }
      if (name === "style") val = cleanStyle(val);
      if (val) out.setAttribute(name, val);
    }
    node.childNodes.forEach((c) => {
      if (c.nodeType === Node.TEXT_NODE) out.appendChild(document.createTextNode(c.textContent ?? ""));
      else if (c.nodeType === Node.ELEMENT_NODE) {
        const cleaned = walk(c as Element);
        if (cleaned) out.appendChild(cleaned);
      }
    });
    return out;
  };
  const root = document.createElement("div");
  doc.body.childNodes.forEach((c) => {
    if (c.nodeType === Node.TEXT_NODE) root.appendChild(document.createTextNode(c.textContent ?? ""));
    else if (c.nodeType === Node.ELEMENT_NODE) {
      const cleaned = walk(c as Element);
      if (cleaned) root.appendChild(cleaned);
    }
  });
  return root.innerHTML;
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
