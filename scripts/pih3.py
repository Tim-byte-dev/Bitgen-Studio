#!/usr/bin/env python3
"""bitGen Studio - scripts/pih3.py (3.5.0): pi-H3 - MiniMax H3 in 2 or 4 steps, no VAE decode.

Tim: "can u add https://hanshengchen.com/blog/pi-h3/ , when asking the user to download, let user choose which model to dl".

pi-H3 (Hansheng Chen, Stanford / Luma AI; ComfyUI nodes github.com/Lakonik/ComfyUI-piFlow, Apache-2.0; adapters
huggingface.co/Lakonik/pi-H3, MiniMax H3 Community License) distils MiniMax H3's FL2VA model into a 2- or 4-step
generator. Its DWD adapters predict the video frames at the last step ("DWD Decode" - no VAE decoder). The shipped styles
"pi-H3 (2 steps)" / "pi-H3 (4 steps)" (comfy_workflows/pi_h3_dwd_2step.json / _4step.json) are the pack's
pi-H3-DWD workflow as an API graph:
    UNETLoader (H3 FL2VA int8) -> Load LakonLab Adapter -> MiniMaxH3SigmaShift 12 / 3 -> sparse attention
    MiniMaxH3ImageToVideo (prompt, size, length, optional first / last frame) -> SamplerCustomAdvanced
    (euler, pi-Flow Scheduler: steps 2 / 4, max_raw_t 0.93 / 0.96, final_step_size_scale 0.6, BasicGuider)
    -> DWD Decode (the frames) + VAEDecodeAudio -> CreateVideo -> SaveVideo
The sparse attention in the graph is ComfyUI's built-in Sol-Attn (BlockSparseAttention "sol-attn" - needs nothing,
but INT8, the pack says it visibly softens pi-H3). apply() swaps it for the best one THIS ComfyUI has, as the pack's
workflow table ranks them:
    1 Spark-Attn (github.com/zechengtang/Spark-H3 - MiniMaxH3SparkAttentionSM86 / SM89 / SM120, the node for this GPU:
      RTX 30 = SM86, RTX 40 / Ada = SM89, RTX 50 / RTX PRO Blackwell = SM120), mode "speed", its steps = the sampler's
    2 Kijai's Sol-Attn (github.com/kijai/ComfyUI-SolAttn_triton - SolAttnPatch, BF16, any GPU Triton supports)
    3 the built-in one (kept)
Every other input of the node it puts in takes that node's own default (ComfyUI's object_info).
Pure except info() (object_info + system_stats): detect, steps_of, spark_class, apply, missing (3.11.2).
"""
import json
import urllib.request

ADAPTER = "Load LakonLab Adapter"
SPARK = ("MiniMaxH3SparkAttentionSM86", "MiniMaxH3SparkAttentionSM89", "MiniMaxH3SparkAttentionSM120")
KJ = "SolAttnPatch"
BUILTIN = "BlockSparseAttention"
RECIPE = {2: 0.93, 4: 0.96}            # pi-Flow Scheduler max_raw_t by steps (the pack's adapter subgraph)


def detect(g):
    """a pi-H3 graph? (a LakonLab adapter loader on an H3 graph)"""
    return isinstance(g, dict) and any(isinstance(v, dict) and v.get("class_type") == ADAPTER for v in g.values())


def steps_of(g):
    for v in (g or {}).values():
        if isinstance(v, dict) and v.get("class_type") == "pi-Flow Scheduler":
            s = (v.get("inputs") or {}).get("steps")
            if isinstance(s, int):
                return s
    return 0


def spark_class(gpu_name, have):
    """the Spark-Attn node for this GPU (its name in ComfyUI's system_stats), if ComfyUI has it -> class or None"""
    n = str(gpu_name or "").lower()
    want = None
    if any(k in n for k in ("rtx 50", "rtx pro", "blackwell")):
        want = "MiniMaxH3SparkAttentionSM120"
    elif any(k in n for k in ("rtx 40", " l40", " l4 ", " ada")) or n.endswith(" l4"):
        want = "MiniMaxH3SparkAttentionSM89"
    elif any(k in n for k in ("rtx 30", "rtx a6000", "rtx a5000", "rtx a4000", " a40", " a10g", " a10 ")) or n.endswith(" a10"):
        want = "MiniMaxH3SparkAttentionSM86"
    return want if want and want in (have or {}) else None


def _combo(spec):
    if not isinstance(spec, (list, tuple)) or not spec:
        return []
    if isinstance(spec[0], (list, tuple)):
        return list(spec[0])
    if len(spec) > 1 and isinstance(spec[1], dict):
        return list(spec[1].get("options") or [])
    return []


def _fill(spec, model_link, steps):
    """a node's inputs from its object_info: the model link, mode "speed", steps = the sampler's, the rest at defaults"""
    ins = {}
    I = (spec or {}).get("input") or {}
    for opt, sec in ((False, I.get("required") or {}), (True, I.get("optional") or {})):
        for name, s in sec.items():
            if not isinstance(s, (list, tuple)) or not s:
                continue
            typ, o = s[0], (s[1] if len(s) > 1 and isinstance(s[1], dict) else {})
            ch = _combo(s)
            if typ == "MODEL":
                ins[name] = model_link
            elif name == "mode" and "speed" in ch:
                ins[name] = "speed"
            elif name == "steps" and typ == "INT" and steps:
                ins[name] = steps
            elif ch:
                ins[name] = o.get("default", ch[0])
            elif typ in ("INT", "FLOAT", "STRING", "BOOLEAN") and "default" in o:
                ins[name] = o["default"]
            elif not opt and typ in ("INT", "FLOAT", "STRING", "BOOLEAN"):
                ins[name] = {"INT": 0, "FLOAT": 0.0, "STRING": "", "BOOLEAN": False}[typ]
    return ins


