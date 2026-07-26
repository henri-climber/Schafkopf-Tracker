-- These columns are nullable only because nothing ever declared otherwise.
-- Every existing row is non-null and the app has always assumed as much, so the
-- generated TypeScript reports `string | null` / `number | null` for values that
-- are never actually null — which forces defensive handling everywhere.
--
-- Verified before writing this migration:
--   Players.name       null: 0, blank: 0
--   Rounds.round_number null: 0
--   Rounds.table_id     null: 0
--
-- Reversible with the matching `drop not null` statements.

alter table public."Players" alter column name set not null;
alter table public."Rounds" alter column round_number set not null;
alter table public."Rounds" alter column table_id set not null;
