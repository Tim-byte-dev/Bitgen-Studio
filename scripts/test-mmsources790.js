#!/usr/bin/env node
/* bitGen Studio — 2.790.0 units: 🧩 Model manager ☐ Local ☐ RunPod ☐ OpenRouter ☐ All (lib/mmSources.js, static/mmsrc.js), 🗑 by place
 * (a pod's file hidden - lib/podInv.js hide; the remote list; your OpenRouter list), ☁ OpenRouter tab (static/mmor.js) + the endpoint
 * kept with a model (lib/orModels.js endpointOf). Temporary folders - no studio, no network. */
"use strict";
const path = require("path"), fs = require("fs"), os = require("os");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "mmsrc790-"));
process.env.H3_POD_INV_DIR = path.join(TMP, "pods");
process.env.H3_REMOTE_MODELS = path.join(TMP, "remote_models.json");
const ROOT = path.join(__dirname, "..");
const MS = require("../lib/mmSources"), PI = require("../lib/podInv"), OM = require("../lib/orModels"), MC = require("../lib/modelCards");
const SRC = require("../static/mmsrc.js"), MO = require("../static/mmor.js");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

// ---- the endpoint kept with an OpenRouter model
check("endpointOf: image / video / the LLMs - OpenRouter's addresses", OM.endpointOf("image", "https://openrouter.ai/api/v1/") === "https://openrouter.ai/api/v1/images" && OM.endpointOf("video") === "https://openrouter.ai/api/v1/videos" && OM.endpointOf("llm") === "https://openrouter.ai/api/v1/chat/completions" && OM.endpointOf("vlm", "http://x/v1") === "http://x/v1/chat/completions");
const S0 = src("lib/orModels.js");
check("add keeps the endpoint (and the answer names the entry); your list fills it in for older entries; a refresh keeps it", /endpoint: endpointOf\(type, OR\(\)\.BASE\(\)\) \}\);   \/\/ 2\.790\.0/.test(S0) && /added: true, entry: e/.test(S0) && /x\.endpoint \? x : Object\.assign\(\{\}, x, \{ endpoint: endpointOf\(t, OR\(\)\.BASE\(\)\) \}\)/.test(S0) && /endpoint: m\.endpoint \|\| endpointOf\(type/.test(S0));

// ---- cards of each place
const invs = [{ id: "podA1", name: "Krea pod", files: [{ cat: "checkpoints", rel: "Models/krea2.safetensors", kind: "model", state: "on", size: 9e9 }, { cat: "loras", rel: "grain.safetensors", kind: "lora", state: "sent" }, { cat: "vae", rel: "ae.safetensors", kind: "vae", state: "on" }, { cat: "checkpoints", rel: "old.safetensors", kind: "model", state: "on" }], hidden: ["checkpoints/old.safetensors"] },
  { id: "podB2", name: "Gone", gone: true, keep: true, files: [{ cat: "loras", rel: "x.safetensors", kind: "lora", state: "on" }] }, { id: "podC3", name: "Dropped", gone: true, files: [{ cat: "loras", rel: "y.safetensors", kind: "lora", state: "on" }] }];
const P = MS.podCards(invs, MC.cardFrom, PI);
check("pod cards: <pod name>/<rel> (the lists' name), source runpod, no VAE, a hidden file left out", P.models.length === 1 && P.models[0].name === "Krea pod/Models/krea2.safetensors" && P.models[0].key === "pi:podA1|checkpoints|Models/krea2.safetensors" && P.models[0].source === "runpod" && P.models[0].pi && P.models[0].family === "krea", P.models);
check("pod cards: a NO_Pod's LoRA (nopod), a dropped gone pod none", P.loras.map((c) => c.name).join() === "Krea pod/grain.safetensors,NO_Pod (Gone)/x.safetensors" && P.loras[1].nopod === true && /terminated/.test(P.loras[1].description));
const O = MS.orCard({ id: "google/gemini-3-image", name: "Gemini 3 Image", maker: "google", price: "$0.04 a picture", endpoint: "https://openrouter.ai/api/v1/images", added: 1763000000000 }, "image", OM.familyLabel);
check("OpenRouter card: openrouter/<id> (the dropdowns' name), source openrouter, the maker as family, the price + endpoint said", O.name === "openrouter/google/gemini-3-image" && O.key === "or:image:google/gemini-3-image" && O.source === "openrouter" && O.family_label === "Google" && O.category === "image" && /\$0\.04 a picture · renders at https:\/\/openrouter\.ai\/api\/v1\/images/.test(O.description), O);
check("an OpenRouter video model = category video", MS.orCard({ id: "x/v", name: "V" }, "video").category === "video");

