#!/usr/bin/env node
/* bitGen Studio — 2.768.0: in remote mode the prompt docker's LLM / Vision lists are the remote host's models - OpenRouter's
 * FREE models by default, the pod's GGUFs on RunPod ▸ Pods, the vLLM endpoint's model on Serverless (lib/remoteLlm.js,
 * routes/remoteLlm.js, static/remotellm.js); the pick is what the LLM calls use. Against a stand-in OpenRouter (H3_OPENROUTER_API).
 * Tim (verbatim): "move all the remote gpu options to the remote gpu docker, when in remote mode clear the llm and vllm dropdown
 * lists in prompt docker add the list of free llm and vl models from openrouter(default) or the selected host in our prompt llm
 * and vllm dropdowns." */
"use strict";
const http = require("http"), fs = require("fs"), path = require("path"), Module = require("module");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
let CFG = { rgpu: { enabled: true, split: { where: "remote" }, engine: { provider: "runpod", runpod: "pods" } }, llm: { port: 1, last_file: "my-local.gguf" } };
const coreP = require.resolve("../lib/core");
const fake = new Module(coreP); fake.filename = coreP; fake.loaded = true;
fake.exports = { getConfig: () => CFG, setConfig: (c) => { CFG = c; }, BASE: ROOT, llmPaths: () => ({ dir: "/nowhere" }), llamaState: () => ({}) };
require.cache[coreP] = fake;
const seen = [];
const MODELS = [
  { id: "google/gemma-4-31b-it:free", name: "Gemma 4 31B (free)", context_length: 131072, architecture: { input_modalities: ["text", "image"], output_modalities: ["text"] }, pricing: { prompt: "0", completion: "0" } },
  { id: "qwen/qwen3.8-27b:free", name: "Qwen3.8 27B (free)", context_length: 32768, architecture: { input_modalities: ["text"], output_modalities: ["text"] }, pricing: { prompt: "0", completion: "0" } },
  { id: "openai/gpt-x", name: "GPT X", context_length: 200000, architecture: { input_modalities: ["text", "image"], output_modalities: ["text"] }, pricing: { prompt: "0.000002", completion: "0.000008" } },
  { id: "black/flux-img", name: "An image model", architecture: { input_modalities: ["text"], output_modalities: ["image"] }, pricing: { prompt: "0", completion: "0" } },
];
const srv = http.createServer((q, s) => { seen.push({ url: q.url, auth: q.headers.authorization }); s.writeHead(200, { "Content-Type": "application/json" }); s.end(JSON.stringify({ data: MODELS })); });
srv.listen(0, "127.0.0.1", async () => {
  process.env.H3_OPENROUTER_API = "http://127.0.0.1:" + srv.address().port + "/api/v1";
  const RL = require("../lib/remoteLlm"), PL = require("../lib/podLlm"), G = require("../lib/gpuSplit"), UI = require("../static/remotellm.js");
  try {
    /* ---- where the LLM runs */
    const H = (r, k) => RL.hostOf(r, k || "llm");
    check("hostOf: Remote with nothing picked = OpenRouter (Tim: 'openrouter(default)'), for the LLM and the vision LLM", H({ enabled: true, split: { where: "remote" } }) === "openrouter" && H({ enabled: true, split: { where: "remote" } }, "vlm") === "openrouter");
    check("…Local / remote generation off / Both with nothing picked: this computer's lists ('')", H({ enabled: true, split: { where: "local" } }) === "" && H({ enabled: false, split: { where: "remote" } }) === "" && H({ enabled: true, split: { where: "both" } }) === "");
    check("…a pick wins (RunPod / OpenRouter); Local picked = this computer; 2.770.0: nothing picked = the platform Settings picks (RunPod when chosen there, else OpenRouter)",
      H({ enabled: true, split: { where: "remote" }, llm_where: { llm: "runpod" } }) === "runpod" && H({ enabled: true, split: { where: "both" }, llm_where: { llm: "openrouter" } }) === "openrouter"
      && H({ enabled: true, split: { where: "remote" }, llm_where: { llm: "local" } }) === "" && H({ enabled: true, split: { where: "remote" }, llm_provider: "runpod", vllm: { endpoint: "ep" } }) === "runpod" && H({ enabled: true, split: { where: "remote" }, llm_provider: "openrouter" }) === "openrouter");
    /* ---- the pod's GGUFs */
    const cat = JSON.parse(fs.readFileSync(path.join(ROOT, "lib", "modelCatalog.json"), "utf8")).models;
    const tl = RL.catalogLlms(cat, "llm"), vl = RL.catalogLlms(cat, "vlm");
    check("catalogLlms: the text GGUFs for the LLM (no image / video GGUFs, no vision, no mmproj); the vision GGUF for the vision LLM", tl.length >= 5 && tl.some((m) => m.id === "Qwen3-4B-Q4_K_M.gguf") && !tl.some((m) => /VL|mmproj|krea|LTX/i.test(m.id)) && vl.length >= 1 && vl.every((m) => /VL/.test(m.id) && !/mmproj/i.test(m.id)), { tl, vl });
    check("mmprojFor: the vision GGUF's projector", RL.mmprojFor(cat, "Qwen3-VL-8B-NSFW-Caption-V4.Q4_K_M.gguf") === "Qwen3-VL-8B-NSFW-Caption-V4.mmproj-f16.gguf" && RL.mmprojFor(cat, "nothing.gguf") === "");

    /* ---- OpenRouter (the default): its FREE models, listed with no key */
    CFG.rgpu.engine = { provider: "runpod", runpod: "pods" };
    let L = await RL.lists();
    check("lists(): Remote + nothing picked = OpenRouter's free text models for the LLM (no paid, no image-out model) - asked with no key (no Authorization)",
      L.llm.host === "openrouter" && L.llm.models.map((m) => m.id).join() === "google/gemma-4-31b-it:free,qwen/qwen3.8-27b:free" && seen[0] && seen[0].auth === undefined && /needs an API key/.test(L.llm.note), { L, seen });
    check("…the vision LLM: the free models that take pictures", L.vlm.host === "openrouter" && L.vlm.models.map((m) => m.id).join() === "google/gemma-4-31b-it:free");
    let r = RL.pick("llm", "qwen/qwen3.8-27b:free"); RL.pick("vlm", "google/gemma-4-31b-it:free");
    check("pick(): OpenRouter's model + vision model saved (the docker's OpenRouter picker shows the same)", r.ok && CFG.rgpu.openrouter.model === "qwen/qwen3.8-27b:free" && CFG.rgpu.openrouter.vlm_model === "google/gemma-4-31b-it:free");
    CFG.rgpu.openrouter.key = "sk-or-T";
    const t = await G.llmTarget("llm"), tv = await G.llmTarget("vlm");
    check("the LLM calls use the pick: Remote + nothing picked -> OpenRouter with the dropdown's model (vision: its own)", t.provider === "openrouter" && t.model === "qwen/qwen3.8-27b:free" && tv.model === "google/gemma-4-31b-it:free", { t, tv });
    CFG.rgpu.openrouter.model = "openai/gpt-x";
    L = await RL.lists();
    check("…a (paid) model picked before stays listed, first", L.llm.models[0].id === "openai/gpt-x" && L.llm.current === "openai/gpt-x" && /picked before/.test(L.llm.models[0].note));

    /* ---- RunPod ▸ Pods: the GGUFs the pod downloads */
    CFG.rgpu.llm_where = { llm: "runpod", vlm: "runpod" };
    L = await RL.lists();
    check("RunPod + Pods: the GGUFs bitGen can put on the pod (not this computer's files); the LLM file picked here before is the current one only if listed", L.llm.host === "runpod" && L.llm.label === "RunPod pod" && L.llm.models.some((m) => m.id === "Qwen3-8B-Q4_K_M.gguf") && L.llm.current === "" && L.vlm.models.length >= 1, L.llm);
    PL.STATE.llm = { pod: "p", phase: "ready", file: "Qwen3-4B-Q4_K_M.gguf" };
    r = RL.pick("llm", "Qwen3-8B-Q4_K_M.gguf"); RL.pick("vlm", "Qwen3-VL-8B-NSFW-Caption-V4.Q4_K_M.gguf");
    const f1 = PL.filesFor("llm"), f2 = PL.filesFor("vlm");
    check("pick(): saved (rgpu.llm_pick); the pod's LLM set up with another file is set up again at the next prompt (stale); podLlm uses the pick (+ the vision GGUF's mmproj)",
      r.ok && CFG.rgpu.llm_pick.llm === "Qwen3-8B-Q4_K_M.gguf" && PL.STATE.llm.phase === "stale" && f1.model === "Qwen3-8B-Q4_K_M.gguf" && f2.model === "Qwen3-VL-8B-NSFW-Caption-V4.Q4_K_M.gguf" && f2.mmproj === "Qwen3-VL-8B-NSFW-Caption-V4.mmproj-f16.gguf", { f1, f2 });
    let e1 = null; try { RL.pick("llm", "../x.sh"); } catch (e) { e1 = e; }
    check("…not a GGUF name: refused (400)", e1 && e1.status === 400);
    /* ---- Serverless: the endpoint's one model */
    CFG.rgpu.engine = { provider: "runpod", runpod: "serverless" }; CFG.rgpu.vllm = { endpoint: "ep1", model: "Qwen/Qwen3-8B" };
    L = await RL.lists();
    check("RunPod Serverless: the vLLM endpoint's model, one (fixed)", L.llm.label === "RunPod vLLM" && L.llm.fixed && L.llm.models.length === 1 && L.llm.models[0].id === "Qwen/Qwen3-8B");
    /* ---- Local again */
    CFG.rgpu.split.where = "local";
    L = await RL.lists();
    let e2 = null; try { RL.pick("llm", "x"); } catch (e) { e2 = e; }
    check("Local: no host - the prompt docker shows this computer's lists again; a pick is refused", L.llm.host === "" && L.vlm.host === "" && e2 && e2.status === 400);
  } catch (e) { check("no error", false, String(e && e.stack)); }
  srv.close();
  /* ---- the page */
  const o = UI.optionsOf({ host: "openrouter", label: "OpenRouter", models: [{ id: "a/b:free", name: "B (free)", note: "32k context" }, { id: "c/d:free", name: "D" }], current: "c/d:free" });
  check("optionsOf: under '☁ OpenRouter', name · note, the current one selected; an empty list says so", o.label === "☁ OpenRouter" && o.items[0].text === "B (free) · 32k context" && o.items[1].selected && !o.items[0].selected && UI.optionsOf({ host: "runpod", label: "RunPod pod", models: [] }).empty === "(no models RunPod pod lists)");
  const page = fs.readFileSync(path.join(ROOT, "static", "index.html"), "utf8"), js = fs.readFileSync(path.join(ROOT, "static", "remotellm.js"), "utf8");
  check("the page: refreshLlms leaves the prompt docker's LLM list to H3RemoteLlm in remote mode (the Settings ▸ LLM picker still lists this computer's); remotellm.js loaded",
    /const remoteOwn = !!\(window\.H3RemoteLlm && H3RemoteLlm\.owns\("llm"\)\)/.test(page) && /if \(remoteOwn\) \{ H3RemoteLlm\.paint\("llm"\); return; \}/.test(page) && /<script src="\/static\/remotellm\.js"><\/script>/.test(page));
  check("remotellm.js: a pick is caught before the page's own handler (it would load the model here); the vision list's own loader kept out (focus + MutationObserver)", /addEventListener\("change", function \(e\) \{[\s\S]*?e\.stopPropagation\(\);[\s\S]*?pick\(k, t\.value\);\s*\}, true\)/.test(js) && /new MutationObserver/.test(js) && /addEventListener\("focus"[\s\S]*?owns\("vlm"\)\) e\.stopPropagation\(\); \}, true\)/.test(js));
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
});
