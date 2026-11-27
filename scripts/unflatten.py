#!/usr/bin/env python3
"""bitGen Studio - put a flat CORE delivery back into its folders (2.992.0; _MANIFEST.txt has promised this file since 2.217.0).

Run it in the folder where the flat zip was unzipped:
    python3 scripts__unflatten.py            moves each a__b.ext to a/b.ext
    python3 scripts__unflatten.py --dry      only says what it would do

It reads _MANIFEST.txt's "<flat name>  <-  <path>" lines, so a name that itself holds "__" (blender's __init__.py) goes to
the right place. A path that would leave this folder is refused. Afterwards unzip the bitgen-ext-<id> zips and the
bitgen-workflows zip here, as the manifest says.
"""
import os
import sys


def pairs(manifest):
    out = []
    with open(manifest, encoding="utf-8") as f:
        for line in f:
            if "  <-  " not in line:
                continue
            flat, path = line.rstrip("\n").split("  <-  ", 1)
            out.append((flat.strip(), path.strip()))
    return out


def main(argv):
    here = os.path.abspath(os.getcwd())
    dry = "--dry" in argv
    man = os.path.join(here, "_MANIFEST.txt")
    if not os.path.isfile(man):
        print("no _MANIFEST.txt here - run this in the folder where the flat zip was unzipped")
        return 1
    moved = kept = missing = 0
    for flat, path in pairs(man):
        src = os.path.join(here, flat)
        dst = os.path.abspath(os.path.join(here, path))
        if not dst.startswith(here + os.sep):
            print("refused (outside this folder):", path)
            return 1
        if flat == path:
            kept += 1
            continue
        if not os.path.isfile(src):
            missing += 1
            continue
        if dry:
            print(flat, "->", path)
        else:
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            os.replace(src, dst)
        moved += 1
    print(("would move" if dry else "moved"), moved, "files;", kept, "already in place;", missing, "not here")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
