/* bitGen Studio — ext/timelinedock/tlvfill.js (2.515.0): 🩹 CONTENT-AWARE FILL FOR VIDEO. window.TlVFill.
 *
 * Tim (verbatim): "do number 8 of the after effects list" - AFTER-EFFECTS-GAP.md: "Content-aware fill for video (remove
 * an object across a shot)".
 *
 *   🩹 Remove (a video clip's Properties - V1 or a video layer)
 *     What           🧍 the cut-out (tlcutout.js: click the person / the car, ▶ Cut out) · ✒ the layer's masks (drawn
 *                    with the ✒ Mask Pen - they may move)
 *     Grow / feather the hole made bigger (an edge, a shadow) and the soft join
 *     Look           how far before and after (s) the frames are looked in for what is behind it
 *     Way            Auto: the frames round it lined up on this one fill it (what is never seen is painted in, then
 *                    carried on so it stays still) · Paint in only (fast, it may shimmer)
 *     Reference      a picture of one frame already filled (✎ Paint one: the frame at the playhead opens in the image
 *                    editor with the hole see-through - fill it (Generative Fill, the clone stamp), Ctrl+S puts it into
 *                    the project's Images - then pick it here): what the shot never shows comes from it
 *     ▶ Remove       the clip again with it gone -> <clip>_fill<hash>.mp4 (.webm for a webm) beside it (the same length and times, its
 *                    sound) - the clip plays that file; ↺ Original puts the clip back on its own file
 * Pure (Node: scripts/test-scene515.js): holeOf, clean.
 */
