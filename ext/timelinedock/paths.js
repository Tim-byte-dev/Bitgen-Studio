/* bitGen Studio — PATH LAYERS (2.387.0), window.TlPaths.
 *
 * Tim (verbatim): "is it possible for making a generated character, vehicle or animal to follow a path that we draw?"
 * then "can we add a paths layer , then generate parts of the scene on each path layer so animals, cars, people can be
 * rendered separately have transparent backgrounds and compose the scene" - asked: per layer "Along the path (Wan ATI)"
 * or "In place + follow path" ("Both, chosen per layer"), and "Green screen + AI matte".
 *
 * A path layer is a video layer with a `path`: {pts: [[x, y] picture px], start, dur, subject: {prompt, kind, mode,
 * orient, size, sizeEnd, ease, matte, model, picStyle, vidStyle, seed}, gen: {...}}.
 *   ＋ Path layer (the timeline bar) / ⤳ Path tool (Shift+P) click the canvas to lay points, drag a point to move it,
 *                                                        Alt-click a point to remove it; the curve runs through them
 *   the panel (in 🧰 Tools & Properties, a path layer selected)   what follows it, how it is made, when, how big, facing
 *   ✨ Generate
 *     In place + follow path   1. a picture of the subject on a green screen (the image style), side on (or from
 *                              above when it turns with the path)  2. a video of it walking / driving ON THE SPOT
 *                              (the video style, the picture as its first frame)  3. the green taken away (AI matte /
 *                              chroma key, lib/matte.js) - and its mirror  4. the layer's clips: the cut-out moved
 *                              along the path with ◆ keyframes (position, size from start to end), facing the way it
 *                              goes (the mirror where the path turns back, or turned with the path), looped if the
 *                              path is longer than the video
 *     Along the path (Wan ATI) 1. the same picture  2. the subject placed at the path's start on a green frame, the
 *                              path (as the video's pixels, 121 points in time) -> Wan 2.1 ATI (routes/pathGen.js):
 *                              the model makes it travel the path itself  3. the green taken away  4. one full-frame
 *                              clip on the layer
 *   ⟲ Place again   the clips rebuilt from the path as it is now (no new render) - move points, change the sizes
 * Every layer is its own see-through video, so the scene is composed of them (and the compile reads their alpha).
 */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  function ready() { try { return !!(window.TlCanvas && typeof tl === "object" && tl && TlCanvas.addTool && TlCanvas.onDraw); } catch (e) { return false; } }
  function boot() { if (!$("tlCanvas")) return; if (!ready()) { setTimeout(boot, 60); return; } start(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();

  function num(v, d) { var n = Number(v); return Number.isFinite(n) ? n : d; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  var GREEN = [0, 177, 64];
  var KINDS = { animal: ["animal", "walking"], person: ["person", "walking"], vehicle: ["vehicle", "driving, its wheels turning"], other: ["subject", "moving"] };

  /* ------------------------------------------------------------------ the path's geometry (pure) */
  /* a Catmull-Rom curve through the points, as a dense polyline with its length so far */
  function sample(pts, per) {
    per = per || 16;
    var P = (pts || []).map(function (p) { return [num(p[0], 0), num(p[1], 0)]; });
    if (P.length < 2) return { pts: P, len: [0], total: 0 };
    var out = [P[0]];
    for (var i = 0; i < P.length - 1; i++) {
      var p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
      for (var k = 1; k <= per; k++) {
        var t = k / per, t2 = t * t, t3 = t2 * t;
        out.push([0, 1].map(function (j) {
          return 0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3);
        }));
      }
    }
    var len = [0];
    for (var m = 1; m < out.length; m++) len.push(len[m - 1] + Math.hypot(out[m][0] - out[m - 1][0], out[m][1] - out[m - 1][1]));
    return { pts: out, len: len, total: len[len.length - 1] };
  }
  function ease(f, how) {
    f = clamp(f, 0, 1);
    return how === "inout" ? f * f * (3 - 2 * f) : how === "in" ? f * f : how === "out" ? 1 - (1 - f) * (1 - f) : f;
  }
  /* where on the path at fraction f of the TIME (eased): {x, y, dx, dy, angle} */
  function at(S, f, how) {
    if (!S.pts.length) return { x: 0, y: 0, dx: 1, dy: 0, angle: 0 };
    if (S.pts.length === 1 || S.total <= 0) return { x: S.pts[0][0], y: S.pts[0][1], dx: 1, dy: 0, angle: 0 };
    var d = ease(f, how) * S.total, lo = 0, hi = S.len.length - 1;
    while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (S.len[mid] < d) lo = mid; else hi = mid; }
    var seg = Math.max(1e-9, S.len[hi] - S.len[lo]), t = clamp((d - S.len[lo]) / seg, 0, 1);
    var a = S.pts[lo], b = S.pts[hi];
    var dx = b[0] - a[0], dy = b[1] - a[1];
    return { x: a[0] + dx * t, y: a[1] + dy * t, dx: dx, dy: dy, angle: Math.atan2(dy, dx) * 180 / Math.PI };
  }
  /* the subject's height (picture px) at fraction f: start size -> end size (% of the picture's height) */
  function sizeAt(P, f, H) { var s = P.subject || {}; return (num(s.size, 30) + (num(s.sizeEnd, num(s.size, 30)) - num(s.size, 30)) * clamp(f, 0, 1)) / 100 * H; }
  /* The clips of an IN-PLACE subject (gen = the matte's result) moved along the path: the mirror where it goes left
     (orient flip) or turned with the path (rotate), looped every gen.dur, ◆ keyframes every 1/8 s. Pure. */
  function placeClips(P, gen, W, H) {
    var s = P.subject || {}, T = Math.max(0.2, num(P.dur, 5)), D = Math.max(0.2, num(gen.dur, 5));
    var S = sample(P.pts), how = s.ease || "linear", orient = s.orient || "flip";
    var step = 1 / 8, times = [];      // a ◆ every 3 frames: smooth on a curve, few enough to read on the clip
    for (var t = 0; t < T - 1e-6; t += step) times.push(Math.round(t * 1e4) / 1e4);
    times.push(T);
    // facing at each sample: left / right with a little hysteresis (a wobble in the path must not flip it back and forth)
    var left = false, faces = times.map(function (tt, i) {
      var p = at(S, tt / T, how);
      if (orient === "flip") {
        if (p.dx < -0.35 * Math.abs(p.dy) - 0.5) left = true;
        else if (p.dx > 0.35 * Math.abs(p.dy) + 0.5) left = false;
        if (i === 0) left = p.dx < 0;
      }
      return left;
    });
    // segments: where the facing changes or the video loops
    var cuts = [0];
    for (var i = 1; i < times.length; i++) if (faces[i] !== faces[i - 1]) cuts.push(times[i]);
    for (var k = D; k < T - 1e-6; k += D) cuts.push(Math.round(k * 1e4) / 1e4);
    cuts.push(T);
    cuts = cuts.filter(function (v, j, a) { return a.indexOf(v) === j; }).sort(function (a, b) { return a - b; });
    var bb = gen.bbox || { x: 0, y: 0, w: gen.w, h: gen.h }, hh = Math.max(1, num(gen.height, bb.h));
    var clips = [];
    for (var c = 0; c < cuts.length - 1; c++) {
      var t0 = cuts[c], t1 = cuts[c + 1];
      if (t1 - t0 < 1e-3) continue;
      var mid = (t0 + t1) / 2, fl = faces[Math.min(faces.length - 1, Math.round(mid / step))];
      var src0 = t0 % D; if (D - src0 < 1e-3) src0 = 0;
      var kf = [];
      var put = function (tt) {
        var f = tt / T, p = at(S, f, how), sc = sizeAt(P, f, H) / hh;
        var ax = bb.x + bb.w / 2, ay = orient === "rotate" ? bb.y + bb.h / 2 : bb.y + bb.h;
        if (fl) ax = gen.w - ax;
        var rot = orient === "rotate" ? Math.round(p.angle * 10) / 10 : 0;
        var ox = (ax - gen.w / 2) * sc, oy = (ay - gen.h / 2) * sc;
        if (rot) { var r = rot * Math.PI / 180, cs = Math.cos(r), sn = Math.sin(r); var rx = ox * cs - oy * sn, ry = ox * sn + oy * cs; ox = rx; oy = ry; }
        kf.push({ at: Math.round((tt - t0) * 1e4) / 1e4, x: Math.round((p.x - W / 2 - ox) * 10) / 10, y: Math.round((p.y - H / 2 - oy) * 10) / 10,
                  scale: Math.round(sc * 1e4) / 1e4, rot: rot });
      };
      for (var q = 0; q < times.length; q++) if (times[q] >= t0 - 1e-6 && times[q] <= t1 + 1e-6) put(times[q]);
      if (!kf.length || kf[kf.length - 1].at < t1 - t0 - 1e-3) put(t1);
      if (kf[0].at > 1e-3) { var k0 = kf.slice(); kf = []; put(t0); kf = kf.concat(k0); }
      var first = kf[0];
      clips.push({ name: fl ? gen.left : gen.name, src: "video", start: Math.round((num(P.start, 0) + t0) * 1e4) / 1e4,
                   in: Math.round(src0 * 1e4) / 1e4, out: Math.round((src0 + t1 - t0) * 1e4) / 1e4, dur: D, opacity: 1,
                   tf: { x: first.x, y: first.y, scale: first.scale, rot: first.rot }, kf: kf, pathClip: true });
    }
    return clips;
  }
  /* Wan ATI's tracks: where the subject's middle is at 121 even times, in the video's pixels (gw x gh) */
  function atiTrack(P, W, H, gw, gh, n) {
    n = n || 121;
    var S = sample(P.pts), how = (P.subject || {}).ease || "linear", out = [];
    for (var i = 0; i < n; i++) {
      var f = i / (n - 1), p = at(S, f, how), hs = sizeAt(P, f, H);
      out.push({ x: Math.round(p.x * gw / W * 100) / 100, y: Math.round((p.y - hs / 2) * gh / H * 100) / 100 });
    }
    return out;
  }
  function prompts(P) {
    var s = P.subject || {}, k = KINDS[s.kind] || KINDS.other, what = String(s.prompt || "").trim();
    var top = s.orient === "rotate";
    var view = top ? "seen from directly above (a top-down view), facing right" : "side view, facing right";
    var still = what + ", the whole " + k[0] + " in view, " + view + ", centred, isolated on a plain flat solid chroma-key green background (#00B140), "
      + "even studio lighting, no shadow, no ground, no scenery, no text";
    var inplace = what + ", " + k[1] + " in place, " + view + ", the camera tracks with it so it stays in the centre of the frame, "
      + "a plain solid chroma-key green background that never changes, no shadow, no scenery";
    var ati = what + ", " + k[1] + " along its path, a plain solid chroma-key green background, static camera, no shadow, no scenery";
    return { still: still, inplace: inplace, ati: ati };
  }

  function start() {
    var C = window.TlCanvas, S = C.state;
    var CSS = ""
      + "#tlPathPanel{border-top:1px solid var(--line);padding:6px 8px;font-size:.72rem;overflow:auto;flex:0 1 auto;max-height:60%}"
      + "#tlPathPanel.off{display:none}"
      + "#tlPathPanel .tlp-t{font-size:.66rem;letter-spacing:.1em;text-transform:uppercase;color:var(--dim);margin-bottom:4px}"
      + "#tlPathPanel .tlp-row{display:flex;gap:6px;align-items:center;margin-top:4px;flex-wrap:wrap}"
      + "#tlPathPanel label{display:flex;gap:3px;align-items:center;white-space:nowrap}"
      + "#tlPathPanel input,#tlPathPanel select,#tlPathPanel textarea{font-size:.72rem;padding:2px 4px;min-width:0}"
      + "#tlPathPanel textarea{width:100%;min-height:44px;resize:vertical;font-family:var(--body)}"
      + "#tlPathPanel select{max-width:150px}"
      + "#tlPathPanel .pp-go{border-color:var(--tiger);color:var(--tiger)}"
      + "#tlPathPanel .pp-st{color:var(--dim);margin-top:4px;line-height:1.35}"
      + "#tlPathPanel .pp-bar{height:4px;background:var(--line);border-radius:2px;overflow:hidden;margin-top:3px}"
      + "#tlPathPanel .pp-bar i{display:block;height:100%;background:var(--tiger);width:0}";
    if (!$("tlPathCss")) { var st = document.createElement("style"); st.id = "tlPathCss"; st.textContent = CSS; document.head.appendChild(st); }

    function lkOf(L) { var i = tl.vlayers.indexOf(L); return i >= 0 ? "vl:" + i : null; }
    function selPath() {
      var lk = tl.selLayer;
      if (typeof lk === "string" && lk.indexOf("vl:") === 0) {
        var L = tl.vlayers[+lk.slice(3)];
        if (L && L.path) return L;
      }
      var s = C.selClip && C.selClip();
      return s && s.Ly && s.Ly.L && s.Ly.L.path ? s.Ly.L : null;
    }
    function defaults() {
      return { pts: [], start: Math.round(num(S.t, 0) * 24) / 24, dur: 5,
               subject: { prompt: "", kind: "animal", mode: "inplace", orient: "flip", size: 30, sizeEnd: 30, ease: "inout",
                          matte: "auto", model: "birefnet-general", picStyle: "", vidStyle: "", seed: -1 } };
    }
    function save() { if (typeof tlSave === "function") tlSave(); }
    function newPathLayer() {
      var n = tl.vlayers.filter(function (L) { return L.path; }).length + 1;
      var L = mkLayer("Path " + n, []);
      L.path = defaults();
      tl.vlayers.push(L);
      if (typeof tlKaraokeOnTop === "function") tlKaraokeOnTop();
      tl.selLayer = lkOf(L);
      try { tlSelClip = null; } catch (e) { /* fine */ }
      save();
      if (typeof renderTimeline === "function") renderTimeline();
      if (C.paintLayers) C.paintLayers();
      C.setTool("path");
      paint(); C.mark();
      if (typeof logLine === "function") logLine("[canvas] ⤳ new path layer " + L.name + " - click the canvas to lay its path");
      return L;
    }

    /* ---- ⤳ the Path tool */
    var drag = null;
    function near(L, p) {
      var z = S.view.z || 1, pts = L.path.pts;
      for (var i = pts.length - 1; i >= 0; i--) if (Math.hypot(pts[i][0] - p.x, pts[i][1] - p.y) * z <= 8) return i;
      return -1;
    }
    C.addTool({ id: "path", icon: "⤳", title: "Path - click to lay a path's points, drag one to move it, Alt-click one to remove it", key: "shift+p", cursor: "crosshair",   // 2.389.0: P alone toggles the prompt docker (ext/promptdock/pfloat.js)
      down: function (p, ev) {
        var L = selPath() || newPathLayer();
        var i = near(L, p);
        if (i >= 0 && ev.altKey) { L.path.pts.splice(i, 1); drag = null; changed(L); return; }
        if (i >= 0) { drag = { L: L, i: i }; return; }
        L.path.pts.push([Math.round(p.x), Math.round(p.y)]);
        drag = { L: L, i: L.path.pts.length - 1 };
        changed(L);
      },
      move: function (p) {
        if (!drag) return;
        drag.L.path.pts[drag.i] = [Math.round(clamp(p.x, -S.W, 2 * S.W)), Math.round(clamp(p.y, -S.H, 2 * S.H))];
      },
      up: function () { if (drag) changed(drag.L); drag = null; }
    });
    function changed(L) {
      save();
      if (typeof renderTimeline === "function") renderTimeline();
      C.mark(); paint();
      if (L.path.gen && L.path.subject.mode !== "ati" && L.clips.some(function (c) { return c.pathClip; })) autoPlace(L);
    }
    var placeT = null;
    function autoPlace(L) { clearTimeout(placeT); placeT = setTimeout(function () { place(L); }, 250); }

    /* ---- drawing the paths */
    C.onDraw(function (ctx) {
      var sel = selPath(), show = S.tool === "path";
      tl.vlayers.forEach(function (L) {
        if (!L.path || (L !== sel && !show) || L.visible === false) return;
        var P = L.path, Sm = sample(P.pts), on = L === sel;
        if (!P.pts.length) return;
        ctx.save();
        ctx.lineWidth = on ? 2.5 : 1.5; ctx.strokeStyle = on ? "#f59e2c" : "rgba(245,158,44,.45)";
        if (!on) ctx.setLineDash([6, 5]);
        ctx.beginPath();
        Sm.pts.forEach(function (q, i) { var s = C.toScreen(q[0], q[1]); if (i) ctx.lineTo(s.x, s.y); else ctx.moveTo(s.x, s.y); });
        ctx.stroke(); ctx.setLineDash([]);
        if (on) {
          P.pts.forEach(function (q, i) {
            var s = C.toScreen(q[0], q[1]);
            ctx.fillStyle = i === 0 ? "#62d26f" : i === P.pts.length - 1 ? "#ff5a52" : "#f5d36b";
            ctx.beginPath(); ctx.arc(s.x, s.y, i === 0 || i === P.pts.length - 1 ? 6 : 4.5, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = "#14120f"; ctx.lineWidth = 1; ctx.stroke();
          });
          // where the subject is at the position marker, and how big
          var t = (S.t - num(P.start, 0)) / Math.max(0.2, num(P.dur, 5));
          if (t >= 0 && t <= 1 && Sm.pts.length > 1) {
            var a = at(Sm, t, (P.subject || {}).ease), hs = sizeAt(P, t, S.H), z = S.view.z || 1, s2 = C.toScreen(a.x, a.y);
            ctx.strokeStyle = "rgba(255,255,255,.8)"; ctx.setLineDash([3, 3]); ctx.lineWidth = 1;
            ctx.strokeRect(s2.x - hs * 0.35 * z, s2.y - hs * z, hs * 0.7 * z, hs * z); ctx.setLineDash([]);
            ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(s2.x, s2.y, 3.5, 0, Math.PI * 2); ctx.fill();
          }
          if (Sm.pts.length > 1) {      // the way it goes
            var e1 = Sm.pts[Sm.pts.length - 1], e0 = Sm.pts[Math.max(0, Sm.pts.length - 4)];
            var se = C.toScreen(e1[0], e1[1]), ang = Math.atan2(e1[1] - e0[1], e1[0] - e0[0]);
            ctx.fillStyle = "#f59e2c"; ctx.beginPath();
            ctx.moveTo(se.x + 12 * Math.cos(ang), se.y + 12 * Math.sin(ang));
            ctx.lineTo(se.x + 7 * Math.cos(ang + 2.5), se.y + 7 * Math.sin(ang + 2.5));
            ctx.lineTo(se.x + 7 * Math.cos(ang - 2.5), se.y + 7 * Math.sin(ang - 2.5)); ctx.fill();
          }
        }
        ctx.restore();
      });
      var L2 = selPath();
      if (L2 !== lastSel) { lastSel = L2; paint(); }
    });
    var lastSel = null;

    /* ---- ＋ Path layer in the timeline's bar */
    var bar = $("tlbar");
    if (bar && !$("tlAddPath")) {
      var b = document.createElement("button");
      b.className = "ghost"; b.id = "tlAddPath"; b.type = "button"; b.textContent = "＋ Path layer";
      b.title = "A path layer: draw a path on the canvas (Shift+P), say what follows it, ✨ Generate - it is rendered on its own, see-through";
      b.addEventListener("click", newPathLayer);
      var after = $("tlAddImgTrack");
      if (after && after.parentNode === bar) bar.insertBefore(b, after.nextSibling); else bar.appendChild(b);
    }

    /* ---- the panel */
    var panel = document.createElement("div");
    panel.id = "tlPathPanel"; panel.className = "off";
    function mountPanel() {
      var host = (window.TlFloat && TlFloat.el) || ($("tlProps") && $("tlProps").parentNode);
      if (host && panel.parentNode !== host) host.appendChild(panel);
    }
    mountPanel();
    setTimeout(mountPanel, 1500);
    var styles = { image: [], video: [] };
    function loadStyles() {
      return fetch("/api/styles").then(function (r) { return r.json(); }).then(function (j) {
        var all = (j && j.styles) || [];
        styles.image = all.filter(function (s) { return s.kind === "image" || !s.kind; });
        styles.video = all.filter(function (s) { return s.kind === "video"; });
        paint();
      }).catch(function () { /* the panel says so */ });
    }
    loadStyles();
    var busy = {};
    var matteInfo = null;
    function matteStatus() {
      return fetch("/api/pathgen/matte").then(function (r) { return r.json(); }).then(function (j) { matteInfo = j; return j; }).catch(function () { return matteInfo; });
    }
    matteStatus().then(function () { paint(); });

    function opts(list, sel, filter, none) {
      var l = filter ? list.filter(filter) : list;
      return (none ? '<option value="">' + none + "</option>" : "") + l.map(function (s) {
        return '<option value="' + esc(s.id) + '"' + (s.id === sel ? " selected" : "") + ">" + esc(s.name || s.id) + (s.arch ? " · " + esc(s.arch) : "") + "</option>";
      }).join("");
    }
    function paint() {
      mountPanel();
      var L = selPath();
      panel.classList.toggle("off", !L);
      if (!L) return;
      if (panel.contains(document.activeElement) && panel._for === L) { paintState(L); return; }
      panel._for = L;
      var P = L.path, s = P.subject;
      var dflImg = s.picStyle || ($("styleSel") && $("styleSel").value) || "", dflVid = s.vidStyle || ($("videoStyleSel") && $("videoStyleSel").value) || "";
      var ati = s.mode === "ati";
      var mi = matteInfo || {};
      panel.innerHTML = '<div class="tlp-t">⤳ Path layer · ' + esc(L.name || "") + " · " + P.pts.length + " point(s)</div>"
        + '<textarea id="ppPrompt" placeholder="What follows the path - e.g. a golden retriever, a red vintage car, a woman in a yellow raincoat">' + esc(s.prompt) + "</textarea>"
        + '<div class="tlp-row"><label>Is <select id="ppKind">' + Object.keys(KINDS).map(function (k) { return '<option value="' + k + '"' + (s.kind === k ? " selected" : "") + ">" + (k === "person" ? "a person" : k === "animal" ? "an animal" : k === "vehicle" ? "a vehicle" : "something else") + "</option>"; }).join("") + "</select></label>"
        + '<label title="In place + follow path: any video model, it walks / drives on the spot and the layer moves along the path. Along the path (Wan ATI): the model makes it travel the path itself (a Wan 2.1 style + the ATI model)">Make <select id="ppMode">'
        + '<option value="inplace"' + (ati ? "" : " selected") + ">In place + follow path</option><option value=\"ati\"" + (ati ? " selected" : "") + ">Along the path (Wan ATI)</option></select></label></div>"
        + '<div class="tlp-row"><label>Start <input type="number" id="ppStart" step="0.1" min="0" value="' + num(P.start, 0).toFixed(2) + '" style="width:62px">s</label>'
        + '<label>Length <input type="number" id="ppDur" step="0.1" min="0.5" max="120" value="' + num(P.dur, 5).toFixed(2) + '" style="width:62px">s</label></div>'
        + '<div class="tlp-row"><label title="Its height at the path\'s start, % of the picture\'s height">Size <input type="number" id="ppSize" min="2" max="200" step="1" value="' + num(s.size, 30) + '" style="width:52px">%</label>'
        + '<label title="Its height at the path\'s end (further away = smaller)">→ <input type="number" id="ppSizeEnd" min="2" max="200" step="1" value="' + num(s.sizeEnd, 30) + '" style="width:52px">%</label>'
        + '<label>Pace <select id="ppEase"><option value="linear"' + (s.ease === "linear" ? " selected" : "") + '>steady</option><option value="inout"' + (s.ease === "inout" ? " selected" : "") + '>ease in + out</option>'
        + '<option value="in"' + (s.ease === "in" ? " selected" : "") + '>speeds up</option><option value="out"' + (s.ease === "out" ? " selected" : "") + ">slows down</option></select></label></div>"
        + (ati ? "" : '<div class="tlp-row"><label title="Side view: it is mirrored where the path goes left. From above: it turns with the path">Facing <select id="ppOrient">'
          + '<option value="flip"' + (s.orient === "flip" ? " selected" : "") + '>side view (mirror going left)</option><option value="rotate"' + (s.orient === "rotate" ? " selected" : "") + '>from above (turns with the path)</option>'
          + '<option value="none"' + (s.orient === "none" ? " selected" : "") + ">as made</option></select></label></div>")
        + '<div class="tlp-row"><label>Picture <select id="ppPic">' + opts(styles.image, dflImg, null, styles.image.length ? null : "no image styles") + "</select></label></div>"
        + '<div class="tlp-row"><label>Video <select id="ppVid">' + opts(styles.video, dflVid, ati ? function (x) { return x.arch === "wan21"; } : null, ati ? "a Wan 2.1 style…" : "the prompt docker's") + "</select></label></div>"
        + '<div class="tlp-row"><label title="AI matte (BiRefNet) keeps fur, hair and soft edges; chroma key needs nothing installed">Cut out <select id="ppMatte">'
        + '<option value="auto"' + (s.matte === "auto" ? " selected" : "") + ">auto" + (mi.ai ? " (AI)" : " (chroma key)") + '</option><option value="ai"' + (s.matte === "ai" ? " selected" : "") + ">AI matte</option>"
        + '<option value="key"' + (s.matte === "key" ? " selected" : "") + ">chroma key</option></select></label>"
        + (mi.ai ? '<select id="ppModel" title="The matting model">' + (mi.models || []).map(function (m) { return "<option" + (m === s.model ? " selected" : "") + ">" + esc(m) + "</option>"; }).join("") + "</select>"
          : '<button class="ghost" id="ppInstall" title="rembg + BiRefNet in their own venv (venvs/matte, ~1.5 GB with the model)">⬇ Install AI matte</button>') + "</div>"
        + '<div class="tlp-row"><button class="ghost pp-go" id="ppGo">✨ Generate</button>'
        + '<button class="ghost" id="ppPlace" title="Rebuild the clips from the path as it is now - no new render"' + (P.gen && !ati ? "" : " disabled") + ">⟲ Place again</button>"
        + '<button class="ghost" id="ppClear" title="Remove the path\'s points">✕ Points</button>'
        + '<label title="-1 = a new one each time">Seed <input type="number" id="ppSeed" value="' + num(s.seed, -1) + '" style="width:80px"></label></div>'
        + '<div class="pp-bar"><i id="ppBar"></i></div><div class="pp-st" id="ppState"></div>';
      var on = function (id, ev, fn, rebuild) {
        var el = $(id); if (!el) return;
        el.addEventListener(ev, function () { fn(el); save(); C.mark(); if (rebuild) { if (typeof renderTimeline === "function") renderTimeline(); }
          if (P.gen && s.mode !== "ati" && L.clips.some(function (c) { return c.pathClip; })) autoPlace(L); });
      };
      on("ppPrompt", "input", function (el) { s.prompt = el.value; });
      $("ppPrompt").addEventListener("change", function () { if (typeof renderTimeline === "function") renderTimeline(); });
      on("ppKind", "change", function (el) { s.kind = el.value; });
      on("ppMode", "change", function (el) { s.mode = el.value; panel._for = null; setTimeout(paint, 0); });
      on("ppStart", "change", function (el) { P.start = Math.max(0, Math.round(num(el.value, 0) * 24) / 24); }, true);
      on("ppDur", "change", function (el) { P.dur = clamp(num(el.value, 5), 0.5, 120); }, true);
      on("ppSize", "input", function (el) { var o = s.size; s.size = clamp(num(el.value, 30), 2, 200); if (num(s.sizeEnd, o) === o) { s.sizeEnd = s.size; var e2 = $("ppSizeEnd"); if (e2) e2.value = s.size; } });
      on("ppSizeEnd", "input", function (el) { s.sizeEnd = clamp(num(el.value, 30), 2, 200); });
      on("ppEase", "change", function (el) { s.ease = el.value; });
      on("ppOrient", "change", function (el) { s.orient = el.value; });
      on("ppPic", "change", function (el) { s.picStyle = el.value; });
      on("ppVid", "change", function (el) { s.vidStyle = el.value; });
      on("ppMatte", "change", function (el) { s.matte = el.value; });
      on("ppModel", "change", function (el) { s.model = el.value; });
      on("ppSeed", "change", function (el) { s.seed = Math.round(num(el.value, -1)); });
      $("ppGo").addEventListener("click", function () { generate(L); });
      $("ppPlace").addEventListener("click", function () { place(L); });
      $("ppClear").addEventListener("click", function () { P.pts = []; changed(L); });
      var ins = $("ppInstall");
      if (ins) ins.addEventListener("click", function () {
        fetch("/api/pathgen/matte/install", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
          .then(function (r) { return r.json(); }).then(function (j) { matteInfo = j; watchInstall(); paintState(L); });
      });
      paintState(L);
    }
    function watchInstall() {
      setTimeout(function () {
        matteStatus().then(function (j) {
          var L = selPath(); if (L) paintState(L);
          if (j && j.installing && j.installing.state === "running") watchInstall();
          else { panel._for = null; paint(); }
        });
      }, 2500);
    }
    function paintState(L) {
      var el = $("ppState"), bar = $("ppBar"); if (!el) return;
      var g = busy[lkOf(L)] || null, st = L.path.status || {};
      var mi = matteInfo || {};
      var inst = mi.installing && mi.installing.state === "running" ? " · installing the AI matte: " + esc((mi.installing.log || []).slice(-1)[0] || "…") : "";
      el.innerHTML = esc(g ? g.msg : st.msg || (L.path.pts.length < 2 ? "Draw the path on the canvas with ⤳ (Shift+P): click to lay points." : "Ready - ✨ Generate.")) + inst;
      if (bar) bar.style.width = (g ? Math.round(100 * (g.pct || 0)) : st.state === "done" ? 100 : 0) + "%";
    }
    function say(L, msg, pct) {
      busy[lkOf(L)] = { msg: msg, pct: pct || 0 };
      if (selPath() === L) paintState(L);
      C.say("⤳ " + msg);
    }

    /* ---- generating */
    function j(r) { return r.json().then(function (x) { if (!r.ok) throw new Error(x.error || r.status); return x; }); }
    function waitJob(id, L, label, a, b) {
      return new Promise(function (ok, no) {
        (function poll() {
          fetch("/api/jobs/" + encodeURIComponent(id)).then(j).then(function (x) {
            if (x.status === "done") return ok(x);
            if (x.status && x.status !== "running" && x.status !== "queued") return no(new Error(label + " " + x.status + " - see the job's log"));
            var pr = x.progress || {};
            say(L, label + (pr.step && pr.total ? " · step " + pr.step + " of " + pr.total : x.status === "queued" ? " · waiting in the queue" : " …"),
                a + (b - a) * (pr.pct ? pr.pct / 100 : 0.1));
            setTimeout(poll, 1500);
          }).catch(function () { setTimeout(poll, 2500); });
        })();
      });
    }
    function outOf(x) { return (x.outputs && x.outputs[0]) || x.output || ""; }
    function imgOf(url) { return new Promise(function (ok, no) { var im = new Image(); im.onload = function () { ok(im); }; im.onerror = function () { no(new Error("could not load " + url)); }; im.src = url; }); }
    function blobOf(cv) { return new Promise(function (ok) { cv.toBlob(ok, "image/png"); }); }
    /* the subject's box in the green-screen picture (pixels that are not the screen's colour) */
    function subjectBox(im) {
      var c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight;
      var g = c.getContext("2d"); g.drawImage(im, 0, 0);
      var d = g.getImageData(0, 0, c.width, c.height).data, w = c.width, h = c.height;
      var key = [d[0], d[1], d[2]];                       // the corner is the screen
      var x0 = w, y0 = h, x1 = -1, y1 = -1;
      for (var y = 0; y < h; y += 2) for (var x = 0; x < w; x += 2) {
        var i = (y * w + x) * 4;
        if (Math.hypot(d[i] - key[0], d[i + 1] - key[1], d[i + 2] - key[2]) > 70) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
      return x1 < 0 ? { x: 0, y: 0, w: w, h: h, canvas: c } : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, canvas: c };
    }
    function genSize(kind, orient, mode) {
      if (mode === "ati") { var w = 832, h = Math.round(832 * S.H / S.W / 16) * 16; return { w: w, h: clamp(h, 256, 1408) }; }
      if (orient === "rotate") return { w: 640, h: 640 };
      return kind === "person" ? { w: 480, h: 832 } : { w: 832, h: 480 };
    }
    async function generate(L) {
      var P = L.path, s = P.subject, lk = lkOf(L);
      if (busy[lk] && busy[lk].running) return;
      if (!String(s.prompt || "").trim()) { say(L, "write what follows the path first"); $("ppPrompt") && $("ppPrompt").focus(); delete busy[lk]; return; }
      if (P.pts.length < 2) { say(L, "draw the path first: ⤳ (Shift+P), click at least two points"); delete busy[lk]; return; }
      var pic = s.picStyle || ($("ppPic") && $("ppPic").value) || ($("styleSel") && $("styleSel").value) || "";
      var vid = s.vidStyle || ($("ppVid") && $("ppVid").value) || ($("videoStyleSel") && $("videoStyleSel").value) || "";
      if (!pic) { say(L, "pick a picture style (Settings → Image)"); delete busy[lk]; return; }
      if (s.mode === "ati" && !(styles.video.filter(function (x) { return x.id === vid && x.arch === "wan21"; }).length)) {
        say(L, "Along the path needs a Wan 2.1 video style"); delete busy[lk]; return;
      }
      busy[lk] = { msg: "…", pct: 0, running: true };
      var pr = prompts(P), size = genSize(s.kind, s.orient, s.mode), seed = num(s.seed, -1);
      try {
        // 1. the subject on a green screen
        say(L, "1/4 the picture of it on a green screen", 0.02);
        var still = s.mode === "ati" ? (s.kind === "person" ? { w: 640, h: 960 } : { w: 960, h: 640 }) : size;
        var r1 = await fetch("/api/genimage", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: pr.still, style_id: pic, width: still.w, height: still.h, seed: seed }) }).then(j);
        if (typeof refreshJobs === "function") refreshJobs();
        var x1 = await waitJob(r1.id, L, "1/4 the picture", 0.02, 0.25);
        var stillName = outOf(x1);
        var im = await imgOf("/outputs/" + encodeURIComponent(stillName) + "?v=" + Date.now());
        // 2. the video
        var job2, fps = 24;
        if (s.mode === "ati") {
          say(L, "2/4 Wan ATI: it travels the path", 0.27);
          var box = subjectBox(im), start = document.createElement("canvas");
          start.width = size.w; start.height = size.h;
          var g = start.getContext("2d");
          g.fillStyle = "rgb(" + GREEN.join(",") + ")"; g.fillRect(0, 0, size.w, size.h);
          var Sm = sample(P.pts), a0 = at(Sm, 0, s.ease), hs = sizeAt(P, 0, S.H) * size.h / S.H, sc = hs / box.h;
          var fx = a0.x * size.w / S.W, fy = a0.y * size.h / S.H, dw = box.w * sc;
          g.save();
          if (a0.dx < 0) { g.translate(fx, 0); g.scale(-1, 1); g.translate(-fx, 0); }
          g.drawImage(box.canvas, box.x, box.y, box.w, box.h, fx - dw / 2, fy - hs, dw, hs);
          g.restore();
          var fd = new FormData();
          fd.append("start", await blobOf(start), "path_start.png");
          var vals = { prompt: pr.ati, seconds: Math.min(5, num(P.dur, 5)), width: size.w, height: size.h, style_id: vid, seed: seed, layer: L.name || "",
                       tracks: JSON.stringify([atiTrack(P, S.W, S.H, size.w, size.h)]) };
          Object.keys(vals).forEach(function (k) { fd.append(k, String(vals[k])); });
          job2 = await fetch("/api/pathgen/ati", { method: "POST", body: fd }).then(j);
        } else {
          say(L, "2/4 the video: it " + (KINDS[s.kind] || KINDS.other)[1].split(",")[0] + " on the spot", 0.27);
          var fd2 = new FormData();
          var first = document.createElement("canvas"); first.width = im.naturalWidth; first.height = im.naturalHeight;
          first.getContext("2d").drawImage(im, 0, 0);
          fd2.append("references", await blobOf(first), "path_still.png");
          var v2 = { mode: "fl2va", prompt: pr.inplace, width: size.w, height: size.h, frames: Math.round(Math.min(10, num(P.dur, 5)) * fps) + 1, seed: seed, format: "mp4" };
          Object.keys(v2).forEach(function (k) { fd2.append(k, String(v2[k])); });
          if (vid) fd2.append("video_style_id", vid);
          job2 = await fetch("/api/generate", { method: "POST", body: fd2 }).then(j);
        }
        if (typeof refreshJobs === "function") refreshJobs();
        var x2 = await waitJob(job2.id, L, "2/4 the video", 0.27, 0.8);
        var vidName = outOf(x2);
        // 3. the green taken away
        say(L, "3/4 cutting it out of the green screen", 0.82);
        var mid = "p" + Date.now().toString(36);
        var m0 = await fetch("/api/pathgen/matte", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: mid, output: vidName, method: s.matte || "auto", model: s.model }) }).then(j);
        var res = await new Promise(function (ok, no) {
          (function poll() {
            fetch("/api/pathgen/matte/" + encodeURIComponent(mid)).then(j).then(function (x) {
              if (x.state === "done") return ok(x.result);
              if (x.state === "error" || x.state === "none") return no(new Error("the cut-out: " + (x.error || "lost")));
              say(L, "3/4 cutting it out (" + (m0.method === "key" ? "chroma key" : "AI matte") + ") " + (x.done || 0) + "/" + (x.of || "…"), 0.82 + 0.15 * ((x.done || 0) / Math.max(1, x.of || 1)));
              setTimeout(poll, 900);
            }).catch(function () { setTimeout(poll, 2000); });
          })();
        });
        // 4. on the layer
        P.gen = { name: res.name, left: res.left, w: res.w, h: res.h, dur: res.dur, bbox: res.bbox, height: res.height, mode: s.mode,
                  still: stillName, video: vidName, method: res.method, at: Date.now() };
        place(L);
        P.status = { state: "done", msg: "✓ " + (s.mode === "ati" ? "along the path (Wan ATI)" : "in place, following the path") + " · cut out by " + (res.method === "key" ? "chroma key" : "AI matte") + " · " + res.name };
        delete busy[lk];
        save();
        if (typeof refreshAssets === "function") refreshAssets();
        if (typeof logLine === "function") logLine("[canvas] ⤳ " + (L.name || "") + ": " + res.name + " (" + res.w + "×" + res.h + ", " + num(res.dur, 0).toFixed(2) + "s, " + res.method + ")");
        C.say("");
      } catch (e) {
        P.status = { state: "error", msg: "⚠ " + String(e && e.message || e) };
        delete busy[lk];
        save();
        C.say("⤳ " + P.status.msg);
      }
      if (selPath() === L) { panel._for = null; paint(); }
    }
    /* the generated cut-out on the layer: along the path (in place) or the one full-frame clip (ATI) */
    function place(L) {
      var P = L.path, g = P.gen;
      if (!g) return;
      var keep = L.clips.filter(function (c) { return !c.pathClip; });
      var add;
      if (g.mode === "ati") {
        var sc = S.W / Math.max(1, g.w);
        add = [{ name: g.name, src: "video", start: num(P.start, 0), in: 0, out: g.dur, dur: g.dur, opacity: 1,
                 tf: { x: 0, y: 0, scale: Math.round(sc * 1e4) / 1e4, rot: 0 }, pathClip: true }];   // the whole picture
      } else {
        add = placeClips(P, g, S.W, S.H);
      }
      L.clips = keep.concat(add);
      save();
      if (typeof renderTimeline === "function") renderTimeline();
      if (C.paintLayers) C.paintLayers();
      C.mark();
    }

    document.addEventListener("keydown", function (e) {
      if (S.tool !== "path" || e.ctrlKey || e.metaKey) return;
      var a = document.activeElement;
      if (a && a !== document.body && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) return;
      if (e.key === "Escape" || e.key === "Enter") { C.setTool("move"); }
    });
    paint();
    window.TlPaths = { sample: sample, at: at, ease: ease, sizeAt: sizeAt, placeClips: placeClips, atiTrack: atiTrack, prompts: prompts,
                       newPathLayer: newPathLayer, selPath: selPath, generate: generate, place: place, paint: paint, defaults: defaults };
  }
})();
