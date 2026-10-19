#!/usr/bin/env node
/* bitGen Studio — 2.385.0 in a REAL browser (WebGL): the floating Tools & Properties docker, dragging / removing ◆
 * keyframes, a 3D layer's lights + materials, the 3D move / rotate / scale widgets, glTF models and the Blender bridge's
 * page side (the add-on's sends, "Render with Blender").
 * Tim: "put timeline docker tools properties in a floating docker the number 1 on the keyboard makes it visible, give the
 * docker a titlebar. allow user to add lights to 3d scene - allow user to change the brightness of the lights - allow
 * user to add materials to 3d objects. allow user to drag keyframe diamond in the frame, the start diamond can drag to a
 * max end diamond -1 frame, the end diamond can drag to max end of clip on selected layer and min to the first diamond
 * + 1 frame - allow user to remove keyframes. add 3d interactive rotate and transform and move widgets to 3d objects
 * placed in the preview canvas - is it possible for us to create a blender to bitgen bridge?"
 * Run against the running app (H3_URL, default the e2e server on :8311); a project of its own, "default" back after.
 * No Playwright here = SKIP (exit 0). Blender itself is NOT needed: its render answers are stubbed here (the real
 * render is scripts/test-blender.py's, when Blender is installed). */
"use strict";
const path = require("path");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 3D tools browser test did not run"); process.exit(0); }
const URL_ = process.env.H3_URL || "http://127.0.0.1:8311/";
const P = "zz_m3dtools_" + process.pid;
let pass = 0, fail = 0;
const check = (n, cond, got) => {
  if (cond) { pass++; console.log("PASS: " + n); }
  else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); }
};
const api = async (u, body, raw) => {
  for (let i = 0; ; i++) {
    try {
      const o = body === undefined ? {} : raw ? { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body }
        : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
      return await (await fetch(URL_ + u.replace(/^\//, ""), o)).json();
    } catch (e) { if (i >= 5) throw e; await new Promise((ok) => setTimeout(ok, 500 * (i + 1))); }
  }
};
/* a minimal binary glTF: a cube (24 vertices, its normals) with one blue material */
function glbCube(color) {
  const P3 = [], N3 = [], I = [];
  const faces = [[[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 1, 0], [0, 0, -1]], [[0, 1, 0], [0, 0, 1], [1, 0, 0]],
                 [[0, -1, 0], [0, 0, -1], [1, 0, 0]], [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [-1, 0, 0], [0, 1, 0]]];
  faces.forEach(([n, u, v]) => {
    const b = P3.length / 3;
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, c]) => {
      P3.push(n[0] + u[0] * a + v[0] * c, n[1] + u[1] * a + v[1] * c, n[2] + u[2] * a + v[2] * c); N3.push(...n);
    });
    I.push(b, b + 1, b + 2, b, b + 2, b + 3);
  });
  const pos = Buffer.from(new Float32Array(P3).buffer), nor = Buffer.from(new Float32Array(N3).buffer), idx = Buffer.from(new Uint16Array(I).buffer);
  const bin = Buffer.concat([pos, nor, idx, Buffer.alloc((4 - (idx.length % 4)) % 4)]);
  const gltf = { asset: { version: "2.0" }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, name: "BlueCube" }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: 0 }] }],
    materials: [{ name: "blue", pbrMetallicRoughness: { baseColorFactor: color, metallicFactor: 0, roughnessFactor: 0.6 } }],
    buffers: [{ byteLength: bin.length }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: pos.length }, { buffer: 0, byteOffset: pos.length, byteLength: nor.length },
                  { buffer: 0, byteOffset: pos.length + nor.length, byteLength: idx.length }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 24, type: "VEC3", min: [-1, -1, -1], max: [1, 1, 1] },
                { bufferView: 1, componentType: 5126, count: 24, type: "VEC3" }, { bufferView: 2, componentType: 5123, count: 36, type: "SCALAR" }] };
  let js = Buffer.from(JSON.stringify(gltf));
  js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
  const head = Buffer.alloc(12), jh = Buffer.alloc(8), bh = Buffer.alloc(8);
  head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8);
  jh.writeUInt32LE(js.length, 0); jh.writeUInt32LE(0x4e4f534a, 4); bh.writeUInt32LE(bin.length, 0); bh.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([head, jh, js, bh, bin]);
}

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 2000, height: 1250 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  let rendered = null;
  await p.route("**/api/blender/render", (route) => { rendered = JSON.parse(route.request().postData() || "{}"); route.fulfill({ json: { ok: true, id: rendered.id, state: "running", of: rendered.frames.length } }); });
  await p.route(/\/api\/blender\/render\/[^/?]+$/, (route) => route.fulfill({ json: { state: "done", done: 3, of: 3, result: { name: "m3d_x.webm", dur: 1, frames: 24 } } }));
  try {
    await api("/api/projects/load", { name: P });
    await p.goto(URL_, { waitUntil: "domcontentloaded" });
    await p.waitForFunction(() => window.TlFloat && window.TlGizmo && window.TlBlender && window.TlM3DLook && typeof dsReady !== "undefined" && dsReady, null, { timeout: 30000 });
    // the floating prompt docker can sit over the timeline at this window size (where it was left) - out of the way
    await p.evaluate(() => { const pd = document.getElementById("promptdock"); if (pd && /pf-float/.test(pd.className)) pd.style.visibility = "hidden"; });
    await p.waitForTimeout(600);
    await p.evaluate(() => {
      const d = document.getElementById("timelinedock");
      if (/collapsed|dockgone/.test(d.className) && typeof toggleCollapse === "function") toggleCollapse("timelinedock");
      setVar("th", 760);
      if (document.getElementById("tlStage").classList.contains("off")) document.getElementById("tlStageTog").click();
      tl.video = []; tl.vlayers = []; tl.images = []; tl.audio = []; tlSave(); renderTimeline(); setPlayhead(1);
      TlFloat.show(true); TlFloat.place(1500, 120);
    });

    // 1 ---- the floating docker
    const fl = await p.evaluate(() => {
      const F = document.getElementById("tlFloat");
      return { tools: document.getElementById("tlTools").parentElement.id, props: document.getElementById("tlProps").parentElement.id,
               title: document.querySelector("#tlFloatTitle h2").textContent, fixed: getComputedStyle(F).position, shown: F.offsetWidth > 100,
               tog: !!document.getElementById("tlFloatTog") };
    });
    check("🧰 the tools AND the properties are in a floating docker with a titlebar (Tools & Properties)",
      fl.tools === "tlFloat" && fl.props === "tlFloat" && /Tools & Properties/.test(fl.title) && fl.fixed === "fixed" && fl.shown && fl.tog, fl);
    await p.evaluate(() => document.activeElement && document.activeElement.blur());
    await p.keyboard.press("1");
    const hid = await p.evaluate(() => document.getElementById("tlFloat").classList.contains("off"));
    await p.keyboard.press("1");
    const back = await p.evaluate(() => !document.getElementById("tlFloat").classList.contains("off"));
    check("...1 on the keyboard hides it and shows it again", hid && back, [hid, back]);
    const t0 = await p.evaluate(() => { const r = document.getElementById("tlFloatTitle").getBoundingClientRect(); return { x: r.x + 60, y: r.y + 15, L: document.getElementById("tlFloat").offsetLeft }; });
    await p.mouse.move(t0.x, t0.y); await p.mouse.down(); await p.mouse.move(t0.x - 120, t0.y + 40, { steps: 6 }); await p.mouse.up();
    // 2.443.0: 🧰 lives over the preview row now (inside the timeline docker) - dropped near the canvas's edge it DOCKS
    // there (its own feature); either way the titlebar moved it. Docked = floated again for the rest of the test.
    const L1 = await p.evaluate(() => { const F = document.getElementById("tlFloat"); const side = F.dataset.side || ""; const at = [F.offsetLeft, F.offsetTop, side];
      if (side) { const b = F.querySelector('.tsd-side[data-side="' + side + '"]'); if (b) b.click(); } return at; });
    check("...its titlebar drags it (moved - or docked beside the canvas when dropped at its edge)", L1[2] === "L" || L1[2] === "R" || L1[0] !== t0.L, [t0, L1]);
    await p.click("#tlFloatClose");
    const closed = await p.evaluate(() => document.getElementById("tlFloat").classList.contains("off"));
    await p.click("#tlFloatTog");
    check("...✕ hides it, 🧰 in the timeline's menu bar shows it", closed && await p.evaluate(() => !document.getElementById("tlFloat").classList.contains("off")));

    // 2 ---- ◆ keyframes: drag within the limits, remove (the floating docker hidden: it may sit over the tracks)
    await p.evaluate(() => {
      TlFloat.show(false);
      const c = TlM3D.add("text"); c.out = 5; c.dur = 5; c.start = 0;
      kfAdd(c, 1, "video", "vl:0"); kfAdd(c, 3, "video", "vl:0");
      tlSave(); renderTimeline(); window.__c = c;
    });
    await p.waitForTimeout(300);
    const dia = () => p.evaluate(() => [...document.querySelectorAll("#tlinner .kfd")].map((d) => { const r = d.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }));
    const ats = () => p.evaluate(() => __c.kf.map((k) => Math.round(k.at * 1000) / 1000));
    const pxs = await p.evaluate(() => PXS);
    let d = await dia();
    await p.mouse.move(d[0].x, d[0].y); await p.mouse.down(); await p.mouse.move(d[0].x + pxs * 4, d[0].y, { steps: 8 }); await p.mouse.up();
    let a = await ats();
    check("◆ the FIRST diamond drags no further than the next one - 1 frame (3 s - 1/24)", Math.abs(a[0] - (3 - 1 / 24)) < 0.002 && a[1] === 3, a);
    d = await dia();
    await p.mouse.move(d[1].x, d[1].y); await p.mouse.down(); await p.mouse.move(d[1].x + pxs * 6, d[1].y, { steps: 8 }); await p.mouse.up();
    a = await ats();
    check("...the LAST one no further than the clip's end (5 s)", a[1] === 5, a);
    d = await dia();
    await p.mouse.move(d[0].x, d[0].y); await p.mouse.down(); await p.mouse.move(d[0].x - pxs * 9, d[0].y, { steps: 8 }); await p.mouse.up();
    a = await ats();
    check("...the first one down to the clip's start (0)", a[0] === 0 && a[1] === 5, a);
    d = await dia();
    await p.mouse.move(d[1].x, d[1].y); await p.mouse.down(); await p.mouse.move(d[1].x - pxs * 7, d[1].y, { steps: 8 }); await p.mouse.up();
    a = await ats();
    check("...and the last one back no further than the first one + 1 frame", a[0] === 0 && Math.abs(a[1] - 1 / 24) < 0.002, a);
    await p.evaluate(() => { __c.kf[1].at = 3; renderTimeline(); });
    d = await dia();
    await p.mouse.click(d[1].x, d[1].y, { button: "right" });
    await p.waitForTimeout(200);
    check("...right-click removes a diamond", (await ats()).length === 1, await ats());
    await p.evaluate(() => { kfAdd(__c, 2, "video", "vl:0"); kfChanged(__c); renderTimeline(); });
    d = await dia();
    await p.evaluate(() => document.querySelectorAll("#tlinner .kfd")[1].focus());
    await p.keyboard.press("Delete");
    await p.waitForTimeout(200);
    check("...and Delete on the selected diamond", (await ats()).length === 1, await ats());
    await p.evaluate(() => { delete __c.kf; tlSave(); renderTimeline(); });

    // 3 ---- 🎨 materials + 💡 lights
    await p.evaluate(() => { TlFloat.show(true); TlCanvas.select(__c, TlCanvas.layerOf(__c)); });
    await p.waitForFunction(() => document.getElementById("m3lPreset") && document.getElementById("m3lAdd"), null, { timeout: 10000 });
    await p.selectOption("#m3lPreset", "gold");
    await p.waitForTimeout(200);
    const gold = await p.evaluate(() => ({ c: __c.m3d.color, m: __c.m3d.metal, r: __c.m3d.rough, pre: __c.m3d.mat && __c.m3d.mat.preset }));
    check("🎨 a material preset (Gold) sets the colour, metal and roughness", gold.c === "#ffcc55" && gold.m === 1 && gold.r === 0.25 && gold.pre === "gold", gold);
    await p.fill("#m3lGlow", "2"); await p.dispatchEvent("#m3lGlow", "input");
    await p.check("#m3lWire");
    const mat = await p.evaluate(() => ({ glow: __c.m3d.mat.glow, wire: __c.m3d.mat.wire, pre: __c.m3d.mat.preset }));
    check("...glow and wireframe are the layer's own (the preset becomes Custom)", mat.glow === 2 && mat.wire === true && !mat.pre, mat);
    await p.selectOption("#m3lAdd", "point");
    await p.waitForFunction(() => document.querySelector("[data-m3li='0']"), null, { timeout: 5000 });
    const rng = await p.$("[data-m3li='0'] input[type=range][data-m3lk='power']");
    await rng.fill("6"); await rng.dispatchEvent("input");
    await p.selectOption("#m3lAdd", "spot");
    await p.waitForTimeout(200);
    const lit = await p.evaluate(() => __c.m3d.lights.map((L) => [L.type, L.power]));
    check("💡 lights are added (point, spot) and a light's brightness slider sets its power", lit.length === 2 && lit[0][0] === "point" && lit[0][1] === 6 && lit[1][0] === "spot", lit);
    await p.uncheck("#m3lStudio");
    const bright = async (pw) => p.evaluate((x) => {
      __c.m3d.lights[0].power = x; __c.m3d.lights[1].on = false;
      const f = H3M3D.frame(__c, 0); if (!f || f.error) return -1;
      const g = f.canvas.getContext("2d").getImageData(0, 0, f.w, f.h).data; let s = 0, n = 0;
      for (let i = 0; i < g.length; i += 4) if (g[i + 3] > 200) { s += g[i] + g[i + 1] + g[i + 2]; n++; }
      return n ? s / n : 0;
    }, pw);
    await p.waitForFunction(() => { const f = H3M3D.frame(__c, 0); return f && !f.error; }, null, { timeout: 20000 });
    const dim = await bright(0.5), hi = await bright(8);
    check("...the light's brightness really lights the object (studio lights off: brighter at 8 than at 0.5)", hi > dim + 20, [dim, hi]);
    await p.evaluate(() => { __c.m3d.studio = undefined; delete __c.m3d.studio; __c.m3d.lights.splice(0); delete __c.m3d.lights; delete __c.m3d.mat; TlCanvas.paintProps(); });

    // 4 ---- the 3D widgets (the floating docker out of the way)
    await p.evaluate(() => { TlFloat.show(false); setPlayhead(1); TlCanvas.select(__c, TlCanvas.layerOf(__c)); TlCanvas.setTool("move"); TlCanvas.mark(); });
    await p.waitForTimeout(300);
    const centre = async () => p.evaluate(() => { const g = TlGizmo.geo(__c); const r = document.getElementById("tlCanvas").getBoundingClientRect(); return g ? { x: r.left + g.c[0], y: r.top + g.c[1], R: g.R } : null; });
    await p.evaluate(() => TlGizmo.setMode("rotate"));
    let g = await centre();
    check("✥ the widget sits on the 3D object (its centre on the canvas)", !!g && g.R >= 46, g);
    const ry0 = await p.evaluate(() => __c.m3d.ry || 0);
    await p.mouse.move(g.x + 5, g.y + 5); await p.mouse.down(); await p.mouse.move(g.x + 65, g.y + 5, { steps: 6 }); await p.mouse.up();
    const rot = await p.evaluate((q) => { const e = document.elementFromPoint(q.x + 5, q.y + 5);
      return [__c.m3d.ry, __c.m3d.rx, TlCanvas.state.tool, e && (e.tagName + "#" + e.id + "." + e.className), TlGizmo.mode(), (__c.kf || []).length]; }, g);
    check("⟲ ROTATE: dragging across the ball turns it round Y", rot[0] - ry0 > 10 && Math.abs(rot[1] || 0) < 1, rot);
    g = await centre();
    await p.mouse.move(g.x + g.R, g.y); await p.mouse.down(); await p.mouse.move(g.x, g.y + g.R, { steps: 8 }); await p.mouse.up();
    const rz = await p.evaluate(() => __c.m3d.rz);
    check("...the outer ring rolls it round Z (a quarter turn ~ -90°)", Math.abs(rz + 90) < 8, rz);
    await p.evaluate(() => TlGizmo.setMode("move"));
    g = await centre();
    const tf0 = await p.evaluate(() => TlCanvas.tfAt(__c).x);
    await p.mouse.move(g.x + g.R * 0.6, g.y); await p.mouse.down(); await p.mouse.move(g.x + g.R * 0.6 + 40, g.y + 30, { steps: 6 }); await p.mouse.up();
    const mv = await p.evaluate(() => [TlCanvas.tfAt(__c).x, TlCanvas.tfAt(__c).y]);
    check("✥ MOVE: the red X arrow moves it across only (Y stays)", mv[0] > tf0 + 20 && Math.abs(mv[1]) < 1, [tf0, mv]);
    g = await centre();
    await p.mouse.move(g.x - g.R * 0.45, g.y + g.R * 0.45); await p.mouse.down(); await p.mouse.move(g.x - g.R * 0.45 - 30, g.y + g.R * 0.45 + 30, { steps: 6 }); await p.mouse.up();
    const pz = await p.evaluate(() => __c.m3d.pz);
    check("...the blue Z arrow moves it toward the camera (depth > 0)", pz > 0.05, pz);
    await p.evaluate(() => TlGizmo.setMode("scale"));
    g = await centre();
    const hx = await p.evaluate(() => { const gg = TlGizmo.geo(__c); const r = document.getElementById("tlCanvas").getBoundingClientRect();
      for (let x = -200; x <= 200; x += 2) for (let y = -200; y <= 200; y += 2) if (TlGizmo.pick(__c, gg.c[0] + x, gg.c[1] + y) === "sx") return { x: r.left + gg.c[0] + x, y: r.top + gg.c[1] + y };
      return null; });
    // out along the handle's own direction (the object is turned: its X axis is not the screen's)
    const ux = hx.x - g.x, uy = hx.y - g.y, ul = Math.hypot(ux, uy) || 1;
    await p.mouse.move(hx.x, hx.y); await p.mouse.down(); await p.mouse.move(hx.x + ux / ul * 40, hx.y + uy / ul * 40, { steps: 6 }); await p.mouse.up();
    const sc = await p.evaluate(() => [__c.m3d.sx, __c.m3d.sy || 1, __c.m3d.sz || 1]);
    check("⤡ SCALE: the red X handle stretches it along its own X only", sc[0] > 1.1 && sc[1] === 1 && sc[2] === 1, sc);
    await p.evaluate(() => { const r = document.getElementById("tlCanvasWrap").getBoundingClientRect(); window.__mid = { x: r.left + 40, y: r.top + 40 }; });
    const mid = await p.evaluate(() => __mid);
    await p.mouse.move(mid.x, mid.y);
    await p.keyboard.press("r");
    const km = await p.evaluate(() => TlGizmo.mode());
    await p.keyboard.press("r");
    check("...R / G / S over the canvas pick the widget (the same key again hides it)", km === "rotate" && await p.evaluate(() => TlGizmo.mode()) === "off", km);
    await p.evaluate(() => TlGizmo.setMode("move"));
    const props = await p.evaluate(() => ["tlg3_move", "tlg3_rotate", "tlg3_scale", "tlp3PZ", "tlp3SXo", "tlp3SYo", "tlp3SZo"].filter((id) => !document.getElementById(id)));
    check("...the Properties: the widget buttons, Depth and the object's own Scale X / Y / Z", props.length === 0, props);
    await p.evaluate(() => { kfAdd(__c, 0.5, "video", "vl:0"); });
    const kk = await p.evaluate(() => { const k = __c.kf[0]; return [k.pz, k.sx, k.sy, k.sz, k.ry]; });
    check("...a ◆ keyframe holds the depth and the X / Y / Z scale too (they tween)", kk[0] > 0.05 && kk[1] > 1.1 && kk[2] === 1 && kk[3] === 1, kk);

    // 5 ---- glTF + the Blender add-on's sends (the inbox)
    const glb = glbCube([0.1, 0.3, 0.95, 1]);
    const n0 = await p.evaluate(() => TlM3D.all().length);
    const pushed = await api("/api/blender/push?name=bridge_cube.glb&layer=1", glb, true);
    check("🟧 the add-on's send lands in the project's models (POST /api/blender/push)", pushed.ok && pushed.name === "bridge_cube.glb", pushed);
    await p.waitForFunction((n) => TlM3D.all().length === n + 1, n0, { timeout: 15000 }).catch(() => null);
    const nl = await p.evaluate(() => { const all = TlM3D.all(); const c = all[all.length - 1]; window.__g = c; return { n: all.length, model: c.m3d.model }; });
    check("...and becomes a 3D layer on the timeline (Add as 3D layer)", nl.n === n0 + 1 && nl.model === "bridge_cube.glb", nl);
    await p.waitForFunction(() => { const f = H3M3D.frame(__g, 0); return f && !f.error; }, null, { timeout: 20000 }).catch(() => null);
    const blue = await p.evaluate(() => {
      const f = H3M3D.frame(__g, 0); if (!f || f.error) return f && f.error;
      const g2 = f.canvas.getContext("2d").getImageData(0, 0, f.w, f.h).data; let r = 0, bb = 0, n = 0;
      for (let i = 0; i < g2.length; i += 4) if (g2[i + 3] > 200) { r += g2[i]; bb += g2[i + 2]; n++; }
      return n ? [r / n, bb / n, n] : null;
    });
    check("...a .glb model draws with its own (blue) material", Array.isArray(blue) && blue[1] > blue[0] + 30 && blue[2] > 500, blue);
    await p.evaluate(() => { __g.m3dBaked = "x"; });
    await api("/api/blender/push?name=bridge_cube.glb&layer=1", glbCube([0.95, 0.2, 0.1, 1]), true);
    await p.waitForFunction(() => __g.m3dBaked !== "x", null, { timeout: 15000 }).catch(() => null);
    const live = await p.evaluate(() => ({ n: TlM3D.all().length, due: __g.m3dBaked !== "x" }));
    check("...sending the SAME model again (the live link) updates that layer - no second layer", live.n === n0 + 1 && live.due, live);

    // 6 ---- Render with Blender (the server's answers stubbed)
    await p.evaluate(() => { TlFloat.show(true); TlCanvas.select(__c, TlCanvas.layerOf(__c)); });
    await p.waitForFunction(() => document.getElementById("blRenderer"), null, { timeout: 5000 });
    await p.selectOption("#blRenderer", "blender");
    await p.evaluate(() => TlM3D.bake(__c));
    check("🟧 Render with Blender: the bake sends the spec and every frame's rotation / depth / scale to /api/blender/render",
      rendered && rendered.id === (await p.evaluate(() => __c.mid)) && rendered.spec.renderer === "blender" && rendered.frames.length === 120
      && rendered.frames[0].sx > 1.1 && "ry" in rendered.frames[60], rendered && { id: rendered.id, n: rendered.frames.length, f0: rendered.frames[0] });
    await p.click("#blSet");
    const dlg = await p.evaluate(() => ({ open: document.getElementById("blSetDlg").open, f: !!document.getElementById("blPath") && !!document.getElementById("blEngine") }));
    check("...⚙ opens the Blender settings (its path, engine, samples)", dlg.open && dlg.f, dlg);
    await p.evaluate(() => document.getElementById("blSetDlg").close());
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    check("the browser run finished", false, String(e && e.stack || e).slice(0, 800));
  } finally {
    await b.close();
    try { await api("/api/projects/load", { name: "default" }); } catch { /* fine */ }
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
