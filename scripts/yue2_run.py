"""bitGen Studio — scripts/yue2_run.py (2.540.6): runs the YuE2 CLI inside its own venv (yue2/.venv), with Hugging
Face's cache told NOT to use symlinks on Windows.

Tim's first YuE2 song (Windows, no Developer Mode): huggingface_hub decided the cache could hold symlinks, then
os.symlink failed with "[WinError 1314] A required privilege is not held by the client" while it fetched
m-a-p/YuE2-Vae (an OSError the hub does not catch - only PermissionError), and the song never started.
Without symlinks the hub COPIES each file into the snapshot (it says so in its own docs: "a degraded version that
might require more space") - the files already in the cache are reused, nothing is downloaded twice.

    <yue2 venv python> scripts/yue2_run.py generate --model M --request FILE --output DIR [--quiet]

Everything after the script name goes to yue2.cli.main unchanged. BITGEN_HF_SYMLINKS=1 keeps the hub's own choice;
BITGEN_HF_SYMLINKS=0 turns symlinks off on any OS (the test does that).
"""
import os
import sys


def no_symlinks():
    """make huggingface_hub copy instead of symlink (its cache works either way)"""
    try:
        import huggingface_hub.file_download as fd
    except Exception:
        return False
    fd.are_symlinks_supported = lambda *a, **k: False
    try:   # older / newer hubs keep the answer per folder in this dict too
        if isinstance(getattr(fd, "_are_symlinks_supported_in_dir", None), dict):
            fd._are_symlinks_supported_in_dir.clear()
    except Exception:
        pass
    return True


def main(argv):
    os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
    flag = os.environ.get("BITGEN_HF_SYMLINKS", "")       # "1" = the hub decides, "0" = never (any OS)
    if (os.name == "nt" and flag != "1") or flag == "0":
        if no_symlinks():
            print("[bitgen] Hugging Face cache: files are copied, not symlinked (Windows without Developer Mode)", file=sys.stderr, flush=True)
    from yue2.cli import main as yue2_main
    return yue2_main(argv)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
