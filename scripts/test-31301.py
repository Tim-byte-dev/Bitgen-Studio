#!/usr/bin/env python3
"""bitGen Studio — 3.13.1: a ComfyUI that crashes in the middle of a render is said in words (scripts/comfy_crash.py), with the
end of its console (<app>/comfy.log), instead of a Python traceback from the worker's /history poll.
Tim's pi-H3 (2 steps) log: "step 2/2 — SamplerCustomAdvanced" then "ConnectionResetError: [WinError 10054] An existing connection
was forcibly closed by the remote host" and "worker exited with code 1"."""
import socket
import sys
import tempfile
import urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import comfy_crash as cx  # noqa: E402

passed = failed = 0


def check(name, ok, got=None):
    global passed, failed
    if ok:
        passed += 1
        print("PASS: " + name)
    else:
        failed += 1
        print("FAIL: " + name + ("" if got is None else "\n      got " + str(got)[:600]))


check("is_gone: a reset / refused / timeout / URLError = ComfyUI not answering",
      cx.is_gone(ConnectionResetError(10054, "forcibly closed")) and cx.is_gone(ConnectionRefusedError()) and cx.is_gone(socket.timeout())
      and cx.is_gone(urllib.error.URLError("refused")))
check("…an HTTP answer (404 / 500) is NOT gone - ComfyUI answered", not cx.is_gone(urllib.error.HTTPError("u", 500, "x", {}, None)) and not cx.is_gone(ValueError("x")))
with tempfile.TemporaryDirectory() as t:
    log = Path(t) / "comfy.log"
    log.write_text("\n".join(["Starting server", "To see the GUI go to: http://127.0.0.1:8188", "got prompt"] + [f"100%|#####| {i}/2" for i in range(40)]
                             + ["Traceback (most recent call last):", '  File "piflow/modules/architectures/dwd_head.py", line 88, in forward',
                                "torch.OutOfMemoryError: CUDA out of memory. Tried to allocate 9.20 GiB", "Exception in thread Thread-3"]), encoding="utf-8")
    tl = cx.log_tail(t)
    check("log_tail: the error lines from the end of <app>/comfy.log", tl[-2].startswith("torch.OutOfMemoryError: CUDA out of memory") and tl[0].startswith("Traceback") and len(tl) == 3, tl)
    log.write_text("Starting server\nline a\nline b\n", encoding="utf-8")
    check("…no error lines: its last lines", cx.log_tail(t, 2) == ["line a", "line b"])
    check("…no comfy.log (ComfyUI not started by bitGen): []", cx.log_tail(Path(t) / "nope") == [])
w = cx.explain("step 2/2 of SamplerCustomAdvanced", ["torch.OutOfMemoryError: CUDA out of memory"], pi=True)
check("explain: it crashed, right after the last step said, its console's words, pi-H3's DWD step and what to try, start ComfyUI again",
      "it crashed" in w and "right after step 2/2 of SamplerCustomAdvanced" in w and "CUDA out of memory" in w and "DWD head" in w and "shorter clip" in w and "Start ComfyUI again" in w, w)
check("…no log: where to look; no pi-H3 words on another render", "ComfyUI docker" in cx.explain("", [], False) and "DWD" not in cx.explain("", [], False))
wk = (ROOT / "misc" / "worker.py").read_text(encoding="utf-8")
cp = (ROOT / "scripts" / "comfy_progress.py").read_text(encoding="utf-8")
check("the worker's /history poll: 5 misses in a row = gone -> the words (not a traceback); one miss is a blip",
      "if _cx is None or not _cx.is_gone(e):" in wk and "if gone < 5:" in wk and 'fail(_cx.explain(seen.get("last", ""), _cx.log_tail(Path(__file__).resolve().parent.parent),' in wk)
check("the progress listener remembers the last step / node it said (what a crash came after)", cp.count('seen["last"] = f"step {v}/{m}"') == 2 and 'seen["last"] = f"it started {ct}"' in cp)
print(f"\n{passed} passed, {failed} failed")
print(f"RESULT: {failed} failed")
sys.exit(1 if failed else 0)
