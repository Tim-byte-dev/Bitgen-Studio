#!/usr/bin/env node
/* bitGen Studio — 2.874.0 units: your own mannequins + character sheet templates (lib/sheetLibrary.js, routes/sheetLibrary.js,
 * lib/charSheetH3.js graph with a template, routes/charSheetH3.js, ext/videodock/h3sheet.js).
 * Tim (verbatim): "let the user use own mannequin images for the character sheet profile, user can upload character sheet and
 * follow that template to create the character sheet" */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os"), zlib = require("zlib");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
/** a real (grey) PNG of w x h */
function png(w, h) {
  const crc = (b) => { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 0;
  const raw = Buffer.alloc((w + 1) * h, 128); for (let y = 0; y < h; y++) raw[y * (w + 1)] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ih), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const L = require("../lib/sheetLibrary");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lib874-"));
L.setRoot(tmp);
// dims
check("dims: PNG", JSON.stringify(L.dims(png(300, 120))) === '{"type":"png","w":300,"h":120}');
const jpg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16]), Buffer.alloc(14), Buffer.from([0xff, 0xc0, 0, 17, 8, 0x02, 0x58, 0x03, 0x20]), Buffer.alloc(30)]);
check("dims: JPEG (the SOF0 frame: 800 x 600)", JSON.stringify(L.dims(jpg)) === '{"type":"jpeg","h":600,"w":800}', L.dims(jpg));
const webp = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBPVP8X"), Buffer.alloc(8), Buffer.from([0x3f, 0x06, 0, 0xff, 0x03, 0])]);
check("dims: WebP (VP8X: 1600 x 1024)", JSON.stringify(L.dims(webp)) === '{"type":"webp","w":1600,"h":1024}', L.dims(webp));
check("dims: anything else = null", L.dims(Buffer.from("hello there, not a picture at all.....")) === null);
// add / list / remove
const t1 = L.add("templates", { buffer: png(1600, 800), original: "my turnaround sheet.png" });
const m1 = L.add("mannequins", { buffer: png(400, 900), name: "Bulky mannequin" });
const li = L.list();
check("add: a template (its name from the file, its size) and a mannequin (the name given), each with its own address",
  t1.name === "my turnaround sheet" && t1.w === 1600 && t1.h === 800 && m1.name === "Bulky mannequin" && li.templates.length === 1 && li.mannequins.length === 1
  && li.templates[0].url === `/api/charsheet/library/templates/${t1.id}/file` && fs.existsSync(L.file("templates", t1.id)), li);
