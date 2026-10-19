/* bitGen Studio — ext/timelinedock/tlcutout.js (2.515.0): 🧍 CUT OUT A SUBJECT THROUGH A SHOT. window.TlCutout.
 *
 * Tim (verbatim): "do number 8 of the after effects list" - AFTER-EFFECTS-GAP.md: "AI cut-out through a shot (a subject
 * matte that follows) + refine edge".
 *
 *   🧍 Cut out (a video clip's Properties - a video layer, or V1)
 *     ✚ Subject / ✖ Not it   click the subject (and what is not it) on the picture at the playhead; ▭ Box = drag a box
 *                            round it; a click on a mark takes it away. Marks at other frames = corrections there (the
 *                            cut-out follows the nearest marked frame).
 *     Way                    Auto (the best installed) · SAM 2 (Segment Anything 2 - ⬇ installs it into the AI matte's
 *                            venv) · AI matte (BiRefNet round the carried shape) · Built in (OpenCV: GrabCut + the
 *                            motion - nothing to install)
 *     Refine edge            ☑ snap to the edges (a guided filter), feather px, choke px (+ shrinks, - grows), smooth
 *                            (over time - the edge stops flickering)
 *     ▶ Cut out              the clip's whole length (its in .. out) -> video/cut_<clip>_<hash>.webm (the subject with
 *                            its alpha, its sound)
 *     ☑ Use it               a video layer plays the cut-out in place of the clip - see-through round the subject, on
 *                            the canvas and in ⚙ Compile (lib/tlKeys.js cutKeys). On V1 it is a preview only (V1 is the
 *                            bottom); the cut-out is what 🩹 Remove takes out (tlvfill.js) and what 📷 Track leaves out.
 * Pure (Node: scripts/test-scene515.js): covers, off, addMark, removeNear, setBox, marksAt, sig, clean.
 */
