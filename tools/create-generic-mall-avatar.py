"""Build the first lightweight, branded generic avatar for the virtual mall.

The asset deliberately uses compact primitive-based geometry and no image textures.
It exports Idle and Walk clips and keeps Body, Hair and Look material zones separate
so the web customizer can recolor them without cloning another GLB per visitor.
"""

from pathlib import Path
import math

import bpy


WORKSPACE = Path(r"C:\Users\javii\Downloads\Web Tienda Virtual")
BLEND_PATH = Path.home() / "Documents" / "Mall Virtual Blender" / "mall-generic-avatar-v1.blend"
EXPORT_PATH = WORKSPACE / "assets" / "avatars" / "mall-generic-avatar-v1.glb"


def material(name, color, roughness=0.62, metallic=0.0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    principled = mat.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = (*color, 1)
    principled.inputs["Roughness"].default_value = roughness
    principled.inputs["Metallic"].default_value = metallic
    return mat


def add_uv_sphere(name, location, scale, mat, segments=12, rings=8):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    return obj


def add_cylinder(name, location, radius, depth, mat, vertices=10):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    bevel = obj.modifiers.new("Soft edges", "BEVEL")
    bevel.width = min(radius * 0.2, 0.025)
    bevel.segments = 2
    bpy.ops.object.shade_smooth()
    return obj


def add_box(name, location, scale, mat, bevel=0.04):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    modifier = obj.modifiers.new("Soft corners", "BEVEL")
    modifier.width = bevel
    modifier.segments = 2
    bpy.ops.object.shade_smooth()
    return obj


def parent_to_bone(obj, armature, bone_name):
    obj.parent = armature
    obj.parent_type = "BONE"
    obj.parent_bone = bone_name
    # Preserve the object's world-space rest pose. A bone parent adds its own
    # transform, so using only the armature inverse makes every limb inherit the
    # bone offset twice after GLB export.
    bone_matrix = armature.matrix_world @ armature.pose.bones[bone_name].matrix
    obj.matrix_parent_inverse = bone_matrix.inverted()


def make_armature():
    bpy.ops.object.armature_add(enter_editmode=True, location=(0, 0, 0))
    armature = bpy.context.object
    armature.name = "MallPersonaRig"
    armature.data.name = "MallPersonaRig"
    edit_bones = armature.data.edit_bones
    root = edit_bones[0]
    root.name = "Hips"
    root.head, root.tail = (0, 0, 0.92), (0, 0, 1.08)

    def bone(name, head, tail, parent):
        created = edit_bones.new(name)
        created.head, created.tail = head, tail
        created.parent = parent
        return created

    spine = bone("Spine", (0, 0, 1.04), (0, 0, 1.28), root)
    chest = bone("Chest", (0, 0, 1.28), (0, 0, 1.48), spine)
    neck = bone("Neck", (0, 0, 1.48), (0, 0, 1.59), chest)
    bone("Head", (0, 0, 1.59), (0, 0, 1.82), neck)
    for side, x in (("Left", -0.25), ("Right", 0.25)):
        upper_arm = bone(f"{side}Arm", (x, 0, 1.42), (x * 1.65, 0, 1.18), chest)
        fore_arm = bone(f"{side}ForeArm", (x * 1.65, 0, 1.18), (x * 1.78, 0.01, 0.94), upper_arm)
        bone(f"{side}Hand", (x * 1.78, 0.01, 0.94), (x * 1.82, 0.04, 0.84), fore_arm)
        upper_leg = bone(f"{side}UpLeg", (x * 0.48, 0, 0.95), (x * 0.53, 0, 0.55), root)
        lower_leg = bone(f"{side}Leg", (x * 0.53, 0, 0.55), (x * 0.57, 0, 0.16), upper_leg)
        bone(f"{side}Foot", (x * 0.57, 0, 0.16), (x * 0.57, 0.12, 0.07), lower_leg)
    bpy.ops.object.mode_set(mode="OBJECT")
    return armature


def key_pose(armature, frame, rotations):
    for bone in armature.pose.bones:
        bone.rotation_mode = "XYZ"
        bone.rotation_euler = rotations.get(bone.name, (0, 0, 0))
        bone.keyframe_insert(data_path="rotation_euler", frame=frame)


def make_actions(armature):
    armature.animation_data_create()
    idle = bpy.data.actions.new("Idle")
    armature.animation_data.action = idle
    key_pose(armature, 1, {"Spine": (math.radians(-1), 0, 0), "LeftArm": (math.radians(-4), 0, 0), "RightArm": (math.radians(4), 0, 0)})
    key_pose(armature, 25, {"Spine": (math.radians(1), 0, 0), "LeftArm": (math.radians(-2), 0, 0), "RightArm": (math.radians(2), 0, 0)})
    key_pose(armature, 49, {"Spine": (math.radians(-1), 0, 0), "LeftArm": (math.radians(-4), 0, 0), "RightArm": (math.radians(4), 0, 0)})

    walk = bpy.data.actions.new("Walk")
    armature.animation_data.action = walk
    for frame, direction in ((1, 1), (13, -1), (25, 1), (37, -1), (49, 1)):
        swing = math.radians(22 * direction)
        key_pose(armature, frame, {
            "Spine": (math.radians(-1.5), 0, math.radians(1.5 * direction)),
            "LeftArm": (-swing, 0, 0), "RightArm": (swing, 0, 0),
            "LeftForeArm": (math.radians(-8), 0, 0), "RightForeArm": (math.radians(-8), 0, 0),
            "LeftUpLeg": (swing, 0, 0), "RightUpLeg": (-swing, 0, 0),
            "LeftLeg": (math.radians(max(-5, -18 * direction)), 0, 0),
            "RightLeg": (math.radians(max(-5, 18 * direction)), 0, 0),
        })
    armature.animation_data.action = idle


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    skin = material("Body", (0.72, 0.44, 0.31), 0.64)
    hair = material("Hair", (0.13, 0.08, 0.05), 0.78)
    look = material("Look", (0.12, 0.16, 0.20), 0.68)
    accent = material("Mall gold", (0.62, 0.45, 0.16), 0.42, 0.18)
    shoe = material("Shoes", (0.055, 0.06, 0.065), 0.62)
    eye = material("Eyes", (0.035, 0.04, 0.045), 0.35)

    rig = make_armature()
    # The compact silhouette is deliberately human and welcoming, not photorealistic.
    torso = add_uv_sphere("Look_Torso", (0, 0, 1.28), (0.29, 0.18, 0.36), look)
    parent_to_bone(torso, rig, "Spine")
    collar = add_cylinder("Look_Collar", (0, 0.015, 1.52), 0.105, 0.07, accent, 12)
    parent_to_bone(collar, rig, "Neck")
    head = add_uv_sphere("Body_Head", (0, 0.015, 1.77), (0.22, 0.205, 0.25), skin, 16, 10)
    parent_to_bone(head, rig, "Head")
    hair_cap = add_uv_sphere("Hair_Cap", (0, -0.008, 1.90), (0.225, 0.21, 0.135), hair, 14, 8)
    parent_to_bone(hair_cap, rig, "Head")
    for side, x in (("Left", -0.073), ("Right", 0.073)):
        eye_obj = add_uv_sphere(f"Eye_{side}", (x, 0.195, 1.79), (0.027, 0.012, 0.034), eye, 10, 6)
        parent_to_bone(eye_obj, rig, "Head")
        arm = add_cylinder(f"Look_{side}UpperArm", (x * 2.1, 0, 1.26), 0.074, 0.31, look, 10)
        arm.rotation_euler[1] = math.radians(-20 if side == "Left" else 20)
        parent_to_bone(arm, rig, f"{side}Arm")
        forearm = add_cylinder(f"Look_{side}ForeArm", (x * 2.55, 0, 1.02), 0.06, 0.28, look, 10)
        forearm.rotation_euler[1] = math.radians(-12 if side == "Left" else 12)
        parent_to_bone(forearm, rig, f"{side}ForeArm")
        hand = add_uv_sphere(f"Body_{side}Hand", (x * 2.68, 0.02, 0.86), (0.065, 0.055, 0.08), skin, 10, 6)
        parent_to_bone(hand, rig, f"{side}Hand")
        leg = add_cylinder(f"Look_{side}Leg", (x * 1.35, 0, 0.63), 0.09, 0.62, look, 10)
        parent_to_bone(leg, rig, f"{side}UpLeg")
        shoe_obj = add_box(f"Shoe_{side}", (x * 1.4, 0.10, 0.10), (0.10, 0.16, 0.07), shoe, 0.035)
        parent_to_bone(shoe_obj, rig, f"{side}Foot")

    scene = bpy.context.scene
    scene.name = "Mall Persona Generic v1"
    scene.render.fps = 24
    scene.frame_start, scene.frame_end = 1, 49
    for obj in scene.objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = rig
    BLEND_PATH.parent.mkdir(parents=True, exist_ok=True)
    EXPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
    bpy.ops.export_scene.gltf(
        filepath=str(EXPORT_PATH), export_format="GLB", export_animations=True,
        export_force_sampling=True, export_frame_range=True, export_apply=True,
        export_image_format="NONE",
    )
    print(f"Created {EXPORT_PATH}")


if __name__ == "__main__":
    main()
