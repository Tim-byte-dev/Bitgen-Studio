/* bitGen Studio — lib/llmRepos.js (2.782.0): YOUR LLMs FROM HUGGING FACE FOR YOUR RUNPOD POD - a repo's GGUF picked, sent to the
 * pod (lib/podLlm.js puts llama.cpp there and runs it), and - when you say so - kept in YOUR LIST under the LLM's name.
 *
 * Tim (verbatim): "can we upload llama.cpp to the pod and select an llm from a hf repo to send to the pod. ask the user if they
 * want to save the repo. if they save it add it to a list of repos with the llm name. if user selects runpod for llm then show only
 * this list in the llm dropdown, same with vllm. Check with user if they want to create a separate pod for the llm/vllm or use the
 * existing one. we should be able to run our llm, vllm,image and video of 1 pod by clearing vram before a new model loads and
 * increasing the space"
 *
 *   THE LIST    <bitGen>/runpod/pods/llm_repos.json (H3_LLM_REPOS = the tests' file) - {v: 1, repos: [entry]}; entry =
 *               {id, kind: "llm" | "vlm" (vision), name, repo ("owner/name"), file (a GGUF in the repo - the first part of a
 *               split one), parts (every part, in order), mmproj (vision), size, mm_size, at}
 *   THE PICK    rgpu.llm_repo_pick = {llm, vlm}: the entry the pod runs - a saved id, or "hf" = rgpu.llm_hf[kind] (sent, not saved)
 *   hfFiles(repo)   the repo's GGUFs from Hugging Face's own API (your token for a gated / private one) ->
 *               {repo, models: [{file, size, parts, quant}], mmprojs: [{file, size}]}
 *   use(kind, x)    the pick made (not saved yet) -> the entry; save(kind, x) -> the saved entry (same repo + file = updated)
 *   remove(id), list(kind), picked(kind) -> entry | null, files(entry) -> [{name, url, size}] for the pod's job
 *   grow(podId, gb) RunPod makes the pod's volume that big (REST v2 PATCH /pods/{id} {mounts: {persistent: {size}}} - it may restart the pod)
 * Pure (scripts/test-llmrepos782.js): repoOf, quantOf, nameOf, splitParts, filesOfTree, clean.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const KINDS = ["llm", "vlm"];
function core() { return require("./core"); }
function FILE() { return process.env.H3_LLM_REPOS || path.join(core().BASE, "runpod", "pods", "llm_repos.json"); }
const HF = () => (process.env.H3_HF_BASE || "https://huggingface.co").replace(/\/+$/, "");

/* ---------------- pure */
/** "owner/name" from what was typed or pasted (a huggingface.co address too) -> "" when it is not one */
function repoOf(s) {
  let t = String(s || "").trim().replace(/^(https?:\/\/)?(www\.)?(hf\.co|huggingface\.co)\//i, "").replace(/[?#].*$/, "");
  t = t.replace(/\/(tree|blob|resolve)\/.*$/, "").replace(/\/+$/, "");
  const m = /^([A-Za-z0-9][\w.-]{0,95})\/([A-Za-z0-9][\w.-]{0,95})$/.exec(t);
  return m ? m[1] + "/" + m[2] : "";
}
/** the quantisation in a GGUF's name (Q4_K_M, IQ3_XXS, F16, BF16, Q8_0 …) */
function quantOf(f) { const m = /(?:^|[-_.])((?:I?Q\d+(?:_[A-Z0-9]+)*)|BF16|F16|F32|MXFP4(?:_MOE)?)(?=[-_.]|$)/i.exec(String(f || "").split("/").pop().replace(/\.gguf$/i, "")); return m ? m[1].toUpperCase() : ""; }
/** a readable name: "unsloth/Qwen3-8B-GGUF" + "Qwen3-8B-Q4_K_M.gguf" -> "Qwen3 8B (Q4_K_M)" */
function nameOf(repo, file) {
  const base = String(repo || "").split("/").pop().replace(/[-_.]?gguf$/i, "") || String(file || "").split("/").pop().replace(/\.gguf$/i, "");
  const q = quantOf(file);
  return (base.replace(/[-_]+/g, " ").trim() + (q ? " (" + q + ")" : "")).slice(0, 80);
}
/** a split GGUF's parts: "x-00001-of-00003.gguf" + the repo's files -> every part in order (one file = [it]) */
function splitParts(file, all) {
  const m = /^(.*-)(\d{5})-of-(\d{5})(\.gguf)$/i.exec(String(file || ""));
  if (!m) return [String(file)];
  const n = +m[3], out = [];
  for (let i = 1; i <= n; i++) out.push(m[1] + String(i).padStart(5, "0") + "-of-" + m[3] + m[4]);
  const have = new Set((all || []).map(String));
  return out.every((p) => have.has(p)) ? out : [String(file)];
}
/** Hugging Face's tree listing -> {models, mmprojs}: one row per model (a split one by its first part, the size of all parts) */
function filesOfTree(tree) {
  const files = (Array.isArray(tree) ? tree : []).filter((x) => x && x.type !== "directory" && /\.gguf$/i.test(String(x.path || "")));
  const sizeOf = new Map(files.map((x) => [String(x.path), +((x.lfs && x.lfs.size) || x.size || 0)]));
  const names = files.map((x) => String(x.path));
  const models = [], mmprojs = [];
  for (const f of names) {
    if (/mmproj/i.test(f.split("/").pop())) { mmprojs.push({ file: f, size: sizeOf.get(f) || 0 }); continue; }
    const sp = /-(\d{5})-of-\d{5}\.gguf$/i.exec(f);
    if (sp && sp[1] !== "00001") continue;
    const parts = splitParts(f, names);
    models.push({ file: f, parts, size: parts.reduce((a, p) => a + (sizeOf.get(p) || 0), 0), quant: quantOf(f) });
  }
  const rank = (q) => { const o = ["Q4_K_M", "Q5_K_M", "Q4_K_S", "Q6_K", "Q8_0", "Q3_K_M", "IQ4_XS", "Q4_0", "Q5_K_S"]; const i = o.indexOf(q); return i < 0 ? 99 : i; };
  models.sort((a, b) => rank(a.quant) - rank(b.quant) || a.size - b.size || a.file.localeCompare(b.file));
  mmprojs.sort((a, b) => (/f16/i.test(b.file) ? 1 : 0) - (/f16/i.test(a.file) ? 1 : 0) || a.size - b.size);
  return { models, mmprojs };
}
const okFile = (f) => /^[^\0]{1,300}\.gguf$/i.test(String(f || "")) && !String(f).split("/").some((p) => p === ".." || p === ".");
/** an entry made safe; null when it is not one */
function clean(x) {
  const o = x || {}, kind = KINDS.includes(o.kind) ? o.kind : "llm", repo = repoOf(o.repo), file = String(o.file || "");
  if (!repo || !okFile(file)) return null;
  const parts = (Array.isArray(o.parts) && o.parts.length ? o.parts : [file]).map(String).filter(okFile).slice(0, 64);
  const mm = o.mmproj && okFile(o.mmproj) ? String(o.mmproj) : "";
  return { id: String(o.id || "").replace(/[^\w-]/g, "").slice(0, 40) || "", kind, name: String(o.name || nameOf(repo, file)).replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 80) || nameOf(repo, file),
    repo, file, parts: parts.length ? parts : [file], mmproj: kind === "vlm" ? mm : "", size: +o.size || 0, mm_size: kind === "vlm" ? +o.mm_size || 0 : 0, at: +o.at || Date.now() };
}

