"""bitGen Studio — the Blender bridge's shared maths (2.385.0). Plain Python: no bpy, so it is unit-tested
(scripts/test-blender.py) and used inside Blender by scripts/blender_render.py.

Tim (verbatim): "is it possible for us to create a blender to bitgen bridge?" - and, asked how much: "Add-on + Blender
render bake".

bitGen draws a 3D layer with three.js (static/m3d.js): Y up, the camera on +Z looking at the origin, a 30 degree
vertical field of view, the object centred and 1 unit across (a model: its bounding sphere has radius 1). A Blender
render of the same layer must frame it the same way, so this holds the conversions:
  to_bl(x, y, z)           a three.js point -> Blender's (Z up, the camera on -Y looking at +Y)
  framing(...)             the camera's distance (the same formula as static/m3d.js frame())
  euler_axes()             three.js's XYZ Euler as Blender rotations: (angle index, axis), applied in order
  scale_bl(sx, sy, sz)     the object's own X / Y / Z scale on Blender's axes
  light_power(type, b)     a bitGen light's brightness -> Blender's sun strength / point-spot watts / world strength
  srgb_to_linear, hex_rgb  colours
  engine_id(want, have)    "eevee" | "cycles" | "workbench" -> one of this Blender's engine identifiers
"""
import math

FOV_DEG = 30.0           # static/m3d.js: new T.PerspectiveCamera(30, ...)
STUDIO = [               # static/m3d.js setup(): amb 0.6, key 1.6 at (2, 3, 4), fill 0.5 at (-3, -1, 2)
    {"type": "ambient", "power": 0.6},
    {"type": "sun", "power": 1.6, "x": 2, "y": 3, "z": 4},
    {"type": "sun", "power": 0.5, "x": -3, "y": -1, "z": 2},
]


def num(v, d):
    try:
        f = float(v)
        return f if math.isfinite(f) else d
    except (TypeError, ValueError):
        return d


def to_bl(x, y, z):
    """three.js (X right, Y up, Z toward the camera) -> Blender (X right, Z up, -Y toward the camera)."""
    return (x, -z, y)


def framing(w, h, fit="sphere", box=(2.0, 2.0, 2.0), fov_deg=FOV_DEG):
    """the camera distance static/m3d.js frame() uses: a unit sphere (models) or the text's box with a 12% margin"""
    vfov = math.radians(fov_deg)
    aspect = max(1e-6, float(w) / max(1e-6, float(h)))
    if fit == "sphere":
        fit_h = 1.08 / math.sin(vfov / 2)
        fit_w = 1.08 / math.sin(math.atan(math.tan(vfov / 2) * aspect))
        return max(fit_h, fit_w)
    bw, bh, bz = box[0] * 1.12, box[1] * 1.12, box[2]
    return max(bh / 2 / math.tan(vfov / 2), bw / 2 / (math.tan(vfov / 2) * aspect)) + bz / 2


def clamp_depth(pz, dist):
    """static/m3d.js: the object never goes behind the lens (pz <= dist - 0.3) nor too far (>= -4 dist)"""
    return max(-dist * 4, min(dist - 0.3, pz))


def euler_axes():
    """three.js Euler 'XYZ' = Rx(rx) * Ry(ry) * Rz(rz). On Blender's axes: rx about X, ry about Z (three's up), rz about
    -Y (three's +Z, toward the camera). Returns [(key, axis)] in multiplication order."""
    return [("rx", (1.0, 0.0, 0.0)), ("ry", (0.0, 0.0, 1.0)), ("rz", (0.0, -1.0, 0.0))]


def scale_bl(sx, sy, sz):
    """the object's own scale: three X -> Blender X, three Y -> Blender Z, three Z -> Blender Y"""
    return (sx, sz, sy)


def light_power(kind, b):
    """bitGen's brightness (static/m3d.js intensities) -> Blender units. three.js: sun 1.6 b, point / spot 25 b candela
    (decay 2), ambient 0.6 b, sky 0.8 b. Blender: a sun's strength is irradiance (~ the three value), a point / spot's
    power is watts over the whole sphere (4 pi x the intensity), ambient / sky light the world."""
    b = max(0.0, min(20.0, num(b, 1.0)))
    if kind == "sun":
        return 1.6 * b
    if kind in ("point", "spot"):
        return 4 * math.pi * 25 * b
    if kind == "sky":
        return 0.8 * b
    return 0.6 * b


