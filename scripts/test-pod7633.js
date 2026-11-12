#!/usr/bin/env node
/* bitGen Studio — 2.763.3 units + LIVE: a pod render reaches the pod's ComfyUI (RunPod's proxy refuses Python's own
 * User-Agent with 403 - scripts/comfy_client.py now says who it is; scripts/comfy_progress.py speaks TLS to an https pod),
 * the style's files are waited for and a style that would fail (files not on the pod) stops with them named (lib/podPrep.js,
 * lib/stylePods.js), a pod made for a style from the PODS docker links the style + its kinds (lib/pods.js), and the docker
 * opens for a waiting render (static/podsdock.js forRender, static/stylepodask.js).
 * Tim (verbatim): "[worker] ERROR: cannot reach ComfyUI at https://18bgghhpmvz3i3-8188.proxy.runpod.net (HTTP Error 403:
 * Forbidden)" + "if a pod doesn't exist for a style popup the pods docker to create the pod when generate button is pressed,
 * auto select the type and style. let user select gpu and number of gpu's and let the user start and stop and terminate the
 * pod from the docker" */
"use strict";
const http = require("http"), fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const rd = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const PP = require("../lib/podPrep");

(async () => {
  // ---- the proxy's 403 for Python-urllib
  const seen = [];
  const srv = http.createServer((q, s) => { seen.push(q.headers["user-agent"] || ""); if (/^Python-urllib/.test(q.headers["user-agent"] || "")) { s.writeHead(403); return s.end("error code: 1010"); } s.writeHead(200, { "Content-Type": "application/json" }); s.end('{"system": {}}'); });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const url = "http://127.0.0.1:" + srv.address().port + "/system_stats";
  // (spawn, not spawnSync - the stand-in answers from this same process)
  const pyA = (code) => new Promise((ok) => { const r = require("child_process").spawn("python3", ["-c", code], { cwd: path.join(ROOT, "scripts") }); let o = ""; r.stdout.on("data", (d) => { o += d; }); r.stderr.on("data", (d) => { o += d; }); r.on("close", () => ok({ stdout: o, stderr: "" })); });
  const bare = await pyA(`import urllib.request\ntry:\n    urllib.request.urlopen(${JSON.stringify(url)}); print("ok")\nexcept Exception as e: print("refused", e)`);
  const withCc = await new Promise((ok) => { const r = require("child_process").spawn("python3", ["-c", `import comfy_client, urllib.request\nprint(comfy_client.http_json(${JSON.stringify(url)}))\nr = urllib.request.urlopen(urllib.request.Request(${JSON.stringify(url)}))\nprint("plain", r.status)`], { cwd: path.join(ROOT, "scripts") }); let o = ""; r.stdout.on("data", (d) => { o += d; }); r.stderr.on("data", (d) => { o += d; }); r.on("close", () => ok(o)); });
  srv.close();
  check("the stand-in proxy refuses Python's own User-Agent (as RunPod's did: HTTP 403)", /refused.*403/.test(bare.stdout), bare.stdout + bare.stderr);
  check("with comfy_client imported every urlopen in the worker says \"bitGen-Studio\" - the pod's ComfyUI answers (its JSON helper and a plain urlopen)", /'system'/.test(withCc) && /plain 200/.test(withCc) && seen.slice(-2).every((u) => /^bitGen-Studio/.test(u)), { withCc, seen });
  const CP = rd("scripts", "comfy_progress.py");
  check("comfy_progress: an https pod's websocket over TLS (wss), its Host without the default port, a User-Agent", /ssl\.create_default_context\(\)\.wrap_socket\(s, server_hostname=host\)/.test(CP) && /User-Agent: bitGen-Studio/.test(CP) && /if port in \(80, 443\)/.test(CP));

  // ---- making a style ready: the downloads waited for, files not on the pod named
  const files = { diffusion_models: [] }, pending = ["big.safetensors"];
  let polls = 0, wcalls = 0;
  const D = {
    ways: async () => ({ pod_id: "p", jupyter: ++wcalls > 2, manager: false, comfy_dir: "/w/ComfyUI", jupyter_url: "j", comfy_url: "c" }),
    contents: async () => ({ models: JSON.parse(JSON.stringify(files)) }),
    download: async () => ({ started: 1 }),
    state: async () => { polls++; if (polls < 6) return { running: false, files: [] };   // the status file not readable yet
      if (polls < 9) return { running: true, files: [{ name: "big.safetensors", state: "downloading", done: polls, size: 10 }] };
      files.diffusion_models.push(pending.shift() || "x"); return { running: false, files: [{ name: "big.safetensors", state: "done" }] }; },
    send: async () => ({}), local: () => null, objectInfo: async () => ({}), kernel: async () => "", nodeState: async () => null, reboot: async () => true,
    catalog: () => ({ models: [{ id: "b", repo: "o/r", file: "big.safetensors", dest: "comfy/diffusion_models", size: 10 }] }), packs: () => [],
    graph: () => ({ 1: { class_type: "UNETLoader", inputs: { unet_name: "big.safetensors" } }, 2: { class_type: "VAELoader", inputs: { vae_name: "nowhere_vae.safetensors" } } }),
    classesOf: () => ["UNETLoader", "VAELoader"], needs: (g) => [{ name: "big.safetensors", cat: "diffusion_models" }, { name: "nowhere_vae.safetensors", cat: "vae" }],
    cfg: () => ({}), localFolders: null, sleep: async () => {},
  };
  process.env.H3_POD_REVIVE_POLL = "1";
  const r = await PP.prepare("p", 8188, [{ id: "s", name: "Krea 2 Raw", kind: "image", workflow: "w.json" }], { deps: D });
  check("prepare: the pod's Jupyter waited for (it starts after ComfyUI), the downloads' progress waited for (an unreadable status is not 'finished'), the file there after",
    files.diffusion_models.includes("big.safetensors") && polls >= 9 && wcalls >= 3 && !r.notThere.includes("big.safetensors"), { r, polls, wcalls, files });
  check("…a file that is nowhere: named in problems and in notThere (the job stops instead of failing on the pod)", r.notThere.join() === "nowhere_vae.safetensors" && r.problems.some((p) => /nowhere_vae/.test(p)), r);
  const SPs = rd("lib", "stylePods.js");
  check("stylePods.ready: files not on the pod -> the job stops with them named; what making it ready could not do goes in the job's log line",
    /cannot render on the pod yet - these files are not on it/.test(SPs) && /" - note: " \+ pr\.join\("; "\)/.test(SPs));

  // ---- the PODS docker for a waiting render
  const PD = rd("static", "podsdock.js"), PJ = rd("lib", "pods.js"), AS = rd("static", "stylepodask.js");
  check("lib/pods.js create: for_style links the style, kinds = the pod for them (one pod per kind), (2.764.2: no longer every custom node - only what the styles' workflows use, podPrep); a CUDA 13 template = a CUDA 13 host",
    /if \(o\.for_style\) SP\.link\(o\.for_style, p\.id\);/.test(PJ) && /SP\.setKinds\(p\.id, o\.kinds\)/.test(PJ) && !/SP\.nodesTodo\(p\.id, true\)/.test(PJ) && /o\.cuda = "13\.0"/.test(PJ) && !/pod_for = /.test(PJ));
  check("the docker: forRender opens it with a banner + the create form on the CUDA 13 template, the style, its kind, bitGen's GPU pick, GPUs, the disk; ▶ Use for <style> on your pods; Cancel the render; the question asks the docker first",
    /function forRender\(o\)/.test(PD) && /openForm\(o\.template\.id, pre\)/.test(PD) && /var pre = \{ style: o\.ask\.style_id, kinds: \[o\.ask\.kind\], gpu: o\.pick \|\| "", volume: o\.volume_gb \|\| 50, count: o\.count \|\| 1, cloud: o\.cloud \|\| "SECURE" \};/.test(PD)
    && /data-pdfor/.test(PD) && /id="pdAskNo"/.test(PD) && /id="pdStyle"/.test(PD) && /data-pdkind/.test(PD) && /H3Pods\.forRender\(o\)/.test(AS));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
