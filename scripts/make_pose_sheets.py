#!/usr/bin/env python3
"""bitGen Studio — generate the character-sheet POSE TEMPLATES (2.207.0).

Black-line drawings on flat grey, one file per subject family, each laid out
exactly as the sheet prompt describes: full-body FRONT / SIDE / BACK panels
plus two head close-ups (front portrait, side profile). They ride as the
Klein edit's SLOT-1 image — "the image being edited" — so the render anchors
its layout and poses to THESE figures instead of holding onto the uploaded
photo's shapes (the i2i/lineart-controlnet behaviour Tim diagnosed: a horse
photo edited in place comes out a furry, and photo artifacts bleed into the
sheet). The photo rides as reference 2, identity only.

DEV-TIME ONLY: the PNGs are shipped prebuilt in static/pose-sheets/; this
script exists so they can be regenerated or tweaked (needs `pip install
cairosvg`). Run from repo root:  python3 scripts/make_pose_sheets.py
"""
import os
import sys

try:
    import cairosvg
except ImportError:
    sys.exit("cairosvg is not installed — pip install cairosvg (dev-time only; "
             "the PNGs ship prebuilt in static/pose-sheets/)")

W, H = 1664, 944
BG = "#d9d9d9"          # the sheet prompt's "flat grey background"
FRAME = "#b5b5b5"
INK = "#111111"
LW = 6                   # main stroke width
LWT = 4                  # thin stroke (details)

# Panel geometry shared by every species so the template family is consistent:
# front | side (wide, quadrupeds are long) | back | two stacked head panels.
PANELS = {
    "front": (20, 20, 370, 904),
    "side": (410, 20, 720, 904),
    "back": (1150, 20, 250, 904),
    "head_f": (1420, 20, 224, 442),
    "head_s": (1420, 482, 224, 442),
}


def catmull(points, closed=False):
    """A smooth path through hand-placed points (Catmull-Rom -> cubic bezier),
    so simple coordinate lists read as organic contours rather than polygons."""
    p = list(points)
    if len(p) < 3:
        return "M " + " L ".join(f"{x:.1f} {y:.1f}" for x, y in p)
    if closed:
        p = [p[-1]] + p + [p[0], p[1]]
    else:
        p = [p[0]] + p + [p[-1]]
    d = f"M {p[1][0]:.1f} {p[1][1]:.1f} "
    for i in range(1, len(p) - 2):
        p0, p1, p2, p3 = p[i - 1], p[i], p[i + 1], p[i + 2]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6.0, p1[1] + (p2[1] - p0[1]) / 6.0)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6.0, p2[1] - (p3[1] - p1[1]) / 6.0)
        d += f"C {c1[0]:.1f} {c1[1]:.1f} {c2[0]:.1f} {c2[1]:.1f} {p2[0]:.1f} {p2[1]:.1f} "
    if closed:
        d += "Z"
    return d


def stroke(d, w=LW):
    return (f'<path d="{d}" fill="none" stroke="{INK}" stroke-width="{w}" '
            'stroke-linecap="round" stroke-linejoin="round"/>')


def line(x1, y1, x2, y2, w=LW):
    return (f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" '
            f'stroke="{INK}" stroke-width="{w}" stroke-linecap="round"/>')


def circle(cx, cy, r, w=LW, fill="none"):
    return (f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" fill="{fill}" '
            f'stroke="{INK}" stroke-width="{w}"/>')


def dot(cx, cy, r=4):
    return f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r}" fill="{INK}" stroke="none"/>'


