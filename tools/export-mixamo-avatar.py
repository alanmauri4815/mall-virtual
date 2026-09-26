"""Build a clean, clothed avatar using the user's rigged Mixamo walk cycle."""

from pathlib import Path
import sys

import bpy


def argument(index: int) -> Path:
    marker = sys.argv.index("--")
    return Path(sys.argv[marker + index]).resolve()


def material(name, color):
    value = bpy.data.materials.new(name)
    value.use_nodes = True
    nodes = value.node_tree.nodes
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    shader.inputs["Base Color"].default_value = color
    shader.inputs["Roughness"].default_value = 0.72
    value.node_tree.links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    return value


def parent_to_bone(obj, rig, bone_name):
    obj.parent = rig
    obj.parent_type = "BONE"
    obj.parent_bone = bone_name
    obj.matrix_parent_inverse = rig.matrix_world.inverted()


def rounded_cube(name, location, scale, mat, bevel=0.05):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    modifier = obj.modifiers.new("Soft edges", "BEVEL")
    modifier.width = bevel
    modifier.segments = 3
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.data.materials.append(mat)
    return obj


def capsule(name, location, radius, depth, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = (radius, radius, depth * 0.5)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    return obj


destination = argument(1)
rig = bpy.data.objects["Human.rig_reduced_reduced"]
body = bpy.data.objects["Human.rig_reduced_body_reduced"]
walk = bpy.data.actions["mixamo.com"]
walk.name = "Walk"

# The downloaded action belongs to a matching Mixamo skeleton. Binding its slot
# to the body rig preserves the original left/right alternating gait.
rig.animation_data_create()
rig.animation_data.action = walk
rig.animation_data.action_slot = walk.slots[0]
for action in list(bpy.data.actions):
    if action != walk:
        bpy.data.actions.remove(action)

skin = material("AvatarBody", (0.47, 0.22, 0.12, 1.0))
outfit = material("AvatarOutfit", (0.045, 0.09, 0.16, 1.0))
accent = material("AvatarShirt", (0.82, 0.72, 0.49, 1.0))
shoes = material("AvatarShoes", (0.025, 0.024, 0.028, 1.0))
hair = material("AvatarHair", (0.075, 0.028, 0.012, 1.0))
body.data.materials.clear()
body.data.materials.append(skin)

# Solid wardrobe pieces are deliberately separate from the body: no texture
# masks or clipped garment faces can expose skin through the jacket or trousers.
pieces = []
pieces.append((rounded_cube("jacket", (0, 0, 1.17), (0.34, 0.20, 0.39), outfit, 0.06), "mixamorig:Spine2"))
pieces.append((rounded_cube("shirt-front", (0, -0.205, 1.19), (0.14, 0.018, 0.27), accent, 0.018), "mixamorig:Spine2"))
pieces.append((rounded_cube("waistcoat", (0, 0, 0.84), (0.29, 0.19, 0.14), outfit, 0.04), "mixamorig:Hips"))
for side, x in (("L", 0.18), ("R", -0.18)):
    pieces.append((capsule(f"sleeve-upper-{side}", (x, 0, 1.28), 0.105, 0.34, outfit), f"mixamorig:{'Left' if side == 'L' else 'Right'}Arm"))
    pieces.append((capsule(f"sleeve-lower-{side}", (x * 1.6, 0, 1.02), 0.085, 0.29, outfit), f"mixamorig:{'Left' if side == 'L' else 'Right'}ForeArm"))
    pieces.append((rounded_cube(f"trouser-upper-{side}", (x, 0, 0.63), (0.13, 0.15, 0.26), outfit, 0.045), f"mixamorig:{'Left' if side == 'L' else 'Right'}UpLeg"))
    pieces.append((rounded_cube(f"trouser-lower-{side}", (x, 0, 0.28), (0.105, 0.13, 0.25), outfit, 0.04), f"mixamorig:{'Left' if side == 'L' else 'Right'}Leg"))
    pieces.append((rounded_cube(f"shoe-{side}", (x, -0.06, 0.06), (0.13, 0.21, 0.07), shoes, 0.04), f"mixamorig:{'Left' if side == 'L' else 'Right'}Foot"))

# A compact hair cap keeps the face clear and behaves with the animated head.
hair_cap = capsule("short-hair", (0, 0.01, 1.63), 0.28, 0.20, hair)
pieces.append((hair_cap, "mixamorig:Head"))

for piece, bone in pieces:
    parent_to_bone(piece, rig, bone)

bpy.context.scene.frame_set(1)
for obj in bpy.context.selected_objects:
    obj.select_set(False)
for obj in [rig, body] + [piece for piece, _ in pieces]:
    obj.select_set(True)
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
