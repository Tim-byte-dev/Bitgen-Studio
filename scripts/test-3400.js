#!/usr/bin/env node
/* bitGen Studio — 3.4.0: Basic Settings ▸ Text encoder (PlatoKeys) + Settings ▸ Add-ons ▸ 🔑 PlatoKeys + bitGen's updated
 * Viggle Remake nodes. (The graph side: scripts/test-platokeys3400.py.)
 * Tim: "we can add it, and add a text encoder dropdown in basic settings to overide the models own. when we overide the text
 * encoder for our local llm it will automatically use the plato workflows. top option will be styles own. if it works for some
 * videos/images and makes it faster it will be good to have" + "please note, the updated viggle node i uploaded" */
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.join(__dirname, ".."), src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const PK = require(path.join(ROOT, "lib/platoKeys.js")), S = require(path.join(ROOT, "lib/samplers.js")), UI = require(path.join(ROOT, "static/samplerset.js"));
const H3K = "minimax_h3_32b_pk_ridge_qwen3.5_2b.safetensors", TE = "qwen3.5_2b_bf16.safetensors";
const KEYS = ["moss_image/qwen35_2b_comfy_to_qwen35_9b_moss_ridge.safetensors", "moss_image/qwen35_2b_to_qwen35_9b_moss_image_ridge.safetensors",
  "moss_image/qwen35_9b_to_qwen35_2b_moss_image_ridge.safetensors", "krea2/qwen35_2b_to_qwen3vl_4b_krea2_ridge.safetensors",
  "ablations/qwen35_2b_to_qwen3vl_4b_krea2_ridge_norm.safetensors", "z_image/qwen3vl_4b_to_zimage_qwen3_4b_ridge.safetensors", H3K];

