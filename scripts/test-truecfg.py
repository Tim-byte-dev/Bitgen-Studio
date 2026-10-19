#!/usr/bin/env python3
"""bitGen Studio — 2.366.0: true cfg for the MiniMax H3 graphs.
Tim: "even your prompt didn't work , cfg was 1, i am trying 3".
  1. every shipped H3 video graph guides with BasicGuider (no cfg input) -
     the reason cfg 3 never reached the render;
  2. cfg <= 1: the graph is untouched;
  3. cfg > 1 on ref2va: BasicGuider -> CFGGuider, positive = the graph's own
     conditioning, negative = a clone of MiniMaxH3ReferenceToVideo with the
     SAME reference links and the negative text, cfg written;
  4. fl2va + the native-audio board (lock-patched model kept);
  5. through a RefMod apply: the negative carries the same mod;
  6. a custom negative; the turbo-LoRA warning;
  7. a guider not fed by an H3 generator is left alone, said;
  8. the worker wiring (after the upscale stage; said when it cannot load);
  9. the Basic Settings note.
Run from repo root: python3 scripts/test-truecfg.py"""
import copy, json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import truecfg as tc  # noqa: E402

FAILED = []


def check(name, cond, extra=""):
    print(("PASS: " if cond else "FAIL: ") + name + ("" if cond else f" {extra}"))
    if not cond:
        FAILED.append(name)


def load(n):
    return json.loads((ROOT / "comfy_workflows" / n).read_text())


def of(g, ct):
    return [k for k, v in g.items() if isinstance(v, dict) and v.get("class_type") == ct]


R2V = load("ref2va.json")
FL = load("fl2va.json")
NA = load("MMH3_NativeAudio_MV_fl2va.json")
SC = load("h3_scene_api.json")

# 1
for name, g in (("ref2va", R2V), ("fl2va", FL), ("native-audio fl2va", NA), ("h3_scene_api", SC)):
    gd = of(g, "BasicGuider")
    check(f"{name} guides with BasicGuider and has no cfg input anywhere (why cfg 3 did nothing)",
          len(gd) == 1 and not any("cfg" in (v.get("inputs") or {}) for v in g.values() if isinstance(v, dict)))

# 2
for c in (1, 1.0, 0.5, None, "x"):
    g2, n2 = tc.apply(copy.deepcopy(R2V), c)
    check(f"cfg {c!r}: untouched, nothing said", g2 == R2V and n2 == [])

# 3
g3, n3 = tc.apply(copy.deepcopy(R2V), 3)
gd = g3["126"]
neg = gd["inputs"]["negative"][0]
check("ref2va cfg 3: node 126 is a CFGGuider with model / positive / negative / cfg 3.0",
      gd["class_type"] == "CFGGuider" and gd["inputs"]["model"] == ["141", 0]
      and gd["inputs"]["positive"] == ["136", 0] and gd["inputs"]["cfg"] == 3.0, gd)
nn = g3.get(neg, {})
check("...the negative is a CLONE of MiniMaxH3ReferenceToVideo (136_neg), output 0",
      neg == "136_neg" and nn.get("class_type") == "MiniMaxH3ReferenceToVideo"
      and gd["inputs"]["negative"] == ["136_neg", 0], neg)
same = {k: v for k, v in R2V["136"]["inputs"].items() if k != "prompt"}
check("...with every reference link the positive has (pictures, voice, videos, size, length, clip, vaes)",
      {k: v for k, v in nn["inputs"].items() if k != "prompt"} == same)
check("...and the default negative text as its prompt (the positive keeps its own link)",
      nn["inputs"]["prompt"] == tc.DEFAULT_NEGATIVE and g3["136"]["inputs"]["prompt"] == ["138", 0]
      and "babbling" in tc.DEFAULT_NEGATIVE and "repeating the reference audio" in tc.DEFAULT_NEGATIVE)
check("...the sampler still reads guider 126 and the positive's latent; nothing else changed",
      g3["125"] == R2V["125"] and {k: v for k, v in g3.items() if k not in ("126", "136_neg")}
      == {k: v for k, v in R2V.items() if k != "126"})
check("...said: true cfg, CFGGuider, the generator, about 2x time; the source graph untouched",
      any("true cfg 3: 1 BasicGuider -> CFGGuider" in n and "MiniMaxH3ReferenceToVideo" in n
          and "2x time" in n for n in n3) and R2V["126"]["class_type"] == "BasicGuider", n3)
check("...no LoRA warning when the 4-step LoRA is off", not any("WARNING" in n for n in n3))

