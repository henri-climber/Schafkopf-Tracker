-- Allocate round numbers in the database rather than on the client.
--
-- The client computed `rounds.length + 1` from its own cached list, so a device
-- that had missed a round — or that fired several inserts before any state
-- updated — claimed a number that was already taken. Deriving the number inside
-- the INSERT means a stale client is harmless: it always lands on the current
-- max + 1 as of the moment the row is written.
--
-- Using max() rather than count() also means a table that already has a gap
-- keeps counting from the top instead of colliding with an existing row.
--
-- Calls for the same table are serialized for the duration of their
-- transactions. Different tables use different advisory-lock keys and can
-- still add rounds concurrently.

create or replace function public.add_round(p_table_id bigint)
returns public."Rounds"
language sql
security invoker
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

-- SECURITY INVOKER (the default) so the caller's RLS still applies.
grant execute on function public.add_round(bigint) to anon, authenticated;
