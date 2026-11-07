"""bitGen Studio — 16 GB MODE FOR MINIMAX H3 RENDERS (2.708.0).

Tim (verbatim): "this workflow is meant to work with 16gb vram - minimax" (DENO's MiniMax H3 R2V Turbo 8+2 export) -
his pick: "16 GB mode for my H3 renders" - use its tricks automatically on a 16 GB card. The recipe, as that export
wires it (class names and widget names verbatim from it - nothing here is guessed):

  text encoder   DenoTextEncoderUnload (positive_conditioning, text_encoder) sits between the H3 node's conditioning
                 and the guider(s): the 32B encoder leaves VRAM before either sampling pass (DENO custom nodes)
  pass 1         the scene at the size Basic Settings asks for, 8 steps with the Ref2VA Acc 8-step LoRA
                 (LoraLoaderModelOnly) + MiniMaxH3SigmaShift 12 / 3, sampler euler - the sound is made here and kept
  latent upscale LTXVSeparateAVLatent -> MinimaxH3LatentUpscaler3D (mode "scale by multiplier", align 32) on the
                 video latent; the audio latent behind SetLatentNoiseMask with a SolidMask of 0 (frozen); back together
                 with LTXVConcatAVLatent
  pass 2         the last 2 of 8 sigmas (BasicScheduler simple 8 -> SplitSigmas 6, the low half) with the DMD Ref2VA
                 8-step LoRA + the Open-H3 2K refiner LoRA + MiniMaxH3SigmaShift 12 / 3 + BlockSparseAttention
                 (sol-attn, tau 1.3, from 20 % of the steps) - the same noise, sampler and conditioning
  before decode  VRAM_Debug (KJNodes: empty cache, gc, unload all models) so the big decode has the card to itself
  attention      ModelAttentionBackend "comfy kitchen attention" on both model chains when this ComfyUI has it

Every part is applied only when the running ComfyUI has its node (and its LoRA / model file): what is missing is
left out WITH A NOTE that says what to install - never sent to fail. The take comes out at Basic Settings' size x the
upscale (like the ⚙ upscaler's "renders at A -> upscaled to B").

apply(g, opt) -> (g, notes). opt: {scale, have: {class: bool}, files: {acc, dmd, refiner, upscaler: name|None},
kitchen: bool|None, turbo: bool, upscale_stage: bool}. Pure: a graph dict in, (graph, notes) out.
"""
import copy

ACC = "MiniMax-H3-Ref2VA-Acc-8Step_pruned_comfy.safetensors"            # Kijai/MiniMax-H3-experimental (loras/)
DMD = "minimax_h3_dmd_ref2va_8step_turbo_pruned.safetensors"            # drbaph/MiniMax-H3-Turbo-Lora-ComfyUI (experimental/)
REFINER = "minimax_h3_open_regenerate_2k_refiner_rank_16_bf16.safetensors"   # Kijai/MiniMax-H3-experimental (loras/)
UPSCALER = "minimax_h3_latent_upscaler_3d_bf16.safetensors"             # LBH-123-AI/Minimax_h3_latent_Upscaler
FILES = {"acc": ACC, "dmd": DMD, "refiner": REFINER, "upscaler": UPSCALER}
SPARSE = {"selection": "sol-attn", "selection.tau": 1.3, "start_percent": 0.2, "end_percent": 1, "dense_blocks": "",
          "min_tokens": 12288, "extra_tokens": 256, "sink_conditioning": "exact_kv_and_rows", "verbose": False}
SHIFT = {"shift_video": 12, "shift_audio": 3}
STEPS, SPLIT = 8, 6                         # 8 sigmas; pass 2 redraws the last 2
SCALES = (1.0, 2.0)                         # the upscale multiplier's range (DENO's table: 1.2 ... 2.0)
DEFAULT_SCALE = 1.5
H3_NODES = ("MiniMaxH3ReferenceToVideo", "MiniMaxH3ImageToVideo")
NODES = {"unload": "DenoTextEncoderUnload", "upscaler": "MinimaxH3LatentUpscaler3D", "sparse": "BlockSparseAttention",
         "shift": "MiniMaxH3SigmaShift", "split": "LTXVSeparateAVLatent", "concat": "LTXVConcatAVLatent",
         "vram": "VRAM_Debug", "backend": "ModelAttentionBackend"}
