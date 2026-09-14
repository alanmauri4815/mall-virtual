"""Export one MPFB review source as an embedded GLB for browser testing."""

from pathlib import Path
import sys

import bpy
from mathutils.kdtree import KDTree


SOURCE_ROOT = Path.home() / "Documents" / "Mall Virtual Blender"
PROJECT_ROOT = Path(__file__).resolve().parents[1]
MAX_TEXTURE_EDGE = 512
LOG_PATH = Path.home() / "Documents" / "Mall Virtual Blender" / "mpfb-export.log"


def log(message):
    with LOG_PATH.open("a", encoding="utf-8") as handle:
        handle.write(f"{message}\n")


def main(source_name, output_name):
    LOG_PATH.write_text("", encoding="utf-8")
    log(f"Opening {source_name}")
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE_ROOT / source_name))
    # Keep the source blend untouched, but reduce delivery textures to a size
    # appropriate for a distant multiplayer avatar.
    texture_dir = Path.home() / "AppData" / "Local" / "Temp" / "mall-avatar-export-textures"
    texture_dir.mkdir(parents=True, exist_ok=True)
    for index, image in enumerate(bpy.data.images):
        width, height = image.size
        largest_edge = max(width, height)
        if largest_edge > MAX_TEXTURE_EDGE:
            scale = MAX_TEXTURE_EDGE / largest_edge
            image.scale(round(width * scale), round(height * scale))
            # The glTF exporter otherwise reads the original image from disk.
            image.filepath_raw = str(texture_dir / f"{index:02d}-{image.name}.png")
            image.file_format = "PNG"
            image.save()
            image.pack()
    bpy.ops.object.select_all(action="DESELECT")
    rig = next(obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE")
    body = next(
        obj for obj in bpy.context.scene.objects
        if obj.type == "MESH" and any(mod.type == "ARMATURE" and mod.object == rig for mod in obj.modifiers)
    )
    bone_names = {bone.name for bone in rig.pose.bones}
    group_names = {group.index: group.name for group in body.vertex_groups if group.name in bone_names}
    body_weights = []
    lookup = KDTree(len(body.data.vertices))
    for vertex in body.data.vertices:
        lookup.insert(body.matrix_world @ vertex.co, vertex.index)
        body_weights.append({
            group_names[item.group]: item.weight
            for item in vertex.groups if item.group in group_names
        })
    lookup.balance()
    log("Prepared body weight lookup")
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    for obj in bpy.context.scene.objects:
        if obj.type == "MESH":
            # MPFB gives clothes, hair and eyes their own vertex groups. Attach
            # each one to the game rig so glTF exports a skin for every mesh.
            if obj != body and len(obj.vertex_groups) == 0:
                # Fitted MPFB assets are positioned around the body but some
                # packs omit armature weights. Transfer them from the nearest
                # body vertices so each object follows the same skeleton.
                groups = {}
                for vertex in obj.data.vertices:
                    _, nearest_index, _ = lookup.find(obj.matrix_world @ vertex.co)
                    for name, weight in body_weights[nearest_index].items():
                        group = groups.get(name)
                        if group is None:
                            group = obj.vertex_groups.new(name=name)
                            groups[name] = group
                        group.add([vertex.index], weight, "REPLACE")
                log(f"Transferred weights to {obj.name}")
            if not any(mod.type == "ARMATURE" for mod in obj.modifiers):
                modifier = obj.modifiers.new(name="MallPersonaGameRig", type="ARMATURE")
                modifier.object = rig
            world_matrix = obj.matrix_world.copy()
            obj.parent = rig
            obj.matrix_world = world_matrix
            # Facial blend shapes account for most of the transfer size and are
            # not used by the mall's idle/walk animation.
            if obj.data.shape_keys:
                bpy.context.view_layer.objects.active = obj
                obj.select_set(True)
                bpy.ops.object.shape_key_remove(all=True)
            obj.select_set(True)
    log("Prepared selected meshes")
    output = PROJECT_ROOT / "assets" / "avatars" / output_name
    bpy.ops.export_scene.gltf(
        filepath=str(output),
        export_format="GLB",
        use_selection=True,
        export_animations=True,
        export_force_sampling=True,
        export_yup=True,
        export_image_format="WEBP",
        export_image_quality=55,
    )
    log(f"Exported {output}")
    print(f"EXPORTED {output}")


if __name__ == "__main__":
    args = sys.argv[sys.argv.index("--") + 1 :]
    main(args[0], args[1])
