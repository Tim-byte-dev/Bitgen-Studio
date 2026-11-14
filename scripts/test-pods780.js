#!/usr/bin/env node
/* bitGen Studio — 2.780.0: NO TEMPLATE BROWSER - A POD IS A bitGen POD. The server picks the one template (lib/pods.js
 * bitgenTemplate: RunPod's PyTorch template - bitGen installs ComfyUI on it - else its ComfyUI CUDA 13 one) and uses it when the
 * page names none; the PODS docker has 🖥 My pods (bitGen's pods, the account's others in one line) / 📦 Presets / ＋ Create pod;
 * the presets' template is read-only. Tim (verbatim): "i think with using our clean pod template and uploading others we don't need
 * to show any other pods except for our pods what do u think?" … "i think we drop the template browser completely. it will make
 * it less complicated" */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path"), Module = require("module"), vm = require("vm");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
let CFG = { rgpu: { runpod: { key: "rpa_TEST" } } };
const coreP = require.resolve("../lib/core"); const fake = new Module(coreP); fake.filename = coreP; fake.loaded = true;
fake.exports = { getConfig: () => CFG, setConfig: (c) => { CFG = c; }, BASE: ROOT, STYLES_DIR: os.tmpdir() };
require.cache[coreP] = fake;
const P = require("../lib/pods"), A = require("../lib/runpodApi");
const rd = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const PT = { id: "runpod-torch-v280", name: "Runpod Pytorch 2.8.0", image: "runpod/pytorch:2.8.0-py3.11-cuda12.8.1-cudnn-devel-ubuntu22.04", ports: ["8888/http", "22/tcp"], disk: 50 };
const CU = { id: "tplCu13", name: "ComfyUI - CUDA 13.0", image: "runpod/comfyui:cuda13.0", ports: ["8188/http", "8888/http"] };

