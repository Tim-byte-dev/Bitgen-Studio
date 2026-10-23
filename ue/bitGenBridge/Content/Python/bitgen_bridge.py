# bitGen Bridge for Unreal Engine 5.8 (bitGen Studio 2.472.0) - Content/Python/bitgen_bridge.py
#
# Started by init_unreal.py when the editor opens (the Python Editor Script Plugin runs every init_unreal.py it finds).
# A small HTTP server on 127.0.0.1:30020 (this computer only) takes bitGen Studio's requests:
#     POST /bitgen  {"cmd": ..., "args": {...}}  ->  {"ok": true, ...} | {"ok": false, "error": ...}
# The work runs on the editor's own thread (a Slate tick) - the HTTP thread only waits for it.
#
#   ping                      the engine version, the project, the level open now
#   levels / sequences        the project's levels (World assets) / Level Sequences
#   metahumans                Blueprints named BP_* under /Game/MetaHumans (where MetaHuman Creator puts them)
#   anims {skeleton}          Animation Sequences (those of a skeleton when given)
#   cameras                   the Camera / CineCamera actors of the open level: location, rotation, field of view
#   viewport                  the level viewport's camera (location, rotation)
#   open_level {path}         load a level
#   still {...}               ONE PICTURE: a Scene Capture placed like the camera renders the level (or only a
#                             MetaHuman spawned for it) into a PNG at `out` (bitGen's project folder)
#   render {...}              A SEQUENCE: an existing Level Sequence, or one made here (a CineCamera keyed from
#                             bitGen's camera keys, a MetaHuman with an animation) rendered by the Movie Render Queue
#                             as PNG frames f_00000.png ... into `out_dir`; -> {"job": id}
#   job {id}                  {"state": queued | running | done | error, "error"}
#   set_viewport {loc, rot}   (2.475.0) the level viewport looks through bitGen's camera
#   focus_at {camera, u, v}   (2.475.0) the distance to what is under (u, v) of the camera's picture (click to focus)
# A still / render may carry a LENS (2.475.0): {focal, sensor, fstop, focus, exposure} - depth of field + exposure.
# ... and a RIG (2.476.0): {lights: [{type point|spot|rect|directional|sky, loc, rot, color, temperature, intensity, radius,
#     source, inner, outer, width, height, volumetric, shadows, on}], fog: {on, density, falloff, color, start, volumetric,
#     albedo, extinction, distance, emissive}, keep} - placed as bitGen_light_* / bitGen_fog for the picture, then removed.
# Unreal units: centimetres, Z up; rotation = (roll, pitch, yaw) in degrees.
#
# Written from Unreal Engine 5.8's Python API documentation; bitGen Studio's tests run it against a stand-in server,
# not a real editor - the README says how to report what does not work.
import json
import os
import threading
import time
import traceback
import uuid
import math
import re

import unreal

VERSION = "1.4.0"
PORT = int(os.environ.get("BITGEN_UE_PORT", "30020"))
_jobs = {}
_queue = []
_lock = threading.Lock()
_server = None
_tick = None


def log(msg):
    unreal.log("[bitGen Bridge] " + str(msg))


def _subsys(cls):
    return unreal.get_editor_subsystem(cls)


def _world():
    try:
        return _subsys(unreal.UnrealEditorSubsystem).get_editor_world()
    except Exception:
        return unreal.EditorLevelLibrary.get_editor_world()


def _vec(v):
    return [round(v.x, 3), round(v.y, 3), round(v.z, 3)]


def _rot(r):
    return [round(r.roll, 3), round(r.pitch, 3), round(r.yaw, 3)]


def _V(a):
    a = a or [0, 0, 0]
    return unreal.Vector(float(a[0]), float(a[1]), float(a[2]))


def _R(a):
    a = a or [0, 0, 0]
    return unreal.Rotator(roll=float(a[0]), pitch=float(a[1]), yaw=float(a[2]))


def _assets_of(module, cls):
    ar = unreal.AssetRegistryHelpers.get_asset_registry()
    try:
        found = ar.get_assets_by_class(unreal.TopLevelAssetPath(module, cls), True)
    except Exception:
        found = ar.get_assets_by_class(cls, True)
    out = []
    for a in found:
        pkg = str(a.package_name)
        if pkg.startswith("/Game/") or pkg.startswith("/" ):
            out.append({"path": pkg, "name": str(a.asset_name), "object": pkg + "." + str(a.asset_name)})
    out.sort(key=lambda x: x["path"])
    return out