// ---- one list, the ticks
const local = { models: [{ key: "checkpoints|a", name: "a", family: "sdxl", category: "image" }], loras: [{ key: "loras|l", name: "l" }], families: [{ id: "sdxl", label: "SDXL" }], categories: ["image"], model_types: [], templates: [] };
const D = SRC.merge(local, { models: P.models, loras: P.loras }, { models: [O] }, { pods_mode: true });
check("merge: this computer's (source local) + RunPod + OpenRouter in Models / LoRAs, remote mode kept, the OpenRouter maker as a family", D.models.length === 3 && D.models[0].place === "local" && D.models[1].place === "runpod" && D.models[2].place === "openrouter" && D.loras.length === 3 && D.remote_list === true && D.sources === true && D.families.some((f) => f.id === "or:google" && f.label === "Google"), D.families);
const D2 = SRC.merge({ error: "no ComfyUI folder" }, { models: P.models }, null, null);
check("merge: this computer unreadable = the others still listed, the reason in the warnings", D2.models.length === 1 && /no ComfyUI folder/.test(D2.warnings[0]));
// 2.796.0: a card of this computer has a `source` of its own (how its Civitai details matched) - the place is c.place
const Dn = SRC.merge({ models: [{ key: "checkpoints|n", name: "n", source: "name" }, { key: "checkpoints|h", name: "h", source: "sha256" }], loras: [] }, { models: P.models }, null, null);
check("2.796.0 (Tim: 'the model manager filters are not working'): a local card's own source ('name', 'sha256') is not its place - counted + shown as this computer", JSON.stringify(SRC.counts(Dn.models)) === '{"local":2,"runpod":1,"openrouter":0}' && SRC.shown(Dn.models[0], "local") && !SRC.shown(Dn.models[0], "runpod") && SRC.shown(Dn.models[2], "runpod") && !SRC.shown(Dn.models[2], "local"), SRC.counts(Dn.models));
check("shown: All places shows every card; one place only its own; placeOf falls back on the source for older cards", SRC.shown({ place: "runpod" }, "all") && !SRC.shown({ place: "runpod" }, "openrouter") && SRC.placeOf({ source: "openrouter" }) === "openrouter" && SRC.placeOf({ source: "name" }) === "local" && SRC.placeOf({}) === "local");
check("counts per place", JSON.stringify(SRC.counts(D.models)) === '{"local":1,"runpod":1,"openrouter":1}');
const bar = SRC.barHtml("runpod", { local: 4, runpod: 2, openrouter: 1 });
check("2.796.0: the place is ONE dropdown (#mmPlace): All places (7) / This computer (4) / RunPod (2) / OpenRouter (1), the picked one selected", /<select id="mmPlace" data-mmsrc="place"/.test(bar) && /<option value="all">All places \(7\)/.test(bar) && /value="local"[^>]*>This computer \(4\)/.test(bar) && /value="runpod" selected[^>]*>RunPod \(2\)/.test(bar) && /value="openrouter"[^>]*>OpenRouter \(1\)/.test(bar) && !/checkbox/.test(bar), bar);
check("the tag on a card: Local / RunPod / NO_Pod / OpenRouter", /Local/.test(SRC.tagHtml({})) && />RunPod</.test(SRC.tagHtml({ source: "runpod", pod_name: "Krea pod" })) && />NO_Pod</.test(SRC.tagHtml({ source: "runpod", nopod: true })) && />OpenRouter</.test(SRC.tagHtml({ source: "openrouter" })));

