#!/usr/bin/env node
/* bitGen Studio — 2.787.0 units: each pod's inventory (lib/podInv.js), the picked model decides the pod (lib/podPick.js), the
 * lists' "<pod>/<file>" entries (routes/podInv.js withPods), Basic Settings ▸ Remote (lib/basicUse.js, static/remoteuse.js) and
 * PODS ▸ 🗂 Inventory (static/podinv.js). Pure + a temporary folder - no studio, no network. */
"use strict";
const path = require("path"), fs = require("fs"), os = require("os");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "podinv787-"));
process.env.H3_POD_INV_DIR = TMP;
const ROOT = path.join(__dirname, "..");
const PI = require("../lib/podInv"), PK = require("../lib/podPick"), BU = require("../lib/basicUse");
const RU = require("../static/remoteuse.js"), PV = require("../static/podinv.js");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };

// ---- pure
check("kindOf: models / vae / text encoders / loras / other", PI.kindOf("checkpoints") === "model" && PI.kindOf("unet") === "model" && PI.kindOf("vae") === "vae" && PI.kindOf("clip") === "te" && PI.kindOf("text_encoders") === "te" && PI.kindOf("loras") === "lora" && PI.kindOf("upscale_models") === "other");
const L = PI.fromListing({ files: [{ path: "checkpoints/Krea2/k.safetensors", size: 7e9 }, { path: "loras/a.safetensors", size: 2e8 }, { path: "vae/ae.safetensors", size: 3e8 }, { path: "loras/half.safetensors.part", partial: true }, { path: "top.bin" }] });
check("fromListing: cat + rel + kind, half-done and top-level files left out", L.length === 3 && L[0].cat === "checkpoints" && L[0].rel === "Krea2/k.safetensors" && L[0].kind === "model" && L[1].kind === "lora" && L.every((f) => f.state === "on"), L);
const A = { id: "podA1", name: "Krea pod", files: L }, B = { id: "podB2", name: "Krea pod big", files: [{ cat: "loras", rel: "a.safetensors", kind: "lora", state: "on" }] }, G = { id: "podC3", name: "Old", gone: true, files: L };
const E = PI.entries([A, B, G]);
check("entries: <pod>/<rel> in checkpoints + loras, the pod as the folder, a gone pod left out", E.checkpoints.length === 1 && E.checkpoints[0].name === "Krea pod/Krea2/k.safetensors" && E.checkpoints[0].folder === "Krea pod/Krea2" && E.checkpoints[0].pod === "podA1"
  && E.loras.map((x) => x.name).join() === "Krea pod big/a.safetensors,Krea pod/a.safetensors" && !E.vae, E);
check("resolve: the longest pod name first, only a file it has", JSON.stringify(PI.resolve("Krea pod big/a.safetensors", [A, B], ["loras"])) === JSON.stringify({ pod_id: "podB2", name: "Krea pod big", cat: "loras", rel: "a.safetensors" })
  && PI.resolve("Krea pod/a.safetensors", [A, B], ["loras"]).pod_id === "podA1" && PI.resolve("Krea pod/nope.safetensors", [A, B]) === null && PI.resolve("Krea2/k.safetensors", [A, B]) === null);
check("resolve: a gone pod's files are not picked; the category matters", PI.resolve("Old/Krea2/k.safetensors", [G]) === null && PI.resolve("Krea pod/Krea2/k.safetensors", [A], ["loras"]) === null);
check("labelOf: a slash in a pod name is not a folder", PI.labelOf({ id: "x", name: "a/b" }) === "a-b");
const n1 = PI.noteIn(L, ["checkpoints", "diffusion_models"], "new.gguf", 5);
check("noteIn: a new file 'sent' in the first category; one it knows stays 'on'", n1.length === 4 && n1[3].state === "sent" && n1[3].cat === "checkpoints" && PI.noteIn(L, ["loras"], "a.safetensors")[1].state === "on");
check("dropIn: deleted paths go", PI.dropIn(L, ["loras/a.safetensors"]).length === 2);
check("groupsOf: Models / VAE / LoRAs in order", PI.groupsOf(L).map((g) => g.label).join() === "Models,VAE,LoRAs");
check("isInvFile: pod files only", PI.isInvFile("abc123xyz.json") && !PI.isInvFile("remote_models.json") && !PI.isInvFile("presets"));

