#!/usr/bin/env python3
"""Patch an exported ComfyUI workflow to render one image style.

PURE: no network, no filesystem, no ComfyUI. Give it a graph and a style, get a
graph back. That is what makes it testable (scripts/test-comfyimage.py) without
a GPU, without ComfyUI running, and without any model on disk.

=======================================================================
WHY IT MATCHES ON INPUT KEYS AND NOT ON CLASS NAMES
=======================================================================
The expensive lesson in this project's history (see the 2.12.x notes in
HANDOVER.md) is that hand-written assumptions about ComfyUI CLASS NAMES rot.
A whole node pack was targeted, then turned out to be the wrong tree entirely;
widget names were guessed and had to be learned back from error logs.

Input KEY names are a different kind of thing. `ckpt_name`, `unet_name`,
`vae_name`, `clip_name1`, `seed`, `steps`, `cfg`, `width`, `height`,
`batch_size`, `text`, `positive`, `negative`, `latent_image`, `model` are the
vocabulary of ComfyUI's core graph format and have been stable for years,
across every sampler variant and every new architecture. A node that has a
`seed` input is a node that takes a seed, whatever it calls itself and whoever
wrote it.

So: this module never asks "is this a KSampler". It asks "which nodes have a
seed", "which node feeds the sampler's latent_image", "what is upstream of the
positive conditioning". That works on an SDXL graph, a FLUX graph that splits
sampling across RandomNoise + BasicScheduler + SamplerCustomAdvanced, and on
architectures that do not exist yet.

WHAT IT REFUSES TO GUESS: which of two text nodes is the negative prompt, when
the graph gives no structural answer. Getting that backwards renders the
negative prompt as the subject and looks like a model problem, not a bug — so
it raises with the node ids instead. Loud beats plausible.
"""
import json
import random
import os

# ---------------------------------------------------------------- vocabulary
SEED_KEYS = ("seed", "noise_seed")
# Where THE PROMPT goes. `text` is every image text-encode node; `lyrics` is
# the MiniMax Music3 text encode (2.90.0), whose words-of-the-song input is
# exactly what a prompt is for a music style. Order is preference: a node that
# somehow had both would get the prompt in `text`.
# `text_g` is CLIPTextEncodeSDXL's pooled prompt; `text_l` is mirrored from it
# when the prompt is written (2.108.1, Tim's SDXL inpaint export).
PROMPT_KEYS = ("text", "lyrics", "text_g")
# The music STYLE's text (genre, BPM, key, mood, vocal, arrangement). Written
# from the style, not the prompt, so one caption serves many songs.
CAPTION_KEYS = ("caption",)
# Seconds of audio. `max_duration` is the Music3 text encode; `seconds` is
# ComfyUI's Empty*LatentAudio widget when a graph sets it literally rather than
# wiring it from the encode's length output.
DURATION_KEYS = ("max_duration", "seconds")
# Sampler/scheduler widgets on the sampler node. Only a MUSIC style writes
# these: image styles carry sd-cli sampler names ("dpm++2m"), which are not
# ComfyUI's, so for an image the template's own choice stands as it always did.
SAMPLER_KEYS = ("sampler_name",)
SCHEDULER_KEYS = ("scheduler",)
# Inclusive ceiling for a rolled seed. MUST stay in step with MAX_SEED in
# lib/imageSeed.js, which is where the seed for a real render now comes from —
# see the long note at the roll below for why the range is this and not int64.
SEED_MAX = 2**32 - 1
SIZE_KEYS = ("width", "height")
# Loader inputs, by what they load. Order matters for the te list: a graph with
# clip_name1/clip_name2 takes text encoder 1 and 2 in that order.
MODEL_KEYS = ("unet_name", "ckpt_name", "model_name", "model_path")
VAE_KEYS = ("vae_name",)
TE_KEYS = ("clip_name", "clip_name1", "clip_name2", "clip_name3", "t5_name")


class PatchError(Exception):
    """Something the user has to fix, described in their terms."""


def _is_link(v):
    """ComfyUI links are [node_id, output_slot]."""
    return isinstance(v, list) and len(v) == 2 and isinstance(v[1], int)


def _ins(node):
    return node.get("inputs") or {}


def nodes_with(graph, key):
    """Node ids whose inputs carry `key` as a VALUE (a widget), not a link."""
    return [nid for nid, n in graph.items()
            if key in _ins(n) and not _is_link(_ins(n)[key])]


def nodes_linking(graph, key):
    """Node ids whose inputs carry `key` as a LINK to another node."""
    return [nid for nid, n in graph.items()
            if key in _ins(n) and _is_link(_ins(n)[key])]


def upstream(graph, nid, key):
    """The node id feeding `nid`'s `key` input, or None."""
    v = _ins(graph.get(nid, {})).get(key)
    return v[0] if _is_link(v) else None


def is_primitive(node):
    """A ComfyUI Primitive* node, whose `value` widget IS the widget.

    ComfyUI's frontend produces these whenever a widget is promoted to an input
    and driven from a shared node: PrimitiveStringMultiline for a prompt reused
    by two encoders, PrimitiveInt for a width fed to both the scheduler and the
    latent. The consuming node then holds a LINK where a literal used to be, and
    every writer here that checks `not _is_link(...)` correctly skips it — so
    the prompt, or the size, silently stays as the template had it.

    That is exactly what Tim's flux2 text-to-image export does, and it failed
    loudly (no prompt node at all) rather than quietly, which is the only reason
    it was caught. Following the link one hop to the primitive is the fix, and
    it is narrow ON PURPOSE: only a Primitive* node holding a literal counts.
    Anything else upstream of a width — GetImageSize in the image-edit graph, a
    maths node, another sampler — is COMPUTED, and overwriting a computed value
    would resize somebody's photo or worse.
    """
    ins = _ins(node)
    return (str((node or {}).get("class_type") or "").startswith("Primitive")
            and "value" in ins and not _is_link(ins["value"]))


def widget_key(graph, nid, name):
    """Where to WRITE `name` on this node: its own widget, or a primitive's value.

    Returns None when the value is computed and must be left alone.
    """
    node = graph.get(nid)
    if node is None:
        return None
    ins = _ins(node)
    if name in ins and not _is_link(ins[name]):
        return name
    if is_primitive(node):
        return "value"
    return None


