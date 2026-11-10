"""
Read activities.csv straight out of the newest Strava export zip.

This is the "extract" half of extract & load. It deliberately does very little:
  - find the (single) export in data/raw/
  - read activities.csv without unzipping anything to disk
  - make the column names safe for BigQuery
  - keep every value as text

Cleaning, typing and filtering (e.g. runs only) happen later in dbt.
Keeping the raw layer as close to the source as possible means we can always
rebuild everything downstream if we change our minds about a transformation.
"""

import csv
import io
import re
import zipfile
from pathlib import Path

RAW_DIR = Path(__file__).resolve().parent.parent / "data" / "raw"


def find_export(raw_dir: Path = RAW_DIR) -> Path:
    """
    Return the single export zip in data/raw/.

    Every Strava export contains the full history, so only the newest one
    matters. Rather than guessing which is newest (file timestamps change
    whenever a file is copied or re-downloaded), we require exactly one zip
    and stop loudly otherwise. Same input every time -> same output every
    time. That's what keeps the pipeline idempotent.
    """
    zips = list(raw_dir.glob("*.zip"))
    if len(zips) != 1:
        found = ", ".join(z.name for z in zips) or "none"
        raise SystemExit(
            f"Expected exactly 1 export zip in {raw_dir}, found {len(zips)} ({found}).\n"
            "Keep only the newest Strava export and run again."
        )
    return zips[0]


def clean_column_names(headers: list[str]) -> list[str]:
    """
    Turn Strava's headers into BigQuery-friendly snake_case names.

    "Activity Date" -> "activity_date"

    Strava repeats some headers (e.g. two "Distance" columns in different
    units). BigQuery doesn't allow duplicate column names, so the second
    one gets a suffix: "distance", "distance_2". Working out which is which
    is a job for the dbt staging layer.
    """
    cleaned = []
    seen: dict[str, int] = {}
    for header in headers:
        name = re.sub(r"[^a-z0-9]+", "_", header.strip().lower()).strip("_")
        seen[name] = seen.get(name, 0) + 1
        cleaned.append(name if seen[name] == 1 else f"{name}_{seen[name]}")
    return cleaned


def read_activities(zip_path: Path) -> list[dict[str, str]]:
    """Read activities.csv from the zip and return one dict per activity."""
    with zipfile.ZipFile(zip_path) as zf:
        with zf.open("activities.csv") as f:
            reader = csv.reader(io.TextIOWrapper(f, encoding="utf-8"))
            columns = clean_column_names(next(reader))
            return [dict(zip(columns, row)) for row in reader]


if __name__ == "__main__":
    # Quick check: run `python extract/activities.py` to see what was read.
    export = find_export()
    activities = read_activities(export)

    print(f"Export:     {export.name}")
    print(f"Activities: {len(activities)}")
    print(f"Columns:    {len(activities[0])}")
    print("\nRenamed duplicate columns:")
    for col in activities[0]:
        if re.search(r"_\d+$", col):
            print(f"  {col}")
