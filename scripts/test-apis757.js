#!/usr/bin/env node
/* bitGen Studio — 2.757.0 units: Settings ▸ API (lib/apis.js, lib/apiJobs.js, the style's Runs on: API, the encrypted keys).
 * Tim (verbatim): "can you add an api tab to bitgen with add api input and name input and a use checkbox for each api the
 * use adds. if api is checked add it to styles with prefix API_ so bitgen can truly work without good hardware" (asked:
 * "Several known services", "Pictures, Video, Songs, The LLM too") + "add runninghub too". */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path"), Module = require("module");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 500))); } };
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");

// a stand-in core: a config in memory + a styles folder of its own
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "apis757-"));
let CFG = { rgpu: { mode: "local" } };
const coreP = require.resolve("../lib/core");
const fake = new Module(coreP); fake.filename = coreP; fake.loaded = true;
fake.exports = { getConfig: () => CFG, setConfig: (c) => { CFG = c; }, STYLES_DIR: TMP };
require.cache[coreP] = fake;
const A = require("../lib/apis"), S = require("../lib/styles"), SEC = require("../lib/secrets"), AJ = require("../lib/apiJobs");

// ---- the services
check("seven services: OpenRouter, fal.ai, Replicate, OpenAI, Google Gemini, Claude, RunningHub (Tim: 'add runninghub too', 'can we add claude as well?')",
  Object.keys(A.SERVICES).join() === "openrouter,fal,replicate,openai,gemini,claude,runninghub");
check("…what each makes: fal / Replicate / RunningHub pictures + video + songs; OpenRouter pictures + video; OpenAI and Gemini pictures (their video APIs are gone or not offered); the LLM on OpenRouter, OpenAI, Gemini",
  A.SERVICES.fal.kinds.join() === "image,video,music" && A.SERVICES.runninghub.kinds.join() === "image,video,music" && A.SERVICES.openrouter.kinds.join() === "image,video"
  && A.SERVICES.openai.kinds.join() === "image" && A.SERVICES.gemini.kinds.join() === "image"
  && ["openrouter", "openai", "gemini", "claude"].every((s) => !!A.SERVICES[s].llm) && ["fal", "replicate", "runninghub"].every((s) => !A.SERVICES[s].llm)
  && A.SERVICES.claude.kinds.length === 0 && A.SERVICES.claude.llm === "https://api.anthropic.com/v1" && A.SERVICES.claude.models.llm === "claude-sonnet-5-5");
const KEYS = { openrouter: "sk-or-v1-" + "a".repeat(40), fal: "12345678-abcd-4bcd-8bcd-1234567890ab:" + "f".repeat(32), replicate: "r8_" + "B".repeat(30),
  gemini: "AIza" + "x".repeat(35), openai: "sk-proj-" + "q".repeat(40), claude: "sk-ant-api03-" + "C".repeat(80), runninghub: "0123456789abcdef0123456789abcdef" };
check("detect: each service's key shape (Auto-detect) - an OpenRouter sk-or- or a Claude sk-ant- key is not taken for OpenAI's sk-",
  Object.entries(KEYS).every(([s, k]) => A.detect(k) === s) && A.detect("hello") === "" && A.detect("") === "", Object.entries(KEYS).map(([s, k]) => s + "=" + A.detect(k)));
const vm = require("vm"), ctx = { window: { document: null } }; ctx.window.window = ctx.window; vm.createContext(ctx);
vm.runInContext(rd("static", "apis.js"), ctx);
check("…the page guesses the same (static/apis.js guess = lib/apis.js detect)", Object.values(KEYS).concat(["x", "sk-abc"]).every((k) => ctx.window.H3Apis.guess(k) === A.detect(k)));