def hex_rgb(h, d=(1.0, 1.0, 1.0)):
    h = str(h or "").strip().lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    if len(h) != 6:
        return d
    try:
        return tuple(int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4))
    except ValueError:
        return d


def srgb_to_linear(c):
    return tuple((v / 12.92) if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c)


ENGINES = {"eevee": ["BLENDER_EEVEE_NEXT", "BLENDER_EEVEE"], "cycles": ["CYCLES"], "workbench": ["BLENDER_WORKBENCH"]}


def engine_id(want, have):
    """the engine asked for, if this Blender has it; else EEVEE, else Cycles, else whatever it has"""
    have = list(have or [])
    for name in [want or "eevee", "eevee", "cycles", "workbench"]:
        for ident in ENGINES.get(name, []):
            if ident in have:
                return ident
    return have[0] if have else "BLENDER_EEVEE"


PRESETS = {   # static/m3d.js PRESETS (what a preset sets; None colour = the layer's colour)
    "gold": {"color": "#ffcc55", "metal": 1, "rough": 0.25},
    "silver": {"color": "#e6e8ea", "metal": 1, "rough": 0.2},
    "chrome": {"color": "#ffffff", "metal": 1, "rough": 0.03},
    "copper": {"color": "#d9825b", "metal": 1, "rough": 0.3},
    "steel": {"color": "#b8bcc2", "metal": 1, "rough": 0.45},
    "plastic": {"color": None, "metal": 0, "rough": 0.25, "clearcoat": 0.6},
    "clay": {"color": "#c9b8a6", "metal": 0, "rough": 0.95},
    "rubber": {"color": "#232323", "metal": 0, "rough": 0.9},
    "glass": {"color": "#ffffff", "metal": 0, "rough": 0.03, "glass": 1, "ior": 1.5},
    "frosted": {"color": "#f4f8ff", "metal": 0, "rough": 0.35, "glass": 1, "ior": 1.45},
    "carpaint": {"color": "#b0121b", "metal": 0.6, "rough": 0.3, "clearcoat": 1},
    "neon": {"color": "#33aaff", "metal": 0, "rough": 0.5, "emissive": "#33aaff", "glow": 3},
    "wire": {"color": None, "metal": 0, "rough": 0.6, "wire": True},
}


def mat_spec(m, preset=None):
    """static/m3d.js matSpec(): the layer's colour / metal / rough + its mat, or a preset over them"""
    x = m.get("mat") or {}
    o = {"color": m.get("color") or "#ffffff", "metal": num(m.get("metal"), 0.2), "rough": num(m.get("rough"), 0.4),
         "emissive": x.get("emissive") or "#000000", "glow": num(x.get("glow"), 0), "opacity": num(x.get("opacity"), 1),
         "clearcoat": num(x.get("clearcoat"), 0), "glass": num(x.get("glass"), 0), "ior": num(x.get("ior"), 1.5),
         "wire": bool(x.get("wire")), "flat": bool(x.get("flat")), "map": x.get("map") or "", "repeat": num(x.get("repeat"), 1)}
    p = PRESETS.get(preset or "")
    if p:
        for k, v in p.items():
            if v is not None:
                o[k] = v
    return o


def lights_of(m):
    """every light the render needs: the studio three (unless studio is False; brightness = light) + the layer's own"""
    out = []
    if m.get("studio") is not False:
        L = max(0.0, num(m.get("light"), 1.0))
        for s in STUDIO:
            d = dict(s)
            d["power"] = s["power"] * L
            d["studio"] = True
            out.append(d)
    for L in m.get("lights") or []:
        if not isinstance(L, dict) or L.get("on") is False:
            continue
        out.append({"type": L.get("type") or "point", "color": L.get("color") or "#ffffff", "b": num(L.get("power"), 1.0),
                    "x": num(L.get("x"), 2), "y": num(L.get("y"), 2), "z": num(L.get("z"), 3), "angle": num(L.get("angle"), 30)})
    return out