(function (root) {
  "use strict";
  var DEF_REFINE = { feather: 1, choke: 0, smooth: 30, edge: true };
  var r4 = function (v) { return Math.round(v * 10000) / 10000; };
  /** does the cut-out cover the clip's in .. out */
  function covers(cut, c) {
    if (!cut || !cut.file || !(+cut.to > +cut.from)) return false;
    var a = Math.max(0, +c.in || 0), b = c.out != null ? +c.out : (+c.dur || 0);
    return a >= +cut.from - 0.02 && (!b || b <= +cut.to + 0.06);
  }
  /** the source second the cut-out file starts at, when the clip plays it (else 0) */
  function off(c) { return c && c.cut && c.cut.use !== false && covers(c.cut, c) ? +c.cut.from || 0 : 0; }
  /** the marks' list with one more at source second t (a mark within half a frame joins that frame's) */
  function addMark(prompts, t, u, v, lab, fps) {
    var F = fps || 24, out = (prompts || []).map(function (p) { return { t: p.t, pts: (p.pts || []).slice(), box: p.box || null }; });
    var p = out.filter(function (x) { return Math.abs(x.t - t) < 0.5 / F; })[0];
    if (!p) { p = { t: r4(t), pts: [], box: null }; out.push(p); }
    p.pts.push([r4(u), r4(v), lab ? 1 : 0]);
    out.sort(function (a, b) { return a.t - b.t; });
    return out;
  }
  /** the marks less the one near (u, v) at t (within r, 0..1 of the picture) - and an empty frame dropped */
  function removeNear(prompts, t, u, v, r, fps) {
    var F = fps || 24, hit = false;
    var out = (prompts || []).map(function (p) {
      if (Math.abs(p.t - t) >= 0.5 / F) return p;
      var pts = (p.pts || []).filter(function (q) { var far = Math.hypot(q[0] - u, q[1] - v) > r; if (!far && !hit) { hit = true; return false; } return true; });
      return { t: p.t, pts: pts, box: p.box };
    }).filter(function (p) { return (p.pts && p.pts.length) || p.box; });
    return { prompts: out, hit: hit };
  }
  function setBox(prompts, t, box, fps) {
    var F = fps || 24, out = (prompts || []).map(function (p) { return { t: p.t, pts: (p.pts || []).slice(), box: p.box || null }; });
    var p = out.filter(function (x) { return Math.abs(x.t - t) < 0.5 / F; })[0];
    if (!p) { p = { t: r4(t), pts: [], box: null }; out.push(p); }
    p.box = box ? [r4(Math.min(box[0], box[2])), r4(Math.min(box[1], box[3])), r4(Math.max(box[0], box[2])), r4(Math.max(box[1], box[3]))] : null;
    out.sort(function (a, b) { return a.t - b.t; });
    return out.filter(function (q) { return (q.pts && q.pts.length) || q.box; });
  }
  function marksAt(prompts, t, fps) { var F = fps || 24; return (prompts || []).filter(function (p) { return Math.abs(p.t - t) < 0.5 / F; })[0] || null; }
  /** what the made cut-out depends on (changed = ▶ Cut out again) */
  function sig(c, rng) { var k = c.cut || {}; return JSON.stringify([k.prompts || [], k.method || "auto", k.refine || DEF_REFINE, rng || null, c.name]); }
  function clean(k) {
    k = k || {}; var R = k.refine || {}, n = function (v, d, lo, hi) { var x = Number(v); return Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : d; };
    return { feather: n(R.feather, 1, 0, 100), choke: Math.round(n(R.choke, 0, -50, 50)), smooth: n(R.smooth, 30, 0, 100), edge: R.edge !== false };
  }
  var pure = { DEF_REFINE: DEF_REFINE, covers: covers, off: off, addMark: addMark, removeNear: removeNear, setBox: setBox, marksAt: marksAt, sig: sig, clean: clean };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  /* ---------------- the page ---------------- */
  root.TlCutout = Object.assign({ ready: false, url: function () { return null; }, off: function () { return 0; } }, pure);
  function ready() { try { return !!(window.TlCanvas && TlCanvas.addTool && TlCanvas.onProps && TlCanvas.onDraw && TlCanvas.srcAt && window.TlScene && window.H3Keyframes && typeof tl === "object" && tl); } catch (e) { return false; } }
  function boot() { if (ready()) install(); else setTimeout(boot, 300); }
  boot();
  function install() {
    if (root.TlCutout.ready) return;
    var C = window.TlCanvas, KF = window.H3Keyframes, FPS = KF.FPS || 24, S = window.TlScene;
    function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (x) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[x]; }); }
    function say(t) { try { C.say(t); } catch (e) { /* fine */ } }
    var toPic = function (b, u, v) { var a = (b.rot || 0) * Math.PI / 180, dx = (u - 0.5) * b.w, dy = (v - 0.5) * b.h; return [b.cx + dx * Math.cos(a) - dy * Math.sin(a), b.cy + dx * Math.sin(a) + dy * Math.cos(a)]; };
    var toLocal = function (b, x, y) { var a = -(b.rot || 0) * Math.PI / 180, dx = x - b.cx, dy = y - b.cy; return [(dx * Math.cos(a) - dy * Math.sin(a)) / b.w + 0.5, (dx * Math.sin(a) + dy * Math.cos(a)) / b.h + 0.5]; };
    var zoom = function () { return (C.state.view && C.state.view.z) || 1; };
    var isVid = function (s) { return !!(s && s.c && !s.c.adjust && (s.Ly.kind === "v1" || (s.Ly.kind === "vl" && !s.c.m3d && !s.c.gen && !s.c.shape && !s.c.nul))); };
    var selV = function () { var s = C.selClip(); return isVid(s) ? s : null; };
    var cutOf = function (c) { return c.cut || (c.cut = { prompts: [], method: "auto", refine: Object.assign({}, DEF_REFINE) }); };
    function save(c, repaint) { delete c.bakeSig; delete c.vbakeSig; if (typeof tlSave === "function") tlSave(); C.mark(); if (repaint) C.paintProps(); }
    var srcNow = function (c) { return C.srcAt(c, C.state.t); };
    var MODE = "inc", BOX = null;            // the canvas tool's mode: inc | exc | box; BOX: a box being dragged

    /* the canvas plays the cut-out (canvas.js vidUrl / vidAt) */
    root.TlCutout.url = function (c) { return c && c.cut && c.cut.file && c.cut.use !== false && c.cut.use != null && covers(c.cut, c) ? "/passets/video/" + encodeURIComponent(c.cut.file) : null; };
    root.TlCutout.off = function (c) { return root.TlCutout.url(c) ? +c.cut.from || 0 : 0; };

    C.addTool({ id: "cutpts", icon: "🧍", title: "Cut out - click the subject (✚), what is not it (✖), or drag a box (▭) on the picked video clip (the 🧍 Cut out section)", key: "", cursor: "crosshair",
      down: function (p) {
        var s = selV(); if (!s) return; var b = C.box(s.c, s.Ly.kind, C.state.t); if (!b) return;
        var u = toLocal(b, p.x, p.y); if (u[0] < 0 || u[1] < 0 || u[0] > 1 || u[1] > 1) return;
        var k = cutOf(s.c), t = srcNow(s.c);
        if (MODE === "box") { BOX = { s: s, a: u, b: u }; return; }
        var r = 12 / zoom() / Math.max(1, b.w), rm = removeNear(k.prompts, t, u[0], u[1], r, FPS);
        k.prompts = rm.hit ? rm.prompts : addMark(k.prompts, t, u[0], u[1], MODE === "inc", FPS);
        save(s.c, true);
      },
      move: function (p) { if (!BOX) return; var b = C.box(BOX.s.c, BOX.s.Ly.kind, C.state.t); if (!b) return; var u = toLocal(b, p.x, p.y); BOX.b = [Math.max(0, Math.min(1, u[0])), Math.max(0, Math.min(1, u[1]))]; C.mark(); },
      up: function () {
        if (!BOX) return; var x = BOX; BOX = null;
        var k = cutOf(x.s.c), big = Math.abs(x.b[0] - x.a[0]) > 0.01 && Math.abs(x.b[1] - x.a[1]) > 0.01;
        k.prompts = setBox(k.prompts, srcNow(x.s.c), big ? [x.a[0], x.a[1], x.b[0], x.b[1]] : null, FPS);
        save(x.s.c, true);
      } });
    C.onDraw(function (ctx, o) {
      var s = selV(); if (!s || !s.c.cut) return;
      var c = s.c, b = C.box(c, s.Ly.kind, C.state.t); if (!b) return;
      var m = marksAt(c.cut.prompts, srcNow(c), FPS), boxNow = BOX && BOX.s.c === c ? [BOX.a[0], BOX.a[1], BOX.b[0], BOX.b[1]] : m && m.box;
      if (!m && !boxNow) return;
      ctx.save();
      if (boxNow) {
        var q = [toPic(b, boxNow[0], boxNow[1]), toPic(b, boxNow[2], boxNow[1]), toPic(b, boxNow[2], boxNow[3]), toPic(b, boxNow[0], boxNow[3])].map(function (w) { return o.toScreen(w[0], w[1]); });
        ctx.strokeStyle = "#50dcff"; ctx.setLineDash([6, 4]); ctx.lineWidth = 1.5; ctx.beginPath(); q.forEach(function (w, i) { if (i) ctx.lineTo(w.x, w.y); else ctx.moveTo(w.x, w.y); }); ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
      }
      ((m && m.pts) || []).forEach(function (pt) {
        var w = toPic(b, pt[0], pt[1]), q2 = o.toScreen(w[0], w[1]);
        ctx.fillStyle = pt[2] ? "#29d17a" : "#ff4d5e"; ctx.strokeStyle = "#000"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(q2.x, q2.y, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.beginPath();
        if (pt[2]) { ctx.moveTo(q2.x - 4, q2.y); ctx.lineTo(q2.x + 4, q2.y); ctx.moveTo(q2.x, q2.y - 4); ctx.lineTo(q2.x, q2.y + 4); }
        else { ctx.moveTo(q2.x - 3, q2.y - 3); ctx.lineTo(q2.x + 3, q2.y + 3); ctx.moveTo(q2.x + 3, q2.y - 3); ctx.lineTo(q2.x - 3, q2.y + 3); }
        ctx.stroke();
      });
      ctx.restore();
    });

    /** ▶ Cut out: the clip's in .. out */
    function cutOut(s) {
      var c = s.c, k = cutOf(s.c), rng = S.range(c);
      if (!(k.prompts || []).length) { say("🧍 click the subject first (✚) - or drag a box round it (▭)"); return Promise.resolve(null); }
      say("🧍 cutting out the subject of " + (s.Ly.L.name || c.name) + "…");
      return S.run(c, "cut", "/api/scene/cutout", { name: c.name, src: c.src, from: rng[0], to: rng[1], prompts: k.prompts, method: k.method || "auto", refine: clean(k), model: k.model }, function () { C.paintProps(); })
        .then(function (res) {
          k.file = res.file; k.from = res.from; k.to = res.to; k.made = { method: res.method || (res.cached ? (k.made && k.made.method) : ""), frames: res.frames, empty: (res.empty || []).length, sig: sig(c, rng) };
          if (k.use == null) k.use = s.Ly.kind === "vl";
          save(c, true);
          say("🧍 cut out: " + (res.frames ? res.frames + " frames" : "made before") + (res.method ? " (" + ({ sam2: "SAM 2", ai: "AI matte", flow: "built in" }[res.method] || res.method) + ")" : "") + ((res.empty || []).length ? " - " + res.empty.length + " frame(s) found nothing (mark them)" : "") + (s.Ly.kind === "vl" ? "" : " - V1: 🩹 Remove can take it out"));
          return res;
        }).catch(function (e) { C.paintProps(); say("🧍 " + e.message); return null; });
    }
    function sam2Install(btn) {
      fetch("/api/scene/sam2/install", { method: "POST" }).then(function (r) { return r.json(); }).then(function (j) {
        if (j.error) { say("🧍 " + j.error); return; }
        say("🧍 installing SAM 2 (torch + sam2 + the checkpoint) - this takes a while…");
        var tick = function () { S.status(true).then(function (st) { var i = st.cutout.sam2 && st.cutout.sam2.installing; if (btn) btn.textContent = i && i.state === "running" ? "⏳ SAM 2…" : st.cutout.sam2.ready ? "✓ SAM 2" : "⬇ SAM 2"; if (i && i.state === "running") setTimeout(tick, 3000); else { say(st.cutout.sam2.ready ? "🧍 SAM 2 is ready" : "🧍 SAM 2: " + ((i && i.error) || "not installed")); C.paintProps(); } }); };
        tick();
      });
    }

    C.onProps(function (Pn, c, s) {
      if (!Pn || !isVid(s)) return;
      var k = c.cut || {}, d = document.createElement("div"); d.className = "tlp-cutout";
      var run = S.busy(c, "cut"), rng = S.range(c), stale = k.file && k.made && k.made.sig !== sig(c, rng);
      var meth = k.method || "auto", R = clean(k);
      var h = '<div class="tlp-t">🧍 Cut out</div><div class="tlp-row" style="flex-wrap:wrap">'
        + '<button class="ghost" data-cut="inc" title="Click the subject on the picture (the playhead\'s frame)"' + (C.state.tool === "cutpts" && MODE === "inc" ? ' style="border-color:#29d17a"' : "") + ">✚ Subject</button>"
        + '<button class="ghost" data-cut="exc" title="Click what is NOT the subject"' + (C.state.tool === "cutpts" && MODE === "exc" ? ' style="border-color:#ff4d5e"' : "") + ">✖ Not it</button>"
        + '<button class="ghost" data-cut="box" title="Drag a box round the subject"' + (C.state.tool === "cutpts" && MODE === "box" ? ' style="border-color:#50dcff"' : "") + ">▭ Box</button>"
        + '<select id="tlpCutWay" title="How the subject is followed"><option value="auto">Auto (the best installed)</option><option value="sam2">SAM 2 (Segment Anything 2)</option><option value="ai">AI matte (BiRefNet)</option><option value="flow">Built in (OpenCV)</option></select>'
        + '<button class="ghost" id="tlpCutSam" title="Install Segment Anything 2 (torch + sam2 + its checkpoint, ~1-3 GB) into the AI matte\'s venv">⬇ SAM 2</button></div>';
      var ps = k.prompts || [];
      h += '<div class="tlp-row" style="flex-wrap:wrap">' + (ps.length ? ps.map(function (p, i) { var ni = (p.pts || []).filter(function (q) { return q[2]; }).length, no = (p.pts || []).length - ni;
        return '<span class="tlp-none" style="white-space:nowrap"><a href="#" data-cutgo="' + i + '" title="Go there">' + (+p.t).toFixed(2) + " s</a>: " + (ni ? ni + " ✚" : "") + (no ? " " + no + " ✖" : "") + (p.box ? " ▭" : "") + ' <button class="ghost" data-cutdel="' + i + '" style="padding:0 3px" title="Take these marks away">✕</button></span>'; }).join(" ")
        : '<span class="tlp-none">No marks yet - ✚ click the subject on the picture</span>') + "</div>";
      h += '<div class="tlp-row" style="flex-wrap:wrap"><span>Refine edge</span><label title="Snap the edge to the picture\'s edges (a guided filter) - hair, fur"><input type="checkbox" id="tlpCutEdge"' + (R.edge ? " checked" : "") + "> snap</label>"
        + '<label>feather <input type="number" id="tlpCutFe" min="0" max="100" step="0.5" value="' + R.feather + '" style="width:44px"> px</label>'
        + '<label title="+ shrinks the edge, - grows it">choke <input type="number" id="tlpCutCh" min="-50" max="50" step="1" value="' + R.choke + '" style="width:44px"> px</label>'
        + '<label title="Over time - the edge stops flickering">smooth <input type="number" id="tlpCutSm" min="0" max="100" step="5" value="' + R.smooth + '" style="width:44px"></label></div>';
      h += '<div class="tlp-row" style="flex-wrap:wrap">' + (run ? '<span class="tlp-none">⏳ ' + esc(run.stage || "") + " " + S.pct(run.p) + '</span><button class="ghost" id="tlpCutStop">■ Stop</button>'
        : '<button class="ghost" id="tlpCutGo" title="The clip\'s whole length (' + rng[0].toFixed(2) + " - " + rng[1].toFixed(2) + ' s of the file)">▶ Cut out</button>');
      if (k.file) {
        h += '<span class="tlp-none">' + (stale ? "⚠ out of date - ▶ again · " : "✓ ") + (+k.from).toFixed(2) + "–" + (+k.to).toFixed(2) + " s" + (k.made && k.made.method ? " (" + esc({ sam2: "SAM 2", ai: "AI matte", flow: "built in" }[k.made.method] || k.made.method) + ")" : "") + (k.made && k.made.empty ? " · " + k.made.empty + " empty" : "") + "</span>"
          + '<label title="' + (s.Ly.kind === "vl" ? "The layer plays the cut-out: see-through round the subject (canvas + compile)" : "V1 is the bottom - a preview only (🩹 Remove uses the cut-out)") + '"><input type="checkbox" id="tlpCutUse"' + (k.use ? " checked" : "") + "> " + (s.Ly.kind === "vl" ? "use it (see-through)" : "show it") + "</label>"
          + (covers(k, c) ? "" : '<span class="tlp-none">⚠ the clip reaches past it - ▶ again</span>')
          + '<button class="ghost" id="tlpCutX" title="Forget the cut-out (the marks stay)">✕</button>';
      }
      h += "</div>";
      d.innerHTML = h; Pn.appendChild(d);
      var q = function (id) { return d.querySelector("#" + id); };
      d.querySelectorAll("input[type=number]").forEach(function (el) { el.addEventListener("keydown", function (e) { e.stopPropagation(); }); });
      q("tlpCutWay").value = meth;
      S.status().then(function (st) {
        var have = (st.cutout && st.cutout.methods) || [];
        [].forEach.call(q("tlpCutWay").options, function (op) { if (op.value !== "auto" && have.indexOf(op.value) < 0) op.textContent += " - not installed"; });
        var sb = q("tlpCutSam"); if (sb) { if (st.cutout.sam2 && st.cutout.sam2.ready) sb.style.display = "none"; else if (st.cutout.sam2 && st.cutout.sam2.installing && st.cutout.sam2.installing.state === "running") sb.textContent = "⏳ SAM 2…"; }
      });
      d.querySelectorAll("[data-cut]").forEach(function (el) { el.addEventListener("click", function () { MODE = el.getAttribute("data-cut"); cutOf(c); C.setTool("cutpts"); C.paintProps(); say({ inc: "🧍 click the subject on the picture", exc: "🧍 click what is NOT the subject", box: "🧍 drag a box round the subject" }[MODE] + " - a click on a mark takes it away"); }); });
      q("tlpCutWay").addEventListener("change", function () { cutOf(c).method = q("tlpCutWay").value; save(c, true); });
      q("tlpCutSam").addEventListener("click", function () { sam2Install(q("tlpCutSam")); });
      d.querySelectorAll("[data-cutgo]").forEach(function (el) { el.addEventListener("click", function (e) { e.preventDefault(); var p = (c.cut.prompts || [])[+el.getAttribute("data-cutgo")]; if (!p) return; var t = (c.start || 0) + (p.t - (+c.in || 0)); if (C.go) C.go(t); }); });
      d.querySelectorAll("[data-cutdel]").forEach(function (el) { el.addEventListener("click", function () { c.cut.prompts.splice(+el.getAttribute("data-cutdel"), 1); save(c, true); }); });
      var ref = function () { var K = cutOf(c); K.refine = { edge: q("tlpCutEdge").checked, feather: +q("tlpCutFe").value || 0, choke: +q("tlpCutCh").value || 0, smooth: +q("tlpCutSm").value || 0 }; save(c, false); };
      ["tlpCutEdge", "tlpCutFe", "tlpCutCh", "tlpCutSm"].forEach(function (id) { q(id).addEventListener("change", ref); });
      if (q("tlpCutGo")) q("tlpCutGo").addEventListener("click", function () { cutOut(s); });
      if (q("tlpCutStop")) q("tlpCutStop").addEventListener("click", function () { S.stop(c, "cut"); });
      if (q("tlpCutUse")) q("tlpCutUse").addEventListener("change", function () { c.cut.use = q("tlpCutUse").checked; save(c, true); });
      if (q("tlpCutX")) q("tlpCutX").addEventListener("click", function () { var K = c.cut; delete K.file; delete K.from; delete K.to; delete K.made; delete K.use; save(c, true); say("🧍 the cut-out is forgotten (its marks stay)"); });
    });
    Object.assign(root.TlCutout, { ready: true, cutOut: cutOut, mode: function (m) { if (m) MODE = m; return MODE; } });
  }
})(typeof window !== "undefined" ? window : globalThis);
