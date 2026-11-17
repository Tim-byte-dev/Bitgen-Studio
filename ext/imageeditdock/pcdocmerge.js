/* pcdocmerge.js — MAIL MERGE IN DOCUMENT TEXT (2.816.0), window.PCDocMerge.
 *
 * Tim (verbatim): "i would actually like to keep comments, footnotes and mail merge" + "lets go with next, we will do all
 * the releases before i start testing" - the WORD PLAN's step 4 (part 2, the last).
 *
 *   DATA       «» Merge ▾ ▸ Data Source… - a .csv / .tsv / .txt file (commas, semicolons or tabs; quotes as
 *              spreadsheets write them) or pasted rows; the first row names the fields. Kept with the story
 *              (head frame's doc.merge = {name, fields, rows, rec, preview}; 5000 records, 100 fields).
 *   FIELDS     Insert Merge Field… puts «Field» at the caret (span data-field, light blue).
 *   PREVIEW    Preview Results shows a record's values in the drawn pages (the story itself keeps its fields -
 *              pcdoctext's PCDocText.viewOf); ◀ / ▶ step through the records.
 *   FINISH     Finish & Merge… - one Word document with every record (each from a new page), one Word document per
 *              record in a .zip (named by a field), or a Word mail-merge document (Word's own MERGEFIELDs + the data
 *              as .csv, for Word's Mailings) - all records or a range. The server builds them (lib/docxMerge.js).
 *
 * Pure (Node + jsdom: scripts/test-docmerge816.js): parseCSV, fillHtml, recordOf, fileName.
 */
