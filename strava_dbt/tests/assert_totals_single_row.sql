-- The totals mart must have exactly one row; returns the count if not.

select count(*) as n
from {{ ref('fct_running_totals') }}
having count(*) != 1