def prompt_key(node):
    """The widget on `node` that takes the prompt, or None.

    `text` on the image encoders, `lyrics` on the Music3 encoder — see
    PROMPT_KEYS. A link is not a widget: a prompt driven from a Primitive is
    handled by is_primitive()/widget_key(), not here.
    """
    ins = _ins(node or {})
    for k in PROMPT_KEYS:
        if k in ins and not _is_link(ins[k]):
            return k
    return None


def find_text_node(graph, start, depth=0, seen=None):
    """Walk upstream from a conditioning link until a node with a text widget.

    Conditioning is rarely one node: FLUX runs CLIPTextEncode -> FluxGuidance,
    and many templates add ConditioningZeroOut, ConditioningSetTimestepRange or
    a style model in between. Following the chain is what makes those work
    without naming any of them.
    """
    if start is None or depth > 12:
        return None
    seen = seen or set()
    if start in seen:
        return None
    seen.add(start)
    node = graph.get(start)
    if node is None:
        return None
    ins = _ins(node)
    if prompt_key(node):
        return start
    # a prompt promoted to a shared PrimitiveStringMultiline is still the prompt
    if is_primitive(node) and isinstance(ins.get("value"), str):
        return start
    for k, v in ins.items():
        if _is_link(v):
            hit = find_text_node(graph, v[0], depth + 1, seen)
            if hit:
                return hit
    return None


def roles(graph):
    """Everything this module needs to know about a graph, discovered.

    Returns a dict; every entry may be None/empty, because a template can
    legitimately lack one (no negative prompt on a distilled model, no separate
    VAE loader on a full checkpoint). The CALLER decides what is fatal.
    """
    r = {"sampler": None, "positive": None, "negative": None, "latent": None,
         "seed": [], "steps": [], "cfg": [], "model_src": None, "clip_src": None,
         "save": [], "save_audio": [], "loaders": {}, "ambiguous_text": [],
         "size_nodes": [], "lora_nodes": [], "image_slots": [],
         "zeroed_negative": False}

    # The sampler is whatever takes BOTH a positive and a negative conditioning.
    # A REFINER graph has two (base + refiner) fed by separate text nodes; the
    # first is the primary, all of them get the prompt (2.108.1).
    r["samplers"] = []
    for nid, n in graph.items():
        ins = _ins(n)
        if _is_link(ins.get("positive")) and _is_link(ins.get("negative")):
            r["samplers"].append(nid)
            if r["sampler"] is None:
                r["sampler"] = nid

    if r["sampler"]:
        s = r["sampler"]
        r["positive"] = find_text_node(graph, upstream(graph, s, "positive"))
        r["negative"] = find_text_node(graph, upstream(graph, s, "negative"))
        r["latent"] = upstream(graph, s, "latent_image")
        r["model_src"] = upstream(graph, s, "model")
        # A DISTILLED GRAPH HAS NO REAL NEGATIVE PROMPT. ComfyUI's own FLUX.2
        # Klein template feeds the POSITIVE text node through ConditioningZeroOut
        # and calls the result "negative", so both conditioning inputs trace back
        # to the SAME text node. Writing a negative prompt there would overwrite
        # the actual prompt with "blurry, low quality" and render that instead —
        # silent, total, and it looks like the model ignoring you.
        if r["negative"] is not None and r["negative"] == r["positive"]:
            r["negative"] = None
            r["zeroed_negative"] = True
    else:
        # No positive/negative pair: the guider shape (FLUX and friends), where
        # there is one conditioning input and no negative at all.
        for key in ("conditioning", "guider", "positive"):
            hits = nodes_linking(graph, key)
            if hits:
                r["positive"] = find_text_node(graph, upstream(graph, hits[0], key))
                r["model_src"] = r["model_src"] or upstream(graph, hits[0], "model")
                break
        if r["positive"] is None:
            texts = []
            for pk in PROMPT_KEYS:
                texts += [n for n in nodes_with(graph, pk) if n not in texts]
            if len(texts) == 1:
                r["positive"] = texts[0]
            elif len(texts) > 1:
                r["ambiguous_text"] = sorted(texts)
        for nid in nodes_linking(graph, "latent_image"):
            r["latent"] = r["latent"] or upstream(graph, nid, "latent_image")

    # A latent not reachable through the sampler node itself. The FLUX.2 shape
    # puts positive/negative on a CFGGuider and latent_image on the separate
    # SamplerCustomAdvanced, so "the sampler" and "the thing holding the latent"
    # are two different nodes and the walk above finds nothing.
    if not r["latent"]:
        for nid in nodes_linking(graph, "latent_image"):
            r["latent"] = upstream(graph, nid, "latent_image")
            if r["latent"]:
                break

    # EVERY node that describes an image size, not just the latent. Flux2Scheduler
    # takes width/height as well and uses them to shift its sigmas: leaving it at
    # 1024x1024 while the latent renders 768x1024 is not an error, it just
    # quietly degrades the result. Size goes everywhere the graph asks for one.
    r["size_nodes"] = [nid for nid in nodes_with(graph, "width")
                       if "height" in _ins(graph[nid])
                       and not _is_link(_ins(graph[nid])["height"])]
    # The latent counts as a size node only if its size is a WIDGET. In the
    # image-edit graph width/height are LINKS from GetImageSize, because an edit
    # keeps the source picture's dimensions — writing the style's size over that
    # would silently resize somebody's photo.
    lat = _ins(graph.get(r["latent"], {})) if r["latent"] else {}
    if (r["latent"] and r["latent"] not in r["size_nodes"]
            and "width" in lat and not _is_link(lat["width"])):
        r["size_nodes"].append(r["latent"])

    # ...and a size promoted to a shared PrimitiveInt is still a size. The
    # text-to-image flux2 export drives BOTH the scheduler and the latent from
    # one Primitive per dimension, so every size writer above skips them and the
    # render silently comes back 1024x1024 whatever the UI asked for. Only a
    # Primitive counts: width linked from GetImageSize (the image-edit graph)
    # is computed from the source picture and must stay that way.
    r["size_prims"] = {}
    for dim in SIZE_KEYS:
        for nid in nodes_linking(graph, dim):
            src = upstream(graph, nid, dim)
            if src and is_primitive(graph.get(src)) \
                    and isinstance(_ins(graph[src]).get("value"), int):
                r["size_prims"].setdefault(dim, [])
                if src not in r["size_prims"][dim]:
                    r["size_prims"][dim].append(src)

    # LoRA nodes the WORKFLOW already carries (bitGen Studio's shipped templates
    # bundle four). These are filled in from the style and the leftovers are
    # bypassed; only a style with more LoRAs than slots builds new ones.
    r["lora_nodes"] = lora_chain(graph)
    r["image_slots"] = image_slots(graph)

    for key in SEED_KEYS:
        r["seed"] += nodes_with(graph, key)
    r["steps"] = nodes_with(graph, "steps")
    r["cfg"] = nodes_with(graph, "cfg")
    # Music vocabulary (2.90.0). Empty on every image graph, and harmless there:
    # patch() only writes these when the style carries a value for them.
    r["caption"] = []
    for key in CAPTION_KEYS:
        r["caption"] += nodes_with(graph, key)
    r["duration"] = []
    for key in DURATION_KEYS:
        r["duration"] += [n for n in nodes_with(graph, key) if n not in r["duration"]]
    r["sampler_widgets"] = []
    for key in SAMPLER_KEYS + SCHEDULER_KEYS:
        r["sampler_widgets"] += [n for n in nodes_with(graph, key)
                                 if n not in r["sampler_widgets"]]

    # The CLIP source, needed to wire a LoRA's clip output back in.
    for nid in nodes_linking(graph, "clip"):
        r["clip_src"] = upstream(graph, nid, "clip")
        break

    # The model source, if the sampler/guider walk above did not find it. A
    # guider node carries the conditioning but not always the model (FLUX puts
    # the model on BasicGuider AND on BasicScheduler), so the general answer is
    # "whoever anybody takes a model from".
    if not r["model_src"]:
        for nid in nodes_linking(graph, "model"):
            r["model_src"] = upstream(graph, nid, "model")
            if r["model_src"]:
                break

    for nid, n in graph.items():
        ct = str(n.get("class_type") or "")
        if "SaveImage" in ct or "PreviewImage" in ct or "SaveAnimated" in ct:
            r["save"].append(nid)
        # Audio sinks: SaveAudio, SaveAudioMP3/Opus, SaveAudioAdvanced,
        # PreviewAudio. A music graph ends in one of these and in no SaveImage,
        # which is why "never saves" has to know about both kinds.
        elif "SaveAudio" in ct or "PreviewAudio" in ct:
            r["save_audio"].append(nid)

    # Loader widgets, grouped by what they load, so a style can override them.
    for nid, n in graph.items():
        for k in _ins(n):
            if _is_link(_ins(n)[k]):
                continue
            if k in MODEL_KEYS:
                r["loaders"].setdefault("model", []).append((nid, k))
            elif k in VAE_KEYS:
                r["loaders"].setdefault("vae", []).append((nid, k))
            elif k in TE_KEYS:
                r["loaders"].setdefault("te", []).append((nid, k))
    # te slots in a stable order: by node id, then by key name, so clip_name1
    # comes before clip_name2 and slot 1 of the style always means the same one.
    for kind in r["loaders"]:
        r["loaders"][kind].sort(key=lambda p: (int(p[0]) if p[0].isdigit() else 1 << 30, p[1]))
    return r


