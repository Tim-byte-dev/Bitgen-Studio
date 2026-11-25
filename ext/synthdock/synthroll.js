/* bitGen Studio — ext/synthdock/synthroll.js (2.957.0): 🎹 THE PIANO ROLL - a note clip's notes, edited (window.H3SynthRoll).
 * Tim: "go with your suggestion" (a piano roll for note clips, clip editing, undo - the Cakewalk-style list).
 * A box over the Synth tab: the keys down the left (click = hear), a grid of the clip's beats (the looper's BPM), the notes as bars.
 *   draw     click an empty place = a note one grid step long there (drag on to make it longer)
 *   a note   drag = move it (time + pitch), drag its right edge = longer / shorter, right-click or Delete = gone, ↑ / ↓ = a
 *            semitone, ← / → = a grid step; click = pick + hear it
 *   below    the velocity lane: drag a note's bar up / down
 *   bar      Grid (1/4 - 1/32), ⌗ Quantize (all the notes to the grid), ▶ hear the clip, zoom, ✕ / Esc = done
 * Pure (Node: scripts/test-957.js): noteAt(notes, t, m, tolS), clampNote(n, len)
 * open(clip, {bpm, color, changed(), play(m, v)})
 */
(function (root) {
  "use strict";
  /** the note under (t s, pitch m) - the last drawn first; tolS = how close to its end counts as its edge -> {i, edge} | null */
  function noteAt(notes, t, m, tolS) {
    for (var i = notes.length - 1; i >= 0; i--) { var n = notes[i]; if (n.m === m && t >= n.t && t <= n.t + n.d) return { i: i, edge: (n.t + n.d - t) <= (tolS || 0) }; }
    return null;
  }
  function clampNote(n, len) { n.m = Math.max(0, Math.min(127, Math.round(n.m))); n.t = Math.max(0, n.t); n.d = Math.max(0.02, n.d); if (len) n.t = Math.min(n.t, Math.max(0, len - 0.02)); return n; }
  var pure = { noteAt: noteAt, clampNote: clampNote };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  var doc = root.document, C = root.H3SynthCore;
  var KW = 46, VH = 62;
  var R = null;
  function beat() { return 60 / (R.o.bpm || 120); }
  function grid() { return beat() * R.grid; }
  function X(t) { return KW + t / beat() * R.zx - R.sx; }
  function T(x) { return Math.max(0, (x - KW + R.sx) / R.zx * beat()); }
  function Y(m) { return (R.top - m) * R.rh; }
  function pitchAt(y) { return R.top - Math.floor(y / R.rh); }
  function snap(t) { return Math.max(0, Math.round(t / grid()) * grid()); }
  function changed() { R.c.notes.sort(function (a, b) { return a.t - b.t || a.m - b.m; }); if (R.o.changed) R.o.changed(); }
  function hear(m, v) { if (R.o.play) R.o.play(m, v == null ? 0.8 : v); }
  function size(cv) {
    var w = cv.clientWidth || 800, h = cv.clientHeight || 300, dpr = Math.min(2, root.devicePixelRatio || 1);
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    var x = cv.getContext("2d"); x.setTransform(dpr, 0, 0, dpr, 0, 0); return { x: x, w: w, h: h };
  }
  function draw() {
    if (!R) return;
    var cv = doc.getElementById("syRollCv"), vc = doc.getElementById("syRollVel"); if (!cv) return;
    var g = size(cv), x = g.x, w = g.w, h = g.h, col = R.o.color || "#38e1ff", c = R.c;
    x.fillStyle = "#0b0d11"; x.fillRect(0, 0, w, h);
    for (var m = R.top; Y(m) < h; m--) {
      var yy = Y(m), blk = C.isBlack(m);
      x.fillStyle = blk ? "#0e1116" : "#151922"; x.fillRect(KW, yy, w - KW, R.rh);
      x.fillStyle = m % 12 === 0 ? "#2a303c" : "#1a1e26"; x.fillRect(KW, yy + R.rh - 1, w - KW, 1);
      // the keys
      x.fillStyle = blk ? "#1b1d22" : "#e8e6df"; x.fillRect(0, yy, KW - 2, R.rh - 1);
      if (m % 12 === 0) { x.fillStyle = "#6b7280"; x.font = "9px system-ui"; x.textAlign = "right"; x.fillText(C.noteName(m), KW - 5, yy + R.rh - 3); }
    }
    // beats + bars, the clip's end
    var b0 = Math.floor(T(KW) / beat()), b1 = Math.ceil(T(w) / beat());
    for (var b = b0; b <= b1; b++) {
      var bx = X(b * beat()); x.fillStyle = b % 4 === 0 ? "#3a4150" : "#222731"; x.fillRect(Math.round(bx), 0, 1, h);
      if (R.grid < 1 && R.zx * R.grid > 8) for (var s = 1; s < 1 / R.grid; s++) { x.fillStyle = "#161a21"; x.fillRect(Math.round(X((b + s * R.grid) * beat())), 0, 1, h); }
      if (b % 4 === 0) { x.fillStyle = "#8b95a7"; x.font = "9px ui-monospace, monospace"; x.textAlign = "left"; x.fillText(String(b / 4 + 1), bx + 3, 10); }
    }
    var ex = X(c.len); x.fillStyle = "#00000088"; x.fillRect(ex, 0, w - ex, h); x.fillStyle = col; x.fillRect(ex, 0, 2, h);
    // the notes
    c.notes.forEach(function (n, i) {
      var nx = X(n.t), nw = Math.max(3, n.d / beat() * R.zx), ny = Y(n.m);
      x.globalAlpha = 0.45 + 0.55 * n.v; x.fillStyle = col; x.fillRect(nx, ny + 1, nw - 1, R.rh - 2); x.globalAlpha = 1;
      x.strokeStyle = i === R.sel ? "#ffffff" : "#000000aa"; x.lineWidth = i === R.sel ? 2 : 1; x.strokeRect(nx + 0.5, ny + 1.5, nw - 2, R.rh - 3);
    });
    // the velocity lane
    var vg = size(vc), vx = vg.x; vx.fillStyle = "#07090c"; vx.fillRect(0, 0, vg.w, vg.h);
    vx.fillStyle = "#8b95a7"; vx.font = "9px system-ui"; vx.textAlign = "left"; vx.fillText("Velocity", 4, 12);
    c.notes.forEach(function (n, i) { var nx = X(n.t), bh = (vg.h - 6) * n.v; vx.fillStyle = i === R.sel ? "#ffffff" : col; vx.fillRect(nx, vg.h - bh, 4, bh); vx.beginPath(); vx.arc(nx + 2, vg.h - bh, 3, 0, Math.PI * 2); vx.fill(); });
    var info = doc.getElementById("syRollInfo");
    if (info) info.textContent = c.notes.length + " note" + (c.notes.length === 1 ? "" : "s") + (R.sel >= 0 && c.notes[R.sel] ? " · " + C.noteName(c.notes[R.sel].m) + " vel " + Math.round(c.notes[R.sel].v * 100) + "%" : "");
  }
  function pos(e, el) { var r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function wire() {
    var cv = doc.getElementById("syRollCv"), vc = doc.getElementById("syRollVel"), box = doc.getElementById("syRoll");
    cv.addEventListener("pointerdown", function (e) {
      var p = pos(e, cv), c = R.c; e.preventDefault(); box.focus({ preventScroll: true });
      var m = pitchAt(p.y);
      if (p.x < KW) { hear(m); return; }
      var t = T(p.x), hitN = noteAt(c.notes, t, m, 6 / R.zx * beat());
      if (e.button === 2) { if (hitN) { c.notes.splice(hitN.i, 1); R.sel = -1; changed(); draw(); } return; }
      try { cv.setPointerCapture(e.pointerId); } catch (er) { /* fine */ }
      if (hitN) {
        R.sel = hitN.i; var n = c.notes[hitN.i]; hear(n.m, n.v);
        R.drag = hitN.edge ? { kind: "len", n: n } : { kind: "move", n: n, dt: t - n.t, m0: n.m };
      } else {
        var nn = clampNote({ m: m, t: snap(t - grid() / 2 + 1e-9), d: grid(), v: 0.8 }, c.len);
        c.notes.push(nn); R.sel = c.notes.length - 1; hear(nn.m); R.drag = { kind: "len", n: nn, fresh: true };
      }
      draw();
    });
    cv.addEventListener("pointermove", function (e) {
      if (!R || !R.drag) return; var p = pos(e, cv), d = R.drag, n = d.n, t = T(p.x);
      if (d.kind === "len") n.d = Math.max(grid() / 4, (e.shiftKey ? t : snap(t + grid() / 2) ) - n.t);
      else { n.t = Math.max(0, e.shiftKey ? t - d.dt : snap(t - d.dt)); var nm = pitchAt(p.y); if (nm !== n.m) { n.m = Math.max(0, Math.min(127, nm)); hear(n.m, n.v); } }
      draw();
    });
    var up = function () { if (R && R.drag) { R.drag = null; R.sel = R.c.notes.indexOf(R.c.notes[R.sel]); var s = R.c.notes[R.sel]; changed(); R.sel = R.c.notes.indexOf(s); draw(); } };
    cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
    cv.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    cv.addEventListener("wheel", function (e) { e.preventDefault(); if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) R.sx = Math.max(0, R.sx + (e.deltaX || e.deltaY)); else R.top = Math.max(20, Math.min(127, R.top + (e.deltaY < 0 ? 2 : -2))); draw(); }, { passive: false });
    var vdrag = false, vset = function (e) { var p = pos(e, vc), best = -1, bd = 12; R.c.notes.forEach(function (n, i) { var dx = Math.abs(X(n.t) + 2 - p.x); if (dx < bd) { bd = dx; best = i; } }); if (best < 0) return; R.c.notes[best].v = Math.round(Math.max(0.05, Math.min(1, (vc.clientHeight - p.y) / (vc.clientHeight - 6))) * 100) / 100; R.sel = best; draw(); };
    vc.addEventListener("pointerdown", function (e) { vdrag = true; try { vc.setPointerCapture(e.pointerId); } catch (er) { /* fine */ } vset(e); });
    vc.addEventListener("pointermove", function (e) { if (vdrag) vset(e); });
    vc.addEventListener("pointerup", function () { if (vdrag) { vdrag = false; changed(); } });
    box.addEventListener("keydown", function (e) {
      e.stopPropagation();
      var n = R.c.notes[R.sel], k = e.key;
      if (k === "Escape") { close(); return; }
      if (!n) return;
      if (k === "Delete" || k === "Backspace") { R.c.notes.splice(R.sel, 1); R.sel = -1; }
      else if (k === "ArrowUp" || k === "ArrowDown") { n.m = Math.max(0, Math.min(127, n.m + (k === "ArrowUp" ? 1 : -1))); hear(n.m, n.v); }
      else if (k === "ArrowLeft" || k === "ArrowRight") n.t = Math.max(0, n.t + (k === "ArrowRight" ? grid() : -grid()));
      else return;
      e.preventDefault(); changed(); R.sel = R.c.notes.indexOf(n); draw();
    });
    doc.getElementById("syRollGrid").onchange = function (e) { R.grid = +e.target.value; draw(); };
    doc.getElementById("syRollQ").onclick = function () { var q = root.H3SynthTLCore.quantize(R.c.notes, grid(), 1); R.c.notes.length = 0; q.forEach(function (n) { R.c.notes.push(n); }); R.sel = -1; changed(); draw(); };
    doc.getElementById("syRollZin").onclick = function () { R.zx = Math.min(400, R.zx * 1.4); draw(); };
    doc.getElementById("syRollZout").onclick = function () { R.zx = Math.max(12, R.zx / 1.4); draw(); };
    doc.getElementById("syRollPlay").onclick = function () { if (R.o.playClip) R.o.playClip(); else R.c.notes.forEach(function (n) { root.setTimeout(function () { hear(n.m, n.v); }, n.t * 1000); }); };
    doc.getElementById("syRollX").onclick = close;
  }
  function open(c, o) {
    close();
    R = { c: c, o: o || {}, sel: -1, drag: null, zx: 80, rh: 12, sx: 0, grid: 0.25, top: 84 };
    if (c.notes.length) { var hi = Math.max.apply(null, c.notes.map(function (n) { return n.m; })); R.top = Math.min(127, hi + 6); }
    var host = doc.getElementById("synthdock") || doc.body, back = doc.createElement("div");
    back.id = "syRollBack"; back.className = "syrollback";
    back.innerHTML = '<div class="syroll" id="syRoll" tabindex="-1" role="dialog" aria-label="Piano roll"><div class="syrollbar"><b>🎹 ' + String(c.name).replace(/[<>&]/g, "") + '</b><span id="syRollInfo"></span>'
      + '<label>Grid <select id="syRollGrid"><option value="1">1/4</option><option value="0.5">1/8</option><option value="0.25" selected>1/16</option><option value="0.125">1/32</option></select></label>'
      + '<button type="button" class="sydk" id="syRollQ" title="⌗ Quantize: every note onto the grid">⌗ Quantize</button><button type="button" class="sydk" id="syRollPlay" title="▶ Hear the clip">▶</button>'
      + '<button type="button" class="sydk" id="syRollZout" title="Zoom out">－</button><button type="button" class="sydk" id="syRollZin" title="Zoom in">＋</button>'
      + '<span class="hint">click = a note · drag = move · edge = length · right-click / Delete = gone · ↑↓←→ · wheel = pitches, Shift+wheel = time</span>'
      + '<button type="button" class="sydk" id="syRollX" title="Done (Esc)">✕ Done</button></div>'
      + '<canvas id="syRollCv" aria-label="The notes"></canvas><canvas id="syRollVel" aria-label="Velocity"></canvas></div>';
    host.appendChild(back); wire(); draw(); doc.getElementById("syRoll").focus({ preventScroll: true });
    if (root.ResizeObserver) { R.ro = new root.ResizeObserver(draw); R.ro.observe(doc.getElementById("syRollCv")); }
  }
  function close() { var b = doc.getElementById("syRollBack"); if (b) b.remove(); if (R && R.ro) R.ro.disconnect(); var was = !!R; if (R && R.o.closed) R.o.closed(); R = null; return was; }
  root.H3SynthRoll = Object.assign({ open: open, close: close, draw: draw, isOpen: function () { return !!R; },
    info: function () { return R ? { notes: R.c.notes.length, sel: R.sel, grid: R.grid, top: R.top, zx: R.zx, sx: R.sx, kw: KW, rh: R.rh, bpm: R.o.bpm } : null; } }, pure);
})(typeof window !== "undefined" ? window : globalThis);
