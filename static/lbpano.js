/* bitGen Studio — static/lbpano.js (2.987.0): THE IMAGE PREVIEW'S 🌐 PANORAMA 3D (window.H3LbPano).
 * Tim (verbatim): "in image preview dialog add a button to view panorama 3d and controls to move around the panorama. and
 * allow user to watch vr sbs or top bottom."
 *
 *   🌐 Panorama 3D (#lb_pano, the preview's bar after 💾 Save, pictures only) - the picture as a 360° panorama (equirectangular) round you,
 *   over the picture (#lb_panoview) - the preview's own ‹ › and its bar stay; 🌐 again / ✕ / Esc goes back to the picture.
 *   LOOK      drag (or one finger) to look round, the wheel / pinch / + − to zoom (the field of view 30° - 110°), the arrow
 *             keys / W A S D / the ◀ ▲ ▼ ▶ pad turn, ⟲ straight ahead, ⟳ turns by itself, ⛶ full screen
 *   VIEW      🖥 Normal · 👓 VR side by side (left eye | right eye) · 👓 VR top / bottom (left eye over the right) - for a
 *             phone headset or a VR video player's picture
 *   PICTURE   Auto · Mono · Stereo side by side · Stereo top / bottom - a STEREO panorama (each eye its own half) is read
 *             as one: auto = 2:1 mono, 1:1 top / bottom, 4:1 side by side
 *   kept      the view and the picture kind (localStorage h3.lbpano.*)
 * three.js = static/vendor/three-m3d.min.js (H3M3D.load - already on this computer, nothing from the internet).
 * Pure (Node: scripts/test-987.js): detect, eyeUV, viewports, clampLook, FOV. */