INSTALL = {
    "DenoTextEncoderUnload": "the DENO custom nodes (Settings ▸ ComfyUI ▸ Video accelerators ▸ Install DENO nodes)",
    "MinimaxH3LatentUpscaler3D": "the H3 latent upscaler nodes (Settings ▸ ComfyUI ▸ 16 GB mode ▸ Install the latent upscaler nodes)",
    "BlockSparseAttention": "a ComfyUI with Sol attention (0.43 or later - Settings ▸ ComfyUI ▸ ⤓ Update)",
    "MiniMaxH3SigmaShift": "a newer ComfyUI with MiniMax H3 (Settings ▸ ComfyUI ▸ ⤓ Update)",
    "LTXVSeparateAVLatent": "a newer ComfyUI (Settings ▸ ComfyUI ▸ ⤓ Update)",
    "VRAM_Debug": "KJNodes (Settings ▸ ComfyUI ▸ Video accelerators ▸ Install KJNodes)",
}


def _is_link(v):
    return isinstance(v, list) and len(v) == 2 and isinstance(v[0], (str, int))


def _same(a, b):
    return _is_link(a) and _is_link(b) and str(a[0]) == str(b[0]) and int(a[1]) == int(b[1])


def _consumers(g, link, skip=()):
    return [(k, key) for k, v in g.items() if k not in skip
            for key, val in ((v or {}).get("inputs") or {}).items() if _same(val, link)]


def clamp_scale(x):
    try:
        x = float(x)
    except (TypeError, ValueError):
        return DEFAULT_SCALE
    return round(min(SCALES[1], max(SCALES[0], x)), 2)


def find(g):
    """the H3 render in a graph: {h3, sampler, guider, scheduler} or None - the SamplerCustomAdvanced whose latent is
    the native H3 node's (output 1), and its BasicGuider"""
    for hid, h in g.items():
        if not (isinstance(h, dict) and h.get("class_type") in H3_NODES):
            continue
        for sid, s in g.items():
            ins = (s or {}).get("inputs") or {}
            if (s or {}).get("class_type") == "SamplerCustomAdvanced" and _same(ins.get("latent_image"), [hid, 1]):
                gl = ins.get("guider")
                gid = str(gl[0]) if _is_link(gl) else None
                if gid is None or (g.get(gid) or {}).get("class_type") != "BasicGuider":
                    continue
                sl = ins.get("sigmas")
                sched = str(sl[0]) if _is_link(sl) and (g.get(str(sl[0])) or {}).get("class_type") == "BasicScheduler" else None
                return {"h3": hid, "sampler": sid, "guider": gid, "scheduler": sched}
    return None


def _base_model(g, link):
    """the model BEFORE the graph's own turbo switch: a ComfySwitchNode's on_false (the base / style-LoRA chain) -
    16 GB mode brings its own 8-step LoRAs, so the 4-step turbo one must not stack under them"""
    nid = str(link[0])
    v = g.get(nid) or {}
    if v.get("class_type") == "ComfySwitchNode" and _is_link((v.get("inputs") or {}).get("on_false")):
        return list(v["inputs"]["on_false"]), True
    return list(link), False


def _loader_link(g, link, depth=0):
    """the UNETLoader at the root of a model chain (the scheduler's model, as DENO wires it)"""
    if not _is_link(link) or depth > 40:
        return None
    v = g.get(str(link[0])) or {}
    if v.get("class_type") in ("UNETLoader", "CheckpointLoaderSimple", "UnetLoaderGGUF"):
        return [str(link[0]), 0]
    ins = v.get("inputs") or {}
    for k in ("model", "on_false"):
        if _is_link(ins.get(k)):
            return _loader_link(g, ins[k], depth + 1)
    return None


