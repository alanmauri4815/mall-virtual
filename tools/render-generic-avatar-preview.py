"""Render a quick studio preview of Mall Persona without modifying its source file."""

from pathlib import Path
import math

import bpy
from mathutils import Vector


SOURCE = Path.home() / "Documents" / "Mall Virtual Blender" / "mall-generic-avatar-v1.blend"
OUTPUT = Path.home() / "Documents" / "Mall Virtual Blender" / "mall-generic-avatar-v1-preview.png"


def point_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()


bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
scene = bpy.context.scene
for obj in list(scene.objects):
    if obj.type in {'CAMERA', 'LIGHT'}:
        bpy.data.objects.remove(obj, do_unlink=True)

bpy.ops.object.camera_add(location=(0, 5.2, 1.42))
camera = bpy.context.object
point_at(camera, (0, 0, 1.05))
scene.camera = camera
camera.data.lens = 58

for location, energy, size in [((3.4, 3.4, 4.5), 950, 3.0), ((-3.5, 2.0, 2.8), 650, 2.0), ((0, -2.5, 3.2), 450, 2.0)]:
    bpy.ops.object.light_add(type='AREA', location=location)
    light = bpy.context.object
    light.data.energy = energy
    light.data.shape = 'DISK'
    light.data.size = size
    point_at(light, (0, 0, 1.0))

bpy.ops.mesh.primitive_plane_add(size=20, location=(0, 0, 0))
floor = bpy.context.object
floor.data.materials.append(bpy.data.materials.new('Preview floor'))
floor.data.materials[0].diffuse_color = (0.055, 0.065, 0.075, 1)

scene.render.engine = 'BLENDER_EEVEE_NEXT'
scene.render.resolution_x = 600
scene.render.resolution_y = 720
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = str(OUTPUT)
scene.world.color = (0.018, 0.025, 0.035)
bpy.ops.render.render(write_still=True)
print(f'Rendered {OUTPUT}')
