#!/usr/bin/env node
/* bitGen Studio — 3.14.0: 🏞 Scene in Layers (ext/imageeditdock/pclayerscene.js + lib/layerScene.js + POST /api/layerscene/plan)
 * and 🛤 Ground & Perspective (pcground.js) - the pure parts and the wiring; in a real browser: scripts/test-ui31400-ui.js.
 * Tim: "can we use code to create the layers using an image model, like background scenic lake, horse, cabin, road, text
 * layers ... horse layer will be a full horse adjusted to the position of the road, we can move the horse up and down the road,
 * and maybe add a perspective tool?" -> "lets do both, it will be one for a photo composition and one for creating posters" */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const LS = require(path.join(ROOT, "ext/imageeditdock/pclayerscene.js"));
const GR = require(path.join(ROOT, "ext/imageeditdock/pcground.js"));
const PL = require(path.join(ROOT, "lib/layerScene.js"));

(async () => {
  /* ---------------- 🛤 the ground */
  check("depthScale: the size follows the distance below the horizon (feet from 600 to 400, horizon 200 -> half)", GR.depthScale(600, 400, 200) === 0.5 && GR.depthScale(400, 600, 200) === 2 && GR.depthScale(500, 500, 200) === 1);
  check("…at / above the horizon: tiny, never 0 or negative; a thing that was not below the horizon: no change", GR.depthScale(600, 150, 200) > 0 && GR.depthScale(600, 150, 200) < 0.01 + 0.05 && GR.depthScale(150, 600, 200) === 1);
  check("footOf / shadowShape: the middle of the bottom; a flat soft ellipse there", JSON.stringify(GR.footOf({ x: 10, y: 20, w: 100, h: 50 })) === "[60,70]"
    && (() => { const s = GR.shadowShape({ x: 0, y: 0, w: 200, h: 300 }); return s.cx === 100 && Math.abs(s.cy - 300) < 5 && s.rx === 90 && s.ry < s.rx / 4 && s.blur >= 2; })());
  check("horizonOf: the one set, else 45 % of the height", GR.horizonOf({ h: 1000 }) === 450 && GR.horizonOf({ h: 1000, groundH: 300 }) === 300);

  /* ---------------- 🏞 the scene */
  check("ROWS0: the lake, the cabin, the horse (on the ground), the title", LS.ROWS0.map((r) => r.kind).join() === "background,object,object,text" && LS.ROWS0[2].ground && LS.check({ mode: "poster", rows: LS.ROWS0, style: "s" }) === "");
  check("check: one background, an object, a text has words, the image style, 📷 needs an edit model",
    /exactly one/.test(LS.check({ rows: [{ name: "a", kind: "object" }], style: "s" })) && /at least one object/.test(LS.check({ rows: [{ name: "b", kind: "background" }], style: "s" }))
    && /needs its words/.test(LS.check({ rows: [{ name: "b", kind: "background" }, { name: "o", kind: "object" }, { name: "t", kind: "text", desc: "" }], style: "s" }))
    && /image style/.test(LS.check({ mode: "poster", rows: LS.ROWS0, style: "" })) && /edit model/.test(LS.check({ mode: "photo", rows: LS.ROWS0, style: "s", editStyle: "" })));
  const a = LS.anchorOf({ kind: "object", ground: true, where: "bottom-left", size: 40 }, 1000, 600, 270);
  check("anchorOf: a ground object's FEET below its place's middle and below the horizon, its height from its size", a.ground && a.x === 250 && a.h === 240 && a.y > 450 && a.y <= 588, a);
  check("…an object placed above the horizon still stands below it", LS.anchorOf({ kind: "object", ground: true, where: "top", size: 5 }, 1000, 600, 300).y >= 300 + 24);
  const b = LS.fitBox(500, 1000, a, 1000, 600);
  check("fitBox: the cut-out at the height asked, its own shape, standing on its feet, inside the picture", b.h === 240 && b.w === 120 && b.y + b.h === Math.round(a.y) && b.x >= 0, b);
  check("…too wide: shrunk to the picture", LS.fitBox(4000, 100, { x: 500, y: 300, h: 300, ground: false }, 1000, 600).w === 950);
  const p = { rows: LS.ROWS0, style: "a sharp photograph", lighting: "late sun from the left", camera: "eye level" };
  check("prompts: 📷 the whole scene names every object and its place, no text; the plate takes them out; each object pulled out WHOLE where it stood",
    /cabin \(a small log cabin.*on the right/i.test(LS.prompts.scene(p)) && /Horse \(a chestnut horse/.test(LS.prompts.scene(p)) && /no text/i.test(LS.prompts.scene(p)) && !/WILD COUNTRY/.test(LS.prompts.scene(p))
    && /Remove the cabin, the horse/.test(LS.prompts.plate(p)) && /whole and complete with any hidden parts finished.*same place and the same size/.test(LS.prompts.extract(LS.ROWS0[2])));
  check("…🎨 the background empty (no cabin, no horse), each object alone on a plain backdrop, nothing cut off, the look carried",
    /no cabin, no horse/.test(LS.prompts.background(p)) && /The whole horse, all of it.*plain flat light grey background/.test(LS.prompts.object(LS.ROWS0[2], p)) && /Lighting: late sun from the left/.test(LS.prompts.object(LS.ROWS0[2], p)));
  check("order: the background, objects far (feet higher) to near, the words on top",
    LS.order([{ kind: "text", n: 1 }, { kind: "object", foot: 500, n: 2 }, { kind: "background", n: 3 }, { kind: "object", foot: 300, n: 4 }]).map((x) => x.n).join() === "3,4,2,1");
  check("textBox: the letter height as % of the picture, at its place", (() => { const t = LS.textBox({ desc: "WILD", size: 10, where: "top" }, 1000, 600); return t.size === 60 && t.w === 900 && t.y >= 0 && Math.abs(t.y + t.h / 2 - 120) < 2; })());

  const kd = (() => { const w = 40, h = 30, d = new Uint8ClampedArray(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4, f = x >= 10 && x < 30 && y >= 5 && y < 25; d[i] = f ? 200 : 205; d[i + 1] = f ? 30 : 205; d[i + 2] = f ? 30 : 205; d[i + 3] = 255; } return d; })();
  const km = LS.backdropKey(kd, 40, 30);
  check("backdropKey: a plain grey backdrop keyed out - the object solid, the backdrop clear", km && km[15 * 40 + 20] === 255 && km[0] === 0 && km[2 * 40 + 35] === 0);
  check("…a busy border (not a plain backdrop): null - the AI matte / the subject finder decide", LS.backdropKey(Uint8ClampedArray.from({ length: 40 * 30 * 4 }, (_, i) => (i % 4 === 3 ? 255 : (i * 37) % 256)), 40, 30) === null);

  /* ---------------- the LLM's plan */
  const c = PL.clean({ aspect: "3:2", horizon: 38, style: "photo", layers: [{ name: "Horse", kind: "object", desc: "a horse", where: "bottom-left", size: 30 }, { name: "Lake", kind: "background", desc: "a lake" },
    { kind: "text", desc: "WILD COUNTRY", where: "Top", size: 50 }, { name: "Bird", kind: "object", desc: "a hawk", where: "top", ground: false }, { name: "Odd", kind: "weird", desc: "x", where: "upstairs" }] });
  check("layerScene.clean: the background first (one), kinds / places / sizes made safe, a text named by its words, its size 3-20, ground for objects only",
    c.rows.map((r) => r.kind + ":" + r.name).join() === "background:Lake,object:Horse,text:WILD COUNTRY,object:Bird,object:Odd" && c.rows[2].size === 20 && c.rows[2].where === "top"
    && c.rows[1].ground === true && c.rows[3].ground === false && c.rows[4].where === "centre" && c.horizon === 38 && c.w > c.h, c.rows);
  check("…no background from the LLM: a plain one added", PL.clean({ layers: [{ name: "Cat", kind: "object", desc: "a cat" }] }).rows[0].kind === "background");
  let sent = null;
  PL.setComplete(async (o) => { sent = o; return { ok: true, text: '```json\n{"aspect":"16:9","horizon":42,"layers":[{"name":"Lake","kind":"background","desc":"lake"},{"name":"Horse","kind":"object","desc":"horse","where":"bottom-left","size":35,"ground":true}]}\n```' }; });
  const r = await PL.plan({ ask: "a horse by a lake", mode: "poster" });
  check("plan: asks for one background + movable objects + words, the mode said; parsed", /SEPARATE LAYERS/.test(sent.messages[0].content) && /poster/.test(sent.messages[1].content) && r.plan.rows.length === 2 && r.plan.horizon === 42);
  check("…no ask / an empty plan / no answer -> said", /say what the scene is/.test(await PL.plan({}).catch((e) => e.message))
    && /nothing in the scene/.test(await (PL.setComplete(async () => ({ ok: true, text: "{}" })), PL.plan({ ask: "x" })).catch((e) => e.message))
    && /did not answer/.test(await (PL.setComplete(async () => ({ ok: false })), PL.plan({ ask: "x" })).catch((e) => e.message)));
  PL.setComplete(null);

  /* ---------------- the wiring */
  const EJ = JSON.parse(read("ext/imageeditdock/ext.json")).scripts, ie = read("ext/imageeditdock/imageedit.js"), cr = read("ext/imageeditdock/pccreate.js"), idx = read("routes/index.js");
  check("the scripts load before the editor, which installs them", EJ.indexOf("pcground.js") < EJ.indexOf("imageedit.js") && EJ.indexOf("pclayerscene.js") < EJ.indexOf("imageedit.js")
    && /win\.PCGround\.install\(E\)/.test(ie) && /win\.PCLayerScene\.install\(E\)/.test(ie));
  check("POST /api/layerscene/plan in routes/layerScene.js, mounted from routes/index.js (server.js untouched; the 3D scene's lib/scenePlan.js untouched)",
    /require\("\.\/layerScene"\)\.mount\(app\)/.test(idx) && /\/api\/layerscene\/plan/.test(read("routes/layerScene.js")) && !/layerscene/i.test(read("misc/server.js")) && /THE LLM LAYS OUT A 3D SCENE/.test(read("lib/scenePlan.js")));
  check("✨ Create With the AI ▸ 🏞 Scene in layers opens the box with your words and plans them", /\["scene", "🏞", "Scene in layers"\]/.test(cr) && /E\.layerScene\.dialog\(\{ ask, plan: true \}\)/.test(cr));
  const ls = read("ext/imageeditdock/pclayerscene.js");
  check("📷 = one /api/genimage of the whole scene, then /api/aiedit (the edit model) for the plate and each object; 🎨 = /api/genimage per layer; cut out by the AI matte or built in",
    /generate\(prompts\.scene/.test(ls) && /edit\(scene, prompts\.plate/.test(ls) && /edit\(scene, prompts\.extract\(r\)\)/.test(ls) && /generate\(prompts\.object\(r/.test(ls)
    && /\/api\/subject\/matte/.test(ls) && /PCSubject\.subjectMask/.test(ls));
  console.log("\n" + pass + " passed, " + fail + " failed");
  console.log("RESULT: " + fail + " failed");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: threw " + (e && e.stack || e)); console.log("RESULT: 1 failed"); process.exit(1); });
