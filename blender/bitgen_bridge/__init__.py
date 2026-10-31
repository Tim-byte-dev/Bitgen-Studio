"""bitGen Bridge — a Blender add-on (bitGen Studio 2.385.0).

Tim (verbatim): "is it possible for us to create a blender to bitgen bridge?" - asked how much: "Add-on + Blender
render bake".

Install: Blender -> Edit -> Preferences -> Add-ons -> Install from Disk (or "Install...") -> the
bitgen-blender-addon zip -> tick "bitGen Bridge". Then the 3D View's sidebar (N) has a bitGen tab:

  bitGen address      where bitGen Studio runs (http://127.0.0.1:8311 - its window's address)
  🔌 Test             asks bitGen who it is and which project is open
  Name                the model's name in bitGen (the selection's / the scene's name by default)
  Selected only       send the selected objects, or the whole scene
  Animation           include the animation (armatures, shape keys, object keys)
  Add as 3D layer     bitGen puts it on the timeline at the position marker (else only into the project's 3D models)
  ⬆ Send to bitGen    exports glTF (.glb: meshes, materials, textures, animation) and sends it to the open project
  Live link           sends it again every time you SAVE the .blend - bitGen reloads the model and re-bakes its layers
  ⬇ Get from bitGen   imports one of the project's 3D models (.glb / .gltf / .fbx / .obj) into this scene

  (2.402.0) Render scene -> bitGen (photoreal with LTX 2.3 + fal's 3DREAL LoRA):
  Looks like          what the shot should look like (3DREAL's trigger is added by bitGen)
  Engine              Solid (Workbench - fastest, a blockout is enough), EEVEE, or the scene's own engine
  3DREAL              strong v2 / strong / light (Auto = the newest in ComfyUI's loras)
  Render in bitGen    queue the LTX 2.3 "3D render -> real" job at once (off: the render only lands in Video assets)
  🎬 Render scene      renders the frame range through the SCENE CAMERA (the long side at most 1280, multiples of
                      32, up to Max seconds) to an .mp4 with Blender's FFmpeg and sends it to the open project

Only the Python standard library is used (urllib) - nothing to install. bitGen's side: routes/blender.js.
"""
bl_info = {
    "name": "bitGen Bridge",
    "author": "Tiger Art - bitGen Studio",
    "version": (1, 1, 0),
    "blender": (3, 6, 0),
    "location": "View3D > Sidebar (N) > bitGen",
    "description": "Send models to bitGen Studio's timeline (glTF), keep them live, pull bitGen's models in, and render the scene photoreal (LTX 2.3 + 3DREAL)",
    "category": "Import-Export",
}

import json
import os
import tempfile
import urllib.error
import urllib.parse
import urllib.request

import bpy
from bpy.app.handlers import persistent
from bpy.props import BoolProperty, EnumProperty, FloatProperty, IntProperty, StringProperty

TIMEOUT = 30
_models_cache = []


def prefs(context=None):
    ctx = context or bpy.context
    try:
        return ctx.preferences.addons[__name__].preferences
    except (KeyError, AttributeError):
        return None


def base_url(context=None):
    p = prefs(context)
    url = (p.url if p else "") or "http://127.0.0.1:8311"
    return url.rstrip("/")


def http(method, path, body=None, ctype="application/octet-stream", context=None, timeout=TIMEOUT):
    req = urllib.request.Request(base_url(context) + path, data=body, method=method)
    if body is not None:
        req.add_header("Content-Type", ctype)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read()
            ct = r.headers.get("Content-Type", "")
            return json.loads(raw.decode("utf-8")) if "json" in ct else raw
    except urllib.error.HTTPError as e:
        try:
            msg = json.loads(e.read().decode("utf-8")).get("error")
        except Exception:
            msg = None
        raise RuntimeError(msg or ("bitGen answered %s" % e.code))
    except urllib.error.URLError as e:
        raise RuntimeError("bitGen is not reachable at %s (%s) - is bitGen Studio running?" % (base_url(context), e.reason))


