/* bitGen Studio — lib/remoteLlm.js (2.768.0): IN REMOTE MODE THE PROMPT DOCKER'S LLM / VISION LISTS ARE THE REMOTE HOST'S MODELS.
 *
 * Tim (verbatim): "move all the remote gpu options to the remote gpu docker, when in remote mode clear the llm and vllm
 * dropdown lists in prompt docker add the list of free llm and vl models from openrouter(default) or the selected host in
 * our prompt llm and vllm dropdowns."
 *
 *   hostOf(rgpu, kind)   where the LLM / vision LLM runs (pure): "" = this computer (Local mode, or Both / an old set-up that
 *                        decides the old way - lib/gpuSplit.js), "openrouter" | "runpod" (☁ Remote generation docker ▸ LLM /
 *                        Vision LLM). Remote mode with nothing picked = OpenRouter (Tim: "openrouter(default)") - unless the
 *                        LLM was set to RunPod's vLLM endpoint before 2.767.0 (rgpu.llm_provider "runpod" + rgpu.vllm.endpoint):
 *                        that keeps working.
 *   lists()              per kind {host, models: [{id, name, note}], current, note}:
 *                          openrouter   OpenRouter's FREE models (vision ones for the vision LLM), free of any key to list;
 *                                       current = Settings' model / vision model
 *                          runpod Pods  the GGUFs bitGen can put on the pod (lib/modelCatalog.json's LLMs - the vision ones
 *                                       with their mmproj); current = rgpu.llm_pick (else the LLM file picked here before)
 *                          runpod Serverless  the vLLM endpoint's model (one - it serves one)
 *   pick(kind, id)       the dropdown's choice saved: OpenRouter's model / vision model; the pod's GGUF (rgpu.llm_pick - its
 *                        LLM on the pod is set up again with it at the next prompt)
 *   fileFor(kind)        the pod's pick for lib/podLlm.js filesFor -> {model, mmproj} | null
 * Pure: hostOf, catalogLlms, mmprojFor. Node: scripts/test-remotellm768.js. Routes: routes/remoteLlm.js.
 */
"use strict";
const KINDS = ["llm", "vlm"];

/* ---------------- pure */
function hostOf(rgpu, kind) {
  const r = rgpu || {}, G = require("./gpuSplit");
  const s = r.split || {}, where = ["remote", "both"].includes(s.where) ? s.where : "local";
  if (!G.enabledOf(r) || where === "local") return "";
  const w = require("./podLlm").whereOf(r, kind);
  if (w) return w === "local" ? "" : w;
  if (where !== "remote") return "";
  return require("./podLlm").providerOf(r);   // 2.770.0: the platform Settings picks - OpenRouter by default
}
const isMm = (f) => /mmproj/i.test(String(f || ""));
const isVision = (e) => /(^|[^a-z])(vl|vision)([^a-z]|$)/i.test(String(e.file || "") + " " + String(e.id || "") + " " + String(e.label || ""));
/** the catalog's GGUF LLMs (pure): kind "llm" = text, "vlm" = vision (an mmproj beside them) -> [{id, name, note}] */
function catalogLlms(catalog, kind) {
  return (catalog || []).filter((e) => e && e.file && /\.gguf$/i.test(e.file) && (e.llm || e.group === "llm") && !isMm(e.file) && (kind === "vlm" ? isVision(e) : !isVision(e)))
    .map((e) => ({ id: String(e.as || String(e.file).split("/").pop()), name: String(e.label || e.file).replace(/^Assistant LLM - /, ""), note: e.size ? Math.round(e.size / 1e8) / 10 + " GB" : "" }));
}
/** the mmproj that goes with a vision GGUF (pure): the catalog's mmproj with the same name up to its first "." */
function mmprojFor(catalog, name) {
  const stem = String(name || "").split(".")[0].toLowerCase();
  if (!stem) return "";
  const m = (catalog || []).find((e) => e && e.file && isMm(e.file) && String(e.as || String(e.file).split("/").pop()).toLowerCase().startsWith(stem));
  return m ? String(m.as || String(m.file).split("/").pop()) : "";
}

