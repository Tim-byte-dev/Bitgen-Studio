/* bitGen Studio — static/uerig.js (2.476.0): UNREAL LIGHTS + FOG for a shot, window.UERig - shared by the image
 * editor (ext/imageeditdock/pcuelights.js) and the timeline (ext/timelinedock/tlunreal.js).
 *
 * Tim (verbatim): "allow user to add unreal lights to the scene, volumetric lights, volumetric fog etc. in bitgen image
 * editor and timeline. it would be good to be able to do it all in one app - bitgen studio."
 *
 * A RIG = {lights: [light…], fog: {…}} goes with a still / a render; the bitGen Bridge plugin places the lights and the
 * fog in the level for that picture (named bitGen_*), then takes them away again (or keeps them: rig.keep).
 *   light {id, type: point | spot | rect | directional | sky, name, on, loc [x y z cm], rot [roll pitch yaw °],
 *          color "#rrggbb", temperature (K, 0 = use the colour), intensity (cd; lux for the sun; a scale for the sky),
 *          radius (cm - how far it reaches), source (cm - a soft light's size), inner / outer (a spot's cone °),
 *          width / height (a rect light, cm), volumetric (how much it lights volumetric fog, 0 = none), shadows}
 *   fog   {on, density, falloff, color, start (cm), volumetric, albedo, extinction, distance (cm), emissive}
 *   TYPES, LIGHT_PRESETS (a shot's lights placed round the camera: three-point, golden hour, night street, neon,
 *   softbox), FOG_PRESETS (haze, morning mist, thick volumetric, cinema smoke), newLight(type, cam), applyPreset(key,
 *   cam), norm(rig), project(cam, aspect, p) -> {u, v, z} (0..1 of the picture; z = depth cm, <= 0 behind),
 *   unproject(cam, aspect, u, v, z) -> [x y z], editor(host, rig, onChange, opts) - the panel both docks use.
 * Unreal: cm, X forward, Y right, Z up; a camera {loc, rot [roll pitch yaw], fov (horizontal °)}.
 */