PACK_NODES = (ADAPTER, "pi-Flow Scheduler", "DWD Decode")   # 3.11.2: the ComfyUI-piFlow nodes every pi-H3 graph needs


def missing(g, inf):
    """3.11.2: the ComfyUI-piFlow nodes this graph uses that this ComfyUI has not loaded - [] when they are there, or when
    ComfyUI could not be asked (then ComfyUI itself says what it is missing)"""
    if not (inf or {}).get("reached"):
        return []
    used = {v.get("class_type") for v in (g or {}).values() if isinstance(v, dict)}
    have = (inf or {}).get("classes") or {}
    return [c for c in PACK_NODES if c in used and c not in have]


def info(base, timeout=10):
    """{classes: {class: object_info}, gpu: its name, version, reached} - what this ComfyUI has for pi-H3"""
    out = {"classes": {}, "gpu": "", "version": "", "reached": False}

    def get(path):
        try:
            with urllib.request.urlopen(f"{base}{path}", timeout=timeout) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception:                   # noqa: BLE001
            return None
    for cls in SPARK + (KJ,) + PACK_NODES:
        j = get(f"/object_info/{cls}")
        if isinstance(j, dict) and j.get(cls):
            out["classes"][cls] = j[cls]
    st = get("/system_stats") or {}
    out["reached"] = bool(st)
    out["version"] = str((st.get("system") or {}).get("comfyui_version") or "")
    devs = st.get("devices") or []
    if devs:
        out["gpu"] = str(devs[0].get("name") or "")
    return out


def apply(g, inf, attention="auto"):
    """-> (g, notes). attention: auto (the best this ComfyUI has) | builtin | dense (no sparse attention)"""
    notes = []
    if not detect(g):
        return g, notes
    st = steps_of(g)
    # the adapter you downloaded: the int8 one the style names, else its bf16 twin (Settings ▸ Add-ons ▸ π pi-H3 lets you pick)
    loras = _combo((((((inf or {}).get("classes") or {}).get(ADAPTER) or {}).get("input") or {}).get("required") or {}).get("adapter_name"))
    for v in g.values():
        if isinstance(v, dict) and v.get("class_type") == ADAPTER and loras:
            ins = v.setdefault("inputs", {})
            name = ins.get("adapter_name")
            if isinstance(name, str) and name not in loras:
                twin = name.replace("_int8_convrot", "") if "_int8_convrot" in name else name.replace(".safetensors", "_int8_convrot.safetensors")
                alt = next((x for x in loras if x.replace("\\", "/").rsplit("/", 1)[-1] == twin), None)
                if alt:
                    ins["adapter_name"] = alt
                    notes.append(f"pi-H3: adapter {alt} (the {'bf16' if '_int8' not in alt else 'int8'} one you have)")
    for v in g.values():                   # the recipe's max_raw_t follows the steps (a style edited to 4 steps)
        if isinstance(v, dict) and v.get("class_type") == "pi-Flow Scheduler":
            ins = v.setdefault("inputs", {})
            if st in RECIPE and not isinstance(ins.get("max_raw_t"), list):
                ins["max_raw_t"] = RECIPE[st]
    bid = next((k for k, v in g.items() if isinstance(v, dict) and v.get("class_type") == BUILTIN), None)
    if bid is None:
        notes.append(f"pi-H3: {st} steps, DWD - this graph has its own attention")
        return g, notes
    link = (g[bid].get("inputs") or {}).get("model")
    if attention == "dense":
        for k, v in g.items():
            for name, x in list((v.get("inputs") or {}).items()):
                if isinstance(x, list) and len(x) == 2 and str(x[0]) == str(bid):
                    v["inputs"][name] = link
        g.pop(bid, None)
        notes.append(f"pi-H3: {st} steps, DWD, dense attention (slower, the closest to H3)")
        return g, notes
    have = (inf or {}).get("classes") or {}
    if attention == "auto":
        sp = spark_class((inf or {}).get("gpu"), have)
        if sp:
            g[bid] = {"class_type": sp, "inputs": _fill(have[sp], link, st), "_meta": {"title": "pi-H3 Spark-Attn"}}
            notes.append(f"pi-H3: {st} steps, DWD, Spark-Attn ({sp} - {(inf or {}).get('gpu') or 'this GPU'})")
            return g, notes
        if KJ in have:
            g[bid] = {"class_type": KJ, "inputs": _fill(have[KJ], link, st), "_meta": {"title": "pi-H3 Kijai Sol-Attn"}}
            notes.append(f"pi-H3: {st} steps, DWD, Kijai's Sol-Attn (Triton - its first run compiles and takes longer)")
            return g, notes
    notes.append(f"pi-H3: {st} steps, DWD, ComfyUI's built-in Sol-Attn (INT8 - a little softer; Spark-H3 or Kijai's "
                 "ComfyUI-SolAttn_triton in ComfyUI are better - Settings ▸ Add-ons ▸ π pi-H3)")
    return g, notes
