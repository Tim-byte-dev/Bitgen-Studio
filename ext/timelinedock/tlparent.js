/* bitGen Studio — ext/timelinedock/tlparent.js (2.490.0): PARENTING and NULL OBJECTS on the timeline's canvas.
 * window.TlParent.
 *
 * Tim (verbatim): "go with 1,2,4,5 and 6 as you suggested" - AFTER-EFFECTS-GAP.md item 2: "Anchor point, parenting,
 * null objects (a layer follows another; empty control layers)". (The anchor point came in 2.489.0.)
 *
 *   ⛓ Parent      (Properties) a picture / text / null layer follows another layer: it moves, turns and scales with
 *                 it (not its opacity); its own position, rotation and scale are then measured in the parent's space.
 *                 Choosing a parent keeps the layer where it is on screen (its values are converted); "none" too.
 *                 Chains work (a parent may have a parent); a layer can never end up following itself.
 *   ＋ Null        an empty control layer: no picture, never compiled, shown on the canvas as a dashed square - key it
 *                 and parent other layers to it
 *   The compile   a parented layer is BAKED by the page before ⚙ Compile (its frames as the canvas draws them ->
 *                 video/tlb_<uid>.webm, lib/layerBake.js) and overlaid as it is; an unchanged layer is not baked again
 *                 (its signature). 2.495.0 (Tim: "fix the parented layers so video layers can follow"): a VIDEO layer
 *                 can follow too - the compile gets its world position / scale / rotation as keys (sampled every
 *                 frame, thinned to the points where the motion bends: worldKeys), not a bake.
 * Pure (Node: scripts/test-parent.js): compose(parentWorld, local), localOf(parentWorld, world), deltaIn(parentWorld,
 * dx, dy), wouldLoop(uidOf, getParent, child, parent).
 */
