#!/usr/bin/env node
/* bitGen Studio — 3.12.1: Settings ▸ Add-ons ▸ π pi-H3's Install replaces a ComfyUI-piFlow older than 1.4.0 (no pi-H3 nodes) -
 * whatever its folder is spelled (the Comfy registry's "comfyui-piflow", no .git) - by putting it aside as
 * <name>.old-<version>.disabled and fetching the newest; git copies are pulled; status says when the copy there is too old.
 * Tim's log (after restarting ComfyUI): "this ComfyUI has not loaded the node 'pi-H3 4-step DWD adapter' (Load LakonLab
 * Adapter)" + https://github.com/Lakonik/ComfyUI-piFlow/blob/main/docs/piH3.md. The worker's words: scripts/test-pih3-31201.py. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const PA = require(path.join(ROOT, "lib/pih3Addon.js"));

/** a ComfyUI-piFlow copy: version, with or without the pi-H3 nodes, a git copy or not */
function copy(cn, name, version, pih3, git) {
  const d = path.join(cn, name); fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, "pyproject.toml"), `[project]\nname = "comfyui-piflow"\nversion = "${version}"\n`);
  fs.writeFileSync(path.join(d, "lakonlab_loaders.py"), "");
  fs.writeFileSync(path.join(d, "__init__.py"), 'NODE_CLASS_MAPPINGS = {\n    "Load pi-Flow Model": 1,\n' + (pih3 ? '    "Load LakonLab Adapter": 2,\n    "DWD Decode": 3,\n' : "") + "}\n");
  if (git) fs.mkdirSync(path.join(d, ".git"), { recursive: true });
  return d;
}
function place() {
  const c = fs.mkdtempSync(path.join(os.tmpdir(), "pf-"));
  const pl = { ok: true, customNodes: path.join(c, "custom_nodes"), models: path.join(c, "models"), python: "" };
  fs.mkdirSync(pl.customNodes, { recursive: true }); fs.mkdirSync(pl.models, { recursive: true });
  return pl;
}
const fetchNew = (got) => async (url, dir) => { got.push([url, path.basename(dir)]); copy(path.dirname(dir), path.basename(dir), "1.4.2", true, true); return { ok: true }; };

