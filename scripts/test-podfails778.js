#!/usr/bin/env node
/* bitGen Studio — 2.778.0: A FILE THE POD NEEDS FOUND ONLINE BY ITS NAME (lib/podFind.js: your remote models list, its Civitai
 * info card, a Civitai search) + A FILE THAT DID NOT GET ONTO A POD ASKED "TRY AGAIN?" (lib/podFails.js, routes/podFails.js,
 * static/podfails.js). Stand-ins for the pod, Civitai and the lists.
 * Tim (verbatim): "if a file fails to upload to the pod ask the user if they want to try again" + his log "[pod]
 * krea2_nsfw-aio-2.safetensors - not on the pod, not in bitGen's download list and not on this computer" + "the checkpoint is
 * on civitai" */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path"), Module = require("module");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 900))); } };
let CFG = { rgpu: {} };
const coreP = require.resolve("../lib/core"); const fake = new Module(coreP); fake.filename = coreP; fake.loaded = true;
fake.exports = { getConfig: () => CFG, setConfig: (c) => { CFG = c; }, BASE: ROOT, STYLES_DIR: os.tmpdir() };
require.cache[coreP] = fake;
const F = require("../lib/podFind"), PF = require("../lib/podFails"), PP = require("../lib/podPrep"), UI = require("../static/podfails.js");
const rd = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const NAME = "krea2_nsfw-aio-2.safetensors";
const VER = { id: 77, name: "v2", model: { name: "Krea2 NSFW AIO" }, files: [{ name: "other.safetensors", downloadUrl: "https://civitai.com/api/download/models/1" }, { name: NAME, downloadUrl: "https://civitai.com/api/download/models/77", sizeKB: 1000, hashes: { SHA256: "AB" } }] };

