#!/usr/bin/env node
/* bitGen Studio — 2.537.0 units: THE MODEL MANAGER FOR 400+ MODELS - pages, folder tabs, "used in this project", the card
 * size, and the shared model_info library (lib/modelInfo.js: Civitai details + thumbnail + examples per model).
 * Tim (verbatim): "paginate the models tab, i have over 400 models and it is trying to fit them all on one page. make the
 * card size resizable in edit mode, move cards to fit the space of the docker, add a model info page, download info and
 * thumbs and examples from civitai for each matching model name, keep them in model_info folder made available to all
 * projects. add a "used in this project" tab to models docker, add tabs for each folder...not checkpoints/sdxl, but just
 * SDXL etc. ... clicking the card will select the model to use, clicking on it's mouseover description will go to full
 * details of the model" */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, cond, got) => { if (cond) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 800))); } };
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const MI = require("../lib/modelInfo.js"), MC = require("../lib/modelCards.js"), MM = require("../static/modelmgr.js");

(async () => {
  /* ---- pages */
  const L = Array.from({ length: 412 }, (_, i) => i);
  const p0 = MM.pageOf(L, 0, 48), pl = MM.pageOf(L, 99, 48);
  check("pageOf: 412 cards at 48 a page = 9 pages; page 1 = 1-48; a page past the end = the last (385-412)", p0.pages === 9 && p0.items.length === 48 && p0.from === 1 && p0.to === 48 && pl.page === 8 && pl.from === 385 && pl.to === 412 && pl.items.length === 28, [p0.pages, pl]);
  check("…an empty list = one empty page", MM.pageOf([], 3, 24).pages === 1 && MM.pageOf([], 3, 24).items.length === 0);
  const a = MM.autoPer(760, 520, 138, 70, 6), b = MM.autoPer(760, 520, 260, 70, 6);
  check("autoPer: the cards that FIT the docker (columns of >= card width, rows of the stretched square + body)", a.cols === 5 && a.rows === 2 && a.per === 10 && b.cols === 2 && b.per === 2, [a, b]);
  check("…bigger docker = more cards a page; at least one column / row", MM.autoPer(1500, 1000, 138, 70).per > a.per && MM.autoPer(50, 20, 138, 70).per === 1);
  check("pagerModel: first, last, the current ±2 with … between", JSON.stringify(MM.pagerModel(10, 30)) === JSON.stringify([0, "…", 8, 9, 10, 11, 12, "…", 29]) && JSON.stringify(MM.pagerModel(0, 3)) === "[0,1,2]", MM.pagerModel(10, 30));

  /* ---- folder tabs */
  check("folderOf: checkpoints/SDXL/x -> SDXL (the folder INSIDE the category); a root file -> ''", MC.folderOf("SDXL/x.safetensors") === "SDXL" && MC.folderOf("SDXL\\sub\\x.safetensors") === "SDXL" && MC.folderOf("x.safetensors") === "");
  const tabs = MC.folderTabs([{ name: "SDXL/a" }, { name: "sdxl/b" }, { name: "Pony/c" }, { name: "d" }]);
  check("folderTabs: one tab per folder, case-insensitive, with counts, A-Z", JSON.stringify(tabs) === JSON.stringify([{ id: "pony", label: "Pony", count: 1 }, { id: "sdxl", label: "SDXL", count: 2 }]), tabs);
  check("inFolder: '' = all; a folder by name, any case", MM.inFolder({ folder: "SDXL" }, "") && MM.inFolder({ folder: "SDXL" }, "sdxl") && !MM.inFolder({ folder: "Pony" }, "sdxl") && !MM.inFolder({ folder: "" }, "sdxl"));

  /* ---- used in this project */
  const cards = [{ key: "checkpoints|SDXL/juggernaut.safetensors", file: "juggernaut.safetensors" }, { key: "loras|detail.safetensors", file: "detail.safetensors" }, { key: "checkpoints|other.safetensors", file: "other.safetensors" }];
  const jobs = [{ meta: { models: ["SDXL\\juggernaut.safetensors"], loras: [{ name: "detail.safetensors", strength: 0.8 }] } }, { meta: { models: [] } }, { params: { model: "nope.safetensors" } }];
  check("usedKeys: the cards a project's jobs rendered with (models + LoRAs, by file name, any folder / slash)", JSON.stringify(MC.usedKeys(cards, jobs)) === JSON.stringify(["checkpoints|SDXL/juggernaut.safetensors", "loras|detail.safetensors"]), MC.usedKeys(cards, jobs));

  /* ---- matching a file to Civitai */
  check("cleanQuery: the name words without versions / precisions / formats", MI.cleanQuery("juggernautXL_v9Rdphoto2Lightning.safetensors") === "juggernaut Rdphoto2" || MI.cleanQuery("juggernautXL_v9Rdphoto2Lightning.safetensors").startsWith("juggernaut"), MI.cleanQuery("juggernautXL_v9Rdphoto2Lightning.safetensors"));
  check("…ponyDiffusionV6XL -> pony diffusion; detail_tweaker_xl_v1.0 -> detail tweaker", /^pony diffusion/i.test(MI.cleanQuery("ponyDiffusionV6XL.safetensors")) && MI.cleanQuery("detail_tweaker_xl_v1.0.safetensors") === "detail tweaker", [MI.cleanQuery("ponyDiffusionV6XL.safetensors"), MI.cleanQuery("detail_tweaker_xl_v1.0.safetensors")]);
  const items = [
    { id: 1, name: "Juggernaut XL", modelVersions: [{ id: 11, name: "v9", files: [{ name: "juggernautXL_v9Rdphoto2Lightning.safetensors", sizeKB: 6938040 }] }, { id: 12, name: "v8", files: [{ name: "juggernautXL_v8Rundiffusion.safetensors", sizeKB: 6000000 }] }] },
    { id: 2, name: "Something else", modelVersions: [{ id: 21, files: [{ name: "other.safetensors", sizeKB: 100 }] }] }];
  const m1 = MI.matchVersion(items, "juggernautXL_v9Rdphoto2Lightning.safetensors", 0);
  check("matchVersion: the same FILE NAME (any case) -> that version", m1 && m1.version.id === 11 && m1.how === "file", m1 && [m1.version.id, m1.how]);
  const m2 = MI.matchVersion(items, "JuggernautXL_v8Rundiffusion.ckpt", 0);
  check("…the same stem (another extension) -> that version (how: stem)", m2 && m2.version.id === 12 && m2.how === "stem", m2 && m2.how);
  const m3 = MI.matchVersion(items, "my_juggernaut_copy.safetensors", 6938040 * 1024);
  check("…same size (0.5 %) + a shared word, only when it is the only one -> size", m3 && m3.version.id === 11 && m3.how === "size", m3 && m3.how);
  check("…nothing that close = NO match (a wrong page is worse than none)", MI.matchVersion(items, "totally_different.safetensors", 123) === null && MI.matchVersion([], "x", 1) === null);
  const ex = MI.examplesOf([{ url: "https://image.civitai.com/a/width=450/1.jpeg", type: "image", nsfwLevel: 1, width: 832, height: 1216, meta: { prompt: "a cat", negativePrompt: "blur", cfgScale: 5, steps: 30, sampler: "DPM++ 2M", seed: 42 } },
    { url: "https://image.civitai.com/b.mp4", type: "video" }, { url: "https://image.civitai.com/c.jpeg", type: "image", nsfwLevel: 8 }], false, 8);
  check("examplesOf: pictures + (2.581.0) videos, safe-for-work unless mature, with their prompt / negative / cfg / steps / sampler / seed", ex.length === 2 && ex[1].media === "video" && ex[0].media === "image" && ex[0].meta.prompt === "a cat" && ex[0].meta.cfg === 5 && ex[0].meta.seed === 42 && ex[0].meta.negative === "blur"
    && MI.examplesOf([{ url: "u", type: "image", nsfwLevel: 8 }], true).length === 1, ex);
  check("dirName / isStale: a safe folder name per file stem; a 'nomatch' is asked again after 30 days", MI.dirName("SDXL/juggernaut:x.safetensors") === "juggernaut_x" && MI.isStale({ status: "nomatch", fetched_at: 0 }, 31 * 864e5) && !MI.isStale({ status: "nomatch", fetched_at: 0 }, 5 * 864e5) && !MI.isStale({ status: "found", fetched_at: 0 }, 99 * 864e5));

  /* ---- fetchOne against a fake Civitai: the library folder */
  const cv = require("../lib/civitai.js"), ex2 = require("../lib/setupExec.js");
  const realApi = cv.api, realOpen = ex2.open, realCfg = cv.cfg;
  const PNG = Buffer.from("89504e470d0a1a0a0000000d4948445200000002000000020802000000fdd49a730000001649444154789c63f8cfc0f09f818181e1ff7f0606000037f005fd8a5a6fb10000000049454e44ae426082", "hex");
  const calls = [];
  cv.cfg = () => ({ token: "", site: "civitai.com", mature: false });
  cv.api = async (p, q) => {
    calls.push([p, q]);
    if (p === "/models") return { items: [{ id: 77, name: "E2E Mi Model", type: "Checkpoint", modelVersions: [{ id: 770, name: "v1", baseModel: "SDXL 1.0", trainedWords: ["e2etrig"], publishedAt: "2026-01-02T00:00:00Z", stats: { thumbsUpCount: 9, thumbsDownCount: 1 },
      files: [{ name: "e2e_mi537_model.safetensors", sizeKB: 1 }], images: [{ url: "https://image.civitai.com/x/width=450/1.png", type: "image", nsfwLevel: 1, meta: { prompt: "an e2e lighthouse", cfgScale: 4, steps: 25 } }, { url: "https://image.civitai.com/x/width=450/2.png", type: "image", nsfwLevel: 1 }] }] }] };
    if (p === "/models/77") return { id: 77, name: "E2E Mi Model", type: "Checkpoint", description: "<p>A test <b>model</b>.</p>", stats: {} };
    const e = new Error("404"); e.status = 404; throw e;
  };
  const { PassThrough } = require("stream");
  ex2.open = async () => { const r = new PassThrough(); setImmediate(() => r.end(PNG)); return { status: 200, headers: { "content-type": "image/png" }, res: r }; };
  const card = { key: "checkpoints|e2e_mi537_model.safetensors", kind: "model", cat: "checkpoints", name: "e2e_mi537_model.safetensors", file: "e2e_mi537_model.safetensors", size: 1024 };
  const dir = MI.dirFor(card);
  try {
    fs.rmSync(dir, { recursive: true, force: true });
    const r = await MI.fetchOne(card);
    const info = MI.infoFor(card);
    check("fetchOne: searched Civitai by the file's name (Checkpoint type), matched by file name -> found", r === "found" && calls[0][0] === "/models" && calls[0][1].types === "Checkpoint" && /e2e mi/i.test(calls[0][1].query) && info.match === "file", [r, calls[0], info && info.match]);
    check("…kept in <app>/model_info/models/<stem>/ - every project reads the same folder", dir === path.join(ROOT, "model_info", "models", "e2e_mi537_model") && fs.existsSync(path.join(dir, "info.json")), dir);
    check("…a thumbnail + the example pictures with their prompts + the version's details", info.thumb === "thumb.png" && fs.existsSync(path.join(dir, "thumb.png")) && info.examples.length === 2 && fs.existsSync(path.join(dir, "ex1.png"))
      && info.examples[0].meta.prompt === "an e2e lighthouse" && info.civitai.baseModel === "SDXL 1.0" && info.civitai.trainedWords[0] === "e2etrig" && /civitai\.com\/models\/77\?modelVersionId=770/.test(info.url), info);
    check("…thumbPath / examplePath only serve files inside its folder", MI.thumbPath(card) === path.join(dir, "thumb.png") && MI.examplePath(card, 1) === path.join(dir, "ex2.png") && MI.examplePath(card, 5) === null);
    check("…the info belongs to THIS file: another size (a different file with the same name) is not given it", MI.infoFor(Object.assign({}, card, { size: 999999 })) === null);
    const mc = MC.mergeInfo(info.civitai);
    check("modelCards reads it like a Civitai answer (title, base model, keywords, released, rating, description)", mc.base_model === "SDXL 1.0" && mc.keywords[0] === "e2etrig" && mc.released === "2026-01-02" && mc.rating === 4.5 && /A test model\./.test(mc.description) && /E2E Mi Model/.test(mc.title), mc);
    // no match
    calls.length = 0;
    const c2 = Object.assign({}, card, { key: "checkpoints|e2e_mi537_nothing.safetensors", name: "e2e_mi537_nothing.safetensors", file: "e2e_mi537_nothing.safetensors", size: 5555555 });
    fs.rmSync(MI.dirFor(c2), { recursive: true, force: true });
    const r2 = await MI.fetchOne(c2);
    check("a file Civitai's search has no match for -> 'nomatch' kept (asked again after 30 days, or ⟳ forced) - it asked with the shorter query too",
      r2 === "nomatch" && MI.readInfo(c2).status === "nomatch" && calls.filter((x) => x[0] === "/models").length >= 1, [r2, calls.map((x) => x[1] && x[1].query)]);
    fs.rmSync(MI.dirFor(c2), { recursive: true, force: true });
    // a LoRA
    const c3 = Object.assign({}, card, { kind: "lora", cat: "loras", key: "loras|e2e_mi537_model.safetensors" });
    calls.length = 0; await MI.fetchOne(c3);
    check("a LoRA is searched in LORA / LoCon / DoRA and kept under model_info/loras/", calls[0][1].types === "LORA,LoCon,DoRA" && MI.dirFor(c3).includes(path.join("model_info", "loras")), calls[0]);
    fs.rmSync(MI.dirFor(c3), { recursive: true, force: true });
  } finally {
    cv.api = realApi; ex2.open = realOpen; cv.cfg = realCfg;
    fs.rmSync(dir, { recursive: true, force: true });
  }

  /* ---- the wiring (source) */
  const mc = read("lib/modelCards.js"), rt = read("routes/modelMgr.js"), mm = read("static/modelmgr.js");
  check("modelCards: the library is a layer of the card (above other tools, below your sidecar), its thumb a fallback, info_status / examples / folder on the card",
    /library && library\.status === "found"/.test(mc) && /require\("\.\/modelInfo"\)\.thumbPath\(h\.card\)/.test(mc) && /card\.info_status =/.test(mc) && /card\.folder = folderOf\(f\.name\)/.test(mc));
  check("routes/modelMgr.js (not server.js): info, example, fetch (+ status / stop), used", ["/api/modelmgr/info", "/api/modelmgr/example", "/api/modelmgr/fetch", "/api/modelmgr/fetch/stop", "/api/modelmgr/used"].every((u) => rt.includes(u)) && !read("server.js").includes("modelmgr/fetch"));
  check("the docker: 📌 This project tab, folder tabs, a pager with 'auto (fit)', ⇲ Edit + a card corner grip + size slider, ⤓ Civitai info, the info page",
    /data-mmtab="used"/.test(mm) && /id="mmFolders"/.test(mm) && /auto \(fit\)/.test(mm) && /data-mmgrip/.test(mm) && /id="mmSize"/.test(mm) && /id="mmFetch"/.test(mm) && /function infoHtml\(\)/.test(mm));
  check("…the hover card is clickable (it stays while the pointer moves onto it) and opens the info page; a card click still selects",
    !/#mmHover\{[^}]*pointer-events:none/.test(mm) && /hv\.addEventListener\("click"/.test(mm) && /openInfo\(key\)/.test(mm) && /hideSoon\(\)/.test(mm) && /pick\(card\.dataset\.key\);/.test(mm));
  check("…a resize refits the page (ResizeObserver), the page keeps its first card", /new ResizeObserver\(onResize\)/.test(mm) && /S\.page = Math\.floor\(first \/ p\)/.test(mm));

  console.log(`\n${pass} passed, ${fail} failed`);
  console.log("RESULT: " + (fail ? "FAIL" : "PASS") + ` (${pass} passed, ${fail} failed)`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: the run finished\n      " + (e && e.stack || e)); console.log("RESULT: FAIL"); process.exit(1); });
