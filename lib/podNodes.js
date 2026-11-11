// bitGen Studio — lib/podNodes.js (2.763.1): THIS COMPUTER'S CUSTOM NODES ON A POD.
// Tim (verbatim): "we may have to upload all of the nodes in comfy custom nodes to the pod and restart the pod when created"
//   WHAT     every folder (and single .py) in this computer's ComfyUI custom_nodes, except the ones switched off (.disabled):
//              a git checkout   -> cloned ON the pod from its own address at the SAME commit (fast - GitHub to RunPod; a
//                                  commit the pod cannot find = the newest one, said); an ssh address is asked over https,
//                                  a user:token@ in the address is never sent - such a clone that fails is uploaded instead
//              anything else    -> zipped here (no .git / __pycache__ / files over 50 MB) and uploaded through the pod's Jupyter
//            then each one's requirements.txt with the Python that runs the pod's ComfyUI, then ComfyUI restarted - through
//            ComfyUI-Manager (/manager/reboot), else RunPod's pod restart - and waited for. Already on the pod = left alone.
//   WHEN     a pod bitGen creates for a style (lib/stylePods.js, once per pod: rgpu.pod_nodes.<pod>), My pods ▸ ⬆ My custom
//            nodes (POST /api/stylepods/nodes/:pod), and a style's nodes the pod lacks (lib/podPrep.js): this computer's
//            ComfyUI says which folder each node class comes from (/object_info python_module) - only those go.
// Pure (scripts/test-podnodes7631.js): gitOf, httpsOf, keepFile, folderOfModule, mirrorCode.
"use strict";
const fs = require("fs");
const path = require("path");
const MAX_FILE = 50 * 1024 * 1024;

