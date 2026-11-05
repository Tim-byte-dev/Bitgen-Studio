/* bitGen Studio — ext/pushpulldock/ppsheetsdlg.js (2.665.0): THE 📄 BUILDING PLANS DIALOG - window.PPSheetsDlg.
 *
 * Tim (verbatim): "add a button in sketcher top toolstrip to create building plans ... bring up a dialog with titlebar for
 * building plans custom so user can check if they want dimensions, all views on 1 a1 page, views of different pages etc"
 *
 *   📄 Plans (the Sketcher's bar, after ✨ Photo) opens <dialog id="ppSheetDlg">: a title bar (drag it - the place is kept in
 *   dialog_layout.cfg like every dialog's, static/dlglayout.js [data-dlg-drag]), the options down the side (sheet A4 - A1 +
 *   landscape / portrait, scale auto / 1:20 - 1:500, all views on one sheet / one view per page, which views, dimensions, room
 *   names / areas, furniture, coloured, the title block's words), a live preview of the pages (◀ ▶), 💾 Save PDF - into the
 *   project's pdf folder (POST /api/pdf/save - routes/pdf.js, lib/pdfStore.js: File ▸ Open PDF from Project finds it) and,
 *   ticked, downloaded too. The options are kept in this browser (localStorage pp.sheets), the date is today's each time.
 *   The drawing itself is ppsheets.js (window.PPSheets); the PDF is written by pdf-lib (static/vendor, MIT).
 */
