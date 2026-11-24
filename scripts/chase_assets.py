#!/usr/bin/env python3
# bitGen Studio — scripts/chase_assets.py (2.936.0): 🚓 POLICE CHASE's ART PACK from your own Blender city + a roads kit.
#
#   python3 scripts/chase_assets.py --city city.blend --roads modularkit.png --out ext/chasedock/assets
#           [--blender "blender" | --bpy-python /path/to/python-with-bpy] [--size 512] [--credit "text" ...]
#
# Makes ext/chasedock/assets/ (never committed - .gitignore; it ships as its own zip because bought / royalty-free art may
# be used inside bitGen but not handed out as files):
#   buildings/<id>_{px,nx,pz,nz,py}.jpg   each building of the city .blend as five pictures (scripts/chase_bake.py renders
#                                         them - the models themselves are not in the pack)
#   roads/{straight,plain,pavement,plaza}.jpg   squares cut from the roads kit's texture atlas (ROAD_CROPS)
#   buildings/<id>_<face>_d.jpg / _e.jpg  (2.938.0, --dress) the pictures with brick on the walls and a sheen on the glass,
#                                         and a lights map: some windows lit for the night (the game's emissive map)
#   cars/getaway.glb, cars/police.glb    (2.937.0) cars made by scripts/chase_car.py, copied in (--getaway / --police)
#   pack.json   {version: 1, buildings: [{id, name, size_m, faces}], roads: {...}, cars: {getaway, police}, credits: [...]}
# Needs Pillow; the buildings need Blender (the app, run headless) or a Python with the bpy module.
import argparse, json, os, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
# where the pieces sit in the roads kit's 4096 x 4096 atlas (textures/modularkit.png): left, top, right, bottom
ROAD_CROPS = {
    "straight": (3740, 2872, 4070, 3224),   # a road running left-right: edge lines top and bottom, a dashed middle
    "plain": (3470, 3760, 3750, 4040),      # plain asphalt (junctions, corners, dead ends)
    "pavement": (1190, 3000, 1450, 3260),   # concrete pavement (under the blocks)
    "plaza": (880, 2266, 1220, 2606),       # pavers (the police station square)
}
FILL = (22, 27, 38)                          # what shows where a building's picture is empty (night)


def crop_roads(atlas, out, px=256):
    from PIL import Image
    Image.MAX_IMAGE_PIXELS = None
    im = Image.open(atlas).convert("RGB")
    if im.size != (4096, 4096):
        k = im.size[0] / 4096.0
    else:
        k = 1.0
    os.makedirs(out, exist_ok=True)
    got = {}
    for name, box in ROAD_CROPS.items():
        b = tuple(int(round(v * k)) for v in box)
        im.crop(b).resize((px, px), Image.LANCZOS).save(os.path.join(out, name + ".jpg"), quality=88)
        got[name] = "roads/" + name + ".jpg"
    return got


def bake(city, tmp, size, blender, bpy_python):
    script = os.path.join(HERE, "chase_bake.py")
    if bpy_python:
        cmd = [bpy_python, script, "--file", city, "--out", tmp, "--size", str(size)]
    else:
        cmd = [blender or "blender", "-b", "--factory-startup", "--python", script, "--", "--file", city, "--out", tmp, "--size", str(size)]
    print("running:", " ".join(cmd), flush=True)
    r = subprocess.run(cmd, cwd=tempfile.gettempdir())
    if r.returncode != 0:
        raise SystemExit("the bake did not finish (exit %d)" % r.returncode)
    with open(os.path.join(tmp, "bake.json")) as fh:
        return json.load(fh)


def to_jpg(src, dst):
    from PIL import Image
    im = Image.open(src).convert("RGBA")
    bg = Image.new("RGBA", im.size, FILL + (255,))
    bg.alpha_composite(im)
    bg.convert("RGB").save(dst, quality=86)


