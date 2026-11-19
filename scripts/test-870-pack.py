#!/usr/bin/env python3
"""bitGen Studio — 2.870.0: lib/charSheetH3.js against the H3 Character Sheet Designer's OWN compiler.

Every state bitGen Studio builds must pass the pack's validation, and the pictures bitGen wires into MiniMax H3 Image
Conditioning (images.image_N) must be the ones the pack's prompt numbers (<Picture n> -> its core_input). Needs a clone
of https://github.com/ukr8b3g-cmyk/H3-Character-Sheet-Designer: H3SHEET_PACK=/path/to/clone python3 scripts/test-870-pack.py
(SKIP without it). The pack is imported from that folder only - nothing of it is copied into this repository."""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PACK = os.environ.get("H3SHEET_PACK", "")
ok = bad = 0


def check(name, cond, got=None):
    global ok, bad
    if cond:
        ok += 1
        print("PASS: " + name)
    else:
        bad += 1
        print("FAIL: " + name + ("" if got is None else "\n      got " + json.dumps(got, default=str)[:700]))


if not PACK or not os.path.isdir(os.path.join(PACK, "h3_character_sheet")):
    print("SKIP: set H3SHEET_PACK to a clone of the H3 Character Sheet Designer")
    print("\nRESULT: 0 passed, 0 failed")
    sys.exit(0)
sys.path.insert(0, PACK)
from h3_character_sheet.minimax_image_compiler import compile_minimax_image_state as C  # noqa: E402

CASES = [
    {"o": {"views": ["face_front", "face_left", "body_front", "body_left", "body_back"]}, "layout": False, "refs": [None, None, None]},
    {"o": {"views": ["face_front", "body_front", "clothing_back", "hands"], "clothing": "pants", "hands": "gloved", "feet": "unshod",
           "detail": "max_8mp", "parts": {"face": "a scar"}, "roles": ["face", "", "footwear"], "viewPrompts": {"hands": "Both hands open."}},
     "layout": True, "refs": [None, "r2.png", None]},
    {"o": {"views": ["face_front", "face_left", "face_right", "face_3q_left", "face_3q_right", "face_back"], "detail": "current"},
     "layout": True, "refs": ["r1.png", "r2.png", "r3.png"]},
    {"o": {"views": ["clothing_front", "hands", "feet", "body_front"], "clothing": "none", "size": {"mode": "manual", "width": 2048, "height": 1024}},
     "layout": False, "refs": ["r1.png", None, "r3.png"]},
    {"o": {"views": list(json.loads(subprocess.check_output(["node", "-e", "console.log(JSON.stringify(require('./lib/charSheetH3').VIEW_IDS))"], cwd=ROOT)))},
     "layout": True, "refs": [None, None, None]},
]
script = """
const S = require('./lib/charSheetH3');
const cases = JSON.parse(require('fs').readFileSync(0, 'utf8'));
console.log(JSON.stringify(cases.map((c) => { const st = S.state(c.o);
  const g = S.graph({ state: st, layout: c.layout, style: 'anime', seed: 1, names: { unet: 'u', clip: 'c', vae: 'v' }, character: 'c.png', refs: c.refs }).graph;
  return { st, cond: g.cond.inputs, design: g.design.inputs, summary: S.summary(st) }; })));
"""
built = json.loads(subprocess.run(["node", "-e", script], cwd=ROOT, input=json.dumps(CASES), capture_output=True, text=True, check=True).stdout)
OUTS = {4: "character_image", 3: "layout_image", 5: "reference_image_1", 6: "reference_image_2", 7: "reference_image_3"}
for n, (case, b) in enumerate(zip(CASES, built), 1):
    presence = {"reference_image_%d" % (i + 1): bool(case["refs"][i]) for i in range(3)}
    try:
        r = C(json.dumps(b["st"]), use_layout_image=case["layout"], style="anime", max_resolution=16384, reference_presence=presence)
    except Exception as e:  # noqa: BLE001
        check("case %d: the pack accepts bitGen's state (%s)" % (n, b["summary"]), False, str(e))
        continue
    check("case %d: the pack accepts bitGen's state (%s) -> %d x %d, %d panels" % (n, b["summary"], r["width"], r["height"], len(r["semantic_layout"]["panels"])),
          r["width"] > 0 and len(r["semantic_layout"]["panels"]) > 0)
    want = {ref["core_input"]: ref["source"] for ref in r["reference_plan"]}
    have = {k: OUTS[v[1]] for k, v in b["cond"].items() if k.startswith("images.")}
    check("case %d: bitGen wires exactly the pictures the pack's prompt numbers (%s)" % (n, ", ".join(sorted(want))), want == have, {"pack": want, "bitgen": have})
    wired = {k for k in b["design"] if k.startswith("reference_image_")}
    check("case %d: the designer node gets the part pictures that are there" % n, wired == {k for k, v in presence.items() if v}, sorted(wired))
print("\n%d passed, %d failed" % (ok, bad))
print("RESULT: " + ("FAIL" if bad else "PASS"))
sys.exit(1 if bad else 0)
