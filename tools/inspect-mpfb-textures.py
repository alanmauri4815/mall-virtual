from pathlib import Path
import sys
import bpy

root = Path.home() / "Documents" / "Mall Virtual Blender"
name = sys.argv[sys.argv.index("--") + 1]
bpy.ops.wm.open_mainfile(filepath=str(root / name))
for image in bpy.data.images:
    if image.size[0] and image.size[1]:
        print(image.name, tuple(image.size), image.filepath)