def dress(out, pack, seed=7):
    """2.938.0 (Tim: "add some brick and glass textures to the buildings and some lights to the buildings"): each side
    picture gets brick on its plain walls, a blue sheen on its glass, and a lights map with some windows lit (pure numpy on
    the pictures - the walls are the light, grey pixels, the glass the bluish or dark ones; the empty fill is left alone)."""
    import numpy as np
    from PIL import Image, ImageFilter
    rng = np.random.default_rng(seed)
    for b in pack.get("buildings", []):
        sx, sy, sz = (b.get("size_m") or [10, 10, 10])[:3]
        b["dressed"], b["lights"] = {}, {}
        for face, rel in b["faces"].items():
            src = os.path.join(out, rel)
            a = np.asarray(Image.open(src).convert("RGB")).astype(np.float32)
            H, W = a.shape[:2]
            r, g, bl = a[..., 0], a[..., 1], a[..., 2]
            mx, mn = a.max(axis=2), a.min(axis=2); lum = 0.299 * r + 0.587 * g + 0.114 * bl
            sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0)
            bg = (np.abs(a - np.array(FILL, np.float32)).sum(axis=2) < 18)
            glass = ~bg & (((bl > r + 8) & (lum < 170)) | (lum < 58))
            # tidy the glass: a soft blur, then a threshold (whole panes, not speckles)
            gm = Image.fromarray((glass * 255).astype(np.uint8)).filter(ImageFilter.BoxBlur(2))
            glass = (np.asarray(gm) > 110) & ~bg
            wall = ~bg & ~glass & (lum > 105) & (sat < 0.2)
            o = a.copy(); e = np.zeros_like(a)
            if face != "py":
                wide = sx if face in ("pz", "nz") else sy
                ppm = W / max(wide, 0.01)                                # pixels a metre
                course = max(3.0, 0.28 * ppm); brick = max(7.0, 0.7 * ppm)
                yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
                row = np.floor(yy / course); off = (row % 2) * brick / 2
                col = np.floor((xx + off) / brick)
                mortar = ((yy % course) < 1.0) | (((xx + off) % brick) < 1.0)
                tone = 0.86 + 0.14 * ((np.sin(row * 12.9898 + col * 78.233) * 43758.5453) % 1.0)
                brickc = np.stack([182 * tone, 96 * tone, 72 * tone], axis=2)
                mix = np.where(mortar[..., None], np.array([196, 190, 180], np.float32), brickc)
                o = np.where(wall[..., None], o * 0.35 + mix * 0.65 * (lum[..., None] / 200.0 + 0.35), o)
                sheen = (0.25 + 0.35 * (1 - yy / max(H, 1)))[..., None]
                o = np.where(glass[..., None], o * (1 - sheen) + np.array([88, 128, 170], np.float32) * sheen, o)
                # the lights: the glass in a grid of window cells, some cells lit warm, some cool
                cw = max(4, int(0.95 * ppm)); ch = max(4, int(0.9 * ppm))
                cells = rng.random(((H // ch) + 2, (W // cw) + 2))
                cy = (yy // ch).astype(int); cx = (xx // cw).astype(int)
                lit = cells[cy, cx] < 0.4
                warm = cells[cy, cx] < 0.3
                col_e = np.where(warm[..., None], np.array([255, 196, 120], np.float32), np.array([170, 205, 255], np.float32))
                e = np.where((glass & lit)[..., None], col_e, 0)
            base = rel[:-4]
            Image.fromarray(np.clip(o, 0, 255).astype(np.uint8)).save(os.path.join(out, base + "_d.jpg"), quality=86)
            b["dressed"][face] = base + "_d.jpg"
            if face != "py":
                Image.fromarray(np.clip(e, 0, 255).astype(np.uint8)).save(os.path.join(out, base + "_e.jpg"), quality=82)
                b["lights"][face] = base + "_e.jpg"
    return pack


def main(argv=None):
    ap = argparse.ArgumentParser(description="Police Chase's art pack")
    ap.add_argument("--city", help="a .blend whose collections are buildings")
    ap.add_argument("--roads", help="the roads kit's texture atlas (4096 x 4096)")
    ap.add_argument("--out", default=os.path.join(HERE, "..", "ext", "chasedock", "assets"))
    ap.add_argument("--size", type=int, default=512)
    ap.add_argument("--blender", default=None)
    ap.add_argument("--bpy-python", default=None)
    ap.add_argument("--credit", action="append", default=[])
    ap.add_argument("--getaway", help="the getaway car: a .glb from scripts/chase_car.py")
    ap.add_argument("--dress", action="store_true", help="brick, glass and lit windows on the buildings (2.938.0)")
    ap.add_argument("--police", help="the police car: a .glb from scripts/chase_car.py (its paint material named Body)")
    a = ap.parse_args(argv)
    out = os.path.abspath(a.out)
    os.makedirs(out, exist_ok=True)
    pack = {"version": 1, "buildings": [], "roads": {}, "cars": {}, "credits": a.credit}
    old = os.path.join(out, "pack.json")
    if os.path.exists(old):
        try:
            prev = json.load(open(old))
            pack["buildings"] = prev.get("buildings", []); pack["roads"] = prev.get("roads", {}); pack["cars"] = prev.get("cars", {})
            pack["credits"] = a.credit or prev.get("credits", [])
        except Exception:
            pass
    for role in ("getaway", "police"):
        f = getattr(a, role)
        if f:
            os.makedirs(os.path.join(out, "cars"), exist_ok=True)
            shutil.copyfile(f, os.path.join(out, "cars", role + ".glb"))
            pack["cars"][role] = "cars/" + role + ".glb"
    if a.roads:
        pack["roads"] = crop_roads(a.roads, os.path.join(out, "roads"))
    if a.city:
        tmp = tempfile.mkdtemp(prefix="chase-bake-")
        try:
            got = bake(os.path.abspath(a.city), tmp, a.size, a.blender, a.bpy_python)
            bdir = os.path.join(out, "buildings"); os.makedirs(bdir, exist_ok=True)
            pack["buildings"] = []
            for b in got:
                faces = {}
                for f, fn in b["faces"].items():
                    dst = "%s_%s.jpg" % (b["id"], f)
                    to_jpg(os.path.join(tmp, fn), os.path.join(bdir, dst))
                    faces[f] = "buildings/" + dst
                pack["buildings"].append({"id": b["id"], "name": b["name"], "size_m": b["size_m"], "faces": faces})
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
    if a.dress:
        dress(out, pack)
    with open(old, "w") as fh:
        json.dump(pack, fh, indent=1)
    print("pack:", old, "-", len(pack["buildings"]), "buildings,", len(pack["roads"]), "road pictures,", len(pack["cars"]), "cars")
    return pack


if __name__ == "__main__":
    main()
