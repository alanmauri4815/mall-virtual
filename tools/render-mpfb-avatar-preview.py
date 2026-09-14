"""Render a quick front review image from an MPFB avatar source file."""

from pathlib import Path
import sys

import bpy
from mathutils import Vector


ROOT = Path.home() / "Documents" / "Mall Virtual Blender"


def look_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def main(source_name, image_name):
    source = ROOT / source_name
    output = ROOT / image_name
    bpy.ops.wm.open_mainfile(filepath=str(source))
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 560
    scene.render.resolution_y = 760
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(output)
    if scene.world is None:
        scene.world = bpy.data.worlds.new("ReviewWorld")
    scene.world.color = (0.04, 0.05, 0.06)

    camera_data = bpy.data.cameras.new("ReviewCamera")
    camera = bpy.data.objects.new("ReviewCamera", camera_data)
    bpy.context.collection.objects.link(camera)
    camera.location = (0.0, -5.6, 1.65)
    camera.data.lens = 58
    look_at(camera, (0.0, 0.0, 1.25))
    scene.camera = camera

    for location, energy, size in [((-3.0, -4.0, 4.5), 1050, 3.0), ((3.0, -3.0, 3.0), 650, 2.5)]:
        light_data = bpy.data.lights.new("ReviewLight", "AREA")
        light_data.energy = energy
        light_data.shape = "DISK"
        light_data.size = size
        light = bpy.data.objects.new("ReviewLight", light_data)
        bpy.context.collection.objects.link(light)
        light.location = location
        look_at(light, (0.0, 0.0, 1.2))

    bpy.ops.render.render(write_still=True)
    print(f"RENDERED {output}")


if __name__ == "__main__":
    args = sys.argv[sys.argv.index("--") + 1 :]
    main(args[0], args[1])
