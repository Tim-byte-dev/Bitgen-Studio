#!/usr/bin/env node
// bitGen Studio 2.971.0 - 🌐 360 PANORAMA in the image editor (Tim: "can we add this to image-editor to create 360 panaromic
// images for mmh3. https://github.com/nomadoor/ComfyUI-Panorama-Stickers?"). The sphere maths (pcpano.js, pure), the job
// (lib/pano360.js), the graph / route / catalogue / wiring pins. The browser leg is scripts/test-ui971-ui.js; the graph through
// the real patcher (python) is scripts/test-971py.js.
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let P = 0, F = 0;
const check = (n, ok, got) => { if (ok) { P++; console.log("PASS:", n); } else { F++; console.log("FAIL:", n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const src = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const PP = require(path.join(ROOT, "ext/imageeditdock/pcpano.js"));
const L = require(path.join(ROOT, "lib/pano360.js"));
const px = (o, x, y) => Array.from(o.data.slice((y * o.w + x) * 4, (y * o.w + x) * 4 + 4)).join();
const solid = (w, h, rgba) => { const o = PP.img(w, h); for (let i = 0; i < w * h; i++) o.data.set(rgba, i * 4); return o; };
const RED = "255,0,0,255", GRN = "0,255,0,255", BLU = "0,0,255,255";

/* ---------------- the sphere (pure) ---------------- */
const red = solid(40, 30, [255, 0, 0, 255]), W = 360, H = 180;
const c = PP.build(W, H, [{ src: red, yaw: 0, pitch: 0, fov: 90 }]);
check("an empty canvas is all pure #00FF00 (what the LoRA fills)", (() => { const b = PP.blank(8, 4); for (let i = 0; i < 32; i++) if (px(b, i % 8, i >> 3) !== GRN) return false; return true; })());
check("a picture at turn 0 sits at FRONT (the middle); behind you (the edges) stays green", px(c, 180, 90) === RED && px(c, 0, 90) === GRN && px(c, 359, 90) === GRN);
check("its size = its field of view: 90° wide covers 45° either side (44° in, 46° out)", px(c, 180 + 43, 90) === RED && px(c, 180 + 46, 90) === GRN && px(c, 180 - 44, 90) === RED);
const c2 = PP.build(W, H, [{ src: red, yaw: 90, pitch: 0, fov: 60 }]);
check("turn +90° = to your RIGHT (three-quarters across)", px(c2, 270, 90) === RED && px(c2, 180, 90) === GRN);
const c3 = PP.build(W, H, [{ src: red, yaw: 0, pitch: 60, fov: 40 }]);
check("tilt +60° = UP (towards the top of the canvas)", px(c3, 180, 30) === RED && px(c3, 180, 90) === GRN);
const tb = PP.img(10, 10); for (let i = 0; i < 100; i++) tb.data.set(i < 50 ? [255, 0, 0, 255] : [0, 0, 255, 255], i * 4);
const lr = PP.img(10, 10); for (let i = 0; i < 100; i++) lr.data.set(i % 10 < 5 ? [255, 0, 0, 255] : [0, 0, 255, 255], i * 4);
const ctb = PP.build(W, H, [{ src: tb, yaw: 0, pitch: 0, fov: 90 }]), clr = PP.build(W, H, [{ src: lr, yaw: 0, pitch: 0, fov: 90 }]);
check("never upside down or mirrored (top stays up, left stays left)", px(ctb, 180, 70) === RED && px(ctb, 180, 110) === BLU && px(clr, 160, 90) === RED && px(clr, 200, 90) === BLU);
const tr = PP.img(10, 10); for (let i = 0; i < 100; i++) tr.data.set([0, 0, 255, i < 50 ? 0 : 255], i * 4);
const ctr = PP.build(W, H, [{ src: tr, yaw: 0, pitch: 0, fov: 90 }]);
check("a picture's transparency stays green (a layer cut out = only the cut-out placed)", px(ctr, 180, 60) === GRN && px(ctr, 180, 120) === BLU);
const two = PP.build(W, H, [{ src: red, yaw: 0, pitch: 0, fov: 90 }, { src: solid(10, 10, [0, 0, 255, 255]), yaw: 0, pitch: 0, fov: 30 }]);
check("several pictures: the later one on top", px(two, 180, 90) === BLU && px(two, 180 + 30, 90) === RED);
check("a picture straddling BEHIND wraps round both edges", (() => { const o = PP.build(W, H, [{ src: red, yaw: 180, pitch: 0, fov: 60 }]); return px(o, 2, 90) === RED && px(o, 357, 90) === RED && px(o, 180, 90) === GRN; })());
/* roll / seam */
const r = PP.roll(c2, W / 2);
check("roll: turned half way round (x -> x + W/2), unroll puts it back exactly", px(r, 90, 90) === RED && Buffer.compare(Buffer.from(PP.unroll(r).data), Buffer.from(c2.data)) === 0);
const s = PP.seamPrep(c, 1 / 12);
check("seamPrep: the left / right join turned to the middle under a green strip a twelfth wide; FRONT now at the edge",
  s.width === 30 && s.x0 === 165 && px(s.img, 180, 90) === GRN && px(s.img, 165, 10) === GRN && px(s.img, 194, 170) === GRN && px(s.img, 0, 90) === RED && px(s.img, 359, 90) === RED, { w: s.width, x0: s.x0 });
check("...the strip is at least 8 px on a tiny canvas", PP.seamPrep(PP.blank(40, 20), 1 / 12).width === 8);
/* the look round */
const v = (o, yaw, pitch, fov) => PP.view(PP.img(64, 36), o, yaw, pitch, fov);
check("view: looking ahead sees FRONT, turned round sees behind", px(v(c, 0, 0, 60), 32, 18) === RED && px(v(c, 180, 0, 60), 32, 18) === GRN);
check("view: turned right sees what is at turn +90, tilted up sees what is up - the same directions as placing", px(v(c2, 90, 0, 60), 32, 18) === RED && px(v(c3, 0, 60, 60), 32, 18) === RED);
check("view: upright and not mirrored", (() => { const a = v(ctb, 0, 0, 60), b = PP.view(PP.img(90, 50), PP.build(W, H, [{ src: red, yaw: -20, pitch: 0, fov: 20 }]), 0, 0, 90); return px(a, 32, 8) === RED && px(a, 32, 28) === BLU && px(b, 25, 25) === RED && px(b, 65, 25) === GRN; })());
/* picking */
check("lonLat: the canvas point -> turn / tilt (0.75, 0.25 = right, 45° up)", JSON.stringify(PP.lonLat(0.75, 0.25)) === '{"yaw":90,"pitch":45}' && PP.lonLat(0, 1).yaw === -180 && PP.lonLat(0, 1).pitch === -90);
check("hit: the topmost picture under a point, -1 on green", PP.hit([{ src: red, yaw: 0, pitch: 0, fov: 90 }, { src: red, yaw: 0, pitch: 0, fov: 20 }], 0.5, 0.5) === 1 && PP.hit([{ src: red, yaw: 0, pitch: 0, fov: 90 }], 0.6, 0.5) === 0 && PP.hit([{ src: red, yaw: 0, pitch: 0, fov: 90 }], 0.02, 0.5) === -1);
check("fovFor: a landscape starts 90° wide, a portrait narrower (never under 35°)", PP.fovFor(1600, 900) === 90 && PP.fovFor(500, 1000) === 45 && PP.fovFor(100, 1000) === 35);
check("speed: a full 2048 × 1024 canvas with a picture builds in well under 2 s", (() => { const t = Date.now(); PP.build(2048, 1024, [{ src: solid(800, 600, [9, 9, 9, 255]), yaw: 10, pitch: 5, fov: 100 }]); return Date.now() - t < 2000; })());

/* ---------------- the job (lib/pano360.js) ---------------- */
check("the trigger sentence starts every prompt; the description follows (never twice, one line, capped)",
  L.prompt("a beach\n at sunset") === L.TRIGGER + " a beach at sunset" && L.prompt(L.TRIGGER + " a beach") === L.TRIGGER + " a beach" && L.prompt("") === L.TRIGGER && L.cleanDesc("x".repeat(5000)).length === L.MAX_DESC
  && L.TRIGGER === "Fill the green areas to complete a seamless 360° equirectangular panorama.");
check("sizes: 2048 × 1024 (the LoRA's own) and 1408 × 704; anything else = 2048", L.size("1408").width === 1408 && L.size("1408").height === 704 && L.size("zz").width === 2048 && L.SIZES.every((z) => z.width === 2 * z.height));
const styleList = [{ id: "a", name: "Qwen Image 2.1", workflow: "comfy_workflows/img_qwen21.json" }, { id: "t8", name: "Qwen 2.1 Turbo8", workflow: "comfy_workflows/img_qwen21_edit.json", loras: [{ path: "turbo.safetensors" }] }, { id: "e", name: "Qwen Image 2.1 edit", workflow: "comfy_workflows/img_qwen21_edit.json", loras: [] }];
check("pickStyle: the Qwen Image 2.1 edit style (by name; else an edit-graph style with no LoRA - never Turbo8's)", L.pickStyle(styleList).id === "e" && L.pickStyle(styleList.slice(0, 2)) === null && L.pickStyle([{ id: "x", workflow: "a/img_qwen21_edit.json" }]).id === "x");
const jp = L.jobParams(styleList[2], { desc: "a forest", size: "1408", file: "/t/c.png", seam: true });
check("jobParams: one image job - the 360 graph, the green canvas as its picture, the LoRA at 0.8 only, 25 steps cfg 1, no asset kept",
  jp.mode === "image" && jp.workflow === L.WORKFLOW && jp.style.workflow === L.WORKFLOW && jp.images.join() === "/t/c.png" && jp.width === 1408 && jp.height === 704
  && JSON.stringify(jp.style.loras) === JSON.stringify([{ path: L.LORA, weight: 0.8 }]) && jp.style.steps === 25 && jp.style.cfg === 1 && jp.no_assets === true && jp.pano360 === "seam"
  && /360 panorama/.test(jp.style_name) && jp.prompt === L.TRIGGER + " a forest" && styleList[2].loras.length === 0);
check("...the make pass says make", L.jobParams(styleList[2], { file: "x" }).pano360 === "make" && L.jobParams(styleList[2], { file: "x" }).width === 2048);

/* ---------------- the graph, the catalogue, the route, the wiring ---------------- */
const G = JSON.parse(src(L.WORKFLOW));
const cls = (id) => G[id] && G[id].class_type;
check("graph: nomadoor's example minus Panorama Studio - LoadImage (the canvas) -> TextEncodeQwenImage21 (images.image_1, resolution 0) with the Prompt primitive",
  cls("21") === "LoadImage" && cls("10") === "TextEncodeQwenImage21" && JSON.stringify(G["10"].inputs["images.image_1"]) === '["21",0]' && G["10"].inputs.resolution === 0
  && JSON.stringify(G["10"].inputs.prompt) === '["9",0]' && cls("9") === "PrimitiveStringMultiline" && G["9"]._meta && /prompt/i.test(G["9"]._meta.title) && G["9"].inputs.value === L.TRIGGER);
check("graph: the LoRA model-only at 0.8 between the model and the sampler (a LoRA slot the style fills); KSampler 25 / cfg 1 / euler / simple; 2048 × 1024 latent",
  cls("11") === "LoraLoaderModelOnly" && G["11"].inputs.lora_name === L.LORA && G["11"].inputs.strength_model === 0.8 && JSON.stringify(G["11"].inputs.model) === '["1",0]'
  && !/\(fixed\)/i.test(G["11"]._meta.title) && JSON.stringify(G["13"].inputs.model) === '["11",0]' && G["13"].inputs.steps === 25 && G["13"].inputs.cfg === 1
  && G["13"].inputs.sampler_name === "euler" && G["13"].inputs.scheduler === "simple" && G["12"].inputs.width === 2048 && G["12"].inputs.height === 1024 && G["15"].inputs.filename_prefix === "pano360");
check("graph: only core ComfyUI nodes (no custom node pack needed); credits in its _comment",
  Object.values(G).filter((n) => n && n.class_type).every((n) => /^(UNETLoader|CLIPLoader|VAELoader|PrimitiveStringMultiline|TextEncodeQwenImage21|LoraLoaderModelOnly|EmptyLatentImage|KSampler|VAEDecode|SaveImage|LoadImage)$/.test(n.class_type))
  && /nomadoor/.test(JSON.stringify(G._comment || "")) && /non-commercial|Research License/i.test(JSON.stringify(G._comment || "")));
const CAT = JSON.parse(src("lib/modelCatalog.json")), all = Array.isArray(CAT) ? CAT : (CAT.models || CAT.entries || Object.values(CAT).find(Array.isArray) || []);
const ent = all.find((e) => e && e.id === "qwen21_pano360");
check("model catalogue: qwen21_pano360 - nomadoor's repo, the file into comfy/loras, the non-commercial licence said (the models check offers the download)",
  !!ent && ent.repo === "nomadoor/qwen-image-2.1-360-panorama-outpaint-lora" && ent.file === L.LORA && ent.dest === "comfy/loras" && /non-commercial/i.test(ent.for), ent);
const R = src("routes/pano360.js"), IX = src("routes/index.js");
check("route: mounted from routes/index.js (not server.js); GET says the style / LoRA / trigger / sizes, POST takes the canvas PNG",
  /require\("\.\/pano360"\)\.mount\(app\)/.test(IX) && !/pano360/.test(src("misc/server.js")) && /app\.get\("\/api\/pano360"/.test(R) && /app\.post\("\/api\/pano360", upload\.single\("canvas"\)/.test(R)
  && /toString\("latin1"\) !== "PNG"/.test(R) && /seam === "1"/.test(R) && /imageSeed\.forRequest/.test(R) && /core\.makeJob\(p\)/.test(R) && /restore the starter styles/.test(R));
const PJ = src("ext/imageeditdock/pcpano.js"), EXT = JSON.parse(src("ext/imageeditdock/ext.json")), IE = src("ext/imageeditdock/imageedit.js");
check("wiring: pcpano.js loaded before imageedit.js; installed after the other add-ons", EXT.scripts.indexOf("pcpano.js") > 0 && EXT.scripts.indexOf("pcpano.js") < EXT.scripts.indexOf("imageedit.js")
  && /if \(win\.PCPano && win\.PCPano\.install\) win\.PCPano\.install\(E\);/.test(IE));
check("the dialog: Image ▸ 🌐 360 Panorama…, models asked first (H3ModelsFound.ensure + the LoRA), POST /api/pano360, the answer opened as a new picture",
  /E\.ui\.addCmd\("image\.pano360", "🌐 360 Panorama…", "", open, \{\}, \["Image", null, true\]\)/.test(PJ) && /H3ModelsFound\.ensure\(\{ kind: "image", style_id: info\.style_id, extra_loras: \[\{ path: info\.lora, weight: info\.lora_weight \}\] \}\)/.test(PJ)
  && /win\.fetch\("\/api\/pano360", \{ method: "POST", body: fd \}\)/.test(PJ) && /E\.openImage\(toImage\(p\), st\.resultName \+ "\.png"\)/.test(PJ));
check("the dialog: ↔ seam (seamPrep -> seam=1 -> unroll), 🥽 VR World (slot=world), the licence note, its ids never clash (pn*, not the push-pull dock's pp*)",
  /seamPrep\(st\.result/.test(PJ) && /openResult\(unroll\(same\), "seam"\)/.test(PJ) && /fd\.append\("slot", "world"\)/.test(PJ) && /\/api\/vrworld\/upload/.test(PJ) && /non-commercial use/.test(PJ)
  && !/id="pp[A-Z]/.test(PJ) && !/\$\("pp/.test(PJ));
check("package.json is 2.971.0 or later", JSON.parse(src("package.json")).version >= "2.971.0");

console.log(`\nRESULT: ${P} passed, ${F} failed`);
process.exit(F ? 1 : 0);
