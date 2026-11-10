"""
Load the Strava export into BigQuery's raw layer.

Run it with:  python extract/load.py

It creates (or fully replaces) two tables in the `strava_raw` dataset:
  - activities    one row per activity, straight from activities.csv
  - track_points  one row per GPS point, from the GPX files

Every column is STRING (the raw-layer rule; dbt does the typing), plus a
`_loaded_at` timestamp so we can always see when the data was loaded.

Why WRITE_TRUNCATE?  It tells BigQuery to *replace* the table on every load
instead of adding to it. Each export holds the full history, so replacing
is correct, and it makes the pipeline idempotent: run it once or ten times,
the tables end up identical. (It's also a batch load job, not DML, so it
works in the free BigQuery sandbox.)
"""

import os
from datetime import datetime, timezone

from dotenv import load_dotenv
from google.cloud import bigquery

from activities import find_export, read_activities
from tracks import read_tracks

# Settings live in .env (see .env.example), so the code works for anyone
# who points it at their own project, and dbt can read the same values.
load_dotenv()


def require_env(name: str) -> str:
    """
    Read a required setting, or stop with a clear message.

    Deliberately no default: if GCP_PROJECT_ID were missing and we fell back
    to gcloud's default project, data could land in another (possibly billed)
    project without anyone noticing.
    """
    value = os.getenv(name)
    if not value:
        raise SystemExit(f"Missing {name}. Copy .env.example to .env and fill it in.")
    return value


PROJECT_ID = require_env("GCP_PROJECT_ID")
DATASET = require_env("BQ_RAW_DATASET")


def load_table(client: bigquery.Client, table_name: str, rows: list[dict], loaded_at: str) -> None:
    """Replace one raw table with `rows`, every column typed as STRING."""
    table_id = f"{PROJECT_ID}.{DATASET}.{table_name}"

    # Column order comes from the first row; dicts keep insertion order.
    schema = [bigquery.SchemaField(col, "STRING") for col in rows[0]]
    schema.append(bigquery.SchemaField("_loaded_at", "TIMESTAMP"))

    job_config = bigquery.LoadJobConfig(
        schema=schema,
        write_disposition=bigquery.WriteDisposition.WRITE_TRUNCATE,
    )
    #Write_disposition tells BigQuery what to do if the table has Data



    rows = [{**row, "_loaded_at": loaded_at} for row in rows]

    job = client.load_table_from_json(rows, table_id, job_config=job_config)
    job.result()  # wait for the load to finish (raises if it failed)

    table = client.get_table(table_id)
    print(f"  {table_id}: {table.num_rows:,} rows, {len(table.schema)} columns")


def main() -> None:
    export = find_export()
    loaded_at = datetime.now(timezone.utc).isoformat()
    print(f"Loading {export.name} into {PROJECT_ID}.{DATASET}")

    activities = read_activities(export)
    points, skipped = read_tracks(export)

    client = bigquery.Client(project=PROJECT_ID)
    load_table(client, "activities", activities, loaded_at)
    load_table(client, "track_points", points, loaded_at)

    if skipped:
        print(f"  Skipped {len(skipped)} activity without a GPX file: {', '.join(skipped)}")
    print("Done.")


if __name__ == "__main__":
    main()
