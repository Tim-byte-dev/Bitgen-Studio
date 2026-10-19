#!/usr/bin/env python3
"""bitGen Studio — SELECT SUBJECT with the AI matte (2.488.0): one picture in, its subject's mask out.

Run by lib/subjectMatte.js inside the AI matte's venv (venvs/matte: rembg + onnxruntime, the models in models/rembg -
the same install as the path layers' matte, scripts/matte.py):
    python scripts/subject_matte.py job.json
job = {input (a PNG), output (the mask PNG, grey: white = subject), model ("birefnet-general" ...), fake: false}
fake = no model: what differs from the picture's border colour (the tests, a machine without the venv).
stdout: one JSON line {"ok": true, "w": .., "h": ..}.
"""
import json
import sys

import numpy as np
from PIL import Image


def fake_mask(im):
    a = np.asarray(im.convert("RGB")).astype(np.float32)
    border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    key = np.median(border, axis=0)
    d = np.sqrt(((a - key) ** 2).sum(-1))
    return Image.fromarray(np.clip((d - 30.0) / 30.0 * 255.0, 0, 255).astype(np.uint8), "L")


def main():
    job = json.load(open(sys.argv[1], "r", encoding="utf-8"))
    im = Image.open(job["input"]).convert("RGB")
    if job.get("fake"):
        mask = fake_mask(im)
    else:
        from rembg import new_session, remove
        session = new_session(job.get("model") or "birefnet-general")
        mask = remove(im, session=session, only_mask=True)
        if mask.mode != "L":
            mask = mask.convert("L")
        if mask.size != im.size:
            mask = mask.resize(im.size, Image.BILINEAR)
    mask.save(job["output"])
    print(json.dumps({"ok": True, "w": im.size[0], "h": im.size[1]}), flush=True)


if __name__ == "__main__":
    main()
