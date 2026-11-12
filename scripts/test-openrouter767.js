#!/usr/bin/env node
/* bitGen Studio — 2.767.0: OpenRouter with reasoning (its "reasoning": {"enabled": true}) and each assistant turn's
 * reasoning_details given back unmodified on the next call (lib/openRouter.js remember / attach, lib/llmChat.js) - against a
 * stand-in OpenRouter (H3_OPENROUTER_API); the model searchable (static/openrouter.js match / picker).
 * Tim (verbatim, with OpenRouter's Python example): "for open routers python . the model should be able to be changed. it would
 * be good to list/search open routers models and choose one from the list" */
"use strict";
const http = require("http"), fs = require("fs"), path = require("path"), Module = require("module");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
let CFG = { rgpu: { enabled: true, engine: { provider: "runpod", runpod: "pods" }, split: { where: "remote" }, llm_where: { llm: "openrouter" }, openrouter: { key: "sk-or-T", model: "google/gemma-4-31b-it:free" } }, llm: { port: 1, max_tokens: 600 } };
const coreP = require.resolve("../lib/core");
const fake = new Module(coreP); fake.filename = coreP; fake.loaded = true;
fake.exports = { getConfig: () => CFG, setConfig: (c) => { CFG = c; }, BASE: ROOT };
require.cache[coreP] = fake;
const seen = [];
const srv = http.createServer(async (q, s) => {
  const ch = []; for await (const c of q) ch.push(c);
  const b = JSON.parse(Buffer.concat(ch).toString() || "{}"); seen.push({ url: q.url, auth: q.headers.authorization, b });
  s.writeHead(200, { "Content-Type": "application/json" });
  const n = seen.length;
  s.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: n === 1 ? "There are 3 r's." : "Yes - 3.", reasoning_details: [{ type: "reasoning.text", text: "s-t-r-a-w-b-e-r-r-y: r at 3, 8, 9 (" + n + ")", format: "unknown", index: 0 }] } }], usage: { prompt_tokens: 5, completion_tokens: 9 } }));
});
srv.listen(0, "127.0.0.1", async () => {
  process.env.H3_OPENROUTER_API = "http://127.0.0.1:" + srv.address().port + "/api/v1";
  const OR = require("../lib/openRouter"), LC = require("../lib/llmChat");
  try {
    const t = await OR.target("llm");
    check("target(): reasoning on by default - {reasoning: {enabled: true}} and room for the thinking", t.provider === "openrouter" && t.body.reasoning.enabled === true && t.min_tokens >= 4000 && t.model === "google/gemma-4-31b-it:free");
    const q1 = [{ role: "user", content: "How many r's are in the word 'strawberry'?" }];
    const r1 = await LC.complete(fake.exports, { messages: q1 });
    check("first call: the model asked, reasoning enabled, no llama.cpp-only field, max_tokens with room; the answer read", r1.ok && /3 r's/.test(r1.text) && seen[0].b.model === "google/gemma-4-31b-it:free" && seen[0].b.reasoning.enabled === true && !seen[0].b.chat_template_kwargs && seen[0].b.max_tokens >= 4000 && seen[0].auth === "Bearer sk-or-T", { r1, b: seen[0].b });
    const r2 = await LC.complete(fake.exports, { messages: q1.concat([{ role: "assistant", content: r1.text }, { role: "user", content: "Are you sure? Think carefully." }]) });
    const am = seen[1].b.messages.find((m) => m.role === "assistant");
    check("second call: the assistant's reasoning_details given back UNMODIFIED with its message (the page sends plain messages)", r2.ok && am && Array.isArray(am.reasoning_details) && am.reasoning_details[0].text === "s-t-r-a-w-b-e-r-r-y: r at 3, 8, 9 (1)" && am.reasoning_details[0].type === "reasoning.text", { am });
    check("…a message bitGen never got from OpenRouter gets none", OR.attach([{ role: "assistant", content: "something else" }])[0].reasoning_details === undefined);
    for (let i = 0; i < 205; i++) OR.remember({ content: "c" + i, reasoning_details: [i] });
    check("…the last 200 kept", OR.RD.size === 200);
    OR.save({ reasoning: false });
    const t2 = await OR.target("llm");
    check("Reasoning off (Settings ▸ Remote generation ▸ OpenRouter): no reasoning field, no extra room", Object.keys(t2.body).length === 0 && t2.min_tokens === 0 && CFG.rgpu.openrouter.reasoning === false);
    OR.save({ model: "qwen/qwen3.8-27b" });
    check("the model can be changed (saved, used next)", (await OR.target("llm")).model === "qwen/qwen3.8-27b");
  } catch (e) { check("no error", false, String(e && e.stack)); }
  srv.close();
  // the page's search
  const src = fs.readFileSync(path.join(ROOT, "static", "openrouter.js"), "utf8");
  const mm = src.slice(src.indexOf("function match(m, q)"), src.indexOf("function paintModels"));
  const match = new Function(mm + "; return match;")();
  const M = [{ id: "google/gemma-4-31b-it:free", name: "Gemma 4 31B (free)", free: true }, { id: "qwen/qwen3-vl-8b", name: "Qwen3 VL 8B", vision: true }, { id: "openai/gpt-x", name: "GPT X" }];
  check("search: every word in its id / name; 'free' and 'vision' match those", M.filter((m) => match(m, "gemma free")).length === 1 && M.filter((m) => match(m, "vision")).map((m) => m.id).join() === "qwen/qwen3-vl-8b" && M.filter((m) => match(m, "")).length === 3);
  check("Settings ▸ OpenRouter: the search box + Reasoning; Basic Settings ▸ GPU: a searchable OpenRouter model list when the LLM / Vision LLM is on OpenRouter", /id="rgOrQ"/.test(src) && /id="rgOrReason"/.test(src) && /function picker\(host, kind\)/.test(src)
    && /H3OpenRouter\.picker\(op, k\)/.test(fs.readFileSync(path.join(ROOT, "static", "remoteprep.js"), "utf8")));
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(fail ? "RESULT: FAIL" : "RESULT: PASS");
  process.exit(fail ? 1 : 0);
});
