# bitGen Studio - scripts/blend_open_model.py (2.579.0): Blender opens WITH A MODEL (the 📐 SolidCraft docker's
# "Send to Blender", lib/blenderSend.js):
#   blender --python scripts/blend_open_model.py -- <model.obj> <out.blend>
# Runs in Blender's own window (not -b): the start scene is emptied, the OBJ (SolidCraft's: millimetres, Z up) comes in
# as metres with Z up, its objects are named after the file and selected, the view frames them once the window is up,
# and the scene is saved as <out.blend> (the project's blender/solidcraft folder) - Ctrl+S keeps saving there.
import os
import sys

import bpy


def _args():
    a = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    if len(a) < 2:
        raise SystemExit("usage: blender --python blend_open_model.py -- <model.obj> <out.blend>")
    return a[0], a[1]


def _empty_scene():
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)


def _import_obj(path):
    before = set(bpy.data.objects)
    if hasattr(bpy.ops.wm, "obj_import"):                       # Blender 3.2+ / 4.x
        bpy.ops.wm.obj_import(filepath=path, forward_axis="Y", up_axis="Z", global_scale=0.001)
        scaled = True
    else:                                                       # older: the legacy importer, scaled after
        bpy.ops.import_scene.obj(filepath=path, axis_forward="Y", axis_up="Z")
        scaled = False
    new = [ob for ob in bpy.data.objects if ob not in before]
    if not scaled:
        for ob in new:
            ob.scale = (0.001, 0.001, 0.001)
    return new


def _frame():
    try:
        for win in bpy.context.window_manager.windows:
            for area in win.screen.areas:
                if area.type != "VIEW_3D":
                    continue
                region = next((r for r in area.regions if r.type == "WINDOW"), None)
                with bpy.context.temp_override(window=win, area=area, region=region):
                    bpy.ops.view3d.view_selected()
                return None
    except Exception as e:  # an older Blender without temp_override - the view stays as it is
        print("[bitGen] could not frame the view:", e)
    return None


def main():
    src, out = _args()
    _empty_scene()
    new = _import_obj(src)
    stem = os.path.splitext(os.path.basename(src))[0]
    for i, ob in enumerate(new):
        ob.name = stem if len(new) == 1 else "%s_%d" % (stem, i + 1)
        ob.select_set(True)
    if new:
        bpy.context.view_layer.objects.active = new[0]
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(out))
    print("[bitGen] %d object(s) from %s -> %s" % (len(new), src, out))
    if not bpy.app.background:
        bpy.app.timers.register(_frame, first_interval=0.5)


main()