# ---------------------------------------------------------------- the commands
def cmd_ping(a):
    w = _world()
    return {"bridge": VERSION, "engine": unreal.SystemLibrary.get_engine_version(), "project": unreal.Paths.get_project_file_path(),
            "level": w.get_path_name() if w else "", "port": PORT}


def cmd_levels(a):
    return {"items": [x for x in _assets_of("/Script/Engine", "World") if not x["path"].startswith("/Engine/")]}


def cmd_sequences(a):
    return {"items": _assets_of("/Script/LevelSequence", "LevelSequence")}


def cmd_metahumans(a):
    root = (a or {}).get("root") or "/Game/MetaHumans"
    ar = unreal.AssetRegistryHelpers.get_asset_registry()
    items = []
    for d in ar.get_assets_by_path(unreal.Name(root), recursive=True):
        try:
            cls = str(d.asset_class_path.asset_name)
        except Exception:
            cls = str(d.asset_class)
        name = str(d.asset_name)
        if cls == "Blueprint" and name.startswith("BP_"):
            pkg = str(d.package_name)
            items.append({"path": pkg, "name": name[3:], "object": pkg + "." + name})
    items.sort(key=lambda x: x["name"])
    return {"items": items}


def cmd_anims(a):
    sk = ((a or {}).get("skeleton") or "").lower()
    items = _assets_of("/Script/Engine", "AnimSequence")
    if sk:
        ar = unreal.AssetRegistryHelpers.get_asset_registry()
        keep = []
        for it in items:
            try:
                d = ar.get_asset_by_object_path(it["object"])
                tag = str(d.get_tag_value("Skeleton") or "").lower()
                if sk in tag:
                    keep.append(it)
            except Exception:
                keep.append(it)
        items = keep
    return {"items": items[:2000]}


def _fov_of(actor):
    try:
        c = actor.get_cine_camera_component()
        f = c.get_editor_property("current_focal_length")
        sw = c.get_editor_property("filmback").sensor_width
        return round(math.degrees(2 * math.atan(sw / (2 * f))), 3), round(f, 3)
    except Exception:
        try:
            return round(actor.get_editor_property("camera_component").get_editor_property("field_of_view"), 3), None
        except Exception:
            return 60.0, None


def cmd_cameras(a):
    out = []
    for act in _subsys(unreal.EditorActorSubsystem).get_all_level_actors():
        if isinstance(act, (unreal.CineCameraActor, unreal.CameraActor)):
            fov, focal = _fov_of(act)
            out.append({"name": act.get_actor_label(), "path": act.get_path_name(), "loc": _vec(act.get_actor_location()), "rot": _rot(act.get_actor_rotation()), "fov": fov, "focal": focal,
                        "cine": isinstance(act, unreal.CineCameraActor)})
    return {"items": out}


def cmd_viewport(a):
    loc, rot = _subsys(unreal.UnrealEditorSubsystem).get_level_viewport_camera_info()
    return {"loc": _vec(loc), "rot": _rot(rot), "fov": 90.0}


def cmd_open_level(a):
    p = a.get("path")
    if not p:
        raise ValueError("no level")
    ok = _subsys(unreal.LevelEditorSubsystem).load_level(p)
    if not ok:
        raise ValueError("Unreal could not open " + p)
    return {"level": p}


def _camera_of(a):
    """{"name"} of a level camera, or {"loc", "rot", "fov"} -> (Vector, Rotator, fov)"""
    cam = a.get("camera") or {}
    if cam.get("name"):
        for act in _subsys(unreal.EditorActorSubsystem).get_all_level_actors():
            if isinstance(act, (unreal.CineCameraActor, unreal.CameraActor)) and act.get_actor_label() == cam["name"]:
                fov, _ = _fov_of(act)
                loc, rot = act.get_actor_location(), act.get_actor_rotation()
                # bitGen's nudges on top of the level camera: dolly (cm, along the view), turn / tilt (degrees)
                if cam.get("yaw") or cam.get("pitch") or cam.get("dolly"):
                    rot = unreal.Rotator(roll=rot.roll, pitch=rot.pitch + float(cam.get("pitch") or 0), yaw=rot.yaw + float(cam.get("yaw") or 0))
                    loc = loc + rot.get_forward_vector() * float(cam.get("dolly") or 0)
                return loc, rot, float(cam.get("fov") or fov)
        raise ValueError("no camera named " + cam["name"] + " in the open level")
    if cam.get("viewport") or not cam.get("loc"):
        loc, rot = _subsys(unreal.UnrealEditorSubsystem).get_level_viewport_camera_info()
        return loc, rot, float(cam.get("fov") or 90)
    return _V(cam.get("loc")), _R(cam.get("rot")), float(cam.get("fov") or 60)


