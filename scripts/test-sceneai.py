#!/usr/bin/env python3
"""bitGen Studio — 2.404.0: ✨ Build a scene with AI + 🧊 a picture -> a 3D model, LIVE: the app (H3_URL), the stub LLM
(the plan) and the stub ComfyUI (pictures + Comfy-Org's Hunyuan3D / TRELLIS.2 graphs checked against a REAL ComfyUI's
schemas) and a REAL Blender.
Tim (verbatim): "is it possible for our llm to use blender to create 3d models?" -> "can we add option 1 + the image to
workflow?" (Hunyuan default, TRELLIS.2 textured; pictures both from the plan and by hand).
  1. a build: the LLM's prose first -> asked again -> the plan; the dog = a picture (the image style) -> a .glb
     (Hunyuan3D 2.1, the picture cut out first) -> Blender builds <project>/blender/ai/<title>.blend + its plan, the scene
     opens in the preview with every object (the unknown kind as a box, the dog as the model)
  2. the same title again = a new file (<title>_2); a second build while one runs = refused
  3. 3D models off = no pictures, no 3D jobs; no image style = said, stand-ins; the 3D files missing = the 3D job fails
     in words naming them, the scene still built with a stand-in
  4. 🧊 by hand: a gallery picture -> TRELLIS.2 (its files listed by ComfyUI) -> models3d/<name>.glb; a picture that is
     not there / TRELLIS.2's files missing -> words; ■ Stop stops a build
Needs the stubs the e2e starts (ComfyUI on :8388 at STUB_MODELS_ROOT, the LLM on :8391). SKIP without Blender.
Run from repo root: H3_URL=http://127.0.0.1:8311/ python3 scripts/test-sceneai.py"""
import json
import os
import shutil
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
URL = os.environ.get("H3_URL", "http://127.0.0.1:8311/").rstrip("/") + "/"
MODELS = Path(os.environ.get("STUB_MODELS_ROOT", "/tmp/e2e_comfy/ComfyUI/models"))
COMFY_OUT = Path(os.environ.get("STUB_COMFY_OUT", "/tmp/stub-comfy-out"))
FAILED = []
P = f"zz_sceneai_{os.getpid()}"


def check(name, cond, extra=""):
    print(("PASS: " if cond else "FAIL: ") + name + ("" if cond else f"\n      {str(extra)[:1500]}"))
    if not cond:
        FAILED.append(name)


