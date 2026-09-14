from pathlib import Path
import sys
import bpy

root = Path.home() / "Documents" / "Mall Virtual Blender"
name = sys.argv[sys.argv.index("--") + 1]
bpy.ops.wm.open_mainfile(filepath=str(root / name))
lines = []
for obj in (item for item in bpy.context.scene.objects if item.type == "MESH"):
    lines.append(str((obj.name, obj.parent.name if obj.parent else None, [(mod.type, getattr(mod, 'object', None).name if getattr(mod, 'object', None) else None) for mod in obj.modifiers], [group.name for group in obj.vertex_groups][:12])))
report = "\n".join(lines)
print(report)
(root / "mpfb-bindings-report.txt").write_text(report, encoding="utf-8")