// ---- add / Use / the API_ styles
let r = A.add({ service: "auto", name: "My OpenRouter", key: KEYS.openrouter, use: true });
const orId = r.api.id;
check("add with Use ticked: the key's service found, Use on, its API_ styles made: 'API_My OpenRouter pictures' + 'API_My OpenRouter video'",
  r.api.service === "openrouter" && r.api.use && r.styles.join() === "API_My OpenRouter pictures,API_My OpenRouter video", r);
check("…the page never gets the key - only that there is one and its last 4", !("key" in r.api) && r.api.has_key && r.api.key_end === KEYS.openrouter.slice(-4) && !JSON.stringify(A.list()).includes(KEYS.openrouter));
let all = S.read(TMP);
const pic = all.find((s) => s.name === "API_My OpenRouter pictures"), vid = all.find((s) => s.name === "API_My OpenRouter video");
check("…the styles: kind picture / video, Runs on API, this API's id, the service's default model, made by Use",
  pic && pic.kind === "image" && pic.runs_on === "api" && pic.api_id === orId && pic.api_model === "google/gemini-2.5-flash-image" && pic.api_auto
  && vid && vid.kind === "video" && vid.api_model === "google/veo-3.1", all.map((s) => s.name));
check("…an API_ style needs nothing in ComfyUI (no missing slots)", S.missingSlots(pic).length === 0 && S.missingSlots(vid).length === 0);
r = A.add({ service: "runninghub", name: "RH", key: KEYS.runninghub });
const rhId = r.api.id;
check("add without Use: no styles yet", !r.api.use && r.styles.length === 0 && !S.read(TMP).some((s) => s.api_id === rhId));
r = A.change(rhId, { use: true, models: { image: "1987654321" } });
check("tick Use later: API_RH pictures / video / songs (a service with three kinds) - the workflow ID typed is the picture style's Model",
  r.styles.join() === "API_RH pictures,API_RH video,API_RH songs" && S.read(TMP).find((s) => s.name === "API_RH pictures").api_model === "1987654321", r.styles);
const mine = S.read(TMP).find((s) => s.name === "API_RH video");
S.save(TMP, Object.assign({}, mine, { api_model: "555" }));
A.change(rhId, { name: "RunHub" });
check("rename: its styles follow (API_RunHub …), the Model you changed in the style is kept",
  S.read(TMP).some((s) => s.name === "API_RunHub pictures") && S.read(TMP).find((s) => s.name === "API_RunHub video").api_model === "555" && !S.read(TMP).some((s) => /^API_RH /.test(s.name)));
const own = S.save(TMP, { name: "My own", kind: "image", runs_on: "api", api_id: rhId, api_model: "777" });
check("a style you make yourself with Runs on: API gets the API_ prefix", own.name === "API_My own" && own.runs_on === "api");
A.change(rhId, { use: false });
check("untick Use: the styles Use made are removed; the one you made yourself stays", !S.read(TMP).some((s) => /^API_RunHub/.test(s.name)) && S.read(TMP).some((s) => s.name === "API_My own"));
const back = S.save(TMP, Object.assign({}, S.read(TMP).find((s) => s.name === "API_My own"), { runs_on: "local" }));
check("…switching a style back to This computer drops API_ and its api fields", back.name === "My own" && back.runs_on === "local" && !("api_id" in back) && !("api_model" in back));
let err = null; try { A.add({ service: "auto", name: "x", key: "not a key" }); } catch (e) { err = e; }
check("a key bitGen cannot place: 'pick it in the list'", err && err.status === 400 && /pick it in the list/.test(err.message));
err = null; try { A.add({ service: "openai", name: "my openrouter", key: KEYS.openai }); } catch (e) { err = e; }
check("…two APIs with the same name: refused (it names the styles)", err && err.status === 409);
err = null; try { A.add({ service: "fal", name: "F", key: "" }); } catch (e) { err = e; }
check("…no key: 'paste the API key first'", err && /paste the API key/.test(err.message));

