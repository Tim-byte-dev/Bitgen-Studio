#!/usr/bin/env node
/* bitGen Studio — 2.324.0: CHARACTER SWAP, the app side.
 * Run: node scripts/test-swap.js
 * Tim: "load a reference video and change the character in the reference
 * video with a character from a reference image ... from a video prompt or
 * from a scene". Answers: keep the original audio · start + duration, one
 * run · a cast sheet or a dropped picture · template + my text.
 *   1. lib/swap: promptFor, secs, ceiling, shortSide, jobParams, castPictures;
 *   2. the wiring: core WORKER_FOR.swap, routes/swap.js mounted from
 *      routes/index.js (never server.js), the workflow shipped;
 *   3. the prompt docker's Swap mode + the video docker's ⇄ (static pins +
 *      a jsdom pass of submitSwap's FormData). */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log("PASS: " + name); }
  else { fail++; console.log("FAIL: " + name + (extra !== undefined ? " :: " + JSON.stringify(extra) : "")); }
}
const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const SW = require(path.join(ROOT, "lib", "swap"));

// ---- 1. lib/swap
check("promptFor: blank = the workflow's own swap instructions, with H3's <Picture 1> tag (2.334.0 - never <Image 1>)",
  SW.promptFor("") === SW.TEMPLATE && SW.TEMPLATE.startsWith("Replace the subject in <Video 1> with the character in <Picture 1>.")
  && !/<Image \d>/.test(SW.TEMPLATE) && (SW.TEMPLATE.match(/<Picture 1>/g) || []).length >= 3
  && SW.TEMPLATE.includes("continuous single-take motion without structural alterations."));
check("the prompt docker's Swap-mode picture tag is <Picture 1> (clicking the picture inserted <Image 1> before 2.334.0)",
  read("static", "index.html").includes('mode === "swap" ? "<Picture 1>"') && !read("static", "index.html").includes('mode === "swap" ? "<Image 1>"'));
check("fixTags / promptFor: the user's <Image 1> becomes <Picture 1>",
  SW.fixTags("give <Image 1> a hat, < image 2 >") === "give <Picture 1> a hat, <Picture 2>"
  && SW.promptFor("<Image 1> waves").endsWith("Additional direction: <Picture 1> waves"));
const pf = SW.promptFor("  she smiles at the end  ");
check("promptFor: the user's text is EXTRA direction after the template (never replaces it)",
  pf.startsWith(SW.TEMPLATE) && pf.endsWith("Additional direction: she smiles at the end"), pf.slice(-80));
check("promptFor: capped", SW.promptFor("x".repeat(5000)).length <= SW.TEMPLATE.length + 40 + SW.MAX_TEXT);
check("secs: blank / junk / negative = null; numbers rounded to ms",
  SW.secs("") === null && SW.secs(undefined) === null && SW.secs("abc") === null && SW.secs(-1) === null
  && SW.secs("2.34567") === 2.346 && SW.secs(0) === 0);
check("ceiling: 362 by default; a learned VRAM ceiling snaps DOWN to 17k+5; below 107 is ignored",
  SW.ceiling({}) === 362 && SW.ceiling({ engine: { comfy: { vram_ceiling: 200 } } }) === 192
  && SW.ceiling({ engine: { comfy: { vram_ceiling: 60 } } }) === 362
  && SW.ceiling({ engine: { comfy: { vram_ceiling: 900 } } }) === 362);
check("shortSide: the size's short side, 16-aligned, 256..1440; blank = 544",
  SW.shortSide(960, 544) === 544 && SW.shortSide(544, 960) === 544 && SW.shortSide(1920, 1080) === 1088
  && SW.shortSide("", "") === 544 && SW.shortSide(100, 100) === 256);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "swap-"));