/* ---------------- live */
function core() { return require("./core"); }
function rg() { return ((core().getConfig() || {}).rgpu) || {}; }
function catalog() { try { return JSON.parse(require("fs").readFileSync(require("path").join(core().BASE, "lib", "modelCatalog.json"), "utf8")).models || []; } catch { return []; } }
function fileFor(kind) {
  // 2.782.0: the LLM picked from YOUR LIST (lib/llmRepos.js - a Hugging Face repo's GGUF) - the pod downloads it from there
  try {
    const LR = require("./llmRepos"), e = LR.picked(kind);
    if (e) return { model: e.parts[0].split("/").pop(), mmproj: e.mmproj ? e.mmproj.split("/").pop() : "", files: LR.files(e), name: e.name, repo: e.repo };
  } catch { /* the older way below */ }
  const p = String((rg().llm_pick || {})[kind] || "");
  if (!p) return null;
  return { model: p, mmproj: kind === "vlm" ? mmprojFor(catalog(), p) : "" };
}
async function one(kind) {
  const r = rg(), host = hostOf(r, kind);
  if (!host) return { kind, host: "" };
  if (host === "openrouter") {
    const OR = require("./openRouter"), c = OR.cfg();
    const out = { kind, host, label: "OpenRouter", models: [], current: kind === "vlm" ? c.vlm_model : c.model, note: c.key ? "" : "OpenRouter needs an API key (free to make) - ☁ Remote generation ▸ ⚙ Settings ▸ Remote generation ▸ 🧠 LLM ▸ OpenRouter" };
    // 2.770.0 (Tim: "checkbox show paid, show free, add the list to the dropdowns"): free and / or paid as Settings says
    try { out.models = (await OR.list({ show: { free: c.show_free, paid: c.show_paid }, vision: kind === "vlm" })).models.map((m) => ({ id: m.id, name: m.name, free: m.free, note: (m.free ? "free" : m.in != null ? "$" + m.in + "/$" + m.out + " per M" : "") + (m.ctx ? " · " + Math.round(m.ctx / 1000) + "k" : "") })); }
    catch (e) { out.error = String((e && e.message) || e); }
    // 2.786.0: YOUR OpenRouter models (☁ OpenRouter models… - lib/orModels.js) first, marked ★
    try { const mine = (require("./orModels").mine()[kind] || []).filter((m) => !m.dead);   // 2.792.0: not a dead one
      out.models = mine.map((m) => ({ id: m.id, name: "★ " + m.name, free: !!m.free, mine: true, note: (m.price || (m.free ? "free" : "")) + (m.ctx ? " · " + Math.round(m.ctx / 1000) + "k" : "") }))
        .concat(out.models.filter((m) => !mine.some((x) => x.id === m.id))); } catch { /* the list as it was */ }
    // a model picked before (a paid one) stays listed
    if (out.current && !out.models.some((m) => m.id === out.current)) out.models.unshift({ id: out.current, name: out.current, note: "picked before" });
    return out;
  }
  const G = require("./gpuSplit");
  if (G.engineOf(r).pods) {
    // 2.782.0 (Tim: "if user selects runpod for llm then show only this list in the llm dropdown, same with vllm"): YOUR LIST
    // (lib/llmRepos.js) - and the one sent from Hugging Face but not saved; "＋ From Hugging Face…" adds (static/llmrepos.js)
    const LR = require("./llmRepos"), mine = LR.list(kind), cur = String((r.llm_repo_pick || {})[kind] || "");
    const models = mine.map((e) => ({ id: "repo:" + e.id, name: e.name, note: e.repo + (e.size ? " · " + (e.size / 1e9).toFixed(1) + " GB" : "") }));
    const hf = cur === "hf" ? LR.picked(kind) : null;
    if (hf) models.unshift({ id: "repo:hf", name: hf.name, note: hf.repo + " · not in your list" });
    return { kind, host, label: "RunPod pod", models, current: cur ? "repo:" + cur : "", hfAdd: true,
      note: models.length ? "set up on your pod when you send a prompt (the first time takes a few minutes)" : "your list is empty - ＋ From Hugging Face… adds an LLM" };
  }
  const v = G.vllm(), m = kind === "vlm" ? (v.vlm_model || (v.vlm_endpoint ? "" : v.model)) : v.model;
  return { kind, host, label: "RunPod vLLM", models: [{ id: m || "", name: m || "the endpoint's own model", note: "" }], current: m || "", fixed: true, note: v.endpoint ? "" : "the RunPod vLLM endpoint is not set up - Settings ▸ Remote generation" };
}
async function lists() {
  const out = {};
  for (const k of KINDS) out[k] = await one(k);
  return out;
}
function pick(kind, id) {
  const k = kind === "vlm" ? "vlm" : "llm", r = rg(), host = hostOf(r, k), v = String(id || "").trim().slice(0, 200);
  if (!host) { const e = new Error("the " + (k === "vlm" ? "vision LLM" : "LLM") + " runs on this computer"); e.status = 400; throw e; }
  if (host === "openrouter") { require("./openRouter").save(k === "vlm" ? { vlm_model: v } : { model: v }); return { ok: true, host, current: v }; }
  if (require("./gpuSplit").engineOf(r).pods && /^repo:/.test(v)) {   // 2.782.0: one of your list (lib/llmRepos.js)
    const id = v.slice(5), LR = require("./llmRepos");
    if (id !== "hf" && !LR.list(k).some((e) => e.id === id)) { const e = new Error("not in your list"); e.status = 404; throw e; }
    LR.pick(k, id);
    return { ok: true, host, current: v };
  }
  if (require("./gpuSplit").engineOf(r).pods) {
    if (!/^[\w.+ -]+\.gguf$/i.test(v)) { const e = new Error("not a GGUF file name"); e.status = 400; throw e; }
    const c = core().getConfig(); c.rgpu = c.rgpu || {}; c.rgpu.llm_pick = Object.assign({}, c.rgpu.llm_pick || {}, { [k]: v }); core().setConfig(c);
    const S = require("./podLlm").STATE[k];
    if (S && S.phase === "ready" && S.file !== v) S.phase = "stale";   // set up again with the new file at the next prompt
    return { ok: true, host, current: v };
  }
  return { ok: true, host, current: v, fixed: true };
}
module.exports = { KINDS, hostOf, catalogLlms, mmprojFor, fileFor, lists, pick };
