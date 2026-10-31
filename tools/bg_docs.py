#!/usr/bin/env python3
"""bitGen Studio - tools/bg_docs.py (2.579.0): the release's doc edits, re-made after the sandbox lost the old helpers.
   from bg_docs import *   then   version(old, new); ed(file, old, new); feat(anchor_prefix, [lines]);
   legs(after_text, text); handover(old, new, legs_old, legs_new, line_old, line_new, prev_heading, section, tested='')
All edits are exact-text: a miss stops the run (nothing silently skipped). Run from the repo root.
2.591.0: the notes live in misc/ (misc/HANDOVER.md, misc/CONTINUE.md, misc/NOTICE.md, misc/CHANGELOG.md) - ed() takes misc/... paths."""
import json, os, re, subprocess

def _rw(p, f):
    s = open(p, encoding="utf-8").read()
    t = f(s)
    open(p, "w", encoding="utf-8").write(t)

def _rep(s, a, b, what):
    if a not in s:
        raise SystemExit("NOT FOUND in %s: %r" % (what, a[:120]))
    return s.replace(a, b, 1)

def version(old, new):
    for p in ("package.json", "package-lock.json"):
        _rw(p, lambda s: re.sub(r'("version":\s*")' + re.escape(old) + '"', r'\g<1>' + new + '"', s, count=2 if p.endswith("lock.json") else 1))
    v = json.load(open("package.json"))["version"]
    if v != new:
        raise SystemExit("package.json still says " + v)

def ed(path, old, new):
    _rw(path, lambda s: _rep(s, old, new, path))

def feat(anchor_prefix, lines):
    """docs/FEATURES.md: the lines go after the line that starts with anchor_prefix"""
    def f(s):
        L = s.split("\n")
        i = next((k for k, l in enumerate(L) if l.startswith(anchor_prefix)), -1)
        if i < 0:
            raise SystemExit("FEATURES anchor not found: " + anchor_prefix)
        return "\n".join(L[:i + 1] + list(lines) + L[i + 1:])
    _rw("docs/FEATURES.md", f)

def legs(after, text):
    """scripts/e2e-stub-test.sh: text goes right after `after` (the previous release's last leg)"""
    _rw("scripts/e2e-stub-test.sh", lambda s: _rep(s, after, after + text, "e2e-stub-test.sh"))

def handover(old, new, legs_old, legs_new, line_old, line_new, prev_heading, section, tested="", keep=10):
    def f(s):
        s = s.replace("handover notes (v" + old, "handover notes (v" + new, 1)
        s = _rep(s, "(%d legs" % legs_old, "(%d legs" % legs_new, "HANDOVER legs")
        s = _rep(s, line_old + ").", line_old + "\n" + line_new + ").", "HANDOVER gate line")
        s = _rep(s, "\n" + prev_heading, "\n" + section.rstrip("\n") + ("\n" + tested if tested else "") + "\n\n" + prev_heading, "HANDOVER heading")
        return s
    _rw("misc/HANDOVER.md", f)
    # only the last `keep` releases stay; older sections move to the top of HANDOVER-ARCHIVE.md
    h = open("misc/HANDOVER.md", encoding="utf-8").read()
    heads = [m.start() for m in re.finditer(r"\n## 2\.\d+\.\d+ — ", h)]
    if len(heads) > keep:
        cut = heads[keep]
        old_part, h = h[cut:], h[:cut] + "\n"
        a = open("misc/HANDOVER-ARCHIVE.md", encoding="utf-8").read().split("\n", 2)
        open("misc/HANDOVER-ARCHIVE.md", "w", encoding="utf-8").write(a[0] + "\n" + a[1] + "\n" + old_part.strip("\n") + "\n\n" + a[2])
        open("misc/HANDOVER.md", "w", encoding="utf-8").write(h)
        print("handover: moved", len(heads) - keep, "section(s) to the archive")
    r = subprocess.run(["python3", "scripts/make_changelog.py"], capture_output=True, text=True)
    print(r.stdout.strip() or r.stderr.strip()[-300:])
