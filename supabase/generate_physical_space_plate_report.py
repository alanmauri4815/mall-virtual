from __future__ import annotations

import csv
import pathlib
import re
from collections import Counter


ROOT = pathlib.Path(r"C:\Users\javii\Downloads\Web Tienda Virtual")
INDEX_HTML = ROOT / "index.html"
BOOTSTRAP_SQL = ROOT / "supabase" / "physical_spaces_bootstrap_20260520.sql"
CSV_OUT = ROOT / "supabase" / "physical_space_plate_report.csv"
MD_OUT = ROOT / "supabase" / "physical_space_plate_report.md"


def extract_js_map(source: str, const_name: str) -> dict[str, str]:
    pattern = rf"const {re.escape(const_name)} = \{{(.*?)\n\s*\}};"
    match = re.search(pattern, source, re.S)
    if not match:
        raise RuntimeError(f"No encontré el bloque {const_name} en index.html")
    block = match.group(1)
    return {
        key: value
        for key, value in re.findall(r"\s*([A-Za-z0-9_]+):\s*'([^']+)'", block)
    }


ROW_RE = re.compile(
    r"\('(?P<physical_space_id>[^']+)',\s*'(?P<kind>[^']+)',\s*'(?P<floor_label>[^']+)',\s*"
    r"'(?P<axis>[^']*)',\s*'(?P<quadrant>[^']*)',\s*(?P<slot_index>\d+),\s*"
    r"'(?P<source_code>[^']*)',\s*'(?P<display_code>[^']*)',\s*"
    r"(?P<x1>-?\d+(?:\.\d+)?),\s*(?P<z1>-?\d+(?:\.\d+)?),\s*"
    r"(?P<x2>-?\d+(?:\.\d+)?),\s*(?P<z2>-?\d+(?:\.\d+)?),\s*"
    r"(?P<x3>-?\d+(?:\.\d+)?),\s*(?P<z3>-?\d+(?:\.\d+)?),\s*"
    r"(?P<x4>-?\d+(?:\.\d+)?),\s*(?P<z4>-?\d+(?:\.\d+)?),\s*"
    r"(?P<y1>-?\d+(?:\.\d+)?),\s*(?P<y2>-?\d+(?:\.\d+)?),\s*"
    r"'(?P<inventory_status>[^']+)',\s*'(?P<inventory_notes>[^']*)'\)"
)


def parse_bootstrap_rows(source: str) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for match in ROW_RE.finditer(source):
        row = match.groupdict()
        rows.append(row)
    if not rows:
        raise RuntimeError("No pude extraer filas de physical_spaces_bootstrap_20260520.sql")
    return rows


def sector_to_signs(quadrant: str) -> tuple[int, int]:
    sx = 1 if "xp" in quadrant else -1
    sz = 1 if "zp" in quadrant else -1
    return sx, sz


def compute_generated_code(row: dict[str, str]) -> str:
    kind = row["kind"]
    if kind == "anchor":
        return row["source_code"] or row["display_code"] or row["physical_space_id"]

    floor_num = row["floor_label"]
    axis = row["axis"]
    slot = int(row["slot_index"])
    sx, sz = sector_to_signs(row["quadrant"])
    wing_h = "N" if sz > 0 else "S"
    wing_v = "O" if sx > 0 else "E"
    prefix = wing_h if axis == "horizontal" else wing_v
    return f"{prefix}{floor_num}{slot:02d}"


def coordinates_summary(row: dict[str, str]) -> str:
    return (
        f"({row['x1']},{row['z1']}) | ({row['x2']},{row['z2']}) | "
        f"({row['x3']},{row['z3']}) | ({row['x4']},{row['z4']}) | y:{row['y1']}-{row['y2']}"
    )