(async () => {
  /* the registry copy: comfyui-piflow 1.3.6, no .git, no pi-H3 nodes */
  let pl = place();
  copy(pl.customNodes, "comfyui-piflow", "1.3.6", false, false);
  const c0 = PA.piflowCopies(pl);
  check("piflowCopies: the registry's comfyui-piflow found - its version, not a git copy, no pi-H3 nodes", c0.length === 1 && c0[0].name === "comfyui-piflow" && c0[0].version === "1.3.6" && !c0[0].git && !c0[0].pih3, c0);
  const st = PA.status(pl);
  check("status: the nodes NOT counted as there; the note names the old copy and what Install does", !st.nodes && /comfyui-piflow 1\.3\.6 - older than 1\.4\.0/.test(st.note) && /Install puts it aside/.test(st.note) && st.piflow[0].version === "1.3.6", st.note);
  let got = [], logs = [];
  let r = await PA.updatePiflow(pl, { log: (l) => logs.push(l), git: "git", X: { run: async () => 0 }, env: {}, fetchRepo: fetchNew(got) });
  const names = fs.readdirSync(pl.customNodes).sort();
  check("update: the old copy put aside as comfyui-piflow.old-1.3.6.disabled (ComfyUI skips it, nothing deleted), the newest fetched as ComfyUI-piFlow",
    r.ok && JSON.stringify(names) === '["ComfyUI-piFlow","comfyui-piflow.old-1.3.6.disabled"]' && got.length === 1 && got[0][0] === PA.REPO && got[0][1] === "ComfyUI-piFlow" && r.aside[0] === "comfyui-piflow.old-1.3.6.disabled", { r, names, got });
  check("…said, with why (older than 1.4.0, not a git copy - the Comfy registry / ComfyUI-Manager)", logs.some((l) => /older than 1\.4\.0/.test(l) && /Comfy registry/.test(l) && /put aside/.test(l)), logs);
  check("…status: the nodes are there now; the .disabled one is not counted", PA.status(pl).nodes && PA.piflowCopies(pl).length === 1);

  /* a git copy that is old: pulled first - if the pull brings the nodes it stays */
  pl = place();
  const gd = copy(pl.customNodes, "ComfyUI-piFlow", "1.3.6", false, true);
  got = []; const runs = [];
  r = await PA.updatePiflow(pl, { log: () => {}, git: "git", X: { run: async (exe, args) => { runs.push(args.join(" ")); copy(pl.customNodes, "ComfyUI-piFlow", "1.4.2", true, true); return 0; } }, env: {}, fetchRepo: fetchNew(got) });
  check("a git copy: git pull --ff-only in it; the pulled 1.4.2 kept, nothing fetched or put aside", r.ok && runs.length === 1 && runs[0] === `-C ${gd} pull --ff-only` && got.length === 0 && r.aside.length === 0 && PA.piflowCopies(pl)[0].version === "1.4.2", { r, runs, got });

  /* a git copy whose pull fails and stays old: put aside, the newest fetched */
  pl = place();
  copy(pl.customNodes, "ComfyUI-piFlow", "1.2.0", false, true);
  got = [];
  r = await PA.updatePiflow(pl, { log: () => {}, git: "git", X: { run: async () => 1 }, env: {}, fetchRepo: fetchNew(got) });
  check("…the pull fails: put aside, the newest fetched", r.ok && fs.existsSync(path.join(pl.customNodes, "ComfyUI-piFlow.old-1.2.0.disabled")) && got.length === 1 && PA.status(pl).nodes, { r, got, names: fs.readdirSync(pl.customNodes) });

  /* a good copy + an old duplicate: the old one put aside, nothing fetched */
  pl = place();
  copy(pl.customNodes, "ComfyUI-piFlow", "1.4.2", true, true); copy(pl.customNodes, "comfyui_piflow", "1.3.0", false, false);
  got = [];
  r = await PA.updatePiflow(pl, { log: () => {}, git: "", X: { run: async () => 0 }, env: {}, fetchRepo: fetchNew(got) });
  check("a good copy + an old duplicate: the duplicate put aside (no two copies registering the same nodes), nothing fetched", r.ok && got.length === 0 && JSON.stringify(fs.readdirSync(pl.customNodes).sort()) === '["ComfyUI-piFlow","comfyui_piflow.old-1.3.0.disabled"]', fs.readdirSync(pl.customNodes));
  /* a second put-aside of the same version gets its own name */
  copy(pl.customNodes, "comfyui_piflow", "1.3.0", false, false);
  r = await PA.updatePiflow(pl, { log: () => {}, git: "", X: { run: async () => 0 }, env: {}, fetchRepo: fetchNew(got) });
  check("…put aside again: a free name (-2)", r.ok && fs.existsSync(path.join(pl.customNodes, "comfyui_piflow.old-1.3.0-2.disabled")));

  /* the fetch fails / brings no nodes */
  pl = place();
  r = await PA.updatePiflow(pl, { log: () => {}, git: "", X: { run: async () => 0 }, env: {}, fetchRepo: async () => ({ ok: false, error: "offline" }) });
  check("nothing there and the fetch fails: said", !r.ok && /could not fetch ComfyUI-piFlow: offline/.test(r.error));
  r = await PA.updatePiflow(pl, { log: () => {}, git: "", X: { run: async () => 0 }, env: {}, fetchRepo: async (u, dir) => { copy(path.dirname(dir), path.basename(dir), "1.3.6", false, false); return { ok: true }; } });
  check("…a fetched copy without the pi-H3 nodes: said", !r.ok && /has no pi-H3 nodes/.test(r.error));

  /* the whole Install with the registry copy */
  pl = place();
  copy(pl.customNodes, "comfyui-piflow", "1.3.6", false, false);
  got = [];
  r = await PA.install(() => {}, ["dwd4"], { place: pl, git: "git", exec: { run: async () => 0, which: () => "git" }, fetchRepo: fetchNew(got), download: async () => ({ ok: true }) });
  check("Install (4 steps) with the registry's old copy: replaced, then the adapters", r.ok && got.length === 1 && PA.status(pl).nodes, { r, got });
  check("PIFLOW_MIN 1.4.0", PA.PIFLOW_MIN === "1.4.0");
  console.log("\n" + pass + " passed, " + fail + " failed");
  console.log("RESULT: " + fail + " failed");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL: threw " + (e && e.stack || e)); console.log("RESULT: 1 failed"); process.exit(1); });
