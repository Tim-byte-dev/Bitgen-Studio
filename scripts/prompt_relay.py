#!/usr/bin/env python3
"""bitGen Studio — scripts/prompt_relay.py (2.592.0): ⏱ TIMED LINES IN AN LTX PROMPT = Prompt Relay.

Tim: "lets just add the regional character lora and prompt relay" (Winnougan's Nougan_Nodes, MIT - its Prompt Relay is a
rewrite of Kijai's ComfyUI-PromptRelay with the same node names; either pack works). Prompt Relay gives each stretch of
an LTX video its own prompt, with one global prompt over the whole clip (a Gaussian penalty on the cross-attention, in
time) - the fox sniffs, then looks up, then runs, in ONE render.

THE PROMPT SAYS IT - any LTX prompt (the prompt docker, a scene on the board, the timeline's AI clip):

    cinematic, 35mm film, a red fox in the snow        <- lines without a time = the global prompt (the whole clip)
    [0-2s] the fox sniffs the ground
    [2-4s] the fox looks up at the camera
    [4s] the fox runs off to the left                  <- a start alone = until the next line / the end

    - a time is seconds ("2", "2s", "2.5s"; "0-2s", "2s-4s", "2 to 4"); the lines are sorted by their start, and each
      runs until the next one starts (a gap is closed, an overlap is cut) - the first starts at 0, the last ends with
      the clip
    - one timed line is enough; nothing timed = an ordinary prompt (no Prompt Relay)
The graph (after ltx_graph.patch / official_finish wrote the prompt) - the FIRST pass only:

    the first pass's model ──> PromptRelayEncode.model ──> (MODEL) the first pass's guider / sampler
    the positive's CLIP ─────> .clip                       (CONDITIONING) a copy of the chain to that guider
    its EmptyLTXVLatentVideo > .latent (frames + size)                (LTXVConditioning ...)
    global_prompt / local_prompts ("a | b | c") / segment_lengths ("48,48,25" - frames at the clip's fps) / epsilon
    A second pass (a sampler on an upsampled latent - Comfy-Org's two-stage templates) keeps the model and the global
    prompt: the node reads the clip's size from the latent it is given, and the detail pass renders at twice the size.

Without the node pack (Settings ▸ Add-ons ▸ Nougan Nodes) - or a graph it cannot be wired into - the clip renders ONE
prompt: the global lines + every timed line's words, said in the log.
Pure: no ComfyUI, no files. misc/ltx_worker.py runs it.
    parse(text) -> None | {"global": str, "segments": [{"start", "end" (None = to the next), "text"}]}
    lengths(segments, seconds, fps) -> [frames]       flat(rel) -> one prompt       splice(g, rel, ...) -> (g, notes)
"""
import copy
import json
import re

NODE = "PromptRelayEncode"
EPSILON = 0.001                                   # the node's default (lower = sharper changes between the lines)
MAX_SEGMENTS = 16
_NUM = r"(\d+(?:\.\d+)?)\s*(?:s|sec|secs|seconds?)?"
LINE = re.compile(r"^\s*\[\s*" + _NUM + r"\s*(?:(?:-|–|—|to)\s*(?:" + _NUM + r")?\s*)?\]\s*(.*?)\s*$", re.I)


def parse(text):
    """The prompt -> its global words + its timed lines, or None when nothing is timed."""
    glob, segs = [], []
    for raw in str(text or "").replace("\r", "").split("\n"):
        m = LINE.match(raw)
        if m:
            words = m.group(3).strip()
            if not words:
                continue
            a = float(m.group(1))
            b = float(m.group(2)) if m.group(2) else None
            segs.append({"start": a, "end": b if b is not None and b > a else None, "text": words})
        elif raw.strip():
            glob.append(raw.strip())
    if not segs:
        return None
    segs.sort(key=lambda s: s["start"])
    return {"global": " ".join(glob).strip(), "segments": segs[:MAX_SEGMENTS]}


def lengths(segments, seconds, fps):
    """Each line's frames (pixel frames at the clip's fps): from its start to the next one's (the first from 0, the last
    to the end). A line that starts after the clip ends is dropped. -> [int], the same count as the kept lines."""
    fps = float(fps or 24)
    total = max(1, int(round(float(seconds or 5) * fps)))
    starts = []
    for s in segments:
        f = int(round(float(s["start"]) * fps))
        if f >= total and starts:
            break
        starts.append(min(f, total - 1))
    if not starts:
        return []
    starts[0] = 0
    out = []
    for i, f in enumerate(starts):
        nxt = starts[i + 1] if i + 1 < len(starts) else total
        out.append(max(1, nxt - f))
    # rounding can leave the sum off by one or two - the last line takes it
    out[-1] = max(1, total - sum(out[:-1]))
    return out