(function (root) {
  "use strict";
  const RAD = Math.PI / 180;
  const TYPES = { point: { label: "Point", icon: "💡", intensity: 20, units: "cd" }, spot: { label: "Spot", icon: "🔦", intensity: 60, units: "cd" },
    rect: { label: "Rect (softbox)", icon: "▭", intensity: 30, units: "cd" }, directional: { label: "Sun (directional)", icon: "☀", intensity: 8, units: "lux" },
    sky: { label: "Sky light", icon: "◐", intensity: 1, units: "x" } };
  let seq = 0;
  const id = () => "l" + Date.now().toString(36) + (++seq).toString(36);
  function basis(rot) {
    const r = (rot[0] || 0) * RAD, p = (rot[1] || 0) * RAD, y = (rot[2] || 0) * RAD;
    const f = [Math.cos(p) * Math.cos(y), Math.cos(p) * Math.sin(y), Math.sin(p)];
    const r0 = [-Math.sin(y), Math.cos(y), 0], u0 = [-Math.sin(p) * Math.cos(y), -Math.sin(p) * Math.sin(y), Math.cos(p)];
    const cr = Math.cos(r), sr = Math.sin(r);
    return { f, r: [0, 1, 2].map((k) => r0[k] * cr + u0[k] * sr), u: [0, 1, 2].map((k) => u0[k] * cr - r0[k] * sr) };
  }
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  /** a world point -> where it is on the camera's picture (u, v 0..1 from the top left) and how far in front (z cm) */
  function project(cam, aspect, p) {
    const B = basis(cam.rot), d = [p[0] - cam.loc[0], p[1] - cam.loc[1], p[2] - cam.loc[2]], z = dot(d, B.f);
    const t = Math.tan(((cam.fov || 60) * RAD) / 2), x = dot(d, B.r), y = dot(d, B.u);
    if (z <= 1e-6) return { u: NaN, v: NaN, z };
    return { u: 0.5 + x / (z * t) / 2, v: 0.5 - y / ((z * t) / (aspect || 16 / 9)) / 2, z };
  }
  /** (u, v) of the picture at depth z (cm in front of the camera) -> the world point */
  function unproject(cam, aspect, u, v, z) {
    const B = basis(cam.rot), t = Math.tan(((cam.fov || 60) * RAD) / 2), a = aspect || 16 / 9;
    const x = (u * 2 - 1) * t * z, y = (1 - v * 2) * (t / a) * z;
    return [0, 1, 2].map((k) => Math.round((cam.loc[k] + B.f[k] * z + B.r[k] * x + B.u[k] * y) * 10) / 10);
  }
  /** the rotation [roll pitch yaw] that looks from `from` at `to` */
  function aim(from, to) {
    const d = [to[0] - from[0], to[1] - from[1], to[2] - from[2]], h = Math.hypot(d[0], d[1]);
    return [0, Math.round(Math.atan2(d[2], h) / RAD * 10) / 10, Math.round(Math.atan2(d[1], d[0]) / RAD * 10) / 10];
  }
  /** a light of `type` placed for the camera: in front of it, a little to the side and up, looking at the subject */
  function newLight(type, cam, o) {
    const T = TYPES[type] || TYPES.point, c = cam || { loc: [-500, 0, 170], rot: [0, 0, 0], fov: 60 };
    const opt = Object.assign({ dist: 300, side: -0.45, up: 0.35 }, o || {});
    const subject = unproject(c, 16 / 9, 0.5, 0.5, opt.dist);
    const loc = type === "directional" || type === "sky" ? [subject[0], subject[1], subject[2] + 500] : unproject(c, 16 / 9, 0.5 + opt.side, 0.5 - opt.up, opt.dist * 0.7);
    return { id: id(), type: TYPES[type] ? type : "point", name: (opt.name || T.label.split(" ")[0]) + "", on: true, loc, rot: type === "directional" ? [0, -45, (c.rot[2] || 0) + 135] : aim(loc, subject),
      color: opt.color || "#ffffff", temperature: opt.temperature || 0, intensity: opt.intensity != null ? opt.intensity : T.intensity, radius: 1000, source: type === "point" || type === "spot" ? 5 : 0,
      inner: 15, outer: 35, width: 100, height: 100, volumetric: opt.volumetric != null ? opt.volumetric : 1, shadows: true };
  }
  const FOG0 = { on: false, density: 0.02, falloff: 0.2, color: "#8fa3b8", start: 0, volumetric: false, albedo: "#ffffff", extinction: 1, distance: 6000, emissive: "#000000" };
  const LIGHT_PRESETS = {
    threepoint: { label: "Three-point (key, fill, rim)", lights: [["spot", { name: "Key", side: -0.4, up: 0.3, intensity: 80, temperature: 5600 }], ["rect", { name: "Fill", side: 0.45, up: 0.1, intensity: 15, temperature: 6500 }], ["spot", { name: "Rim", side: 0.2, up: 0.45, dist: 600, intensity: 120 }]] },
    golden: { label: "Golden hour (low warm sun + sky)", lights: [["directional", { name: "Sun", intensity: 6, temperature: 3200 }], ["sky", { name: "Sky", intensity: 0.6, color: "#9bb7ff" }]], sun: [0, -8, 160] },
    night: { label: "Night street (warm spot + cool fill)", lights: [["spot", { name: "Street lamp", side: -0.3, up: 0.6, intensity: 150, temperature: 2700, volumetric: 3 }], ["point", { name: "Blue fill", side: 0.5, up: 0, intensity: 8, color: "#4a7bff" }]] },
    neon: { label: "Neon (magenta + cyan, volumetric)", lights: [["rect", { name: "Magenta", side: -0.5, up: 0.15, intensity: 60, color: "#ff2bd6", volumetric: 4 }], ["rect", { name: "Cyan", side: 0.5, up: 0.15, intensity: 60, color: "#19e6ff", volumetric: 4 }]], fog: "volumetric" },
    softbox: { label: "Studio softbox (one big soft key)", lights: [["rect", { name: "Softbox", side: -0.35, up: 0.25, intensity: 50, temperature: 5600 }]] },
  };
  const FOG_PRESETS = {
    haze: { label: "Light haze", fog: { on: true, density: 0.01, falloff: 0.2, color: "#a9bbcc", volumetric: false } },
    mist: { label: "Morning mist (low)", fog: { on: true, density: 0.05, falloff: 0.8, color: "#d9e2ea", start: 0, volumetric: true, extinction: 1.5, albedo: "#ffffff", distance: 4000 } },
    volumetric: { label: "Thick volumetric (light shafts)", fog: { on: true, density: 0.03, falloff: 0.1, color: "#6b7a8a", volumetric: true, extinction: 3, albedo: "#ffffff", distance: 6000 } },
    smoke: { label: "Cinema smoke (warm)", fog: { on: true, density: 0.04, falloff: 0.05, color: "#b59a7a", volumetric: true, extinction: 2, albedo: "#ffe2c0", distance: 5000 } },
  };
  function applyPreset(key, cam) {
    const P = LIGHT_PRESETS[key]; if (!P) return null;
    const lights = P.lights.map(([t, o]) => newLight(t, cam, o));
    if (P.sun) lights.filter((l) => l.type === "directional").forEach((l) => { l.rot = [0, P.sun[1], ((cam && cam.rot[2]) || 0) + P.sun[2]]; });
    return { lights, fog: P.fog ? Object.assign({}, FOG0, FOG_PRESETS[P.fog].fog) : null };
  }
  const hex = (c, d) => (/^#[0-9a-f]{6}$/i.test(String(c || "")) ? String(c).toLowerCase() : d);
  const num = (v, d, lo, hi) => { const n = Number(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
  const v3 = (a, d) => (Array.isArray(a) && a.length >= 3 && a.slice(0, 3).every((x) => Number.isFinite(Number(x))) ? a.slice(0, 3).map(Number) : d);
  /** a rig made sane (the same rules as lib/unreal.js cleanRig) */
  function norm(rig) {
    const r = rig || {};
    const lights = (Array.isArray(r.lights) ? r.lights : []).slice(0, 32).map((l) => {
      const t = TYPES[l && l.type] ? l.type : "point";
      return { id: String((l && l.id) || id()).slice(0, 40), type: t, name: String((l && l.name) || TYPES[t].label).slice(0, 40), on: l.on !== false, loc: v3(l.loc, [0, 0, 200]), rot: v3(l.rot, [0, -30, 0]),
        color: hex(l.color, "#ffffff"), temperature: num(l.temperature, 0, 0, 20000), intensity: num(l.intensity, TYPES[t].intensity, 0, 1e6), radius: num(l.radius, 1000, 1, 1e6), source: num(l.source, 0, 0, 1e4),
        inner: num(l.inner, 15, 0, 89), outer: num(l.outer, 35, 1, 89), width: num(l.width, 100, 1, 1e5), height: num(l.height, 100, 1, 1e5), volumetric: num(l.volumetric, 1, 0, 100), shadows: l.shadows !== false };
    });
    const f = Object.assign({}, FOG0, r.fog || {});
    const fog = { on: !!f.on, density: num(f.density, 0.02, 0, 10), falloff: num(f.falloff, 0.2, 0.001, 10), color: hex(f.color, FOG0.color), start: num(f.start, 0, 0, 1e7), volumetric: !!f.volumetric,
      albedo: hex(f.albedo, "#ffffff"), extinction: num(f.extinction, 1, 0.1, 10), distance: num(f.distance, 6000, 100, 1e6), emissive: hex(f.emissive, "#000000") };
    return { lights, fog, keep: !!r.keep };
  }
  const empty = (rig) => !rig || ((!rig.lights || !rig.lights.some((l) => l.on !== false)) && !(rig.fog && rig.fog.on));

  /* ================================ the panel (both docks) ================================ */
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const CSS = ".uerig{font-size:11px}.uerig h5{margin:8px 0 3px;font-size:11px}.uerig .r{display:flex;gap:4px;align-items:center;margin:3px 0;flex-wrap:wrap}.uerig .r>span.k{min-width:62px;color:var(--pc-dim,#999)}"
    + ".uerig input[type=number]{width:60px}.uerig .lt{display:flex;align-items:center;gap:4px;padding:2px 3px;border-radius:3px;cursor:pointer}.uerig .lt.sel{background:var(--pc-on,#3a2f1d)}.uerig .lt .sw{width:12px;height:12px;border-radius:50%;border:1px solid #0006;flex:none}"
    + ".uerig .lt .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.uerig .lt.off .nm{opacity:.45;text-decoration:line-through}.uerig .lt button{min-width:0;padding:0 4px}.uerig .box{border:1px solid var(--pc-line,#3a352e);border-radius:4px;padding:4px 6px;margin:4px 0}";
  /** the lights + fog panel: host gets the HTML; onChange(rig, label) after each change; opts {cam (for placing new
   *  lights), sel (the picked light id), onSel(id), extra (html after the presets)} */
  function editor(host, rig0, onChange, opts) {
    const doc = host.ownerDocument, o = opts || {};
    if (!doc.getElementById("uerigCss")) { const st = doc.createElement("style"); st.id = "uerigCss"; st.textContent = CSS; doc.head.appendChild(st); }
    const rig = norm(rig0); let sel = o.sel && rig.lights.some((l) => l.id === o.sel) ? o.sel : (rig.lights[0] && rig.lights[0].id) || null;
    const L = () => rig.lights.find((l) => l.id === sel) || null;
    const n = (k, v, step, w) => `<input type="number" data-k="${k}" value="${esc(Math.round(v * 1000) / 1000)}" step="${step || 1}"${w ? ` style="width:${w}px"` : ""}>`;
    function paint() {
      const l = L();
      host.innerHTML = '<div class="uerig">'
        + `<div class="r"><select data-pre="1"><option value="">＋ Lights from a preset…</option>${Object.entries(LIGHT_PRESETS).map(([k, p]) => `<option value="${k}">${esc(p.label)}</option>`).join("")}</select></div>`
        + `<div class="r">${Object.entries(TYPES).map(([t, T]) => `<button class="ghost" data-add="${t}" title="Add a ${esc(T.label)} light">${T.icon} ${esc(T.label.split(" ")[0])}</button>`).join("")}</div>`
        + (o.extra || "")
        + "<h5>Lights</h5>" + (rig.lights.length ? rig.lights.map((x) => `<div class="lt${x.id === sel ? " sel" : ""}${x.on ? "" : " off"}" data-id="${x.id}"><input type="checkbox" data-on="${x.id}"${x.on ? " checked" : ""} title="On / off"><span>${TYPES[x.type].icon}</span><span class="sw" style="background:${x.color}"></span><span class="nm">${esc(x.name)}</span><span class="hint">${Math.round(x.intensity * 100) / 100} ${TYPES[x.type].units}</span><button class="ghost" data-del="${x.id}" title="Delete">✕</button></div>`).join("") : '<div class="hint">no lights of bitGen\'s yet - the level\'s own lights still shine</div>')
        + (l ? '<div class="box">'
          + `<div class="r"><span class="k">Name</span><input type="text" data-k="name" value="${esc(l.name)}" style="width:110px"><select data-k="type">${Object.entries(TYPES).map(([t, T]) => `<option value="${t}"${t === l.type ? " selected" : ""}>${esc(T.label)}</option>`).join("")}</select></div>`
          + `<div class="r"><span class="k">Colour</span><input type="color" data-k="color" value="${l.color}"><span>Temperature</span>${n("temperature", l.temperature, 100, 64)}<span class="hint">K (0 = the colour)</span></div>`
          + `<div class="r"><span class="k">Intensity</span>${n("intensity", l.intensity, l.type === "sky" ? 0.1 : 1, 70)}<span class="hint">${TYPES[l.type].units}</span></div>`
          + (l.type === "point" || l.type === "spot" || l.type === "rect" ? `<div class="r"><span class="k">Reach</span>${n("radius", l.radius, 50, 70)}<span class="hint">cm</span><span>Soft size</span>${n("source", l.source, 1, 50)}</div>` : "")
          + (l.type === "spot" ? `<div class="r"><span class="k">Cone</span>${n("inner", l.inner, 1, 46)}<span>-</span>${n("outer", l.outer, 1, 46)}<span class="hint">°</span></div>` : "")
          + (l.type === "rect" ? `<div class="r"><span class="k">Size</span>${n("width", l.width, 10, 60)}<span>x</span>${n("height", l.height, 10, 60)}<span class="hint">cm</span></div>` : "")
          + (l.type !== "sky" ? `<div class="r"><span class="k">Volumetric</span>${n("volumetric", l.volumetric, 0.5, 50)}<span class="hint">light shafts in volumetric fog (0 = none)</span><label><input type="checkbox" data-k="shadows"${l.shadows ? " checked" : ""}> shadows</label></div>` : "")
          + (l.type !== "sky" ? `<div class="r"><span class="k">X Y Z</span>${n("loc0", l.loc[0], 10)}${n("loc1", l.loc[1], 10)}${n("loc2", l.loc[2], 10)}</div><div class="r"><span class="k">R P Y</span>${n("rot0", l.rot[0], 1)}${n("rot1", l.rot[1], 1)}${n("rot2", l.rot[2], 1)}</div>` : "")
          + "</div>" : "")
        + "<h5>Fog</h5>"
        + `<div class="r"><label><input type="checkbox" data-f="on"${rig.fog.on ? " checked" : ""}> Height fog</label><label><input type="checkbox" data-f="volumetric"${rig.fog.volumetric ? " checked" : ""}> Volumetric</label><select data-fpre="1"><option value="">a fog preset…</option>${Object.entries(FOG_PRESETS).map(([k, p]) => `<option value="${k}">${esc(p.label)}</option>`).join("")}</select></div>`
        + `<div class="r"><span class="k">Density</span><input type="number" data-f="density" value="${rig.fog.density}" step="0.005"><span>Falloff</span><input type="number" data-f="falloff" value="${rig.fog.falloff}" step="0.05"><input type="color" data-f="color" value="${rig.fog.color}" title="Fog colour"></div>`
        + `<div class="r"><span class="k">Starts at</span><input type="number" data-f="start" value="${rig.fog.start}" step="50"><span class="hint">cm</span></div>`
        + `<div class="r"><span class="k">Volumetric</span><span>Albedo</span><input type="color" data-f="albedo" value="${rig.fog.albedo}"><span>Extinction</span><input type="number" data-f="extinction" value="${rig.fog.extinction}" step="0.1" style="width:50px"><span>View</span><input type="number" data-f="distance" value="${rig.fog.distance}" step="500"><span class="hint">cm</span></div>`
        + `<div class="r"><label title="Leave bitGen's lights and fog in the Unreal level after the picture (named bitGen_*)"><input type="checkbox" data-keep="1"${rig.keep ? " checked" : ""}> keep them in the Unreal level</label></div>`
        + "</div>";
      bind();
    }
    const fire = (label) => { onChange(norm(rig), label); };
    function bind() {
      const q = (s) => host.querySelectorAll(s);
      q("[data-add]").forEach((b) => { b.onclick = () => { const l = newLight(b.dataset.add, o.cam && o.cam()); rig.lights.push(l); sel = l.id; if (o.onSel) o.onSel(sel); paint(); fire("add " + b.dataset.add + " light"); }; });
      q("[data-pre]").forEach((s) => { s.onchange = () => { const r = applyPreset(s.value, o.cam && o.cam()); if (!r) return; rig.lights = rig.lights.concat(r.lights); if (r.fog) rig.fog = r.fog; sel = r.lights[0].id; if (o.onSel) o.onSel(sel); paint(); fire("lights preset"); }; });
      q(".lt[data-id]").forEach((d) => { d.onclick = (e) => { if (e.target.closest("input,button")) return; sel = d.dataset.id; if (o.onSel) o.onSel(sel); paint(); }; });
      q("[data-on]").forEach((c) => { c.onchange = () => { const l = rig.lights.find((x) => x.id === c.dataset.on); l.on = c.checked; paint(); fire(c.checked ? "light on" : "light off"); }; });
      q("[data-del]").forEach((b) => { b.onclick = () => { rig.lights = rig.lights.filter((x) => x.id !== b.dataset.del); if (sel === b.dataset.del) sel = (rig.lights[0] && rig.lights[0].id) || null; if (o.onSel) o.onSel(sel); paint(); fire("delete light"); }; });
      q(".box [data-k]").forEach((inp) => { inp.onchange = () => {
        const l = L(); if (!l) return; const k = inp.dataset.k;
        if (/^loc\d$/.test(k)) l.loc[+k[3]] = +inp.value; else if (/^rot\d$/.test(k)) l.rot[+k[3]] = +inp.value;
        else if (k === "shadows") l.shadows = inp.checked; else if (k === "name" || k === "color" || k === "type") l[k] = inp.value; else l[k] = +inp.value;
        if (k === "type" || k === "name") paint();
        fire("light " + k.replace(/\d$/, ""));
      }; });
      q("[data-f]").forEach((inp) => { inp.onchange = () => { const k = inp.dataset.f; rig.fog[k] = inp.type === "checkbox" ? inp.checked : inp.type === "color" ? inp.value : +inp.value; fire("fog " + k); }; });
      q("[data-fpre]").forEach((s) => { s.onchange = () => { const P = FOG_PRESETS[s.value]; if (!P) return; rig.fog = Object.assign({}, FOG0, P.fog); paint(); fire("fog preset"); }; });
      q("[data-keep]").forEach((c) => { c.onchange = () => { rig.keep = c.checked; fire("keep the lights"); }; });
    }
    paint();
    return { rig: () => norm(rig), sel: () => sel, select: (i) => { sel = i; paint(); }, repaint: paint };
  }
  const UERig = { TYPES, FOG0, LIGHT_PRESETS, FOG_PRESETS, basis, project, unproject, aim, newLight, applyPreset, norm, empty, editor, CSS };
  if (typeof module !== "undefined" && module.exports) module.exports = UERig;
  else root.UERig = UERig;
})(typeof window !== "undefined" ? window : globalThis);
