/* bitGen Studio — static/unreal.js (2.472.0): the UNREAL ENGINE 5.8 BRIDGE in the page, window.UEBridge - shared by the
 * image editor (ext/imageeditdock/pcunreal.js) and the timeline (ext/timelinedock/tlunreal.js), + its part of
 * Settings ▸ 3D (static/settings3d.js).
 *
 *   status() / list(kind) / viewport()     /api/unreal/... (lib/unreal.js -> the bitGen Bridge plugin in the editor)
 *   still(o) -> {name, url, w, h, camera, alphaInverted}       render(o, onProgress) -> {video, dur, frames}
 *   loadStill(r) -> a canvas (alpha turned the right way round when Settings says it comes inverted)
 *   framing(preset, turn) -> {camera: {loc, rot, fov}, figure: {loc, rot}}   (Face / Bust / Full body, Unreal cm, Z up)
 *   dialogHtml / esc / opt                 small helpers for the two docks' dialogs
 * Settings ▸ 3D ▸ Unreal Engine: the port (30020), "alpha is inverted", Test connection, how to install the plugin
 * (the bitgen-ue-bridge zip -> <Project>/Plugins/bitGenBridge).
 */
(function (root) {
  "use strict";
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const opt = (v, cur, label) => `<option value="${esc(v)}"${String(v) === String(cur) ? " selected" : ""}>${esc(label)}</option>`;
  async function api(url, body) {
    const r = await fetch(url, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : undefined);
    let j = null; try { j = await r.json(); } catch (e) { j = {}; }
    if (!r.ok) throw new Error(j.error || "Unreal: " + r.status);
    return j;
  }
  const status = () => api("/api/unreal/status");
  const list = (kind, q) => api("/api/unreal/list/" + kind + (q ? "?" + new URLSearchParams(q) : "")).then((j) => j.items || []);
  const viewport = () => api("/api/unreal/viewport");
  const actors = (o) => api("/api/unreal/actors", o);                                     // 2.540.0: the mesh actors in view
  async function still(o) { const j = await api("/api/unreal/still", o); j.url = "/api/unreal/file/" + encodeURIComponent(j.name) + "?t=" + Date.now(); return j; }
  async function loadStill(r) {
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error("the picture from Unreal did not load")); i.src = r.url; });
    const c = root.document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext("2d"); g.drawImage(img, 0, 0);
    if (r.alphaInverted) { const d = g.getImageData(0, 0, c.width, c.height); for (let i = 3; i < d.data.length; i += 4) d.data[i] = 255 - d.data[i]; g.putImageData(d, 0, 0); }
    return c;
  }
  /** a render -> polls until the video is there; onProgress({state, frames, of}) */
  async function render(o, onProgress) {
    const j = await api("/api/unreal/render", o);
    for (let i = 0; i < 24 * 60 * 30; i++) {
      await new Promise((r) => setTimeout(r, i < 10 ? 300 : 1000));
      const s = await api("/api/unreal/job/" + j.job);
      if (onProgress) { try { onProgress(s); } catch (e) { /* the caller's */ } }
      if (s.state === "done") return { video: s.video, dur: s.dur, frames: s.frames, sequence: s.sequence || j.sequence };
      if (s.state === "error") throw new Error(s.error || "Unreal could not render it");
    }
    throw new Error("the render took too long");
  }
  /** where the camera goes for a MetaHuman (the figure at the origin, facing the camera along X, turned `turn`°) */
  const FRAMES = { face: { d: 70, z: 165, fov: 28, tilt: 0 }, bust: { d: 140, z: 150, fov: 30, tilt: -3 }, full: { d: 420, z: 100, fov: 32, tilt: -2 } };
  function framing(preset, turn) {
    const f = FRAMES[preset] || FRAMES.bust;
    return { camera: { loc: [f.d, 0, f.z], rot: [0, f.tilt, 180], fov: f.fov }, figure: { loc: [0, 0, 0], rot: [0, 0, +turn || 0] } };
  }
  /* ---- 2.475.0: THE CAMERA - Unreal's axes (cm; X forward, Y right, Z up; rotation [roll, pitch, yaw] degrees) */
  const RAD = Math.PI / 180;
  const FILMBACKS = [["ff", "Full frame 36 x 24", 36], ["s35", "Super 35 24.89 x 18.66", 24.89], ["apsc", "APS-C 23.6 x 15.6", 23.6], ["m43", "Micro 4/3 17.3 x 13", 17.3], ["imax", "IMAX 70 x 48.5", 70.41], ["phone", "Phone 6.4 x 4.8", 6.4]];
  const FSTOPS = [1.2, 1.4, 1.8, 2, 2.8, 4, 5.6, 8, 11, 16, 22];
  /** lens presets (a focal length, an aperture; the filmback stays yours unless the preset names one) */
  const LENSES = [["wide18", "Ultra wide 18mm f/8 - landscapes, rooms", { focal: 18, fstop: 8 }], ["wide24", "Wide 24mm f/5.6 - establishing shots", { focal: 24, fstop: 5.6 }],
    ["s35", "35mm f/4 - street, documentary", { focal: 35, fstop: 4 }], ["n50", "50mm f/2.8 - natural, like the eye", { focal: 50, fstop: 2.8 }],
    ["p85", "85mm f/1.8 - portrait, soft background", { focal: 85, fstop: 1.8 }], ["t135", "135mm f/2.8 - tight portrait / telephoto", { focal: 135, fstop: 2.8 }],
    ["t200", "200mm f/4 - far telephoto, flat depth", { focal: 200, fstop: 4 }], ["mac100", "Macro 100mm f/8 - close-ups", { focal: 100, fstop: 8 }],
    ["cine", "Anamorphic look 40mm f/2 (Super 35)", { focal: 40, fstop: 2, sensor: 24.89 }]];
  const fovOf = (focal, sensor) => 2 * Math.atan((sensor || 36) / (2 * Math.max(0.1, focal || 35))) / RAD;
  const focalOf = (fov, sensor) => (sensor || 36) / (2 * Math.tan(Math.max(0.5, Math.min(179, fov || 60)) * RAD / 2));
  /** forward / right / up for [roll, pitch, yaw] */
  function basis(rot) {
    const r = (rot[0] || 0) * RAD, p = (rot[1] || 0) * RAD, y = (rot[2] || 0) * RAD;
    const f = [Math.cos(p) * Math.cos(y), Math.cos(p) * Math.sin(y), Math.sin(p)];
    const r0 = [-Math.sin(y), Math.cos(y), 0], u0 = [-Math.sin(p) * Math.cos(y), -Math.sin(p) * Math.sin(y), Math.cos(p)];
    const cr = Math.cos(r), sr = Math.sin(r);
    return { f, r: [0, 1, 2].map((k) => r0[k] * cr + u0[k] * sr), u: [0, 1, 2].map((k) => u0[k] * cr - r0[k] * sr) };
  }
  const add = (a, b, k) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
  const wrap = (a) => { a = ((a + 180) % 360 + 360) % 360 - 180; return Math.round(a * 1000) / 1000; };
  const rnd = (v) => v.map((x) => Math.round(x * 100) / 100);
  /** move a camera {loc, rot, fov}: how = orbit | look | pan | dolly | roll; (dx, dy) in screen pixels (or the wheel);
   *  dist = the orbit's pivot / the pan's scale (cm, e.g. the focus distance) */
  function moveCam(cam, how, dx, dy, dist) {
    const c = { loc: cam.loc.slice(), rot: cam.rot.slice(), fov: cam.fov }, D = Math.max(10, dist || 500), B = basis(c.rot);
    if (how === "orbit") {
      const P = add(c.loc, B.f, D);
      c.rot[2] = wrap(c.rot[2] + dx * 0.3); c.rot[1] = Math.max(-89, Math.min(89, c.rot[1] - dy * 0.3));
      c.loc = add(P, basis(c.rot).f, -D);
    } else if (how === "look") { c.rot[2] = wrap(c.rot[2] + dx * 0.15); c.rot[1] = Math.max(-89, Math.min(89, c.rot[1] - dy * 0.15)); }
    else if (how === "pan") { const k = D * 0.002; c.loc = add(add(c.loc, B.r, -dx * k), B.u, dy * k); }
    else if (how === "dolly") c.loc = add(c.loc, B.f, -dy * D * 0.004);
    else if (how === "roll") c.rot[0] = wrap(c.rot[0] + dx * 0.3);
    c.loc = rnd(c.loc); c.rot = c.rot.map((x) => Math.round(x * 1000) / 1000);
    return c;
  }
  const INSTALL = "Unzip bitgen-ue-bridge-1.2.0.zip into your Unreal project's Plugins folder (<Project>\\Plugins\\bitGenBridge), open the project and enable the plugins it asks for. The Output Log then shows \"[bitGen Bridge] listening\".";
  /* ---- Settings ▸ 3D ▸ Unreal Engine */
  function settingsSection() {
    if (!root.Settings3D) return;
    root.Settings3D.addSection({
      html: '<label class="f" style="margin-top:14px">Unreal Engine 5.8</label>'
        + '<div class="rowbtns" style="align-items:center;gap:6px;flex-wrap:wrap"><span>Bridge port</span><input type="number" id="s_uePort" min="1" max="65535" style="width:90px">'
        + '<label><input type="checkbox" id="s_ueInv"> alpha is inverted (a solid background where it should be clear)</label>'
        + '<button class="ghost" type="button" id="s_ueTest">Test connection</button><span class="hint" id="s_ueSt"></span></div>'
        + '<p class="hint help" style="margin:4px 0 0">' + esc(INSTALL) + " Then: the image editor's and the timeline's UNREAL tab (Unreal layers, MetaHuman layers, the Unreal camera).</p>",
      init(el) {
        const $ = (id) => el.querySelector("#" + id);
        const save = () => api("/api/unreal/settings", { port: +$("s_uePort").value, alphaInverted: $("s_ueInv").checked }).catch((e) => { $("s_ueSt").textContent = e.message; });
        $("s_uePort").onchange = save; $("s_ueInv").onchange = save;
        $("s_ueTest").onclick = () => { $("s_ueSt").textContent = "…"; status().then((s) => { $("s_ueSt").textContent = s.connected ? `✓ Unreal ${s.engine} - ${s.project}` : "✕ " + s.error; }); };
      },
      load() { api("/api/unreal/settings").then((s) => { const p = root.document.getElementById("s_uePort"), i = root.document.getElementById("s_ueInv"); if (p) p.value = s.port; if (i) i.checked = !!s.alphaInverted; }).catch(() => {}); },
    });
  }
  if (root.document) { if (root.Settings3D) settingsSection(); else root.addEventListener("DOMContentLoaded", settingsSection); }
  const setViewport = (cam) => api("/api/unreal/viewport", { loc: cam.loc, rot: cam.rot });
  const focusAt = (camera, u, v, aspect) => api("/api/unreal/focus", { camera, u, v, aspect });
  const UEBridge = { actors, FILMBACKS, FSTOPS, LENSES, fovOf, focalOf, basis, moveCam, setViewport, focusAt, api, status, list, viewport, still, loadStill, render, framing, FRAMES, INSTALL, esc, opt };
  if (typeof module !== "undefined" && module.exports) module.exports = UEBridge;
  else root.UEBridge = UEBridge;
})(typeof window !== "undefined" ? window : globalThis);
