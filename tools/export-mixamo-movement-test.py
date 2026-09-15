"""Export the user's unmodified body and its Mixamo walk for in-mall testing."""

from pathlib import Path
import sys

import bpy


def argument(index: int) -> Path:
    marker = sys.argv.index("--")
    return Path(sys.argv[marker + index]).resolve()


destination = argument(1)
rig = bpy.data.objects["Human.rig"]
body = bpy.data.objects["Human"]
walk = bpy.data.actions["mixamo.com"]
walk.name = "Walk"

# Both armatures use Mixamo bone names. The body is weighted to Human.rig;
# bind the downloaded action to that armature's action slot before exporting.
rig.animation_data_create()
rig.animation_data.action = walk
rig.animation_data.action_slot = walk.slots[0]
for action in list(bpy.data.actions):
    if action != walk:
        bpy.data.actions.remove(action)

material = bpy.data.materials.new("AvatarBody")
material.diffuse_color = (0.56, 0.31, 0.19, 1.0)
material.use_nodes = True
material.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.56, 0.31, 0.19, 1.0)
body.data.materials.clear()
body.data.materials.append(material)

for obj in bpy.context.selected_objects:
    obj.select_set(False)
rig.select_set(True)
body.select_set(True)
bpy.context.view_layer.objects.active = rig
destination.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=str(destination),
    export_format="GLB",
    use_selection=True,
    export_materials="EXPORT",
    export_animations=True,
    export_animation_mode="ACTIONS",
    export_bake_animation=True,
    export_optimize_animation_size=True,
    export_anim_single_armature=True,
    export_yup=True,
)
print(f"Exported {destination}")
