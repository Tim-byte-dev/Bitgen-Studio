#!/usr/bin/env python3
"""Unit tests for the ComfyUI VRAM helpers in scripts/comfy_client.py (2.98.0).

Run: python3 scripts/test-comfyfree.py

THE BUG THESE EXIST FOR. "15 sec videos used to work. 10 seconds work but 15
doesn't." The sampler died with torch.OutOfMemoryError on a 362-frame ref2va
that had rendered before, because ComfyUI keeps every model it has touched
resident and evicts on its own estimate — after a still, a song and a shorter
clip the card was full of things nobody was using. The fix is to ask ComfyUI
to unload everything (POST /free) BEFORE each generation, and to say what an
OOM means when it still happens.

Two things here are easy to break silently and would only show on Tim's card:
  * /free only SETS FLAGS. If the client queues the next instant, ComfyUI can
    run the graph FIRST and unload AFTER. free_memory() must wait for the
    unload to land before it returns, and the tests check it does.
  * an explicit `false` is the only thing that turns the clear off — a missing
    key, an old config.json, a null: all ON. Getting this backwards makes the
    fix vanish on every upgrade.
A tiny in-process HTTP server plays ComfyUI: it answers /free with the EMPTY
200 the real one sends, and its fake card only reports the freed figure after
a delay, so a client that does not wait sees the OLD figure.
"""
import json
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import comfy_client as C  # noqa: E402

PASS = FAIL = 0


def check(name, cond, got=None):
    global PASS, FAIL
    if cond:
        PASS += 1
        print("PASS:", name)
    else:
        FAIL += 1
        print("FAIL:", name, "" if got is None else f"\n      got {got!r}")


GB = 2 ** 30
STATE = {"free_calls": 0, "free_body": None, "freed_at": None, "free_status": 200,
         "devices": True, "prompts": 0, "prompt_seen_free": []}
FREE_DELAY = 1.2      # seconds before the fake card "sees" the unload


class Fake(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _j(self, obj, code=200):
        b = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):
        if self.path == "/system_stats":
            if not STATE["devices"]:
                return self._j({"ok": True})
            landed = STATE["freed_at"] is not None and time.time() - STATE["freed_at"] >= FREE_DELAY
            free = 30 * GB if landed else 3 * GB
            return self._j({"devices": [{"name": "fake", "type": "cuda", "index": 0,
                                         "vram_total": 32 * GB, "vram_free": free}]})
        self._j({"error": "nf"}, 404)

    def do_POST(self):
        n = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(n)
        if self.path == "/free":
            if STATE["free_status"] != 200:
                return self._j({"error": "no such route"}, STATE["free_status"])
            STATE["free_calls"] += 1
            STATE["free_body"] = json.loads(body or b"{}")
            STATE["freed_at"] = time.time()
            self.send_response(200)          # ComfyUI: web.Response(status=200), no body
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        if self.path == "/prompt":
            STATE["prompts"] += 1
            landed = STATE["freed_at"] is not None and time.time() - STATE["freed_at"] >= FREE_DELAY
            STATE["prompt_seen_free"].append(landed)
            STATE["freed_at"] = None            # a render fills the card again
            return self._j({"prompt_id": "p%d" % STATE["prompts"]})
        self._j({"error": "nf"}, 404)


srv = ThreadingHTTPServer(("127.0.0.1", 0), Fake)
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f"http://127.0.0.1:{srv.server_address[1]}"

# ----------------------------------------------------------- the switch
check("no config at all means ON", C.free_before_gen({}) is True)
check("no engine.comfy block means ON", C.free_before_gen({"engine": {}}) is True)
check("a null value means ON (an old config.json must not turn it off)",
      C.free_before_gen({"engine": {"comfy": {"free_before_gen": None}}}) is True)
check("an explicit true is ON", C.free_before_gen({"engine": {"comfy": {"free_before_gen": True}}}) is True)
check("ONLY an explicit false is OFF",
      C.free_before_gen({"engine": {"comfy": {"free_before_gen": False}}}) is False)
