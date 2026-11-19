"""
Export the dbt marts to the website's data file.

Run it with:  python export/export_data.py

It reads the finished tables in the `strava` dataset (built by dbt) and
writes them to docs/data.json, which the static dashboard in docs/ loads.
GitHub Pages serves docs/ as the public site.

Why a JSON file instead of querying BigQuery from the page?
  - The page needs no credentials, so nothing secret is ever public.
  - The site keeps working even if the sandbox tables expire (60-day rule).
  - It's tiny (a few hundred KB) and loads instantly.

This file is public, so it holds only what the page shows: no GPS
coordinates, no private notes, and no run titles except the personal-best
races (everyday run titles often name my home estate).
"""

import json
import os
from datetime import date, datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from google.cloud import bigquery

load_dotenv()

PROJECT_ID = os.getenv("GCP_PROJECT_ID")
if not PROJECT_ID:
    raise SystemExit("Missing GCP_PROJECT_ID. Copy .env.example to .env and fill it in.")

# Where dbt builds the marts: must match `dataset:` in strava_dbt/profiles.yml.
MARTS_DATASET = "strava"

OUTPUT = Path(__file__).resolve().parent.parent / "docs" / "data.json"

# One query per section of the dashboard. Sorting happens here, because
# tables have no guaranteed order.
QUERIES = {
    "totals": """
        select * from `{d}.fct_running_totals`
    """,
    "runs": """
        select
            cast(activity_id as string)     as activity_id,
            run_date,
            started_at_local,
            -- no activity_name: many of my run titles name my home estate
            distance_km,
            moving_time_min,
            pace_s_per_km,
            gap_pace_s_per_km,
            elevation_gain_m,
            training_load
        from `{d}.fct_runs`
        order by started_at_local
    """,
    "weekly": """
        select week_start, runs, distance_km, moving_time_min, elevation_gain_m
        from `{d}.fct_weekly_runs`
        order by week_start
    """,
    "fitness": """
        select day, training_load, fitness, fatigue, form
        from `{d}.fct_daily_fitness`
        order by day
    """,
    "monthly_pace": """
        select month_start, runs, distance_km, pace_s_per_km, gap_pace_s_per_km
        from `{d}.fct_monthly_pace`
        order by month_start
    """,
    "personal_bests": """
        select
            cast(activity_id as string)     as activity_id,
            run_date,
            activity_name,
            effort,
            effort_distance_m,
            best_time_s,
            pace_s_per_km
        from `{d}.fct_best_efforts`
        where is_personal_best
        order by effort_distance_m, run_date
    """,
}


def to_json_value(value):
    """Make BigQuery values JSON-friendly: dates as ISO strings, floats rounded."""
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, float):
        return round(value, 2)
    return value


def run_query(client: bigquery.Client, sql: str) -> list[dict]:
    rows = client.query(sql.format(d=f"{PROJECT_ID}.{MARTS_DATASET}")).result()
    return [{key: to_json_value(val) for key, val in row.items()} for row in rows]


def main() -> None:
    client = bigquery.Client(project=PROJECT_ID)
    data = {name: run_query(client, sql) for name, sql in QUERIES.items()}

    # When this file was written, i.e. when the dashboard was "posted".
    # The page shows it as "Last updated on ... at ...".
    data["exported_at"] = datetime.now(timezone.utc).isoformat()

    # The totals table has exactly one row (a dbt test guarantees it).
    data["totals"] = data["totals"][0]

    OUTPUT.parent.mkdir(exist_ok=True)
    OUTPUT.write_text(json.dumps(data, indent=1), encoding="utf-8")

    sizes = ", ".join(f"{k}: {len(v)}" for k, v in data.items() if isinstance(v, list))
    print(f"Wrote {OUTPUT} ({OUTPUT.stat().st_size / 1024:.0f} KB) - {sizes}")


if __name__ == "__main__":
    main()
