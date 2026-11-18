/* pcpageprops.js — 📄 PAGE PROPERTIES: the page's template, size, orientation, resolution and margins in one dialog
 * (2.846.0), window.PCPageProps.
 *
 * Tim (verbatim): "add a page properties dialog, with margin, size, dpi and template dropdown".
 *
 *   File ▸ 📄 Page Properties… (also the right-click menu, the WP View's Layout ribbon, the Web View's ribbon):
 *     TEMPLATE   built-in pages (A4 / Letter documents, an A5 booklet, a print flyer, an A3 poster, a business card, a DL
 *                leaflet, web pages for desktop / tablet / phone, a social post, a 16:9 slide) and YOUR templates
 *                (💾 Save as template… / 🗑 - lib/pageTemplates.js, <app>/page_templates.json, every project); picking one
 *                fills the boxes; the dropdown names the template the page matches.
 *     SIZE       a paper size or your own W x H in mm or px, portrait / landscape; RESOLUTION in dpi (the px it makes shown).
 *     MARGINS    top / bottom / left / right in mm (🔗 all the same); shown on the page as dashed guides (they do not print);
 *                the page's WP layers fitted to them (every frame of their story on the page).
 *     This page or all pages. The size / dpi go through pcpages.js setup() (Canvas Size / Image Size - undoable); the margins
 *     are kept on the page (pg.margins, in the .bgi).
 * Pure (Node: scripts/test-846.js): TEMPLATES, specOf, matchTemplate, marginRect, mmToPx, pxToMm.
 */
