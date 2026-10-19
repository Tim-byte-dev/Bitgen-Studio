#!/usr/bin/env python3
"""ui_named_to_api.py — a ComfyUI UI export that carries widgets_values_named
(the newer frontend writes the widget NAMES next to their values) -> an API
prompt, with no /object_info needed (2.342.0).

    python3 scripts/ui_named_to_api.py in_ui.json out_api.json [--keep-all]

Tim's LTX_Ripple_FFAF_Edit_v11.json (tested in his ComfyUI) is the reason:
  - every widget value comes from widgets_values_named (never guessed by
    position); a widget input that is wired takes the wire;
  - SetNode / GetNode (KJNodes) are wires by NAME - resolved to real links;
  - "Anything Everywhere" (cg-use-everywhere) broadcasts - the links it
    ADDED are in extra.ue_links (downstream / slot / upstream), so they
    become real links exactly as ComfyUI queued them;
  - canvas-only nodes (Label, Note, MarkdownNote, Anything Everywhere) and
    muted nodes (mode 2) are dropped; a bypassed node (mode 4) is passed
    through by type;
  - UI-only widget values (videopreview, "choose video to upload", "Update
    inputs") are left out;
  - node titles ride in _meta.title (the app's patchers find nodes by them).
Pure functions: convert(ui) -> (api, notes).
"""
import json
import sys

CANVAS_ONLY = {"Label (rgthree)", "Note", "MarkdownNote", "Anything Everywhere", "Anything Everywhere3",
               "Anything Everywhere?", "Prompts Everywhere", "Fast Groups Bypasser (rgthree)",
               "Fast Groups Muter (rgthree)", "Bookmark (rgthree)"}
VIRTUAL = {"SetNode", "GetNode", "Reroute", "PrimitiveNode"}
UI_ONLY = {"videopreview", "choose video to upload", "Update inputs", "upload", "image_upload"}


def _links(ui):
    out = {}
    for L in ui.get("links") or []:
        if isinstance(L, list):
            out[L[0]] = {"origin": L[1], "oslot": L[2], "target": L[3], "tslot": L[4], "type": L[5] if len(L) > 5 else ""}
        elif isinstance(L, dict):
            out[L["id"]] = {"origin": L["origin_id"], "oslot": L["origin_slot"], "target": L["target_id"],
                            "tslot": L["target_slot"], "type": L.get("type", "")}
    return out


def convert(ui, keep_all=False):
    if (ui.get("definitions") or {}).get("subgraphs"):
        raise ValueError("this export has subgraphs - use lib/subgraphs + lib/graphToApi (the live converter)")
    nodes = {n["id"]: n for n in ui.get("nodes") or []}
    links = _links(ui)
    notes = []
    name_of = lambda n: str(((n.get("widgets_values") or [""]) + [""])[0] if isinstance(n.get("widgets_values"), list) else "")
    sets = {}
    for n in nodes.values():
        if n["type"] == "SetNode":
            inp = (n.get("inputs") or [{}])[0]
            L = links.get(inp.get("link"))
            if L:
                sets[name_of(n)] = (L["origin"], L["oslot"])

    def resolve(origin, slot, hops=0):
        """Follow Get -> Set / Reroute / a bypassed node to the real source."""
        if hops > 50:
            raise ValueError("a Set/Get or reroute loop")
        n = nodes.get(origin)
        if n is None:
            return None
        t = n["type"]
        if t == "GetNode":
            s = sets.get(name_of(n))
            return resolve(s[0], s[1], hops + 1) if s else None
        if t in ("SetNode", "Reroute"):
            inp = (n.get("inputs") or [{}])[0]
            L = links.get(inp.get("link"))
            return resolve(L["origin"], L["oslot"], hops + 1) if L else None
        if n.get("mode") == 4:                                 # bypassed: the first input of the output's type
            otype = ((n.get("outputs") or [])[slot] or {}).get("type") if slot < len(n.get("outputs") or []) else None
            for inp in n.get("inputs") or []:
                if inp.get("type") == otype and inp.get("link") is not None:
                    L = links[inp["link"]]
                    return resolve(L["origin"], L["oslot"], hops + 1)
            return None
        return (origin, slot)

    ue = {}
    for u in ((ui.get("extra") or {}).get("ue_links") or []):
        ue[(int(u["downstream"]), int(u["downstream_slot"]))] = (int(u["upstream"]), int(u["upstream_slot"]))

    api = {}
    for nid, n in nodes.items():
        t = n["type"]
        if t in CANVAS_ONLY or t in VIRTUAL or n.get("mode") in (2, 4):
            continue
        named = n.get("widgets_values_named")
        wv = n.get("widgets_values")
        if named is None and isinstance(wv, dict):
            named = wv                                          # VHS nodes keep a dict
        if named is None and wv not in (None, []) and not keep_all:
            raise ValueError(f"node {nid} ({t}) has widget values but no names - re-export from a frontend that writes widgets_values_named")
        ins = {k: v for k, v in (named or {}).items() if k not in UI_ONLY}
        for slot, inp in enumerate(n.get("inputs") or []):
            L = links.get(inp.get("link"))
            src = resolve(L["origin"], L["oslot"]) if L else None
            if src is None and (nid, slot) in ue:
                u = ue[(nid, slot)]
                src = resolve(u[0], u[1])
            if src is not None:
                ins[inp["name"]] = [str(src[0]), int(src[1])]
            elif inp.get("widget") is None:
                ins.pop(inp["name"], None)                      # an unwired optional socket
        api[str(nid)] = {"class_type": t, "inputs": ins,
                         "_meta": {"title": n.get("title") or (n.get("properties") or {}).get("Node name for S&R") or t}}
    # a link into a dropped node would dangle
    for k, v in api.items():
        for key, val in list(v["inputs"].items()):
            if isinstance(val, list) and len(val) == 2 and isinstance(val[1], int) and isinstance(val[0], str) and val[0] not in api:
                notes.append(f"node {k} ({v['class_type']}).{key}: its source was not converted - dropped")
                v["inputs"].pop(key)
    return api, notes


def main(argv):
    if len(argv) < 3:
        print(__doc__)
        return 2
    ui = json.load(open(argv[1], encoding="utf-8"))
    api, notes = convert(ui, keep_all="--keep-all" in argv)
    for x in notes:
        print("note:", x)
    json.dump(api, open(argv[2], "w", encoding="utf-8"), indent=1)
    print(f"{len(api)} nodes -> {argv[2]}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
