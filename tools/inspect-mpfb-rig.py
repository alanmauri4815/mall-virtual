from pathlib import Path
import sys
import bpy

root = Path.home() / "Documents" / "Mall Virtual Blender"
name = sys.argv[sys.argv.index("--") + 1]
bpy.ops.wm.open_mainfile(filepath=str(root / name))
for armature in (obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"):
    print(armature.name)
    print("\n".join(bone.name for bone in armature.data.bones))
