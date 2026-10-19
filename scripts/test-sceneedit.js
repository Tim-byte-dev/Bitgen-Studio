#!/usr/bin/env node
/* bitGen Studio — 2.337.0: ✎ FIRST FRAME (QWEN IMAGE 2.1) on the scene cards.
 * Run: node scripts/test-sceneedit.js
 * Tim: "can we use qwen2.1 to put the character in the location with the
 * props as first frame? make the image edit a dropdown accordian ... an
 * option to edit the image with qwen2.1 in the first image selector in each
 * scene, this way we can continue from the position but may change the
 * location".
 *   1. lib/sceneEdit: safe / resolveBase / plan (every base, the tags, the
 *      refusals) / canvasFor / the qe_ files / harvest;
 *   2. lib/scenes keeps the record through safe() and a plan rewrite;
 *   3. the Qwen 2.1 graph + style + catalog; aiEdit sees it as an 8-slot edit;
 *   4. wiring: routes/sceneedit.js mounted from routes/index.js (never
 *      server.js), the harvest in syncJobs;
 *   5. the accordion (jsdom): block / bind / the picker's qe_ slots. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("PASS: " + name); }
  else { fail++; console.log("FAIL: " + name + (extra !== undefined ? " :: " + JSON.stringify(extra).slice(0, 400) : "")); }
}
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const SE = require(path.join(ROOT, "lib", "sceneEdit"));

// ---- 1. lib/sceneEdit
const s0 = SE.safe(null);
check("safe: a blank record (base auto, nothing picked)", s0.base === "auto" && s0.chars.length === 0 && s0.location === null
  && s0.props.length === 0 && s0.status === "" && SE.isBlank(null) && SE.isBlank(s0));
const s1 = SE.safe({ base: "nope", chars: ["A", "B", "C", "D"], location: { file: "../evil.png" },
  props: [{ file: "qe_prop_1.png" }, { file: "x.png" }, { file: "qe_prop_2.png" }, { file: "qe_prop_3.png" }, { file: "qe_prop_4.png" }], status: "weird" });
check("safe: junk base -> auto, 3 characters, only qe_ files (no path escape), 3 props, junk status -> ''",
  s1.base === "auto" && s1.chars.length === 3 && s1.location === null && s1.props.length === 3
  && s1.props.every((p) => /^qe_prop_/.test(p.file)) && s1.status === "" && !SE.isBlank(s1), s1);
check("resolveBase: auto = continue when it can, else the location, else the First picture, else a character",
  SE.resolveBase("auto", { canContinue: true, hasLocation: true }) === "continue"
  && SE.resolveBase("auto", { hasLocation: true, hasFirst: true }) === "location"
  && SE.resolveBase("auto", { hasFirst: true }) === "first"
  && SE.resolveBase("auto", { nChars: 1 }) === "character" && SE.resolveBase("auto", {}) === ""
  && SE.resolveBase("location", { canContinue: true }) === "location");

const A = { name: "Ava", path: "/c/ava.png" }, B = { name: "Bo", path: "/c/bo.png" };
let p = SE.plan({ base: "location", locationPath: "/l/cafe.png", chars: [A, B], props: [{ path: "/p/qe_prop_x_red_umbrella.png", label: "upload: red_umbrella.png" }], text: "she holds a coffee cup" });
check("plan location: <image1> the place, the characters <image2> <image3>, the prop <image4>, in load order",
  p.images.join() === "/l/cafe.png,/c/ava.png,/c/bo.png,/p/qe_prop_x_red_umbrella.png"
  && p.prompt.startsWith("<image1> is the location. Place the character from <image2> and the character from <image3> in it.")
  && p.prompt.includes("Include the red umbrella from <image4>") && p.prompt.includes("She holds a coffee cup.")
  && p.prompt.endsWith("no borders.") && p.roles[0] === "the location", p);
p = SE.plan({ base: "continue", baseFile: "/t/frame.png", locationPath: "/l/street.png", chars: [A], text: "" , sceneText: "Ava walks home in the rain" });
check("plan continue: the frame is <image1> (same pose / position / framing), the NEW location <image2>, the character <image3>; blank direction = the scene's prompt",
  p.images.join() === "/t/frame.png,/l/street.png,/c/ava.png"
  && p.prompt.startsWith("Keep the people in <image1> exactly where they are: the same pose, position, expression and camera framing.")
  && p.prompt.includes("Move them into the location shown in <image2>") && p.prompt.includes("the character in <image3>")
  && p.prompt.includes("The shot: Ava walks home in the rain."), p);
p = SE.plan({ base: "first", baseFile: "/f/first.png", chars: [] });
check("plan first: the scene's own First picture is <image1>", p.images[0] === "/f/first.png" && p.roles[0] === "the scene's First picture");
p = SE.plan({ base: "character", chars: [A] });
check("plan character: no place, no frame - a film still of the character", p.prompt.startsWith("A film still of the character from <image1>"));
const refuses = (o, re) => { try { SE.plan(o); return false; } catch (e) { return re.test(e.message); } };
check("plan refuses in words: no location / nothing to continue from / no First / nothing at all",
  refuses({ base: "location" }, /pick a location picture/) && refuses({ base: "continue" }, /no frame to continue from/)
  && refuses({ base: "first" }, /no First picture/) && refuses({ base: "" }, /pick a character, a location picture or a frame/));
check("canvasFor: the video's aspect at ~1 MP, 16-px aligned (the first frame is never smaller than the take)",
  JSON.stringify(SE.canvasFor(960, 544)) === '{"width":1360,"height":768}' && JSON.stringify(SE.canvasFor(544, 960)) === '{"width":768,"height":1360}'
  && JSON.stringify(SE.canvasFor()) === '{"width":1360,"height":768}');
check("propName: from the label / file", SE.propName({ label: "upload: red_umbrella.png" }) === "red umbrella" && SE.propName({ path: "/x/qe_prop.png" }) === "prop");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "qe-"));
const src = path.join(tmp, "src.png");
fs.writeFileSync(src, "png");
const d = path.join(tmp, "scene");
let r = SE.setPic(d, null, "location", src, "upload: cafe.png");
check("setPic location: qe_location.<ext>, labelled", r.ok && r.qedit.location.file === "qe_location.png" && fs.existsSync(path.join(d, "qe_location.png")));
let q = r.qedit;
for (let i = 0; i < 3; i++) { r = SE.setPic(d, q, "prop", src, `upload: prop${i}.png`); q = r.qedit; }
check("setPic prop: up to 3, a 4th refused", q.props.length === 3 && !SE.setPic(d, q, "prop", src, "x").ok);
check("picPath: only qe_ pictures in the scene's folder", SE.picPath(d, "qe_location.png") && !SE.picPath(d, "../src.png") && !SE.picPath(d, "fl_first.png"));
r = SE.delPic(d, q, "prop", q.props[1].file);
check("delPic: the prop and its file go", r.ok && r.qedit.props.length === 2 && fs.readdirSync(d).filter((f) => /^qe_prop/.test(f)).length === 2);
r = SE.delPic(d, r.qedit, "location");
check("delPic location", r.ok && r.qedit.location === null && !fs.existsSync(path.join(d, "qe_location.png")));

const out = path.join(tmp, "out.png"); fs.writeFileSync(out, "png");
const jobs = new Map([["j1", { finished: true, status: "done", output: "out.png" }], ["j2", { finished: false }],
                      ["j3", { finished: true, status: "failed", log: ["[worker] ERROR: boom"] }]]);
const set = [];
const rows = [{ n: 1, anchor: "reference", qedit: { job: "j1", status: "running" } }, { n: 2, qedit: { job: "j2" } },
              { n: 3, anchor: "continue", qedit: { job: "j3", status: "running" } }, { n: 4, qedit: { job: "gone" } }, { n: 5 }];
const ch = SE.harvest(rows, { jobs, outputPath: (nm) => path.join(tmp, nm), setFirst: (row, s, label) => { set.push([row.n, s, label]); return { ok: true }; },
                              reason: () => "the edit failed: boom" });
check("harvest: done -> the First slot (a Ref scene becomes First), running stays running, failed says why, a vanished job fails",
  ch && set.length === 1 && set[0][0] === 1 && set[0][2] === "✎ Qwen 2.1 first frame" && rows[0].anchor === "first"
  && rows[0].qedit.status === "done" && rows[0].qedit.job === "" && rows[1].qedit.status === "running" && rows[1].qedit.job === "j2"
  && rows[2].qedit.status === "failed" && /boom/.test(rows[2].qedit.error) && rows[2].anchor === "continue"
  && rows[3].qedit.status === "failed" && /vanished/.test(rows[3].qedit.error) && rows[4].qedit === undefined, rows);

// ---- 2. lib/scenes keeps it
const S = read("lib", "scenes.js");
check("scenes.safe keeps qedit (blank ones stay out), fromPlan carries it through a rewrite",
  S.includes("qedit: r.qedit && !sceneEdit.isBlank(r.qedit) ? sceneEdit.safe(r.qedit) : undefined")
  && S.includes("qedit: o ? o.qedit : undefined"));

// ---- 3. the graph, the style, the catalog
const g = JSON.parse(read("comfy_workflows", "img_qwen21_edit.json"));
const nodes = Object.entries(g).filter(([k]) => !k.startsWith("_"));
const enc = nodes.find(([, v]) => v.class_type === "TextEncodeQwenImage21");
const loads = nodes.filter(([, v]) => v.class_type === "LoadImage").map(([k]) => +k).sort((a, b) => a - b);
check("img_qwen21_edit.json: 8 LoadImage slots (21..28) wired to images.image_1..8 in id order, the prompt from a Primitive, cfg 1 euler",
  enc && loads.join() === "21,22,23,24,25,26,27,28"
  && [1, 2, 3, 4, 5, 6, 7, 8].every((k) => JSON.stringify(enc[1].inputs[`images.image_${k}`]) === JSON.stringify([String(20 + k), 0]))
  && JSON.stringify(enc[1].inputs.prompt) === '["9",0]' && g["13"].inputs.cfg === 1 && g["13"].inputs.sampler_name === "euler");
check("...the Comfy-Org/Qwen-Image-2.1 files, and the catalog carries them", g["1"].inputs.unet_name === "qwen_image_2.1_int8_convrot.safetensors"
  && g["2"].inputs.clip_name === "qwen3vl_8b_int8_convrot.safetensors" && g["2"].inputs.type === "qwen_image"
  && g["3"].inputs.vae_name === "qwen_image_2.1_vae_bf16.safetensors"
  && ["qwen21", "qwen21_te", "qwen21_vae"].every((id) => JSON.parse(read("lib", "modelCatalog.json")).models.some((m) => m.id === id)));
const aiEdit = require(path.join(ROOT, "lib", "aiEdit"));
check("aiEdit: an instruction-edit graph with 8 picture slots",
  aiEdit.isEditGraph(ROOT, "comfy_workflows/img_qwen21_edit.json")
  && aiEdit.editGraph({ engine: "comfy", kind: "image", workflow: "comfy_workflows/img_qwen21_edit.json" }, ROOT).slots === 8);
check("the starter style: Qwen Image 2.1 edit, 25 steps, cfg 1", /name: "Qwen Image 2\.1 edit", arch: "qwen-image", engine: "comfy",\s+workflow: "comfy_workflows\/img_qwen21_edit\.json",\s+steps: 25, cfg: 1/.test(read("lib", "styles.js")));
const CI = read("scripts", "comfy_image.py");
check("comfy_image: an unused slot that fed an OPTIONAL autogrow input (images.image_N) drops the dangling key",
  CI.includes('for k in [k for k, v in ins.items() if "." in k and _is_link(v) and v[0] not in graph]:'));

// ---- 4. wiring
const R = read("routes", "sceneedit.js"), IDX = read("routes", "index.js"), CH = read("routes", "characters.js");
check("routes/sceneedit.js is mounted from routes/index.js (never server.js)",
  IDX.includes('require("./sceneedit").mount(app);') && !read("server.js").includes("sceneedit"));
check("route: the endpoints", ["/api/sceneedit/engines", "/api/scenes/:n/qedit\"", "/api/scenes/:n/qedit/pic\"", "/api/scenes/:n/qedit/pic/upload",
  "/api/scenes/:n/qedit/pic/delete", "/api/scenes/:n/qedit/pic/:file", "/api/scenes/:n/qedit/run"].every((e) => R.includes(e)));
check("route: Qwen 2.1 first among the edit styles; a job already running is refused (409); the canvas from canvasFor; no_assets",
  R.includes("/qwen.*2\\.1/i.test(x.name)") && R.includes("status(409)") && R.includes("sceneEdit.canvasFor(") && R.includes("no_assets: true"));
const SF = read("lib", "sceneFrames.js");
check("route: the continuation frame the way a render finds it (picked frame, else the scene before; the tail PNGs first) - lib/sceneFrames (2.338.0, shared with LTX scenes)",
  R.includes('require("../lib/sceneFrames")') && SF.includes("row.cont_src") && SF.includes("tailFrames.pick(project, st, c.row, c.t)")
  && SF.includes("sceneRefs.extractFrame(takeOf(c.row), c.t)"));
check("route: none ticked = the @tags the scene's prompt names", R.includes('txt.includes("@" + c.tag)'));
check("syncJobs harvests finished ✎ jobs into the First slot", CH.includes("sceneEdit.harvest(st.list, { jobs: core.jobs")
  && CH.includes('setFirst: (row, src, label) => sceneRefs.setSlot(project, row, "first", src, label)'));
const EXT = JSON.parse(read("ext", "videodock", "ext.json"));
check("the video dock loads qedit.js", EXT.scripts.includes("qedit.js"));
const C = read("ext", "videodock", "characters.js");
check("characters.js: the accordion under the frame slots, bound after every paint, its prompt holds the repaint, a running ✎ keeps the poll",
  C.includes("(window.ScQedit ? window.ScQedit.block(r) : \"\")") && C.includes("window.ScQedit.bind(el(\"scList\")")
  && C.includes("window.ScQedit && window.ScQedit.editing()") && C.includes("window.ScQedit && window.ScQedit.busy(scState.list)"));
check("the picker: qe_location / qe_prop go to /qedit/pic and /qedit/pic/upload",
  C.includes('isQe ? "/qedit/pic" : "/fl"') && C.includes('isQe ? "/qedit/pic/upload" : "/fl/upload"'));

// ---- 5. the accordion (jsdom)
(async () => {
  let JSDOM;
  try { ({ JSDOM } = require("jsdom")); } catch { console.log("(jsdom missing - the accordion checks are skipped)"); return; }
  const dom = new JSDOM('<!doctype html><body><div id="scList"></div></body>', { runScripts: "outside-only", url: "http://127.0.0.1/" });
  const w = dom.window, doc = w.document;
  const calls = [];
  w.fetch = async (url, o) => {
    const body = o && typeof o.body === "string" ? JSON.parse(o.body) : null;
    calls.push({ url, body });
    const J = (x) => ({ ok: true, json: async () => x });
    if (url === "/api/sceneedit/engines") return J({ edit: [{ id: "q21", name: "Qwen Image 2.1 edit" }, { id: "k", name: "FLUX.1 Kontext edit" }], default: "q21",
      cast: [{ name: "Ava", tag: "ava", url: "/c/ava.png" }, { name: "Bo", tag: "bo", url: "/c/bo.png" }] });
    if (/\/qedit\/run$/.test(url)) return J({ ok: true, note: "✎ queued" });
    return J({ ok: true });
  };
  w.eval(read("ext", "videodock", "qedit.js"));
  const QE = w.ScQedit;
  await QE.loadInfo(true);
  const row = { n: 2, qedit: { base: "continue", chars: ["Bo"], prompt: "rain", location: { file: "qe_location.png", label: "cafe" },
    props: [{ file: "qe_prop_a_cup.png", label: "cup" }], status: "failed", error: "boom" } };
  doc.getElementById("scList").innerHTML = QE.block(row);
  const det = doc.querySelector('details.scqe[data-qe="2"]');
  check("block: a closed <details> accordion titled ✎ First frame (Qwen 2.1), the failure said",
    det && !det.open && /✎ First frame \(Qwen 2\.1\)/.test(det.querySelector("summary").textContent) && /⚠ failed/.test(det.textContent) && /boom/.test(det.textContent));
  check("block: Start from (the record's choice), the cast as checkboxes (Bo ticked), 📍 location + 🧸 prop thumbs, the direction, the edit styles (Qwen 2.1 picked), ✎ Make first frame",
    det.querySelector("[data-qebase]").value === "continue"
    && Array.from(det.querySelectorAll("[data-qechar]")).map((c) => c.value + ":" + c.checked).join() === "Ava:false,Bo:true"
    && det.querySelector('img[src="/api/scenes/2/qedit/pic/qe_location.png"]') && det.querySelector('img[src="/api/scenes/2/qedit/pic/qe_prop_a_cup.png"]')
    && det.querySelector("[data-qeprompt]").value === "rain" && det.querySelector("[data-qestyle]").value === "q21"
    && /Make first frame/.test(det.querySelector("[data-qerun]").textContent));
  const picks = [], notes = [];
  let refreshed = 0;
  QE.bind(doc.getElementById("scList"), { refresh: () => { refreshed++; }, picker: (n, slot) => picks.push([n, slot]), note: (t) => notes.push(t) });
  det.querySelector('[data-qepick][data-slot="qe_prop"]').click();
  det.querySelector('[data-qepick][data-slot="qe_location"]').click();
  check("📍 / 🧸 open the scene picker with the qe_ slots", JSON.stringify(picks) === '[[2,"qe_prop"],[2,"qe_location"]]');
  det.querySelector('[data-qechar][value="Ava"]').checked = true;
  det.querySelector('[data-qechar][value="Ava"]').dispatchEvent(new w.Event("change"));
  await new Promise((r) => setTimeout(r, 10));
  check("ticking a character saves the list", calls.some((c) => c.url === "/api/scenes/2/qedit" && c.body && JSON.stringify(c.body.chars) === '["Ava","Bo"]'));
  det.querySelector("[data-qerun]").click();
  await new Promise((r) => setTimeout(r, 10));
  const run = calls.find((c) => /\/qedit\/run$/.test(c.url));
  check("✎ Make first frame posts the base, the ticked cast, the direction and the style; the note is shown",
    run && run.url === "/api/scenes/2/qedit/run" && run.body.base === "continue" && JSON.stringify(run.body.chars) === '["Ava","Bo"]'
    && run.body.prompt === "rain" && run.body.style_id === "q21" && notes.includes("✎ queued") && refreshed >= 1, run && run.body);
  det.open = true; det.dispatchEvent(new w.Event("toggle"));
  check("the open state is remembered for the repaint", QE._open[2] === true && /<details[^>]* open/.test(QE.block(row)));
  check("busy: a running ✎ keeps the board polling", QE.busy([{ qedit: { status: "running" } }]) && !QE.busy([{ qedit: { status: "done" } }]));
})().then(() => {
  console.log(`RESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}).catch((e) => { console.log("FAIL: crashed " + e.stack); process.exit(1); });
