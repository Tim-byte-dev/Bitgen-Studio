#!/usr/bin/env python3
"""bitGen Studio — 2.574.0 units: the picture worker's steps. image_worker.run splits sd-cli's \\r progress bar into lines
(each redraw reaches the job as it happens); scripts/comfy_progress.queue_live / wait_live (the ControlNet stage's
queue + wait pair) listen on ComfyUI's websocket like run() does. Run: python3 scripts/test-steps574.py
Tim: "show step number of steps for all generations(image,music,video) in all places that show it"."""
import io
import os
import sys
import contextlib

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
sys.path.insert(0, ROOT); sys.path.insert(0, os.path.join(ROOT, "misc"))
import image_worker as IW                                 # noqa: E402
import comfy_progress as CP                               # noqa: E402

PASS = FAIL = 0


def check(name, cond, got=None):
    global PASS, FAIL
    if cond:
        PASS += 1
        print("PASS: " + name)
    else:
        FAIL += 1
        print("FAIL: " + name + ("\n      " + repr(got)[:700] if got is not None else ""))


# 1 sd-cli's bar: three \r redraws then a newline -> three lines, each one a step
prog = ("import sys,time\n"
        "for i in (1,2,3):\n"
        "    sys.stdout.write('\\r  |' + '=' * i * 5 + '>  | %d/3 - 1.20s/it' % i); sys.stdout.flush(); time.sleep(0.05)\n"
        "sys.stdout.write('\\nsaved out.png\\n')\n")
out = io.StringIO()
with contextlib.redirect_stdout(out):
    rc = IW.run([sys.executable, "-c", prog], echo_cmd=False)
lines = [x for x in out.getvalue().splitlines() if x.strip()]
check("image_worker.run: sd-cli's \\r redraws become one line each (1/3, 2/3, 3/3) - then the rest", rc == 0
      and [l.strip().split("|")[-1].strip() for l in lines[:3]] == ["1/3 - 1.20s/it", "2/3 - 1.20s/it", "3/3 - 1.20s/it"]
      and lines[-1] == "saved out.png", lines)


# 2 queue_live / wait_live: the listener runs from the queue until the wait ends, with the same client id
class FakeCC:
    def __init__(self):
        self.client = None

    def queue(self, base, g, client_id=None):
        self.client = client_id
        return "pid1"

    def wait(self, base, pid, on_tick=None, timeout=0):
        for el in (10, 20):
            on_tick(el)
        return {"ok": True}


said = []
started = {}
real_listen = CP.listen


def fake_listen(base, client, stop, pidbox, g, seen, say):
    started["client"] = client
    stop.wait(5)
    started["stopped"] = stop.is_set()


CP.listen = fake_listen
try:
    cc = FakeCC()
    pid = CP.queue_live(cc, "http://x", {"1": {}}, said.append)
    live = "pid1" in CP._LIVE
    outs = CP.wait_live(cc, "http://x", pid, said.append)
    import time
    time.sleep(0.2)
finally:
    CP.listen = real_listen
check("queue_live / wait_live: queued with the listener's client id, the listener stopped after the wait, the outputs back",
      pid == "pid1" and live and outs == {"ok": True} and started.get("client") == cc.client and started.get("stopped") and "pid1" not in CP._LIVE
      and "[worker] queued as pid1" in said, (started, said))

print(f"\n{PASS} passed, {FAIL} failed")
print("RESULT: " + ("FAIL" if FAIL else "PASS") + f" ({PASS} passed, {FAIL} failed)")
sys.exit(1 if FAIL else 0)
