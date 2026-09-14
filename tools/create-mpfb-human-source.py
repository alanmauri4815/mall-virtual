"""Create a reviewable MPFB human source without changing the mall runtime asset."""

from pathlib import Path

import bpy
import addon_utils


OUTPUT = Path.home() / "Documents" / "Mall Virtual Blender" / "mall-persona-human-base-v1.blend"


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    addon_utils.enable("bl_ext.blender_org.mpfb", default_set=True, persistent=True)

    from bl_ext.blender_org.mpfb.services import HumanService, TargetService

    macro = TargetService.get_default_macro_info_dict()
    macro["gender"] = 0.68
    macro["age"] = 0.52
    macro["height"] = 0.54
    macro["weight"] = 0.48
    macro["muscle"] = 0.5
    macro["proportions"] = 0.52
    macro["race"] = {"african": 0.34, "asian": 0.28, "caucasian": 0.38}

    human = HumanService.create_human(
        mask_helpers=True,
        detailed_helpers=False,
        extra_vertex_groups=True,
        feet_on_ground=True,
        scale=1.0,
        macro_detail_dict=macro,
    )
    human.name = "MallPersona_Human_Base"
    human.data.name = "MallPersona_Human_Base"
    human.use_shape_key_edit_mode = True
    rig = HumanService.add_builtin_rig(human, "game_engine", import_weights=True)
    if not rig:
        raise RuntimeError("MPFB could not create the game engine rig.")
    rig.name = rig.data.name = "MallPersona_GameRig"

    scene = bpy.context.scene
    scene.name = "Mall Persona Human Base v1"
    scene["asset_license"] = "CC0 MakeHuman Community core assets"
    scene["intended_use"] = "Review source for lightweight generic mall avatars"
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT))
    print(f"Saved {OUTPUT}")
    print(f"Vertices: {len(human.data.vertices)}")
    print(f"Bones: {[bone.name for bone in rig.pose.bones]}")


if __name__ == "__main__":
    main()
