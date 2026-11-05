/* bitGen Studio — ext/pushpulldock/ppwalltype.js (2.661.0): 🧱 WALL TYPES - a wall's build-up, layer by layer - window.PPWallType.
 *
 * Tim (verbatim): "create a docker to create wall structure like brick, air gap, frame, insulation, gyprock etc. wall thickness etc"
 *
 *   A wall type = a name + its layers from the OUTSIDE face to the INSIDE one: [{k: a LAYERS key, t: metres, ins: batts in a
 *   frame, col: its own colour (optional)}]. Its thickness = the layers added up (batts in a frame add nothing).
 *   The model keeps its types (M.arch.wtypes - the BUILTIN set the first time one is used) and each room which wall has which
 *   (room.wt = {edge: type id}); room.tw = {edge: thickness} follows from them (sync - pparch's clean runs it too), and
 *   pparch.js builds each wall that thick round its centre line (wallQuads / interior / exterior / opInfo - tw()).
 *   The outside layer, when it is a finish (brick, render, cladding ...), colours the wall's outside face (a wall's own
 *   Outside colour still wins); the layers' seams are drawn on the wall's top and on the 📐 floorplan.
 *   The 🧱 Wall types docker (the Sketcher's bar): the types, one's layers (kind, thickness, ↑ ↓ ✕, ＋ a layer), its cut drawn
 *   to scale, its thickness, and Use it for: the picked wall / the picked room's walls / every exterior / interior wall.
 *   A wall's own panel (pparchtools.js) picks its type too.
 * Pure (Node: scripts/test-walltype661.js): LAYERS, BUILTIN, cleanTypes, cleanWt, list, ensure, find, total, outerCol, sync,
 * assign, targets, usedBy, removeType, copyType, section, seams.
 */