def _spawn_metahuman(m, loc=None, rot=None):
    bp = unreal.EditorAssetLibrary.load_asset(m["bp"])
    if not bp:
        raise ValueError("no MetaHuman " + str(m["bp"]))
    act = _subsys(unreal.EditorActorSubsystem).spawn_actor_from_object(bp, _V(m.get("loc") or loc or [0, 0, 0]), _R(m.get("rot") or rot or [0, 0, 0]))
    if not act:
        raise ValueError("Unreal could not place the MetaHuman")
    act.set_actor_label("bitGen_MetaHuman")
    if m.get("anim"):
        anim = unreal.EditorAssetLibrary.load_asset(m["anim"])
        body = None
        for c in act.get_components_by_class(unreal.SkeletalMeshComponent):
            if c.get_name().lower() == "body":
                body = c
        if body is None:
            comps = act.get_components_by_class(unreal.SkeletalMeshComponent)
            body = comps[0] if comps else None
        if body and anim:
            body.set_animation_mode(unreal.AnimationMode.ANIMATION_SINGLE_NODE)
            body.set_animation(anim)
            body.set_position(float(m.get("time") or 0), False)
            body.set_play_rate(0)
    return act


def _lens_pp(pp, lens):
    """2.475.0: bitGen's lens on a post-process block: exposure (EV), depth of field (f-stop, focus distance cm,
    sensor width mm) - returns the block (FPostProcessSettings is a struct: set it back)"""
    if not lens:
        return pp
    def put(name, value):
        try:
            pp.set_editor_property("override_" + name, True)
            pp.set_editor_property(name, value)
        except Exception:
            pass
    if lens.get("exposure") is not None:
        put("auto_exposure_bias", float(lens["exposure"]))
    if lens.get("fstop"):
        put("depth_of_field_fstop", float(lens["fstop"]))
    if lens.get("focus"):
        put("depth_of_field_focal_distance", float(lens["focus"]))
    if lens.get("sensor"):
        put("depth_of_field_sensor_width", float(lens["sensor"]))
    return pp


def _capture_lens(comp, lens):
    if not lens:
        return
    try:
        comp.set_editor_property("post_process_settings", _lens_pp(comp.get_editor_property("post_process_settings"), lens))
        comp.set_editor_property("post_process_blend_weight", 1.0)
    except Exception as e:
        log("lens: %s" % e)
    if lens.get("fstop") and lens.get("focus"):        # a Scene Capture leaves depth of field out unless asked
        try:
            flags = list(comp.get_editor_property("show_flag_settings") or [])
            flags.append(unreal.EngineShowFlagsSetting(show_flag_name="DepthOfField", enabled=True))
            comp.set_editor_property("show_flag_settings", flags)
        except Exception:
            pass


def _lc(hexs):
    h = str(hexs or "#ffffff").lstrip("#")
    try:
        return unreal.LinearColor(int(h[0:2], 16) / 255.0, int(h[2:4], 16) / 255.0, int(h[4:6], 16) / 255.0, 1.0)
    except Exception:
        return unreal.LinearColor(1, 1, 1, 1)


def _col(hexs):
    h = str(hexs or "#ffffff").lstrip("#")
    try:
        return unreal.Color(r=int(h[0:2], 16), g=int(h[2:4], 16), b=int(h[4:6], 16), a=255)
    except Exception:
        return unreal.Color(r=255, g=255, b=255, a=255)


def _set(obj, names, value):
    """the first property name this engine version knows"""
    for n in names if isinstance(names, (list, tuple)) else [names]:
        try:
            obj.set_editor_property(n, value)
            return True
        except Exception:
            continue
    return False


LIGHT_CLASSES = {"point": "PointLight", "spot": "SpotLight", "rect": "RectLight", "directional": "DirectionalLight", "sky": "SkyLight"}


def _clear_rig():
    """bitGen's own lights / fog from an earlier picture (named bitGen_light_* / bitGen_fog)"""
    actors = _subsys(unreal.EditorActorSubsystem)
    for act in actors.get_all_level_actors():
        try:
            lab = act.get_actor_label()
        except Exception:
            continue
        if lab.startswith("bitGen_light_") or lab == "bitGen_fog":
            actors.destroy_actor(act)