(async () => {
  let LIST = [PT, CU];
  A.templates = async (src) => (src === "official" ? LIST : []);
  let t = await P.bitgenTemplate();
  check("bitgenTemplate: RunPod's PyTorch template - bitGen installs ComfyUI on it, a CUDA 12.8 host", t.id === "runpod-torch-v280" && t.install === true && t.comfy === false && t.cuda === "12.8", t);
  LIST = [CU]; await P.templates({ refresh: true });
  t = await P.bitgenTemplate().catch((e) => e);
  check("…no PyTorch one listed: RunPod's ComfyUI CUDA 13 template (its own ComfyUI, a CUDA 13 host)", t.id === "tplCu13" && t.install === false && t.comfy === true && t.cuda === "13.0", t);
  LIST = []; await P.templates({ refresh: true }).catch(() => 0);
  let e = null; try { await P.bitgenTemplate(); } catch (x) { e = x; }
  check("…neither: said (status 404, a template problem)", e && e.status === 404 && e.local === "template" && /PyTorch template/.test(e.message));

  // create with no template = the bitGen pod's
  LIST = [PT, CU]; await P.templates({ refresh: true }); let sent = null;
  A.createPod = async (b) => { sent = b; return { id: "podNEW1", name: b.name, desiredStatus: "RUNNING" }; };
  const SP = require("../lib/stylePods"), PM = require("../lib/podMade"), PR = require("../lib/podPresets");
  SP.link = () => {}; SP.setKinds = () => {}; PM.watch = () => {}; PR.fromPod = async () => ({ name: "x" });
  require("../lib/podModels").setJupyter = () => {};
  const r = await P.create({ gpu: "NVIDIA GeForce RTX 4090", cloud: "SECURE" });
  check("create with no template named: RunPod asked for the bitGen pod (PyTorch template, CUDA 12.8 host, 8188 opened for bitGen's ComfyUI)",
    sent && sent.templateId === "runpod-torch-v280" && sent.gpu.minCudaVersion === "12.8" && (sent.ports || []).includes("8188/http") && r.port === 8188, sent);
  LIST = []; await P.templates({ refresh: true }).catch(() => 0);
  let ce = null; try { await P.create({ gpu: "x" }); } catch (x) { ce = x; }
  check("…none to be had: the error carries its explanation (the dialog)", ce && ce.problem && ce.problem.kind === "template", ce && ce.problem);
  const R = {}; require("../routes/pods").mount({ get: (u, f) => { R["GET " + u] = f; }, post: () => {}, delete: () => {} });
  check("GET /api/pods/bitgen-template", typeof R["GET /api/pods/bitgen-template"] === "function");

  // the docker
  const D = rd("static/podsdock.js");
  check("PODS docker: no template browser (tabs, search, kind, ComfyUI only, For, cards, ★ Shortcuts); tabs My pods / Presets / ＋ Create pod; starts on My pods",
    /\[\["mine", "🖥 My pods"\], \["presets", "📦 Presets"\], \["create", "＋ Create pod"\]\]/.test(D) && !/\["all", "All"\]/.test(D) && !/id="pdQ"/.test(D) && !/id="pdKind"/.test(D) && !/id="pdComfy"/.test(D) && !/id="pdFor"/.test(D) && !/pdCard/.test(D) && !/data-pdstar/.test(D) && /src: "mine"/.test(D));
  const ctx = { window: { document: { readyState: "complete", getElementById: () => null, addEventListener() {}, querySelectorAll: () => [], querySelector: () => null }, addEventListener() {} }, setTimeout() {}, setInterval() {} };
  ctx.window.window = ctx.window; ctx.window.setTimeout = () => {}; ctx.window.setInterval = () => {}; vm.createContext(ctx);
  vm.runInContext(D.replace('typeof window !== "undefined" ? window : globalThis', "window"), ctx);
  const sp = ctx.window.H3Pods.split([{ id: "a", bitgen: true, status: "RUNNING", cost_hr: 0.5 }, { id: "b", bitgen: false, status: "RUNNING", cost_hr: 0.44 }, { id: "c", status: "EXITED", cost_hr: 0.3 }]);
  check("My pods = bitGen's pods; the account's others apart, with what the running ones cost an hour", sp.mine.map((p) => p.id).join() === "a" && sp.other.map((p) => p.id).join() === "b,c" && Math.abs(sp.otherHr - 0.44) < 1e-9, sp);
  check("…the others in one line under the list (opens to their state + ⏹ Stop) - nothing runs unseen", /other pod" \+ \(SP\.other\.length === 1 \? "" : "s"\) \+ " on your RunPod account \(not bitGen's\)"/.test(D) && /data-pdostop/.test(D) && /act\(p, "stop"\)/.test(D));
  check("＋ Create pod: what the pod is made from in one line (no template to pick); Create sends the bitGen pod's template", /id="pdTplLine"/.test(D) && /Made from RunPod's /.test(D) && /templateId: \(S\.tplB \|\| \{\}\)\.id \|\| ""/.test(D) && /\/api\/pods\/bitgen-template/.test(D));
  check("a render waiting for a pod opens ＋ Create pod filled in (no template to wait for)", /go\("create", Object\.assign\(pre, \{ name: \("bitGen " \+ o\.ask\.style_name\)/.test(D));
  const PP = rd("static/podpresets.js");
  check("📦 Presets: the template is a read-only line; ＋ New preset uses the bitGen pod's template", /getj\("\/api\/pods\/bitgen-template"\)/.test(PP) && !/<select data-ppf="template_id">/.test(PP) && /A bitGen pod - the template is picked by bitGen/.test(PP) && /cuda: t\.cuda \|\| ""/.test(PP));
  check("the 'no pod yet' box says it is a bitGen pod (no 'CUDA 13 only' for the PyTorch template)", /A bitGen pod, made from RunPod\\'s /.test(rd("static/stylepodask.js")) && !/CUDA 13 or newer hosts only/.test(rd("static/stylepodask.js")));
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch((x) => { console.error(x); process.exit(1); });
