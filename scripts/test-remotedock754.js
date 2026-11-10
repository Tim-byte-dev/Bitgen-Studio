#!/usr/bin/env node
/* bitGen Studio — 2.754.0 units: USE REMOTE GENERATION (lib/gpuSplit.js enabled) + POD SHORTCUTS (lib/podShortcuts.js) +
 * the Remote generation docker's wiring (routes/remoteDock.js, static/remotedock.js).
 * Tim (verbatim): "add a checkbox in the settings- remote geneation tab, to use remote generation, if checked show the gpu
 * menu item in basic settings if unchecked hide the gpu menu item ... i would like to add public pods to my account is it
 * possible to have a shortcut to them?" */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const P = require("../lib/podShortcuts");
check("templateId: a template's page link, a deploy link, a bare ID; nothing else", P.templateId("https://www.runpod.io/console/explore/57we0zdwtt") === "57we0zdwtt"
  && P.templateId("https://runpod.io/console/deploy?template=bzhe0deyqj&ref=2vdt3dn9") === "bzhe0deyqj" && P.templateId(" 57we0zdwtt ") === "57we0zdwtt"
  && P.templateId("https://example.com/x") === "" && P.templateId("hello world") === "" && P.templateId("") === "");
check("deployUrl: RunPod's deploy page with the template + bitGen's referral code; pageUrl: the template's page", P.deployUrl("57we0zdwtt") === "https://runpod.io/console/deploy?template=57we0zdwtt&ref=gbj9zxqh"
  && P.pageUrl("57we0zdwtt") === "https://www.runpod.io/console/explore/57we0zdwtt" && P.REF === "gbj9zxqh");

(async () => {
  const G = require("../lib/gpuSplit");
  check("enabledOf: the saved choice; never saved = on when something remote is set up (an update keeps working), else off (a new install)",
    G.enabledOf({}) === false && G.enabledOf({ enabled: false, mode: "runpod" }) === false && G.enabledOf({ enabled: true }) === true && G.enabledOf({ mode: "serverless" }) === true
    && G.enabledOf({ split: { where: "both" } }) === true && G.enabledOf({ vllm: { endpoint: "e" } }) === true && G.enabledOf({ openrouter: { key: "k", model: "m" } }) === true && G.enabledOf({ openrouter: { key: "k" } }) === false);
  const core = require("../lib/core");
  let CFG = { engine: { comfy: { url: "http://comfy.here:8188" } }, rgpu: { mode: "local", split: { where: "local" }, pod_shortcuts: [] } };
  const gc = core.getConfig, sc = core.setConfig;
  core.getConfig = () => CFG; core.setConfig = (c) => { CFG = c; };
  try {
    // shortcuts
    let l = P.change({ add: { name: "MiniMax H3", link: "https://www.runpod.io/console/explore/57we0zdwtt" } });
    l = P.change({ add: { name: "MiniMax H3 again", link: "57we0zdwtt" } });
    check("shortcuts: added from a link, kept in rgpu.pod_shortcuts; the same template again replaces it (no twin)", l.length === 1 && l[0].name === "MiniMax H3 again" && l[0].deploy === P.deployUrl("57we0zdwtt") && CFG.rgpu.pod_shortcuts.length === 1);
    let err = null; try { P.change({ add: { name: "x", link: "https://example.com" } }); } catch (e) { err = e; }
    check("…a link that is not a template: refused (400), saying where to copy it", err && err.status === 400 && /RunPod template link/.test(err.message));
    check("…removed", P.change({ remove: "57we0zdwtt" }).length === 0);
    // the switch
    delete CFG.rgpu.enabled;
    check("never chosen + nothing remote: off", G.enabled() === false && G.view().enabled === false);
    G.set({ where: "both", llm: true });
    check("…picking Both (never chosen) turns it on", CFG.rgpu.enabled === true && G.split().where === "both");
    CFG.rgpu.openrouter = { key: "sk", model: "m:free" }; CFG.rgpu.llm_provider = "openrouter";
    check("…on + Both + LLM ticked + OpenRouter: the LLM goes there", (await G.llmTarget("llm")) !== null);
    G.setEnabled(false);
    check("unticked: Local, the LLM here; Remote / Both refused, saying where to turn it on", G.split().where === "local" && (await G.llmTarget("llm")) === null
      && (() => { try { G.set({ where: "both" }); return false; } catch (e) { return e.status === 400 && /tick Use remote generation first/.test(e.message); } })());
    CFG.rgpu.split.where = "both"; CFG.rgpu.split.image = true;   // a hand-edited settings file
    const fj = G.forJob(CFG, { mode: "image" });
    check("…off wins whatever the settings say: a job renders here, no note", fj.gpu === null && fj.note === "" && fj.config.engine.comfy.url === "http://comfy.here:8188");
    G.setEnabled(null);
    check("…null = never chosen again (the tests put it back)", !("enabled" in CFG.rgpu));
  } finally { core.getConfig = gc; core.setConfig = sc; }

  const IDX = rd("routes", "index.js"), RD = rd("routes", "remoteDock.js"), HTML = rd("static", "index.html"), JS = rd("static", "remotedock.js"), RG = rd("lib", "remoteGpu.js");
  check("routes/remoteDock.js mounted from routes/index.js: GET /api/remotegen, POST /enabled, POST /shortcuts", /require\("\.\/remoteDock"\)\.mount\(app\)/.test(IDX) && /app\.get\("\/api\/remotegen"/.test(RD) && /\/api\/remotegen\/enabled/.test(RD) && /\/api\/remotegen\/shortcuts/.test(RD));
  check("the page loads static/remotedock.js; the docker is a SecFloat window (id rgen) with NO status-bar button; its toggle lives in Basic Settings ▸ GPU",
    HTML.indexOf("/static/remotedock.js") > HTML.indexOf("/static/openrouter.js") && /SecFloat\.add\(\{ id: "rgen", title: "Remote generation"/.test(JS) && !/statusbar/i.test(JS.replace(/no status-bar button|not in the\s+statusbar/gi, "")) && /\$\("sec-gpu"\)/.test(JS) && /id = "gpuDock"/.test(JS));
  check("the pod list honours H3_RUNPOD_REST_API (the tests' stand-in, never the real RunPod)", /process\.env\.H3_RUNPOD_REST_API \|\| RUNPOD_API/.test(RG));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