def build_rows() -> list[dict[str, str]]:
    index_source = INDEX_HTML.read_text(encoding="utf-8", errors="ignore")
    sql_source = BOOTSTRAP_SQL.read_text(encoding="utf-8", errors="ignore")

    store_code_renames = extract_js_map(index_source, "STORE_CODE_RENAMES")
    plate_overrides = extract_js_map(index_source, "PHYSICAL_SPACE_PLATE_OVERRIDES")
    bootstrap_rows = parse_bootstrap_rows(sql_source)

    report_rows: list[dict[str, str]] = []
    for row in bootstrap_rows:
        generated_code = compute_generated_code(row)
        renamed_code = store_code_renames.get(generated_code, generated_code)
        plate_code_3d = plate_overrides.get(row["physical_space_id"], renamed_code)
        display_code_supabase = row["display_code"]
        source_code_supabase = row["source_code"]
        status = "MATCH" if plate_code_3d == display_code_supabase else "MISMATCH"
        report_rows.append(
            {
                "physical_space_id": row["physical_space_id"],
                "kind": row["kind"],
                "floor_label": row["floor_label"],
                "axis": row["axis"],
                "quadrant": row["quadrant"],
                "slot_index": row["slot_index"],
                "source_code_supabase": source_code_supabase,
                "display_code_supabase": display_code_supabase,
                "generated_code_3d": generated_code,
                "renamed_code_3d": renamed_code,
                "plate_code_3d": plate_code_3d,
                "inventory_status": row["inventory_status"],
                "coordinates": coordinates_summary(row),
                "status": status,
            }
        )
    report_rows.sort(
        key=lambda r: (
            0 if r["kind"] == "anchor" else 1,
            r["floor_label"],
            r["quadrant"],
            r["axis"],
            int(r["slot_index"]),
            r["physical_space_id"],
        )
    )
    return report_rows


def write_csv(rows: list[dict[str, str]]) -> None:
    fieldnames = [
        "physical_space_id",
        "kind",
        "floor_label",
        "axis",
        "quadrant",
        "slot_index",
        "source_code_supabase",
        "display_code_supabase",
        "generated_code_3d",
        "renamed_code_3d",
        "plate_code_3d",
        "inventory_status",
        "coordinates",
        "status",
    ]
    with CSV_OUT.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def write_markdown(rows: list[dict[str, str]]) -> None:
    mismatch_rows = [row for row in rows if row["status"] == "MISMATCH"]
    floor_counter = Counter(row["floor_label"] for row in mismatch_rows)
    kind_counter = Counter(row["kind"] for row in mismatch_rows)

    lines = [
        "# Reporte de placas físicas vs Supabase",
        "",
        f"- Total espacios revisados: **{len(rows)}**",
        f"- Total mismatches entre `plate_code_3d` y `display_code_supabase`: **{len(mismatch_rows)}**",
        "",
        "## Resumen de mismatches por piso",
        "",
    ]
    if floor_counter:
        for floor, count in sorted(floor_counter.items()):
            lines.append(f"- Piso `{floor}`: {count}")
    else:
        lines.append("- Sin mismatches")

    lines.extend(
        [
            "",
            "## Resumen de mismatches por tipo",
            "",
        ]
    )
    if kind_counter:
        for kind, count in sorted(kind_counter.items()):
            lines.append(f"- `{kind}`: {count}")
    else:
        lines.append("- Sin mismatches")

    lines.extend(
        [
            "",
            "## Primeros mismatches detectados",
            "",
            "| physical_space_id | floor | source_code | display_code_supabase | generated_code_3d | renamed_code_3d | plate_code_3d |",
            "| --- | --- | --- | --- | --- | --- | --- |",
        ]
    )
    for row in mismatch_rows[:40]:
        lines.append(
            f"| {row['physical_space_id']} | {row['floor_label']} | {row['source_code_supabase']} | "
            f"{row['display_code_supabase']} | {row['generated_code_3d']} | {row['renamed_code_3d']} | {row['plate_code_3d']} |"
        )

    lines.extend(
        [
            "",
            "## Archivos generados",
            "",
            f"- CSV completo: `{CSV_OUT.name}`",
            f"- Este resumen: `{MD_OUT.name}`",
        ]
    )

    MD_OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    rows = build_rows()
    write_csv(rows)
    write_markdown(rows)
    print(f"CSV: {CSV_OUT}")
    print(f"MD: {MD_OUT}")
    print(f"Total rows: {len(rows)}")
    print(f"Mismatches: {sum(1 for row in rows if row['status'] == 'MISMATCH')}")


if __name__ == "__main__":
    main()
