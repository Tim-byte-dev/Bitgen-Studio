#!/usr/bin/env node
/* bitGen Studio — 2.753.0 units: OPENROUTER FOR THE LLM + "REMOTE GENERATION".
 * Tim (verbatim): "lets add openrouter to remote gpu, maybe change remote gpu to remote generation?"
 *   lib/openRouter.js pure: headers (the key, the app's name + site), priceOf (per token -> per million), mapModel (text
 *   models only; free = ":free" or both prices 0; vision = takes images), listView (free first, filters), pickVision;
 *   the key is an encrypted one (lib/secrets.js PATHS); lib/gpuSplit.js routes the LLM to OpenRouter when it is the
 *   provider (llmReady / llmTarget, with a config in hand); the routes are mounted; the page loads static/openrouter.js and
 *   the tab says "Remote generation"; nothing in lib / routes / static still says "Settings ▸ Remote GPU". */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const O = require("../lib/openRouter");

(async () => {
  const h = O.headers("sk-or-1");
  check("headers: Bearer key, the app named (HTTP-Referer tigerart.com.au, X-OpenRouter-Title bitGen Studio)", h.Authorization === "Bearer sk-or-1" && h["HTTP-Referer"] === "https://tigerart.com.au" && h["X-OpenRouter-Title"] === "bitGen Studio", h);
  check("priceOf: OpenRouter's per-token string -> $ per million tokens; junk = NaN", O.priceOf("0.00000015") === 0.15 && O.priceOf("0") === 0 && Number.isNaN(O.priceOf("")));
  const raw = [
    { id: "zz/paid-vision", name: "Zz Paid Vision", context_length: 128000, pricing: { prompt: "0.000001", completion: "0.000002" }, architecture: { input_modalities: ["text", "image"], output_modalities: ["text"] } },
    { id: "aa/free-text:free", name: "Aa Free Text", context_length: 32000, pricing: { prompt: "0", completion: "0" }, architecture: { input_modalities: ["text"], output_modalities: ["text"] } },
    { id: "mm/free-vision:free", name: "Mm Free Vision", pricing: { prompt: "0", completion: "0" }, architecture: { input_modalities: ["image", "text"], output_modalities: ["text"] } },
    { id: "ii/image-maker", name: "Image Maker", pricing: { prompt: "0", completion: "0" }, architecture: { input_modalities: ["text"], output_modalities: ["image"] } },
    { id: "old/modality", name: "Old Style", pricing: { prompt: "0.0000005", completion: "0.0000005" }, architecture: { modality: "text+image->text" } },
  ];
  const m = O.mapModel(raw[0]);
  check("mapModel: id, name, ctx, prices per million, vision from input_modalities", m.id === "zz/paid-vision" && m.ctx === 128000 && m.in === 1 && m.out === 2 && m.vision && !m.free, m);
  check("…a picture-only model is left out (not an LLM); the old 'modality' string still read", O.mapModel(raw[3]) === null && O.mapModel(raw[4]).vision === true && O.mapModel(raw[4]).in === 0.5);
  const all = O.listView(raw), free = O.listView(raw, { freeOnly: true }), vis = O.listView(raw, { vision: true, freeOnly: true });
  check("listView: free first, then by name; Free models only; vision filter", all.map((x) => x.id).join() === "aa/free-text:free,mm/free-vision:free,old/modality,zz/paid-vision"
    && free.map((x) => x.id).join() === "aa/free-text:free,mm/free-vision:free" && vis.map((x) => x.id).join() === "mm/free-vision:free", all.map((x) => x.id));
  check("pickVision: the one picked for it; else the LLM's when it takes pictures; else none", O.pickVision({ model: "aa/free-text:free", vlm_model: "x/y" }, all) === "x/y"
    && O.pickVision({ model: "mm/free-vision:free" }, all) === "mm/free-vision:free" && O.pickVision({ model: "aa/free-text:free" }, all) === "");
  check("BASE: openrouter.ai/api/v1, or H3_OPENROUTER_API (the tests' stand-in)", (delete process.env.H3_OPENROUTER_API, O.BASE()) === "https://openrouter.ai/api/v1"
    && (process.env.H3_OPENROUTER_API = "http://stand.in:1/v1/", O.BASE()) === "http://stand.in:1/v1");
  check("the key is kept encrypted with the others (lib/secrets.js PATHS rgpu.openrouter.key)", require("../lib/secrets").PATHS.includes("rgpu.openrouter.key"));

  // lib/gpuSplit.js with a config in hand (core stubbed)
  const core = require("../lib/core");
  let CFG = { rgpu: { mode: "local", split: { where: "both", llm: true, vlm: true }, openrouter: { key: "sk-or-T", model: "mm/free-vision:free" }, llm_provider: "openrouter" } };
  const gc = core.getConfig, sc = core.setConfig;
  core.getConfig = () => CFG; core.setConfig = (c) => { CFG = c; };
  try {
    const G = require("../lib/gpuSplit");
    const t = await G.llmTarget("llm"), tv = await G.llmTarget("vlm");
    check("gpuSplit: OpenRouter the provider, Both + LLM ticked -> the chat goes to OpenRouter's /chat/completions with the key and the model",
      G.llmReady() && t && t.url === "http://stand.in:1/v1/chat/completions" && t.model === "mm/free-vision:free" && t.headers.Authorization === "Bearer sk-or-T" && /^OpenRouter /.test(t.label) && tv.model === "mm/free-vision:free", t);
    const v = G.view();
    check("…view: vllm_ready (the page's name for 'a remote LLM is set up'), llm_provider openrouter, the label; LLM routed remote", v.vllm_ready === true && v.llm_provider === "openrouter" && v.llm_label === "OpenRouter mm/free-vision:free" && v.routes.llm === "remote", v);
    CFG.rgpu.split.llm = false;
    check("…LLM not ticked = here (llama-server)", (await G.llmTarget("llm")) === null);
    CFG.rgpu.split.llm = true; CFG.rgpu.openrouter.model = "";
    check("…no model picked = not set up - here", !G.llmReady() && (await G.llmTarget("llm")) === null);
    CFG.rgpu.llm_provider = "runpod"; CFG.rgpu.openrouter.model = "aa/x";
    check("…provider RunPod vLLM with no endpoint = here (OpenRouter's setup does not leak into it)", !G.llmReady() && (await G.llmTarget("llm")) === null);
    delete CFG.rgpu.llm_provider;
    check("…no provider saved: OpenRouter when only it is set up", O.provider() === "openrouter" && G.llmReady());
  } finally { core.getConfig = gc; core.setConfig = sc; }

  const IDX = rd("routes", "index.js"), HTML = rd("static", "index.html"), RO = rd("routes", "openRouter.js");
  check("routes/openRouter.js mounted from routes/index.js: GET/POST /api/openrouter, /models, /test", /require\("\.\/openRouter"\)\.mount\(app\)/.test(IDX) && /app\.get\("\/api\/openrouter"/.test(RO) && /app\.post\("\/api\/openrouter"/.test(RO) && /\/api\/openrouter\/models/.test(RO) && /\/api\/openrouter\/test/.test(RO));
  check("the page: the tab is 'Remote generation', static/openrouter.js loads after remotegpu.js", /data-stab="rgpu">Remote generation</.test(HTML) && HTML.indexOf("/static/openrouter.js") > HTML.indexOf("/static/remotegpu.js"));
  const left = [];
  for (const d of ["lib", "routes", "static"]) for (const f of fs.readdirSync(path.join(ROOT, d))) if (/\.(js|html)$/.test(f) && /Settings (▸|->) Remote GPU/.test(rd(d, f))) left.push(d + "/" + f);
  check("nothing in lib / routes / static still says Settings ▸ Remote GPU", left.length === 0, left);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
