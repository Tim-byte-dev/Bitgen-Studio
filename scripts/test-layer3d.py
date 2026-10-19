#!/usr/bin/env python3
"""bitGen Studio — 2.460.0: the 3D layer's Blender side (scripts/blend_layer3d.py) with a real Blender.
A posable fixture (scripts/make_layer3d_fixture.py: a red body, an armature "Figure" with a blue arm on bone "arm", a
front camera) -> inspect (the camera as an orbit, the bones) -> ONE serve process: the scene camera, the same view as an
orbit (the same picture), a turned bone (the arm moves), the next job without the pose (back to the file's own pose),
another orbit, EEVEE. No Blender = SKIP."""
import json, os, shutil, subprocess, sys, tempfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
npass = nfail = 0
def check(n, ok, got=None):
    global npass, nfail
    if ok: npass += 1; print("PASS: " + n)
    else: nfail += 1; print("FAIL: " + n + ("" if got is None else "\n      got " + str(got)[:600]))
exe = shutil.which("blender") or next((p for p in ("/usr/bin/blender", "/usr/local/bin/blender", "/snap/bin/blender") if os.path.exists(p)), None)
if not exe:
    print("SKIP: Blender is not installed here - the 3D layer's Blender test did not run"); sys.exit(0)
try:
    from PIL import Image
except ImportError:
    print("SKIP: Pillow is not installed - the 3D layer's Blender test did not run"); sys.exit(0)
T = tempfile.mkdtemp(prefix="h3_l3d_")
fig = os.path.join(T, "fig.blend")
run = lambda *a, **k: subprocess.run([exe, "-b", "--factory-startup", "-P", *a], capture_output=True, text=True, timeout=600, **k)
r = run(os.path.join(ROOT, "scripts", "make_layer3d_fixture.py"), "--", fig)
check("the fixture scene builds (a figure with a rig, a camera)", os.path.isfile(fig), r.stdout[-400:])
r = run(os.path.join(ROOT, "scripts", "blend_layer3d.py"), "--", "inspect", fig, os.path.join(T, "meta.json"))
meta = json.load(open(os.path.join(T, "meta.json"))) if os.path.isfile(os.path.join(T, "meta.json")) else {}
o = meta.get("orbit") or {}
check("inspect: the scene camera Cam (45°), its view as an orbit (in front, -Y, 6 away, level), the figure's bones hip -> arm",
      meta.get("camera") == "Cam" and abs(o.get("yaw", 0) + 90) < 0.01 and abs(o.get("pitch", 9)) < 0.01 and abs(o.get("dist", 0) - 6) < 0.01 and abs(o.get("fov", 0) - 45) < 0.01
      and meta.get("armatures") == [{"name": "Figure", "bones": [{"name": "hip", "parent": None}, {"name": "arm", "parent": "hip"}]}], meta)
J = lambda n, **k: json.dumps(dict({"cmd": "render", "out": os.path.join(T, n + ".png"), "w": 320, "h": 240, "engine": "WORKBENCH", "cam": None}, **k))
jobs = [J("scene"), J("orbit", cam=o), J("posed", pose={"Figure": {"arm": [0, 0, 60]}}), J("again"), J("side", cam=dict(o, yaw=0, pitch=20)), J("eevee", engine="EEVEE"), J("bad", pose={"Nobody": {"x": [5, 5, 5]}}), json.dumps({"cmd": "quit"})]
r = subprocess.run([exe, "-b", "--factory-startup", "-P", os.path.join(ROOT, "scripts", "blend_layer3d.py"), "--", "serve", fig], input="\n".join(jobs) + "\n", capture_output=True, text=True, timeout=900)
done = [l for l in r.stdout.splitlines() if l.startswith("H3L done ")]
check("serve: loads once ('H3L ready'), answers 7 jobs, each with its time", "H3L ready" in r.stdout and len(done) == 7 and all(l.split()[-1].isdigit() for l in done), r.stdout[-800:])
im = {n: Image.open(os.path.join(T, n + ".png")).convert("RGB") for n in ("scene", "orbit", "posed", "again", "side", "eevee", "bad") if os.path.isfile(os.path.join(T, n + ".png"))}
def diff(a, b):
    A, B = im[a].tobytes(), im[b].tobytes(); return sum(abs(x - y) for x, y in zip(A, B)) / len(A)
def blue(n, box):
    x0, y0, x1, y1 = box; c = 0
    for y in range(y0, y1):
        for x in range(x0, x1):
            p = im[n].getpixel((x, y))
            if p[2] > 120 and p[2] > p[0] + 50 and p[2] > p[1] + 30: c += 1
    return c