# 4
g4, n4 = tc.apply(copy.deepcopy(FL), 2.5)
gd4 = g4["105:16"]
check("fl2va: CFGGuider negative = a MiniMaxH3ImageToVideo clone with the same first/last frames",
      gd4["class_type"] == "CFGGuider" and gd4["inputs"]["cfg"] == 2.5
      and g4[gd4["inputs"]["negative"][0]]["class_type"] == "MiniMaxH3ImageToVideo"
      and g4[gd4["inputs"]["negative"][0]]["inputs"]["first_frame"] == ["114", 0]
      and g4[gd4["inputs"]["negative"][0]]["inputs"]["last_frame"] == ["116", 0])
g5, _ = tc.apply(copy.deepcopy(NA), 3)
check("native-audio board: the lock-patched model stays the guider's model (the song stays locked)",
      g5["53"]["class_type"] == "CFGGuider" and g5["53"]["inputs"]["model"] == ["41", 0]
      and g5["53"]["inputs"]["positive"] == ["40", 0] and g5["41"] == NA["41"])

# 5
RM = copy.deepcopy(R2V)
RM["900"] = {"class_type": "MiniMaxH3RefModsLoader", "inputs": {"mod_1": "x.safetensors"}}
RM["901"] = {"class_type": "MiniMaxH3RefModApply", "inputs": {"conditioning": ["136", 0], "mods": ["900", 0], "retention": 1.0}}
RM["126"]["inputs"]["conditioning"] = ["901", 0]
g6, n6 = tc.apply(RM, 3)
ng = g6["126"]["inputs"]["negative"][0]
check("through a RefMod apply: positive = the apply, negative = a cloned apply reading the cloned generator, same mods",
      g6["126"]["inputs"]["positive"] == ["901", 0] and ng == "901_neg"
      and g6[ng]["inputs"]["conditioning"] == ["136_neg", 0] and g6[ng]["inputs"]["mods"] == ["900", 0]
      and g6["136_neg"]["inputs"]["prompt"] == tc.DEFAULT_NEGATIVE, (ng, g6.get(ng)))

# 6
g7, n7 = tc.apply(copy.deepcopy(R2V), 4, use_lora=True, negative="  muffled voice ")
check("a custom negative is used (trimmed)", g7["136_neg"]["inputs"]["prompt"] == "muffled voice")
check("turbo LoRA on + cfg > 1: the over-bake warning names the switch and 20+ steps",
      any(n.startswith("WARNING: the turbo LoRA is distilled for cfg 1") and "4-step LoRA off" in n
          and "20+ steps" in n for n in n7), n7)
g7b, _ = tc.apply(copy.deepcopy(g7), 4)
check("idempotent: a graph already on CFGGuider is not switched twice", g7b == g7)

# 7
ODD = {"1": {"class_type": "UNETLoader", "inputs": {}},
       "2": {"class_type": "CLIPTextEncode", "inputs": {"text": "x", "clip": ["3", 0]}},
       "4": {"class_type": "BasicGuider", "inputs": {"model": ["1", 0], "conditioning": ["2", 0]}}}
g8, n8 = tc.apply(copy.deepcopy(ODD), 3)
check("a guider not fed by an H3 generator is left alone, said",
      g8 == ODD and any("not fed by an H3 generator" in n for n in n8), n8)
g9, n9 = tc.apply({"1": {"class_type": "KSampler", "inputs": {"cfg": 3}}}, 3)
check("a graph with no BasicGuider: said (its own cfg input already got the value)",
      any("no BasicGuider" in n for n in n9))

# 8
W = (ROOT / "worker.py").read_text()
check("worker: truecfg is imported like the other stage helpers, None when it cannot load",
      "    import truecfg as _tc\n" in W and "    _tc = None\n" in W)
check("worker: applied AFTER the upscale stage (it reads the guider's conditioning) with cfg_val, use_lora, the negative",
      W.index("g, tc_notes = _tc.apply(") > W.index("g, unotes = _us.apply(")
      and "g, cfg_val, use_lora=use_lora," in W and 'params.get("negative_prompt")' in W
      and W.index("g, tc_notes = _tc.apply(") < W.index("# 2.301.0: the lossless master's taps"))
check("worker: says cfg was ignored when the helper did not load",
      "ignored: scripts/truecfg.py did not load" in W)

# 9
RS = (ROOT / "lib" / "renderSettings.js").read_text()
check("Basic Settings note: cfg > 1 = true CFG on H3 (2x time), 1 = distilled single pass",
      "true CFG on H3" in RS and "native H3 guides at 1" not in RS)

print(f"\nRESULT: {len(FAILED)} failed")
sys.exit(1 if FAILED else 0)