(function (root) {
  "use strict";
  const FOV = [30, 110];
  /** the stereo layout of a panorama picture from its size: 2:1 mono, ~1:1 top / bottom, ~4:1 side by side */
  function detect(w, h) { const a = w > 0 && h > 0 ? w / h : 2; return a > 3 ? "sbs" : a < 1.5 ? "tb" : "mono"; }
  /** the part of the picture an eye sees: {repeat [x, y], offset [x, y]} in texture space (v up: the TOP half = offset y 0.5) */
  function eyeUV(layout, eye) {
    if (layout === "sbs") return { repeat: [0.5, 1], offset: [eye === "right" ? 0.5 : 0, 0] };
    if (layout === "tb") return { repeat: [1, 0.5], offset: [0, eye === "right" ? 0 : 0.5] };
    return { repeat: [1, 1], offset: [0, 0] };
  }
  /** where each eye is drawn on a W × H canvas: normal = one view; sbs = left | right halves; tb = left over right */
  function viewports(mode, W, H) {
    if (mode === "sbs") { const w = Math.floor(W / 2); return [{ eye: "left", x: 0, y: 0, w, h: H }, { eye: "right", x: w, y: 0, w: W - w, h: H }]; }
    if (mode === "tb") { const h = Math.floor(H / 2); return [{ eye: "left", x: 0, y: H - h, w: W, h }, { eye: "right", x: 0, y: 0, w: W, h: H - h }]; }   // gl's y is from the bottom
    return [{ eye: "left", x: 0, y: 0, w: W, h: H }];
  }
  /** the look made safe: yaw any (wrapped to -180..180), pitch -89..89, fov 30..110 */
  function clampLook(L) {
    const y = ((((+L.yaw || 0) + 180) % 360) + 360) % 360 - 180;
    return { yaw: y, pitch: Math.max(-89, Math.min(89, +L.pitch || 0)), fov: Math.max(FOV[0], Math.min(FOV[1], +L.fov || 75)) };
  }
  const pure = { detect, eyeUV, viewports, clampLook, FOV };
  if (!root.document) { if (typeof module !== "undefined") module.exports = pure; return; }

  const doc = root.document, $ = (id) => doc.getElementById(id);
  const LS = { get: (k, d) => { try { const v = root.localStorage.getItem("h3.lbpano." + k); return v == null ? d : v; } catch (e) { return d; } }, set: (k, v) => { try { root.localStorage.setItem("h3.lbpano." + k, v); } catch (e) { /* this session */ } } };
  const S = { on: false, T: null, R: null, scene: null, cams: null, mats: [], tex: null, look: { yaw: 0, pitch: 0, fov: 75 }, mode: LS.get("mode", "normal"), pic: LS.get("pic", "auto"), layout: "mono", spin: false, raf: 0, drag: null, url: "", size: [0, 0], keys: new Set() };
  const cur = () => { try { return root.lb && root.lb.items ? root.lb.items[root.lb.i] : (typeof lb !== "undefined" ? lb.items[lb.i] : null); } catch (e) { return null; } };   // eslint-disable-line no-undef

  function css() {
    if ($("lbPanoCss")) return;
    const s = doc.createElement("style"); s.id = "lbPanoCss";
    s.textContent = "#lb_panoview{position:absolute;inset:0;z-index:5;background:#000;display:none;touch-action:none}#lb_panoview.on{display:block}"
      + "#lb_panoview canvas{width:100%;height:100%;display:block;cursor:grab}#lb_panoview canvas:active{cursor:grabbing}"
      + "#lb_panoui{position:absolute;left:8px;bottom:8px;display:flex;gap:6px;align-items:center;flex-wrap:wrap;background:#000a;border-radius:8px;padding:5px 7px;font-size:12px;color:#ddd}"
      + "#lb_panoui button,#lb_panoui select{font-size:12px;padding:2px 7px}#lb_panoui .pad{display:grid;grid-template-columns:repeat(3,26px);grid-template-rows:repeat(2,22px);gap:2px}"
      + "#lb_panoui .pad button{padding:0}#lb_panoui button.on{background:var(--tiger-deep,#a8601a);color:#fff}#lb_panoinfo{position:absolute;right:10px;top:8px;color:#ccc;font-size:12px;background:#0008;padding:2px 8px;border-radius:5px;pointer-events:none}"
      + "#lb_pano.on{background:var(--tiger-deep,#a8601a);color:#fff}";
    doc.head.appendChild(s);
  }
  function build() {
    const st = $("lb_stage"); if (!st) return null;
    let v = $("lb_panoview"); if (v) return v;
    v = doc.createElement("div"); v.id = "lb_panoview"; v.setAttribute("role", "application"); v.setAttribute("aria-label", "Panorama 3D - drag to look round");
    v.innerHTML = '<div id="lb_panoinfo"></div><div id="lb_panoui">'
      + '<div class="pad" role="group" aria-label="Turn"><span></span><button type="button" class="ghost" data-turn="up" title="Look up (↑ / W)">▲</button><span></span>'
      + '<button type="button" class="ghost" data-turn="left" title="Turn left (← / A)">◀</button><button type="button" class="ghost" data-turn="down" title="Look down (↓ / S)">▼</button><button type="button" class="ghost" data-turn="right" title="Turn right (→ / D)">▶</button></div>'
      + '<button type="button" class="ghost" id="lb_panoin" title="Zoom in (+ / the wheel)">＋</button><button type="button" class="ghost" id="lb_panoout" title="Zoom out (−)">－</button>'
      + '<button type="button" class="ghost" id="lb_panohome" title="Straight ahead, the zoom back (Home)">⟲</button><button type="button" class="ghost" id="lb_panospin" title="Turn by itself (Space)">⟳ Auto</button>'
      + '<select id="lb_panomode" title="How it is shown - 👓 for a phone headset or a VR player" aria-label="View"><option value="normal">🖥 Normal</option><option value="sbs">👓 VR side by side</option><option value="tb">👓 VR top / bottom</option></select>'
      + '<select id="lb_panopic" title="The picture: a plain 360° (mono) or a STEREO one - each eye its own half" aria-label="Picture"><option value="auto">Auto</option><option value="mono">Mono 360°</option><option value="sbs">Stereo side by side</option><option value="tb">Stereo top / bottom</option></select>'
      + '<button type="button" class="ghost" id="lb_panofull" title="Full screen (F)">⛶</button><button type="button" class="ghost" id="lb_panoclose" title="Back to the picture (Esc)">✕</button></div>';
    st.appendChild(v);
    v.querySelectorAll("[data-turn]").forEach((b) => {
      let iv = 0; const go = () => turn(b.dataset.turn, 4);
      b.addEventListener("pointerdown", (e) => { e.stopPropagation(); go(); clearInterval(iv); iv = setInterval(go, 40); });
      ["pointerup", "pointerleave", "pointercancel"].forEach((t) => b.addEventListener(t, () => clearInterval(iv)));
    });
    $("lb_panoin").onclick = () => zoom(1 / 1.15); $("lb_panoout").onclick = () => zoom(1.15);
    $("lb_panohome").onclick = home; $("lb_panospin").onclick = () => spin(!S.spin);
    $("lb_panomode").value = S.mode; $("lb_panomode").onchange = (e) => { S.mode = e.target.value; LS.set("mode", S.mode); draw(); info(); };
    $("lb_panopic").value = S.pic; $("lb_panopic").onchange = (e) => { S.pic = e.target.value; LS.set("pic", S.pic); applyLayout(); };
    $("lb_panofull").onclick = full; $("lb_panoclose").onclick = () => show(false);
    const ui = $("lb_panoui"); ["pointerdown", "wheel", "click"].forEach((t) => ui.addEventListener(t, (e) => e.stopPropagation()));
    // the preview's own drag (pan the picture / swipe to the next) and wheel (zoom the picture) stay out of the panorama
    ["pointerdown", "pointermove", "pointerup", "wheel", "dblclick"].forEach((t) => v.addEventListener(t, (e) => e.stopPropagation()));
    return v;
  }
  async function ensure() {
    if (S.R) return true;
    const T = root.H3THREE || (root.H3M3D && await root.H3M3D.load()); if (!T) throw new Error("three.js did not load (static/vendor/three-m3d.min.js)");
    S.T = T;
    const R = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); R.setPixelRatio(Math.min(2, root.devicePixelRatio || 1)); R.autoClear = false;
    if ("outputColorSpace" in R && T.SRGBColorSpace) R.outputColorSpace = T.SRGBColorSpace;
    S.R = R; $("lb_panoview").insertBefore(R.domElement, $("lb_panoview").firstChild);
    S.scene = new T.Scene();
    S.cams = { left: new T.PerspectiveCamera(75, 1, 0.1, 200), right: new T.PerspectiveCamera(75, 1, 0.1, 200) };
    S.cams.left.layers.enable(1); S.cams.right.layers.disable(0); S.cams.right.layers.enable(2); S.cams.left.layers.disable(0);
    // one sphere each eye (layer 1 = left, 2 = right) - a mono picture puts the whole picture on both
    for (const [i, eye] of [[1, "left"], [2, "right"]]) {
      const g = new T.SphereGeometry(50, 96, 64); g.scale(-1, 1, 1);
      const m = new T.MeshBasicMaterial({ color: 0xffffff }); const mesh = new T.Mesh(g, m); mesh.layers.set(i); mesh.rotation.y = -Math.PI / 2;   // the picture's middle ahead
      S.scene.add(mesh); S.mats.push({ eye, m });
    }
    const c = R.domElement;
    c.addEventListener("pointerdown", (e) => { if (e.button !== 0) return; c.setPointerCapture(e.pointerId); S.drag = { x: e.clientX, y: e.clientY, yaw: S.look.yaw, pitch: S.look.pitch }; spin(false); });
    c.addEventListener("pointermove", (e) => {
      if (!S.drag) return; const k = S.look.fov / Math.max(1, c.clientHeight) * (S.mode === "sbs" ? 2 : 1);
      S.look.yaw = S.drag.yaw - (e.clientX - S.drag.x) * k; S.look.pitch = S.drag.pitch - (e.clientY - S.drag.y) * k; S.look = clampLook(S.look); draw();   // the picture is grabbed
    });
    ["pointerup", "pointercancel"].forEach((t) => c.addEventListener(t, () => { S.drag = null; }));
    c.addEventListener("wheel", (e) => { e.preventDefault(); e.stopPropagation(); zoom(e.deltaY > 0 ? 1.08 : 1 / 1.08); }, { passive: false });
    try { new root.ResizeObserver(() => draw()).observe($("lb_panoview")); } catch (e) { /* old */ }
    return true;
  }
  function applyLayout() {
    if (!S.tex) return;
    S.layout = S.pic === "auto" ? detect(S.size[0], S.size[1]) : S.pic;
    for (const x of S.mats) {
      const t = x.eye === "left" ? S.tex : (S.tex2 || (S.tex2 = S.tex.clone()));
      const uv = eyeUV(S.layout, x.eye); t.repeat.set(uv.repeat[0], uv.repeat[1]); t.offset.set(uv.offset[0], uv.offset[1]); t.needsUpdate = true;
      x.m.map = t; x.m.needsUpdate = true;
    }
    draw(); info();
  }
  async function load(url) {
    await ensure();
    if (S.url === url && S.tex) return;
    const T = S.T, tex = await new Promise((ok, no) => new T.TextureLoader().load(url, ok, undefined, () => no(new Error("the picture did not load"))));
    if ("colorSpace" in tex && T.SRGBColorSpace) tex.colorSpace = T.SRGBColorSpace;
    tex.wrapS = T.RepeatWrapping; tex.minFilter = T.LinearFilter; tex.generateMipmaps = false;
    if (S.tex) S.tex.dispose(); if (S.tex2) { S.tex2.dispose(); S.tex2 = null; }
    S.tex = tex; S.url = url; S.size = [tex.image.width || 2, tex.image.height || 1];
    applyLayout();
  }
  function info() {
    const i = $("lb_panoinfo"); if (!i) return;
    const L = { mono: "mono 360°", sbs: "stereo side by side", tb: "stereo top / bottom" }[S.layout], a = S.size[1] ? (S.size[0] / S.size[1]).toFixed(2) : "?";
    i.textContent = "🌐 " + S.size[0] + " × " + S.size[1] + " (" + a + ":1) · " + L + (S.mode !== "normal" ? " · 👓 " + (S.mode === "sbs" ? "side by side" : "top / bottom") : "") + (S.layout === "mono" && Math.abs(S.size[0] / S.size[1] - 2) > 0.15 ? " · not 2:1 - a 360° panorama is twice as wide as it is high" : "");
  }
  // drawn on the next frame (several changes in one frame = one drawing; a drawing in the middle of a pointer event was not shown)
  function draw() { if (!S.R || !S.on || S.frame) return; S.frame = requestAnimationFrame(() => { S.frame = 0; paint(); }); }
  function paint() {
    if (!S.R || !S.on) return;
    const v = $("lb_panoview"), W = Math.max(2, v.clientWidth), H = Math.max(2, v.clientHeight), R = S.R, T = S.T;
    const sz = new T.Vector2(); R.getSize(sz); if (sz.x !== W || sz.y !== H) R.setSize(W, H, false);
    R.setScissorTest(true); R.setClearColor(0x000000, 1); R.clear();
    const L = S.look, ipd = S.mode === "normal" ? 0 : 0.032;
    for (const vp of viewports(S.mode, W, H)) {
      const cam = S.cams[S.mode === "normal" ? "left" : vp.eye];
      cam.fov = L.fov; cam.aspect = vp.w / vp.h; cam.updateProjectionMatrix();
      cam.rotation.order = "YXZ"; cam.rotation.set(-L.pitch * Math.PI / 180, -L.yaw * Math.PI / 180, 0);
      const right = new T.Vector3(1, 0, 0).applyEuler(cam.rotation); cam.position.copy(right.multiplyScalar(vp.eye === "right" ? ipd : -ipd));
      R.setViewport(vp.x, vp.y, vp.w, vp.h); R.setScissor(vp.x, vp.y, vp.w, vp.h); R.render(S.scene, cam);
    }
    R.setScissorTest(false);
  }
  function turn(dir, deg) { S.look.yaw += dir === "left" ? -deg : dir === "right" ? deg : 0; S.look.pitch += dir === "up" ? -deg : dir === "down" ? deg : 0; S.look = clampLook(S.look); draw(); }
  function zoom(f) { S.look.fov *= f; S.look = clampLook(S.look); draw(); }
  function home() { S.look = { yaw: 0, pitch: 0, fov: 75 }; draw(); }
  function spin(on) {
    S.spin = !!on; const b = $("lb_panospin"); if (b) b.classList.toggle("on", S.spin);
    cancelAnimationFrame(S.raf); let t0 = 0;
    const step = (t) => { if (!S.spin || !S.on) return; if (t0) { S.look.yaw += (t - t0) * 0.006; S.look = clampLook(S.look); draw(); } t0 = t; S.raf = requestAnimationFrame(step); };
    if (S.spin) S.raf = requestAnimationFrame(step);
  }
  function full() { const v = $("lb_panoview"); if (doc.fullscreenElement) doc.exitFullscreen().catch(() => {}); else if (v.requestFullscreen) v.requestFullscreen().catch(() => {}); }
  async function show(on) {
    const v = build(); if (!v) return false;
    const it = cur();
    if (on && (!it || it.kind !== "image")) return false;
    S.on = !!on; v.classList.toggle("on", S.on); const b = $("lb_pano"); if (b) { b.classList.toggle("on", S.on); b.setAttribute("aria-pressed", S.on ? "true" : "false"); }
    if (!S.on) { spin(false); if (doc.fullscreenElement === v) doc.exitFullscreen().catch(() => {}); return true; }
    try { await load(it.url); } catch (e) { S.on = false; v.classList.remove("on"); if (b) b.classList.remove("on"); const i = $("lb_panoinfo"); if (i) i.textContent = "🌐 " + (e.message || e); return false; }
    draw(); return true;
  }
  function onKey(e) {
    if (!S.on || !$("lb") || !$("lb").open) return;
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    const k = e.key, m = { ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right", ArrowUp: "up", w: "up", W: "up", ArrowDown: "down", s: "down", S: "down" }[k];
    const stop = () => { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); };
    if (m) { stop(); turn(m, e.shiftKey ? 15 : 5); return; }
    if (k === "+" || k === "=") { stop(); zoom(1 / 1.15); return; }
    if (k === "-") { stop(); zoom(1.15); return; }
    if (k === "Home" || k === "0") { stop(); home(); return; }
    if (k === " ") { stop(); spin(!S.spin); return; }
    if (k === "f" || k === "F") { stop(); full(); return; }
    if (k === "Escape") { stop(); show(false); }
  }
  function boot() {
    const save = $("lb_save"), lbd = $("lb"); if (!save || !lbd) { setTimeout(boot, 400); return; }
    if ($("lb_pano")) return;
    css();
    const b = doc.createElement("button"); b.className = "ghost"; b.id = "lb_pano"; b.type = "button"; b.textContent = "🌐 Panorama 3D";
    b.title = "See this picture as a 360° panorama round you - drag to look, 👓 VR side by side or top / bottom for a headset";
    b.onclick = (e) => { e.stopPropagation(); show(!S.on); };
    save.parentNode.insertBefore(b, save.nextSibling);                   // after 💾 Save (🎨's row before it stays as it was)
    doc.addEventListener("keydown", onKey, true);
    lbd.addEventListener("cancel", (e) => { if (S.on) { e.preventDefault(); show(false); } });   // Esc: the panorama first, then the preview
    lbd.addEventListener("close", () => { if (S.on) show(false); });
    // another item (‹ ›): the panorama follows it - a video / sound closes it; the button only for pictures
    let last = null;
    setInterval(() => {
      const it = cur(); b.style.display = it && it.kind === "image" ? "" : "none";
      if (!lbd.open) { last = null; return; }
      const u = it && it.url; if (u === last) return; last = u;
      if (S.on) { if (it && it.kind === "image") load(u).then(draw).catch(() => {}); else show(false); }
    }, 300);
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot); else boot();
  root.H3LbPano = Object.assign({ show, state: () => ({ on: S.on, look: Object.assign({}, S.look), mode: S.mode, pic: S.pic, layout: S.layout, size: S.size.slice(), url: S.url, spin: S.spin }),
    turn, zoom, home, spin, setMode: (m) => { S.mode = m; LS.set("mode", m); if ($("lb_panomode")) $("lb_panomode").value = m; draw(); info(); },
    setPic: (p) => { S.pic = p; LS.set("pic", p); if ($("lb_panopic")) $("lb_panopic").value = p; applyLayout(); }, canvas: () => S.R && S.R.domElement, draw, paint }, pure);
})(typeof window !== "undefined" ? window : globalThis);
