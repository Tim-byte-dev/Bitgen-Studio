"""bitGen Studio — scripts/comfy_missing.py (3.11.2): what to do when ComfyUI has not loaded a node a workflow needs.

Tim's log: "[comfy] rejected: missing_node_type Node 'pi-H3 2-step DWD adapter' not found. The custom node may not be
installed." - ComfyUI names the node by its TITLE (the workflow's _meta.title), and the worker then said "fix them in the
template or re-export from ComfyUI", which sends you the wrong way: the workflow is right, this ComfyUI has not loaded the
custom node pack it needs (not installed, not restarted since it was installed, or the pack failed to import).

  PACKS                    class -> (pack, where bitGen installs it, the ComfyUI it needs)
  note(class_type, title, version)  -> the words: which pack, restart, update ComfyUI when it is too old, IMPORT FAILED
  version_tuple("0.45.1")  -> (0, 45, 1)
Pure (Node / Python tests: scripts/test-pih3-3112.py).
"""

PIFLOW = ("ComfyUI-piFlow", "Settings ▸ Add-ons ▸ π pi-H3", "0.45.0")
PACKS = {
    "Load LakonLab Adapter": PIFLOW, "pi-Flow Scheduler": PIFLOW, "DWD Decode": PIFLOW, "Load pi-Flow Model": PIFLOW,
    "pi-Flow Sampler": PIFLOW, "Load AsymFlow Model": PIFLOW, "AsymFlux2Scheduler": PIFLOW, "ModelSamplingPiFlow": PIFLOW,
    "SolAttnPatch": ("ComfyUI-SolAttn_triton (Kijai)", "Settings ▸ Add-ons ▸ π pi-H3 (Kijai's Sol-Attn)", ""),
}


def version_tuple(v):
    out = []
    for p in str(v or "").lstrip("v").split("."):
        num = "".join(ch for ch in p if ch.isdigit())
        if not num:
            break
        out.append(int(num))
    return tuple(out)


def note(class_type, title="", version=""):
    """the words for a node ComfyUI does not have"""
    ct, ti = str(class_type or ""), str(title or "")
    name = f"'{ti}' ({ct})" if ti and ct and ti != ct else f"'{ct or ti}'"
    pk = PACKS.get(ct)
    ver = version_tuple(version)
    if pk:
        pack, where, need = pk
        old = need and ver and ver < version_tuple(need)
        s = f"this ComfyUI has not loaded the node {name} - it comes with {pack}. "
        if old:
            s += f"{pack} needs ComfyUI {need} or newer and this one is {version}: update ComfyUI first (Settings ▸ ComfyUI ▸ Engine ▸ ⤓ Update ComfyUI), then restart it. "
        else:
            s += f"Restart ComfyUI - it only loads custom nodes when it starts ({where} puts {pack} in its custom_nodes folder; install it there if you have not). "
        s += f"If it still does not load, ComfyUI's console names the reason when it starts: look for 'IMPORT FAILED' next to {pack}."
        return s
    return (f"this ComfyUI does not have the node {name} - the custom node pack it comes with is not loaded. Install that pack "
            "(ComfyUI Manager ▸ Install Missing Custom Nodes) and restart ComfyUI; if it is installed, ComfyUI's console says "
            "'IMPORT FAILED' next to it when it starts, with the reason. The workflow itself is fine.")
