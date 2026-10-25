#!/usr/bin/env python3
"""bitGen Studio — scripts/comfy_regions.py (2.569.0): 🔲 ZONES as regional prompting in ONE ComfyUI pass.

Tim (verbatim): "can we add zones to the image editor - like put 3 boxes on the canvas, and tell the image model to put
kite in this box, dog in this box, bench in this box?"

PURE, like comfy_image.py (which calls apply() at the end of patch() when the job carries `regions`): a patched graph
in, the same graph with one area-conditioned prompt per zone out.

    the sampler's positive conditioning  ─┐
    CLIPTextEncode(zone 1's words) ─ [FluxGuidance] ─ ConditioningSetArea(box 1) ─ ConditioningCombine ─ ...
    CLIPTextEncode(zone 2's words) ─ [FluxGuidance] ─ ConditioningSetArea(box 2) ─ ConditioningCombine ─ the sampler

- Found by input KEYS as everywhere in comfy_image.py: every node with BOTH a positive and a negative link (KSampler,
  CFGGuider ...) gets it on `positive`; a graph with none (FLUX's BasicGuider) gets it on its `conditioning` link.
- The zone's text encoder uses the CLIP the scene's own text node uses (its `clip` link) - the same model.
- A FluxGuidance on the way from the text node to the sampler is copied onto each zone (same guidance), so every
  part of the combined conditioning carries the model's guidance.
- The boxes arrive as fractions of the picture (0..1) and are written in the render's pixels, on a 16-pixel grid
  (a latent patch of FLUX / Qwen is 2x2 latent pixels = 16 image pixels), at least 64 px a side.
ComfyUI's area conditioning is core (no node pack). It is at its best with SD 1.5 / SDXL; FLUX / Qwen Image follow
it more loosely (the zone's prompt runs on its crop of the latent).

2.592.0 🎭 A ZONE CAN CARRY A CHARACTER LoRA (Tim: "lets just add the regional character lora and prompt relay" - from
Winnougan's Nougan_Nodes, MIT, Settings ▸ Add-ons ▸ Nougan Nodes). The zones with a LoRA go to ONE
NouganRegionalCharacterLoRA node instead of area conditioning: LoRA A and LoRA B (two different LoRAs at most), each
masked to its own boxes token by token, the base weights untouched; the node encodes the scene's words over the whole
picture + each box's words inside it. Wired:

    the sampler's model ──> NouganRegionalCharacterLoRA.model ──> (MODEL) every node that took that model
    the scene's CLIP ─────> .clip                                 (CONDITIONING) every node that read the scene's
    regions = {"global": the scene, "regions": [{char a|b, x, y, w, h, text}]}    text encoder (FluxGuidance,
                                                                                  ReferenceLatent ...) - not the
                                                                                  ConditioningZeroOut negative
The zones without a LoRA still get area conditioning on top. The node's NEGATIVE output is not used (the graph keeps
its own). It assumes a 2x2 latent patch with the text tokens before the picture's (FLUX.2 / Krea 2 / Qwen Image type
models); a LoRA whose layer names do not match the model changes nothing (ComfyUI's console says "0 layers matched").
"""

import json

from comfy_image import PatchError, _ins, _is_link, _next_id, comfy_lora_name, find_text_node, prompt_key, upstream

GRID = 16
MIN_SIDE = 64
MAX_ZONES = 8
CHAR_NODE = "NouganRegionalCharacterLoRA"          # 2.592.0: Nougan_Nodes (nougan_regional_lora.py)
CHAR_FEATHER = 0.06                                # the node's own default (the LoRA masks' soft edge, 0..0.3)
MAX_CHAR_LORAS = 2                                 # the node has LoRA A and LoRA B


def _snap(v, grid=GRID):
    return int(round(float(v) / grid)) * grid


def area_px(region, width, height):
    """A zone {x, y, w, h} (fractions) -> {x, y, width, height} in the render's pixels (16-px grid, inside the picture)."""
    W, H = int(width), int(height)
    x0 = max(0.0, min(1.0, float(region.get("x", 0)))) * W
    y0 = max(0.0, min(1.0, float(region.get("y", 0)))) * H
    x1 = max(0.0, min(1.0, float(region.get("x", 0)) + float(region.get("w", 0)))) * W
    y1 = max(0.0, min(1.0, float(region.get("y", 0)) + float(region.get("h", 0)))) * H
    w = max(MIN_SIDE, _snap(x1 - x0))
    h = max(MIN_SIDE, _snap(y1 - y0))
    w, h = min(w, _snap(W) or W), min(h, _snap(H) or H)
    x = max(0, min(_snap(x0), W - w))
    y = max(0, min(_snap(y0), H - h))
    return {"x": int(x), "y": int(y), "width": int(w), "height": int(h)}


def targets(graph):
    """Where the combined conditioning goes: [(node id, input key)]."""
    out = [(nid, "positive") for nid, n in graph.items()
           if _is_link(_ins(n).get("positive")) and _is_link(_ins(n).get("negative"))]
    if not out:
        out = [(nid, "conditioning") for nid, n in graph.items()
               if _is_link(_ins(n).get("conditioning")) and "guider" in str(n.get("class_type") or "").lower()]
    return out


