"""bitGen Studio — THE MMH3 ULTIMATE UPSCALE STAGE (2.312.0).

Tim (verbatim): "... upscaler dropdown, upscale resolution. Add a workflow
for comfyui upscaler, https://github.com/bbaudio-2025/Comfyui-MMH3-UltimateUpscale".

The pack upscales the H3 LATENT between the sampler and the decode: a 3D
latent upscaler model (ComfyUI models/latent_upscale_models) grows the
latent to the target size, then ONE refine step at denoise 0.2 runs over it
in temporal chunks and spatial tiles so it fits in VRAM. Its nodes, as Tim's
MM3 export wires them (and comfy_workflows/MMH3_UltimateUpscale_stage.json
carries them):
  MMH3LatentUpscaleWithModelParams  model_name, width, height, device, precision
  MMH3TemporalSplitParams           chunk_length 85, temporal_overlap 17, anchor 0.999
  MMH3SpatialSplitParams            upscale_width/height, tiles 1024, overlap 128
  MMH3UltimateUpscale               model, conditioning, latent, noise, sampler,
                                    sigmas, cfg 1 + the three param inputs
apply(g, stage, seed):
  * the graph ALREADY has an *UltimateUpscale stage (the MM3 chain export):
    re-aim it - the model file and the target size on its param nodes,
    cfg back to 1 (the shared patch writes the render's cfg into every node
    that has one);
  * otherwise SPLICE the stage in: after the SamplerCustomAdvanced whose
    output feeds the video decode; model + conditioning from that sampler's
    guider (the native-audio graphs' lock-patched model, so the audio latent
    stays locked); every consumer of the sampler's latent reads the
    upscaled one instead. The audio decode of the native-audio graphs comes
    from the lock node, never from this latent, so the song is untouched.
from_take(g, video) - 2.315.0 (Tim: "i would prefer to press the button so
  i can preview the scene"): the ⏫ upscales the TAKE he previewed, not a
  fresh sample. The stage's latent input is re-pointed at the take itself:
  LoadVideo (the uploaded take - its lossless master when it has one) ->
  GetVideoComponents -> VAEEncodeTiled with the VAE the stage's decode
  uses. The scene's sampler is left with no consumer, so ComfyUI never runs
  it; model + conditioning still come from its guider (the refine pass).
Pure: graph dicts in, (graph, notes) out.
"""
import copy
import json
from pathlib import Path

TEMPLATE = Path(__file__).resolve().parents[1] / "comfy_workflows" / "MMH3_UltimateUpscale_stage.json"
PARAMS = "MMH3LatentUpscaleWithModelParams"
SPATIAL = "MMH3SpatialSplitParams"


def _is_link(v):
    return isinstance(v, list) and len(v) == 2 and isinstance(v[0], (str, int))


def _consumers(g, nid, slot=0):
    out = []
    for k, v in g.items():
        for key, val in ((v or {}).get("inputs") or {}).items():
            if _is_link(val) and str(val[0]) == str(nid) and int(val[1]) == slot:
                out.append((k, key))
    return out


def _aim(g, notes, stage):
    """Re-aim every param node of an existing stage; cfg back to 1."""
    w, h, m = int(stage["width"]), int(stage["height"]), str(stage.get("model") or "")
    for k, v in g.items():
        ct = str((v or {}).get("class_type", ""))
        ins = v.setdefault("inputs", {})
        if ct == PARAMS:
            if m:
                ins["model_name"] = m
            ins["width"], ins["height"] = w, h
        elif ct == SPATIAL:
            ins["upscale_width"], ins["upscale_height"] = w, h
        elif "ultimateupscale" in ct.lower() and "cfg" in ins and not _is_link(ins["cfg"]):
            ins["cfg"] = 1


def load_template():
    return json.loads(TEMPLATE.read_text(encoding="utf-8"))