(function (root) {
  "use strict";
  /* ---------------- the maths: transforms {x, y, scale, rot (degrees), ax, ay} ---------------- */
  // a layer's point p (pixels from its centre) lands at  pos + R(rot)·scale·(p - anchor)  in its parent's space
  function compose(P, L) {
    var r = P.rot * Math.PI / 180, cs = Math.cos(r), sn = Math.sin(r), dx = (L.x - (P.ax || 0)) * P.scale, dy = (L.y - (P.ay || 0)) * P.scale;
    return { x: P.x + cs * dx - sn * dy, y: P.y + sn * dx + cs * dy, scale: P.scale * L.scale, rot: P.rot + L.rot, ax: L.ax || 0, ay: L.ay || 0 };
  }
  /** the local transform that puts a layer at `W` (world) under a parent at `P` (world) */
  function localOf(P, W) {
    var r = -P.rot * Math.PI / 180, cs = Math.cos(r), sn = Math.sin(r), dx = (W.x - P.x) / P.scale, dy = (W.y - P.y) / P.scale;
    return { x: cs * dx - sn * dy + (P.ax || 0), y: sn * dx + cs * dy + (P.ay || 0), scale: W.scale / P.scale, rot: W.rot - P.rot, ax: W.ax || 0, ay: W.ay || 0 };
  }
  /** a move on screen (dx, dy) as a move in the parent's space */
  function deltaIn(P, dx, dy) { var r = -P.rot * Math.PI / 180; return [(Math.cos(r) * dx - Math.sin(r) * dy) / P.scale, (Math.sin(r) * dx + Math.cos(r) * dy) / P.scale]; }
  /** would `child` following `parent` make a loop? (getParent(clip) -> its parent clip or null) */
  function wouldLoop(getParent, child, parent) { var p = parent, n = 0; while (p && n++ < 64) { if (p === child) return true; p = getParent(p); } return false; }
  /** 2.495.0: Ramer-Douglas-Peucker on samples (ts, vs): the indexes to keep so straight lines between them stay within tol */
  function simplify(ts, vs, tol) {
    var n = ts.length, keep = [], i; if (!n) return [];
    for (i = 0; i < n; i++) keep.push(i === 0 || i === n - 1);
    var stack = [[0, n - 1]];
    while (stack.length) {
      var s = stack.pop(), a = s[0], b = s[1]; if (b - a < 2) continue;
      var best = -1, bi = -1, span = (ts[b] - ts[a]) || 1e-9;
      for (i = a + 1; i < b; i++) { var d = Math.abs(vs[i] - (vs[a] + (vs[b] - vs[a]) * (ts[i] - ts[a]) / span)); if (d > best) { best = d; bi = i; } }
      if (best > tol) { keep[bi] = true; stack.push([a, bi], [bi, b]); }
    }
    var out = []; for (i = 0; i < n; i++) if (keep[i]) out.push(i); return out;
  }
  /** 2.495.0: world samples [{at, x, y, scale, rot}] -> keys: {at, x, y} where the path bends, {at, scale}, {at, rot}
   *  (a channel that never changes: no keys); the tolerances double until at most `max` keys */
  function keysOf(sm, tol, max) {
    var ts = sm.map(function (q) { return q.at; }), ch = function (k) { return sm.map(function (q) { return q[k]; }); };
    var flat = function (vs, e) { for (var i = 1; i < vs.length; i++) if (Math.abs(vs[i] - vs[0]) > e) return false; return true; };
    var r2 = function (v) { return Math.round(v * 100) / 100; }, r4 = function (v) { return Math.round(v * 10000) / 10000; };
    var T = { xy: tol.xy, scale: tol.scale, rot: tol.rot }, out = [];
    for (var round = 0; round < 12; round++) {
      out = [];
      var xs = ch("x"), ys = ch("y"), ss = ch("scale"), rs = ch("rot");
      if (!(flat(xs, T.xy) && flat(ys, T.xy))) { var ix = simplify(ts, xs, T.xy), iy = simplify(ts, ys, T.xy), u = {}; ix.concat(iy).forEach(function (k) { u[k] = 1; });
        Object.keys(u).map(Number).sort(function (a, b) { return a - b; }).forEach(function (k) { out.push({ at: Math.round(ts[k] * 1000) / 1000, x: r2(xs[k]), y: r2(ys[k]) }); }); }
      if (!flat(ss, T.scale)) simplify(ts, ss, T.scale).forEach(function (k) { out.push({ at: Math.round(ts[k] * 1000) / 1000, scale: r4(ss[k]) }); });
      if (!flat(rs, T.rot)) simplify(ts, rs, T.rot).forEach(function (k) { out.push({ at: Math.round(ts[k] * 1000) / 1000, rot: r2(rs[k]) }); });
      if (sm.length && sm[0].op != null) { var os = ch("op"), ot = 0.002 * T.xy / tol.xy; if (!flat(os, ot)) simplify(ts, os, ot).forEach(function (k) { out.push({ at: Math.round(ts[k] * 1000) / 1000, op: r4(os[k]) }); }); else out.push({ at: 0, op: r4(os[0]) }); }   // 2.497.0
      if (out.length <= max) break;
      T = { xy: T.xy * 2, scale: T.scale * 2, rot: T.rot * 2 };
    }
    return out.sort(function (a, b) { return a.at - b.at; });
  }
  var pure = { compose: compose, localOf: localOf, deltaIn: deltaIn, wouldLoop: wouldLoop, simplify: simplify, keysOf: keysOf };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  function ready() { try { return !!(window.TlCanvas && TlCanvas.onProps && TlCanvas.drawClip && window.H3Keyframes && typeof tl === "object" && tl); } catch (e) { return false; } }
  function boot() { if (ready()) install(); else setTimeout(boot, 300); }
  boot();

  function install() {
    if (window.TlParent && window.TlParent.world) return;
    var C = window.TlCanvas, KF = window.H3Keyframes, FPS = KF.FPS || 24;
    function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
    function say(t) { try { C.say(t); } catch (e) { /* fine */ } }
    var uid = function (c) { if (!c.uid) c.uid = "u" + Math.random().toString(36).slice(2, 10); return c.uid; };
    /** every canvas clip with its layer: [{c, L, kind ("vl" | "img"), lk}] */
    function all() {
      var out = [];
      (tl.vlayers || []).forEach(function (L, i) { (L.clips || []).forEach(function (c) { out.push({ c: c, L: L, kind: "vl", lk: "vl:" + i }); }); });
      (tl.images || []).forEach(function (L, i) { (L.clips || []).forEach(function (c) { out.push({ c: c, L: L, kind: "img", lk: "i:" + i }); }); });
      return out;
    }
    function byUid(u) { if (!u) return null; var r = all().filter(function (x) { return x.c.uid === u; })[0]; return r ? r.c : null; }
    function parentOf(c) { return c && c.parent ? byUid(c.parent) : null; }
    /** a clip's world transform at time t (its parents' chain applied) */
    function world(c, t, depth) {
      var L = C.tfAt(c, t), P = parentOf(c);
      if (!P || (depth || 0) > 32) return L;
      return compose(world(P, t, (depth || 0) + 1), L);
    }
    /** keep the layer where it is while its parent changes: its static values and every key converted */
    function setParent(c, P) {
      var t = C.state.t || 0, oldP = parentOf(c), Pn = P || null;
      if (Pn && (Pn === c || wouldLoop(parentOf, c, Pn))) { say("a layer cannot follow itself (or a layer that follows it)"); return false; }
      var from = oldP ? world(oldP, t) : { x: 0, y: 0, scale: 1, rot: 0 }, to = Pn ? world(Pn, t) : { x: 0, y: 0, scale: 1, rot: 0 };
      var conv = function (v) { var w = oldP ? compose(from, v) : v; return Pn ? localOf(to, w) : w; };
      var base = c.tf || {};
      var s0 = { x: +base.x || 0, y: +base.y || 0, scale: base.scale == null ? 1 : +base.scale, rot: +base.rot || 0, ax: +base.ax || 0, ay: +base.ay || 0 }, n0 = conv(s0);
      c.tf = Object.assign({}, base, { x: r2(n0.x), y: r2(n0.y), scale: r4(n0.scale), rot: r2(n0.rot) });
      (c.kf || []).forEach(function (k) {
        if (k.x == null && k.scale == null && k.rot == null) return;
        var at = (c.start || 0) + k.at, v = C.tfAt(Object.assign({}, c, { tf: base }), at);
        var w = conv({ x: k.x != null ? k.x : v.x, y: k.y != null ? k.y : v.y, scale: k.scale != null ? k.scale : v.scale, rot: k.rot != null ? k.rot : v.rot, ax: v.ax, ay: v.ay });
        if (k.x != null) { k.x = r2(w.x); k.y = r2(w.y); }
        if (k.scale != null) k.scale = r4(w.scale);
        if (k.rot != null) k.rot = r2(w.rot);
      });
      if (Pn) c.parent = uid(Pn); else delete c.parent;
      delete c.bakeSig;
      if (typeof tlSave === "function") tlSave();
      C.mark(); C.paintProps(); if (typeof renderTimeline === "function") renderTimeline();
      return true;
    }
    function r2(v) { return Math.round(v * 100) / 100; }
    function r4(v) { return Math.round(Math.max(0.01, Math.min(20, v)) * 10000) / 10000; }
    function localDelta(c, dx, dy) { var P = parentOf(c); return P ? deltaIn(world(P, C.state.t), dx, dy) : [dx, dy]; }
    function labelOf(x) { return (x.L.name || x.lk.toUpperCase()) + (x.c.nul ? " (null)" : x.c.text ? " · " + String(x.c.text.content || "").slice(0, 16) : ""); }
    /** ＋ Null: an empty control layer at the picture's centre, as long as the timeline (at least 5 s) */
    function addNull() {
      var len = 5; try { (tl.video || []).forEach(function (v) { len = Math.max(len, (v.start || 0) + (typeof effDur === "function" ? effDur(v) : 5)); }); } catch (e) { /* fine */ }
      var c = { name: "", nul: true, start: 0, len: Math.round(len * 100) / 100, opacity: 1, tf: { x: 0, y: 0, scale: 1, rot: 0 } }; uid(c);
      var n = all().filter(function (x) { return x.c.nul; }).length + 1;
      C.newLayer("image", c, "Null " + n);
      say("Null " + n + ": key it, then parent layers to it (⛓ Parent)");
      return c;
    }
    C.onProps(function (P, c, sel) {
      if (!sel || !sel.Ly || sel.Ly.kind === "v1" || sel.Ly.kind === "aud" || !P) return;
      var me = all().filter(function (x) { return x.c === c; })[0]; if (!me) return;
      var cand = all().filter(function (x) { return x.c !== c && !wouldLoop(parentOf, c, x.c) && !x.c.adjust; });
      var d = document.createElement("div"); d.className = "tlp-parent";
      d.innerHTML = '<div class="tlp-row"><span title="Follow another layer: move, turn and scale with it">⛓ Parent</span>'
        + '<select id="tlpParent" style="flex:1"><option value="">none</option>' + cand.map(function (x) { return '<option value="' + esc(uid(x.c)) + '"' + (c.parent === x.c.uid ? " selected" : "") + ">" + esc(labelOf(x)) + "</option>"; }).join("") + "</select>"
        + '<button class="ghost" id="tlpNull" title="A null object: an empty layer to key and parent others to">＋ Null</button></div>';
      P.appendChild(d);
      var s = document.getElementById("tlpParent");
      if (s) s.addEventListener("change", function () { setParent(c, s.value ? byUid(s.value) : null); });
      document.getElementById("tlpNull").addEventListener("click", function () { addNull(); });
    });
    // the nulls on the canvas: a dashed square and a cross (never in the picture or the compile)
    C.onDraw(function (ctx, o) {
      var t = C.state.t;
      all().forEach(function (x) {
        if (!x.c.nul || !C.at(x.c, x.kind, t) || x.L.visible === false) return;
        var b = C.box(x.c, x.kind, t); if (!b) return;
        var a = b.rot * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a), pts = [[-50, -50], [50, -50], [50, 50], [-50, 50]].map(function (p) { var q = [p[0] * b.w / 100, p[1] * b.h / 100]; return o.toScreen(b.cx + q[0] * cs - q[1] * sn, b.cy + q[0] * sn + q[1] * cs); });
        ctx.save(); ctx.setLineDash([5, 4]); ctx.strokeStyle = "rgba(255,90,90,.95)"; ctx.lineWidth = 1.5; ctx.beginPath();
        pts.forEach(function (p, i) { if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); }); ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
        var cc = o.toScreen(b.cx, b.cy); ctx.beginPath(); ctx.moveTo(cc.x - 6, cc.y); ctx.lineTo(cc.x + 6, cc.y); ctx.moveTo(cc.x, cc.y - 6); ctx.lineTo(cc.x, cc.y + 6); ctx.stroke();
        ctx.fillStyle = "rgba(255,90,90,.95)"; ctx.font = "11px sans-serif"; ctx.fillText(x.L.name || "Null", pts[0].x + 3, pts[0].y - 4);
        ctx.restore();
      });
    });

    /* ---------------- the bake: what the compile overlays for a parented layer ---------------- */
    function sigOf(x) {
      var chain = [], p = x.c, n = 0;
      while (p && n++ < 33) { chain.push({ rays: p.rays || null, warp: p.warp || null, d3: p.d3 || null, gen: p.gen || null, dist: p.dist || null, tm: p.tm || null, pin: p.pin || null, masks: p.masks || null, expr: p.expr || null, tf: p.tf || null, kf: p.kf || null, start: p.start, len: p.len, text: p.text || null, name: p.name, op: p.opacity, fx: p.fx || null, shape: p.shape || null }); p = parentOf(p); }
      var scene = window.Tl3D && Tl3D.sceneSig ? Tl3D.sceneSig(x.c) : null;   // 2.510.0: a 3D card hangs on the camera / light / other cards
      return JSON.stringify(scene ? [chain, x.L.opacity, C.state.W, C.state.H, scene] : [chain, x.L.opacity, C.state.W, C.state.H]);
    }
    function bake(x, onProgress) {
      var c = x.c, fps = FPS, len = Math.max(0.05, C.clipLen(c, x.kind)), n = Math.max(1, Math.round(len * fps)), id = uid(c);
      var cv = document.createElement("canvas"); cv.width = C.state.W; cv.height = C.state.H; var g = cv.getContext("2d");
      var Ly = { L: x.L, kind: x.kind, lk: x.lk };
      var frameBlob = function (i) {
        var t = (c.start || 0) + Math.min(len - 1e-4, i / fps);
        g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = "source-over"; g.clearRect(0, 0, cv.width, cv.height);
        var X = window.H3TextFx && H3TextFx.setSharp ? H3TextFx : null;   // 2.607.0: a text preset baked SHARP (never the quick picture)
        if (X) X.setSharp(true);
        try { C.drawClip(g, c, Ly, t); } finally { if (X) X.setSharp(false); }
        return new Promise(function (ok) { cv.toBlob(ok, "image/png"); });
      };
      var send = function (i) {
        return frameBlob(i).then(function (blob) { return fetch("/api/tlbake/frame?id=" + encodeURIComponent(id) + "&i=" + i, { method: "POST", headers: { "Content-Type": "image/png" }, body: blob }); })
          .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || r.status); }); });
      };
      var i = 0;
      var step = function () { if (i >= n) return Promise.resolve(); var k = i++; return send(k).then(function () { if (onProgress) onProgress(i, n); return step(); }); };
      var pre = window.H3TextFx && H3TextFx.load ? Promise.resolve(H3TextFx.load()).catch(function () { /* plain then */ }) : Promise.resolve();
      return pre.then(step).then(function () {
        return fetch("/api/tlbake/encode", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: id, fps: fps, frames: n }) })
          .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || r.status); return j; }); });
      }).then(function (j) { c.bake = j.name; c.bakeSig = sigOf(x); if (typeof tlSave === "function") tlSave(); return j; });
    }
    /** before ⚙ Compile: every parented picture / text layer baked (unless it is unchanged since its last bake) */
    function bakeAll() {
      // 2.492.0: shape layers (tlshape.js) are baked the same way
      // 2.493.0: + text layers with text animators (tltextanim.js)
      var anim = function (c) { return !!(window.TlTextAnim && TlTextAnim.live(c)); };
      // 2.498.0: + picture / text layers with ✒ masks (tlmask.js)
      var masked = function (c) { return !!((window.TlMask && TlMask.live && TlMask.live(c)) || (c.pin && c.pin.on !== false) || (window.TlTime && TlTime.on && TlTime.on(c))
        || (window.TlGen && TlGen.live && TlGen.live(c)) || (window.TlDist && TlDist.live && TlDist.live(c)) || (window.TlRays && TlRays.live && TlRays.live(c)) || (window.TlWarp && TlWarp.live && TlWarp.live(c)) || (window.Tl3D && Tl3D.live && Tl3D.live(c))
        || (window.TlVBake && TlVBake.needs && TlVBake.needs(c))); };   // 2.506.0: + ☀ rays and whatever needs the page (warp, 3D ...)   // 2.499.0: + ▢ corner pin; 2.500.0: + ⏱ time; 2.505.0: + 🌫 generators, 〰 distortions
      var todo = all().filter(function (x) { return x.kind === "img" && (x.c.parent || x.c.shape || anim(x.c) || masked(x.c)) && !x.c.nul && !x.c.adjust && x.L.visible !== false; });
      all().forEach(function (x) { if (!x.c.parent && !x.c.shape && !anim(x.c) && !masked(x.c) && x.c.bake) { delete x.c.bake; delete x.c.bakeSig; } });
      var run = Promise.resolve();
      todo.forEach(function (x) {
        if (x.c.bake && x.c.bakeSig === sigOf(x)) return;
        run = run.then(function () { say("⛓ baking " + (x.L.name || "a parented layer") + "…"); return bake(x, function (k, n) { if (k % 12 === 0) say("⛓ baking " + (x.L.name || "") + " " + k + " / " + n); }); });
      });
      return run.then(function () { if (todo.length) say("⛓ " + todo.length + " parented layer(s) ready for the compile"); });
    }
    /** 2.495.0: a clip's WORLD transform as keys for the compile (a video layer following a parent): {tf, kf} - its own
     *  opacity / colour / anchor keys kept, position / scale / rotation sampled each frame and thinned */
    function worldKeys(c, kind) {
      var len = Math.max(0.05, C.clipLen(c, kind || "vl")), n = Math.max(1, Math.round(len * FPS)), sm = [];
      // 2.497.0: an opacity expression is sampled too (TlExpr)
      var opx = !!(c.expr && c.expr.op && window.TlExpr && TlExpr.num), o0 = c.opacity == null ? 1 : +c.opacity;
      for (var i = 0; i <= n; i++) { var tau = Math.min(len, i / FPS), w = world(c, (c.start || 0) + tau), q = { at: tau, x: w.x, y: w.y, scale: w.scale, rot: w.rot }; if (opx) q.op = Math.max(0, Math.min(1, TlExpr.num(c, "op", tau, KF.value(c.kf, tau, "op", o0)))); sm.push(q); }
      var MOVE = ["x", "y", "scale", "rot", "to", "ti"].concat(opx ? ["op"] : []), own = [];
      (c.kf || []).forEach(function (k) { var o = {}, any = false; for (var p in k) if (MOVE.indexOf(p) < 0) { o[p] = k[p]; if (p !== "at" && p !== "ease" && p !== "bz") any = true; } if (any) own.push(o); });
      var keys = keysOf(sm, { xy: 0.25, scale: 0.0005, rot: 0.05 }, Math.max(20, 390 - own.length)), w0 = sm[0];
      var tf = Object.assign({}, c.tf || {}, { x: r2(w0.x), y: r2(w0.y), scale: r4(w0.scale), rot: r2(w0.rot) });
      return { tf: tf, kf: own.concat(keys).sort(function (a, b) { return a.at - b.at; }) };
    }
    window.TlParent = { keysOf: keysOf, simplify: simplify, world: world, worldKeys: worldKeys, setParent: setParent, parentOf: parentOf, addNull: addNull, localDelta: localDelta, bake: bake, bakeAll: bakeAll, all: all, compose: compose, localOf: localOf, deltaIn: deltaIn, wouldLoop: wouldLoop, sigOf: sigOf };
  }
})(typeof window !== "undefined" ? window : globalThis);
