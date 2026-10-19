#!/usr/bin/env python3
"""bitGen Studio — 2.477.0: THE GITHUB REPOSITORY (the public beta).
Tim (verbatim): "give me a full repo that i can send to github - beta release".
Checks what a visitor to the repository sees and what GitHub runs: the root files (README, LICENSE, NOTICE,
CHANGELOG, CONTRIBUTING, SECURITY, docs/BETA.md), every relative link in them points at a file that is there, the
beta note, CHANGELOG.md starts at this version (scripts/make_changelog.py: other products'
names replaced, title case), NOTICE.md names every browser library's licence file (and the LGPL one), the GitHub
workflow + templates, scripts/ci-units.sh (only self-contained unit tests), .gitignore keeps this machine's
files out, and none of these pages names other products. Runs in a plain checkout (no release notes needed)."""
import importlib.util, json, os, re, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
npass = nfail = 0
def check(name, ok, got=None):
    global npass, nfail
    if ok: npass += 1; print("PASS: " + name)
    else: nfail += 1; print("FAIL: " + name + ("" if got is None else " :: " + repr(got)[:400]))
def read(p):
    p = os.path.join(ROOT, p)
    return open(p, encoding="utf-8").read() if os.path.exists(p) else ""
ver = json.load(open(os.path.join(ROOT, "package.json"), encoding="utf-8"))["version"]
PAGES = ["README.md", "LICENSE", "NOTICE.md", "CHANGELOG.md", "CONTRIBUTING.md", "SECURITY.md", "docs/BETA.md", "docs/INSTALL.md", "docs/USAGE.md"]
missing = [p for p in PAGES if not read(p).strip()]
check("the repository's pages are there: README, LICENSE, NOTICE, CHANGELOG, CONTRIBUTING, SECURITY, docs/BETA, INSTALL, USAGE", not missing, missing)
check("LICENSE is MIT", "MIT License" in read("LICENSE") or "Permission is hereby granted, free of charge" in read("LICENSE"))
# relative links
bad = []
for p in ["README.md", "CONTRIBUTING.md", "docs/BETA.md", "CHANGELOG.md", "SECURITY.md"]:
    s = read(p); base = os.path.dirname(os.path.join(ROOT, p))
    links = re.findall(r"\]\(([^)\s]+)\)", s) + re.findall(r'(?:href|src)="([^"]+)"', s)
    for l in links:
        if re.match(r"^(https?:|mailto:|#)", l): continue
        f = l.split("#")[0]
        if f and not os.path.exists(os.path.normpath(os.path.join(base, f))): bad.append(f"{p}: {l}")
check("every relative link and picture in README / CONTRIBUTING / BETA / CHANGELOG / SECURITY points at a file in the repository", not bad, bad)
rd = read("README.md")
check("README: the beta note points at docs/BETA.md; the quick start, requirements, tests and licence sections",
      "**Public beta" in rd and "docs/BETA.md" in rd and all(h in rd for h in ["## Quick start", "## Requirements", "## Tests", "## Licence"]))
check("docs/BETA.md: what is experimental (the Unreal bridge untested in a real editor, the Daz live link), how to report",
      "public beta" in read("docs/BETA.md") and "not inside a real Unreal Editor" in read("docs/BETA.md") and "Daz" in read("docs/BETA.md") and "Bug report" in read("docs/BETA.md"))
# the changelog
spec = importlib.util.spec_from_file_location("chlog", os.path.join(ROOT, "scripts", "make_changelog.py")); C = importlib.util.module_from_spec(spec); spec.loader.exec_module(C)
ch = read("CHANGELOG.md")
first = re.search(r"^- \*\*(\d+\.\d+\.\d+)\*\*", ch, re.M)
check(f"CHANGELOG.md starts at this version ({ver}) and lists 300+ releases", first and first.group(1) == ver and len(re.findall(r"^- \*\*\d", ch, re.M)) >= 300, first and first.group(1))
check("make_changelog: other products' names become plain words; how a release came about is left to the notes",
      C.clean("FRAMES LIKE CORELDRAW'S POWERCLIP: LOCKED CONTENTS") == "FRAMES: LOCKED CONTENTS" and C.clean("SMART OBJECTS, LIQUIFY (PHOTOSHOP GAPS 2 + 3)") == "SMART OBJECTS, LIQUIFY"
      and C.clean("THE EDITABLE SCENE BOARD (by instruction)") == "THE EDITABLE SCENE BOARD" and not C.BRANDS.search(C.clean("PREMIERE'S SMALLER JOBS: DROP-FRAME")))