def _next_id(graph):
    used = [int(k) for k in graph if str(k).isdigit()]
    return str((max(used) if used else 0) + 1)


def comfy_name(p):
    """Any model path as ComfyUI names it in its dropdowns.

    ComfyUI's value is the path RELATIVE TO ITS OWN folder for that kind, with
    the extension and any subfolder kept, and with FORWARD SLASHES
    ("flux_klein_9B/model.safetensors"). Its combo validation is an exact string
    match, so a Windows-style backslash in a subfolder name is rejected outright:

        node 70: Value not in list [unet_name] =
          flux_klein_9B\\aisha....safetensors
          ... not in (list of length 24)

    That is a REAL failure this project hit in 2.72.0, with the file sitting
    exactly where it should be. It only bites names with a SUBFOLDER — a model
    loose in the root has no separator to get wrong — which is why it survived
    so long. Applied to every loader value, not just LoRAs: model, VAE and text
    encoder overrides are written into the graph verbatim and are just as
    capable of carrying a backslash in from a hand-typed style.
    """
    return str(p or "").strip().replace("\\", "/").lstrip("/")


def comfy_lora_name(p):
    """A style's LoRA entry as ComfyUI names it. See comfy_name()."""
    return comfy_name(p)


def is_lora_node(node):
    return "loraloader" in str((node or {}).get("class_type") or "").lower()


def lora_chain(graph):
    """Existing LoRA nodes, ordered so the first is nearest the model loader.

    Ordered by walking each node's `model` input: a node whose model comes from
    another LoRA node sits after it. Ordering matters because slot 1 of the
    style has to mean the same node every time.
    """
    loras = [nid for nid, n in graph.items() if is_lora_node(n)]
    if len(loras) < 2:
        return loras
    depth = {}
    for nid in loras:
        d, cur, guard = 0, nid, 0
        while guard < 50:
            guard += 1
            up = upstream(graph, cur, "model")
            if up is None or not is_lora_node(graph.get(up)):
                break
            d += 1
            cur = up
        depth[nid] = d
    return sorted(loras, key=lambda n: (depth[n], int(n) if n.isdigit() else 1 << 30))


def bypass_node(graph, nid, pairs):
    """Remove `nid`, reconnecting each (output_slot, input_key) straight through.

    This is what "bypass" means in ComfyUI's own UI (Ctrl+B): the node stops
    existing and whatever it was passing through carries on. For a LoraLoader
    that is output 0 -> its own `model` input and output 1 -> its own `clip`.
    """
    node = graph.get(nid)
    if node is None:
        return graph
    ins = _ins(node)
    for slot, key in pairs:
        src = ins.get(key)
        for other in graph.values():
            oins = _ins(other)
            for k, v in list(oins.items()):
                if _is_link(v) and v[0] == nid and v[1] == slot:
                    if _is_link(src) or src is None:
                        oins[k] = src
    graph.pop(nid, None)
    return graph


