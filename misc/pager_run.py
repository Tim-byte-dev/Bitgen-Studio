"""bitGen Studio — misc/pager_run.py (2.994.0): ⛰ PANORAMA DEPTH - runs IN PaGeR's own venv (cwd = its folder), started by
misc/pager_worker.py. The model is loaded and called exactly as PaGeR's own app.py does (commit c465ffb, read 2026-11-27):
  cfg = OmegaConf.load(hf_hub_download(repo, "config.yaml")); Pager(Path(repo), cfg=cfg, device); get_intrinsics_extrinsics;
  the picture -> [-1, 1] -> erp_to_cubemap(face_w = cfg.face_size, fov = cfg.cube_fov); the indoor / outdoor scale head from
  its CLIP classifier (or the one asked); pager(cube, dtype=float16, skip_heads=...); prepare_depth_for_logging /
  prepare_normals_for_logging; the sky's probability through cubemap_to_erp.
PaGeR's weights are CC BY-NC 4.0 - NON-COMMERCIAL use only (said in every message bitGen shows about it).

  python pager_run.py <args.json>   args = {image, out_dir, stem, scene auto|indoor|outdoor, ipd, stereo, mesh, repo, geo_dir}
Writes into out_dir: <stem>_depth.png (coloured), <stem>_depth16.png (centimetres, 16-bit), <stem>_sky.png, <stem>_normals.png,
<stem>_depth.f32 (512 x 256 float32 metres, for the viewer), <stem>_depth.json, <stem>_depth.glb (the walk-in mesh) and
<stem>_360_TB.png (the stereo 360, top = left eye); prints @@RESULT {json} last.
"""
import json
import sys
import time
from pathlib import Path

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:                                      # noqa: BLE001
        pass

ERP_W, ERP_H = 2048, 1024       # the picture the model reads (its cube faces are 504 px; app.py reads 4032 x 2016)
GRID_W, GRID_H = 512, 256       # the viewer's depth grid + the mesh


def say(t):
    print(t, flush=True)