def _apply_rig(rig):
    """2.476.0: bitGen's lights + height fog (volumetric) into the level -> the actors placed"""
    if not rig:
        return []
    _clear_rig()
    actors = _subsys(unreal.EditorActorSubsystem)
    out = []
    for l in rig.get("lights") or []:
        if l.get("on") is False:
            continue
        cls = getattr(unreal, LIGHT_CLASSES.get(l.get("type"), "PointLight"))
        act = actors.spawn_actor_from_class(cls, _V(l.get("loc")), _R(l.get("rot")))
        if not act:
            continue
        act.set_actor_label("bitGen_light_" + str(l.get("name") or l.get("type"))[:30])
        out.append(act)
        comp = act.get_component_by_class(unreal.LightComponentBase)
        if comp is None:
            continue
        _set(comp, "mobility", unreal.ComponentMobility.MOVABLE)
        t = l.get("type")
        if t in ("point", "spot", "rect"):
            _set(comp, "intensity_units", unreal.LightUnits.CANDELAS)
        _set(comp, "intensity", float(l.get("intensity") or 0))
        if t == "sky":
            _set(comp, "real_time_capture", True)
            _set(comp, "light_color", _col(l.get("color")))
            continue
        try:
            comp.set_light_color(_lc(l.get("color")), True)
        except Exception:
            _set(comp, "light_color", _col(l.get("color")))
        if float(l.get("temperature") or 0) > 0:
            _set(comp, "use_temperature", True)
            _set(comp, "temperature", float(l["temperature"]))
        _set(comp, "volumetric_scattering_intensity", float(l.get("volumetric") or 0))
        _set(comp, "cast_shadows", bool(l.get("shadows", True)))
        _set(comp, "cast_volumetric_shadow", bool(l.get("shadows", True)))
        if t in ("point", "spot", "rect"):
            _set(comp, "attenuation_radius", float(l.get("radius") or 1000))
        if t in ("point", "spot"):
            _set(comp, "source_radius", float(l.get("source") or 0))
        if t == "spot":
            _set(comp, "inner_cone_angle", float(l.get("inner") or 15))
            _set(comp, "outer_cone_angle", float(l.get("outer") or 35))
        if t == "rect":
            _set(comp, "source_width", float(l.get("width") or 100))
            _set(comp, "source_height", float(l.get("height") or 100))
    f = rig.get("fog") or {}
    if f.get("on"):
        act = actors.spawn_actor_from_class(unreal.ExponentialHeightFog, unreal.Vector(0, 0, 0), unreal.Rotator(0, 0, 0))
        if act:
            act.set_actor_label("bitGen_fog")
            out.append(act)
            comp = act.get_component_by_class(unreal.ExponentialHeightFogComponent)
            if comp is not None:
                _set(comp, "fog_density", float(f.get("density") or 0.02))
                _set(comp, "fog_height_falloff", float(f.get("falloff") or 0.2))
                _set(comp, ["fog_inscattering_luminance", "fog_inscattering_color"], _lc(f.get("color")))
                _set(comp, "start_distance", float(f.get("start") or 0))
                _set(comp, "volumetric_fog", bool(f.get("volumetric")))
                _set(comp, "volumetric_fog_albedo", _col(f.get("albedo")))
                _set(comp, "volumetric_fog_extinction_scale", float(f.get("extinction") or 1))
                _set(comp, "volumetric_fog_distance", float(f.get("distance") or 6000))
                _set(comp, "volumetric_fog_emissive", _lc(f.get("emissive") or "#000000"))
    return out


def cmd_set_viewport(a):
    """2.475.0: the level viewport looks through bitGen's camera"""
    _subsys(unreal.UnrealEditorSubsystem).set_level_viewport_camera_info(_V(a.get("loc")), _R(a.get("rot")))
    return {"loc": a.get("loc"), "rot": a.get("rot")}


def cmd_focus_at(a):
    """2.475.0: the distance (cm) from the camera to what is at (u, v) of its picture (0..1, from the top left)"""
    loc, rot, fov = _camera_of(a)
    u, v, aspect = float(a.get("u", 0.5)), float(a.get("v", 0.5)), float(a.get("aspect") or 16 / 9)
    t = math.tan(math.radians(fov) / 2)
    f, rgt, up = rot.get_forward_vector(), rot.get_right_vector(), rot.get_up_vector()
    d = f + rgt * ((u * 2 - 1) * t) + up * ((1 - v * 2) * t / aspect)
    end = loc + d * 1000000.0
    hit = unreal.SystemLibrary.line_trace_single(_world(), loc, end, unreal.TraceTypeQuery.TRACE_TYPE_QUERY1, True, [], unreal.DrawDebugTrace.NONE, True)
    try:
        parts = unreal.GameplayStatics.break_hit_result(hit if not isinstance(hit, tuple) else hit[0])
        blocking, dist, where = parts[0], parts[3], parts[4]
    except Exception:
        blocking, dist, where = False, 0, None
    if not blocking:
        return {"hit": False}
    return {"hit": True, "focus": round(float(dist) / max(1e-6, float(d.length())), 2), "at": _vec(where) if where else None}


