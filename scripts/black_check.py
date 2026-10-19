"""bitGen Studio — is a render all black? (2.348.0)

Tim: "it rendered once, but now it is only rendering a black video". A model
that produced NaNs (or a VAE that decoded garbage) still writes a perfectly
valid video - of black frames - and the job used to finish as "done". The
swap workers ask this before filing a take, and fail IN WORDS instead.

ffmpeg's blackdetect over the whole file: black when the black span covers
(nearly) all of it. No ffmpeg / an unreadable file -> False (never blocks)."""
import re
import subprocess


def black_ratio(path, pix_th=0.06):
    """The fraction of the video that is black (0..1), or None if unknown."""
    try:
        r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-an",
                            "-vf", f"blackdetect=d=0:pix_th={pix_th}", "-f", "null", "-"],
                           capture_output=True, text=True, timeout=300)
    except Exception:                                      # noqa: BLE001
        return None
    err = r.stderr or ""
    m = re.search(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)", err)
    total = (int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))) if m else 0.0
    spans = [float(x) for x in re.findall(r"black_duration:\s*([\d.]+)", err)]
    if total <= 0:
        return None
    return min(1.0, sum(spans) / total)


def all_black(path, at_least=0.9):
    b = black_ratio(path)
    return b is not None and b >= at_least


def reason(engine, safe=False):
    if safe:
        # 2.350.0: the safe-mode render (fp16 accumulation off, no speed
        # patches, ComfyUI's own attention, a full-precision VAE) was black too
        return (f"the {engine} render came back ALL BLACK, in safe mode too (fp16 accumulation off, no speed "
                "patches, ComfyUI's own attention) - so it is the model files or ComfyUI itself: restart ComfyUI, "
                "update ComfyUI + its custom nodes, check the models finished downloading, and look in ComfyUI's "
                "console for 'NaN', 'invalid value' or a warning while the model loads.")
    return (f"the {engine} render came back ALL BLACK - the model most likely produced NaNs (or the VAE decoded "
            "nothing). ↻ Retry with a new seed; if it stays black, restart ComfyUI (a speed patch or "
            "fp16 accumulation left switched on in it can do this) - its console may say 'NaN' or 'invalid value'.")