def default_name(context):
    s = context.scene.bitgen
    if s.name.strip():
        n = s.name.strip()
    elif s.selected_only and context.active_object:
        n = context.active_object.name
    else:
        n = context.scene.name or "scene"
    n = "".join(ch if ch.isalnum() or ch in " ._-()" else "_" for ch in n).strip() or "blender"
    return n if n.lower().endswith(".glb") else n + ".glb"


def export_glb(context, path):
    s = context.scene.bitgen
    kw = dict(filepath=path, export_format="GLB", use_selection=bool(s.selected_only), export_apply=True,
              export_animations=bool(s.animation), export_yup=True)
    try:
        bpy.ops.export_scene.gltf(**kw)
    except TypeError:            # an older exporter without one of the options
        for k in ("export_apply", "export_animations"):
            kw.pop(k, None)
        bpy.ops.export_scene.gltf(**kw)


def send(context, layer=None):
    """export + POST /api/blender/push -> the answer ({name, project, seq})"""
    s = context.scene.bitgen
    if s.selected_only and not context.selected_objects:
        raise RuntimeError("nothing is selected - select objects or untick Selected only")
    name = default_name(context)
    tmp = os.path.join(tempfile.gettempdir(), "bitgen_" + name)
    export_glb(context, tmp)
    with open(tmp, "rb") as fh:
        data = fh.read()
    try:
        os.remove(tmp)
    except OSError:
        pass
    add = s.add_layer if layer is None else layer
    q = urllib.parse.urlencode({"name": name, "layer": "1" if add else "0"})
    r = http("POST", "/api/blender/push?" + q, data, context=context, timeout=300)
    s.last_sent = name
    return r


# ---- 2.402.0: the scene through its camera -> bitGen -> LTX 2.3 + 3DREAL (render -> real)
REAL_ITEMS = [("AUTO", "Auto (newest)", "The newest 3DREAL file in ComfyUI's loras"),
              ("3DREAL-strong-v2.safetensors", "strong v2", "Newest: multi-scene, audio, better faces"),
              ("3DREAL-strong.safetensors", "strong", "A harder photoreal push"),
              ("3DREAL-light.safetensors", "light", "Faithful / gentle")]
ENGINE_ITEMS = [("WORKBENCH", "Solid (fast)", "Workbench - a blockout is all 3DREAL needs"),
                ("EEVEE", "EEVEE", "Blender's real-time engine (materials, lights)"),
                ("SCENE", "Scene's engine", "Whatever the scene is set to (Cycles can be slow)")]


def fit_size(w, h, longest=1280):
    """the render size for LTX: the scene's aspect, the long side at most `longest`, both multiples of 32"""
    w, h = max(1, int(w)), max(1, int(h))
    k = min(1.0, float(longest) / max(w, h))
    return max(256, int(round(w * k / 32.0)) * 32), max(256, int(round(h * k / 32.0)) * 32)


def eevee_id():
    ids = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items]
    for e in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE"):
        if e in ids:
            return e
    return ids[0]


