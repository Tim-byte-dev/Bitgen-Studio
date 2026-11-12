// bitGen Studio — lib/podPrep.js (2.763.0): A STYLE MADE READY ON A POD - its files, its LoRAs, its node packs.
// Tim (verbatim): "can we use a dropdown of our styles for the mode selected ... then we send our styles workflow to the pod
// with our styles stand models, text encoders and vaes, we reuse the same styles, no p_ but when in pod mode we use the pod
// that uses that style" + (agreed) "catalog models download on the pod, other files from this computer, missing custom
// nodes installed, say clearly when a template cannot run a style".
//   FILES     what the style's workflow(s) load + the style's own model / VAE / text encoders / LoRAs (lib/modelsFound.js
//             needs - the same list the "models not found" check uses) that the pod's ComfyUI does not list:
//               in bitGen's download list (lib/modelCatalog.json)  -> downloaded ON THE POD from Hugging Face (fast - the
//                                                                    pod's own line; lib/podModels.js start)
//               else on this computer                              -> sent from this computer (lib/podSend.js ensure)
//               else                                               -> named in `problems`
//   NODES     the node classes the workflow(s) use that the pod's /object_info lacks -> the packs that provide them
//             (lib/nodePacks.json provides) are cloned into the pod's custom_nodes by its Jupyter (+ their requirements
//             with the Python that runs ComfyUI), then ComfyUI is restarted through ComfyUI-Manager (/manager/reboot) and
//             waited for. A class no pack provides = a problem ("this pod's ComfyUI cannot run <style>: …").
//   2.763.1: a missing class that this computer's ComfyUI has comes from ITS custom_nodes folder (lib/podNodes.js - cloned at
//   the same commit, or uploaded); only the rest goes by lib/nodePacks.json.
//   The workers build LTX / Wan graphs from /object_info - their files come from the style's own names.
// Pure (scripts/test-stylepods763.js): workflowsOf, plan, missingClasses, packsFor, nodeCode.
"use strict";
const fs = require("fs");
const path = require("path");
const base = (n) => String(n || "").split(/[\\/]/).pop().toLowerCase();

/** the workflow files a style renders with (pure): image / music = its own; video = its own, else per mode (its own
 *  workflows[mode], else Settings ▸ ComfyUI's template for the mode, else comfy_workflows/<mode>.json) */
function workflowsOf(st, cfg) {
  const s = st || {};
  if ((s.kind || "image") !== "video") return s.workflow ? [s.workflow] : [];
  if (s.workflow) return [s.workflow];
  const tmpl = (((cfg || {}).engine || {}).comfy || {}).workflows || {};
  const wfs = s.workflows || { t2va: "", ref2va: "", fl2va: "" };
  const own = Object.keys(wfs).filter((m) => wfs[m]);
  return [...new Set((own.length ? own : Object.keys(wfs)).map((m) => wfs[m] || tmpl[m] || `comfy_workflows/${m}.json`))];
}
/** what to put on the pod (pure): needs = [{name, cat}] (modelsFound.needs), onPod = the pod's lists {cat: [names]},
 *  catalog = lib/modelCatalog.json, local(cat, name) -> {path, rel, category} | null
 *  -> {download: [{name, folder, url, size}], send: [{name, cats}], there: [names], missing: [names]} */
function plan(needs, onPod, catalog, local) {
  const PM = require("./podModels");
  const have = new Set();
  for (const list of Object.values(onPod || {})) for (const n of list || []) have.add(base(n));
  const out = { download: [], send: [], there: [], missing: [] }, seen = new Set();
  for (const n of needs || []) {
    const b = base(n.name);
    if (!b || seen.has(b)) continue;
    seen.add(b);
    if (have.has(b)) { out.there.push(n.name); continue; }
    const m = ((catalog && catalog.models) || []).find((x) => x && x.file && String(x.as || String(x.file).split("/").pop()).toLowerCase() === b && PM.folderOf(x));
    if (m) { out.download.push({ name: String(m.as || String(m.file).split("/").pop()), folder: PM.folderOf(m), url: PM.urlOf(m), size: +m.size || 0 }); continue; }
    const cats = n.cat === "loras" ? ["loras"] : n.cat === "checkpoints" || n.cat === "diffusion_models" || n.cat === "unet" ? ["checkpoints", "diffusion_models", "unet"] : [n.cat];
    if (local && local(cats, n.name)) out.send.push({ name: n.name, cats });
    else out.missing.push(n.name);
  }
  return out;
}
/** node classes a set of workflows use that a ComfyUI lacks (pure): classes = [names], have = Set of /object_info keys */
function missingClasses(classes, have) { return [...new Set(classes || [])].filter((c) => !have.has(c)).sort(); }
/** the node packs that provide `classes` (pure) -> {packs: [pack], unknown: [classes no pack provides]} */
function packsFor(classes, packs) {
  const by = new Map();
  for (const p of packs || []) for (const c of p.provides || []) if (!by.has(c)) by.set(c, p);
  const out = [], unknown = [];
  for (const c of classes || []) { const p = by.get(c); if (!p) unknown.push(c); else if (!out.includes(p)) out.push(p); }
  return { packs: out, unknown };
}
/** the Python the pod's Jupyter runs to install node packs (pure): a background thread clones each pack into
 *  <comfy>/custom_nodes (a pack in a sub-folder of its repo: the repo in custom_nodes/.bitgen_src/<id>, the sub-folder linked
 *  in), installs its requirements.txt with the Python that runs ComfyUI's main.py, and writes <cwd>/.bitgen_nodes.json */