def apply_loras(graph, loras, r=None):
    """Fill the workflow's LoRA slots from the style; bypass the rest.

    bitGen Studio's shipped templates carry FOUR LoraLoader nodes so a stack can be
    used without editing the graph in ComfyUI. A slot with no LoRA name is
    BYPASSED — removed with its model/clip passed straight through — because an
    empty lora_name is not a no-op in ComfyUI: it fails validation outright.

    A style with more LoRAs than the workflow has slots gets extra nodes built,
    so a hand-exported workflow with no LoRA nodes at all still works.
    """
    live = [l for l in (loras or []) if comfy_lora_name((l or {}).get("path"))]
    r = r or roles(graph)
    slots = list(r.get("lora_nodes") or [])
    report = []

    # 1. fill the slots the workflow already has
    for nid, l in zip(slots, live):
        w = l.get("weight")
        w = 1.0 if w is None or w == "" else float(w)
        ins = graph[nid]["inputs"]
        ins["lora_name"] = comfy_lora_name(l.get("path"))
        ins["strength_model"] = w
        if "strength_clip" in ins:
            ins["strength_clip"] = w
        report.append((nid, ins["lora_name"], w, "slot"))

    # 2. bypass every slot the style did not fill. An unused LoRA node left in
    #    the graph is not harmless: ComfyUI rejects an empty lora_name.
    for nid in slots[len(live):]:
        bypass_node(graph, nid, [(0, "model"), (1, "clip")])
        report.append((nid, None, None, "bypassed"))

    # 3. more LoRAs than slots: build the extras onto the end of the chain
    extra = live[len(slots):]
    if extra:
        graph, built = build_loras(graph, extra, roles(graph))
        report += [(nid, name, w, "built") for nid, name, w in built]
    return graph, report


def build_loras(graph, loras, r):
    """Create LoraLoader nodes in front of the model (and CLIP, when present)."""
    live = [l for l in (loras or []) if comfy_lora_name((l or {}).get("path"))]
    if not live:
        return graph, []
    if not r["model_src"]:
        raise PatchError(
            "this workflow's sampler has no model input that could be traced, so "
            "the LoRA stack cannot be wired in. Remove the LoRAs from the style, "
            "or bake them into the workflow in ComfyUI and re-export it.")

    clip_src = r["clip_src"]
    model_link = None
    for nid in nodes_linking(graph, "model"):
        model_link = _ins(graph[nid])["model"]
        break
    clip_link = None
    for nid in nodes_linking(graph, "clip"):
        clip_link = _ins(graph[nid])["clip"]
        break

    added = []
    cur_model, cur_clip = model_link, clip_link
    for l in live:
        nid = _next_id(graph)
        name = comfy_lora_name(l.get("path"))
        w = l.get("weight")
        w = 1.0 if w is None or w == "" else float(w)
        if clip_src and cur_clip:
            graph[nid] = {"class_type": "LoraLoader",
                          "inputs": {"model": cur_model, "clip": cur_clip,
                                     "lora_name": name,
                                     "strength_model": w, "strength_clip": w}}
            cur_model, cur_clip = [nid, 0], [nid, 1]
        else:
            # No CLIP in this graph (or none reachable): the model-only loader
            # is the right node rather than inventing a clip link that would
            # fail validation.
            graph[nid] = {"class_type": "LoraLoaderModelOnly",
                          "inputs": {"model": cur_model, "lora_name": name,
                                     "strength_model": w}}
            cur_model = [nid, 0]
        added.append((nid, name, w))

    # Rewire every consumer of the ORIGINAL model/clip link to the end of the
    # chain. Done last so the loaders themselves are not rewired to their own
    # output — an easy way to build a graph that validates and then hangs.
    for cid, n in graph.items():
        if cid in {a[0] for a in added}:
            continue
        ins = _ins(n)
        if _is_link(ins.get("model")) and ins["model"] == model_link:
            ins["model"] = cur_model
        if clip_link and _is_link(ins.get("clip")) and ins["clip"] == clip_link:
            ins["clip"] = cur_clip
    return graph, added


def image_slots(graph):
    """LoadImage nodes, in id order. Slot 1 is the image being edited."""
    return sorted([nid for nid, n in graph.items()
                   if "loadimage" in str(n.get("class_type") or "").lower()],
                  key=lambda n: int(n) if n.isdigit() else 1 << 30)


def _consumers(graph, nid):
    out = []
    for cid, n in graph.items():
        for v in _ins(n).values():
            if _is_link(v) and v[0] == nid:
                out.append(cid)
                break
    return out


def _downstream(graph, nid, depth=0, seen=None):
    seen = seen if seen is not None else set()
    if depth > 30:
        return seen
    for cid in _consumers(graph, nid):
        if cid in seen:
            continue
        seen.add(cid)
        _downstream(graph, cid, depth + 1, seen)
    return seen


def prune_orphans(graph, candidates):
    """Drop nodes from `candidates` that nothing consumes and that produce no
    output of their own. Repeated to a fixpoint, because removing one node can
    orphan the one that fed it."""
    changed = True
    while changed:
        changed = False
        for nid in list(candidates):
            if nid not in graph:
                continue
            ct = str(graph[nid].get("class_type") or "")
            if "SaveImage" in ct or "PreviewImage" in ct:
                continue
            if not _consumers(graph, nid):
                graph.pop(nid, None)
                changed = True
    return graph


def bypass_image_slot(graph, load_nid):
    """Remove an unused reference-image slot and everything that existed only
    to serve it.

    A LoadImage cannot be passed through the way a LoraLoader can — it has no
    input to reconnect. What CAN be passed through is the conditioning chain it
    was injected into: each ReferenceLatent on the chain carries a
    `conditioning` input and emits conditioning, so bypassing it hands the
    upstream conditioning straight to whoever was listening. Once those are
    gone, the VAEEncode / ImageScaleToTotalPixels / LoadImage behind them feed
    nothing and are pruned.

    Leaving the slot in place is not an option: an empty `image` fails
    ComfyUI's validation exactly like an empty lora_name does.
    """
    branch = _downstream(graph, load_nid)
    for nid in sorted(branch, key=lambda n: int(n) if n.isdigit() else 0):
        if nid in graph and _is_link(_ins(graph[nid]).get("conditioning")):
            bypass_node(graph, nid, [(0, "conditioning")])
    prune_orphans(graph, branch | {load_nid})
    graph.pop(load_nid, None)
    # 2.337.0: an OPTIONAL autogrow input (Qwen Image 2.1's images.image_N)
    # takes the picture directly - no conditioning chain to bypass. The
    # dangling key is dropped (ComfyUI rejects a link to a node that is gone;
    # an absent optional input is simply unused).
    for n in graph.values():
        ins = _ins(n)
        for k in [k for k, v in ins.items() if "." in k and _is_link(v) and v[0] not in graph]:
            ins.pop(k, None)
    return graph


