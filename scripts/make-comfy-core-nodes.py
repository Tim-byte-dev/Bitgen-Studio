#!/usr/bin/env python3
"""bitGen Studio — scripts/make-comfy-core-nodes.py (2.744.0): lib/comfyCoreNodes.json - the node classes built into
ComfyUI (no node packs) at a given version, read from ComfyUI's own source.

Tim: "if user is using runpod only show the styles that will work with runpod" - a RunPod Serverless endpoint cannot be
asked which nodes it has (no /object_info), so the studio knows what RunPod's ComfyUI worker image carries: ComfyUI
<version> and no node packs (lib/rpslStyles.js).

    python3 scripts/make-comfy-core-nodes.py <ComfyUI git checkout> <ref>=<label> [<ref>=<label> ...]
    e.g.  ... ~/ComfyUI v0.34.0=0.34.0 origin/master=latest

Read at each ref (git show, nothing checked out): nodes.py's NODE_CLASS_MAPPINGS, every comfy_extras/*.py (the old
NODE_CLASS_MAPPINGS dicts and the new io.Schema(node_id="...")). The API nodes (comfy_api_nodes - paid services) are
left out. Only the NAMES are kept - facts about ComfyUI, no code of it."""
import json
import re
import subprocess
import sys
import datetime

MAP_BLOCK = re.compile(r"NODE_CLASS_MAPPINGS\s*=\s*\{(.*?)\n\}", re.S)
MAP_KEY = re.compile(r"""^\s*["']([^"']+)["']\s*:""", re.M)
NODE_ID = re.compile(r"""node_id\s*=\s*["']([^"']+)["']""")


def git(repo, *a):
    return subprocess.run(["git", "-C", repo, *a], capture_output=True, text=True, check=True).stdout


def names_at(repo, ref):
    out = set()
    files = ["nodes.py"] + [f for f in git(repo, "ls-tree", "-r", "--name-only", ref, "comfy_extras").split() if f.endswith(".py")]
    for f in files:
        try:
            src = git(repo, "show", f"{ref}:{f}")
        except subprocess.CalledProcessError:
            continue
        for blk in MAP_BLOCK.findall(src):
            out.update(MAP_KEY.findall(blk))
        out.update(NODE_ID.findall(src))
    return sorted(out)


def main():
    repo, pairs = sys.argv[1], sys.argv[2:]
    res = {"_comment": "scripts/make-comfy-core-nodes.py: the node classes built into ComfyUI (no node packs) - read from "
                       "ComfyUI's source; names only. lib/rpslStyles.js uses them for a RunPod Serverless endpoint.",
           "made": datetime.date.today().isoformat(), "versions": {}}
    for p in pairs:
        ref, label = p.split("=", 1)
        date = git(repo, "log", "-1", "--format=%cs", ref).strip()
        res["versions"][label] = {"ref": ref, "date": date, "nodes": names_at(repo, ref)}
        print(label, ref, date, len(res["versions"][label]["nodes"]), file=sys.stderr)
    print(json.dumps(res, indent=0, ensure_ascii=False))


if __name__ == "__main__":
    main()
