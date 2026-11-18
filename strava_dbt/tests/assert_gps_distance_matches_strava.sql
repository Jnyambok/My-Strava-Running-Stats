-- Reconciliation: for every run, our GPS distance must be within 5% of Strava's.
-- Returns the runs that are off; zero rows = pass.

with gps as (

    select
        activity_id,
        max(distance_m) as gps_distance_m
    from {{ ref('int_track_point_distances') }}
    group by activity_id

)

select
    runs.activity_id,
    runs.distance_km * 1000         as strava_distance_m,
    gps.gps_distance_m
from {{ ref('fct_runs') }} as runs
join gps
    on runs.activity_id = gps.activity_id
where abs(gps.gps_distance_m / (runs.distance_km * 1000) - 1) > 0.05