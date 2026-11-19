"""
Run the whole pipeline with one command:

    python pipeline.py

  1. Load    extract/load.py        Strava zip -> BigQuery raw tables
  2. Build   dbt build              staging -> marts, with every test
  3. Export  export/export_data.py  marts -> docs/data.json (the website's data)

Each step only runs if the one before it succeeded. If a dbt test fails,
the export never runs, so the public site keeps its last good data instead
of showing wrong numbers.

The one step that can't be automated is downloading the export from
Strava (scripting a login would break Strava's terms), so the routine is:
request the export, drop the zip into data/raw/, run this, commit and push.
"""

import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PYTHON = sys.executable
# dbt lives next to this Python (inside the venv), so we never pick up a
# different, globally installed dbt by accident.
DBT = str(Path(PYTHON).parent / "dbt")

STEPS = [
    ("Load the Strava export into BigQuery", [PYTHON, "extract/load.py"], ROOT),
    ("Build and test the dbt models", [DBT, "build"], ROOT / "strava_dbt"),
    ("Export the marts to docs/data.json", [PYTHON, "export/export_data.py"], ROOT),
]


def main() -> None:
    start = time.time()
    for number, (title, command, folder) in enumerate(STEPS, start=1):
        print(f"\n=== Step {number}/{len(STEPS)}: {title} ===", flush=True)
        result = subprocess.run(command, cwd=folder)
        if result.returncode != 0:
            raise SystemExit(f"\nStopped: step {number} ({title}) failed. Nothing after it ran.")

    minutes = (time.time() - start) / 60
    print(f"\nDone in {minutes:.1f} min. Check the page locally, then commit and push docs/data.json.")


if __name__ == "__main__":
    main()