check("a stray string is not false",
      C.free_before_gen({"engine": {"comfy": {"free_before_gen": "no"}}}) is True)

# ------------------------------------------------------------- readouts
devs = C.vram(BASE)
check("vram() reads the device list", devs and devs[0]["total"] == 32 * GB and devs[0]["free"] == 3 * GB, devs)
check("fmt_vram prints GB with one decimal", C.fmt_vram(devs) == "3.0/32.0 GB free", C.fmt_vram(devs))
check("fmt_vram says 'unknown' for nothing", C.fmt_vram([]) == "unknown")
check("vram() is [] against a dead URL, never a traceback", C.vram("http://127.0.0.1:9") == [])

# ------------------------------------------------------- free_memory()
t0 = time.time()
before, after = C.free_memory(BASE)
took = time.time() - t0
check("/free was POSTed once", STATE["free_calls"] == 1, STATE["free_calls"])
check("...asking for BOTH unload_models and free_memory",
      STATE["free_body"] == {"unload_models": True, "free_memory": True}, STATE["free_body"])
check("the empty 200 ComfyUI sends is not an error", True)
check("before = the full card", before and before[0]["free"] == 3 * GB, before)
check("after = the freed card: it WAITED for the unload to land",
      after and after[0]["free"] == 30 * GB, after)
check("...and that wait was the delay, not the 15 s ceiling", 1.0 <= took < 6.0, took)
# the race this guards: queue immediately after and the fake must have landed
STATE["freed_at"] = None
C.free_memory(BASE)
C.http_json(f"{BASE}/prompt", {"prompt": {}})
check("a /prompt sent after free_memory() returns lands AFTER the unload",
      STATE["prompt_seen_free"] == [True], STATE["prompt_seen_free"])

# a build with no devices in /system_stats (or the e2e stub before 2.98.0):
# still one poll, still returns, still no crash
STATE["devices"] = False
t0 = time.time()
b2, a2 = C.free_memory(BASE)
took = time.time() - t0
STATE["devices"] = True
check("no device list: free_memory() still returns quickly and empty", b2 == [] and a2 == [] and took < 5, (b2, a2, took))

# ------------------------------------------------- clear_before_gen()
lines = []
say = lines.append
C.http_json(f"{BASE}/prompt", {"prompt": {}})       # a render happened: card full
n0 = STATE["free_calls"]
check("clear_before_gen runs and returns True when ON",
      C.clear_before_gen(BASE, {}, say) is True and STATE["free_calls"] == n0 + 1, lines)
check("...and logs the before -> after line the e2e greps for",
      any(l.startswith("[comfy] VRAM: 3.0/32.0 GB free -> 30.0/32.0 GB free") for l in lines), lines)
lines.clear()
n0 = STATE["free_calls"]
r = C.clear_before_gen(BASE, {"engine": {"comfy": {"free_before_gen": False}}}, say)
check("OFF: returns False, no /free, and SAYS it is off (with where to turn it on)",
      r is False and STATE["free_calls"] == n0
      and lines == ["[comfy] VRAM clear before generation is OFF (Settings -> ComfyUI)"], lines)
lines.clear()
STATE["free_status"] = 404          # an old ComfyUI without the route
r = C.clear_before_gen(BASE, {}, say)
STATE["free_status"] = 200
check("a ComfyUI without /free: never raises, says so, render goes ahead",
      r is False and len(lines) == 1 and lines[0].startswith("[comfy] VRAM clear failed (")
      and "rendering anyway" in lines[0], lines)
lines.clear()
r = C.clear_before_gen("http://127.0.0.1:9", {}, say)
check("a dead URL: never raises either", r is False and "rendering anyway" in lines[0], lines)

