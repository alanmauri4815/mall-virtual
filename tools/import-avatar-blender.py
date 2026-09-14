"""Create the editable Blender source file for the mall assistant avatar."""

from pathlib import Path

import bpy


WORKSPACE = Path(r"C:\Users\javii\Downloads\Web Tienda Virtual")
SOURCE_GLB = WORKSPACE / "assets" / "avatars" / "model.glb"
OUTPUT_BLEND = Path.home() / "Documents" / "Mall Virtual Blender" / "mall-avatar-source.blend"


if not SOURCE_GLB.is_file():
    raise FileNotFoundError(f"Avatar source was not found: {SOURCE_GLB}")

OUTPUT_BLEND.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(SOURCE_GLB))

scene = bpy.context.scene
scene.name = "Mall Avatar Source"
scene["source_asset"] = str(SOURCE_GLB)
scene["runtime_asset"] = "assets/avatars/mall-avatar-v1.glb"
scene["intended_use"] = "Mall information assistant and future moving NPC variants"

bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT_BLEND))
print(f"Saved editable avatar source: {OUTPUT_BLEND}")
