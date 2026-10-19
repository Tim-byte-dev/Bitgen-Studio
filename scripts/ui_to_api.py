#!/usr/bin/env python3
"""ui_to_api.py — convert a ComfyUI UI export (nodes/links) to an API prompt.

    python3 scripts/ui_to_api.py in_ui.json out_api.json [--drop TYPE ...]

ComfyUI's UI export lists widget VALUES in order but not their NAMES; the
API prompt needs names. Only node types whose widget order is known here are
converted; an unknown type stops the run and names itself, so nothing is
silently mis-wired. PrimitiveNode values are inlined into what they feed;
--drop TYPE removes a pass-through node (e.g. an all-Off LoRA stack) by
reconnecting its inputs straight to its consumers, slot by slot type.

Written for 2.108.1 to bring Tim's SDXL inpaint export (checkpoint + inpaint
UNet + refiner) into comfy_workflows/ without a second export.
"""
import json
import sys

# widget order per node type (UI widgets_values), and which UI-only widgets
# (control_after_generate, upload) do not exist in the API prompt
WIDGETS = {
    "CheckpointLoaderSimple": ["ckpt_name"],
    "UNETLoader": ["unet_name", "weight_dtype"],
    "LoadImage": ["image", "upload"],
    "VAEEncodeForInpaint": ["grow_mask_by"],
    "CLIPTextEncode": ["text"],
    "CLIPTextEncodeSDXL": ["width", "height", "crop_w", "crop_h", "target_width", "target_height", "text_g", "text_l"],
    "CLIPTextEncodeSDXLRefiner": ["ascore", "width", "height", "text"],
    "KSampler": ["seed", "control_after_generate", "steps", "cfg", "sampler_name", "scheduler", "denoise"],
    "KSamplerAdvanced": ["add_noise", "noise_seed", "control_after_generate", "steps", "cfg", "sampler_name",
                         "scheduler", "start_at_step", "end_at_step", "return_with_leftover_noise"],
    "VAEDecode": [], "VAEEncode": [], "SaveImage": ["filename_prefix"], "PreviewImage": [],
    "EmptyLatentImage": ["width", "height", "batch_size"],
    "Get image size": [], "GetImageSize": [], "GetImageSizeAndCount": [],
    "GrowMask": ["expand", "tapered_corners"],
    "LoraLoader": ["lora_name", "strength_model", "strength_clip"],
    "LoraLoaderModelOnly": ["lora_name", "strength_model"],
    # 2.236.0 — YuE2 music (orders read from ComfyUI's own comfy_extras/
    # nodes_yue2.py, nodes_audio.py and nodes_audio_encoder.py schemas, the
    # never-guess rule; brought in for Tim's yue2_full.json export):
    "EmptyYuE2LatentAudio": ["seconds", "batch_size"],
    "YuE2GenerateABC": ["style", "lyrics", "seed", "control_after_generate",
                        "mode", "max_abc_tokens", "temperature", "top_p",
                        "top_k", "repetition_penalty", "penalty_window"],
    "YuE2GenerateMusic": ["style", "lyrics", "abc", "seed",
                          "control_after_generate", "mode", "max_duration",
                          "temperature", "top_p", "top_k", "repetition_penalty"],
    "SheetSage2AudioToABC": ["mode"],
    "AudioEncoderLoader": ["audio_encoder_name"],
    "VAEDecodeAudio": [],
    "VAEDecodeAudioTiled": ["tile_size", "overlap"],
    "SaveAudioAdvanced": ["filename_prefix", "format"],
    "LoadAudio": ["audio", "upload"],
    "PreviewAny": [],
    "Note": [],
}
UI_ONLY = {"control_after_generate", "upload"}
DEFAULTS = {"UNETLoader": {"weight_dtype": "default"},
            # nodes_yue2.py's own defaults for the advanced widgets a UI
            # export omits when the panel was never opened
            "YuE2GenerateABC": {"temperature": 0.7, "top_p": 0.9, "top_k": 30,
                                "repetition_penalty": 1.005, "penalty_window": 100}}


def convert(ui, drop=()):
    nodes = {n["id"]: n for n in ui["nodes"]}
    links = {l[0]: l for l in ui["links"]}          # id -> [id, from, from_slot, to, to_slot, type]
    # primitives: value + the (node, input name) they feed
    prim = {}
    for n in ui["nodes"]:
        if n["type"] == "PrimitiveNode":
            prim[n["id"]] = (n.get("widgets_values") or [None])[0]
    # dropped pass-through nodes: map each of their outputs to the input link of the same type
    redirect = {}                                    # (dropped_id, out_slot) -> (src_id, src_slot)
    for n in ui["nodes"]:
        if n["type"] not in drop:
            continue
        in_by_type = {}
        for i in n.get("inputs", []):
            if i.get("link") is not None:
                l = links[i["link"]]
                in_by_type[l[5]] = (l[1], l[2])
        for si, o in enumerate(n.get("outputs", [])):
            if o.get("type") in in_by_type:
                redirect[(n["id"], si)] = in_by_type[o["type"]]
    out = {}
    unknown = set()
    for n in ui["nodes"]:
        t = n["type"]
        if t == "PrimitiveNode" or t in drop:
            continue
        if t not in WIDGETS:
            unknown.add(t)
            continue
        if n.get("mode") in (2, 4):                  # muted / bypassed in the UI
            continue
        inputs = dict(DEFAULTS.get(t, {}))
        # widgets (by order), skipping UI-only ones — the UI lists them anyway
        names = WIDGETS[t]
        vals = list(n.get("widgets_values") or [])
        vi = 0
        for name in names:
            if vi >= len(vals):
                break
            v = vals[vi]; vi += 1
            if name in UI_ONLY:
                continue
            inputs[name] = v
        # linked inputs (override widgets of the same name)
        for i in n.get("inputs", []):
            lid = i.get("link")
            if lid is None:
                continue
            l = links[lid]
            src, slot = l[1], l[2]
            if src in prim:
                inputs[i["name"]] = prim[src]
                continue
            while (src, slot) in redirect:
                src, slot = redirect[(src, slot)]
            inputs[i["name"]] = [str(src), slot]
        out[str(n["id"])] = {"class_type": t, "inputs": inputs}
    if unknown:
        raise SystemExit("unknown node types (add their widget order to WIDGETS): " + ", ".join(sorted(unknown)))
    return out


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    drop = []
    if "--drop" in sys.argv:
        drop = sys.argv[sys.argv.index("--drop") + 1:]
        args = [a for a in args if a not in drop]
    if len(args) < 2:
        print(__doc__); return 2
    ui = json.load(open(args[0], encoding="utf-8"))
    api = convert(ui, drop=set(drop))
    json.dump(api, open(args[1], "w", encoding="utf-8"), indent=2)
    print(f"wrote {args[1]}: {len(api)} nodes" + (f" (dropped {', '.join(drop)})" if drop else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
