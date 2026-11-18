/* pcdocai.js — 📄 ✨ THE LLM WRITES THE DOCUMENT INTO A WP LAYER (2.837.0), window.PCDocAi (window.H3DocAi once installed).
 *
 * Tim: "if image editor layer is open and wp layer is selected and i ask the llm to write an article from documents i give it or
 * create a report or write a story, can we have the llm automatically generate the documet with charts and tables etc in the wp
 * layer? images, charts,tables can go in separate layers in a wp group."
 *   The prompt docker, a WP layer picked: "write an article about …", "create a report from these", "write a story about …"
 *   (window.H3ChatRoutes, first) - documents put on its ＋ (or dropped) while a WP layer is picked (.txt .md .docx .pdf - pdAdd ->
 *   takeFile) are what it is written from. Also Layer ▸ ✨ Write With the AI… / the canvas's right-click on a WP layer (a box:
 *   the request, the kind, about how many words, tables / charts / pictures, 📎 documents).
 *   -> POST /api/docai/plan (lib/docAi.js) -> the WP layer's text: the title, headings, paragraphs, lists, quotes and TABLES
 *   (real WP tables) in the frame's story (one undo); each CHART (the spreadsheet's chart engine) and PICTURE (the prompt
 *   docker's image style, made one at a time) a layer of its own under the text, all in a "📄 <title>" WP group with the WP
 *   layer; the frame made shorter to leave them room (the text goes on in the next frame / ＋ Next page as before).
 * Pure (Node: scripts/test-837.js): wants, toHtml, figureGrid.
 */