// ---- the LLM
check("llmTarget: none until an API is set for the LLM", A.llmTarget("llm") === null);
r = A.add({ service: "gemini", name: "Gem", key: KEYS.gemini, use: true });
const gemId = r.api.id;
A.change(gemId, { llm: true });
let t = A.llmTarget("llm");
check("Use for the LLM (Gemini): its OpenAI-shaped /chat/completions, Bearer key, the default model gemini-2.5-flash; the vision LLM too",
  t && t.url === "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions" && t.headers.Authorization === "Bearer " + KEYS.gemini && t.model === "gemini-2.5-flash"
  && A.llmTarget("vlm") && /Settings ▸ API ▸ Gem/.test(t.label), t);
A.change(orId, { llm: true, models: { llm: "meta-llama/llama-4-maverick" } });
t = A.llmTarget("llm");
check("…one API at a time: ticking it on OpenRouter unticks Gemini; OpenRouter's own headers, the model typed",
  t && /openrouter\.ai\/api\/v1\/chat\/completions$/.test(t.url) && t.model === "meta-llama/llama-4-maverick" && t.headers["X-OpenRouter-Title"] === "bitGen Studio"
  && !A.list().apis.find((a) => a.id === gemId).llm, t);
err = null; try { A.change(rhId, { llm: true }); } catch (e) { err = e; }
check("…RunningHub has no LLM: refused in words", err && /no LLM bitGen can use/.test(err.message));
A.change(orId, { use: false });
check("…Use off = not the LLM either (and its styles gone)", A.llmTarget("llm") === null && !S.read(TMP).some((s) => s.api_id === orId));
// Claude: the LLM only
r = A.add({ service: "auto", name: "My Claude", key: KEYS.claude, use: true });
const clId = r.api.id;
t = A.llmTarget("llm");
check("Claude (Tim: 'can we add claude as well?'): recognised from sk-ant-, Use = the LLM (no styles - Claude makes no pictures), Anthropic's OpenAI-compatible /v1/chat/completions, Bearer key, claude-sonnet-5-5",
  r.api.service === "claude" && r.api.use && r.api.llm && r.styles.length === 0 && !S.read(TMP).some((s) => s.api_id === clId)
  && t && t.url === "https://api.anthropic.com/v1/chat/completions" && t.headers.Authorization === "Bearer " + KEYS.claude && t.model === "claude-sonnet-5-5" && A.llmTarget("vlm"), { r, t });
const fb = A.fitBody(t, { model: "m", messages: [], temperature: 0.7, top_p: 0.9, n: 1, max_tokens: 400, chat_template_kwargs: { enable_thinking: false } });
check("…fitBody: Claude 5 refuses temperature / top_p (400) - dropped with n and chat_template_kwargs; room for its thinking (max_tokens at least 2048); other services' bodies untouched",
  !("temperature" in fb) && !("top_p" in fb) && !("n" in fb) && !("chat_template_kwargs" in fb) && fb.max_tokens === 2048 && A.fitBody(t, { max_tokens: 4096 }).max_tokens === 4096
  && JSON.stringify(A.fitBody({ url: "x" }, { temperature: 0.4, max_tokens: 300 })) === JSON.stringify({ temperature: 0.4, max_tokens: 300 }) && JSON.stringify(A.fitBody(null, { a: 1 })) === '{"a":1}', fb);
