/* bitGen Studio — static/bgxml.js (2.436.0): bitGen's PROJECT FILES as XML, window.BgXml (and require() in Node).
 *
 * Tim (verbatim): "save image edit project as .bgi, save video project as .bgv, save the overall project as .bgp in xml
 * format" (+ "Both": a .bgp self-contained or a manifest; .bgi a zip with its document as XML, .bgv XML).
 *
 *   toXml(value, tag)    any JSON value -> XML: objects <o>, arrays <a>, strings <s>, numbers <n>, true / false <b>,
 *                        null <z/>; each member of an object carries k="<its key>". Readable, diffable, and exactly
 *                        the value back (fromXml) - numbers as written by JS, strings escaped (control characters as
 *                        &#x..;).
 *   fromXml(text)        the first value element's JSON back (a small parser of the XML this file writes: elements,
 *                        attributes, text, CDATA, the 5 named entities and numeric ones; comments / <?xml ?> skipped)
 *   parse(text)          -> a light tree {tag, attrs, kids, text} (used by fromXml, the .bgp reader)
 *   doc(rootTag, attrs, parts)   an XML document: <?xml?> + <root attrs> + the parts (already XML) + </root>
 *   esc(t) / attr(t)     text / attribute escaping
 */
(function (root) {
  "use strict";
  const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, (c) => "&#x" + c.charCodeAt(0).toString(16) + ";");
  const attr = (t) => esc(t).replace(/"/g, "&quot;").replace(/\n/g, "&#xa;").replace(/\r/g, "&#xd;").replace(/\t/g, "&#x9;");
  /** a JSON value as XML (indent: 0 = one line) */
  function toXml(v, tag, key, ind) {
    const k = key == null ? "" : ` k="${attr(key)}"`, pad = ind == null ? "" : "\n" + "  ".repeat(ind), nx = ind == null ? null : ind + 1;
    if (v === null || v === undefined || (typeof v === "number" && !Number.isFinite(v))) return `${pad}<z${k}/>`;
    if (typeof v === "string") return `${pad}<s${k}>${esc(v)}</s>`;
    if (typeof v === "number") return `${pad}<n${k}>${String(v)}</n>`;
    if (typeof v === "boolean") return `${pad}<b${k}>${v ? "true" : "false"}</b>`;
    if (Array.isArray(v)) return `${pad}<a${k}>${v.map((x) => toXml(x, null, null, nx)).join("")}${v.length && pad ? pad : ""}</a>`;
    if (typeof v === "object") {
      const keys = Object.keys(v).filter((x) => v[x] !== undefined && typeof v[x] !== "function");
      const inner = keys.map((x) => toXml(v[x], null, x, nx)).join("");
      return `${pad}<o${k}>${inner}${keys.length && pad ? pad : ""}</o>`;
    }
    return `${pad}<z${k}/>`;
  }
  function doc(rootTag, attrs, parts) {
    const a = Object.keys(attrs || {}).filter((x) => attrs[x] != null).map((x) => ` ${x}="${attr(attrs[x])}"`).join("");
    return `<?xml version="1.0" encoding="UTF-8"?>\n<${rootTag}${a}>${(parts || []).join("")}\n</${rootTag}>\n`;
  }
  /* ---------------- reading ---------------- */
  const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
  const unesc = (t) => t.replace(/&(#x[0-9a-f]+|#[0-9]+|amp|lt|gt|quot|apos);/gi, (m, e) => (e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENT[e.toLowerCase()]));
  /** a light tree of the XML: {tag, attrs, kids: [nodes], text} (text = the joined text of the element itself) */
  function parse(src) {
    const s = String(src), top = { tag: "#doc", attrs: {}, kids: [], text: "" }, stack = [top];
    let i = 0;
    while (i < s.length) {
      const lt = s.indexOf("<", i);
      const textEnd = lt < 0 ? s.length : lt;
      if (textEnd > i) { const t = s.slice(i, textEnd); stack[stack.length - 1].text += unesc(t); }
      if (lt < 0) break;
      if (s.startsWith("<!--", lt)) { const e = s.indexOf("-->", lt + 4); i = e < 0 ? s.length : e + 3; continue; }
      if (s.startsWith("<?", lt)) { const e = s.indexOf("?>", lt + 2); i = e < 0 ? s.length : e + 2; continue; }
      if (s.startsWith("<![CDATA[", lt)) { const e = s.indexOf("]]>", lt + 9); stack[stack.length - 1].text += s.slice(lt + 9, e < 0 ? s.length : e); i = e < 0 ? s.length : e + 3; continue; }
      if (s.startsWith("<!", lt)) { const e = s.indexOf(">", lt); i = e < 0 ? s.length : e + 1; continue; }
      const gt = s.indexOf(">", lt); if (gt < 0) throw new Error("bad XML: an unclosed tag at " + lt);
      let body = s.slice(lt + 1, gt);
      if (body[0] === "/") {
        const name = body.slice(1).trim(), cur = stack.pop();
        if (!cur || cur.tag !== name) throw new Error(`bad XML: </${name}> closes <${cur && cur.tag}>`);
        i = gt + 1; continue;
      }
      const self = body.endsWith("/"); if (self) body = body.slice(0, -1);
      const m = /^([A-Za-z_][\w.:-]*)/.exec(body); if (!m) throw new Error("bad XML: a tag without a name at " + lt);
      const node = { tag: m[1], attrs: {}, kids: [], text: "" };
      const re = /([A-Za-z_][\w.:-]*)\s*=\s*("([^"]*)"|'([^']*)')/g; let a;
      while ((a = re.exec(body.slice(m[1].length)))) node.attrs[a[1]] = unesc(a[3] != null ? a[3] : a[4]);
      stack[stack.length - 1].kids.push(node);
      if (!self) stack.push(node);
      i = gt + 1;
    }
    if (stack.length !== 1) throw new Error("bad XML: <" + stack[stack.length - 1].tag + "> is not closed");
    return top;
  }
  /** a value element (o / a / s / n / b / z) -> JSON */
  function valueOf(n) {
    switch (n.tag) {
      case "z": return null;
      case "s": return n.text;
      case "n": { const v = Number(n.text.trim()); return Number.isFinite(v) ? v : null; }
      case "b": return n.text.trim() === "true";
      case "a": return n.kids.map(valueOf);
      case "o": { const o = {}; for (const k of n.kids) if (k.attrs.k != null) o[k.attrs.k] = valueOf(k); return o; }
      default: return undefined;
    }
  }
  const VALUE = { o: 1, a: 1, s: 1, n: 1, b: 1, z: 1 };
  /** the first value element inside node (deep-first) */
  function firstValue(node) { for (const k of node.kids) { if (VALUE[k.tag]) return k; const f = firstValue(k); if (f) return f; } return null; }
  function fromXml(text) { const t = typeof text === "string" ? parse(text) : text; const v = firstValue(t); return v ? valueOf(v) : undefined; }
  /** a child element by tag (the first) / all of them */
  const child = (n, tag) => (n && n.kids.find((k) => k.tag === tag)) || null;
  const children = (n, tag) => (n ? n.kids.filter((k) => k.tag === tag) : []);
  const BgXml = { toXml, fromXml, parse, valueOf, firstValue, doc, esc, attr, unesc, child, children };
  if (typeof module !== "undefined" && module.exports) module.exports = BgXml;
  else root.BgXml = BgXml;
})(typeof window !== "undefined" ? window : globalThis);
