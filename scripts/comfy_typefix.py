"""bitGen Studio — LINK TYPE REPAIR after a ComfyUI rejection (2.305.0).

Tim's field report (Scene 7, a Ref after earlier scenes): "when trying to do
a new ref in a later [scene] i get prompt failed, it works with first image,
but fails with trans, cont, ref ... rejected: prompt_outputs_failed_validation
... node 136 (MiniMaxH3ReferenceToVideo) input 'ref_videos.ref_video_0':
Return type mismatch between linked nodes ref_videos.ref_video_0,
received_type(VIDEO) mismatch input_type(IMAGE)".

WHY. A Ref / Cont scene after a rendered one carries the end of the previous
take as <Video 1>. The exports (the official ref2va.json and the
MMH3_NativeAudio_MV one) wire LoadVideo straight into ref_videos.ref_video_N
- right for the ComfyUI they were exported from, where that slot took a
VIDEO. Newer ComfyUI declares the slot IMAGE (the clip's frames), so the
same link is refused before anything runs. First works because fl2va has no
video slot at all.

WHAT. ComfyUI names the exact link it refuses. When the refusal is a VIDEO
source on an IMAGE input, the worker slots a GetVideoComponents between the
two (its output 0 is the frames, IMAGE) and queues again, once. Driven by
the server's own verdict, so it only ever touches a link THIS ComfyUI
refused - an older build that still takes VIDEO keeps the direct link.

Pure helpers; the worker calls them.
"""
import re

_TYPES = re.compile(r"received_type\((\w+)\)\s*mismatch\s*input_type\((\w+)\)")
# the node that turns a VIDEO into its parts: 0 = images, 1 = audio, 2 = fps
SPLITTER = "GetVideoComponents"
_OUT = {"IMAGE": 0, "AUDIO": 1}


def mismatches(node_errors):
    """[(node id, input name, received type, wanted type)] for every
    'Return type mismatch' in a /prompt refusal's node_errors."""
    out = []
    for nid, ne in (node_errors or {}).items():
        for e in (ne or {}).get("errors") or []:
            text = f"{e.get('message', '')} {e.get('details', '')}"
            m = _TYPES.search(text)
            if not m:
                continue
            xi = e.get("extra_info") or {}
            name = xi.get("input_name") or str(e.get("details", "")).split(",")[0].strip()
            if name:
                out.append((str(nid), str(name), m.group(1).upper(), m.group(2).upper()))
    return out


def _free_id(g, stem):
    k, i = stem, 1
    while k in g:
        i += 1
        k = f"{stem}_{i}"
    return k


def repair(g, found):
    """Fix what can be fixed in place. Returns the notes (empty = nothing
    fixable - the caller reports the refusal as before). Only VIDEO ->
    IMAGE / AUDIO is repaired: a GetVideoComponents per source video,
    shared when one video feeds several refused inputs."""
    notes, made = [], {}
    for nid, name, got, want in found:
        if got != "VIDEO" or want not in _OUT:
            continue
        node = g.get(nid) or {}
        ins = node.get("inputs") or {}
        link = ins.get(name)
        if not (isinstance(link, list) and len(link) == 2 and str(link[0]) in g):
            continue
        src = str(link[0])
        if g[src].get("class_type") == SPLITTER:
            continue                    # already split - not ours to fix
        key = (src, int(link[1]))
        if key not in made:
            sid = _free_id(g, f"bgvsplit_{src}")
            g[sid] = {"class_type": SPLITTER, "inputs": {"video": [src, int(link[1])]},
                      "_meta": {"title": "bitGen: video -> frames"}}
            made[key] = sid
        ins[name] = [made[key], _OUT[want]]
        notes.append(f"{node.get('class_type', '?')}#{nid}.{name}: this ComfyUI takes "
                     f"{want} there, the loader gives VIDEO - {SPLITTER} "
                     f"#{made[key]} inserted ({'frames' if want == 'IMAGE' else 'audio'})")
    return notes
