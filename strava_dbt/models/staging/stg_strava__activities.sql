with source as (

    select * from {{ source('strava', 'activities') }}

),

renamed as (

    select
        -- ids
        cast(activity_id as int64)                                   as activity_id,

        -- when (Strava exports times in UTC)
        parse_timestamp('%b %d, %Y, %I:%M:%S %p', activity_date)     as started_at,

        -- what
        activity_name,
        activity_type,

        -- distance & time
        cast(distance_2 as float64)                                  as distance_m,
        cast(moving_time as float64)                                 as moving_time_s,
        cast(elapsed_time as int64)                                  as elapsed_time_s,
        cast(elevation_gain as float64)                              as elevation_gain_m,

        -- speed (both in metres per second)
        cast(average_speed as float64)                               as average_speed_mps,
        cast(nullif(average_grade_adjusted_pace,'') as float64) as gap_speed_mps,

        -- optional fields: empty string -> NULL, real garbage still fails
        cast(nullif(average_cadence, '') as float64)                 as average_cadence,
        cast(nullif(perceived_exertion, '') as float64)              as perceived_exertion,
        cast(nullif(total_steps, '') as float64)                     as total_steps,

        -- metadata
        _loaded_at

    from source

)

select * from renamed