def api(path, body=None, method=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(URL + path.lstrip("/"), data=data, method=method or ("POST" if body is not None else "GET"),
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read() or b"{}")
        except json.JSONDecodeError:
            return e.code, {}


def wait_build(bid, limit=300):
    t0 = time.time()
    while time.time() - t0 < limit:
        _, st = api(f"api/sceneai/status?id={bid}")
        if st.get("state") != "running":
            return st
        time.sleep(1)
    return {"state": "timeout"}


def wait_job(jid, limit=120):
    t0 = time.time()
    while time.time() - t0 < limit:
        _, j = api(f"api/jobs/{jid}")
        if j.get("status") in ("done", "failed", "cancelled"):
            return j
        time.sleep(0.7)
    return {"status": "timeout"}


if not shutil.which("blender"):
    print("SKIP: Blender is not installed here - Build a scene with AI did not run")
    print("\nRESULT: 0 failed")
    sys.exit(0)

FILES = {"hunyuan": [("checkpoints", "hunyuan_3d_v2.1.safetensors"), ("background_removal", "birefnet.safetensors")],
         "trellis": [("diffusion_models", "trellis_2_int8_convrot.safetensors"), ("vae", "trellis_2_shape_vae_bf16.safetensors"),
                     ("vae", "trellis_2_texture_vae_bf16.safetensors"), ("clip_vision", "dino_v3_L_naf_fp32.safetensors")]}
made = []


def put(eng):
    for d, f in FILES[eng]:
        p = MODELS / d / f
        p.parent.mkdir(parents=True, exist_ok=True)
        if not p.exists():
            p.write_bytes(b"stub")
            made.append(p)


def take(eng):
    for d, f in FILES[eng]:
        p = MODELS / d / f
        if p.exists() and p in made:
            p.unlink()
            made.remove(p)


def last_mesh_rec():
    recs = sorted(COMFY_OUT.glob("mesh_*.json"), key=lambda p: p.stat().st_mtime)
    return json.loads(recs[-1].read_text()) if recs else {}


try:
    api("api/projects/load", {"name": P})
    pd = ROOT / "projects" / P
    _, sty = api("api/styles", {"name": f"sceneai pictures {os.getpid()}", "kind": "image", "workflow": "comfy_workflows/img_flux2_klein_9b_t2i.json"})
    SID = (sty.get("style") or {}).get("id")
    check("an image style for the pictures (FLUX.2 Klein t2i)", bool(SID), sty)
    put("hunyuan")
    n_mesh0 = len(list(COMFY_OUT.glob("mesh_*.json")))

    # 1
    code, r = api("api/sceneai/build", {"prompt": "SCENEPLAN_GARBLE_TEST a quiet street with a dog and a red car", "seconds": 4,
                                        "image_style_id": SID, "engine": "auto", "maxModels": 3})
    check("✨ build: started", code == 200 and r.get("id"), r)
    code2, r2 = api("api/sceneai/build", {"prompt": "another", "image_style_id": SID})
    check("a second build while one runs -> refused (409)", code2 == 409 and "already" in (r2.get("error") or ""), (code2, r2))
    st = wait_build(r["id"])
    L = "\n".join(st.get("lines") or [])
    check("the build finished (done)", st.get("state") == "done", L + str(st.get("error")))
    check("the LLM's prose first -> asked again for the JSON alone -> its plan", "asking again" in L and 'plan: "Quiet street" - 7 object(s)' in L, L)
    check("an unknown kind (flying saucer) -> a box, said", '"Ufo": kind "flying saucer"' in L and "a box" in L, L)
    pics = [x for x in (st.get("jobs") or [])]
    check("two queue jobs: the dog's picture (image) then its 3D model (mesh3d)",
          len(pics) == 2 and api(f"api/jobs/{pics[0]}")[1].get("params", {}).get("mode") == "image"
          and api(f"api/jobs/{pics[1]}")[1].get("params", {}).get("mode") == "mesh3d", pics)
    pj = api(f"api/jobs/{pics[0]}")[1] if pics else {}
    check("the picture: the dog alone, on white, centred (the words for image-to-3D), 1024 x 1024, the image style",
          "golden retriever" in (pj.get("params") or {}).get("prompt", "") and "plain white background" in pj["params"]["prompt"]
          and pj["params"].get("width") == 1024 and pj["params"].get("style_id") == SID, (pj.get("params") or {}).get("prompt"))
    glb = pd / "models3d" / "Quiet_street_Dog.glb"
    check("the 3D model: models3d/Quiet_street_Dog.glb, a binary glTF", glb.is_file() and glb.read_bytes()[:4] == b"glTF", list((pd / "models3d").glob("*")) if (pd / "models3d").is_dir() else None)
    rec = last_mesh_rec()
    check("ComfyUI ran Comfy-Org's Hunyuan3D 2.1 graph on THAT picture, cut out first (birefnet), seeded",
          rec.get("_engine") == "hunyuan" and rec.get("_files", {}).get("ckpt_name") == "hunyuan_3d_v2.1.safetensors"
          and "RemoveBackground" in rec.get("_classes", []) and rec.get("_image") == Path(pj.get("output") or "x").name and rec.get("_seeds"),
          (rec, pj.get("output")))
    blend = pd / "blender" / "ai" / "Quiet_street.blend"
    planf = pd / "blender" / "ai" / "Quiet_street.plan.json"
    plan = json.loads(planf.read_text()) if planf.is_file() else {}
    check("Blender built blender/ai/Quiet_street.blend; the plan kept beside it (with the prompt and the dog's model file)",
          blend.is_file() and plan.get("prompt", "").startswith("SCENEPLAN_GARBLE_TEST")
          and any(o.get("name") == "Dog" and str(o.get("file", "")).endswith("Quiet_street_Dog.glb") for o in plan.get("objects", [])), plan.get("objects"))
    check("Blender's notes: the dog's model sized to the plan (0.65 m)", "blender: Dog: the model Quiet_street_Dog.glb, 0.65 m tall" in L, L)
    _, cur = api("api/blendview/current")
    ids = sorted(o.get("id") for o in (cur.get("meta") or {}).get("objects", []))
    check("the scene is open in the preview: every object, the dog a mesh, the camera animated, 4 s",
          cur.get("stem") == "Quiet_street" and all(x in ids for x in ["Street", "Red car", "Lamp", "Old oak", "Walker", "Ufo", "Dog", "Camera", "Ground", "Sun"])
          and (cur.get("meta") or {}).get("frame_end") == 96, (cur.get("stem"), ids))
    check("the status carries the scene (for the page) and the plan's objects", (st.get("scene") or {}).get("stem") == "Quiet_street"
          and any(o.get("name") == "Dog" and o.get("model") == "Quiet_street_Dog.glb" for o in (st.get("plan") or {}).get("objects", [])), st.get("plan"))

    # 2
    code, r = api("api/sceneai/build", {"prompt": "SCENEPLAN_NOMODEL_TEST again", "seconds": 4, "models": False, "image_style_id": SID})
    st = wait_build(r.get("id"))
    L = "\n".join(st.get("lines") or [])
    check("3D models off: no queue job, the same title -> a new file Quiet_street_2.blend (nothing overwritten)",
          st.get("state") == "done" and not st.get("jobs") and (pd / "blender" / "ai" / "Quiet_street_2.blend").is_file()
          and blend.is_file() and (st.get("scene") or {}).get("stem") == "Quiet_street_2", L)

    # 3
    code, r = api("api/sceneai/build", {"prompt": "a street", "seconds": 4})
    st = wait_build(r.get("id"))
    L = "\n".join(st.get("lines") or [])
    check("no image style: said, the dog drawn as a stand-in, the scene still built",
          st.get("state") == "done" and "pick an image style first" in L and "blender: Dog: no model made - a stand-in dog" in L and not st.get("jobs"), L)
    take("hunyuan")
    code, r = api("api/sceneai/build", {"prompt": "a street", "seconds": 4, "image_style_id": SID, "engine": "auto"})
    st = wait_build(r.get("id"))
    L = "\n".join(st.get("lines") or [])
    check("no image-to-3D files: the 3D job fails naming Hunyuan3D's + TRELLIS.2's files, the dog a stand-in, the scene built",
          st.get("state") == "done" and "model: Dog failed" in L and "hunyuan_3d_v2.1.safetensors" in L and "stand-in dog" in L, L)
    code, r = api("api/sceneai/build", {"prompt": ""})
    check("no description -> refused in words", code == 400 and "describe the scene" in (r.get("error") or ""), (code, r))

    # 4
    pic = Path(pj.get("output") or "").name
    put("trellis")
    put("hunyuan")
    code, j = api("api/mesh3d", {"name": pic, "engine": "trellis", "model_name": "dog textured"})
    check("🧊 by hand: a gallery picture queued for TRELLIS.2 -> models3d/dog_textured.glb", code == 200 and j.get("model") == "dog_textured.glb"
          and (j.get("params") or {}).get("mode") == "mesh3d", (code, j))
    jj = wait_job(j.get("id"))
    rec = last_mesh_rec()
    check("... done: ComfyUI ran Comfy-Org's TRELLIS.2 graph (its UNet, both VAEs, DINOv3, the texture stage), the .glb in models3d/",
          jj.get("status") == "done" and rec.get("_engine") == "trellis" and "Trellis2TextureStage" in rec.get("_classes", [])
          and not any("Pixal3D" in c or "Switch" in c for c in rec.get("_classes", []))
          and rec.get("_files", {}).get("unet_name") == "trellis_2_int8_convrot.safetensors" and (pd / "models3d" / "dog_textured.glb").is_file(),
          (jj.get("status"), (jj.get("log") or [])[-5:], rec))
    _, ml = api("api/tlcanvas/models")
    check("the .glb files are listed for ＋ Model and the timeline's 3D layers", all(any((m if isinstance(m, str) else m.get("name")) == n for m in ml.get("models", []))
                                                                                   for n in ("Quiet_street_Dog.glb", "dog_textured.glb")), ml)
    code, j = api("api/mesh3d", {"name": "no_such_picture.png"})
    check("a picture that is not in the project -> 404 in words", code == 404 and "not in this project" in (j.get("error") or ""), (code, j))
    take("trellis")
    code, j = api("api/mesh3d", {"name": pic, "engine": "trellis"})
    jj = wait_job(j.get("id"))
    log = "\n".join(jj.get("log") or [])
    check("TRELLIS.2 asked, its files gone -> the job fails naming exactly those files", jj.get("status") == "failed"
          and "TRELLIS.2 needs trellis_2_int8_convrot.safetensors" in log and "dino_v3_L_naf_fp32" in log, log[-600:])
    code, r = api("api/sceneai/build", {"prompt": "a street", "seconds": 4, "image_style_id": SID})
    api("api/sceneai/stop", {"id": r.get("id")})
    st = wait_build(r.get("id"))
    check("■ Stop: the build stops (cancelled), its jobs cancelled", st.get("state") == "cancelled"
          and all(api(f"api/jobs/{x}")[1].get("status") in ("cancelled", "done", "failed") for x in st.get("jobs") or []), st.get("lines"))
    check("the stub ComfyUI saw every image-to-3D graph pass its real-schema checks (no refusal)", len(list(COMFY_OUT.glob("mesh_*.json"))) >= n_mesh0 + 2)
except Exception as e:                                  # noqa: BLE001
    import traceback
    traceback.print_exc()
    check("the run stopped: " + str(e), False)
finally:
    for p in list(made):
        try:
            p.unlink()
        except OSError:
            pass
    try:
        if "SID" in globals() and SID:
            api(f"api/styles/{SID}", None, "DELETE")
        api("api/blendview/close", {})
        api("api/projects/load", {"name": "default"})
    except Exception:                                   # noqa: BLE001
        pass
    shutil.rmtree(ROOT / "projects" / P, ignore_errors=True)
print(f"\nRESULT: {len(FAILED)} failed")
sys.exit(1 if FAILED else 0)
