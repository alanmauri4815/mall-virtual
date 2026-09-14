"""Print imported GLB bounds for scale calibration."""

from pathlib import Path
import sys
import bpy
from mathutils import Vector


path = Path(sys.argv[sys.argv.index("--") + 1])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(path))
corners = []
for obj in bpy.context.scene.objects:
    if obj.type != "MESH":
        continue
    corners.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
low = Vector((min(point.x for point in corners), min(point.y for point in corners), min(point.z for point in corners)))
high = Vector((max(point.x for point in corners), max(point.y for point in corners), max(point.z for point in corners)))
print("BOUNDS", tuple(low), tuple(high), "SIZE", tuple(high - low))
