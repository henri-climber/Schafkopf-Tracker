-- Serialize round-number allocation per table. The original add_round migration
-- is already applied, so this behavior change intentionally lives in a new
-- migration instead of rewriting migration history.

create or replace function public.add_round(p_table_id bigint)
returns public."Rounds"
language sql
security invoker
set search_path = ''
as $$
  select pg_advisory_xact_lock(
    hashtextextended('public.add_round:' || p_table_id::text, 0)
  );

  insert into public."Rounds" (table_id, round_number)
  select p_table_id, coalesce(max(round_number), 0) + 1
  from public."Rounds"
  where table_id = p_table_id
  returning *;
$$;
