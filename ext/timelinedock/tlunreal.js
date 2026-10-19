/* bitGen Studio — the timeline's UNREAL tab: Unreal Engine 5.8 scenes, MetaHumans and an Unreal camera as timeline
 * layers (2.472.0), window.TlUnreal.
 *
 * Tim (verbatim): "can we add an unreal engine 5.8 bridge, get ue5.8 scenes/projects and render them in our timeline
 * ... we can add metahuman layer, ue5.8 layer, ue5.8 camera in our timeline?"
 *
 *   UNREAL ▸ Unreal Layer      a Level Sequence of the open Unreal project (or a level through one of its cameras,
 *                              held for a length you pick) rendered by Unreal's Movie Render Queue at the timeline's
 *                              size and fps -> a video layer at the playhead ("UE1"…)
 *   UNREAL ▸ MetaHuman Layer   a MetaHuman playing an animation, framed Face / Bust / Full body, on a clear
 *                              background -> a layer over the others ("MH1"…)
 *   UNREAL ▸ Unreal Camera     (2.475.0: + its lens in Keys… - focal length, f-stop, focus, exposure) a camera of your own: KEYS (time, place, turn, field of view) taken from Unreal's level
 *                              viewport or its cameras at the playhead, then rendered through the level -> a layer
 *                              ("UE Cam1"…); its keys stay on the clip (c.ue) - ＋ Key / Keys… / Render again
 * Each clip remembers how it was made (c.ue = {kind: sequence | scene | metahuman | camera, …}) - Render Again makes
 * it anew (after changing the Unreal project, or the keys). Progress shows in the timeline's status line.
 * 2.540.0 UNREAL ▸ Render to Real (an Unreal clip picked): 🔍 the mesh actors its camera sees at the start (bitGen Bridge
 *   1.3.0), each with a reference docker picture (by its name, or picked) -> its first frame made real with those pictures
 *   (an edit model), then LTX 2.3 3DREAL animates that photo along the clip (lib/realRefs.js) - the result in the gallery.
 * Pure (Node: scripts/test-unreal.js): renderRequest(ue, W, H, fps) - a clip's settings -> /api/unreal/render's body;
 *   keyAt(keys, t) - the camera between keys (straight in-between).
 */
