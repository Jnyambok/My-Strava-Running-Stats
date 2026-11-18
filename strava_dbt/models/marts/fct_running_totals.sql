with runs as (

    select * from {{ ref('fct_runs') }}

),

activities as (

    select * from {{ ref('stg_strava__activities') }}

),

final as (

    select
        count(*)                        as total_runs,
        sum(distance_km)                as total_distance_km,
        sum(moving_time_min) / 60       as total_moving_hours,
        sum(elevation_gain_m)           as total_elevation_gain_m,
        min(run_date)                   as first_run_date,
        max(run_date)                   as last_run_date,
        (select max(_loaded_at) from activities) as data_loaded_at
    from runs

)

select * from final