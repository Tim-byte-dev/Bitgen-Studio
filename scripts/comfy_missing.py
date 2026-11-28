"""bitGen Studio — scripts/comfy_missing.py (3.11.2): what to do when ComfyUI has not loaded a node a workflow needs.

Tim's log: "[comfy] rejected: missing_node_type Node 'pi-H3 2-step DWD adapter' not found. The custom node may not be
installed." - ComfyUI names the node by its TITLE (the workflow's _meta.title), and the worker then said "fix them in the
template or re-export from ComfyUI", which sends you the wrong way: the workflow is right, this ComfyUI has not loaded the
custom node pack it needs (not installed, not restarted since it was installed, or the pack failed to import).

  PACKS                    class -> (pack, where bitGen installs it, the ComfyUI it needs)
  note(class_type, title, version)  -> the words: which pack, restart, update ComfyUI when it is too old, IMPORT FAILED
  version_tuple("0.45.1")  -> (0, 45, 1)
Pure (Node / Python tests: scripts/test-pih3-3112.py).

3.12.1 (Tim's log again, after restarting: "this ComfyUI has not loaded the node 'pi-H3 4-step DWD adapter' (Load LakonLab
Adapter)" + https://github.com/Lakonik/ComfyUI-piFlow/blob/main/docs/piH3.md): "restart ComfyUI" was not enough. The pi-H3 nodes
(Load LakonLab Adapter, DWD Decode, pi-Flow Scheduler) only came in ComfyUI-piFlow 1.4.0 (20 Nov 2026); an older copy still
loads (its Load pi-Flow Model / pi-Flow Sampler) and the pi-H3 ones are simply not in it. A copy from the Comfy registry /
ComfyUI-Manager has no .git, and on Windows its folder "comfyui-piflow" IS "ComfyUI-piFlow" - so the add-on's Install kept it.
Now the worker says WHICH case it is:
  piflow_copies(dirs)            the ComfyUI-piFlow folders in custom_nodes: [{dir, name, version, git, pih3}]
  custom_nodes_dirs(cfg, app)    the custom_nodes folder(s) of the ComfyUI set in Settings (none for a remote one)
  load_failures(entries, rx)     ComfyUI's console (/internal/logs/raw) lines saying the pack did not import
  piflow_hint(old_loaded, copies, failures, dirs) -> the words for the case, "" when nothing more is known
"""
import os
import re
from pathlib import Path

PIFLOW_MIN = (1, 4, 0)               # the first ComfyUI-piFlow with the pi-H3 nodes (20 Nov 2026)
OLD_PIFLOW_NODES = ("Load pi-Flow Model", "pi-Flow Sampler", "ModelSamplingPiFlow")   # in every version - "an old copy is loaded"
PIFLOW_RX = re.compile(r"comfyui[-_]?piflow", re.I)

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


# ---------------------------------------------------------------- 3.12.1: which ComfyUI-piFlow, and why it did not load
def _version_of(d):
    try:
        txt = (Path(d) / "pyproject.toml").read_text(encoding="utf-8", errors="replace")
    except OSError:
        return ""
    m = re.search(r'^\s*version\s*=\s*"([^"]+)"', txt, re.M)
    return m.group(1) if m else ""


def piflow_copies(dirs):
    """every ComfyUI-piFlow folder (any spelling - the registry's is comfyui-piflow) in these custom_nodes folders, not the
    .disabled ones: [{dir, name, version, git, pih3 (its __init__ registers Load LakonLab Adapter)}]"""
    out = []
    for cn in dirs or []:
        try:
            names = sorted(os.listdir(cn))
        except OSError:
            continue
        for n in names:
            d = Path(cn) / n
            if not d.is_dir() or n.endswith(".disabled") or not PIFLOW_RX.fullmatch(n):
                continue
            try:
                init = (d / "__init__.py").read_text(encoding="utf-8", errors="replace")
            except OSError:
                init = ""
            out.append({"dir": str(d), "name": n, "version": _version_of(d), "git": (d / ".git").exists(),
                        "pih3": "Load LakonLab Adapter" in init})
    return out


