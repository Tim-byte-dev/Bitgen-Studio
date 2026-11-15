#!/usr/bin/env node
/* bitGen Studio — 2.794.0 units: LOCAL MULTI-GPU PART 2 - the LLM, the vision LLM and speech on a card of their own; Settings ▸
 * General ☐ "Offload to CPU / RAM when a model does not fit" (lib/cardUse.js, lib/remoteHosts.js, lib/gpuCards.js, lib/core.js,
 * lib/captioner.js, the speech libs, lib/comfy.js, routes/cardUse.js, static/cardoffload.js). Pure + a made-up GGUF + a speech
 * helper run through venv.runJson (python3) + source pins - no studio, no graphics card. */
"use strict";
const path = require("path"), fs = require("fs"), os = require("os");
const ROOT = path.join(__dirname, "..");
const CU = require("../lib/cardUse"), RH = require("../lib/remoteHosts"), GC = require("../lib/gpuCards");
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 600))); } };
const src = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const GB = 1024 * 1024 * 1024;

(async () => {
  // ---- pure
  check("envFor: CUDA_VISIBLE_DEVICES = the card + PCI order (N = the card nvidia-smi shows)", JSON.stringify(CU.envFor(1)) === JSON.stringify({ CUDA_VISIBLE_DEVICES: "1", CUDA_DEVICE_ORDER: "PCI_BUS_ID" }));
  check("offloadOn: on unless config.gpu_offload is false", CU.offloadOn({}) === true && CU.offloadOn({ gpu_offload: true }) === true && CU.offloadOn({ gpu_offload: false }) === false && CU.offloadOn(null) === true);
  check("pickOf: every kind (llm, vlm, tts, stt, stems too)", CU.pickOf({ local_cards: { llm: 1, tts: 0 } }, "llm") === 1 && CU.pickOf({ local_cards: { llm: 1, tts: 0 } }, "tts") === 0 && CU.pickOf({ local_cards: {} }, "stt") === null && CU.pickOf({ local_cards: { vlm: -1 } }, "vlm") === null);
  const fits = CU.layersFor({ bytes: 8 * GB, layers: 40, freeMb: 24000, kvBytes: 1 * GB, offload: true, name: "m.gguf", card: 1 });
  check("layersFor: fits = every layer (-ngl 99), said", fits.ngl === 99 && fits.all === true && /fits on GPU 1/.test(fits.note), fits);
  const part = CU.layersFor({ bytes: 30 * GB, layers: 60, freeMb: 24576, kvBytes: 2 * GB, offload: true, name: "big.gguf", card: 0 });
  // room = 24576 MB - 700 MB reserve - 2 GB KV = 21.3 GB; a layer = 0.5 GB -> 42 layers
  check("layersFor: too big + offload = the layers that fit (the rest in RAM), said", part.ngl === 42 && part.all === false && /42 of 60 layers on the card, the rest in RAM/.test(part.note) && /needs about 32 GB/.test(part.note), part);
  const refuse = CU.layersFor({ bytes: 30 * GB, layers: 60, freeMb: 24576, kvBytes: 2 * GB, offload: false, name: "big.gguf", card: 0 });
  check("layersFor: too big + offload off = a clear error (what it needs, what is free, what to do)", /big\.gguf needs about 32 GB \(30 GB model \+ 2 GB context\) and GPU 0 has 24 GB free/.test(refuse.error || "") && /Offload to CPU \/ RAM/.test(refuse.error) && !("ngl" in refuse), refuse);
  const tiny = CU.layersFor({ bytes: 30 * GB, layers: 60, freeMb: 1000, kvBytes: 2 * GB, offload: true });
  check("layersFor: no room at all = 0 layers (all in RAM), never negative", tiny.ngl === 0, tiny);
  check("layersFor: unknown size / layers / free memory = every layer, as before", CU.layersFor({ bytes: 0, layers: 40, freeMb: 9000 }).ngl === 99 && CU.layersFor({ bytes: 5 * GB, freeMb: 9000 }).ngl === 99 && CU.layersFor({ bytes: 5 * GB, layers: 40 }).ngl === 99);
  const sj = CU.speechJob({ text: "hi", device: "cuda:0" }, { timeout_ms: 5, env: { A: "1" } }, 1);
  check("speechJob: a card = device cuda (the card is cuda:0 inside) + the env, copies", sj.job.device === "cuda" && sj.opts.env.CUDA_VISIBLE_DEVICES === "1" && sj.opts.env.A === "1" && sj.opts.timeout_ms === 5);
  const sn = CU.speechJob({ device: "cpu" }, { x: 1 }, null);
  check("speechJob: no card = unchanged", sn.job.device === "cpu" && !sn.opts.env);

  // ---- Runs on: every kind gets Local - <card>
  const cards = GC.cardsFrom([{ name: "RTX 5090", mem_total: 32607 }, { name: "RTX 3090", mem_total: 24576 }]);
  const ids = (k) => RH.optionsFor(k, cards).map((x) => x.id).join();
  check("Runs on: LLM / Vision LLM / speech / song separation offer Local - <card> after Local (2+ cards)", ["llm", "vlm", "tts", "stt", "stems"].every((k) => ids(k) === "local,local:0,local:1,runpod,openrouter,lan,team"), ["llm", "tts"].map(ids));
  check("Runs on: one card = no card choices (as before)", RH.optionsFor("llm", cards.slice(0, 1)).every((o) => !/^local:/.test(o.id)));
  const H = RH.hostsOf({ local_cards: { llm: 1, stt: 0 } }, { where: "local" }, {}, () => "", {});
  check("hostsOf: an LLM / speech kind with a card = local:<N>", H.llm === "local:1" && H.stt === "local:0" && H.vlm === "local" && H.tts === "local", H);
  const H2 = RH.hostsOf({ local_cards: { llm: 1 } }, { where: "local" }, {}, (k) => (k === "llm" ? "openrouter" : ""), {});
  check("hostsOf: an LLM on OpenRouter stays OpenRouter whatever its card", H2.llm === "openrouter", H2);
  check("gpuCards.setPick takes every cardUse kind; the gate stays ComfyUI's (image / video / music)", /require\("\.\/cardUse"\)\.KINDS\.includes\(kind\)/.test(src("lib/gpuCards.js")) && GC.KINDS.join() === "image,video,music");

  // ---- ComfyUI: offload off = --gpu-only
  const d = { cmd: "/c/py.exe", args: ["-s", "/c/ComfyUI/main.py"], cwd: "/c" };
  check("argsFor: offload off = --gpu-only (everything on the card); on / unset = as before", GC.argsFor(d, 1, false).args.slice(-1)[0] === "--gpu-only" && GC.argsFor(d, 1, true).args.join(" ") === "-s /c/ComfyUI/main.py --port 8190 --cuda-device 1" && GC.argsFor(d, 1).args.join(" ") === "-s /c/ComfyUI/main.py --port 8190 --cuda-device 1");
  const CF = src("lib/comfy.js");
  check("comfy.js: the main ComfyUI gets --gpu-only when offload is off - only when bitGen runs main.py itself (a .bat / custom command left alone)", /require\("\.\/cardUse"\)\.offloadNow\(\) \|\| \(d\.args \|\| \[\]\)\.includes\("--gpu-only"\) \? d\.args : \(d\.args \|\| \[\]\)\.concat\(\["--gpu-only"\]\)/.test(CF) && /proc = spawn\(d\.cmd, args, \{ \.\.\.so, env \}\)/.test(CF));

  // ---- a made-up GGUF: layersNow reads its layers + size and the card's free memory (H3_TEST_GPUS)
  const T = fs.mkdtempSync(path.join(os.tmpdir(), "cu794-"));
  const kv = []; const str = (s) => { const b = Buffer.from(s, "utf8"); const l = Buffer.alloc(8); l.writeBigUInt64LE(BigInt(b.length)); return Buffer.concat([l, b]); };
  const u32 = (v) => { const b = Buffer.alloc(4); b.writeUInt32LE(v); return b; };
  const add = (k, type, val) => kv.push(Buffer.concat([str(k), u32(type), val]));
  add("general.architecture", 8, str("llama"));
  add("llama.block_count", 4, u32(40)); add("llama.context_length", 4, u32(8192)); add("llama.embedding_length", 4, u32(1024));
  add("llama.attention.head_count", 4, u32(8)); add("llama.attention.head_count_kv", 4, u32(8));
  const hdr = Buffer.concat([Buffer.from("GGUF"), u32(3), Buffer.alloc(8), (() => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(kv.length)); return b; })(), ...kv]);
  const F = path.join(T, "made-up.gguf");
  fs.writeFileSync(F, hdr); fs.truncateSync(F, 400 * 1024 * 1024);   // 400 MB, sparse
  const shape = require("../lib/gguf").llmShape(F);
  check("gguf.llmShape: + layers (block_count)", shape && shape.layers === 40 && shape.kvBytesPerToken === 2 * 40 * 1024 * 2, shape);
  process.env.H3_E2E = "1"; process.env.H3_TEST_GPUS = JSON.stringify([{ name: "A", mem_total: 24576, mem_used: 1000 }, { name: "B", mem_total: 8192, mem_used: 7800 }]);
  check("freeMbOf: total - used of nvidia-smi's card (the tests' stand-in cards)", (await CU.freeMbOf(0)) === 23576 && (await CU.freeMbOf(1)) === 392 && (await CU.freeMbOf(5)) === 0);
  const a = await CU.layersNow("cuda0", { files: [F], layers: shape.layers, kvBytes: 0, name: "made-up.gguf", offload: false });
  check("layersNow: fits on GPU 0 = every layer", a.ngl === 99 && a.all, a);
  const bb = await CU.layersNow("cuda1", { files: [F], layers: shape.layers, kvBytes: 0, name: "made-up.gguf", offload: false });
  check("layersNow: GPU 1 (392 MB free) + offload off = refused before the start, with why", /made-up\.gguf needs about 0\.4 GB .* GPU 1 has 0\.4 GB free/.test(bb.error || ""), bb);
  const c = await CU.layersNow("cuda1", { files: [F, path.join(T, "gone.gguf")], layers: shape.layers, kvBytes: 0, offload: true });
  check("layersNow: GPU 1 + offload = 0 layers on the card (no room past the reserve), a missing file counted as 0", c.ngl === 0 && c.all === false, c);
  check("layersNow: cpu / a device that is not cudaN = every layer as before", (await CU.layersNow("cpu", { files: [F] })).ngl === 99);
  delete process.env.H3_TEST_GPUS; delete process.env.H3_E2E;

  // ---- a speech helper on its card: venv.runJson sees the env + device cuda
  const helper = path.join(T, "echo_env.py");
  fs.writeFileSync(helper, "import json, os, sys\njob = json.load(open(sys.argv[1]))\nprint(json.dumps({'cvd': os.environ.get('CUDA_VISIBLE_DEVICES'), 'order': os.environ.get('CUDA_DEVICE_ORDER'), 'device': job.get('device')}))\n");
  const r = CU.speechJob({ device: "cuda:1" }, { timeout_ms: 20000 }, 1);
  let got = null; try { got = await require("../lib/venv").runJson(process.env.PYTHON || "python3", helper, r.job, r.opts); } catch (e) { got = { error: e.message }; }
  check("a speech job on card 1: its program sees only that card (CUDA_VISIBLE_DEVICES=1, PCI order) and device cuda", got && got.cvd === "1" && got.order === "PCI_BUS_ID" && got.device === "cuda", got);

  // ---- the vision LLM's card (captioner with a stand-in core)
  const CAP = require("../lib/captioner");
  const fake = (c) => ({ getConfig: () => c });
  check("captioner.visionDevice: Runs on ▸ Vision LLM card first, then Settings' vision device, then the LLM's (its card first)", CAP.visionDevice(fake({ rgpu: { local_cards: { vlm: 1 } }, captioner: { device: "cuda0" } })) === "cuda1"
    && CAP.visionDevice(fake({ captioner: { device: "cuda0" }, llm: { device: "cuda1" } })) === "cuda0"
    && CAP.visionDevice(fake({ rgpu: { local_cards: { llm: 0 } }, llm: { device: "cuda1" } })) === "cuda0"
    && CAP.visionDevice(fake({ llm: { device: "cuda1" } })) === "cuda1");
  check("captioner.sameGpu: the LLM's card counts (both on GPU 1 = same)", CAP.sameGpu(fake({ rgpu: { local_cards: { llm: 1, vlm: 1 } } })) === true && CAP.sameGpu(fake({ rgpu: { local_cards: { llm: 0, vlm: 1 } } })) === false);

  // ---- wiring
  const C = src("lib/core.js"), CA = src("lib/captioner.js");
  check("core.ensureLlama: Runs on ▸ LLM's card first (PCI order), Settings' device the fallback", /const CU = require\("\.\/cardUse"\), pick = CU\.pickNow\("llm"\);/.test(C) && /const dev = pick != null \? "cuda" \+ pick : \(config\.llm\.device \|\| "cuda1"\);/.test(C) && /if \(pick != null\) env\.CUDA_DEVICE_ORDER = "PCI_BUS_ID";/.test(C));
  check("core.ensureLlama: -ngl = the layers that fit (after the old model left the card), a number of your own kept, offload off = refused; offload in the launch signature", /const ownLayers = Number\.isFinite\(nl\) && nl >= 0 && nl < 99;/.test(C) && /if \(dev !== "cpu" && !ownLayers\) \{/.test(C) && /await CU\.layersNow\(dev, \{ files: \[model\], layers: \(shape \|\| \{\}\)\.layers, kvBytes: shape && shape\.kvBytesPerToken \? shape\.kvBytesPerToken \* ctxEff : 0/.test(C) && /if \(fit\.error\) throw new Error\(fit\.error\);/.test(C) && /args\.push\("-ngl", String\(ngl\)\)/.test(C) && /CU\.offloadNow\(\) \? "offload" : "card-only"/.test(C) && C.indexOf("if (hadProc) await gpuSettle(oldDev);") < C.indexOf("await CU.layersNow(dev"));
  check("captioner: the vision LLM's card (PCI order) + the layers that fit (model + projector)", /if \(picked\) env\.CUDA_DEVICE_ORDER = "PCI_BUS_ID";/.test(CA) && /await CU\.layersNow\(dev, \{ files: \[c\.model, c\.mmproj\]/.test(CA) && /args\.push\("-ngl", String\(ngl\)\)/.test(CA));
  check("speech on its card: tts, speech dialog, whisper + Bark, the live transcriber, song separation", /require\("\.\/cardUse"\)\.runJson\("tts", v\.python, rt\.helper, job, lo\)/.test(src("lib/tts.js")) && /require\("\.\/cardUse"\)\.runJson\("tts", py, helper, job, o\)/.test(src("lib/speechDialog.js"))
    && (src("lib/asr.js").match(/require\("\.\/cardUse"\)\.runJson\("stt",/g) || []).length === 3 && /require\("\.\/cardUse"\)\.forSpeech\("stt", conf, \{\}\)/.test(src("lib/asrLive.js")) && /env: Object\.assign\(\{\}, process\.env, card\.opts\.env \|\| \{\}\)/.test(src("lib/asrLive.js"))
    && /require\("\.\/cardUse"\)\.runJson\("stems", rt\.python, HELPER\(\), job,/.test(src("lib/stems.js")));
  check("remoteHosts: the row's line for an LLM / speech card", /llama\.cpp on GPU " \+ n \+ " - as many layers as its free memory holds/.test(src("lib/remoteHosts.js")) && /runs on GPU " \+ n \+ " \(the card is all its program sees\)/.test(src("lib/remoteHosts.js")));
  const RI = src("routes/index.js"), RC = src("routes/cardUse.js"), IX = src("static/index.html");
  check("routes: /api/carduse mounted from routes/index.js (not server.js), offload saved + the cards' ComfyUIs stopped to start the new way", /require\("\.\/cardUse"\)\.mount\(app\)/.test(RI) && /app\.post\("\/api\/carduse\/offload"/.test(RC) && /CU\.setOffload\(!!\(req\.body \|\| \{\}\)\.on\)/.test(RC) && /stopAll\(\)/.test(RC) && !/carduse/i.test(src("misc/server.js")));
  check("Settings ▸ General: ☐ Offload to CPU / RAM when a model does not fit (ticked by default) + static/cardoffload.js loaded", /<input type="checkbox" id="s_offload" checked>\s*Offload to CPU \/ RAM when a model does not fit<\/label>/.test(IX) && /<script src="\/static\/cardoffload\.js"><\/script>/.test(IX));
  const CO = require("../static/cardoffload.js");
  check("cardoffload.message: on / off said", /keeps the rest in RAM/.test(CO.message(true)) && /refused with what it needs/.test(CO.message(false)));
  try { fs.rmSync(T, { recursive: true, force: true }); } catch { /* tmp */ }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
