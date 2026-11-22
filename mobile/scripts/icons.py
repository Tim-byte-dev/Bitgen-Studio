#!/usr/bin/env python3
"""bitGen app - the launcher icons and the start-up splash made from the bitGen logo (docs/images/logo-512.png) on the
studio's dark background. Run after `npx cap add android`: python3 scripts/icons.py"""
import glob
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
LOGO = os.path.join(ROOT, "..", "docs", "images", "logo-512.png")
RES = os.path.join(ROOT, "android", "app", "src", "main", "res")
BG = (20, 17, 14, 255)                     # --bg #14110e
logo = Image.open(LOGO).convert("RGBA")


def on_bg(size, frac, round_mask=False):
    """the logo at `frac` of the square, centred on the dark background"""
    w, h = size
    im = Image.new("RGBA", (w, h), BG)
    s = int(min(w, h) * frac)
    lg = logo.resize((s, s), Image.LANCZOS)
    im.alpha_composite(lg, ((w - s) // 2, (h - s) // 2))
    if round_mask:
        m = Image.new("L", (w * 4, h * 4), 0)
        from PIL import ImageDraw
        ImageDraw.Draw(m).ellipse((0, 0, w * 4 - 1, h * 4 - 1), fill=255)
        im.putalpha(m.resize((w, h), Image.LANCZOS))
    return im


DENS = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
for d, k in DENS.items():
    folder = os.path.join(RES, "mipmap-" + d)
    os.makedirs(folder, exist_ok=True)
    n = int(round(48 * k)); f = int(round(108 * k))
    on_bg((n, n), 0.92).save(os.path.join(folder, "ic_launcher.png"))
    on_bg((n, n), 0.92, round_mask=True).save(os.path.join(folder, "ic_launcher_round.png"))
    fg = Image.new("RGBA", (f, f), (0, 0, 0, 0))
    s = int(f * 0.62)                       # the adaptive icon's safe zone is the middle 66 dp of 108
    fg.alpha_composite(logo.resize((s, s), Image.LANCZOS), ((f - s) // 2, (f - s) // 2))
    fg.save(os.path.join(folder, "ic_launcher_foreground.png"))
for p in glob.glob(os.path.join(RES, "drawable*", "splash.png")):
    w, h = Image.open(p).size
    on_bg((w, h), 0.42).convert("RGB").save(p)
bgxml = os.path.join(RES, "values", "ic_launcher_background.xml")
if os.path.exists(bgxml):
    t = open(bgxml).read()
    import re
    open(bgxml, "w").write(re.sub(r"#[0-9A-Fa-f]{6}", "#14110E", t, count=1))
print("icons + splash made from", os.path.relpath(LOGO, ROOT))
