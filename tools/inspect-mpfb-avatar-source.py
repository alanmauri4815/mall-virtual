"""Print mesh, material and rig counts for an MPFB avatar source."""

from pathlib import Path
import sys
import bpy


root = Path.home() / "Documents" / "Mall Virtual Blender"
name = sys.argv[sys.argv.index("--") + 1]
bpy.ops.wm.open_mainfile(filepath=str(root / name))
meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
rigs = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
print("MESHES", [(obj.name, len(obj.data.vertices), len(obj.data.materials)) for obj in meshes])
print("RIGS", [(obj.name, len(obj.data.bones)) for obj in rigs])
print("ACTIONS", [(action.name, action.frame_range[:]) for action in bpy.data.actions])