def apply(g, stage, seed=0, template=None):
    if not isinstance(g, dict) or not stage:
        return g, []
    notes = []
    have = [k for k, v in g.items() if "ultimateupscale" in str((v or {}).get("class_type", "")).lower()]
    if have:
        _aim(g, notes, stage)
        notes.append(f"upscale: the graph's own stage ({', '.join(have)}) re-aimed at "
                     f"{stage.get('model')} -> {stage['width']}x{stage['height']}")
        return g, notes
    # the sampler whose latent feeds the VIDEO decode
    samp = None
    for k, v in g.items():
        if str((v or {}).get("class_type", "")) != "SamplerCustomAdvanced":
            continue
        if any(str((g.get(c) or {}).get("class_type", "")) == "VAEDecode" for c, _ in _consumers(g, k, 0)):
            samp = k
    if samp is None:
        notes.append("upscale skipped: no SamplerCustomAdvanced feeding a VAEDecode in this graph")
        return g, notes
    gd = (g[samp].get("inputs") or {}).get("guider")
    guider = g.get(str(gd[0])) if _is_link(gd) else None
    gins = (guider or {}).get("inputs") or {}
    model = gins.get("model")
    cond = gins.get("conditioning", gins.get("positive"))
    if not (_is_link(model) and _is_link(cond)):
        notes.append("upscale skipped: the sampler's guider has no model + conditioning to hand the upscaler")
        return g, notes
    t = copy.deepcopy(template if template is not None else load_template())
    subst = {"@model": list(model), "@conditioning": list(cond), "@latent": [samp, 0]}
    for v in t.values():
        for key, val in list((v.get("inputs") or {}).items()):
            if isinstance(val, str) and val in subst:
                v["inputs"][key] = subst[val]
    cons = _consumers(g, samp, 0)
    ids = {}
    for k, v in t.items():
        nk = k
        while nk in g:
            nk += "_"
        ids[k] = nk
    for k, v in t.items():
        for key, val in list((v.get("inputs") or {}).items()):
            if _is_link(val) and str(val[0]) in ids:
                v["inputs"][key] = [ids[str(val[0])], val[1]]
        g[ids[k]] = v
    up = ids["bgup_upscale"]
    for c, key in cons:
        g[c]["inputs"][key] = [up, 0]
    g[ids["bgup_noise"]]["inputs"]["noise_seed"] = int(seed) & 0xFFFFFFFFFFFF
    _aim(g, notes, stage)
    notes.append(f"upscale: MMH3 Ultimate Upscale spliced after sampler {samp} "
                 f"({stage.get('model')} -> {stage['width']}x{stage['height']}, one refine "
                 f"step at denoise 0.2; {len(cons)} consumer(s) now read the upscaled latent)")
    return g, notes


TAKE_ENCODE = {"tile_size": 512, "overlap": 64, "temporal_size": 64, "temporal_overlap": 8}


def _stages(g):
    return [k for k, v in g.items() if "ultimateupscale" in str((v or {}).get("class_type", "")).lower()]


def from_take(g, video):
    """Feed the upscale stage the rendered take instead of the sampler."""
    if not isinstance(g, dict) or not video:
        return g, ["take upscale skipped: no take to read"]
    ups = _stages(g)
    if not ups:
        return g, ["take upscale skipped: the graph has no upscale stage to feed"]
    vae = None
    for k, v in g.items():
        ct = str((v or {}).get("class_type", ""))
        ins = (v or {}).get("inputs") or {}
        if ct in ("VAEDecode", "VAEDecodeTiled") and _is_link(ins.get("samples")) \
                and str(ins["samples"][0]) in ups and _is_link(ins.get("vae")):
            vae = list(ins["vae"])
            break
    if vae is None:
        vae = next((list(v["inputs"]["vae"]) for v in g.values()
                    if str((v or {}).get("class_type", "")) in ("VAEDecode", "VAEDecodeTiled")
                    and _is_link(((v or {}).get("inputs") or {}).get("vae"))), None)
    if vae is None:
        return g, ["take upscale skipped: no video decode in the graph to borrow its VAE from"]
    ids = {}
    for base in ("bgtake_load", "bgtake_comp", "bgtake_enc"):
        nk = base
        while nk in g:
            nk += "_"
        ids[base] = nk
    g[ids["bgtake_load"]] = {"class_type": "LoadVideo", "inputs": {"file": str(video)},
                             "_meta": {"title": "bitGen: the take to upscale"}}
    g[ids["bgtake_comp"]] = {"class_type": "GetVideoComponents",
                             "inputs": {"video": [ids["bgtake_load"], 0]}}
    g[ids["bgtake_enc"]] = {"class_type": "VAEEncodeTiled",
                            "inputs": {"pixels": [ids["bgtake_comp"], 0], "vae": vae, **TAKE_ENCODE}}
    was = []
    for u in ups:
        ins = g[u].setdefault("inputs", {})
        old = ins.get("latent")
        if _is_link(old):
            was.append(str(old[0]))
        ins["latent"] = [ids["bgtake_enc"], 0]
    left = [w for w in was if not any(str(c) not in ups for c, _ in _consumers(g, w, 0))]
    return g, [f"upscale: the stage reads the TAKE {video} (VAE-encoded, tiled) instead of a new "
               f"sample - the clip you previewed is the clip that gets upscaled"
               + (f"; sampler {', '.join(left)} has nothing left to feed, ComfyUI skips it" if left else "")]
