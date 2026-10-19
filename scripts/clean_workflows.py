#!/usr/bin/env python3
"""bitGen Studio — clean the shipped workflows' default media (2.401.1).

Tim (verbatim): "set all default images, videos and sound in workflows to 0 or comfy fairy . it must all be cleaned
before i can upload the repo".

Every workflow in comfy_workflows/ (API exports, UI exports, the *_tmp run graphs) can carry the file names - and
the full paths - of the pictures, videos and sounds that were loaded the last time it ran: personal renders, voice
clips, someone else's downloads, C:\\... paths. The app never needs them: every loader the app uses is filled with
the job's own uploads (or pruned) before a graph is queued. So the defaults become neutral:

  a picture  -> "example.png"  (ComfyUI's own example picture, in every install's input folder)
  a video    -> "0"
  a sound    -> "0"

and a VHS video preview's subfolder / type go back to "" / "input" (they named the folders it came from).

  python3 scripts/clean_workflows.py [folder ...]          clean in place (default: comfy_workflows), list what changed
  python3 scripts/clean_workflows.py --check [folder ...]  change nothing; exit 1 listing every file still carrying one
The build runs it before packaging and refuses a zip whose workflows are not clean.
"""
import json
import re
import sys
from pathlib import Path

IMAGE = "example.png"
OTHER = "0"
IMG_RX = re.compile(r"\.(png|jpe?g|webp|bmp|gif|exr|hdr|tiff?|tga|avif)$", re.I)
AV_RX = re.compile(r"\.(mp4|webm|mov|mkv|avi|m4v|mpe?g|wmv|flv|mp3|wav|flac|ogg|opus|m4a|aac|wma|aiff?)$", re.I)
CLEAN = {IMAGE, OTHER}


def neutral(s):
    """The neutral value for a media string, or None when `s` is not a media file name / path."""
    if not isinstance(s, str) or "\n" in s or len(s) > 400:
        return None
    t = s.strip()
    if IMG_RX.search(t):
        return IMAGE
    if AV_RX.search(t):
        return OTHER
    return None


def clean(obj, found):
    """Clean `obj` in place; `found` collects (old, new) pairs."""
    if isinstance(obj, dict):
        # a VHS / ComfyUI video preview: {"filename", "subfolder", "type", "format", "fullpath"}
        if neutral(obj.get("filename")) is not None:
            if obj.get("subfolder"):
                found.append((f"subfolder {obj['subfolder']}", ""))
                obj["subfolder"] = ""
            if obj.get("type") not in (None, "input"):
                found.append((f"type {obj['type']}", "input"))
                obj["type"] = "input"
        for k, v in list(obj.items()):
            n = neutral(v)
            if n is not None:
                if v != n:
                    found.append((v, n))
                    obj[k] = n
            else:
                clean(v, found)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            n = neutral(v)
            if n is not None:
                if v != n:
                    found.append((v, n))
                    obj[i] = n
            else:
                clean(v, found)
    return found


def rewrite(raw, data, found):
    """The file's own text with only the media strings swapped (its layout kept), checked to parse to the cleaned
    data; anything the text swap cannot do exactly falls back to a full re-dump in the file's indent."""
    text = raw
    media = {o: n for o, n in found if not str(o).startswith(("subfolder ", "type "))}
    for o, n in sorted(media.items(), key=lambda kv: -len(kv[0])):
        for tok in {json.dumps(o, ensure_ascii=False), json.dumps(o)}:
            text = text.replace(tok, json.dumps(n))
    for o, n in found:                                   # a preview's subfolder / type, only beside "subfolder": / "type":
        if str(o).startswith(("subfolder ", "type ")):
            key, val = str(o).split(" ", 1)
            text = re.sub(r'("%s"\s*:\s*)%s' % (key, re.escape(json.dumps(val))), lambda m: m.group(1) + json.dumps(n), text)
    try:
        if json.loads(text) == data:
            return text
    except ValueError:
        pass
    m = re.search(r'\n( +)["{\[]', raw)
    return json.dumps(data, indent=len(m.group(1)) if m else None, ensure_ascii=False) + ("\n" if raw.endswith("\n") else "")


def files(folders):
    for f in folders:
        p = Path(f)
        if p.is_file() and p.suffix.lower() == ".json":
            yield p
        elif p.is_dir():
            yield from sorted(p.rglob("*.json"))


def run(folders, check=False, say=print):
    """{file: [(old, new)]} for every file that carried (check) / had (clean) a media default."""
    out = {}
    for f in files(folders):
        try:
            raw = f.read_text(encoding="utf-8")
            data = json.loads(raw)
        except (OSError, ValueError):
            continue
        found = clean(data, [])
        if not found:
            continue
        out[str(f)] = found
        if not check:
            f.write_text(rewrite(raw, data, found), encoding="utf-8")
        say(f"{'NOT CLEAN' if check else 'cleaned'}: {f} ({len(found)}: "
            + ", ".join(sorted({str(o) for o, _ in found}))[:300] + ")")
    return out


def main(argv):
    check = "--check" in argv
    folders = [a for a in argv if not a.startswith("--")] or [str(Path(__file__).resolve().parents[1] / "comfy_workflows")]
    out = run(folders, check)
    n = sum(len(v) for v in out.values())
    if check:
        print(f"RESULT: {len(out)} workflow(s) still carry {n} media default(s)" if out else "RESULT: clean")
        return 1 if out else 0
    print(f"RESULT: cleaned {n} media default(s) in {len(out)} workflow(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
