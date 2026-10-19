"""bitGen Studio — TRUE CFG FOR THE MINIMAX H3 GRAPHS (2.366.0).

Tim (verbatim): "even your prompt didn't work , cfg was 1, i am trying 3".

Every shipped H3 video graph (ref2va, fl2va, the native-audio board, the
scene/chain exports) guides with BasicGuider: ONE model pass per step and
NO cfg input. The shared patch writes "cfg" only into nodes that have that
input, so Basic Settings' cfg 3 never reached the render - the take was
the same cfg-1 sample with a different seed.

apply(g, cfg, use_lora, negative):
  cfg <= 1 -> the graph is untouched (H3's distilled default, one pass).
  cfg  > 1 -> every BasicGuider whose conditioning comes from a MiniMax H3
              generator (MiniMaxH3ReferenceToVideo / MiniMaxH3ImageToVideo /
              any MiniMaxH3*ToVideo, also through RefMod applies or other
              conditioning-in/conditioning-out nodes) becomes a CFGGuider:
                positive = the graph's own conditioning (unchanged)
                negative = the SAME generator cloned with the negative text
                           - same pictures, same voice, same video refs, so
                           the guidance amplifies only what the TEXT adds:
                           the <d> words and the acting, not the references.
                cfg      = the requested value
              Each step then runs the model twice (about 2x the time).
The turbo LoRA (Settings -> ComfyUI -> 4-step LoRA) is distilled for cfg 1;
with it on, a cfg above 1 over-bakes - the note says so, the render still
runs as asked.
Pure: graph dict in, (graph, notes) out.
"""
import copy

DEFAULT_NEGATIVE = (
    "mumbling, babbling, gibberish speech, murmuring, humming, extra words, "
    "random vocal sounds, repeating the reference audio, speaking words that "
    "are not in the script, lips moving with no words, muffled garbled voice")


def _is_link(v):
    return isinstance(v, list) and len(v) == 2 and isinstance(v[0], (str, int))


def _is_gen(node):
    ct = str((node or {}).get("class_type", ""))
    return ct.startswith("MiniMaxH3") and ct.endswith("ToVideo")


def _cond_path(g, link):
    """Walk the conditioning link back to its H3 generator. Returns the node
    ids from the guider's source to the generator (inclusive), or None when
    the chain meets anything that is not conditioning-in/conditioning-out."""
    path, seen = [], set()
    while _is_link(link):
        nid = str(link[0])
        if nid in seen or nid not in g:
            return None
        seen.add(nid)
        node = g[nid]
        path.append(nid)
        if _is_gen(node):
            return path
        ins = node.get("inputs") or {}
        nxt = ins.get("conditioning")
        if not _is_link(nxt):
            return None
        link = nxt
    return None


def _fresh_id(g, base):
    nid, i = f"{base}_neg", 2
    while nid in g:
        nid, i = f"{base}_neg{i}", i + 1
    return nid


def apply(g, cfg, use_lora=False, negative=""):
    notes = []
    try:
        cfg = float(cfg)
    except (TypeError, ValueError):
        cfg = 1.0
    if cfg <= 1.0:
        return g, notes
    neg_text = str(negative or "").strip() or DEFAULT_NEGATIVE
    g = copy.deepcopy(g)
    guiders = [k for k, v in g.items()
               if isinstance(v, dict) and v.get("class_type") == "BasicGuider"]
    clones = {}                      # original node id -> negative clone id
    switched = 0
    for gid in guiders:
        ins = g[gid].get("inputs") or {}
        model, cond = ins.get("model"), ins.get("conditioning")
        path = _cond_path(g, cond)
        if not _is_link(model) or not path:
            notes.append(f"cfg {cfg:g}: guider {gid} is not fed by an H3 generator - left at its own guidance")
            continue
        # clone generator first, then each conditioning node back up to the guider
        prev = None
        for nid in reversed(path):
            if nid not in clones:
                node = copy.deepcopy(g[nid])
                nins = node.setdefault("inputs", {})
                if prev is None:                       # the generator
                    nins["prompt"] = neg_text
                else:
                    nins["conditioning"] = [prev, 0]
                cid = _fresh_id(g, nid)
                g[cid] = node
                clones[nid] = cid
            prev = clones[nid]
        g[gid] = {"class_type": "CFGGuider",
                  "inputs": {"model": model, "positive": cond,
                             "negative": [prev, int(cond[1])], "cfg": cfg},
                  **({"_meta": g[gid]["_meta"]} if "_meta" in g[gid] else {})}
        switched += 1
    if switched:
        gen = clones and next(iter(clones))
        notes.append(f"true cfg {cfg:g}: {switched} BasicGuider -> CFGGuider, negative = "
                     f"the H3 generator ({g.get(gen, {}).get('class_type', '?')}) with the same "
                     "references and the negative text - two model passes per step (about 2x time)")
        if use_lora:
            notes.append(f"WARNING: the turbo LoRA is distilled for cfg 1 - cfg {cfg:g} with it "
                         "over-bakes; turn Settings -> ComfyUI -> 4-step LoRA off and use 20+ steps")
    elif not guiders:
        notes.append(f"cfg {cfg:g}: this graph has no BasicGuider - the cfg was written to any node with a cfg input")
    return g, notes