def flat(rel):
    """One prompt from a parsed one (no Prompt Relay): the global words, then each line's words in order."""
    parts = [rel.get("global") or ""] + [s["text"] for s in rel.get("segments") or []]
    return ". ".join(p.strip().rstrip(".") for p in parts if p and p.strip())


def _ins(n):
    return (n or {}).get("inputs") or {}


def _is_link(v):
    return isinstance(v, list) and len(v) == 2 and isinstance(v[0], (str, int)) and isinstance(v[1], int)


def _same(v, link):
    return _is_link(v) and str(v[0]) == str(link[0]) and int(v[1]) == int(link[1])


UPSCALE_HINT = ("upsampl", "upscale")           # a latent through one of these = a second (detail) pass


def _up_path(g, start, want, stop=UPSCALE_HINT, seen=None, depth=0):
    """Walk upstream from node `start` to the first node whose class is in `want`; None when the way passes a node
    whose class name has one of `stop` in it (a latent upsampler) or nothing is found."""
    seen = seen if seen is not None else set()
    if start is None or start in seen or depth > 30:
        return None
    seen.add(start)
    n = g.get(start) or {}
    ct = str(n.get("class_type") or "")
    if ct in want:
        return start
    if any(h in ct.lower() for h in stop):
        return None
    if depth > 0 and _is_link(_ins(n).get("latent_image")):
        return None                                        # another sampler's result = a later pass's input
    for v in _ins(n).values():
        if _is_link(v):
            hit = _up_path(g, str(v[0]), want, stop, seen, depth + 1)
            if hit:
                return hit
    return None


def video_latent(g, start=None):
    """The empty video latent that sets the clip's frame count (EmptyLTXVLatentVideo) - upstream of `start` when given."""
    want = {"EmptyLTXVLatentVideo"} | {str(n.get("class_type")) for n in g.values()
                                       if str(n.get("class_type") or "").startswith("Empty") and "LTX" in str(n.get("class_type") or "")
                                       and "Audio" not in str(n.get("class_type") or "")}
    if start is not None:
        return _up_path(g, str(start), want)
    for nid, n in g.items():
        if str(n.get("class_type") or "") in want:
            return nid
    return None


def first_pass(g):
    """The FIRST pass's renderers: [(the node with the model - a guider or the sampler itself, its empty latent)]. A
    sampler whose latent comes through a latent upsampler is the second (detail) pass - Prompt Relay stays off it: the
    node reads the clip's size from the latent it was given, and the second pass renders at another size."""
    out = []
    for nid, n in g.items():
        ins = _ins(n)
        if not _is_link(ins.get("latent_image")):
            continue
        lat = video_latent(g, ins["latent_image"][0])
        if not lat:
            continue                                         # a second pass (or not a video latent)
        r = nid if _is_link(ins.get("model")) else (_renderer(g, str(ins["guider"][0])) if _is_link(ins.get("guider")) else None)
        if r and _is_link(_ins(g.get(r)).get("model")) and r not in [x[0] for x in out]:
            out.append((r, lat))
    return out


def _renderer(g, start, depth=0, seen=None):
    """From a sampler's `guider` link up to the guider itself (a node with a model AND a positive) - through the
    pass-through nodes a canvas puts in between (Tim's canvas: easy cleanGpuUsed)."""
    seen = seen if seen is not None else set()
    if start is None or start in seen or depth > 6:
        return None
    seen.add(start)
    ins = _ins(g.get(start))
    if _is_link(ins.get("model")) and _is_link(ins.get("positive")):
        return start
    for v in ins.values():
        if _is_link(v):
            hit = _renderer(g, str(v[0]), depth + 1, seen)
            if hit:
                return hit
    return None


def cond_path(g, start):
    """From a renderer's `positive` link down to the text encoder: ([the nodes in between, top first], the encoder)."""
    path, nid, seen = [], start, set()
    while nid is not None and nid not in seen and len(seen) < 12:
        seen.add(nid)
        ins = _ins(g.get(nid))
        if _is_link(ins.get("clip")):
            return path, nid
        path.append(nid)
        nxt = None
        for k in ["positive", "conditioning"] + [k for k in ins if k not in ("positive", "conditioning", "negative")]:
            if _is_link(ins.get(k)):
                nxt = str(ins[k][0])
                break
        nid = nxt
    return path, None


def positive_encoder(g):
    """The text encoder behind the first pass's positive (None = none)."""
    fp = first_pass(g)
    for r, _lat in fp:
        p = _ins(g[r]).get("positive")
        if _is_link(p):
            return cond_path(g, str(p[0]))[1]
    return None


def _out_slot(spec, typ, dflt):
    outs = (spec or {}).get("output") or []
    return outs.index(typ) if typ in outs else dflt


