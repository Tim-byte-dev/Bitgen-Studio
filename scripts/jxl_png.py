"""bitGen Studio — scripts/jxl_png.py (2.479.0): a JPEG XL picture as a PNG for the Python side.

Tim (verbatim): "add jxl file support".

Python's picture library and ComfyUI's image loader cannot read JPEG XL, and ffmpeg only can when it was built with
libjxl. Every place that hands a picture on (the ComfyUI uploads in worker.py / comfy_client.py, the timeline's
compile, the file dialog's thumbnails, Select Subject) calls png_for(path): a .jxl comes back as the path of a PNG of
it (decoded by the studio's own codec - node scripts/jxl-cli.js topng, cached by lib/jxl.js), anything else as it was.
The Node program: $BITGEN_NODE (the server sets it for its workers), else `node` on the PATH.
"""
import os
import shutil
import subprocess
from pathlib import Path

CLI = Path(__file__).resolve().parent / "jxl-cli.js"


def is_jxl(path) -> bool:
    return str(path or "").lower().endswith(".jxl")


def node_exe():
    return os.environ.get("BITGEN_NODE") or shutil.which("node") or shutil.which("node.exe")


def png_for(path) -> str:
    """a .jxl -> the path of its PNG (cached); anything else -> itself. Raises RuntimeError when it cannot be read."""
    p = str(path)
    if not is_jxl(p):
        return p
    node = node_exe()
    if not node:
        raise RuntimeError("a JPEG XL picture needs Node.js to be read (set BITGEN_NODE or put node on the PATH): " + p)
    r = subprocess.run([node, str(CLI), "topng", p], capture_output=True, text=True,
                       stdin=subprocess.DEVNULL, timeout=600)
    out = (r.stdout or "").strip().splitlines()
    if r.returncode != 0 or not out or not Path(out[-1]).exists():
        raise RuntimeError("could not read the JPEG XL picture " + Path(p).name + ": " + ((r.stderr or "").strip().splitlines() or ["?"])[-1])
    return out[-1]


if __name__ == "__main__":
    import sys
    print(png_for(sys.argv[1]))
