#!/usr/bin/env python3
"""bitGen Studio — 2.348.0: an all-black render is caught, not filed as done.
Run: python3 scripts/test-blackcheck.py
Tim: "it rendered once, but now it is only rendering a black video"."""
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import black_check as BC  # noqa: E402

P = F = 0


def check(name, ok, extra=None):
    global P, F
    if ok:
        P += 1
        print("PASS: " + name)
    else:
        F += 1
        print("FAIL: " + name + ("" if extra is None else f" :: {extra}"))


if shutil.which("ffmpeg"):
    T = Path(tempfile.mkdtemp(prefix="blk-"))
    mk = lambda src, out: subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", src, "-t", "2",  # noqa: E731
                                          "-pix_fmt", "yuv420p", str(T / out)], check=True)
    mk("color=c=black:s=192x108:r=24", "black.mp4")
    mk("testsrc2=s=192x108:r=24", "live.mp4")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=black:s=192x108:r=24:d=0.5", "-f", "lavfi",
                    "-i", "testsrc2=s=192x108:r=24:d=1.5", "-filter_complex", "[0][1]concat=n=2:v=1[v]", "-map", "[v]",
                    "-pix_fmt", "yuv420p", str(T / "fadein.mp4")], check=True)
    check("an all-black render is black", BC.all_black(T / "black.mp4"), BC.black_ratio(T / "black.mp4"))
    check("a live render is not", not BC.all_black(T / "live.mp4") and BC.black_ratio(T / "live.mp4") < 0.05)
    check("a render that STARTS black (a fade-in) is not", not BC.all_black(T / "fadein.mp4"), BC.black_ratio(T / "fadein.mp4"))
    check("an unreadable file never blocks", BC.all_black(T / "nope.mp4") is False)
    shutil.rmtree(T, ignore_errors=True)
else:
    print("(no ffmpeg - skipped)")
check("the words: all black, NaNs, retry, restart ComfyUI", all(x in BC.reason("Viggle") for x in ("Viggle render came back ALL BLACK", "NaNs", "Retry with a new seed", "restart ComfyUI")))
for w in ("ripple_worker.py", "viggle_worker.py"):
    s = (ROOT / w).read_text(encoding="utf-8")
    check(f"{w}: a black take fails in words before it is filed", "if BC.all_black(raw):" in s and "fail(BC.reason(" in s)
print(f"RESULT: {P} passed, {F} failed")
sys.exit(1 if F else 0)