check("…every LLM caller sends its body through fitBody (lib/llmChat.js, lib/quickPrompt.js, lib/captioner.js)",
  ["llmChat", "quickPrompt", "captioner"].every((f) => /JSON\.stringify\((?:Object\.assign\()?require\("\.\/apis"\)\.fitBody\(remote, (?:Object\.assign\()?\{/.test(rd("lib", f + ".js"))));
check("…✓ Test asks Anthropic's /v1/models with x-api-key + anthropic-version", /a\.service === "claude"\) r = await get\(\(base \|\| "https:\/\/api\.anthropic\.com\/v1"\) \+ "\/models\?limit=1", \{ "x-api-key": a\.key, "anthropic-version": "2023-06-01" \}\)/.test(rd("lib", "apis.js")));
A.remove(clId);
const G = rd("lib", "gpuSplit.js");
check("lib/gpuSplit.js llmTarget asks Settings ▸ API first (the prompt LLM, captions, the shot list all go there)", /async function llmTarget\(kind\) \{\n  const api = require\("\.\/apis"\)\.llmTarget\(kind\);[^\n]*\n  if \(api\) return api;/.test(G));

// ---- the keys: encrypted in settings/keys.json, never in custom.settings
const cfg = { rgpu: { runpod: { key: "rp" } }, apis: { ab12cd34: { name: "x", service: "fal", key: "secret1" } } };
check("lib/secrets.js: each API's key is a key path (apis.<id>.key) - pick takes it, strip leaves it out of custom.settings",
  SEC.pathsOf(cfg).includes("apis.ab12cd34.key") && SEC.pick(cfg)["apis.ab12cd34.key"] === "secret1" && !JSON.stringify(SEC.strip(cfg)).includes("secret1") && SEC.isKeyPath("apis.ab12cd34.key") && !SEC.isKeyPath("apis.x.name"));
const c2 = { apis: { ab12cd34: { name: "x" } } };
SEC.put(c2, { "apis.ab12cd34.key": "k", "apis.gone0000.key": "old" });
check("…loading puts each key back on its API; a removed API's key is not brought back as an empty API", c2.apis.ab12cd34.key === "k" && !c2.apis.gone0000);
const ST = SEC.store(fs.mkdtempSync(path.join(os.tmpdir(), "apikeys-")), { log: () => {} });
require("../lib/settings").save({ config: cfg, base: {}, customPath: path.join(TMP, "custom.settings"), secrets: ST });
check("…saved: keys.json holds it encrypted, custom.settings does not", ST.read()["apis.ab12cd34.key"] === "secret1" && !fs.readFileSync(ST.file, "utf8").includes("secret1") && !fs.readFileSync(path.join(TMP, "custom.settings"), "utf8").includes("secret1"));
delete cfg.apis.ab12cd34;
require("../lib/settings").save({ config: cfg, base: {}, customPath: path.join(TMP, "custom.settings"), secrets: ST });
check("…an API removed: its key leaves keys.json too", !("apis.ab12cd34.key" in ST.read()));

// ---- jobs
const C = rd("lib", "core.js");
check("lib/core.js workerFor: a picture / video / song job whose style runs on an API -> misc/api_worker.py; everything else its usual worker",
  /if \(st && st\.runs_on === "api" && API_MODES\.has\(String\(p\.mode \|\| ""\)\)\) return path\.join\(MISC, "api_worker\.py"\)/.test(C) && /spawn\(config\.python, \["-u", workerFor\(job\.params\), jobFile\]/.test(C));
check("…an API job does not wait for a hot GPU, does not take the warm LLM's memory, does not go to the remote GPU",
  /g = isApiJob\(queue\[0\]\.params\) \? null : require\("\.\/queuePresets"\)\.check\(\)/.test(C) && /&& !isApiJob\(job\.params\)\) \{   \/\/ 2\.757\.0: an API job keeps the warm models/.test(C) && /if \(isApiJob\(job\.params\)\) \{[^\n]*\n  else try \{ const sp = require\("\.\/gpuSplit"\)\.forJob/.test(C));
check("…job.json carries only that API's key (none for any other job)", /jobCfg\.apis = want && jobCfg\.apis\[want\] \? \{ \[want\]: jobCfg\.apis\[want\] \} : \{\};/.test(C));
const vp = AJ.videoParams({ style: vid, mode: "fl2va", prompt: " a fox ", files: ["/a.png", "/b.png"], width: "1280", height: "720", frames: "120", seed: "9", format: "webm" });
check("lib/apiJobs.js videoParams: the request as typed (no H3 chunk plan) - mode, prompt, size, frames, seed, the pictures, the style",
  vp.params && vp.params.mode === "fl2va" && vp.params.prompt === "a fox" && vp.params.width === 1280 && vp.params.frames === 120 && vp.params.seed === 9 && vp.params.format === "webm"
  && vp.params.reference_files.length === 2 && vp.params.video_style.runs_on === "api" && !vp.params.plan, vp);
check("…First / last frame with no picture, or an empty prompt, or no API picked: refused in words",
  /first frame picture/.test(AJ.videoParams({ style: vid, mode: "fl2va", prompt: "x", files: [] }).error) && /prompt is required/.test(AJ.videoParams({ style: vid, mode: "t2va", prompt: " " }).error)
  && /has none picked/.test(AJ.videoParams({ style: { name: "API_x", runs_on: "api" }, mode: "t2va", prompt: "x" }).error));
check("routes/index.js /api/generate hands an API_ video style to lib/apiJobs.js before the MiniMax H3 work", /if \(require\("\.\.\/lib\/apiJobs"\)\.isApiStyle\(vs\)\) \{/.test(rd("routes", "index.js")));
const RP = require("../lib/rpslStyles");
check("lib/rpslStyles.js hideWhy: an API_ style is never hidden, whatever Basic Settings ▸ GPU says (Local, Remote, an endpoint)",
  ["local", "remote", "both"].every((w) => RP.hideWhy({ runs_on: "api" }, { ok: false, why: "x" }, { where: w, sls: true }) === null));
check("routes/modelsFound.js: the model-file check skips an API_ style (the service has its own models)", /st0\.runs_on === "api"\) return \{ skip: "an API_ style/.test(rd("routes", "modelsFound.js")));

// ---- the page
const P = rd("static", "apis.js"), R = rd("static", "runson.js");
check("static/apis.js: Settings ▸ API after Remote generation - Service (Auto-detect), Name, API key (hidden as typed), Use, + Add; each API: Use, Use for the LLM, ✓ Test, ✕, Models and key",
  /tabs\.querySelector\('\[data-stab="rgpu"\]'\)/.test(P) && /id="apiSvc"><option value="auto">Auto-detect from the key/.test(P) && /id="apiName"/.test(P) && /type="password" id="apiKey"/.test(P)
  && /id="apiUse" checked> Use/.test(P) && /id="apiAdd">\+ Add/.test(P) && /data-act="use"/.test(P) && /data-act="llm"/.test(P) && /data-act="test"/.test(P) && /data-act="del"/.test(P) && /Save models and key/.test(P));
check("…the style lists hear it (refreshStyles / refreshMusicStyles, the Runs on list)", /root\.refreshStyles\(\)/.test(P) && /root\.refreshMusicStyles\(\)/.test(P) && /H3RunsOn\.reload\(\)/.test(P));
check("static/runson.js: Runs on ◉ This computer ◉ Remote GPU ◉ API - the API (only those that make this kind), its Model, Extra settings (JSON)",
  /\["api", "API", /.test(R) && /id="s_\$\{p\}apiid"/.test(R) && /id="s_\$\{p\}apimodel"/.test(R) && /id="s_\$\{p\}apiextra"/.test(R) && /\(a\.kinds \|\| \[\]\)\.indexOf\(kind\) >= 0/.test(R)
  && /return \{ runs_on: "api", endpoint: "", api_id:/.test(R));
check("index.html loads static/apis.js; routes/index.js mounts routes/apis.js (server.js untouched)", /<script src="\/static\/apis\.js"><\/script>/.test(rd("static", "index.html")) && /require\("\.\/apis"\)\.mount\(app\)/.test(rd("routes", "index.js")) && !/apis/.test(rd("misc", "server.js")));

// ---- remove
A.remove(gemId);
check("✕ Remove: the API and the styles it made are gone", !A.list().apis.some((a) => a.id === gemId) && !S.read(TMP).some((s) => s.api_id === gemId));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