def slots_optional(graph, slots):
    """2.340.0: True when every LoadImage slot feeds ONLY optional autogrow
    inputs (dotted keys like images.image_3) - the workflow renders without
    any picture (Qwen Image 2.1: text-to-image)."""
    if not slots:
        return False
    for nid in slots:
        uses = [(k, n) for n in graph.values() for k, v in _ins(n).items() if _is_link(v) and str(v[0]) == str(nid)]
        if not uses or any("." not in k for k, _n in uses):
            return False
    return True


def apply_images(graph, images, r=None):
    """Fill the workflow's LoadImage slots; bypass the rest.

    `images` are names ComfyUI already knows — uploaded via /upload/image before
    this is called — not paths on this machine.
    """
    r = r or roles(graph)
    slots = list(r.get("image_slots") or [])
    imgs = [str(i) for i in (images or []) if str(i or "").strip()]
    report = []
    if not slots:
        if imgs:
            raise PatchError(
                "reference images were given, but this workflow has no LoadImage "
                "node to put them in. Use a workflow built for image editing, or "
                "clear the reference images.")
        return graph, report
    if not imgs and slots_optional(graph, slots):
        # 2.340.0: every slot feeds an OPTIONAL autogrow input (Qwen Image
        # 2.1's images.image_N) - no picture = text-to-image
        for nid in slots:
            bypass_image_slot(graph, nid)
            report.append((nid, None, "bypassed"))
        return graph, report
    if not imgs:
        raise PatchError(
            "this workflow edits a reference image, and none was given. Add at "
            "least one image to the reference dock — with nothing to edit there "
            "is also nothing to take the output size from.")
    if len(imgs) > len(slots):
        raise PatchError(
            f"this workflow has {len(slots)} reference-image slot(s) but "
            f"{len(imgs)} images were given. Remove the extras, or export a "
            "workflow with more LoadImage nodes.")
    for nid, name in zip(slots, imgs):
        graph[nid]["inputs"]["image"] = name
        report.append((nid, name, "slot"))
    for nid in slots[len(imgs):]:
        bypass_image_slot(graph, nid)
        report.append((nid, None, "bypassed"))
    return graph, report


GGUF_UNET = ("UnetLoaderGGUF", "UnetLoaderGGUFAdvanced")


def is_gguf(name):
    return str(name or "").lower().endswith(".gguf")


def match_loader(node, value):
    """2.523.0 (Tim's log: "krea and anima aren't working" - Krea 2 Raw GGUF's UnetLoaderGGUF was given
    Krea2/jibMixKrea_v60CarolinaReaper.safetensors and ComfyUI answered "Value not in list": that loader lists .gguf
    files ONLY). The diffusion-model loader follows the FILE: a .safetensors in a GGUF loader becomes UNETLoader
    (weight_dtype default), a .gguf in UNETLoader becomes UnetLoaderGGUF (the ComfyUI-GGUF pack). Both read the same
    folders (models/diffusion_models + models/unet), so a style picks either kind of file. -> what changed | ''"""
    cls = str(node.get("class_type") or "")
    ins = node.setdefault("inputs", {})
    if cls in GGUF_UNET and value and not is_gguf(value):
        node["class_type"] = "UNETLoader"
        for k in ("dequant_dtype", "patch_dtype", "patch_on_device"):
            ins.pop(k, None)
        ins.setdefault("weight_dtype", "default")
        return f"{cls} -> UNETLoader"
    if cls == "UNETLoader" and is_gguf(value):
        node["class_type"] = "UnetLoaderGGUF"
        ins.pop("weight_dtype", None)
        return "UNETLoader -> UnetLoaderGGUF"
    return ""


def apply_overrides(graph, style, r, report):
    """Point the template's loaders at this style's models, when it says to.

    An override that cannot be applied is FATAL, not skipped: the user typed a
    model name expecting it to be used, and quietly rendering with the
    template's model instead produces a perfectly good picture of the wrong
    thing. An EMPTY override is not an override — the template's own value
    stands, which is the normal case.

    Every value goes through comfy_name() first (2.72.0). ComfyUI matches these
    combo values EXACTLY, and it spells subfolders with forward slashes, so a
    backslash from a hand-typed style — or from a Windows path pasted in — is
    rejected with "Value not in list" even though the file is right there.
    """
    def put(kind, value, label):
        slots = r["loaders"].get(kind) or []
        if not slots:
            raise PatchError(
                f"the style overrides {label} with '{value}', but this workflow "
                f"has no {label} loader to point at it. Clear that field, or "
                f"export a workflow that loads its {label} from a node.")
        nid, key = slots[0]
        graph[nid]["inputs"][key] = value
        report.append(f"{label}: node {nid}.{key} = {value}")
        if kind == "model":
            swap = match_loader(graph[nid], value)
            if swap:
                report.append(f"model: node {nid} {swap} (the file is a {'.gguf' if is_gguf(value) else 'safetensors'} model)")

    if str(style.get("model") or "").strip():
        put("model", comfy_name(style["model"]), "model")
    if str(style.get("vae") or "").strip():
        put("vae", comfy_name(style["vae"]), "VAE")
    te = [t for t in (style.get("te") or [])]
    slots = r["loaders"].get("te") or []
    for i, val in enumerate(te):
        v = comfy_name(val)
        if not v:
            continue
        if i >= len(slots):
            raise PatchError(
                f"the style sets text encoder {i + 1} to '{v}', but this "
                f"workflow only has {len(slots)} text-encoder input(s). Clear "
                "that field or export a workflow that loads them separately.")
        nid, key = slots[i]
        graph[nid]["inputs"][key] = v
        report.append(f"text encoder {i + 1}: node {nid}.{key} = {v}")
    return graph


