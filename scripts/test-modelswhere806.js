#!/usr/bin/env node
/* bitGen Studio — 2.806.0 units: a missing model / LoRA - checked against the RunPod pod a render goes to (⬆ Send to <pod>)
 * or found online for this computer (⬇ Download) - lib/modelsWhere.js, routes/modelsFound.js, static/modelsfound.js.
 * Tim (verbatim): "If any lora/model is missing popup a message box asking if bitgen should download it, download it to local
 * if generation is in local mode or send to the pod if in runpod mode." No network, no pod, no studio. */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path");
const ROOT = path.join(__dirname, "..");
const MW = require("../lib/modelsWhere");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

(async () => {
  check("catsFor: a model in any model folder, a LoRA in loras, a text encoder in text_encoders / clip",
    MW.catsFor("checkpoints").join() === "checkpoints,diffusion_models,unet" && MW.catsFor("loras").join() === "loras" && MW.catsFor("text_encoders").join() === "text_encoders,clip");
  const rows = [{ name: "krea2_raw.safetensors", cat: "diffusion_models", from: "style" }, { name: "SDXL/detail.safetensors", cat: "loras", from: "style" }, { name: "ae.safetensors", cat: "vae", from: "workflow" }];
  const models = { checkpoints: ["krea2_raw.safetensors"], loras: [], vae: ["ae.safetensors"] };
  const miss = MW.podMissing(rows, models);
  check("podMissing: a model in another model folder counts as there; the LoRA the pod lacks is missing", miss.length === 1 && miss[0].name === "SDXL/detail.safetensors", miss);
  check("podMissing: the same file name in another sub-folder counts as there", MW.podMissing([{ name: "SDXL/detail.safetensors", cat: "loras" }], { loras: ["mine/detail.safetensors"] }).length === 0);
  check("cleanItems: names + folders only, no '..', at most 20", MW.cleanItems([{ name: "../x.safetensors", cat: "loras" }, { name: "\\a\\b.safetensors", cat: "lo/ras" }, { url: "http://evil" }]).length === 1
    && MW.cleanItems([{ name: "\\a\\b.safetensors", cat: "lo/ras" }])[0].name === "a/b.safetensors" && MW.cleanItems([{ name: "\\a\\b.safetensors", cat: "lo/ras" }])[0].cat === "loras");

  const pod = { pod_id: "abc123", name: "Pod A" };
  const r = await MW.checkPod(rows, pod, { contents: async () => ({ models }) });
  check("checkPod: the pod's lists asked - checked, place pod, its name, what it lacks with its folder", r.checked && r.place === "pod" && r.pod_name === "Pod A" && r.found === 2 && r.missing.length === 1 && r.missing[0].name === "SDXL/detail.safetensors" && r.missing[0].folder === "models/loras" && typeof r.missing[0].here === "boolean", r);
  const r2 = await MW.checkPod(rows, pod, { contents: async () => { throw new Error("the pod is stopped on RunPod"); } });
  check("checkPod: a pod that does not answer = not checked, with why (its own preparation goes on)", !r2.checked && /stopped/.test(r2.why) && /preparation/.test(r2.why), r2);
  const r3 = await MW.checkPod(rows, pod, { contents: () => new Promise(() => {}), wait: 50 });
  check("checkPod: a pod that never answers is not waited for", !r3.checked && /did not answer/.test(r3.why), r3);

  // online + fetchLocal with stand-ins
  const T = fs.mkdtempSync(path.join(os.tmpdir(), "mw806-"));
  const body = Buffer.from("x".repeat(5000));
  let asked = "";
  MW.setDeps({
    find: async (cats, name) => (/detail/.test(name) ? { url: "https://civitai.com/api/download/models/9", from: "Civitai", size: body.length, model: "Detail Tweaker" } : null),
    fetch: async (u) => { asked = u; return new Response(body, { status: 200, headers: { "content-length": String(body.length) } }); },
    dir: () => T, key: () => "KEY1",
  });
  const m = [{ name: "SDXL/detail.safetensors", cat: "loras" }, { name: "nowhere.safetensors", cat: "loras" }, { name: "cat.safetensors", cat: "checkpoints", source: { id: "x" } }];
  await MW.online(m);
  check("online: a file not in the download list found online gets {online: from, size, model}; others left", m[0].online && m[0].online.from === "Civitai" && m[0].online.model === "Detail Tweaker" && !m[1].online && !m[2].online, m);
  MW.fetchLocal([{ name: "SDXL/detail.safetensors", cat: "loras" }]);
  for (let i = 0; i < 50 && MW.fetchState().busy; i++) await new Promise((ok) => setTimeout(ok, 20));
  const st = MW.fetchState(), f = st.files["SDXL/detail.safetensors"], dest = path.join(T, "models", "loras", "SDXL", "detail.safetensors");
  check("fetchLocal: downloaded into ComfyUI's models/<folder>/<sub-folders> here, whole, no .part left", f && f.state === "ok" && fs.existsSync(dest) && fs.statSync(dest).size === body.length && !fs.existsSync(dest + ".part"), { f, exists: fs.existsSync(dest) });
  check("fetchLocal: the address is looked up HERE, Civitai's key added", /token=KEY1/.test(asked), asked);
  MW.setDeps({ find: async () => null, fetch: async () => { throw new Error("no"); }, dir: () => T, key: () => "" });
  MW.fetchLocal([{ name: "gone.safetensors", cat: "loras" }]);
  for (let i = 0; i < 50 && MW.fetchState().busy; i++) await new Promise((ok) => setTimeout(ok, 20));
  check("fetchLocal: not found online any more = an error on that file", MW.fetchState().files["gone.safetensors"].state === "err" && /not found online/.test(MW.fetchState().files["gone.safetensors"].error));
  fs.rmSync(T, { recursive: true, force: true });

  const R = src("routes/modelsFound.js"), S = src("static/modelsfound.js");
  check("route: a render on a pod is checked against that pod (no more 'its files are put on the pod' skip); online lookup for here",
    /checkPod\(p\.rows, p\.pod\)/.test(R) && !/return \{ skip: "it renders on a RunPod pod - its files are put on the pod" \}/.test(R) && /modelsWhere"\)\.online\(r\.missing\)/.test(R)
    && /\/api\/models\/pod-send/.test(R) && /\/api\/models\/fetch/.test(R));
  check("route: the editor's Override (ovr: checkpoint + temporary LoRAs) is checked too", /extra_loras: loraList\(ov\.extra_loras\)/.test(R) && /ovr: f\("ovr"\)/.test(S));
  check("box: ⬆ Send to <pod> -> /api/models/pod-send, the online files -> /api/models/fetch", /"⬆ Send to " \+ pod\.name/.test(S) && /jpost\("\/api\/models\/pod-send"/.test(S) && /jpost\("\/api\/models\/fetch"/.test(S));
  console.log("\nRESULT: " + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
