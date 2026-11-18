with runs as (

    select * from {{ ref('fct_runs') }}

),

-- fallback effort for runs I didn't rate
average_effort as (

    select avg(perceived_exertion) as perceived_exertion
    from runs

),

run_load as (

    select
        run_date,
        perceived_exertion is null as is_load_estimated,
        coalesce(
            perceived_exertion,
            (select perceived_exertion from average_effort)
        ) * moving_time_min as training_load
    from runs

),

-- every day from the first run to the last
days as (

    select day
    from unnest(
        generate_date_array(
            (select min(run_date) from runs),
            (select max(run_date) from runs)
        )
    ) as day

),

daily as (

    select
        run_date                       as day,
        sum(training_load)             as training_load,
        countif(is_load_estimated)     as estimated_runs
    from run_load
    group by run_date

),

filled as (

    select
        days.day,
        coalesce(daily.training_load, 0)    as training_load,
        coalesce(daily.estimated_runs, 0)   as estimated_runs
    from days
    left join daily
        on days.day = daily.day

),

final as (

    select
        day,
        training_load,
        estimated_runs,
        sum(training_load) over (
            order by day
            rows between 41 preceding and current row
        ) / 42 as fitness,
        sum(training_load) over (
            order by day
            rows between 6 preceding and current row
        ) / 7 as fatigue
    from filled

)

select
    *,
    fitness - fatigue as form
from final