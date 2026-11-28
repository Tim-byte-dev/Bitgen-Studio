#!/usr/bin/env python3
"""bitGen Studio — 3.11.0: misc/amt_worker.py + misc/amt_run.py (✍ Continue, mode "amt") end to end, with stand-ins for what is
not here: torch, transformers and the anticipation package (its vocabulary's numbers, a sampler that records what it was given
and writes notes for whichever instruments the instrument mask leaves). Tim: "okay let go with 1".

With AMT_REAL_PY (a Python with torch + transformers) and AMT_SRC (a clone of github.com/jthickstun/anticipation) set, it ALSO
runs the REAL generate() with a rule-driven fake model (no weights): the encoding, the one-instrument mask and the progress
hook against the real code."""
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WORKER = ROOT / "misc" / "amt_worker.py"
passed = failed = 0


def check(name, ok, got=None):
    global passed, failed
    if ok:
        passed += 1
        print("PASS: " + name)
    else:
        failed += 1
        print("FAIL: " + name + ("" if got is None else "\n      got " + str(got)[:700]))


CONFIG = """TIME_RESOLUTION = 100
MAX_TIME = 100 * 100
MAX_DUR = 100 * 10
MAX_PITCH = 128
MAX_INSTR = 129
MAX_NOTE = MAX_PITCH * MAX_INSTR
DELTA = 5
"""
VOCAB = """from anticipation.config import *
TIME_OFFSET = 0
DUR_OFFSET = TIME_OFFSET + MAX_TIME
NOTE_OFFSET = DUR_OFFSET + MAX_DUR
REST = NOTE_OFFSET + MAX_NOTE
CONTROL_OFFSET = NOTE_OFFSET + MAX_NOTE + 1
VOCAB_SIZE = CONTROL_OFFSET + MAX_TIME + MAX_DUR + MAX_NOTE + 3
"""
SAMPLE = r'''
import json, os
from anticipation.config import *
from anticipation.vocab import *
from tqdm import tqdm

def instr_logits(logits, full_history):
    return logits

class L:
    """enough of a tensor for the mask: logits[a:b] = -inf"""
    def __init__(self, n): self.v = [0.0] * n
    def __setitem__(self, k, x):
        if isinstance(k, slice):
            for i in range(*k.indices(len(self.v))): self.v[i] = x
        else: self.v[k] = x

def generate(model, start_time, end_time, inputs=None, controls=None, top_p=1.0, debug=False, delta=DELTA*TIME_RESOLUTION):
    inputs = inputs or []
    lg = instr_logits(L(VOCAB_SIZE), inputs)
    allowed = [i for i in range(MAX_INSTR) if lg.v[NOTE_OFFSET + i * MAX_PITCH + 60] != -float("inf")]
    s, e = int(start_time * TIME_RESOLUTION), int(end_time * TIME_RESOLUTION)
    if os.environ.get("AMT_FAKE_LOG"):
        json.dump({"start": s, "end": e, "top_p": top_p, "inputs": inputs, "allowed": allowed[:5], "n_allowed": len(allowed), "model": model.name},
                  open(os.environ["AMT_FAKE_LOG"], "w"))
    with tqdm(range(e - s)) as pg:
        out = list(inputs)
        for k, ins in enumerate([allowed[0], allowed[-1]]):
            t = s + 50 * k
            out += [TIME_OFFSET + t, DUR_OFFSET + 40, NOTE_OFFSET + ins * MAX_PITCH + 62 + k]
            pg.update(50)
        out += [TIME_OFFSET + s + 120, DUR_OFFSET + 10, REST]          # a rest: not a note
        pg.update(e - s - 100)
    return out
'''
TORCH = """import os
def manual_seed(s):
    if os.environ.get("AMT_FAKE_SEED"):
        open(os.environ["AMT_FAKE_SEED"], "w").write(str(s))
class cuda:
    @staticmethod
    def is_available():
        return False
"""
TRANSFORMERS = """import json, os
class _M:
    def __init__(self, name): self.name = name
    def to(self, d): return self
    def eval(self): return self
class AutoModelForCausalLM:
    @staticmethod
    def from_pretrained(name, **kw):
        if os.environ.get("AMT_FAKE_LOAD"):
            json.dump({"name": name, "kw": kw, "offline": os.environ.get("HF_HUB_OFFLINE")}, open(os.environ["AMT_FAKE_LOAD"], "w"))
        return _M(name)
"""


