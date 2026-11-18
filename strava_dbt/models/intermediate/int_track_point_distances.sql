with points as (

    select * from {{ ref('stg_strava__track_points') }}

),

-- distance from the previous point, in metres
steps as (

    select
        activity_id,
        point_index,
        recorded_at,
        ifnull(
            st_distance(
                st_geogpoint(longitude, latitude),
                lag(st_geogpoint(longitude, latitude)) over (
                    partition by activity_id
                    order by point_index
                )
            ),
            0
        ) as step_m
    from points

),

-- running totals from the start of each activity
final as (

    select
        activity_id,
        point_index,
        recorded_at,
        step_m,
        sum(step_m) over (
            partition by activity_id
            order by point_index
        ) as distance_m,
        timestamp_diff(
            recorded_at,
            min(recorded_at) over (partition by activity_id),
            second
        ) as elapsed_s
    from steps

)

select * from final