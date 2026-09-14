"""Render a review image from the editable public-commons Blender source."""

from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "blender" / "mall-public-commons-v1.blend"
OUTPUT = ROOT / "tmp-public-commons-preview.png"


def look_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
scene = bpy.context.scene
scene.render.engine = "BLENDER_WORKBENCH"
scene.render.resolution_x = 1280
scene.render.resolution_y = 720
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = str(OUTPUT)
scene.render.film_transparent = False
scene.display.shading.light = "STUDIO"
scene.display.shading.color_type = "MATERIAL"
scene.display.shading.show_shadows = True
scene.display.shading.show_cavity = True
if scene.world is None:
    scene.world = bpy.data.worlds.new("Preview world")
scene.world.color = (0.035, 0.045, 0.065)

bpy.ops.mesh.primitive_plane_add(size=80, location=(0, 0, 0))
floor = bpy.context.object
floor.name = "Preview terrazzo floor"
floor_material = bpy.data.materials.new("Preview terrazzo")
floor_material.diffuse_color = (0.2, 0.22, 0.24, 1.0)
floor.data.materials.append(floor_material)

bpy.ops.object.light_add(type="AREA", location=(0, -3, 19))
key = bpy.context.object
key.data.energy = 1700
key.data.shape = "DISK"
key.data.size = 16

bpy.ops.object.light_add(type="AREA", location=(-18, -12, 10))
fill = bpy.context.object
fill.data.energy = 900
fill.data.color = (0.55, 0.72, 1.0)
fill.data.size = 10
look_at(fill, (0, 0, 2))

bpy.ops.object.light_add(type="AREA", location=(18, 10, 9))
rim = bpy.context.object
rim.data.energy = 1200
rim.data.color = (1.0, 0.5, 0.18)
rim.data.size = 8
look_at(rim, (0, 0, 2))

bpy.ops.object.camera_add(location=(0, -42, 31))
camera = bpy.context.object
camera.data.lens = 38
look_at(camera, (0, 0, 3.8))
scene.camera = camera

bpy.ops.render.render(write_still=True)
print(f"RENDERED {OUTPUT}")
