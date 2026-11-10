#!/usr/bin/env node
/* bitGen Studio — 2.753.0 in a REAL browser against a running studio (H3_URL, or H3_PORT - default 8311) started with
 * H3_OPENROUTER_API=http://127.0.0.1:8397/v1 (a stand-in OpenRouter this test serves on 8397).
 * Tim (verbatim): "lets add openrouter to remote gpu, maybe change remote gpu to remote generation?"
 *   - Settings: the tab is "Remote generation"; its 🧠 LLM section has Runs on RunPod vLLM / OpenRouter;
 *   - OpenRouter: the key typed -> OpenRouter's models listed (free only by default, "N models · M free"), the vision list
 *     only the models that take pictures; ✓ Test says the key works and the model is free;
 *   - the key is kept encrypted (settings/keys.json), not in custom.settings;
 *   - Basic Settings ▸ GPU with NO remote GPU: Both can be picked, LLM / Vision LLM tick, Image / Video cannot; the line
 *     says "LLM: OpenRouter";
 *   - a prompt enhance goes to OpenRouter: the model picked, the key, the app named (HTTP-Referer, X-OpenRouter-Title).
 * Put back afterwards. No server / no Playwright / 8397 busy = SKIP. */
"use strict";
const path = require("path"), fs = require("fs"), http = require("http");
const { execSync } = require("child_process");
let chromium = null;
for (const p of ["playwright", (() => { try { return path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"); } catch { return ""; } })()]) {
  if (!p) continue;
  try { ({ chromium } = require(p)); break; } catch { /* next */ }
}
if (!chromium) { console.log("SKIP: playwright is not installed here - the 2.753.0 browser test did not run"); process.exit(0); }
const ROOT = path.join(__dirname, "..");
const URL0 = process.env.H3_URL || ("http://127.0.0.1:" + (process.env.H3_PORT || 8311) + "/");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = (p, b) => fetch(URL0 + p.replace(/^\//, ""), b ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) } : undefined).then((r) => r.json());
const KEY = "sk-or-v1-UI753test";
const MODELS = [
  { id: "meta/llama-free:free", name: "Llama Free", context_length: 32000, pricing: { prompt: "0", completion: "0" }, architecture: { input_modalities: ["text"], output_modalities: ["text"] } },
  { id: "qwen/vl-free:free", name: "Qwen VL Free", context_length: 32000, pricing: { prompt: "0", completion: "0" }, architecture: { input_modalities: ["text", "image"], output_modalities: ["text"] } },
  { id: "big/paid", name: "Big Paid", context_length: 200000, pricing: { prompt: "0.000003", completion: "0.000015" }, architecture: { input_modalities: ["text"], output_modalities: ["text"] } },
  { id: "pic/maker", name: "Pic Maker", pricing: { prompt: "0", completion: "0" }, architecture: { input_modalities: ["text"], output_modalities: ["image"] } },
];

(async () => {
  try { const r = await fetch(URL0); if (!r.ok) throw 0; } catch { console.log("SKIP: no studio at " + URL0 + " - the 2.753.0 browser test did not run"); process.exit(0); }
  const seen = [];
  const or = http.createServer((q, s) => {
    let body = ""; q.on("data", (d) => { body += d; }); q.on("end", () => {
      seen.push({ url: q.url, method: q.method, auth: q.headers.authorization, ref: q.headers["http-referer"], title: q.headers["x-openrouter-title"], body });
      s.writeHead(200, { "Content-Type": "application/json" });
      if (q.url === "/v1/models") return s.end(JSON.stringify({ data: MODELS }));
      if (q.headers.authorization !== "Bearer " + KEY) { s.writeHead(401); return s.end("{}"); }
      if (q.url === "/v1/key") return s.end(JSON.stringify({ data: { label: "ui753", is_free_tier: true } }));
      if (q.url === "/v1/chat/completions") return s.end(JSON.stringify({ id: "x", object: "chat.completion", model: JSON.parse(body || "{}").model,
        choices: [{ index: 0, message: { role: "assistant", content: "A red fox runs through deep snow at dawn, soft golden light." }, finish_reason: "stop" }], usage: { prompt_tokens: 50, completion_tokens: 15 } }));
      s.end("{}");
    });
  });
  try { await new Promise((ok, bad) => { or.once("error", bad); or.listen(8397, "127.0.0.1", ok); }); } catch { console.log("SKIP: port 8397 is busy - the 2.753.0 browser test did not run"); process.exit(0); }
  const o0 = await api("/api/openrouter"), g0 = await api("/api/gpusplit"), v0 = await api("/api/remotegpu");
  // a clean start: no remote GPU, no OpenRouter
  await api("/api/remotegpu/use", { mode: "local" });
  await api("/api/remotegpu/save", { runpod: { key: "" }, serverless: { endpoint: "", comfy: "0.34.0", show_all: false } });
  await api("/api/gpusplit/vllm", { endpoint: "", model: "", vlm_endpoint: "", vlm_model: "" });
  await api("/api/openrouter", { key: "", model: "", vlm_model: "", free_only: true, provider: "runpod" });
  await api("/api/gpusplit", { where: "local", llm: false, vlm: false, image: false, video: false });
  const rm0 = (await api("/api/gpusplit")).remote;
  const b = await chromium.launch();
  try {
    const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
    const errs = []; p.on("pageerror", (e) => errs.push(e.message));
    const ev = (f, a) => p.evaluate(f, a);
    await p.goto(URL0);
    await p.waitForFunction(() => window.H3OpenRouter && window.H3GpuSplit && document.getElementById("gpuWhere"), null, { timeout: 30000 });
    await sleep(600);
    await ev(() => { document.getElementById("openSettings").onclick(); document.querySelector('#settings .stabs [data-stab="rgpu"]').click(); });
    await p.waitForFunction(() => document.getElementById("rgLlmProv"), null, { timeout: 8000 }).catch(() => {});
    const t1 = await ev(() => ({ tab: document.querySelector('#settings .stabs [data-stab="rgpu"]').textContent, head: document.querySelector("#rgVllm label.f").textContent,
      provs: [...document.querySelectorAll('input[name="rgLlmProv"]')].map((i) => i.value + (i.checked ? "*" : "")), or: getComputedStyle(document.getElementById("rgOr")).display,
      rp: getComputedStyle(document.getElementById("rgVep")).display }));
    check("Settings: the tab says Remote generation; 🧠 LLM runs on RunPod vLLM (picked) / OpenRouter; OpenRouter's part hidden", t1.tab === "Remote generation" && t1.head === "🧠 LLM"
      && t1.provs.join() === "runpod*,openrouter" && t1.or === "none" && t1.rp !== "none", t1);
    await p.check('input[name="rgLlmProv"][value="openrouter"]'); await sleep(300);
    const t2 = await ev(() => ({ or: getComputedStyle(document.getElementById("rgOr")).display, rpRow: getComputedStyle(document.getElementById("rgVep").closest(".rgVrp")).display, free: document.getElementById("rgOrFree").checked }));
    check("…OpenRouter picked: its key / models / help show, RunPod's rows hide; Free models only ticked", t2.or !== "none" && t2.rpRow === "none" && t2.free, t2);
    await p.fill("#rgOrKey", KEY); await p.press("#rgOrKey", "Tab");
    await p.waitForFunction(() => document.getElementById("rgOrModel").options.length > 2, null, { timeout: 8000 }).catch(() => {});
    const t3 = await ev(() => ({ llm: [...document.getElementById("rgOrModel").options].map((o) => o.value), vlm: [...document.getElementById("rgOrVlm").options].map((o) => o.value),
      labels: [...document.getElementById("rgOrModel").options].map((o) => o.textContent), msg: document.getElementById("rgOrMsg").textContent }));
    check("…the key typed: OpenRouter's text models listed, free only (no picture maker, no paid one); the vision list only the ones that take pictures (👁)",
      t3.llm.join() === ",meta/llama-free:free,qwen/vl-free:free" && t3.vlm.join() === ",qwen/vl-free:free" && /^👁 Qwen VL Free - free$/.test(t3.labels[2]) && /3 models · 2 free/.test(t3.msg), t3);
    await p.uncheck("#rgOrFree"); await sleep(300);
    const paid = await ev(() => [...document.getElementById("rgOrModel").options].map((o) => o.textContent));
    check("…Free models only off: the paid one too, with its price per million tokens", paid.some((x) => /^Big Paid - \$3 \/ \$15 per M tokens$/.test(x)), paid);
    await p.check("#rgOrFree"); await sleep(200);
    await p.selectOption("#rgOrModel", "meta/llama-free:free"); await sleep(400);
    await ev(() => document.getElementById("rgOrTest").click());
    await p.waitForFunction(() => /^[✓✗]/.test(document.getElementById("rgOrMsg").textContent), null, { timeout: 8000 }).catch(() => {});
    const t4 = await ev(() => document.getElementById("rgOrMsg").textContent);
    check("✓ Test: the key works (free tier), the model is free", /^✓ LLM: meta\/llama-free:free \(free\) · the key works - free tier/.test(t4), t4);
    await ev(() => document.getElementById("rgOrVtest").click());
    await p.waitForFunction(() => /^[✓✗] Vision|^✗/.test(document.getElementById("rgOrMsg").textContent), null, { timeout: 8000 }).catch(() => {});
    const t5 = await ev(() => document.getElementById("rgOrMsg").textContent);
    check("…the vision ✓ Test with a text-only LLM and no vision model: says to pick one that takes pictures", /^✗ meta\/llama-free:free does not take pictures/.test(t5), t5);
    await p.selectOption("#rgOrVlm", "qwen/vl-free:free"); await sleep(400);
    const saved = await api("/api/openrouter");
    check("saved: provider OpenRouter, the LLM + the vision LLM", saved.provider === "openrouter" && saved.model === "meta/llama-free:free" && saved.vlm_model === "qwen/vl-free:free" && saved.key === KEY, saved);
    let cs = ""; try { cs = fs.readFileSync(path.join(ROOT, "custom.settings"), "utf8"); } catch { cs = ""; }
    let kj = ""; try { kj = fs.readFileSync(path.join(ROOT, "settings", "keys.json"), "utf8"); } catch { kj = ""; }
    check("…the key kept encrypted in settings/keys.json, not in custom.settings", !cs.includes(KEY) && /"rgpu\.openrouter\.key": "v1:/.test(kj) && !kj.includes(KEY), { inCustom: cs.includes(KEY), kj: kj.slice(0, 200) });
    await ev(() => document.getElementById("settings").close());
    // Basic Settings ▸ GPU
    await ev(() => { toggleSec("gpu", false); document.dispatchEvent(new Event("h3:rgpu")); }); await sleep(900);   // false = open (test-ui745-ui.js)
    const gpu = () => ev(() => ({ radios: [...document.querySelectorAll('input[name="gpuWhere"]')].map((i) => i.value + (i.checked ? "*" : "") + (i.disabled ? "-" : "")),
      ticks: ["llm", "vlm", "image", "video"].map((k) => { const i = document.getElementById("gpu_" + k); return k + (i.checked ? "*" : "") + (i.disabled ? "-" : ""); }), line: document.getElementById("gpuLine").textContent }));
    let G = await gpu();
    if (!rm0) check("Basic Settings ▸ GPU, no remote GPU but OpenRouter set up: Both can be picked (Remote still needs a GPU)", G.radios.join() === "local*,remote-,both", G);
    else console.log("NOTE: this studio remembers a remote GPU - the 'OpenRouter alone' legs are skipped");
    await p.check('input[name="gpuWhere"][value="both"]'); await sleep(900);
    await p.check("#gpu_llm"); await sleep(700); await p.check("#gpu_vlm"); await sleep(900);
    G = await gpu();
    if (!rm0) check("…Both: LLM + Vision LLM ticked; Image / Video + songs cannot be (no remote GPU); the line says the renders stay here, LLM: OpenRouter",
      G.ticks.join() === "llm*,vlm*,image-,video-" && /^No remote GPU - pictures, videos and songs render on this computer · LLM: OpenRouter · Vision LLM: OpenRouter$/.test(G.line), G);
    const gv = await api("/api/gpusplit");
    check("…the server: Both, the LLMs routed remote, llm_label OpenRouter meta/llama-free:free", gv.where === "both" && gv.routes.llm === "remote" && gv.routes.vlm === "remote" && gv.llm_label === "OpenRouter meta/llama-free:free", gv);
    // a real LLM call
    const before = seen.length;
    const en = await api("/api/enhance", { prompt: "fox in snow", mode: "t2v" });
    const chat = seen.slice(before).find((x) => x.url === "/v1/chat/completions");
    let cb = {}; try { cb = JSON.parse(chat.body); } catch { cb = {}; }
    check("✨ a prompt enhance goes to OpenRouter: the model picked, the key, the app named (HTTP-Referer tigerart.com.au, X-OpenRouter-Title bitGen Studio); the answer comes back",
      !!chat && cb.model === "meta/llama-free:free" && chat.auth === "Bearer " + KEY && chat.ref === "https://tigerart.com.au" && chat.title === "bitGen Studio" && /red fox/.test(en.text || ""), { en, chat: chat && { auth: chat.auth, ref: chat.ref, title: chat.title, model: cb.model } });
    check("no page errors", errs.length === 0, errs);
  } catch (e) {
    fail++; console.log("FAIL: the test crashed: " + (e && e.stack || e));
  } finally {
    await b.close();
    or.close();
    await api("/api/gpusplit", { where: "local", llm: !!g0.llm, vlm: !!g0.vlm, image: !!g0.image, video: !!g0.video }).catch(() => {});
    await api("/api/openrouter", { key: o0.key || "", model: o0.model || "", vlm_model: o0.vlm_model || "", free_only: o0.free_only !== false, provider: o0.provider || "runpod" }).catch(() => {});
    await api("/api/remotegpu/save", { runpod: { key: (v0.runpod || {}).key || "" }, serverless: Object.assign({ endpoint: "", cost_hr: 0, comfy: "0.34.0", show_all: false }, v0.serverless || {}) }).catch(() => {});
    await api("/api/gpusplit/vllm", Object.assign({ endpoint: "", model: "", vlm_endpoint: "", vlm_model: "" }, g0.vllm || {})).catch(() => {});
    if (v0.mode && v0.mode !== "local") await api("/api/remotegpu/use", { mode: v0.mode }).catch(() => {});
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