(function (root) {
  "use strict";
  var DEF = { what: "cut", grow: 6, feather: 4, reach: 2, method: "auto", ref: "" };
  function clean(f) {
    f = f || {}; var n = function (v, d, lo, hi) { var x = Number(v); return Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : d; };
    return { what: f.what === "mask" ? "mask" : "cut", grow: n(f.grow, 6, 0, 200), feather: n(f.feather, 4, 0, 100), reach: n(f.reach, 2, 0.2, 10), method: f.method === "spatial" ? "spatial" : "auto", ref: String(f.ref || "").slice(0, 200) };
  }
  /** the hole the app takes out: {name, kind, t0} - the cut-out's file (alpha) or the masks' grey video - or null (+ why) */
  function holeOf(c, f) {
    if (f.what === "mask") {
      if (!c.mbake) return { hole: null, why: "the layer has no ✒ masks made yet (draw them; ⚙ Compile / ▶ Remove makes their video)" };
      return { hole: { name: c.mbake, kind: "grey", t0: Math.max(0, +c.in || 0) }, why: "" };
    }
    if (!c.cut || !c.cut.file) return { hole: null, why: "🧍 cut out what goes first (✚ click it, ▶ Cut out)" };
    return { hole: { name: c.cut.file, kind: "alpha", t0: +c.cut.from || 0 }, why: "" };
  }
  var pure = { DEF: DEF, clean: clean, holeOf: holeOf };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  /* ---------------- the page ---------------- */
  root.TlVFill = Object.assign({ ready: false }, pure);
  function ready() { try { return !!(window.TlCanvas && TlCanvas.onProps && TlCanvas.srcAt && window.TlScene && window.H3Keyframes && typeof tl === "object" && tl); } catch (e) { return false; } }
  function boot() { if (ready()) install(); else setTimeout(boot, 300); }
  boot();
  function install() {
    if (root.TlVFill.ready) return;
    var C = window.TlCanvas, S = window.TlScene;
    function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (x) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[x]; }); }
    function say(t) { try { C.say(t); } catch (e) { /* fine */ } }
    var isVid = function (s) { return !!(s && s.c && !s.c.adjust && (s.Ly.kind === "v1" || (s.Ly.kind === "vl" && !s.c.m3d && !s.c.gen && !s.c.shape && !s.c.nul))); };
    function save(c, repaint) { delete c.bakeSig; delete c.vbakeSig; if (typeof tlSave === "function") tlSave(); C.mark(); if (repaint) C.paintProps(); }
    var IMGS = null, IMGAT = 0;
    function images() {
      if (IMGS && Date.now() - IMGAT < 15000) return Promise.resolve(IMGS);
      return fetch("/api/passets").then(function (r) { return r.json(); }).then(function (j) { IMGS = (j.images || []).map(function (x) { return x.name; }).filter(function (n) { return /\.(png|jpe?g|webp)$/i.test(n); }); IMGAT = Date.now(); return IMGS; }).catch(function () { return []; });
    }
    function remove(s) {
      var c = s.c, f = clean(c.vfill), rng = S.range(c);
      var go = function () {
        var H = holeOf(c, f); if (!H.hole) { say("🩹 " + H.why); return Promise.resolve(null); }
        say("🩹 taking it out of " + (s.Ly.L.name || c.name) + "…");
        var orig = c.vfill && c.vfill.of && c.name === c.vfill.file ? c.vfill.of : c.name;   // always from the clip's own file
        return S.run(c, "fill", "/api/scene/fill", { name: orig, src: c.src, from: rng[0], to: rng[1], hole: H.hole, grow: f.grow, feather: f.feather, reach: f.reach, method: f.method, ref: f.ref ? { name: f.ref, t: C.srcAt(c, C.state.t) } : null }, function () { C.paintProps(); })
          .then(function (res) {
            c.vfill = Object.assign(clean(c.vfill), { of: c.vfill && c.vfill.of ? c.vfill.of : c.name, file: res.file, info: { from_frames: res.from_frames, inpainted: res.inpainted, cached: !!res.cached } });
            c.name = res.file;                         // the clip plays the filled file (the same times)
            if (c.cut) c.cut.use = false;              // what was cut out is gone now
            save(c, true);
            say("🩹 removed" + (res.from_frames != null ? ": " + Math.round(res.from_frames * 100) + "% from other frames, " + Math.round((res.inpainted || 0) * 100) + "% painted in" : " (made before)") + " - ↺ Original puts it back");
            return res;
          }).catch(function (e) { C.paintProps(); say("🩹 " + e.message); return null; });
      };
      // ✒ masks: their grey video first (the compile's own bake)
      if (f.what === "mask" && window.TlMask && TlMask.bakeMasks && (!c.mbake || c.mbakeSig !== JSON.stringify([c.masks, C.clipLen(c, "vl"), c.start]))) return Promise.resolve(TlMask.bakeMasks()).then(go);
      return go();
    }
    /** ✎ the frame at the playhead into the image editor, its hole see-through - fill it there */
    function paintRef(s) {
      var c = s.c, ed = window.imageEditorInstance && window.imageEditorInstance.E;
      if (!ed || !ed.openImage) { say("🩹 open the image editor (its docker) first"); return; }
      var b = C.box(c, s.Ly.kind, C.state.t); if (!b || !b.src || b.src.tagName !== "VIDEO") { say("🩹 the clip's picture is not ready - a moment"); return; }
      var V = b.src, W = V.videoWidth, H = V.videoHeight, cv = document.createElement("canvas"); cv.width = W; cv.height = H; var g = cv.getContext("2d");
      var name = "fillref_" + String(c.name).replace(/\.[^.]+$/, "").slice(0, 30) + "_" + C.srcAt(c, C.state.t).toFixed(2) + ".png";
      var finish = function () { var im = new Image(); im.onload = function () { ed.openImage(im, name); say("🩹 the frame is in the image editor - fill the see-through part (Generative Fill, the clone stamp), Ctrl+S into the project, then pick " + name + " as the Reference"); }; im.src = cv.toDataURL("image/png"); };
      var orig = c.cut && c.cut.use ? null : V;                    // the clip's own picture (not the cut-out)
      var draw = function (src) { g.drawImage(src, 0, 0, W, H); };
      var hole = function () {
        if (!c.cut || !c.cut.file) { finish(); return; }
        var m = document.createElement("video"); m.muted = true; m.crossOrigin = "anonymous"; m.preload = "auto"; m.src = "/passets/video/" + encodeURIComponent(c.cut.file);
        m.addEventListener("loadeddata", function () { m.currentTime = Math.max(0, C.srcAt(c, C.state.t) - (+c.cut.from || 0)); }, { once: true });
        m.addEventListener("seeked", function () { g.globalCompositeOperation = "destination-out"; g.drawImage(m, 0, 0, W, H); g.globalCompositeOperation = "source-over"; finish(); }, { once: true });
        m.addEventListener("error", finish, { once: true });
      };
      if (orig) { draw(orig); hole(); return; }
      var o = document.createElement("video"); o.muted = true; o.crossOrigin = "anonymous"; o.preload = "auto";
      o.src = c.src === "video" ? "/passets/video/" + encodeURIComponent(c.name) : "/outputs/" + encodeURIComponent(c.name) + (c.src === "final" ? "?where=final" : "");
      o.addEventListener("loadeddata", function () { o.currentTime = C.srcAt(c, C.state.t); }, { once: true });
      o.addEventListener("seeked", function () { draw(o); hole(); }, { once: true });
    }

    C.onProps(function (Pn, c, s) {
      if (!Pn || !isVid(s)) return;
      var f = clean(c.vfill), run = S.busy(c, "fill"), d = document.createElement("div"); d.className = "tlp-vfill";
      var H = holeOf(c, f);
      var h = '<div class="tlp-t">🩹 Remove (content-aware fill)</div><div class="tlp-row" style="flex-wrap:wrap">'
        + '<select id="tlpVfWhat" title="What is taken out"><option value="cut">🧍 the cut-out</option>' + (s.Ly.kind === "vl" ? '<option value="mask">✒ the masks</option>' : "") + "</select>"
        + '<label title="The hole made bigger - its edge, a shadow">grow <input type="number" id="tlpVfGrow" min="0" max="200" step="1" value="' + f.grow + '" style="width:44px"> px</label>'
        + '<label>feather <input type="number" id="tlpVfFe" min="0" max="100" step="1" value="' + f.feather + '" style="width:44px"> px</label>'
        + '<label title="How far before and after the frames are looked in">look <input type="number" id="tlpVfReach" min="0.2" max="10" step="0.5" value="' + f.reach + '" style="width:44px"> s</label>'
        + '<select id="tlpVfWay"><option value="auto">Auto (other frames + paint in)</option><option value="spatial">Paint in only (fast)</option></select></div>'
        + '<div class="tlp-row" style="flex-wrap:wrap"><label title="One frame already filled - what the shot never shows comes from it">reference <select id="tlpVfRef"><option value="">none</option>' + (f.ref ? '<option value="' + esc(f.ref) + '" selected>' + esc(f.ref) + "</option>" : "") + "</select></label>"
        + '<button class="ghost" id="tlpVfPaint" title="The frame at the playhead into the image editor, the hole see-through - fill it there, Ctrl+S, pick it here">✎ Paint one</button></div>'
        + '<div class="tlp-row" style="flex-wrap:wrap">' + (run ? '<span class="tlp-none">⏳ ' + esc(run.stage || "") + " " + S.pct(run.p) + '</span><button class="ghost" id="tlpVfStop">■ Stop</button>'
          : '<button class="ghost" id="tlpVfGo"' + (H.hole ? "" : ' title="' + esc(H.why) + '"') + ">▶ Remove</button>" + (H.hole ? "" : '<span class="tlp-none">' + esc(H.why) + "</span>"));
      if (c.vfill && c.vfill.of && c.vfill.file && c.name === c.vfill.file) {
        var I = c.vfill.info || {};
        h += '<span class="tlp-none">✓ removed' + (I.from_frames != null && !I.cached ? " (" + Math.round(I.from_frames * 100) + "% from other frames)" : "") + "</span>"
          + '<button class="ghost" id="tlpVfOrig" title="The clip back on ' + esc(c.vfill.of) + '">↺ Original</button>';
      }
      h += "</div>";
      d.innerHTML = h; Pn.appendChild(d);
      var q = function (id) { return d.querySelector("#" + id); };
      d.querySelectorAll("input[type=number]").forEach(function (el) { el.addEventListener("keydown", function (e) { e.stopPropagation(); }); });
      q("tlpVfWhat").value = f.what; q("tlpVfWay").value = f.method;
      images().then(function (ls) { var sel = q("tlpVfRef"); if (!sel) return; ls.forEach(function (n) { if (n === f.ref) return; var o = document.createElement("option"); o.value = n; o.textContent = n; sel.appendChild(o); }); });
      var keep = function () { c.vfill = Object.assign(c.vfill || {}, { what: q("tlpVfWhat").value, grow: +q("tlpVfGrow").value, feather: +q("tlpVfFe").value, reach: +q("tlpVfReach").value, method: q("tlpVfWay").value, ref: q("tlpVfRef").value }); save(c, false); };
      ["tlpVfWhat", "tlpVfGrow", "tlpVfFe", "tlpVfReach", "tlpVfWay", "tlpVfRef"].forEach(function (id) { q(id).addEventListener("change", function () { keep(); if (id === "tlpVfWhat") C.paintProps(); }); });
      if (q("tlpVfGo")) q("tlpVfGo").addEventListener("click", function () { remove(s); });
      if (q("tlpVfStop")) q("tlpVfStop").addEventListener("click", function () { S.stop(c, "fill"); });
      if (q("tlpVfPaint")) q("tlpVfPaint").addEventListener("click", function () { paintRef(s); });
      if (q("tlpVfOrig")) q("tlpVfOrig").addEventListener("click", function () { c.name = c.vfill.of; delete c.vfill.of; delete c.vfill.file; delete c.vfill.info; save(c, true); say("🩹 the clip plays its own file again (the filled one stays in the project)"); });
    });
    Object.assign(root.TlVFill, { ready: true, remove: remove, paintRef: paintRef });
  }
})(typeof window !== "undefined" ? window : globalThis);