class Panel:
    """Draw in unit space (any coords); primitives are collected, then fitted
    to the panel by their actual bounds at svg() time — figures FILL panels."""
    def __init__(self, key, pad=0.08):
        self.key = key
        self.pad = pad
        self.ops = []            # ("path", pts, closed, w) | ("seg", a, b, w)
                                 # | ("circ", c, r, w) | ("dot", c, r)
        self.minx = self.miny = 1e9
        self.maxx = self.maxy = -1e9

    def _grow(self, pts, r=0):
        for x, y in pts:
            self.minx = min(self.minx, x - r); self.maxx = max(self.maxx, x + r)
            self.miny = min(self.miny, y - r); self.maxy = max(self.maxy, y + r)

    def path(self, pts, closed=False, w=LW):
        self._grow(pts); self.ops.append(("path", list(pts), closed, w))

    def seg(self, a, b, w=LW):
        self._grow([a, b]); self.ops.append(("seg", a, b, w))

    def circ(self, c, r, w=LW):
        self._grow([c], r); self.ops.append(("circ", c, r, w))

    def dot(self, c, r=1.2):
        self._grow([c], r); self.ops.append(("dot", c, r))

    def svg(self):
        x, y, w, h = PANELS[self.key]
        cw = max(self.maxx - self.minx, 1e-6)
        ch = max(self.maxy - self.miny, 1e-6)
        s = min(w * (1 - 2 * self.pad) / cw, h * (1 - 2 * self.pad) / ch)
        ox = x + (w - cw * s) / 2.0 - self.minx * s
        oy = y + (h - ch * s) / 2.0 - self.miny * s
        def pt(p): return (ox + p[0] * s, oy + p[1] * s)
        parts = []
        for op in self.ops:
            if op[0] == "path":
                _, pts, closed, lw = op
                parts.append(stroke(catmull([pt(p) for p in pts], closed), lw))
            elif op[0] == "seg":
                _, a, b, lw = op
                (x1, y1), (x2, y2) = pt(a), pt(b)
                parts.append(line(x1, y1, x2, y2, lw))
            elif op[0] == "circ":
                _, c, r, lw = op
                cx, cy = pt(c)
                parts.append(circle(cx, cy, r * s, lw))
            else:
                _, c, r = op
                cx, cy = pt(c)
                parts.append(dot(cx, cy, max(3, r * s)))
        return "".join(parts)


def frame():
    out = [f'<rect width="{W}" height="{H}" fill="{BG}"/>']
    for x, y, w, h in PANELS.values():
        out.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="none" '
                   f'stroke="{FRAME}" stroke-width="2"/>')
    return "".join(out)


# ---------------------------------------------------------------- figures --
# Every figure is drawn in its panel's 0..100 unit box, y DOWN, feet ~97.

def human():
    out = []
    def standing(p, face=False):
        p.circ((50, 9), 7)
        p.path([(46, 16), (46, 20)]); p.path([(54, 16), (54, 20)])   # neck
        p.path([(46, 20), (34, 23), (30, 26)])                       # shoulder L
        p.path([(54, 20), (66, 23), (70, 26)])                       # shoulder R
        p.path([(30, 26), (26, 40), (24, 54), (26, 57)])             # arm L outer
        p.path([(70, 26), (74, 40), (76, 54), (74, 57)])             # arm R outer
        p.path([(34, 25), (35, 40), (33, 53)])                       # arm L inner
        p.path([(66, 25), (65, 40), (67, 53)])                       # arm R inner
        p.path([(38, 24), (37, 40), (39, 55), (42, 60)])             # torso L
        p.path([(62, 24), (63, 40), (61, 55), (58, 60)])             # torso R
        p.path([(42, 60), (50, 62), (58, 60)])                       # hips
        p.path([(42, 60), (41, 76), (42, 90), (42, 96)])             # leg L outer
        p.path([(58, 60), (59, 76), (58, 90), (58, 96)])             # leg R outer
        p.path([(49, 63), (48, 76), (47, 92)])                       # leg L inner
        p.path([(51, 63), (52, 76), (53, 92)])                       # leg R inner
        p.seg((42, 96), (35, 97)); p.seg((58, 96), (65, 97))         # feet
        if face:
            p.dot((47, 8), 0.8); p.dot((53, 8), 0.8)
            p.path([(48, 12), (52, 12)], w=LWT)
    p = Panel("front"); standing(p, face=True); out.append(p.svg())
    # SIDE: profile — one visible arm, legs offset, feet forward
    p = Panel("side", pad=0.18)
    p.circ((50, 9), 7)
    p.path([(50, 16), (49, 21)])                                     # neck
    p.path([(49, 21), (44, 24), (43, 40), (44, 56), (46, 61)])       # back line
    p.path([(49, 21), (55, 24), (56, 34), (54, 48), (55, 61)])       # chest/front
    p.path([(52, 24), (53, 40), (51, 54)])                           # near arm
    p.path([(46, 61), (55, 61)])                                     # seat
    p.path([(50, 61), (49, 76), (49, 96)]); p.seg((49, 96), (58, 97))  # near leg
    p.path([(52, 61), (53, 76), (53, 95)], w=LWT); p.seg((53, 95), (60, 96), w=LWT)
    out.append(p.svg())
    p = Panel("back"); standing(p, face=False); out.append(p.svg())
    # HEAD front / profile
    p = Panel("head_f", pad=0.16)
    p.path([(50, 12), (68, 20), (73, 44), (64, 68), (50, 76), (36, 68),
            (27, 44), (32, 20)], closed=True)
    p.path([(27, 42), (22, 48), (27, 56)]); p.path([(73, 42), (78, 48), (73, 56)])
    p.dot((41, 42), 1.1); p.dot((59, 42), 1.1)
    p.seg((50, 48), (50, 56), w=LWT)
    p.path([(43, 64), (50, 66), (57, 64)], w=LWT)
    out.append(p.svg())
    p = Panel("head_s", pad=0.16)
    p.path([(42, 10), (60, 12), (70, 26), (72, 40), (77, 48), (71, 51),
            (70, 57), (61, 60), (58, 70), (44, 74), (33, 62), (30, 38),
            (33, 20)], closed=True)
    p.path([(46, 44), (42, 50), (47, 56)])                           # ear
    p.dot((64, 38), 1.1)
    out.append(p.svg())
    return out


