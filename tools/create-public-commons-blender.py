"""Build the lightweight Blender source and GLB for the mall public commons."""

from math import cos, pi, sin
from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parents[1]
ASSET_PATH = ROOT / "assets" / "models" / "mall-public-commons-v1.glb"
BLEND_PATH = ROOT / "assets" / "blender" / "mall-public-commons-v1.blend"


def make_material(name, color, metallic=0.0, roughness=0.5, emission=None, emission_strength=1.4):
    material = bpy.data.materials.new(name)
    material.diffuse_color = (*color, 1.0)
    material.use_nodes = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1.0)
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = roughness
    if emission:
        if "Emission Color" in shader.inputs:
            shader.inputs["Emission Color"].default_value = (*emission, 1.0)
            shader.inputs["Emission Strength"].default_value = emission_strength
        else:
            shader.inputs["Emission"].default_value = (*emission, 1.0)
            shader.inputs["Emission Strength"].default_value = emission_strength
    return material


def add_box(name, x, y, z, width, depth, height, material, bevel=0.0, rotation=0.0):
    bpy.ops.mesh.primitive_cube_add(location=(x, y, z))
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = (width, depth, height)
    obj.rotation_euler[2] = rotation
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        modifier = obj.modifiers.new("Soft architectural edge", "BEVEL")
        modifier.width = bevel
        modifier.segments = 1
    obj.data.materials.append(material)
    return obj


def add_cylinder(name, x, y, z, radius, depth, material, vertices=16):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=(x, y, z))
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    return obj


def add_uv_sphere(name, x, y, z, radius, material, squash=(1.0, 1.0, 1.0)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=radius, location=(x, y, z))
    obj = bpy.context.object
    obj.name = name
    obj.scale = squash
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    return obj


def add_torus(name, x, y, z, major_radius, minor_radius, material):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_radius,
        minor_radius=minor_radius,
        major_segments=32,
        minor_segments=6,
        location=(x, y, z),
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    return obj


def create_lounge(x, y, rotation, materials, index):
    stone, wood, bronze, soil, leaf_light, leaf_dark = materials
    add_cylinder(f"Lounge {index} terrazzo planter", x, y, 0.45, 1.28, 0.76, stone, 20)
    add_cylinder(f"Lounge {index} brass planter rim", x, y, 0.85, 1.32, 0.08, bronze, 20)
    add_cylinder(f"Lounge {index} planted soil", x, y, 0.86, 1.18, 0.06, soil, 20)

    foliage = [
        (-0.42, -0.28, 1.18, 1.0),
        (0.38, -0.32, 1.28, 0.92),
        (0.48, 0.36, 1.12, 0.78),
        (-0.34, 0.42, 1.35, 0.9),
        (0.0, 0.0, 1.58, 1.08),
    ]
    for leaf_index, (local_x, local_y, height, scale) in enumerate(foliage):
        world_x = x + local_x * cos(rotation) - local_y * sin(rotation)
        world_y = y + local_x * sin(rotation) + local_y * cos(rotation)
        add_uv_sphere(
            f"Lounge {index} foliage {leaf_index}",
            world_x,
            world_y,
            height,
            0.56 * scale,
            leaf_light if leaf_index % 2 else leaf_dark,
            (1.0, 1.0, 0.72),
        )

    # Five repeated bench segments give the planter a relaxed, social seating ring.
    for seat_index, angle in enumerate((-0.55, 0.25, 1.05, 1.85, 2.65)):
        final_angle = angle + rotation
        radius = 2.12
        seat_x = x + cos(final_angle) * radius
        seat_y = y + sin(final_angle) * radius
        add_box(
            f"Lounge {index} oak bench {seat_index}",
            seat_x,
            seat_y,
            0.48,
            1.48,
            0.58,
            0.20,
            wood,
            bevel=0.06,
            rotation=final_angle + pi / 2,
        )
        leg_offset_x = cos(final_angle + pi / 2) * 0.47
        leg_offset_y = sin(final_angle + pi / 2) * 0.47
        for sign in (-1, 1):
            add_box(
                f"Lounge {index} brass bench leg {seat_index}-{sign}",
                seat_x + leg_offset_x * sign,
                seat_y + leg_offset_y * sign,
                0.25,
                0.08,
                0.34,
                0.38,
                bronze,
                bevel=0.02,
                rotation=final_angle + pi / 2,
            )