# ----------------------------------------------------------- the words
# Tim's event, verbatim in shape
OOM = [["execution_start", {"prompt_id": "0da7", "timestamp": 1}],
       ["execution_error", {"prompt_id": "0da7", "node_id": "125",
                            "node_type": "SamplerCustomAdvanced", "executed": ["126", "136", "129"],
                            "exception_message": "Allocation on device \nThis error means you ran out of memory on your GPU.\n\nTIPS: If the workflow worked before you might have accidentally set the batch_size to a large number.",
                            "exception_type": "torch.OutOfMemoryError",
                            "traceback": ["  File \"E:\\ComfyUI\\execution.py\", line 545, in execute"]}]]
E22 = [["execution_error", {"node_type": "SamplerCustomAdvanced",
                            "exception_message": "[Errno 22] Invalid argument",
                            "exception_type": "OSError"}]]
OTHER = [["execution_error", {"node_type": "LoadImage", "exception_message": "file not found",
                              "exception_type": "FileNotFoundError"}]]
check("is_oom recognises torch.OutOfMemoryError", C.is_oom(OOM))
check("is_oom recognises the plain 'CUDA out of memory' wording",
      C.is_oom([["execution_error", {"exception_message": "CUDA out of memory. Tried to allocate 20 GiB"}]]))
check("is_oom is not fooled by an unrelated error", not C.is_oom(OTHER) and not C.is_oom(E22))
check("is_oom never raises on junk", C.is_oom(None) is False and C.is_oom(object) is False)
adv = C.explain_execution_error(OOM)
check("an OOM gets the OOM advice", adv == C.OOM_ADVICE and adv.startswith("\n\n[worker] The GPU ran out of memory"))
check("...naming force split at 10 s FIRST (10 s clips render; least damage)",
      "force split" in adv and adv.index("force split") < adv.index("smaller frame size"))
check("...the frame size, other GPU users, and --reserve-vram as the other levers",
      "--reserve-vram" in adv and "status bar" in adv and "CUDA_VISIBLE_DEVICES" in adv)
check("...every line carries the [worker] prefix the UI parses",
      all(l.startswith("[worker]") for l in adv.strip().split("\n")), [l for l in adv.strip().split("\n") if not l.startswith("[worker]")][:2])
check("...and it never blames the graph or the nodes",
      "MiniMax H3 nodes" not in adv and "models folders" not in adv)
check("Errno 22 still gets ITS advice, untouched", "ComfyUI-on-Windows stderr crash" in C.explain_execution_error(E22))
check("an unrecognised error gets no speculation", C.explain_execution_error(OTHER) == "")

# --- is_retryable_sampler_failure (2.99.1): OOM and sampler-[Errno 22] retry
E22_SAMPLER = [["execution_error", {"node_type": "SamplerCustomAdvanced",
                "exception_type": "OSError", "exception_message": "[Errno 22] Invalid argument\n"}]]
E22_LOADER = [["execution_error", {"node_type": "LoadImage",
                "exception_type": "OSError", "exception_message": "[Errno 22] Invalid argument\n"}]]
check("retryable: a real OOM", C.is_retryable_sampler_failure(OOM))
check("retryable: OSError [Errno 22] IN THE SAMPLER (the disguised OOM)",
      C.is_retryable_sampler_failure(E22_SAMPLER))
check("NOT retryable: [Errno 22] in a NON-sampler node (the genuine stderr case)",
      not C.is_retryable_sampler_failure(E22_LOADER))
check("NOT retryable: an ordinary sampler error", not C.is_retryable_sampler_failure(OTHER))
check("retryable never raises on junk",
      C.is_retryable_sampler_failure(None) is False and C.is_retryable_sampler_failure([{"a": object}]) is False)

# --- accelerator failures (2.129.0): which injected patch does this blame? ---
# The two shapes come from Tim's live runs, verbatim.
SPECTRUM_FAIL = [["execution_start", {"prompt_id": "p"}],
                 ["execution_error", {
                     "node_id": "333", "node_type": "SamplerCustomAdvanced",
                     "exception_type": "TypeError",
                     "exception_message": ("FinalLayer.forward() missing 3 required "
                                           "positional arguments: 'sigma', "
                                           "'sample_sigmas', and 'shifts'"),
                     "traceback": ["  File \"comfy/ldm/minimax/model.py\", line 300, in forward"]}]]
