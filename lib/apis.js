// bitGen Studio — lib/apis.js (2.757.0): SETTINGS ▸ API - ONLINE SERVICES THAT RENDER FOR YOU, AS API_ STYLES.
// Tim (verbatim): "can you add an api tab to bitgen with add api input and name input and a use checkbox for each api the
// use adds. if api is checked add it to styles with prefix API_ so bitgen can truly work without good hardware" (asked:
// "Several known services", "Pictures, Video, Songs, The LLM too") + "add runninghub too".
//
//   config.apis = {<id>: {name, service, use, base?, llm?, models: {image, video, music, llm}}}; each key at apis.<id>.key
//                 (lib/secrets.js - encrypted in settings/keys.json, never in custom.settings)
//   SERVICES    what each service can do, how its key looks (detect), its default models - the defaults are a start,
//               every API_ style's Model can be changed (Settings ▸ Image / Video / Audio, the style's Runs on)
//   ticking Use  makes one API_<name> style per kind the service makes (picture / video / song), runs_on "api", api_id,
//               api_model; unticking removes the ones it made (api_auto). misc/api_worker.py renders them - no GPU, no
//               ComfyUI here.
//   llm          "Use for the LLM" (one API at a time, OpenAI-compatible services): every LLM call goes there
//               (lib/gpuSplit.js llmTarget asks llmTarget below first)
// Pure (scripts/test-apis757.js): SERVICES, detect, newId, view, styleFor, llmTargetOf, fitBody.
"use strict";

const SERVICES = {
  openrouter: { name: "OpenRouter", site: "https://openrouter.ai/keys", kinds: ["image", "video"], llm: "https://openrouter.ai/api/v1",
    key: /^sk-or-(v1-)?[A-Za-z0-9_-]{20,}$/, hint: "sk-or-v1-…",
    models: { image: "google/gemini-2.5-flash-image", video: "google/veo-3.1", llm: "google/gemini-2.5-flash" },
    note: "Pictures and video from many models with one key; you pay per picture or per second of video." },
  fal: { name: "fal.ai", site: "https://fal.ai/dashboard/keys", kinds: ["image", "video", "music"], llm: "",
    key: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:[0-9a-f]{20,}$/i, hint: "xxxxxxxx-…:…",
    models: { image: "fal-ai/flux/schnell", video: "fal-ai/wan/v2.2-a14b/text-to-video", music: "fal-ai/ace-step" },
    note: "Hundreds of picture, video and music models; the Model is the endpoint (fal-ai/…)." },
  replicate: { name: "Replicate", site: "https://replicate.com/account/api-tokens", kinds: ["image", "video", "music"], llm: "",
    key: /^r8_[A-Za-z0-9]{20,}$/, hint: "r8_…",
    models: { image: "black-forest-labs/flux-schnell", video: "wan-video/wan-2.2-t2v-fast", music: "minimax/music-1.5" },
    note: "Public models by owner/name (or owner/name:version); you pay per run." },
  openai: { name: "OpenAI", site: "https://platform.openai.com/api-keys", kinds: ["image"], llm: "https://api.openai.com/v1",
    key: /^sk-(proj-)?[A-Za-z0-9_-]{20,}$/, hint: "sk-…",
    models: { image: "gpt-image-1", llm: "gpt-4.1-mini" },
    note: "Pictures (GPT Image) and the LLM. OpenAI ended its video API (Sora) in September 2026." },
  gemini: { name: "Google Gemini", site: "https://aistudio.google.com/apikey", kinds: ["image"], llm: "https://generativelanguage.googleapis.com/v1beta/openai",
    key: /^AIza[0-9A-Za-z_-]{30,}$/, hint: "AIza…",
    models: { image: "gemini-2.5-flash-image", llm: "gemini-2.5-flash" },
    note: "Pictures (and picture edits) and the LLM. Its video models are not offered through the API keys bitGen uses." },
  // Tim: "can we add claude as well?" - the LLM only (Claude makes no pictures / video / songs): Anthropic's OpenAI-compatible
  // chat/completions (https://api.anthropic.com/v1, Bearer key; image_url pictures work - the vision LLM too). Claude 5 models
  // refuse temperature / top_p (400) and think by default: fitBody() drops those and keeps room for the answer.
  claude: { name: "Claude (Anthropic)", site: "https://platform.claude.com/settings/keys", kinds: [], llm: "https://api.anthropic.com/v1",
    key: /^sk-ant-[A-Za-z0-9_-]{20,}$/, hint: "sk-ant-…",
    models: { llm: "claude-sonnet-5-5" },
    note: "The LLM only - the screenplay writer, prompt help, picture descriptions and the shot list. Claude makes no pictures, video or songs." },
  runninghub: { name: "RunningHub", site: "https://www.runninghub.ai", kinds: ["image", "video", "music"], llm: "",
    key: /^[0-9a-f]{32}$/i, hint: "32 letters and digits",
    models: { image: "", video: "", music: "" },
    note: "ComfyUI workflows in the cloud: the Model is a workflow ID from runninghub.ai (the number in its address)." },
};
const KINDS = ["image", "video", "music"];
const KIND_WORD = { image: "pictures", video: "video", music: "songs" };