def cmd_still(a):
    w, h = int(a.get("w") or 1280), int(a.get("h") or 720)
    out = a.get("out")
    if not out:
        raise ValueError("no output file")
    if a.get("level"):
        cur = _world()
        if not cur or not cur.get_path_name().startswith(a["level"]):
            cmd_open_level({"path": a["level"]})
    world = _world()
    actors = _subsys(unreal.EditorActorSubsystem)
    spawned = []
    try:
        mh = None
        if a.get("metahuman"):
            mh = _spawn_metahuman(a["metahuman"])
            spawned.append(mh)
        rig = a.get("rig")
        placed = _apply_rig(rig)                              # 2.476.0: bitGen's lights + fog for this picture
        if not (rig or {}).get("keep"):
            spawned.extend(placed)
        loc, rot, fov = _camera_of(a)
        cap = actors.spawn_actor_from_class(unreal.SceneCapture2D, loc, rot)
        spawned.append(cap)
        comp = cap.get_editor_property("capture_component2d")
        alpha = bool(a.get("alpha"))
        rt = unreal.RenderingLibrary.create_render_target2d(world, w, h, unreal.TextureRenderTargetFormat.RTF_RGBA8, unreal.LinearColor(0, 0, 0, 0), False)
        comp.set_editor_property("texture_target", rt)
        comp.set_editor_property("fov_angle", fov)
        comp.set_editor_property("capture_every_frame", False)
        comp.set_editor_property("capture_on_movement", False)
        comp.set_editor_property("capture_source", unreal.SceneCaptureSource.SCS_FINAL_COLOR_LDR)
        if alpha:
            try:
                comp.set_editor_property("consider_unrendered_opaque_pixels_as_fully_translucent", True)
            except Exception:
                pass
        _capture_lens(comp, a.get("lens"))
        if a.get("rig"):                                      # fog / volumetric fog in the capture
            try:
                flags = list(comp.get_editor_property("show_flag_settings") or [])
                for nm in ("Fog", "VolumetricFog"):
                    flags.append(unreal.EngineShowFlagsSetting(show_flag_name=nm, enabled=True))
                comp.set_editor_property("show_flag_settings", flags)
            except Exception:
                pass
        if mh is not None and a.get("only_metahuman"):
            comp.set_editor_property("primitive_render_mode", unreal.SceneCapturePrimitiveRenderMode.PRM_USE_SHOW_ONLY_LIST)
            comp.set_editor_property("show_only_actors", [mh])
        comp.capture_scene()
        for _ in range(3):                 # the capture is drawn with the next frames of the editor
            yield
        d, f = os.path.dirname(out), os.path.basename(out)
        os.makedirs(d, exist_ok=True)
        unreal.RenderingLibrary.export_render_target(world, rt, d, f)
        if not os.path.exists(out) and os.path.exists(out + ".png"):
            os.replace(out + ".png", out)
        return {"out": out, "w": w, "h": h, "camera": {"loc": _vec(loc), "rot": _rot(rot), "fov": fov}}
    finally:
        for s in spawned:
            try:
                actors.destroy_actor(s)
            except Exception:
                pass


def _object_path(p):
    return p if "." in p.split("/")[-1] else p + "." + p.split("/")[-1]


def _binding_id(seq, b):
    try:
        return unreal.MovieSceneSequenceExtensions.get_portable_binding_id(seq, seq, b)
    except Exception:
        try:
            return seq.get_portable_binding_id(seq, b)
        except Exception:
            return seq.get_binding_id(b)


