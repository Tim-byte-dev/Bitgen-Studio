/* bitGen Studio — ext/pushpulldock/ppjoinerydlg.js (2.689.0): THE 🗄 CUPBOARDS & SHELVING DIALOG.
 * Tim (verbatim): "add a shelf/cupboard dialog for builtin cupboards, walk-in robes etc. must be customizable and be able to
 * save as template"
 *
 *   window.PPJoineryLib   your templates (GET / POST / DELETE /api/pushpull-joinery - routes/ppJoinery.js, kept for every
 *     project): list, load() -> Promise, save({id?, name, spec}) -> Promise<t>, remove(id) -> Promise, all() -> built-in + yours
 *   window.PPJoineryDlg.open({spec, title, ok, onOK(spec)}) -> the <dialog id="ppJnDlg">:
 *     templates down the side (Built in / Yours - a click loads one), the design (name, layout straight / L / U, width, depth,
 *     height, side length, board, plinth, doors + shown in 3D, handles, the body / door / handle colours - a colour or one of
 *     the Sketcher's materials), the runs' tabs (Back / Left / Right) with their BAYS (width - 0 shares what is left -, what
 *     is in it, shelves, drawers; ↑ ↓ ✕, ＋ Add bay, ⇔ Share evenly), a live front view of the run + the plan;
 *     💾 Save as template (the name box; the same name replaces yours), 🗑 Delete (yours), OK / Cancel.
 * Needs ppjoinery.js (window.PPJoinery); the materials from ppfurn.js. */
