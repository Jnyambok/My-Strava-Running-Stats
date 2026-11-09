# My Strava Running Stats

A personal analytics engineering project. It takes my Strava data export, models it in BigQuery with dbt, and publishes a public dashboard with metrics Strava normally keeps behind its paid tier.

> **Status:** 🚧 In progress, being built step by step.

---

## Why

Strava's free tier shows the basics. The more useful training metrics, such as fitness and fatigue trends, heart-rate zone breakdowns and best-effort progression, need a subscription. I wanted to build them myself from the raw data and practise a real analytics engineering workflow along the way.

## How it works

```
Strava export (zip) ──► Python ──► BigQuery ──► dbt ──► data.json ──► Static website
   (every 2 weeks)        └──────────────── one command ─────────────────┘
```

| Step | Tool | What it does |
|---|---|---|
| Source | Strava bulk export | Every two weeks I request my data archive and drop the zip into `data/raw/` |
| Extract & load | Python | Reads the newest zip and loads only new runs into BigQuery |
| Transform | dbt + BigQuery | Cleans the raw data and builds tested models for the dashboard |
| Export | Python | Writes the final dbt models to a JSON file |
| Present | HTML / CSS / JS + Chart.js | A single-page dashboard on GitHub Pages, showing when the data was last updated |

**Why not the Strava API?** Since June 2026 the Strava API requires a paid subscription, and its terms limit showing data publicly. The bulk export is free and it's my own data, so the pipeline is built around a fortnightly file drop instead.

## Metrics

Starting with a small set and adding more over time:

- [ ] **Totals:** distance, runs, moving time, elevation
- [ ] **Weekly activity:** distance per week
- [ ] **Best efforts:** fastest 5K, 10K and half marathon over time
- [ ] **Fitness & form:** 42-day fitness vs 7-day fatigue
- [ ] **Heart-rate zones:** time spent in each zone per week

## Project structure

_Will be filled in as the project is built._

## Running it locally

_Coming soon._

---

Data from [Strava](https://www.strava.com). This project is not affiliated with Strava.