function nodeCode(packs, comfy) {
  const job = JSON.stringify({ comfy, packs: (packs || []).map((p) => ({ id: p.id, folder: p.folder, url: p.url, subdir: p.subdir || "" })) });
  return [
    "import json, os, subprocess, threading",
    `J = json.loads(${JSON.stringify(job)})`,
    "P = os.path.join(os.getcwd(), '.bitgen_nodes.json')",
    "S = {'running': True, 'packs': [{'id': k['id'], 'state': 'waiting'} for k in J['packs']]}",
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
    "    exe = py(); cn = os.path.join(J['comfy'], 'custom_nodes'); env = dict(os.environ, GIT_TERMINAL_PROMPT='0')",
    "    for i, k in enumerate(J['packs']):",
    "        st = S['packs'][i]; st['state'] = 'installing'; save()",
    "        try:",
    "            dst = os.path.join(cn, k['folder'])",
    "            src = os.path.join(cn, '.bitgen_src', k['id']) if k['subdir'] else dst",
    "            if not os.path.isdir(src):",
    "                os.makedirs(os.path.dirname(src), exist_ok=True)",
    "                subprocess.run(['git', 'clone', '--depth', '1', k['url'], src], check=True, capture_output=True, timeout=900, env=env)",
    "            if k['subdir'] and not os.path.exists(dst): os.symlink(os.path.join(src, k['subdir']), dst)",
    "            req = os.path.join(dst, 'requirements.txt')",
    "            if os.path.isfile(req): subprocess.run([exe, '-m', 'pip', 'install', '-r', req], check=True, capture_output=True, timeout=1800)",
    "            st['state'] = 'done'",
    "        except Exception as e:",
    "            err = getattr(e, 'stderr', None)",
    "            st['state'] = 'failed: ' + (err.decode('utf8', 'ignore')[-200:] if isinstance(err, bytes) and err else str(e)[:200])",
    "        save()",
    "    S['running'] = False; save()",
    "save(); threading.Thread(target=run, daemon=True).start()",
    "print('bitgen-nodes-started')",
  ].join("\n");
}

