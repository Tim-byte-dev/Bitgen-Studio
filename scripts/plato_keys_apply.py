"""bitGen Studio — 3.4.0: Basic Settings ▸ Text encoder into the graph a render sends (PlatoKeys).

Tim (verbatim): "we can add it, and add a text encoder dropdown in basic settings to overide the models own. when we
overide the text encoder for our local llm it will automatically use the plato workflows. top option will be styles own."

The job's BITGEN_TEXT_ENCODER (lib/samplers.js envOf, from the page's X-Bitgen-Sampler header) names a text encoder file
ComfyUI has. For every CLIPLoader / CLIPLoaderGGUF that loads a style family's own encoder (lib/platoKeys.json - MiniMax
H3, MOSS-Image, Krea 2, Z-Image) and has a key for that file in ComfyUI's models/plato_keys:
  * the loader loads the picked file instead (a GGUF loader becomes a CLIPLoader);
  * official PlatoKeys keys (…_to_…, github.com/Nynxz/ComfyUI-PlatoKeys): plato_keys.Load + plato_keys.PatchCLIP after it,
    the loader's type set to the key's source type (qwen_image for a Qwen source - calibrate_comfy.py's default);
    another key (Tim's minimax_h3_32b_pk_ridge_qwen3.5_2b) that PlatosKeyPatchCLIP lists: that node, the loader's type
    kept (his workflows load the 2B as type minimax);
  * every node that took the loader's CLIP takes the patched one (CLIPTextEncode, the H3 / Viggle Remake conditioning…).
A loader with no key for the pick keeps its own encoder - said in the job's log, never a failure.
Called by scripts/comfy_client.py queue() and misc/worker.py's own send, beside the sampler pick.
Pure apart from object_info (the tests pass info=): norm, parse_key, family_of_loader, fits, pick_key, node_for.
"""
import json
import os
import re
import urllib.request

_RULES_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib", "platoKeys.json")
with open(_RULES_PATH, encoding="utf-8") as _f:
    RULES = json.load(_f)
_SKIP = re.compile(RULES["skip"], re.I)
LOADERS = ("CLIPLoader", "CLIPLoaderGGUF")


def norm(name):
    b = re.split(r"[\\/]", str(name or ""))[-1].lower()
    b = re.sub(r"\.(safetensors|gguf|sft|pt|bin)$", "", b)
    b = re.sub(r"_\d+layers?", "", b)
    return re.sub(r"[^a-z0-9]", "", b)


def parse_key(name):
    full = str(name or "")
    if not full.lower().endswith(".safetensors") or _SKIP.search(full.lower()):
        return None
    b = re.split(r"[\\/]", full)[-1].lower()[:-len(".safetensors")]
    official = "_to_" in b
    if official:
        src, tgt = b.split("_to_", 1)
    else:
        m = re.match(r"^.*(?:ridge|_pk)_(.+)$", b)
        src, tgt = (m.group(1) if m else ""), b
    comfy = src.endswith("_comfy")
    if comfy:
        src = src[:-len("_comfy")]
    fam = next((f for f in RULES["families"] if any(norm(t) in norm(tgt) for t in f["target"])), None)
    if not fam or not norm(src):
        return None
    return {"name": full, "family": fam["id"], "source": norm(src), "comfy": comfy, "official": official}


def family_of_loader(clip_name, typ):
    n, t = str(clip_name or "").lower(), str(typ or "").lower()
    return next((f for f in RULES["families"] if t in f["types"] and re.search(f["native"], n, re.I)), None)


def fits(encoder, key):
    k = parse_key(key) if isinstance(key, str) else key
    return bool(k) and re.search(r"(?<![0-9])" + re.escape(k["source"]) + r"(?![0-9])", norm(encoder)) is not None


def pick_key(keys, encoder, family_id):
    c = [k for k in (parse_key(x) for x in (keys or [])) if k and k["family"] == family_id and fits(encoder, k)]
    c.sort(key=lambda k: (not k["comfy"], len(k["name"]), k["name"]))
    return c[0]["name"] if c else ""


def node_for(key, info):
    k = parse_key(key) or {}
    off = key in (info.get("keys") or []) and info.get("official")
    fe = key in (info.get("fearn_keys") or []) and info.get("fearn")
    if not k.get("official") and fe:
        return "fearn"
    if off:
        return "official"
    return "fearn" if fe else ""


def _combo(spec):
    if not isinstance(spec, (list, tuple)) or not spec:
        return []
    if isinstance(spec[0], (list, tuple)):
        return [str(x) for x in spec[0]]
    if len(spec) > 1 and isinstance(spec[1], dict):
        return [str(x) for x in (spec[1].get("options") or [])]
    return []


def _first_key_combo(node):
    I = (node or {}).get("input") or {}
    for sec in (I.get("required") or {}, I.get("optional") or {}):
        for spec in sec.values():
            c = _combo(spec)
            if c and any(x.lower().endswith(".safetensors") for x in c):
                return c
    return []


_INFO = {}


def object_info(base, timeout=15):
    """What this ComfyUI has: its CLIPLoader lists + the PlatoKeys nodes and the keys they list (cached per base)."""
    if base in _INFO:
        return _INFO[base]

    def ask(cls):
        try:
            with urllib.request.urlopen(f"{base}/object_info/{cls}", timeout=timeout) as r:
                return (json.loads(r.read().decode("utf-8")) or {}).get(cls)
        except Exception:                   # noqa: BLE001
            return None
    clip, load, patch, fearn = ask("CLIPLoader"), ask("plato_keys.Load"), ask("plato_keys.PatchCLIP"), ask("PlatosKeyPatchCLIP")
    req = ((clip or {}).get("input") or {}).get("required") or {}
    v = {"online": clip is not None, "encoders": _combo(req.get("clip_name")), "types": _combo(req.get("type")),
         "official": bool(load and patch), "keys": _first_key_combo(load) if load else [],
         "fearn": bool(fearn), "fearn_keys": _first_key_combo(fearn) if fearn else [], "fearn_spec": fearn}
    _INFO[base] = v
    return v