def horse():
    out = []
    # FRONT: head-on — long muzzle, upright ears, chest, front legs
    p = Panel("front")
    p.path([(43, 9), (38, 1), (46, 8)]); p.path([(57, 9), (62, 1), (54, 8)])   # ears
    p.path([(40, 10), (36, 22), (42, 34), (50, 38), (58, 34), (64, 22),
            (60, 10), (50, 7)], closed=True)              # head w/ muzzle
    p.dot((44, 20)); p.dot((56, 20))
    p.path([(44, 33), (46, 36)], w=LWT); p.path([(56, 33), (54, 36)], w=LWT)   # nostrils
    p.path([(38, 36), (30, 48), (28, 62)])                # neck/shoulder L
    p.path([(62, 36), (70, 48), (72, 62)])                # neck/shoulder R
    p.path([(28, 62), (32, 70), (50, 74), (68, 70), (72, 62)])  # chest
    p.path([(38, 72), (37, 84), (37, 95)]); p.seg((37, 95), (33, 97))   # L leg + hoof
    p.path([(62, 72), (63, 84), (63, 95)]); p.seg((63, 95), (67, 97))   # R leg + hoof
    p.path([(30, 74), (29, 86), (29, 95)], w=LWT); p.path([(70, 74), (71, 86), (71, 95)], w=LWT)  # hinds hint
    out.append(p.svg())
    # SIDE: the classic standing horse profile — the panel that matters most
    p = Panel("side", pad=0.08)
    p.path([(13, 22), (10, 14), (15, 20)])                # ear
    p.path([(15, 20), (8, 30), (6, 38), (12, 40), (18, 36),               # head/muzzle
            (26, 44), (30, 52),                                            # neck underline
            (44, 56), (62, 55), (76, 52),                                  # belly line
            (82, 42), (88, 34),                                            # rump rise
            (84, 26), (72, 24), (56, 26), (40, 26), (26, 24), (18, 18),    # topline back to poll
            (15, 20)], closed=True)
    p.dot((13, 26))
    p.path([(88, 34), (94, 48), (92, 66)], )              # tail
    p.path([(34, 54), (33, 72), (33, 94)]); p.seg((33, 94), (29, 96))  # foreleg near
    p.path([(40, 55), (41, 72), (41, 94)], w=LWT); p.seg((41, 94), (45, 96), w=LWT)  # foreleg far
    p.path([(74, 52), (78, 66), (72, 78), (72, 94)]); p.seg((72, 94), (68, 96))      # hind near (hock)
    p.path([(80, 50), (84, 66), (80, 78), (80, 94)], w=LWT); p.seg((80, 94), (84, 96), w=LWT)  # hind far
    p.path([(20, 18), (30, 22), (44, 24)], w=LWT)         # mane hint
    out.append(p.svg())
    # BACK: rear view — rump, tail down the middle, hind legs
    p = Panel("back")
    p.path([(42, 10), (38, 4), (43, 12)]); p.path([(58, 10), (62, 4), (57, 12)])  # ears over the back
    p.path([(43, 12), (50, 9), (57, 12), (60, 20), (50, 24), (40, 20)],
           closed=True)                                   # head from behind
    p.path([(40, 22), (30, 34), (26, 50), (30, 64), (50, 70), (70, 64),
            (74, 50), (70, 34), (60, 22)])                # rump
    p.path([(50, 26), (50, 52), (48, 78)])                # tail
    p.path([(36, 68), (35, 82), (35, 95)]); p.seg((35, 95), (31, 97))
    p.path([(64, 68), (65, 82), (65, 95)]); p.seg((65, 95), (69, 97))
    out.append(p.svg())
    # HEADS
    p = Panel("head_f", pad=0.18)
    p.path([(38, 16), (30, 4), (40, 20)]); p.path([(62, 16), (70, 4), (60, 20)])
    p.path([(38, 18), (32, 38), (40, 62), (50, 70), (60, 62), (68, 38),
            (62, 18), (50, 12)], closed=True)
    p.dot((41, 34)); p.dot((59, 34))
    p.path([(44, 60), (46, 64)], w=LWT); p.path([(56, 60), (54, 64)], w=LWT)
    out.append(p.svg())
    p = Panel("head_s", pad=0.18)
    p.path([(46, 18), (42, 6), (50, 16)])                 # ear
    p.path([(50, 16), (34, 26), (22, 40), (18, 52), (26, 58), (38, 54),
            (52, 46), (64, 40), (70, 30), (62, 18), (50, 16)], closed=True)
    p.dot((50, 28)); p.path([(24, 50), (28, 52)], w=LWT)  # eye, nostril
    p.path([(62, 20), (54, 26), (46, 32)], w=LWT)         # mane hint
    out.append(p.svg())
    return out


