# My Strava Running Stats

A personal analytics engineering project. It pulls my runs from the Strava API, models them in BigQuery with dbt, and publishes a public dashboard with metrics Strava normally keeps behind its paid tier.

> **Status:** 🚧 In progress, being built step by step.

---

## Why

Strava's free tier shows the basics. The more useful training metrics, such as fitness and fatigue trends, heart-rate zone breakdowns and best-effort progression, need a subscription. I wanted to build them myself from the raw data and practise a real analytics engineering workflow along the way.

## How it works

```
Strava API ──► Python ──► BigQuery ──► dbt ──► data.json ──► Static website
                  └──────────── GitHub Actions (daily) ────────────┘
```

| Step | Tool | What it does |
|---|---|---|
| Extract & load | Python | Authenticates with Strava (OAuth), pulls new runs, loads them into BigQuery |
| Transform | dbt + BigQuery | Cleans the raw data and builds tested models for the dashboard |
| Export | Python | Writes the final dbt models to a JSON file |
| Present | HTML / CSS / JS + Chart.js | A single-page dashboard on GitHub Pages |
| Schedule | GitHub Actions | Runs the whole pipeline once a day |

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
