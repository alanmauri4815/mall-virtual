"""Export a Mixamo FBX as an animation-only GLB clip."""

from pathlib import Path
import sys

import bpy


def argument(index: int) -> Path:
    marker = sys.argv.index("--")
    return Path(sys.argv[marker + index]).resolve()


source = argument(1)
destination = argument(2)
clip_name = sys.argv[sys.argv.index("--") + 3]

before = set(bpy.data.objects)
bpy.ops.import_scene.fbx(filepath=str(source), use_anim=True)
imported = set(bpy.data.objects) - before
rigs = [obj for obj in imported if obj.type == "ARMATURE"]
if len(rigs) != 1:
    raise RuntimeError(f"Expected one imported rig, got {[obj.name for obj in rigs]}")
rig = rigs[0]
if rig.animation_data is None or rig.animation_data.action is None:
    raise RuntimeError(f"No animation found in {source.name}")

action = rig.animation_data.action
action.name = clip_name
for obj in bpy.context.selected_objects:
    obj.select_set(False)
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
destination.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=str(destination),
    export_format="GLB",
    use_selection=True,
    export_materials="NONE",
    export_animations=True,
    export_animation_mode="ACTIONS",
    export_bake_animation=True,
    export_optimize_animation_size=True,
    export_anim_single_armature=True,
    export_yup=True,
)
print(f"Exported {clip_name} to {destination}")
