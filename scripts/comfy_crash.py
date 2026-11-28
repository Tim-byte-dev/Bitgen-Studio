"""bitGen Studio — scripts/comfy_crash.py (3.13.1): what to say when ComfyUI stops answering in the middle of a render.

Tim's pi-H3 (2 steps) log: "step 2/2 - SamplerCustomAdvanced", then the worker died with a Python traceback -
"ConnectionResetError: [WinError 10054] An existing connection was forcibly closed by the remote host" from its /history
poll. ComfyUI itself had gone (crashed) right after the sampler; the traceback said nothing a user can act on, and the reason
was in ComfyUI's own console, which nobody saw.

  is_gone(exc)                  a network error that means ComfyUI is not answering (reset / refused / timed out)
  log_tail(app_base, n)         the last lines of <app>/comfy.log (ComfyUI's console when bitGen started it) - the error ones
                                first: Traceback / Error / Exception / CUDA / out of memory / Killed / exit code
  explain(last, tail, pi)       the words: it crashed (after which step), its console's last words, what to try
Pure apart from reading the log file (scripts/test-31301.py).
"""
import re
import socket
import urllib.error
from pathlib import Path

ERR_RX = re.compile(r"Traceback|Error|Exception|CUDA|out of memory|Killed|Segmentation|Access violation|exit code|"
                    r"0xC0000005|cudaError|RuntimeError|MemoryError|torch\.OutOfMemory|FATAL|Fatal", re.I)


def is_gone(exc):
    """a ConnectionReset / refused / timeout - ComfyUI not answering (not an HTTP error answer)"""
    if isinstance(exc, urllib.error.HTTPError):
        return False
    if isinstance(exc, urllib.error.URLError):
        return True
    return isinstance(exc, (ConnectionError, socket.timeout, TimeoutError, OSError))


def log_tail(app_base, n=12, path=None):
    """ComfyUI's console (<app>/comfy.log) - its error lines from the end, else its last lines; [] when there is none"""
    p = Path(path) if path else Path(app_base) / "comfy.log"
    try:
        lines = [ln.rstrip() for ln in p.read_text(encoding="utf-8", errors="replace").splitlines() if ln.strip()]
    except OSError:
        return []
    last = lines[-300:]
    errs = [ln for ln in last if ERR_RX.search(ln)]
    pick = errs[-n:] if errs else last[-n:]
    return [ln[:300] for ln in pick]


def explain(last="", tail=None, pi=False):
    """-> the words (one string) for a ComfyUI that stopped answering"""
    s = "ComfyUI stopped answering in the middle of the render - it crashed (its process ended)"
    if last:
        s += f", right after {last}"
    s += ". "
    if tail:
        s += "Its console's last words (comfy.log): " + " | ".join(tail) + ". "
    else:
        s += "Its console (the ComfyUI docker, or the window it runs in) says why. "
    if pi:
        s += ("On pi-H3 the last step also predicts the frames (the DWD head) - a crash there is memory: try a shorter clip or a "
              "smaller size, or the other step count. ")
    s += "Start ComfyUI again, then render again."
    return s
