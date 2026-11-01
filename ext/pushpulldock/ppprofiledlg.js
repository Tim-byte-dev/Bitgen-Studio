/* bitGen Studio — ext/pushpulldock/ppprofiledlg.js (2.640.0): THE SKETCHER'S PROFILE DIALOG + THE PICTURE DROPDOWN.
 * Tim (verbatim): "create a dialog to create profiles for skirting and cornices, list the profiles in the skirting and cornice
 * properties with a dropdown showing the visual profiles. do the same for door frames, window frames and window sills."
 *
 *   window.PPProfileLib   the project's own profiles (GET / POST / DELETE /api/pushpull-profiles - routes/ppProfiles.js)
 *     list, load() -> Promise, save(p) -> Promise<p>, remove(id) -> Promise, options(kind, A) -> [{group, p}]
 *   window.PPProfileUI.dropdown({kind, value, A, none, onPick(id, p), onEdit()}) -> element
 *     a <select> cannot show pictures - this is a button (thumbnail + name ▾) opening a list of thumbnails
 *     (.ppprof[data-kind] > .ppprof-btn; the list .ppprof-list > .ppprof-opt[data-id], .ppprof-edit)
 *   window.PPProfileDlg.open({kind, id, A, onSave(p)}) -> the <dialog id="ppProfDlg">: the profiles of a kind down the side,
 *     a canvas to draw one (click = a point on the nearest side, drag = move, Delete / right-click = remove; 1 mm grid;
 *     Shift = free), its name, its width / height (typing one scales it), 💾 Save (the project's library; onSave uses it)
 * Needs ppprofile.js (window.PPProfile). */