// ---- live (the temporary folder)
PI.fromList("podA1", { files: [{ path: "checkpoints/Krea2/k.safetensors", size: 7e9 }, { path: "loras/a.safetensors", size: 2e8 }] }, "Krea pod");
PI.noteSent("podA1", ["loras"], "b.safetensors", 1e8);
let inv = PI.load("podA1");
check("fromList + noteSent: runpod/pods/<id>.json kept", inv && inv.name === "Krea pod" && inv.files.length === 3 && inv.listed_at > 0 && fs.existsSync(path.join(TMP, "podA1.json")), inv);
PI.noteDeleted("podA1", ["loras/b.safetensors"]);
check("noteDeleted", PI.load("podA1").files.length === 2);
fs.writeFileSync(path.join(TMP, "remote_models.json"), "{}");
PI.sync([{ id: "podA1", name: "Krea pod", status: "RUNNING" }, { id: "podN9", name: "New one", status: "RUNNING", bitgen: true }]);
check("sync: all() reads only pod files; a new bitGen pod gets an empty inventory", PI.all().map((i) => i.id).sort().join() === "podA1,podN9", PI.all().map((i) => i.id));
PI.sync([{ id: "podN9", name: "New one", status: "RUNNING", bitgen: true }]);
check("sync: a pod RunPod no longer lists = gone (kept), out of the live list", PI.load("podA1").gone === true && PI.live().map((i) => i.id).join() === "podN9");
PI.sync([{ id: "podA1", name: "Krea pod 2", status: "EXITED" }, { id: "podN9", name: "New one", status: "RUNNING" }]);
check("sync: a stopped pod is not gone; its new name kept", PI.load("podA1").gone === false && PI.load("podA1").name === "Krea pod 2");
const v = PI.view("podA1");
check("view: groups + label", v && v.label === "Krea pod 2" && v.groups.length === 2 && v.count === 2, v);

// ---- podPick.picksOf (pure) + apply
const invs = [Object.assign({}, PI.load("podA1"))];
const st = { name: "S", model_override: true, model: "Krea pod 2/Krea2/k.safetensors", loras: [{ name: "Krea pod 2/a.safetensors", strength: 1 }, { name: "local.safetensors" }] };
const P = PK.picksOf(st, invs, PI.resolve);
check("picksOf: the Override model + a pod LoRA found, a local LoRA not", P.refs.length === 2 && P.refs[0].where === "model" && P.refs[1].where === "lora" && P.refs.every((r) => r.pod_id === "podA1"), P.refs);
P.fix(st);
check("…fix: the plain file names ComfyUI lists on the pod", st.model === "Krea2/k.safetensors" && st.loras[0].name === "a.safetensors" && st.loras[1].name === "local.safetensors", st);
const vs = { name: "V", basic_model: "Krea pod 2/Krea2/k.safetensors", phases: [{ model: "Krea pod 2/Krea2/k.safetensors" }, { model: "x" }] };
const P2 = PK.picksOf(vs, invs, PI.resolve); P2.fix(vs);
check("picksOf: a video model (phases[0]) from Basic Settings", P2.refs.length === 1 && vs.phases[0].model === "Krea2/k.safetensors" && vs.phases[1].model === "x" && vs.basic_model === "Krea2/k.safetensors", vs);
check("picksOf: the style's own model is not touched (no Override)", PK.picksOf({ model: "Krea pod 2/Krea2/k.safetensors" }, invs, PI.resolve).refs.length === 0);
const q = { mode: "image", style: { name: "S", model_override: true, model: "Krea pod 2/Krea2/k.safetensors", loras: [] } };
const pk = PK.apply(q);
check("apply: params.pod_pick = that pod, the name plain; applied once", pk && pk.pod_id === "podA1" && q.style.model === "Krea2/k.safetensors" && q.pod_pick_done && PK.apply(q) === pk, pk);
PI.fromList("podN9", { files: [{ path: "loras/z.safetensors" }] }, "New one");
const q2 = { mode: "image", style: { name: "S", model_override: true, model: "Krea pod 2/Krea2/k.safetensors", loras: [{ name: "New one/z.safetensors" }] } };
check("apply: two pods asked for = an error said, not rendered", /different pods/.test((PK.apply(q2) || {}).error || ""));
check("apply: an API / pod style is left alone", PK.apply({ mode: "image", style: { runs_on: "api", model_override: true, model: "Krea pod 2/Krea2/k.safetensors" } }) === null);

