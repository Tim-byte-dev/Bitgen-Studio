#!/usr/bin/env python3
"""Report whether a venv has everything an installed distribution declares.

Run INSIDE the target venv:  python check_deps.py fish-speech [extra ...]

Rather than hardcoding a list that will rot, this asks the installed package
what it requires (importlib.metadata) and checks each one resolves. Extra
names can be appended for things a package needs at RUN time without
declaring them — torchcodec is the current example: recent torchaudio
delegates audio decoding to it, so loading a reference clip fails with
"torch codec is required" even though nothing declares it.

Prints one JSON line: {"missing": [...], "present": [...], "notes": [...]}
"""
import json
import sys

try:
    from importlib import metadata as md
except ImportError:                                          # pragma: no cover
    import importlib_metadata as md                          # type: ignore

# import name -> distribution name, where they differ
ALIASES = {"PIL": "pillow", "yaml": "pyyaml", "sklearn": "scikit-learn",
           "cv2": "opencv-python", "soundfile": "soundfile"}


def dist_ok(name):
    try:
        md.version(name)
        return True
    except Exception:                                        # noqa: BLE001
        return False


def req_names(dist):
    """Declared requirements, minus optional extras (we only need the base set)."""
    out = []
    try:
        reqs = md.requires(dist) or []
    except Exception:                                        # noqa: BLE001
        return out
    for r in reqs:
        if "extra ==" in r:            # optional extra, not needed for inference
            continue
        name = r.split(";")[0].strip()
        for sep in ("[", "<", ">", "=", "!", "~", " ", "("):
            name = name.split(sep)[0]
        name = name.strip()
        if name:
            out.append(name)
    return out


def main():
    targets = sys.argv[1:] or ["fish-speech"]
    primary, extras = targets[0], targets[1:]
    missing, present, notes = [], [], []

    if not dist_ok(primary):
        notes.append(f"{primary} itself is not installed in this venv")
    for name in sorted(set(req_names(primary))):
        (present if dist_ok(name) else missing).append(name)
    for name in extras:
        (present if dist_ok(name) else missing).append(name)

    # torchaudio moved decoding to torchcodec; flag the pairing explicitly
    if dist_ok("torchaudio") and not dist_ok("torchcodec"):
        notes.append("torchaudio is installed but torchcodec is not - recent "
                     "torchaudio delegates audio decoding to torchcodec, so "
                     "loading a reference clip fails with 'torch codec is required'")
    print(json.dumps({"missing": sorted(set(missing)),
                      "present": sorted(set(present)), "notes": notes}))
    return 1 if missing else 0


if __name__ == "__main__":
    sys.exit(main())
