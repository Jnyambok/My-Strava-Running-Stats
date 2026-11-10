"""
Read the GPS track points out of every GPX file in the Strava export.

A GPX file is XML. Each activity has one, and inside it is a list of
track points recorded roughly every second:

    <trkpt lat="-1.29" lon="36.82">
      <ele>1622.0</ele>
      <time>2026-11-09T14:40:46Z</time>
    </trkpt>

We flatten that into one row per point, so the data looks like a table:

    activity_id | point_index | recorded_at          | latitude | longitude | elevation
    20921243068 | 0           | 2026-11-09T14:40:46Z | -1.29    | 36.82     | 1622.0

Same raw-layer rule as activities.py: no maths, no filtering, values stay
as text. Distances, paces and best efforts are calculated later in dbt.
"""

import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

from activities import find_export, read_activities

# GPX tags live in this XML namespace, so ElementTree needs it to find them.
NS = {"gpx": "http://www.topografix.com/GPX/1/1"}


def parse_gpx(xml_bytes: bytes, activity_id: str) -> list[dict[str, str]]:
    """Turn one GPX file into a list of track-point rows."""
    root = ET.fromstring(xml_bytes)
    points = []
    for index, trkpt in enumerate(root.iterfind(".//gpx:trkpt", NS)):
        points.append({
            "activity_id": activity_id,
            "point_index": str(index),
            "recorded_at": trkpt.findtext("gpx:time", default="", namespaces=NS),
            "latitude": trkpt.get("lat", ""),
            "longitude": trkpt.get("lon", ""),
            "elevation": trkpt.findtext("gpx:ele", default="", namespaces=NS),
        })
    return points


def read_tracks(zip_path: Path) -> tuple[list[dict[str, str]], list[str]]:
    """
    Read the track points for every activity that has a GPX file.

    activities.csv tells us which file belongs to which activity (the
    `filename` column), so we use it as the map rather than guessing from
    file names. Activities without a GPX file (e.g. an occasional .fit file)
    are skipped and reported back, rather than silently ignored.
    """
    points: list[dict[str, str]] = []
    skipped: list[str] = []
    with zipfile.ZipFile(zip_path) as zf:
        for activity in read_activities(zip_path):
            filename = activity["filename"]
            if not filename.endswith(".gpx"):
                skipped.append(f"{activity['activity_id']} ({activity['activity_type']}, {filename or 'no file'})")
                continue
            points.extend(parse_gpx(zf.read(filename), activity["activity_id"]))
    return points, skipped


if __name__ == "__main__":
    # Quick check: run `python extract/tracks.py` to see what was read.
    export = find_export()
    points, skipped = read_tracks(export)

    activities_with_points = {p["activity_id"] for p in points}
    print(f"Export:          {export.name}")
    print(f"Track points:    {len(points):,}")
    print(f"Activities:      {len(activities_with_points)}")
    print(f"Avg points/act:  {len(points) // max(len(activities_with_points), 1):,}")
    print(f"Skipped:         {len(skipped)}")
    for s in skipped:
        print(f"  {s}")
