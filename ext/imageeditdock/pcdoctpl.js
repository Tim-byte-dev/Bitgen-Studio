/* pcdoctpl.js — 🧾 DOCUMENT TEMPLATES: INVOICES, QUOTES, RECEIPTS (2.841.0), window.PCDocTpl.
 *
 * Tim (verbatim): "allow user to create a template in image editor so user can create invoices, user can talk to llm or type
 * invoice needs."
 *   A TEMPLATE  any image editor document (pages, WP frames, text layers, pictures - your logo, your look) with {{fields}} in
 *               its words - {{client_name}}, {{from_name}}, {{notes}} … - and, for line items, a table row of {{item.description}}
 *               {{item.qty}} {{item.price}} {{item.amount}}. bitGen fills {{number}} (INV-0001 … counted per template), {{date}},
 *               {{due_date}}, {{subtotal}}, {{tax_rate}}, {{tax}}, {{total}} itself. File ▸ 🧾 Save as Template… keeps it
 *               (lib/docTemplates.js, <app>/doc_templates/); Invoice, Quote and Receipt are built in.
 *   FILL        File ▸ 🧾 New From Template… opens a copy and the 🧾 Fill box: the fields (your own details remembered per
 *               template), the line items (＋ rows), ✨ Ask the AI ("3 hours of design at $90 for Acme, due in 7 days") fills
 *               the box; Fill puts it all in - one undo. Or say it in the prompt docker: "make an invoice for Acme for 3 hours
 *               of design at $90" - the template opens (the one in front, else your newest of that kind, else the built-in one)
 *               and fills. The sums are worked out here, never by the LLM. Export with File ▸ Export (PDF / Word) as usual.
 * Pure (Node + jsdom: scripts/test-841.js): fieldsOf, hasItems, money, totals, fillText, fillHtml, labelOf, addDays, builtin.
 */