try {
  const wf = path.join(tmp, "wf.json"), vid = path.join(tmp, "take.mp4"), pic = path.join(tmp, "hero.png");
  fs.writeFileSync(wf, "{}"); fs.writeFileSync(vid, "v"); fs.writeFileSync(pic, "p");
  const ok = SW.jobParams({ workflow: wf, video: vid, image: pic, text: "look left", start: "1.5", dur: "4",
                            width: 960, height: 544, seed: "12", cfg: {}, scene: { n: 3, swap: true } });
  check("jobParams: a swap job (mode, files, the built prompt, the window, size, ceiling, seed, scene)",
    ok.mode === "swap" && ok.video === vid && ok.image === pic && ok.prompt.endsWith("look left")
    && ok.start === 1.5 && ok.dur === 4 && ok.short_side === 544 && ok.ceiling === 362 && ok.seed === 12
    && ok.scene.n === 3 && ok.format === "mp4", ok);
  const bl = SW.jobParams({ workflow: wf, video: vid, image: pic });
  check("jobParams: blank start = 0, blank duration = null (to the end), seed -1",
    bl.start === 0 && bl.dur === null && bl.seed === -1, bl);
  check("jobParams: quality full by default (2.336.0 - turbo off, 20 steps); fast / best on request; junk = full",
    bl.quality === "full" && SW.jobParams({ workflow: wf, video: vid, image: pic, quality: "fast" }).quality === "fast"
    && SW.jobParams({ workflow: wf, video: vid, image: pic, quality: "best" }).quality === "best"
    && SW.jobParams({ workflow: wf, video: vid, image: pic, quality: "ultra" }).quality === "full"
    && SW.QUALITIES.map((q) => q.id).join() === "fast,full,best");
  check("jobParams: the picture at ref_image_size max + the swap LoRA on by default (2.334.0); match / off on request",
    bl.ref_image_size === "max" && bl.swap_lora === true
    && SW.jobParams({ workflow: wf, video: vid, image: pic, ref_image_size: "match", swap_lora: false }).ref_image_size === "match"
    && SW.jobParams({ workflow: wf, video: vid, image: pic, swap_lora: false }).swap_lora === false
    && SW.jobParams({ workflow: wf, video: vid, image: pic, ref_image_size: "huge" }).ref_image_size === "max", bl);
  check("jobParams: refusals in words (workflow missing / not a video / no picture / file gone)",
    /workflows zip/.test(SW.jobParams({ workflow: path.join(tmp, "nope.json"), video: vid, image: pic }).error)
    && /reference VIDEO/.test(SW.jobParams({ workflow: wf, video: pic, image: pic }).error)
    && /PICTURE/.test(SW.jobParams({ workflow: wf, video: vid, image: vid }).error)
    && /is gone/.test(SW.jobParams({ workflow: wf, video: path.join(tmp, "x.mp4"), image: pic }).error));
  check("summary: names the files, the window and the kept audio",
    /hero\.png into take\.mp4 \(1\.5s \+ 4s/.test(SW.summary(ok)) && /original audio is kept/.test(SW.summary(ok)));
  const fakeChars = {
    cast: () => [{ name: "Anna", images: ["a.png"] }, { name: "Ghost", images: [] }],
    referenceImage: (c) => (c.images || [])[0] || null,
    tagOf: (t) => String(t).toLowerCase(),
    charDir: (n) => path.join(tmp, n),
  };
  const cp = SW.castPictures(fakeChars, "p");
  check("castPictures: every cast member WITH a sheet (a sheetless one is left out)",
    cp.length === 1 && cp[0].name === "Anna" && cp[0].tag === "anna" && cp[0].path === path.join(tmp, "Anna", "a.png"), cp);
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }

// ---- 2. the wiring
const core = read("lib", "core.js");
check("core: mode swap runs swap_worker.py (its own worker, WORKER_FOR)", /swap: "swap_worker\.py"/.test(core));
check("routes/index.js mounts routes/swap.js; server.js is untouched",
  /require\("\.\/swap"\)\.mount\(app\)/.test(read("routes", "index.js")) && !/swap/.test(read("misc/server.js")));
const rs = read("routes", "swap.js");
check("routes/swap.js: GET /api/swap/cast, POST /api/swap, POST /api/scenes/:n/swap",
  rs.includes('app.get("/api/swap/cast"') && rs.includes('app.post("/api/swap"')
  && rs.includes('app.post("/api/scenes/:n/swap"'));
check("routes/swap.js: the scene's result is its NEXT take (scenes.starting -> syncJobs harvests it)",
  /scenes\.starting\(/.test(rs) && /r\.upscaled \|\| r\.output/.test(rs));
const wfj = JSON.parse(read("comfy_workflows", "MiniMax_H3_Swap.json"));
const cls = Object.values(wfj).map((v) => v.class_type);
check("the workflow ships as API json (+ Tim's UI export beside it)",
  cls.includes("MiniMaxH3ReferenceToVideo") && cls.includes("VHS_LoadVideo") && cls.includes("LoadImage")
  && fs.existsSync(path.join(ROOT, "comfy_workflows", "MiniMax_H3_Swap.ui.json")));
check("swap_worker.py: cuts, patches, renders, puts the original audio back",
  /SG\.trim_args/.test(read("misc/swap_worker.py")) && /SG\.patch/.test(read("misc/swap_worker.py"))
  && /SG\.mux_args/.test(read("misc/swap_worker.py")));

// ---- 2b. the mmh3_chr_swap STYLE (2.328.0, Tim: "is there a style for this
// workflow, if not can you make one mmh3_chr_swap")
const ST = require(path.join(ROOT, "lib", "styles"));
const starter = ST.STARTER_STYLES.find((x) => x.name === "mmh3_chr_swap");
check("styles: mmh3_chr_swap is a starter video style on the swap workflow (no model/te/vae - the graph's loaders)",
  starter && starter.kind === "video" && starter.arch === "minimax-h3" && starter.role === "swap"
  && starter.workflows.ref2va === "comfy_workflows/MiniMax_H3_Swap.json" && !starter.te && !starter.vae
  && ST.normalize(starter, null).role === "swap" && ST.normalize({ kind: "video", name: "x", role: "junk" }, null).role === ""
  && SW.STYLE_NAME === "mmh3_chr_swap");
check("isSwapGraph: the H3 reference node + a picture + a video loader (t2va is not; ref2va has the same classes - hence role)",
  SW.isSwapGraph(wfj) && !SW.isSwapGraph(JSON.parse(read("comfy_workflows", "t2va.json"))) && !SW.isSwapGraph(null));
{
  const norm = ST.normalize(starter, null);
  const plain = ST.normalize({ name: "Plain", kind: "video", arch: "minimax-h3", workflow: "comfy_workflows/ref2va.json" }, null);
  const other = ST.normalize({ name: "My swap", kind: "video", arch: "minimax-h3",
                               workflow: "comfy_workflows/MiniMax_H3_Swap.json" }, null);
  const faked = ST.normalize({ name: "Fake", kind: "video", arch: "minimax-h3", role: "swap",
                               workflow: "comfy_workflows/t2va.json" }, null);
  check("isSwapStyle: role swap (or naming MiniMax_H3_Swap.json) AND a swap graph; plain ref2va / a non-swap graph / a missing file are not",
    SW.isSwapStyle(norm, ROOT) && SW.isSwapStyle(other, ROOT) && !SW.isSwapStyle(plain, ROOT) && !SW.isSwapStyle(faked, ROOT)
    && !SW.isSwapStyle({ ...norm, workflows: { ref2va: "comfy_workflows/nope.json" } }, ROOT)
    && !SW.isSwapStyle({ ...norm, kind: "image" }, ROOT));
  const list = [plain, norm, other];
  const a = SW.resolveStyle(list, other.id, ROOT), b = SW.resolveStyle(list, plain.id, ROOT),
        c = SW.resolveStyle(list, "", ROOT), d = SW.resolveStyle([plain], plain.id, ROOT);
  check("resolveStyle: the picked swap style; a non-swap pick or none -> mmh3_chr_swap; none left -> the built-in workflow",
    a.style.name === "My swap" && b.style.name === "mmh3_chr_swap" && /not a swap style/.test(b.note)
    && c.style.name === "mmh3_chr_swap" && d.style === null
    && d.workflow === path.join(ROOT, "comfy_workflows", "MiniMax_H3_Swap.json")
    && a.workflow === path.join(ROOT, "comfy_workflows", "MiniMax_H3_Swap.json"), [a.note, b.note, c.note, d.note]);
  const jp = SW.jobParams({ workflow: c.workflow, style: c.style, video: path.join(ROOT, "comfy_workflows", "MiniMax_H3_Swap.json").replace(/\.json$/, ".mp4"), image: "x.png" });
  const tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), "swapst-"));
  try {
    const v = path.join(tmp2, "t.mp4"), pc = path.join(tmp2, "p.png");
    fs.writeFileSync(v, "v"); fs.writeFileSync(pc, "p");
    const j2 = SW.jobParams({ workflow: c.workflow, style: c.style, video: v, image: pc });
    check("jobParams: the style rides the job (video_style / id / name) and the summary names it",
      j2.video_style && j2.video_style.name === "mmh3_chr_swap" && j2.video_style_name === "mmh3_chr_swap"
      && /style mmh3_chr_swap/.test(SW.summary(j2)) && jp.error !== undefined);
  } finally { fs.rmSync(tmp2, { recursive: true, force: true }); }
}
const ri = read("routes", "index.js");
check("routes: both swap routes pick the style (resolveStyle); /api/styles lists swap_styles; /api/generate refuses a swap style",
  (rs.match(/const ps = pickStyle\(b\.video_style_id\);/g) || []).length === 2 && /swap\.resolveStyle\(/.test(rs)
  && /swap_styles: Object\.fromEntries/.test(ri) && /is a character-swap style - it only runs in Swap mode/.test(ri));
check("swap_worker.py: the style's overrides through worker.py's apply_video_style + apply_video_accel",
  /_W\.apply_video_style\(graph, style\)/.test(read("misc/swap_worker.py")) && /_W\.apply_video_accel\(/.test(read("misc/swap_worker.py"))
  && /apply_style\(graph, params\.get\("video_style"\)\)/.test(read("misc/swap_worker.py")));

// ---- 3. the UI
const html = read("static", "index.html");
check("prompt docker: a Swap mode button beside Ref / F/L / Text, CAP.swap = 1, its hint",
  /<button data-mode="swap"[^>]*>Swap<\/button>/.test(html) && /const CAP = \{ ref2va: 10, fl2va: 2, t2va: 0, swap: 1 \};/.test(html)   // 2.340.0: the tray holds 10 (qwen2_1)
  && /swap: "Character swap:/.test(html));
check("prompt docker: picking a swap style switches to Swap mode; Swap sends the picked style",
  /if \(st && st\.swap && mode !== "swap"\)/.test(html) && /st\.swap = !!\(\(vj\.swap_styles/.test(html)
  && /async function submitSwap[\s\S]{0,1500}fd\.append\("video_style_id"/.test(html)
  && /<select id="s_vsrole"><option value="">Normal renders<\/option><option value="swap">Character swap<\/option>/.test(html)
  && /role: \$\("s_vsrole"\)/.test(html));
check("prompt docker: the Swap row (from / length) shows only in Swap mode",
  html.includes('id="swapRow"') && html.includes('$("swapRow").classList.toggle("hidden", mode !== "swap")'));
check("prompt docker: Generate routes Swap mode to submitSwap (no <Picture n> mapping), and an empty box is allowed",
  html.includes(': mode === "swap" ? await submitSwap(text)') && html.includes("? SWAP_NO_TEXT : $(\"prompt\").value;"));
const vh = read("ext", "videodock", "dock.html"), vj = read("ext", "videodock", "characters.js");
check("video docker: ⇄ on the take bar + the swap dialog (cast sheets / a picture / from / length / direction)",
  vh.includes('id="scSwap"') && vh.includes('id="scSwapDlg"') && vh.includes('id="scSwapFile"')
  && vh.includes('id="scSwapStart"') && vh.includes('id="scSwapDur"') && vh.includes('id="scSwapText"'));
check("video docker: the dialog reads /api/swap/cast and posts /api/scenes/:n/swap",
  vj.includes('fetch("/api/swap/cast")') && vj.includes('fetch("/api/scenes/" + n + "/swap"'));

// jsdom: submitSwap sends the tray picture + the FIRST reference video
(async () => {
  let JSDOM;
  try { ({ JSDOM } = require("jsdom")); } catch { console.log("(jsdom missing - the FormData pass is skipped)"); return; }
  const src = html.match(/const SWAP_NO_TEXT[\s\S]*?window\.submitSwap = submitSwap;/);
  check("submitSwap: found in the page", !!src);
  if (!src) return;
  const dom = new JSDOM(`<input id="swapStart" value="2"><input id="swapDur" value="3.5">
    <input id="width" value="960"><input id="height" value="544"><input id="seed" value="-1">`,
    { runScripts: "outside-only" });
  const w = dom.window;
  const sent = [];
  w.$ = (id) => w.document.getElementById(id);
  w.refs = [{ file: new w.File(["x"], "hero.png", { type: "image/png" }) }];
  w.refVids = ["clip.mp4", "other.mp4"];
  w.ensureComfyReady = async () => true;
  w.alert = (m) => sent.push({ alert: m });
  w.logLine = () => {}; w.refreshJobs = async () => {}; w.selectJob = () => {};
  w.fetch = async (url, o) => { sent.push({ url, fd: o.body }); return { ok: true, json: async () => ({ id: "j1", note: "n" }) }; };
  w.eval("var refs = window.refs, refVids = window.refVids;" + src[0]);
  const id = await w.submitSwap("[swap]");
  const post = sent.find((x) => x.url);
  const fd = post && post.fd;
  check("submitSwap: POST /api/swap with the picture, the FIRST video, the window, no direction for the bare line",
    id === "j1" && post.url === "/api/swap" && fd.get("video") === "clip.mp4" && fd.get("image").name === "hero.png"
    && fd.get("start") === "2" && fd.get("dur") === "3.5" && fd.get("prompt") === "" && fd.get("width") === "960",
    post && [...fd.keys()]);
  w.eval("refs.length = 0;");
  const none = await w.submitSwap("x");
  check("submitSwap: no picture = refused in words, nothing posted",
    none === null && sent.some((x) => x.alert && /ONE picture/.test(x.alert)) && sent.filter((x) => x.url).length === 1);
})().then(() => {
  console.log(`RESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
});
