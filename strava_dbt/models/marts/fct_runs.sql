with activities as (

    select * from {{ ref('stg_strava__activities') }}

),

runs as (

    select * from activities
    where activity_type = 'Run'

),

final as (

    select
        -- ids
        activity_id,
        activity_name,

        -- when (convert UTC to local before taking the date)
        started_at,
        datetime(started_at, '{{ var("timezone") }}')                   as started_at_local,
        date(started_at, '{{ var("timezone") }}')                       as run_date,
        date_trunc(date(started_at, '{{ var("timezone") }}'), isoweek)  as week_start,

        -- distance & time in human units
        distance_m / 1000                                                as distance_km,
        moving_time_s / 60                                               as moving_time_min,
        elapsed_time_s / 60                                              as elapsed_time_min,
        elevation_gain_m,

        -- pace = seconds per km (lower is faster)
        safe_divide(moving_time_s, distance_m / 1000)                    as pace_s_per_km,
        safe_divide(1000, gap_speed_mps)                                 as gap_pace_s_per_km,

        -- form
        average_cadence * 2                                              as cadence_spm,
        perceived_exertion,

        -- training load (Foster session-RPE): effort x minutes
        perceived_exertion * (moving_time_s / 60)                        as training_load

    from runs

)

select * from final
