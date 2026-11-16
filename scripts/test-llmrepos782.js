#!/usr/bin/env node
/* bitGen Studio — 2.782.0: YOUR LLMs FROM HUGGING FACE FOR YOUR POD (lib/llmRepos.js, routes/llmRepos.js, static/llmrepos.js) -
 * the RunPod LLM / Vision lists show only your list (lib/remoteLlm.js), the pod picked for it (rgpu.llm_pod), the pod's job downloads
 * the repo's files (lib/podLlm.js), and ONE POD for the LLM, vision LLM, pictures and video: the pod's node swaps the card (a render
 * stops llama-server, a chat unloads ComfyUI's models and starts it again); the pod's volume made bigger (RunPod PATCH /pods/{id}).
 * Tim (verbatim): "can we upload llama.cpp to the pod and select an llm from a hf repo to send to the pod. ask the user if they want
 * to save the repo. if they save it add it to a list of repos with the llm name. if user selects runpod for llm then show only this
 * list in the llm dropdown, same with vllm. Check with user if they want to create a separate pod for the llm/vllm or use the existing
 * one. we should be able to run our llm, vllm,image and video of 1 pod by clearing vram before a new model loads and increasing the
 * space" */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os"), http = require("http");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const rd = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "lr782-"));
process.env.H3_LLM_REPOS = path.join(TMP, "llm_repos.json");
let CFG = { rgpu: { enabled: true, split: { where: "remote" }, engine: { provider: "runpod", runpod: "pods" }, llm_where: { llm: "runpod", vlm: "runpod" } }, hf: { token: "hf_x" } };
require.cache[require.resolve("../lib/core")] = { id: "core", filename: "core", loaded: true, exports: { BASE: TMP, getConfig: () => CFG, setConfig: (c) => { CFG = c; } } };
const LR = require("../lib/llmRepos"), RL = require("../lib/remoteLlm"), PL = require("../lib/podLlm"), PG = require("../static/llmrepos.js");

