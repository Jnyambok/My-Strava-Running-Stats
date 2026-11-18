with points as (

    select * from {{ ref('int_track_point_distances') }}

),

runs as (

    select * from {{ ref('fct_runs') }}

),

-- the distances we want best times for
efforts as (

    select * from unnest([
        struct('5K' as effort, 5000 as effort_distance_m),
        struct('10K', 10000),
        struct('Half marathon', 21100)
    ])

),

-- the first time each 10 m mark was reached in each activity
marks as (

    select
        activity_id,
        cast(floor(distance_m / 10) as int64)   as mark,
        min(elapsed_s)                          as elapsed_s
    from points
    group by activity_id, mark

),

-- for every start mark and every effort, the time to reach start + effort distance;
-- keep the fastest per activity
best_per_run as (

    select
        efforts.effort,
        efforts.effort_distance_m,
        start.activity_id,
        min(finish.elapsed_s - start.elapsed_s) as best_time_s
    from marks as start
    cross join efforts
    join marks as finish
        on finish.activity_id = start.activity_id
        and finish.mark = start.mark + cast(efforts.effort_distance_m / 10 as int64)
    group by efforts.effort, efforts.effort_distance_m, start.activity_id

),

final as (

    select
        best_per_run.activity_id,
        runs.run_date,
        runs.activity_name,
        best_per_run.effort,
        best_per_run.effort_distance_m,
        best_per_run.best_time_s,
        best_per_run.best_time_s / (best_per_run.effort_distance_m / 1000) as pace_s_per_km,
        best_per_run.best_time_s = min(best_per_run.best_time_s) over (
            partition by best_per_run.effort
            order by runs.run_date
        ) as is_personal_best
    from best_per_run
    join runs
        on best_per_run.activity_id = runs.activity_id

)

select * from final