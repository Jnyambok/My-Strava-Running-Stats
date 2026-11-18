with runs as (

    select * from {{ ref('fct_runs') }}

),

-- every Monday from the first run's week to the last run's week
weeks as (

    select week_start
    from unnest(
        generate_date_array(
            (select min(week_start) from runs),
            (select max(week_start) from runs),
            interval 1 week
        )
    ) as week_start

),

weekly as (

    select
        week_start,
        count(*)               as runs,
        sum(distance_km)       as distance_km,
        sum(moving_time_min)   as moving_time_min,
        sum(elevation_gain_m)  as elevation_gain_m,
        sum(training_load)     as training_load
    from runs
    group by week_start

),

final as (

    select
        weeks.week_start,
        coalesce(weekly.runs, 0)              as runs,
        coalesce(weekly.distance_km, 0)       as distance_km,
        coalesce(weekly.moving_time_min, 0)   as moving_time_min,
        coalesce(weekly.elevation_gain_m, 0)  as elevation_gain_m,
        weekly.training_load
    from weeks
    left join weekly
        on weeks.week_start = weekly.week_start

)

select * from final