(async () => {
  check("repoOf: owner/name, or its huggingface.co / hf.co address (tree / blob paths dropped); anything else = \"\"",
    LR.repoOf("unsloth/Qwen3-8B-GGUF") === "unsloth/Qwen3-8B-GGUF" && LR.repoOf("https://huggingface.co/unsloth/Qwen3-8B-GGUF/tree/main") === "unsloth/Qwen3-8B-GGUF" && LR.repoOf("hf.co/bartowski/x-GGUF?y=1") === "bartowski/x-GGUF" && LR.repoOf("../etc/passwd") === "" && LR.repoOf("one") === "");
  check("quantOf / nameOf", LR.quantOf("Qwen3-8B-Q4_K_M.gguf") === "Q4_K_M" && LR.quantOf("a-UD-IQ3_XXS.gguf") === "IQ3_XXS" && LR.quantOf("m-BF16.gguf") === "BF16" && LR.nameOf("unsloth/Qwen3-8B-GGUF", "Qwen3-8B-Q4_K_M.gguf") === "Qwen3 8B (Q4_K_M)");
  const TREE = [{ type: "directory", path: "BF16" }, { type: "file", path: "README.md", size: 9 },
    { type: "file", path: "Qwen3-8B-Q8_0.gguf", size: 8.7e9, lfs: { size: 8.7e9 } }, { type: "file", path: "Qwen3-8B-Q4_K_M.gguf", lfs: { size: 5.0e9 } },
    { type: "file", path: "BF16/Qwen3-8B-BF16-00001-of-00002.gguf", lfs: { size: 9e9 } }, { type: "file", path: "BF16/Qwen3-8B-BF16-00002-of-00002.gguf", lfs: { size: 7.4e9 } },
    { type: "file", path: "mmproj-BF16.gguf", lfs: { size: 0.9e9 } }, { type: "file", path: "mmproj-F16.gguf", lfs: { size: 0.85e9 } }];
  const T = LR.filesOfTree(TREE);
  check("filesOfTree: GGUFs only, Q4_K_M first, a split model as ONE row with every part and their size, the projectors apart (F16 first)",
    T.models.map((m) => m.file).join("|") === "Qwen3-8B-Q4_K_M.gguf|Qwen3-8B-Q8_0.gguf|BF16/Qwen3-8B-BF16-00001-of-00002.gguf"
    && T.models[2].parts.length === 2 && T.models[2].size === 16.4e9 && T.mmprojs[0].file === "mmproj-F16.gguf" && T.models[0].size === 5e9, T);
  check("clean: a path with .. is refused; a projector only for a vision LLM", LR.clean({ repo: "a/b", file: "../x.gguf" }) === null && LR.clean({ kind: "llm", repo: "a/b", file: "x.gguf", mmproj: "m.gguf" }).mmproj === "" && LR.clean({ kind: "vlm", repo: "a/b", file: "x.gguf", mmproj: "m.gguf" }).mmproj === "m.gguf");

  // sent, then saved
  const sent = LR.use("llm", { repo: "unsloth/Qwen3-8B-GGUF", file: "Qwen3-8B-Q4_K_M.gguf", size: 5e9, name: "Qwen3 8B (Q4_K_M)" });
  check("use: picked but NOT in your list yet (\"hf\")", sent.id === "hf" && CFG.rgpu.llm_repo_pick.llm === "hf" && LR.list("llm").length === 0 && LR.picked("llm").repo === "unsloth/Qwen3-8B-GGUF");
  let L = await RL.lists();
  check("the RunPod pod's LLM dropdown: only your list - here the unsaved one, said as not in your list, + the ＋ (hfAdd)", L.llm.models.length === 1 && L.llm.models[0].id === "repo:hf" && /not in your list/.test(L.llm.models[0].note) && L.llm.hfAdd && L.llm.current === "repo:hf", L.llm);
  const saved = LR.save("llm", Object.assign({}, sent, { name: "My Qwen" }));
  const sv2 = LR.save("vlm", { repo: "unsloth/Qwen3-VL-8B-Instruct-GGUF", file: "Q4.gguf", mmproj: "mmproj-F16.gguf", name: "Qwen VL" });
  L = await RL.lists();
  check("save: kept under its name, picked; the LLM list shows it, the vision list shows only vision ones", /^r/.test(saved.id) && CFG.rgpu.llm_repo_pick.llm === saved.id && L.llm.models.length === 1 && L.llm.models[0].name === "My Qwen" && L.llm.current === "repo:" + saved.id && L.vlm.models.length === 1 && L.vlm.models[0].name === "Qwen VL", L);
  check("…the same repo + file saved again = the same entry renamed", LR.save("llm", Object.assign({}, sent, { name: "Qwen again" })).id === saved.id && LR.list("llm").length === 1);
  const pk = RL.pick("llm", "repo:" + saved.id);
  check("RL.pick repo:<id> picks it; an unknown one is refused", pk.current === "repo:" + saved.id && (() => { try { RL.pick("llm", "repo:nope"); return false; } catch (e) { return e.status === 404; } })());
  const ff = RL.fileFor("vlm");
  check("fileFor -> what the pod downloads: every part + the projector from Hugging Face, your token",
    ff.model === "Q4.gguf" && ff.mmproj === "mmproj-F16.gguf" && ff.files.length === 2 && /\/unsloth\/Qwen3-VL-8B-Instruct-GGUF\/resolve\/main\/mmproj-F16\.gguf$/.test(ff.files[1].url) && ff.files[0].token === "hf_x", ff);
  const split = LR.files(LR.clean({ repo: "a/b", file: "BF16/m-00001-of-00002.gguf", parts: ["BF16/m-00001-of-00002.gguf", "BF16/m-00002-of-00002.gguf"] }));
  check("…a split model: every part, named as llama.cpp wants them side by side", split.map((f) => f.name).join("|") === "m-00001-of-00002.gguf|m-00002-of-00002.gguf" && /resolve\/main\/BF16\/m-00002-of-00002\.gguf$/.test(split[1].url));
  check("remove: off your list (and unpicked)", LR.remove(sv2.id).removed === sv2.id && !LR.list("vlm").length && CFG.rgpu.llm_repo_pick.vlm === "");
  CFG.rgpu.llm_pod = { llm: { pod_id: "pod9", pod_name: "LLM pod" } };
  check("the pod picked in the dialog runs it (before the older ticks)", PL.podFor("llm").id === "pod9" && PL.podFor("llm").name === "LLM pod");

  // Hugging Face's listing through a stand-in
  const srv = http.createServer((req, res) => {
    if (/\/api\/models\/gated\/x\//.test(req.url)) { res.writeHead(401); res.end(); return; }
    if (/\/api\/models\/none\/x\//.test(req.url)) { res.writeHead(404); res.end(); return; }
    if (/\/api\/models\/unsloth\/Qwen3-8B-GGUF\/tree\/main\?recursive=true/.test(req.url) && req.headers.authorization === "Bearer hf_x") { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(TREE)); return; }
    res.writeHead(500); res.end();
  }).listen(0);
  process.env.H3_HF_BASE = "http://127.0.0.1:" + srv.address().port;
  const H = await LR.hfFiles("https://huggingface.co/unsloth/Qwen3-8B-GGUF");
  const err = async (r) => { try { await LR.hfFiles(r); return ""; } catch (e) { return e.status + " " + e.message; } };
  check("hfFiles: the repo's GGUFs from Hugging Face's API (your token sent); gated / missing said", H.repo === "unsloth/Qwen3-8B-GGUF" && H.models.length === 3
    && /^403 .*accept its licence/.test(await err("gated/x")) && /^404 Hugging Face has no repo/.test(await err("none/x")) && /^400/.test(await err("nonsense")));
  srv.close();

  // the pod's side
  const N = PL.proxyNodeCode(), J = PL.jobCode({ kind: "llm", comfy_dir: "/c", comfy_port: 8188, files: [], model: "m.gguf", share: true });
  check("the pod's node swaps the card: a render (ComfyUI's prompt handler) stops the LLM servers when shared; a chat waits for ComfyUI to be idle, unloads its models, starts the server from its command",
    /add_on_prompt_handler\(_on_prompt\)/.test(N) && /if _share\(\):\\n            for k in PORTS:/.test(JSON.stringify(N)) && /get_tasks_remaining\(\) == 0/.test(N) && /mm\.unload_all_models\(\); mm\.soft_empty_cache\(True\)/.test(N) && /subprocess\.Popen\(c\['cmd'\]/.test(N) && /'v': VERSION/.test(N));
  check("…the job writes the command + share.json, frees ComfyUI before loading, and restarts ComfyUI when the pod has an older node",
    /'\.cmd\.json'/.test(J) && /share\.json/.test(J) && /if J\.get\('share', True\): free_comfy\(\)/.test(J) && /\/free'/.test(J) && /if ping_v\(\) == J\.get\('node_v', 1\): return 'loaded'/.test(J) && new RegExp('"node_v":' + PL.NODE_VERSION).test(JSON.parse(J.match(/J = json\.loads\((".*")\)/)[1])));
  // RunPod's volume
  const RA = require("../lib/runpodApi"), calls = [];
  const origCall = RA.call;
  CFG.rgpu.runpod = { key: "rk" };
  const fakeFetch = async (u, o) => { calls.push([o.method, u.replace(/^.*\/pods/, "/pods"), o.body]); return { ok: true, status: 200, text: async () => JSON.stringify({ id: "pod9", mounts: { persistent: { size: 40, path: "/workspace" } } }) }; };
  const g = await RA.update("pod9", { mounts: { persistent: { size: 80 } } }, "rk", { fetch: fakeFetch });
  check("runpodApi.update: REST v2 PATCH /pods/{id} {mounts: {persistent: {size}}} (2.807.0 - v1's volumeInGb refused by v2)", g.id === "pod9" && calls[0][0] === "PATCH" && calls[0][1] === "/pods/pod9" && /"mounts":\{"persistent":\{"size":80\}\}/.test(calls[0][2]) && calls.length === 1, calls);
  let gerr = ""; try { await LR.grow("pod9", 5); } catch (e) { gerr = e.message; }
  check("grow: 10-4000 GB only", /10 to 4000/.test(gerr));
  // the page
  check("page: sizes, the first GGUF, a volume that fits with room", PG.gb(5e9) === "5.0 GB" && PG.defaultModel(T.models) === "Qwen3-8B-Q4_K_M.gguf" && PG.needGb(16.4e9, 0.85e9) === 50 && PG.needGb(40e9, 1e9) === 70);
  const RLs = rd("static/remotellm.js"), IX = rd("static/index.html"), RI = rd("routes/index.js");
  check("the LLM / Vision list's ＋ opens the dialog (the pick stays as it was); the script loaded; the routes mounted (not in server.js)",
    /value = "__hfadd"/.test(RLs) && /H3LlmRepos\.open\(k\)/.test(RLs) && /<script src="\/static\/llmrepos\.js">/.test(IX) && /require\("\.\/llmRepos"\)\.mount\(app\)/.test(RI) && !/llmRepos/.test(rd("misc/server.js")));
  const LP = rd("static/llmrepos.js");
  check("the dialog: Hugging Face's GGUFs, the projector for a vision LLM, Run it on (your pods / a new pod), share the card, a bigger volume, Send, then Keep it in your list? Save / Not now",
    /List its GGUF files/.test(LP) && /lrMm/.test(LP) && /a new pod just for the/.test(LP) && /Share the card with pictures and video/.test(LP) && /Make it bigger/.test(LP) && /▶ Send to the pod/.test(LP) && /in your " \+ kindWord\(S\.ask\.kind\) \+ ' list\?/.test(LP) && /id="lrSave">Save/.test(LP) && /id="lrNo">Not now/.test(LP));
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
