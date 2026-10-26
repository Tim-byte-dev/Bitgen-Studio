#!/usr/bin/env node
/* bitGen Studio — scripts/test-vision595.js (2.595.0): Settings ▸ Add-ons ▸ WeVisOne-VL into the user's vision folder.
 * Tim: "can we add https://tencent.github.io/WeVisOne-VL/, add it to addons to dl, dl it to the llm vision folder set by
 * the user". lib/visionAddon.js (the folder: Settings ▸ LLM's vision folder, else <LLM folder>/vision; the dropdown; the
 * model + its projector into WeVisOne-VL-<size>/; only what is missing; remove), lib/addons.js (the card), and the
 * vision dropdown's own scan (lib/captioner.js) listing it with ITS projector. A fake download; a temp folder. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bg-vision595-"));
const core = require("../lib/core");
let CFG = {};
core.getConfig = () => CFG;
core.llmPaths = () => ({ dir: path.join(tmp, "llm") });
const V = require("../lib/visionAddon");
const C = require("../lib/captioner");

(async () => {
  try {
    check("the folder: <LLM folder>/vision when Settings ▸ LLM has no vision folder", V.visionDir() === path.join(tmp, "llm", "vision"));
    const mine = path.join(tmp, "My Vision");
    CFG = { captioner: { dir: '"' + mine + '\\"' } };
    fs.mkdirSync(mine, { recursive: true });
    check("the folder: the vision folder set in Settings ▸ LLM (its quotes / trailing slash cleaned, like the scan)", V.visionDir() === mine, V.visionDir());
    check("the dropdown: five, ★ 4B Q4_K_M the default; an unknown pick = the default", V.ITEMS.length === 5 && V.picked(["nope"]).id === "wv4_q4km" && V.picked(["wv2_q8"]).id === "wv2_q8"
      && V.ITEMS.every((i) => i.files.length === 2 && /mmproj-f16\.gguf$/.test(i.files[1].file) && /^mradermacher\/WeVisOne-VL-[24]B-GGUF$/.test(i.files[0].repo)));
    const got = [];
    const download = async (m, p) => { got.push({ repo: m.repo, file: m.file, to: p.app, dest: m.dest }); fs.writeFileSync(path.join(p.app, m.file), "gguf"); return { ok: true }; };
    const lines = [];
    const r = await V.install((l) => lines.push(l), ["wv4_q4km"], { download });
    check("install 4B Q4_K_M: the model + its projector from mradermacher/WeVisOne-VL-4B-GGUF into <vision folder>/WeVisOne-VL-4B", r.ok && got.length === 2
      && got.every((g) => g.to === path.join(mine, "WeVisOne-VL-4B") && g.repo === "mradermacher/WeVisOne-VL-4B-GGUF")
      && got[0].file === "WeVisOne-VL-4B.Q4_K_M.gguf" && got[1].file === "WeVisOne-VL-4B.mmproj-f16.gguf", got);
    check("it says where to pick it and that a recent llama.cpp is needed", lines.some((l) => /vision dropdown/.test(l)) && lines.some((l) => /recent llama\.cpp/.test(l)));
    got.length = 0;
    await V.install(() => {}, ["wv4_q8"], { download });
    check("4B Q8_0 next: only its model downloads (the projector is there)", got.length === 1 && got[0].file === "WeVisOne-VL-4B.Q8_0.gguf", got);
    await V.install(() => {}, ["wv2_q4km"], { download });
    const st = V.status();
    check("status: the three present, the note names them", st.installed && st.select && st.items.filter((i) => i.present).map((i) => i.id).join() === "wv4_q8,wv4_q4km,wv2_q4km".split(",").sort((a, b) => V.ITEMS.findIndex((x) => x.id === a) - V.ITEMS.findIndex((x) => x.id === b)).join() && /vision dropdown/.test(st.note), st);
    const sc = C.scan(core);
    const byName = (n) => sc.find((m) => m.name === n) || {};
    check("the vision dropdown's own scan lists them, each with ITS size's projector (2B with the 2B one)",
      byName("WeVisOne-VL-4B.Q4_K_M.gguf").mmproj === path.join(mine, "WeVisOne-VL-4B", "WeVisOne-VL-4B.mmproj-f16.gguf")
      && byName("WeVisOne-VL-4B.Q8_0.gguf").mmproj === path.join(mine, "WeVisOne-VL-4B", "WeVisOne-VL-4B.mmproj-f16.gguf")
      && byName("WeVisOne-VL-2B.Q4_K_M.gguf").mmproj === path.join(mine, "WeVisOne-VL-2B", "WeVisOne-VL-2B.mmproj-f16.gguf"), sc);
    const failDl = async () => ({ ok: false, error: "HTTP 404" });
    const rf = await V.install(() => {}, ["wv2_q8"], { download: failDl });
    check("a failed download says which file and why", !rf.ok && /WeVisOne-VL-2B\.Q8_0\.gguf: HTTP 404/.test(rf.error), rf);
    await V.remove(() => {}, ["wv4_q4km"]);
    check("remove 4B Q4_K_M: its model goes, the projector stays (Q8_0 still needs it)", !fs.existsSync(path.join(mine, "WeVisOne-VL-4B", "WeVisOne-VL-4B.Q4_K_M.gguf")) && fs.existsSync(path.join(mine, "WeVisOne-VL-4B", "WeVisOne-VL-4B.mmproj-f16.gguf")));
    await V.remove(() => {}, ["wv4_q8"]);
    check("remove the last 4B: the projector and the empty folder go too", !fs.existsSync(path.join(mine, "WeVisOne-VL-4B")));
    // the card
    const A = require("../lib/addons");
    const card = A.list().find((a) => a.id === "wevisone");
    check("Settings ▸ Add-ons: the WeVisOne-VL card - a dropdown (5), the links (the project page + both GGUF repos), installed (the 2B is there)",
      card && card.select && card.items.length === 5 && card.installed && card.links.length === 3 && card.links.some((l) => l.url === "https://huggingface.co/mradermacher/WeVisOne-VL-4B-GGUF") && /vision models folder/.test(card.for), card);
  } catch (e) { fail++; console.log("FAIL: crashed - " + (e && e.stack || e)); }
  finally { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* fine */ } }
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
})();