def make_fake(src):
    """the stand-in anticipation package + torch / transformers / tqdm in <src> (also: --make-fake <dir> for a by-hand run)"""
    src = Path(src)
    (src / "anticipation").mkdir(parents=True, exist_ok=True)
    (src / "anticipation" / "__init__.py").write_text("")
    (src / "anticipation" / "config.py").write_text(CONFIG)
    (src / "anticipation" / "vocab.py").write_text(VOCAB)
    (src / "anticipation" / "sample.py").write_text(SAMPLE)
    (src / "torch.py").write_text(TORCH)
    (src / "transformers.py").write_text(TRANSFORMERS)
    (src / "tqdm.py").write_text("class tqdm:\n    def __init__(self, it=None, **k): pass\n    def __enter__(self): return self\n    def __exit__(self, *a): return False\n    def update(self, n=1): print('REAL TQDM')\n")


if len(sys.argv) == 3 and sys.argv[1] == "--make-fake":
    make_fake(sys.argv[2])
    sys.exit(0)


def run_worker(job, cwd, env):
    jf = Path(cwd) / "job.json"
    jf.write_text(json.dumps(job), encoding="utf-8")
    r = subprocess.run([sys.executable, str(WORKER), str(jf)], cwd=cwd, capture_output=True, text=True, env=dict(os.environ, **env), timeout=120)
    return r.returncode, r.stdout + r.stderr


with tempfile.TemporaryDirectory() as t:
    t = Path(t)
    src = t / "anticipation"
    make_fake(src)
    logs = {k: str(t / (k + ".json")) for k in ("AMT_FAKE_LOG", "AMT_FAKE_LOAD", "AMT_FAKE_SEED")}
    params = {"mode": "amt", "model": "stanford-crfm/music-small-800k", "notes": [{"m": 60, "t": 0, "d": 0.5}, {"m": 64, "t": 0.5, "d": 0.5}, {"m": 67, "t": 1.0, "d": 0.7}],
              "start": 2.0, "end": 4.0, "instr": 33, "only": True, "top_p": 0.95, "seed": 1234, "amt": {"python": sys.executable, "src": str(src)}}
    code, log = run_worker({"params": params, "output_dir": str(t / "out"), "config": {}}, t, logs)
    gen = json.load(open(logs["AMT_FAKE_LOG"])) if Path(logs["AMT_FAKE_LOG"]).exists() else {}
    load = json.load(open(logs["AMT_FAKE_LOAD"])) if Path(logs["AMT_FAKE_LOAD"]).exists() else {}
    res = json.load(open(t / "amt" / "notes.json")) if (t / "amt" / "notes.json").exists() else {}
    check("the worker finishes; the notes in <job folder>/amt/notes.json", code == 0 and "continue complete - 2 new notes" in log and len(res.get("notes", [])) == 2, log[-700:])
    check("…the model loaded from the cache only (offline), on the CPU here, said", load.get("name") == "stanford-crfm/music-small-800k" and load.get("kw", {}).get("local_files_only") is True and load.get("offline") == "1" and "on the CPU" in log and res.get("device") == "cpu", load)
    check("…the notes as the model's events: 10 ms steps, bass (instrument 33 x 128 + pitch), in time order", gen.get("inputs") == [0, 10050, 10000 + 1000 + 33 * 128 + 60, 50, 10050, 10000 + 1000 + 33 * 128 + 64, 100, 10070, 10000 + 1000 + 33 * 128 + 67], gen.get("inputs"))
    check("…writing from 2 s to 4 s, top_p and the seed passed", gen.get("start") == 200 and gen.get("end") == 400 and gen.get("top_p") == 0.95 and open(logs["AMT_FAKE_SEED"]).read() == "1234", gen)
    check("…one instrument: the mask leaves only instrument 33 (no drums, no other parts)", gen.get("n_allowed") == 1 and gen.get("allowed") == [33], gen.get("allowed"))
    check("…the new notes back as pitch / time / length / instrument from the start on; the rest token and the prompt left out",
          res.get("notes") == [{"m": 62, "t": 2.0, "d": 0.4, "instr": 33}, {"m": 63, "t": 2.5, "d": 0.4, "instr": 33}], res.get("notes"))
    check("…the progress lines (the queue's bar), never the real tqdm", "[amt] writing: step 200/200" in log and "REAL TQDM" not in log, log[-500:])
    code, log = run_worker({"params": dict(params, only=False), "output_dir": str(t / "out"), "config": {}}, t, logs)
    gen = json.load(open(logs["AMT_FAKE_LOG"]))
    res = json.load(open(t / "amt" / "notes.json"))
    check("one instrument off: every instrument allowed (the model may add drums / bass - drums are left out by lib/amtNotes.js back)", code == 0 and gen.get("n_allowed") == 129 and {n["instr"] for n in res["notes"]} == {0, 128}, (gen.get("n_allowed"), res.get("notes")))
    code, log = run_worker({"params": dict(params, amt={"python": str(t / "nope"), "src": str(src)}), "output_dir": str(t / "out"), "config": {}}, t, logs)
    check("not installed: said, where to install it", code != 0 and "Settings ▸ Add-ons ▸ ✍ Continue" in log, log[-300:])
    (src / "anticipation" / "sample.py").write_text("raise RuntimeError('CUDA error: out of memory')\n")
    code, log = run_worker({"params": params, "output_dir": str(t / "out"), "config": {}}, t, logs)
    check("the model stops: the job fails with its error", code != 0 and "stopped" in log and "out of memory" in log, log[-400:])