/* ---------------- live */
function core() { return require("./core"); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const POLL = () => +(process.env.H3_POD_REVIVE_POLL || 5000);
function readJson(rel) { try { return JSON.parse(fs.readFileSync(path.isAbsolute(rel) ? rel : path.join(core().BASE, rel), "utf8")); } catch { return null; } }
function defaults() {
  const PM = require("./podModels"), PS = require("./podStyles"), SD = require("./podSend"), RPS = require("./rpslStyles");
  let scan = null;
  return {
    ways: (id, port) => PM.ways(id, port),
    contents: (id, port) => PS.contents(id, port),
    download: (id, port, files) => PM.start(id, { files, port }),
    state: (id, port) => PM.state(id, port),
    send: (id, port, cats, name, say) => SD.ensure(id, port, cats, name, say),
    local: (cats, name) => { try { scan = scan || SD.localScan(); } catch { scan = { categories: {} }; } return SD.findLocal(scan, cats, name); },
    objectInfo: async (id, port) => { const r = await PM.hit(require("./runpodApi").proxyUrl(id, +port || 8188) + "/object_info", { ms: 60000 }); return r.j || {}; },
    kernel: (w, code) => PM.runKernel(w.jupyter_url, PM.jupyterOf(w.pod_id), code),
    nodeState: (w) => PM.readCwdJson(w.pod_id, ".bitgen_nodes.json").catch(() => null),   // 2.763.3: file API, else a kernel
    reboot: async (w) => { for (const u of ["/manager/reboot", "/v2/manager/reboot", "/api/manager/reboot"]) { const r = await PM.hit(w.comfy_url + u, { ms: 15000 }).catch(() => ({ status: 0 })); if (r.status === 200) return true; } return false; },
    catalog: () => readJson("lib/modelCatalog.json") || { models: [] },
    packs: () => (readJson("lib/nodePacks.json") || {}).packs || [],
    graph: (rel) => readJson(rel),
    classesOf: (g) => RPS.classesOf(g).classes,
    needs: (g, st, kind) => require("./modelsFound").needs(g, st, kind, {}),
    cfg: () => core().getConfig() || {},
    // 2.763.1 (Tim: "we may have to upload all of the nodes in comfy custom nodes to the pod"): the classes' own folders on
    // this computer (its ComfyUI's /object_info) go to the pod as they are (lib/podNodes.js)
    localFolders: (classes) => require("./podNodes").foldersFor(classes),
    mirror: (pod, port, folders, say) => require("./podNodes").mirror(pod, port, { only: folders, say }),
    sleep,
  };
}
const PREP = {};   // pod -> {running, styles, note, done: [], problems: [], at}
/** the state for the PODS docker */
function status(id) { const p = PREP[String(id || "")]; return p ? { running: p.running, styles: p.styles, note: p.note, done: p.done, problems: p.problems, at: p.at } : null; }
/** make styles ready on a pod -> {done: [style names], problems: [words]}; one run per pod at a time (a second call waits
 *  for it and runs after) */
async function prepare(id, port, styles, opts) {
  const pod = String(id || "").replace(/[^A-Za-z0-9]/g, "");
  const prev = PREP[pod];
  if (prev && prev.running && prev.promise) await prev.promise.catch(() => null);
  const P = PREP[pod] = { running: true, styles: (styles || []).map((s) => s.name), note: "starting", done: [], problems: [], at: Date.now() };
  P.promise = run(pod, port, styles || [], Object.assign(defaults(), (opts || {}).deps || {}), P, (opts || {}).say);
  try { return await P.promise; } finally { P.running = false; P.at = Date.now(); }
}
async function run(pod, port, styles, D, P, say0) {
  const say = (t) => { P.note = t; P.at = Date.now(); if (say0) say0(t); };
  if (!styles.length) { say("nothing to make ready"); return { done: [], problems: [] }; }
  say("asking the pod what it has");
  const w = await D.ways(pod, port);
  const cfg = D.cfg(), cat = D.catalog();
  // ---- what each style needs
  let needs = [], classes = [];
  for (const st of styles) {
    for (const rel of workflowsOf(st, cfg)) {
      const g = D.graph(rel);
      if (!g) { P.problems.push(`${st.name}: its workflow ${path.basename(String(rel))} is not in this install`); continue; }
      needs = needs.concat(D.needs(g, st, st.kind || "image"));
      classes = classes.concat(D.classesOf(g));
    }
    if (!workflowsOf(st, cfg).length) needs = needs.concat(D.needs(null, st, st.kind || "image"));
  }
  // ---- node packs first (a restart of ComfyUI comes before the model lists are read)
  let info = {}; try { info = await D.objectInfo(pod, port); } catch { info = {}; }
  const have = new Set(Object.keys(info || {}));
  if (have.size) {
    let miss = missingClasses(classes, have);
    if (miss.length && D.localFolders) {
      const lf = await D.localFolders(miss).catch(() => ({ folders: [], rest: miss }));
      if (lf.folders.length) {
        say("putting this computer's node packs on the pod: " + lf.folders.join(", "));
        try { const r = await D.mirror(pod, port, lf.folders, (t) => say(t)); (r.failed || []).forEach((f) => P.problems.push(`node pack ${f.id}: ${f.why}`)); }
        catch (e) { P.problems.push("node packs from this computer: " + String((e && e.message) || e)); }
      }
      miss = lf.rest;
    }
    const pk = packsFor(miss, D.packs());
    if (pk.unknown.length) P.problems.push(`this pod's ComfyUI cannot run ${styles.map((s) => s.name).join(", ")} yet - no node pack bitGen knows adds ${pk.unknown.slice(0, 8).join(", ")}${pk.unknown.length > 8 ? " …" : ""} (install it with ComfyUI-Manager on the pod)`);
    if (pk.packs.length) {
      if (!w.jupyter || !w.comfy_dir) P.problems.push(`missing node packs ${pk.packs.map((p) => p.folder).join(", ")} - bitGen installs them through the pod's Jupyter (paste its password in ⬇ Models)`);
      else {
        say("installing node packs on the pod: " + pk.packs.map((p) => p.folder).join(", "));
        const said = await D.kernel(w, nodeCode(pk.packs, w.comfy_dir));
        if (!/bitgen-nodes-started/.test(said)) P.problems.push("the pod's Jupyter did not start the node pack installs");
        else {
          let s = null;
          for (let i = 0; i < 720; i++) { await D.sleep(POLL()); s = await D.nodeState(w); if (s && !s.running) break; }
          const bad = ((s && s.packs) || []).filter((x) => /^failed/.test(String(x.state)));
          bad.forEach((b) => P.problems.push(`node pack ${b.id}: ${b.state}`));
          say("restarting the pod's ComfyUI for the new node packs");
          if (!(await D.reboot(w))) P.problems.push("ComfyUI on the pod was not restarted (no ComfyUI-Manager) - restart the pod so the new node packs load");
          else {
            for (let i = 0; i < 120; i++) { await D.sleep(POLL()); try { await D.ways(pod, port); break; } catch { /* still restarting */ } }
          }
        }
      }
    }
  }
  // ---- files
  say("checking the pod's model files");
  let onPod = {}; try { onPod = (await D.contents(pod, port)).models || {}; } catch { onPod = {}; }
  const pl = plan(needs, onPod, cat, D.local);
  pl.missing.forEach((n) => P.problems.push(`${n} - not on the pod, not in bitGen's download list and not on this computer`));
  if (pl.download.length) {
    // 2.763.3 (Tim's pod: "downloading on the pod: krea2_raw_fp8_scaled…" then straight to the render): the pod's Jupyter can
    // start after its ComfyUI - waited for (3 min) before ComfyUI-Manager (its own list only) is tried
    let w2 = w;
    for (let i = 0; i < 36 && !w2.jupyter; i++) { say("waiting for the pod's Jupyter (it downloads the files)"); await D.sleep(POLL()); try { w2 = await D.ways(pod, port); } catch { /* still starting */ } }
    if (!w2.jupyter && !w2.manager) P.problems.push("the pod has no way in for downloads (no Jupyter password, no ComfyUI-Manager): " + pl.download.map((f) => f.name).join(", "));
    else {
      say("downloading on the pod: " + pl.download.map((f) => f.name).join(", "));
      try {
        await D.download(pod, port, pl.download);
        let known = false;
        for (let i = 0; i < 5760; i++) {
          await D.sleep(POLL());
          const s = await D.state(pod, port).catch(() => ({ running: false, files: [] }));
          if ((s.files || []).length) known = true;
          const cur = (s.files || []).find((f) => f.state === "downloading");
          if (cur) say(`downloading ${cur.name} on the pod${cur.size ? " - " + Math.round(100 * (cur.done || 0) / cur.size) + "%" : ""}`);
          if (known && !s.running) { (s.files || []).filter((f) => /^failed/.test(String(f.state))).forEach((f) => P.problems.push(`${f.name}: ${f.state}`)); break; }
          if (!known && i >= 24) { P.problems.push("bitGen could not read how far the downloads on the pod are"); break; }
        }
      } catch (e) { P.problems.push("downloads on the pod: " + String((e && e.message) || e)); }
    }
  }
  for (const f of pl.send) {
    say("sending " + f.name + " from this computer");
    try { await D.send(pod, port, f.cats, f.name, (t) => say(t)); } catch (e) { P.problems.push(String((e && e.message) || e)); }
  }
  // 2.763.3: what the style needs that the pod still does not list - the render would fail on it, so it is said (and the
  // job stops - lib/stylePods.js)
  let after = {}; try { after = (await D.contents(pod, port)).models || {}; } catch { after = onPod; }
  const have2 = new Set(); for (const list of Object.values(after || {})) for (const n of list || []) have2.add(base(n));
  const notThere = [...new Set(needs.map((n) => n.name).filter((n) => !have2.has(base(n))))];
  P.done = styles.map((s) => s.name);
  P.notThere = notThere;
  say(notThere.length ? "not on the pod yet: " + notThere.join(", ") : P.problems.length ? "ready with problems" : "ready");
  return { done: P.done, problems: P.problems, notThere };
}
module.exports = { workflowsOf, plan, missingClasses, packsFor, nodeCode, prepare, status };