def encoder(graph, start, depth=0, seen=None):
    """The text ENCODER node behind a conditioning link (the first node upstream with a `clip` link) - not the
    Primitive that may hold its words (comfy_image.find_text_node stops there)."""
    seen = seen if seen is not None else set()
    if start is None or start in seen or depth > 10:
        return None
    seen.add(start)
    ins = _ins(graph.get(start) or {})
    if _is_link(ins.get("clip")):
        return start
    keys = ["conditioning"] + [k for k in ins if k != "conditioning"]
    for k in keys:
        if _is_link(ins.get(k)):
            hit = encoder(graph, ins[k][0], depth + 1, seen)
            if hit:
                return hit
    return None


def _guidance_on_path(graph, start, text_nid):
    """The FluxGuidance value between the sampler's conditioning and its text node (None = there is none)."""
    nid, seen = start, set()
    while nid and nid not in seen and nid != text_nid:
        seen.add(nid)
        n = graph.get(nid) or {}
        if str(n.get("class_type") or "") == "FluxGuidance":
            g = _ins(n).get("guidance")
            return g if not _is_link(g) else 3.5
        nid = upstream(graph, nid, "conditioning")
    return None


def _same(v, link):
    return _is_link(v) and str(v[0]) == str(link[0]) and int(v[1]) == int(link[1])


def _rewire(graph, old, new, skip=(), keep_classes=()):
    """every input that reads `old` reads `new` instead (not in `skip` nodes / `keep_classes`) -> how many"""
    n = 0
    for nid, node in graph.items():
        if nid in skip or str(node.get("class_type") or "") in keep_classes:
            continue
        for k, v in list(_ins(node).items()):
            if _same(v, old):
                node["inputs"][k] = list(new)
                n += 1
    return n


def char_names(zones):
    """the different character LoRAs of the zones, in order (as ComfyUI lists them)"""
    out = []
    for z in zones or []:
        n = comfy_lora_name(str((z or {}).get("lora") or "").strip()) if str((z or {}).get("lora") or "").strip() else ""
        if n and n not in out:
            out.append(n)
    return out


def characters(graph, zones):
    """2.592.0: the zones with a `lora` -> one NouganRegionalCharacterLoRA node. -> (graph, report, the other zones)."""
    cz = [z for z in zones if str(z.get("lora") or "").strip()]
    rest = [z for z in zones if not str(z.get("lora") or "").strip()]
    if not cz:
        return graph, [], zones
    names = char_names(cz)
    if len(names) > MAX_CHAR_LORAS:
        raise PatchError(f"🎭 regional character LoRAs: {MAX_CHAR_LORAS} different character LoRAs at most in one picture "
                         f"(the node has LoRA A and LoRA B) - these boxes name {len(names)}: " + ", ".join(names))
    tg = targets(graph)
    if not tg:
        raise PatchError("🎭 regional character LoRAs: this workflow has no sampler conditioning (no node with positive + "
                         "negative, no guider)")
    nid, key = tg[0]
    src = _ins(graph[nid])[key]
    enc = encoder(graph, src[0])
    clip = _ins(graph.get(enc, {})).get("clip") if enc else None
    if not _is_link(clip):
        raise PatchError("🎭 regional character LoRAs: the prompt's text encoder has no CLIP input "
                         f"(node {enc or '?'}) - pick a style whose workflow uses a CLIP text encode")
    # the model the sampler / guider renders with (after the style's LoRAs)
    model = None
    for tid, _k in tg:
        m = _ins(graph[tid]).get("model")
        if _is_link(m):
            model = list(m)
            break
    if model is None:
        for node in graph.values():
            m, ct = _ins(node).get("model"), str(node.get("class_type") or "").lower()
            if _is_link(m) and ("guider" in ct or "sampler" in ct):
                model = list(m)
                break
    if model is None:
        raise PatchError("🎭 regional character LoRAs: no sampler / guider with a model input in this workflow")
    # the scene's words (the encoder's own, or the Primitive that holds them)
    tnode = find_text_node(graph, enc)
    tins = _ins(graph.get(tnode, {})) if tnode else {}
    pk = prompt_key(graph.get(tnode, {})) if tnode else None
    scene = tins.get(pk) if pk else tins.get("value")
    scene = scene if isinstance(scene, str) else ""
    strength = {}
    for z in cz:
        n = comfy_lora_name(str(z["lora"]).strip())
        if n not in strength:
            try:
                strength[n] = max(-4.0, min(4.0, float(z.get("lora_strength") if z.get("lora_strength") is not None else 1.0)))
            except (TypeError, ValueError):
                strength[n] = 1.0
    regions = []
    for z in cz:
        n = comfy_lora_name(str(z["lora"]).strip())
        regions.append({"char": "a" if n == names[0] else "b", "x": float(z.get("x", 0)), "y": float(z.get("y", 0)),
                        "w": float(z.get("w", 0.5)), "h": float(z.get("h", 1)), "text": str(z.get("text") or "").strip()[:600]})
    # an EDIT model's encoder takes the picture too (Qwen Image Edit's TextEncodeQwenImageEdit*: clip + image + vae) -
    # its conditioning carries the reference, so it stays: only the node's MODEL is used, and the boxes' words go on as
    # area conditioning like the other zones
    keep_cond = any(_is_link(v) and any(w in k.lower() for w in ("image", "vae", "latent", "pixels"))
                    for k, v in _ins(graph[enc]).items())
    cid = _next_id(graph)
    graph[cid] = {"class_type": CHAR_NODE, "_meta": {"title": "🎭 regional character LoRAs"}, "inputs": {
        "model": list(model), "clip": list(clip),
        "lora_a": names[0], "strength_a": strength[names[0]],
        "lora_b": names[1] if len(names) > 1 else names[0], "strength_b": strength[names[1]] if len(names) > 1 else 0.0,
        "feather": CHAR_FEATHER, "regions": json.dumps({"global": scene, "regions": regions}, ensure_ascii=False)}}
    _rewire(graph, model, [cid, 0], skip=(cid,))
    if not keep_cond:
        _rewire(graph, [enc, 0], [cid, 1], skip=(cid,), keep_classes=("ConditioningZeroOut",))
    report = [f"🎭 regional character LoRAs ({CHAR_NODE}, node {cid}): " + "; ".join(
        f"LoRA {'A' if i == 0 else 'B'} {n} @ {strength[n]:g} in box(es) "
        + ", ".join(str(j + 1) for j, z in enumerate(zones) if z in cz and comfy_lora_name(str(z['lora']).strip()) == n)
        for i, n in enumerate(names)) + (" - the scene's words over the whole picture" if scene and not keep_cond else "")
        + (f" - the edit model's own encoder ({graph[enc].get('class_type')}) keeps the picture; the boxes' words go on as area prompts" if keep_cond else "")]
    return graph, report, (zones if keep_cond else rest)