# ---------------- the REAL anticipation code, a rule-driven fake model (no weights)
real_py, real_src = os.environ.get("AMT_REAL_PY"), os.environ.get("AMT_SRC")
if real_py and real_src:
    with tempfile.TemporaryDirectory() as t:
        t = Path(t)
        drv = t / "drive.py"
        drv.write_text(f'''import sys, json
sys.path.insert(0, {str(ROOT / "misc")!r})
import torch, transformers
from anticipation import vocab as V
class Out: pass
class Fake(torch.nn.Module):
    device = torch.device("cpu")
    def forward(self, x):
        t = x[0].tolist(); k = (len(t) - 1) % 3
        lg = torch.full((1, len(t), V.VOCAB_SIZE), -20.0)
        if k == 0: lg[0, -1, V.TIME_OFFSET:V.TIME_OFFSET + V.MAX_TIME] = -0.08 * torch.arange(V.MAX_TIME, dtype=torch.float32)
        elif k == 1: lg[0, -1, V.DUR_OFFSET + 30] = 10
        else: lg[0, -1, V.NOTE_OFFSET:V.NOTE_OFFSET + V.MAX_NOTE] = 0.0
        o = Out(); o.logits = lg; return o
transformers.AutoModelForCausalLM.from_pretrained = staticmethod(lambda *a, **k: Fake())
import amt_run
amt_run.main()
''')
        for only in (True, False):
            a = {"model": "x", "notes": [{"m": 60, "t": 0, "d": 0.5}, {"m": 64, "t": 0.5, "d": 0.5}, {"m": 67, "t": 1.0, "d": 0.7}], "start": 2.0, "end": 4.0,
                 "instr": 33, "only": only, "top_p": 0.97, "seed": 7, "out": str(t / "n.json")}
            (t / "a.json").write_text(json.dumps(a))
            r = subprocess.run([real_py, str(drv), str(t / "a.json")], capture_output=True, text=True, env=dict(os.environ, PYTHONPATH=real_src), timeout=600)
            n = json.load(open(t / "n.json"))["notes"] if (t / "n.json").exists() else []
            ins = {x["instr"] for x in n}
            check(f"REAL generate(), one instrument {'on' if only else 'off'}: new notes from 2 s on" + (" - bass only" if only else " - other instruments too"),
                  r.returncode == 0 and len(n) > 0 and min(x["t"] for x in n) >= 2.0 and (ins == {33} if only else len(ins) > 1) and "[amt] writing: step" in r.stdout, (r.stdout[-400:], r.stderr[-400:], ins))
else:
    print("(AMT_REAL_PY / AMT_SRC not set - the run against the real anticipation code is skipped)")

print(f"\n{passed} passed, {failed} failed")
print(f"RESULT: {failed} failed")
sys.exit(1 if failed else 0)
