/* bitGen Studio — ext/pushpulldock/pproadtools.js (2.673.0): THE 🛤 ROAD TOOL of the 📏 Sketcher (window.PPRoadTools) -
 * SimCity's road tool: pick a type, click along the way, double-click / Enter ends it. The roads are pproads.js.
 *
 * Tim (verbatim): "in sketcher add a road tool like Sim City's road tool, to draw roads on the map, roads will follow the
 * contour of the ground unless too steep, then offer a tunnel or cut the terrain to pass. offer several types of roads just
 * like sim city, autoplace traffic lights and signs etc"
 *
 *   click          a point along the way (on the ⛰ ground) - near a road's end it carries on from it, on a road it makes a T
 *   double-click / Enter   the road ends: on the ground (levelled across); steeper than its type takes ->
 *                  "When too steep": Ask (the panel offers ⛏ Cut the ground / 🚇 Tunnel / bridge) | Cut | Tunnel | Keep
 *   Alt+click a road   its points shown - drag one (the road, its grading follow), Delete removes the picked point
 *   Esc            the road being drawn is dropped
 * Driven by ppterraintools.js (it owns the ⛰ / 🏊 / 🛣 / 🛤 tools): create(ctx, kit) -> {use, down, move, up, dbl, key,
 *   escape, props, finish, state, opts, editing}; kit = {groundAt(ev), before(), TV(), TR(), AR(), fmt(m)}. */
