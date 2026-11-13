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
/** 2.769.0: the pod's Python that looks for files by name (in /workspace, ComfyUI's folder, /opt, /root, /home …) and links one
 *  found outside the folder its ComfyUI reads into it (pure) - prints BITGEN_LOCATE {name: {hits, linked, in_dir}} */
function locateCode(names, comfy, dirs) {
  const roots = [...new Set(["/workspace", String(comfy || ""), "/ComfyUI", "/comfyui", "/opt", "/root", "/home", "/models", "/data"].filter(Boolean))];
  const J = JSON.stringify({ names: names || [], roots, dirs: dirs || {} });
  return [
    "import os, json, time",
    `J = json.loads(${JSON.stringify(J)})`,
    "t0 = time.time(); want = {n.lower(): n for n in J['names']}; found = {}; seen = set()",
    "skip = {'proc', 'sys', 'dev', '.git', 'venv', '.venv', '__pycache__', 'node_modules', 'site-packages', '.cache'}",
    "for root in J['roots']:",
    "    if not os.path.isdir(root) or time.time() - t0 > 50: continue",
    "    for d, subs, files in os.walk(root):",
    "        rd = os.path.realpath(d)",
    "        if rd in seen: subs[:] = []; continue",
    "        seen.add(rd); subs[:] = [x for x in subs if x not in skip]",
    "        for f in files:",
    "            fl = f.lower(); part = fl.endswith('.part'); k = fl[:-5] if part else fl",
    "            if k in want:",
    "                p = os.path.join(d, f)",
    "                try: sz = os.path.getsize(p)",
    "                except Exception: sz = 0",
    "                found.setdefault(want[k], []).append({'path': p, 'size': sz, 'part': part})",
    "        if time.time() - t0 > 50: break",
    "out = {}",
    "for n in J['names']:",
    "    hits = found.get(n, []); r = {'hits': hits[:4]}; tgt = (J['dirs'].get(n) or '').rstrip('/')",
    "    full = [h for h in hits if not h['part'] and h['size'] > 0]",
    "    if full and tgt:",
    "        if any(os.path.realpath(os.path.dirname(h['path'])) == os.path.realpath(tgt) for h in full): r['in_dir'] = tgt",
    "        else:",
    "            dst = os.path.join(tgt, n)",
    "            try:",
    "                os.makedirs(tgt, exist_ok=True)",
    "                if os.path.lexists(dst): os.remove(dst)",
    "                os.symlink(full[0]['path'], dst); r['linked'] = dst",
    "            except Exception as e: r['error'] = str(e)[:160]",
    "    out[n] = r",
    "print('BITGEN_LOCATE ' + json.dumps(out))",
  ].join("\n");
}
/** the kernel's answer -> {name: {...}} | null (pure) */
function locateRead(said) { const m = /BITGEN_LOCATE (\{[\s\S]*\})\s*$/.exec(String(said || "").trim()); if (!m) return null; try { return JSON.parse(m[1]); } catch { return null; } }
const gb = (n) => (Math.round((+n || 0) / 1e8) / 10) + " GB";
/** what the search found, in words, for the files ComfyUI still does not list (pure) */
function locateWords(found, still, dirs) {
  const out = [];
  for (const n of still || []) {
    const r = (found || {})[n] || {}, hits = r.hits || [], part = hits.find((h) => h.part), full = hits.find((h) => !h.part && h.size > 0);
    if (r.error) out.push(`${n} is at ${full ? full.path : "?"} - bitGen could not link it into ${dirs[n]}: ${r.error}`);
    else if (r.linked) out.push(`${n} was at ${full ? full.path : "?"} - linked into ${dirs[n]}, but the pod's ComfyUI still does not list it`);
    else if (r.in_dir) out.push(`${n} is in ${r.in_dir} (${gb(full && full.size)}) but the pod's ComfyUI does not list it - its loader may not read this file, or ComfyUI needs a restart`);
    else if (part) out.push(`${n} is only partly downloaded (${gb(part.size)} at ${part.path}) - its download stopped; try again`);
    else if (hits.length) out.push(`${n} is on the pod but empty (${hits[0].path})`);
    else out.push(`${n} is not anywhere on the pod - its download did not happen`);
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
    objectInfo: async (id, port) => { const a = await PM.comfyAt(id, port); if (!a.url) return {}; const r = await PM.hit(a.url + "/object_info", { ms: 60000 }); if (r.status && r.status !== 200) throw new Error("HTTP " + r.status); return r.j || {}; },   // 2.766.3: the port that answers; 2.769.0: a refusal said
    updateComfy: (w, port, say, o) => require("./podComfyUpdate").update(w, port, say, o || {}),   // 2.766.3; 2.770.0 {force} = a repair
    autoUpdate: (id, port, say) => require("./podComfyUpdate").waitAuto(id, port, say),   // 2.769.0
    locate: async (w, code) => locateRead(await PM.runKernel(w.jupyter_url, PM.jupyterOf(w.pod_id), code)),   // 2.769.0
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
  // 2.771.0 (Tim: "record the time it takes to prepare a pod for generation each time it needs new uploads or restarts etc."):
  // every note with its time -> 📊 Statistics (lib/genStats.js: the phases - check / update / nodes / restart / download / send …)
  const t0 = Date.now(), notes = [], say0 = (opts || {}).say;
  const sayT = (t) => { notes.push({ t: Date.now(), note: String(t) }); if (say0) say0(t); };
  P.promise = run(pod, port, styles || [], Object.assign(defaults(), (opts || {}).deps || {}), P, sayT, !!(opts || {}).nodesOnly);
  try { return await P.promise; } finally {
    P.running = false; P.at = Date.now();
    // (stand-ins in opts.deps = a test - kept out of the statistics)
    if (!(opts || {}).deps || process.env.H3_GENSTATS_TEST) try { require("./genStats").recordPrep({ pod, kind: (opts || {}).nodesOnly ? "nodes" : "prepare", at: t0, end: P.at, notes, styles: P.styles, problems: P.problems }); } catch { /* never block */ }
  }
}
async function run(pod, port, styles, D, P, say0, nodesOnly) {
  const say = (t) => { P.note = t; P.at = Date.now(); if (say0) say0(t); };
  if (!styles.length) { say("nothing to make ready"); return { done: [], problems: [] }; }
  say("asking the pod what it has");
  let w = await D.ways(pod, port);
  // 2.769.0 (Tim: "update comfy automatically when the pod is created as well"): a pod bitGen made has its ComfyUI updated
  // first (once) - this job waits for it, then asks the pod again
  if (D.autoUpdate && !nodesOnly) {
    const u = await D.autoUpdate(pod, port, say).catch(() => null);
    if (u) {
      if (!u.ok) P.problems.push("ComfyUI on the new pod was not updated: " + (u.why || "it stopped"));
      else say(u.same ? "ComfyUI on the pod is already the latest" + (u.version ? " (" + u.version + ")" : "") : "ComfyUI on the pod is updated" + (u.version ? " to " + u.version : ""));
      try { w = await D.ways(pod, port); } catch { /* the one from before */ }
    }
  }
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
  let info = {}, infoErr = ""; try { info = await D.objectInfo(pod, port); } catch (e) { info = {}; infoErr = String((e && e.message) || e).slice(0, 160); }
  const have = new Set(Object.keys(info || {}));
  // 2.770.0 (Tim's log: "the pod's ComfyUI did not list its nodes (/object_info was empty) … qwen_image_2.1_int8_convrot.safetensors is
  // in /workspace/runpod-slim/ComfyUI/models/diffusion_models (7.3 GB) but the pod's ComfyUI does not list it"): a ComfyUI that
  // answers but has no nodes is broken - usually newer code without its requirements (an update whose pip step failed). It is
  // repaired: its requirements installed with its own Python, then restarted - and asked again
  if (!have.size && classes.length && !infoErr && w.jupyter && w.comfy_dir && D.updateComfy) {
    say("the pod's ComfyUI answers but lists no nodes - repairing it (its requirements, then a restart), a few minutes");
    const u = await D.updateComfy(w, port, say, { force: true }).catch((e) => ({ ok: false, why: String((e && e.message) || e) }));
    if (u.ok) { say("ComfyUI on the pod is repaired" + (u.version ? " (" + u.version + ")" : "")); try { info = await D.objectInfo(pod, port); } catch (e) { info = {}; infoErr = String((e && e.message) || e).slice(0, 160); } for (const k of Object.keys(info || {})) have.add(k); }
    else P.problems.push("the pod's ComfyUI lists no nodes and was not repaired: " + (u.why || "it stopped"));
  }
  // 2.769.0: a ComfyUI that does not list its nodes is said (the node check - and the update it can lead to - was skipped)
  if (!have.size && classes.length) P.problems.push("the pod's ComfyUI did not list its nodes (/object_info" + (infoErr ? " - " + infoErr : " was empty") + ") - bitGen could not check them" + (infoErr ? "" : "; ComfyUI is probably failing to load its nodes - restart the pod (PODS ▸ My pods), or look at its log on the pod"));
  if (have.size) {
    let miss = missingClasses(classes, have);
    // 2.764.2 (Tim: "only upload nodes that are necessary for the workflows we are using to the pod"): only the packs whose
    // nodes these workflows use and the pod lacks - found by the node's own folder on this computer (its ComfyUI's /object_info)
    if (!miss.length) say("the pod has every node these workflows use");
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
    // 2.766.3 (Tim: "… no node pack bitGen knows adds TextEncodeQwenImage21 … but the files are already transferred"): a class
    // built into a newer ComfyUI = the pod's ComfyUI is too old - it is updated (git pull, its requirements, a restart)
    const CU = require("./podComfyUpdate"), core = CU.coreMissing(pk.unknown), names = styles.map((s) => s.name).join(", ");
    pk.unknown = pk.unknown.filter((c) => !core.includes(c));
    if (core.length) {
      say(`this pod's ComfyUI${w.comfy_version ? " " + w.comfy_version : ""} is older than ${names} needs (${core.slice(0, 3).join(", ")} is built into a newer one) - updating ComfyUI on the pod, a few minutes`);
      const u = await D.updateComfy(w, port, say).catch((e) => ({ ok: false, why: String((e && e.message) || e) }));
      if (u.ok) {
        say("ComfyUI on the pod is updated" + (u.version ? " to " + u.version : ""));
        let again = {}; try { again = await D.objectInfo(pod, port); } catch { again = {}; }
        const still = core.filter((c) => !Object.prototype.hasOwnProperty.call(again || {}, c));
        if (still.length) { P.problems.push(`the pod's ComfyUI still lacks ${still.slice(0, 4).join(", ")} after its update`); P.lacks = (P.lacks || []).concat(still); }
      } else { P.problems.push(`this pod's ComfyUI${w.comfy_version ? " " + w.comfy_version : ""} is older than ${names} needs (${core.slice(0, 4).join(", ")}) and was not updated: ${u.why}`); P.lacks = (P.lacks || []).concat(core); }
    }
    // 2.766.4 (Tim: "… worker ERROR: ComfyUI does not have these node types: TextEncodeQwenImage21 … the custom nodes didn't
    // get installed"): a node the pod still lacks stops the render here (lib/stylePods.js), it is not sent to fail on the pod
    if (pk.unknown.length) P.lacks = (P.lacks || []).concat(pk.unknown);
    if (pk.unknown.length) P.problems.push(`this pod's ComfyUI cannot run ${names} yet - no node pack bitGen knows adds ${pk.unknown.slice(0, 8).join(", ")}${pk.unknown.length > 8 ? " …" : ""} (install it with ComfyUI-Manager on the pod)`);
    if (pk.packs.length) {
      if (!w.jupyter || !w.comfy_dir) P.problems.push(`missing node packs ${pk.packs.map((p) => p.folder).join(", ")} - bitGen installs them through the pod's Jupyter (paste its password in ⬇ Models)`);
      else {
        say("installing node packs on the pod: " + pk.packs.map((p) => p.folder).join(", "));
        // 2.764.6: its own process on the pod (lib/podJob.js) - a thread in the kernel ended with the kernel
        const PJ = require("./podJob"), said = await D.kernel(w, PJ.detach(nodeCode(pk.packs, w.comfy_dir))), mem = {};
        if (PJ.failed(said) || !/bitgen-nodes-started/.test(said)) P.problems.push("the pod did not start the node pack installs" + (PJ.failed(said) ? ": " + PJ.failed(said) : ""));
        else {
          let s = null;
          for (let i = 0; i < 720; i++) { await D.sleep(POLL()); s = PJ.track(mem, await D.nodeState(w), Date.now()); if (s && !s.running) break; }
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
  // 2.764.2: ⬆ Nodes its styles need (My pods) - the node packs only
  if (nodesOnly) { P.done = styles.map((s) => s.name); say(P.problems.length ? "node packs - " + P.problems.join("; ") : "the node packs its styles' workflows use are on the pod"); return { done: P.done, problems: P.problems, notThere: [] }; }
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
        const r0 = await D.download(pod, port, pl.download);
        // 2.764.6: a gated / missing file is said at once (lib/hfCheck.js)
        ((r0 && r0.blocked) || []).forEach((b) => { P.problems.push(`${b.name}: ${b.why}`); say(`${b.name}: ${b.why}`); });
        let known = false;
        // 2.766.0 (Tim: "add a progress bar for each transfer to the pod"): a bar per file (lib/podTransfers.js); the
        // files go in runpod/pods/remote_models.json with the styles that use them (lib/remoteModels.js)
        const PT = require("./podTransfers"), bars = {};
        // 2.770.1 (Tim: "if the files are already on the pod, don't repeat the download progress"): a bar only once a file really downloads
        const want = {}; for (const f of pl.download) if (!((r0 && r0.blocked) || []).some((b) => b.name === f.name)) want[f.name] = f;
        const barOf = (n) => bars[n] || (want[n] ? (bars[n] = PT.begin({ pod, name: n, how: "download", from: /civitai/i.test(want[n].url) ? "Civitai" : "Hugging Face", size: want[n].size })) : null);
        try { const RM = require("./remoteModels"); for (const f of pl.download) RM.add({ label: f.name.replace(/\.[^.]+$/, "").replace(/_+/g, " "), group: styles.map((x) => x.name).join(", ").slice(0, 80), folder: f.folder, name: f.name, url: f.url, size: f.size, source: "catalog", styles: styles.map((x) => x.id) }); } catch { /* a nicety */ }
        const settle = (files) => { for (const f of files || []) { if (!want[f.name]) continue; if (f.state === "there already") { delete want[f.name]; if (bars[f.name]) { PT.end(bars[f.name], "done"); delete bars[f.name]; } continue; } const b = barOf(f.name); if (!b) continue; if (f.state === "done") { PT.end(b, "done"); delete bars[f.name]; delete want[f.name]; } else if (/^failed/.test(String(f.state))) { PT.end(b, f.state); delete bars[f.name]; delete want[f.name]; } else PT.step(b, f.done || 0, f.size); } };
        for (let i = 0; i < 5760; i++) {
          await D.sleep(POLL());
          const s = await D.state(pod, port).catch(() => ({ running: false, files: [] }));
          settle(s.files);
          if ((s.files || []).length) known = true;
          const cur = (s.files || []).find((f) => f.state === "downloading");
          if (cur) say(`downloading ${cur.name} on the pod${cur.size ? " - " + Math.round(100 * (cur.done || 0) / cur.size) + "%" : ""}${cur.note ? " (" + cur.note + ")" : ""}`);
          if (known && !s.running) { (s.files || []).filter((f) => /^failed/.test(String(f.state))).forEach((f) => { if (!P.problems.some((x) => x.startsWith(f.name + ": "))) P.problems.push(`${f.name}: ${f.state.replace(/^failed: (gated|not found|refused)/, "$1")}`); }); break; }
          if (!known && i >= 24) { P.problems.push("bitGen could not read how far the downloads on the pod are"); break; }
        }
        for (const k of Object.keys(bars)) PT.end(bars[k], "failed: bitGen stopped watching it");
      } catch (e) { P.problems.push("downloads on the pod: " + String((e && e.message) || e)); }
    }
  }
  for (const f of pl.send) {
    say("sending " + f.name + " from this computer");
    try { await D.send(pod, port, f.cats, f.name, (t) => say(t)); } catch (e) { P.problems.push(String((e && e.message) || e)); }
  }
  // 2.763.3: what the style needs that the pod still does not list - the render would fail on it, so it is said (and the
  // job stops - lib/stylePods.js)
  // 2.766.4 (Tim: "i think the download wasn't completed before... the timing is off"): files just put on the pod may take
  // ComfyUI a moment to list - asked again (3 times, 10 s apart) before they are called missing
  let notThere = [], tries = (pl.download.length || pl.send.length) ? 4 : 1, warn = [];
  const listed = async () => {
    let after = {}; try { const c = await D.contents(pod, port); after = c.models || {}; warn = c.warnings || []; } catch (e) { after = onPod; warn = [String((e && e.message) || e)]; }
    const have2 = new Set(); for (const list of Object.values(after || {})) for (const n of list || []) have2.add(base(n));
    return [...new Set(needs.map((n) => n.name).filter((n) => !have2.has(base(n))))];
  };
  for (let t = 0; t < tries; t++) {
    if (t) { say("waiting for the pod's ComfyUI to list the new files"); await D.sleep(+(process.env.H3_POD_LIST_WAIT || 10000)); }
    notThere = await listed();
    if (!notThere.length) break;
  }
  // 2.769.0 (Tim's log: "downloading on the pod: qwen_image_2.1_int8_convrot.safetensors, … - waiting for the pod's ComfyUI to
  // list the new files - … these files are not on it"): the pod is searched for each one - one found outside the folders its
  // ComfyUI reads is linked into them; a half-downloaded one, one that is nowhere, or a ComfyUI that did not list its models
  // is said, so the reason is in the job's line
  if (notThere.length && w.jupyter && D.locate) {
    say("looking for " + notThere.join(", ") + " on the pod");
    let w2 = w; try { w2 = await D.ways(pod, port); } catch { w2 = w; }
    const PM = require("./podModels"), dirs = {};
    for (const n of needs) if (notThere.includes(n.name) && !dirs[n.name]) dirs[n.name] = PM.modelDir(w2, n.cat === "unet" ? "diffusion_models" : n.cat);
    let found = null; try { found = await D.locate(w2, locateCode(notThere, w2.comfy_dir, dirs)); } catch (e) { found = null; P.problems.push("bitGen could not look for the files on the pod: " + String((e && e.message) || e).slice(0, 160)); }
    if (found) {
      const linked = Object.keys(found).filter((k) => found[k] && found[k].linked);
      if (linked.length) { say("linked into the folders the pod's ComfyUI reads: " + linked.join(", ")); for (let t = 0; t < 3; t++) { await D.sleep(+(process.env.H3_POD_LIST_WAIT || 10000)); notThere = await listed(); if (!notThere.length) break; } }
      for (const line of locateWords(found, notThere, dirs)) P.problems.push(line);
    }
  }
  if (notThere.length && warn.length) P.problems.push("the pod's ComfyUI did not answer all its model lists (" + warn.slice(0, 3).join("; ") + ")");
  P.done = styles.map((s) => s.name);
  P.notThere = notThere;
  say(notThere.length ? "not on the pod yet: " + notThere.join(", ") : P.problems.length ? "ready with problems" : "ready");
  return { done: P.done, problems: P.problems, notThere, lacks: [...new Set(P.lacks || [])] };
}
module.exports = { workflowsOf, plan, missingClasses, packsFor, nodeCode, prepare, status, locateCode, locateRead, locateWords };