def main():
    a = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    sys.path.insert(0, str(Path.cwd()))
    sys.path.insert(0, str(a["geo_dir"]))
    import numpy as np
    import torch
    from huggingface_hub import hf_hub_download
    from matplotlib import pyplot as plt
    from omegaconf import OmegaConf
    from PIL import Image
    from src.pager import Pager
    from src.utils.geometry_utils import cubemap_to_erp, erp_to_cubemap
    from src.utils.utils import prepare_depth_for_logging, prepare_normals_for_logging
    import pager_geo as G

    t0 = time.time()
    out, stem = Path(a["out_dir"]), a["stem"]
    out.mkdir(parents=True, exist_ok=True)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    if device.type != "cuda":
        say("[pager] no CUDA card found - it runs on the CPU (very slow)")
    repo = a.get("repo") or "prs-eth/PaGeR"
    say("[pager] loading PaGeR (" + repo + " - CC BY-NC 4.0, non-commercial use only)")
    cfg = OmegaConf.load(hf_hub_download(repo_id=repo, filename="config.yaml"))
    face_size, cube_fov = int(cfg.face_size), float(getattr(cfg, "cube_fov", 90.0))
    pager = Pager(Path(repo), cfg=cfg, device=device)
    pager.get_intrinsics_extrinsics(image_size=face_size, fov=cube_fov)
    pager.model.to(device, dtype=pager.weight_dtype)
    pager.model.eval()

    pic = Image.open(a["image"]).convert("RGB")
    src_w, src_h = pic.size
    if abs(src_w / max(1, src_h) - 2.0) > 0.15:
        say(f"[pager] note: {src_w} x {src_h} is not 2:1 - a 360° panorama is twice as wide as it is high; read as one anyway")
    pic = pic.resize((ERP_W, ERP_H), Image.BICUBIC)
    rgb = np.array(pic)
    img = torch.from_numpy(rgb).permute(2, 0, 1).to(torch.float32) / 255.0
    img = img * 2.0 - 1.0
    cube = erp_to_cubemap(img, face_w=face_size, fov=cube_fov).unsqueeze(0).to(device)

    heads = {"indoor": "scale_indoor", "outdoor": "scale_outdoor"}
    scene = a.get("scene") or "auto"
    if scene not in heads:
        from src.utils.scene_classifier import get_classifier
        label, p_out = get_classifier(device=device).classify((cube[0] + 1.0) * 0.5)
        scene = "outdoor" if label == "outdoor" else "indoor"
        say(f"[pager] the scene reads as {scene} (outdoor {float(p_out):.2f})")
    skip = {h for k, h in heads.items() if k != scene}
    say("[pager] the depth, the normals and the sky (" + scene + " scale)")
    with torch.inference_mode():
        pred = pager(cube, dtype=torch.float16, skip_heads=skip)
    sky_pred = pred["sky"][0] if "sky" in pred else None
    size = (ERP_H, ERP_W)
    raw_depth, viz_depth = prepare_depth_for_logging(pager, pred["depth"][0], sky_pred, size, plt.get_cmap("Spectral"), log_scale=pred.get("scale", None))
    raw_n, viz_n = prepare_normals_for_logging(pager, pred["normals"][0], sky_pred, size)
    depth = np.squeeze(np.asarray(raw_depth, dtype=np.float32))
    sky = None
    if sky_pred is not None:
        with torch.inference_mode():
            sky = cubemap_to_erp(torch.sigmoid(sky_pred.float()), *size, fov=cube_fov).detach().cpu().numpy().squeeze()
    del pager, pred
    if device.type == "cuda":
        torch.cuda.empty_cache()

    files = {}
    def keep(key, name):
        files[key] = name
        return out / name
    Image.fromarray(np.transpose(viz_depth, (1, 2, 0))).save(keep("preview", f"{stem}_depth.png"))
    Image.fromarray(np.clip(depth * 100.0, 0, 65535).astype(np.uint16)).save(keep("depth16", f"{stem}_depth16.png"))
    Image.fromarray(np.transpose(viz_n, (1, 2, 0))).save(keep("normals", f"{stem}_normals.png"))
    if sky is not None:
        Image.fromarray((np.clip(sky, 0, 1) * 255).astype(np.uint8)).save(keep("sky", f"{stem}_sky.png"))
    g = G.grid(depth, GRID_W, GRID_H)
    keep("grid", f"{stem}_depth.f32")
    (out / files["grid"]).write_bytes(g.astype("<f4").tobytes())
    if a.get("mesh", True):
        from io import BytesIO
        tex = Image.fromarray(rgb)
        b = BytesIO()
        tex.save(b, "JPEG", quality=90)
        pos, uv, idx = G.mesh(g)
        (out / keep("mesh", f"{stem}_depth.glb")).write_bytes(G.glb(pos, uv, idx, b.getvalue(), stem + " (⛰ depth - PaGeR, non-commercial)"))
    if a.get("stereo", True):
        ipd = float(a.get("ipd") or 0.064)
        say(f"[pager] the stereo 360 (top / bottom, eyes {ipd * 1000:.0f} mm apart)")
        Image.fromarray(G.stereo_tb(rgb, depth, ipd)).save(keep("stereo", f"{stem}_360_TB.png"))
    valid = depth[(depth > 0) & ((sky < 0.3) if sky is not None else True)]
    meta = {"format": "bitgen-panodepth", "v": 1, "stem": stem, "scene": scene, "width": ERP_W, "height": ERP_H,
            "grid": [GRID_W, GRID_H], "units": {"depth16": "cm", "grid": "m"}, "near": float(valid.min()) if valid.size else 0.0,
            "median": float(np.median(valid)) if valid.size else 0.0, "far": float(depth.max()), "source": Path(a["image"]).name,
            "licence": "PaGeR weights CC BY-NC 4.0 - non-commercial use only", "files": files, "seconds": round(time.time() - t0, 1)}
    (out / keep("meta", f"{stem}_depth.json")).write_text(json.dumps(meta, indent=1), encoding="utf-8")
    say("@@RESULT " + json.dumps(meta))


if __name__ == "__main__":
    main()