/** which service a pasted key is for ("" = not known by its shape) (pure). A 32-character hex key could be another
 *  service's too - RunningHub is only guessed when nothing else fits. */
function detect(key) {
  const k = String(key || "").trim();
  for (const id of ["openrouter", "fal", "replicate", "gemini", "claude", "openai", "runninghub"]) if (SERVICES[id].key.test(k)) return id;
  return "";
}
function newId(have) {
  for (;;) { const id = Math.random().toString(36).slice(2, 10).padEnd(8, "0"); if (!(have || {})[id]) return id; }
}
const clean = (s, n) => String(s == null ? "" : s).replace(/[\u0000-\u001f]/g, "").trim().slice(0, n || 80);
const safeName = (s) => clean(s, 40).replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
/** an API as the page sees it - never the key, only whether there is one and its last 4 (pure) */
function view(id, a) {
  const svc = SERVICES[a.service] || {}, key = String(a.key || "");
  return { id, name: a.name, service: a.service, service_name: svc.name || a.service, use: !!a.use, llm: !!a.llm,
    has_key: !!key, key_end: key ? key.slice(-4) : "", base: a.base || "", models: Object.assign({}, svc.models || {}, a.models || {}),
    kinds: svc.kinds || [], can_llm: !!svc.llm, site: svc.site || "", note: svc.note || "" };
}
/** the API_ style for one API + kind (pure) */
function styleFor(id, a, kind) {
  const svc = SERVICES[a.service] || { models: {} };
  return { name: "API_" + safeName(a.name) + (svc.kinds.length > 1 ? " " + KIND_WORD[kind] : ""), kind, runs_on: "api", api_id: id,
    api_model: clean(((a.models || {})[kind]) || svc.models[kind] || "", 200), api_auto: true };
}
/** the LLM target for an API marked "Use for the LLM" (pure) - null when none */
function llmTargetOf(apis, kind) {
  for (const [id, a] of Object.entries(apis || {})) {
    const svc = SERVICES[a.service];
    if (!a.use || !a.llm || !svc || !svc.llm || !a.key) continue;
    const model = clean(((a.models || {}).llm) || svc.models.llm || "", 200);
    if (!model) continue;
    return { url: (a.base || svc.llm).replace(/\/+$/, "") + "/chat/completions", model,
      headers: Object.assign({ Authorization: "Bearer " + a.key }, a.service === "openrouter" ? { "HTTP-Referer": "https://tigerart.com.au", "X-OpenRouter-Title": "bitGen Studio" } : {}),
      label: (svc.name || a.service) + " " + model + " (Settings ▸ API ▸ " + a.name + ")", api_id: id, kind,
      ...(a.service === "claude" ? { drop: ["temperature", "top_p", "n", "chat_template_kwargs"], min_tokens: 2048 } : {}) };
  }
  return null;
}

