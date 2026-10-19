#!/usr/bin/env node
/* bitGen Studio — 2.520.0 units: THE THREE RECOMMENDATIONS
 *   (1) Settings -> Models -> 🖥 This computer & package (static/hwpanel.js, GET /api/setup/packages, POST /api/setup/answers)
 *   (2) ⬆ Upgrade to a bigger package without running setup again (POST /api/setup/upgrade)
 *   (3) grouped model downloads - a group's own checkbox (electron/installer.html's models page, static/modelsdlg.js)
 * Tim (verbatim): "go with all 3 of your reccomendations"
 * The installer's models page runs in jsdom with a stand-in h3setup bridge. */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, cond, got) => { if (cond) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 800))); } };
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const HP = require("../static/hwpanel.js"), H = require("../lib/hwPlan.js"), G = require("../lib/setupGpu.js");
const CAT = JSON.parse(read("lib", "modelCatalog.json"));

(async () => {
  /* ---- (1) the panel's pure parts */
  check("canUpgrade: only to a bigger package; Editor is no upgrade; nothing recorded counts as Editor",
    HP.canUpgrade("editor", "light") && HP.canUpgrade("light", "full") && !HP.canUpgrade("full", "standard") && !HP.canUpgrade("standard", "standard") && !HP.canUpgrade("", "editor") && HP.canUpgrade("", "standard"));
  check("the panel's order is hwPlan's", JSON.stringify(H.ORDER) === JSON.stringify(["editor", "light", "standard", "full"]), H.ORDER);
  const p12 = G.profile([{ name: "NVIDIA GeForce RTX 3060", vram_gb: 12, vendor: "nvidia" }], 32 * 1073741824, "win32", { cpu: { model: "Ryzen 5", cores: 6 } });
  const plan = H.plan(p12, CAT, {});
  const k = plan.packages.find((x) => x.id === "standard");
  const html = HP.rowsHtml(k.rows);
  check("rowsHtml: a row a capability with ✓ / ~ / ✗, a heading a group", (html.match(/class="hwrow"/g) || []).length === k.rows.length && /✓/.test(html) && /<div style="margin:6px 0 2px;color:var\(--tiger\)/.test(html), html.slice(0, 300));
  check("rowsHtml: 'in it' / 'add later' / why", /in it/.test(html) && (/add later/.test(html) === k.rows.some((r) => !r.included && r.later)) && k.rows.filter((r) => r.why).every((r) => html.includes(r.why.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"))));
  check("rowsHtml escapes", !/<script>/.test(HP.rowsHtml([{ id: "x", group: "g", label: "<script>", state: "yes" }])));

  /* ---- the setup routes (pins: they need the app's settings) */
  const R = read("routes", "setup.js");
  check("GET /api/setup/packages: the plan for the answers (the query's or the saved ones) + installed + the card list",
    /app\.get\("\/api\/setup\/packages"/.test(R) && /installed: \(\(cfg\.setup \|\| \{\}\)\.package\) \|\| \(comfyDir \? "full" : ""\)/.test(R) && /gpu_list: require\("\.\.\/lib\/hwPlan"\)\.GPUS/.test(R));
  check("POST /api/setup/answers keeps the hardware answers in custom.settings (setup.answers)", /app\.post\("\/api\/setup\/answers"/.test(R) && /cfg\.setup = Object\.assign\(\{\}, cfg\.setup \|\| \{\}, \{ answers:/.test(R));
  check("POST /api/setup/upgrade: a real package (not Editor), not while busy; your ComfyUI (existing) or a new one; then the package's ticked models; the package recorded",
    /if \(!Hw\.ORDER\.includes\(b\.package\) \|\| b\.package === "editor"\) return res\.status\(400\)/.test(R) && /if \(state\.busy\) return res\.status\(409\)/.test(R)
    && /comfy: abs \? \{ mode: "existing", dir: abs \} : \{ mode: "new"/.test(R) && /m\.rows\.filter\(\(x\) => x\.ticked\)/.test(R) && /\{ package: b\.package \}\); C\.setConfig\(c2\)/.test(R));
  check("/api/config keeps setup (the answers saved from the panel survive a Settings save)", /"civitai", "queue", "setup"\]/.test(read("routes", "index.js")));
  const HTML = read("static", "index.html");
  check("Settings -> Models starts with the panel; the page loads static/hwpanel.js", /id="stab-models"[^>]*>\s*(<!--[^>]*-->\s*)?<div id="hwPanel"><\/div>/.test(HTML) && /<script src="\/static\/hwpanel\.js/.test(HTML));

  /* ---- (3) grouped downloads: the installer's models page in jsdom */
  const { JSDOM } = require("jsdom");
  const IH = read("electron", "installer.html");
  const found = G.profile([{ name: "NVIDIA GeForce RTX 4090", vram_gb: 24, vendor: "nvidia" }], 64 * 1073741824, "win32", { cpu: { model: "Ryzen 9", cores: 16 } });
  const GROUPS = [{ id: "img", label: "Image" }, { id: "vid", label: "Video" }];
  const ROWS = [
    { id: "a", group: "img", label: "A", size: 2e9, available: true, present: false, ticked: true },
    { id: "b", group: "img", label: "B", size: 3e9, available: true, present: false, ticked: false },
    { id: "c", group: "img", label: "C", size: 1e9, available: true, present: true, ticked: false },
    { id: "d", group: "vid", label: "D", size: 5e9, available: true, present: false, ticked: true },
    { id: "e", group: "vid", label: "E", size: 4e9, available: false, present: false, ticked: false, why: "too big" },
  ];
  const calls = [];
  const DET = { platform: "win32", arch: "x64", gpu: found, plan: ["x"], recommended: [], python: "py", git: "git", ffmpeg: "", comfy: { configured: "", defaultDir: "C:\\bitGen\\comfy" },
    omnivoice: false, llama: false, done: false, gpu_list: H.GPUS, viggle: null };
  const api = {
    detect: async () => DET, browse: async () => "", inspect: async () => ({ ok: false, error: "x" }),
    packages: async (hw, o) => Object.assign(H.plan(found, CAT, o), { gpu: found }),
    install: async (pl) => { calls.push(["install", pl]); return { ok: true, steps: { python: { ok: true } }, warnings: [] }; },
    models: async () => ({ groups: GROUPS, rows: ROWS }),
    token: async () => ({ ok: false }), disk: async () => 1e12, download: async (ids) => { calls.push(["download", ids]); return { ok: true }; }, hfcli: async () => ({ found: false }),
    finish: async () => {}, skip: async () => {}, minimize: async () => {}, close: async () => {}, onEvent: () => {},
  };
  const tick = () => new Promise((r) => setTimeout(r, 40));
  const dom = new JSDOM(IH, { runScripts: "dangerously", pretendToBeVisual: true, beforeParse(w) { w.h3setup = api; } });
  await tick();
  const w = dom.window, $ = (id) => w.document.getElementById(id), D = w.document;
  $("hw_pick").value = "rtx4090"; await $("b_next").onclick(); await tick();
  const full = D.querySelector('#pkgs input[value="full"]'); if (full) { full.checked = true; full.onchange(); await tick(); }
  await $("b_install").onclick();
  for (let i = 0; i < 100 && !D.querySelector("#mlist input[data-grp]"); i++) await tick();
  const grp = (g) => D.querySelector(`#mlist input[data-grp="${g}"]`), item = (i) => D.querySelector(`#mlist input[data-id="${i}"]`);
  check("models page: a checkbox a group, before its models; each model knows its group", !!grp("img") && !!grp("vid") && item("a").dataset.in === "img" && item("d").dataset.in === "vid", $("mlist").innerHTML.slice(0, 400));
  const sz = (g) => grp(g).closest("label").textContent;
  check("the group's heading says how many to get and their size (downloaded / unavailable ones not counted)", /2 to get · 4\.7 GB/.test(sz("img")) && /1 to get · 4\.7 GB/.test(sz("vid")), [sz("img"), sz("vid")]);
  check("half ticked -> the group box is indeterminate; all ticked -> checked", grp("img").indeterminate === true && grp("img").checked === false && grp("vid").checked === true && grp("vid").indeterminate === false);
  grp("img").checked = true; grp("img").onchange(); await tick();
  check("tick Image: all its downloadable models tick (not the downloaded one)", item("a").checked && item("b").checked && !item("c").checked && grp("img").checked && !grp("img").indeterminate);
  grp("vid").checked = false; grp("vid").onchange(); await tick();
  check("untick Video: its models untick, the unavailable one stays off", !item("d").checked && !item("e").checked);
  check("the total follows (2 files, 5e9 bytes = 4.7 GB)", /^2 file\(s\), 4\.7 GB/.test($("mtot").textContent), $("mtot").textContent);
  item("d").checked = true; item("d").onchange(); await tick();
  check("ticking the only Video model by hand checks its group again", grp("vid").checked === true);
  await $("b_download").onclick(); await tick();
  const dl = calls.find((c) => c[0] === "download");
  check("Download sends only the models (never the group boxes)", dl && JSON.stringify(dl[1].slice().sort()) === JSON.stringify(["a", "b", "d"]), dl);
  w.close();

  /* ---- modelsdlg (Settings -> Model downloads) does the same */
  const MD = read("static", "modelsdlg.js");
  check("modelsdlg: group boxes (data-grp) tick their models (data-in), show the size, go indeterminate; the download picks data-id boxes only",
    /data-grp="' \+ esc\(g\.id\)/.test(MD) && /data-in="' \+ esc\(g\.id\)/.test(MD) && /g\.indeterminate = on > 0 && on < all\.length/.test(MD) && /data-grpsz/.test(MD) && !/input:checked"\)/.test(MD));

  console.log(`RESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