let e1 = ""; try { L.add("templates", { buffer: Buffer.from("not a picture at all, just some words here") }); } catch (e) { e1 = e.message; }
let e2 = ""; try { L.add("mannequins", { buffer: png(20, 20) }); } catch (e) { e2 = e.message; }
let e3 = ""; try { L.add("poses", { buffer: png(200, 200) }); } catch (e) { e3 = e.message; }
check("refused: not a picture, too small, an unknown library", /not a PNG, JPEG, WebP or BMP/.test(e1) && /too small/.test(e2) && /no such library/.test(e3), [e1, e2, e3]);
check("kept for every project in one folder with an index (charsheet_library/index.json), git-ignored",
  fs.existsSync(path.join(tmp, "index.json")) && /\/charsheet_library\//.test(src(".gitignore")) && /charsheet_library/.test(src("lib/sheetLibrary.js")));
check("remove: gone from the list and the disk", L.remove("mannequins", m1.id) === true && !L.list().mannequins.length && !L.file("mannequins", m1.id) && L.remove("mannequins", m1.id) === false);
// the graph with a template
const S = require("../lib/charSheetH3");
const st = S.state({ views: ["face_front", "body_front", "body_left", "body_back"], detail: "high" });
const ts = S.templateSize(1600, 800, st);
check("templateSize: the template's shape (2:1) at the Size's pixels (High detail ~6 MP), 16 px steps", ts.w === 3472 && ts.h === 1728 && ts.w % 16 === 0, ts);
const tall = S.templateSize(500, 4000, S.state({ views: ["body_front"], detail: "max_16mp" }));
check("...a very tall template keeps each side at 8192 at most", tall.h <= 8192 && tall.w >= 512 && Math.abs(tall.w / tall.h - 0.125) < 0.02, tall);
const names = { unet: "u.safetensors", clip: "c.safetensors", vae: "v.safetensors" };
const g1 = S.graph({ state: st, layout: false, style: "none", seed: 3, names, character: "/x/hero.png", refs: [null, "/x/boots.png", null],
  template: { path: L.file("templates", t1.id), w: 1600, h: 800 }, concat: true }).graph;
check("graph with a template: the designer asked for its layout words, YOUR sheet in the layout slot (image_1), its shape as the size",
  g1.design.inputs.use_layout_image === true && JSON.stringify(g1.cond.inputs["images.image_1"]) === '["tpl",0]' && g1.tpl.class_type === "LoadImage"
  && g1.cond.inputs.width === 3472 && g1.cond.inputs.height === 1728 && JSON.stringify(g1.cond.inputs["images.image_3"]) === '["design",6]', g1.cond.inputs);
check("...the extra words after the designer's (String Concatenate): follow <Picture 2>'s layout, the character only from <Picture 1>",
  g1.tplPrompt.class_type === "StringConcatenate" && JSON.stringify(g1.tplPrompt.inputs.string_a) === '["design",0]' && /TEMPLATE for this sheet/.test(g1.tplPrompt.inputs.string_b)
  && /never from <Picture 2>/.test(g1.tplPrompt.inputs.string_b) && JSON.stringify(g1.cond.inputs.prompt) === '["tplPrompt",0]');
const up = S.graph({ state: st, layout: false, style: "none", seed: 3, names, character: "/x/hero.png", refs: [],
  template: { path: "/lib/t.png", w: 1000, h: 1000 }, concat: false });
check("...no String Concatenate in this ComfyUI: the template still rides, the designer's words alone; uploaded by the worker",
  !up.graph.tplPrompt && JSON.stringify(up.graph.cond.inputs.prompt) === '["design",0]' && up.uploads.some((u) => u.node === "tpl" && u.path === "/lib/t.png"));
const plain = S.graph({ state: st, layout: true, style: "none", seed: 3, names, character: "/x/hero.png", refs: [] }).graph;
check("no template: as before (the designer's own layout picture, its own size)", JSON.stringify(plain.cond.inputs["images.image_1"]) === '["design",3]' && JSON.stringify(plain.cond.inputs.width) === '["design",1]' && !plain.tpl);
// the routes + the page
const R = src("routes/charSheetH3.js"), RL = src("routes/sheetLibrary.js"), HS = src("ext/videodock/h3sheet.js");
check("routes/sheetLibrary.js: GET the library, POST a picture, DELETE, GET the file; mounted from routes/index.js",
  /app\.get\("\/api\/charsheet\/library"/.test(RL) && /app\.post\("\/api\/charsheet\/library\/:kind", upload\.single\("file"\)/.test(RL) && /app\.delete\("\/api\/charsheet\/library\/:kind\/:id"/.test(RL)
  && /\/api\/charsheet\/library\/:kind\/:id\/file/.test(RL) && /require\("\.\/sheetLibrary"\)\.mount\(app\)/.test(src("routes/index.js")));
check("the sheet route: template = a library id (gone = said), String Concatenate looked for, said in the job; own:<id> mannequins copied into Images",
  /LIB\.item\("templates", String\(b\.template\)\)/.test(R) && /concat: !!\(info && info\.StringConcatenate\)/.test(R) && /" · template " \+ template\.name/.test(R)
  && /sex\.startsWith\("own:"\)/.test(R) && /"mannequin-own-" \+ it\.id/.test(R));
check("h3sheet.js: Template ▾ (None / your sheets / ＋ Upload a character sheet…, 🗑), the template drawn as the layout, the Layout guide ticked + locked, sent with the sheet",
  /id="h3sTpl"/.test(HS) && /＋ Upload a character sheet…/.test(HS) && /id="h3sTplDel"/.test(HS) && /function drawTemplate/.test(HS) && /lg\.disabled = !!t/.test(HS) && /fd\.append\("template", f\.template\)/.test(HS));
check("...🧍 Mannequin… lists Your mannequins + ＋ Add your own mannequin… (🗑 for yours), loaded like bitGen's",
  /g\.label = "Your mannequins"/.test(HS) && /＋ Add your own mannequin…/.test(HS) && /loadMannequin\("own:" \+ x\.j\.id\)/.test(HS) && /id="h3sMqDel"/.test(HS));
console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
process.exit(fail ? 1 : 0);