def apply(g, opt=None):
    o = dict(opt or {})
    have = o.get("have") or {}
    files = o.get("files") or {}
    ok = lambda key: have.get(NODES[key], False)                       # noqa: E731 - unknown = absent
    notes = []
    if any((v or {}).get("class_type") == "BlockSparseAttention" for v in g.values()):
        return g, ["16 GB mode: not used - this graph already runs sparse attention (FastH3 Omni: 8 steps, built for it)"]
    f = find(g)
    if not f:
        return g, ["16 GB mode: not used - no native MiniMax H3 render (MiniMaxH3ReferenceToVideo / ImageToVideo -> "
                   "SamplerCustomAdvanced -> BasicGuider) in this graph"]
    g = copy.deepcopy(g)
    h3, samp, guid = g[f["h3"]], g[f["sampler"]], g[f["guider"]]
    gin = guid["inputs"]
    cond = list(gin["conditioning"]) if _is_link(gin.get("conditioning")) else None
    clip = (h3.get("inputs") or {}).get("clip")
    # ---- the text encoder leaves VRAM before sampling
    if ok("unload") and cond and _is_link(clip):
        g["h16teu"] = {"class_type": NODES["unload"], "inputs": {"positive_conditioning": cond, "text_encoder": list(clip)},
                       "_meta": {"title": "16 GB mode: text encoder unload"}}
        for k, key in _consumers(g, cond, skip=("h16teu",)):
            if (g[k].get("class_type") or "") in ("BasicGuider", "CFGGuider") or key == "conditioning":
                g[k]["inputs"][key] = ["h16teu", 0]
        cond = ["h16teu", 0]
        notes.append("16 GB mode: the text encoder is unloaded after encoding (DenoTextEncoderUnload)")
    elif cond:
        notes.append("16 GB mode: text encoder unload left out - install " + INSTALL["DenoTextEncoderUnload"])
    # ---- the base model chain (style LoRAs kept; the graph's own turbo switch bypassed)
    base, switched = _base_model(g, gin["model"])
    kitchen = bool(o.get("kitchen")) and ok("backend")

    def chain(start, loras, tag, sparse):
        prev = list(start)
        if kitchen:
            g[f"h16{tag}be"] = {"class_type": NODES["backend"], "inputs": {"model": prev, "attention": "comfy kitchen attention"}}
            prev = [f"h16{tag}be", 0]
        for i, (name, _label) in enumerate(loras):
            nid = f"h16{tag}l{i}"
            g[nid] = {"class_type": "LoraLoaderModelOnly", "inputs": {"model": prev, "lora_name": name, "strength_model": 1.0}}
            prev = [nid, 0]
        if ok("shift"):
            g[f"h16{tag}sh"] = {"class_type": NODES["shift"], "inputs": dict({"model": prev}, **SHIFT)}
            prev = [f"h16{tag}sh", 0]
        if sparse and ok("sparse"):
            g[f"h16{tag}sp"] = {"class_type": NODES["sparse"], "inputs": dict({"model": prev}, **SPARSE)}
            prev = [f"h16{tag}sp", 0]
        return prev
    # ---- pass 1: 8 steps with the Acc LoRA (turbo); else the graph's own pass, untouched
    turbo = o.get("turbo", True) and files.get("acc") and ok("shift")
    if turbo:
        gin["model"] = chain(base, [(files["acc"], "acc")], "p1", False)
        if f["scheduler"]:
            g[f["scheduler"]]["inputs"]["steps"] = STEPS
        sl = samp["inputs"].get("sampler")
        if _is_link(sl) and (g.get(str(sl[0])) or {}).get("class_type") == "KSamplerSelect":
            g[str(sl[0])]["inputs"]["sampler_name"] = "euler"
        notes.append(f"16 GB mode: pass 1 = {STEPS} steps with the Ref2VA Acc 8-step LoRA + sigma shift 12 / 3, euler"
                     + (" (the graph's own turbo switch bypassed)" if switched else "")
                     + (", comfy kitchen attention" if kitchen else ""))
    elif o.get("turbo", True):
        notes.append("16 GB mode: pass 1 keeps the graph's own steps - "
                     + ("download the Ref2VA Acc 8-step LoRA (Settings ▸ ComfyUI ▸ 16 GB mode)" if not files.get("acc")
                        else "install " + INSTALL["MiniMaxH3SigmaShift"]))
    # ---- pass 2: latent upscale + the last 2 sigmas
    scale = clamp_scale(o.get("scale", DEFAULT_SCALE))
    need = [NODES[k] for k in ("upscaler", "split", "concat", "shift") if not ok(k)]
    lack = [FILES[k] for k in ("upscaler", "dmd", "refiner") if not files.get(k)]
    if o.get("upscale_stage"):
        notes.append("16 GB mode: the latent upscale pass left out - the ⚙ upscaler stage upscales this render")
    elif scale <= 1.0:
        notes.append("16 GB mode: upscale x1 - no second pass")
    elif need or lack:
        notes.append("16 GB mode: the latent upscale pass left out - "
                     + "; ".join(["install " + INSTALL.get(n, n) for n in need]
                                 + (["download " + ", ".join(lack) + " (Settings ▸ ComfyUI ▸ 16 GB mode)"] if lack else [])))
    else:
        out = [f["sampler"], 0]
        users = _consumers(g, out) + _consumers(g, [f["sampler"], 1])
        g["h16sep"] = {"class_type": NODES["split"], "inputs": {"av_latent": out}}
        g["h16up"] = {"class_type": NODES["upscaler"], "_meta": {"title": f"16 GB mode: latent upscale x{scale}"},
                      "inputs": {"latent": ["h16sep", 0], "model_name": files["upscaler"], "mode": "scale by multiplier",
                                 "mode.scale": scale, "align": 32}}
        g["h16mask"] = {"class_type": "SolidMask", "inputs": {"value": 0, "width": 64, "height": 64}}
        g["h16amask"] = {"class_type": "SetLatentNoiseMask", "inputs": {"samples": ["h16sep", 1], "mask": ["h16mask", 0]}}
        g["h16cat"] = {"class_type": NODES["concat"], "inputs": {"video_latent": ["h16up", 0], "audio_latent": ["h16amask", 0]}}
        root = _loader_link(g, base) or base
        g["h16sched"] = {"class_type": "BasicScheduler", "inputs": {"model": root, "scheduler": "simple", "steps": STEPS, "denoise": 1}}
        g["h16split"] = {"class_type": "SplitSigmas", "inputs": {"sigmas": ["h16sched", 0], "step": SPLIT}}
        m2 = chain(base, [(files["dmd"], "dmd"), (files["refiner"], "refiner")], "p2", True)
        g["h16guide"] = {"class_type": "BasicGuider", "inputs": {"model": m2, "conditioning": list(cond or gin["conditioning"])}}
        si = samp["inputs"]
        g["h16samp"] = {"class_type": "SamplerCustomAdvanced", "_meta": {"title": "16 GB mode: pass 2 (the last 2 steps)"},
                        "inputs": {"noise": si["noise"], "guider": ["h16guide", 0], "sampler": si["sampler"],
                                   "sigmas": ["h16split", 1], "latent_image": ["h16cat", 0]}}
        final = ["h16samp", 0]
        if ok("vram"):
            g["h16free"] = {"class_type": NODES["vram"], "inputs": {"any_input": ["h16samp", 0], "empty_cache": True,
                                                                     "gc_collect": True, "unload_all_models": True}}
            final = ["h16free", 0]
        for k, key in users:
            g[k]["inputs"][key] = list(final)
        notes.append(f"16 GB mode: pass 2 = latent upscale x{scale} (align 32), then the last {STEPS - SPLIT} of {STEPS} "
                     "steps with the DMD + 2K refiner LoRAs" + (" + Sol sparse attention" if ok("sparse") else "")
                     + "; the sound from pass 1 kept (masked)" + ("; models unloaded before the decode" if ok("vram") else "")
                     + f"; {len(users)} consumer(s) read the upscaled result")
    return g, notes
