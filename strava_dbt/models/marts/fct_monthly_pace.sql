with runs as (

    select * from {{ ref('fct_runs') }}

),

final as (

    select
        date_trunc(run_date, month)                                 as month_start,
        count(*)                                                    as runs,
        sum(distance_km)                                            as distance_km,

        -- total time / total distance (NOT avg(pace_s_per_km))
        sum(moving_time_min * 60) / sum(distance_km)                as pace_s_per_km,

        -- grade-adjusted pace, weighted by distance the same way
        sum(gap_pace_s_per_km * distance_km) / sum(distance_km)     as gap_pace_s_per_km

    from runs
    group by month_start

)

select * from final