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
 *   docker's image style, made one at a time) a layer of its own, all in a "📄 <title>" WP group with the WP layer.
 * 2.838.0 (Tim: "yes, please go ahead with the next step" - figures where they belong + a spreadsheet as the data): each
 *   figure has its PLACE in the text (an empty paragraph as tall as it - pcdoctext data-fig) right after the paragraph about
 *   it, its layer anchored there (L.anchor {flow, fig, src}): it follows the text as it reflows - to the next frame, to
 *   another page - drawn again from its source (the chart's SVG, the picture's file) at its new spot. A workbook (.xlsx /
 *   .csv) is a document too: its sheets go to the LLM as rows of cells.
 * Pure (Node: scripts/test-837.js, test-838.js): wants, toHtml, figHeight.
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
    if (/\b(slides?|presentation|deck|formula|song|lyrics|video|scene|storyboard)\b/i.test(s)) return null;
    // a spreadsheet asked FOR is the spreadsheet's (2.828.0); one written FROM is the data (2.838.0)
    if (/\b(spread)?sheets?\b/i.test(s) && !/\b(from|using|with|in|of|on)\s+(the |this |these |that |my |our |a |an )?(attached |excel )?(spread)?sheets?\b/i.test(s)) return null;
    const k = (KIND_RE.exec(s)[1] || "").toLowerCase();
    const kind = /blog|post|newsletter|paper/.test(k) ? "article" : /proposal|brief|memo/.test(k) ? "report" : k;
    const words = (/\b(\d{2,5})\s*words?\b/i.exec(s) || [])[1];
    return { ask: s, kind, words: words ? +words : 0, pictures: /\b(pictures?|images?|photos?|illustrat\w*)\b/i.test(s) && !/\bno (pictures?|images?)\b/i.test(s) };
  }
  /** a figure's height in the story (CSS px) for a column colW wide and a frame frameH tall: a chart 0.56 of the width, a
   *  picture 0.62, never more than 70 % of the frame (so it fits a frame with room for its caption) */
  function figHeight(type, colW, frameH) {
    const h = Math.round(colW * (type === "chart" ? 0.56 : 0.62));
    return Math.max(40, frameH ? Math.min(h, Math.round(frameH * 0.7)) : h);
  }
  /** the document's blocks -> the WP layer's HTML (tables as WP tables; a chart / picture = its place (data-fig, as tall as
   *  it - o.colW / o.frameH) then its caption; o.figId(n) names the places) */
  function toHtml(doc, opt) {
    const out = [], d = doc || {}, o = opt || {}; let fig = 0;
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
      } else if (b.type === "chart" || b.type === "image") {
        fig++;
        const cap = "<i>" + esc(b.caption || "Figure " + fig) + "</i>";      // the LLM's caption ("Figure 1: …")
        // 2.839.0: the caption INSIDE the place, under the picture (padding-top = the picture) - it moves / floats with it
        if (o.colW) out.push(`<p data-fig="${esc(o.figId ? o.figId(fig) : "f" + fig)}" style="padding-top:${figHeight(b.type, o.colW, o.frameH)}px">${cap}</p>`);
        else out.push("<p>" + cap + "</p>");
      }
    }
    return out.join("");
  }
  const pure = { wants, toHtml, figHeight };
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
      if (!f || !/\.(txt|md|markdown|docx|pdf|xlsx|csv|tsv)$/i.test(f.name || "") || !editorOn() || !wpNow()) return false;
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
      if (/\.(docx|xlsx)$/i.test(f.name)) { const r = await fetch("/api/docai/extract?name=" + encodeURIComponent(f.name), { method: "POST", body: f }); const j = await r.json(); if (!r.ok) throw new Error(j.error || "HTTP " + r.status); return j.text; }
      return f.text();
    }
    /* ---- a chart as a picture (the spreadsheet's chart engine) */
    function engine() { if (root.SheetChart) return Promise.resolve(root.SheetChart); return new Promise((ok) => { const s = doc.createElement("script"); s.src = "/ext/sheetdock/sheetchart.js"; s.onload = () => ok(root.SheetChart || null); s.onerror = () => ok(null); doc.head.appendChild(s); }); }
    async function chartSvg(ch, w, h) {
      const SC = await engine(); if (!SC) return null;
      const K = root.SlideCore, colors = K ? K.chartColors({ theme: "plain" }) : undefined;
      const svg = SC.svg({ type: ch.type, title: ch.title, legend: ch.legend !== false, colors }, { cats: ch.cats, series: ch.series }, w, h, { ink: "#222222", dim: "#666666", line: "#d4d7dc", font: "Calibri, Arial, sans-serif", bg: "#ffffff", fs: Math.max(12, Math.round(Math.min(w, h) / 22)) });
      return svg;
    }
    /* ---- a picture from the prompt docker's image style (a job, waited for) */
    async function picture(prompt, w, h) {
      const style = $("styleSel") ? $("styleSel").value : ""; if (!style) throw new Error("no image style in the prompt docker");
      const a = w / h, area = 1048576, r16 = (v) => Math.max(256, Math.min(2048, Math.round(v / 16) * 16));
      const body = { prompt: prompt + ". A clear illustration, no text, no words, no letters.", style_id: style, batch: 1, width: r16(Math.sqrt(area * a)), height: r16(Math.sqrt(area / a)) };
      const r = await fetch("/api/genimage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const job = await r.json();
      if (!r.ok || job.error) throw new Error(job.error || "HTTP " + r.status);
      for (;;) { await sleep(1500); const jr = await fetch("/api/jobs/" + encodeURIComponent(job.id)), j = await jr.json(); if (j.status === "done") { const n = (j.outputs && j.outputs[0]) || j.output; return n ? "/outputs/" + String(n).split("/").map(encodeURIComponent).join("/") : null; } if (j.status === "failed" || j.status === "cancelled" || !jr.ok) throw new Error("the picture's job " + (j.status || "went away")); }
    }

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
      const story = E.docText.storyOf ? E.docText.storyOf(W) : [W], head = story[0] || W, hd = head.doc, k = hd.k || 1;
      const flowId = hd.flow && hd.flow.id, tag = Date.now().toString(36), figId = (n) => "a" + tag + "-" + n;
      const made = [];
      E.structOp("✨ write the document", () => {
        head.doc.html = E.docText.sanitize(toHtml(d, { colW: hd.w / k, frameH: hd.h / k, figId })); head.doc.top = 0;
        figs.forEach((b, i) => {
          const N = E.makeLayer(b.type === "chart" ? "📊 " + (b.caption || b.chart.title || "Chart") : "🖼 " + (b.caption || "Picture"));
          N.anchor = { flow: flowId, fig: figId(i + 1), box: null, src: null, drawn: false };
          N.aidoc = { kind: b.type };
          S.layers.push(N); made.push({ L: N, b });
        });
        // the WP group: the WP layer + its charts and pictures
        if (D && D.group) {
          const ids = [W.id].concat(made.map((m) => m.L.id)), G = E.makeLayer("📄 " + (d.title || "Document").slice(0, 40), S.w, S.h, "group");
          S.layers = D.group(S.layers, ids, G); S.active = S.layers.indexOf(W);
        }
      });
      E.docText.reflow(flowId);                                           // the figures' layers go to their places (pcdoctext placeAnchors)
      if (D && D.rasterize) D.rasterize(W);
      E.refresh(); E.renderLayersPanel();
      const room = (m) => (m.L.anchor && m.L.anchor.box) || null;
      const lost = made.filter((m) => !room(m)).length;
      // the charts now (their SVG is the layer's source - drawn again sharp wherever the text takes it)
      for (const m of made.filter((x) => x.b.type === "chart")) {
        const bx = room(m);
        const svg = await chartSvg(m.b.chart, bx ? bx.w : 1200, bx ? bx.h : 672); if (!svg) { say("📊 charts need the ▦ Spreadsheet extension"); continue; }
        m.L.anchor.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
        await E.docText.anchorDraw(m.L);
      }
      E.refresh();
      const pics = made.filter((x) => x.b.type === "image");
      (async () => {
        for (const [i, m] of pics.entries()) {
          say(`🖼 making picture ${i + 1} of ${pics.length}…`);
          try { const bx = room(m) || { w: 1200, h: 744 }, url = await picture(m.b.picture, bx.w, bx.h); if (!url) continue; m.L.anchor.src = url; await E.docText.anchorDraw(m.L); E.refresh(); }
          catch (e) { say("🖼 " + e.message); }
        }
        if (pics.length) say(`🖼 ${pics.length} picture(s) in the document`);
      })();
      files.length = 0;
      if (lost) say(`📄 the text runs past the WP frame - ${lost} figure(s) wait for room there: make the frame taller or ＋ Next page`);
      say(`📄 "${d.title || "the document"}" written in the WP layer` + (figs.length ? ` - ${figs.length} chart(s) / picture(s) in the text, each a layer in its group` : "") + " (Ctrl+Z takes it back)");
      return { title: d.title, figures: figs.length, tables: d.blocks.filter((b) => b.type === "table").length, pictures: pics.length };
    }
    /* ---- the box (Layer ▸ ✨ Write With the AI… / right-click a WP layer) */
    function dialog(ask) {
      E.ui.dialog("✨ Write With the AI", `<div class="kxrow"><span>Write</span><textarea id="pdaAsk" rows="3" style="flex:1" placeholder="e.g. a report on the sales figures in these documents">${esc(ask || "")}</textarea></div>
        <div class="kxrow"><span>Kind</span><select id="pdaKind">${["article", "report", "story", "essay", "letter", "summary", "document"].map((k) => `<option>${k}</option>`).join("")}</select>
          <span>About</span><input type="number" id="pdaWords" value="800" min="150" max="6000" style="width:80px"><span>words</span></div>
        <div class="kxrow"><label><input type="checkbox" id="pdaTables" checked> Tables</label><label><input type="checkbox" id="pdaCharts" checked> Charts</label><label><input type="checkbox" id="pdaPics"> Pictures (the prompt docker's image style)</label></div>
        <div class="kxrow"><span>From</span><input type="file" id="pdaFiles" multiple accept=".txt,.md,.markdown,.docx,.pdf,.xlsx,.csv,.tsv"><span style="color:var(--pc-dim)">${files.length ? files.length + " from the prompt docker too" : ""}</span></div>`, async (dlg) => {
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
    E.docAi = { write, dialog, takeFile, wpNow, picture, files: () => files.slice() };
    root.H3DocAi = { takeFile, write, dialog };
  }
  const PCDocAi = Object.assign({ install }, pure);
  root.PCDocAi = PCDocAi;
})(typeof window !== "undefined" ? window : globalThis);