check("the scene camera and the same view as an orbit give the same picture (the orbit sum matches Blender's camera)", len(im) == 7 and im["scene"].size == (320, 240) and diff("scene", "orbit") < 1.0, len(im) == 7 and diff("scene", "orbit"))
arm_scene, arm_posed = blue("scene", (180, 90, 250, 120)), blue("posed", (180, 90, 250, 120))
check("a turned bone: the blue arm leaves its place (posed); the figure's body stays", len(im) == 7 and arm_scene > 300 and arm_posed < arm_scene / 3 and diff("scene", "posed") > 0.5, (arm_scene, arm_posed))
check("...the next job without a pose: back to the file's own pose (the same picture as the first)", len(im) == 7 and diff("scene", "again") < 0.5, len(im) == 7 and diff("scene", "again"))
check("another orbit (from the side, from above): another picture", len(im) == 7 and diff("scene", "side") > 5)
check("EEVEE renders too (lit, a shadow) - not the Workbench picture", len(im) == 7 and diff("scene", "eevee") > 2)
check("a pose for a figure that is not there is ignored (the picture as the scene's)", len(im) == 7 and diff("scene", "bad") < 1.0)
# 2.461.0: an ANIMATED figure (the arm swings -30° .. 30° over frames 1 - 21)
anim = os.path.join(T, "anim.blend")
run(os.path.join(ROOT, "scripts", "make_layer3d_fixture.py"), "--", anim, "animated")
jobs = [J("a10", frame=11), J("a10p", frame=11, pose={"Figure": {"arm": [0, 0, 60]}}), J("a10b", frame=11), json.dumps({"cmd": "quit"})]
r = subprocess.run([exe, "-b", "--factory-startup", "-P", os.path.join(ROOT, "scripts", "blend_layer3d.py"), "--", "serve", anim], input="\n".join(jobs) + "\n", capture_output=True, text=True, timeout=900)
for n in ("a10", "a10p", "a10b"):
    if os.path.isfile(os.path.join(T, n + ".png")): im[n] = Image.open(os.path.join(T, n + ".png")).convert("RGB")
check("an animated figure at a frame: a turned bone shows (its channels muted for that view), the next view without it is the animation again (nothing left keyed)",
      all(n in im for n in ("a10", "a10p", "a10b")) and diff("a10", "a10p") > 0.5 and diff("a10", "a10b") < 0.5, all(n in im for n in ("a10", "a10p", "a10b")) and (diff("a10", "a10p"), diff("a10", "a10b")))
# blend_pose.apply over a frame range (the timeline's render / save): the turn keyed on top of the motion at every frame
chk = os.path.join(T, "chk.py")
open(chk, "w").write("""import sys, json, math, bpy
sys.path.insert(0, %r)
import blend_pose
from mathutils import Euler
o = bpy.data.objects["Figure"]; pb = o.pose.bones["arm"]; sc = bpy.context.scene
own = {}
for f in (1, 6, 11, 21):
    sc.frame_set(f); own[f] = pb.rotation_euler.to_quaternion()
n = blend_pose.apply({"Figure": {"arm": [0, 0, 60]}, "Nobody": {"x": [1, 2, 3]}}, list(range(1, 22)))
d = Euler((0, 0, math.radians(60)), "XYZ").to_quaternion()
err = 0.0
for f in (1, 6, 11, 21):
    sc.frame_set(f); q = pb.rotation_quaternion; w = own[f] @ d
    err = max(err, min((q - w).magnitude, (q + w).magnitude))
print("H3L check " + json.dumps({"n": n, "err": err, "mode": pb.rotation_mode}), flush=True)
""" % os.path.join(ROOT, "scripts"))
r = subprocess.run([exe, "-b", anim, "--factory-startup", "-P", chk], capture_output=True, text=True, timeout=600)
ln = [l for l in r.stdout.splitlines() if l.startswith("H3L check ")]
res = json.loads(ln[0][10:]) if ln else {}
check("blend_pose.apply over frames 1 - 21 (the timeline's render): the turn keyed on top of the motion at EVERY frame (own @ turn), a missing figure ignored", res.get("n") == 1 and res.get("err", 9) < 1e-4 and res.get("mode") == "QUATERNION", res or r.stdout[-400:])
shutil.rmtree(T, ignore_errors=True)
print(f"\nRESULT: {npass} passed, {nfail} failed")
sys.exit(1 if nfail else 0)
