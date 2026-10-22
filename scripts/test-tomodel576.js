#!/usr/bin/env node
/* bitGen Studio — 2.576.0 units: 🔄 Sync finds a Civitai model by its SHA-256 when its name does not (lib/modelInfo
 * fetchOne), the status bar says "reading n%" meanwhile (static/civitaisync.js), the viewer's 🧩 To model… + Ctrl+↓
 * (static/tomodel.js sourceOf / modelOfUrl / rank), a Civitai example as the thumbnail (routes/modelMgr.js) and the
 * model manager's Ctrl+↓.
 * Tim: "a lot of my models are not found on civitai during sync, but i downloaded most from civitai. in the viewer add a
 * button to send music/video/image to modelinfo - copy the media to the folder model info images are saved and add the
 * thumbnail to model info images. when user clicks on an image and presses ctrl+ the down arrow to make this the primary
 * thumbnail for the model" */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };

(async () => {
  /* 1 the sync by SHA-256 */
  const MI = require(path.join(ROOT, "lib", "modelInfo.js")), CV = require(path.join(ROOT, "lib", "civitai.js"));
  const api0 = CV.api, asked = [];
  const card = { kind: "model", cat: "checkpoints", name: "e2e576_renamed.safetensors", file: "e2e576_renamed.safetensors", size: 10, key: "checkpoints|e2e576_renamed.safetensors" };
  const dir = MI.dirFor(card);
  try {
    fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    // an earlier sync read its SHA-256 (kept in info.json) but only asked by name
    fs.writeFileSync(path.join(dir, "info.json"), JSON.stringify({ v: 1, file: card.file, size: 10, cat: "checkpoints", status: "nomatch", query: "e2e576 renamed", fetched_at: Date.now(), sha256: "abc123" }));
    CV.api = async (u) => {
      asked.push(u);
      if (/^\/models\?|^\/models$/.test(u)) return { items: [] };
      if (/by-hash\/ABC123/.test(u)) return { id: 576, modelId: 5760, name: "v1", baseModel: "SDXL 1.0", images: [], files: [] };
      if (/^\/models\/5760/.test(u)) return { id: 5760, name: "E2E Real Name", type: "Checkpoint", description: "found by its content" };
      const e = new Error("404"); e.status = 404; throw e;
    };
    const r = await MI.fetchOne(card);
    const info = JSON.parse(fs.readFileSync(path.join(dir, "info.json"), "utf8"));
    check("a model its NAME does not find: Civitai asked by its SHA-256 (exact) -> found, match \"hash\", the SHA-256 kept",
      r === "found" && info.status === "found" && info.match === "hash" && info.sha256 === "abc123" && asked.some((u) => /by-hash\/ABC123/.test(u)) && asked.some((u) => /^\/models/.test(u)), { r, info, asked });
    fs.writeFileSync(path.join(dir, "info.json"), JSON.stringify({ v: 1, file: card.file, size: 10, status: "nomatch", sha256: "fff999" }));
    asked.length = 0;
    const r2 = await MI.fetchOne(card);
    const i2 = JSON.parse(fs.readFileSync(path.join(dir, "info.json"), "utf8"));
    check("...not on Civitai by its content either: \"no match\" marked hashed (the next sync does not read it again)", r2 === "nomatch" && i2.hashed === true && i2.sha256 === "fff999", i2);
  } finally { CV.api = api0; fs.rmSync(dir, { recursive: true, force: true }); }
  const MS = rd("lib", "modelInfo.js");
  check("the sync queue asks again every \"no match\" that was only searched by name; the file is read (hashFn / civitai.sha256) when its SHA-256 is unknown; status() says what it reads",
    /o\.sync && i\.status === "nomatch" && !i\.hashed/.test(MS) && /await \(hashFn \|\| cv\.sha256\)\(abs/.test(MS) && /hashing: Q\.hash \?/.test(MS));
  const CS = require(path.join(ROOT, "static", "civitaisync.js"));
  const t = CS.text({ running: true, done: 3, total: 9, current: "big.safetensors", hashing: { file: "big.safetensors", got: 45, total: 100 } });
  check("status bar while it reads a file: \"🔄 Civitai 3/9 · reading 45%\" (the tooltip says why)", t.txt === "🔄 Civitai 3/9 · reading 45%" && /SHA-256/.test(t.tip), t);

  /* 2 the viewer's 🧩 To model… / Ctrl+↓ */
  const T = require(path.join(ROOT, "static", "tomodel.js"));
  check("sourceOf: the gallery (/outputs/…) and Assets (/passets/<kind>/…) by name; anything else is uploaded",
    JSON.stringify(T.sourceOf("/outputs/a%20b.png?v=3")) === '{"src":"output","name":"a b.png"}' && JSON.stringify(T.sourceOf("http://127.0.0.1:8311/passets/video/c.mp4")) === '{"src":"video","name":"c.mp4"}'
    && T.sourceOf("blob:http://x/123") === null && T.sourceOf("/api/modelmgr/media/file?key=a&id=b") === null);
  check("modelOfUrl: a model's own file / a Civitai example -> its key + id / n",
    JSON.stringify(T.modelOfUrl("/api/modelmgr/media/file?key=checkpoints%7Cx.safetensors&id=k1")) === '{"key":"checkpoints|x.safetensors","item":"k1"}'
    && JSON.stringify(T.modelOfUrl("/api/modelmgr/example?key=loras%7Cy.safetensors&n=2&v=9")) === '{"key":"loras|y.safetensors","example":"2"}' && T.modelOfUrl("/outputs/a.png") === null);
  const cards = [{ key: "a", title: "Alpha", file: "alpha.safetensors" }, { key: "b", title: "Juggernaut XL", file: "juggernautXL_v9.safetensors" }, { key: "c", title: "Pony", file: "pony.safetensors" }];
  check("rank: the model the file was made with first; the search filters", T.rank(cards, "SDXL/juggernautXL_v9.safetensors", "")[0].key === "b" && T.rank(cards, "", "pony").map((c) => c.key).join() === "c");
  const TM = rd("static", "tomodel.js"), IX = rd("static", "index.html");
  check("the viewer: 🧩 To model… after ↗ Open; Ctrl+↓ (capture) - a model's picture -> thumbnail at once, any other picture -> the picker with the thumbnail box ticked; copies via /api/modelmgr/media",
    /id = "lb_tomodel"/.test(TM) && /e\.key === "ArrowDown"/.test(TM) && /mk \? thumbFromModel\(mk\) : open\(it, true\)/.test(TM) && /\/api\/modelmgr\/media/.test(TM) && /tomodel\.js/.test(IX));
  const RM = rd("routes", "modelMgr.js"), MM = rd("static", "modelmgr.js");
  check("routes: POST /api/modelmgr/thumb {key, example: n} - a Civitai example as the thumbnail", /b\.example != null && b\.example !== ""/.test(RM) && /MI\.examplePath\(c, b\.example\)/.test(RM));
  check("the model manager's info page: a click picks (S.lastPick), Ctrl+↓ makes that picture / example the thumbnail; H3ModelMgr.reloadKeep",
    /S\.mSel = i; S\.lastPick = "media"/.test(MM) && /S\.exSel = n; S\.lastPick = "ex"/.test(MM) && /e\.key !== "ArrowDown"/.test(MM) && /reloadKeep: function \(key\)/.test(MM));

  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
