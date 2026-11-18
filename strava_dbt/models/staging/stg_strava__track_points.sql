with source as (

    select * from {{ source('strava', 'track_points') }}

),

renamed as (

    select
        -- ids (grain: one row per GPS point within an activity)
        cast(activity_id as int64)          as activity_id,
        cast(point_index as int64)          as point_index,

        -- when
        cast(recorded_at as timestamp)      as recorded_at,

        -- where
        cast(latitude as float64)           as latitude,
        cast(longitude as float64)          as longitude,
        cast(elevation as float64)          as elevation_m,

        -- metadata
        _loaded_at

    from source

)

select * from renamed