(function (root) {
  "use strict";
  /** the layers a wall is made of: label, a usual thickness (m), its colour (a material where there is one), finish = it can be
      a face of the wall, frame = studs (batts can go in it), gap = nothing (air) */
  const LAYERS = {
    brick: { label: "Brick", t: 0.11, col: "mat:brick", finish: true },
    block: { label: "Concrete block", t: 0.19, col: "mat:concrete", finish: true },
    concrete: { label: "Concrete", t: 0.2, col: "mat:concrete", finish: true },
    stone: { label: "Stone", t: 0.2, col: "mat:stone", finish: true },
    render: { label: "Render", t: 0.012, col: "#e4ddd0", finish: true },
    weatherboard: { label: "Weatherboard", t: 0.018, col: "mat:wood", finish: true },
    fibre: { label: "Fibre cement sheet", t: 0.009, col: "#d9d5cc", finish: true },
    metal: { label: "Metal cladding", t: 0.005, col: "mat:roof_metal", finish: true },
    tiles: { label: "Tiles", t: 0.01, col: "mat:tile", finish: true },
    gap: { label: "Air gap / cavity", t: 0.04, col: "", gap: true },
    batten: { label: "Battens", t: 0.02, col: "#b88f5c" },
    wrap: { label: "Wrap / sarking", t: 0.001, col: "#c9d6e4" },
    board: { label: "Insulation board", t: 0.05, col: "#e6d27a" },
    insul: { label: "Insulation batts", t: 0.09, col: "#efd27c" },
    timber: { label: "Timber frame", t: 0.09, col: "#c8a06a", frame: true },
    steel: { label: "Steel frame", t: 0.092, col: "#9aa0a6", frame: true },
    plaster: { label: "Plasterboard (gyprock)", t: 0.01, col: "mat:plaster" },
    wetboard: { label: "Wet-area board", t: 0.01, col: "#cfe0d4" },
  };
  const L = (k, t, ins) => (ins ? { k, t, ins: true } : { k, t });
  /** the types a model starts with */
  const BUILTIN = [
    { id: "veneer", name: "Brick veneer", layers: [L("brick", 0.11), L("gap", 0.04), L("wrap", 0.001), L("timber", 0.09, true), L("plaster", 0.01)] },
    { id: "double", name: "Double brick", layers: [L("brick", 0.11), L("gap", 0.05), L("brick", 0.11), L("render", 0.01)] },
    { id: "clad", name: "Timber frame, weatherboard", layers: [L("weatherboard", 0.018), L("wrap", 0.001), L("timber", 0.09, true), L("plaster", 0.01)] },
    { id: "fibre", name: "Timber frame, fibre cement", layers: [L("fibre", 0.009), L("batten", 0.02), L("wrap", 0.001), L("timber", 0.09, true), L("plaster", 0.01)] },
    { id: "block", name: "Rendered block", layers: [L("render", 0.012), L("block", 0.19), L("plaster", 0.01)] },
    { id: "stud", name: "Interior stud", layers: [L("plaster", 0.01), L("timber", 0.09), L("plaster", 0.01)] },
    { id: "steelstud", name: "Interior steel stud", layers: [L("plaster", 0.013), L("steel", 0.064), L("plaster", 0.013)] },
    { id: "wet", name: "Wet-area stud", layers: [L("tiles", 0.01), L("wetboard", 0.01), L("timber", 0.09), L("plaster", 0.01)] },
  ];
  const r6 = (v) => Math.round(v * 1e6) / 1e6;
  const colOk = (c) => typeof c === "string" && (/^#[0-9a-f]{6}$/i.test(c) || /^(mat|tex):[\w-]{1,40}$/.test(c));
  const copy = (o) => JSON.parse(JSON.stringify(o));
  /** the types, checked: an id (letters / digits / - _), a name, 1-12 known layers 1 mm - 1 m; 60 at most, each id once */
  function cleanTypes(list) {
    const seen = new Set(), out = [];
    (Array.isArray(list) ? list : []).forEach((T) => {
      if (!T || typeof T !== "object" || out.length >= 60) return;
      const id = String(T.id || "").replace(/[^\w-]/g, "").slice(0, 24); if (!id || seen.has(id)) return;
      const layers = (Array.isArray(T.layers) ? T.layers : []).filter((x) => x && LAYERS[x.k]).slice(0, 12).map((x) => {
        const o = { k: x.k, t: r6(Math.min(1, Math.max(0.001, +x.t || LAYERS[x.k].t))) };
        if (x.ins && LAYERS[x.k].frame) o.ins = true;
        if (colOk(x.col)) o.col = x.col;
        return o;
      });
      if (!layers.length) return;
      seen.add(id); out.push({ id, name: String(T.name || "Wall type").slice(0, 60), layers });
    });
    return out;
  }
  /** a room's {edge: type id}, checked against the types there are */
  function cleanWt(o, nEdges, ids) {
    const out = {}; if (!o || typeof o !== "object") return out;
    Object.keys(o).forEach((k) => { const i = +k; if (Number.isInteger(i) && i >= 0 && i < nEdges && ids.has(String(o[k]))) out[i] = String(o[k]); });
    return out;
  }
  /** the model's types (none yet: the built-in ones, not kept until one is used - ensure) */
  const list = (A) => (A && Array.isArray(A.wtypes) && A.wtypes.length ? A.wtypes : BUILTIN);
  /** the model keeps the built-in types the first time one is used / edited */
  function ensure(A) { if (!Array.isArray(A.wtypes) || !A.wtypes.length) A.wtypes = copy(BUILTIN); return A.wtypes; }
  const find = (A, id) => list(A).find((T) => T.id === id) || null;
  /** the wall's thickness (m): the layers added up, batts in a frame nothing */
  const total = (T) => r6((T && T.layers ? T.layers : []).reduce((s, x) => s + (+x.t || 0), 0));
  const colOf = (x) => (x.col || (LAYERS[x.k] && LAYERS[x.k].col) || "");
  /** the outside face's colour - its outside layer when that is a finish (brick, render, cladding ...), else null */
  function outerCol(T) { const x = T && T.layers && T.layers[0]; return x && LAYERS[x.k] && LAYERS[x.k].finish ? colOf(x) || null : null; }
  /** every room's room.tw = {edge: its type's thickness} (the types as they are now) - how many walls have a type */
  function sync(A) {
    let n = 0;
    (A.rooms || []).forEach((R) => {
      R.tw = {};
      Object.keys(R.wt || {}).forEach((k) => { const T = find(A, R.wt[k]); if (T && total(T) > 0) { R.tw[k] = Math.max(0.02, total(T)); n++; } else delete R.wt[k]; });
    });
    return n;
  }
  /** the type for these walls ([{R, i}]; null: none - the room's own thickness again) */
  function assign(A, walls, id) {
    if (id) { ensure(A); if (!find(A, id)) return 0; }
    walls.forEach((w) => { w.R.wt = Object.assign({}, w.R.wt || {}); if (id) w.R.wt[w.i] = id; else delete w.R.wt[w.i]; });
    sync(A); return walls.length;
  }
  /** the walls a "Use it for" means: "wall" (sel = {room, edge}), "room" (the room's walls standing), "ext" / "int" (every wall
      of that kind - pparch's wallKind) */
  function targets(A, mode, sel, P) {
    const out = [], Pa = P || root.PPArch; if (!Pa) return out;
    const each = (R, fn) => Pa.edgesOf(R).forEach((e) => { if (e.L > 1e-6 && !Pa.isGone(R, e.i)) fn(e.i); });
    if (mode === "wall" || mode === "room") {
      const R = sel && Pa.room(A, sel.id); if (!R) return out;
      if (mode === "wall") { if (sel.edge != null && !Pa.isGone(R, sel.edge)) out.push({ R, i: sel.edge }); } else each(R, (i) => out.push({ R, i }));
      return out;
    }
    (A.rooms || []).forEach((R) => each(R, (i) => { if (Pa.wallKind(A, R, i) === mode) out.push({ R, i }); }));
    return out;
  }
  /** how many walls have this type */
  const usedBy = (A, id) => (A.rooms || []).reduce((s, R) => s + Object.keys(R.wt || {}).filter((k) => R.wt[k] === id).length, 0);
  /** a type gone (its walls back to their room's thickness) */
  function removeType(A, id) { ensure(A); const n0 = A.wtypes.length; A.wtypes = A.wtypes.filter((T) => T.id !== id); (A.rooms || []).forEach((R) => { Object.keys(R.wt || {}).forEach((k) => { if (R.wt[k] === id) delete R.wt[k]; }); }); sync(A); return n0 !== A.wtypes.length; }
  /** a copy of a type (or a new plain one) with its own id -> the copy */
  function copyType(A, id, name) {
    ensure(A);
    const src = find(A, id), T = src ? copy(src) : { name: "Wall type", layers: [L("plaster", 0.01), L("timber", 0.09), L("plaster", 0.01)] };
    let n = 1; while (A.wtypes.some((x) => x.id === "wt" + n)) n++;
    T.id = "wt" + n; T.name = name || (src ? src.name + " (copy)" : "Wall type " + n); A.wtypes.push(T); return T;
  }
  /** the layers' places across the wall: [{k, label, t, col, from, to, ins}] from the outside (0) */
  function section(T) {
    let s = 0;
    return (T && T.layers ? T.layers : []).map((x) => { const o = { k: x.k, label: LAYERS[x.k] ? LAYERS[x.k].label : x.k, t: x.t, col: colOf(x), from: r6(s), to: r6(s + x.t), ins: !!x.ins }; s += x.t; return o; });
  }
  /** the seams between the layers on a wall's quad [lS, lE, rE, rS] (left = inside, right = outside) -> [[p, q] ...] */
  function seams(T, quad) {
    const tot = total(T); if (!(tot > 0) || !quad) return [];
    const [lS, lE, rE, rS] = quad, lerp = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
    return section(T).slice(0, -1).map((x) => { const f = x.to / tot; return [lerp(rS, lS, f), lerp(rE, lE, f)]; });
  }
  const api = { LAYERS, BUILTIN, cleanTypes, cleanWt, list, ensure, find, total, outerCol, sync, assign, targets, usedBy, removeType, copyType, section, seams };
  if (typeof module !== "undefined" && module.exports && !root.document) { module.exports = api; return; }
  root.PPWallType = api;

  /* ---------------- the 🧱 Wall types docker */
  const doc = root.document, $ = (id) => doc.getElementById(id);
  const H = () => root.H3PushPull;
  const ls = { get: (k) => { try { return root.localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { root.localStorage.setItem(k, v); } catch (e) { /* fine */ } } };
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const mm = (m) => Math.round(m * 1000);
  const hexOf = (c) => { if (!c) return "transparent"; const F = root.PPFurn; return F && F.hex ? F.hex(c) : c.startsWith("#") ? c : "#bbbbbb"; };
  function arch() { const h = H(); return h && h.state && h.state.M ? (h.state.M.arch || null) : null; }
  function edit(label, fn) {
    const h = H(); if (!h || !h.state.M) return;
    const before = h.snapshot ? h.snapshot() : null;
    if (!h.state.M.arch) h.state.M.arch = root.PPArch.empty();
    fn(h.state.M.arch);
    if (h.commit) h.commit(label, before);
    if (h.state.A) h.state.A.rebuild();
    paint();
    try { const T = h.state.T && h.state.T.arch; if (T && T.props) T.props(); } catch (e) { /* fine */ }
  }
  function status(t) { const m = $("ppMsg"); if (m) m.textContent = t; }
  let cur = ls.get("pp.wtcur") || "veneer";
  const shown = () => ls.get("pp.walltypes") === "1";
  function resized() { const h = H(); if (h && h.state && h.state.V) setTimeout(() => { try { h.state.V.size(); } catch (e) { /* fine */ } }, 30); }
  function mount() {
    const main = $("ppMain"), props = $("ppProps"); if (!main || !props) return null;
    let box = $("ppWT");
    if (!box) {
      box = doc.createElement("div"); box.id = "ppWT"; box.setAttribute("aria-label", "Wall types");
      main.insertBefore(box, props);
      const st = doc.createElement("style");
      st.textContent = "#ppWT{width:250px;flex:none;overflow:auto;font-size:11px;border-left:1px solid var(--line,#444);padding:4px 6px 10px}#ppWT.off{display:none}"
        + "#pushpulldock.ppnarrow #ppWT{position:absolute;right:0;top:0;bottom:0;z-index:6;background:var(--panel,#1f1c17);box-shadow:-6px 0 18px #0006;max-width:70%}"
        + "#ppWT .wth{font-weight:600;color:var(--tiger,#f59e2c);margin:2px 0 4px;display:flex;align-items:center;gap:4px}#ppWT .wth span{flex:1}"
        + "#ppWT .wtrow{display:flex;gap:4px;align-items:center;padding:2px 4px;border-radius:3px;cursor:pointer}#ppWT .wtrow:hover{background:var(--ui-hover,#2f2a21)}"
        + "#ppWT .wtrow.on{background:var(--ui-on,#4a3414);color:var(--tiger,#f59e2c)}#ppWT .wtrow .n{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#ppWT .wtrow .d{color:var(--dim,#9a917f)}"
        + "#ppWT .lay{display:flex;gap:3px;align-items:center;margin:2px 0}#ppWT .lay select{flex:1;min-width:0;font-size:11px}#ppWT .lay input[type=number]{width:46px;font-size:11px}"
        + "#ppWT .sw{width:12px;height:12px;border-radius:2px;border:1px solid #0006;flex:none}#ppWT button{font-size:11px;padding:1px 5px}#ppWT .ib{padding:0 3px;background:none;border:0;color:inherit;cursor:pointer}"
        + "#ppWT .ib:hover{color:var(--tiger,#f59e2c)}#ppWT .wtsec{margin:6px 0 2px;color:var(--dim,#9a917f);font-weight:600}#ppWT .use{display:flex;flex-wrap:wrap;gap:3px}#ppWT .hint{color:var(--dim,#9a917f);margin-top:6px;line-height:1.35}"
        + "#ppWT input.nm{width:100%;box-sizing:border-box;font-size:11px}#ppWT svg{display:block;width:100%;margin:4px 0}#ppWT .tot{font-weight:600;margin:3px 0}";
      doc.head.appendChild(st);
      box.addEventListener("click", onClick); box.addEventListener("change", onChange);
      const bar = $("ppBar"), after = $("ppOutlineBtn") || $("ppCut");
      if (bar && !$("ppWTBtn")) {
        const b = doc.createElement("button"); b.className = "ghost gbtn"; b.id = "ppWTBtn"; b.type = "button"; b.textContent = "🧱 Wall types";
        b.title = "The wall types docker: each wall's build-up layer by layer (brick, air gap, frame, insulation, plasterboard ...) and its thickness - for the picked wall, a room, every exterior / interior wall";
        b.onclick = () => toggle();
        if (after && after.parentNode === bar) after.after(b); else bar.appendChild(b);
      }
    }
    return box;
  }
  function toggle(on) { const v = on == null ? !shown() : !!on; ls.set("pp.walltypes", v ? "1" : "0"); paint(); resized(); }
  /** the cut through the wall, to scale: outside on the left */
  function svgOf(T) {
    const S = section(T), tot = total(T) || 1, W = 236, H2 = 46, x0 = 16, w = W - 32;
    const bars = S.map((x, i) => { const a = x0 + x.from / tot * w, b = Math.max(a + 1.5, x0 + x.to / tot * w), c = hexOf(x.col);
      const batts = x.ins ? `<path d="M${a.toFixed(1)} 8 ${Array.from({ length: 6 }, (_, k) => `L${(k % 2 ? a : b).toFixed(1)} ${8 + (k + 1) * (H2 - 16) / 6}`).join(" ")}" stroke="#d9a82e" fill="none" stroke-width="1.2"/>` : "";
      return `<rect x="${a.toFixed(1)}" y="8" width="${(b - a).toFixed(1)}" height="${H2 - 16}" fill="${c}" stroke="#0007" stroke-width=".5"${x.k === "gap" ? ' stroke-dasharray="2 2"' : ""}><title>${esc(x.label)} ${mm(x.t)} mm${x.ins ? " + batts" : ""}</title></rect>${batts}`; }).join("");
    return `<svg viewBox="0 0 ${W} ${H2}" aria-label="the wall's cut"><text x="2" y="6" font-size="7" fill="currentColor" opacity=".6">outside</text><text x="${W - 2}" y="6" font-size="7" fill="currentColor" opacity=".6" text-anchor="end">inside</text>${bars}</svg>`;
  }
  function selWall() { const h = H(), T = h && h.state && h.state.T && h.state.T.arch; const s = T && T.sel ? T.sel() : null; return s && s.ak === "room" ? s : null; }
  function paint() {
    const box = mount(); if (!box) return;
    const on = shown(); box.classList.toggle("off", !on); const btn = $("ppWTBtn"); if (btn) btn.classList.toggle("on", on);
    if (!on) return;
    const A = arch() || (root.PPArch ? root.PPArch.empty() : {}), L0 = list(A); let T = find(A, cur); if (!T) { T = L0[0]; cur = T ? T.id : ""; }
    const s = selWall(), rows = [];
    rows.push(`<div class="wth"><span>🧱 Wall types</span><button class="ib" data-act="new" title="A new wall type">＋</button><button class="ib" data-act="copy" title="A copy of this type">⧉</button><button class="ib" data-act="del" title="Delete this type (its walls: their room's thickness again)">✕</button><button class="ib" data-act="close" title="Close">×</button></div>`);
    L0.forEach((x) => { const n = usedBy(A, x.id); rows.push(`<div class="wtrow${x.id === cur ? " on" : ""}" data-type="${esc(x.id)}"><span class="sw" style="background:${esc(hexOf(outerCol(x) || colOf(x.layers[0])))}"></span><span class="n" title="${esc(x.name)}">${esc(x.name)}</span><span class="d">${mm(total(x))} mm${n ? " · " + n + " wall" + (n > 1 ? "s" : "") : ""}</span></div>`); });
    if (T) {
      rows.push(`<div class="wtsec">This type</div><input class="nm" id="ppWTName" value="${esc(T.name)}" aria-label="Name">`);
      rows.push(svgOf(T));
      rows.push(`<div class="tot" id="ppWTTotal">Wall thickness ${mm(total(T))} mm</div><div class="wtsec">Layers - outside to inside</div>`);
      const opts = (k) => Object.keys(LAYERS).map((key) => `<option value="${key}"${key === k ? " selected" : ""}>${esc(LAYERS[key].label)}</option>`).join("");
      T.layers.forEach((x, i) => rows.push(`<div class="lay" data-i="${i}"><span class="sw" style="background:${esc(hexOf(colOf(x)))}"></span><select data-f="k" aria-label="Layer ${i + 1}">${opts(x.k)}</select><input type="number" data-f="t" min="1" max="1000" step="1" value="${mm(x.t)}" title="mm" aria-label="Layer ${i + 1} thickness (mm)">`
        + (LAYERS[x.k].frame ? `<label title="Insulation batts between the studs (they add nothing to the thickness)"><input type="checkbox" data-f="ins"${x.ins ? " checked" : ""}>batts</label>` : "")
        + `<button class="ib" data-act="up" title="Further out">↑</button><button class="ib" data-act="down" title="Further in">↓</button><button class="ib" data-act="rm" title="Take this layer out">✕</button></div>`));
      rows.push(`<div class="lay"><select id="ppWTAdd" aria-label="Add a layer"><option value="">＋ Add a layer…</option>${Object.keys(LAYERS).map((key) => `<option value="${key}">${esc(LAYERS[key].label)}</option>`).join("")}</select></div>`);
      const wl = s && s.part === "wall" && s.edge != null, rm = s && s.id != null;
      rows.push(`<div class="wtsec">Use it for</div><div class="use">`
        + `<button data-use="wall"${wl ? "" : " disabled"} title="The wall picked in the view (➤ Select)">▮ The picked wall</button>`
        + `<button data-use="room"${rm ? "" : " disabled"} title="Every wall of the picked room">⌂ The room's walls</button>`
        + `<button data-use="ext" title="Every wall with the outdoors on one side">Exterior walls</button><button data-use="int" title="Every wall with a room on both sides">Interior walls</button>`
        + `<button data-use="none"${wl || rm ? "" : " disabled"} title="The picked wall / room back to the room's own thickness">✕ None</button></div>`);
      rows.push(`<div class="hint">Each wall keeps its centre line - it grows both ways. The outside layer (brick, render, cladding…) colours the wall's outside face; the seams show on the wall's top and the 📐 floorplan. Ctrl+Z undoes.</div>`);
    }
    box.innerHTML = rows.join("");
  }
  /** the current type, kept in the model first (a built-in one the first time) */
  function mine(A) { ensure(A); return A.wtypes.find((x) => x.id === cur); }
  function onClick(e) {
    const t = e.target, A0 = arch() || {};
    const row = t.closest(".wtrow"); if (row) { cur = row.dataset.type; ls.set("pp.wtcur", cur); paint(); return; }
    const act = t.closest("[data-act]") && t.closest("[data-act]").dataset.act;
    if (act === "close") { toggle(false); return; }
    if (act === "new" || act === "copy") { let nt = null; edit("wall type", (A) => { nt = copyType(A, act === "copy" ? cur : null); }); if (nt) { cur = nt.id; ls.set("pp.wtcur", cur); paint(); } return; }
    if (act === "del") { const n = usedBy(A0, cur), T = find(A0, cur); edit("wall type gone", (A) => removeType(A, cur)); status("🧱 " + (T ? T.name : "the type") + " deleted" + (n ? " - its " + n + " wall" + (n > 1 ? "s" : "") + " back to their room's thickness" : "")); cur = (list(arch() || {})[0] || {}).id || ""; paint(); return; }
    const lay = t.closest(".lay[data-i]");
    if (lay && act) { const i = +lay.dataset.i; edit("wall type", (A) => { const T = mine(A); if (!T) return; const Ls = T.layers;
      if (act === "rm" && Ls.length > 1) Ls.splice(i, 1);
      if (act === "up" && i > 0) Ls.splice(i - 1, 0, Ls.splice(i, 1)[0]);
      if (act === "down" && i < Ls.length - 1) Ls.splice(i + 1, 0, Ls.splice(i, 1)[0]);
      sync(A); }); return; }
    const use = t.closest("[data-use]"); if (use && !use.disabled) { useFor(use.dataset.use); }
  }
  function useFor(mode) {
    const A0 = arch(); if (!A0) return;
    const s = selWall(), m = mode === "none" ? (s && s.part === "wall" ? "wall" : "room") : mode;
    const W = targets(A0, m, s); if (!W.length) { status("🧱 no walls for that" + (m === "wall" || m === "room" ? " - pick a wall or a room with ➤ Select" : "")); return; }
    const T = find(A0, cur); let n = 0;
    edit("wall type", (A) => { n = assign(A, targets(A, m, s), mode === "none" ? null : cur); });
    status(mode === "none" ? "🧱 " + n + " wall" + (n > 1 ? "s" : "") + " back to their room's thickness" : "🧱 " + (T ? T.name : "") + " (" + mm(total(T)) + " mm) for " + n + " wall" + (n > 1 ? "s" : ""));
  }
  function onChange(e) {
    const t = e.target;
    if (t.id === "ppWTName") { const v = t.value.trim(); if (v) edit("wall type", (A) => { const T = mine(A); if (T) T.name = v.slice(0, 60); }); return; }
    if (t.id === "ppWTAdd") { const k = t.value; if (k && LAYERS[k]) edit("wall type", (A) => { const T = mine(A); if (T && T.layers.length < 12) { T.layers.push({ k, t: LAYERS[k].t }); sync(A); } }); return; }
    const lay = t.closest(".lay[data-i]"); if (!lay) return;
    const i = +lay.dataset.i, f = t.dataset.f;
    edit("wall type", (A) => { const T = mine(A), x = T && T.layers[i]; if (!x) return;
      if (f === "k" && LAYERS[t.value]) { x.k = t.value; x.t = LAYERS[t.value].t; delete x.col; if (!LAYERS[x.k].frame) delete x.ins; }
      if (f === "t") x.t = Math.min(1, Math.max(0.001, (+t.value || 1) / 1000));
      if (f === "ins") { if (t.checked) x.ins = true; else delete x.ins; }
      sync(A); });
  }
  function boot() { const h = H(); if (!h || !h.state || !h.state.booted || !$("ppMain")) return false; paint(); return true; }
  if (!boot()) { let k = 0; const t = setInterval(() => { if (boot() || ++k > 240) clearInterval(t); }, 500); }
  Object.assign(root.PPWallType, { paint, mount, toggle, useFor, current: () => cur, pick: (id) => { cur = id; ls.set("pp.wtcur", id); paint(); } });
})(typeof window !== "undefined" ? window : globalThis);
