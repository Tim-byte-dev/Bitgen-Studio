"""bitGen Studio — can the native engine use these files? (2.352.0). Runs INSIDE venvs/native.

    python check.py <base dir> <json: {component: {"official": dir} | {"comfy": file}}>
    -> one JSON line: {component: {"ok": bool, "why": str, "gb": float}}

Reads safetensors HEADERS only (names, shapes, the comfy_quant records) - a
ComfyUI file is checked against the exact model it would be loaded into
without reading its gigabytes. component "viggle" = a Viggle transformer
(same shape as transformer_ref); "*_lora" = a LoRA file.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)


def lora_check(path):
    from safetensors import safe_open
    try:
        with safe_open(path, framework="pt") as f:
            keys = list(f.keys())
    except Exception as e:                                          # noqa: BLE001
        return {"ok": False, "why": f"cannot read it ({type(e).__name__})", "gb": 0}
    ab = [k for k in keys if k.endswith((".lora_A.weight", ".lora_B.weight", ".lora_down.weight", ".lora_up.weight"))]
    if not ab:
        return {"ok": False, "why": "no lora_A / lora_B (or lora_down / lora_up) weights - not a LoRA the engine reads", "gb": 0}
    known = [k for k in ab if any(t in k for t in ("transformer_blocks.", "blocks.", "refiner_blocks."))]
    if not known:
        return {"ok": False, "why": f"its keys ({ab[0]}) do not name MiniMax-H3 blocks", "gb": 0}
    return {"ok": True, "why": f"LoRA ({len(ab) // 2} layers)", "gb": round(os.path.getsize(path) / 2 ** 30, 2)}


def main(argv):
    base, spec = argv[1], json.loads(argv[2])
    import h3_engine as H
    out = {}
    for comp, src in spec.items():
        if comp.endswith("_lora"):
            out[comp] = lora_check(src.get("comfy") or src.get("official"))
        elif comp == "viggle":
            out[comp] = H.check_source("transformer_ref", src, base)
        else:
            out[comp] = H.check_source(comp, src, base)
    print(json.dumps(out), flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