/** a checkout's origin address + commit (pure with rd(path) -> text | null); none = null */
function gitOf(dir, rd) {
  let gd = path.join(dir, ".git");
  const f = rd(gd);
  if (f && /^gitdir:/.test(f)) gd = path.resolve(dir, f.replace(/^gitdir:\s*/, "").trim());
  const cfg = rd(path.join(gd, "config"));
  if (!cfg) return null;
  const m = /\[remote "origin"\][^[]*?\burl\s*=\s*(\S+)/.exec(cfg);
  if (!m) return null;
  let head = (rd(path.join(gd, "HEAD")) || "").trim(), commit = "";
  if (/^[0-9a-f]{40}$/.test(head)) commit = head;
  else if (/^ref:/.test(head)) {
    const ref = head.replace(/^ref:\s*/, "");
    commit = (rd(path.join(gd, ...ref.split("/"))) || "").trim();
    if (!/^[0-9a-f]{40}$/.test(commit)) { const pk = rd(path.join(gd, "packed-refs")) || ""; const l = pk.split("\n").find((x) => x.endsWith(" " + ref)); commit = l ? l.split(" ")[0] : ""; }
  }
  return { url: m[1], commit: /^[0-9a-f]{40}$/.test(commit) ? commit : "" };
}
/** an address the pod can clone (pure): ssh -> https, no user:token@ -> "" when it cannot be made public-looking */
function httpsOf(u) {
  let s = String(u || "").trim();
  const ssh = /^(?:ssh:\/\/)?git@([^:/]+)[:/](.+)$/.exec(s);
  if (ssh) s = "https://" + ssh[1] + "/" + ssh[2];
  if (/^file:\/\//.test(s) && process.env.H3_POD_GIT_FILE === "1") return s;   // the tests' own repos
  if (!/^https?:\/\//i.test(s)) return "";
  try { const x = new URL(s); x.username = ""; x.password = ""; return x.toString(); } catch { return ""; }
}
/** a file that goes in a zipped folder (pure): rel = its path inside the pack */
function keepFile(rel, size) {
  const parts = String(rel).split(/[\\/]/);
  if (parts.some((p) => p === ".git" || p === "__pycache__" || p === "node_modules" || p === ".venv")) return false;
  return (+size || 0) <= MAX_FILE;
}
/** "custom_nodes.ComfyUI-KJNodes.nodes" -> "ComfyUI-KJNodes"; a core node -> "" (pure) */
function folderOfModule(m) { const s = String(m || "").split("."); return s[0] === "custom_nodes" && s[1] ? s[1] : ""; }
/** the Python the pod's Jupyter runs (pure): a background thread puts each item in <comfy>/custom_nodes (git clone + the
 *  commit, or the uploaded zip unpacked), installs its requirements.txt with the Python running main.py, writes
 *  <cwd>/.bitgen_mirror.json {running, packs: [{id, state, note}]} */
function mirrorCode(items, comfy) {
  const job = JSON.stringify({ comfy, items: (items || []).map((k) => ({ folder: k.folder, git: k.git || "", commit: k.commit || "", zip: k.zip || "" })) });
  return [
    "import json, os, subprocess, threading, zipfile",
    `J = json.loads(${JSON.stringify(job)})`,
    "P = os.path.join(os.getcwd(), '.bitgen_mirror.json')",
    "S = {'running': True, 'packs': [{'id': k['folder'], 'state': 'waiting', 'note': ''} for k in J['items']]}",
    "def save():",
    "    t = P + '.tmp'",
    "    open(t, 'w').write(json.dumps(S)); os.replace(t, P)",
    "def py():",
    "    for p in os.listdir('/proc'):",
    "        if not p.isdigit(): continue",
    "        try:",
    "            a = open('/proc/' + p + '/cmdline', 'rb').read().split(b'\\0')",
    "            if any(x.endswith(b'main.py') for x in a): return os.readlink('/proc/' + p + '/exe')",
    "        except Exception: pass",
    "    return 'python3'",
    "def run():",
    "    exe = py(); cn = os.path.join(J['comfy'], 'custom_nodes'); env = dict(os.environ, GIT_TERMINAL_PROMPT='0'); os.makedirs(cn, exist_ok=True)",
    "    for i, k in enumerate(J['items']):",
    "        st = S['packs'][i]; dst = os.path.join(cn, k['folder'])",
    "        try:",
    "            if os.path.exists(dst):",
    "                st['state'] = 'there already'; save(); continue",
    "            st['state'] = 'installing'; save()",
    "            if k['git']:",
    "                subprocess.run(['git', 'clone', '-q', k['git'], dst], check=True, capture_output=True, timeout=1200, env=env)",
    "                if k['commit'] and subprocess.run(['git', '-C', dst, 'checkout', '-q', k['commit']], capture_output=True, timeout=300, env=env).returncode:",
    "                    st['note'] = 'your commit was not found - the newest one is used'",
    "            else:",
    "                z = os.path.join(os.getcwd(), k['zip'])",
    "                with zipfile.ZipFile(z) as f: f.extractall(cn)",
    "                os.remove(z)",
    "            req = os.path.join(dst, 'requirements.txt')",
    "            if os.path.isdir(dst) and os.path.isfile(req): subprocess.run([exe, '-m', 'pip', 'install', '-q', '-r', req], check=True, capture_output=True, timeout=1800)",
    "            st['state'] = 'done'",
    "        except Exception as e:",
    "            err = getattr(e, 'stderr', None)",
    "            st['state'] = 'failed: ' + (err.decode('utf8', 'ignore')[-200:] if isinstance(err, bytes) and err else str(e)[:200])",
    "        save()",
    "    S['running'] = False; save()",
    "save(); threading.Thread(target=run, daemon=True).start()",
    "print('bitgen-mirror-started')",
  ].join("\n");
}

/* ---------------- live */
function core() { return require("./core"); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const POLL = () => +(process.env.H3_POD_REVIVE_POLL || 5000);
const rdText = (p) => { try { return fs.readFileSync(p, "utf8"); } catch { return null; } };
/** this computer's ComfyUI custom_nodes folder ("" = none found) */
function localDir() {
  const c = ((core().getConfig() || {}).engine || {}).comfy || {};
  let root = ""; try { root = require("./comfyDetect").scanTarget(c).dirAbs || ""; } catch { root = ""; }
  for (const d of [path.join(root, "custom_nodes"), path.join(root, "ComfyUI", "custom_nodes")]) { try { if (root && fs.statSync(d).isDirectory()) return d; } catch { /* next */ } }
  return "";
}
/** this computer's packs -> [{folder, git, commit, local}] (git "" = zipped + uploaded) */
function list(dir) {
  const d = dir || localDir(), out = [];
  if (!d) return out;
  for (const n of fs.readdirSync(d).sort()) {
    if (/^[._]/.test(n) || /\.disabled$/i.test(n) || n === "__pycache__") continue;
    const p = path.join(d, n);
    let st; try { st = fs.statSync(p); } catch { continue; }
    if (st.isFile()) { if (/\.py$/i.test(n)) out.push({ folder: n, git: "", commit: "", local: p, file: true }); continue; }
    if (!st.isDirectory()) continue;
    const g = gitOf(p, rdText), url = g ? httpsOf(g.url) : "";
    out.push({ folder: n, git: url, commit: url ? g.commit : "", local: p });
  }
  return out;
}
/** a folder (or a .py) zipped (keepFile) -> Buffer; entries "<folder>/<rel>" so they unpack into custom_nodes */
function zipOf(item) {
  const Z = require("./zipWrite"), entries = [];
  if (item.file) return Z.zip([{ name: item.folder, data: fs.readFileSync(item.local), deflate: true }]);
  const walk = (d, rel) => {
    for (const n of fs.readdirSync(d)) {
      const p = path.join(d, n), r = rel ? rel + "/" + n : n;
      let st; try { st = fs.lstatSync(p); } catch { continue; }
      if (st.isSymbolicLink()) continue;
      if (st.isDirectory()) { if (keepFile(r + "/x", 0)) walk(p, r); continue; }
      if (keepFile(r, st.size)) entries.push({ name: item.folder + "/" + r, data: fs.readFileSync(p), deflate: true });
    }
  };
  walk(item.local, "");
  return Z.zip(entries);
}
/** which local folders the node classes come from: this computer's ComfyUI /object_info -> {folders, rest} */
async function foldersFor(classes) {
  const out = { folders: [], rest: [] };
  if (!(classes || []).length) return out;
  let info = null;
  try {
    const url = String((((core().getConfig() || {}).engine || {}).comfy || {}).url || "http://127.0.0.1:8188").replace(/\/+$/, "");
    const r = await fetch(url + "/object_info", { signal: AbortSignal.timeout(30000) });
    info = r.ok ? await r.json() : null;
  } catch { info = null; }
  for (const c of classes) {
    const f = info && info[c] ? folderOfModule(info[c].python_module) : "";
    if (f) { if (!out.folders.includes(f)) out.folders.push(f); } else out.rest.push(c);
  }
  return out;
}
const MIRROR = {};   // pod -> {running, note, packs, at}
function status(id) { const m = MIRROR[String(id || "")]; return m ? { running: m.running, note: m.note, packs: m.packs, at: m.at } : null; }
async function putFile(w, name, buf) {
  const PM = require("./podModels"), pw = PM.jupyterOf(w.pod_id), CH = +(process.env.H3_POD_CHUNK || 16 << 20);
  const H = { Authorization: "token " + pw, "Content-Type": "application/json" }, n = Math.max(1, Math.ceil(buf.length / CH));
  for (let i = 0; i < n; i++) {
    const part = buf.subarray(i * CH, Math.min(buf.length, (i + 1) * CH));
    const r = await PM.hit(w.jupyter_url + "/api/contents/" + encodeURIComponent(name), { method: "PUT", headers: H, ms: 600000,
      body: JSON.stringify({ type: "file", format: "base64", name, path: name, content: part.toString("base64"), chunk: n === 1 ? undefined : (i === n - 1 ? -1 : i + 1) }) });
    if (r.status >= 300) throw new Error(`the pod's Jupyter refused ${name} (HTTP ${r.status})`);
  }
}
async function runItems(w, items, M, say) {
  const PM = require("./podModels");
  for (const k of items) if (!k.git) { say("uploading " + k.folder); k.zip = "bitgen-nodes-" + k.folder.replace(/[^\w.-]+/g, "_") + ".zip"; await putFile(w, k.zip, zipOf(k)); }   // 2.763.4: not hidden - Jupyter refuses those
  const said = await PM.runKernel(w.jupyter_url, PM.jupyterOf(w.pod_id), mirrorCode(items, w.comfy_dir));
  if (!/bitgen-mirror-started/.test(said)) throw new Error("the pod's Jupyter did not start the node installs");
  let s = null;
  for (let i = 0; i < 1440; i++) {
    await sleep(POLL());
    s = await PM.readCwdJson(w.pod_id, ".bitgen_mirror.json").catch(() => null);   // 2.763.3: file API, else a kernel
    const cur = s && (s.packs || []).find((p) => p.state === "installing");
    if (cur) say("installing " + cur.id);
    if (s && !s.running) break;
  }
  return (s && s.packs) || [];
}
/** this computer's custom nodes onto a pod (all, or only `folders`) -> {done, there, failed: [{id, why}], restarted} */
async function mirror(id, port, opts) {
  const o = opts || {}, pod = String(id || "").replace(/[^A-Za-z0-9]/g, ""), PM = require("./podModels");
  const M = MIRROR[pod] = { running: true, note: "starting", packs: [], at: Date.now() };
  const say = (t) => { M.note = t; M.at = Date.now(); if (o.say) o.say(t); };
  try {
    let items = list(o.dir);
    if (o.only) items = items.filter((k) => o.only.includes(k.folder));
    if (!items.length) { say(o.only ? "none of those node folders is on this computer" : "no custom nodes found on this computer (Settings ▸ ComfyUI ▸ Folder)"); return { done: [], there: [], failed: [], restarted: false }; }
    const w = await PM.ways(pod, port);
    if (!w.jupyter || !w.comfy_dir) throw Object.assign(new Error("bitGen puts custom nodes on a pod through its Jupyter - paste its password in ⬇ Models"), { status: 409 });
    // what the pod has already - not uploaded or cloned again
    let have = [];
    try { const t = await PM.runKernel(w.jupyter_url, PM.jupyterOf(w.pod_id), ["import os, json", `d = os.path.join(${JSON.stringify(w.comfy_dir)}, 'custom_nodes')`, "print('bitgen-cn ' + json.dumps(os.listdir(d) if os.path.isdir(d) else []))"].join("\n"));
      have = JSON.parse((/bitgen-cn (\[.*\])/.exec(t) || [0, "[]"])[1]); } catch { have = []; }
    const there0 = items.filter((k) => have.includes(k.folder)).map((k) => ({ id: k.folder, state: "there already", note: "" }));
    items = items.filter((k) => !have.includes(k.folder));
    if (!items.length) { M.packs = there0; say("custom nodes: all " + there0.length + " on the pod already"); return { done: [], there: there0.map((x) => x.id), failed: [], restarted: false }; }
    say("putting " + items.length + " custom node " + (items.length === 1 ? "pack" : "packs") + " on the pod" + (there0.length ? " (" + there0.length + " there already)" : ""));
    let res = await runItems(w, items, M, say);
    // a clone the pod could not make (a private repo, an address it cannot reach) - uploaded from here instead
    const again = items.filter((k, i) => k.git && /^failed/.test(String((res[i] || {}).state)));
    if (again.length) {
      say("uploading what the pod could not clone: " + again.map((k) => k.folder).join(", "));
      const up = again.map((k) => Object.assign({}, k, { git: "", commit: "" }));
      const res2 = await runItems(w, up, M, say);
      res = res.map((r, i) => { const j = again.indexOf(items[i]); return j >= 0 ? res2[j] || r : r; });
    }
    res = there0.concat(res);
    M.packs = res;
    const done = res.filter((r) => r.state === "done").map((r) => r.id), there = res.filter((r) => r.state === "there already").map((r) => r.id);
    const failed = res.filter((r) => /^failed/.test(String(r.state))).map((r) => ({ id: r.id, why: String(r.state).replace(/^failed: ?/, "") }));
    let restarted = false;
    if (done.length) {
      say("restarting the pod's ComfyUI so the new nodes load");
      restarted = await restart(pod, port, w);
      say("waiting for the pod's ComfyUI");
      for (let i = 0; i < 360; i++) { await sleep(POLL()); try { await PM.ways(pod, port); break; } catch { /* still restarting */ } }
    }
    say(`custom nodes: ${done.length} put on the pod${there.length ? ", " + there.length + " there already" : ""}${failed.length ? ", " + failed.length + " failed (" + failed.map((f) => f.id).join(", ") + ")" : ""}`);
    return { done, there, failed, restarted };
  } catch (e) { say("custom nodes: " + String((e && e.message) || e)); throw e; }
  finally { M.running = false; M.at = Date.now(); }
}
/** ComfyUI-Manager's reboot, else RunPod's pod restart -> true when one was asked */
async function restart(pod, port, w) {
  const PM = require("./podModels");
  for (const u of ["/manager/reboot", "/v2/manager/reboot", "/api/manager/reboot"]) { const r = await PM.hit(w.comfy_url + u, { ms: 15000 }).catch(() => ({ status: 0 })); if (r.status === 200) return true; }
  try { await require("./runpodApi").action(pod, "restart", String((((core().getConfig() || {}).rgpu || {}).runpod || {}).key || "")); return true; } catch { return false; }
}
module.exports = { MAX_FILE, gitOf, httpsOf, keepFile, folderOfModule, mirrorCode, localDir, list, zipOf, foldersFor, mirror, restart, status };
