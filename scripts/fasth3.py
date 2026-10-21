#!/usr/bin/env python3
"""bitGen Studio - scripts/fasth3.py (2.573.0): FASTH3 OMNI in any MiniMax H3 graph.

Tim: "please add this workflow https://www.fasth3-omni.com/en, fasth3 omni".

FastH3 Omni (FastVideo / Hao AI Lab, on MiniMax H3) is H3's reference-to-video model distilled to 8 steps. It runs in
ComfyUI's own nodes (0.43+, no node pack) and ONLY with its recipe (Comfy-Org's template video_fasth3_ominiref_r2v):
    MiniMaxH3SigmaShift   shift_video 12 / shift_audio 3   (the V2 text/image-to-video checkpoint: 10 / 3)
    ModelAttentionBackend "comfy kitchen attention"         (the dense fallback; plain pytorch when kitchen is missing)
    BlockSparseAttention  vsa, keep_percent 10              ("must never run plain block-sparse attention")
    8 steps, euler (V2: res_multistep), simple, cfg 1 (BasicGuider)
The shipped style "FastH3 Omni" (comfy_workflows/fasth3_omni_r2v.json) already has all of it. This module puts the
recipe on ANY H3 graph whose diffusion model is a FastH3 file - so the board's Native-audio music video, H3_Video_Ref
and every H3 style render with it when Basic Settings' model (Override style) or the style's Model is the FastH3 file:
    - the shift right after the loader (the scheduler's sigmas need it as much as the guider does),
    - the base model's turbo LoRAs taken out (a distilled model with a turbo LoRA on top is two distillations),
    - backend + VSA at the final model edge, the steps / sampler set (an explicit Basic Settings step count stays).
A graph that already has a node of the recipe keeps it - only its values are set.
Pure: apply(g, explicit_steps) -> (g, notes); worker.py calls it after the refs / mods and before the upscale stage.
"""

TURBO_WORDS = ("turbo", "lightx2v", "_4step", "_8step", "4step", "8step")
LOADER_KEYS = ("unet_name", "ckpt_name", "model_name")
GUIDERS = ("BasicGuider", "CFGGuider", "DualCFGGuider")
RECIPES = {
    "omni": {"label": "FastH3 Omni (ref2va, 8 steps)", "shift": (12.0, 3.0), "start": 0.0, "sampler": "euler", "steps": 8},
    "v2": {"label": "FastH3 8-step V2 (text / image to video)", "shift": (10.0, 3.0), "start": 0.2,
           "sampler": "res_multistep", "steps": 8},
}
KITCHEN = "comfy kitchen attention"


def recipe_for(name):
    """a diffusion model file name -> "omni" | "v2" | None"""
    n = str(name or "").lower().replace("\\", "/").rsplit("/", 1)[-1]
    if "fasth3" not in n:
        return None
    return "omni" if "omni" in n else "v2"


def _loader(g):
    """(node id, recipe key, file) of the first model loader that loads a FastH3 file, else (None, None, "")"""
    for nid, v in g.items():
        ins = (v or {}).get("inputs") or {}
        for k in LOADER_KEYS:
            r = recipe_for(ins.get(k)) if isinstance(ins.get(k), str) else None
            if r:
                return nid, r, ins[k]
    return None, None, ""


def detect(g):
    """does this graph render with a FastH3 model? -> the recipe key or None"""
    return _loader(g or {})[1]


def _is_link(x):
    return isinstance(x, list) and len(x) == 2 and not isinstance(x[0], (list, dict))


def _rewire(g, old, new):
    """every input carrying link `old` now carries `new`"""
    for v in g.values():
        ins = (v or {}).get("inputs") or {}
        for k, x in list(ins.items()):
            if _is_link(x) and str(x[0]) == str(old[0]) and x[1] == old[1]:
                ins[k] = list(new)


def _new_id(g, base):
    i = 0
    while f"{base}{i or ''}" in g:
        i += 1
    return f"{base}{i or ''}"


def _of(g, cls):
    return [nid for nid, v in g.items() if (v or {}).get("class_type") == cls]


def _final_edge(g):
    """the link feeding the guider's model (else the sampler's) - where VSA belongs"""
    for nid, v in g.items():
        ins = (v or {}).get("inputs") or {}
        if v.get("class_type") in GUIDERS and _is_link(ins.get("model")):
            return ins["model"]
    for nid, v in g.items():
        ins = (v or {}).get("inputs") or {}
        if "Sampler" in str(v.get("class_type") or "") and _is_link(ins.get("model")):
            return ins["model"]
    return None


