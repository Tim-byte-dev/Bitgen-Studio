/* bitGen Studio — the timeline docker's PREVIEW CANVAS, TOOLBAR and LAYERS panel (2.377.0).
 *
 * Tim (verbatim): "Add a preview canvas to the timeline docker. user can drag videos, pictures and audio into the
 * canvas and it gets placed on a separate layer. user will be able to enter text and edit text. create a layers
 * docker on the right of the timeline docker the same height as the preview canvas, add a photoshop style toolbar
 * to the left of the preview canvas. user will be able to play preview in the preview canvas, similar to after
 * effects".
 *
 * THE COMPOSITION IS THE TIMELINE. Nothing here has its own copy: the canvas draws `tl` (the core page's timeline)
 * at the playhead, bottom to top exactly as the compile does - V1 (the base picture, fitted), the video layers V2+
 * in order (each at its own pixel size, centred), then the image / text layers in order (width capped at the
 * picture's). A clip's `tf` {x, y, scale, rot} (lib/clipTransform.js) moves it; the compile (worker.py _tf_chain)
 * draws the same, so what the canvas shows is what Compile writes.
 *
 *   toolbar (left)   ✥ Move (V) - select / drag / corner handles scale / the top handle rotates (Shift: 15°)
 *                    T  Text (T) - click to make a text layer; click a text layer to edit it
 *                    ✋ Hand (H, or hold Space) - pan the view      🔍 Zoom (Z; Alt-click out)      ⤢ Fit
 *                    the text colour swatch
 *   canvas           drop videos / pictures / sounds (assets, the gallery, or files from the computer): each lands
 *                    on a NEW layer at the playhead, where it was dropped (V1 only while it is empty)
 *   transport        ⏮ ▶/⏸ ⏹ ⏭, the timecode (h:mm:ss:ff at 24 fps), 🔁 loop (the ruler selection, else all),
 *                    the zoom, the picture size. Space plays / pauses while the pointer is over the stage. Playback
 *                    runs every layer's video and sound in step and drives the timeline's position marker.
 *   layers (right)   every layer top to bottom: 👁 visibility, the name (double-click renames), ▲ ▼ order (within
 *                    its kind - the compile draws all video layers, then all image layers), 🗑 delete; then the
 *                    selected clip's properties: X, Y, Scale, Rotation, Opacity, and for a text layer its text,
 *                    font, size, colour, bold / italic, outline, shadow, alignment, duration.
 * A TEXT layer is an image clip carrying `text`; its picture is drawn here and saved as images/text_<id>.png
 * (routes/tlCanvas.js) for the compile.
 * 2.382.0: a 3D layer is a VIDEO-layer clip carrying `m3d` - drawn live by static/m3d.js (three.js), baked into
 * video/m3d_<id>.webm for the compile; its own panel / menu / bake are ext/timelinedock/m3d.js (window.TlM3D).
 */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }
  // extension scripts load BEFORE the core page's script (lib/extensions.js) - start once the timeline exists
  function ready() { try { return typeof tl === "object" && tl && typeof renderTimeline === "function"; } catch (e) { return false; } }
  function boot() {
    if (!$("tlCanvas")) return;
    if (!ready()) { setTimeout(boot, 50); return; }
    start();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  function start() {

  var FPS = typeof TLFPS === "number" ? TLFPS : 24;
  var cv = $("tlCanvas"), ctx = cv.getContext("2d");
  var S = {
    tool: "move", playing: false, loop: false, t: 0, base: 0, t0: 0, raf: 0,
    view: { fit: true, z: 1, ox: 0, oy: 0 }, W: 1280, H: 720,
    drag: null, spaceHand: false, over: false, color: "#ffffff", dirty: true,
  };
  var vids = new WeakMap(), auds = new WeakMap(), imgs = new Map(), texts = new Map();
  var pending = {};            // text id -> timer (PNG upload)

  /* ------------------------------------------------------------------ the stage's own CSS */
  var CSS = ""
    // the stage takes up to its own height and SHRINKS with a short docker; the tracks keep at least 70 px
    + "#tlStage{display:flex;gap:6px;flex:0 1 var(--tlsh,320px);min-height:0;margin-bottom:4px;overflow:hidden}"
    + "#timelinedock #tlscroll{min-height:70px}"
    + "#tlStage.off{display:none}"
    + "#tlTools{display:flex;flex-direction:column;gap:3px;width:38px;flex:none;padding:4px 3px;background:#16130f;"
    + "border:1px solid var(--line);border-radius:6px;align-items:center;overflow-y:auto;overflow-x:hidden}"
    + "#tlTools button{width:30px;height:30px;padding:0;font-size:15px;line-height:1;display:flex;align-items:center;justify-content:center}"
    + "#tlTools button.on{background:var(--tiger);color:#14120f;border-color:var(--tiger)}"
    + "#tlTools .tlt-sep{width:24px;height:1px;background:var(--line);margin:3px 0}"
    + "#tlTools input[type=color]{width:28px;height:28px;padding:0;border:1px solid var(--line);border-radius:4px;background:none;cursor:pointer}"
    + "#tlCanvasCol{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}"
    + "#tlCanvasWrap{position:relative;flex:1;min-height:0;background:#0b0a08;border:1px solid var(--line);border-radius:6px;overflow:hidden;outline:none}"
    + "#tlCanvasWrap.drop{border-color:var(--tiger);box-shadow:inset 0 0 0 2px var(--tiger)}"
    + "#tlCanvas{position:absolute;inset:0;width:100%;height:100%;display:block}"
    + "#tlCanvasWrap .tlc-hint:empty{display:none}"
    + "#tlCanvasWrap .tlc-hint{position:absolute;left:8px;bottom:6px;font-size:.66rem;color:var(--dim);pointer-events:none;"
    + "background:rgba(0,0,0,.5);padding:1px 6px;border-radius:3px;max-width:70%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}"
    + "#tlCTrans{display:flex;gap:4px;align-items:center;flex:none;font-size:.7rem;min-width:0;overflow:hidden}"   // 2.418.0: never widens the column (⏱ + ½ beside ▶)
    + "#tlCTrans button{padding:2px 8px;font-size:.74rem}"
    + "#tlCTrans button.on{color:var(--tiger);border-color:var(--tiger)}"
    + "#tlCTime{font-family:var(--mono);font-size:.74rem;color:var(--text);min-width:92px;text-align:center}"
    + "#tlCInfo{margin-left:auto;color:var(--dim);font-family:var(--mono);font-size:.66rem;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"
    + "#tlLayersPanel{width:250px;flex:none;display:flex;flex-direction:column;border:1px solid var(--line);border-radius:6px;background:#16130f;min-height:0;overflow:hidden}"
    + "#tlLayersPanel .tll-head{display:flex;align-items:center;gap:6px;padding:4px 8px;border-bottom:1px solid var(--line);"
    + "font-size:.68rem;letter-spacing:.12em;text-transform:uppercase;color:var(--dim)}"
    + "#tlLayersPanel .tll-head button{margin-left:auto;padding:0 6px;font-size:.72rem}"
    + "#tlLayerList{flex:1;min-height:40px;overflow:auto}"
    + ".tll-row{display:flex;align-items:center;gap:4px;padding:3px 6px;font-size:.74rem;border-left:3px solid transparent;cursor:default}"
    + ".tll-row:hover{background:rgba(255,255,255,.04)}"
    + ".tll-row.sel{background:rgba(245,158,44,.14);border-left-color:var(--tiger)}"
    + ".tll-row .tll-ic{width:18px;text-align:center;flex:none}"
    + ".tll-row .tll-nm{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}"
    + ".tll-row .tll-nm small{color:var(--dim)}"
    + ".tll-row .tll-name{cursor:text}"
    + ".tll-row .tll-name.editing{outline:1px solid var(--tiger);background:var(--ink);padding:0 3px;border-radius:3px;font-weight:600}"
    + ".tll-row button{padding:0 4px;font-size:.7rem;line-height:1.3;min-width:0}"
    + ".tll-row button.eye.offv{opacity:.35}"
    + "#tlProps{border-top:1px solid var(--line);padding:6px 8px;max-height:60%;overflow:auto;font-size:.72rem;flex:0 1 auto;min-height:0}"
    + "#tlProps .tlp-t{font-size:.66rem;letter-spacing:.1em;text-transform:uppercase;color:var(--dim);margin-bottom:4px}"
    + "#tlProps .tlp-g{display:grid;grid-template-columns:auto 1fr auto 1fr;gap:4px 6px;align-items:center}"
    + "#tlProps input,#tlProps select,#tlProps textarea{width:100%;font-size:.72rem;padding:2px 4px;min-width:0}"
    + "#tlProps textarea{resize:vertical;min-height:44px;font-family:var(--body)}"
    + "#tlProps .tlp-row{display:flex;gap:6px;align-items:center;margin-top:4px}"
    + "#tlProps .tlp-row label{display:flex;gap:3px;align-items:center;white-space:nowrap}"
    + "#tlProps .tlp-row input[type=checkbox]{width:auto}"
    + "#tlProps .tlp-row input[type=color]{width:26px;height:20px;padding:0}"
    + "#tlProps .tlp-none{color:var(--dim)}"
    + "#tlProps .tlp-keys button{padding:1px 7px;font-size:.74rem}"
    + "#tlProps .tlp-keys button:disabled{opacity:.35}"
    + ".tlstagesplit{height:5px;cursor:ns-resize;flex:none;margin:0 0 4px;border-radius:2px;background:transparent}"
    + ".tlstagesplit:hover{background:var(--line)}";
  if (!$("tlCanvasCss")) { var st = document.createElement("style"); st.id = "tlCanvasCss"; st.textContent = CSS; document.head.appendChild(st); }

  /* ------------------------------------------------------------------ small helpers */
  function storeGet(k, d) { try { return typeof store === "object" ? store.get(k, d) : d; } catch (e) { return d; } }
  function storeSet(k, v) { try { if (typeof store === "object") store.set(k, v); } catch (e) { /* fine */ } }
  function say(t) { var h = $("tlCHint"); if (h) h.textContent = t || ""; }
  function log(t) { if (typeof logLine === "function") logLine(t); }
  function num(v, d) { var n = Number(v); return Number.isFinite(n) ? n : d; }
  function fsnap(t) { return Math.round(t * FPS) / FPS; }
  function tc(t) {
    t = Math.max(0, t || 0);
    var f = Math.round(t * FPS), fr = f % FPS, s = Math.floor(f / FPS);
    var p = function (x) { return String(x).padStart(2, "0"); };
    return Math.floor(s / 3600) + ":" + p(Math.floor(s / 60) % 60) + ":" + p(s % 60) + ":" + p(fr);
  }
  function tfOf(c) { var t = c.tf || {}; return { x: num(t.x, 0), y: num(t.y, 0), scale: num(t.scale, 1), rot: num(t.rot, 0), ax: num(t.ax, 0), ay: num(t.ay, 0) }; }   // 2.489.0: + the anchor point
  function setTf(c, p) { var t = tfOf(c); for (var k in p) t[k] = p[k]; c.tf = t; }
  /* 2.379.0 KEYFRAMES ON THE CANVAS (static/keyframes.js): a clip's position / scale / rotation / opacity / text colour
     at time t tween between its ◆ keyframes; `tau` = seconds into the clip. A property that has keyframes is AUTO-KEYED
     when it is changed (After Effects' stopwatch): the change goes into the keyframe at the playhead (made if needed);
     a property with no keyframes changes the clip's static value as before. */
  var KF = window.H3Keyframes || { value: function (k, a, p, fb) { return fb; }, has: function () { return false; },
                                   set: function (k) { return k; }, find: function () { return null; }, step: function () { return null; },
                                   remove: function (k) { return k; } };
  function clipLen(c, kind) { return Math.max(0, clipEnd(c, kind) - (c.start || 0)); }
  function tauOf(c, kind, t) { return Math.max(0, Math.min(clipLen(c, kind), (t == null ? S.t : t) - (c.start || 0))); }
  function kindOf(c) { var Ly = layerOf(c); return Ly ? Ly.kind : (c.text || c.len != null ? "img" : "vl"); }
  function tfAt(c, t) {
    var b = tfOf(c);
    if ((!c.kf || !c.kf.length) && !c.expr) return b;
    var tau = (t == null ? S.t : t) - (c.start || 0);
    var o = { x: num(KF.value(c.kf, tau, "x", b.x), b.x), y: num(KF.value(c.kf, tau, "y", b.y), b.y),
             scale: Math.max(0.01, num(KF.value(c.kf, tau, "scale", b.scale), b.scale)), rot: num(KF.value(c.kf, tau, "rot", b.rot), b.rot),
             ax: num(KF.value(c.kf, tau, "ax", b.ax), b.ax), ay: num(KF.value(c.kf, tau, "ay", b.ay), b.ay) };
    return c.expr && window.TlExpr && TlExpr.tf ? TlExpr.tf(c, tau, o) : o;            // 2.497.0: ƒx expressions
  }
  function textAt(c, t) {
    if (!c.text || !KF.has(c.kf, "color")) return c.text;
    var o = {}; for (var k in c.text) o[k] = c.text[k];
    o.color = KF.value(c.kf, (t == null ? S.t : t) - (c.start || 0), "color", c.text.color);
    return o;
  }
  function opAt(c, t) { var o = c.opacity == null ? 1 : +c.opacity; return KF.value(c.kf, (t == null ? S.t : t) - (c.start || 0), "op", o); }
  /* write position / scale / rotation: into the keyframe at the playhead when that property is keyed, else static */
  function writeTf(c, p) {
    var keyed = {}, plain = {}, any = false;
    Object.keys(p).forEach(function (k) {
      var grp = (k === "x" || k === "y") ? ["x", "y"] : [k];
      if (grp.some(function (g) { return KF.has(c.kf, g); })) { keyed[k] = p[k]; any = true; } else plain[k] = p[k];
    });
    if (Object.keys(plain).length) setTf(c, plain);
    if (any) {
      // a position key always holds BOTH x and y (one point, like After Effects' Position)
      var now = tfAt(c);
      if ("x" in keyed && !("y" in keyed)) keyed.y = now.y;
      if ("y" in keyed && !("x" in keyed)) keyed.x = now.x;
      var n0 = (c.kf || []).length;
      c.kf = KF.set(c.kf, tauOf(c, kindOf(c)), keyed, FPS);
      afterKey(c, n0);
    }
    return any;
  }
  function writeKeyed(c, prop, v) {           // opacity / colour: keyed when keyed
    if (!KF.has(c.kf, prop)) return false;
    var o = {}, n0 = (c.kf || []).length; o[prop] = v;
    c.kf = KF.set(c.kf, tauOf(c, kindOf(c)), o, FPS);
    afterKey(c, n0);
    return true;
  }
  /* an auto-key that MADE a new keyframe: its diamond appears on the timeline and the ◆ row updates (debounced -
     a drag makes the key once, then moves it) */
  function afterKey(c, n0) {
    var K = $("tlpKeys"); if (K) K._sig = null;
    if ((c.kf || []).length !== n0) S.akNew = true;
    clearTimeout(S.akT);
    S.akT = setTimeout(function () {
      var sel = selClip(); if (sel && sel.c === c) paintKeys(c, sel);
      if (S.akNew && typeof renderTimeline === "function") renderTimeline();
      S.akNew = false;
    }, 80);
  }
  function clipEnd(c, kind) { return (c.start || 0) + (kind === "img" ? imgLen(c) : effDur(c)); }
  function at(c, kind, t) { return t >= (c.start || 0) - 1e-6 && t < clipEnd(c, kind) - 1e-6; }
  /* 2.406.0: a clip's 🎬 speed / reverse / ramp (static/clipfx.js - the compile's own segments). srcAt = the source
     second shown at timeline second t; a constant forward speed PLAYS at that rate, a reversed or ramped clip is
     SEEK-driven (paused, the frame chosen every paint) - browsers cannot play backwards */
  function FXm() { return window.H3ClipFx || null; }
  function retimed(c) { var F = FXm(); return !!(F && c && c.fx && F.retimed(c.fx)); }
  function srcAt(c, t) {
    if (!retimed(c)) return (c.in || 0) + (t - (c.start || 0));
    return FXm().srcTime(Object.assign({}, c, { out: c.out != null ? c.out : c.dur }), t - (c.start || 0));
  }
  /** 2.515.0: the video element's own time for timeline time t (a cut-out's file starts later in the source) */
  function vidOff(c) { return window.TlCutout && TlCutout.off ? TlCutout.off(c) : 0; }
  function vidAt(c, t) { return srcAt(c, t) - vidOff(c); }
  function seekDriven(c) { return retimed(c) && !!(c.fx.reverse || c.fx.ramp || c.fx.remap); }   // 2.501.0: + a time remap
  function playRate(c) { return retimed(c) && !seekDriven(c) ? Math.max(0.0625, Math.min(16, +c.fx.speed || 1)) : 1; }
  function liveL(L) { try { return typeof layerLive === "function" ? layerLive(L) : L.visible !== false; } catch (e) { return true; } }
  function opac(c, L, t) {
    var o = c.opacity == null ? 1 : +c.opacity;   // the keyframes' "op" (kfValue -> static/keyframes.js) wins below
    try { if (typeof kfValue === "function") o = kfValue(c, t - (c.start || 0), "op", o); } catch (e) { /* plain */ }
    if (c.expr && c.expr.op && window.TlExpr && TlExpr.num) o = TlExpr.num(c, "op", t - (c.start || 0), o);   // 2.497.0: ƒx
    return Math.max(0, Math.min(1, o)) * (L && L.opacity != null ? +L.opacity : 1);
  }
  function vidUrl(c) {
    // 2.515.0: a 🧍 cut-out video layer plays the file it was cut out into (tlcutout.js - its alpha; vidOff = where it starts)
    if (window.TlCutout && TlCutout.url) { var cu = TlCutout.url(c); if (cu) return cu; }
    // 2.413.0: a ✨ stabilised clip plays its steady preview once it is made (ext/timelinedock/stabilise.js)
    if (window.TlStab && c && c.fx && c.fx.vfx && c.fx.vfx.stabilise) { var su = TlStab.url(c); if (su) return su; }
    if (window.TlProxy) { var pu = TlProxy.url(c); if (pu) return pu; }       // 2.416.0: 🪶 a proxy (the compile reads the original)
    if (c.src === "video") return "/passets/video/" + encodeURIComponent(c.name);
    if (c.src === "final") return "/outputs/" + encodeURIComponent(c.name) + "?where=final";
    return "/outputs/" + encodeURIComponent(c.name);
  }

  /* ------------------------------------------------------------------ the layer stack (compile order) */
  function stack() {
    var out = [];
    out.push({ kind: "v1", lk: "v1", L: (typeof v1 === "function" ? v1() : (tl.v1 || {})), clips: tl.video || [] });
    (tl.vlayers || []).forEach(function (L, i) { out.push({ kind: "vl", lk: "vl:" + i, L: L, clips: L.clips || [] }); });
    (tl.images || []).forEach(function (L, i) { out.push({ kind: "img", lk: "i:" + i, L: L, clips: L.clips || [] }); });
    return out;
  }
  function audioStack() { return (tl.audio || []).map(function (L, i) { return { kind: "aud", lk: "a:" + i, L: L, clips: L.clips || [] }; }); }
  function layerOf(c) {
    var all = stack().concat(audioStack());
    for (var i = 0; i < all.length; i++) if (all[i].clips.indexOf(c) >= 0) return all[i];
    return null;
  }

  /* ------------------------------------------------------------------ media */
  function video(c) {
    var v = vids.get(c);
    var url = vidUrl(c);
    if (!v || v._url !== url) {
      if (v) { try { v.pause(); v.removeAttribute("src"); v.load(); } catch (e) { /* gone */ } }
      v = document.createElement("video");
      v.preload = "auto"; v.muted = true; v.playsInline = true; v.crossOrigin = "anonymous"; v._url = url; v.src = url;
      v.addEventListener("loadeddata", mark); v.addEventListener("seeked", mark); v.addEventListener("loadedmetadata", function () { comp(); mark(); });
      vids.set(c, v);
    }
    return v;
  }
  function audio(c) {
    var a = auds.get(c);
    var url = typeof soundUrl === "function" ? soundUrl(c) : "/passets/sound/" + encodeURIComponent(c.name);   // 2.412.0: a video's sound taken out
    if (!a || a._url !== url) { a = new Audio(); a.preload = "auto"; a._url = url; a.src = url; auds.set(c, a); }
    return a;
  }
  function image(name) {
    var url = "/passets/images/" + encodeURIComponent(name);
    var im = imgs.get(url);
    if (!im) { im = new Image(); im.onload = mark; im.src = url; imgs.set(url, im); }
    return im;
  }

  /* ------------------------------------------------------------------ TEXT: drawn here, saved as a PNG */
  var FONTS = ["Arial", "Arial Black", "Impact", "Georgia", "Times New Roman", "Verdana", "Trebuchet MS", "Courier New", "Comic Sans MS"];
  function textDefaults() {
    return { content: "Your text", font: "Arial", size: Math.max(12, Math.round(S.H * 0.08)), color: S.color || "#ffffff",
             bold: true, italic: false, stroke: "#000000", strokeW: Math.max(0, Math.round(S.H * 0.004)), shadow: true, align: "center" };
  }
  /* 2.411.0: a TEXT EFFECT PRESET (t.fx - static/textfx.js): drawn through the PSD effect's stack, LIVE - a quick picture
     while typing, the sharp one when typing pauses (then the canvas redraws); ⚙ Compile always gets the sharp one */
  function fxSpec(t) {
    t = filled(t);                                     // 2.511.0: 📋 data in a preset text too
    return { text: t.content, font: t.font || "Arial", size: Math.max(4, Math.min(1000, num(t.size, 48))), weight: t.bold ? 700 : 400, italic: !!t.italic,
             align: t.align === "left" || t.align === "right" ? t.align : "center", leading: 1.22, color: t.color || "#ffffff" };
  }
  /** 2.511.0: 📋 {{set.column}} in a text filled from the timeline's data (tldata.js) */
  function filled(t) { return t && window.TlData && TlData.fill && /\{\{/.test(String(t.content || "")) ? Object.assign({}, t, { content: TlData.fill(String(t.content)) }) : t; }
  function renderText(t) {
    t = filled(t);
    var key = JSON.stringify(t);
    var hit = texts.get(key);
    if (hit) return hit;
    if (t.fx && window.H3TextFx) {
      var fr = H3TextFx.live("tl:" + t.fx, fxSpec(t), t.fx, function () { mark(); });
      if (fr) { if (!fr.fast) { if (texts.size > 60) texts.clear(); texts.set(key, fr.canvas); } return fr.canvas; }
    }
    var c = document.createElement("canvas"), x = c.getContext("2d");
    var size = Math.max(4, Math.min(1000, num(t.size, 48)));
    var font = (t.italic ? "italic " : "") + (t.bold ? "bold " : "") + size + "px \"" + (t.font || "Arial") + "\", sans-serif";
    var lines = String(t.content == null ? "" : t.content).split("\n");
    x.font = font;
    var sw = Math.max(0, num(t.strokeW, 0)), sh = t.shadow ? Math.max(2, Math.round(size * 0.06)) : 0;
    var w = 1;
    lines.forEach(function (l) { w = Math.max(w, x.measureText(l || " ").width); });
    var lh = Math.round(size * 1.22), pad = Math.ceil(sw + sh + size * 0.15);
    c.width = Math.max(2, Math.ceil(w + pad * 2)); c.height = Math.max(2, Math.ceil(lh * lines.length + pad * 2));
    x.font = font; x.textBaseline = "middle"; x.lineJoin = "round";
    var align = t.align === "left" || t.align === "right" ? t.align : "center";
    x.textAlign = align;
    var ax = align === "left" ? pad : align === "right" ? c.width - pad : c.width / 2;
    lines.forEach(function (l, i) {
      var y = pad + lh * i + lh / 2;
      if (t.shadow) { x.save(); x.shadowColor = "rgba(0,0,0,.65)"; x.shadowBlur = sh * 1.5; x.shadowOffsetX = sh * 0.5; x.shadowOffsetY = sh * 0.5;
        x.fillStyle = t.color || "#fff"; x.fillText(l, ax, y); x.restore(); }
      if (sw > 0) { x.strokeStyle = t.stroke || "#000"; x.lineWidth = sw * 2; x.strokeText(l, ax, y); }
      x.fillStyle = t.color || "#fff"; x.fillText(l, ax, y);
    });
    if (texts.size > 60) texts.clear();
    if (!t.fx) texts.set(key, c);                 // 2.411.0: the plain stand-in of a preset text is not kept (its picture is coming)
    return c;
  }
  var pendingClip = {};        // text id -> the clip waiting for its upload
  /* 2.379.0: a text layer whose COLOUR is keyframed also gets a white-fill twin (text_<id>_w.png): the compile tints it
     frame by frame (white x the tweened colour = the colour; the black outline and shadow stay black) */
  function uploadWhite(c) {
    if (!KF.has(c.kf, "color")) return Promise.resolve(true);
    var o = {}; for (var k in c.text) o[k] = c.text[k]; o.color = "#ffffff";
    var pic = renderText(o);
    return new Promise(function (ok) {
      pic.toBlob(function (blob) {
        if (!blob) return ok(false);
        fetch("/api/tlcanvas/text?variant=w&id=" + encodeURIComponent(c.tid), { method: "POST", headers: { "Content-Type": "image/png" }, body: blob })
          .then(function (r) { return r.json(); }).then(function (j) { ok(!(j && j.error)); }).catch(function () { ok(false); });
      }, "image/png");
    });
  }
  function uploadText(c) {
    // 2.411.0: a preset's text goes up SHARP (the full picture, not the quick one shown while typing)
    var picP = c.text && c.text.fx && window.H3TextFx
      ? H3TextFx.full(fxSpec(c.text), c.text.fx).then(function (r) { return r ? r.canvas : renderText(c.text); }, function () { return renderText(c.text); })
      : Promise.resolve(renderText(c.text));
    if (!(c.text && c.text.fx)) uploadWhite(c);                // a preset draws its own colours: no white twin to tint
    return picP.then(function (pic) { return new Promise(function (ok) {
      pic.toBlob(function (blob) {
        if (!blob) return ok(false);
        fetch("/api/tlcanvas/text?id=" + encodeURIComponent(c.tid), { method: "POST", headers: { "Content-Type": "image/png" }, body: blob })
          .then(function (r) { return r.json(); })
          .then(function (j) {
            if (j && j.error) say("the text picture was not saved: " + j.error);
            else { clearTimeout(S.thumbT); S.thumbT = setTimeout(function () { if (typeof renderTimeline === "function") renderTimeline(); }, 120); }
            ok(!(j && j.error));
          })
          .catch(function () { say("the text picture was not saved - is the app server running?"); ok(false); });
      }, "image/png");
    }); });
  }
  function saveTextPng(c) {
    if (!c || !c.text) return;
    if (!c.tid) c.tid = "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    c.name = "text_" + c.tid + ".png";
    clearTimeout(pending[c.tid]);
    pendingClip[c.tid] = c;
    pending[c.tid] = setTimeout(function () { delete pending[c.tid]; delete pendingClip[c.tid]; uploadText(c); }, 350);
  }
  /* every text picture still waiting goes NOW (⚙ Compile reads them from disk) */
  function flushText() {
    return Promise.all(Object.keys(pending).map(function (id) {
      clearTimeout(pending[id]); var c = pendingClip[id]; delete pending[id]; delete pendingClip[id];
      return c ? uploadText(c) : true;
    }));
  }

  /* ------------------------------------------------------------------ geometry */
  function comp() {
    var c0 = (tl.video || [])[0];
    var W = 0, H = 0;
    var fr = window.H3FrameSize && tl.frame ? H3FrameSize.normalize(tl.frame) : null;   // 2.513.0: the timeline's own size (tlsizebar.js)
    if (fr) { W = fr.w; H = fr.h; }
    else if (c0) { var v = video(c0); if (v.videoWidth) { W = v.videoWidth; H = v.videoHeight; } }
    if (!W) { W = parseInt(($("width") || {}).value, 10) || 1280; H = parseInt(($("height") || {}).value, 10) || 720; }
    if (W !== S.W || H !== S.H) { S.W = W; S.H = H; mark(); }
    var inf = $("tlCInfo"); if (inf) inf.textContent = S.W + "×" + S.H + " · " + FPS + " fps";
  }
  /* the clip's box in picture pixels: centre, size, rotation (null = nothing to draw yet) */
  function box(c, kind, t) {
    var w, h;
    if (kind === "v1") {
      var v = video(c), vw = v.videoWidth || S.W, vh = v.videoHeight || S.H;
      var k = Math.min(S.W / vw, S.H / vh);
      return { cx: S.W / 2, cy: S.H / 2, w: vw * k, h: vh * k, rot: 0, src: v };
    }
    // 2.490.0: a PARENTED clip follows its parent (ext/timelinedock/tlparent.js): its world transform; a NULL draws nothing
    var tf = window.TlParent && c.parent ? TlParent.world(c, t) : tfAt(c, t), src = null;
    if (c.nul) { src = nullPic(); w = 100; h = 100; }
    else if (c.gen && window.TlGen && TlGen.picture) {    // 2.505.0: a GENERATOR layer (fractal noise / gradient ramp) - the frame's size
      src = TlGen.picture(c, Math.max(0, (t == null ? S.t : t) - (c.start || 0))); w = S.W; h = S.H;
    }
    else if (c.shape && window.TlShape) {             // 2.492.0: a SHAPE layer - its picture at this moment, its own size (tlshape.js)
      src = TlShape.picture(c, Math.max(0, (t == null ? S.t : t) - (c.start || 0))); w = src.width; h = src.height;
    }
    else if (kind === "vl" && c.m3d) {                   // 2.382.0: a 3D layer - its picture at this moment, drawn live
      var fr = window.H3M3D ? H3M3D.frame(c, Math.max(0, (t == null ? S.t : t) - (c.start || 0))) : null;
      src = fr ? fr.canvas : null; w = fr ? fr.w : num(c.m3d.w, 640); h = fr ? fr.h : num(c.m3d.h, 640);
    } else if (kind === "vl") {
      var vv = video(c); src = vv; w = vv.videoWidth || S.W; h = vv.videoHeight || S.H;
    } else if (c.text) {
      // the SIZE comes from the static text (a colour tween never changes it); the picture from the colour at t
      if (window.TlTextAnim && TlTextAnim.live(c)) {   // 2.493.0: TEXT ANIMATORS - each letter drawn on its own (tltextanim.js)
        src = TlTextAnim.picture(c, Math.max(0, (t == null ? S.t : t) - (c.start || 0))); w = src.width; h = src.height;
      } else {
      var base = renderText(c.text); src = renderText(textAt(c, t));
      w = Math.min(base.width, S.W); h = base.height * w / base.width;
      }
    } else {
      var im = image(c.name); src = im;
      if (!im.naturalWidth) return null;
      w = Math.min(im.naturalWidth, S.W); h = im.naturalHeight * w / im.naturalWidth;
    }
    w *= tf.scale; h *= tf.scale;
    // 2.489.0: the ANCHOR POINT (ax, ay: pixels from the centre at scale 1) sits at the position; scale and rotation
    // pivot on it - the box's centre is the position minus the turned, scaled anchor (worker.py _tf_chain / _kf_perspective)
    var ar = tf.rot * Math.PI / 180, ox = tf.scale * (tf.ax * Math.cos(ar) - tf.ay * Math.sin(ar)), oy = tf.scale * (tf.ax * Math.sin(ar) + tf.ay * Math.cos(ar));
    return { cx: S.W / 2 + tf.x - ox, cy: S.H / 2 + tf.y - oy, w: w, h: h, rot: tf.rot, src: src, px: S.W / 2 + tf.x, py: S.H / 2 + tf.y };
  }
  var NULLPIC = null;
  function nullPic() { if (!NULLPIC) { NULLPIC = document.createElement("canvas"); NULLPIC.width = 2; NULLPIC.height = 2; } return NULLPIC; }
  /* 2.490.0: ONE clip drawn at time t into g (picture coordinates) - what paintComp draws for it, without the layer's
     entry / exit transition: the bake of a clip the compile cannot place itself (ext/timelinedock/tlparent.js) */
  function drawClip(g, c, Ly, t) {
    var u = window.H3AnyKeys && c.kf && c.kf.length ? H3AnyKeys.apply(c, t - (c.start || 0), KF) : null;
    try { return drawClip0(g, c, Ly, t); } finally { if (u) u(); }
  }
  function drawClip0(g, c, Ly, t) {
    if (!at(c, Ly.kind, t) || c.adjust || c.nul) return false;
    var b = box(c, Ly.kind, t); if (!b || !b.src) return false;
    if (b.src.tagName === "VIDEO" && b.src.readyState < 2) return false;
    var pic = look(b.src, c, t);
    if (c.dist && window.TlDist && TlDist.apply) pic = TlDist.apply(pic, c, t - (c.start || 0), false);   // 2.505.0: 〰 full size for the bake
    if (c.masks && window.TlMask && TlMask.apply) pic = TlMask.apply(pic, c, t - (c.start || 0));   // 2.498.0
    if (c.warp && window.TlWarp && TlWarp.apply) pic = TlWarp.apply(pic, c, t - (c.start || 0), false);   // 2.507.0: 📌 puppet pins / ⌗ mesh warp (bigger: _ow)
    if (c.rays && window.TlRays && TlRays.apply) pic = TlRays.apply(pic, c, t - (c.start || 0), false);   // 2.506.0: ☀ (bigger: _ow)
    if (c.d3 && window.Tl3D && Tl3D.live(c) && Tl3D.draw) return Tl3D.draw(g, pic, c, Ly.kind, t, opac(c, Ly.L, t), false);   // 2.510.0: 🧊 a card in 3D
    if (c.tm && window.TlTime && TlTime.on && TlTime.on(c) && TlTime.draw) return TlTime.draw(g, c, Ly.kind, t, pic, opac(c, Ly.L, t));   // 2.500.0: ⏱
    if (c.pin && c.pin.on !== false && window.TlTrack && TlTrack.drawPin) { g.save(); g.globalAlpha = opac(c, Ly.L, t); var okp = TlTrack.drawPin(g, pic, c, t); g.restore(); return okp; }   // 2.499.0
    g.save(); g.globalAlpha = opac(c, Ly.L, t); g.translate(b.cx, b.cy); g.rotate(b.rot * Math.PI / 180);
    var ow = pic._ow || 1;                                   // 2.506.0: a picture bigger than the layer's box (☀ rays, warps)
    try { g.drawImage(pic, -b.w * ow / 2, -b.h * ow / 2, b.w * ow, b.h * ow); } catch (e) { g.restore(); return false; }
    g.restore(); return true;
  }
  function view() {
    var r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    var cw = Math.max(1, Math.round(r.width * dpr)), ch = Math.max(1, Math.round(r.height * dpr));
    if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
    if (S.view.fit) {
      var z = Math.min((r.width - 24) / S.W, (r.height - 24) / S.H);
      S.view.z = Math.max(0.02, z);
      S.view.ox = (r.width - S.W * S.view.z) / 2; S.view.oy = (r.height - S.H * S.view.z) / 2;
    }
    var zl = $("tlCZoom"); if (zl) zl.textContent = Math.round(S.view.z * 100) + "%";
    return { dpr: dpr, w: r.width, h: r.height };
  }
  function toComp(ev) {
    var r = cv.getBoundingClientRect();
    return { x: (ev.clientX - r.left - S.view.ox) / S.view.z, y: (ev.clientY - r.top - S.view.oy) / S.view.z };
  }
  function toScreen(x, y) { return { x: S.view.ox + x * S.view.z, y: S.view.oy + y * S.view.z }; }
  function corners(b) {
    var a = b.rot * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a), hw = b.w / 2, hh = b.h / 2;
    return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(function (p) {
      return { x: b.cx + p[0] * cs - p[1] * sn, y: b.cy + p[0] * sn + p[1] * cs };
    });
  }
  function inside(b, p) {
    var a = -b.rot * Math.PI / 180, dx = p.x - b.cx, dy = p.y - b.cy;
    var lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
    return Math.abs(lx) <= b.w / 2 && Math.abs(ly) <= b.h / 2;
  }
  function rotHandle(b) {
    var a = b.rot * Math.PI / 180, d = b.h / 2 + 28 / S.view.z;
    return { x: b.cx + d * Math.sin(a), y: b.cy - d * Math.cos(a) };
  }

  /* ------------------------------------------------------------------ drawing */
  function mark() { S.dirty = true; }
  function draw() {
    S.dirty = false;
    comp();
    var vw = view(), t = S.t;
    ctx.setTransform(vw.dpr, 0, 0, vw.dpr, 0, 0);
    ctx.clearRect(0, 0, vw.w, vw.h);
    ctx.fillStyle = "#0b0a08"; ctx.fillRect(0, 0, vw.w, vw.h);
    ctx.save();
    ctx.translate(S.view.ox, S.view.oy); ctx.scale(S.view.z, S.view.z);
    paintComp(ctx, t);
    ctx.restore();
    // the picture's edge
    ctx.strokeStyle = "rgba(255,255,255,.18)"; ctx.lineWidth = 1;
    ctx.strokeRect(S.view.ox - .5, S.view.oy - .5, S.W * S.view.z + 1, S.H * S.view.z + 1);
    // the selected clip's box + handles
    var sel = selClip();
    if (sel && sel.Ly && at(sel.c, sel.Ly.kind, t)) {
      var b2 = box(sel.c, sel.Ly.kind);
      if (b2) {
        var cs = corners(b2).map(function (p) { return toScreen(p.x, p.y); });
        ctx.strokeStyle = "#f59e2c"; ctx.lineWidth = 1.5;
        ctx.beginPath(); cs.forEach(function (p, i) { if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); }); ctx.closePath(); ctx.stroke();
        if (sel.Ly.kind !== "v1") {
          ctx.fillStyle = "#f59e2c";
          cs.forEach(function (p) { ctx.fillRect(p.x - 4, p.y - 4, 8, 8); });
          var rh = rotHandle(b2), rs = toScreen(rh.x, rh.y), top = toScreen((corners(b2)[0].x + corners(b2)[1].x) / 2, (corners(b2)[0].y + corners(b2)[1].y) / 2);
          ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.lineTo(rs.x, rs.y); ctx.stroke();
          ctx.beginPath(); ctx.arc(rs.x, rs.y, 5, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
    drawHooks.forEach(function (fn) { try { fn(ctx, { toScreen: toScreen, view: S.view, W: S.W, H: S.H }); } catch (e) { /* a hook never breaks the canvas */ } });
    var tm = $("tlCTime"); if (tm) tm.textContent = tc(t);
  }
  /* 2.491.0: one layer's clips at time t drawn into tg (the picture, or a layer's own see-through picture) */
  function drawLayer(tg, Ly, t) {
    // 2.415.0: a video / picture layer enters at its FIRST clip and leaves at its LAST - its transition seen here
    // (static/trprev.js - the compile draws the same shape, scripts/transitions.py boundary_chain)
    var fst = null, lst = null;
    if (window.H3TrPrev && (Ly.kind === "vl" || Ly.kind === "img") && Ly.L && ((Ly.L.transitionIn && Ly.L.transitionIn.type !== "none") || (Ly.L.transitionOut && Ly.L.transitionOut.type !== "none"))) {
      Ly.clips.forEach(function (c) { if (c.adjust) return; if (!fst || (c.start || 0) < (fst.start || 0)) fst = c; if (!lst || clipEnd(c, Ly.kind) > clipEnd(lst, Ly.kind)) lst = c; });
    }
    Ly.clips.forEach(function (c) {
      if (!at(c, Ly.kind, t)) return;
      if (c.adjust) { if (S.adjOn) adjust(tg, c, Ly, t); return; }    // its placeholder picture is never drawn
      if (c.nul) return;                                                // 2.490.0: a null object is never drawn
      var b = box(c, Ly.kind, t);
      if (!b || !b.src) return;
      if (b.src.tagName === "VIDEO") {
        var want = vidAt(c, c.tm && window.TlTime && TlTime.postT ? TlTime.postT(c, t) : t);   // 2.500.0: posterize time holds the frame
        if ((!S.playing || seekDriven(c) || (S.rate || 1) < 0) && Math.abs((b.src.currentTime || 0) - want) > 0.5 / FPS && !b.src.seeking) { try { b.src.currentTime = want; } catch (e) { /* not ready */ } }
        if (b.src.readyState < 2) return;
      }
      // 2.418.0: the playback resolution (½ / ¼ while playing): the clip's look worked on a smaller copy
      var hasLook = !!(c.fx && (c.fx.vfx || c.fx.mask || (FXm() && FXm().graded(c.fx))));
      var pic = look(S.playing && (S.res || 1) < 1 && hasLook && b.src.tagName !== "CANVAS" ? shrink(b.src, c, S.res) : b.src, c, t);
      if (c.dist && window.TlDist && TlDist.apply) pic = TlDist.apply(pic, c, t - (c.start || 0), S.playing);   // 2.505.0: 〰 distort (smaller while playing)
      if (c.masks && window.TlMask && TlMask.apply) pic = TlMask.apply(pic, c, t - (c.start || 0));   // 2.498.0: ✒ Bézier masks
      if (c.warp && window.TlWarp && TlWarp.apply) pic = TlWarp.apply(pic, c, t - (c.start || 0), S.playing);   // 2.507.0: 📌 puppet pins / ⌗ mesh warp
      if (c.rays && window.TlRays && TlRays.apply) pic = TlRays.apply(pic, c, t - (c.start || 0), S.playing);   // 2.506.0: ☀ light rays
      if (c.d3 && window.Tl3D && Tl3D.live(c) && Tl3D.draw) { Tl3D.draw(tg, pic, c, Ly.kind, t, opac(c, Ly.L, t), S.playing); return; }   // 2.510.0: 🧊 a card in 3D (camera, depth of field, shadows)
      if (c.tm && window.TlTime && TlTime.on && TlTime.on(c) && TlTime.draw) { TlTime.draw(tg, c, Ly.kind, t, pic, opac(c, Ly.L, t)); return; }   // 2.500.0: ⏱ motion blur / posterize / echo
      if (c.pin && c.pin.on !== false && window.TlTrack && TlTrack.drawPin) { tg.save(); tg.globalAlpha = opac(c, Ly.L, t); TlTrack.drawPin(tg, pic, c, t); tg.restore(); return; }   // 2.499.0: ▢ corner pin
      tg.save();
      tg.globalAlpha = opac(c, Ly.L, t);
      tg.translate(b.cx, b.cy); tg.rotate(b.rot * Math.PI / 180);
      if (fst || lst) { var trs = H3TrPrev.at(Ly.L, c, t, clipEnd(c, Ly.kind) - (c.start || 0), c === fst, c === lst); if (trs) H3TrPrev.apply(tg, trs, b.w, b.h); }
      var pow = pic._ow || 1;                                // 2.506.0: ☀ rays / warps reach past the box
      try { tg.drawImage(pic, -b.w * pow / 2, -b.h * pow / 2, b.w * pow, b.h * pow); } catch (e) { /* not decodable yet */ }
      tg.restore();
    });
  }
  var BLENDS = { multiply: "multiply", screen: "screen", overlay: "overlay", darken: "darken", lighten: "lighten", "color-dodge": "color-dodge",
                 "color-burn": "color-burn", "hard-light": "hard-light", "soft-light": "soft-light", difference: "difference", exclusion: "exclusion", add: "lighter",
                 hue: "yuv", saturation: "yuv", color: "yuv", luminosity: "yuv" };   // 2.495.0: the colour modes (blendYUV)
  /** 2.495.0: a layer (lc, the whole picture, see-through) on the picture so far (pg) in a COLOUR mode - the sums the
   *  compile does (worker.py _hsl_blend): full-range BT.601 Y U V; luminosity = the layer's Y + the base's U V, color =
   *  the base's Y + the layer's U V, hue = the layer's colour direction at the base's strength, saturation = the base's
   *  direction at the layer's strength; then laid on by the layer's alpha */
  function yuvOf(r, g, b) { return [Math.round(0.299 * r + 0.587 * g + 0.114 * b), Math.round(128 - 0.168736 * r - 0.331264 * g + 0.5 * b), Math.round(128 + 0.5 * r - 0.418688 * g - 0.081312 * b)]; }
  function mixYUV(mode, br, bg, bb, lr, lg, lb) {
    var B = yuvOf(br, bg, bb), L = yuvOf(lr, lg, lb), Y = B[0], U = B[1], V = B[2];
    if (mode === "luminosity") Y = L[0];
    else if (mode === "color") { U = L[1]; V = L[2]; }
    else {
      var D = mode === "hue" ? L : B, Sg = mode === "hue" ? B : L, m = Math.round(Math.hypot(Sg[1] - 128, Sg[2] - 128)), dm = Math.hypot(D[1] - 128, D[2] - 128);
      var eu = dm > 0 ? Math.round(128 + 127 * (D[1] - 128) / dm) : 128, ev = dm > 0 ? Math.round(128 + 127 * (D[2] - 128) / dm) : 128;
      U = Math.max(0, Math.min(255, Math.round(128 + (eu - 128) * m / 127))); V = Math.max(0, Math.min(255, Math.round(128 + (ev - 128) * m / 127)));
    }
    var c = function (v) { return Math.max(0, Math.min(255, Math.round(v))); };
    return [c(Y + 1.402 * (V - 128)), c(Y - 0.344136 * (U - 128) - 0.714136 * (V - 128)), c(Y + 1.772 * (U - 128))];
  }
  function blendYUV(pg, lc, mode) {
    var W = S.W, H = S.H, bd, ld;
    try { bd = pg.getImageData(0, 0, W, H); ld = lc.getContext("2d").getImageData(0, 0, W, H); } catch (e) { return false; }
    var b = bd.data, l = ld.data;
    for (var i = 0; i < l.length; i += 4) {
      var a = l[i + 3]; if (!a) continue;
      var o = mixYUV(mode, b[i], b[i + 1], b[i + 2], l[i], l[i + 1], l[i + 2]), f = a / 255;
      b[i] = Math.round(b[i] + (o[0] - b[i]) * f); b[i + 1] = Math.round(b[i + 1] + (o[1] - b[i + 1]) * f); b[i + 2] = Math.round(b[i + 2] + (o[2] - b[i + 2]) * f);
    }
    pg.putImageData(bd, 0, 0);
    return true;
  }
  var MATTES = { alpha: 1, alphainv: 1, luma: 1, lumainv: 1 };
  var OFF = {};
  function offC(k) { var c = OFF[k] || (OFF[k] = document.createElement("canvas")); if (c.width !== S.W) c.width = S.W; if (c.height !== S.H) c.height = S.H; return c; }
  /** the matte: the layer above drawn on its own, turned into a mask (its alpha, or its brightness), kept or cut out */
  function applyMatte(lg, mLy, mode, t) {
    var mc = offC("M"), mg = mc.getContext("2d"); mg.setTransform(1, 0, 0, 1, 0, 0); mg.globalAlpha = 1; mg.globalCompositeOperation = "source-over"; mg.clearRect(0, 0, S.W, S.H);
    drawLayer(mg, mLy, t);
    if (mode === "luma" || mode === "lumainv") {
      var id = mg.getImageData(0, 0, S.W, S.H), d = id.data;
      for (var i = 0; i < d.length; i += 4) { var a = d[i + 3] / 255; d[i + 3] = Math.round((0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) * a); }
      mg.putImageData(id, 0, 0);
    }
    lg.save(); lg.setTransform(1, 0, 0, 1, 0, 0); lg.globalAlpha = 1;
    lg.globalCompositeOperation = mode === "alphainv" || mode === "lumainv" ? "destination-out" : "destination-in";
    lg.drawImage(mc, 0, 0); lg.restore();
  }
  /* the picture at time t, in picture pixels (g is already in picture coordinates) - the canvas and snapshot() */
  /* 2.516.0: KEYFRAMES ON ANY PROPERTY (static/anykeys.js) - every clip's "@" keys written onto it for this frame while it
     is drawn, put back after (a clip drawn alone - a bake - the same in drawClip) */
  function anyKeys(t) {
    var A = window.H3AnyKeys; if (!A) return function () {};
    var undo = [];
    stack().forEach(function (Ly) { (Ly.clips || []).forEach(function (c) { if (c.kf && c.kf.length && A.has(c)) undo.push(A.apply(c, t - (c.start || 0), KF)); }); });
    return function () { for (var i = undo.length - 1; i >= 0; i--) undo[i](); };
  }
  function paintComp(g, t) { var u = anyKeys(t); try { return paintComp0(g, t); } finally { u(); } }
  function paintComp0(g, t) {
    g.fillStyle = "#000"; g.fillRect(0, 0, S.W, S.H);
    g.save(); g.beginPath(); g.rect(0, 0, S.W, S.H); g.clip();
    // 2.418.0: ⚡ a RENDERED stretch while playing - the preview file (the compile's own picture, captions and all) is
    // drawn instead of building the picture layer by layer (ext/timelinedock/tlrender.js)
    var rv = S.playing && window.TlRender ? TlRender.frame(t) : null;
    if (rv) { try { g.drawImage(rv, 0, 0, S.W, S.H); g.restore(); return; } catch (e) { /* draw it live */ } }
    // 2.409.0: an ADJUSTMENT LAYER (a picture-layer clip marked adjust) works on everything drawn under it - so while
    // one is on, the layers are drawn into an off-screen picture first, the adjustment is applied to it at its place
    var adjOn = stack().some(function (Ly) { return Ly.kind === "img" && liveL(Ly.L) && Ly.clips.some(function (c) { return c.adjust && at(c, "img", t); }); });
    // 2.420.0: while PLAYING the frame is put together on the GPU (static/glcomp.js) - one textured draw per clip, a
    // grade-only clip graded in that draw; null = something this pass does not do (a transition, an adjustment layer)
    var blendOn = stack().some(function (Ly) { return Ly.L && Ly.kind !== "v1" && ((Ly.L.blend && BLENDS[Ly.L.blend]) || (Ly.L.matte && MATTES[Ly.L.matte]) || (Ly.clips || []).some(function (c) { return (c.masks && c.masks.length) || c.pin || c.tm || c.dist || c.gen || c.rays || c.warp || c.d3; })); });   // 2.491.0 (2.498.0: + masks - the 2D path draws them)
    if (S.playing && !adjOn && !blendOn && tl.glComp !== false && window.H3GLComp) {
      var gc = compGL(t);
      if (gc) {
        try { g.drawImage(gc, 0, 0, S.W, S.H); } catch (e) { /* drawn below */ }
        S.lastGL = true;
        compHooks.forEach(function (fn) { try { fn(g, t, { W: S.W, H: S.H }); } catch (e) { /* a hook never breaks the picture */ } });
        g.restore();
        return;
      }
    }
    S.lastGL = false;
    var pg = g;
    if (adjOn) {
      PC = PC || document.createElement("canvas");
      if (PC.width !== S.W) PC.width = S.W; if (PC.height !== S.H) PC.height = S.H;
      pg = PC.getContext("2d"); pg.setTransform(1, 0, 0, 1, 0, 0); pg.globalAlpha = 1; pg.globalCompositeOperation = "source-over";
      pg.fillStyle = "#000"; pg.fillRect(0, 0, S.W, S.H);
    }
    // 2.491.0: BLEND MODES + TRACK MATTES (ext/timelinedock/tlblend.js): a layer with a blend mode or a matte is drawn
    // on its own see-through picture first; a matte layer (the one right above a matted layer) is not drawn itself
    S.adjOn = adjOn;
    var st0 = stack(), usedAsMatte = {};
    st0.forEach(function (Ly, k) { if (Ly.L && Ly.L.matte && MATTES[Ly.L.matte] && st0[k + 1]) usedAsMatte[k + 1] = true; });
    st0.forEach(function (Ly, k) {
      if (usedAsMatte[k]) return;
      if (!liveL(Ly.L)) return;
      var special = Ly.L && Ly.kind !== "v1" && ((Ly.L.blend && BLENDS[Ly.L.blend]) || (Ly.L.matte && MATTES[Ly.L.matte] && st0[k + 1]));
      if (!special) { drawLayer(pg, Ly, t); return; }
      var lc = offC("L"), lg = lc.getContext("2d"); lg.setTransform(1, 0, 0, 1, 0, 0); lg.globalAlpha = 1; lg.globalCompositeOperation = "source-over"; lg.clearRect(0, 0, S.W, S.H);
      drawLayer(lg, Ly, t);
      if (Ly.L.matte && MATTES[Ly.L.matte] && st0[k + 1]) applyMatte(lg, st0[k + 1], Ly.L.matte, t);
      if (BLENDS[Ly.L.blend] === "yuv") { blendYUV(pg, lc, Ly.L.blend); return; }             // 2.495.0: a colour mode
      pg.save(); pg.setTransform(1, 0, 0, 1, 0, 0); pg.globalAlpha = 1; pg.globalCompositeOperation = BLENDS[Ly.L.blend] || "source-over";
      try { pg.drawImage(lc, 0, 0); } catch (e) { /* fine */ }
      pg.restore();
    });
    if (adjOn) { try { g.drawImage(PC, 0, 0, S.W, S.H); } catch (e) { /* fine */ } }
    compHooks.forEach(function (fn) { try { fn(g, t, { W: S.W, H: S.H }); } catch (e) { /* a hook never breaks the picture */ } });
    g.restore();
  }
  var PC = null;
  /* 2.420.0: the GPU compositor's frame (static/glcomp.js) or null when this frame needs the 2D path */
  function compGL(t) {
    var G = window.H3GLComp;
    if (!G || !G.begin(S.W, S.H)) return null;
    var ok = true;
    stack().forEach(function (Ly) {
      if (!ok || !liveL(Ly.L)) return;
      var fst = null, lst = null;
      if (window.H3TrPrev && (Ly.kind === "vl" || Ly.kind === "img") && Ly.L && ((Ly.L.transitionIn && Ly.L.transitionIn.type !== "none") || (Ly.L.transitionOut && Ly.L.transitionOut.type !== "none"))) {
        Ly.clips.forEach(function (c) { if (c.adjust) return; if (!fst || (c.start || 0) < (fst.start || 0)) fst = c; if (!lst || clipEnd(c, Ly.kind) > clipEnd(lst, Ly.kind)) lst = c; });
      }
      Ly.clips.forEach(function (c) {
        if (!ok || !at(c, Ly.kind, t) || c.adjust || c.nul) return;
        if ((fst || lst) && H3TrPrev.at(Ly.L, c, t, clipEnd(c, Ly.kind) - (c.start || 0), c === fst, c === lst)) { ok = false; return; }   // a wipe now: 2D
        var b = box(c, Ly.kind, t);
        if (!b || !b.src) return;
        if (b.src.tagName === "VIDEO") {
          var want = vidAt(c, t);
          if ((seekDriven(c) || (S.rate || 1) < 0) && Math.abs((b.src.currentTime || 0) - want) > 0.5 / FPS && !b.src.seeking) { try { b.src.currentTime = want; } catch (e) { /* not ready */ } }
          if (b.src.readyState < 2) return;
        }
        var a = opac(c, Ly.L, t), fx = c.fx;
        var vf = fx && fx.vfx && fx.vfx.kf && window.H3ClipFx && H3ClipFx.vfxAt ? H3ClipFx.vfxAt(fx.vfx, t - (+c.start || 0)) : (fx && fx.vfx);
        var sp = window.H3Vfx && fx ? H3Vfx.split(vf) : [null, null];
        if (fx && !sp[0] && !sp[1] && !fx.mask && b.src.tagName !== "CANVAS" && G.gradeReady(fx)) { if (!G.draw(b.src, b, a, fx)) ok = false; return; }
        var hasLook = !!(fx && (fx.vfx || fx.mask || (FXm() && FXm().graded(fx))));
        var pic = look(S.playing && (S.res || 1) < 1 && hasLook && b.src.tagName !== "CANVAS" ? shrink(b.src, c, S.res) : b.src, c, t);
        if (!G.draw(pic, b, a, null)) ok = false;
      });
    });
    return ok ? G.end() : null;
  }
  /* 2.418.0: a clip's picture at the playback resolution (one small canvas per clip, reused) */
  var SHR = new Map();
  function shrink(src, c, k) {
    var d = dimsOf(src), w = Math.max(2, Math.round(d[0] * k)), h = Math.max(2, Math.round(d[1] * k));
    if (!d[0] || !d[1]) return src;
    var cv = SHR.get(c);
    if (!cv) { cv = document.createElement("canvas"); cv._shrunk = true; SHR.set(c, cv); if (SHR.size > 64) SHR.clear(); }
    if (cv.width !== w) cv.width = w; if (cv.height !== h) cv.height = h;
    try { cv.getContext("2d").drawImage(src, 0, 0, w, h); } catch (e) { return src; }
    return cv;
  }
  /* 2.406.0 / 2.409.0: a clip's look in the compile's order - crop + key (✨), the grade + LUT (🎨, the baked table
     through WebGL - static/gradegl.js), then blur / sharpen / glow / vignette / grain (static/vfxgl.js) */
  function look(src, c, t) {
    var fx = c.fx;
    if (!fx || (src.tagName === "CANVAS" && !src._shrunk)) return src;   // a 3D layer's canvas is drawn as it is
    // 2.412.0: keyframed effects - their values at this moment of the clip
    var vf = fx.vfx && fx.vfx.kf && window.H3ClipFx && H3ClipFx.vfxAt ? H3ClipFx.vfxAt(fx.vfx, (t || 0) - (+c.start || 0)) : fx.vfx;
    var pic = src, sp = window.H3Vfx ? H3Vfx.split(vf) : [null, null];
    try {
      if (sp[0]) pic = H3Vfx.apply(pic, sp[0], true) || pic;
      var pre = pic;
      if (fx.mask && pre !== src && pre.tagName === "CANVAS") pre = copyOf(pre);    // the next pass may reuse its canvas
      if (window.H3GradeGL) pic = H3GradeGL.apply(pic, fx, mark) || pic;
      if (sp[1]) pic = H3Vfx.apply(pic, sp[1], true, (t || 0) - (+c.start || 0)) || pic;   // 2.415.0: tau for a moving wave
      if (fx.mask && pic !== pre) pic = masked(pre, pic, fx.mask, (t || 0) - (+c.start || 0));   // 2.416.0
    } catch (e) { pic = src; }
    return pic;
  }
  /* 2.416.0: a MASK / power window - the look only inside (or outside) the shape: the picture before the look, the look
     laid over it through the mask (static/clipfx.js maskAlpha - the compile's formula, scripts/vfx_filters.py) */
  var MSK = { base: null, look: null, small: null, key: "" };
  function dimsOf(x) { return [x.videoWidth || x.naturalWidth || x.width, x.videoHeight || x.naturalHeight || x.height]; }
  function copyOf(cv) { var d = dimsOf(cv), k = document.createElement("canvas"); k.width = d[0]; k.height = d[1]; k.getContext("2d").drawImage(cv, 0, 0); return k; }
  function maskSmall(m, w, h, tau) {
    var F = FXm(); if (!F || !F.maskAlpha) return null;
    var mw = Math.min(320, w), mh = Math.max(1, Math.round(mw * h / w));
    var key = JSON.stringify([m.shape, m.x, m.y, m.w, m.h, m.rot, m.feather, m.invert, mw, mh, m.track ? F.maskAt(m, tau) : 0]);
    if (MSK.small && MSK.key === key) return MSK.small;
    var cv = MSK.small || document.createElement("canvas"); cv.width = mw; cv.height = mh;
    var g = cv.getContext("2d"), im = g.createImageData(mw, mh), d = im.data;
    for (var y = 0; y < mh; y++) for (var x = 0; x < mw; x++) {
      var a = F.maskAlpha(m, (x + 0.5) * w / mw, (y + 0.5) * h / mh, w, h, tau), i = (y * mw + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = Math.round(a * 255);
    }
    g.putImageData(im, 0, 0);
    MSK.small = cv; MSK.key = key;
    return cv;
  }
  function masked(pre, look, m, tau) {
    var d = dimsOf(look), w = d[0], h = d[1];
    if (!w || !h) return look;
    var sm = maskSmall(m, w, h, tau); if (!sm) return look;
    var L = MSK.look || document.createElement("canvas"); L.width = w; L.height = h; MSK.look = L;
    var lg = L.getContext("2d"); lg.globalCompositeOperation = "source-over"; lg.clearRect(0, 0, w, h); lg.drawImage(look, 0, 0, w, h);
    lg.globalCompositeOperation = "destination-in"; lg.imageSmoothingEnabled = true; lg.drawImage(sm, 0, 0, w, h); lg.globalCompositeOperation = "source-over";
    var B = MSK.base || document.createElement("canvas"); B.width = w; B.height = h; MSK.base = B;
    var bg = B.getContext("2d"); bg.clearRect(0, 0, w, h); bg.drawImage(pre, 0, 0, w, h); bg.drawImage(L, 0, 0);
    return B;
  }
  /* 2.409.0: an adjustment layer at its place: the picture so far graded + its effects, mixed in by its opacity */
  function adjust(pg, c, Ly, t) {
    var fx = c.fx || {}, res = PC;
    try {
      if (window.H3GradeGL) res = H3GradeGL.apply(PC, fx, mark) || res;
      var vf = fx.vfx && fx.vfx.kf && window.H3ClipFx && H3ClipFx.vfxAt ? H3ClipFx.vfxAt(fx.vfx, t - (+c.start || 0)) : fx.vfx;   // 2.412.0
      var sp = window.H3Vfx ? H3Vfx.split(vf) : [null, null];
      if (sp[1]) res = H3Vfx.apply(res, sp[1], false, t - (+c.start || 0)) || res;
      if (fx.mask && res !== PC) res = masked(PC, res, fx.mask, t - (+c.start || 0));   // 2.416.0: the adjustment's mask
    } catch (e) { res = PC; }
    if (res === PC) return;
    var op = opac(c, Ly.L, t);
    pg.save(); pg.setTransform(1, 0, 0, 1, 0, 0);
    if (op >= 0.999) { pg.globalCompositeOperation = "copy"; pg.drawImage(res, 0, 0, S.W, S.H); }
    else { pg.globalAlpha = op; pg.drawImage(res, 0, 0, S.W, S.H); }
    pg.restore();
  }
  var compHooks = [];        // 2.406.0: drawn INTO the picture (the 💬 captions) - so snapshot() and the compile agree
  /* the picture at the position marker, full size, as a PNG data URL (the compile-parity test compares it) */
  function snapshot() {
    var c = document.createElement("canvas"); c.width = S.W; c.height = S.H;
    paintComp(c.getContext("2d"), S.t);
    return c.toDataURL("image/png");
  }
  function loop(now) {
    S.raf = requestAnimationFrame(loop);
    // 2.418.0: ⏱ frames drawn late while playing (ext/timelinedock/tlrender.js marks those stretches red)
    if (S.playing && S.lastF && window.TlRender) TlRender.note(S.t, (now || performance.now()) - S.lastF);
    S.lastF = S.playing ? (now || performance.now()) : 0;
    if (S.playing) tick();
    else {
      var ph = (typeof playhead === "number" && isFinite(playhead)) ? playhead : 0;
      if (Math.abs(ph - S.t) > 1e-6) { S.t = ph; S.dirty = true; }
    }
    if (S.dirty || S.playing) draw();
  }

  /* ------------------------------------------------------------------ playback (every layer in step) */
  function endT() { try { return typeof sceneEnd === "function" ? sceneEnd() : 0; } catch (e) { return 0; } }
  function range() {
    if (tl.sel && tl.sel.b > tl.sel.a) return { a: tl.sel.a, b: tl.sel.b };
    return { a: 0, b: Math.max(endT(), 0.1) };
  }
  function keepAudio() { var k = $("tlKeepA"); return !k || k.checked; }
  function syncMedia(t, play) {
    if (window.TlRender) TlRender.sync(t, play && S.playing, S.rate);   // 2.418.0: ⚡ the rendered preview kept in step
    stack().forEach(function (Ly) {
      if (Ly.kind === "img") return;
      var live = liveL(Ly.L);
      Ly.clips.forEach(function (c) {
        if (c.m3d) return;                             // 2.382.0: a 3D layer is drawn, not played
        var v = vids.get(c);
        var on = live && at(c, Ly.kind, t);
        if (!on) { if (v && !v.paused) v.pause(); if (window.TlRetimeSound) TlRetimeSound.stop(c); return; }
        v = video(c);
        var want = vidAt(c, t);
        v.muted = !play || !keepAudio() || !!Ly.L.muted || seekDriven(c) || (S.rate || 1) < 0 || !!c.soundOut;   // 2.412.0: its sound is a clip of its own   // 2.406.0: a reversed / ramped clip's own file is silent here (2.417.0: TlRetimeSound plays its rendered sound)
        v.volume = Math.max(0, Math.min(1, Ly.L.volume == null ? 1 : +Ly.L.volume));
        if (window.TlMixer) TlMixer.apply(v, Ly.lk, Ly.L, 1);                 // 2.415.0: 🎚 through the track's bus (fader, pan, meter)
        var R = S.playing ? (S.rate || 1) : 1;                                // 2.411.0: the shuttle's speed (backwards: seen, not heard)
        var pr = Math.max(0.0625, Math.min(16, playRate(c) * (R > 0 ? R : 1)));
        if (Math.abs((v.playbackRate || 1) - pr) > 1e-3) { try { v.playbackRate = pr; } catch (e) { /* out of range */ } }
        if (play && !seekDriven(c) && R > 0) {
          if (Math.abs(v.currentTime - want) > 0.2 * Math.max(1, pr)) { try { v.currentTime = want; } catch (e) { /* not ready */ } }
          if (v.paused) v.play().catch(function () { /* autoplay */ });
        } else if (!v.paused) v.pause();
        // 2.417.0: a reversed / ramped clip is HEARD too - its sound rendered once with the compile's retime
        if (window.TlRetimeSound && seekDriven(c)) TlRetimeSound.sync(c, t, play && keepAudio() && !Ly.L.muted && R > 0 && !c.soundOut, Ly, R);
      });
    });
    audioStack().forEach(function (Ly) {
      var live = liveL(Ly.L);
      Ly.clips.forEach(function (c) {
        var a = auds.get(c);
        var AR = S.playing ? (S.rate || 1) : 1;
        var on = play && AR > 0 && live && !Ly.L.muted && at(c, "aud", t);
        if (!on) { if (a && !a.paused) a.pause(); return; }
        a = audio(c);
        var want = (c.in || 0) + (t - (c.start || 0));
        a.volume = Math.max(0, Math.min(1, (Ly.L.volume == null ? 1 : +Ly.L.volume) * (c.volume == null ? 1 : +c.volume)));
        if (window.TlMixer) TlMixer.apply(a, Ly.lk, Ly.L, c.volume == null ? 1 : +c.volume);   // 2.415.0: 🎚
        if (Math.abs((a.playbackRate || 1) - AR) > 1e-3) { try { a.playbackRate = Math.min(16, AR); } catch (e) { /* out of range */ } }
        if (Math.abs(a.currentTime - want) > 0.2 * Math.max(1, AR)) { try { a.currentTime = want; } catch (e) { /* not ready */ } }
        if (a.paused) a.play().catch(function () { /* autoplay */ });
      });
    });
  }
  function marker(t) {
    try { if (typeof tlMarkerDragging !== "undefined" && tlMarkerDragging) return; } catch (e) { /* older core */ }   // 2.383.0: the user holds it
    try { playhead = t; } catch (e) { /* core not ready */ }
    var ph = document.getElementById("playhead");
    if (ph && typeof LABW === "number" && typeof PXS === "number") ph.style.left = (LABW + t * PXS) + "px";
    var tp = $("tlPh"); if (tp) tp.textContent = "▏" + t.toFixed(2) + "s";
  }
  function tick() {
    var t = S.base + (performance.now() - S.t0) / 1000 * (S.rate || 1);      // 2.411.0: J / K / L shuttle (-8 .. 8x)
    var r = range();
    if ((S.rate || 1) < 0 && t <= r.a) { t = r.a; S.t = t; pause(); return; }
    if (t >= r.b) {
      if (S.loop) { S.base = r.a; S.t0 = performance.now(); t = r.a; syncMedia(t, false); }
      else { t = r.b; S.t = t; pause(); return; }
    }
    S.t = t;
    syncMedia(t, true);
    marker(t);
  }
  function play(rate) {
    if (S.playing) return;
    try { if (typeof pv === "object" && pv.on && typeof pvStop === "function") pvStop(); } catch (e) { /* fine */ }
    S.rate = typeof rate === "number" && rate ? rate : 1;
    var r = range();
    var t = (typeof playhead === "number" && isFinite(playhead)) ? playhead : r.a;
    if (S.rate > 0 && (t >= r.b - 1e-3 || t < r.a - 1e-3)) t = r.a;
    if (S.rate < 0 && t <= r.a + 1e-3) t = r.b;                               // backwards from the start: from the end
    S.base = t; S.t = t; S.t0 = performance.now(); S.playing = true; S.lastF = 0;
    if (window.TlRender) TlRender.resetMeter();                              // 2.418.0: ⏱ counts from this ▶
    paintTransport();
  }
  /* 2.411.0: J / K / L (Premiere's shuttle): L forwards - again 2x, 4x, 8x; J backwards the same; K stops (back to 1x) */
  function shuttle(dir) {
    if (!dir) { pause(); return 0; }
    var cur = S.playing ? (S.rate || 1) : 0;
    var next = dir > 0 ? (cur > 0 ? Math.min(8, cur * 2) : 1) : (cur < 0 ? Math.max(-8, cur * 2) : -1);
    if (!S.playing) { play(next); return next; }
    S.base = S.t; S.t0 = performance.now(); S.rate = next;
    syncMedia(S.t, true); paintTransport();
    return next;
  }
  /** one frame forwards / backwards (K + L / K + J), paused */
  function step(n) { pause(); go(fsnap(S.t + (n || 1) / FPS)); return S.t; }
  function pause() {
    if (!S.playing) return;
    S.playing = false;
    S.rate = 1;
    syncMedia(S.t, false);
    marker(fsnap(S.t));
    S.t = fsnap(S.t);
    paintTransport();
    mark();
  }
  function stop() { pause(); go(range().a); }
  function go(t) {
    S.t = Math.max(0, t);
    if (S.playing) { S.base = S.t; S.t0 = performance.now(); syncMedia(S.t, true); }
    marker(S.t);
    mark();
  }
  function paintTransport() {
    var b = $("tlCPlay");
    if (b) { b.textContent = S.playing ? "⏸" : "▶"; b.title = S.playing ? "Pause (Space)" : "Play the preview from the position marker (Space)"; }
    // 2.411.0: the shuttle's speed beside the transport (J / K / L)
    var sr = $("tlCRate");
    if (!sr && b && b.parentNode) { sr = document.createElement("span"); sr.id = "tlCRate"; sr.style.cssText = "font:600 .7rem var(--mono,monospace);color:var(--tiger,#f59e2c);min-width:30px";
      sr.title = "J / K / L: backwards, stop, forwards - press again for 2x, 4x, 8x"; b.parentNode.insertBefore(sr, b.nextSibling);
      if (window.TlRender) TlRender.transport(); }                  // 2.418.0: ⏱ + Full / ½ / ¼ beside it, in the same moment
    if (sr) sr.textContent = S.playing && (S.rate || 1) !== 1 ? ((S.rate < 0 ? "◀ " : "▶ ") + Math.abs(S.rate) + "×") : "";
    var l = $("tlCLoop"); if (l) l.classList.toggle("on", S.loop);
  }

  /* ------------------------------------------------------------------ selection */
  function selClip() {
    var c = (typeof tlSelClip !== "undefined") ? tlSelClip : null;
    if (!c) return null;
    var Ly = layerOf(c);
    if (!Ly) {
      // 2.408.0: the timeline was reloaded (a karaoke overlay landing, a named timeline saved / switched) - the selected
      // clip OBJECT is gone but the same clip is there: same file, start and trim. Follow it instead of losing it.
      var hit = null;
      stack().concat(audioStack()).some(function (L2) {
        return (L2.clips || []).some(function (x) {
          if (x && x.name === c.name && Math.abs((+x.start || 0) - (+c.start || 0)) < 1e-6 && Math.abs((+x.in || 0) - (+c.in || 0)) < 1e-6) { hit = { c: x, Ly: L2 }; return true; }
          return false;
        });
      });
      if (!hit) return null;
      try { tlSelClip = hit.c; } catch (e) { /* fine */ }
      if (!tl.selLayer) tl.selLayer = hit.Ly.lk;
      return hit;
    }
    return { c: c, Ly: Ly };
  }
  function select(c, Ly) {
    try { tlSelClip = c; } catch (e) { /* core not ready */ }
    if (Ly) tl.selLayer = Ly.lk;
    if (typeof renderTimeline === "function") renderTimeline();
    paintLayers(); paintProps(); mark();
  }
  function hit(p) {
    var st = stack();
    for (var i = st.length - 1; i >= 0; i--) {
      var Ly = st[i];
      if (!liveL(Ly.L)) continue;
      for (var j = Ly.clips.length - 1; j >= 0; j--) {
        var c = Ly.clips[j];
        if (!at(c, Ly.kind, S.t)) continue;
        var b = box(c, Ly.kind);
        if (b && inside(b, p)) return { c: c, Ly: Ly, b: b };
      }
    }
    return null;
  }

  /* ------------------------------------------------------------------ tools + pointer */
  /* 2.380.0 EXTRA TOOLS (ext/timelinedock/fill.js: ⬚ Select, 🖌 Mask): {id, icon, title, key, cursor,
     down(p, ev), move(p, ev), up(p, ev)} - a toolbar button, a shortcut key, the pointer while it is the tool */
  var extTools = {};
  function addTool(t) {
    extTools[t.id] = t;
    var bar = $("tlTools"), seps = bar ? bar.querySelectorAll(".tlt-sep") : [];
    var b = document.createElement("button");
    b.className = "ghost"; b.id = "tlTool_" + t.id; b.type = "button"; b.textContent = t.icon;
    b.title = t.title + (t.key ? " (" + t.key.replace(/^shift\+/, "Shift+").replace(/[a-z]$/, function (c) { return c.toUpperCase(); }) + ")" : ""); b.setAttribute("aria-label", t.title);
    b.addEventListener("click", function () { setTool(t.id); });
    if (bar) bar.insertBefore(b, seps[0] || null);
  }
  var drawHooks = [];
  var grabHooks = [];        // 2.385.0: {down(ev, p, sel) -> {move(ev, p), up(ev)} | null, hover(ev, p, sel) -> cursor | null}
  function setTool(t) {
    S.tool = t;
    ["move", "text", "hand", "zoom"].concat(Object.keys(extTools)).forEach(function (k) { var b = $("tlTool_" + k); if (b) b.classList.toggle("on", k === t); });
    cv.style.cursor = extTools[t] ? (extTools[t].cursor || "crosshair")
      : t === "hand" ? "grab" : t === "zoom" ? "zoom-in" : t === "text" ? "text" : "default";
    say("");      // 2.380.0: no tool explanations on the canvas - ❔ help (static/help/timeline.html) has them
  }
  function zoomAt(f, sx, sy) {
    var r = cv.getBoundingClientRect();
    if (sx == null) { sx = r.width / 2; sy = r.height / 2; }
    var cx = (sx - S.view.ox) / S.view.z, cy = (sy - S.view.oy) / S.view.z;
    S.view.fit = false;
    S.view.z = Math.max(0.02, Math.min(16, S.view.z * f));
    S.view.ox = sx - cx * S.view.z; S.view.oy = sy - cy * S.view.z;
    mark();
  }
  function fit() { S.view.fit = true; mark(); }
  function handleAt(sel, ev) {
    var b = box(sel.c, sel.Ly.kind);
    if (!b) return null;
    var r = cv.getBoundingClientRect(), mx = ev.clientX - r.left, my = ev.clientY - r.top;
    var rh = toScreen(rotHandle(b).x, rotHandle(b).y);
    if (Math.hypot(mx - rh.x, my - rh.y) <= 8) return { kind: "rot", b: b };
    var cs = corners(b).map(function (p) { return toScreen(p.x, p.y); });
    for (var i = 0; i < 4; i++) if (Math.abs(mx - cs[i].x) <= 7 && Math.abs(my - cs[i].y) <= 7) return { kind: "scale", b: b };
    return null;
  }
  cv.addEventListener("pointerdown", function (ev) {
    $("tlCanvasWrap").focus({ preventScroll: true });
    var p = toComp(ev);
    var tool = S.spaceHand ? "hand" : S.tool;
    if (tool === "hand" || ev.button === 1) {
      S.drag = { kind: "pan", sx: ev.clientX, sy: ev.clientY, ox: S.view.ox, oy: S.view.oy };
      S.view.fit = false; cv.style.cursor = "grabbing";
    } else if (tool === "zoom") {
      var r = cv.getBoundingClientRect();
      zoomAt(ev.altKey ? 1 / 1.6 : 1.6, ev.clientX - r.left, ev.clientY - r.top);
      return;
    } else if (extTools[tool]) {
      S.drag = { kind: "ext", tool: extTools[tool] };
      extTools[tool].down(p, ev);
    } else if (tool === "text") {
      var h0 = hit(p);
      if (h0 && h0.c.text) { select(h0.c, h0.Ly); focusText(); return; }
      addText(p);
      return;
    } else {
      var sel = selClip();
      // 2.385.0: a grab hook (the 3D widgets, m3dgizmo.js) takes the pointer first when it is on one of its handles
      for (var gi = 0; gi < grabHooks.length; gi++) {
        var gd = null;
        try { gd = grabHooks[gi].down(ev, p, sel); } catch (e) { gd = null; }
        if (gd) {
          S.drag = { kind: "hook", g: gd, c: sel && sel.c };
          try { cv.setPointerCapture(ev.pointerId); } catch (e) { /* fine */ }
          ev.preventDefault();
          return;
        }
      }
      var hd = sel && sel.Ly.kind !== "v1" && at(sel.c, sel.Ly.kind, S.t) ? handleAt(sel, ev) : null;
      if (hd) {
        var tf0 = tfAt(sel.c);
        S.drag = { kind: hd.kind, c: sel.c, b: hd.b, tf0: tf0, p0: p,
                   a0: Math.atan2(p.y - hd.b.cy, p.x - hd.b.cx), d0: Math.max(1, Math.hypot(p.x - hd.b.cx, p.y - hd.b.cy)) };
      } else {
        var h = hit(p);
        if (!h) { select(null, null); return; }
        if (h.c !== (sel && sel.c)) select(h.c, h.Ly);
        if (h.Ly.kind === "v1") { say("V1 always fills the frame"); return; }
        S.drag = { kind: "move", c: h.c, tf0: tfAt(h.c), p0: p, ly: h.Ly.kind };
      }
    }
    try { cv.setPointerCapture(ev.pointerId); } catch (e) { /* fine */ }
    ev.preventDefault();
  });
  cv.addEventListener("pointermove", function (ev) {
    var d = S.drag;
    if (!d) {
      if (S.tool === "move" && !S.spaceHand) {
        var sel = selClip(), cur = null;
        for (var gi = 0; gi < grabHooks.length && !cur; gi++) { try { cur = grabHooks[gi].hover ? grabHooks[gi].hover(ev, toComp(ev), sel) : null; } catch (e) { cur = null; } }
        var hd = !cur && sel && sel.Ly.kind !== "v1" && at(sel.c, sel.Ly.kind, S.t) ? handleAt(sel, ev) : null;
        cv.style.cursor = cur || (hd ? (hd.kind === "rot" ? "crosshair" : "nwse-resize") : "default");
      }
      return;
    }
    if (d.kind === "hook") { try { d.g.move(ev, toComp(ev)); } catch (e) { /* a hook never breaks the canvas */ } paintProps(true); mark(); return; }
    if (d.kind === "pan") { S.view.ox = d.ox + (ev.clientX - d.sx); S.view.oy = d.oy + (ev.clientY - d.sy); mark(); return; }
    var p = toComp(ev);
    if (d.kind === "ext") { d.tool.move(p, ev); mark(); return; }
    if (d.kind === "move") {
      var ddx = p.x - d.p0.x, ddy = p.y - d.p0.y;
      if (window.TlParent && d.c.parent) { var ld = TlParent.localDelta(d.c, ddx, ddy); ddx = ld[0]; ddy = ld[1]; }   // 2.490.0: in its parent's space
      var nx = d.tf0.x + ddx, ny = d.tf0.y + ddy;
      if (ev.shiftKey) { if (Math.abs(p.x - d.p0.x) > Math.abs(p.y - d.p0.y)) ny = d.tf0.y; else nx = d.tf0.x; }
      // 2.446.0: snapped to the guidelines / the picture's edges + centre / the grid (tlgrid.js; Alt = free)
      if (window.TlGrid && TlGrid.snapMove && !d.c.parent) {
        var bb = box(d.c, d.ly);
        if (bb) { var sn = TlGrid.snapMove({ cx: S.W / 2 + nx, cy: S.H / 2 + ny, w: bb.w, h: bb.h }, S.view.z, ev); if (sn) { if (!(ev.shiftKey && nx === d.tf0.x)) nx += sn.dx; if (!(ev.shiftKey && ny === d.tf0.y)) ny += sn.dy; } }
      }
      writeTf(d.c, { x: Math.round(nx), y: Math.round(ny) });
    } else if (d.kind === "scale") {
      var k = Math.hypot(p.x - d.b.cx, p.y - d.b.cy) / d.d0;
      writeTf(d.c, { scale: Math.max(0.01, Math.min(20, Math.round(d.tf0.scale * k * 1000) / 1000)) });
    } else if (d.kind === "rot") {
      var a = d.tf0.rot + (Math.atan2(p.y - d.b.cy, p.x - d.b.cx) - d.a0) * 180 / Math.PI;
      if (ev.shiftKey) a = Math.round(a / 15) * 15;
      writeTf(d.c, { rot: Math.round(a * 10) / 10 });
    }
    paintProps(true); mark();
  });
  function endDrag(ev) {
    var d = S.drag; S.drag = null;
    try { cv.releasePointerCapture(ev.pointerId); } catch (e) { /* fine */ }
    if (d && d.kind === "ext") { if (d.tool.up) d.tool.up(toComp(ev), ev); mark(); return; }
    if (d && d.kind === "hook") { try { if (d.g.up) d.g.up(ev); } catch (e) { /* fine */ } }
    if (S.tool === "hand") cv.style.cursor = "grab";
    if (d && d.kind !== "pan" && typeof tlSave === "function") {
      tlSave(); paintProps();
      if (d.c && d.c.kf && typeof renderTimeline === "function") renderTimeline();   // a new / moved ◆ shows on the clip
    }
  }
  cv.addEventListener("pointerup", endDrag);
  cv.addEventListener("pointercancel", endDrag);
  cv.addEventListener("wheel", function (ev) {
    if (!ev.ctrlKey && !ev.altKey) return;
    ev.preventDefault();
    var r = cv.getBoundingClientRect();
    zoomAt(ev.deltaY < 0 ? 1.15 : 1 / 1.15, ev.clientX - r.left, ev.clientY - r.top);
  }, { passive: false });
  cv.addEventListener("dblclick", function (ev) {
    var h = hit(toComp(ev));
    if (h && h.c.text) { select(h.c, h.Ly); focusText(); }
  });

  /* keys: only while the pointer is over the stage or the canvas has focus */
  var stage = $("tlStage");
  stage.addEventListener("pointerenter", function () { S.over = true; });
  stage.addEventListener("pointerleave", function () { S.over = false; S.overDock = false; });
  // 2.410.0: a docker docked beside the canvas (stagedock.js - 🎤 Karaoke, 🧰 Tools) is inside the stage, but its keys
  // are its own: the canvas's single-key tools wait until the pointer is back over the canvas
  stage.addEventListener("pointerover", function (e) { S.overDock = !!(e.target && e.target.closest && e.target.closest(".tsd")); });
  function typing() {
    if (window.H3Space && H3Space.typing) return H3Space.typing(document.activeElement);   // 2.410.0: a focused checkbox / button is not typing
    var a = document.activeElement;
    return a && a !== document.body && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName));
  }
  document.addEventListener("keydown", function (e) {
    if (!((S.over && !S.overDock) || document.activeElement === $("tlCanvasWrap")) || typing() || e.ctrlKey || e.metaKey) return;
    if (document.querySelector("dialog[open]")) return;
    var k = e.key;
    if (k === " ") {
      e.preventDefault();
      if (e.repeat) return;
      if (S.tool !== "hand") { S.spaceHand = true; S.spaceAt = performance.now(); cv.style.cursor = "grab"; }
      return;
    }
    var m = { v: "move", t: "text", h: "hand", z: "zoom" }[k.toLowerCase()];
    // 2.389.0: a tool's key may be "shift+<key>" (the Path tool: Shift+P - P alone is the prompt docker's)
    if (!m) Object.keys(extTools).forEach(function (id) { var tk = extTools[id].key || ""; if (e.shiftKey ? tk === "shift+" + k.toLowerCase() : tk === k.toLowerCase()) m = id; });
    if (m && !e.altKey) { e.preventDefault(); setTool(m); return; }
    // (stopped here: the gallery's own Delete would otherwise remove a selected gallery picture too)
    if (k === "Delete" && selClip() && selClip().Ly.kind !== "v1") { e.preventDefault(); e.stopPropagation(); removeClip(selClip()); }
  });
  document.addEventListener("keyup", function (e) {
    if (e.key !== " " || !S.spaceHand) return;
    S.spaceHand = false;
    setTool(S.tool);
    // a TAP of Space (no pan) plays / pauses - After Effects style
    if (performance.now() - (S.spaceAt || 0) < 250 && !S.drag) { if (S.playing) pause(); else play(); }
  });

  /* ------------------------------------------------------------------ drop: a NEW layer at the playhead, where dropped */
  var wrap = $("tlCanvasWrap");
  function wanted(e) {
    var dt = e.dataTransfer;
    if (!dt) return false;
    var ty = Array.prototype.slice.call(dt.types || []);
    return ty.indexOf("Files") >= 0 || ty.indexOf("text/h3clip") >= 0 || (typeof dragPayload !== "undefined" && !!dragPayload);
  }
  wrap.addEventListener("dragover", function (e) { if (!wanted(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = "copy"; wrap.classList.add("drop"); });
  wrap.addEventListener("dragleave", function () { wrap.classList.remove("drop"); });
  wrap.addEventListener("drop", function (e) {
    if (!wanted(e)) return;
    e.preventDefault(); wrap.classList.remove("drop");
    var p = toComp(e), t0 = fsnap(S.t);
    var off = { x: Math.round(p.x - S.W / 2), y: Math.round(p.y - S.H / 2) };
    var payload = typeof dragPayload !== "undefined" ? dragPayload : null;
    var h3 = null; try { h3 = JSON.parse(e.dataTransfer.getData("text/h3clip") || "null"); } catch (x) { h3 = null; }
    var files = e.dataTransfer.files && e.dataTransfer.files.length ? Array.prototype.slice.call(e.dataTransfer.files) : null;
    // 2.382.0: .fbx / .obj (with their .mtl and textures) become 3D layers (ext/timelinedock/m3d.js)
    if (files && window.TlM3D && TlM3D.takeDrop(files, t0, off)) return;
    var placed = [];
    var addVideo = function (c) {
      if (!tl.video.length) { c.start = t0; tl.video.push(c); if (typeof resolveOverlaps === "function") resolveOverlaps(); placed.push("V1"); return; }
      c.tf = { x: off.x, y: off.y, scale: 1, rot: 0 };
      var L = mkLayer("V" + (tl.vlayers.length + 2), [c]); tl.vlayers.push(L); placed.push(L.name);
      if (typeof tlKaraokeOnTop === "function") tlKaraokeOnTop();
    };
    var addImage = function (c) { c.tf = { x: off.x, y: off.y, scale: 1, rot: 0 }; var L = mkLayer("I" + (tl.images.length + 1), [c]); tl.images.push(L); placed.push(L.name); };
    var addSound = function (c) { var L = mkLayer("A" + (tl.audio.length + 1), [c]); tl.audio.push(L); placed.push(L.name); };
    var done = function () {
      if (!placed.length) return;
      if (typeof tlSave === "function") tlSave();
      if (typeof renderTimeline === "function") renderTimeline();
      paintLayers(); mark();
      log("[canvas] dropped at " + t0.toFixed(2) + "s -> " + placed.join(", "));
    };
    if (files) {
      importFiles(files, function (up) {
        if (up.kind === "video") addVideo({ name: up.name, dur: up.duration, in: 0, out: up.duration, opacity: 1, start: t0, src: "video" });
        else if (up.kind === "sound") addSound({ name: up.name, start: t0, in: 0, out: up.duration });
        else if (up.kind === "images") addImage({ name: up.name, start: t0, len: 3, opacity: 1 });
      }).then(done);
      return;
    }
    if (h3 && h3.name) {
      addVideo({ name: h3.name, dur: h3.duration, in: 0, out: h3.duration, opacity: 1, start: t0, src: h3.where === "final" ? "final" : "output" });
      done(); return;
    }
    if (!payload) return;
    if (payload.type === "asset") {
      if (payload.kind === "video") addVideo({ name: payload.name, dur: payload.duration, in: 0, out: payload.duration, opacity: 1, start: t0, src: "video" });
      else if (payload.kind === "sound") addSound({ name: payload.name, dur: payload.duration, start: t0, in: 0, out: payload.duration });
      else if (payload.kind === "images") addImage({ name: payload.name, start: t0, len: 3, opacity: 1 });
      done();
    } else if (payload.type === "output") {
      adoptOutput(payload.name, payload.kind).then(function (a) {
        if (a.kind === "images") addImage({ name: a.name, start: t0, len: 3, opacity: 1 });
        else if (a.kind === "sound") addSound({ name: a.name, dur: a.duration, start: t0, in: 0, out: a.duration });
        else addVideo({ name: a.name, dur: a.duration, in: 0, out: a.duration, opacity: 1, start: t0, src: "video" });
        if (typeof refreshAssets === "function") refreshAssets();
        done();
      }).catch(function (err) { say("could not add " + payload.name + ": " + (err.message || err)); });
    } else if (payload.type === "refimg" && typeof refs !== "undefined" && refs[payload.refIndex]) {
      var r = refs[payload.refIndex];
      uploadAsset(new File([r.file], "ref_" + Date.now().toString(36) + ".png", { type: "image/png" })).then(function (up) {
        if (up) addImage({ name: up.name, start: t0, len: 3, opacity: 1 });
        if (typeof refreshAssets === "function") refreshAssets();
        done();
      });
    }
  });

  /* ------------------------------------------------------------------ text layers */
  function addText(p) {
    var t0 = fsnap(S.t);
    var c = { name: "", start: t0, len: 5, opacity: 1, text: textDefaults(),
              tf: { x: Math.round(p.x - S.W / 2), y: Math.round(p.y - S.H / 2), scale: 1, rot: 0 } };
    c.tid = "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    c.name = "text_" + c.tid + ".png";
    var L = mkLayer("T" + ((tl.images || []).filter(function (x) { return (x.clips || []).some(function (y) { return y.text; }); }).length + 1), [c]);
    L.text = true;
    tl.images.push(L);
    uploadText(c);
    if (typeof tlSave === "function") tlSave();
    select(c, { lk: "i:" + (tl.images.length - 1) });
    setTool("move");
    focusText();
    log("[canvas] text layer " + L.name + " at " + t0.toFixed(2) + "s");
  }
  function focusText() { setTimeout(function () { var a = $("tlpText"); if (a) { a.focus(); a.select(); } }, 30); }

  function removeClip(sel) {
    var L = sel.Ly.L, i = L.clips.indexOf(sel.c);
    if (i < 0) return;
    L.clips.splice(i, 1);
    if (!L.clips.length && sel.Ly.kind !== "v1") {
      var arr = sel.Ly.kind === "vl" ? tl.vlayers : sel.Ly.kind === "img" ? tl.images : tl.audio;
      var j = arr.indexOf(L); if (j >= 0) arr.splice(j, 1);
    }
    try { tlSelClip = null; } catch (e) { /* fine */ }
    tlSave(); renderTimeline(); paintLayers(); paintProps(); mark();
  }

  /* ------------------------------------------------------------------ the LAYERS panel */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function rows() {
    var out = [];
    var st = stack();
    for (var i = st.length - 1; i >= 0; i--) out.push(st[i]);
    return out.concat(audioStack());
  }
  function icon(Ly) {
    if (Ly.kind === "aud") return "🔊";
    if (Ly.kind === "img") return Ly.clips.some(function (c) { return c.text; }) ? "T" : "🖼";
    if (Ly.L && Ly.L.path) return "⤳";                                 // 2.387.0: a path layer
    if (Ly.clips.some(function (c) { return c.m3d; })) return "🧊";   // 2.382.0
    return "🎞";
  }
  function arrOf(Ly) { return Ly.kind === "vl" ? tl.vlayers : Ly.kind === "img" ? tl.images : Ly.kind === "aud" ? tl.audio : null; }
  function paintLayers() {
    var box0 = $("tlLayerList"); if (!box0) return;
    if (S.renaming) return;              // 2.382.1: never repaint under a name being typed
    var cur = selClip();
    box0.innerHTML = rows().map(function (Ly, i) {
      var c = Ly.clips.find(function (x) { return at(x, Ly.kind === "aud" ? "aud" : Ly.kind, S.t); }) || Ly.clips[0];
      var sub = c ? (c.text ? String(c.text.content || "").split("\n")[0]
        : c.m3d ? (c.m3d.type === "text" ? String(c.m3d.text || "").split("\n")[0] : String(c.m3d.model || "3D model")) : String(c.name || "")) : "empty";
      var on = Ly.L.visible !== false;
      var sel = (cur && cur.Ly.lk === Ly.lk) || tl.selLayer === Ly.lk;
      var arr = arrOf(Ly);
      var hue = typeof layerHue === "function" ? layerHue(Ly.L) : null;     // 2.383.0: the layer's own colour
      return '<div class="tll-row' + (sel ? " sel" : "") + '" data-i="' + i + '"' + (hue != null && !sel ? ' style="border-left-color:hsl(' + hue + ' 58% 56%)"' : "")
        + ' title="' + esc(Ly.L.name || Ly.lk) + " - " + esc(sub) + '">'
        + '<button class="ghost eye' + (on ? "" : " offv") + '" data-act="eye" title="' + (on ? "Hide" : "Show") + ' this layer" aria-label="Visibility">👁</button>'
        + '<span class="tll-ic">' + icon(Ly) + "</span>"
        + '<span class="tll-nm"><b class="tll-name" title="Double-click to rename (Enter keeps it, Esc cancels)">' + esc(Ly.L.name || Ly.lk.toUpperCase()) + "</b> <small>" + esc(sub.slice(0, 40)) + "</small></span>"
        + (arr ? '<button class="ghost" data-act="up" title="Move this layer up" aria-label="Up">▲</button>'
               + '<button class="ghost" data-act="down" title="Move this layer down" aria-label="Down">▼</button>'
               + '<button class="ghost" data-act="del" title="Delete this layer" aria-label="Delete">🗑</button>' : "")
        + "</div>";
    }).join("") || '<div class="tll-row"><span class="tll-nm"><small>no layers yet - drop media on the canvas</small></span></div>';
  }
  $("tlLayerList").addEventListener("click", function (e) {
    var row = e.target.closest(".tll-row[data-i]"); if (!row) return;
    var Ly = rows()[+row.getAttribute("data-i")]; if (!Ly) return;
    var act = (e.target.closest("button") || {}).getAttribute ? e.target.closest("button") && e.target.closest("button").getAttribute("data-act") : null;
    var arr = arrOf(Ly);
    // 2.382.1: a double-click on the name renames it in place. The first click re-paints the list (it selects), so the
    // browser's dblclick may never reach the new row - the second click (detail 2) is caught here instead.
    if (!act && e.detail >= 2 && e.target.closest(".tll-nm")) { if (!S.renaming) editName(row, Ly); return; }
    if (act === "eye") { Ly.L.visible = Ly.L.visible === false; tlSave(); renderTimeline(); paintLayers(); mark(); return; }
    if (act === "up" || act === "down") {
      var i = arr.indexOf(Ly.L), j = i + (act === "up" ? 1 : -1);   // the panel lists top first: "up" = later in the array
      if (j < 0 || j >= arr.length) return;
      arr.splice(i, 1); arr.splice(j, 0, Ly.L);
      if (typeof tlKaraokeOnTop === "function") tlKaraokeOnTop();
      tlSave(); renderTimeline(); paintLayers(); mark(); return;
    }
    if (act === "del") {
      var go1 = typeof appConfirm === "function" ? appConfirm('Delete the layer "' + (Ly.L.name || Ly.lk) + '" and its ' + Ly.clips.length + " clip(s) from the timeline?", "Delete layer") : Promise.resolve(true);
      go1.then(function (ok) {
        if (!ok) return;
        var k = arr.indexOf(Ly.L); if (k >= 0) arr.splice(k, 1);
        try { if (Ly.clips.indexOf(tlSelClip) >= 0) tlSelClip = null; } catch (x) { /* fine */ }
        tl.selLayer = null;
        tlSave(); renderTimeline(); paintLayers(); paintProps(); mark();
      });
      return;
    }
    var c = Ly.clips.find(function (x) { return at(x, Ly.kind === "aud" ? "aud" : Ly.kind, S.t); }) || Ly.clips[0];
    tl.selLayer = Ly.lk;
    if (c) select(c, Ly); else { paintLayers(); mark(); }
  });
  /* 2.382.1 (Tim: "allow user to edit the names of the layers"): a layer's name is edited IN PLACE - double-click it
     (or F2 on the selected layer; or the Name box in Properties). Enter / leaving keeps it, Esc puts the old one back.
     The timeline's own track labels rename the same layer (and repaint this list). */
  function renameLayer(L, val) {
    var v = String(val == null ? "" : val).replace(/\s+/g, " ").trim().slice(0, 40);
    if (!v || v === L.name) return false;
    L.name = v;
    tlSave(); if (typeof renderTimeline === "function") renderTimeline();
    log("[canvas] layer renamed: " + v);
    return true;
  }
  function editName(row, Ly) {
    var b = row && row.querySelector(".tll-name"); if (!b || !Ly) return;
    var was = Ly.L.name || "";
    S.renaming = true;
    b.contentEditable = "true"; b.spellcheck = false; b.classList.add("editing");
    b.focus();
    try { var r = document.createRange(); r.selectNodeContents(b); var sl = window.getSelection(); sl.removeAllRanges(); sl.addRange(r); } catch (x) { /* fine */ }
    var done = false;
    var finish = function (keep) {
      if (done) return; done = true;
      b.contentEditable = "false"; b.classList.remove("editing");
      S.renaming = false;
      if (!(keep && renameLayer(Ly.L, b.textContent))) b.textContent = was || Ly.lk.toUpperCase();
      paintLayers(); paintProps();
    };
    b.addEventListener("keydown", function (ev) {
      ev.stopPropagation();
      if (ev.key === "Enter") { ev.preventDefault(); finish(true); }
      else if (ev.key === "Escape") { ev.preventDefault(); finish(false); }
    });
    b.addEventListener("blur", function () { finish(true); });
    b.addEventListener("pointerdown", function (ev) { ev.stopPropagation(); });
  }
  $("tlLayerList").addEventListener("dblclick", function (e) {
    var row = e.target.closest(".tll-row[data-i]"); if (!row || e.target.closest("button")) return;
    var Ly = rows()[+row.getAttribute("data-i")]; if (!Ly || S.renaming) return;
    e.preventDefault();
    editName(row, Ly);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "F2" || typing() || S.renaming || document.querySelector("dialog[open]")) return;
    if (!(S.over || document.activeElement === $("tlCanvasWrap"))) return;
    var row = $("tlLayerList").querySelector(".tll-row.sel[data-i]"); if (!row) return;
    e.preventDefault();
    editName(row, rows()[+row.getAttribute("data-i")]);
  });

  /* ------------------------------------------------------------------ the selected clip's PROPERTIES */
  function paintProps(valuesOnly) {
    var P = $("tlProps"); if (!P) return;
    var sel = selClip();
    if (!sel || sel.Ly.kind === "aud") {
      if (!valuesOnly) P.innerHTML = '<div class="tlp-t">Properties</div><div class="tlp-none">Select a clip on the canvas or a layer above.'
        + (sel && sel.Ly.kind === "aud" ? " A sound layer has no picture - its volume is on the timeline." : "") + "</div>";
      P._for = null;
      // 2.406.0: a sound clip still gets the hooks (🎧 its clean-up, 🗣 its role in the mix - ext/timelinedock/clipfx.js)
      if (sel && !valuesOnly) propHooks.forEach(function (fn) { try { fn(P, sel.c, sel); } catch (e) { log("[canvas] properties: " + (e.message || e)); } });
      return;
    }
    var c = sel.c, tf = tfAt(c), base = sel.Ly.kind === "v1", h0;
    if (valuesOnly && P._for === c) {
      var setv = function (id, v) { var el = $(id); if (el && document.activeElement !== el) el.value = v; };
      setv("tlpX", Math.round(tf.x)); setv("tlpY", Math.round(tf.y)); setv("tlpS", Math.round(tf.scale * 1000) / 10); setv("tlpR", Math.round(tf.rot * 10) / 10);
      setv("tlpO", Math.round(opAt(c) * 100));
      if (c.text) setv("tlpColor", KF.value(c.kf, S.t - (c.start || 0), "color", c.text.color));
      paintKeys(c, sel);
      return;
    }
    P._for = c;
    var t = c.text;
    // 2.382.1: the layer's name, editable right here
    h0 = '<div class="tlp-row" style="margin:0 0 4px"><label style="flex:1">Name <input type="text" id="tlpName" maxlength="40" value="'
      + esc(sel.Ly.L.name || sel.Ly.lk.toUpperCase()) + '" title="The layer\'s name (the timeline and this list)" style="width:100%"></label></div>';
    var h = h0 + '<div class="tlp-t">' + (t ? "Text" : base ? "V1 clip (the base picture)" : sel.Ly.kind === "img" ? "Picture"
      : c.m3d ? (c.m3d.type === "text" ? "3D text" : "3D model") : "Video") + " · " + esc(sel.Ly.L.name || sel.Ly.lk) + "</div>";
    if (!base) h += '<div class="tlp-g">'
      + '<span>X</span><input type="number" id="tlpX" step="1" value="' + Math.round(tf.x) + '" title="Pixels right of the picture\'s centre">'
      + '<span>Y</span><input type="number" id="tlpY" step="1" value="' + Math.round(tf.y) + '" title="Pixels below the picture\'s centre">'
      + '<span>Scale</span><input type="number" id="tlpS" step="1" min="1" max="2000" value="' + (Math.round(tf.scale * 1000) / 10) + '" title="% of its own size">'
      + '<span>Rot°</span><input type="number" id="tlpR" step="1" value="' + tf.rot + '" title="Degrees clockwise">'
      + "</div>" + '<div class="tlp-keys" id="tlpKeys"></div>';   // 2.379.0: ◀ ◇ Key ▶ right under what it keys
    h += '<div class="tlp-row"><label>Opacity <input type="number" id="tlpO" min="0" max="100" step="1" value="' + Math.round(opAt(c) * 100) + '" style="width:58px">%</label>'
      + (sel.Ly.kind === "img" ? '<label>Length <input type="number" id="tlpLen" min="0.1" step="0.1" value="' + imgLen(c).toFixed(2) + '" style="width:62px">s</label>' : "")
      + (!base ? '<button class="ghost" id="tlpReset" title="Back to the centre, 100%, no rotation">Reset</button>' : "") + "</div>";
    if (t) {
      h += '<textarea id="tlpText" rows="3" placeholder="Type the text" title="The text (Enter = a new line)">' + esc(t.content) + "</textarea>"
        + '<div class="tlp-row"><select id="tlpFont" title="Font">' + FONTS.map(function (f) { return '<option' + (f === t.font ? " selected" : "") + ">" + esc(f) + "</option>"; }).join("") + "</select>"
        + '<input type="number" id="tlpSize" min="4" max="1000" value="' + t.size + '" title="Size (px)" style="width:62px">'
        + '<input type="color" id="tlpColor" value="' + esc(KF.value(c.kf, S.t - (c.start || 0), "color", t.color)) + '" title="Colour (keyframed once a ◆ holds a colour)"></div>'
        + '<div class="tlp-row"><label><input type="checkbox" id="tlpBold"' + (t.bold ? " checked" : "") + "><b>B</b></label>"
        + '<label><input type="checkbox" id="tlpItal"' + (t.italic ? " checked" : "") + "><i>I</i></label>"
        + '<label><input type="checkbox" id="tlpShadow"' + (t.shadow ? " checked" : "") + "> shadow</label>"
        + '<select id="tlpAlign" title="Alignment" style="width:auto">' + ["left", "center", "right"].map(function (a) { return '<option' + (a === t.align ? " selected" : "") + ">" + a + "</option>"; }).join("") + "</select></div>"
        + '<div class="tlp-row"><label>Outline <input type="color" id="tlpStroke" value="' + esc(t.stroke) + '"></label>'
        + '<input type="number" id="tlpStrokeW" min="0" max="60" value="' + t.strokeW + '" title="Outline width (px)" style="width:52px">px</div>';
    }
    P.innerHTML = h;
    var nmIn = $("tlpName");
    if (nmIn) {
      nmIn.addEventListener("keydown", function (ev) { ev.stopPropagation(); if (ev.key === "Enter") nmIn.blur(); if (ev.key === "Escape") { nmIn.value = sel.Ly.L.name || ""; nmIn.blur(); } });
      nmIn.addEventListener("change", function () { if (renameLayer(sel.Ly.L, nmIn.value)) paintLayers(); else nmIn.value = sel.Ly.L.name || sel.Ly.lk.toUpperCase(); });
    }
    var touch = function () { tlSave(); mark(); if (typeof renderTimeline === "function") renderTimeline(); paintLayers(); };
    var tfIn = function (id, key, conv) {
      var el = $(id); if (!el) return;
      el.addEventListener("input", function () { var v = Number(el.value); if (!Number.isFinite(v)) return; var o = {}; o[key] = conv ? conv(v) : v; writeTf(c, o); mark(); });
      el.addEventListener("change", function () { tlSave(); if (c.kf && typeof renderTimeline === "function") renderTimeline(); });
    };
    tfIn("tlpX", "x"); tfIn("tlpY", "y"); tfIn("tlpR", "rot");
    tfIn("tlpS", "scale", function (v) { return Math.max(0.01, Math.min(20, v / 100)); });
    var o = $("tlpO"); if (o) o.addEventListener("change", function () {
      var v = Math.max(0, Math.min(1, (+o.value || 0) / 100));
      if (!writeKeyed(c, "op", v)) c.opacity = v;
      touch();
    });
    var ln = $("tlpLen"); if (ln) ln.addEventListener("change", function () { c.len = Math.max(0.1, +ln.value || 3); touch(); });
    var rs = $("tlpReset"); if (rs) rs.addEventListener("click", function () { delete c.tf; touch(); paintProps(); });
    if (t) {
      var upd = function () {
        t.content = $("tlpText").value; t.font = $("tlpFont").value; t.size = Math.max(4, Math.min(1000, +$("tlpSize").value || 48));
        if (!writeKeyed(c, "color", $("tlpColor").value)) t.color = $("tlpColor").value;   // keyed colour -> the ◆ at the playhead
        t.bold = $("tlpBold").checked; t.italic = $("tlpItal").checked; t.shadow = $("tlpShadow").checked;
        t.align = $("tlpAlign").value; t.stroke = $("tlpStroke").value; t.strokeW = Math.max(0, Math.min(60, +$("tlpStrokeW").value || 0));
        saveTextPng(c); mark();
      };
      ["tlpText", "tlpSize", "tlpStrokeW", "tlpColor", "tlpStroke"].forEach(function (id) { $(id).addEventListener("input", upd); });
      ["tlpFont", "tlpBold", "tlpItal", "tlpShadow", "tlpAlign"].forEach(function (id) { $(id).addEventListener("change", upd); });
      $("tlpText").addEventListener("change", function () { touch(); });
      $("tlpColor").addEventListener("change", function () { if (c.kf) touch(); });
    }
    if (!base) paintKeys(c, sel);
    propHooks.forEach(function (fn) { try { fn(P, c, sel); } catch (e) { log("[canvas] properties: " + (e.message || e)); } });   // 2.382.0
  }
  var propHooks = [];

  /* 2.379.0 the KEYFRAME row of the Properties panel: ◀ previous ◆, ◆ key everything here, ▶ next ◆, the ease out of
     the ◆ at the playhead, ✕ delete it - the same keyframes the timeline shows as diamonds on the clip */
  function paintKeys(c, sel) {
    var K = $("tlpKeys"); if (!K) return;
    var kind = sel.Ly.kind === "vl" ? "video" : "image";
    var tau = S.t - (c.start || 0), inClip = at(c, sel.Ly.kind, S.t);
    var here = inClip ? KF.find(c.kf, tauOf(c, sel.Ly.kind), FPS) : null;
    var n = (c.kf || []).length;
    var sig = [n, here ? here.at + ":" + (here.ease || "") : "-", inClip, KF.step(c.kf, tau, -1), KF.step(c.kf, tau, 1)].join("|");
    if (K._sig === sig && K._for === c) return;
    K._sig = sig; K._for = c;
    K.innerHTML = '<div class="tlp-row" style="flex-wrap:wrap">'
      + '<button class="ghost" id="tlpKPrev" title="Go to the previous keyframe"' + (KF.step(c.kf, tau, -1) == null ? " disabled" : "") + '>◀</button>'
      + '<button class="ghost" id="tlpKAdd" title="Keyframe here: position, scale, rotation, opacity' + (c.text ? ", colour" : "")
      + ' at the playhead - make another one at a different time with different values and the canvas tweens between them"'
      + (inClip ? "" : " disabled") + '>' + (here ? "◆ Keyed" : "◇ Key") + '</button>'
      + '<button class="ghost" id="tlpKNext" title="Go to the next keyframe"' + (KF.step(c.kf, tau, 1) == null ? " disabled" : "") + '>▶</button>'
      + (here ? '<select id="tlpKEase" title="How this keyframe tweens to the next one" style="width:auto">'
        + [["linear", "linear"], ["in", "ease in"], ["out", "ease out"], ["inout", "ease in+out"], ["hold", "hold"], ["bezier", "Bézier (📈 graph)"]].map(function (e) {
            return '<option value="' + e[0] + '"' + ((here.ease || "linear") === e[0] ? " selected" : "") + ">" + e[1] + "</option>"; }).join("")
        + '</select><button class="ghost" id="tlpKDel" title="Delete the keyframe at the playhead">✕◆</button>' : "")
      + '<span class="tlp-none" style="margin-left:auto">' + n + " ◆</span></div>";
    var goKey = function (dir) {
      var k = KF.step(c.kf, S.t - (c.start || 0), dir);
      if (k == null) return;
      var tt = (c.start || 0) + k;
      if (typeof setPlayhead === "function") setPlayhead(tt); else go(tt);
      S.t = tt; mark(); paintProps(true);
    };
    $("tlpKPrev").addEventListener("click", function () { goKey(-1); });
    $("tlpKNext").addEventListener("click", function () { goKey(1); });
    $("tlpKAdd").addEventListener("click", function () {
      if (typeof kfAdd !== "function") return;
      kfAdd(c, tauOf(c, sel.Ly.kind), kind, sel.Ly.lk);
      keysChanged(c);
      if (typeof renderTimeline === "function") renderTimeline();
      log("[canvas] ◆ keyframe on " + (sel.Ly.L.name || sel.Ly.lk) + " at +" + tauOf(c, sel.Ly.kind).toFixed(2) + "s");
    });
    var es = $("tlpKEase");
    if (es) es.addEventListener("change", function () {
      var k = KF.find(c.kf, tauOf(c, sel.Ly.kind), FPS); if (!k) return;
      if (es.value === "linear") delete k.ease; else k.ease = es.value;
      if (k.ease === "bezier" && !(KF.okBz && KF.okBz(k.bz))) k.bz = (KF.EASY || [0.333, 0, 0.667, 1]).slice();   // 2.489.0
      keysChanged(c); if (typeof renderTimeline === "function") renderTimeline();
    });
    var kd = $("tlpKDel");
    if (kd) kd.addEventListener("click", function () {
      c.kf = KF.remove(c.kf, tauOf(c, sel.Ly.kind), FPS);
      if (!c.kf.length) delete c.kf;
      keysChanged(c); if (typeof renderTimeline === "function") renderTimeline();
    });
  }
  /* the keyframes changed (here, or in the timeline's ◆ editor): save, repaint, and a keyed text colour needs its
     white twin picture on disk for the compile */
  function keysChanged(c) {
    if (c && c.kf && KF.rove) c.kf = KF.rove(c.kf);          // 2.496.0: roving position keys re-timed (an even speed)
    if (typeof tlSave === "function") tlSave();
    if (c && c.text && KF.has(c.kf, "color")) saveTextPng(c);
    mark(); paintProps(true);
    var K = $("tlpKeys"); if (K) K._sig = null;
    var sel = selClip(); if (sel && sel.c === c) paintKeys(c, sel);
  }

  /* ------------------------------------------------------------------ wiring */
  $("tlTool_move").addEventListener("click", function () { setTool("move"); });
  $("tlTool_text").addEventListener("click", function () { setTool("text"); });
  $("tlTool_hand").addEventListener("click", function () { setTool("hand"); });
  $("tlTool_zoom").addEventListener("click", function () { setTool("zoom"); });
  $("tlTool_fit").addEventListener("click", fit);
  $("tlTool_color").addEventListener("input", function () {
    S.color = $("tlTool_color").value; storeSet("tlc.color", S.color);
    var sel = selClip();
    if (sel && sel.c.text) {
      if (writeKeyed(sel.c, "color", S.color)) keysChanged(sel.c);
      else { sel.c.text.color = S.color; saveTextPng(sel.c); tlSave(); paintProps(); mark(); }
    }
  });
  $("tlCPlay").addEventListener("click", function () { if (S.playing) pause(); else play(); });
  $("tlCStop").addEventListener("click", stop);
  $("tlCStart").addEventListener("click", function () { go(range().a); });
  $("tlCEnd").addEventListener("click", function () { pause(); go(Math.max(0, endT())); });
  $("tlCLoop").addEventListener("click", function () { S.loop = !S.loop; paintTransport(); });
  $("tlCZoomFit").addEventListener("click", fit);
  // show / hide the stage, its height
  var tog = $("tlStageTog");
  function stageOn(on) {
    $("tlStage").classList.toggle("off", !on);
    var sp = $("tlStageSplit"); if (sp) sp.style.display = on ? "" : "none";
    if (tog) tog.classList.toggle("on", on);
    storeSet("tlstage.on", on ? "1" : "0");
    mark();
  }
  if (tog) tog.addEventListener("click", function () { stageOn($("tlStage").classList.contains("off")); });
  var sh = parseInt(storeGet("tlstage.h", "320"), 10);
  if (sh >= 160) document.documentElement.style.setProperty("--tlsh", sh + "px");
  var split = $("tlStageSplit");
  if (split) split.addEventListener("pointerdown", function (ev) {
    var y0 = ev.clientY, h0 = $("tlStage").getBoundingClientRect().height;
    var mv = function (e) { var h = Math.max(160, Math.min(1400, h0 + e.clientY - y0)); document.documentElement.style.setProperty("--tlsh", h + "px"); mark(); };
    var up = function (e) { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up);
      storeSet("tlstage.h", String(Math.round($("tlStage").getBoundingClientRect().height))); };
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up);
    ev.preventDefault();
  });
  stageOn(storeGet("tlstage.on", "1") !== "0");
  S.color = storeGet("tlc.color", "#ffffff"); $("tlTool_color").value = S.color;

  // the core's edits and scrubs repaint the canvas and the layers list
  ["renderTimeline", "setPlayhead", "tlSwitch"].forEach(function (fn) {
    var orig = window[fn];
    if (typeof orig !== "function" || orig._tlc) return;
    var wrapped = function () { var r = orig.apply(this, arguments); mark(); clearTimeout(S.lp); S.lp = setTimeout(function () { paintLayers(); paintProps(true); }, 60); return r; };
    wrapped._tlc = true;
    window[fn] = wrapped;
  });
  // ⚙ Compile reads the text pictures from disk: anything still waiting is saved first (capture = before the compile)
  var ex = $("tlExport");
  if (ex) ex.addEventListener("click", function () { flushText(); }, true);
  /* 2.382.0: what ⚙ Compile waits for (timelinedock.js awaits it): the text pictures and every 3D layer's bake */
  function beforeExport() {
    return Promise.all([flushText(), window.TlM3D ? TlM3D.bakeAll() : true]).then(function (r) {
      return window.TlParent && TlParent.bakeAll ? TlParent.bakeAll().then(function () { return r; }) : r;   // 2.490.0: parented layers
    });
  }
  if (typeof ResizeObserver === "function") new ResizeObserver(mark).observe(wrap);
  window.addEventListener("resize", mark);

  setTool("move");
  paintTransport();
  paintLayers(); paintProps();
  loop();
  /* 2.380.0: a NEW picture / video layer with one clip (the ✨ Fill results - fill.js) */
  function newLayer(kind, c, name) {
    var arr = kind === "video" ? tl.vlayers : tl.images;
    var L = mkLayer(name || ((kind === "video" ? "V" + (tl.vlayers.length + 2) : "I" + (tl.images.length + 1))), [c]);
    arr.push(L);
    if (kind === "video" && typeof tlKaraokeOnTop === "function") tlKaraokeOnTop();
    if (typeof tlSave === "function") tlSave();
    if (typeof renderTimeline === "function") renderTimeline();
    select(c, { lk: (kind === "video" ? "vl:" : "i:") + (arr.length - 1) });
    return L;
  }
  window.TlCanvas = { state: S, play: play, pause: pause, stop: stop, go: go, shuttle: shuttle, step: step, draw: draw, addText: addText, renderText: renderText,
                      addTool: addTool, onDraw: function (fn) { drawHooks.push(fn); mark(); }, mark: mark,
                      onComp: function (fn) { compHooks.push(fn); mark(); }, srcAt: srcAt, vidAt: vidAt,   // 2.406.0 toComp: toComp,
                      toScreen: toScreen, paintComp: paintComp, newLayer: newLayer, say: say,
                      box: box, stack: stack, hit: hit, select: select, setTool: setTool, fit: fit, paintLayers: paintLayers,
                      flushText: flushText, uploadText: uploadText, saveTextPng: saveTextPng, fxSpec: fxSpec, snapshot: snapshot,
                      tfAt: tfAt, textAt: textAt, keysChanged: keysChanged, writeTf: writeTf,
                      // 2.382.0 the 3D layers (ext/timelinedock/m3d.js)
                      beforeExport: beforeExport, onProps: function (fn) { propHooks.push(fn); paintProps(); },
                      paintProps: paintProps, writeKeyed: writeKeyed, onGrab: function (h) { grabHooks.push(h); },
                      drawClip: drawClip, nullPic: nullPic, clipLen: clipLen,   // 2.490.0
                      drawLayer: drawLayer, BLENDS: BLENDS, MATTES: MATTES, mixYUV: mixYUV, blendYUV: blendYUV,   // 2.491.0
                      at: at, keysAt: function () { return S.over && !S.overDock; }, renameLayer: renameLayer, tauOf: tauOf, selClip: selClip, layerOf: layerOf, opac: opac };
  if (window.H3M3D) H3M3D.onChange(mark);
  }
})();
