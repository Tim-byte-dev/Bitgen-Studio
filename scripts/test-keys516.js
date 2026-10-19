#!/usr/bin/env node
/* bitGen Studio — 2.516.0 units: ◇ KEYFRAMES ON ANY PROPERTY (static/anykeys.js, ext/timelinedock/tlanykey.js, lib/clipFx.js
 * withAk, scripts/vfx_filters.py) and the KREA 2 workflows (Turbo / Raw, safetensors / GGUF).
 * Tim (verbatim): "create workflows for krea2 gguff and safetensors.and finish the last row". */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path");
const { spawnSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const check = (n, cond, got) => { if (cond) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const near = (a, b, e) => Math.abs(a - b) <= e;
const A = require("../static/anykeys.js"), KF = require("../static/keyframes.js");

/* ---- the keys */
check("rules: colour (exposure ... hue, wheel brightness, HSL ranges, LUT mix), lens / warp / keyer, mask feather / expansion / opacity, text size / outline, time - each with how the compile gets it",
  ["fx.grade.exposure", "fx.grade.hue", "fx.grade.wheels.gain.l", "fx.grade.hsl.2.sat", "fx.lut_mix", "fx.vfx.lens", "fx.vfx.warp.speed", "fx.vfx.key.spill", "masks.0.feather", "masks.3.op", "text.size", "text.strokeW", "tm.shutter", "tm.echo.decay"].every((p) => A.rule(p))
  && !A.rule("fx.grade.bogus") && !A.rule("name") && A.rule("fx.grade.exposure").r.c === "lut" && A.rule("fx.vfx.lens").r.c === "vfx" && A.rule("masks.1.expand").r.c === "mask" && A.rule("text.size").r.c === "bake"
  && A.uiK("fx.lut_mix") === 100 && A.uiK("tm.echo.i0") === 100 && A.uiK("tm.echo.n") === 1);
check("which layers may key what: V1 = colour + effects (no masks / text / time); a picture layer everything",
  A.allowed("fx.grade.exposure", "v1") && A.allowed("fx.vfx.lens", "v1") && !A.allowed("masks.0.feather", "v1") && !A.allowed("text.size", "vl") && A.allowed("text.size", "img") && A.allowed("tm.post", "vl") && !A.allowed("tm.post", "v1"));
const c = { text: { size: 40 }, masks: [{ feather: 0 }], kf: [{ at: 0, ease: "in", "@text.size": 40, "@masks.0.feather": 0, "@fx.grade.exposure": -1, x: 5 }, { at: 2, "@text.size": 120 }, { at: 4, "@masks.0.feather": 40, "@fx.grade.exposure": 1, "@masks.7.op": 50 }] };
check("keyed(c): the @ paths (an unknown one is not)", JSON.stringify(A.keyed(c).sort()) === JSON.stringify(["fx.grade.exposure", "masks.0.feather", "masks.7.op", "text.size"]) && A.has(c) && !A.has({ kf: [{ at: 0, x: 1 }] }));
const u = A.apply(c, 1, KF), during = { size: c.text.size, fe: c.masks[0].feather, ex: c.fx && c.fx.grade && c.fx.grade.exposure, m7: c.masks[7] };
u();
check("apply(c, tau): the keyed values written for that moment (the key's ease - in - on every setting it holds), a key on a mask that is not there ignored; undo puts it all back - and takes away what it had to make (fx.grade)",
  near(during.size, 40 + 80 * 0.25, 1e-6) && near(during.fe, 2.5, 1e-6) && near(during.ex, -0.875, 1e-6) && during.m7 === undefined && c.text.size === 40 && c.masks[0].feather === 0 && c.fx === undefined, during);
const u1 = A.apply(c, 3, KF), u2 = A.apply(c, 3, KF); u2(); const mid = c.text.size; u1();
check("nested apply / undo (a clip drawn alone inside a frame) undo in order", near(mid, 120, 1e-6) && c.text.size === 40 && c.fx === undefined);
check("needsBake: a picture layer with any keyed setting; a video layer only for what only the page draws (time) - colour / effects / masks it does not",
  A.needsBake(c, "img") && !A.needsBake({ kf: [{ at: 0, "@fx.grade.exposure": 1 }, { at: 1, "@masks.0.op": 50 }] }, "vl") && A.needsBake({ kf: [{ at: 0, "@tm.shutter": 90 }] }, "vl"));
const fc = A.forCompile({ fx: { vfx: { warp: { type: "wave", amount: 10 } } }, kf: [{ at: 0, ease: "inout", "@fx.vfx.lens": 0, "@fx.vfx.warp.amount": 10, "@fx.grade.exposure": -1.5 }, { at: 2, "@fx.vfx.lens": 60, "@fx.grade.exposure": 1, "@fx.vfx.warp.amount": 50 }] }, KF);
check("forCompile: the effects' keys (+ samples where the ease bends) as vfx kf {at, lens, warp_amount}, the warp's type; the look every quarter second between colour keys",
  fc && fc.vfx.length === 8 && fc.vfx[0].lens === 0 && fc.vfx[7].lens === 60 && near(fc.vfx[1].lens, 60 * KF.ease("inout", 1 / 7), 1e-3) && fc.warp_type === "wave" && fc.vfx[7].warp_amount === 50
  && fc.grade.length === 9 && fc.grade[0].fx.grade.exposure === -1.5 && fc.grade[8].fx.grade.exposure === 1 && near(fc.grade[4].at, 1, 1e-6), fc);

/* ---- the app's side: the keys into the compile's fx */
const CF = require("../lib/clipFx");
const ak = CF.cleanAk({ vfx: [{ at: 0, lens: -500, key_blend: 9, bogus: 1 }, { at: 1, warp_amount: 30 }], warp_type: "twirl", grade: [{ at: 0, fx: { grade: { exposure: -1 } } }, { at: 1, fx: { grade: { exposure: 1 } } }] });
check("cleanAk: numbers clamped (lens -100, edge 0.5), unknown dropped, the warp type, 2+ looks", ak.vfx[0].lens === -100 && ak.vfx[0].key_blend === 0.5 && ak.vfx[0].bogus === undefined && ak.warp_type === "twirl" && ak.grade.length === 2, ak);
let wfx = null; try { wfx = CF.withAk({ vfx: { kf: [{ at: 0, blur: 3 }] } }, ak); } catch (e) { wfx = { error: e.message }; }
check("withAk: the effects' keys merged into vfx.kf (the same moment = one key), a keyed warp with none set gets its type; lut_keys = a .cube per look",
  wfx && wfx.vfx && wfx.vfx.kf.length === 2 && wfx.vfx.kf[0].blur === 3 && wfx.vfx.kf[0].lens === -100 && wfx.vfx.warp && wfx.vfx.warp.type === "twirl"
  && Array.isArray(wfx.lut_keys) && wfx.lut_keys.length === 2 && wfx.lut_keys.every((k) => /\.cube$/.test(k.file) && fs.existsSync(k.file)) && wfx.lut_keys[0].file !== wfx.lut_keys[1].file, wfx);
const ck = CF.clipKeys({ name: "x.mp4", in: 0, out: 2, ak: { grade: [{ at: 0, fx: { grade: { exposure: -1 } } }, { at: 2, fx: {} }] } });
check("clipKeys: a clip with keyed colour and no static look still reaches the compile (fx.lut_keys, its first look as lut_file)", ck.fx && ck.fx.lut_keys && ck.fx.lut_keys.length === 2 && ck.fx.lut_file === ck.fx.lut_keys[0].file, ck);

/* ---- the page's wiring */
const CV = read("ext", "timelinedock", "canvas.js"), TD = read("ext", "timelinedock", "timelinedock.js"), MK = read("ext", "timelinedock", "tlmask.js"), GR = read("ext", "timelinedock", "tlgraph.js"), AKP = read("ext", "timelinedock", "tlanykey.js");
check("canvas.js: every clip's keys on while a frame is painted (paintComp), a clip drawn alone too (drawClip - the bakes)", /function paintComp\(g, t\) \{ var u = anyKeys\(t\); try \{ return paintComp0\(g, t\); \} finally \{ u\(\); \} \}/.test(CV) && /H3AnyKeys\.apply\(c, t - \(c\.start \|\| 0\), KF\)/.test(CV) && /return drawClip0\(g, c, Ly, t\)/.test(CV));
check("masks: maskCanvas applies the keys (the mask video too), it animates when only its settings are keyed, its bake signature has them", /return maskCanvas0\(c, tau, W, H, into\)/.test(MK) && /H3AnyKeys\.keyed\(c\)\.some\(function \(p\) \{ return \/\^masks\\\.\/\.test\(p\); \}\)/.test(MK) && /@masks\\\./.test(MK));
check("📈 graph editor: an @ setting's value is its own (fallback); the page registers each keyed one (TlGraph.addProp)", /p\.charAt\(0\) === "@" && window\.H3AnyKeys/.test(GR) && /TlGraph\.addProp\("@" \+ p, A\.label\(p\), A\.uiK\(p\), ""\)/.test(AKP));
check("the export sends ak (forCompile) for V1 and the video layers; a picture layer with keys is baked (TlVBake anykeys)", (TD.match(/ak: tlAnyKeys\(c\)/g) || []).length === 2 && /function tlAnyKeys\(c\)/.test(TD) && /TlVBake\.register\("anykeys"/.test(AKP));
check("tlanykey: the inputs it keys (colour sliders, LUT mix, lens, warp, keyer, text size / outline, time, wheel brightness, mask feather / expansion / opacity, HSL ranges)",
  ["tfxLutMix", "tfxLens", "tfxWarpA", "tfxWarpS", "tfxWarpV", "tfxKeyS", "tfxKeyB", "tfxKeyP", "tlpSize", "tlpStrokeW", "tlpTmSh", "tlpTmEf", "tcpL_gain"].every((id) => AKP.includes(id + ":")) && /data-mkn/.test(AKP) && /#tcpHsl/.test(AKP) && /data-g/.test(AKP));
check("the page loads static/anykeys.js and ext tlanykey.js", /<script src="\/static\/anykeys\.js"><\/script>/.test(read("static", "index.html")) && JSON.stringify(JSON.parse(read("ext", "timelinedock", "ext.json"))).includes('"tlanykey.js"'));
for (const f of ["static/anykeys.js", "ext/timelinedock/tlanykey.js", "ext/timelinedock/canvas.js", "ext/timelinedock/tlmask.js", "ext/timelinedock/tlgraph.js", "ext/timelinedock/timelinedock.js"]) {
  const r = spawnSync(process.execPath, ["--check", path.join(ROOT, f)], { encoding: "utf8" });
  check("parses: " + f, r.status === 0, (r.stderr || "").split("\n").slice(0, 4).join(" | "));
}

/* ---- the compile's filters (ffmpeg runs them) */
const py = process.env.PYTHON || (process.platform === "win32" ? "python" : "python3");
const T = fs.mkdtempSync(path.join(os.tmpdir(), "bg516-"));
const PYC = `
import sys, json, subprocess
sys.path.insert(0, ${JSON.stringify(path.join(ROOT, "scripts"))})
import vfx_filters as VF
T = ${JSON.stringify(T)}
def cube(p, k):
    L = ["LUT_3D_SIZE 5"] + [f"{r/4*k:.4f} {g/4*k:.4f} {b/4*k:.4f}" for b in range(5) for g in range(5) for r in range(5)]
    open(p, "w").write("\\n".join(L) + "\\n")
for k in (1.0, 0.25, 0.6): cube(f"{T}/c{k}.cube", k)
def run(v, lut=None, src="color=c=0xc8c8c8:s=64x64:r=10:d=3", n=30, alpha=False):
    parts = []; notes = VF.build(parts, "[0:v]", "[o]", v, 64, 64, tag="t", fps=10, dur=3, lut=lut)
    if alpha:
        parts.append("[o]format=yuva420p,alphaextract[oa]")
    r = subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", src, "-filter_complex", ";".join(parts), "-map", "[oa]" if alpha else "[o]", "-frames:v", str(n), "-f", "rawvideo", "-pix_fmt", "gray", "-"], capture_output=True, cwd=T)
    b = r.stdout; fs = [sum(b[i*4096:(i+1)*4096]) / 4096.0 for i in range(len(b) // 4096)]
    return {"notes": notes, "err": r.stderr.decode()[-200:], "m": [round(x, 1) for x in fs], "n": len(fs)}
out = {}
out["look"] = run({}, lut=[(0.0, f"{T}/c1.0.cube"), (1.0, f"{T}/c0.25.cube"), (2.0, f"{T}/c0.6.cube")])
out["lens"] = run({"kf": [{"at": 0, "lens": 0}, {"at": 1, "lens": 80}]}, src="testsrc=s=64x64:r=10:d=3")
out["wave"] = run({"warp": {"type": "wave", "amount": 0, "size": 20, "speed": 0}, "kf": [{"at": 0, "warp_amount": 0}, {"at": 1, "warp_amount": 100}]}, src="testsrc=s=64x64:r=10:d=3")
out["key"] = run({"key": {"color": "#00ff00", "similarity": 0.1, "blend": 0.05, "spill": 0.5}, "kf": [{"at": 0, "key_similarity": 0.01}, {"at": 1, "key_similarity": 0.5}]}, src="color=c=0x30c030:s=64x64:r=10:d=3", alpha=True)
out["grain"] = run({"kf": [{"at": 0, "grain": 1.0}, {"at": 2, "grain": 1.0}]}, src="color=c=gray:s=64x64:r=10:d=3", n=3)
import numpy as np
r = subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "color=c=gray:s=64x64:r=10:d=1", "-filter_complex", ";".join((lambda p: (VF.build(p, "[0:v]", "[o]", {"kf": [{"at": 0, "grain": 1.0}, {"at": 2, "grain": 1.0}]}, 64, 64, tag="g", fps=10, dur=1), p)[1])([])), "-map", "[o]", "-frames:v", "3", "-f", "rawvideo", "-pix_fmt", "gray", "-"], capture_output=True, cwd=T)
out["grain_std"] = float(np.frombuffer(r.stdout, np.uint8).std()) if r.stdout else -1
print(json.dumps(out))`;
const pr = spawnSync(py, ["-c", PYC], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
let R = null; try { R = JSON.parse((pr.stdout || "").trim().split("\n").pop()); } catch { R = null; }
if (!R) check("the filters ran", false, (pr.stderr || "").slice(-500));
else {
  const L = R.look.m;
  check("a keyed LOOK: two lanes of cubes (each on only in its stretches) cross-faded by command - 1.0 at 0 s, half way at 0.5 s, 0.25 at 1 s, half way to 0.6 at 1.5 s, held after",
    R.look.n === 30 && near(L[0], 200, 6) && near(L[5], 125, 8) && near(L[10], 52, 8) && near(L[15], 88, 8) && near(L[25], 125, 8) && R.look.notes.some((x) => /look keyed \(3 looks/.test(x)), R.look);
  check("keyed lens / wave / keyer build and run (lenscorrection by command, the wave an expression of the time, chromakey + despill by command) - the picture changes as the keys move",
    R.lens.n === 30 && R.lens.notes.includes("lens keyed") && R.wave.n === 30 && R.wave.notes.includes("wave keyed") && R.key.n === 30 && R.key.notes.includes("keyer keyed") && Math.abs(R.key.m[0] - R.key.m[15]) > 5, { lens: R.lens.notes, wave: R.wave.notes, key: R.key });
  check("the 2.412.0 keyed sharpen / grain fix: blend's normal mode weighs its FIRST input - a grain key at full strength is grain now", R.grain_std > 10, R.grain_std);
}
try { fs.rmSync(T, { recursive: true, force: true }); } catch { /* fine */ }

/* ---- KREA 2 */
const wf = (n) => JSON.parse(read("comfy_workflows", n)), nodes = (g) => Object.entries(g).filter(([k]) => !k.startsWith("_")), cls = (g, k) => nodes(g).filter(([, v]) => v.class_type === k);
const TS = wf("img_krea2_turbo_t2i.json"), RS = wf("img_krea2_raw_t2i.json"), TG = wf("img_krea2_turbo_gguf_t2i.json"), RG = wf("img_krea2_raw_gguf_t2i.json");
check("Krea 2 workflows: safetensors on UNETLoader (krea2_turbo / raw fp8 scaled), GGUF on UnetLoaderGGUF (krea2_turbo- / krea2_raw-Q5_K_M.gguf)",
  cls(TS, "UNETLoader")[0][1].inputs.unet_name === "krea2_turbo_fp8_scaled.safetensors" && cls(RS, "UNETLoader")[0][1].inputs.unet_name === "krea2_raw_fp8_scaled.safetensors"
  && cls(TG, "UnetLoaderGGUF")[0][1].inputs.unet_name === "krea2_turbo-Q5_K_M.gguf" && cls(RG, "UnetLoaderGGUF")[0][1].inputs.unet_name === "krea2_raw-Q5_K_M.gguf" && !cls(TG, "UNETLoader").length);
check("all four: Qwen3-VL 4B on CLIPLoader type krea2, the Qwen-Image VAE, 4 model-only LoRA slots, EmptyLatentImage, KSampler",
  [TS, RS, TG, RG].every((g) => { const c = cls(g, "CLIPLoader")[0][1].inputs; return c.clip_name === "qwen3vl_4b_fp8_scaled.safetensors" && c.type === "krea2" && cls(g, "VAELoader")[0][1].inputs.vae_name === "qwen_image_vae.safetensors"
    && cls(g, "LoraLoaderModelOnly").length === 4 && cls(g, "EmptyLatentImage").length === 1 && cls(g, "KSampler").length === 1; }));
const ks = (g) => cls(g, "KSampler")[0][1].inputs;
check("Turbo: 8 steps, cfg 1, er_sde / simple, a zeroed negative; Raw: 52 steps, cfg 3.5, a real negative prompt",
  [TS, TG].every((g) => ks(g).steps === 8 && ks(g).cfg === 1 && ks(g).sampler_name === "er_sde" && ks(g).scheduler === "simple" && cls(g, "ConditioningZeroOut").length === 1)
  && [RS, RG].every((g) => ks(g).steps === 52 && ks(g).cfg === 3.5 && cls(g, "CLIPTextEncode").length === 2 && !cls(g, "ConditioningZeroOut").length));
const PATCH = `
import sys, json
sys.path.insert(0, ${JSON.stringify(path.join(ROOT, "scripts"))})
import comfy_image as ci
out = {}
for n in ["img_krea2_turbo_t2i.json", "img_krea2_raw_gguf_t2i.json"]:
    g = ci.load_workflow(${JSON.stringify(path.join(ROOT, "comfy_workflows"))} + "/" + n)
    r = ci.patch(g, {"arch": "krea2", "engine": "comfy", "model": "krea2_raw-Q4_K_M.gguf" if "gguf" in n else "", "steps": 30, "cfg": 4, "negative": "ugly", "loras": [{"path": "krea2_darkbrush.safetensors", "weight": 0.8}]}, {"prompt": "a red fox", "seed": 7, "width": 1280, "height": 720})
    g2 = r[0] if isinstance(r, tuple) else r
    g2 = g2.get("graph", g2)
    out[n] = {k: v for k, v in g2.items() if not k.startswith("_")}
print(json.dumps(out))`;
const pp = spawnSync(py, ["-c", PATCH], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
let G = null; try { G = JSON.parse((pp.stdout || "").trim().split("\n").pop()); } catch { G = null; }
const gt = G && G["img_krea2_turbo_t2i.json"], gr = G && G["img_krea2_raw_gguf_t2i.json"];
check("the style patcher fills them: the prompt, seed, size, steps / cfg, slot 1's LoRA (the empty slots bypassed), the GGUF model asked for, Raw's negative",
  gt && gr && Object.values(gt).some((v) => v.class_type === "CLIPTextEncode" && v.inputs.text === "a red fox") && Object.values(gt).filter((v) => v.class_type === "LoraLoaderModelOnly").length === 1
  && Object.values(gt).some((v) => v.class_type === "KSampler" && v.inputs.seed === 7 && v.inputs.steps === 30) && Object.values(gt).some((v) => v.class_type === "EmptyLatentImage" && v.inputs.width === 1280 && v.inputs.height === 720)
  && Object.values(gr).some((v) => v.class_type === "UnetLoaderGGUF" && v.inputs.unet_name === "krea2_raw-Q4_K_M.gguf") && Object.values(gr).some((v) => v.class_type === "CLIPTextEncode" && v.inputs.text === "ugly"), (pp.stderr || "").slice(-400) || G);
const ST = read("lib", "styles.js"), ARCH = JSON.parse(read("lib", "imageArch.json")).archs.find((a) => a.id === "krea2"), CAT = JSON.parse(read("lib", "modelCatalog.json")).models;
check("the starters (Krea 2 Turbo / Raw / Turbo GGUF / Raw GGUF), the arch (ComfyUI only, a negative prompt), the catalogue (Comfy-Org/Krea-2 fp8 + the Qwen3-VL 4B encoder, vantagewithai's GGUFs, the Qwen-Image VAE)",
  ["Krea 2 Turbo", "Krea 2 Raw", "Krea 2 Turbo GGUF", "Krea 2 Raw GGUF"].every((n) => ST.includes('name: "' + n + '", arch: "krea2"')) && ARCH && ARCH.comfy_only && ARCH.negative
  && ["krea2_turbo", "krea2_raw", "krea2_turbo_gguf", "krea2_raw_gguf", "krea2_te"].every((id) => CAT.some((m) => m.id === id))
  && CAT.find((m) => m.id === "krea2_turbo_gguf").dest === "comfy/unet" && CAT.find((m) => m.id === "krea2_te").repo === "Comfy-Org/Krea-2" && /Krea 2/.test(CAT.find((m) => m.id === "qwen_vae").for));
check("ComfyUI-GGUF's node pack notes the Krea 2 GGUF styles", /Krea 2 GGUF/.test(read("lib", "nodePacks.json")));
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
