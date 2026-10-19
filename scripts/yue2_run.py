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

2.540.6 - ATTENTION. Tim's next song: "RuntimeError: USE_FLASH_ATTENTION was not enabled for build." The pipeline's
CUDA-graph decoder (yue2/cuda_graph.py GraphAR, attention_backend="auto") picks FlashAttention when the op merely
EXISTS with a seqused_k schema - but the Windows PyTorch wheels are built without it, so the call fails. Its own
fallbacks are cuDNN and the public SDPA. This runner asks PyTorch whether FlashAttention is really built in
(torch.backends.cuda.is_flash_attention_available(); unknown = not on Windows) and, when it is not, gives GraphAR
cuDNN (sdpa when cuDNN does not fit the model) - the CUDA graph, and its speed, are kept.
BITGEN_YUE2_ATTN=flash|cudnn|sdpa forces one (music_worker.py retries with sdpa, then --backend torch-eager, when an
attention kernel still fails, and remembers what worked).
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


def flash_ok():
    """is FlashAttention really built into this PyTorch (not just its op name)?"""
    try:
        import torch
        f = getattr(torch.backends.cuda, "is_flash_attention_available", None)
        if callable(f):
            return bool(f())
    except Exception:
        pass
    return os.name != "nt"


def attention_choice():
    """(backend for GraphAR or None = the pipeline's auto, why)"""
    want = os.environ.get("BITGEN_YUE2_ATTN", "").strip().lower()
    if want in ("flash", "cudnn", "sdpa"):
        return want, "BITGEN_YUE2_ATTN"
    if flash_ok():
        return None, ""
    return "cudnn", "this PyTorch build has no FlashAttention"


def set_attention(name):
    """GraphAR(..., attention_backend="auto") -> name; cuDNN that does not fit the model -> sdpa"""
    try:
        import yue2.cuda_graph as cg
    except Exception:
        return False
    orig = cg.GraphAR.__init__

    def init(self, *a, **k):
        if k.get("attention_backend", "auto") != "auto":
            return orig(self, *a, **k)
        k["attention_backend"] = name
        try:
            return orig(self, *a, **k)
        except ValueError:
            if name != "cudnn":
                raise
            print("[bitgen] cuDNN attention does not fit this model - using PyTorch's SDPA", file=sys.stderr, flush=True)
            k["attention_backend"] = "sdpa"
            return orig(self, *a, **k)
    cg.GraphAR.__init__ = init
    return True


def main(argv):
    os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
    flag = os.environ.get("BITGEN_HF_SYMLINKS", "")       # "1" = the hub decides, "0" = never (any OS)
    if (os.name == "nt" and flag != "1") or flag == "0":
        if no_symlinks():
            print("[bitgen] Hugging Face cache: files are copied, not symlinked (Windows without Developer Mode)", file=sys.stderr, flush=True)
    att, why = attention_choice()
    if att and set_attention(att):
        print(f"[bitgen] YuE2 attention: {att} ({why})", file=sys.stderr, flush=True)
    from yue2.cli import main as yue2_main
    return yue2_main(argv)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