SAGE_FAIL = [["execution_error", {
    "node_id": "h3sage", "node_type": "PathchSageAttentionKJ",
    "exception_type": "ImportError",
    "exception_message": "DLL load failed while importing _fused: The specified module could not be found.",
    "traceback": ["  File \"sageattention/core.py\", line 20, in <module>"]}]]
BOTH = {"h3sage": "PathchSageAttentionKJ", "h3spectrum": "SpectrumApplyMiniMaxH3"}
SAGE_ONLY = {"h3sage": "PathchSageAttentionKJ"}
MEMEFF_ONLY = {"h3sage": "MiniMaxH3MemoryEfficientSageAttentionPatch"}

check("H3 internals mismatch: the FinalLayer.forward() signature TypeError",
      C.is_h3_internals_mismatch(SPECTRUM_FAIL))
check("H3 internals mismatch: the keyword-argument form of the same drift",
      C.is_h3_internals_mismatch([["execution_error", {
          "exception_type": "TypeError",
          "exception_message": "forward() got an unexpected keyword argument 'sample_sigmas'"}]]))
check("NOT a mismatch: an ordinary TypeError",
      not C.is_h3_internals_mismatch([["execution_error", {
          "exception_type": "TypeError",
          "exception_message": "unsupported operand type(s) for +: 'int' and 'str'"}]]))
check("NOT a mismatch: an OOM or a plain sampler error",
      not C.is_h3_internals_mismatch(OOM) and not C.is_h3_internals_mismatch(OTHER))
check("is_sage_failure: the patch node itself raised (the wrong-torch wheel)",
      C.is_sage_failure(SAGE_FAIL))
check("is_sage_failure: text naming the library is enough",
      C.is_sage_failure([["execution_error", {"exception_message": "No module named 'sageattention'"}]]))
check("is_sage_failure does NOT claim the H3 signature error (Sage patches attention, not FinalLayer)",
      not C.is_sage_failure(SPECTRUM_FAIL))
check("is_sage_failure is not fooled by an unrelated error",
      not C.is_sage_failure(OTHER) and not C.is_sage_failure(OOM))
check("blame: the H3 signature error names SPECTRUM when Spectrum is in the graph",
      C.failed_accelerator(SPECTRUM_FAIL, BOTH) == "h3spectrum")
check("blame: with only the GENERIC sage node, the H3 signature error blames nothing "
      "(removing it would not fix the error)",
      C.failed_accelerator(SPECTRUM_FAIL, SAGE_ONLY) == "")
check("blame: with only KJNodes' H3 memeff patch, THAT is the pack reaching into the model",
      C.failed_accelerator(SPECTRUM_FAIL, MEMEFF_ONLY) == "h3sage")
check("blame: a sage failure names sage, never spectrum",
      C.failed_accelerator(SAGE_FAIL, BOTH) == "h3sage")
check("blame: nothing injected, nothing blamed",
      C.failed_accelerator(SAGE_FAIL, {}) == "" and C.failed_accelerator(SPECTRUM_FAIL, {}) == "")
check("blame: an ordinary error blames no accelerator",
      C.failed_accelerator(OTHER, BOTH) == "" and C.failed_accelerator(OOM, BOTH) == "")
check("blame never raises on junk",
      C.failed_accelerator(None, BOTH) == "" and C.failed_accelerator(SAGE_FAIL, None) == "")
h3adv = C.explain_execution_error(SPECTRUM_FAIL)
check("the H3 signature error gets ITS advice, not the Sage advice",
      h3adv == C.H3_INTERNALS_ADVICE and "MiniMaxH3SigmaShift" in h3adv
      and "Install Sage attention" not in h3adv)
check("...it says the graph and the loaders are not at fault",
      "loaders and the references are fine" in h3adv)
check("...every line carries the [worker] prefix the UI parses",
      all(l.startswith("[worker]") for l in h3adv.strip().split("\n")))