(function (root) {
  "use strict";
  const MAX_ROWS = 5000, MAX_FIELDS = 100;
  /** CSV / TSV / semicolon text -> {fields, rows}; the separator the first line uses most; "" quotes; BOM dropped */
  function parseCSV(text) {
    const t = String(text || "").replace(/^﻿/, "");
    const first = t.split(/\r?\n/)[0] || "";
    const count = (ch) => first.split(ch).length - 1;
    const sep = ["\t", ";", ","].reduce((a, c) => (count(c) > count(a) ? c : a), ",");
    const rows = []; let row = [], cell = "", q = false;
    for (let i = 0; i < t.length; i++) {
      const c = t[i];
      if (q) { if (c === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
      if (c === '"' && cell === "") { q = true; continue; }
      if (c === sep) { row.push(cell); cell = ""; continue; }
      if (c === "\n" || c === "\r") { if (c === "\r" && t[i + 1] === "\n") i++; row.push(cell); cell = ""; if (row.some((x) => x !== "")) rows.push(row); row = []; continue; }
      cell += c;
    }
    row.push(cell); if (row.some((x) => x !== "")) rows.push(row);
    if (!rows.length) return { fields: [], rows: [] };
    const seen = new Map();
    const fields = rows[0].slice(0, MAX_FIELDS).map((f, i) => { let n = String(f).trim().replace(/[<>"]/g, "").slice(0, 60) || "Field " + (i + 1); const k = seen.get(n) || 0; seen.set(n, k + 1); return k ? `${n} ${k + 1}` : n; });
    return { fields, rows: rows.slice(1, MAX_ROWS + 1).map((r) => fields.map((_, i) => String(r[i] == null ? "" : r[i]))) };
  }
  /** a record as {field: value} */
  const recordOf = (fields, row) => { const o = {}; (fields || []).forEach((f, i) => { o[f] = row ? String(row[i] == null ? "" : row[i]) : ""; }); return o; };
  /** the story with each «Field» replaced by the record's value (plain text; line breaks kept) */
  function fillHtml(html, rec, document) {
    const d = document || root.document, box = d.createElement("div"); box.innerHTML = String(html || "");
    for (const sp of [...box.querySelectorAll("span[data-field]")]) {
      const f = sp.getAttribute("data-field"), v = rec && Object.prototype.hasOwnProperty.call(rec, f) ? rec[f] : "";
      const frag = d.createDocumentFragment();
      String(v).split(/\r?\n/).forEach((line, i) => { if (i) frag.appendChild(d.createElement("br")); frag.appendChild(d.createTextNode(line)); });
      sp.replaceWith(frag);
    }
    return box.innerHTML;
  }
  /** a file name from a pattern with «Field»s ("Letter - «Last Name»") */
  function fileName(pattern, rec, i) {
    const s = String(pattern || "Record «#»").replace(/«#»/g, String(i + 1)).replace(/«([^»]+)»/g, (a, f) => (rec && rec[f] != null ? rec[f] : ""));
    return s.replace(/[\\/:*?"<>|\r\n]+/g, "_").trim().slice(0, 100) || "Record " + (i + 1);
  }
  const esc = (t) => String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  function install(E) {
    const { S, doc, win } = E;
    if (!E.docText || !E.ui || !E.ui.addCmd || !doc) return;
    const X = E.docText, say = E.say || (() => {});
    const ed = () => X.ed();
    const isDoc = (L) => !!(L && L.type === "doc" && L.doc);
    /** the story being edited, else the picked frame's, else the first one */
    function headL() {
      const L = (X.editing && X.editing()) || (isDoc(S.layers[S.active]) ? S.layers[S.active] : S.layers.find(isDoc));
      return L ? (X.storyOf ? X.storyOf(L)[0] : L) : null;
    }
    const mergeOf = (H) => (H && H.doc.merge && Array.isArray(H.doc.merge.fields) ? H.doc.merge : null);
    // the drawn pages show a record while Preview Results is on
    if (win.PCDocText) win.PCDocText.viewOf = (head) => { const m = head && head.merge; if (!m || !m.preview || !m.rows || !m.rows.length) return null; const r = Math.max(0, Math.min(m.rows.length - 1, m.rec || 0)); return fillHtml(head.html, recordOf(m.fields, m.rows[r]), doc); };
    const redraw = (H) => { X.reflow(H.doc.flow && H.doc.flow.id); if (E.renderOptions) E.renderOptions(); };

    function sourceDialog() {
      const H = headL(); if (!H) return say("make or pick a document text frame first (File ▸ New Text Document…)");
      const m = mergeOf(H);
      E.ui.dialog("Mail Merge Data", `<div class="kxrow"><span>File</span><input type="file" id="pdmFile" accept=".csv,.tsv,.txt,text/csv,text/plain"></div>
        <div class="kxrow" style="color:var(--pc-dim)">…or paste the rows (the first row names the fields; commas, semicolons or tabs):</div>
        <textarea id="pdmText" rows="6" style="width:100%;font-family:monospace" placeholder="First Name,Last Name,City&#10;Anna,Smith,Perth"></textarea>
        <div class="kxrow" style="color:var(--pc-dim)">${m ? `Now: ${esc(m.name || "pasted rows")} - ${m.fields.length} fields, ${m.rows.length} records` : "No data yet."}</div>`, async (dlg) => {
        const f = dlg.querySelector("#pdmFile").files[0], pasted = dlg.querySelector("#pdmText").value;
        const text = f ? await f.text() : pasted;
        if (!String(text).trim()) return say("no data picked - nothing changed");
        const pr = parseCSV(text);
        if (!pr.fields.length) return say("no fields found in that data");
        const before = E.snapStruct ? E.snapStruct() : null;
        H.doc.merge = { name: f ? f.name : "pasted rows", fields: pr.fields, rows: pr.rows, rec: 0, preview: !!(m && m.preview) };
        if (before && E.push) E.push({ t: "struct", before, after: E.snapStruct(), label: "mail merge data" });
        redraw(H);
        say(`📇 ${pr.fields.length} fields, ${pr.rows.length} records - Insert Merge Field… puts them in the text`);
      }, { okLabel: "📇 Use" });
    }
    function fieldDialog() {
      const H = headL(), m = mergeOf(H);
      if (!m) return say("pick the data first: «» Merge ▾ ▸ Data Source…");
      if (!(X.editing && X.editing())) return say("click into the document text where the field goes");
      X.keepSel();
      E.ui.dialog("Insert Merge Field", `<div class="kxrow"><span>Field</span><select id="pdmF" size="${Math.min(10, Math.max(3, m.fields.length))}" style="min-width:220px">${m.fields.map((f, i) => `<option${i ? "" : " selected"}>${esc(f)}</option>`).join("")}</select></div>
        <div class="kxrow" style="color:var(--pc-dim)">The field shows as «Field»; Preview Results shows each record's value.</div>`, (dlg) => {
        insertField(dlg.querySelector("#pdmF").value);
      }, { okLabel: "«» Insert" });
    }
    function insertField(name) {
      if (!X.restoreSel()) return say("click into the document text first");
      const s = doc.getSelection(); if (!s || !s.rangeCount || !ed() || !ed().contains(s.anchorNode)) return say("click into the document text first");
      const r = s.getRangeAt(0); r.deleteContents();
      const sp = doc.createElement("span"); sp.setAttribute("data-field", name); sp.textContent = `«${name}»`; sp.contentEditable = "false";
      r.insertNode(sp); r.setStartAfter(sp); r.collapse(true); s.removeAllRanges(); s.addRange(r);
      X.keepSel(); X.live();
      setTimeout(() => { const e0 = ed(); if (e0) { try { e0.focus({ preventScroll: true }); } catch (e) { e0.focus(); } X.restoreSel(); } }, 0);
      say(`«${name}» put in`);
    }
    function setPreview(on, step) {
      const H = headL(), m = mergeOf(H); if (!m) return say("pick the data first: «» Merge ▾ ▸ Data Source…");
      if (on != null) m.preview = on;
      if (step) { m.preview = true; m.rec = Math.max(0, Math.min(m.rows.length - 1, (m.rec || 0) + step)); }
      if (X.editing && X.editing()) X.end();
      redraw(H);
      say(m.preview ? `record ${(m.rec || 0) + 1} of ${m.rows.length}` : "the fields shown as «Field» again");
    }
    function finishDialog() {
      const H = headL(), m = mergeOf(H);
      if (!m) return say("pick the data first: «» Merge ▾ ▸ Data Source…");
      if (!/data-field=/.test(H.doc.html)) return say("there are no merge fields in this text yet - Insert Merge Field… first");
      if (X.editing && X.editing()) X.end();
      const firstF = m.fields[0] || "";
      E.ui.dialog("Finish & Merge", `<div class="kxrow"><span>Make</span><select id="pdmMode">
          <option value="one">One Word document - every record from a new page</option>
          <option value="each">A Word document for each record (.zip)</option>
          <option value="word">A Word mail-merge document + the data (.zip, for Word's Mailings)</option></select></div>
        <div class="kxrow"><span>Records</span><select id="pdmAll"><option value="all">All ${m.rows.length}</option><option value="range">From … to …</option></select>
          <input type="number" id="pdmFrom" value="1" min="1" max="${m.rows.length}" style="width:70px"> – <input type="number" id="pdmTo" value="${m.rows.length}" min="1" max="${m.rows.length}" style="width:70px"></div>
        <div class="kxrow"><span>Name</span><input id="pdmName" value="${esc((S.name || "Merged").replace(/\.[a-z0-9]+$/i, ""))}" style="width:220px"></div>
        <div class="kxrow"><span>Each file</span><input id="pdmEach" value="${esc(firstF ? `«#» - «${firstF}»` : "«#»")}" style="width:220px"></div>
        <div class="kxrow" style="color:var(--pc-dim)">«#» = the record's number; «Field» = its value.</div>`, async (dlg) => {
        const mode = dlg.querySelector("#pdmMode").value, all = dlg.querySelector("#pdmAll").value === "all";
        const a = all ? 1 : Math.max(1, +dlg.querySelector("#pdmFrom").value || 1), b = all ? m.rows.length : Math.min(m.rows.length, +dlg.querySelector("#pdmTo").value || m.rows.length);
        if (b < a) return say("the range is empty");
        const model = E.docx && E.docx.modelOf ? E.docx.modelOf(H) : null;
        if (!model) return say("the Word file maker is not loaded");
        say(`merging ${b - a + 1} record(s)…`);
        try {
          const r = await win.fetch("/api/docx/merge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model, fields: m.fields, rows: m.rows.slice(a - 1, b), first: a, mode, name: dlg.querySelector("#pdmName").value.trim() || "Merged", each: dlg.querySelector("#pdmEach").value }) });
          const j = await r.json(); if (!r.ok || j.error) throw new Error(j.error || "HTTP " + r.status);
          const el = doc.createElement("a"); el.href = j.url; el.download = j.name; doc.body.appendChild(el); el.click(); el.remove();
          PCDocMerge.last = j;
          say(`${j.name} - ${j.records} record(s) - saved in the project's docs folder and downloaded`);
        } catch (e) { say("could not merge: " + e.message); }
      }, { okLabel: "🖨 Merge" });
    }
    // a field is one piece while typing (words typed after it go after it, Backspace takes it whole) - the attribute
    // never reaches the story (the cleaner drops it)
    const atoms = () => { const e0 = ed(); if (e0) for (const sp of e0.querySelectorAll("span[data-field]")) if (sp.contentEditable !== "false") sp.contentEditable = "false"; };
    doc.addEventListener("focusin", (e) => { const e0 = ed(); if (e0 && e.target === e0) atoms(); }, true);
    const C = E.ui.addCmd, has = () => !!mergeOf(headL());
    C("doc.merge.source", "📇 Data Source…", "", sourceDialog);
    C("doc.merge.field", "«» Insert Merge Field…", "", fieldDialog, { enabled: has });
    C("doc.merge.preview", "Preview Results", "", () => { const m = mergeOf(headL()); setPreview(!(m && m.preview)); }, { enabled: has, checked: () => { const m = mergeOf(headL()); return !!(m && m.preview); } });
    C("doc.merge.prev", "◀ Previous Record", "", () => setPreview(null, -1), { enabled: has });
    C("doc.merge.next", "▶ Next Record", "", () => setPreview(null, 1), { enabled: has });
    C("doc.merge.finish", "🖨 Finish & Merge…", "", finishDialog, { enabled: has });
    const MENU = () => ["doc.merge.source", "doc.merge.field", E.ui.sep, "doc.merge.preview", "doc.merge.prev", "doc.merge.next", E.ui.sep, "doc.merge.finish"];
    const T = E.tools.doctext, ob = T.options, bb = T.bindOptions;
    T.options = function () {
      const h = ob.call(this), btn = '<button class="ghost" id="pdmMenu" title="Mail merge: the data, fields, preview, finish">«» Merge ▾</button>';
      return h.indexOf('id="pdnFn"') >= 0 ? h.replace(/(<button class="ghost" id="pdnFn"[^>]*>[^<]*<\/button>)/, "$1" + btn) : h + btn;
    };
    T.bindOptions = function (o) {
      bb.call(this, o);
      const b = o.querySelector("#pdmMenu");
      if (b) { b.onmousedown = (e) => e.preventDefault(); b.onclick = (ev) => { X.keepSel(); const kr = (E.kx || E.stage).getBoundingClientRect(), r = ev.currentTarget.getBoundingClientRect(); E.ui.menuAt(MENU(), r.left - kr.left, r.bottom - kr.top, 0); }; }
    };
    E.docMerge = { sourceDialog, fieldDialog, insertField, setPreview, finishDialog, menu: MENU, head: headL };
  }

  const PCDocMerge = { parseCSV, fillHtml, recordOf, fileName, install, last: null, MAX_ROWS, MAX_FIELDS };
  if (typeof module !== "undefined" && module.exports) module.exports = PCDocMerge;
  if (root && root.document) root.PCDocMerge = PCDocMerge;
})(typeof window !== "undefined" ? window : globalThis);
