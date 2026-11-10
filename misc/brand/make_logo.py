#!/usr/bin/env python3
"""bitGen Studio — misc/brand/make_logo.py (2.751.0): THE OFFICIAL bitGen LOGO, every file made from one source.

Tim (verbatim): "make the new logo the official bitgen logo, we use it for everything that uses a logo".
The logo: a tribal butterfly whose wings are two tigers facing each other, and a tree whose branches are the butterfly's
antennae ("the tree is the antannae, 2 tigers facing each other , a butterfly and a tree all in one"), white with a blue
glow in a glowing ring. The source is Tim's picture (docs/images/logo-source.jpg, the navy disc); this script adds the
tree (tapered, pointed strokes like the wings), keys the navy out to transparency and writes every logo file:

    python3 misc/brand/make_logo.py            (from the app folder; Pillow + numpy)

    docs/images/logo.png                 256  README, the website's header / footer / favicon (website-sync.py)
    docs/images/logo-512.png             512  the master for anything new (transparent)
    static/icon.png                      512  the app window + taskbar (electron/main.js)
    static/favicon.png                    64  the app's browser tab
    installer/bitgen.ico          16 - 256    the Windows shortcut (installer/bootstrap.ps1)
    docs/images/bitgen-logo-1920x1080.png     the banner (the website's link preview - og.jpg)
The vector versions are static/logo.svg (the butterfly + tree; the intro film draws it, misc/intro/render.js, and adds
the ring) and static/logo-mark.svg (no ring - the small mark, e.g. the title bar). See docs/BRAND.md.
"""
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
P = lambda *a: os.path.join(ROOT, *a)
S = 4                                    # drawn 4x, scaled down (smooth edges)

def bez(p, t):
    (x0, y0), (x1, y1), (x2, y2), (x3, y3) = p
    u = 1 - t
    return (u**3*x0 + 3*u*u*t*x1 + 3*u*t*t*x2 + t**3*x3, u**3*y0 + 3*u*u*t*y1 + 3*u*t*t*y2 + t**3*y3)

def stroke(p, w0, wmax, w1, n=80, peak=0.35):
    """a tapered stroke along a cubic: width w0 at the start, wmax at `peak`, w1 at the end (0 = a point) -> polygon"""
    pts = [bez(p, i / n) for i in range(n + 1)]
    left, right = [], []
    for i, (x, y) in enumerate(pts):
        t = i / n
        a = pts[max(i - 1, 0)]; b = pts[min(i + 1, n)]
        dx, dy = b[0] - a[0], b[1] - a[1]; L = math.hypot(dx, dy) or 1
        nx, ny = -dy / L, dx / L
        w = (w0 + (wmax - w0) * math.sin(math.pi / 2 * t / peak)) if t < peak else (w1 + (wmax - w1) * math.cos(math.pi / 2 * (t - peak) / (1 - peak)))
        w /= 2
        left.append((x + nx * w, y + ny * w)); right.append((x - nx * w, y - ny * w))
    return left + right[::-1]

def mirror(poly, cx):
    return [(2 * cx - x, y) for x, y in poly]

CX = 293.0
shapes = []
# the trunk: from between the tigers' chins up to where the wings part
trunk = stroke([(CX, 418), (CX, 385), (CX, 345), (CX, 306)], 9, 9, 7, peak=0.5)
shapes.append(trunk)
# the roots: two short pointed flares at the foot
root = stroke([(CX - 1, 410), (CX - 6, 418), (CX - 12, 424), (CX - 21, 428)], 6, 6, 0, peak=0.2)
shapes += [root, mirror(root, CX)]
# a branch = an antenna: out of the trunk, sweeping up and out, its tip curling outward (the tribal hook)
branch = stroke([(CX - 1, 314), (CX - 15, 282), (CX - 22, 228), (CX - 46, 186)], 7, 12, 4, peak=0.4)
hook = stroke([(CX - 45, 188), (CX - 56, 168), (CX - 76, 165), (CX - 82, 184)], 8, 8, 0, peak=0.15)
# a twig on the outside of each branch (the tree), pointed like the wings' flames
twig = stroke([(CX - 17, 266), (CX - 32, 255), (CX - 41, 240), (CX - 43, 222)], 8, 8, 0, peak=0.2)
for s in (branch, hook, twig):
    shapes += [s, mirror(s, CX)]