(function () {
  "use strict";
  function lerp(a, b, k) { return a + (b - a) * k; }
  function lerpAng(a, b, k) { var d = ((b - a + 540) % 360) - 180; return a + d * k; }
  /** the camera at time t between keys (sorted by t) */
  function keyAt(keys, t) {
    if (!keys || !keys.length) return null;
    var K = keys.slice().sort(function (x, y) { return x.t - y.t; });
    if (t <= K[0].t) return K[0]; if (t >= K[K.length - 1].t) return K[K.length - 1];
    for (var i = 0; i + 1 < K.length; i++) if (t >= K[i].t && t <= K[i + 1].t) {
      var a = K[i], b = K[i + 1], k = (t - a.t) / Math.max(1e-9, b.t - a.t);
      return { t: t, loc: [0, 1, 2].map(function (j) { return lerp(a.loc[j], b.loc[j], k); }), rot: [0, 1, 2].map(function (j) { return lerpAng(a.rot[j], b.rot[j], k); }), fov: lerp(a.fov || 60, b.fov || 60, k) };
    }
    return K[K.length - 1];
  }
  /** a clip's c.ue -> the render request */
  function renderRequest(ue, W, H, fps, framing) {
    var o = { w: ue.w || W, h: ue.h || H, fps: ue.fps || fps, frames: Math.max(1, Math.round((ue.dur || 5) * (ue.fps || fps))), alpha: !!ue.alpha };
    if (ue.level) o.level = ue.level;
    if (ue.lens) o.lens = ue.lens;
    if (ue.rig) o.rig = ue.rig;                                          // 2.476.0: lights + fog (static/uerig.js)                                       // 2.475.0: focal length, f-stop, focus, exposure
    if (ue.kind === "sequence") o.sequence = ue.sequence;
    else if (ue.kind === "scene") o.camera_keys = [{ t: 0, loc: ue.camera.loc, rot: ue.camera.rot, fov: ue.camera.fov || 60 }];
    else if (ue.kind === "camera") o.camera_keys = (ue.keys || []).map(function (k) { return { t: k.t, loc: k.loc, rot: k.rot, fov: k.fov || 60 }; });
    else if (ue.kind === "metahuman") {
      var f = framing(ue.preset || "bust", ue.turn || 0);
      o.camera_keys = [{ t: 0, loc: f.camera.loc, rot: f.camera.rot, fov: f.camera.fov }];
      o.metahuman = { bp: ue.metahuman.bp, loc: f.figure.loc, rot: f.figure.rot }; if (ue.metahuman.anim) o.metahuman.anim = ue.metahuman.anim;
      o.alpha = true;
    }
    return o;
  }
  var pure = { keyAt: keyAt, renderRequest: renderRequest };
  if (typeof module !== "undefined" && module.exports) { module.exports = pure; return; }

  function $(id) { return document.getElementById(id); }
  var tries = 0;
  function boot() { if (!$("tlStage")) return; if (!(window.TlCadBar && window.TlCadBar.addTab && window.TlCanvas && window.UEBridge)) { if (++tries < 400) setTimeout(boot, 80); return; } start(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();

  function start() {
    var C = window.TlCanvas, S = C.state, U = window.UEBridge, esc = U.esc, opt = U.opt;
    var FPS = function () { return typeof window.TLFPS === "number" ? window.TLFPS : 24; };
    var dlg = null, busy = 0;
    function closeDlg() { if (dlg) { dlg.remove(); dlg = null; } }
    function dialog(title, html, onOk, okLabel) {
      closeDlg();
      dlg = document.createElement("div"); dlg.className = "tlued"; dlg.id = "tlUeDlg";
      dlg.innerHTML = "<h4>" + esc(title) + '</h4><div class="b">' + html + '</div><div class="bt"><button class="ghost cn" type="button">Cancel</button><button class="ghost ok" type="button">' + esc(okLabel || "OK") + "</button></div>";
      document.body.appendChild(dlg);
      dlg.querySelector(".cn").onclick = closeDlg;
      dlg.querySelector(".ok").onclick = function () { if (onOk(dlg) !== false) closeDlg(); };
      dlg.addEventListener("keydown", function (e) { e.stopPropagation(); if (e.key === "Escape") closeDlg(); });
      return dlg;
    }
    if (!$("tlUeCss")) {
      var st = document.createElement("style"); st.id = "tlUeCss";
      st.textContent = ".tlued{position:fixed;left:50%;top:18%;transform:translateX(-50%);z-index:10090;min-width:380px;max-width:92vw;background:var(--pc-panel,#24211d);border:1px solid var(--line,#3a352e);border-radius:6px;box-shadow:0 10px 30px rgba(0,0,0,.55);font-size:12px;color:var(--text,#ddd)}"
        + ".tlued h4{margin:0;padding:8px 10px;border-bottom:1px solid var(--line,#3a352e)}.tlued .b{padding:8px 10px;max-height:60vh;overflow:auto}.tlued .rw{display:flex;gap:6px;align-items:center;margin:4px 0;flex-wrap:wrap}.tlued .rw>span:first-child{min-width:90px;color:var(--dim,#999)}"
        + ".tlued .bt{display:flex;justify-content:flex-end;gap:6px;padding:8px 10px;border-top:1px solid var(--line,#3a352e)}.tlued input[type=number]{width:70px}.tlued table{border-collapse:collapse;width:100%}.tlued td,.tlued th{padding:2px 4px;text-align:left;font-weight:normal}.tlued td input{width:58px}";
      document.head.appendChild(st);
    }
    function lists(kinds) {
      var out = {};
      return kinds.reduce(function (p, k) { return p.then(function () { return U.list(k).then(function (x) { out[k] = x; }, function (e) { out[k] = []; out.error = e.message; }); }); }, Promise.resolve()).then(function () { return out; });
    }
    var counters = { UE: 0, MH: 0, "UE Cam": 0 };
    function nameFor(base) { var n = 0, names = (window.tl && window.tl.vlayers ? window.tl.vlayers : []).map(function (L) { return L.name; }); do { n++; } while (names.indexOf(base + n) >= 0); return base + n; }
    /** render a c.ue -> a clip (a new layer, or `clip` made anew) */
    function make(ue, base, clip) {
      busy++;
      var t0 = clip ? clip.start : Math.round((S.t || 0) * 24) / 24;
      C.say("🎮 Unreal is rendering " + base + "…");
      return U.render(renderRequest(ue, S.W, S.H, FPS(), U.framing), function (s) { C.say("🎮 Unreal: " + (s.state === "encoding" ? "making the video…" : s.frames + " / " + s.of + " frames")); })
        .then(function (r) {
          if (clip) { clip.name = r.video; clip.dur = r.dur; clip.out = Math.min(clip.out || r.dur, r.dur); clip.in = Math.min(clip.in || 0, clip.out); clip.ue = ue; if (typeof window.tlSave === "function") window.tlSave(); if (typeof window.renderTimeline === "function") window.renderTimeline(); C.mark(); }
          else { var c = { name: r.video, src: "video", start: t0, dur: r.dur, in: 0, out: r.dur, opacity: 1, ue: ue }; C.newLayer("video", c, nameFor(base)); clip = c; }
          C.say("🎮 " + base + ": " + r.frames + " frames from Unreal" + (r.sequence ? " (" + r.sequence + ")" : ""));
          return clip;
        }).catch(function (e) { C.say("🎮 Unreal: " + e.message); return null; })
        .then(function (x) { busy--; return x; });
    }
    function sel() { var s = C.selClip && C.selClip(); return s && s.c && s.c.ue ? s : null; }
    function selCam() { var s = sel(); return s && s.c.ue.kind === "camera" ? s : null; }
    function ensure() { return U.status().then(function (st) { if (!st.connected) throw new Error(st.error); return st; }); }
    function sceneDialog() {
      return ensure().then(function (st) { return lists(["levels", "sequences", "cameras"]).then(function (l) {
        dialog("Unreal Layer", '<div class="rw"><span class="hint">Unreal ' + esc(st.engine) + " · " + esc(st.project) + "</span></div>"
          + '<div class="rw"><span>Level</span><select id="tuLv">' + opt("", "", "the one open now") + l.levels.map(function (x) { return opt(x.path, "", x.path); }).join("") + "</select></div>"
          + '<div class="rw"><span>Render</span><select id="tuWhat">' + l.sequences.map(function (x) { return opt("seq:" + (x.object || x.path), "", "the sequence " + x.name); }).join("") + l.cameras.map(function (x) { return opt("cam:" + x.name, "", "the camera " + x.name + " (held)"); }).join("") + opt("vp", "", "the level viewport now (held)") + "</select></div>"
          + '<div class="rw"><span>Length (s)</span><input type="number" id="tuDur" value="5" min="0.1" step="0.5"><span class="hint">(a sequence: its own length is used when it is shorter)</span></div>'
          + '<div class="rw"><span>Size · fps</span><input type="number" id="tuW" value="' + S.W + '"> x <input type="number" id="tuH" value="' + S.H + '"> · <input type="number" id="tuF" value="' + FPS() + '"></div>', function (d) {
          var q = function (id) { return d.querySelector("#" + id); }, what = q("tuWhat").value;
          var ue = { level: q("tuLv").value || "", dur: +q("tuDur").value || 5, w: +q("tuW").value || S.W, h: +q("tuH").value || S.H, fps: +q("tuF").value || FPS(), alpha: false };
          var go = function () { make(ue, "UE"); };
          if (/^seq:/.test(what)) { ue.kind = "sequence"; ue.sequence = what.slice(4); go(); }
          else if (/^cam:/.test(what)) { var cam = l.cameras.filter(function (x) { return x.name === what.slice(4); })[0]; ue.kind = "scene"; ue.camera = { loc: cam.loc, rot: cam.rot, fov: cam.fov, name: cam.name }; go(); }
          else U.viewport().then(function (v) { ue.kind = "scene"; ue.camera = { loc: v.loc, rot: v.rot, fov: v.fov }; go(); }).catch(function (e) { C.say("🎮 Unreal: " + e.message); });
        }, "Render");
      }); }).catch(function (e) { C.say("🎮 Unreal: " + e.message); });
    }
    function metaDialog() {
      return ensure().then(function () { return lists(["metahumans", "anims", "levels"]).then(function (l) {
        if (!l.metahumans.length) { C.say("🎮 Unreal: no MetaHumans in the project (/Game/MetaHumans/<name>/BP_<name>)"); return; }
        dialog("MetaHuman Layer", '<div class="rw"><span>MetaHuman</span><select id="tuMh">' + l.metahumans.map(function (x) { return opt(x.object || x.path, "", x.name); }).join("") + "</select></div>"
          + '<div class="rw"><span>Animation</span><select id="tuAn">' + opt("", "", "(none - its own pose)") + l.anims.map(function (x) { return opt(x.object || x.path, "", x.name); }).join("") + "</select></div>"
          + '<div class="rw"><span>Framing</span><select id="tuFr">' + opt("face", "full", "Face") + opt("bust", "full", "Bust") + opt("full", "full", "Full body") + '</select><span>Turn</span><input type="number" id="tuTu" value="0" step="15"><span>°</span></div>'
          + '<div class="rw"><span>Level (light)</span><select id="tuLv">' + opt("", "", "the one open now") + l.levels.map(function (x) { return opt(x.path, "", x.path); }).join("") + "</select></div>"
          + '<div class="rw"><span>Length (s)</span><input type="number" id="tuDur" value="5" min="0.1" step="0.5"></div>', function (d) {
          var q = function (id) { return d.querySelector("#" + id); }, mh = l.metahumans.filter(function (x) { return (x.object || x.path) === q("tuMh").value; })[0];
          make({ kind: "metahuman", level: q("tuLv").value || "", metahuman: { bp: q("tuMh").value, anim: q("tuAn").value || "", name: mh ? mh.name : "" }, preset: q("tuFr").value, turn: +q("tuTu").value || 0, dur: +q("tuDur").value || 5, w: S.W, h: S.H, fps: FPS(), alpha: true }, "MH");
        }, "Render");
      }); }).catch(function (e) { C.say("🎮 Unreal: " + e.message); });
    }
    /** a new Unreal camera: the first key from the viewport (or a level camera), the clip rendered when asked */
    function cameraNew() {
      return ensure().then(function () { return Promise.all([U.list("levels"), U.list("cameras")]).then(function (r) {
        var levels = r[0], cams = r[1];
        dialog("Unreal Camera", '<div class="rw"><span>Level</span><select id="tuLv">' + opt("", "", "the one open now") + levels.map(function (x) { return opt(x.path, "", x.path); }).join("") + "</select></div>"
          + '<div class="rw"><span>First key from</span><select id="tuFrom">' + opt("vp", "vp", "the level viewport now") + cams.map(function (x) { return opt(x.name, "", "the camera " + x.name); }).join("") + "</select></div>"
          + '<div class="rw"><span>Length (s)</span><input type="number" id="tuDur" value="5" min="0.5" step="0.5"></div>'
          + '<div class="rw hint">Then move Unreal\'s viewport, put the timeline\'s playhead later and press UNREAL ▸ ＋ Key; Render when the keys are right.</div>', function (d) {
          var q = function (id) { return d.querySelector("#" + id); }, from = q("tuFrom").value, dur = +q("tuDur").value || 5, lv = q("tuLv").value || "";
          var first = from === "vp" ? U.viewport() : Promise.resolve(cams.filter(function (x) { return x.name === from; })[0]);
          first.then(function (k) {
            var ue = { kind: "camera", level: lv, dur: dur, w: S.W, h: S.H, fps: FPS(), keys: [{ t: 0, loc: k.loc, rot: k.rot, fov: k.fov || 60 }] };
            make(ue, "UE Cam");
          }).catch(function (e) { C.say("🎮 Unreal: " + e.message); });
        }, "Render");
      }); }).catch(function (e) { C.say("🎮 Unreal: " + e.message); });
    }
    /** ＋ Key: the viewport now -> a key at the playhead of the picked Unreal camera clip */
    function addKey() {
      var s = selCam(); if (!s) { C.say("🎮 pick an Unreal camera clip first (UNREAL ▸ Unreal Camera)"); return Promise.resolve(null); }
      var t = Math.max(0, Math.min(s.c.ue.dur, (S.t || 0) - (s.c.start || 0) + (s.c.in || 0)));
      return U.viewport().then(function (v) {
        var keys = s.c.ue.keys.filter(function (k) { return Math.abs(k.t - t) > 1e-3; });
        keys.push({ t: Math.round(t * 1000) / 1000, loc: v.loc, rot: v.rot, fov: (keyAt(s.c.ue.keys, t) || {}).fov || v.fov || 60 });
        keys.sort(function (a, b) { return a.t - b.t; }); s.c.ue.keys = keys;
        if (typeof window.tlSave === "function") window.tlSave();
        C.say("🎮 key " + keys.length + " at " + t.toFixed(2) + " s from Unreal's viewport - UNREAL ▸ Render Again to see it");
        return keys.length;
      }).catch(function (e) { C.say("🎮 Unreal: " + e.message); return null; });
    }
    function keysDialog() {
      var s = selCam(); if (!s) { C.say("🎮 pick an Unreal camera clip first"); return; }
      var keys = JSON.parse(JSON.stringify(s.c.ue.keys));
      var row = function (k, i) { var n = function (f, j, v) { return '<td><input type="number" step="any" data-k="' + i + '" data-f="' + f + '" data-j="' + j + '" value="' + (Math.round(v * 100) / 100) + '"></td>'; };
        return "<tr>" + n("t", 0, k.t) + [0, 1, 2].map(function (j) { return n("loc", j, k.loc[j]); }).join("") + [0, 1, 2].map(function (j) { return n("rot", j, k.rot[j]); }).join("") + n("fov", 0, k.fov || 60) + '<td><button class="ghost" data-x="' + i + '" type="button">✕</button></td></tr>'; };
      var ln = s.c.ue.lens || {};
      var lensRow = '<div class="rw"><span>Lens</span><input type="number" id="tuLf" step="0.5" value="' + (ln.focal || "") + '" placeholder="mm" title="Focal length (mm) - empty = the keys\' field of view"><span>mm</span>'
        + '<select id="tuLa">' + opt("", ln.fstop || "", "f-stop (no depth of field)") + U.FSTOPS.map(function (f) { return opt(f, ln.fstop || "", "f/" + f); }).join("") + "</select>"
        + '<input type="number" id="tuLd" step="10" value="' + (ln.focus || "") + '" placeholder="focus cm" title="Focus distance (cm)"><span>EV</span><input type="number" id="tuLe" step="0.1" value="' + (ln.exposure || 0) + '" style="width:54px"></div>';
      var d = dialog("Unreal Camera Keys - " + (s.Ly && s.Ly.L ? s.Ly.L.name : ""), lensRow + '<table><tr><th>time</th><th>X</th><th>Y</th><th>Z</th><th>roll</th><th>pitch</th><th>yaw</th><th>fov</th><th></th></tr>' + keys.map(row).join("") + '</table><div class="rw hint">Unreal centimetres, degrees. The camera moves straight between keys.</div>', function (dl) {
        dl.querySelectorAll("[data-k]").forEach(function (inp) { var k = keys[+inp.dataset.k]; if (!k) return; var v = +inp.value; if (inp.dataset.f === "t" || inp.dataset.f === "fov") k[inp.dataset.f] = v; else k[inp.dataset.f][+inp.dataset.j] = v; });
        s.c.ue.keys = keys.filter(Boolean).sort(function (a, b) { return a.t - b.t; });
        var L2 = {}, fv = +dl.querySelector("#tuLf").value, fs = +dl.querySelector("#tuLa").value, fd = +dl.querySelector("#tuLd").value, ev = +dl.querySelector("#tuLe").value;
        if (fv > 0) L2.focal = fv; if (fs > 0) L2.fstop = fs; if (fd > 0) L2.focus = fd; if (ev) L2.exposure = ev;
        if (fv > 0) s.c.ue.keys.forEach(function (k) { k.fov = U.fovOf(fv, 36); });
        if (Object.keys(L2).length) s.c.ue.lens = L2; else delete s.c.ue.lens;
        if (typeof window.tlSave === "function") window.tlSave();
        make(s.c.ue, "UE Cam", s.c);
      }, "Render");
      d.querySelectorAll("[data-x]").forEach(function (b) { b.onclick = function () { if (keys.filter(Boolean).length < 2) return; keys[+b.dataset.x] = null; b.closest("tr").remove(); }; });
    }
    /** 2.476.0: Lights & Fog of the picked Unreal clip (static/uerig.js's panel) - or the image editor's layer's */
    function lightsDialog() {
      var s = sel(); if (!s) { C.say("🎮 pick a clip made with Unreal first (UNREAL ▸ Unreal Layer / MetaHuman Layer / Unreal Camera)"); return; }
      if (!window.UERig) { C.say("static/uerig.js is not loaded"); return; }
      var rig = JSON.parse(JSON.stringify(s.c.ue.rig || { lights: [], fog: {} }));
      var camOf = function () { var k = s.c.ue.keys && s.c.ue.keys[0]; if (k) return { loc: k.loc, rot: k.rot, fov: k.fov || 60 }; if (s.c.ue.camera && s.c.ue.camera.loc) return s.c.ue.camera; return U.framing(s.c.ue.preset || "bust", s.c.ue.turn || 0).camera; };
      var d = dialog("Lights & Fog - " + (s.Ly && s.Ly.L ? s.Ly.L.name : "Unreal"), '<div class="rw"><button class="ghost" type="button" id="tuIeRig" title="The lights + fog of the Unreal / MetaHuman layer picked in the image editor">⇦ The image editor\'s lights</button></div><div id="tuRig"></div>', function () {
        s.c.ue.rig = window.UERig.empty(rig) ? undefined : rig;
        if (typeof window.tlSave === "function") window.tlSave();
        make(s.c.ue, s.c.ue.kind === "metahuman" ? "MH" : s.c.ue.kind === "camera" ? "UE Cam" : "UE", s.c);
      }, "Render");
      d.style.minWidth = "460px";
      var host = d.querySelector("#tuRig"), ed = window.UERig.editor(host, rig, function (r) { rig = r; }, { cam: camOf });
      d.querySelector("#tuIeRig").onclick = function () {
        var E = window.imageEditorInstance && window.imageEditorInstance.E, L = E && E.layer();
        if (!L || !L.smart || !L.smart.ue || !L.smart.ue.rig) { C.say("🎮 pick an Unreal / MetaHuman layer with lights in the image editor first"); return; }
        rig = JSON.parse(JSON.stringify(L.smart.ue.rig)); ed = window.UERig.editor(host, rig, function (r) { rig = r; }, { cam: camOf });
        C.say("🎮 the image editor's lights + fog (" + rig.lights.length + " light(s)) - Render to use them");
      };
      void ed;
    }
    /* 2.540.0: 🎬 Render to Real - the clip's first frame + the reference docker's pictures -> 3DREAL */
    function camAtStart(ue) {
      if (ue.kind === "camera" && ue.keys && ue.keys.length) { var k = keyAt(ue.keys, 0); return { loc: k.loc, rot: k.rot, fov: k.fov || 60 }; }
      if (ue.kind === "metahuman") return U.framing(ue.preset || "bust", ue.turn || 0).camera;
      if (ue.camera) return ue.camera;
      return null;                                         // a Level Sequence: its own camera - not known here
    }
    function realDialog() {
      var s = sel(); if (!s) { C.say("🎮 pick a clip made with Unreal first (UNREAL ▸ Unreal Layer / Unreal Camera)"); return Promise.resolve(null); }
      if (!window.RealRefs) { C.say("static/realrefs.js is not loaded"); return Promise.resolve(null); }
      var ue = s.c.ue, cam = camAtStart(ue), refs = window.H3Refs ? window.H3Refs.images() : [], objs = null, man = JSON.parse(JSON.stringify(ue.rr || {}));
      var html = '<div class="rw"><span class="hint">' + esc(s.c.name) + " · " + (s.c.dur || 0).toFixed(1) + " s - its first frame becomes a photo with the reference docker's pictures, then LTX 2.3 3DREAL animates it along the clip</span></div>"
        + '<div class="rw"><button class="ghost" type="button" id="tuFind">🔍 Find the objects</button><span class="hint" id="tuFindMsg">' + (cam ? "" : "a Level Sequence: names only (its camera is the sequence's)") + "</span></div>"
        + '<div id="tuRefs"><div class="hint">' + (refs.length ? "press 🔍 to list the objects" : "the reference docker has no pictures - drop some in its Image tab") + "</div></div>"
        + '<div class="rw"><span>Looks like</span><textarea id="tuLook" rows="2" style="flex:1" placeholder="golden hour, wet street …"></textarea></div>'
        + '<div class="rw"><span>3DREAL</span><select id="tuReal"><option value="">Auto (newest)</option><option value="3DREAL-strong-v2.safetensors">strong v2</option><option value="3DREAL-strong.safetensors">strong</option><option value="3DREAL-light.safetensors">light</option></select>'
        + '<span>Strength</span><input type="number" id="tuStr" min="0" max="2" step="0.05" value="1"></div>';
      var d = dialog("Render to Real - " + (s.Ly && s.Ly.L ? s.Ly.L.name : "Unreal"), html, function (dd) {
        var items = window.RealRefs.resolve(objs || [], refs, man);
        if (!items.length) { C.say("🖼 no object has a reference picture yet - 🔍 Find the objects, then pick pictures (or name the actors after them)"); return false; }
        ue.rr = man; if (typeof window.tlSave === "function") window.tlSave();
        var look = dd.querySelector("#tuLook").value, ic = dd.querySelector("#tuReal").value, str = +dd.querySelector("#tuStr").value || 1;
        C.say("🖼 uploading " + new Set(items.map(function (x) { return x.ref; })).size + " reference picture(s)…");
        window.RealRefs.upload(items, refs).then(function (up) {
          return fetch("/api/realrefs/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "video", source: "unreal", token: up.token, items: up.items, video_asset: s.c.name, seconds: s.c.dur, prompt: look, ltx: { ic_lora: ic, ic_strength: str } }) })
            .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || "refused"); return j; }); });
        }).then(function (j) {
          C.say("🖼 " + j.note + " - first frame job " + j.edit);
          if (typeof window.refreshJobs === "function") window.refreshJobs();
          return window.RealRefs.follow(j.id, function (st) { C.say(window.RealRefs.stepText(st)); });
        }).catch(function (e) { C.say("🖼 " + e.message); });
      }, "🎬 Render to Real");
      d.style.minWidth = "460px";
      function paintList() { var h = d.querySelector("#tuRefs"); h.innerHTML = window.RealRefs.listHtml(objs || [], refs, man); window.RealRefs.bindList(h, function (name, v) { if (v === "") delete man[name]; else man[name] = v; paintList(); }); }
      d.querySelector("#tuFind").onclick = function () {
        var m = d.querySelector("#tuFindMsg"); m.textContent = "asking Unreal…";
        var req = { camera: cam || { viewport: true }, w: ue.w || S.W || 1280, h: ue.h || S.H || 720 }; if (ue.level) req.level = ue.level;
        U.actors(req).then(function (j) { objs = (j.objects || []).map(function (o) { return { name: o.name, box: cam ? o.box : null }; }); m.textContent = objs.length + " object(s)" + (cam ? " in view" : ""); paintList(); })
          .catch(function (e) { m.textContent = e.message + (/unknown command/.test(e.message) ? " - update the bitGen Bridge plugin to 1.3.0 (🎮 Load UE project)" : ""); });
      };
      return Promise.resolve(d);
    }
    function again() { var s = sel(); if (!s) { C.say("🎮 pick a clip made with Unreal first"); return Promise.resolve(null); } return make(s.c.ue, s.c.ue.kind === "metahuman" ? "MH" : s.c.ue.kind === "camera" ? "UE Cam" : "UE", s.c); }
    var sv = function (p) { return '<svg viewBox="0 0 24 24">' + p + "</svg>"; };
    window.TlCadBar.addTab({ id: "unreal", label: "Unreal", groups: [
      { label: "Layers", show: 3, items: [
        { id: "u_scene", label: "Unreal Layer", icon: sv('<circle cx="12" cy="12" r="9"/><path d="M8 16V9l4 3 4-3v7"/>'), run: sceneDialog },
        { id: "u_mh", label: "MetaHuman Layer", icon: sv('<circle cx="12" cy="7" r="3.5"/><path d="M5 21c0-4 3-7 7-7s7 3 7 7"/>'), run: metaDialog },
        { id: "u_cam", label: "Unreal Camera", icon: "🎥", run: cameraNew }] },
      { label: "Camera", show: 3, items: [{ id: "u_key", label: "＋ Key", icon: "◆", run: addKey, enabled: function () { return !!selCam(); } }, { id: "u_keys", label: "Keys…", icon: "☰", run: keysDialog, enabled: function () { return !!selCam(); } },
        { id: "u_again", label: "Render Again", icon: "⟳", run: again, enabled: function () { return !!sel(); } }] },
      { label: "Real", show: 1, items: [{ id: "u_real", label: "Render to Real", icon: "🎬", run: realDialog, enabled: function () { return !!sel(); } }] },   // 2.540.0
      { label: "Lights", show: 1, items: [{ id: "u_lights", label: "Lights & Fog…", icon: "💡", run: lightsDialog, enabled: function () { return !!sel(); } }] },
      { label: "Bridge", show: 1, items: [{ id: "u_set", label: "Unreal Settings", icon: "⚙", run: function () { if (window.Settings3D) window.Settings3D.open(); } },
        { id: "u_st", label: "Check the Link", icon: "🔗", run: function () { U.status().then(function (s) { C.say(s.connected ? "🎮 Unreal " + s.engine + ": " + s.project + " · " + s.level : "🎮 Unreal: " + s.error); }); } }] },
    ] });
    window.TlUnreal = { realDialog: realDialog, camAtStart: camAtStart, lightsDialog: lightsDialog, sceneDialog: sceneDialog, metaDialog: metaDialog, cameraNew: cameraNew, addKey: addKey, keysDialog: keysDialog, again: again, make: make, busy: function () { return busy > 0; }, keyAt: keyAt, renderRequest: renderRequest };
  }
})();