// ---- 🗑 off the lists (live, temporary folders)
PI.save({ id: "podT1", name: "Test pod", files: invs[0].files.slice(0, 2) });
let r = MS.remove("pi:podT1|checkpoints|Models/krea2.safetensors");
check("🗑 a pod's file: off the lists (hidden), the pod keeps it; not listed / not picked any more", r.ok && /pod keeps the file/.test(r.said) && PI.load("podT1").hidden.includes("checkpoints/Models/krea2.safetensors") && PI.load("podT1").files.length === 2
  && !(PI.entries(PI.live()).checkpoints || []).length && PI.resolve("Test pod/Models/krea2.safetensors", PI.live(), PI.MODEL_CATS) === null, r);
PI.fromList("podT1", { files: [{ path: "checkpoints/Models/krea2.safetensors", size: 9e9 }, { path: "loras/grain.safetensors" }] }, "Test pod");
check("…the pod's next listing does not bring it back", !(PI.entries(PI.live()).checkpoints || []).length && PI.load("podT1").hidden.length === 1);
PI.noteSent("podT1", ["checkpoints"], "Models/krea2.safetensors", 9e9);
check("…bitGen putting it on the pod again lists it again", (PI.entries(PI.live()).checkpoints || []).length === 1);
check("🗑 a pod file it does not have: said", MS.remove("pi:podT1|checkpoints|nope.safetensors").ok === false);
const RM = require("../lib/remoteModels");
RM.save([{ id: "abc123", name: "krea2_raw.safetensors", folder: "diffusion_models", source: "huggingface", url: "https://huggingface.co/x/y/resolve/main/krea2_raw.safetensors", size: 1, pods: {} }]);
r = MS.remove("rm:abc123");
check("🗑 a remote-list card: off runpod/pods/remote_models.json", r.ok && RM.load().length === 0, r);
let err = ""; try { MS.remove("checkpoints|a.safetensors"); } catch (e) { err = e.message; }
check("🗑 on a card of this computer is not a list removal (the file delete asks first)", /deleted from the disk/.test(err));

// ---- the OpenRouter tab
const ch = MO.cardHtml({ id: "google/g", name: "G", free: false, price: "$0.04 a picture", maker: "google", desc: "draws" }, false), cm = MO.cardHtml({ id: "a/b", name: "B", free: true }, true);
check("the tab's card: name, id, price, maker, ＋ (not yet yours) / ✓ yours + 🗑", /<b>G<\/b><small>google\/g<\/small>/.test(ch) && /\$0\.04 a picture/.test(ch) && /data-oradd="google\/g"/.test(ch) && !/data-orrm/.test(ch) && /✓ yours/.test(cm) && /data-orrm="a\/b"/.test(cm) && />free</.test(cm));

// ---- wiring
const MM = src("static/modelmgr.js"), IX = src("static/index.html"), RI = src("routes/index.js");
check("modelmgr: every place loaded through H3MmSrc, the ticks filter, 🗑 off the list for pi / or cards, no info page for them", /window\.H3MmSrc\.load\(jget, refresh\)/.test(MM) && /window\.H3MmSrc\.shown\(c\)/.test(MM) && /c\.pi \|\| c\.or \? srcActs\(c\)/.test(MM) && /data-mmsrcdel/.test(MM) && /\^\(pi\|or\):/.test(MM) && /c\.rm \? rmActs\(c\)/.test(MM));
check("modelmgr: the ☁ OpenRouter tab (H3MmOr.render into #mmOr)", /data-mmtab="openrouter"/.test(MM) && /window\.H3MmOr\.render\(\$\("mmOr"\)/.test(MM) && /id="mmOr"/.test(MM) && /id="mmSrc"/.test(MM));
check("index.html loads mmsrc.js + mmor.js before modelmgr.js; routes mount mmSources", IX.indexOf("/static/mmsrc.js") > 0 && IX.indexOf("/static/mmsrc.js") < IX.indexOf("/static/modelmgr.js") && IX.indexOf("/static/mmor.js") < IX.indexOf("/static/modelmgr.js") && /require\("\.\/mmSources"\)\.mount\(app\)/.test(RI));

try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* fine */ }
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
