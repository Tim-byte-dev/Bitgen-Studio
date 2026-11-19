/* bitGen Studio — ext/webdock/wbcode.js (2.864.0): the Web editor's </> Code tab as a code editor (Tim: "in web builder code add line
 * numbers, add colors for tags, add a left toolbar for quick tags, highlight a tag if it is not closed, add quick comments to the left
 * toolbar").
 *   the editor   #wbCode (the textarea - it still holds the text) over a coloured copy (#wbCodeHl) with line numbers (#wbCodeNo) beside;
 *                the three scroll together. HTML: tags, attributes, values, comments, the doctype, PHP blocks; .css / .js / .php: comments,
 *                strings, numbers, keywords.
 *   not closed   a tag left open (red; orange for one HTML lets you leave open: <p>, <li>, <td> …) or a closing tag with no opening one;
 *                the line under the editor lists them - a click goes to the tag.
 *   ◧ toolbar    quick tags (wrapping the selection), quick comments (<!-- -->, /* *​/, //, ✎ TODO) and ⌗ comment / uncomment the lines.
 * window.WbCode = {highlight, problems, lineOf, wrap, comment, toggle, refresh} - the pure ones work in Node (tests). */
(function (root) {
  "use strict";
  const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
  const OPTIONAL = new Set(["p", "li", "dt", "dd", "td", "th", "tr", "thead", "tbody", "tfoot", "option", "optgroup", "colgroup", "caption", "rt", "rp", "html", "head", "body"]);
  const RAW = new Set(["script", "style", "textarea", "title"]);
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const kindOf = (p) => /\.(css)$/i.test(p || "") ? "css" : /\.(m?js|json)$/i.test(p || "") ? "js" : /\.php$/i.test(p || "") ? "php" : "html";
  /** the tags of an HTML text: [{at, end, name, close, self}] - comments, the doctype, PHP blocks and raw text (script / style) skipped */
  function tags(t) {
    const out = []; let i = 0;
    while (i < t.length) {
      const lt = t.indexOf("<", i); if (lt < 0) break;
      if (t.startsWith("<!--", lt)) { const e = t.indexOf("-->", lt + 4); i = e < 0 ? t.length : e + 3; continue; }
      if (t.startsWith("<?", lt)) { const e = t.indexOf("?>", lt + 2); i = e < 0 ? t.length : e + 2; continue; }
      if (t.startsWith("<!", lt)) { const e = t.indexOf(">", lt); i = e < 0 ? t.length : e + 1; continue; }
      const m = /^<(\/?)([A-Za-z][\w:-]*)/.exec(t.slice(lt, lt + 80));
      if (!m) { i = lt + 1; continue; }
      let j = lt + m[0].length, q = null;
      for (; j < t.length; j++) { const c = t[j]; if (q) { if (c === q) q = null; } else if (c === '"' || c === "'") q = c; else if (c === ">") break; }
      const end = Math.min(t.length, j + 1), name = m[2].toLowerCase(), self = /\/\s*>$/.test(t.slice(lt, end));
      out.push({ at: lt, end, name, close: !!m[1], self });
      i = end;
      if (!m[1] && RAW.has(name) && !self) { const re = new RegExp("</" + name + "\\s*>", "ig"); re.lastIndex = end; const r = re.exec(t); i = r ? r.index : t.length; }
    }
    return out;
  }
  /** tags not closed + closing tags with no opening one -> [{at, end, name, kind: "open" | "stray", soft}] */
  function problems(t) {
    const st = [], out = [];
    for (const g of tags(String(t || ""))) {
      if (g.close) {
        let k = st.length - 1; while (k >= 0 && st[k].name !== g.name) k--;
        if (k < 0) { if (!VOID.has(g.name)) out.push({ at: g.at, end: g.end, name: g.name, kind: "stray", soft: false }); continue; }
        while (st.length - 1 > k) { const o = st.pop(); out.push({ at: o.at, end: o.end, name: o.name, kind: "open", soft: OPTIONAL.has(o.name) }); }
        st.pop();
      } else if (!g.self && !VOID.has(g.name)) st.push(g);
    }
    for (const o of st) out.push({ at: o.at, end: o.end, name: o.name, kind: "open", soft: OPTIONAL.has(o.name) });
    return out.sort((a, b) => a.at - b.at);
  }
  const lineOf = (t, at) => String(t).slice(0, at).split("\n").length;
  /* ---- colouring */
  function hlTag(s) {   // one tag's text: <name attr="v" …>
    const m = /^(<\/?)([A-Za-z][\w:-]*)([\s\S]*?)(\/?>)?$/.exec(s); if (!m) return esc(s);
    const attrs = m[3].replace(/([^\s=]+)(\s*=\s*)("[^"]*"?|'[^']*'?|[^\s"'>]+)?|([^\s]+)|(\s+)/g, (all, n, eq, v, lone, sp) =>
      sp != null ? sp : lone != null ? `<span class="hn">${esc(lone)}</span>` : `<span class="hn">${esc(n)}</span>${esc(eq)}${v != null ? `<span class="hv">${esc(v)}</span>` : ""}`);
    return `<span class="hp">${esc(m[1])}</span><span class="ht">${esc(m[2])}</span>${attrs}<span class="hp">${esc(m[4] || "")}</span>`;
  }
  const KW = /\b(var|let|const|function|return|if|else|for|while|do|switch|case|break|continue|new|class|extends|import|export|from|async|await|try|catch|finally|throw|typeof|instanceof|this|null|true|false|undefined|echo|public|private|static|require_once|require|include|foreach|as|elseif|array|fn|use|namespace)\b/g;
  function hlCode(s, kind) {   // css / js / php text
    const re = kind === "css" ? /(\/\*[\s\S]*?(?:\*\/|$))|("(?:\\.|[^"\\])*"?|'(?:\\.|[^'\\])*'?)|(#[0-9a-fA-F]{3,8}\b|-?\d*\.?\d+(?:px|em|rem|%|vh|vw|s|ms|deg)?)|([\w-]+)(?=\s*:)|([^]{1})/g
      : /(\/\*[\s\S]*?(?:\*\/|$)|\/\/[^\n]*|#[^\n]*(?=\n|$)(?!\{))|("(?:\\.|[^"\\])*"?|'(?:\\.|[^'\\])*'?|`(?:\\.|[^`\\])*`?)|(\b\d+(?:\.\d+)?\b)|(\$[A-Za-z_]\w*)|([^]{1})/g;
    let out = "", m, plain = "";
    const flush = () => { if (plain) { out += esc(plain).replace(KW, '<span class="hk">$1</span>'); plain = ""; } };
    while ((m = re.exec(s))) {
      if (m[5] != null) { plain += m[5]; continue; }
      if (kind !== "css" && m[1] != null && m[1][0] === "#" && kind !== "php") { plain += m[1]; continue; }   // # is a comment in PHP only
      flush();
      if (m[1] != null) out += `<span class="hc">${esc(m[1])}</span>`;
      else if (m[2] != null) out += `<span class="hv">${esc(m[2])}</span>`;
      else if (m[3] != null) out += `<span class="hm">${esc(m[3])}</span>`;
      else if (m[4] != null) out += `<span class="${kind === "css" ? "hn" : "ht"}">${esc(m[4])}</span>`;
    }
    flush(); return out;
  }
  /** the coloured HTML of a text (a file of kind html / css / js / php); bad = problems() to mark */
  function highlight(t, kind, bad) {
    t = String(t || ""); kind = kind || "html";
    if (kind !== "html" && kind !== "php") return hlCode(t, kind);
    const B = new Map((bad || []).map((p) => [p.at, p]));
    let out = "", i = 0;
    const text = (s) => { out += esc(s); };
    while (i < t.length) {
      const lt = t.indexOf("<", i); if (lt < 0) { text(t.slice(i)); break; }
      text(t.slice(i, lt));
      if (t.startsWith("<!--", lt)) { const e = t.indexOf("-->", lt + 4), j = e < 0 ? t.length : e + 3; out += `<span class="hc">${esc(t.slice(lt, j))}</span>`; i = j; continue; }
      if (t.startsWith("<?", lt)) { const e = t.indexOf("?>", lt + 2), j = e < 0 ? t.length : e + 2; out += `<span class="hphp">${hlCode(t.slice(lt, j), "php")}</span>`; i = j; continue; }
      if (t.startsWith("<!", lt)) { const e = t.indexOf(">", lt), j = e < 0 ? t.length : e + 1; out += `<span class="hd">${esc(t.slice(lt, j))}</span>`; i = j; continue; }
      const m = /^<(\/?)([A-Za-z][\w:-]*)/.exec(t.slice(lt, lt + 80));
      if (!m) { text("<"); i = lt + 1; continue; }
      let j = lt + m[0].length, q = null;
      for (; j < t.length; j++) { const c = t[j]; if (q) { if (c === q) q = null; } else if (c === '"' || c === "'") q = c; else if (c === ">") break; }
      const end = Math.min(t.length, j + 1), p = B.get(lt), h = hlTag(t.slice(lt, end));
      out += p ? `<span class="${p.soft ? "hwarn" : "hbad"}" title="${p.kind === "stray" ? "a closing tag with no opening one" : "not closed"}">${h}</span>` : h;
      i = end;
      const name = m[2].toLowerCase();
      if (!m[1] && RAW.has(name) && !/\/\s*>$/.test(t.slice(lt, end))) {
        const re = new RegExp("</" + name + "\\s*>", "ig"); re.lastIndex = end; const r = re.exec(t), stop = r ? r.index : t.length;
        const inner = t.slice(end, stop); out += name === "style" ? hlCode(inner, "css") : name === "script" ? hlCode(inner, "js") : esc(inner); i = stop;
      }
    }
    return out;
  }
  /* ---- quick tags + comments (pure: text, selection -> {text, a, b}) */
  function wrap(t, a, b, tag) {
    const sel = t.slice(a, b), name = String(tag).replace(/[^\w-]/g, "");
    const SNIP = { a: ['<a href="">', "</a>"], img: ['<img src="images/" alt="">', ""], br: ["<br>", ""], hr: ["<hr>", ""], input: ['<input name="" type="text">', ""],
      ul: ["<ul>\n  <li>", "</li>\n</ul>"], ol: ["<ol>\n  <li>", "</li>\n</ol>"], table: ["<table>\n  <tr><th>", "</th></tr>\n  <tr><td></td></tr>\n</table>"],
      form: ['<form method="post" action="">\n  ', '\n  <button type="submit">Send</button>\n</form>'], button: ['<button type="button">', "</button>"], link: ['<link rel="stylesheet" href="css/">', ""], script: ['<script src="js/">', "</script>"] };
    const [o, c] = SNIP[name] || [`<${name}>`, `</${name}>`];
    if (!c) { const ins = o + sel; return { text: t.slice(0, a) + ins + t.slice(b), a: a + ins.length, b: a + ins.length }; }
    return { text: t.slice(0, a) + o + sel + c + t.slice(b), a: a + o.length, b: a + o.length + sel.length };
  }
  const MARKS = { html: ["<!-- ", " -->"], css: ["/* ", " */"], js: ["// ", ""], php: ["// ", ""] };
  /** a comment at the cursor (around the selection): kind block | line | todo */
  function comment(t, a, b, fileKind, how) {
    const sel = t.slice(a, b);
    const [o, c] = how === "block" ? (fileKind === "html" ? MARKS.html : ["/* ", " */"]) : how === "line" ? (fileKind === "html" ? MARKS.html : ["// ", ""]) : (fileKind === "html" ? ["<!-- TODO: ", " -->"] : fileKind === "css" ? ["/* TODO: ", " */"] : ["// TODO: ", ""]);
    return { text: t.slice(0, a) + o + sel + c + t.slice(b), a: a + o.length, b: a + o.length + sel.length };
  }
  /** ⌗ comment / uncomment the selected lines (all commented -> uncommented) */
  function toggle(t, a, b, fileKind) {
    const s = t.lastIndexOf("\n", a - 1) + 1, e0 = t.indexOf("\n", Math.max(a, b - (b > a && t[b - 1] === "\n" ? 1 : 0))), e = e0 < 0 ? t.length : e0;
    const lines = t.slice(s, e).split("\n"), [o, c] = MARKS[fileKind] || MARKS.html;
    const isC = (l) => !l.trim() || (l.trim().startsWith(o.trim()) && (!c || l.trim().endsWith(c.trim())));
    const all = lines.every(isC) && lines.some((l) => l.trim());
    const out = lines.map((l) => {
      if (!l.trim()) return l;
      const ind = /^\s*/.exec(l)[0], body = l.slice(ind.length);
      if (all) { let x = body.slice(o.trim().length).replace(/^ /, ""); if (c) x = x.slice(0, x.length - c.trim().length).replace(/ $/, ""); return ind + x; }
      return ind + o + body + c;
    }).join("\n");
    return { text: t.slice(0, s) + out + t.slice(e), a: s, b: s + out.length };
  }
  const pure = { tags, problems, lineOf, highlight, wrap, comment, toggle, kindOf, VOID, OPTIONAL };
  if (typeof module !== "undefined" && module.exports && typeof window === "undefined") { module.exports = pure; return; }

  /* ---------------- the page */
  const doc = root.document, $ = (id) => doc.getElementById(id);
  const QUICK = [["p", "¶", "a paragraph"], ["h1", "H1", "a main heading"], ["h2", "H2", "a heading"], ["h3", "H3", "a smaller heading"], ["div", "▭", "a div"], ["section", "§", "a section"], ["a", "🔗", "a link"],
    ["img", "🖼", "a picture"], ["strong", "B", "bold"], ["em", "I", "italic"], ["span", "⟨⟩", "a span"], ["ul", "•", "a list"], ["ol", "1.", "a numbered list"],
    ["br", "↵", "a line break"], ["button", "▢", "a button"], ["form", "✉", "a form"], ["input", "⌨", "an input box"], ["table", "▦", "a table"], ["script", "JS", "a script"], ["link", "CSS", "a style sheet"]];
  let fileKind = "html", raf = 0;
  const area = () => $("wbCode");
  function paint() {
    raf = 0; const c = area(), hl = $("wbCodeHl"), no = $("wbCodeNo"), st = $("wbCodeIssues"); if (!c || !hl) return;
    const W = root.H3Web && root.H3Web.state ? root.H3Web.state() : {}; fileKind = kindOf(W.path);
    const t = c.value, bad = fileKind === "html" || fileKind === "php" ? problems(t) : [];
    hl.innerHTML = highlight(t, fileKind, bad) + "\n ";
    const n = t.split("\n").length; let s = ""; for (let k = 1; k <= n; k++) s += k + "\n"; no.textContent = s;
    sync();
    const hard = bad.filter((p) => !p.soft), soft = bad.filter((p) => p.soft);
    st.innerHTML = !bad.length ? "" : (hard.length ? `<span class="hbadtxt">⚠ ${hard.length} not closed / stray:</span> ` : "") + bad.slice(0, 12).map((p) =>
      `<a href="#" data-at="${p.at}" class="${p.soft ? "w" : "b"}">${p.kind === "stray" ? "&lt;/" : "&lt;"}${esc(p.name)}&gt; line ${lineOf(t, p.at)}</a>`).join(" ") + (bad.length > 12 ? " …" : "") + (soft.length && !hard.length ? ` <span style="color:var(--dim)">(HTML lets these stay open)</span>` : "");
    st.style.display = bad.length ? "" : "none";
  }
  function sync() { const c = area(), hl = $("wbCodeHl"), no = $("wbCodeNo"); if (!c || !hl) return; hl.scrollTop = c.scrollTop; hl.scrollLeft = c.scrollLeft; no.scrollTop = c.scrollTop; }
  function refresh() { if (!raf) raf = (root.requestAnimationFrame || setTimeout)(paint); }
  function edit(fn) {
    const c = area(); if (!c || c.style.display === "none") return;
    const r = fn(c.value, c.selectionStart, c.selectionEnd, fileKind);
    c.focus(); c.setSelectionRange(0, c.value.length); doc.execCommand && doc.execCommand("insertText", false, r.text) || (c.value = r.text);   // Ctrl+Z undoes it
    if (c.value !== r.text) c.value = r.text;
    c.setSelectionRange(r.a, r.b); c.dispatchEvent(new root.Event("input", { bubbles: true })); refresh();
  }
  function build() {
    const c = area(); if (!c || $("wbCodeEd")) return;
    const ed = doc.createElement("div"); ed.id = "wbCodeEd";
    const tools = doc.createElement("div"); tools.id = "wbCodeTools";
    tools.innerHTML = QUICK.map(([t, l, why]) => `<button type="button" class="ghost" data-qt="${t}" title="${why} - wraps the selection">${l}</button>`).join("")
      + '<span class="sep"></span><button type="button" class="ghost" data-qc="block" title="A block comment round the selection (HTML or CSS / JS)">&lt;!--</button>'
      + '<button type="button" class="ghost" data-qc="line" title="A line comment (// in JS / PHP)">//</button>'
      + '<button type="button" class="ghost" data-qc="todo" title="A TODO comment">✎</button>'
      + '<button type="button" class="ghost" data-qc="toggle" title="Comment / uncomment the selected lines (Ctrl+/)">⌗</button>';
    const box = doc.createElement("div"); box.id = "wbCodeBox";
    box.innerHTML = '<pre id="wbCodeNo" aria-hidden="true"></pre><div id="wbCodeIn"><pre id="wbCodeHl" aria-hidden="true"></pre></div>';
    c.parentNode.insertBefore(ed, c); ed.appendChild(tools); ed.appendChild(box); box.querySelector("#wbCodeIn").appendChild(c);
    const issues = doc.createElement("div"); issues.id = "wbCodeIssues"; issues.style.display = "none"; ed.parentNode.insertBefore(issues, ed.nextSibling);
    c.addEventListener("input", refresh); c.addEventListener("scroll", sync);
    c.addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.key === "/") { e.preventDefault(); edit((t, a, b, k) => toggle(t, a, b, k)); } });
    tools.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.qt) edit((t, a, z) => wrap(t, a, z, b.dataset.qt));
      else if (b.dataset.qc === "toggle") edit((t, a, z, k) => toggle(t, a, z, k));
      else if (b.dataset.qc) edit((t, a, z, k) => comment(t, a, z, k, b.dataset.qc));
    });
    issues.addEventListener("click", (e) => {
      const a = e.target.closest("[data-at]"); if (!a) return; e.preventDefault();
      const at = +a.dataset.at, el = area(); el.focus(); el.setSelectionRange(at, at);
      const lh = parseFloat(root.getComputedStyle(el).lineHeight) || 18; el.scrollTop = Math.max(0, (lineOf(el.value, at) - 4) * lh); sync();
    });
    // the picture view hides the textarea - the editor goes with it
    new root.MutationObserver(() => { ed.style.display = c.style.display === "none" ? "none" : ""; if (c.style.display === "none") issues.style.display = "none"; else refresh(); }).observe(c, { attributes: true, attributeFilter: ["style"] });
    refresh();
  }
  function start() { if (area()) build(); else setTimeout(start, 400); }
  root.WbCode = Object.assign({ refresh, paint }, pure);
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start); else start();
})(typeof window !== "undefined" ? window : globalThis);
