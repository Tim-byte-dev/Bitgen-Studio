#!/usr/bin/env node
/* bitGen Studio — 2.409.0 unit tests:
 *   1. Basic Settings' Override style for EVERY video model (lib/basicOverride.js, lib/renderSettings basic_model,
 *      lib/ltx jobParams `basic`, lib/wan cfgExact, scripts/basic_apply.py on the real LTX 2.3 / 2.5 / 3DREAL graphs,
 *      the GGUF loaders in worker.py / scripts/wan_graph.py, the page wiring)
 *   2. ✨ effects + adjustment layers (static/clipfx.js normVfx, scripts/vfx_filters.py, scripts/clipfx_render.py,
 *      lib/clipFx.adjustKeys, routes/effects.js, lib/interchange leaves them out)
 * Tim: "if overide is checked in basic settings docker then all models including ltx2.3 and 2.5 use basic settings
 * including, cfg, steps, seed, model and loras, use prompt from prompt docker or prompt chat when video button is
 * pressed , continue with the premier close gap". No app needed. */
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const BO = require(path.join(ROOT, "lib", "basicOverride.js"));
const RS = require(path.join(ROOT, "lib", "renderSettings.js"));
const FX = require(path.join(ROOT, "static", "clipfx.js"));
let pass = 0, fail = 0;
const check = (n, c, got) => { if (c) { pass++; console.log("PASS: " + n); } else { fail++; console.log("FAIL: " + n + (got === undefined ? "" : "\n      got " + JSON.stringify(got).slice(0, 700))); } };
const py = (code) => execFileSync("python3", ["-c", "import sys,json; sys.path.insert(0, " + JSON.stringify(path.join(ROOT, "scripts")) + "); sys.path.insert(0, " + JSON.stringify(ROOT) + ")\n" + code], { encoding: "utf8" });
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");

/* ---- 1. the override */
check("parse: off / absent -> null", BO.parse(null) === null && BO.parse({ override: false, steps: 9 }) === null && BO.parse("{bad") === null);
const b1 = BO.parse(JSON.stringify({ override: true, steps: "12", cfg: "2.55", seed: "4242", model: "ltx\\x.gguf", loras: [{ path: "a.safetensors", weight: 0.5 }] }));
check("parse: steps / cfg / seed / model (slashes) / LoRAs", b1.steps === 12 && b1.cfg === 2.55 && b1.seed === 4242 && b1.model === "ltx/x.gguf" && b1.loras.length === 1 && b1.loras[0].path === "a.safetensors", b1);
const b2 = BO.parse({ override: true, steps: 999, cfg: 99, seed: -5, model: "../evil", loras: "x" });
check("parse: out of range -> the model's own, random seed, a bad model dropped", b2.steps === 0 && b2.cfg === null && b2.seed === -1 && b2.model === "" && b2.loras.length === 0, b2);
const st = { id: "s", phases: [{ model: "orig.safetensors", steps: 8 }, { model: "low.safetensors" }], loras: [{ path: "style.safetensors", weight: 1 }], model: "orig.safetensors" };
const w1 = BO.withStyle(st, b1, { loras: true, topModel: true });
check("withStyle: phase 1's model (+ style.model) replaced, the LoRAs added, the style itself untouched", w1.phases[0].model === "ltx/x.gguf" && w1.phases[1].model === "low.safetensors" && w1.model === "ltx/x.gguf"
  && w1.loras.length === 2 && st.phases[0].model === "orig.safetensors" && st.loras.length === 1, w1);
check("withStyle: no override -> the same style; no style + a model -> the synthetic one", BO.withStyle(st, null) === st
  && BO.withStyle(null, b1, { synth: { name: "syn", phases: [{}] } }).phases[0].model === "ltx/x.gguf");