def _fearn_inputs(spec, clip_link, key):
    """PlatosKeyPatchCLIP's inputs from its own object_info: the CLIP link, the key, every other widget at its default."""
    ins = {}
    I = (spec or {}).get("input") or {}
    for opt, sec in ((False, I.get("required") or {}), (True, I.get("optional") or {})):
        for name, s in sec.items():
            if not isinstance(s, (list, tuple)) or not s:
                continue
            typ, o = s[0], (s[1] if len(s) > 1 and isinstance(s[1], dict) else {})
            ch = _combo(s)
            if typ == "CLIP":
                ins[name] = clip_link
            elif ch:
                ins[name] = key if key in ch else o.get("default", ch[0])
            elif typ in ("INT", "FLOAT", "STRING", "BOOLEAN"):
                if "default" in o:
                    ins[name] = o["default"]
                elif not opt:
                    ins[name] = {"INT": 0, "FLOAT": 1.0, "STRING": "", "BOOLEAN": False}[typ]
    if not any(v == clip_link for v in ins.values()):
        ins["clip"] = clip_link
    return ins


def _next_id(graph):
    n = 0
    for k in graph:
        try:
            n = max(n, int(str(k).split(":")[-1]))
        except ValueError:
            pass
    return n + 1


def apply_text_encoder(base, graph, te=None, say=print, info=None):
    """-> {"changed": [loader ids], "kept": [loader ids]}; nothing picked = nothing changes, nothing said."""
    te = (os.environ.get("BITGEN_TEXT_ENCODER", "") if te is None else te).strip()
    out = {"changed": [], "kept": []}
    if not te or not isinstance(graph, dict):
        return out
    I = info if info is not None else object_info(base)
    words = []
    if I.get("online") and I.get("encoders") and te not in I["encoders"]:
        say(f"[text encoder] Basic Settings - {te} is not in this ComfyUI's text encoders - the style's own kept")
        return out
    keys = list(dict.fromkeys((I.get("keys") or []) + (I.get("fearn_keys") or [])))
    loaders = [(str(nid), n) for nid, n in list(graph.items())
               if isinstance(n, dict) and n.get("class_type") in LOADERS]
    for nid, n in loaders:
        ins = n.setdefault("inputs", {})
        name, typ = ins.get("clip_name"), ins.get("type")
        if not isinstance(name, str):
            continue
        fam = family_of_loader(name, typ)
        if not fam or name == te:
            continue
        key = pick_key(keys, te, fam["id"])
        how = node_for(key, I) if key else ""
        if not how:
            out["kept"].append(nid)
            words.append(f"{fam['label']} (node {nid}): " + (
                f"no PlatoKeys key maps {te} onto it in ComfyUI's models/plato_keys" if not key else
                "the PlatoKeys nodes are not in ComfyUI (Settings ▸ Add-ons ▸ 🔑 PlatoKeys)") + " - its own encoder kept")
            continue
        k = parse_key(key)
        n["class_type"] = "CLIPLoader"
        ins["clip_name"] = te
        if how == "official":
            st = next((v for p, v in RULES.get("sourceType", {}).items() if k["source"].startswith(p)), "")
            if st and (not I.get("types") or st in I["types"]):
                ins["type"] = st
        ins.setdefault("device", "default")
        link = [nid, 0]
        pid = str(_next_id(graph))
        if how == "official":
            lid = pid
            graph[lid] = {"class_type": "plato_keys.Load", "inputs": {"key_name": key},
                          "_meta": {"title": "Load Plato Key (bitGen - Basic Settings ▸ Text encoder)"}}
            pid = str(_next_id(graph))
            graph[pid] = {"class_type": "plato_keys.PatchCLIP",
                          "inputs": dict({"clip": link, "plato_key": [lid, 0]}, **RULES.get("patch", {})),
                          "_meta": {"title": "Patch CLIP (Plato Key)"}}
        else:
            graph[pid] = {"class_type": "PlatosKeyPatchCLIP", "inputs": _fearn_inputs(I.get("fearn_spec"), link, key),
                          "_meta": {"title": "PlatosKeyPatchCLIP (bitGen - Basic Settings ▸ Text encoder)"}}
        for oid, o in graph.items():
            if str(oid) == pid or not isinstance(o, dict):
                continue
            for iname, v in (o.get("inputs") or {}).items():
                if isinstance(v, list) and len(v) == 2 and str(v[0]) == nid and v[1] == 0 and o.get("class_type") != "plato_keys.Load":
                    o["inputs"][iname] = [pid, 0]
        out["changed"].append(nid)
        words.append(f"{fam['label']} (node {nid}): {te} + key {key} ({'PlatoKeys Patch CLIP' if how == 'official' else 'PlatosKeyPatchCLIP'})")
    if words:
        try:
            say("[text encoder] Basic Settings - " + "; ".join(words))
        except Exception:                   # noqa: BLE001
            pass
    elif not out["changed"]:
        try:
            say(f"[text encoder] Basic Settings - {te}: this workflow has no MiniMax H3 / MOSS-Image / Krea 2 / Z-Image "
                "text encoder loader - nothing changed")
        except Exception:                   # noqa: BLE001
            pass
    return out
