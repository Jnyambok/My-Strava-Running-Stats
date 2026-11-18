-- Reconciliation: total km in the weekly mart must equal total km in fct_runs.
-- Catches a join that drops or duplicates runs. Returns a row only if they differ.

select
    (select sum(distance_km) from {{ ref('fct_weekly_runs') }}) as weekly_total,
    (select sum(distance_km) from {{ ref('fct_runs') }})        as runs_total
from (select 1)
where abs(
    (select sum(distance_km) from {{ ref('fct_weekly_runs') }})
  - (select sum(distance_km) from {{ ref('fct_runs') }})
) > 0.001