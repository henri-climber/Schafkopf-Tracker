-- Cover foreign-key lookups whose referencing columns are not the leading
-- columns of their existing composite primary keys.
create index round_scores_player_id_idx
  on public.round_scores (player_id);

create index table_players_table_id_idx
  on public.table_players (table_id);

-- The unique constraint on (match_id, set_number) already covers match_id
-- lookups and cascades, so this single-column index duplicated its leading key.
drop index public.tt_sets_match_idx;