(function (root) {
  "use strict";
  const doc = root.document;
  const J = () => root.PPJoinery;
  const el = (tag, cls, txt) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const $ = (id) => doc.getElementById(id);

  /* ---------------- your templates */
  const Lib = {
    list: [], loaded: false,
    load() { return root.fetch("/api/pushpull-joinery").then((r) => r.json()).then((j) => { Lib.list = (j.templates || []).map((t) => Object.assign({}, t, { spec: J().clean(t.spec) })); Lib.loaded = true; return Lib.list; }).catch(() => Lib.list); },
    save(t) {
      return root.fetch("/api/pushpull-joinery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(t) })
        .then((r) => r.json().then((j) => { if (!r.ok) throw new Error(j.error || "not saved"); Lib.list = j.templates.map((x) => Object.assign({}, x, { spec: J().clean(x.spec) })); return j.template; }));
    },
    remove(id) {
      return root.fetch("/api/pushpull-joinery/" + encodeURIComponent(id), { method: "DELETE" })
        .then((r) => r.json().then((j) => { if (!r.ok) throw new Error(j.error || "not deleted"); Lib.list = j.templates.map((x) => Object.assign({}, x, { spec: J().clean(x.spec) })); return true; }));
    },
    all() { return J().PRESETS.map((p) => Object.assign({ group: "Built in" }, p)).concat(Lib.list.map((t) => Object.assign({ group: "Yours" }, t))); },
  };

  const CSS = `
  #ppJnDlg{width:min(1100px,96vw);max-height:92vh;padding:0;border:1px solid var(--line,#444);border-radius:8px;background:var(--panel,#1f1c17);color:var(--text,#eee)}
  #ppJnDlg::backdrop{background:rgba(0,0,0,.45)}
  #ppJnDlg .ppjn-wrap{display:grid;grid-template-columns:190px minmax(330px,1fr) 380px;gap:10px;padding:10px;max-height:calc(92vh - 50px);overflow:auto}
  #ppJnDlg h3{margin:0;padding:8px 10px;font-size:14px;border-bottom:1px solid var(--line,#444)}
  #ppJnList{display:flex;flex-direction:column;gap:2px;overflow:auto;max-height:70vh}
  #ppJnList .grp{font-size:11px;opacity:.7;margin:6px 0 2px}
  #ppJnList button{text-align:left;font-size:12px;padding:4px 6px}
  #ppJnList button.on{outline:1px solid var(--tiger,#f59e2c)}
  #ppJnDlg .row{display:grid;grid-template-columns:120px 1fr;gap:4px;align-items:center;margin:3px 0;font-size:12px}
  #ppJnDlg .row input[type=number],#ppJnDlg .row input[type=text],#ppJnDlg .row select{width:100%;box-sizing:border-box}
  #ppJnDlg .cols{display:flex;gap:4px;align-items:center}
  #ppJnRuns{display:flex;gap:4px;margin:8px 0 4px}#ppJnRuns button.on{outline:1px solid var(--tiger,#f59e2c)}
  #ppJnBays{width:100%;border-collapse:collapse;font-size:12px}#ppJnBays td,#ppJnBays th{padding:2px 3px;text-align:left}
  #ppJnBays input{width:60px}#ppJnBays select{max-width:140px}
  #ppJnElev svg,#ppJnPlan svg{background:var(--panel-2,#2a2620);border-radius:6px;display:block;max-width:100%;height:auto}
  .ppj-body{fill:none;stroke:var(--line,#666)}.ppj-b{fill:#cfc6b4;stroke:#7d7466;stroke-width:.4}.ppj-kick{fill:#8d8577}
  .ppj-drawer{fill:#b9ae98;stroke:#6b6355;stroke-width:.6}.ppj-door{fill:rgba(245,158,44,.06);stroke:var(--tiger,#f59e2c);stroke-dasharray:4 3;stroke-width:1}
  .ppj-rail{stroke:#8fb6d9;stroke-width:2;stroke-dasharray:5 3}.ppj-pl{stroke:var(--text,#ddd);stroke-width:1}.ppj-wall{stroke:#888;stroke-width:4}
  .ppj-w,.ppj-dim{fill:var(--dim,#aaa);font:10px sans-serif;text-anchor:middle}
  #ppJnDlg .foot{display:flex;gap:6px;align-items:center;justify-content:flex-end;padding:8px 10px;border-top:1px solid var(--line,#444)}
  #ppJnMsg{margin-right:auto;font-size:12px;opacity:.85}`;

  let D = null;          // {spec, run, sel (template id), onOK}
  function ensureDlg() {
    let dlg = $("ppJnDlg"); if (dlg) return dlg;
    if (!$("ppJnCss")) { const st = el("style"); st.id = "ppJnCss"; st.textContent = CSS; doc.head.appendChild(st); }
    dlg = el("dialog"); dlg.id = "ppJnDlg";
    dlg.innerHTML = `<h3 id="ppJnTitle">🗄 Cupboards &amp; shelving</h3>
      <div class="ppjn-wrap"><div id="ppJnList"></div><div id="ppJnForm"></div><div><div id="ppJnElev"></div><div style="height:6px"></div><div id="ppJnPlan"></div>
        <div class="row" style="margin-top:8px"><label for="ppJnTplName">Template name</label><input id="ppJnTplName" type="text" maxlength="60"></div>
        <div class="cols"><button type="button" class="ghost" id="ppJnSave">💾 Save as template</button><button type="button" class="ghost" id="ppJnDel">🗑 Delete template</button></div></div></div>
      <div class="foot"><span id="ppJnMsg"></span><button type="button" class="ghost" id="ppJnCancel">Cancel</button><button type="button" id="ppJnOK">OK</button></div>`;
    (doc.getElementById("pushpulldock") || doc.body).appendChild(dlg);
    $("ppJnCancel").onclick = () => close();
    $("ppJnOK").onclick = () => { const cb = D && D.onOK, s = D && D.spec; close(); if (cb && s) cb(J().clean(s)); };
    $("ppJnSave").onclick = () => saveTpl();
    $("ppJnDel").onclick = () => delTpl();
    dlg.addEventListener("cancel", () => { D = null; });
    dlg.addEventListener("keydown", (e) => { e.stopPropagation(); });           // the Sketcher's keys stay out of the boxes
    return dlg;
  }
  const say = (t) => { const m = $("ppJnMsg"); if (m) m.textContent = t || ""; };
  function changed(fn) { return (e) => { fn(e); D.spec = J().clean(D.spec); paint(true); }; }

  /* ---------------- the form */
  function colourRow(box, label, key) {
    const r = el("div", "row"), c = el("div", "cols"), sel = el("select"), pick = el("input");
    sel.id = "ppJnCol_" + key; pick.type = "color"; pick.id = "ppJnColPick_" + key;
    const v = D.spec.col[key], mats = root.PPFurn && root.PPFurn.materials ? root.PPFurn.materials() : [];
    sel.appendChild(new Option("Colour…", "")); mats.forEach((m) => sel.appendChild(new Option(m.label, "mat:" + m.key)));
    sel.value = v.startsWith("mat:") ? v : ""; pick.value = v.startsWith("#") ? v : (root.PPFurn ? root.PPFurn.hex(v) : "#cccccc");
    pick.style.display = sel.value ? "none" : "";
    sel.onchange = changed(() => { D.spec.col[key] = sel.value || pick.value; });
    pick.oninput = changed(() => { sel.value = ""; D.spec.col[key] = pick.value; });
    c.append(sel, pick); r.append(el("label", "", label), c); box.appendChild(r);
  }
  function row(box, label, input) { const r = el("div", "row"); r.append(el("label", "", label), input); box.appendChild(r); return r; }
  function num(id, v, step, lo, hi, fn, mm) {
    const i = el("input"); i.type = "number"; i.id = id; i.step = String(step); i.min = String(lo); i.max = String(hi);
    i.value = mm ? Math.round(v * 1000) : v; i.title = mm ? "millimetres" : "";
    i.onchange = changed(() => { const x = parseFloat(i.value); if (Number.isFinite(x)) fn(mm ? x / 1000 : x); });
    return i;
  }
  function select(id, v, opts, fn) { const s = el("select"); s.id = id; Object.keys(opts).forEach((k) => s.appendChild(new Option(opts[k], k))); s.value = v; s.onchange = changed(() => fn(s.value)); return s; }
  function form() {
    const box = $("ppJnForm"), S = D.spec, JJ = J(); box.innerHTML = "";
    const name = el("input"); name.type = "text"; name.id = "ppJnName"; name.maxLength = 60; name.value = S.name;
    name.oninput = () => { D.spec.name = name.value; const tn = $("ppJnTplName"); if (tn && !D.tplNameTouched) tn.value = name.value; };
    row(box, "Name", name);
    row(box, "Layout", select("ppJnLayout", S.layout, JJ.LAYOUTS, (v) => { D.spec.layout = v; if (v !== "run" && D.spec.side < D.spec.d + 0.3) D.spec.side = Math.max(1.5, D.spec.d + 1); D.run = Math.min(D.run, v === "U" ? 2 : v === "L" ? 1 : 0); }));
    row(box, "Width (mm)", num("ppJnW", S.w, 10, 300, 12000, (v) => { D.spec.w = v; }, true));
    row(box, "Depth (mm)", num("ppJnD", S.d, 10, 150, 1500, (v) => { D.spec.d = v; }, true));
    row(box, "Height (mm)", num("ppJnH", S.h, 10, 300, 4000, (v) => { D.spec.h = v; }, true));
    if (S.layout !== "run") {
      row(box, S.layout === "U" ? "Robe depth (mm)" : "Side length (mm)", num("ppJnSide", S.side, 10, 500, 12000, (v) => { D.spec.side = v; }, true)).title = "Outside, from the back wall to the open end of the side run(s)";
      if (S.layout === "L") row(box, "Side run", select("ppJnLside", S.lside, { left: "On the left", right: "On the right" }, (v) => { D.spec.lside = v; }));
    }
    row(box, "Board (mm)", num("ppJnT", S.t, 1, 9, 50, (v) => { D.spec.t = v; }, true));
    row(box, "Plinth (mm)", num("ppJnPlinth", S.plinth, 10, 0, 300, (v) => { D.spec.plinth = v; }, true)).title = "The kick board under the doors - 0 = none";
    row(box, "Doors", select("ppJnDoors", S.doors, JJ.DOORS, (v) => { D.spec.doors = v; }));
    const show = el("input"); show.type = "checkbox"; show.id = "ppJnShow"; show.checked = S.showDoors; show.onchange = changed(() => { D.spec.showDoors = show.checked; });
    if (S.doors !== "none") row(box, "Doors in 3D", show).title = "Off = see inside in the 3D view (the doors stay in the design, the plan and the plans)";
    row(box, "Handles", select("ppJnHandle", S.handle, JJ.HANDLES, (v) => { D.spec.handle = v; }));
    colourRow(box, "Body", "body"); colourRow(box, "Doors / drawers", "doors"); colourRow(box, "Handles / rails", "handles");
    // the runs' tabs + their bays
    const runs = JJ.runsOf(S), tabs = el("div"); tabs.id = "ppJnRuns";
    runs.forEach((R, i) => { const b = el("button", "ghost" + (i === D.run ? " on" : ""), R.name + " · " + Math.round(R.L * 1000) + " mm"); b.type = "button"; b.dataset.run = i; b.onclick = () => { D.run = i; paint(); }; tabs.appendChild(b); });
    box.appendChild(tabs);
    const T = el("table"); T.id = "ppJnBays"; T.innerHTML = "<tr><th>#</th><th>Width</th><th>In it</th><th>Shelves</th><th>Drawers</th><th></th></tr>";
    const R = runs[D.run], bays = S.runs[D.run].bays, lay = JJ.bays(R, bays, S.t);
    bays.forEach((b, i) => {
      const tr = el("tr"); tr.dataset.bay = i;
      const w = el("input"); w.type = "number"; w.step = "10"; w.min = "0"; w.max = "6000"; w.value = Math.round(b.w * 1000); w.title = "inside width in mm - 0 shares what is left (now " + Math.round((lay[i].x1 - lay[i].x0) * 1000) + " mm)"; w.className = "bw";
      w.onchange = changed(() => { const x = parseFloat(w.value); b.w = Number.isFinite(x) ? Math.max(0, x / 1000) : 0; });
      const k = el("select"); k.className = "bk"; Object.keys(JJ.KINDS).forEach((kk) => k.appendChild(new Option(JJ.KINDS[kk], kk))); k.value = b.kind; k.onchange = changed(() => { b.kind = k.value; });
      const sh = el("input"); sh.type = "number"; sh.className = "bs"; sh.min = "0"; sh.max = "20"; sh.value = b.shelves; sh.onchange = changed(() => { b.shelves = Math.max(0, Math.min(20, Math.round(+sh.value || 0))); });
      const dr = el("input"); dr.type = "number"; dr.className = "bd"; dr.min = "0"; dr.max = "10"; dr.value = b.drawers; dr.onchange = changed(() => { b.drawers = Math.max(0, Math.min(10, Math.round(+dr.value || 0))); });
      if (!/^(shelves|shoes|drawers)$/.test(b.kind)) sh.disabled = true;
      if (b.kind !== "drawers") dr.disabled = true;
      const ops = el("td"); [["↑", -1], ["↓", 1]].forEach(([t, dlt]) => { const x = el("button", "ghost", t); x.type = "button"; x.disabled = i + dlt < 0 || i + dlt >= bays.length; x.onclick = changed(() => { const m = bays.splice(i, 1)[0]; bays.splice(i + dlt, 0, m); }); ops.appendChild(x); });
      const del = el("button", "ghost", "✕"); del.type = "button"; del.className = "bx"; del.disabled = bays.length < 2; del.title = "Take this bay out"; del.onclick = changed(() => { bays.splice(i, 1); }); ops.appendChild(del);
      const td = (x) => { const c = el("td"); c.appendChild(x); return c; };
      tr.append(el("td", "", String(i + 1)), td(w), td(k), td(sh), td(dr), ops); T.appendChild(tr);
    });
    box.appendChild(T);
    const bb = el("div", "cols"); bb.style.marginTop = "4px";
    const add = el("button", "ghost", "＋ Add bay"); add.type = "button"; add.id = "ppJnAdd"; add.onclick = changed(() => { bays.push(JJ.bay("shelves")); });
    const even = el("button", "ghost", "⇔ Share evenly"); even.type = "button"; even.id = "ppJnEven"; even.title = "Every bay's width back to 0 - they share the run"; even.onclick = changed(() => { bays.forEach((b) => { b.w = 0; }); });
    bb.append(add, even); box.appendChild(bb);
  }
  function list() {
    const box = $("ppJnList"); box.innerHTML = ""; let g = "";
    Lib.all().forEach((t) => {
      if (t.group !== g) { g = t.group; box.appendChild(el("div", "grp", g)); }
      const b = el("button", "ghost" + (t.id === D.sel ? " on" : ""), t.name); b.type = "button"; b.dataset.id = t.id;
      b.onclick = () => { D.spec = J().clean(JSON.parse(JSON.stringify(t.spec))); D.sel = t.id; D.run = 0; D.tplNameTouched = false; $("ppJnTplName").value = t.group === "Yours" ? t.name : D.spec.name; say(t.group === "Yours" ? "your template - change it and 💾 Save to keep the changes under its name" : "a built-in template - 💾 Save as template keeps your own version"); paint(); };
      box.appendChild(b);
    });
    if (!Lib.list.length) box.appendChild(el("div", "grp", "Yours: none yet - 💾 Save as template"));
  }
  function preview() {
    $("ppJnElev").innerHTML = J().elevation(D.spec, D.run, { w: 380, h: 260 });
    $("ppJnPlan").innerHTML = J().planSvg(D.spec, { w: 380, h: 170 });
    const del = $("ppJnDel"); del.disabled = !(D.sel && !String(D.sel).startsWith("preset:"));
  }
  function paint(keepForm) {
    if (!D) return;
    const f = doc.activeElement && doc.activeElement.closest && doc.activeElement.closest("#ppJnForm") ? doc.activeElement.id || doc.activeElement.className : null;
    form(); list(); preview();
    if (keepForm && f) { const back = $(f) || $("ppJnForm").querySelector("." + String(f).split(" ")[0]); if (back && back.focus) try { back.focus({ preventScroll: true }); } catch (e) { /* fine */ } }
  }
  function saveTpl() {
    const name = ($("ppJnTplName").value || D.spec.name || "").trim();
    if (!name) { say("✗ give the template a name"); return Promise.resolve(null); }
    const mine = D.sel && !String(D.sel).startsWith("preset:") && (Lib.list.find((t) => t.id === D.sel) || {}).name === name ? D.sel : undefined;
    return Lib.save({ id: mine, name, spec: Object.assign({}, D.spec, { name }) }).then((t) => { if (!D) return t; D.sel = t.id; D.spec.name = name; say("💾 saved \"" + name + "\" - in every project's 🗄 list"); paint(); return t; })
      .catch((e) => { say("✗ " + e.message); return null; });
  }
  function delTpl() {
    if (!D.sel || String(D.sel).startsWith("preset:")) return Promise.resolve(false);
    const t = Lib.list.find((x) => x.id === D.sel); if (!t) return Promise.resolve(false);
    return Lib.remove(t.id).then(() => { if (!D) return true; D.sel = null; say("🗑 \"" + t.name + "\" deleted"); paint(); return true; }).catch((e) => { say("✗ " + e.message); return false; });
  }
  function close() { const dlg = $("ppJnDlg"); if (dlg && dlg.open) dlg.close(); D = null; }
  /** open on a design (the picked cupboard's, or the last one) */
  function open(o) {
    o = o || {};
    const dlg = ensureDlg();
    D = { spec: J().clean(o.spec ? JSON.parse(JSON.stringify(o.spec)) : J().DEFAULT), run: 0, sel: o.template || null, onOK: o.onOK || null, tplNameTouched: false };
    $("ppJnTitle").textContent = o.title || "🗄 Cupboards & shelving";
    $("ppJnOK").textContent = o.ok || "OK";
    $("ppJnTplName").value = D.spec.name; $("ppJnTplName").oninput = () => { if (D) D.tplNameTouched = true; };
    say(o.hint || "pick a template, change it as you like · 💾 Save as template keeps it for every project");
    paint();
    if (!dlg.open) { try { dlg.showModal(); } catch (e) { dlg.setAttribute("open", ""); } }
    Lib.load().then(() => { if (D) list(); });
    return dlg;
  }
  root.PPJoineryLib = Lib;
  root.PPJoineryDlg = { open, close, state: () => D, save: saveTpl, remove: delTpl };
})(typeof window !== "undefined" ? window : globalThis);
