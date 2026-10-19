#!/usr/bin/env python3
"""bitGen Studio — 2.402.0: the Blender add-on's "Render scene -> bitGen" (blender/bitgen_bridge) in a REAL Blender.
Tim (verbatim): "can we use this lora and our blender bridge to layout a 3d scene in blender and render it in bitgen
using ltx2.3".
  1. the add-on source: the panel box, the operator, the settings (Looks like / Engine / 3DREAL / Strength / Max
     seconds / Render in bitGen), registered;
  2. LIVE in Blender (headless, --factory-startup; SKIP where Blender is not installed): a cube, a light and an animated
     camera, 300 frames at 1920x1080 / 24 fps - send_scene renders through the scene camera with Workbench, cut to
     Max seconds (2 s = 48 frames), 1280x704 (the long side 1280, multiples of 32), H.264 .mp4 (ftyp) POSTed to
     /api/blender/scene with the prompt / 3DREAL variant / render=1; every render setting put back after; a scene
     with no camera refused in words.
Run from repo root: python3 scripts/test-blenderscene.py"""
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FAILED = []


def check(name, cond, extra=""):
    print(("PASS: " if cond else "FAIL: ") + name + ("" if cond else f"\n      {str(extra)[:1500]}"))
    if not cond:
        FAILED.append(name)


src = (ROOT / "blender" / "bitgen_bridge" / "__init__.py").read_text(encoding="utf-8")
check("the add-on: Render scene -> bitGen (operator bitgen.render_scene registered, the panel's LTX 2.3 · 3DREAL box, "
      "Looks like / Engine / 3DREAL / Strength / Max seconds / Render in bitGen), version 1.1.0",
      "class BITGEN_OT_render_scene" in src and '"bitgen.render_scene"' in src and "BITGEN_OT_render_scene," in src
      and 'box.operator("bitgen.render_scene"' in src and all(k in src for k in ("look:", "engine:", "real:", "real_strength:",
                                                                                 "max_seconds:", "render_now:"))
      and '"version": (1, 1, 0)' in src and "/api/blender/scene?" in src)

exe = shutil.which("blender")
if not exe:
    print("SKIP: Blender is not installed here - the LIVE render legs did not run")
else:
    T = Path(tempfile.mkdtemp(prefix="blscene_"))
    run = T / "run.py"
    run.write_text(r'''
import sys, json, threading, http.server
sys.path.insert(0, %r)
got = {}
class H(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        n = int(self.headers.get("Content-Length") or 0); body = self.rfile.read(n)
        got.update(path=self.path, bytes=len(body), head=body[4:8].decode("latin1"), ct=self.headers.get("Content-Type"))
        out = json.dumps({"ok": True, "name": "blender_Shot.mp4", "seconds": 2, "job": {"id": "j1"}, "note": "LTX 2.3"}).encode()
        self.send_response(200); self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(out))); self.end_headers(); self.wfile.write(out)
    def log_message(self, *a): pass
srv = http.server.HTTPServer(("127.0.0.1", 0), H); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
import bpy
import bitgen_bridge as B
B.register()
B.base_url = lambda context=None: "http://127.0.0.1:%%d" %% port
sc = bpy.context.scene
for o in list(bpy.data.objects): bpy.data.objects.remove(o)
bpy.ops.mesh.primitive_cube_add()
bpy.ops.object.light_add(type="SUN", location=(3, 3, 6))
res = {}
try:
    B.send_scene(bpy.context); res["nocam"] = "sent"
except Exception as e:
    res["nocam"] = str(e)
bpy.ops.object.camera_add(location=(6, -6, 4)); cam = bpy.context.active_object
cam.rotation_euler = (1.1, 0, 0.785); sc.camera = cam
cam.keyframe_insert("location", frame=1); cam.location = (4, -7, 3); cam.keyframe_insert("location", frame=48)
sc.frame_start, sc.frame_end = 1, 300
sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage, sc.render.fps = 1920, 1080, 100, 24
s = sc.bitgen; s.name = "Shot"; s.look = "a red sports car on a sunny street"; s.max_seconds = 2; s.real = "3DREAL-light.safetensors"
before = [sc.render.engine, sc.render.resolution_x, sc.render.resolution_y, sc.frame_end, sc.render.image_settings.file_format, sc.render.filepath]
res["answer"] = B.send_scene(bpy.context)
res["restored"] = before == [sc.render.engine, sc.render.resolution_x, sc.render.resolution_y, sc.frame_end, sc.render.image_settings.file_format, sc.render.filepath]
res["got"] = got
print("H3RESULT " + json.dumps(res))
''' % str(ROOT / "blender"))
    r = subprocess.run([exe, "-b", "--factory-startup", "-P", str(run)], capture_output=True, text=True, timeout=600, cwd=str(T))
    line = next((l for l in r.stdout.splitlines() if l.startswith("H3RESULT ")), "")
    res = json.loads(line[9:]) if line else {}
    got = res.get("got") or {}
    q = got.get("path", "")
    check("LIVE Blender: no camera -> refused in words", "no camera" in str(res.get("nocam")), (res, r.stderr[-600:]))
    check("LIVE Blender: rendered through the scene camera (Workbench) to H.264 .mp4 (ftyp), cut to Max seconds "
          "(48 frames at 24 fps), 1280x704 - POSTed to /api/blender/scene with the look, the 3DREAL variant, render=1",
          got.get("head") == "ftyp" and got.get("bytes", 0) > 1000 and got.get("ct") == "video/mp4"
          and q.startswith("/api/blender/scene?") and "frames=48" in q and "fps=24" in q and "width=1280" in q
          and "height=704" in q and "render=1" in q and "ic_lora=3DREAL-light.safetensors" in q
          and "prompt=a+red+sports+car" in q and "name=Shot" in q, (res, r.stdout[-800:]))
    check("LIVE Blender: every render setting (engine, size, frame range, file format, output path) put back after; "
          "bitGen's answer returned", res.get("restored") is True and (res.get("answer") or {}).get("job") == {"id": "j1"}, res)
    shutil.rmtree(T, ignore_errors=True)

print(f"\nRESULT: {len(FAILED)} failed")
sys.exit(1 if FAILED else 0)