def render_scene(context, path):
    """render the frame range through the scene camera into `path` (.mp4); every setting is put back after.
    Returns {frames, fps, width, height}."""
    sc = context.scene
    s = sc.bitgen
    if not sc.camera:
        raise RuntimeError("the scene has no camera - add one and frame the shot (bitGen renders through it)")
    r = sc.render
    im = r.image_settings
    keep = {"engine": r.engine, "filepath": r.filepath, "x": r.resolution_x, "y": r.resolution_y,
            "pct": r.resolution_percentage, "end": sc.frame_end, "transparent": r.film_transparent,
            "media": getattr(im, "media_type", None), "fmt": im.file_format,
            "ff": (r.ffmpeg.format, r.ffmpeg.codec, r.ffmpeg.constant_rate_factor)}
    fps = max(1.0, r.fps / (r.fps_base or 1.0))
    frames = sc.frame_end - sc.frame_start + 1
    cap = int(round(max(1, s.max_seconds) * fps))
    w, h = fit_size(r.resolution_x * r.resolution_percentage / 100.0, r.resolution_y * r.resolution_percentage / 100.0)
    try:
        if s.engine == "WORKBENCH":
            r.engine = "BLENDER_WORKBENCH"
        elif s.engine == "EEVEE":
            r.engine = eevee_id()
        r.resolution_x, r.resolution_y, r.resolution_percentage = w, h, 100
        r.film_transparent = False
        if frames > cap:
            sc.frame_end = sc.frame_start + cap - 1
            frames = cap
        if hasattr(im, "media_type"):            # Blender 4.5+: a video is a media type first
            try:
                im.media_type = "VIDEO"
            except Exception:
                pass
        im.file_format = "FFMPEG"
        r.ffmpeg.format = "MPEG4"
        r.ffmpeg.codec = "H264"
        try:
            r.ffmpeg.constant_rate_factor = "HIGH"
        except Exception:
            pass
        r.filepath = path
        bpy.ops.render.render(animation=True)
    finally:
        r.engine = keep["engine"]
        r.filepath = keep["filepath"]
        r.resolution_x, r.resolution_y, r.resolution_percentage = keep["x"], keep["y"], keep["pct"]
        sc.frame_end = keep["end"]
        r.film_transparent = keep["transparent"]
        try:
            if keep["media"] is not None:
                im.media_type = keep["media"]
            im.file_format = keep["fmt"]
            r.ffmpeg.format, r.ffmpeg.codec, r.ffmpeg.constant_rate_factor = keep["ff"]
        except Exception:
            pass
    return {"frames": frames, "fps": fps, "width": w, "height": h}


def send_scene(context):
    """render + POST /api/blender/scene -> bitGen's answer ({name, seconds, job, note})"""
    sc = context.scene
    s = sc.bitgen
    name = "".join(ch if ch.isalnum() or ch in "._-" else "_" for ch in (s.name.strip() or sc.name or "scene")) or "scene"
    path = os.path.join(tempfile.gettempdir(), "bitgen_scene_%s.mp4" % name)
    info = render_scene(context, path)
    out = path if os.path.isfile(path) else None
    if not out:                                  # Blender appends the frame range to a name without one
        d = os.path.dirname(path)
        cands = sorted((os.path.join(d, f) for f in os.listdir(d) if f.startswith("bitgen_scene_%s" % name)),
                       key=os.path.getmtime)
        out = cands[-1] if cands else None
    if not out:
        raise RuntimeError("Blender wrote no video - is FFmpeg output available in this Blender build?")
    with open(out, "rb") as fh:
        data = fh.read()
    try:
        os.remove(out)
    except OSError:
        pass
    q = urllib.parse.urlencode({"name": name, "prompt": s.look, "render": "1" if s.render_now else "0",
                                "frames": info["frames"], "fps": "%g" % info["fps"], "width": info["width"],
                                "height": info["height"], "ic_lora": "" if s.real == "AUTO" else s.real, "ic_strength": "%g" % s.real_strength})
    return http("POST", "/api/blender/scene?" + q, data, ctype="video/mp4", context=context, timeout=600)


class BitgenSettings(bpy.types.PropertyGroup):
    name: StringProperty(name="Name", description="The model's name in bitGen (empty: the selection's / the scene's name)")
    selected_only: BoolProperty(name="Selected only", default=True, description="Send the selected objects (off: the whole scene)")
    animation: BoolProperty(name="Animation", default=True, description="Include the animation")
    add_layer: BoolProperty(name="Add as 3D layer", default=True, description="bitGen puts it on the timeline at the position marker")
    live: BoolProperty(name="Live link", default=False, description="Send it again every time the .blend is saved")
    last_sent: StringProperty(name="Last sent", default="")
    status: StringProperty(name="Status", default="")
    # 2.402.0: Render scene -> bitGen
    look: StringProperty(name="Looks like", default="",
                         description="What the shot should look like - bitGen adds 3DREAL's trigger (\"3DREAL. Make it photorealistic.\")")
    engine: EnumProperty(name="Engine", items=ENGINE_ITEMS, default="WORKBENCH")
    real: EnumProperty(name="3DREAL", items=REAL_ITEMS, default="AUTO")
    real_strength: FloatProperty(name="Strength", default=1.0, min=0.0, max=2.0,
                                 description="How strongly the render guides LTX (1 = the LoRA card's own)")
    render_now: BoolProperty(name="Render in bitGen", default=True,
                             description="Queue LTX 2.3 3D render -> real at once (off: the render only lands in Video assets)")
    max_seconds: IntProperty(name="Max seconds", default=10, min=1, max=30,
                             description="The frame range is cut to this many seconds")


