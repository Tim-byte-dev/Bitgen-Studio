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
  return r.llm_provider === "runpod" && (r.vllm || {}).endpoint ? "" : "openrouter";
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
    try { out.models = (await OR.list({ free: true, vision: kind === "vlm" })).models.map((m) => ({ id: m.id, name: m.name, note: m.ctx ? Math.round(m.ctx / 1000) + "k context" : "" })); }
    catch (e) { out.error = String((e && e.message) || e); }
    // a model picked before (a paid one) stays listed
    if (out.current && !out.models.some((m) => m.id === out.current)) out.models.unshift({ id: out.current, name: out.current, note: "picked before" });
    return out;
  }
  const G = require("./gpuSplit");
  if (G.engineOf(r).pods) {
    const cur = String((r.llm_pick || {})[kind] || (kind === "llm" ? ((core().getConfig() || {}).llm || {}).last_file || "" : ""));
    const models = catalogLlms(catalog(), kind);
    return { kind, host, label: "RunPod pod", models, current: models.some((m) => m.id === cur) ? cur : "", note: "set up on your pod when you send a prompt (the first time takes a few minutes)" };
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
