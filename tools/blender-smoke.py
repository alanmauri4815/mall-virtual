from pathlib import Path

Path.home().joinpath("Documents", "Mall Virtual Blender", "blender-smoke.log").write_text(
    "Blender executed this script.\n", encoding="utf-8"
)
