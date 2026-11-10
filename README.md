# My Strava Running Stats

A personal analytics engineering project. It takes my Strava data export, models it in BigQuery with dbt, and publishes a public dashboard with metrics Strava normally keeps behind its paid tier.

> **Status:** 🚧 In progress. See [Progress](#progress) below.

---

## Why

Strava's free tier shows the basics. The more useful training metrics, such as fitness and fatigue trends, best-effort progression and grade-adjusted pace, need a subscription. I wanted to build them myself from the raw data and practise a real analytics engineering workflow along the way.

## How it works

```
Strava export (zip) ──► Python ──► BigQuery ──► dbt ──► data.json ──► Static website
   (every 2 weeks)        └──────────────── one command ─────────────────┘
```

| Step | Tool | What it does |
|---|---|---|
| Source | Strava bulk export | Every two weeks I request my data archive and drop the zip into `data/raw/` |
| Extract & load | Python | Reads the newest zip and reloads the full history into BigQuery, since every export contains all activities |
| Transform | dbt + BigQuery | Cleans the raw data and builds tested models for the dashboard |
| Export | Python | Writes the final dbt models to a JSON file |
| Present | HTML / CSS / JS + Chart.js | A single-page dashboard on GitHub Pages, showing when the data was last updated |

**Why not the Strava API?** Since June 2026 the Strava API requires a paid subscription, and its terms limit showing data publicly. The bulk export is free and it's my own data, so the pipeline is built around a fortnightly file drop instead.

**Cost: free.** BigQuery runs in the free **sandbox**, with no billing account, so it can't be charged. The sandbox shapes the design:

- **No DML** (`INSERT` / `UPDATE` / `MERGE`), so each run fully reloads the raw tables with batch load jobs and dbt builds plain tables and views rather than incremental models. With about 130 activities, a full reload takes seconds.
- **Tables expire after 60 days.** That's fine, because the export zip is the source of truth and the website reads its own `data.json`, so it keeps working even if BigQuery is empty.
- **10 GiB lifetime storage**, so staging models are views (which use no storage) and only the small final tables are stored.

## The data

What the export actually contains:

- **`activities.csv`**: one row per activity, with 104 columns. The export has 117 runs, 11 walks and 2 hikes, from May 2025 to today.
- **`activities/*.gpx`**: one GPS track per activity, with a point roughly every second (position, elevation, time).

What that means for the metrics:

- **No heart-rate data**, because I record on my phone. Effort is measured with **perceived exertion** instead: I rate each run's effort out of 10, and that's filled in for about 70% of activities.
- **Grade-adjusted pace** is included for every run.
- **Cadence** is available for about 60% of activities.
- The CSV has **duplicate column names**, for example two `Distance` columns in different units. Cleaning that up is a job for the dbt staging layer.

Only `activities.csv` and the GPX files are used. The rest of the export (messages, logins, contacts and so on) is never loaded, and raw data is never committed to git.

## Metrics

- **Totals:** distance, runs, moving time, elevation
- **Weekly activity:** distance per week
- **Best efforts:** fastest 5K, 10K and half marathon over time, found from the GPS tracks
- **Fitness & form:** 42-day fitness vs 7-day fatigue, using training load = perceived exertion × minutes
- **Pace trends:** average and grade-adjusted pace over time

## Key Attributes

The engineering ideas this project demonstrates, and why they matter.

### Idempotency
Running the pipeline once or ten times on the same export gives exactly the same data. Pipelines get rerun all the time (failures, retries, backfills, debugging), and a non-idempotent pipeline silently double-counts on every rerun.

- **Full refresh, not append.** Each Strava export contains my full history, so every run replaces the raw tables instead of adding to them.
- **Unambiguous input.** The loader expects exactly one export in `data/raw/` and stops with an error otherwise, rather than guessing by file timestamp.
- **Safety net.** A dbt `unique` test on `activity_id` fails the build if duplicates ever appear.
- **Trade-off.** I chose full refresh over incremental `MERGE` because the data is small and the BigQuery sandbox doesn't support DML. At scale, I'd switch to incremental models with a merge or partition strategy.

## Progress

### Phase 0: Plan
- [x] Define the goal and the tools
- [x] Choose the data source: bulk export, since the API needs a paid subscription
- [x] Draft the README
- [x] Request the first Strava export
- [x] Explore the export to see what data exists
- [x] Set up the BigQuery sandbox

### Phase 1: Extract & load (Python)
- [x] Create project folders and git-ignore raw data
- [x] Read `activities.csv` from the zip
- [ ] Parse the GPX tracks
- [ ] Load into BigQuery raw tables (full reload each run)

### Phase 2: Transform (dbt)
- [ ] Set up a dbt project connected to BigQuery
- [ ] Staging models: clean columns, fix units, keep runs only
- [ ] Mart models for the dashboard
- [ ] Add dbt tests and docs

### Phase 3: Metrics
- [ ] Totals
- [ ] Weekly distance
- [ ] Best efforts (5K / 10K / half)
- [ ] Fitness & form
- [ ] Pace trends

### Phase 4: Website
- [ ] Export the marts to `data.json`
- [ ] Page layout with the orange gradient design
- [ ] Charts
- [ ] "Last updated on …" date
- [ ] Publish on GitHub Pages

### Phase 5: Routine
- [ ] One command runs the whole pipeline
- [ ] Write the "Running it locally" guide
- [ ] Final README polish with screenshots

## Project structure

_Will be filled in as the project is built._

## Running it locally

_Coming soon._

---

Data from [Strava](https://www.strava.com). This project is not affiliated with Strava.