(function (root) {
  "use strict";
  const doc = root.document;
  const PF = () => root.PPProfile;
  const el = (tag, cls, txt) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

  /* ---------------- the project's library */
  const Lib = {
    list: [], loaded: false,
    load() {
      return root.fetch("/api/pushpull-profiles").then((r) => r.json()).then((j) => { Lib.list = (PF() ? PF().cleanList(j.profiles) : j.profiles) || []; Lib.loaded = true; return Lib.list; }).catch(() => Lib.list);
    },
    save(p) {
      return root.fetch("/api/pushpull-profiles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) }).then((r) => r.json()).then((j) => {
        if (j.error) throw new Error(j.error);
        Lib.list = PF().cleanList(j.profiles); return PF().clean(j.profile);
      });
    },
    remove(id) {
      return root.fetch("/api/pushpull-profiles/" + encodeURIComponent(id), { method: "DELETE" }).then((r) => r.json()).then((j) => { if (j.error) throw new Error(j.error); Lib.list = PF().cleanList(j.profiles); return true; });
    },
    /** what a dropdown lists: the built-in ones, then the project's (the library + the model's own copies) */
    options(kind, A) {
      const out = PF().presets(kind).map((p) => ({ group: "Built in", p })), seen = new Set(out.map((o) => o.p.id));
      Lib.list.concat((A && A.profiles) || []).forEach((p) => { if (p.kind === kind && !seen.has(p.id)) { seen.add(p.id); out.push({ group: "This project", p }); } });
      return out;
    },
  };
  /** a profile picked for a part: the model keeps its own copy (it then draws anywhere, without the library) */
  function keep(A, p) {
    if (!A || !p || p.id.startsWith("preset:")) return;
    if (!A.profiles) A.profiles = [];
    const i = A.profiles.findIndex((q) => q.id === p.id), c = { id: p.id, name: p.name, kind: p.kind, pts: p.pts.map((q) => q.slice()) };
    if (i >= 0) A.profiles[i] = c; else A.profiles.push(c);
  }

  /* ---------------- the picture dropdown */
  let openList = null;
  function closeList() { if (openList) { openList.remove(); openList = null; doc.removeEventListener("pointerdown", outside, true); doc.removeEventListener("keydown", escKey, true); } }
  function outside(e) { if (openList && !openList.contains(e.target) && !(e.target.closest && e.target.closest(".ppprof-btn"))) closeList(); }
  function escKey(e) { if (e.key === "Escape" && openList) { e.preventDefault(); e.stopPropagation(); closeList(); } }
  function dropdown(o) {
    const kind = o.kind, wrap = el("div", "ppprof"); wrap.dataset.kind = kind;
    const cur = o.value ? PF().byId(o.value, Lib.list.concat((o.A && o.A.profiles) || [])) : null;
    const shown = cur || (o.none ? null : PF().resolve(o.A, o.value, kind));
    css();
    const btn = el("button", "ghost ppprof-btn"); btn.type = "button"; btn.title = "Pick a " + PF().KINDS[kind].label.toLowerCase() + " profile";
    btn.innerHTML = (shown ? PF().svg(shown, 26, 26) : '<span class="ppprof-none">∅</span>') + "<span class=\"ppprof-name\"></span><span class=\"ppprof-car\">▾</span>";
    btn.querySelector(".ppprof-name").textContent = shown ? shown.name : "None";
    btn.onclick = () => {
      if (openList && openList.dataset.kind === kind && openList._btn === btn) { closeList(); return; }
      closeList();
      const L = el("div", "ppprof-list"); L.dataset.kind = kind; L._btn = btn;
      const r = btn.getBoundingClientRect(), H = Math.min(360, (root.innerHeight || 800) - 16);
      L.style.cssText = "position:fixed;z-index:10050;left:" + Math.max(4, Math.min(r.left, (root.innerWidth || 1200) - 248)) + "px;top:" + (r.bottom + 2 + H > (root.innerHeight || 800) ? Math.max(4, r.top - H - 2) : r.bottom + 2) + "px;width:240px;max-height:" + H + "px";
      const row = (id, p, label) => {
        const b = el("button", "ppprof-opt" + ((o.value || "") === id || (!o.value && !o.none && p && p.id === PF().KINDS[kind].def) ? " on" : "")); b.type = "button"; b.dataset.id = id;
        b.innerHTML = (p ? PF().svg(p, 40, 40) : '<span class="ppprof-none">∅</span>') + "<span></span>"; b.lastChild.textContent = label;
        if (p) { const s = PF().size(p); b.title = p.name + " - " + Math.round(s.w * 1000) + " × " + Math.round(s.h * 1000) + " mm"; }
        b.onclick = () => { closeList(); o.onPick && o.onPick(id, p); };
        L.appendChild(b);
      };
      if (o.none) row("", null, "None");
      let g = "";
      Lib.options(kind, o.A).forEach(({ group, p }) => { if (group !== g) { g = group; L.appendChild(el("div", "ppprof-grp", group)); } row(p.id, p, p.name); });
      const ed = el("button", "ppprof-edit", "✎ New / edit profiles…"); ed.type = "button"; ed.onclick = () => { closeList(); if (o.onEdit) o.onEdit(); }; L.appendChild(ed);
      doc.body.appendChild(L); openList = L;
      doc.addEventListener("pointerdown", outside, true); doc.addEventListener("keydown", escKey, true);
      if (!Lib.loaded) Lib.load().then(() => { if (openList === L) { closeList(); btn.onclick(); } });
    };
    wrap.appendChild(btn);
    return wrap;
  }

  /* ---------------- the dialog */
  // which way the drawing faces: display (right, up) from the profile's (x, y)
  const VIEW = {
    skirt: { to: (q) => [q[0], q[1]], from: (d) => [d[0], d[1]], ref: "floor" },
    sill: { to: (q) => [q[0], q[1]], from: (d) => [d[0], d[1]], ref: "floor" },
    cornice: { to: (q) => [q[0], -q[1]], from: (d) => [d[0], -d[1]], ref: "ceiling" },
    doorframe: { to: (q) => [q[1], q[0]], from: (d) => [d[1], d[0]], ref: "face" },
    windowframe: { to: (q) => [q[1], q[0]], from: (d) => [d[1], d[0]], ref: "face" },
  };
  let D = null;                               // the open dialog's state
  function ensureDlg() {
    let dlg = doc.getElementById("ppProfDlg");
    if (dlg) return dlg;
    dlg = el("dialog"); dlg.id = "ppProfDlg";
    dlg.innerHTML = '<form method="dialog" class="pppd">' +
      '<div class="pppd-head"><b>✎ Profiles</b><span class="pppd-sub"></span><button type="button" class="ghost" id="ppPdX" title="Close">✕</button></div>' +
      '<div class="pppd-body"><div class="pppd-side"><label>Kind <select id="ppPdKind"></select></label><div id="ppPdList" class="pppd-list"></div>' +
      '<button type="button" class="ghost" id="ppPdNew">＋ New (from this one)</button></div>' +
      '<div class="pppd-main"><label class="pppd-row">Name <input id="ppPdName" type="text" maxlength="60"></label>' +
      '<canvas id="ppPdCanvas" width="420" height="320"></canvas>' +
      '<div class="pppd-row"><label>Width <input id="ppPdW" type="number" step="1" min="1" max="1000"> mm</label><label>Height <input id="ppPdH" type="number" step="1" min="1" max="1000"> mm</label><span id="ppPdN" class="pppd-hint"></span></div>' +
      '<div class="pppd-hint" id="ppPdHint">Click = a point (on the nearest side) · drag = move it · Delete / right-click = remove it · 1 mm grid (Shift: free)</div></div></div>' +
      '<div class="pppd-foot"><button type="button" class="ghost" id="ppPdDel">🗑 Delete</button><span style="flex:1"></span><button type="button" class="ghost" id="ppPdCancel">Cancel</button><button type="button" id="ppPdSave">💾 Save</button></div></form>';
    css();
    doc.body.appendChild(dlg);
    return wire(dlg);
  }
  /** the dialog's + the dropdown's look (once - a dropdown can open before the dialog ever has) */
  function css() {
    if (doc.getElementById("ppProfCss")) return;
    const st = el("style"); st.id = "ppProfCss"; st.textContent =
      "#ppProfDlg{padding:0;border:1px solid var(--line,#3a352d);border-radius:8px;background:var(--panel,#1f1c17);color:var(--text,#e8e2d6);max-width:96vw}" +
      "#ppProfDlg::backdrop{background:#0008}.pppd{margin:0;display:flex;flex-direction:column;min-width:640px}.pppd-head,.pppd-foot{display:flex;gap:8px;align-items:center;padding:8px 10px;border-bottom:1px solid var(--line,#3a352d)}" +
      ".pppd-foot{border-bottom:0;border-top:1px solid var(--line,#3a352d)}.pppd-sub{opacity:.7;font-size:12px;flex:1}.pppd-body{display:flex;gap:10px;padding:10px}" +
      ".pppd-side{width:190px;display:flex;flex-direction:column;gap:6px}.pppd-list{flex:1;overflow:auto;max-height:330px;display:flex;flex-direction:column;gap:2px}" +
      ".pppd-list button,.ppprof-opt{display:flex;align-items:center;gap:6px;text-align:left;padding:2px 4px;background:transparent;border:1px solid transparent;border-radius:4px;color:inherit;cursor:pointer;font-size:12px}" +
      ".pppd-list button.on,.ppprof-opt.on{border-color:var(--tiger,#f59e2c)}.pppd-list button:hover,.ppprof-opt:hover{background:#ffffff14}" +
      ".pppd-main{display:flex;flex-direction:column;gap:6px}.pppd-row{display:flex;gap:10px;align-items:center;font-size:12px}.pppd-row input[type=number]{width:70px}" +
      "#ppPdCanvas{background:var(--ink,#121010);border:1px solid var(--line,#3a352d);border-radius:4px;cursor:crosshair;touch-action:none}.pppd-hint{font-size:11px;opacity:.7}.pppd-grp{font-size:10px;opacity:.6;margin-top:4px}" +
      "#pushpulldock #ppProps .ppr.ppprofrow{display:flex !important;flex-direction:column;align-items:stretch;gap:2px;margin:3px 0}#pushpulldock #ppProps .ppprofrow>span{font-size:12px}" +
      ".ppprof{display:block}.ppprof-btn{display:flex;align-items:center;gap:6px;width:100%;text-align:left;padding:2px 6px}.ppprof-btn .ppprof-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ppprof-car{opacity:.6}" +
      ".ppprof-list{background:var(--panel,#1f1c17);color:var(--text,#e8e2d6);border:1px solid var(--line,#3a352d);border-radius:6px;box-shadow:0 8px 24px #0009;overflow:auto;padding:4px;display:flex;flex-direction:column;gap:1px}" +
      ".ppprof-grp{font-size:10px;opacity:.6;padding:4px 4px 0}.ppprof-edit{margin-top:4px;padding:4px;background:transparent;border:1px dashed var(--line,#3a352d);border-radius:4px;color:inherit;cursor:pointer;font-size:12px}" +
      ".ppprof-none{display:inline-block;width:26px;text-align:center;opacity:.6}.ppprofsvg{flex:none;color:var(--text,#e8e2d6)}";
    doc.head.appendChild(st);
  }
  function wire(dlg) {
    Object.keys(PF().KINDS).forEach((k) => { const op = el("option", "", PF().KINDS[k].label); op.value = k; $("ppPdKind").appendChild(op); });
    $("ppPdKind").onchange = () => { D.kind = $("ppPdKind").value; const first = PF().presets(D.kind)[0]; load(first); };
    $("ppPdX").onclick = $("ppPdCancel").onclick = () => close(null);
    dlg.addEventListener("cancel", (e) => { e.preventDefault(); close(null); });
    dlg.addEventListener("keydown", (e) => {                        // the Sketcher's keys stay out of it
      e.stopPropagation();
      const a = doc.activeElement, typing = a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName);
      if ((e.key === "Delete" || e.key === "Backspace") && !typing && D && D.sel >= 0) { e.preventDefault(); delPoint(D.sel); }
      if (e.key === "Escape") { e.preventDefault(); close(null); }
    });
    $("ppPdName").oninput = () => { if (D) D.p.name = $("ppPdName").value; };
    // typing a width / height scales the profile that way (frames are shown turned: across = width, out = height)
    const scaleTo = (axis) => () => {
      const v = parseFloat((axis === "w" ? $("ppPdW") : $("ppPdH")).value) / 1000; if (!D || !(v > 0)) return;
      const s = PF().size(D.p), swap = D.kind === "doorframe" || D.kind === "windowframe", ix = (axis === "w") !== swap ? 0 : 1;
      const now = ix === 0 ? s.w : s.h; if (now < 1e-6) return;
      const lo = ix === 0 ? s.minX : s.minY, k = v / now;
      D.p.pts = D.p.pts.map((q) => { const r = q.slice(); r[ix] = Math.round((lo + (q[ix] - lo) * k) * 1e6) / 1e6; return r; });
      paint();
    };
    $("ppPdW").onchange = scaleTo("w"); $("ppPdH").onchange = scaleTo("h");
    $("ppPdNew").onclick = () => { if (!D) return; load({ id: "", name: (D.p.name || "Profile").replace(/ copy$/, "") + " copy", kind: D.kind, pts: D.p.pts.map((q) => q.slice()) }); $("ppPdName").focus(); $("ppPdName").select(); };
    $("ppPdSave").onclick = () => save();
    $("ppPdDel").onclick = () => {
      if (!D || !D.p.id || D.p.id.startsWith("preset:")) return;
      Lib.remove(D.p.id).then(() => { list(); load(PF().presets(D.kind)[0]); hint("deleted from the project (a model that uses it keeps its own copy)"); }).catch((e) => hint("✗ " + e.message));
    };
    const cv = $("ppPdCanvas");
    cv.addEventListener("contextmenu", (e) => { e.preventDefault(); const i = hitPoint(e); if (i >= 0) delPoint(i); });
    cv.addEventListener("pointerdown", (e) => {
      if (!D || e.button !== 0) return;
      let i = hitPoint(e);
      if (i < 0) { const q = toModel(e); i = insertPoint(q); }
      D.sel = i; D.drag = { i, id: e.pointerId }; try { cv.setPointerCapture(e.pointerId); } catch (x) { /* not captured */ }
      paint();
    });
    cv.addEventListener("pointermove", (e) => {
      if (!D) return;
      if (!D.drag) { D.hover = hitPoint(e); cv.style.cursor = D.hover >= 0 ? "move" : "crosshair"; return; }
      D.p.pts[D.drag.i] = toModel(e); paint();
    });
    const up = () => { if (D && D.drag) { D.drag = null; D.frozen = null; paint(); } };
    cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
    return dlg;
  }
  const $ = (id) => doc.getElementById(id);
  function hint(t) { $("ppPdHint").textContent = t; }
  /* the canvas's mapping: fitted round the profile (frozen while dragging so it does not swim) */
  function frame() {
    if (D.frozen) return D.frozen;
    const cv = $("ppPdCanvas"), V = VIEW[D.kind], ds = D.p.pts.map(V.to).concat([[0, 0]]);
    const xs = ds.map((d) => d[0]), ys = ds.map((d) => d[1]);
    let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const span = Math.max(x1 - x0, y1 - y0, 0.03), pad = span * 0.25;
    const k = Math.min((cv.width - 20) / (x1 - x0 + 2 * pad), (cv.height - 20) / (y1 - y0 + 2 * pad));
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const f = { k, toS: (d) => [cv.width / 2 + (d[0] - cx) * k, cv.height / 2 - (d[1] - cy) * k], toD: (sx, sy) => [cx + (sx - cv.width / 2) / k, cy - (sy - cv.height / 2) / k] };
    if (D.drag) D.frozen = f;
    return f;
  }
  function toModel(e) {
    const cv = $("ppPdCanvas"), r = cv.getBoundingClientRect(), sx = (e.clientX - r.left) * cv.width / r.width, sy = (e.clientY - r.top) * cv.height / r.height;
    const q = VIEW[D.kind].from(frame().toD(sx, sy));
    return e.shiftKey ? [Math.round(q[0] * 1e5) / 1e5, Math.round(q[1] * 1e5) / 1e5] : [Math.round(q[0] * 1000) / 1000, Math.round(q[1] * 1000) / 1000];   // 1 mm (Shift: free)
  }
  function hitPoint(e) {
    const cv = $("ppPdCanvas"), r = cv.getBoundingClientRect(), sx = (e.clientX - r.left) * cv.width / r.width, sy = (e.clientY - r.top) * cv.height / r.height, F = frame();
    let best = -1, bd = 8;
    D.p.pts.forEach((q, i) => { const s = F.toS(VIEW[D.kind].to(q)), d = Math.hypot(s[0] - sx, s[1] - sy); if (d < bd) { bd = d; best = i; } });
    return best;
  }
  /** a new point on the side nearest it (after that side's first point) -> its index */
  function insertPoint(q) {
    const P = D.p.pts, n = P.length; let bi = n - 1, bd = Infinity;
    for (let i = 0; i < n; i++) {
      const a = P[i], b = P[(i + 1) % n], ab = [b[0] - a[0], b[1] - a[1]], L = ab[0] * ab[0] + ab[1] * ab[1];
      const t = L ? Math.max(0, Math.min(1, ((q[0] - a[0]) * ab[0] + (q[1] - a[1]) * ab[1]) / L)) : 0, d = Math.hypot(q[0] - a[0] - ab[0] * t, q[1] - a[1] - ab[1] * t);
      if (d < bd) { bd = d; bi = i; }
    }
    P.splice(bi + 1, 0, q); return bi + 1;
  }
  function delPoint(i) {
    if (D.p.pts.length <= 3) { hint("a profile keeps at least 3 points"); return; }
    D.p.pts.splice(i, 1); D.sel = -1; paint();
  }
  function paint() {
    if (!D) return;
    const cv = $("ppPdCanvas"), g = cv.getContext("2d"), F = frame(), V = VIEW[D.kind], st = root.getComputedStyle ? root.getComputedStyle(doc.documentElement) : null;
    const col = (v, d) => (st && st.getPropertyValue(v).trim()) || d;
    g.clearRect(0, 0, cv.width, cv.height);
    // the grid: every mm when there is room, else every 5 / 10 mm (every 10 mm darker)
    const step = F.k * 0.001 >= 6 ? 0.001 : F.k * 0.005 >= 6 ? 0.005 : 0.01, a0 = F.toD(0, cv.height), a1 = F.toD(cv.width, 0);
    for (let x = Math.floor(a0[0] / step) * step; x <= a1[0]; x += step) { const s = F.toS([x, 0])[0]; g.strokeStyle = Math.abs(x / 0.01 - Math.round(x / 0.01)) < 1e-6 ? "#ffffff22" : "#ffffff0d"; g.beginPath(); g.moveTo(s, 0); g.lineTo(s, cv.height); g.stroke(); }
    for (let y = Math.floor(a0[1] / step) * step; y <= a1[1]; y += step) { const s = F.toS([0, y])[1]; g.strokeStyle = Math.abs(y / 0.01 - Math.round(y / 0.01)) < 1e-6 ? "#ffffff22" : "#ffffff0d"; g.beginPath(); g.moveTo(0, s); g.lineTo(cv.width, s); g.stroke(); }
    // the wall (and the floor / ceiling) it sits against
    const o = F.toS([0, 0]); g.strokeStyle = "#9aa4b2"; g.lineWidth = 2; g.beginPath();
    if (V.ref === "face") { g.moveTo(0, o[1]); g.lineTo(cv.width, o[1]); } else if (V.ref === "ceiling") { g.moveTo(o[0], cv.height); g.lineTo(o[0], o[1]); g.lineTo(cv.width, o[1]); } else { g.moveTo(o[0], 0); g.lineTo(o[0], o[1]); g.lineTo(cv.width, o[1]); }
    g.stroke(); g.lineWidth = 1;
    g.fillStyle = "#9aa4b2"; g.font = "11px sans-serif";
    g.fillText(V.ref === "face" ? "the wall's face (the opening's edge at the left)" : V.ref === "ceiling" ? "wall | ceiling" : D.kind === "sill" ? "wall | the window's bottom" : "wall | floor", 6, 14);
    // the profile
    const S = D.p.pts.map((q) => F.toS(V.to(q)));
    g.beginPath(); S.forEach((s, i) => (i ? g.lineTo(s[0], s[1]) : g.moveTo(s[0], s[1]))); g.closePath();
    g.fillStyle = (col("--tiger", "#f59e2c")) + "55"; g.fill(); g.strokeStyle = col("--tiger", "#f59e2c"); g.stroke();
    S.forEach((s, i) => { g.fillStyle = i === D.sel ? "#ffffff" : i === D.hover ? "#ffd27a" : col("--tiger", "#f59e2c"); g.fillRect(s[0] - 3.5, s[1] - 3.5, 7, 7); });
    const sz = PF().size(D.p), swap = D.kind === "doorframe" || D.kind === "windowframe";
    if (doc.activeElement !== $("ppPdW")) $("ppPdW").value = Math.round((swap ? sz.h : sz.w) * 1000);
    if (doc.activeElement !== $("ppPdH")) $("ppPdH").value = Math.round((swap ? sz.w : sz.h) * 1000);
    $("ppPdN").textContent = D.p.pts.length + " points";
    const own = D.p.id && !D.p.id.startsWith("preset:");
    $("ppPdDel").disabled = !own;
    doc.querySelector("#ppProfDlg .pppd-sub").textContent = PF().KINDS[D.kind].label + " · x " + PF().KINDS[D.kind].axes[0] + ", y " + PF().KINDS[D.kind].axes[1] + (own || !D.p.id ? "" : " · built in: Save keeps a copy");
  }
  function list() {
    const box = $("ppPdList"); box.innerHTML = "";
    let g = "";
    Lib.options(D.kind, D.A).forEach(({ group, p }) => {
      if (group !== g) { g = group; box.appendChild(el("div", "pppd-grp", group)); }
      const b = el("button", p.id === D.p.id ? "on" : ""); b.type = "button"; b.dataset.id = p.id; b.innerHTML = PF().svg(p, 34, 34) + "<span></span>"; b.lastChild.textContent = p.name;
      b.onclick = () => load(p); box.appendChild(b);
    });
  }
  function load(p) {
    D.p = { id: p.id || "", name: p.name || "Profile", kind: D.kind, pts: p.pts.map((q) => q.slice()) };
    D.sel = -1; D.hover = -1; D.frozen = null;
    $("ppPdKind").value = D.kind; $("ppPdName").value = D.p.name;
    list(); paint();
  }
  function save() {
    const c = PF().clean(Object.assign({}, D.p, { id: D.p.id && !D.p.id.startsWith("preset:") ? D.p.id : "" }));
    if (!c) { hint("✗ that is not a closed shape - it needs at least 3 points round an area"); return Promise.resolve(null); }
    if (!D.p.id || D.p.id.startsWith("preset:")) delete c.id;            // a built-in one / a new one: a new profile of the project's
    if (D.p.id && D.p.id.startsWith("preset:") && c.name === PF().byId(D.p.id).name) c.name += " (mine)";
    return Lib.save(c).then((p) => { const cb = D.onSave; close(p); if (cb) cb(p); return p; }).catch((e) => { hint("✗ " + e.message); return null; });
  }
  function close(p) { const dlg = $("ppProfDlg"); if (dlg && dlg.open) dlg.close(); D = null; void p; }
  /** open on a kind (and the profile in use) */
  function open(o) {
    o = o || {}; closeList();
    const dlg = ensureDlg(), kind = PF().KINDS[o.kind] ? o.kind : "skirt";
    D = { kind, A: o.A || null, onSave: o.onSave || null, sel: -1, hover: -1, p: null };
    const start = (o.id && PF().byId(o.id, Lib.list.concat((o.A && o.A.profiles) || []))) || PF().resolve(o.A, o.id, kind);
    load(start);
    if (!dlg.open) { try { dlg.showModal(); } catch (e) { dlg.setAttribute("open", ""); } }
    Lib.load().then(() => { if (D) list(); });
    return dlg;
  }

  root.PPProfileLib = Object.assign(Lib, { keep });
  root.PPProfileUI = { dropdown, close: closeList };
  root.PPProfileDlg = { open, close: () => close(null), state: () => D, save };
})(typeof window !== "undefined" ? window : globalThis);
