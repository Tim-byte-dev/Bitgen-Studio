#!/usr/bin/env python3
"""bitGen Studio — the Credits section of docs/USAGE.md from lib/credits.json (2.642.0).

    python3 scripts/make_credits.py [--check]

lib/credits.json is the one place the credits are written (Settings ▸ About reads it too - routes/about.js). This writes them
into docs/USAGE.md between the <!-- credits:start --> and <!-- credits:end --> markers, so the Guide PDF and the in-app Help
show them. --check only compares (exit 1 when USAGE.md is out of date).
Pure (python: scripts/test-credits642.py): render(data) -> markdown.
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
START, END = "<!-- credits:start -->", "<!-- credits:end -->"


def render(d):
    out = ["## Credits", ""]
    for c in d.get("credits", []):                          # one paragraph each: "Produced and Developed by Tim Paul"
        out += [f"**{c['role']}{c.get('join', ' ')}{c['name']}**", ""]
    out += [d.get("about", ""), "", d.get("thanks", ""), ""]
    for s in d.get("sections", []):
        out += [f"### {s['title']}", ""]
        for i in s.get("items", []):
            name = f"[{i['name']}]({i['url']})" if i.get("url") else i["name"]
            by = f" ({i['by']})" if i.get("by") else ""
            out.append(f"- **{name}**{by} - {i.get('what', '')}")
        out.append("")
    if d.get("licence"):
        out += [d["licence"], ""]
    return "\n".join(out).rstrip() + "\n"


def splice(usage, block):
    if START in usage and END in usage:
        return re.sub(re.escape(START) + r".*?" + re.escape(END), lambda m: START + "\n" + block + END, usage, flags=re.S)
    return usage.rstrip() + "\n\n" + START + "\n" + block + END + "\n"


if __name__ == "__main__":
    data = json.load(open(os.path.join(ROOT, "lib", "credits.json"), encoding="utf-8"))
    p = os.path.join(ROOT, "docs", "USAGE.md")
    old = open(p, encoding="utf-8").read()
    new = splice(old, render(data))
    if "--check" in sys.argv:
        print("make_credits: docs/USAGE.md is " + ("up to date" if new == old else "OUT OF DATE")); sys.exit(0 if new == old else 1)
    open(p, "w", encoding="utf-8").write(new)
    print("make_credits: %d sections -> docs/USAGE.md" % len(data.get("sections", [])))
