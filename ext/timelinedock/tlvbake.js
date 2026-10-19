/* bitGen Studio — ext/timelinedock/tlvbake.js (2.506.0): A VIDEO LAYER BAKED BY THE PAGE. window.TlVBake.
 *
 * Some effects only the canvas can draw (☀ light rays, ⌗ mesh warp / 📌 puppet pins, 🧊 3D cards ...). On a picture
 * layer the page already bakes them (TlParent.bakeAll); a VIDEO layer had no such path. Here it gets one: its every
 * frame SEEKED in the clip's video (the clip's own time map, TlCanvas.srcAt), drawn by TlCanvas.drawClip exactly as the
 * canvas draws it (masks, distortion, rays, warp, its move...), sent as PNGs to /api/tlbake/frame, encoded to
 * video/tlb_<uid>_vb.webm (VP9 with transparency). The compile overlays that file like a baked picture layer
 * (lib/tlKeys.vbakeKeys -> vbaked, worker.py) - the SOUND still comes from the clip's own file.
 *   TlVBake.register(name, fn)   fn(clip) -> true when that effect needs the clip baked
 *   TlVBake.needs(c)             any registered effect on c
 *   TlVBake.bakeAll()            chained onto TlParent.bakeAll (every video layer that needs it and changed)
 * Pure (Node): sig(c) - what a bake depends on.
 */
(function (root) {
  "use strict";
  var REG = {};
  function register(name, fn) { if (typeof fn === "function") REG[name] = fn; }
  function needs(c) { if (!c) return false; for (var k in REG) { try { if (REG[k](c)) return true; } catch (e) { /* that one says no */ } } return false; }
  function sig(c, extra) {
    var keep = {}; for (var k in c) if (!/^(vbake|vbakeSig|bake|bakeSig|dbake|dbakeSig|mbake|_.*)$/.test(k)) keep[k] = c[k];
    return JSON.stringify([keep, extra || null]);
  }
  var api = { register: register, needs: needs, sig: sig, REG: REG };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }
  root.TlVBake = Object.assign({ ready: false }, api);
  function ready() { try { return !!(window.TlCanvas && TlCanvas.drawClip && TlCanvas.srcAt && window.TlParent && TlParent.bakeAll && window.H3Keyframes && typeof tl === "object" && tl); } catch (e) { return false; } }
  function boot() { if (ready()) install(); else setTimeout(boot, 300); }
  boot();
  function install() {
    if (root.TlVBake.ready) return;
    var C = window.TlCanvas, FPS = (window.H3Keyframes && H3Keyframes.FPS) || 24;
    function say(t) { try { C.say(t); } catch (e) { /* fine */ } }
    function seek(v, want) {
      return new Promise(function (ok) {
        if (Math.abs((v.currentTime || 0) - want) < 1e-4 && v.readyState >= 2 && !v.seeking) { ok(); return; }
        var done = false, fin = function () { if (done) return; done = true; v.removeEventListener("seeked", fin); setTimeout(ok, 0); };
        v.addEventListener("seeked", fin); try { v.currentTime = want; } catch (e) { fin(); }
        setTimeout(fin, 4000);
      });
    }
    /** one video layer clip -> video/tlb_<uid>_vb.webm */
    function bake(x, onProgress) {
      var c = x.c, len = Math.max(0.05, C.clipLen(c, "vl")), n = Math.max(1, Math.round(len * FPS)), id = (c.uid || (c.uid = "u" + Math.random().toString(36).slice(2, 10))) + "_vb";
      var cv = document.createElement("canvas"); cv.width = C.state.W; cv.height = C.state.H; var g = cv.getContext("2d");
      var Ly = { L: x.L, kind: "vl", lk: x.lk }, i = 0;
      var step = function () {
        if (i >= n) return Promise.resolve();
        var k = i++, t = (c.start || 0) + Math.min(len - 1e-4, k / FPS), b = C.box(c, "vl", t), v = b && b.src;
        var ready = v && v.tagName === "VIDEO" ? seek(v, (C.vidAt || C.srcAt)(c, t)) : Promise.resolve();
        return ready.then(function () {
          g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = "source-over"; g.clearRect(0, 0, cv.width, cv.height);
          C.drawClip(g, c, Ly, t);
          return new Promise(function (ok) { cv.toBlob(ok, "image/png"); });
        }).then(function (blob) { return fetch("/api/tlbake/frame?id=" + encodeURIComponent(id) + "&i=" + k, { method: "POST", headers: { "Content-Type": "image/png" }, body: blob }); })
          .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || r.status); }); })
          .then(function () { if (onProgress) onProgress(i, n); return step(); });
      };
      return step().then(function () {
        return fetch("/api/tlbake/encode", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: id, fps: FPS, frames: n }) })
          .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || r.status); return j; }); });
      }).then(function (j) { c.vbake = j.name; c.vbakeSig = sig(c, extra(x)); if (typeof tlSave === "function") tlSave(); return j; });
    }
    var extra = function (x) { var s = window.Tl3D && Tl3D.sceneSig ? Tl3D.sceneSig(x.c) : null; return s ? [C.state.W, C.state.H, x.L.opacity, s] : [C.state.W, C.state.H, x.L.opacity]; };   // 2.510.0: + the 3D scene
    function bakeAll() {
      var all = TlParent.all ? TlParent.all() : [], run = Promise.resolve();
      all.forEach(function (x) { if (x.kind === "vl" && !needs(x.c) && x.c.vbake) { delete x.c.vbake; delete x.c.vbakeSig; } });
      all.filter(function (x) { return x.kind === "vl" && needs(x.c) && x.L.visible !== false; }).forEach(function (x) {
        if (x.c.vbake && x.c.vbakeSig === sig(x.c, extra(x))) return;
        run = run.then(function () { say("🎞 baking " + (x.L.name || "a video layer") + "…"); return bake(x, function (k, n) { if (k % 12 === 0) say("🎞 baking " + (x.L.name || "") + " " + k + " / " + n); }); });
      });
      return run;
    }
    var prevBake = TlParent.bakeAll;
    TlParent.bakeAll = function () { return Promise.resolve(prevBake.apply(this, arguments)).then(bakeAll); };
    Object.assign(root.TlVBake, { ready: true, bake: bake, bakeAll: bakeAll });
  }
})(typeof window !== "undefined" ? window : globalThis);
