# bitGen Studio — scripts/bvh_to_fbx.py (2.869.0): a motion capture .bvh (RGB MoCap's export) made an .fbx the timeline's 3D layers play.
# blender -b --factory-startup -P scripts/bvh_to_fbx.py -- <in.bvh> <out.fbx>
import sys
import bpy
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
if len(argv) < 2:
    print("H3B error: usage bvh_to_fbx.py -- in.bvh out.fbx"); sys.exit(2)
src, dst = argv[0], argv[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_anim.bvh(filepath=src, update_scene_fps=True, update_scene_duration=True, rotate_mode="NATIVE", axis_forward="-Z", axis_up="Y")
bpy.ops.export_scene.fbx(filepath=dst, use_selection=False, add_leaf_bones=False, bake_anim=True, bake_anim_use_all_actions=False, bake_anim_use_nla_strips=False, object_types={"ARMATURE"}, axis_forward="-Z", axis_up="Y")
print("H3B done " + dst)