check("the sage wheel failure still gets the Sage install advice",
      "Install" in C.explain_execution_error(SAGE_FAIL)
      and "Sage attention" in C.explain_execution_error(SAGE_FAIL))

# ---- execution_culprits (2.143.1) -----------------------------------------
# The worker's execution-error verdict used to be generic advice ("check the
# MiniMax H3 nodes exist... model files in ComfyUI's OWN folders") - wrong by
# construction, since both of those are /prompt VALIDATION failures that never
# reach execution. Tim received exactly that advice on a real scene card. The
# verdict now names the node ComfyUI's own event blames.
GENERIC = [["execution_start", {"prompt_id": "p", "timestamp": 1}],
           ["execution_error", {"prompt_id": "p", "node_id": "42",
                                "node_type": "VAEDecode",
                                "exception_type": "RuntimeError",
                                "exception_message": "expected 16 channels\nsecond line",
                                "traceback": ["  File x"]}]]
culps = C.execution_culprits(GENERIC)
check("culprits: the blamed node, class and exception come out of the event",
      culps == [("42", "VAEDecode", "RuntimeError", "expected 16 channels")])
check("culprits: only the FIRST line of a multi-line exception_message (a card line)",
      "second line" not in culps[0][3])
check("culprits: an event with no node fields is not a culprit",
      C.execution_culprits([["execution_start", {"prompt_id": "p"}]]) == [])
check("culprits: the live spectrum shape names the sampler node it really blamed",
      C.execution_culprits(SPECTRUM_FAIL)[0][:2] == ("333", "SamplerCustomAdvanced"))
check("culprits: junk never raises",
      C.execution_culprits(None) == [] and C.execution_culprits("x") == []
      and C.execution_culprits([["e", None], "y"]) == [])
check("culprits: a missing node_id still yields the class (never drops the event)",
      C.execution_culprits([["execution_error", {"node_type": "LoadImage",
                             "exception_message": "file not found"}]])
      == [("?", "LoadImage", "", "file not found")])

# ---- culprit_details (2.153.0, Tim's preflight card) -----------------------
# "H3 preflight error: 2 error(s), 2 warning(s), 3 scene(s)." names a COUNT
# and nothing else - the itemized lines live on the FOLLOWING lines of the
# same exception message, and they must reach the log and the card.
PREFLIGHT = [["execution_start", {"prompt_id": "p", "timestamp": 1}],
             ["execution_error", {"prompt_id": "p", "node_id": "17",
                                  "node_type": "MiniMaxH3ChainLoopStart",
                                  "exception_type": "ValueError",
                                  "exception_message":
                                      "H3 preflight error: 2 error(s), 2 warning(s), 3 scene(s).\n"
                                      "error: clip_02 length 40 is invalid\n"
                                      "error: unknown reference tag 'hero_face'\n"
                                      "warning: clip_03 has no dialogue\n"
                                      "warning: clip_01 is very short",
                                  "traceback": ["  File chain.py, line 9"]}]]
dets = C.culprit_details(PREFLIGHT)
check("details: the itemized lines after the summary, per node",
      dets == [("17", ["error: clip_02 length 40 is invalid",
                       "error: unknown reference tag 'hero_face'",
                       "warning: clip_03 has no dialogue",
                       "warning: clip_01 is very short"])], dets)
check("details: a one-line message falls back to the traceback tail",
      C.culprit_details(GENERIC) == [("42", ["second line"])]
      and C.culprit_details([["execution_error", {"node_id": "5",
            "node_type": "X", "exception_message": "boom",
            "traceback": ["  File a", "  File b", "raise ValueError('boom')", ""]}]])
      == [("5", ["File a", "File b", "raise ValueError('boom')"])],
      C.culprit_details(GENERIC))
check("details: junk never raises",
      C.culprit_details(None) == [] and C.culprit_details("x") == [])

srv.shutdown()
print("=======================")
print(f"RESULT: {PASS} passed, {FAIL} failed")
sys.exit(1 if FAIL else 0)
