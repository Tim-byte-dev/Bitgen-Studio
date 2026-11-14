"""bitGen Studio — 2.781.1 units: ComfyUI's newer combo lists (["COMBO", {"options": [...]}] / {"type": "COMBO", ...}) are
read by the Python side too (scripts/comfy_client.py combo_choices / combo_values), so a Basic Settings model in
models/checkpoints still moves the style's UNETLoader to Load Checkpoint (relocate_model_loaders) on a new pod's ComfyUI.

Tim's log (a new bitGen pod, ComfyUI 0.45):
    model: node 70.unet_name = krea2_nsfw-aio-2.safetensors
    node 70: Value not in list [unet_name] = krea2_nsfw-aio-2.safetensors
      unet_name: 'krea2_nsfw-aio-2.safetensors' not in []
The pod had downloaded it from Civitai into models/checkpoints; every list read empty, so nothing moved.
Run: python3 scripts/test-combo7811.py
"""
import copy
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import comfy_client as CC                                    # noqa: E402
import comfy_image as C                                      # noqa: E402

PASS = FAIL = 0


def check(name, cond, got=None):
    global PASS, FAIL
    if cond:
        PASS += 1
        print("PASS: " + name)
    else:
        FAIL += 1
        print("FAIL: " + name + ("\n      " + repr(got) if got is not None else ""))


AIO = "krea2_nsfw-aio-2.safetensors"
CKPT = ["sd_xl_base_1.0.safetensors", AIO]
check("combo_choices: classic [[...], {...}]", CC.combo_choices([["a", "b"], {}]) == ["a", "b"])
check("…newer [\"COMBO\", {\"options\": [...]}]", CC.combo_choices(["COMBO", {"options": ["a", "b"], "multiselect": False}]) == ["a", "b"])
check("…object form {\"type\": \"COMBO\", \"options\": [...]}", CC.combo_choices({"type": "COMBO", "options": ["x"]}) == ["x"])
check("…an empty list is a list (ComfyUI has none), not a non-combo", CC.combo_choices(["COMBO", {"options": []}]) == [] and CC.combo_choices(["INT", {"default": 1}]) is None and CC.combo_choices("x") is None)


def answers(shape):
    def wrap(lst):
        return [lst, {}] if shape == "classic" else ["COMBO", {"options": lst}] if shape == "combo" else {"type": "COMBO", "options": lst}
    return {
        "UNETLoader": {"UNETLoader": {"input": {"required": {"unet_name": wrap([]), "weight_dtype": wrap(["default", "fp8_e4m3fn"])}}}},
        "UnetLoaderGGUF": {"UnetLoaderGGUF": {"input": {"required": {"unet_name": wrap([])}}}},
        "CheckpointLoaderSimple": {"CheckpointLoaderSimple": {"input": {"required": {"ckpt_name": wrap(CKPT)}}}},
    }


real = CC.object_info
for shape in ("classic", "combo", "object"):
    A = answers(shape)
    CC.object_info = lambda base, ct=None, timeout=15, A=A: A.get(ct) if ct else A
    check(shape + ": combo_values reads Load Checkpoint's list", CC.combo_values("http://pod", "CheckpointLoaderSimple", "ckpt_name") == CKPT)
    g, _ = C.patch(C.load_workflow(os.path.join(HERE, "..", "comfy_workflows", "img_krea2_raw_t2i.json")), {"model": AIO}, {"prompt": "a blonde woman", "seed": 1})
    before = copy.deepcopy(g)
    out = CC.relocate_model_loaders("http://pod", g)
    n = g["70"]
    check(shape + ": Tim's Krea 2 Raw + the AIO checkpoint in models/checkpoints -> node 70 is Load Checkpoint with it (the text encoder + VAE loaders stay)",
          n["class_type"] == "CheckpointLoaderSimple" and n["inputs"].get("ckpt_name") == AIO and len(out) == 1 and all(g[k] == before[k] for k in g if k != "70"), (n, out))
CC.object_info = real
src = open(os.path.join(HERE, "..", "misc", "worker.py"), encoding="utf8").read()
check("the worker's schema sync fills a missing combo from the newer shape too", "_combo_list(sp) or" in src and "2.781.1" in src)
print(f"\n{PASS} passed, {FAIL} failed")
sys.exit(1 if FAIL else 0)