(function (root) {
  "use strict";
  /* ================================ pure ================================ */
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const KIND_RE = /\b(article|report|story|essay|letter|summary|document|blog post|blog|post|paper|proposal|brief|memo|newsletter)\b/i;
  /** a prompt-docker message that asks for a document -> {ask, kind, pictures} | null */
  function wants(t) {
    const s = String(t || "").trim();
    if (!/\b(write|create|draft|make|compose|prepare|produce|generate|put together)\b/i.test(s) || !KIND_RE.test(s)) return null;
    if (/\b(slides?|presentation|deck|spreadsheet|sheet|formula|song|lyrics|video|scene|storyboard)\b/i.test(s)) return null;
    const k = (KIND_RE.exec(s)[1] || "").toLowerCase();
    const kind = /blog|post|newsletter|paper/.test(k) ? "article" : /proposal|brief|memo/.test(k) ? "report" : k;
    const words = (/\b(\d{2,5})\s*words?\b/i.exec(s) || [])[1];
    return { ask: s, kind, words: words ? +words : 0, pictures: /\b(pictures?|images?|photos?|illustrat\w*)\b/i.test(s) && !/\bno (pictures?|images?)\b/i.test(s) };
  }
  /** the document's blocks -> the WP layer's HTML (tables as WP tables; a chart / picture = its caption line, the layer below) */
  function toHtml(doc) {
    const out = [], d = doc || {}; let fig = 0;
    if (d.title) out.push(`<h1>${esc(d.title)}</h1>`);
    for (const b of d.blocks || []) {
      if (b.type === "h1" || b.type === "h2" || b.type === "h3") out.push(`<${b.type === "h1" && d.title ? "h2" : b.type}>${esc(b.text)}</${b.type === "h1" && d.title ? "h2" : b.type}>`);
      else if (b.type === "p") out.push(`<p>${esc(b.text)}</p>`);
      else if (b.type === "quote") out.push(`<blockquote>${esc(b.text)}</blockquote>`);
      else if (b.type === "ul" || b.type === "ol") out.push(`<${b.type}>${b.items.map((x) => `<li>${esc(x)}</li>`).join("")}</${b.type}>`);
      else if (b.type === "table") {
        const rows = b.rows || [], c = Math.max(1, rows[0] ? rows[0].length : 1), w = (100 / c).toFixed(3).replace(/\.?0+$/, ""), head = b.head !== false && rows.length > 1;
        if (b.caption) out.push(`<p><i>${esc(b.caption)}</i></p>`);
        out.push(`<table style="width:100%;table-layout:fixed"><colgroup>${Array.from({ length: c }, () => `<col style="width:${w}%">`).join("")}</colgroup>`
          + (head ? `<thead><tr>${rows[0].map((x) => `<th>${esc(x) || "<br>"}</th>`).join("")}</tr></thead>` : "")
          + `<tbody>${rows.slice(head ? 1 : 0).map((r) => `<tr>${r.map((x) => `<td>${esc(x) || "<br>"}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
      } else if (b.type === "chart" || b.type === "image") { fig++; out.push("<p><i>" + esc(b.caption || "Figure " + fig) + "</i></p>"); }   // the LLM's caption ("Figure 1: …"), its layer below
    }
    return out.join("");
  }
  /** where n figures go under a frame {x, y, w, h}: two across (one when alone), 0.62 tall; the frame's new height -> {h, cells} */
  function figureGrid(fr, n, gap) {
    if (!n) return { h: fr.h, cells: [] };
    const g = gap == null ? 16 : gap, cols = n === 1 ? 1 : 2, rows = Math.ceil(n / cols);
    let cw = (fr.w - g * (cols - 1)) / cols, ch = cw * 0.62;
    const room = fr.h * 0.6;                                             // the text keeps at least 40 % of the frame
    if (rows * (ch + g) > room) { ch = Math.max(60, room / rows - g); cw = Math.min(cw, ch / 0.62); }
    const h = Math.max(fr.h * 0.4, fr.h - rows * (ch + g)), y0 = fr.y + h + g, cells = [];
    for (let i = 0; i < n; i++) { const r = Math.floor(i / cols), c = i % cols, rowN = Math.min(cols, n - r * cols), x0 = fr.x + (fr.w - (rowN * cw + (rowN - 1) * g)) / 2;
      cells.push({ x: Math.round(x0 + c * (cw + g)), y: Math.round(y0 + r * (ch + g)), w: Math.round(cw), h: Math.round(ch) }); }
    return { h: Math.round(h), cells };
  }
  const pure = { wants, toHtml, figureGrid };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  /* ================================ the page ================================ */
  function install(E) {
    const { S, D, doc, say } = E;
    const $ = (id) => doc.getElementById(id);
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const editorOn = () => (typeof root.ieOnScreen === "function" ? !!root.ieOnScreen() : true);
    /** the WP layer to write into: the active one, or the first in the active (WP) group */
    function wpNow() {
      const L = E.layer(); if (!L) return null;
      if (L.type === "doc") return L;
      if (L.type === "group" && D && D.descendants) return D.descendants(S.layers, L.id).find((x) => x.type === "doc") || null;
      return null;
    }
    const files = [];
    function takeFile(f) {
      if (!f || !/\.(txt|md|markdown|docx|pdf)$/i.test(f.name || "") || !editorOn() || !wpNow()) return false;
      files.push(f);
      if (typeof root.chatAdd === "function") root.chatAdd("assistant", `📎 ${f.name} - the next "write a report / an article / a story …" for the WP layer is written from ${files.length > 1 ? "these " + files.length + " documents" : "it"}`);
      return true;
    }
    async function textOf(f) {
      if (/\.pdf$/i.test(f.name)) {
        const L = await new Promise((ok, no) => { if (root.pdfjsLib) return ok(root.pdfjsLib); const s = doc.createElement("script"); s.src = "/static/vendor/pdf.min.js"; s.onload = () => ok(root.pdfjsLib); s.onerror = () => no(new Error("pdf.js did not load")); doc.head.appendChild(s); });
        if (L.GlobalWorkerOptions && !L.GlobalWorkerOptions.workerSrc) L.GlobalWorkerOptions.workerSrc = "/static/vendor/pdf.worker.min.js";
        const pdf = await L.getDocument({ data: new Uint8Array(await f.arrayBuffer()) }).promise, out = [];
        for (let i = 1; i <= Math.min(pdf.numPages, 200); i++) { const c = await (await pdf.getPage(i)).getTextContent(); out.push(c.items.map((x) => x.str).join(" ")); }
        return out.join("\n\n");
      }
      if (/\.docx$/i.test(f.name)) { const r = await fetch("/api/docai/extract?name=" + encodeURIComponent(f.name), { method: "POST", body: f }); const j = await r.json(); if (!r.ok) throw new Error(j.error || "HTTP " + r.status); return j.text; }
      return f.text();
    }
    /* ---- a chart as a picture (the spreadsheet's chart engine) */
    function engine() { if (root.SheetChart) return Promise.resolve(root.SheetChart); return new Promise((ok) => { const s = doc.createElement("script"); s.src = "/ext/sheetdock/sheetchart.js"; s.onload = () => ok(root.SheetChart || null); s.onerror = () => ok(null); doc.head.appendChild(s); }); }
    async function chartImage(ch, w, h) {
      const SC = await engine(); if (!SC) return null;
      const K = root.SlideCore, colors = K ? K.chartColors({ theme: "plain" }) : undefined;
      const svg = SC.svg({ type: ch.type, title: ch.title, legend: ch.legend !== false, colors }, { cats: ch.cats, series: ch.series }, w, h, { ink: "#222222", dim: "#666666", line: "#d4d7dc", font: "Calibri, Arial, sans-serif", bg: "#ffffff", fs: Math.max(12, Math.round(Math.min(w, h) / 22)) });
      return new Promise((ok) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => ok(null); im.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg); });
    }
    /* ---- a picture from the prompt docker's image style (a job, waited for) */
    async function picture(prompt, w, h) {
      const style = $("styleSel") ? $("styleSel").value : ""; if (!style) throw new Error("no image style in the prompt docker");
      const a = w / h, area = 1048576, r16 = (v) => Math.max(256, Math.min(2048, Math.round(v / 16) * 16));
      const body = { prompt: prompt + ". A clear illustration, no text, no words, no letters.", style_id: style, batch: 1, width: r16(Math.sqrt(area * a)), height: r16(Math.sqrt(area / a)) };
      const r = await fetch("/api/genimage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const job = await r.json();
      if (!r.ok || job.error) throw new Error(job.error || "HTTP " + r.status);
      for (;;) { await sleep(1500); const jr = await fetch("/api/jobs/" + encodeURIComponent(job.id)), j = await jr.json(); if (j.status === "done") { const n = (j.outputs && j.outputs[0]) || j.output; return new Promise((ok) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => ok(null); im.src = "/outputs/" + String(n).split("/").map(encodeURIComponent).join("/"); }); } if (j.status === "failed" || j.status === "cancelled" || !jr.ok) throw new Error("the picture's job " + (j.status || "went away")); }
    }
    const fitDraw = (g, im, c) => { const k = Math.min(c.w / im.width, c.h / im.height), w = im.width * k, h = im.height * k; g.imageSmoothingQuality = "high"; g.drawImage(im, c.x + (c.w - w) / 2, c.y + (c.h - h) / 2, w, h); };

    /** write it: {ask, kind, words, tables, charts, pictures, docs: [File]} -> {title, figures} */
    async function write(o) {
      const W = wpNow(); if (!W) throw new Error("pick a WP layer first (Layer ▸ New ▸ 📄 WP Layer)");
      if (E.docText.editing && E.docText.editing()) E.docText.end();
      const a = Object.assign({ tables: true, charts: true }, o || {}), docs = (a.docs || []).slice(); let text = "";
      for (const f of docs) { say(`📄 reading ${f.name}…`); try { text += `\n\n=== ${f.name} ===\n` + (await textOf(f)); } catch (e) { say(`📄 ${f.name}: ${e.message}`); } }
      say("📄 ✨ the LLM is writing" + (docs.length ? ` from ${docs.length} document(s)` : "") + "…");
      const r = await fetch("/api/docai/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ask: a.ask, text, kind: a.kind, words: a.words, tables: a.tables, charts: a.charts, pictures: a.pictures }) });
      const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || "HTTP " + r.status);
      const d = j.doc, figs = d.blocks.filter((b) => b.type === "chart" || b.type === "image");
      const story = E.docText.storyOf ? E.docText.storyOf(W) : [W], head = story[0] || W, fr = W.doc;
      const grid = figureGrid({ x: fr.x, y: fr.y, w: fr.w, h: fr.h }, figs.length, 16);
      const made = [];
      E.structOp("✨ write the document", () => {
        head.doc.html = E.docText.sanitize(toHtml(d)); head.doc.top = 0;
        if (figs.length) fr.h = grid.h;
        figs.forEach((b, i) => {
          const N = E.makeLayer(b.type === "chart" ? "📊 " + (b.caption || b.chart.title || "Chart") : "🖼 " + (b.caption || "Picture"));
          const c = grid.cells[i], g = N.canvas.getContext("2d");
          if (b.type === "image") { g.fillStyle = "rgba(128,128,128,.18)"; g.fillRect(c.x, c.y, c.w, c.h); g.fillStyle = "#777"; g.font = `${Math.max(14, Math.round(c.h / 10))}px sans-serif`; g.textAlign = "center"; g.fillText("🖼 the picture is being made…", c.x + c.w / 2, c.y + c.h / 2); }
          N.aidoc = { kind: b.type, cell: c };
          S.layers.push(N); made.push({ L: N, b, c });
        });
        // the WP group: the WP layer + its charts and pictures
        if (D && D.group) {
          const ids = [W.id].concat(made.map((m) => m.L.id)), G = E.makeLayer("📄 " + (d.title || "Document").slice(0, 40), S.w, S.h, "group");
          S.layers = D.group(S.layers, ids, G); S.active = S.layers.indexOf(W);
        }
      });
      E.docText.reflow(fr.flow && fr.flow.id);
      if (D && D.rasterize) D.rasterize(W);
      E.refresh(); E.renderLayersPanel();
      // the charts now, the pictures one at a time (each fills its layer when done - its own undo step)
      for (const m of made.filter((x) => x.b.type === "chart")) {
        const im = await chartImage(m.b.chart, m.c.w, m.c.h); if (!im) { say("📊 charts need the ▦ Spreadsheet extension"); continue; }
        const copy = E.beginPx(m.L), g = m.L.canvas.getContext("2d"); g.clearRect(0, 0, S.w, S.h); fitDraw(g, im, m.c); const px = E.endPx(m.L, copy, null, "📊 chart"); if (px) E.push(px);
      }
      E.refresh();
      const pics = made.filter((x) => x.b.type === "image");
      (async () => {
        for (const [i, m] of pics.entries()) {
          say(`🖼 making picture ${i + 1} of ${pics.length}…`);
          try { const im = await picture(m.b.picture, m.c.w, m.c.h); if (!im || !S.layers.includes(m.L)) continue; const copy = E.beginPx(m.L), g = m.L.canvas.getContext("2d"); g.clearRect(0, 0, S.w, S.h); fitDraw(g, im, m.c); const px = E.endPx(m.L, copy, null, "🖼 picture"); if (px) E.push(px); E.refresh(); }
          catch (e) { say("🖼 " + e.message); }
        }
        if (pics.length) say(`🖼 ${pics.length} picture(s) in the document`);
      })();
      files.length = 0;
      say(`📄 "${d.title || "the document"}" written in the WP layer` + (figs.length ? ` - ${figs.length} chart(s) / picture(s) as layers in its group` : "") + " (Ctrl+Z takes it back)");
      return { title: d.title, figures: figs.length, tables: d.blocks.filter((b) => b.type === "table").length, pictures: pics.length };
    }
    /* ---- the box (Layer ▸ ✨ Write With the AI… / right-click a WP layer) */
    function dialog(ask) {
      E.ui.dialog("✨ Write With the AI", `<div class="kxrow"><span>Write</span><textarea id="pdaAsk" rows="3" style="flex:1" placeholder="e.g. a report on the sales figures in these documents">${esc(ask || "")}</textarea></div>
        <div class="kxrow"><span>Kind</span><select id="pdaKind">${["article", "report", "story", "essay", "letter", "summary", "document"].map((k) => `<option>${k}</option>`).join("")}</select>
          <span>About</span><input type="number" id="pdaWords" value="800" min="150" max="6000" style="width:80px"><span>words</span></div>
        <div class="kxrow"><label><input type="checkbox" id="pdaTables" checked> Tables</label><label><input type="checkbox" id="pdaCharts" checked> Charts</label><label><input type="checkbox" id="pdaPics"> Pictures (the prompt docker's image style)</label></div>
        <div class="kxrow"><span>From</span><input type="file" id="pdaFiles" multiple accept=".txt,.md,.markdown,.docx,.pdf"><span style="color:var(--pc-dim)">${files.length ? files.length + " from the prompt docker too" : ""}</span></div>`, async (dlg) => {
        const f = [...(dlg.querySelector("#pdaFiles").files || [])].concat(files);
        try { await write({ ask: dlg.querySelector("#pdaAsk").value.trim(), kind: dlg.querySelector("#pdaKind").value, words: +dlg.querySelector("#pdaWords").value, tables: dlg.querySelector("#pdaTables").checked, charts: dlg.querySelector("#pdaCharts").checked, pictures: dlg.querySelector("#pdaPics").checked, docs: f }); }
        catch (e) { say("✗ " + e.message); }
      }, { okLabel: "✨ Write" });
    }
    if (E.ui && E.ui.addCmd) {
      E.ui.addCmd("layer.docai", "✨ Write With the AI…", "", () => dialog(""), { enabled: () => !!wpNow() }, ["Layer", "layer.docedit"]);
      E.ui.stageCtxItems = (E.ui.stageCtxItems || []).concat(["layer.docai"]); E.ui.layerCtxItems = (E.ui.layerCtxItems || []).concat(["layer.docai"]);
    }
    /* ---- the prompt docker */
    async function maybe(text) {
      if (!editorOn() || !S.w || !wpNow()) return null;
      const w = wants(text); if (!w) return null;
      const r = await write(Object.assign({ docs: files.slice() }, w));
      return `📄 "${r.title || "the document"}" is in the WP layer` + (r.tables ? ` - ${r.tables} table(s) in the text` : "") + (r.figures ? `, ${r.figures} chart(s) / picture(s) as layers in its 📄 group` : "") + (r.pictures ? " (the pictures arrive one at a time)" : "") + ". Ctrl+Z takes it back.";
    }
    root.H3ChatRoutes = [maybe].concat(root.H3ChatRoutes || []);
    E.docAi = { write, dialog, takeFile, wpNow, files: () => files.slice() };
    root.H3DocAi = { takeFile, write, dialog };
  }
  const PCDocAi = Object.assign({ install }, pure);
  root.PCDocAi = PCDocAi;
})(typeof window !== "undefined" ? window : globalThis);