def with_tree(base):
    """Tim's picture + the tree, drawn like the wings: white with their blue glow"""
    W, H = base.size
    layer = Image.new("L", (W * S, H * S), 0)
    d = ImageDraw.Draw(layer)
    for poly in shapes:
        d.polygon([(x * S, y * S) for x, y in poly], fill=255)
    mask = layer.resize((W, H), Image.LANCZOS)
    img = np.asarray(base).astype(np.float32)
    m = np.asarray(mask).astype(np.float32) / 255
    for radius, col, k in [(9, (60, 120, 170), 0.55), (3, (140, 185, 215), 0.6)]:
        g = np.asarray(mask.filter(ImageFilter.GaussianBlur(radius))).astype(np.float32) / 255 * k
        img = img * (1 - g[..., None]) + np.array(col, np.float32) * g[..., None]
    img = img * (1 - m[..., None]) + np.array((228, 236, 242), np.float32) * m[..., None]
    return np.clip(img, 0, 255).astype(np.uint8).astype(np.float32)        # 8-bit, as the drawing was made


def transparent(img):
    """the navy keyed out: brightness above the navy = opacity; the glow's colour recovered from the navy; squared"""
    a = np.clip((img.max(axis=2) - 62.0) / 118.0, 0, 1)
    bg = np.array([10, 27, 53], np.float32)
    col = np.clip((img - bg * (1 - a[..., None])) / np.maximum(a, 1e-3)[..., None], 0, 255)
    out = np.zeros(img.shape[:2] + (4,), np.float32)
    out[..., :3] = np.where(a[..., None] > 0, col, 0)
    out[..., 3] = a * 255
    im = Image.fromarray(out.astype(np.uint8), "RGBA")
    W, H = im.size
    side = max(W, H) + 8
    cx, cy = W // 2, H // 2
    sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    sq.paste(im.crop((cx - side // 2, cy - side // 2, cx - side // 2 + side, cy - side // 2 + side)), (0, 0))
    return sq


def banner(master):
    """the logo on a deep navy, lit from the middle like its own glow (1920 x 1080)"""
    W, H = 1920, 1080
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    r = np.sqrt(((xx - W / 2) / (W * 0.55)) ** 2 + ((yy - H / 2) / (H * 0.62)) ** 2)
    k = np.clip(1 - r, 0, 1) ** 1.6
    c0, c1 = np.array([2, 6, 14], np.float32), np.array([9, 24, 48], np.float32)
    ban = Image.fromarray((c0 + (c1 - c0) * k[..., None]).astype(np.uint8), "RGB").convert("RGBA")
    L = 940
    ban.alpha_composite(master.resize((L, L), Image.LANCZOS), ((W - L) // 2, (H - L) // 2))
    return ban.convert("RGB")


def main():
    base = Image.open(P("docs", "images", "logo-source.jpg")).convert("RGB")
    master = transparent(with_tree(base)).resize((512, 512), Image.LANCZOS)
    out = {}
    def save(rel, im, **kw):
        im.save(P(*rel.split("/")), **kw); out[rel] = im.size
    save("docs/images/logo-512.png", master, optimize=True)
    save("docs/images/logo.png", master.resize((256, 256), Image.LANCZOS), optimize=True)
    save("static/icon.png", master, optimize=True)
    save("static/favicon.png", master.resize((64, 64), Image.LANCZOS), optimize=True)
    master.resize((256, 256), Image.LANCZOS).save(P("installer", "bitgen.ico"), format="ICO", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    out["installer/bitgen.ico"] = "16-256"
    save("docs/images/bitgen-logo-1920x1080.png", banner(master), optimize=True)
    for k, v in out.items():
        print(f"{k}: {v}")


if __name__ == "__main__":
    sys.exit(main())