def _quadruped(p_front, p_side, p_back, hf, hs, *, ear, tail, muzzle):
    """Shared small-quadruped builder — dog/cat/mouse/generic differ in ears,
    tail carriage and muzzle length. Keeps the five-panel family consistent."""
    out = []
    # FRONT
    p = p_front
    ex = 10 if ear == "round" else 8
    if ear == "round":
        p.circ((38, 12), 7, w=LW); p.circ((62, 12), 7, w=LW)
    elif ear == "point":
        p.path([(38, 14), (32, 2), (44, 10)]); p.path([(62, 14), (68, 2), (56, 10)])
    else:  # floppy
        p.path([(36, 12), (30, 26), (38, 24)]); p.path([(64, 12), (70, 26), (62, 24)])
    p.path([(38, 12), (36, 24), (44, 32), (50, 34), (56, 32), (64, 24),
            (62, 12), (50, 8)], closed=True)              # head
    p.dot((43, 21)); p.dot((57, 21)); p.dot((50, 27 + muzzle))
    p.path([(40, 32), (32, 44), (30, 58), (36, 66), (50, 70), (64, 66),
            (70, 58), (68, 44), (60, 32)])                # chest/body
    p.path([(40, 66), (39, 80), (39, 94)]); p.path([(60, 66), (61, 80), (61, 94)])
    p.path([(32, 62), (31, 78), (31, 92)], w=LWT); p.path([(68, 62), (69, 78), (69, 92)], w=LWT)
    out.append(p.svg())
    # SIDE
    p = p_side
    if ear == "point":
        p.path([(20, 22), (16, 10), (24, 20)])
    elif ear == "round":
        p.circ((20, 16), 6)
    else:
        p.path([(20, 20), (16, 34), (24, 30)])
    ml = 8 + muzzle * 3
    p.path([(22, 20), (12, 26), (8 + (8 - ml) * 0, 30), (10, 34), (20, 36),   # head+muzzle
            (28, 42), (34, 50), (48, 54), (64, 53), (76, 48),                 # neck+belly
            (82, 38), (80, 28), (68, 24), (52, 24), (36, 22), (26, 16),
            (22, 20)], closed=True)
    p.dot((18, 26))
    if tail == "up":
        p.path([(80, 34), (88, 22), (86, 10)])
    elif tail == "long":
        p.path([(80, 36), (92, 46), (96, 62), (90, 74)], w=LWT)
    else:
        p.path([(80, 34), (90, 40), (94, 52)])
    p.path([(34, 52), (33, 70), (33, 92)]); p.path([(42, 54), (43, 71), (43, 92)], w=LWT)
    p.path([(70, 50), (74, 64), (70, 76), (70, 92)]); p.path([(78, 48), (82, 64), (78, 78), (78, 92)], w=LWT)
    out.append(p.svg())
    # BACK
    p = p_back
    if ear == "round":
        p.circ((40, 12), 6); p.circ((60, 12), 6)
    elif ear == "point":
        p.path([(40, 14), (34, 4), (45, 11)]); p.path([(60, 14), (66, 4), (55, 11)])
    else:
        p.path([(38, 12), (33, 24), (41, 21)]); p.path([(62, 12), (67, 24), (59, 21)])
    p.path([(42, 12), (50, 9), (58, 12), (60, 20), (50, 23), (40, 20)], closed=True)
    p.path([(40, 21), (32, 34), (28, 50), (33, 64), (50, 69), (67, 64),
            (72, 50), (68, 34), (60, 21)])                # back/rump
    if tail == "up":
        p.path([(50, 30), (50, 14)])
    elif tail == "long":
        p.path([(50, 66), (54, 80), (50, 92)], w=LWT)
    else:
        p.path([(50, 66), (50, 80)])
    p.path([(38, 66), (37, 80), (37, 94)]); p.path([(62, 66), (63, 80), (63, 94)])
    out.append(p.svg())
    # HEADS
    p = hf
    if ear == "round":
        p.circ((30, 20), 12); p.circ((70, 20), 12)
    elif ear == "point":
        p.path([(32, 26), (22, 4), (44, 18)]); p.path([(68, 26), (78, 4), (56, 18)])
    else:
        p.path([(30, 22), (18, 48), (34, 42)]); p.path([(70, 22), (82, 48), (66, 42)])
    p.path([(34, 22), (28, 44), (38, 64), (50, 70), (62, 64), (72, 44),
            (66, 22), (50, 16)], closed=True)
    p.dot((41, 40), 1.2); p.dot((59, 40), 1.2); p.dot((50, 52 + muzzle), 1.4)
    p.path([(50, 54 + muzzle), (46, 60 + muzzle)], w=LWT)
    p.path([(50, 54 + muzzle), (54, 60 + muzzle)], w=LWT)
    out.append(p.svg())
    p = hs
    if ear == "round":
        p.circ((44, 18), 11)
    elif ear == "point":
        p.path([(42, 24), (36, 4), (52, 18)])
    else:
        p.path([(42, 22), (34, 48), (48, 40)])
    p.path([(48, 18), (30, 28), (18, 40 + muzzle * 2), (16, 48 + muzzle * 2),
            (26, 52 + muzzle), (42, 52), (58, 50), (68, 40), (64, 22),
            (48, 18)], closed=True)
    p.dot((36, 34), 1.2); p.dot((18, 44 + muzzle * 2), 1.2)
    out.append(p.svg())
    return out


