#!/usr/bin/env python3
"""bitGen Studio — CHANGELOG.md from the release notes (2.477.0, the public beta).

Tim (verbatim): "give me a full repo that i can send to github - beta release".

    python3 scripts/make_changelog.py [--check]

Every release has a section `## X.Y.Z — TITLE` in HANDOVER.md (the newest) and HANDOVER-ARCHIVE.md (the older ones),
the developer notes that ship in the release zips. This writes CHANGELOG.md: one line per version, newest first,
titles in title case, grouped by minor-version hundreds. Other products' names are replaced by plain descriptions
(the same rule as the help and the Guide: scripts/test-brandnames.py). --check only compares and exits 1 if
CHANGELOG.md is out of date (or the notes are not there: then it passes, as in a repository checkout).
Pure (python: scripts/test-repo.py): parse(text), clean(title), title_case(s), render(entries).
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HEAD = re.compile(r"^##\s+(\d+\.\d+\.\d+)\s*[—–-]+\s*(.+?)\s*$")
BRANDS = re.compile(r"CorelDRAW|Corel|Adobe|Photoshop|Illustrator|Premiere|After Effects|InDesign|Lightroom|Acrobat|Audition|PowerClip|Fusion 360|Autodesk", re.I)
# the old notes compared features with other programs; the changelog says what was built
SUBS = [
    (r"\s*\((?:PHOTOSHOP|PREMIERE) GAPS?[^)]*\)", ""),
    (r"\s*\(the last Premiere row\)", ""),
    (r"\s*\(CORELDRAW\)", ""),
    (r"\s*\((?:by instruction|hardware [^)]*|(?:from )?Tim's [^)]*)\)\s*$", ""),     # how the release came about - the notes keep it
    (r"FRAMES LIKE CORELDRAW'S POWERCLIP", "FRAMES"),
    (r"FRAMES \(POWERCLIP\)", "FRAMES"),
    (r"CORELDRAW'S\s+", ""),
    (r"THE IMAGE EDITOR AS PHOTOSHOP \(PhotoCraft's layout and features\)", "THE IMAGE EDITOR'S NEW LAYOUT AND FEATURES"),
    (r"24 PHOTOSHOP-STYLE", "24 OF THEM"),
    (r"CLOSING THE PREMIERE GAP", "PRO EDITING"),
    (r"PREMIERE'S BIGGER ROWS", "BIGGER EDITING FEATURES"),
    (r"PREMIERE'S MEDIUM JOBS", "MORE EDITING FEATURES"),
    (r"PREMIERE'S PARTLY-DONE ITEMS FINISHED", "PARTLY-DONE EDITING FEATURES FINISHED"),
    (r"PREMIERE'S SMALLER JOBS", "SMALLER EDITING FEATURES"),
    (r"PREMIERE LEFTOVERS", "EDITING EXTRAS"),
    (r"PREMIERE (?:GAP )?ROUND", "EDITING ROUND"),
]
KEEP_UPPER = set("""AI UI UX LLM CAD PDF PSD SVG DXF STL GLTF GLB OBJ FBX USD MRQ ATN TTS SFX XML FCPXML FCP7 AAF LUT HDR SDR
EXR RGB RGBA CMYK HSL HSV GPU CPU CUDA API URL OS JSON MP4 MOV MP3 WAV ZIP QR ID FPS VR XR 3D 2D 4K 8K NLE EQ ICC OCR MIDI ASR VAE
SDXL FLUX VRAM RAM SSD NVIDIA AMD ESC DEL KB MB GB TB F1 F2 F3 F4 F5 F6 F7 F8 F9 F10 F11 F12 UE UE5 H3 LTX FFMPEG
NVENC VAAPI AV1 H.264 H.265 BGI BGP RVC STT IPA SAM SAM2 HF IP OK PNG JPG JPEG WEBP GIF TIFF HEIC RAW PBR IK FK""".split())
PROPER = {w.upper(): w for w in """ComfyUI MiniMax Unreal MetaHuman MetaHumans Blender Daz Studio Electron Windows Linux macOS
OpenCascade Wan YuE YuE2 Music3 Qwen Qwen-Image Z-Image SeedVR2 Krita RunPod Viggle Hugging Face OpenType Bézier Pantone
GitHub Node Python Playwright Whisper Kokoro Chatterbox Florence Hunyuan TRELLIS Gemma Llama ControlNet IPAdapter
Final Cut Pro X ProRes Hunyuan3D TRELLIS.2 Comfy-Org Fal LoRA""".split()}
SMALL = {"a", "an", "the", "and", "or", "nor", "but", "of", "in", "on", "to", "for", "with", "by", "at", "from", "as", "into", "per", "via", "vs", "x"}


def clean(title):
    t = title
    for a, b in SUBS:
        t = re.sub(a, b, t)
    t = BRANDS.sub("pro", t)
    return re.sub(r"\s{2,}", " ", t).strip(" ;:,")


def _part(core):
    up = core.upper()
    if up in PROPER:
        return PROPER[up]
    if up in KEEP_UPPER:
        return up
    if up.endswith("S") and up[:-1] in PROPER:                            # LORAS -> LoRAs
        return PROPER[up[:-1]] + "s"
    if up.endswith("S") and up[:-1] in KEEP_UPPER and len(up) > 2:      # PSDS -> PSDs, LUTS -> LUTs
        return up[:-1] + "s"
    if re.fullmatch(r"[A-Z0-9.]+", up) and re.search(r"\d", up):           # SEEDVR2, 3DREAL, H.264
        return up
    low = core.lower()
    return low[:1].upper() + low[1:] if low[:1].isalpha() else low


def _word(w, cap):
    m = re.match(r"^([^\w]*)(.*?)([^\w]*)$", w, re.U)
    pre, core, post = m.group(1), m.group(2), m.group(3)
    if not core:
        return w
    if core != core.upper():             # written in mixed / lower case on purpose (e.g. "the gap tracked", "PhotoCraft")
        return w
    if pre.endswith(".") and len(core) <= 4:                                # a file type: .BGI -> .bgi
        return pre + core.lower() + post
    if core.upper() in PROPER or core.upper() in KEEP_UPPER or core.upper()[:-1] in PROPER:
        return pre + _part(core) + post
    if not cap and core.lower() in SMALL:
        return pre + core.lower() + post
    # hyphenated / slashed parts each capitalised (CONTENT-AWARE -> Content-Aware); 'S stays 's (EDITOR'S -> Editor's)
    parts = re.split(r"([-/])", core)
    out = "".join(p if p in "-/" else _part(p) for p in parts)
    return pre + re.sub(r"'S\b", "'s", out) + post


def title_case(s):
    words = s.split(" ")
    out, cap = [], True
    for i, w in enumerate(words):
        near = (i + 1 < len(words) and words[i + 1] in ("/", "+")) or (i > 0 and words[i - 1] in ("/", "+"))
        out.append(_word(w, cap or near))
        cap = w.endswith((":", "—", ";")) or w in ("—", "-")
    return " ".join(out)


def vkey(v):
    return tuple(int(x) for x in v.split("."))


def parse(text):
    """-> {version: title} for every `## X.Y.Z — TITLE` (the first one wins: HANDOVER.md before the archive)"""
    out = {}
    for line in text.splitlines():
        m = HEAD.match(line)
        if m and m.group(1) not in out:
            out[m.group(1)] = m.group(2)
    return out


def render(entries):
    vs = sorted(entries, key=vkey, reverse=True)
    lines = ["# Changelog", "",
             "Every bitGen Studio release, newest first. The [Feature Reference](docs/bitGen-Studio-Features.pdf) says what each",
             "feature does and the version it arrived in; [docs/USAGE.md](docs/USAGE.md) has the step-by-step guide.", "",
             "Made by `python3 scripts/make_changelog.py` from the release notes.", ""]
    group = None
    for v in vs:
        a, b, _ = vkey(v)
        g = (a, b // 100)
        if g != group:
            group = g
            lo = b // 100 * 100
            lines += ["", f"## {a}.{lo}–{a}.{lo + 99}" if b >= 100 else f"## {a}.0–{a}.99", ""]
        lines.append(f"- **{v}** — {title_case(clean(entries[v]))}")
    return "\n".join(lines).rstrip() + "\n"


def collect():
    text = ""
    for f in ("HANDOVER.md", "HANDOVER-ARCHIVE.md"):
        p = os.path.join(ROOT, f)
        if os.path.exists(p):
            text += open(p, encoding="utf-8").read() + "\n"
    return parse(text)


if __name__ == "__main__":
    entries = collect()
    out = os.path.join(ROOT, "CHANGELOG.md")
    if "--check" in sys.argv:
        if not entries:
            print("make_changelog: no release notes here (a repository checkout) - nothing to check"); sys.exit(0)
        same = os.path.exists(out) and open(out, encoding="utf-8").read() == render(entries)
        print("make_changelog: CHANGELOG.md is " + ("up to date" if same else "OUT OF DATE")); sys.exit(0 if same else 1)
    open(out, "w", encoding="utf-8").write(render(entries))
    print(f"make_changelog: {len(entries)} releases -> CHANGELOG.md")