def create_lighting(materials):
    bronze, pink, aqua = materials
    add_torus("Atrium brass pendant outer ring", 0, 0, 11.8, 4.2, 0.09, bronze)
    add_torus("Atrium pink pendant ring", 0, 0, 11.73, 3.92, 0.055, pink)
    for index, angle in enumerate((0, pi / 2, pi, pi * 1.5)):
        x = cos(angle) * 4.2
        y = sin(angle) * 4.2
        add_cylinder(f"Atrium pendant suspension {index}", x, y, 16.5, 0.035, 9.4, bronze, 8)
    for index, (x, y) in enumerate(((7.6, 0), (-7.6, 0), (0, 7.6), (0, -7.6))):
        add_cylinder(f"Atrium satellite pendant {index}", x, y, 9.8, 0.36, 0.12, aqua if index % 2 else pink, 16)
        add_torus(f"Atrium satellite brass ring {index}", x, y, 9.88, 0.42, 0.035, bronze)
        add_cylinder(f"Atrium satellite cable {index}", x, y, 14.5, 0.025, 9.3, bronze, 8)


def join_material_batches(root):
    grouped = {}
    for obj in list(bpy.context.scene.objects):
        if obj.type != "MESH":
            continue
        material = obj.active_material
        grouped.setdefault(material.name if material else "unassigned", []).append(obj)

    bpy.ops.object.select_all(action="DESELECT")
    for material_name, objects in grouped.items():
        for obj in objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        bpy.ops.object.convert(target="MESH")
        bpy.ops.object.join()
        merged = bpy.context.object
        merged.name = f"PublicCommons_{material_name}"
        merged.parent = root
        bpy.ops.object.select_all(action="DESELECT")


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    ASSET_PATH.parent.mkdir(parents=True, exist_ok=True)
    BLEND_PATH.parent.mkdir(parents=True, exist_ok=True)

    root = bpy.data.objects.new("Mall public commons v1", None)
    root["asset_role"] = "public-atrium-furniture"
    root["optimized"] = True
    bpy.context.collection.objects.link(root)

    terrazzo = make_material("Terrazzo warm gray", (0.62, 0.60, 0.56), roughness=0.5)
    oak = make_material("Oak seating", (0.28, 0.16, 0.07), roughness=0.36)
    brass = make_material("Brushed brass", (0.52, 0.32, 0.10), metallic=0.82, roughness=0.24)
    soil = make_material("Planter soil", (0.08, 0.045, 0.018), roughness=0.9)
    leaf_light = make_material("Foliage olive", (0.18, 0.35, 0.13), roughness=0.82)
    leaf_dark = make_material("Foliage forest", (0.055, 0.16, 0.06), roughness=0.86)
    pink = make_material("Neon magenta", (0.96, 0.15, 0.58), roughness=0.25, emission=(1.0, 0.02, 0.24), emission_strength=3.2)
    aqua = make_material("Neon aqua", (0.05, 0.84, 0.58), roughness=0.22, emission=(0.0, 0.72, 0.36), emission_strength=2.8)

    lounges = [
        (11.8, 11.8, pi * 0.25),
        (-11.8, 11.8, pi * 0.75),
        (-11.8, -11.8, pi * 1.25),
        (11.8, -11.8, pi * 1.75),
    ]
    for index, (x, y, rotation) in enumerate(lounges, start=1):
        create_lounge(x, y, rotation, (terrazzo, oak, brass, soil, leaf_light, leaf_dark), index)
    create_lighting((brass, pink, aqua))
    join_material_batches(root)

    bpy.context.scene["asset"] = "Mall public commons v2"
    bpy.context.scene["triage"] = "low-poly PBR, emissive lighting, no external textures"
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
    bpy.ops.export_scene.gltf(
        filepath=str(ASSET_PATH),
        export_format="GLB",
        export_apply=True,
        export_materials="EXPORT",
        export_normals=True,
        export_tangents=False,
        export_yup=True,
    )
    print(f"EXPORTED {ASSET_PATH}")


if __name__ == "__main__":
    main()