def apply_denoise(graph, denoise, report):
    """STRENGTH, the image editor's Refine (2.332.0): the sampler's denoise.

    Written on every sampler-side node that has a literal `denoise` widget
    (KSampler, BasicScheduler). Below 1.0 an inpaint graph built on
    VAEEncodeForInpaint cannot refine - that node GREYS the masked pixels
    before encoding, so a partial denoise would start from grey and come
    back grey. It is swapped for the partial-denoise pair ComfyUI documents:
    VAEEncode (the real pixels) -> SetLatentNoiseMask (the same mask), and
    the grow_mask_by it had is dropped (the editor feathers the mask).
    """
    try:
        dn = float(denoise)
    except (TypeError, ValueError):
        return graph
    dn = max(0.01, min(1.0, dn))
    hit = []
    for nid in nodes_with(graph, "denoise"):
        ins = graph[nid]["inputs"]
        if not _is_link(ins.get("denoise")):
            ins["denoise"] = round(dn, 3)
            hit.append(nid)
    swapped = []
    if dn < 1.0:
        for nid, n in list(graph.items()):
            if str(n.get("class_type") or "") != "VAEEncodeForInpaint":
                continue
            ins = _ins(n)
            enc = _next_id(graph)
            graph[enc] = {"class_type": "VAEEncode",
                          "inputs": {"pixels": ins.get("pixels"), "vae": ins.get("vae")}}
            graph[nid] = {"class_type": "SetLatentNoiseMask",
                          "inputs": {"samples": [enc, 0], "mask": ins.get("mask")}}
            swapped.append(nid)
    report.append(f"strength {dn:.2f}: denoise on node(s) {', '.join(hit) or '(none - this graph has no denoise)'}"
                  + (f"; VAEEncodeForInpaint -> VAEEncode + SetLatentNoiseMask at {', '.join(swapped)}" if swapped else ""))
    return graph