def _make_sequence(a, jid):
    """a Level Sequence for bitGen's camera keys (+ a MetaHuman with an animation)"""
    fps = int(a.get("fps") or 24)
    frames = int(a.get("frames") or 120)
    tools = unreal.AssetToolsHelpers.get_asset_tools()
    name = "bitGen_" + jid
    seq = tools.create_asset(name, "/Game/bitGen", unreal.LevelSequence, unreal.LevelSequenceFactoryNew())
    seq.set_display_rate(unreal.FrameRate(fps, 1))
    seq.set_playback_start(0)
    seq.set_playback_end(frames)
    keys = a.get("camera_keys") or []
    if keys:
        cam = seq.add_spawnable_from_class(unreal.CineCameraActor)
        try:
            tmpl = cam.get_object_template()
            fov = float(keys[0].get("fov") or 60)
            cc = tmpl.get_cine_camera_component()
            sw = cc.get_editor_property("filmback").sensor_width
            cc.set_editor_property("current_focal_length", sw / (2 * math.tan(math.radians(fov) / 2)))
        except Exception:
            pass
        lens = a.get("lens") or {}
        try:
            cc = cam.get_object_template().get_cine_camera_component()
            fb = cc.get_editor_property("filmback")
            if lens.get("sensor"):
                fb.sensor_width = float(lens["sensor"]); cc.set_editor_property("filmback", fb)
            if lens.get("focal"):
                cc.set_editor_property("current_focal_length", float(lens["focal"]))
            if lens.get("fstop"):
                cc.set_editor_property("current_aperture", float(lens["fstop"]))
            if lens.get("focus"):
                fs = cc.get_editor_property("focus_settings")
                fs.focus_method = unreal.CameraFocusMethod.MANUAL; fs.manual_focus_distance = float(lens["focus"])
                cc.set_editor_property("focus_settings", fs)
            if lens.get("exposure") is not None:
                cc.set_editor_property("post_process_settings", _lens_pp(cc.get_editor_property("post_process_settings"), {"exposure": lens["exposure"]}))
        except Exception as e:
            log("sequence lens: %s" % e)
        tr = cam.add_track(unreal.MovieScene3DTransformTrack)
        sec = tr.add_section()
        sec.set_range(0, frames)
        ch = sec.get_all_channels()          # location x y z, rotation x (roll) y (pitch) z (yaw), scale x y z
        tick = seq.get_tick_resolution().numerator / max(1, seq.get_display_rate().numerator) if hasattr(seq, "get_tick_resolution") else 1
        for k in keys:
            fn = unreal.FrameNumber(int(round(float(k.get("t") or 0) * fps * tick)))
            loc, rot = k.get("loc") or [0, 0, 0], k.get("rot") or [0, 0, 0]
            for i, v in enumerate([loc[0], loc[1], loc[2], rot[0], rot[1], rot[2]]):
                ch[i].add_key(fn, float(v))
        cut = seq.add_track(unreal.MovieSceneCameraCutTrack)
        cs = cut.add_section()
        cs.set_range(0, frames)
        cs.set_camera_binding_id(_binding_id(seq, cam))
    if a.get("metahuman"):
        m = a["metahuman"]
        act = _spawn_metahuman(dict(m, anim=None))
        b = seq.add_possessable(act)
        if m.get("anim"):
            anim = unreal.EditorAssetLibrary.load_asset(m["anim"])
            body = None
            for c in act.get_components_by_class(unreal.SkeletalMeshComponent):
                if c.get_name().lower() == "body":
                    body = c
            if body and anim:
                cb = seq.add_possessable(body)
                at = cb.add_track(unreal.MovieSceneSkeletalAnimationTrack)
                s = at.add_section()
                s.set_range(0, frames)
                p = s.get_editor_property("params")
                p.set_editor_property("animation", anim)
                s.set_editor_property("params", p)
    unreal.EditorAssetLibrary.save_loaded_asset(seq)
    return seq.get_path_name()


def cmd_render(a):
    jid = uuid.uuid4().hex[:10]
    out_dir = a.get("out_dir")
    if not out_dir:
        raise ValueError("no output folder")
    os.makedirs(out_dir, exist_ok=True)
    level = a.get("level") or (_world().get_path_name().split(".")[0] if _world() else "")
    if a.get("level"):
        cmd_open_level({"path": a["level"]})
    seq_path = _object_path(a["sequence"]) if a.get("sequence") else _make_sequence(a, jid)
    sub = _subsys(unreal.MoviePipelineQueueSubsystem)
    q = sub.get_queue()
    q.delete_all_jobs()
    job = q.allocate_new_job(unreal.MoviePipelineExecutorJob)
    job.set_editor_property("sequence", unreal.SoftObjectPath(seq_path))
    job.set_editor_property("map", unreal.SoftObjectPath(_object_path(level)))
    job.set_editor_property("job_name", "bitGen " + jid)
    cfg = job.get_configuration()
    o = cfg.find_or_add_setting_by_class(unreal.MoviePipelineOutputSetting)
    o.set_editor_property("output_directory", unreal.DirectoryPath(out_dir))
    o.set_editor_property("output_resolution", unreal.IntPoint(int(a.get("w") or 1280), int(a.get("h") or 720)))
    o.set_editor_property("file_name_format", "f_{frame_number}")
    o.set_editor_property("zero_pad_frame_numbers", 5)
    o.set_editor_property("override_existing_output", True)
    if a.get("fps"):
        o.set_editor_property("use_custom_frame_rate", True)
        o.set_editor_property("output_frame_rate", unreal.FrameRate(int(a["fps"]), 1))
    cfg.find_or_add_setting_by_class(unreal.MoviePipelineDeferredPassBase)
    png = cfg.find_or_add_setting_by_class(unreal.MoviePipelineImageSequenceOutput_PNG)
    try:
        png.set_editor_property("write_alpha", bool(a.get("alpha")))
    except Exception:
        pass
    if a.get("samples"):
        aa = cfg.find_or_add_setting_by_class(unreal.MoviePipelineAntiAliasingSetting)
        aa.set_editor_property("spatial_sample_count", int(a["samples"]))
    _jobs[jid] = {"state": "running", "error": "", "out_dir": out_dir, "sequence": seq_path, "t0": time.time()}
    placed = _apply_rig(a.get("rig"))                         # 2.476.0: lights + fog for the whole render

    def done(executor, success):
        if not (a.get("rig") or {}).get("keep"):
            for x in placed:
                try:
                    _subsys(unreal.EditorActorSubsystem).destroy_actor(x)
                except Exception:
                    pass
        _jobs[jid]["state"] = "done" if success else "error"
        if not success:
            _jobs[jid]["error"] = "the Movie Render Queue did not finish (the Output Log says why)"
    ex = sub.render_queue_with_executor(unreal.MoviePipelinePIEExecutor)
    try:
        ex.on_executor_finished_delegate.add_callable_unique(done)
    except Exception:
        ex.on_executor_finished_delegate.add_callable(done)
    return {"job": jid, "sequence": seq_path}