def _new_id(g, base):
    nid = base
    while nid in g:
        nid += "_"
    return nid


def splice(g, rel, seconds, fps, spec=None, epsilon=None):
    """-> (graph, notes). spec = ComfyUI's object_info entry for PromptRelayEncode (input names / defaults / outputs) or
    None (the names Kijai's and Nougan's packs use). Only the FIRST pass gets the patched model and the relay's
    conditioning (its own copy of the chain between the encoder and the guider - LTXVConditioning ...); a second
    (detail) pass keeps the model and the global prompt. Raises ValueError in words when it cannot be wired in."""
    g = copy.deepcopy(g)
    segs = rel.get("segments") or []
    lens = lengths(segs, seconds, fps)
    segs = segs[:len(lens)]
    if not segs:
        raise ValueError("no timed line starts inside the clip")
    fp = first_pass(g)
    if not fp:
        raise ValueError("the graph has no sampler on an empty LTX video latent (EmptyLTXVLatentVideo)")
    r0, lat = fp[0]
    pos = _ins(g[r0]).get("positive")
    if not _is_link(pos):
        raise ValueError(f"the first pass ({g[r0].get('class_type')}) has no positive conditioning")
    path, enc = cond_path(g, str(pos[0]))
    clip = _ins(g.get(enc)).get("clip") if enc else None
    if not _is_link(clip):
        raise ValueError("the graph's positive prompt has no text encoder with a CLIP input")
    model = list(_ins(g[r0])["model"])
    req = ((spec or {}).get("input") or {}).get("required") or {}
    opt = ((spec or {}).get("input") or {}).get("optional") or {}
    vals = {"model": model, "clip": list(clip), "latent": [lat, 0], "global_prompt": rel.get("global") or "",
            "local_prompts": " | ".join(s["text"].replace("|", "/") for s in segs),
            "segment_lengths": ",".join(str(n) for n in lens),
            "epsilon": float(epsilon if epsilon is not None else EPSILON)}
    inputs = {}
    if req or opt:
        for k, v in list(req.items()) + list(opt.items()):
            if k in vals:
                inputs[k] = vals[k]
            elif k in req and isinstance(v, list) and len(v) > 1 and isinstance(v[1], dict) and "default" in v[1]:
                inputs[k] = v[1]["default"]                          # a widget this pack has that we do not set
        unknown = [k for k in req if k not in inputs]
        if unknown:
            raise ValueError(f"{NODE} on this ComfyUI wants inputs bitGen does not know: " + ", ".join(unknown))
    else:
        inputs = vals
    nid = _new_id(g, "relay")
    g[nid] = {"class_type": NODE, "_meta": {"title": "⏱ Prompt Relay"}, "inputs": inputs}
    m_slot, c_slot = _out_slot(spec, "MODEL", 0), _out_slot(spec, "CONDITIONING", 1)
    # the first pass's own copy of the chain encoder -> guider, its bottom reading the relay instead of the encoder
    clone = {}
    for p in path:
        clone[p] = _new_id(g, f"{p}_relay")
        g[clone[p]] = copy.deepcopy(g[p])
        g[clone[p]].setdefault("_meta", {})["title"] = f"{(g[p].get('_meta') or {}).get('title') or g[p].get('class_type')} (⏱ relay)"
    for i, p in enumerate(path):
        ci = _ins(g[clone[p]])
        nxt = path[i + 1] if i + 1 < len(path) else enc
        for k, v in list(ci.items()):
            if _is_link(v) and str(v[0]) == str(nxt) and k != "negative":
                ci[k] = [clone[nxt], v[1]] if nxt in clone else [nid, c_slot]
                break
    for r, _lat in fp:
        ri = _ins(g[r])
        if _same(ri.get("model"), model):
            ri["model"] = [nid, m_slot]
        for k, v in list(ri.items()):
            if _is_link(v) and path and str(v[0]) == str(path[0]):
                ri[k] = [clone[path[0]], v[1]]
            elif _is_link(v) and not path and k == "positive" and str(v[0]) == str(enc):
                ri[k] = [nid, c_slot]
    t = 0.0
    lines = []
    for s, n in zip(segs, lens):
        lines.append(f"{t:.1f}-{t + n / float(fps or 24):.1f}s \"{s['text'][:40]}\"")
        t += n / float(fps or 24)
    second = len([1 for n in g.values() if _is_link(_ins(n).get("latent_image"))]) - len(fp)
    notes = [f"⏱ Prompt Relay ({NODE}): {len(segs)} timed line(s) - " + "; ".join(lines)
             + (" - the global prompt over the whole clip" if rel.get("global") else "")
             + (f" (the first pass; the {second} detail pass(es) keep the global prompt)" if second > 0 else "")]
    return g, notes


def as_json(rel):
    return json.dumps(rel, ensure_ascii=False)