def patch(graph, style, params):
    """The whole job: a template in, a ready-to-queue graph out.

    params: {prompt, negative?, width?, height?, steps?, cfg?, seed?, batch?}
    Anything absent falls through to the style, and anything absent there is
    LEFT AS THE TEMPLATE HAS IT — a template exported from a working ComfyUI
    session is a better default than anything this code could invent.
    """
    graph = json.loads(json.dumps(graph))       # never mutate the caller's copy
    r = roles(graph)
    report = []

    if r["ambiguous_text"]:
        raise PatchError(
            "this workflow has several text prompts and no sampler wiring to say "
            "which is positive and which is negative (nodes "
            + ", ".join(r["ambiguous_text"]) + "). Re-export it from ComfyUI with "
            "the prompts connected to the sampler, so the positive prompt cannot "
            "be swapped with the negative one.")
    # 2.236.0: a SHEET-MUSIC job (want="abc") renders no audio — its output
    # is the ABC notation a PreviewAny node lands in the history. That job
    # may also have no prompt node at all (transcribing an audio file).
    want = str((params or {}).get("want") or "")
    has_preview_any = any(n.get("class_type") == "PreviewAny" for n in graph.values())
    if not r["positive"] and not (want == "abc" and has_preview_any):
        raise PatchError(
            "no text prompt node could be found in this workflow, so there is "
            "nowhere to put the prompt. Is this an Export (API) file from "
            "ComfyUI, and does it contain a text encode node?")
    # WHAT THE GRAPH MUST KEEP depends on what the style makes. A music style
    # through a graph that only saves an image would run for a minute and hand
    # the worker nothing it can collect; the reverse is just as useless. Said
    # here, in the user's terms, rather than as "produced no audio" afterwards.
    kind = str((style or {}).get("kind") or "image")
    if kind == "music":
        if not r["save_audio"] and not (want == "abc" and has_preview_any):
            raise PatchError(
                "this workflow never saves audio (no SaveAudio/SaveAudioAdvanced/"
                "PreviewAudio node), so the song would render and be kept "
                "nowhere. Add one in ComfyUI and re-export.")
    elif not r["save"]:
        raise PatchError(
            "this workflow never saves an image (no SaveImage/PreviewImage "
            "node), so it would render and keep nothing. Add one in ComfyUI and "
            "re-export.")

    def pick(key):
        for src in (params, style):
            v = (src or {}).get(key)
            if v is not None and v != "":
                return v
        return None

    # `text` on an image encoder, `lyrics` on the Music3 encoder, `value` on a
    # Primitive the prompt was promoted to. Never a key the node does not have.
    def write_text(nid, value, want="text"):
        """Write a prompt onto a text node: its own widget (text / text_g +
        text_l / lyrics) or the primitive feeding it. Returns the key used."""
        key = widget_key(graph, nid, want) or prompt_key(graph.get(nid)) or want
        graph[nid]["inputs"][key] = value
        if key == "text_g" and "text_l" in _ins(graph[nid]) and not _is_link(_ins(graph[nid])["text_l"]):
            graph[nid]["inputs"]["text_l"] = value          # SDXL's two encoders read the same words
        return key

    prompt_txt = str(params.get("prompt") or "")
    if r["positive"]:
        pkey = write_text(r["positive"], prompt_txt)
        report.append(f"prompt: node {r['positive']}.{pkey}")
    else:
        report.append("no prompt node (audio transcription graph) — nothing to write")
    # every OTHER sampler's positive text node (the refiner's) gets it too
    for sid in r.get("samplers", [])[1:]:
        tn = find_text_node(graph, upstream(graph, sid, "positive"))
        if tn and tn != r["positive"] and tn != r["negative"]:
            k2 = write_text(tn, prompt_txt)
            report.append(f"prompt (refiner): node {tn}.{k2}")

    # THE CAPTION IS THE STYLE'S, written only when the style has one: a
    # template exported with a worked example keeps it for a style that leaves
    # the box empty, which is the "template is a better default" rule.
    cap = str((style or {}).get("caption") or "")
    if cap.strip() and r["caption"]:
        for nid in r["caption"]:
            for k in CAPTION_KEYS:
                if k in _ins(graph[nid]) and not _is_link(_ins(graph[nid])[k]):
                    graph[nid]["inputs"][k] = cap
        report.append(f"caption ({len(cap)} chars): node(s) {', '.join(r['caption'])}")

    neg = pick("negative")
    if r["negative"] and neg is not None:
        nkey = write_text(r["negative"], str(neg))
        report.append(f"negative: node {r['negative']}.{nkey}")
        for sid in r.get("samplers", [])[1:]:
            tn = find_text_node(graph, upstream(graph, sid, "negative"))
            if tn and tn != r["negative"] and tn != r["positive"]:
                k2 = write_text(tn, str(neg))
                report.append(f"negative (refiner): node {tn}.{k2}")

    seed = pick("seed")
    if seed is None or int(seed) < 0:
        # -1 MEANS RANDOM, AND IT HAS TO BE MADE REAL HERE.
        # This used to leave the template's own noise_seed alone, so every
        # render came back byte-identical -- the shipped t2i template ships
        # noise_seed 0, and Tim generated the same picture every time and
        # reasonably concluded the LoRA was not loading. "Leave the template's
        # value" is the right default for steps or cfg, where the export is a
        # better guess than anything invented here; it is exactly WRONG for a
        # seed, where the template's value is an accident of whoever exported it
        # and re-using it defeats the whole point of generating again.
        # The number is drawn here and REPORTED, so a picture you liked can be
        # reproduced by typing that seed back in.
        # RANGE MATTERS, and the ceiling here is deliberately conservative.
        # 2.78.0 drew from the full int64 space and Tim's next render died with
        # "OSError: [Errno 22] Invalid argument" inside SamplerCustomAdvanced --
        # the node that consumes RandomNoise's output -- on a graph that was
        # otherwise byte-identical to one that had just worked. The seed line
        # was the only difference.
        #
        # I cannot point at the line in ComfyUI that fails, and an upstream bug
        # with the same error text exists (a Windows stderr flush inside tqdm),
        # so this is NOT a proven mechanism. What is certain: 0..2**32-1 is the
        # range ComfyUI's own UI, A1111, numpy.random.seed and every sampler
        # backend accept without argument, huge seeds buy nothing (4 billion
        # distinct images per prompt is not a limitation anybody has hit), and
        # small seeds are what worked. When the cost of being wrong is zero and
        # the evidence points one way, take the cheap option.
        seed = random.randint(0, SEED_MAX)
        origin = " (random: the style asked for -1)"
    else:
        # Already a real number. Since 2.83.0 the usual source is
        # lib/imageSeed.js, which rolls one per press of Generate Image so the
        # number reaches job.json and the filename as well as the graph; a seed
        # the user pinned arrives the same way and is equally verbatim.
        seed = int(seed)
        origin = " (fresh for this press)" if params.get("seed_random") else ""
    seed = int(seed)
    for nid in r["seed"]:
        for k in SEED_KEYS:
            if k in _ins(graph[nid]) and not _is_link(_ins(graph[nid])[k]):
                graph[nid]["inputs"][k] = seed
    if r["seed"]:
        report.append(f"seed {seed}: node(s) {', '.join(r['seed'])}{origin}")
    else:
        # NOT a failure: a graph can legitimately have its noise wired from
        # somewhere this patcher does not model. But it does mean the one knob
        # that makes two renders differ is missing, so the user gets told why
        # every press comes back looking the same, rather than concluding the
        # model or the LoRA is broken -- which is exactly what happened in
        # 2.78.0 when the seed silently never moved.
        report.append(
            f"seed {seed}: NOT APPLIED - this workflow has no seed input the "
            "patcher can reach, so every render with it will look the same. "
            "Re-export it from ComfyUI with a sampler or noise node that takes "
            "a seed.")

    steps = pick("steps")
    if steps is not None:
        for nid in r["steps"]:
            graph[nid]["inputs"]["steps"] = int(steps)
        if r["steps"]:
            report.append(f"steps {int(steps)}: node(s) {', '.join(r['steps'])}")

    # cfg only. FLUX-family guidance lives in a FluxGuidance node and is NOT the
    # same number as cfg — writing a cfg of 1.0 into it would flatten the image.
    # It stays as the template has it. (Likewise the Music3 encoder's own
    # `cfg_scale`, which is a text-encode parameter, not the sampler's cfg.)
    # CLIP SKIP (2.112.0): a style's clip_skip N becomes stop_at_clip_layer -N
    # on every CLIPSetLastLayer the graph carries (Pony/Illustrious want 2).
    # A graph without that node ignores the setting — nothing is invented.
    cs = pick("clip_skip")
    if cs is not None and int(cs) > 0:
        hit = [nid for nid, n in graph.items() if n.get("class_type") == "CLIPSetLastLayer"
               and not _is_link(_ins(n).get("stop_at_clip_layer"))]
        for nid in hit:
            graph[nid]["inputs"]["stop_at_clip_layer"] = -int(cs)
        if hit:
            report.append(f"clip skip {int(cs)}: node(s) {', '.join(hit)}")

    cfg = pick("cfg")
    if cfg is not None:
        for nid in r["cfg"]:
            graph[nid]["inputs"]["cfg"] = float(cfg)
        if r["cfg"]:
            report.append(f"cfg {float(cfg)}: node(s) {', '.join(r['cfg'])}")

    # Seconds of song (music styles only carry it). The Music3 encode takes it
    # as max_duration and its latent reads the length back from the encode, so
    # one write reaches both; a graph with a literal `seconds` on its latent
    # gets the same number there.
    dur = pick("max_duration")
    if dur is not None and r["duration"]:
        for nid in r["duration"]:
            for k in DURATION_KEYS:
                if k in _ins(graph[nid]) and not _is_link(_ins(graph[nid])[k]):
                    graph[nid]["inputs"][k] = int(dur)
        report.append(f"duration {int(dur)}s: node(s) {', '.join(r['duration'])}")

    # ---- YuE2 (2.236.0, Tim's yue2_full.json) — class-targeted, because the
    # song's words live on TWO nodes and the caption key is spelled `style`.
    # The generic prompt pass lands the lyrics on the sampler-wired
    # YuE2GenerateMusic; the ABC generator (YuE2GenerateABC) and the cover
    # transcriber sit beside the sampler path, so they are addressed by
    # class, never by key alone (an image graph may legitimately carry a
    # `style` input; scoping to the YuE2 classes cannot touch it). Every
    # write is link-guarded: a wired input stays wired.
    yue2 = [nid for nid, n in graph.items()
            if n.get("class_type") in ("YuE2GenerateMusic", "YuE2GenerateABC")]
    if yue2:
        capw = str((style or {}).get("caption") or "")
        for nid in yue2:
            ins = _ins(graph[nid])
            if prompt_txt and "lyrics" in ins and not _is_link(ins["lyrics"]):
                graph[nid]["inputs"]["lyrics"] = prompt_txt
            if capw.strip() and "style" in ins and not _is_link(ins["style"]):
                graph[nid]["inputs"]["style"] = capw
        report.append("yue2 lyrics/style: node(s) " + ", ".join(sorted(yue2)))
        # a per-request ABC score (an edited sheet sent back to be sung):
        # written only onto the Music node, and only when it is NOT wired to
        # a generator — a wired abc is the graph's own pipeline.
        abc_in = str(params.get("abc") or "")
        for nid in yue2:
            n = graph[nid]
            if (n.get("class_type") == "YuE2GenerateMusic" and abc_in.strip()
                    and not _is_link(_ins(n).get("abc"))):
                n["inputs"]["abc"] = abc_in
                report.append(f"abc score ({len(abc_in)} chars): node {nid}")
    # the cover's reference audio: LoadAudio by class, the name as ComfyUI's
    # input folder knows it (comfy_client.upload_image put it there).
    ref = str(params.get("ref_audio") or "")
    if ref:
        for nid, n in graph.items():
            if n.get("class_type") == "LoadAudio":
                n["inputs"]["audio"] = ref
                report.append(f"reference audio {ref}: node {nid}")

    # Sampler/scheduler: written for a MUSIC style only — its catalogue lists
    # ComfyUI's own names. An image style's sampler is an sd-cli name and would
    # be refused ("Value not in list"), so those keep the template's choice.
    if kind == "music" and r["sampler_widgets"]:
        sname = str((style or {}).get("sampler") or "").strip()
        sched = str((style or {}).get("scheduler") or "").strip()
        for nid in r["sampler_widgets"]:
            ins = graph[nid]["inputs"]
            for k in SAMPLER_KEYS:
                if sname and k in ins and not _is_link(ins[k]):
                    ins[k] = sname
            for k in SCHEDULER_KEYS:
                if sched and k in ins and not _is_link(ins[k]):
                    ins[k] = sched
        if sname or sched:
            report.append(f"sampler {sname or '(template)'} / scheduler "
                          f"{sched or '(template)'}: node(s) "
                          + ", ".join(r["sampler_widgets"]))

    for nid in r["size_nodes"]:
        ins = graph[nid]["inputs"]
        for k in SIZE_KEYS:
            v = pick(k)
            if v is not None and k in ins and not _is_link(ins[k]):
                ins[k] = int(v)
    for dim, nids in (r.get("size_prims") or {}).items():
        v = pick(dim)
        if v is None:
            continue
        for nid in nids:
            graph[nid]["inputs"]["value"] = int(v)
    if r["size_nodes"] or r.get("size_prims"):
        w = pick("width")
        h = pick("height")
        touched = list(r["size_nodes"])
        for nids in (r.get("size_prims") or {}).values():
            touched += [n for n in nids if n not in touched]
        report.append(f"size {w}x{h}: node(s) {', '.join(touched)}")
    elif r["latent"] and "width" in _ins(graph.get(r["latent"], {})):
        # the latent's width is a LINK (GetImageSize in the edit graph): the
        # size is computed from the source picture, and saying so beats silence
        report.append("size: taken from the reference image, not the style")
    if r["latent"]:
        lat = graph[r["latent"]]["inputs"]
        batch = params.get("batch")
        if batch and "batch_size" in lat and not _is_link(lat["batch_size"]):
            # ComfyUI batches in ONE run and varies the noise per batch index,
            # so N images come back different without N queue round trips.
            lat["batch_size"] = int(batch)
            report.append(f"batch {int(batch)}: node {r['latent']}")

    apply_overrides(graph, style, r, report)
    if params.get("denoise") is not None and params.get("denoise") != "":
        graph = apply_denoise(graph, params.get("denoise"), report)
    graph, ireport = apply_images(graph, params.get("images"), r)
    for nid, name, how in ireport:
        report.append(f"image slot {nid}: bypassed (unused)" if how == "bypassed"
                      else f"image slot {nid}: {name}")
    graph, lreport = apply_loras(graph, style.get("loras"), roles(graph))
    for nid, name, w, how in lreport:
        report.append(f"LoRA node {nid}: bypassed (no LoRA in this slot)"
                      if how == "bypassed" else
                      f"LoRA node {nid}: {name} @ {w:g} ({how})")
    # 2.569.0: 🔲 zones - one area-conditioned prompt per box (scripts/comfy_regions.py)
    if params.get("regions"):
        import comfy_regions
        rr = roles(graph)
        lat = _ins(graph.get(rr["latent"] or "", {}))
        lit = lambda k: lat.get(k) if lat.get(k) is not None and not _is_link(lat.get(k)) else None   # noqa: E731
        W = params.get("width") or lit("width") or style.get("width")
        H = params.get("height") or lit("height") or style.get("height")
        graph, zrep = comfy_regions.apply(graph, params.get("regions"), W, H)
        report += zrep
    return graph, report