def cmd_job(a):
    j = _jobs.get(a.get("id"))
    if not j:
        raise ValueError("no such job")
    n = len([f for f in os.listdir(j["out_dir"]) if f.startswith("f_") and f.endswith(".png")]) if os.path.isdir(j["out_dir"]) else 0
    return {"state": j["state"], "error": j["error"], "frames": n, "sequence": j["sequence"]}


def cmd_actors_in_view(a):
    """2.540.0: the level's mesh actors with their bounds + the camera (bitGen puts each on the picture and gives it a
    reference docker picture - lib/realRefs.js). a = the still's camera spec (+ level); hidden / bitGen_* / huge
    (landscape, sky) actors are left out"""
    if a.get("level"):
        cur = _world()
        if not cur or not cur.get_path_name().startswith(a["level"]):
            cmd_open_level({"path": a["level"]})
    loc, rot, fov = _camera_of(a)
    out = []
    for act in _subsys(unreal.EditorActorSubsystem).get_all_level_actors():
        try:
            label = act.get_actor_label()
            if label.startswith("bitGen_") or act.is_hidden_ed():
                continue
            if isinstance(act, (unreal.CameraActor, unreal.Light, unreal.ExponentialHeightFog, unreal.SkyAtmosphere)) or "Landscape" in act.get_class().get_name():
                continue
            if not act.get_components_by_class(unreal.PrimitiveComponent):
                continue
            origin, extent = act.get_actor_bounds(False)
            if max(extent.x, extent.y, extent.z) > 50000 or max(extent.x, extent.y, extent.z) < 1:
                continue
            out.append({"label": label, "cls": act.get_class().get_name(), "origin": _vec(origin), "extent": _vec(extent),
                        "dist": float((origin - loc).length())})
        except Exception:
            continue
    out.sort(key=lambda x: x["dist"])
    return {"camera": {"loc": _vec(loc), "rot": _rot(rot), "fov": fov}, "actors": out[:300]}


def cmd_import_mesh(a):
    """2.579.0 (plugin 1.4.0): a mesh file bitGen made (the 📐 SolidCraft docker's "Send to Unreal" - an OBJ in
    centimetres, Y up, as Unreal's OBJ import expects) -> a Static Mesh in /Game/bitGen/<folder>/, placed in the open
    level (an actor with the same label is replaced where it stood) and selected.
    a = {file (absolute), name?, folder? (default SolidCraft), place? (default true)}"""
    path = a.get("file") or ""
    if not path or not os.path.isfile(path):
        raise ValueError("no such file: %s" % path)
    name = re.sub(r"[^A-Za-z0-9_]", "_", a.get("name") or os.path.splitext(os.path.basename(path))[0])[:60] or "bitGen_mesh"
    folder = re.sub(r"[^A-Za-z0-9_/]", "_", a.get("folder") or "SolidCraft").strip("/") or "SolidCraft"
    task = unreal.AssetImportTask()
    task.set_editor_property("filename", path)
    task.set_editor_property("destination_path", "/Game/bitGen/" + folder)
    task.set_editor_property("destination_name", name)
    task.set_editor_property("automated", True)
    task.set_editor_property("replace_existing", True)
    task.set_editor_property("save", True)
    unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
    paths = [str(p) for p in (task.get_editor_property("imported_object_paths") or [])]
    if not paths:
        raise RuntimeError("Unreal imported nothing from %s - see the Output Log" % os.path.basename(path))
    out = {"assets": paths}
    if a.get("place", True):
        mesh = None
        for p in paths:
            asset = unreal.load_asset(p)
            if isinstance(asset, unreal.StaticMesh):
                mesh = asset
                break
        if mesh:
            sub = _subsys(unreal.EditorActorSubsystem)
            loc, rot = unreal.Vector(0, 0, 0), unreal.Rotator(0, 0, 0)
            for act in sub.get_all_level_actors():
                if act.get_actor_label() == name:            # sent again: the new mesh where the old one stood
                    loc, rot = act.get_actor_location(), act.get_actor_rotation()
                    sub.destroy_actor(act)
            act = sub.spawn_actor_from_object(mesh, loc, rot)
            act.set_actor_label(name)
            sub.set_selected_level_actors([act])
            out["actor"] = name
    return out