(async () => {
  /* ---- podFind pure */
  check("catOf / kindOf: unet -> diffusion_models, a LoRA need = lora", F.catOf(["unet"]) === "diffusion_models" && F.catOf(["checkpoints", "diffusion_models"]) === "checkpoints" && F.kindOf(["loras"]) === "lora" && F.kindOf(["checkpoints"]) === "model");
  check("entryHit: a remote_models.json entry with a link = a hit (from Civitai); no link = none", F.entryHit({ url: "https://civitai.red/api/download/models/9", folder: "checkpoints/Krea", name: NAME, source: "civitai", size: 5 }).site === "civitai.red" && F.entryHit({ name: NAME }) === null);
  check("fileOf: the file of THAT name in a Civitai version (not another file of it)", F.fileOf(VER, "Krea2/" + NAME).url.endsWith("/77") && F.fileOf(VER, "nope.safetensors") === null);

  /* ---- podFind.find: list -> info card -> search */
  const asked = [];
  F.setDeps({ remote: () => ({ url: "https://huggingface.co/x/resolve/main/" + NAME, folder: "checkpoints", name: NAME, source: "huggingface" }), info: () => null, version: async () => { asked.push("v"); return VER; }, search: async () => { asked.push("s"); return { items: [] }; } });
  let h = await F.find(["checkpoints"], NAME);
  check("1. your remote models list first (its link; Civitai not asked)", h && h.how === "list" && /huggingface/.test(h.url) && !asked.length, h);
  F.setDeps({ remote: () => null, info: () => ({ status: "found", civitai: { id: 77 } }), version: async (id) => { asked.push("v" + id); return VER; }, search: async () => { asked.push("s"); return { items: [] }; } });
  h = await F.find(["checkpoints"], NAME);
  check("2. its Civitai info card: the version it matched asked again, the file of that name -> a Civitai download", h && h.how === "info" && h.url.endsWith("/models/77") && h.from === "Civitai" && h.folder === "checkpoints" && asked.includes("v77") && !asked.includes("s"), h);
  F.setDeps({ remote: () => null, info: () => null, version: async () => VER, search: async (q, kind) => { asked.push("q:" + q + ":" + kind); return { items: [{ id: 5, name: "Krea2 NSFW AIO", modelVersions: [VER] }] }; } });
  h = await F.find(["checkpoints", "diffusion_models", "unet"], "Krea2/" + NAME, (t) => asked.push("say:" + t));
  check("3. a Civitai search by its name (Checkpoint): the SAME file name in a version -> its download, model name kept", h && h.how === "search" && h.url.endsWith("/77") && /Krea2 NSFW AIO/.test(h.model) && h.name === NAME && asked.some((x) => /^q:.*:model$/.test(x)) && asked.some((x) => /say:looking for krea2_nsfw-aio-2/.test(x)), { h, asked });
  F.setDeps({ remote: () => null, info: () => null, version: async () => VER, search: async () => ({ items: [{ id: 5, name: "x", modelVersions: [{ id: 1, files: [{ name: "krea2_nsfw-aio-3.safetensors", downloadUrl: "https://civitai.com/api/download/models/2" }] }] }] }) });
  check("…only that file name (or its stem) is taken - another file is not a guess", (await F.find(["checkpoints"], NAME)) === null);
  let n = 0; F.setDeps({ remote: () => null, info: () => null, version: async () => VER, search: async () => { n++; return { items: [{ id: 5, name: "x", modelVersions: [VER] }] }; } });
  await F.find(["loras"], NAME); await F.find(["loras"], NAME);
  check("…a hit kept for 10 minutes (the same name again = no new search)", n === 1);

  /* ---- podSend.ensure uses it; podPrep looks before calling a file missing */
  check("podSend.ensure: not on this computer -> found online (lib/podFind.js) and downloaded by the pod before 'not in this computer's folders'", /require\("\.\/podFind"\)\.find\(cats, name, tell\)/.test(rd("lib/podSend.js")) && /require\("\.\/podFind"\)\.pull\(id, port, hit, say/.test(rd("lib/podSend.js")));

  const files = { checkpoints: [] }; let pulled = [], pullWhy = "403 Civitai refused it";
  const D = {
    ways: async () => ({ pod_id: "p", jupyter: true, manager: false, comfy_dir: "/ComfyUI" }),
    contents: async () => ({ models: JSON.parse(JSON.stringify(files)) }), download: async () => ({ started: 0 }), state: async () => ({ running: false, files: [] }),
    send: async () => { throw new Error("sending x.safetensors to the pod: HTTP 413 the upload was too big"); }, local: (cats, nm) => nm === "x.safetensors" ? { path: "/x" } : null,
    objectInfo: async () => ({ CheckpointLoaderSimple: {} }), kernel: async () => "", nodeState: async () => null, reboot: async () => true,
    catalog: () => ({ models: [] }), packs: () => [], graph: () => ({}), classesOf: () => ["CheckpointLoaderSimple"], needs: () => [{ name: "Krea2/" + NAME, cat: "checkpoints" }, { name: "x.safetensors", cat: "loras" }, { name: "gone.safetensors", cat: "loras" }],
    cfg: () => ({}), sleep: async () => {}, locate: null,
    online: async (cats, nm) => nm.endsWith(NAME) ? { url: "https://civitai.com/api/download/models/77", folder: "checkpoints", name: NAME, from: "Civitai", model: "Krea2 NSFW AIO" } : null,
    pull: async (id, port, hit, say, o) => { pulled.push(hit.name + "|" + o.rel); if (!pullWhy) files.checkpoints.push("Krea2/" + NAME); return pullWhy; },
  };
  process.env.H3_POD_LIST_WAIT = "1";
  PF.clear();
  const ST = [{ id: "krea2raw", name: "Krea 2 Raw", kind: "image", workflow: "w.json" }];
  const r = await PP.prepare("pod1", 8188, ST, { deps: D });
  check("podPrep: the checkpoint found on Civitai is downloaded by the pod (kept in its sub-folder name) - not called missing", pulled.length === 1 && pulled[0] === NAME + "|Krea2/" + NAME && !r.problems.some((p) => /not found on Civitai by its name/.test(p) && p.startsWith("Krea2/")), { pulled, p: r.problems });
  check("…what still failed is said: the pod's download (why), the upload (why), the one found nowhere", r.notThere.length === 3 && r.problems.some((p) => /the pod could not download it from Civitai - 403/.test(p)) && r.problems.some((p) => /HTTP 413/.test(p)) && r.problems.some((p) => /^gone\.safetensors - not on the pod.*not found on Civitai by its name/.test(p)), r.problems);
  let L = PF.list();
  const by = (nm) => L.find((f) => f.name === nm) || {};
  check("podFails: the three kept for the pod - download / upload / missing, each with why and the style that needs it; not asked yet",
    L.length === 3 && by(NAME).how === "download" && /403/.test(by(NAME).why) && by("x.safetensors").how === "upload" && /413/.test(by("x.safetensors").why) && by("gone.safetensors").how === "missing"
    && L.every((f) => f.pod === "pod1" && f.styles[0] === "Krea 2 Raw" && !f.asked), L);
  check("…the page's words for one", /krea2_nsfw-aio-2\.safetensors the pod could not download it: .*403/.test(by(NAME).words), by(NAME).words);

  /* ---- the page's box (pure) */
  check("static/podfails.js: pending = not asked, not being retried; grouped by pod (one box each); the how in words",
    UI.pending([{ asked: true }, { retrying: true }, { id: 1 }]).length === 1 && UI.groupOf([{ pod: "a", id: 1 }, { pod: "b", id: 2 }, { pod: "a", id: 3 }]).map((g) => g.pod + g.files.length).join() === "a2,b1"
    && /from this computer failed/.test(UI.howWords("upload")) && /could not download/.test(UI.howWords("download")) && /Not found/.test(UI.howWords("missing")));

  /* ---- Not now / Try again */
  check("dismiss: not asked again", PF.dismiss(by("gone.safetensors").id) && PF.list().find((f) => f.name === "gone.safetensors").asked === true);
  let prepped = null;
  const rr = PF.retry(by(NAME).id, { port: () => 9000, prepare: async (pod, port, sts) => { prepped = { pod, port, sts: sts.map((s) => s.name) }; } });
  await new Promise((ok) => setTimeout(ok, 20));
  check("Try again: the pod's failed styles made ready again (once - the styles of all its failed files), on the pod's port; the files marked asked + tried",
    rr.started && rr.pod === "pod1" && rr.files.length === 3 && prepped && prepped.pod === "pod1" && prepped.port === 9000 && prepped.sts.join() === "Krea 2 Raw" && PF.list().every((f) => f.asked && f.tries === 1 && !f.retrying), { rr, prepped, L: PF.list() });
  pullWhy = ""; D.send = async () => { files.checkpoints.push("x.safetensors"); return {}; }; D.needs = () => [{ name: "Krea2/" + NAME, cat: "checkpoints" }, { name: "x.safetensors", cat: "loras" }];
  files.checkpoints.push("x.safetensors");
  const r2 = await PP.prepare("pod1", 8188, ST, { deps: D });
  check("…a run that puts them on the pod clears them (nothing to ask)", r2.notThere.length === 0 && PF.list().length === 0, { nt: r2.notThere, L: PF.list() });
  PP.prepare("pod2", 8188, ST, { deps: Object.assign({}, D, { needs: () => [{ name: "y.safetensors", cat: "loras" }], online: undefined }) });
  await new Promise((ok) => setTimeout(ok, 30));
  check("…a failure again is asked again (a new entry, not asked)", PF.list().some((f) => f.pod === "pod2" && f.name === "y.safetensors" && !f.asked));
  let thrown = null; try { PF.retry("nope"); } catch (e) { thrown = e; }
  check("…a file no longer waiting: 404", thrown && thrown.status === 404);

  /* ---- wiring */
  const IDX = rd("routes/index.js"), RT = rd("routes/podFails.js"), H = rd("static/index.html");
  check("routes: GET /api/pods/fails, POST …/:id/retry, …/:id/dismiss - mounted from routes/index.js (not server.js); the page loads static/podfails.js",
    /require\("\.\/podFails"\)\.mount\(app\)/.test(IDX) && /app\.get\("\/api\/pods\/fails"/.test(RT) && /\/api\/pods\/fails\/:id\/retry/.test(RT) && /\/api\/pods\/fails\/:id\/dismiss/.test(RT) && /<script src="\/static\/podfails\.js">/.test(H) && !/podFails/.test(rd("misc/server.js")));
  check("tests' stand-ins never reach Civitai (no online lookup unless the test gives one)", /if \(\(opts \|\| \{\}\)\.deps && !opts\.deps\.online\) delete DD\.online;/.test(rd("lib/podPrep.js")));
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