def custom_nodes_dirs(cfg, app_base):
    """the custom_nodes folder(s) of the ComfyUI folder set in Settings ▸ ComfyUI - or, when none is set, of a ComfyUI beside
    the app where bitGen looks (ComfyUI\\, comfy\\, ..\\ComfyUI, the portable build); [] when none is here (a remote ComfyUI)"""
    d = str((((cfg or {}).get("engine") or {}).get("comfy") or {}).get("dir") or "").strip()
    app = Path(app_base)
    roots = [Path(d) if os.path.isabs(d) else app / d] if d else [app / "ComfyUI", app / "comfy", app.parent / "ComfyUI",
                                                                   app.parent / "ComfyUI_windows_portable"]
    out = []
    for p in roots:
        for x in (p / "custom_nodes", p / "ComfyUI" / "custom_nodes"):
            if x.is_dir() and str(x) not in out:
                out.append(str(x))
    return out


def load_failures(entries, rx=PIFLOW_RX, keep=3):
    """ComfyUI's console lines (its /internal/logs/raw entries [{t, m}] or plain strings) that say the pack failed to import:
    'Cannot import ... module for custom nodes: <why>' / '(IMPORT FAILED): ...' - the last few, trimmed"""
    out = []
    for e in entries or []:
        m = str((e or {}).get("m") if isinstance(e, dict) else e or "")
        for line in m.splitlines():
            if rx.search(line) and re.search(r"IMPORT FAILED|Cannot import|Traceback|Error", line):
                out.append(line.strip()[:300])
    seen, uniq = set(), []
    for line in out:
        if line not in seen:
            seen.add(line)
            uniq.append(line)
    return uniq[-keep:]


def piflow_hint(old_loaded, copies, failures, dirs):
    """the words for why the pi-H3 nodes are not there - "" when nothing more than note() is known"""
    pack, where = PIFLOW[0], PIFLOW[1]
    copies = copies or []
    good = [c for c in copies if c["pih3"]]
    old = [c for c in copies if not c["pih3"]]
    desc = lambda c: f"{c['dir']} ({'version ' + c['version'] if c['version'] else 'no version'}{', a git copy' if c['git'] else ', not a git copy'})"   # noqa: E731
    if failures:
        return (f"{pack} did not import when ComfyUI started - its console says: " + " | ".join(failures)
                + f". Fix that (often: update ComfyUI - {pack} {'.'.join(map(str, PIFLOW_MIN))}+ needs 0.45.0 or newer - or a package "
                "missing from ComfyUI's Python), then restart ComfyUI.")
    if old_loaded or (old and not good):
        found = (" This ComfyUI's custom_nodes has " + "; ".join(desc(c) for c in old) + ".") if old else ""
        return (f"this ComfyUI loaded an OLD {pack} - the pi-H3 nodes (Load LakonLab Adapter, DWD Decode, pi-Flow Scheduler) only "
                f"came in {pack} {'.'.join(map(str, PIFLOW_MIN))} (20 Nov 2026).{found} Update it: {where} ▸ Install (it puts the "
                f"old copy aside as <name>.disabled and fetches the newest), or Update it in ComfyUI-Manager; then restart ComfyUI.")
    if good:
        return (f"{pack} is in " + "; ".join(desc(c) for c in good) + " but this ComfyUI has not loaded it. Restart ComfyUI (it "
                "only loads custom nodes when it starts). If you did: is the ComfyUI you run the one in that folder (Settings ▸ "
                f"ComfyUI)? Its console says 'IMPORT FAILED' next to {pack} when it starts, with the reason.")
    if dirs:
        return (f"{pack} is not in " + " or ".join(dirs) + f" - {where} ▸ Install puts it there; then restart ComfyUI.")
    return ""


def piflow_report(cfg, app_base, info, log_entries=None):
    """the worker's one call (misc/worker.py): info = scripts/pih3.py info() (its classes include OLD_PIFLOW_NODES);
    log_entries = a function -> ComfyUI's console entries (comfy_client._log_entries) or None -> piflow_hint's words or """""
    classes = (info or {}).get("classes") or {}
    old_loaded = any(c in classes for c in OLD_PIFLOW_NODES) and "Load LakonLab Adapter" not in classes
    dirs = custom_nodes_dirs(cfg, app_base)
    try:
        entries = log_entries() if log_entries else None
    except Exception:                       # noqa: BLE001 - an older ComfyUI has no log endpoint
        entries = None
    return piflow_hint(old_loaded, piflow_copies(dirs), load_failures(entries or []), dirs)