(async () => {
  // the rules (lib/platoKeys.json - the Python side reads the same file)
  check("parseKey: official keys (source, family, stock-ComfyUI flag), Tim's H3 key; the reverse key and ablations are not picked",
    JSON.stringify(PK.parseKey(KEYS[0])) === JSON.stringify({ name: KEYS[0], family: "moss", source: "qwen352b", comfy: true, official: true })
    && PK.parseKey(H3K).family === "h3" && PK.parseKey(H3K).source === "qwen352b" && PK.parseKey(KEYS[2]) === null && PK.parseKey(KEYS[4]) === null && PK.parseKey("x.json") === null);
  check("pickKey: the stock-ComfyUI key first; a 2B file fits, a 20B does not; Tim's quantised 2B in a sub-folder fits",
    PK.pickKey(KEYS, TE, "moss") === KEYS[0] && PK.pickKey(KEYS, "LLMs\\qwen3.5_2b-w6a8_convrot.safetensors", "h3") === H3K && PK.pickKey(KEYS, "qwen3.5_20b.safetensors", "moss") === "");
  check("familyOfLoader: the styles' own encoders (H3 safetensors + GGUF, MOSS, Krea 2, Z-Image); P-H3 / FLUX.2 / music are not",
    PK.familyOfLoader("qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors", "minimax").id === "h3" && PK.familyOfLoader("qwen3vl_32b_minimax_h3-Q4_K_M.gguf", "minimax").id === "h3"
    && PK.familyOfLoader("qwen3.5_9b_w4a8_gptq.safetensors", "moss_image").id === "moss" && PK.familyOfLoader("qwen3vl_4b_fp8_scaled.safetensors", "krea2").id === "krea2"
    && PK.familyOfLoader("qwen_3_4b.safetensors", "lumina2").id === "zimage" && !PK.familyOfLoader("p-h3-image_text_encoder_int8_convrot.safetensors", "minimax")
    && !PK.familyOfLoader("qwen_3_8b_fp8mixed.safetensors", "flux2") && !PK.familyOfLoader("minimax_music3_text_encoder_pruned_int8_convrot.safetensors", "minimax"));
  const I = { online: true, encoders: [TE, "qwen3.5_9b_w4a8_gptq.safetensors", "qwen3vl_4b_fp8_scaled.safetensors", "qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors", "clip_l.safetensors"],
    official: true, keys: KEYS, fearn: true, fearnKeys: [H3K] };
  const o = PK.optionsOf(I);
  check("optionsOf: only encoders a key maps onto a family (not onto its own family), with the families' names",
    JSON.stringify(o) === JSON.stringify([{ file: TE, families: ["h3", "moss", "krea2"], labels: ["MiniMax H3", "MOSS-Image", "Krea 2"] }, { file: "qwen3vl_4b_fp8_scaled.safetensors", families: ["zimage"], labels: ["Z-Image"] }]), o);
  check("…no nodes in ComfyUI = no options; Tim's H3 key goes through PlatosKeyPatchCLIP, an official one through plato_keys",
    PK.optionsOf(Object.assign({}, I, { official: false, fearn: false })).length === 0 && PK.nodeFor(H3K, I) === "fearn" && PK.nodeFor(KEYS[0], I) === "official" && PK.nodeFor(KEYS[0], Object.assign({}, I, { official: false })) === "");
  // GET /api/platokeys from a ComfyUI's object_info
  const OI = { CLIPLoader: { input: { required: { clip_name: [I.encoders], type: [["minimax", "moss_image", "qwen_image"]] } } },
    "plato_keys.Load": { input: { required: { key_name: ["COMBO", { options: KEYS }] } } }, "plato_keys.PatchCLIP": { input: { required: {} } },
    PlatosKeyPatchCLIP: { input: { required: { clip: ["CLIP"], key_name: [[H3K]] } } } };
  const asked = [];
  const fetch = async (u) => { asked.push(u); const cls = decodeURIComponent(u.split("/object_info/")[1]); return { ok: true, json: async () => (OI[cls] ? { [cls]: OI[cls] } : {}) }; };
  const op = await PK.options({ urls: ["http://pod:1/"], fetch, refresh: true });
  check("options(): the ComfyUI's encoders + the keys its PlatoKeys nodes list -> the Basic Settings list, no note",
    op.online && op.nodes && op.encoders.length === 2 && op.encoders[0].file === TE && op.note === "" && asked[0] === "http://pod:1/object_info/CLIPLoader", { op, asked });
  const off = await PK.options({ urls: ["http://x:1"], fetch: async () => { throw new Error("down"); }, refresh: true });
  check("…ComfyUI not answering: empty list + a note", !off.online && off.encoders.length === 0 && /not answering/.test(off.note), off);
  check("routes/platoKeys.js: GET /api/platokeys, mounted from routes/index.js (not server.js)", /app\.get\("\/api\/platokeys"/.test(src("routes/platoKeys.js")) && /require\("\.\/platoKeys"\)\.mount\(app\)/.test(src("routes/index.js")));

  // the pick travels: page header -> lib/samplers clean / envOf -> the job's BITGEN_TEXT_ENCODER
  check("samplers.clean: + text_encoder (a file name, a sub-folder allowed; no ..); a sampler-only pick unchanged",
    JSON.stringify(S.clean({ text_encoder: "LLMs\\qwen3.5_2b-w6a8_convrot.safetensors" })) === JSON.stringify({ sampler: "", scheduler: "", text_encoder: "LLMs\\qwen3.5_2b-w6a8_convrot.safetensors" })
    && S.clean({ text_encoder: "../../etc/x.safetensors" }) === null && S.clean({ text_encoder: "a;rm -rf.safetensors" }) === null && JSON.stringify(S.clean({ sampler: "euler" })) === '{"sampler":"euler","scheduler":""}');
  check("samplers.envOf: BITGEN_TEXT_ENCODER for the worker (scripts/plato_keys_apply.py)", S.envOf({ comfy_sampler: { text_encoder: TE } }).BITGEN_TEXT_ENCODER === TE && !("BITGEN_TEXT_ENCODER" in S.envOf({ comfy_sampler: { sampler: "euler" } })));
  check("page: headerOf carries text_encoder (Style's own = none); teLabel names the styles",
    UI.headerOf({ text_encoder: TE }) === JSON.stringify({ sampler: "", scheduler: "", text_encoder: TE }) && UI.headerOf({ sampler: "", scheduler: "", text_encoder: "" }) === ""
    && UI.teLabel({ file: TE, labels: ["MOSS-Image", "Krea 2"] }) === TE + "  →  MOSS-Image, Krea 2");
  const P = src("static/samplerset.js");
  check("page: #imgTextEnc / #vidTextEnc under the sampler rows, Style's own first, the list from /api/platokeys; sent while picked (Override style or not)",
    /"imgCkptCombo", "imgTextEnc"\]/.test(P) && /"vidModel", "vidTextEnc"\]/.test(P) && /root\.fetch\("\/api\/platokeys"\)/.test(P) && /"— " \+ WORDS\.own\.label \+ " —"/.test(P)
    && /on \? headerOf\(pk\) : headerOf\(\{ text_encoder: pk\.text_encoder \}\)/.test(P));
  const RS = require(path.join(ROOT, "lib/renderSettings.js")), BB = require(path.join(ROOT, "lib/boardBasic.js"));
  check("the board's renders keep it (lib/renderSettings basic_text_encoder -> lib/boardBasic), Override style or not",
    RS.basicPatch({ text_encoder: TE }).basic_text_encoder === TE && RS.basicPatch({ text_encoder: "" }).basic_text_encoder === ""
    && JSON.stringify(BB.pickFor({ basic_text_encoder: TE })) === JSON.stringify({ sampler: "", scheduler: "", text_encoder: TE }) && BB.pickFor({}) === null
    && /out\.text_encoder = sp0\.text_encoder \|\| ""/.test(src("ext/videodock/characters.js")));
  check("the job's log says it (lib/core.js)", /text encoder " \+ sp\.text_encoder \+ " \(PlatoKeys\)"/.test(src("lib/core.js")));
  check("the worker applies it: scripts/plato_keys_apply.py from comfy_client queue() + worker.py's own send; one rules file for both sides",
    /plato_keys_apply\.apply_text_encoder\(base, graph\)/.test(src("scripts/comfy_client.py")) && /plato_keys_apply\.apply_text_encoder\(base, graph, say=say\)/.test(src("misc/worker.py"))
    && /lib", "platoKeys\.json"/.test(src("scripts/plato_keys_apply.py")) && /require\("\.\/platoKeys\.json"\)/.test(src("lib/platoKeys.js")));

  // the downloads + the node packs
  const cat = JSON.parse(src("lib/modelCatalog.json")), byId = (id) => cat.models.find((m) => m.id === id);
  check("catalog: the public keys into models/plato_keys/<family> + Qwen3.5-2B (Comfy-Org)",
    byId("pk_moss_comfy").repo === "nynxz/PlatoKeys" && byId("pk_moss_comfy").dest === "comfy/plato_keys/moss_image" && byId("pk_krea2_2b").dest === "comfy/plato_keys/krea2"
    && byId("pk_te_2b").repo === "Comfy-Org/Qwen3.5" && byId("pk_te_2b").file === "text_encoders/qwen3.5_2b_bf16.safetensors" && cat.groups.some((g) => g.id === "platokeys"));
  const Packs = require(path.join(ROOT, "lib/setupPacks.js"));
  const vr = Packs.LIST.find((p) => p.id === "viggle_remake"), pkp = Packs.LIST.find((p) => p.id === "platokeys");
  check("node packs: ComfyUI-PlatoKeys (plato_keys.*) and Viggle Remake BUNDLED (comfy_nodes/ComfyUI-Viggle-Remake - Tim's updated node)",
    pkp && pkp.url === "https://github.com/Nynxz/ComfyUI-PlatoKeys" && Packs.packFor("plato_keys.PatchCLIP") === pkp && vr && vr.bundled === "comfy_nodes/ComfyUI-Viggle-Remake" && Packs.packFor("RemakeConditioning") === vr);
  const nodes = src("comfy_nodes/ComfyUI-Viggle-Remake/nodes.py");
  check("…the bundled copy is the updated one: tokenize_segments with llama_template=\"{}\" + Plato's hf_text; Apache-2.0", /llama_template="\{\}"/.test(nodes) && /"hf_text"/.test(nodes) && /SPDX-License-Identifier: Apache-2\.0/.test(nodes) && /RemakePrefix/.test(nodes));
  const t = fs.mkdtempSync(path.join(os.tmpdir(), "pk3400_"));
  try {
    const cn = path.join(t, "custom_nodes"); fs.mkdirSync(cn);
    check("status: not in custom_nodes = missing", Packs.status(cn).find((p) => p.id === "viggle_remake").present === false);
    const r1 = Packs.syncBundled(vr, cn, { base: ROOT, log: () => {} });
    check("syncBundled: copied in; the same copy again = nothing to do", r1.ok && !r1.updated && fs.readFileSync(path.join(cn, "ComfyUI-Viggle-Remake", "nodes.py"), "utf8") === nodes && Packs.syncBundled(vr, cn, { base: ROOT }).skipped === true && Packs.status(cn).find((p) => p.id === "viggle_remake").present);
    fs.writeFileSync(path.join(cn, "ComfyUI-Viggle-Remake", "nodes.py"), "# the old one");
    fs.mkdirSync(path.join(cn, "ComfyUI-Viggle-Remake", "__pycache__")); fs.writeFileSync(path.join(cn, "ComfyUI-Viggle-Remake", "__pycache__", "nodes.pyc"), "x");
    const st = Packs.status(cn).find((p) => p.id === "viggle_remake");
    const logs = [], r2 = Packs.install(vr, cn, { base: ROOT, log: (l) => logs.push(l) });
    const r2v = await r2;
    check("an older Viggle Remake copy: counts as missing (Setup refreshes it); install = bitGen's copy, its __pycache__ cleared",
      st.stale && !st.present && r2v.ok && r2v.updated && fs.readFileSync(path.join(cn, "ComfyUI-Viggle-Remake", "nodes.py"), "utf8") === nodes && !fs.existsSync(path.join(cn, "ComfyUI-Viggle-Remake", "__pycache__")) && /updated to bitGen's copy \(nodes\.py\)/.test(logs.join("\n")), { st, r2v, logs });

    // the add-on
    const A = require(path.join(ROOT, "lib/addons.js")), PA = require(path.join(ROOT, "lib/platoKeysAddon.js"));
    check("Settings ▸ Add-ons: 🔑 PlatoKeys right after 🤗 Hugging Face downloads", A.LIST[0].id === "hf" && A.LIST[1].id === "platokeys" && /PlatoKeys/.test(A.LIST[1].label) && /no public key maps onto MiniMax H3/i.test(A.LIST[1].needs));
    check("wanted: the nodes always; defaults = nodes, Viggle Remake, the 2B, the MOSS + Krea 2 keys", PA.wanted([]).join() === "nodes,remake,te2b,moss,krea2" && PA.wanted(["zimage"]).join() === "nodes,zimage");
    const pl = { ok: true, customNodes: cn, models: path.join(t, "models"), python: "" };
    fs.rmSync(path.join(cn, "ComfyUI-Viggle-Remake"), { recursive: true, force: true });
    const got = [], L = [];
    const ir = await PA.install((l) => L.push(l), ["moss", "remake"], { place: pl, git: "", base: ROOT,
      fetchRepo: async (url, dest) => { got.push(url); fs.mkdirSync(path.join(dest, "plato_keys"), { recursive: true }); return { ok: true }; },
      download: async (m) => { got.push(m.id); const p = require(path.join(ROOT, "lib/setupModels.js")).destPath(m, { comfyModels: pl.models, app: ROOT }); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, "k"); return { ok: true }; } });
    check("install: the PlatoKeys pack, bitGen's Viggle Remake, the ticked keys into models/plato_keys/moss_image; the H3 note said",
      ir.ok && got.join() === "https://github.com/Nynxz/ComfyUI-PlatoKeys,pk_moss_comfy,pk_moss" && fs.existsSync(path.join(cn, "ComfyUI-Viggle-Remake", "nodes.py"))
      && fs.existsSync(path.join(pl.models, "plato_keys", "moss_image", "qwen35_2b_comfy_to_qwen35_9b_moss_ridge.safetensors")) && L.some((l) => /no public key/.test(l)), { ir, got, L });
    fs.writeFileSync(path.join(pl.models, "plato_keys", H3K), "mine");
    const s2 = PA.status(pl);
    check("status: installed, its keys listed (Tim's own key too), the Viggle Remake copy = bitGen's", s2.installed && s2.keys.includes(H3K) && s2.keys.includes("moss_image/qwen35_2b_comfy_to_qwen35_9b_moss_ridge.safetensors") && s2.remake === "bitGen's copy" && s2.items.find((i) => i.id === "moss").present && !s2.items.find((i) => i.id === "te2b").present, s2);
    await PA.remove(() => {}, pl);
    check("remove: the pack + the downloaded keys go; your own key and the Viggle Remake nodes stay", !fs.existsSync(path.join(cn, "ComfyUI-PlatoKeys")) && fs.existsSync(path.join(pl.models, "plato_keys", H3K)) && !fs.existsSync(path.join(pl.models, "plato_keys", "moss_image", "qwen35_2b_comfy_to_qwen35_9b_moss_ridge.safetensors")) && fs.existsSync(path.join(cn, "ComfyUI-Viggle-Remake")));
  } finally { fs.rmSync(t, { recursive: true, force: true }); }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