def dog():
    return _quadruped(Panel("front"), Panel("side", pad=0.14), Panel("back"),
                      Panel("head_f", pad=0.18), Panel("head_s", pad=0.18),
                      ear="floppy", tail="up", muzzle=2)


def cat():
    return _quadruped(Panel("front"), Panel("side", pad=0.16), Panel("back"),
                      Panel("head_f", pad=0.18), Panel("head_s", pad=0.18),
                      ear="point", tail="up", muzzle=0)


def mouse():
    return _quadruped(Panel("front", pad=0.22), Panel("side", pad=0.24), Panel("back", pad=0.22),
                      Panel("head_f", pad=0.18), Panel("head_s", pad=0.18),
                      ear="round", tail="long", muzzle=1)


def quadruped():
    return _quadruped(Panel("front"), Panel("side", pad=0.14), Panel("back"),
                      Panel("head_f", pad=0.18), Panel("head_s", pad=0.18),
                      ear="point", tail="down", muzzle=1)


SHEETS = {"human": human, "horse": horse, "dog": dog, "cat": cat,
          "mouse": mouse, "quadruped": quadruped}


def main():
    root = os.path.join(os.path.dirname(__file__), "..")
    out_dir = os.path.join(root, "static", "pose-sheets")
    os.makedirs(out_dir, exist_ok=True)
    for name, fn in SHEETS.items():
        body = frame() + "".join(fn())
        svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" '
               f'viewBox="0 0 {W} {H}">{body}</svg>')
        png = os.path.join(out_dir, f"{name}.png")
        cairosvg.svg2png(bytestring=svg.encode(), write_to=png,
                         output_width=W, output_height=H)
        print(f"wrote {png}")


if __name__ == "__main__":
    main()