tc = C.title_case("THE EDITOR'S PEN, PATHS + LUTS FOR PSDS, .BGI FILES, IN / OUT, SEEDVR2 UPSCALING (the gap tracked)")
check("make_changelog: title case keeps acronyms and names (LUTs, PSDs, .bgi, SeedVR2) and lower-case asides", tc == "The Editor's Pen, Paths + LUTs for PSDs, .bgi Files, In / Out, SeedVR2 Upscaling (the gap tracked)", tc)
check("make_changelog: parse takes the first heading per version, newest first in render", list(C.parse("## 1.2.0 — B\n## 1.10.0 — A\n## 1.2.0 — OLD\n").items()) == [("1.2.0", "B"), ("1.10.0", "A")]
      and C.render({"1.2.0": "B", "1.10.0": "A"}).index("1.10.0") < C.render({"1.2.0": "B", "1.10.0": "A"}).index("1.2.0"))
if read("HANDOVER.md"):
    r = subprocess.run([sys.executable, os.path.join(ROOT, "scripts", "make_changelog.py"), "--check"], capture_output=True, text=True)
    check("CHANGELOG.md is up to date with the release notes (python3 scripts/make_changelog.py)", r.returncode == 0, r.stdout.strip())
# notices
nt = read("NOTICE.md")
lic = sorted(os.path.relpath(os.path.join(dp, f), os.path.join(ROOT, "static", "vendor")).replace(os.sep, "/") for dp, _, fs in os.walk(os.path.join(ROOT, "static", "vendor")) for f in fs if f.startswith("LICENSE"))
check("NOTICE.md names every licence file in static/vendor and says how the LGPL OpenCascade files ship", lic and all(l in nt for l in lic) and "LGPL-2.1" in nt and "unmodified" in nt and "github.com/sgenoud/replicad" in nt, [l for l in lic if l not in nt])
# GitHub
ci = read(".github/workflows/ci.yml")
check("the GitHub workflow: on push + pull requests, Node 20, npm ci, check-gitignore, scripts/ci-units.sh", all(w in ci for w in ["push:", "pull_request:", "node-version: 20", "npm ci", "check-gitignore.sh", "scripts/ci-units.sh"]))
check("issue templates (bug report, feature request) and a pull request template", all(read(p) for p in [".github/ISSUE_TEMPLATE/bug_report.md", ".github/ISSUE_TEMPLATE/feature_request.md", ".github/PULL_REQUEST_TEMPLATE.md"]))
lst = subprocess.run(["bash", os.path.join(ROOT, "scripts", "ci-units.sh"), "--list"], capture_output=True, text=True).stdout.split()
tests = [t for t in lst if t.startswith("scripts/")]
check("scripts/ci-units.sh: 100+ self-contained unit tests, no browser tests, none that need a server", len(tests) >= 100 and not any(t.endswith("-ui.js") for t in tests)
      and not any(re.search(r"H3_URL|playwright|child_process", read(t)) for t in tests), len(tests))
gi = read(".gitignore")
check(".gitignore keeps this machine's files out (custom.settings, models, projects, node_modules, venvs)", all(re.search(r"^" + re.escape(w) + r"\s*$", gi, re.M) for w in ["custom.settings", "models/", "projects/", "node_modules/", "venvs/"]))
# no other products' names in what a visitor reads first
RX = re.compile(r"CorelDRAW|Corel|Adobe|Photoshop|Illustrator|Premiere|After Effects|InDesign|Lightroom|Acrobat|Audition|PowerClip|Fusion 360|Autodesk")
hits = [f"{p}: {m}" for p in ["README.md", "CHANGELOG.md", "CONTRIBUTING.md", "SECURITY.md", "docs/BETA.md", ".github/ISSUE_TEMPLATE/bug_report.md", ".github/ISSUE_TEMPLATE/feature_request.md"] for m in RX.findall(read(p))]
check("README, CHANGELOG, CONTRIBUTING, SECURITY, BETA and the templates name no other products", not hits, hits[:6])
print(f"\nRESULT: {npass} passed, {nfail} failed")
sys.exit(1 if nfail else 0)
