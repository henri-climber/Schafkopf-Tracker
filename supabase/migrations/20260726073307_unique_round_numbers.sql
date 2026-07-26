-- Round numbers were allocated on the client as `rounds.length + 1`, from state
-- that could be stale (a phone that slept through someone else's round) or
-- mid-update (six inserts landed within 116ms on table 47, all claiming round 1).
-- That produced 23 duplicate groups across 19 tables.
--
-- Renumber every table to a clean 1..n, then make duplicates impossible.
--
-- Renumbering is score-neutral: round_scores references Rounds.id, never
-- round_number, and standings aggregate per player. Only the displayed "#"
-- changes. Ordering by (round_number, created_at, id) keeps the existing
-- sequence and orders same-numbered rounds by when they were created, which
-- also closes the gaps the old `length + 1` left behind.

with numbered as (
  select id,
         row_number() over (partition by table_id
                            order by round_number, created_at, id) as new_number
  from public."Rounds"
)
update public."Rounds" r
set round_number = n.new_number
from numbered n
where r.id = n.id
  and r.round_number <> n.new_number;

alter table public."Rounds"
  add constraint rounds_table_id_round_number_key unique (table_id, round_number);
