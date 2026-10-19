#!/usr/bin/env python3
"""bitGen Studio — 2.459.0: no CorelDRAW / Adobe product names in anything the user sees.
Tim: "remove all coreldraw and adobe references in help or tooltips or information" (asked: everything you see - help
pages, tooltips, menus, status messages, the Guide PDF, USAGE; code comments and HANDOVER stay).
Checks the help pages, docs/USAGE.md (the Guide), docs/shortcuts.json, the PDF makers' own text, and every JS string
literal (found with TypeScript's parser - the global `typescript` module; without it that part is SKIPPED) in ext,
static (not static/vendor), lib and routes. File-format data (authoringApp="PremierePro" in the FCP7 XML) is allowed."""
import os, re, sys, json, subprocess, glob
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RX = re.compile(r"CorelDRAW|Corel|Adobe|Photoshop|Illustrator|Premiere|After Effects|InDesign|Lightroom|Acrobat|Audition|PowerClip")
ALLOW = re.compile(r'authoringApp="PremierePro"')
npass = nfail = 0
def check(name, ok, got=None):
    global npass, nfail
    if ok: npass += 1; print("PASS: " + name)
    else:
        nfail += 1; print("FAIL: " + name)
        for g in (got or [])[:20]: print("  " + g)
def hits_in(path, strip_comments=None):
    out = []
    for i, line in enumerate(open(path, encoding="utf-8"), 1):
        t = strip_comments(line) if strip_comments else line
        if RX.search(ALLOW.sub("", t)): out.append(f"{os.path.relpath(path, ROOT)}:{i}: {line.strip()[:160]}")
    return out
help_hits = []
for f in sorted(glob.glob(os.path.join(ROOT, "static", "help", "*.html"))):
    s = re.sub(r"<!--.*?-->", "", open(f, encoding="utf-8").read(), flags=re.S)
    help_hits += [f"{os.path.relpath(f, ROOT)}: …{m.group(0)}…" for m in RX.finditer(s)]
check("the help pages (static/help) name no other products", not help_hits, help_hits)
check("docs/USAGE.md (the Guide PDF) names no other products", not hits_in(os.path.join(ROOT, "docs", "USAGE.md")), hits_in(os.path.join(ROOT, "docs", "USAGE.md")))
check("docs/shortcuts.json (the Guide's shortcut pages) names no other products", not hits_in(os.path.join(ROOT, "docs", "shortcuts.json")), hits_in(os.path.join(ROOT, "docs", "shortcuts.json")))
py = []
for f in ("make_guide_pdf.py", "make_ad_pdf.py"):
    p = os.path.join(ROOT, "scripts", f)
    if os.path.exists(p): py += hits_in(p, lambda l: l.split("#", 1)[0] if not l.lstrip().startswith(("'''", '"""')) else l)
check("the PDF makers' own text (the Guide + the brochure) names no other products", not py, py)
# JS string literals
try:
    groot = subprocess.run(["npm", "root", "-g"], capture_output=True, text=True, timeout=60).stdout.strip()
except Exception:
    groot = ""
ts = os.path.join(groot, "typescript")
if not groot or not os.path.isdir(ts):
    print("SKIP: the global typescript module is not installed - the string-literal check did not run")
else:
    files = []
    for d in ("ext", "static", "lib", "routes"):
        for dp, dn, fn in os.walk(os.path.join(ROOT, d)):
            if os.sep + "vendor" in dp or "node_modules" in dp: continue
            files += [os.path.join(dp, x) for x in fn if x.endswith(".js")]
    files = [f for f in files if RX.search(open(f, encoding="utf-8", errors="ignore").read())]
    js = r'''
const ts = require(process.argv[1]); const fs = require("fs");
const RX = /CorelDRAW|Corel|Adobe|Photoshop|Illustrator|Premiere|After Effects|InDesign|Lightroom|Acrobat|Audition|PowerClip/, AL = /authoringApp="PremierePro"/g;
const K = ts.SyntaxKind, S = new Set([K.StringLiteral, K.NoSubstitutionTemplateLiteral, K.TemplateHead, K.TemplateMiddle, K.TemplateTail]);
for (const f of JSON.parse(fs.readFileSync(0, "utf8"))) {
  const src = fs.readFileSync(f, "utf8"), sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const walk = (n) => { if (S.has(n.kind)) { const t = n.getText(sf); if (RX.test(t.replace(AL, ""))) console.log(f + ":" + (sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1) + ": " + t.slice(0, 140).replace(/\n/g, " ")); } ts.forEachChild(n, walk); };
  walk(sf);
}'''
    r = subprocess.run(["node", "-e", js, ts], input=json.dumps(files), capture_output=True, text=True, timeout=300)
    lines = [os.path.relpath(l.split(":", 1)[0], ROOT) + ":" + l.split(":", 1)[1] for l in r.stdout.splitlines() if l.strip()]
    check(f"no other products' names in a string the app shows (every JS string literal in ext / static / lib / routes - {len(files)} files with the names in comments looked at)", r.returncode == 0 and not lines, lines or [r.stderr[-300:]])
print(f"\nRESULT: {npass} passed, {nfail} failed")
sys.exit(1 if nfail else 0)