(function (root) {
  "use strict";
  /* ================================ pure ================================ */
  const mmToPx = (mm, dpi) => Math.round((+mm || 0) / 25.4 * (dpi || 150));
  const pxToMm = (px, dpi) => Math.round((+px || 0) / (dpi || 150) * 25.4 * 100) / 100;
  const M = (v) => ({ top: v, right: v, bottom: v, left: v });
  const PX = (name, w, h, m) => ({ name, preset: "Custom", wmm: pxToMm(w, 72), hmm: pxToMm(h, 72), orient: w > h ? "landscape" : "portrait", dpi: 72, margins: M(m || 0), px: [w, h] });
  /** the built-in page templates */
  const TEMPLATES = [
    { name: "A4 document", preset: "A4", orient: "portrait", dpi: 150, margins: M(25.4) },
    { name: "Letter document", preset: "Letter", orient: "portrait", dpi: 150, margins: M(25.4) },
    { name: "A5 booklet", preset: "A5", orient: "portrait", dpi: 150, margins: M(15) },
    { name: "A4 flyer (print)", preset: "A4", orient: "portrait", dpi: 300, margins: M(10) },
    { name: "A3 poster", preset: "A3", orient: "portrait", dpi: 150, margins: M(15) },
    { name: "Business card", preset: "Business card", orient: "landscape", dpi: 300, margins: M(4) },
    { name: "DL leaflet", preset: "DL", orient: "portrait", dpi: 300, margins: M(8) },
    PX("Web page - desktop (1440 px)", 1440, 900), PX("Web page - tablet (768 px)", 768, 1024), PX("Web page - phone (390 px)", 390, 844),
    PX("Social post (1080 × 1080)", 1080, 1080), PX("Slide 16:9 (1920 × 1080)", 1920, 1080),
  ];
  /** a template -> the page spec pcpages.js takes ({preset, wmm, hmm, orient, dpi}) + margins */
  function specOf(t, sizes) {
    const ps = (sizes || []).find((x) => x[0] === t.preset);
    const out = { preset: ps ? t.preset : "Custom", orient: t.orient === "landscape" ? "landscape" : "portrait", dpi: +t.dpi || 150, margins: Object.assign(M(0), t.margins || {}) };
    if (ps) { out.wmm = ps[1]; out.hmm = ps[2]; } else { out.wmm = +t.wmm || 210; out.hmm = +t.hmm || 297; }
    return out;
  }
  /** the name of the first template the page is (size + orientation + dpi + margins, within 0.5 mm) - "" for none */
  function matchTemplate(page, list, sizes) {
    const near = (a, b) => Math.abs((+a || 0) - (+b || 0)) <= 0.5, m = page.margins || M(0);
    for (const t of list || []) {
      const s = specOf(t, sizes);
      const same = s.preset === (page.preset || "Custom") && s.orient === page.orient && +s.dpi === +page.dpi && (s.preset !== "Custom" || (near(s.wmm, page.wmm) && near(s.hmm, page.hmm)))
        && ["top", "right", "bottom", "left"].every((k) => near(s.margins[k], m[k]));
      if (same) return t.name;
    }
    return "";
  }
  /** the margins on a W x H px page at dpi -> the area inside them {x, y, w, h} (px; never negative) */
  function marginRect(m, W, H, dpi) {
    const x = mmToPx(m.left, dpi), y = mmToPx(m.top, dpi);
    return { x, y, w: Math.max(0, W - x - mmToPx(m.right, dpi)), h: Math.max(0, H - y - mmToPx(m.bottom, dpi)) };
  }
  const pure = { TEMPLATES, specOf, matchTemplate, marginRect, mmToPx, pxToMm };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  /* ================================ the page ================================ */
  function install(E) {
    const { S, doc, win, store } = E, say = E.say || (() => {});
    if (!E.ui || !E.ui.addCmd || !E.pages) return;
    const PG = root.PCPages, SIZES = (PG && PG.PAGE_SIZES) || [];
    const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    const api = async (u, body) => { const r = await win.fetch(u, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}); const j = await r.json().catch(() => ({})); if (!r.ok || j.error) throw new Error(j.error || "HTTP " + r.status); return j; };
    const isDoc = (L) => !!(L && L.type === "doc" && L.doc);
    let mine = [];
    const loadMine = async () => { try { mine = (await api("/api/pagetemplates")).templates || []; } catch (e) { mine = []; } return mine; };
    const showOn = () => store.get("pp.showm", true) !== false;
    /** the page in front as {preset, wmm, hmm, orient, dpi, margins} (a picture without pages: its size at 150 dpi) */
    function pageNow() {
      const pg = E.pages.current && E.pages.current();
      if (pg) return { preset: pg.preset, wmm: pg.wmm, hmm: pg.hmm, orient: pg.orient, dpi: pg.dpi, margins: pg.margins || marginsFromFrames(pg.dpi) || M(0) };
      const g = PG && PG.guess ? PG.guess(S.w, S.h, 150) : null;
      return Object.assign({ preset: "Custom", wmm: pxToMm(S.w, 150), hmm: pxToMm(S.h, 150), orient: S.w > S.h ? "landscape" : "portrait", dpi: 150 }, g || {}, { margins: marginsFromFrames(150) || M(0) });
    }
    /** a WP layer on the page = its margins (when the page has none set) */
    function marginsFromFrames(dpi) { const L = S.layers.find(isDoc); if (!L || !root.PCDocMargins) return null; return root.PCDocMargins.mmOf(L.doc, S.w, S.h, dpi); }

    /** apply {preset, wmm, hmm, orient, dpi, margins} to the page in front (fit = its WP layers to the margins) */
    function applyHere(spec, fit) {
      E.pages.setup({ preset: spec.preset, wmm: spec.wmm, hmm: spec.hmm, orient: spec.orient, dpi: spec.dpi });
      const pg = E.pages.current(); if (pg) pg.margins = PG && PG.cleanMargins ? PG.cleanMargins(spec.margins) : spec.margins;
      if (fit && root.PCDocMargins) {
        const f = root.PCDocMargins.fromMargins(spec.margins, S.w, S.h, spec.dpi), docs = S.layers.filter(isDoc);
        if (f && docs.length) {
          E.structOp("page margins", () => { for (const L of docs) Object.assign(L.doc, f); });
          const flows = new Set(docs.map((L) => L.doc.flow && L.doc.flow.id)); for (const id of flows) E.docText.reflow(id);
        } else if (docs.length) say("those margins leave no room for the WP text - it was left as it was");
      }
    }
    function apply(spec, all, fit) {
      if (!S.w) return say("open or make a document first");
      if (!all) { applyHere(spec, fit); }
      else {
        E.pages.ensure(); const home = E.pages.cur(), n = E.pages.count();
        for (let i = 0; i < n; i++) { E.pages.go(i); applyHere(spec, fit); }
        E.pages.go(home);
      }
      E.drawOverlay(); if (E.pageView && E.pageView.snap) E.pageView.snap();
      say(`📄 ${all ? "every page" : "the page"}: ${S.w} × ${S.h} px at ${spec.dpi} dpi · margins ${spec.margins.top} / ${spec.margins.right} / ${spec.margins.bottom} / ${spec.margins.left} mm`);
    }

    async function dialog() {
      if (!S.w) return say("open or make a document first - File ▸ New, or 🌐 New Website");
      await loadMine();
      const p = pageNow(), dpis = (PG && PG.DPIS) || [72, 96, 150, 200, 300];
      const all = TEMPLATES.concat(mine), cur = matchTemplate(p, all, SIZES);
      const opt = (t) => `<option value="${esc(t.name)}"${t.name === cur ? " selected" : ""}>${esc(t.name)}</option>`;
      const html = `<div class="rw"><span>Template</span><select id="ppTpl" style="flex:1"><option value="">— as it is —</option><optgroup label="Built in">${TEMPLATES.map(opt).join("")}</optgroup>${mine.length ? `<optgroup label="Your templates">${mine.map(opt).join("")}</optgroup>` : ""}</select>`
        + `<button type="button" class="ghost" id="ppSave" title="Keep these settings as a template of your own (every project)">💾 Save as template…</button><button type="button" class="ghost" id="ppDel" title="Delete the picked template of your own">🗑</button></div>
        <div class="rw" id="ppNameRow" style="display:none"><span>Template name</span><input id="ppTplName" value="My page" style="flex:1"><button type="button" class="ghost" id="ppNameOk">✔ Keep it</button></div>
        <div class="rw"><span>Size</span><select id="ppPreset">${SIZES.map(([n, a, b]) => `<option value="${esc(n)}"${n === p.preset ? " selected" : ""}>${esc(n)} (${a} × ${b} mm)</option>`).join("")}<option value="Custom"${p.preset === "Custom" ? " selected" : ""}>Custom</option></select>
          <span id="ppCustom"><input type="number" id="ppW" step="0.1" min="1" style="width:76px"> × <input type="number" id="ppH" step="0.1" min="1" style="width:76px"> <select id="ppUnit"><option value="mm">mm</option><option value="px">px</option></select></span></div>
        <div class="rw"><span>Orientation</span><label><input type="radio" name="ppOr" value="portrait"${p.orient !== "landscape" ? " checked" : ""}> ▯ Portrait</label><label><input type="radio" name="ppOr" value="landscape"${p.orient === "landscape" ? " checked" : ""}> ▭ Landscape</label></div>
        <div class="rw"><span>Resolution</span><input type="number" id="ppDpi" list="ppDpis" min="36" max="600" value="${p.dpi}" style="width:70px"><datalist id="ppDpis">${dpis.map((d) => `<option value="${d}">`).join("")}</datalist> dpi <span id="ppPx" style="color:var(--pc-dim)"></span></div>
        <div class="rw"><span>Margins (mm)</span>Top <input type="number" id="ppMt" min="0" step="0.5" style="width:60px"> Bottom <input type="number" id="ppMb" min="0" step="0.5" style="width:60px"> Left <input type="number" id="ppMl" min="0" step="0.5" style="width:60px"> Right <input type="number" id="ppMr" min="0" step="0.5" style="width:60px"> <label title="All four the same"><input type="checkbox" id="ppLink"> 🔗</label></div>
        <div class="rw"><label><input type="checkbox" id="ppShow"${showOn() ? " checked" : ""}> Show the margins on the page (they do not print)</label><label><input type="checkbox" id="ppFit"${S.layers.some(isDoc) ? " checked" : ""}> Fit the WP layers to the margins</label></div>
        <div class="rw"><span>Apply to</span><label><input type="radio" name="ppAll" value="0" checked> This page</label><label><input type="radio" name="ppAll" value="1"> All pages</label></div>`;
      E.ui.dialog("📄 Page Properties", html, (d) => {
        const spec = read(d); if (!spec) return false;
        store.set("pp.showm", d.querySelector("#ppShow").checked);
        apply(spec, d.querySelector('input[name="ppAll"]:checked').value === "1", d.querySelector("#ppFit").checked);
        return true;
      }, { okLabel: "Apply", wide: true, init: (d) => {
        const $ = (id) => d.querySelector("#" + id);
        const setSize = (wmm, hmm) => { const unit = $("ppUnit").value, dpi = +$("ppDpi").value || 150; $("ppW").value = unit === "px" ? mmToPx(wmm, dpi) : Math.round(wmm * 10) / 10; $("ppH").value = unit === "px" ? mmToPx(hmm, dpi) : Math.round(hmm * 10) / 10; };
        const fill = (s) => {
          $("ppPreset").value = SIZES.some((x) => x[0] === s.preset) ? s.preset : "Custom";
          if (s.px) $("ppUnit").value = "px"; else if ($("ppPreset").value !== "Custom") $("ppUnit").value = "mm";
          d.querySelector(`input[name="ppOr"][value="${s.orient === "landscape" ? "landscape" : "portrait"}"]`).checked = true;
          $("ppDpi").value = s.dpi;
          const ps = SIZES.find((x) => x[0] === s.preset);
          setSize(ps ? ps[1] : s.wmm, ps ? ps[2] : s.hmm);
          const m = s.margins || M(0); $("ppMt").value = m.top; $("ppMb").value = m.bottom; $("ppMl").value = m.left; $("ppMr").value = m.right;
          $("ppLink").checked = m.top === m.bottom && m.top === m.left && m.top === m.right;
          upd();
        };
        const upd = () => {
          $("ppCustom").style.display = $("ppPreset").value === "Custom" ? "" : "none";
          const s = read(d, true); if (!s) { $("ppPx").textContent = ""; return; }
          const px = PG && PG.pagePx ? PG.pagePx(s) : { w: mmToPx(s.wmm, s.dpi), h: mmToPx(s.hmm, s.dpi) };
          $("ppPx").textContent = `= ${px.w} × ${px.h} px`;
          const t = matchTemplate(Object.assign({}, s, { wmm: s.wmm, hmm: s.hmm }), TEMPLATES.concat(mine), SIZES);
          if ($("ppTpl").value !== t) $("ppTpl").value = t;
          $("ppDel").disabled = !mine.some((x) => x.name === $("ppTpl").value);
        };
        fill(p);
        $("ppTpl").onchange = () => { const t = TEMPLATES.concat(mine).find((x) => x.name === $("ppTpl").value); if (t) fill(Object.assign(specOf(t, SIZES), { px: t.px })); };
        let unitWas = $("ppUnit").value;
        $("ppUnit").onchange = () => { const dpi = +$("ppDpi").value || 150, to = $("ppUnit").value; for (const id of ["ppW", "ppH"]) { const v = +$(id).value; $(id).value = unitWas === to ? v : to === "px" ? mmToPx(v, dpi) : Math.round(pxToMm(v, dpi) * 10) / 10; } unitWas = to; upd(); };
        $("ppDpi").addEventListener("change", () => { if ($("ppUnit").value === "px") upd(); });
        for (const id of ["ppPreset", "ppW", "ppH", "ppDpi", "ppMt", "ppMb", "ppMl", "ppMr"]) { $(id).addEventListener("input", upd); $(id).addEventListener("change", upd); }
        d.querySelectorAll('input[name="ppOr"]').forEach((r) => { r.onchange = () => { if ($("ppPreset").value === "Custom") { const w = $("ppW").value; $("ppW").value = $("ppH").value; $("ppH").value = w; } upd(); }; });
        for (const id of ["ppMt", "ppMb", "ppMl", "ppMr"]) $(id).addEventListener("input", () => { if ($("ppLink").checked) for (const o of ["ppMt", "ppMb", "ppMl", "ppMr"]) if (o !== id) $(o).value = $(id).value; upd(); });
        $("ppSave").onclick = () => { const row = $("ppNameRow"); row.style.display = row.style.display === "none" ? "" : "none"; if (mine.some((x) => x.name === $("ppTpl").value)) $("ppTplName").value = $("ppTpl").value; if (row.style.display === "") $("ppTplName").select(); };
        $("ppTplName").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); $("ppNameOk").click(); } }, true);
        $("ppNameOk").onclick = () => {
          const s = read(d), name = $("ppTplName").value.trim(); if (!s || !name) return;
          api("/api/pagetemplates/save", { template: Object.assign({ name }, s) }).then(async (r) => {
            await loadMine(); const sel = $("ppTpl");
            sel.innerHTML = `<option value="">— as it is —</option><optgroup label="Built in">${TEMPLATES.map((t) => `<option value="${esc(t.name)}">${esc(t.name)}</option>`).join("")}</optgroup><optgroup label="Your templates">${mine.map((t) => `<option value="${esc(t.name)}">${esc(t.name)}</option>`).join("")}</optgroup>`;
            sel.value = r.template.name; $("ppNameRow").style.display = "none"; upd(); say(`💾 page template "${r.template.name}" kept - every project lists it`);
          }).catch((e) => say("💾 " + e.message));
        };
        $("ppDel").onclick = () => {
          const n = $("ppTpl").value; if (!mine.some((x) => x.name === n)) return;
          api("/api/pagetemplates/delete", { name: n }).then(async () => { await loadMine(); const o = $("ppTpl").querySelector(`option[value="${CSS.escape(n)}"]`); if (o) o.remove(); $("ppTpl").value = ""; upd(); say(`🗑 page template "${n}" deleted`); }).catch((e) => say("🗑 " + e.message));
        };
      } });
    }
    /** the dialog's boxes -> {preset, wmm, hmm, orient, dpi, margins} (null when a box is wrong; quiet = no message) */
    function read(d, quiet) {
      const $ = (id) => d.querySelector("#" + id), dpi = Math.round(+$("ppDpi").value);
      if (!(dpi >= 36 && dpi <= 600)) { if (!quiet) say("the resolution is 36 - 600 dpi"); return null; }
      const preset = $("ppPreset").value, orient = d.querySelector('input[name="ppOr"]:checked').value, unit = $("ppUnit").value;
      let wmm, hmm;
      const ps = SIZES.find((x) => x[0] === preset);
      if (ps) { wmm = ps[1]; hmm = ps[2]; } else { const w = +$("ppW").value, h = +$("ppH").value; if (!(w > 0 && h > 0)) { if (!quiet) say("type the page's width and height"); return null; } wmm = unit === "px" ? pxToMm(w, dpi) : w; hmm = unit === "px" ? pxToMm(h, dpi) : h; }
      const m = { top: +$("ppMt").value || 0, bottom: +$("ppMb").value || 0, left: +$("ppMl").value || 0, right: +$("ppMr").value || 0 };
      return { preset: ps ? preset : "Custom", wmm, hmm, orient, dpi, margins: m };
    }
    // the margins on the page: dashed guides (not printed, not exported)
    E.overlayHooks.push((g, px) => {
      if (!showOn() || !S.w) return;
      const pg = E.pages.current && E.pages.current(); if (!pg || !pg.margins) return;
      const m = pg.margins; if (!(m.top || m.right || m.bottom || m.left)) return;
      const r = marginRect(m, S.w, S.h, pg.dpi);
      g.save(); g.strokeStyle = "rgba(214,61,180,.75)"; g.lineWidth = px; g.setLineDash([4 * px, 4 * px]); g.strokeRect(r.x + 0.5 * px, r.y + 0.5 * px, r.w, r.h); g.restore();
    });
    const C = E.ui.addCmd;
    C("page.props", "📄 Page Properties…", "", dialog, { enabled: () => !!S.w }, ["File", "file.newpages"]);
    E.ui.stageCtxItems = (E.ui.stageCtxItems || []).concat(["page.props"]);
    E.pageProps = { dialog, apply, pageNow, read, TEMPLATES, mine: () => mine };
  }
  const PCPageProps = Object.assign({ install }, pure);
  if (root && root.document) root.PCPageProps = PCPageProps;
})(typeof window !== "undefined" ? window : globalThis);