(function (root) {
  "use strict";
  const R = () => root.PPRoads, PT = () => root.PPTerrain;
  const OPT0 = { type: "road", curved: true, steep: "ask" };
  const STEEP = [["ask", "Ask me (cut or tunnel)"], ["cut", "⛏ Cut + fill the ground"], ["tunnel", "🚇 Tunnel / bridge"], ["follow", "Keep it on the ground"]];
  const HINT = "🛤 Road - pick a type, click along the way (it follows the ground) · double-click / Enter ends · click a road's end to carry on, its side for a T · Alt+click a road: drag its points";

  function create(ctx, kit) {
    const V = ctx.V, O = Object.assign({}, OPT0);
    try { const s = JSON.parse(root.localStorage.getItem("pp.roadopt") || "{}"); Object.keys(OPT0).forEach((k) => { if (typeof s[k] === typeof OPT0[k]) O[k] = s[k]; }); } catch (e) { /* fine */ }
    if (!R() || !R().TYPES[O.type]) O.type = "road";
    const keepOpt = () => { try { root.localStorage.setItem("pp.roadopt", JSON.stringify(O)); } catch (e) { /* fine */ } };
    let st = {}, editId = null;
    const AR = kit.AR, fmt = kit.fmt;
    const zAt = (p) => (kit.TR() && PT() ? PT().at(kit.TR(), p[0], p[1]) : 0) + 0.12;
    const edited = () => (editId != null ? (AR().roads || []).find((r) => r.id === editId) || null : null);
    const pct = (g) => R().pct(g);

    function use(on) { st = {}; editId = null; marks(); if (on) ctx.status(HINT); }
    function drop() { const had = !!(st.draft || editId != null); st = {}; editId = null; marks(); return had; }
    /** the road being drawn (its centre + edges on the ground) or the edited road's points */
    function marks() {
      const tv = kit.TV(); if (!tv || !tv.marks) return;
      const lines = [], pts = [], rings = [], hot = [];
      const draw = (r) => { const C = R().path(r).map((p) => [p[0], p[1], zAt(p)]); for (let i = 1; i < C.length; i++) lines.push([C[i - 1], C[i]]); const E = R().outline(r).map((p) => [p[0], p[1], zAt(p)]), h = E.length / 2; for (let i = 1; i < E.length; i++) if (i !== h) lines.push([E[i - 1], E[i]]); };
      if (st.draft) {
        const P = st.draft.pts.concat(st.draft.at ? [st.draft.at] : []);
        if (P.length >= 2) { const tmp = R().make(null, P, { type: O.type, curved: O.curved }); if (tmp) draw(tmp); }
        st.draft.pts.forEach((p) => pts.push([p[0], p[1], zAt(p)]));
        if (st.snap) rings.push([st.snap[0], st.snap[1], zAt(st.snap)]);
      }
      const r = edited();
      if (r) r.nodes.forEach((n, i) => (st.hot === i ? hot : pts).push([n.p[0], n.p[1], zAt(n.p)]));
      tv.marks(lines.length || pts.length || rings.length || hot.length ? { lines, pts, rings, hot } : null);
    }
    /** a point, snapped onto a road's end / centre line (2 m, or within its width) */
    function pointAt(ev) {
      const p = kit.groundAt(ev); if (!p) return null;
      const s = ev.shiftKey ? null : R().snap(AR(), p, 2);
      st.snap = s ? s.p : null;
      return s ? s.p : [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100];
    }
    function nodeHit(ev) {
      const r = edited(); if (!r) return null;
      const b = V.canvas.getBoundingClientRect(), mx = ev.clientX - b.left, my = ev.clientY - b.top; let best = null;
      r.nodes.forEach((n, i) => { const s = V.screen([n.p[0], n.p[1], zAt(n.p)]); if (!(s[2] < 1)) return; const d = Math.hypot(s[0] - mx, s[1] - my); if (d < 12 && (!best || d < best.d)) best = { i, d }; });
      return best;
    }
    function down(ev) {
      if (!R()) return;
      const h = !st.draft && nodeHit(ev);
      if (h) { st.hot = h.i; st.drag = { before: kit.before(), moved: false, i: h.i }; marks(); ctx.status("🛤 drag the point - the road follows · Delete removes it"); return; }
      const p0 = kit.groundAt(ev); if (!p0) return;
      if (!st.draft && ev.altKey) {
        const f = R().roadAt(AR(), p0, 1);
        if (f) { editId = f.r.id; st.hot = null; marks(); props(); ctx.status("🛤 " + f.r.name + " - drag its points (□) · Delete removes the picked one · click away to leave it"); return; }
      }
      editId = null;
      const p = pointAt(ev); if (!p) return;
      if (!st.draft) { st.draft = { pts: [p] }; marks(); props(); ctx.status("🛤 a " + R().TYPES[O.type].label.toLowerCase() + " - click the next points · double-click / Enter ends it · Shift: no snapping"); return; }
      const last = st.draft.pts[st.draft.pts.length - 1]; if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.5) return;
      st.draft.pts.push(p); marks();
      const tmp = R().make(null, st.draft.pts, { type: O.type, curved: O.curved }), pr = tmp && R().profile(AR(), tmp);
      if (pr) ctx.status("🛤 " + fmt(R().length(tmp)) + " · the ground up to " + pct(pr.steepest) + (pr.steepest > R().TYPES[O.type].max ? " - steeper than a " + R().TYPES[O.type].label.toLowerCase() + " takes (" + pct(R().TYPES[O.type].max) + ")" : "") + " · double-click / Enter ends it");
    }
    function move(ev) {
      if (st.drag) {
        const r = edited(); if (!r || !(ev.buttons & 1)) return;
        const p = pointAt(ev); if (!p) return;
        r.nodes[st.drag.i].p = p; R().smooth(r); st.drag.moved = true;
        const av = ctx.archView && ctx.archView(); if (av) av.rebuild(); marks(); return;
      }
      if (st.draft) { const p = pointAt(ev); if (p) { st.draft.at = p; marks(); } }
    }
    function up() {
      const D = st.drag; if (!D) return; st.drag = null;
      const r = edited();
      if (D.moved && r) { const v = R().setMode(AR(), r, r.mode); ctx.commit("road", D.before); ctx.status("🛤 " + r.name + " moved" + (v.cut + v.fill > 1 ? " - the ground graded again (" + Math.round(v.cut) + " m³ cut, " + Math.round(v.fill) + " m³ filled)" : "")); props(); }
      marks();
    }
    function dbl() { if (st.draft) finish(); }
    function finish() {
      const D = st.draft; st.draft = null; st.snap = null;
      const pts = D ? D.pts.filter((p, i) => i === 0 || Math.hypot(p[0] - D.pts[i - 1][0], p[1] - D.pts[i - 1][1]) > 0.5) : [];
      if (pts.length < 2) { marks(); ctx.status("🛤 a road needs two points at least"); return null; }
      const b = kit.before(), A = AR(), r = R().make(A, pts, { type: O.type, curved: O.curved });
      if (!r) { marks(); return null; }
      A.roadSet = R().cleanSet(A.roadSet);
      const pr = R().profile(A, r), t = R().TYPES[r.type];
      const mode = pr.steep && (O.steep === "cut" || O.steep === "tunnel") ? O.steep : "follow";
      const v = R().setMode(A, r, mode);
      ctx.commit("road", b); editId = r.id; marks(); props();
      const what = "🛤 " + r.name + " - " + fmt(R().length(r));
      if (pr.steep && O.steep === "ask") ctx.status(what + " · ⚠ the ground is " + pct(pr.steepest) + " steep along it, a " + t.label.toLowerCase() + " takes " + pct(t.max) + " - ⛏ Cut the ground or 🚇 Tunnel / bridge (in the panel)");
      else ctx.status(what + (mode === "cut" ? " · cut to an even grade (" + Math.round(v.cut) + " m³ cut, " + Math.round(v.fill) + " m³ filled)" : mode === "tunnel" ? " · through the high ground in a tunnel" : " · on the ground") + " · junctions get their lights and signs");
      return r;
    }
    function key(e) {
      if (e.key === "Enter" && st.draft) { finish(); return true; }
      if ((e.key === "Delete" || e.key === "Backspace") && edited() && st.hot != null) {
        const r = edited(); if (r.nodes.length <= 2) { ctx.status("🛤 a road keeps two points (🗑 Delete in its panel removes it)"); return true; }
        const b = kit.before(); r.nodes.splice(st.hot, 1); R().smooth(r); R().setMode(AR(), r, r.mode); st.hot = null; ctx.commit("road", b); marks(); props(); return true;
      }
      return false;
    }
    function escape() { return drop(); }

    /** the panel: the types as pictures, curved, when too steep, the lights + signs; the edited road's own settings */
    function props(k) {
      const box = root.document && root.document.getElementById("ppProps"); if (!box || !R()) return;
      const el = k ? k.el : (tag, cls, txt) => { const e = root.document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
      if (!k) { box.innerHTML = ""; box.style.display = "block"; }
      const row = (label, input) => { const r = el("label", "ppr"); r.appendChild(el("span", "", label)); r.appendChild(input); box.appendChild(r); return input; };
      const selIn = (label, val, opts, fn) => { const s = el("select"); opts.forEach(([v, t]) => { const o = el("option", "", t); o.value = v; if (v === val) o.selected = true; s.appendChild(o); }); s.onchange = () => fn(s.value); return row(label, s); };
      const chkIn = (label, val, fn) => { const i = el("input"); i.type = "checkbox"; i.checked = !!val; i.onchange = () => fn(i.checked); return row(label, i); };
      const txtIn = (label, val, fn) => { const i = el("input"); i.type = "text"; i.value = val; i.onchange = () => fn(i.value.trim().slice(0, 60) || val); return row(label, i); };
      const btns = (list) => { const r = el("div", "ppbtns"); list.forEach(([t, fn, tip]) => { const b = el("button", "ghost", t); b.type = "button"; if (tip) b.title = tip; b.onclick = fn; r.appendChild(b); }); box.appendChild(r); };
      const head = (t) => box.appendChild(el("div", "pph", t)), hint = (t) => box.appendChild(el("div", "pphint", t));
      const opt = (key) => (v) => { O[key] = v; keepOpt(); props(); marks(); };
      head("🛤 Road");
      const pick = el("div", "pproads"); pick.setAttribute("role", "listbox"); pick.setAttribute("aria-label", "Road type");
      R().KEYS.forEach((t) => { const T = R().TYPES[t], b = el("button", t === O.type ? "on" : ""); b.type = "button"; b.dataset.road = t; b.title = T.label + " - " + T.lanes + " lane" + (T.lanes > 1 ? "s" : "") + ", " + T.speed + " km/h, " + pct(T.max) + " steepest";
        b.innerHTML = R().icon(t, 48, 28); b.appendChild(el("span", "", T.icon)); b.onclick = () => opt("type")(t); pick.appendChild(b); });
      box.appendChild(pick);
      selIn("Type", O.type, R().KEYS.map((t) => [t, R().TYPES[t].label]), opt("type"));
      chkIn("Curved (through the points)", O.curved, opt("curved"));
      selIn("When too steep", O.steep, STEEP, opt("steep"));
      const A = AR(); A.roadSet = R().cleanSet(A.roadSet);
      const setCh = (key) => (v) => { const b = kit.before(); A.roadSet = Object.assign(R().cleanSet(A.roadSet), { [key]: v }); ctx.commit("road", b); props(); };
      chkIn("Traffic lights + signs", A.roadSet.auto, setCh("auto"));
      selIn("Traffic keeps to the", A.roadSet.side, [["left", "Left (Australia, UK)"], ["right", "Right (US, Europe)"]], setCh("side"));
      hint("Roads follow the ground. Steeper than the type takes (a highway 6 %, a dirt road 20 %): cut the ground to an even grade, or tunnel through (a bridge over a deep valley). Junctions get traffic lights where major roads meet, stop / give-way signs where a minor road joins.");
      const r = edited();
      if (r) {
        const ch = (fn) => (v) => { const b = kit.before(); fn(v); ctx.commit("road", b); props(); marks(); };
        R().panel({ head, txtIn, selIn, chkIn, btns, ch, hint, erase: () => { const b = kit.before(); const A2 = AR(); A2.roads = (A2.roads || []).filter((x) => x.id !== r.id); editId = null; ctx.commit("road", b); props(); marks(); ctx.status("🛤 " + r.name + " removed (the ground stays as it was graded - ↶ undoes both)"); } }, r, AR());
      }
      if (ctx.resized) ctx.resized();
    }
    return { use, down, move, up, dbl, key, escape, props, finish, drop, state: () => st, opts: O, editing: () => editId, HINT };
  }

  const api = { create, OPT0, STEEP, HINT };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root && typeof root === "object") root.PPRoadTools = api;
})(typeof window !== "undefined" ? window : globalThis);