// ---- Basic Settings ▸ Remote (pure parts)
const u = BU.of({ basic_use: { image_model: false, image_model_pod: "pod!A1", video_loras_pod: "podB2" } });
check("basicUse.of: the *_pod keys cleaned, left out when Remote is off (the four flags' JSON as before)", u.image_model === false && u.image_model_pod === "podA1" && u.video_loras_pod === "podB2" && !("image_loras_pod" in u) && BU.POD_KEYS.length === 4
  && JSON.stringify(BU.of({})) === '{"image_model":true,"image_loras":true,"video_model":true,"video_loras":true}');
const rh = RU.rowHtml(RU.ROWS[0], [{ id: "podA1", label: "Krea pod 2" }, { id: "podN9", label: "New one" }], "podN9");
check("remoteuse rowHtml: ☐ Remote ticked + the pod picked", /data-rukey="image_model_pod" checked/.test(rh) && /value="podN9" selected/.test(rh) && !/disabled/.test(rh) && RU.ROWS.length === 4);
check("remoteuse rowHtml: unticked = the list greyed", /disabled/.test(RU.rowHtml(RU.ROWS[1], [{ id: "a", label: "A" }], "")));

// ---- the lists + the panel
const W = require("../routes/podInv").withPods({ categories: { checkpoints: { files: [{ name: "mine.safetensors" }] }, loras: { files: [] } } }, PI.live());
check("withPods: the pods' files ADDED, this computer's kept", W.pod_models && W.categories.checkpoints.files.map((f) => f.name).join() === "mine.safetensors,Krea pod 2/Krea2/k.safetensors" && W.categories.loras.files.some((f) => f.name === "New one/z.safetensors"), W.categories);
check("withPods: no pod files = the answer untouched", require("../routes/podInv").withPods({ categories: {} }, []).pod_models === undefined);
const ph = PV.panelHtml(PI.view("podA1"), true);
check("podinv panel: groups, ✓, ⟳ when running, the <pod>/<file> line", /Models \(1\)/.test(ph) && /LoRAs \(1\)/.test(ph) && /data-pirefresh/.test(ph) && /Krea pod 2\/&lt;file&gt;/.test(ph) && !/data-pirefresh/.test(PV.panelHtml(PI.view("podA1"), false)));

// ---- wired in
const src = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
check("core calls podPick before the pod gate; the gate honours the pick", /podPick"\)\.apply\(q0\.params\)/.test(src("lib/core.js")) && /how: "pick"/.test(src("lib/stylePods.js")) && /if \(!pick && !podJob/.test(src("lib/stylePods.js")));
check("routes: podInv mounted before remoteModels; the route check + models-found know picks", src("routes/index.js").indexOf('require("./podInv").mount') < src("routes/index.js").indexOf('require("./remoteModels").mount')
  && /wouldPod/.test(src("routes/stylePods.js")) && /wouldPod/.test(src("routes/modelsFound.js")));
check("inventory fed by listings, transfers, deletions", /podInv"\)\.fromList/.test(src("lib/podFiles.js")) && /podInv"\)\.noteDeleted/.test(src("lib/podFiles.js")) && /podInv"\)\.noteSent/.test(src("lib/podSend.js")) && /podInv"\)\.noteSent/.test(src("lib/remoteModels.js")));
check("Basic Settings marks its own model / LoRAs (basic_model, temp_loras)", /basic_model: bo\.model/.test(src("routes/index.js")) && /temp_loras: extra\.map/.test(src("routes/index.js")) && /temp_loras: extraV\.map/.test(src("routes/index.js")));

fs.rmSync(TMP, { recursive: true, force: true });
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
