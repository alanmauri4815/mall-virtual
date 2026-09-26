"""Build a portable, clothed avatar from installed MakeHuman assets.

The supplied `Hombre_Caminando.blend` remains untouched. Its animation source
is retained for a proper retargeting pass; this export uses the mall's runtime
locomotion because its rig has different rest-pose axes.
"""

from pathlib import Path
import os
import sys

import bpy
import bmesh


SOURCE_TO_MPFB_BONES = {
    "thigh_l": "upperleg01.L",
    "calf_l": "lowerleg01.L",
    "foot_l": "foot.L",
    "thigh_r": "upperleg01.R",
    "calf_r": "lowerleg01.R",
    "foot_r": "foot.R",
    "upperarm_l": "upperarm01.L",
    "lowerarm_l": "lowerarm01.L",
    "upperarm_r": "upperarm01.R",
    "lowerarm_r": "lowerarm01.R",
    "spine_02": "spine02",
    "spine_03": "spine03",
    "neck_01": "neck01",
}


def argument(index: int) -> Path:
    marker = sys.argv.index("--")
    return Path(sys.argv[marker + index]).resolve()


SOURCE = argument(1)
DESTINATION = argument(2)
MPFB_DATA = (
    Path(os.environ["APPDATA"])
    / "Blender Foundation"
    / "Blender"
    / "5.2"
    / "extensions"
    / ".user"
    / "blender_org"
    / "mpfb"
    / "data"
)


def select_human(human: bpy.types.Object) -> None:
    for obj in bpy.context.selected_objects:
        obj.select_set(False)
    human.select_set(True)
    bpy.context.view_layer.objects.active = human


def append_action(name: str) -> bpy.types.Action:
    with bpy.data.libraries.load(str(SOURCE), link=False) as (source, target):
        if name not in source.actions:
            raise RuntimeError(f"No encontre la accion {name} en {SOURCE.name}")
        target.actions = [name]
    action = bpy.data.actions.get(name)
    if action is None:
        raise RuntimeError(f"No pude cargar la accion {name}")
    action.use_fake_user = True
    return action


def retarget_action(action: bpy.types.Action) -> None:
    """Translate the source rig's bone labels to the MPFB standard rig."""
    for layer in action.layers:
        for strip in layer.strips:
            for channelbag in strip.channelbags:
                for fcurve in channelbag.fcurves:
                    for source_bone, target_bone in SOURCE_TO_MPFB_BONES.items():
                        token = f'pose.bones["{source_bone}"]'
                        if token in fcurve.data_path:
                            fcurve.data_path = fcurve.data_path.replace(
                                token, f'pose.bones["{target_bone}"]'
                            )


def use_flat_material(material: bpy.types.Material, color: tuple[float, float, float, float]) -> None:
    """Use portable opaque colors instead of MakeHuman's Blender-only nodes."""
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    shader.inputs["Base Color"].default_value = color
    shader.inputs["Roughness"].default_value = 0.72
    shader.inputs["Alpha"].default_value = 1.0
    material.node_tree.links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    material.diffuse_color = color
    material.surface_render_method = "DITHERED"


def simplify_materials() -> None:
    palette = {
        "body": (0.58, 0.31, 0.19, 1.0),
        "male_casualsuit01": (0.06, 0.17, 0.29, 1.0),
        "shoes01": (0.07, 0.06, 0.05, 1.0),
        "short04": (0.10, 0.035, 0.015, 1.0),
    }
    for material in bpy.data.materials:
        material_name = material.name.lower()
        for key, color in palette.items():
            if key in material_name:
                use_flat_material(material, color)
                break


def set_male_phenotype(human: bpy.types.Object) -> None:
    """Match the base body to the male garment topology before loading clothes."""
    shape_keys = human.data.shape_keys
    if shape_keys is None:
        return
    for key in shape_keys.key_blocks:
        if key.name.startswith("$md-universal-$fe-"):
            key.value = 0.0
        elif key.name.startswith("$md-universal-$ma-"):
            key.value = 1.0


def remove_hidden_lower_body(human: bpy.types.Object) -> None:
    """Avoid the base mesh showing through the separately weighted trousers."""
    mesh = human.data
    editable = bmesh.new()
    editable.from_mesh(mesh)
    hidden_faces = [
        face for face in editable.faces
        if sum(vertex.co.z for vertex in face.verts) / len(face.verts) < 0.68
    ]
    bmesh.ops.delete(editable, geom=hidden_faces, context="FACES")
    editable.to_mesh(mesh)
    editable.free()


# Build a full-resolution humanoid because the reduced source topology cannot
# accept MakeHuman clothing weights.  This topology supports the bundled assets
# without vertex-index mismatches.
bpy.ops.mpfb.create_human()
human = bpy.data.objects.get("Human")
if human is None:
    raise RuntimeError("MPFB no creo el humano base.")
starter_cube = bpy.data.objects.get("Cube")
if starter_cube is not None:
    bpy.data.objects.remove(starter_cube, do_unlink=True)
set_male_phenotype(human)
select_human(human)
bpy.ops.mpfb.add_standard_rig()
rig = bpy.data.objects.get("Human.rig")
if rig is None:
    raise RuntimeError("MPFB no creo el rig estandar.")

# The supplied Idle and Walk actions target this object name. Keeping it lets
# Blender match their action slots during GLB export while leaving the mesh
# weights and bone hierarchy intact.
rig.name = "MallPersona_Masculino_v1_GameRig"

select_human(human)
bpy.ops.mpfb.load_library_skin(filepath=str(MPFB_DATA / "skins" / "young_caucasian_male" / "young_caucasian_male.mhmat"))
bpy.ops.mpfb.load_clothes(filepath=str(MPFB_DATA / "clothes" / "male_casualsuit01" / "male_casualsuit01.mhclo"))
bpy.ops.mpfb.load_clothes(filepath=str(MPFB_DATA / "clothes" / "shoes01" / "shoes01.mhclo"))
bpy.ops.mpfb.load_clothes(filepath=str(MPFB_DATA / "hair" / "short04" / "short04.mhclo"))
remove_hidden_lower_body(human)
simplify_materials()

# A direct fcurve remap moves the bones but deforms the full MPFB mesh because
# the source rig has different rest-pose axes. The browser applies its own
# lightweight procedural gait to this standard rig until a true retarget pass.
rig.animation_data_clear()
bpy.context.scene.frame_set(1)

# MPFB creates one harmless setup action. It does not belong to the exported
# character and would otherwise show up as a third, unusable GLB animation.
for action in list(bpy.data.actions):
    bpy.data.actions.remove(action)

# Export only the avatar collection. MPFB leaves helper meshes in the scene,
# and selecting every mesh would export those helpers as visible geometry.
for obj in bpy.context.selected_objects:
    obj.select_set(False)
avatar_objects = [human, rig] + [
    obj for obj in bpy.context.scene.objects
    if obj.type == "MESH" and obj.name.startswith(f"{human.name}.")
]
for obj in avatar_objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = rig

DESTINATION.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=str(DESTINATION),
    export_format="GLB",
    use_selection=True,
    export_materials="EXPORT",
    export_image_format="WEBP",
    export_image_quality=72,
    export_animations=False,
    export_animation_mode="ACTIONS",
    export_bake_animation=True,
    export_optimize_animation_size=True,
    export_anim_single_armature=True,
    export_yup=True,
)

print(f"Exported {DESTINATION}")