class BitgenPrefs(bpy.types.AddonPreferences):
    bl_idname = __name__
    url: StringProperty(name="bitGen address", default="http://127.0.0.1:8311",
                        description="Where bitGen Studio runs (its window's address)")

    def draw(self, context):
        self.layout.prop(self, "url")


class BITGEN_OT_test(bpy.types.Operator):
    bl_idname = "bitgen.test"
    bl_label = "Test connection"
    bl_description = "Ask bitGen Studio who it is and which project is open"

    def execute(self, context):
        try:
            r = http("GET", "/api/blender/ping", context=context, timeout=8)
            context.scene.bitgen.status = "%s %s - project %s" % (r.get("app"), r.get("version"), r.get("project"))
            self.report({"INFO"}, context.scene.bitgen.status)
            return {"FINISHED"}
        except Exception as e:
            context.scene.bitgen.status = str(e)
            self.report({"ERROR"}, str(e))
            return {"CANCELLED"}


class BITGEN_OT_send(bpy.types.Operator):
    bl_idname = "bitgen.send"
    bl_label = "Send to bitGen"
    bl_description = "Export glTF (.glb) and send it to bitGen Studio's open project"

    def execute(self, context):
        try:
            r = send(context)
            msg = "sent %s to %s" % (r.get("name"), r.get("project"))
            context.scene.bitgen.status = msg
            self.report({"INFO"}, msg)
            return {"FINISHED"}
        except Exception as e:
            context.scene.bitgen.status = str(e)
            self.report({"ERROR"}, str(e))
            return {"CANCELLED"}


class BITGEN_OT_render_scene(bpy.types.Operator):
    bl_idname = "bitgen.render_scene"
    bl_label = "Render scene → bitGen"
    bl_description = ("Render the frame range through the scene camera and send it to bitGen Studio - with Render in "
                      "bitGen, LTX 2.3 + fal's 3DREAL LoRA turns it photoreal")

    def execute(self, context):
        try:
            r = send_scene(context)
            msg = "sent %s (%ss)" % (r.get("name"), r.get("seconds")) + (" - job %s queued" % r["job"]["id"] if r.get("job") else "")
            context.scene.bitgen.status = msg
            self.report({"INFO"}, msg + (" · " + r["note"] if r.get("note") else ""))
            return {"FINISHED"}
        except Exception as e:
            context.scene.bitgen.status = str(e)
            self.report({"ERROR"}, str(e))
            return {"CANCELLED"}


def model_items(self, context):
    return [(m, m, "") for m in _models_cache] or [("", "(press ↻)", "")]


class BITGEN_OT_refresh(bpy.types.Operator):
    bl_idname = "bitgen.refresh"
    bl_label = "Refresh bitGen's models"

    def execute(self, context):
        global _models_cache
        try:
            r = http("GET", "/api/tlcanvas/models", context=context, timeout=10)
            _models_cache = [m["name"] for m in r.get("models", [])]
            self.report({"INFO"}, "%d model(s) in bitGen's project" % len(_models_cache))
            return {"FINISHED"}
        except Exception as e:
            self.report({"ERROR"}, str(e))
            return {"CANCELLED"}