COMMANDS = {"actors_in_view": cmd_actors_in_view, "set_viewport": cmd_set_viewport, "focus_at": cmd_focus_at, "ping": cmd_ping, "levels": cmd_levels, "sequences": cmd_sequences, "metahumans": cmd_metahumans, "anims": cmd_anims, "cameras": cmd_cameras,
            "viewport": cmd_viewport, "open_level": cmd_open_level, "still": cmd_still, "render": cmd_render, "job": cmd_job,
            "import_mesh": cmd_import_mesh}


# ---------------------------------------------------------------- the editor's thread does the work
_waiting = []          # commands that wait a few frames (a generator: each `yield` = one editor frame)


def _finish(item, r=None, e=None):
    if e is not None:
        item["result"] = {"ok": False, "error": str(e) or e.__class__.__name__, "trace": traceback.format_exc()[-800:]}
    else:
        item["result"] = dict(r or {}, ok=True)
    item["event"].set()


def _step(item):
    try:
        next(item["gen"])
        return True
    except StopIteration as st:
        _finish(item, st.value)
    except Exception as e:
        _finish(item, e=e)
    return False


def _on_tick(dt):
    with _lock:
        todo = list(_queue)
        del _queue[:]
    for item in list(_waiting):
        if not _step(item):
            _waiting.remove(item)
    for item in todo:
        try:
            r = COMMANDS[item["cmd"]](item.get("args") or {})
            if hasattr(r, "__next__"):
                item["gen"] = r
                if _step(item):
                    _waiting.append(item)
                continue
            _finish(item, r)
        except Exception as e:
            _finish(item, e=e)


def run_on_game_thread(cmd, args, timeout=300):
    if cmd not in COMMANDS:
        return {"ok": False, "error": "unknown command " + str(cmd)}
    item = {"cmd": cmd, "args": args, "event": threading.Event()}
    with _lock:
        _queue.append(item)
    if not item["event"].wait(timeout):
        return {"ok": False, "error": "Unreal was busy for too long"}
    return item["result"]


def start(port=None):
    global _server, _tick, PORT
    import http.server
    if port:
        PORT = int(port)
    if _server:
        return PORT

    class H(http.server.BaseHTTPRequestHandler):
        def log_message(self, *a):
            pass

        def _send(self, code, obj):
            b = json.dumps(obj).encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(b)))
            self.end_headers()
            self.wfile.write(b)

        def do_GET(self):
            if self.path.startswith("/bitgen/ping"):
                return self._send(200, run_on_game_thread("ping", {}, 30))
            self._send(404, {"ok": False, "error": "POST /bitgen"})

        def do_POST(self):
            if not self.path.startswith("/bitgen"):
                return self._send(404, {"ok": False, "error": "POST /bitgen"})
            try:
                n = int(self.headers.get("Content-Length") or 0)
                req = json.loads(self.rfile.read(n).decode("utf-8") or "{}")
            except Exception:
                return self._send(400, {"ok": False, "error": "not JSON"})
            r = run_on_game_thread(req.get("cmd"), req.get("args") or {})
            self._send(200 if r.get("ok") else 422, r)

    _server = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), H)
    threading.Thread(target=_server.serve_forever, daemon=True, name="bitGenBridge").start()
    _tick = unreal.register_slate_post_tick_callback(_on_tick)
    log("listening on http://127.0.0.1:%d/bitgen (bitGen Studio's Settings ▸ 3D ▸ Unreal)" % PORT)
    return PORT


def stop():
    global _server, _tick
    if _server:
        _server.shutdown()
        _server = None
    if _tick is not None:
        unreal.unregister_slate_post_tick_callback(_tick)
        _tick = None