check("note: what was decided, in words", /steps 12, cfg 2\.55, seed 4242, model ltx\/x\.gguf, 1 LoRA\(s\) added/.test(BO.note(b1, "LTX")));
const rp = RS.basicPatch({ override: true, steps: 12, cfg: 3, model: "m\\a.safetensors" });
check("renderSettings: the board keeps Basic Settings' model", rp.basic_model === "m/a.safetensors" && RS.normalize({ basic_model: "../x" }).basic_model === "");
const jo = RS.jobOverrides({ basic_override: true, basic_steps: 12, basic_cfg: 2, basic_model: "m.gguf" }, { width: 640, height: 352, style: { phases: [{ model: "a" }], model: "a" } });
check("renderSettings.jobOverrides: the model on phase 1 (+ style.model), said; `basic` for LTX scenes", jo.video_style.phases[0].model === "m.gguf" && jo.video_style.model === "m.gguf"
  && jo.notes.some((x) => /model m\.gguf \(Basic Settings/.test(x)) && jo.basic.steps === 12 && jo.basic.cfg === 2, jo);
check("renderSettings.jobOverrides: override off -> no model, no basic", RS.jobOverrides({ basic_override: false, basic_model: "m.gguf" }, { style: { phases: [{ model: "a" }] } }).basic === null
  && RS.jobOverrides({ basic_override: false, basic_model: "m.gguf" }, { style: { phases: [{ model: "a" }] } }).video_style.phases[0].model === "a");
const LTX = require(path.join(ROOT, "lib", "ltx.js"));
const ls = require(path.join(ROOT, "lib", "styles.js")).read(path.join(ROOT, "styles"), "video").find((s) => LTX.isLtxStyle(s));
if (ls) {
  const jp = LTX.jobParams({ style: ls, workflow: LTX.workflowFor(ls, ROOT), mode: "t2v", prompt: "x", images: [], seconds: 3, width: 640, height: 384, seed: 7, basic: { steps: 12, cfg: 2 } });
  check("lib/ltx jobParams carries `basic` {steps, cfg}", jp.basic && jp.basic.steps === 12 && jp.basic.cfg === 2, jp.basic || jp.error);
  check("... and none without it", !LTX.jobParams({ style: ls, workflow: LTX.workflowFor(ls, ROOT), mode: "t2v", prompt: "x", images: [], seconds: 3, width: 640, height: 384, seed: 7 }).basic);
}
const W = require(path.join(ROOT, "lib", "wan.js"));
const wst = require(path.join(ROOT, "lib", "styles.js")).read(path.join(ROOT, "styles"), "video").find((s) => W.isWanStyle(s));
if (wst) {
  check("lib/wan: cfg 1 kept when the override says so (cfgExact), dropped otherwise (the family's)",
    W.jobParams({ style: wst, prompt: "x", seconds: 2, cfg: 1, cfgExact: true }).cfg === 1 && W.jobParams({ style: wst, prompt: "x", seconds: 2, cfg: 1 }).cfg === 0);
}
const ba = JSON.parse(py(`import basic_apply as B
d=json.load(open(${JSON.stringify(path.join(ROOT, "scripts", "fixtures", "frontend", "ltx_templates_graphToPrompt.json"))}))
out={}
for k in ("ltx23_official_t2v","ltx25_official_i2v","ltx23_official_ic_lora"):
    g=d["cases"][k]["frontend"]; g=g.get("output",g)
    n=B.apply(g,{"steps":12,"cfg":2.5})
    out[k]={"notes":n,"sig":[v["inputs"]["sigmas"] for v in g.values() if v.get("class_type")=="ManualSigmas"],
            "cfg":[v["inputs"].get("cfg") for v in g.values() if v.get("class_type") in ("CFGGuider","KSampler")],
            "vcfg":[(v["inputs"].get("video_cfg"),v["inputs"].get("audio_cfg")) for v in g.values() if v.get("class_type")=="LTXVDualCFGGuider"],
            "steps":[v["inputs"].get("steps") for v in g.values() if v.get("class_type")=="KSampler"]}
s=B.parse_sigmas("1.0, 0.99375, 0.9875, 0.98125, 0.975, 0.909375, 0.725, 0.421875, 0.0")
r=B.resample(s,20)
out["re"]={"n":len(r),"first":r[0],"last":r[-1],"mono":all(r[i]>=r[i+1] for i in range(len(r)-1)),"same":B.resample(s,8)==s}
out["none"]=B.apply({"1":{"class_type":"CFGGuider","inputs":{"cfg":1}}},None)
print(json.dumps(out))`));
const t23 = ba.ltx23_official_t2v, t25 = ba.ltx25_official_i2v, ic = ba.ltx23_official_ic_lora;
check("basic_apply LTX 2.3: the 8-step main schedule re-drawn as 12 (13 values), the 3-step refine kept, both CFGGuiders 2.5",
  t23.sig.some((x) => x.split(",").length === 13) && t23.sig.some((x) => x.split(",").length === 4) && t23.cfg.every((c) => c === 2.5), t23);
check("basic_apply LTX 2.5: video_cfg 2.5 on both dual guiders, audio_cfg kept", t25.vcfg.length === 2 && t25.vcfg.every((v) => v[0] === 2.5 && v[1] === 1) && t25.sig.some((x) => x.split(",").length === 13), t25);
check("basic_apply 3DREAL: the KSampler's steps 12 + cfg 2.5", ic.steps[0] === 12 && ic.cfg[0] === 2.5, ic);
check("resample: 20 steps = 21 values from 1.0 to 0.0, only falling; 8 = the same list", ba.re.n === 21 && ba.re.first === 1 && ba.re.last === 0 && ba.re.mono && ba.re.same, ba.re);
check("basic_apply: no override -> nothing", ba.none.length === 0);
const gg = JSON.parse(py(`import wan_graph as WG, worker as Wk
g={"1":{"class_type":"UNETLoader","inputs":{"unet_name":"a.safetensors","weight_dtype":"default"}},"2":{"class_type":"KSampler","inputs":{"model":["1",0],"steps":8,"cfg":1}}}
g2,notes=Wk.apply_video_style(g,{"phases":[{"model":"h3-q4.gguf"}]})
print(json.dumps({"cls":g2["1"]["class_type"],"in":g2["1"]["inputs"],"notes":notes}))`));
check("worker.py: a .gguf model on a UNETLoader -> UnetLoaderGGUF (said)", gg.cls === "UnetLoaderGGUF" && gg.in.unet_name === "h3-q4.gguf" && gg.notes.some((x) => /GGUF/.test(x)), gg);
check("wan_graph: a .gguf model gets UnetLoaderGGUF", /UnetLoaderGGUF/.test(read("scripts", "wan_graph.py")) && /basic_model/.test(read("wan_worker.py")));
const H = read("static", "index.html");
check("the page: every video render sends `basic` (prompt docker + LTX), the Model box, the summary line, basicset.js loaded",
  (H.match(/fd\.append\("basic", H3Basic\.json\(\)\)/g) || []).length === 2 && /id="vidModel" list="vidModelList"/.test(H) && /id="ovrSummary"/.test(H) && /<script src="\/static\/basicset\.js">/.test(H));
check("the page: Enhance's Generate goes through the same dispatch (LTX / Wan / swap / H3), not /api/generate", /\$\("enhGenerate"\)\.onclick = \(\) => \{[\s\S]{0,600}generateFrom\(gm, text\);/.test(H) && !/submitJob\(finalPrompt\(\$\("enhancedText"\)/.test(H));
check("the board ▶ sends Basic Settings' model", /out\.model = md \? md\.value\.trim\(\) : ""/.test(read("ext", "videodock", "characters.js")));
check("the routes read it: /api/generate (H3 + Wan), /api/ltx, the board's LTX scenes", /basicOverride\.parse\(f\.basic\)/.test(read("routes", "index.js")) && /basicOverride\.parse\(b\.basic\)/.test(read("routes", "ltx.js"))
  && /basic: rs\.basic/.test(read("routes", "characters.js")) && /_BA\.apply\(graph, params\.get\("basic"\)\)/.test(read("ltx_worker.py")));

/* ---- 2. effects + adjustment layers */
const v1 = FX.normalize({ vfx: { blur: 80, sharpen: 1, key: { color: "#00FF00", similarity: 0.9 }, crop: { l: 60, t: 5 }, glow: 0, stabilise: 1 } });
check("normVfx: clamped, idle ones dropped, a key with its defaults, crop capped at 45 %", v1.vfx.blur === 50 && v1.vfx.sharpen === 1 && !("glow" in v1.vfx) && v1.vfx.key.color === "#00ff00"
  && v1.vfx.key.similarity === 0.5 && v1.vfx.key.blend === 0.08 && v1.vfx.crop.l === 45 && v1.vfx.crop.t === 5 && v1.vfx.stabilise, v1);
check("normVfx: nothing set -> no fx; effects alone need a render", FX.normalize({ vfx: { blur: 0, key: { on: false } } }) === null && FX.needsRender({ vfx: { blur: 2 } }));
const vf = JSON.parse(py(`import vfx_filters as V, clipfx_render as R
p=[]; n=V.build(p,"[a]","[b]",{"blur":10,"sharpen":1,"glow":0.5,"vignette":0.5,"grain":0.5,"crop":{"l":10,"t":0,"r":10,"b":0},"key":{"color":"#0000ff","similarity":0.2,"blend":0.1,"spill":0.6},"stabilise":True},1920,1080,tag="t")
q=[]; m=V.build(q,"[x]","[y]",{"blur":4,"key":{"color":"#00ff00"},"crop":{"l":10}},1920,1080,enable="between(t,1.000,2.000)",tag="adj",clip=False,lut="'/a/b.cube'")
info={"video":True,"audio":False,"fps":30.0,"alpha":False,"dur":4,"vcodec":"h264","w":1280,"h":720}
g=R.graph({"vfx":{"key":{"color":"#00ff00","similarity":0.12,"blend":0.08,"spill":0.5}}},info,4)
print(json.dumps({"p":p,"n":n,"q":q,"m":m,"g":g[0],"need":R.needs({"fx":{"vfx":{"grain":0.2}}}),"alpha":[V.needs_alpha({"key":{}}),V.needs_alpha({"blur":3})]}))`));
const P0 = vf.p.join(";");
check("vfx (a clip): deshake, crop to 1536 + pad back see-through, chromakey blue + blue despill, gblur, unsharp, glow (split / blur / screen), vignette, grain",
  /deshake/.test(P0) && /crop=1536:1080:192:0,pad=1920:1080:192:0:color=black@0/.test(P0) && /chromakey=color=0x0000ff:similarity=0\.200:blend=0\.100/.test(P0) && /despill=type=blue:mix=0\.60/.test(P0)
  && /gblur=sigma=5\.000/.test(P0) && /unsharp=5:5:1\.500/.test(P0) && /split=2\[tga\]\[tgb\]/.test(P0) && /blend=all_mode=screen:all_opacity=0\.500/.test(P0) && /vignette=angle=0\.6750/.test(P0) && /noise=alls=20:allf=t/.test(P0)
  && vf.p[vf.p.length - 1].endsWith("[b]"), vf.p);
const Q0 = vf.q.join(";");
check("vfx (an adjustment layer): the LUT + blur only while it is on (enable=), no key / crop / stabilise", /lut3d=file='\/a\/b\.cube':interp=tetrahedral:enable='between\(t,1\.000,2\.000\)'/.test(Q0)
  && /gblur=sigma=2\.000:enable='between\(t,1\.000,2\.000\)'/.test(Q0) && !/chromakey|crop=|deshake/.test(Q0), vf.q);
check("clipfx_render: a keyed clip renders see-through (yuva420p), the effects named; grain alone needs a render; key / crop need alpha",
  /chromakey/.test(vf.g) && /format=yuva420p\[v\]/.test(vf.g) && vf.need && vf.alpha[0] && !vf.alpha[1], vf.g);
const CF = require(path.join(ROOT, "lib", "clipFx.js"));
const ak = CF.adjustKeys({ adjust: true, fx: { vfx: { blur: 3, key: { color: "#00ff00" }, crop: { l: 5 }, stabilise: true } } });
check("adjustKeys: an adjustment's effects without a clip's own (key / crop / stabilise); a plain picture -> nothing", JSON.stringify(ak) === JSON.stringify({ adjust: { vfx: { blur: 3 } } })
  && JSON.stringify(CF.adjustKeys({ name: "a.png" })) === "{}", ak);
const png = require(path.join(ROOT, "routes", "effects.js")).clearPng(16, 16);
check("the adjustment placeholder is a valid 16x16 PNG", png.slice(1, 4).toString() === "PNG" && png.readUInt32BE(16) === 16 && png.readUInt32BE(20) === 16);
const IX = require(path.join(ROOT, "lib", "interchange.js"));
const it = IX.items({ video: [{ name: "a.mp4", start: 0, in: 0, out: 2, dur: 2 }], v1: {}, images: [{ clips: [{ name: "adjustment.png", start: 0, len: 2, adjust: true }, { name: "logo.png", start: 0, len: 2 }] }] });
check("the XML / EDL / OTIO leave adjustment layers out (no picture)", it.video[1].items.length === 1 && it.video[1].items[0].name === "logo.png");
check("worker.py applies an adjustment at its place in the picture layers (enable while on)", /c\.get\("adjust"\) is not None/.test(read("worker.py")) && /enable=f"between\(t,\{s0:\.3f\},\{s1:\.3f\}\)"/.test(read("worker.py")));
check("the page: vfxgl.js loaded, the canvas draws a clip's look (key / crop -> grade -> the rest) and an adjustment over what is under it",
  /<script src="\/static\/vfxgl\.js">/.test(H) && /function look\(src, c(, t)?\)/.test(read("ext", "timelinedock", "canvas.js")) && /function adjust\(pg, c, Ly, t\)/.test(read("ext", "timelinedock", "canvas.js")));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