class BITGEN_OT_get(bpy.types.Operator):
    bl_idname = "bitgen.get"
    bl_label = "Get from bitGen"
    bl_description = "Import one of bitGen's 3D models into this scene"
    model: EnumProperty(name="Model", items=model_items)

    def invoke(self, context, event):
        bpy.ops.bitgen.refresh()
        return context.window_manager.invoke_props_dialog(self)

    def execute(self, context):
        if not self.model:
            return {"CANCELLED"}
        try:
            data = http("GET", "/api/tlcanvas/model/" + urllib.parse.quote(self.model), context=context, timeout=300)
            path = os.path.join(tempfile.gettempdir(), "bitgen_get_" + self.model)
            with open(path, "wb") as fh:
                fh.write(data)
            ext = os.path.splitext(path)[1].lower()
            if ext in (".glb", ".gltf"):
                bpy.ops.import_scene.gltf(filepath=path)
            elif ext == ".fbx":
                bpy.ops.import_scene.fbx(filepath=path)
            elif ext == ".obj":
                if hasattr(bpy.ops.wm, "obj_import"):
                    bpy.ops.wm.obj_import(filepath=path)
                else:
                    bpy.ops.import_scene.obj(filepath=path)
            self.report({"INFO"}, "imported " + self.model)
            return {"FINISHED"}
        except Exception as e:
            self.report({"ERROR"}, str(e))
            return {"CANCELLED"}


class BITGEN_PT_panel(bpy.types.Panel):
    bl_label = "bitGen"
    bl_idname = "BITGEN_PT_panel"
    bl_space_type = "VIEW_3D"
    bl_region_type = "UI"
    bl_category = "bitGen"

    def draw(self, context):
        s = context.scene.bitgen
        col = self.layout.column(align=True)
        p = prefs(context)
        if p:
            col.prop(p, "url", text="")
        col.operator("bitgen.test", icon="LINKED")
        self.layout.separator()
        col = self.layout.column()
        col.prop(s, "name")
        row = col.row()
        row.prop(s, "selected_only")
        row.prop(s, "animation")
        col.prop(s, "add_layer")
        col.operator("bitgen.send", icon="EXPORT")
        col.prop(s, "live", icon="FILE_REFRESH")
        self.layout.separator()
        self.layout.operator("bitgen.get", icon="IMPORT")
        # 2.402.0: the scene -> photoreal
        self.layout.separator()
        box = self.layout.box()
        box.label(text="Render scene (LTX 2.3 · 3DREAL)", icon="RENDER_ANIMATION")
        box.prop(s, "look")
        row = box.row()
        row.prop(s, "engine", text="")
        row.prop(s, "real", text="")
        row = box.row()
        row.prop(s, "real_strength")
        row.prop(s, "max_seconds")
        box.prop(s, "render_now")
        box.operator("bitgen.render_scene", icon="RENDER_ANIMATION")
        if s.status:
            box = self.layout.box()
            box.label(text=s.status[:120])


@persistent
def on_save(_dummy):
    """the live link: every Save sends the model again (as a model only - the layer is already there)"""
    for sc in bpy.data.scenes:
        s = getattr(sc, "bitgen", None)
        if not s or not s.live:
            continue
        try:
            ctx = bpy.context
            r = send(ctx, layer=False)
            s.status = "live: sent %s" % r.get("name")
        except Exception as e:
            s.status = "live link: %s" % e
        break


CLASSES = (BitgenSettings, BitgenPrefs, BITGEN_OT_test, BITGEN_OT_send, BITGEN_OT_render_scene, BITGEN_OT_refresh,
           BITGEN_OT_get, BITGEN_PT_panel)


def register():
    for c in CLASSES:
        bpy.utils.register_class(c)
    bpy.types.Scene.bitgen = bpy.props.PointerProperty(type=BitgenSettings)
    if on_save not in bpy.app.handlers.save_post:
        bpy.app.handlers.save_post.append(on_save)


def unregister():
    if on_save in bpy.app.handlers.save_post:
        bpy.app.handlers.save_post.remove(on_save)
    del bpy.types.Scene.bitgen
    for c in reversed(CLASSES):
        bpy.utils.unregister_class(c)


if __name__ == "__main__":
    register()