/* ---------------- live */
function core() { return require("./core"); }
function apis() { const c = core().getConfig() || {}; return (c.apis && typeof c.apis === "object" && !Array.isArray(c.apis)) ? c.apis : {}; }
function list() { return { apis: Object.entries(apis()).map(([id, a]) => view(id, a)), services: Object.entries(SERVICES).map(([id, s]) => ({ id, name: s.name, kinds: s.kinds, llm: !!s.llm, hint: s.hint, site: s.site, note: s.note, models: s.models })) }; }
function bad(m, st) { const e = new Error(m); e.status = st || 400; return e; }
function save(next) { const c = core().getConfig(); c.apis = next; core().setConfig(c); }

function add(b) {
  const o = b || {}, key = clean(o.key, 400), name = safeName(o.name);
  if (!key) throw bad("paste the API key first");
  const service = o.service && o.service !== "auto" ? String(o.service) : detect(key);
  if (!SERVICES[service]) throw bad("bitGen does not know this key's service - pick it in the list");
  if (!name) throw bad("give it a name (it becomes the API_ styles' name)");
  const all = Object.assign({}, apis());
  if (Object.values(all).some((a) => a.name.toLowerCase() === name.toLowerCase())) throw bad("an API with that name is there already", 409);
  const id = newId(all);
  all[id] = { name, service, use: false, llm: false, base: clean(o.base, 200), models: {}, key };
  save(all);
  if (o.use) return change(id, SERVICES[service].kinds.length ? { use: true } : { use: true, llm: true });   // Claude: Use = the LLM
  return { api: view(id, all[id]), styles: [] };
}
/** {use, llm, name, key, base, models: {kind: id}} */
function change(id, b) {
  const all = Object.assign({}, apis()), a = all[id];
  if (!a) throw bad("there is no such API", 404);
  const o = b || {}, svc = SERVICES[a.service];
  const n = Object.assign({}, a, { models: Object.assign({}, a.models || {}) });
  if (o.name != null) { const nm = safeName(o.name); if (!nm) throw bad("a name, please"); n.name = nm; }
  if (o.key != null && clean(o.key, 400)) n.key = clean(o.key, 400);
  if (o.base != null) n.base = clean(o.base, 200);
  if (o.models && typeof o.models === "object") for (const k of [...KINDS, "llm"]) if (o.models[k] != null) n.models[k] = clean(o.models[k], 200);
  if (o.use != null) n.use = !!o.use;
  if (o.llm != null) {
    if (o.llm && !svc.llm) throw bad(svc.name + " has no LLM bitGen can use - pick OpenRouter, OpenAI or Google Gemini for that");
    n.llm = !!o.llm;
    if (n.llm) for (const k of Object.keys(all)) if (k !== id && all[k].llm) all[k] = Object.assign({}, all[k], { llm: false });   // one LLM at a time
  }
  all[id] = n; save(all);
  const styles = syncStyles(id, n, a);
  return { api: view(id, n), styles };
}
function remove(id) {
  const all = Object.assign({}, apis()), a = all[id];
  if (!a) throw bad("there is no such API", 404);
  syncStyles(id, Object.assign({}, a, { use: false }), a);
  delete all[id]; save(all);
  return { ok: true };
}
/** Use ticked = its API_ styles exist (renamed with it; the Model kept if you changed it there); unticked = the ones it
 *  made are removed (a style you made yourself with Runs on: API stays) -> the names now there */
