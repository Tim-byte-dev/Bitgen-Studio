#!/usr/bin/env python3
"""bitGen Studio - tools/bg_release.py (2.579.0): BUILD A RELEASE'S ZIPS from the repo tree (re-made in the repo after the
sandbox that held the old helpers was reclaimed - so the next session has them).

  python3 tools/bg_release.py [--exts id,id | --exts none] [--out dist]

  1. scripts/make_zips.sh (the repo's own builder): full, flat (core), workflows, ext zips (EXTS = the changed ones)
  2. the FULL zip keeps of docs/ only USAGE.md + shortcuts.json and has no HANDOVER-ARCHIVE.md (Tim, 2.539.0)
  3. the REPO zip: bitgen-studio/<the full tree> minus the session-only files (handover notes, CONTINUE, the flat-zip
     helpers, the gap docs) - what Tim uploads to GitHub
  4. the Unreal bridge zip: bitgen-ue-bridge-<ue/bitGenBridge VersionName>.zip (ue/bitGenBridge + ue/README.txt)
What Tim gets (CONTINUE.md): repo zip + flat zip + the changed ext zips + the 3 bridges + the 2 PDFs - never the full zip.
"""
import json, os, subprocess, sys, zipfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
# 2.591.0: the notes and helpers live in misc/
REPO_DROP_TOP = {"misc/HANDOVER.md", "misc/HANDOVER-ARCHIVE.md", "misc/CONTINUE.md", "misc/WORKING-VERSIONS.md", "misc/FOLDER-STRUCTURE.md",
                 "misc/CONTINUATION-NOTES-2_137_1.md", "misc/_gitignore", "misc/unflatten.ps1", "_MANIFEST.txt",
                 "push-to-github.bat"}             # 2.591.2: in the app folder, never in the repo
REPO_DROP = {"scripts/unflatten.py", "docs/PHOTOSHOP-GAP.md", "docs/PREMIERE-GAP.md", "docs/AFTER-EFFECTS-GAP.md"}


def main(argv):
    exts, out = None, os.path.join(ROOT, "dist")
    i = 0
    while i < len(argv):
        if argv[i] == "--exts": exts = argv[i + 1]; i += 2
        elif argv[i] == "--out": out = os.path.abspath(argv[i + 1]); i += 2
        else: raise SystemExit(__doc__)
    ver = json.load(open(os.path.join(ROOT, "package.json")))["version"]
    os.makedirs(out, exist_ok=True)
    env = dict(os.environ)
    if exts is not None: env["EXTS"] = exts
    r = subprocess.run(["bash", os.path.join(ROOT, "scripts", "make_zips.sh"), out], cwd=ROOT, env=env, capture_output=True, text=True)
    print(r.stdout.strip())
    if r.returncode: raise SystemExit("make_zips.sh failed: " + r.stderr[-800:])
    full = os.path.join(out, "bitgen-studio-v%s-full.zip" % ver)
    # 2 the full zip: docs/ = USAGE.md + shortcuts.json only, no HANDOVER-ARCHIVE.md
    keep = lambda n: not (n == "misc/HANDOVER-ARCHIVE.md" or (n.startswith("docs/") and n not in ("docs/USAGE.md", "docs/shortcuts.json")))
    zi = zipfile.ZipFile(full)
    names = [n for n in zi.namelist()]
    tmp = full + ".tmp"
    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zo:
        for n in names:
            if keep(n): zo.writestr(zi.getinfo(n), zi.read(n))
    zi.close(); os.replace(tmp, full)
    print("full zip trimmed: %d -> %d files" % (len(names), len([n for n in names if keep(n)])))
    # 2b the flat zip as before: the bridges (blender/, daz/, ue/) ride their own zips, docs/images stays in the repo
    flat = os.path.join(out, "bitgen-studio-v%s-flat.zip" % ver)
    fdrop = lambda n: n.startswith(("blender__", "daz__", "ue__", "docs__images__")) or n == "misc__quick_prompts.json"
    zi = zipfile.ZipFile(flat); fn = zi.namelist(); tmp = flat + ".tmp"
    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zo:
        for n2 in fn:
            if fdrop(n2): continue
            data = zi.read(n2)
            if n2 == "_MANIFEST.txt":
                data = "\n".join(l for l in data.decode("utf-8").split("\n") if not fdrop(l.split("  <-  ")[0])).encode("utf-8")
            zo.writestr(zi.getinfo(n2), data)
    zi.close(); os.replace(tmp, flat)
    print("flat zip: %d -> %d files (no bridges / doc pictures)" % (len(fn), len([x for x in fn if not fdrop(x)])))
    # 3 the repo zip (from the untrimmed list: the docs and PDFs belong in the repo)
    repo = os.path.join(out, "bitgen-studio-v%s-repo.zip" % ver)
    n = 0
    with zipfile.ZipFile(repo, "w", zipfile.ZIP_DEFLATED) as z:
        for f in names:
            if f in REPO_DROP or f in REPO_DROP_TOP: continue
            z.write(os.path.join(ROOT, f), "bitgen-studio/" + f); n += 1
    print("built %s (%d files)" % (repo, n))
    # 4 the Unreal bridge
    uv = json.load(open(os.path.join(ROOT, "ue", "bitGenBridge", "bitGenBridge.uplugin")))["VersionName"]
    uez = os.path.join(out, "bitgen-ue-bridge-%s.zip" % uv)
    with zipfile.ZipFile(uez, "w", zipfile.ZIP_DEFLATED) as z:
        for dp, dn, fns in os.walk(os.path.join(ROOT, "ue", "bitGenBridge")):
            dn[:] = [d for d in dn if d != "__pycache__"]
            for f in sorted(fns):
                if f.endswith(".pyc"): continue
                full_p = os.path.join(dp, f); z.write(full_p, os.path.relpath(full_p, os.path.join(ROOT, "ue")))
        z.write(os.path.join(ROOT, "ue", "README.txt"), "README.txt")
    print("built " + uez)


if __name__ == "__main__":
    main(sys.argv[1:])
