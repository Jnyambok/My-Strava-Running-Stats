-- Grain check: one row per (activity_id, effort).
-- Returns duplicates; zero rows = pass.

select
    activity_id,
    effort,
    count(*) as n
from {{ ref('fct_best_efforts') }}
group by activity_id, effort
having count(*) > 1