(function (root) {
  "use strict";
  /* ================================ pure ================================ */
  const RE = /\{\{\s*([\w.-]+)\s*\}\}/g;
  const COMPUTED = ["number", "date", "due_date", "subtotal", "tax_rate", "tax", "total", "currency"];
  const escH = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  /** the fields a template asks for (in order; not the item columns, not the ones bitGen fills) */
  function fieldsOf(texts) {
    const out = [];
    for (const t of texts || []) for (const m of String(t || "").replace(/<[^>]+>/g, "").matchAll(RE)) { const k = m[1]; if (!/^item\./.test(k) && !COMPUTED.includes(k) && !out.includes(k)) out.push(k); }
    return out;
  }
  const hasItems = (texts) => (texts || []).some((t) => /\{\{\s*item\.[\w-]+\s*\}\}/.test(String(t || "").replace(/<[^>]+>/g, "")));
  const HAS = /\{\{\s*[\w.-]+\s*\}\}/;
  const hasFields = (texts) => (texts || []).some((t) => HAS.test(String(t || "").replace(/<[^>]+>/g, "")));
  function money(n, cur) {
    const v = Math.round((+n || 0) * 100) / 100, neg = v < 0, s = Math.abs(v).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return (neg ? "-" : "") + (cur == null ? "$" : cur) + s;
  }
  const r2 = (n) => Math.round((+n || 0) * 100) / 100;
  /** the items' sums: each amount = qty x price (cents), subtotal, tax at rate %, total */
  function totals(items, rate) {
    const amounts = (items || []).map((it) => r2((+it.qty || 0) * (+it.price || 0))), subtotal = r2(amounts.reduce((a, b) => a + b, 0)), tax = r2(subtotal * (+rate || 0) / 100);
    return { amounts, subtotal, tax, total: r2(subtotal + tax) };
  }
  /** plain words: every {{field}} -> its value (one it does not know -> left out) */
  const fillText = (s, v) => String(s || "").replace(RE, (a, k) => (v && v[k] != null ? String(v[k]) : ""));
  const qtyS = (q) => { const n = +q || 0; return String(Math.round(n * 1000) / 1000); };
  /** a WP layer's html: each table row with {{item.*}} made once per item; every {{field}} -> its value (escaped; new lines
   *  -> <br>); a placeholder split by formatting tags is still found */
  function fillHtml(html, values, items, cur, document) {
    const d = document || root.document, box = d.createElement("div"); box.innerHTML = String(html || "");
    // a placeholder broken up by tags ({{<b>client</b>_name}}) put back together first
    box.innerHTML = box.innerHTML.replace(/\{\{((?:\s|<[^>]+>|[\w.-])+?)\}\}/g, (a, inner) => "{{" + inner.replace(/<[^>]+>/g, "").trim() + "}}");
    const t = totals(items, values && values.tax_rate);
    for (const tr of [...box.querySelectorAll("tr")]) {
      if (!/\{\{\s*item\./.test(tr.innerHTML)) continue;
      (items || []).forEach((it, i) => {
        const c = tr.cloneNode(true), iv = { "item.description": it.description || "", "item.qty": qtyS(it.qty), "item.price": money(it.price, cur), "item.amount": money(t.amounts[i], cur), "item.n": String(i + 1) };
        c.innerHTML = c.innerHTML.replace(RE, (a, k) => (iv[k] != null ? escH(iv[k]).replace(/\n/g, "<br>") : ""));
        tr.parentNode.insertBefore(c, tr);
      });
      tr.remove();
    }
    return box.innerHTML.replace(RE, (a, k) => (values && values[k] != null ? escH(values[k]).replace(/\n/g, "<br>") : ""));
  }
  /** a field's name as a label: client_name -> Client name */
  const labelOf = (k) => { const s = String(k).replace(/[_.-]+/g, " ").trim(); return s.charAt(0).toUpperCase() + s.slice(1); };
  function addDays(iso, n) { const d = new Date(String(iso || "") + "T12:00:00Z"); if (isNaN(d)) return ""; d.setUTCDate(d.getUTCDate() + (+n || 0)); return d.toISOString().slice(0, 10); }
  /** the built-in templates: {name, kind, html} - a WP frame's words */
  function builtin(kind) {
    const k = ["invoice", "quote", "receipt"].includes(kind) ? kind : "invoice";
    const T = { invoice: ["INVOICE", "Invoice no.", "Bill to", "Due"], quote: ["QUOTE", "Quote no.", "Quote for", "Valid until"], receipt: ["RECEIPT", "Receipt no.", "Received from", "Paid on"] }[k];
    // (the tags made by el() - the document's own words are not app words for the UI translation's scanner)
    const el = (t, a, inner) => "<" + t + (a ? " " + a : "") + ">" + (inner == null ? "" : inner) + "</" + t + ">", br = "<" + "br>";
    const cell = 'style="border:none;padding:0"', R = 'style="text-align:right"', col = (w) => "<" + 'col style="width:' + w + '%">';
    const html = el("p", 'data-style="title"', T[0])
      + el("p", "", el("b", "", "{{from_name}}") + br + "{{from_address}}" + br + "{{from_email}} · {{from_phone}}" + br + "{{from_business_number}}")
      + el("table", 'style="width:100%;table-layout:fixed;border:none"', el("colgroup", "", col(55) + col(45)) + el("tbody", "", el("tr", "",
        el("td", cell, el("p", "", el("b", "", T[2])) + el("p", "", "{{client_name}}" + br + "{{client_address}}" + br + "{{client_email}}"))
        + el("td", cell, el("p", R, T[1] + " " + el("b", "", "{{number}}") + br + "Date {{date}}" + br + T[3] + " {{due_date}}")))))
      + el("table", 'style="width:100%;table-layout:fixed"', el("colgroup", "", col(52) + col(12) + col(18) + col(18))
        + el("thead", "", el("tr", "", el("th", "", "Description") + el("th", R, "Qty") + el("th", R, "Price") + el("th", R, "Amount")))
        + el("tbody", "", el("tr", "", el("td", "", "{{item.description}}") + el("td", R, "{{item.qty}}") + el("td", R, "{{item.price}}") + el("td", R, "{{item.amount}}"))))
      + el("p", R, "Subtotal {{subtotal}}" + br + "Tax ({{tax_rate}}%) {{tax}}" + br + el("b", "", "Total {{total}}"))
      + (k === "invoice" ? el("p", "", el("b", "", "Payment") + br + "{{payment_details}}") : "") + el("p", "", "{{notes}}");
    return { name: "_builtin-" + k, kind: k, title: T[0].charAt(0) + T[0].slice(1).toLowerCase(), html };
  }
  const pure = { RE, HAS, COMPUTED, fieldsOf, hasItems, hasFields, money, totals, fillText, fillHtml, labelOf, addDays, builtin };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  /* ================================ the page ================================ */
  function install(E) {
    const { S, doc, win, store } = E, say = E.say || (() => {});
    if (!E.ui || !E.ui.addCmd || !E.docText) return;
    const api = async (u, body, raw) => { const r = await win.fetch(u, raw ? { method: "POST", body } : body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}); const j = await r.json().catch(() => ({})); if (!r.ok || j.error) throw new Error(j.error || "HTTP " + r.status); return j; };
    const today = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
    const editorOn = () => (typeof root.ieOnScreen === "function" ? !!root.ieOnScreen() : true);
    /** every layer list of the document (this page + the others) */
    function lists() { const out = [S.layers]; const pp = S.pages; if (pp && pp.list) pp.list.forEach((pg, i) => { if (pg.st && pg.st.layers && pg.st.layers !== S.layers && !(i === pp.cur && pp.editing == null)) out.push(pg.st.layers); }); return out; }
    function textsNow() { const t = []; for (const ls of lists()) for (const L of ls) { if (L.type === "doc" && L.doc) t.push(L.doc.html); else if (L.type === "text" && L.text) t.push(L.text.str); } return t; }
    function tplNow() { for (const ls of lists()) for (const L of ls) if (L.tpl && L.tpl.name) return L.tpl; return null; }
    const isTemplateDoc = () => S.w && hasFields(textsNow());
    async function metaOf(name) { const j = await api("/api/doctemplates/number", { name, peek: true }); return j; }
    /** put it all in: {values, items} - one undo for this page (the other pages changed with it) */
    function apply(values, items, cur) {
      const flows = new Set();
      const doIt = (ls) => { for (const L of ls) {
        if (L.type === "doc" && L.doc && HAS.test(L.doc.html.replace(/<[^>]+>/g, ""))) { L.doc.html = E.docText.sanitize(fillHtml(L.doc.html, values, items, cur, doc)); if (L.doc.flow) flows.add(L.doc.flow.id); }
        else if (L.type === "text" && L.text && HAS.test(L.text.str || "")) { L.text.str = fillText(L.text.str, values); delete L.text.runs; if (E.D && E.D.rasterize) E.D.rasterize(L); }
      } };
      E.structOp("🧾 fill the template", () => { for (const ls of lists()) doIt(ls); });
      for (const id of flows) E.docText.reflow(id);
      E.refresh(); E.renderLayersPanel();
    }
    /** the details -> the document: the number counted on, the dates, the sums */
    async function fill(o) {
      const tpl = tplNow() || { name: "_builtin-invoice", kind: "invoice" };
      const m = (await metaOf(tpl.name)).meta, cur = o.currency || m.currency, v = Object.assign({}, o.fields || {});
      if (!v.number) v.number = (await api("/api/doctemplates/number", { name: tpl.name })).number;
      v.date = v.date || today(); v.due_date = v.due_date || addDays(v.date, m.dueDays); v.tax_rate = v.tax_rate != null && v.tax_rate !== "" ? v.tax_rate : m.taxRate; v.currency = cur;
      const items = (o.items || []).filter((it) => it && (String(it.description || "").trim() || +it.price));
      const t = totals(items, v.tax_rate); v.subtotal = money(t.subtotal, cur); v.tax = money(t.tax, cur); v.total = money(t.total, cur);
      apply(v, items, cur);
      // your own details (from_*, payment) remembered for this template
      const keep = {}; for (const [k, x] of Object.entries(o.fields || {})) if (/^(from_|payment)/.test(k) && x) keep[k] = x;
      if (Object.keys(keep).length) api("/api/doctemplates/meta", { name: tpl.name, meta: { defaults: Object.assign({}, m.defaults, keep) } }).catch(() => {});
      say(`🧾 ${tpl.kind} ${v.number} filled - total ${v.total}` + (items.length ? ` (${items.length} item(s))` : "") + " · File ▸ Export for PDF / Word · Ctrl+Z takes it back");
      return { number: v.number, total: v.total, items: items.length };
    }
    async function askAi(ask, fields) {
      const tpl = tplNow() || { kind: "invoice", name: "_builtin-invoice" }, m = (await metaOf(tpl.name)).meta;
      return api("/api/doctemplates/ai", { ask, fields, kind: tpl.kind, currency: m.currency, today: today(), items: hasItems(textsNow()) });
    }
    /* ---- the 🧾 Fill box */
    async function fillDialog(pre) {
      if (!isTemplateDoc()) return say("this document has no {{fields}} - File ▸ 🧾 New From Template… first");
      const tpl = tplNow() || { name: "_builtin-invoice", kind: "invoice" }, texts = textsNow(), fields = fieldsOf(texts), items = hasItems(texts);
      const mm = (await metaOf(tpl.name)), m = mm.meta;
      const val = (k) => (pre && pre.fields && pre.fields[k] != null ? pre.fields[k] : m.defaults[k] || "");
      const big = (k) => /address|notes|payment|details/.test(k);
      const rowsHtml = (list) => (list && list.length ? list : [{ description: "", qty: 1, price: "" }]).map((it) => `<tr><td><input class="tplD" value="${escH(it.description)}" style="width:100%"></td><td><input class="tplQ" type="number" step="any" value="${escH(it.qty)}" style="width:70px"></td><td><input class="tplP" type="number" step="any" value="${escH(it.price)}" style="width:90px"></td><td><button class="ghost tplX" title="Remove">✕</button></td></tr>`).join("");
      E.ui.dialog("🧾 Fill " + (tpl.kind.charAt(0).toUpperCase() + tpl.kind.slice(1)), `
        <div class="rw"><span>✨ Ask the AI</span><textarea id="tplAsk" rows="2" style="flex:1" placeholder="e.g. 3 hours of logo design at $90 and hosting $20 for Acme Pty Ltd, due in 7 days"></textarea><button class="ghost" id="tplAskGo">✨ Fill in</button></div>
        <div class="rw"><span>Number</span><input id="tpl_number" placeholder="${escH(mm.number)} (next)"><span>Date</span><input id="tpl_date" type="date" value="${today()}"><span>Tax %</span><input id="tpl_tax_rate" type="number" step="any" value="${m.taxRate}" style="width:70px"></div>
        ${fields.map((k) => `<div class="rw"><span>${escH(labelOf(k))}</span>${big(k) ? `<textarea id="tpl_${k}" rows="2" style="flex:1">${escH(val(k))}</textarea>` : `<input id="tpl_${k}" value="${escH(val(k))}" style="flex:1">`}</div>`).join("")}
        ${items ? `<table class="tplItems" style="width:100%;margin-top:6px"><thead><tr><th style="text-align:left">Description</th><th>Qty</th><th>Price</th><th></th></tr></thead><tbody>${rowsHtml(pre && pre.items)}</tbody></table><button class="ghost" id="tplAdd">＋ Item</button>` : ""}`, (dlg) => {
        const q = (s) => dlg.querySelector(s), fv = {};
        for (const k of fields) { const el = q("#tpl_" + k); if (el && el.value.trim()) fv[k] = el.value; }
        if (q("#tpl_number").value.trim()) fv.number = q("#tpl_number").value.trim();
        fv.date = q("#tpl_date").value; fv.tax_rate = q("#tpl_tax_rate").value;
        const its = items ? [...dlg.querySelectorAll(".tplItems tbody tr")].map((tr) => ({ description: tr.querySelector(".tplD").value, qty: +tr.querySelector(".tplQ").value || 0, price: +tr.querySelector(".tplP").value || 0 })) : [];
        fill({ fields: fv, items: its }).catch((e) => say("🧾 " + e.message));
      }, { okLabel: "🧾 Fill", wide: true, init: (dlg) => {
        const tb = dlg.querySelector(".tplItems tbody");
        const wire = () => dlg.querySelectorAll(".tplX").forEach((b) => { b.onclick = () => { b.closest("tr").remove(); }; });
        wire();
        const add = dlg.querySelector("#tplAdd"); if (add) add.onclick = () => { tb.insertAdjacentHTML("beforeend", rowsHtml(null)); wire(); };
        dlg.querySelector("#tplAskGo").onclick = async () => {
          const b = dlg.querySelector("#tplAskGo"), ask = dlg.querySelector("#tplAsk").value.trim(); if (!ask) return;
          b.disabled = true; b.textContent = "⏳ …";
          try {
            const r = await askAi(ask, fields);
            for (const [k, x] of Object.entries(r.fields || {})) { const el = dlg.querySelector("#tpl_" + k); if (el) el.value = x; }
            if (tb && r.items && r.items.length) { tb.innerHTML = rowsHtml(r.items); wire(); }
          } catch (e) { say("✨ " + e.message); }
          b.disabled = false; b.textContent = "✨ Fill in";
        };
      } });
    }
    /* ---- a new document from a template */
    async function fromTemplate(t) {
      if (t.builtin) {
        const B = builtin(t.kind), m = Math.round(20 / 25.4 * 150);
        E.pages.newDocument({ preset: "A4", wmm: 210, hmm: 297, orient: "portrait", dpi: 150 }, 1, B.title);
        const L = E.docText.addFrame(m, m, S.w - 2 * m, S.h - 2 * m, { auto: true, k: 150 / 96, html: E.docText.sanitize(B.html) }, false);
        L.tpl = { name: B.name, kind: B.kind }; E.docText.end && E.docText.end(); E.docText.reflow(L.doc.flow.id);
        return L;
      }
      const r = await win.fetch("/api/doctemplates/file?name=" + encodeURIComponent(t.name)); if (!r.ok) throw new Error("that template could not be opened");
      await E.bgi.openBytes(new Uint8Array(await r.arrayBuffer()), t.name + ".bgi");
      let marked = false; for (const ls of lists()) for (const L of ls) if (L.type === "doc" || L.type === "text") { L.tpl = { name: t.name, kind: t.kind }; marked = true; }
      if (!marked && S.layers[0]) S.layers[0].tpl = { name: t.name, kind: t.kind };
      return null;
    }
    async function newDialog() {
      let mine = []; try { mine = (await api("/api/doctemplates")).templates; } catch (e) { say("🧾 " + e.message); }
      const items = [{ builtin: true, kind: "invoice", label: "🧾 Invoice (built in)" }, { builtin: true, kind: "quote", label: "📝 Quote (built in)" }, { builtin: true, kind: "receipt", label: "🧾 Receipt (built in)" }]
        .concat(mine.map((t) => ({ name: t.name, kind: t.kind, label: `⭐ ${t.name} · ${t.kind} · next ${t.prefix}${String(t.next).padStart(t.digits, "0")}` })));
      E.ui.dialog("🧾 New From Template", `<div class="tplList" style="display:flex;flex-direction:column;gap:4px;max-height:50vh;overflow:auto">${items.map((t, i) => `<label class="rw" style="gap:8px"><input type="radio" name="tplPick" value="${i}" ${i === 0 ? "checked" : ""}><span style="flex:1">${escH(t.label)}</span>${t.builtin ? "" : `<button class="ghost tplDel" data-n="${escH(t.name)}" title="Delete this template">🗑</button>`}</label>`).join("")}</div>
        <div style="color:var(--pc-dim);margin-top:6px">Your own: lay out any document with {{fields}} and an item row ({{item.description}} {{item.qty}} {{item.price}} {{item.amount}}), then File ▸ 💾 Save as Template….</div>`, (dlg) => {
        const t = items[+((dlg.querySelector("input[name=tplPick]:checked") || {}).value || 0)];
        fromTemplate(t).then(() => setTimeout(() => fillDialog(), 300)).catch((e) => say("🧾 " + e.message));
      }, { okLabel: "Open", init: (dlg) => dlg.querySelectorAll(".tplDel").forEach((b) => { b.onclick = async (e) => { e.preventDefault(); if (!win.confirm || win.confirm(`Delete the template "${b.dataset.n}"?`)) { await api("/api/doctemplates/delete", { name: b.dataset.n }); b.closest("label").remove(); } }; }) });
    }
    function saveDialog() {
      if (!S.w) return say("open or make a document first");
      const t = tplNow(), fields = fieldsOf(textsNow());
      E.ui.dialog("💾 Save as Template", `<div class="rw"><span>Name</span><input id="tplName" value="${escH(t && !/^_builtin-/.test(t.name) ? t.name : "My invoice")}" style="flex:1"></div>
        <div class="rw"><span>Kind</span><select id="tplKind">${["invoice", "quote", "receipt", "order", "letter", "other"].map((k) => `<option ${t && t.kind === k ? "selected" : ""}>${k}</option>`).join("")}</select><span>Numbers start</span><input id="tplPrefix" style="width:70px"></div>
        <div class="rw"><span>Tax %</span><input id="tplTax" type="number" step="any" value="10" style="width:70px"><span>Currency</span><input id="tplCur" value="$" style="width:50px"><span>Due in (days)</span><input id="tplDue" type="number" value="14" style="width:60px"></div>
        <div style="color:var(--pc-dim);margin-top:6px">${fields.length ? "Fields found: " + fields.map((f) => "{{" + escH(f) + "}}").join(" ") : "No {{fields}} in the words yet - type e.g. {{client_name}} where the filled-in words go."}${hasItems(textsNow()) ? " · an item row" : ""}</div>`, (dlg) => {
        const q = (s) => dlg.querySelector(s).value, name = q("#tplName").trim(), kind = q("#tplKind");
        (async () => {
          const out = await E.bgi.toBytes(), bytes = out && out.bytes ? out.bytes : out;   // {bytes, layers, smart}
          const qs = new URLSearchParams({ name, kind, taxRate: q("#tplTax"), currency: q("#tplCur"), dueDays: q("#tplDue") }); if (q("#tplPrefix").trim()) qs.set("prefix", q("#tplPrefix").trim());
          const j = await api("/api/doctemplates/save?" + qs, bytes, true);
          // your own details remembered on the template it came from go with it
          if (t && t.name !== j.meta.name) { try { const pm = (await metaOf(t.name)).meta; if (pm.defaults && Object.keys(pm.defaults).length) j.meta = (await api("/api/doctemplates/meta", { name: j.meta.name, meta: { defaults: Object.assign({}, pm.defaults, j.meta.defaults) } })).meta; } catch (e) { /* kept without them */ } }
          for (const ls of lists()) for (const L of ls) if (L.type === "doc" || L.type === "text") L.tpl = { name: j.meta.name, kind: j.meta.kind };
          say(`💾 template "${j.meta.name}" saved - File ▸ 🧾 New From Template… makes a ${j.meta.kind} from it (next ${j.meta.prefix}${String(j.meta.next).padStart(j.meta.digits, "0")})`);
        })().catch((e) => say("💾 " + e.message));
      }, { okLabel: "💾 Save" });
    }
    E.ui.addCmd("file.tplnew", "🧾 New From Template…", "", () => newDialog(), {}, ["File", "file.newtextdoc"]);
    E.ui.addCmd("file.tplfill", "🧾 Fill This Template…", "", () => fillDialog(), { enabled: () => !!isTemplateDoc() }, ["File", "file.tplnew"]);
    E.ui.addCmd("file.tplsave", "💾 Save as Template…", "", () => saveDialog(), { enabled: () => !!S.w }, ["File", "file.tplfill"]);
    /* ---- the prompt docker: "make an invoice for Acme for 3 hours of design at $90" */
    const WANT = /\b(invoice|quote|quotation|receipt|bill)\b/i, VERB = /\b(make|create|write|draft|prepare|send|generate|do|fill|raise|issue|new)\b/i;
    async function maybe(text) {
      if (!editorOn()) return null;
      const s = String(text || ""); if (!WANT.test(s) || !(VERB.test(s) || isTemplateDoc())) return null;
      if (/\b(slides?|presentation|spreadsheet|report|article|story|letter|e-?mail|essay|summary|blog)\b/i.test(s)) return null;
      const kind = /\bquot/i.test(s) ? "quote" : /\breceipt\b/i.test(s) ? "receipt" : "invoice";
      return aiMake(s, kind, !!(!isTemplateDoc() || (tplNow() && tplNow().kind !== kind && /\b(new|make|create)\b/i.test(s))));
    }
    /** 2.849.0 (✨ Create With the AI, pccreate.js): a new invoice / quote / receipt from words -> the line said */
    async function aiMake(s, kind, fresh) {
      if (fresh !== false) {
        let mine = []; try { mine = (await api("/api/doctemplates")).templates; } catch (e) { /* the built-in one */ }
        const t = mine.find((x) => x.kind === kind);
        await fromTemplate(t ? { name: t.name, kind } : { builtin: true, kind });
      }
      const fields = fieldsOf(textsNow()), r = await askAi(s, fields), tpl = tplNow(), m = (await metaOf(tpl.name)).meta;
      const res = await fill({ fields: Object.assign({}, m.defaults, r.fields), items: r.items });
      return `🧾 ${tpl.kind.charAt(0).toUpperCase() + tpl.kind.slice(1)} ${res.number} is in the image editor - ${res.items} item(s), total ${res.total}. File ▸ 🧾 Fill This Template… on a fresh copy to change it, File ▸ Export for PDF / Word.`;
    }
    root.H3ChatRoutes = [maybe].concat(root.H3ChatRoutes || []);
    E.docTpl = { fill, fillDialog, newDialog, saveDialog, fromTemplate, askAi, tplNow, isTemplateDoc, textsNow, aiMake };
  }
  const PCDocTpl = Object.assign({ install }, pure);
  root.PCDocTpl = PCDocTpl;
})(typeof window !== "undefined" ? window : globalThis);