def apply(g, explicit_steps=0, kitchen=None):
    """the FastH3 recipe on graph `g` (in place) -> (g, notes). kitchen: True/False when the caller knows whether
    ComfyUI offers "comfy kitchen attention", None = leave the backend's value as it is"""
    notes = []
    if not isinstance(g, dict):
        return g, notes
    lid, rk, fname = _loader(g)
    if not lid:
        return g, notes
    R = RECIPES[rk]
    kinds = {str((v or {}).get("class_type") or "") for v in g.values()}
    if rk == "omni" and "MiniMaxH3ImageToVideo" in kinds and "MiniMaxH3ReferenceToVideo" not in kinds:
        notes.append("FastH3: WARNING - FastH3 Omni is a reference-to-video model and this is a first / last frame "
                     "(fl2va) graph; for First / Cont / Trans scenes use H3's own fl2va model or FastH3 8-step V2")
    notes.append(f"FastH3: {fname} - {R['label']}: shift {R['shift'][0]:g}/{R['shift'][1]:g}, VSA keep 10, "
                 f"{R['steps']} steps {R['sampler']}, cfg 1")
    # 1. the base model's turbo LoRAs out
    for nid in list(g):
        v = g.get(nid) or {}
        if "LoraLoader" not in str(v.get("class_type") or ""):
            continue
        ins = v.get("inputs") or {}
        name = str(ins.get("lora_name") or "").lower()
        if any(w in name for w in TURBO_WORDS) and _is_link(ins.get("model")):
            _rewire(g, [nid, 0], ins["model"])
            if _is_link(ins.get("clip")):
                _rewire(g, [nid, 1], ins["clip"])
            del g[nid]
            notes.append(f"FastH3: turbo LoRA {ins.get('lora_name')} taken out (the model is distilled already)")
    # 2. the sigma shift - its own values, or a new node right after the loader
    sh = _of(g, "MiniMaxH3SigmaShift")
    if sh:
        for nid in sh:
            g[nid].setdefault("inputs", {}).update({"shift_video": R["shift"][0], "shift_audio": R["shift"][1]})
    else:
        nid = _new_id(g, "f3shift")
        _rewire(g, [lid, 0], [nid, 0])
        g[nid] = {"class_type": "MiniMaxH3SigmaShift", "_meta": {"title": "MiniMaxH3SigmaShift (FastH3)"},
                  "inputs": {"shift_video": R["shift"][0], "shift_audio": R["shift"][1], "model": [lid, 0]}}
        notes.append(f"FastH3: + {nid} MiniMaxH3SigmaShift {R['shift'][0]:g}/{R['shift'][1]:g} after the loader")
    # 3. backend + VSA at the final model edge
    bs = _of(g, "BlockSparseAttention")
    if not bs:
        src = _final_edge(g)
        if src is None:
            notes.append("FastH3: no guider / sampler with a model input - VSA could not go in (the render will be wrong)")
        else:
            be = _of(g, "ModelAttentionBackend")
            prev = list(src)
            if not be:
                bid = _new_id(g, "f3attn")
                g[bid] = {"class_type": "ModelAttentionBackend", "_meta": {"title": "Model Attention Backend (FastH3)"},
                          "inputs": {"attention": KITCHEN if kitchen is not False else "pytorch attention", "model": prev}}
                prev = [bid, 0]
            vid = _new_id(g, "f3vsa")
            g[vid] = {"class_type": "BlockSparseAttention", "_meta": {"title": "Model Sparse Attention (FastH3: VSA)"},
                      "inputs": {"model": prev}}
            bs = [vid]
            # every consumer of the old edge but the new chain itself
            for nid, v in g.items():
                if nid in (vid,) or (prev != list(src) and nid == prev[0]):
                    continue
                ins = (v or {}).get("inputs") or {}
                x = ins.get("model")
                if _is_link(x) and str(x[0]) == str(src[0]) and x[1] == src[1] and v.get("class_type") != "MiniMaxH3SigmaShift":
                    ins["model"] = [vid, 0]
            notes.append(f"FastH3: + {'backend -> ' if not be else ''}{vid} BlockSparseAttention (vsa) before the guider")
    for nid in bs:
        g[nid].setdefault("inputs", {}).update({"selection": "vsa", "selection.keep_percent": 10, "start_percent": R["start"],
                                                "end_percent": 1, "dense_blocks": "", "min_tokens": 12288, "extra_tokens": 256,
                                                "sink_conditioning": "exact_kv_and_rows", "verbose": False})
        for k in ("selection.tau",):
            g[nid]["inputs"].pop(k, None)
    if kitchen is False:
        for nid in _of(g, "ModelAttentionBackend"):
            if g[nid].get("inputs", {}).get("attention") == KITCHEN:
                g[nid]["inputs"]["attention"] = "pytorch attention"
                notes.append("FastH3: this ComfyUI has no comfy kitchen attention - the dense fallback is pytorch attention "
                             "(Settings ▸ ComfyUI ▸ Comfy Kitchen installs it)")
    # 4. steps / sampler / cfg
    for nid in _of(g, "BasicScheduler"):
        ins = g[nid].setdefault("inputs", {})
        if not _is_link(ins.get("steps")):
            ins["steps"] = int(explicit_steps) if int(explicit_steps or 0) > 0 else R["steps"]
        ins["scheduler"] = "simple"
    if int(explicit_steps or 0) > 0 and int(explicit_steps) != R["steps"]:
        notes.append(f"FastH3: {int(explicit_steps)} steps (Basic Settings) - the model is distilled for {R['steps']}")
    for nid in _of(g, "KSamplerSelect"):
        g[nid].setdefault("inputs", {})["sampler_name"] = R["sampler"]
    for nid in _of(g, "CFGGuider"):
        g[nid].setdefault("inputs", {})["cfg"] = 1.0
    return g, notes
