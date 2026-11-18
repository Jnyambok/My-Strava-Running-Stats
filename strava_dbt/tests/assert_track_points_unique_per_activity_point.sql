-- Grain check: each (activity_id, point_index) pair must appear once.
-- Returns the duplicates; zero rows = pass.

select
    activity_id,
    point_index,
    count(*) as n
from {{ ref('stg_strava__track_points') }}
group by activity_id, point_index
having count(*) > 1