def load_workflow(path):
    """Read an Export (API) workflow and check it looks like one.

    The UI export (the one with "nodes" and "links" arrays) is the file people
    reach for first, and it is NOT the same format. Saying so beats a
    KeyError.
    """
    with open(path, "r", encoding="utf-8") as fh:
        g = json.load(fh)
    if not isinstance(g, dict) or not g:
        raise PatchError(f"{os.path.basename(path)} is not a ComfyUI workflow.")
    if "nodes" in g and "links" in g:
        raise PatchError(
            f"{os.path.basename(path)} is a ComfyUI UI workflow, not an API one. "
            "In ComfyUI use Workflow -> Export (API) and save THAT file.")
    # Keys starting with "_" are notes, not nodes. ComfyUI ignores unknown
    # top-level keys, and the shipped templates carry a "_comment" explaining
    # which models they need and why the LoRA slots are empty — documentation
    # that lives WITH the file is documentation that gets read.
    g = {k: v for k, v in g.items() if not str(k).startswith("_")}
    if not g:
        raise PatchError(f"{os.path.basename(path)} contains no nodes.")
    for k, v in g.items():
        if not isinstance(v, dict) or "class_type" not in v:
            raise PatchError(
                f"{os.path.basename(path)} does not look like an Export (API) "
                f"workflow (node '{k}' has no class_type).")
    return g