/* ---------------- the list */
function load() { try { const j = JSON.parse(fs.readFileSync(FILE(), "utf8")); return (j.repos || []).map(clean).filter(Boolean); } catch { return []; } }
function write(list) { const f = FILE(); fs.mkdirSync(path.dirname(f), { recursive: true }); const t = f + ".part"; fs.writeFileSync(t, JSON.stringify({ v: 1, repos: list }, null, 1)); fs.renameSync(t, f); }
function list(kind) { const L = load(); return kind ? L.filter((e) => e.kind === kind) : L; }
function rg() { return ((core().getConfig() || {}).rgpu) || {}; }
function setRg(fn) { const c = core().getConfig(); c.rgpu = c.rgpu || {}; fn(c.rgpu); core().setConfig(c); }
/** the entry the pod runs for a kind */
function picked(kind) {
  const r = rg(), p = String((r.llm_repo_pick || {})[kind] || "");
  if (!p) return null;
  if (p === "hf") return clean(Object.assign({ id: "hf" }, (r.llm_hf || {})[kind] || {}));
  return load().find((e) => e.id === p && e.kind === kind) || null;
}
function pick(kind, id) {
  const k = KINDS.includes(kind) ? kind : "llm";
  setRg((r) => { r.llm_repo_pick = Object.assign({}, r.llm_repo_pick || {}, { [k]: String(id || "") }); });
  try { const S = require("./podLlm").STATE[k]; if (S && S.phase === "ready") S.phase = "stale"; } catch { /* fine */ }
}
/** the pick made from Hugging Face (not saved) */
function use(kind, x) {
  const e = clean(Object.assign({}, x, { kind }));
  if (!e) { const er = new Error("pick a repo and one of its GGUF files"); er.status = 400; throw er; }
  e.id = "hf";
  setRg((r) => { r.llm_hf = Object.assign({}, r.llm_hf || {}, { [e.kind]: e }); });
  pick(e.kind, "hf");
  return e;
}
/** kept in your list under its name (the same repo + file = that entry, renamed) - and picked */
function save(kind, x) {
  const e = clean(Object.assign({}, x, { kind }));
  if (!e) { const er = new Error("pick a repo and one of its GGUF files"); er.status = 400; throw er; }
  const L = load(), i = L.findIndex((y) => y.kind === e.kind && y.repo.toLowerCase() === e.repo.toLowerCase() && y.file === e.file);
  if (i >= 0) { e.id = L[i].id; L[i] = e; } else { e.id = "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); L.push(e); }
  write(L); pick(e.kind, e.id);
  return e;
}
function remove(id) {
  const L = load(), e = L.find((y) => y.id === id);
  if (!e) { const er = new Error("not in your list"); er.status = 404; throw er; }
  write(L.filter((y) => y.id !== id));
  if ((rg().llm_repo_pick || {})[e.kind] === id) pick(e.kind, "");
  return { removed: id };
}
/** what the pod's job downloads: every part (+ the mmproj) from Hugging Face */
function files(e) {
  const tok = String((((core().getConfig() || {}).hf) || {}).token || "");
  const url = (f) => `${HF()}/${e.repo}/resolve/main/${String(f).split("/").map(encodeURIComponent).join("/")}`;
  const out = e.parts.map((p, i) => ({ name: p.split("/").pop(), url: url(p), size: i === 0 && e.parts.length === 1 ? e.size : 0, from: "Hugging Face", token: tok }));
  if (e.mmproj) out.push({ name: e.mmproj.split("/").pop(), url: url(e.mmproj), size: e.mm_size || 0, from: "Hugging Face", token: tok });
  return out;
}
/** a repo's GGUF files, from Hugging Face's API */
async function hfFiles(repo0) {
  const repo = repoOf(repo0);
  if (!repo) { const e = new Error("type a Hugging Face repo as owner/name (for example unsloth/Qwen3-8B-GGUF) or paste its address"); e.status = 400; throw e; }
  const tok = String((((core().getConfig() || {}).hf) || {}).token || "");
  const r = await fetch(`${HF()}/api/models/${repo}/tree/main?recursive=true`, { headers: Object.assign({ "User-Agent": "bitGen-Studio" }, tok ? { Authorization: "Bearer " + tok } : {}) });
  if (r.status === 401 || r.status === 403) { const e = new Error(`${repo} is private or gated - accept its licence on Hugging Face and add your token (Settings ▸ Models)`); e.status = 403; throw e; }
  if (r.status === 404) { const e = new Error(`Hugging Face has no repo called ${repo}`); e.status = 404; throw e; }
  if (!r.ok) { const e = new Error(`Hugging Face answered HTTP ${r.status}`); e.status = 502; throw e; }
  const out = Object.assign({ repo }, filesOfTree(await r.json()));
  if (!out.models.length) { const e = new Error(`${repo} has no GGUF files - llama.cpp needs a GGUF (look for a repo whose name ends in -GGUF)`); e.status = 404; throw e; }
  return out;
}
/** RunPod makes the pod's volume `gb` big (only bigger) */
async function grow(podId, gb) {
  const id = String(podId || "").replace(/[^A-Za-z0-9]/g, ""), n = Math.round(+gb || 0);
  if (!id || !(n >= 10 && n <= 4000)) { const e = new Error("a pod and a size from 10 to 4000 GB"); e.status = 400; throw e; }
  const RA = require("./runpodApi"), key = String(((rg().runpod || {}).key) || "").trim();
  const cur = await RA.pod(id, key).catch(() => null);
  const now = cur ? +((((cur.mounts || {}).persistent || {}).size) || cur.volumeInGb || 0) : 0;   // 2.807.0: REST v2 mounts.persistent.size
  if (now && n <= now) { const e = new Error(`the pod's volume is ${now} GB already - pick a bigger size`); e.status = 400; throw e; }
  await RA.update(id, { mounts: { persistent: { size: n } } }, key);   // 2.807.0: REST v2 (v1's volumeInGb is refused - unknown properties)
  try { require("./podActivity").note(id, `volume made ${n} GB (was ${now || "?"} GB) - RunPod may restart the pod`); } catch { /* fine */ }
  return { ok: true, pod_id: id, volume_gb: n, was: now };
}
module.exports = { KINDS, FILE, repoOf, quantOf, nameOf, splitParts, filesOfTree, clean, load, list, picked, pick, use, save, remove, files, hfFiles, grow };
