"""Build two review-ready MPFB avatar sources from the installed CC0 asset pack.

These .blend files are deliberately separate from the web runtime. They let us
approve the character direction before producing optimized GLB files.
"""

from pathlib import Path

import addon_utils
import bpy


MPFB_DATA = (
    Path.home()
    / "AppData/Roaming/Blender Foundation/Blender/5.2/extensions/.user"
    / "blender_org/mpfb/data"
)
OUTPUT_DIR = Path.home() / "Documents" / "Mall Virtual Blender"
LOG_FILE = OUTPUT_DIR / "mpfb-avatar-build.log"


def log(message):
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with LOG_FILE.open("a", encoding="utf-8") as handle:
        handle.write(f"{message}\n")


def asset(*parts):
    return str(MPFB_DATA.joinpath(*parts))


def add_asset(HumanService, human, path, asset_type):
    HumanService.add_mhclo_asset(
        path,
        human,
        asset_type=asset_type,
        subdiv_levels=0,
        material_type="MAKESKIN",
        set_up_rigging=True,
        interpolate_weights=True,
        import_subrig=True,
        import_weights=True,
    )


def build_avatar(label, gender, skin, hair, clothes, shoes, eye_color):
    log(f"Starting {label}")
    bpy.ops.wm.read_factory_settings(use_empty=True)
    addon_utils.enable("bl_ext.blender_org.mpfb", default_set=True, persistent=True)
    from bl_ext.blender_org.mpfb.services import HumanService, TargetService

    macro = TargetService.get_default_macro_info_dict()
    macro.update(
        {
            "gender": gender,
            "age": 0.52,
            "height": 0.53,
            "weight": 0.48,
            "muscle": 0.48,
            "proportions": 0.52,
            "race": {"african": 0.34, "asian": 0.28, "caucasian": 0.38},
        }
    )
    human = HumanService.create_human(
        mask_helpers=True,
        detailed_helpers=False,
        extra_vertex_groups=True,
        feet_on_ground=True,
        scale=1.0,
        macro_detail_dict=macro,
    )
    log(f"Created base mesh for {label}")
    human.name = human.data.name = label
    HumanService.set_character_skin(skin, human, skin_type="MAKESKIN")
    # Add the game rig before clothing so MPFB transfers its vertex weights to
    # every fitted asset rather than exporting them as static child meshes.
    rig = HumanService.add_builtin_rig(human, "game_engine", import_weights=True)
    if not rig:
        raise RuntimeError(f"Could not add game-engine rig to {label}")
    rig.name = rig.data.name = f"{label}_GameRig"
    log(f"Added rig for {label}")
    log(f"Applied skin for {label}")
    add_asset(HumanService, human, hair, "Hair")
    log(f"Applied hair for {label}")
    add_asset(HumanService, human, clothes, "Clothes")
    log(f"Applied clothing for {label}")
    add_asset(HumanService, human, shoes, "Clothes")
    log(f"Applied shoes for {label}")
    add_asset(HumanService, human, asset("eyes", "low-poly", "low-poly.mhclo"), "Eyes")
    log(f"Applied eyes for {label}")

    # The eye material is applied to the loaded eyes object by asset material data.

    scene = bpy.context.scene
    scene.name = f"Mall Persona {label}"
    scene["asset_license"] = "CC0 MakeHuman Community core assets"
    scene["intended_use"] = "Review source for a lightweight generic mall avatar"
    scene["eye_color_reference"] = eye_color
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output = OUTPUT_DIR / f"{label.lower()}.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(output))
    log(f"Saved {output}")
    print(f"SAVED {output}")


def main():
    if LOG_FILE.exists():
        LOG_FILE.unlink()
    build_avatar(
        "MallPersona_Masculino_v1",
        1.0,
        asset("skins", "middleage_caucasian_male", "middleage_caucasian_male.mhmat"),
        asset("hair", "short04", "short04.mhclo"),
        asset("clothes", "male_casualsuit02", "male_casualsuit02.mhclo"),
        asset("clothes", "shoes06", "shoes06.mhclo"),
        "brown",
    )
    build_avatar(
        "MallPersona_Femenino_v1",
        0.0,
        asset("skins", "middleage_african_female", "middleage_african_female.mhmat"),
        asset("hair", "bob02", "bob02.mhclo"),
        asset("clothes", "female_casualsuit02", "female_casualsuit02.mhclo"),
        asset("clothes", "shoes05", "shoes05.mhclo"),
        "brown",
    )


if __name__ == "__main__":
    main()