function syncStyles(id, a, before) {
  const S = require("./styles"), dir = core().STYLES_DIR, svc = SERVICES[a.service];
  const mine = S.read(dir).filter((s) => s.runs_on === "api" && s.api_id === id && s.api_auto);
  if (!a.use) { for (const s of mine) { try { S.remove(dir, s.id); } catch { /* gone */ } } return []; }
  const out = [];
  for (const kind of svc.kinds) {
    const want = styleFor(id, a, kind), have = mine.find((s) => s.kind === kind);
    try {
      if (have) {
        const patch = { name: want.name };
        if (before && before.models && a.models && before.models[kind] !== a.models[kind] && a.models[kind]) patch.api_model = a.models[kind];
        out.push(S.save(dir, Object.assign({}, have, patch)).name);
      } else out.push(S.save(dir, want).name);
    } catch (e) { out.push("✗ " + want.name + ": " + (e.message || e)); }
  }
  return out;
}
/** ✓ Test: the key against the service (a list of models, or the account) -> {ok, line} */
async function test(id) {
  const a = apis()[id]; if (!a) throw bad("there is no such API", 404);
  const svc = SERVICES[a.service], base = (process.env["H3_API_BASE_" + a.service.toUpperCase()] || "").replace(/\/+$/, "");
  const get = async (url, headers, method, body) => {
    const r = await fetch(url, { method: method || "GET", headers, body, signal: AbortSignal.timeout(20000) });
    const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch { /* not JSON */ }
    return { status: r.status, j, t };
  };
  try {
    let r;
    if (a.service === "openrouter") r = await get((base || "https://openrouter.ai/api/v1") + "/key", { Authorization: "Bearer " + a.key });
    else if (a.service === "openai") r = await get((base || "https://api.openai.com/v1") + "/models", { Authorization: "Bearer " + a.key });
    else if (a.service === "gemini") r = await get((base || "https://generativelanguage.googleapis.com/v1beta") + "/models?pageSize=5", { "x-goog-api-key": a.key });
    else if (a.service === "claude") r = await get((base || "https://api.anthropic.com/v1") + "/models?limit=1", { "x-api-key": a.key, "anthropic-version": "2023-06-01" });
    else if (a.service === "replicate") r = await get((base || "https://api.replicate.com/v1") + "/account", { Authorization: "Bearer " + a.key });
    else if (a.service === "fal") r = await get((base || "https://api.fal.ai/v1") + "/models?limit=1", { Authorization: "Key " + a.key });
    else if (a.service === "runninghub") r = await get((base || a.base || "https://www.runninghub.ai").replace(/\/+$/, "") + "/uc/openapi/accountStatus", { "Content-Type": "application/json" }, "POST", JSON.stringify({ apikey: a.key }));
    if (r.status === 401 || r.status === 403) return { ok: false, error: svc.name + " refused the key" };
    if (a.service === "runninghub" && r.j && r.j.code !== 0) return { ok: false, error: "RunningHub: " + (r.j.msg || "refused the key") };
    if (r.status >= 400) return { ok: false, error: svc.name + " answered HTTP " + r.status };
    return { ok: true, line: svc.name + " accepted the key" + (a.service === "runninghub" && r.j && r.j.data && r.j.data.remainCoins != null ? " · " + r.j.data.remainCoins + " coins left" : "") };
  } catch (e) { return { ok: false, error: svc.name + " could not be reached (" + (e.message || e) + ")" }; }
}
/** the live LLM target - H3_API_BASE_<SERVICE> (the tests' stand-ins) beats the service's address */
function llmTarget(kind) {
  const all = {};
  for (const [id, a] of Object.entries(apis())) { const env = process.env["H3_API_BASE_" + String(a.service).toUpperCase()]; all[id] = env ? Object.assign({}, a, { base: env }) : a; }
  return llmTargetOf(all, kind);
}
/** a chat body made for the target (pure): the fields its service refuses dropped, room for the answer (Claude thinks
 *  before it answers - a 300-token budget could be spent before a word is written) */
function fitBody(target, body) {
  const t = target || {}, b = Object.assign({}, body);
  for (const k of t.drop || []) delete b[k];
  if (t.min_tokens) b.max_tokens = Math.max(+b.max_tokens || 0, t.min_tokens);
  return b;
}

module.exports = { SERVICES, KINDS, detect, newId, view, styleFor, llmTargetOf, fitBody, list, add, change, remove, syncStyles, test, llmTarget };