def apply(graph, regions, width, height):
    """-> (graph, report lines). regions = [{x, y, w, h, text, strength?, lora?, lora_strength?}] (fractions of the
    picture). 2.592.0: the zones with a character LoRA go to the 🎭 regional character LoRA node (characters())."""
    zones = [r for r in (regions or []) if str((r or {}).get("text") or "").strip()][:MAX_ZONES]
    if not zones:
        return graph, []
    if not width or not height:
        raise PatchError("regional prompting needs the picture's width and height")
    tg = targets(graph)
    if not tg:
        raise PatchError("regional prompting: this workflow has no sampler conditioning to add the zones to "
                         "(no node with positive + negative, no guider)")
    graph, report, zones = characters(graph, zones)
    if not zones:
        return graph, report
    done = {}                                        # the original conditioning link -> the combined link
    for nid, key in tg:
        src = _ins(graph[nid])[key]
        k = (str(src[0]), int(src[1]))
        if k in done:
            graph[nid]["inputs"][key] = list(done[k])
            continue
        text_nid = encoder(graph, src[0]) or find_text_node(graph, src[0])
        clip = _ins(graph.get(text_nid, {})).get("clip") if text_nid else None
        if not _is_link(clip):
            raise PatchError("regional prompting: the prompt's text encoder has no CLIP input to share with the zones "
                             f"(node {text_nid or '?'}) - pick a style whose workflow uses a CLIP text encode")
        guide = _guidance_on_path(graph, src[0], text_nid)
        cur = list(src)
        for i, z in enumerate(zones):
            a = area_px(z, width, height)
            t_id = _next_id(graph)
            graph[t_id] = {"class_type": "CLIPTextEncode", "inputs": {"text": str(z["text"]).strip()[:600], "clip": list(clip)},
                           "_meta": {"title": f"zone {i + 1}"}}
            c_link = [t_id, 0]
            if guide is not None:
                g_id = _next_id(graph)
                graph[g_id] = {"class_type": "FluxGuidance", "inputs": {"conditioning": c_link, "guidance": guide},
                               "_meta": {"title": f"zone {i + 1} guidance"}}
                c_link = [g_id, 0]
            a_id = _next_id(graph)
            strength = max(0.1, min(2.0, float(z.get("strength") or 1.0)))
            graph[a_id] = {"class_type": "ConditioningSetArea",
                           "inputs": dict(conditioning=c_link, width=a["width"], height=a["height"], x=a["x"], y=a["y"], strength=strength),
                           "_meta": {"title": f"zone {i + 1} area"}}
            m_id = _next_id(graph)
            graph[m_id] = {"class_type": "ConditioningCombine", "inputs": {"conditioning_1": cur, "conditioning_2": [a_id, 0]},
                           "_meta": {"title": f"zone {i + 1} combine"}}
            cur = [m_id, 0]
            report.append(f"zone {i + 1}: \"{str(z['text']).strip()[:40]}\" at {a['x']},{a['y']} {a['width']}x{a['height']}"
                          + (f" (guidance {guide})" if guide is not None else ""))
        done[k] = cur
        graph[nid]["inputs"][key] = list(cur)
    return graph, report