(function (root) {
  "use strict";
  const doc = root.document; if (!doc) return;
  const $ = (id) => doc.getElementById(id);
  const H = () => root.H3PushPull, SH = () => root.PPSheets;
  const KEY = "pp.sheets";
  const S = { open: false, page: 0, res: null, t: 0 };

  function loadScript(src, test) {
    if (test()) return Promise.resolve(test());
    return new Promise((ok, bad) => { const s = doc.createElement("script"); s.src = src; s.onload = () => (test() ? ok(test()) : bad(new Error(src + " did not load"))); s.onerror = () => bad(new Error(src + " did not load")); doc.head.appendChild(s); });
  }
  const pdflib = () => loadScript("/static/vendor/pdf-lib.min.js", () => root.PDFLib);
  const deps = () => ({ PPArch: root.PPArch, PPPlan: root.PPPlan, PPTerrain: root.PPTerrain, hex: root.PPFurn ? (c) => root.PPFurn.hex(c) : null, footprint: root.PPFurn ? (it) => root.PPFurn.footprint(it) : null, label: root.PPFurn ? (it) => root.PPFurn.label(it) : null });
  const model = () => { const h = H(); return h && h.state && h.state.M ? h.state.M.arch : null; };
  const modelName = () => { try { return H().nameNow(); } catch (e) { return "model"; } };
  function msg(t) { try { H().msg(t); } catch (e) { /* not booted */ } }
  function test(k, v) { try { if (root.H3TestEvent) root.H3TestEvent(k, v); } catch (e) { /* the 🧪 list */ } }

  /* ---------------- the dialog */
  function css() {
    if ($("ppSheetCss")) return;
    const st = doc.createElement("style"); st.id = "ppSheetCss"; st.textContent =
      "#ppSheetDlg{width:min(1240px,96vw);padding:0;border:1px solid var(--line,#3a352d);border-radius:8px;background:var(--panel,#1f1c17);color:var(--text,#e8e2d6);max-width:98vw;max-height:96vh;overflow:hidden}" +
      "#ppSheetDlg::backdrop{background:#0008}.ppsd{margin:0;display:flex;flex-direction:column;max-height:96vh}" +
      ".ppsd-bar{display:flex;gap:8px;align-items:center;padding:7px 10px;border-bottom:1px solid var(--line,#3a352d);background:var(--panel-2,#26221c);cursor:move;user-select:none}" +
      ".ppsd-bar b{font-size:13px}.ppsd-sub{opacity:.7;font-size:12px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
      ".ppsd-body{display:flex;gap:10px;padding:10px;min-height:0;overflow:hidden}.ppsd-side{width:250px;flex:none;overflow:auto;display:flex;flex-direction:column;gap:6px;font-size:12px;max-height:calc(96vh - 110px)}" +
      ".ppsd-side fieldset{border:1px solid var(--line,#3a352d);border-radius:6px;padding:5px 8px;margin:0;display:flex;flex-direction:column;gap:4px}.ppsd-side legend{font-size:11px;opacity:.75;padding:0 4px}" +
      ".ppsd-row{display:flex;gap:6px;align-items:center}.ppsd-row>span{width:72px;flex:none;opacity:.85}.ppsd-row select,.ppsd-row input[type=text]{flex:1;min-width:0;font-size:12px}" +
      ".ppsd-side label.ck{display:flex;gap:6px;align-items:center}.ppsd-side textarea{width:100%;box-sizing:border-box;font-size:11px;resize:vertical;min-height:44px}" +
      ".ppsd-main{display:flex;flex-direction:column;gap:6px;min-width:0;flex:1}.ppsd-nav{display:flex;gap:6px;align-items:center;font-size:12px}.ppsd-info{opacity:.75;flex:1;text-align:right}" +
      "#ppSdCanvas{background:#fff;border:1px solid var(--line,#3a352d);border-radius:3px;box-shadow:0 2px 10px #0006;max-width:100%}" +
      ".ppsd-warn{font-size:12px;color:var(--tiger,#f59e2c);min-height:16px}.ppsd-foot{display:flex;gap:8px;align-items:center;padding:8px 10px;border-top:1px solid var(--line,#3a352d);font-size:12px}" +
      ".ppsd-foot input[type=text]{width:220px}";
    doc.head.appendChild(st);
  }
  const SCALE_OPTS = () => '<option value="auto">Auto (fits)</option>' + SH().SCALES.map((s) => '<option value="' + s + '">1:' + s + "</option>").join("");
  function ensure() {
    let d = $("ppSheetDlg"); if (d) return d;
    css();
    d = doc.createElement("dialog"); d.id = "ppSheetDlg"; d.setAttribute("aria-label", "Building plans");
    d.innerHTML = '<div class="ppsd">' +
      '<div class="ppsd-bar" data-dlg-drag title="Drag to move"><b>📄 Building plans</b><span class="ppsd-sub" id="ppSdSub"></span><button type="button" class="ghost" id="ppSdX" title="Close (Esc)">✕</button></div>' +
      '<div class="ppsd-body"><div class="ppsd-side">' +
        '<fieldset><legend>Sheet</legend>' +
          '<label class="ppsd-row"><span>Size</span><select id="ppSdSheet"><option>A4</option><option>A3</option><option>A2</option><option>A1</option></select></label>' +
          '<label class="ppsd-row"><span>Orientation</span><select id="ppSdOrient"><option value="landscape">Landscape</option><option value="portrait">Portrait</option></select></label>' +
          '<label class="ppsd-row"><span>Scale</span><select id="ppSdScale">' + SCALE_OPTS() + "</select></label>" +
        "</fieldset>" +
        '<fieldset><legend>Pages</legend>' +
          '<label class="ck"><input type="radio" name="ppSdPages" value="one" id="ppSdOne"> All views on one sheet</label>' +
          '<label class="ck"><input type="radio" name="ppSdPages" value="many" id="ppSdMany"> One view per page</label>' +
        "</fieldset>" +
        '<fieldset><legend>Views</legend>' +
          '<label class="ck"><input type="checkbox" id="ppSdPlans"> Floor plans (every storey)</label>' +
          '<label class="ck"><input type="checkbox" id="ppSdElev"> Elevations - north, east, south, west</label>' +
          '<label class="ck"><input type="checkbox" id="ppSdRoof"> Roof / site plan</label>' +
        "</fieldset>" +
        '<fieldset><legend>Show</legend>' +
          '<label class="ck"><input type="checkbox" id="ppSdDims"> Dimensions + levels</label>' +
          '<label class="ck"><input type="checkbox" id="ppSdRooms"> Room names, sizes, areas</label>' +
          '<label class="ck"><input type="checkbox" id="ppSdFurn"> Furniture</label>' +
          '<label class="ck"><input type="checkbox" id="ppSdShade"> Coloured (materials)</label>' +
        "</fieldset>" +
        '<fieldset><legend>Title block</legend>' +
          '<label class="ppsd-row"><span>Project</span><input type="text" id="ppSdProject" maxlength="80"></label>' +
          '<label class="ppsd-row"><span>Drawing</span><input type="text" id="ppSdTitle" maxlength="80"></label>' +
          '<label class="ppsd-row"><span>Drawn by</span><input type="text" id="ppSdBy" maxlength="60"></label>' +
          '<label class="ppsd-row"><span>Date</span><input type="text" id="ppSdDate" maxlength="30"></label>' +
          '<label class="ppsd-row"><span>Revision</span><input type="text" id="ppSdRev" maxlength="12"></label>' +
          '<label>Notes<textarea id="ppSdNotes" maxlength="400"></textarea></label>' +
        "</fieldset>" +
      "</div>" +
      '<div class="ppsd-main"><div class="ppsd-nav"><button type="button" class="ghost" id="ppSdPrev" title="The page before">◀</button><span id="ppSdPage">Page 1 of 1</span><button type="button" class="ghost" id="ppSdNext" title="The next page">▶</button><span class="ppsd-info" id="ppSdInfo"></span></div>' +
        '<canvas id="ppSdCanvas" width="640" height="452"></canvas><div class="ppsd-warn" id="ppSdWarn" role="status"></div></div>' +
      "</div>" +
      '<div class="ppsd-foot"><label>File <input type="text" id="ppSdFile" maxlength="80"></label><span>.pdf</span>' +
        '<label class="ck" title="Also save it to this computer (the browser\'s downloads)"><input type="checkbox" id="ppSdDl" checked> Download too</label><span style="flex:1"></span>' +
        '<button type="button" class="ghost" id="ppSdCancel">Cancel</button><button type="button" id="ppSdSave" title="Save the PDF into the project\'s pdf folder">💾 Save PDF</button></div>' +
      "</div>";
    doc.body.appendChild(d);
    wire(d);
    return d;
  }
  const FIELDS = { sheet: "ppSdSheet", orient: "ppSdOrient", scale: "ppSdScale", project: "ppSdProject", title: "ppSdTitle", drawnBy: "ppSdBy", date: "ppSdDate", revision: "ppSdRev", notes: "ppSdNotes", file: "ppSdFile" };
  const CHECKS = { plans: "ppSdPlans", elevations: "ppSdElev", roof: "ppSdRoof", dims: "ppSdDims", rooms: "ppSdRooms", furniture: "ppSdFurn", shade: "ppSdShade" };
  /** the options as the dialog shows them */
  function read() {
    const o = {};
    Object.keys(FIELDS).forEach((k) => { o[k] = $(FIELDS[k]).value; });
    Object.keys(CHECKS).forEach((k) => { o[k] = $(CHECKS[k]).checked; });
    o.pages = $("ppSdMany").checked ? "many" : "one";
    return SH().clean(o);
  }
  function write(o) {
    Object.keys(FIELDS).forEach((k) => { $(FIELDS[k]).value = o[k] == null ? "" : String(o[k]); });
    Object.keys(CHECKS).forEach((k) => { $(CHECKS[k]).checked = !!o[k]; });
    $("ppSdOne").checked = o.pages !== "many"; $("ppSdMany").checked = o.pages === "many";
  }
  function remember(o) { try { const k = Object.assign({}, o); delete k.date; delete k.file; delete k.project; root.localStorage.setItem(KEY, JSON.stringify(k)); } catch (e) { /* private window */ } }
  function stored() { try { return JSON.parse(root.localStorage.getItem(KEY) || "{}") || {}; } catch (e) { return {}; } }
  function wire(d) {
    $("ppSdX").onclick = $("ppSdCancel").onclick = () => close();
    d.addEventListener("cancel", (e) => { e.preventDefault(); close(); });
    d.addEventListener("keydown", (e) => {                      // the Sketcher's keys stay out of it
      e.stopPropagation();
      if (e.key === "Escape") { e.preventDefault(); close(); }
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(); }
    });
    d.addEventListener("input", () => soon());
    d.addEventListener("change", () => soon());
    $("ppSdPrev").onclick = () => { if (S.res && S.page > 0) { S.page--; paint(); } };
    $("ppSdNext").onclick = () => { if (S.res && S.page < S.res.pages.length - 1) { S.page++; paint(); } };
    $("ppSdSave").onclick = () => save();
  }
  function soon() { clearTimeout(S.t); S.t = setTimeout(update, 140); }
  /** compose again from the options + repaint */
  function update() {
    if (!S.open) return;
    const A = model(), o = read();
    remember(o);
    try { S.res = SH().compose(A, o, deps()); } catch (e) { S.res = null; $("ppSdWarn").textContent = "⚠ " + (e.message || e); return; }
    if (S.page >= S.res.pages.length) S.page = S.res.pages.length - 1; if (S.page < 0) S.page = 0;
    paint();
  }
  function paint() {
    const R = S.res; if (!R) return;
    const pg = R.pages[S.page], cv = $("ppSdCanvas");
    const main = cv.parentElement, maxW = Math.max(320, Math.min(980, (main && main.clientWidth) || (root.innerWidth || 1200) - 340)), maxH = Math.max(240, Math.min(700, (root.innerHeight || 800) - 330));
    const k = Math.min(maxW / pg.w, maxH / pg.h), dpr = Math.min(2, root.devicePixelRatio || 1);
    cv.style.width = Math.round(pg.w * k) + "px"; cv.style.height = "auto";                // the sheet's shape kept when the dialog is narrower
    cv.width = Math.round(pg.w * k * dpr); cv.height = Math.round(pg.h * k * dpr);
    SH().drawCanvas(cv.getContext("2d"), pg, cv.width);
    $("ppSdPage").textContent = "Page " + (S.page + 1) + " of " + R.pages.length;
    $("ppSdPrev").disabled = S.page <= 0; $("ppSdNext").disabled = S.page >= R.pages.length - 1;
    const o = read(), sc = R.scales.length ? (new Set(R.scales).size === 1 ? "1:" + R.scales[0] : "1:" + R.scales[S.page]) : "-";
    $("ppSdInfo").textContent = o.sheet + " " + o.orient + " · " + sc + " · " + R.n + " view" + (R.n === 1 ? "" : "s");
    $("ppSdWarn").textContent = R.warn ? "⚠ " + R.warn : "";
    inView();
  }
  /** a dialog left lower down (dialog_layout.cfg) or grown by its preview: pulled back up so 💾 Save PDF stays on screen */
  function inView() {
    const d = $("ppSheetDlg"); if (!d || !d.open) return;
    const r = d.getBoundingClientRect(), vh = root.innerHeight || 800, vw = root.innerWidth || 1200;
    if (r.bottom > vh - 4 || r.right > vw - 4) {
      const s = d.style; s.position = "fixed"; s.margin = "0"; s.inset = "auto"; s.right = "auto"; s.bottom = "auto"; s.transform = "none";
      s.top = Math.max(0, Math.min(r.top, vh - r.height - 8)) + "px"; s.left = Math.max(0, Math.min(r.left, vw - r.width - 8)) + "px";
    }
  }
  /** open it for the Sketcher's model */
  function open() {
    if (!SH()) return msg("📄 the building plans are not loaded");
    const d = ensure(), name = modelName();
    const o = SH().clean(Object.assign({}, stored(), { project: name, file: name + " plans", date: SH().defaults().date }));
    write(o);
    $("ppSdSub").textContent = "· " + name;
    S.open = true; S.page = 0;
    if (!d.open) { try { d.showModal(); } catch (e) { d.setAttribute("open", ""); } }
    update(); setTimeout(inView, 250); test("pp_plans_open", name);
    return d;
  }
  function close() { S.open = false; clearTimeout(S.t); const d = $("ppSheetDlg"); if (d && d.open) { try { d.close(); } catch (e) { d.removeAttribute("open"); } } }
  /** 💾 the PDF -> the project's pdf folder (+ downloaded when ticked) -> {name, size, pages} */
  function save() {
    const o = read(), A = model();
    const res = SH().compose(A, o, deps());
    if (!res.n) { $("ppSdWarn").textContent = "⚠ " + (res.warn || "Nothing to draw yet"); return Promise.resolve(null); }
    const btn = $("ppSdSave"); btn.disabled = true; const was = btn.textContent; btn.textContent = "⏳ Writing…";
    const file = (o.file || modelName() + " plans") + ".pdf";
    return pdflib().then((L) => SH().toPdf(res.pages, L, { title: (o.project ? o.project + " - " : "") + (o.title || "Building plans"), author: o.drawnBy, subject: "Building plans" }))
      .then((bytes) => root.fetch("/api/pdf/save?name=" + encodeURIComponent(file), { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: bytes })
        .then((r) => r.json()).then((j) => {
          if (j.error) throw new Error(j.error);
          if ($("ppSdDl").checked) { try { H().download(j.name, bytes, "application/pdf"); } catch (e) { /* saved in the project anyway */ } }
          msg("📄 " + j.name + " - " + res.pages.length + " page" + (res.pages.length === 1 ? "" : "s") + ", " + o.sheet + " - saved in the project's pdf folder");
          test("pp_plans_pdf", j.name + " " + res.pages.length);
          S.last = { name: j.name, size: j.size, pages: res.pages.length, bytes: bytes.length };
          close(); return S.last;
        }))
      .catch((e) => { $("ppSdWarn").textContent = "⚠ " + (e.message || e); return null; })
      .finally(() => { btn.disabled = false; btn.textContent = was; });
  }
  // 📄 Plans on the bar (the dock's html may come after this script): one listener on the document
  doc.addEventListener("click", (e) => { const b = e.target && e.target.closest && e.target.closest("#ppPlans"); if (b) { e.preventDefault(); open(); } });

  root.PPSheetsDlg = { open, close, save, update, read, state: S };
})(typeof window !== "undefined" ? window : globalThis);
