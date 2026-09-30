-- Record what was played in each round, not just the resulting numbers.
--
-- Points are still derived on the client and stored in round_scores.raw_score
-- exactly as before, so standings, the leaderboard and the chart are untouched.
-- This migration only adds the facts behind those numbers (mode, who played,
-- extras) plus the tariff they were scored with.
--
-- Everything here is additive: new columns are nullable or defaulted, so the
-- client that is deployed right now keeps working until the new one ships.

-- ── Enums ───────────────────────────────────────────────────────────────────
-- Real enums rather than CHECK constraints so the generated TypeScript types
-- are unions instead of `string`.

create type public.schafkopf_game_mode as enum (
  'sauspiel',
  'hochzeit',
  'farbsolo',
  'wenz',
  'geier',
  'farbwenz',
  'farbgeier',
  'bettel',
  'ramsch',
  'manual'
);

create type public.schafkopf_suit as enum ('eichel', 'gras', 'herz', 'schellen');

-- declarer is "the selected player": whoever played, or in Ramsch the loser
-- (or the player who went Durchmarsch).
create type public.round_role as enum ('declarer', 'partner', 'opponent', 'sitting_out');

-- ── Global default tariff ───────────────────────────────────────────────────
-- A single row, editable by everyone like the rest of the app. The seed must
-- match DEFAULT_SCORING_CONFIG in src/features/schafkopf/domain/gameModes.ts;
-- gameModes.test.ts parses it out of this file to keep the two in step.

create table public.schafkopf_settings (
  id boolean primary key default true check (id),
  scoring_config jsonb not null check (jsonb_typeof(scoring_config) = 'object'),
  updated_at timestamptz not null default now()
);

alter table public.schafkopf_settings enable row level security;

create policy "Enable read access for all users"
  on public.schafkopf_settings for select
  using (true);

create policy "Enable update for all users"
  on public.schafkopf_settings for update
  to anon
  using (true)
  with check (true);

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger schafkopf_settings_touch_updated_at
  before update on public.schafkopf_settings
  for each row execute function public.touch_updated_at();

insert into public.schafkopf_settings (scoring_config) values ($config$
{
  "version": 1,
  "modes": {
    "sauspiel": { "enabled": true, "tariff": 10, "minLaufende": 3 },
    "hochzeit": { "enabled": true, "tariff": 10, "minLaufende": 3 },
    "farbsolo": { "enabled": true, "tariff": 20, "minLaufende": 3 },
    "wenz": { "enabled": true, "tariff": 20, "minLaufende": 2 },
    "geier": { "enabled": true, "tariff": 20, "minLaufende": 2 },
    "farbwenz": { "enabled": false, "tariff": 20, "minLaufende": 3 },
    "farbgeier": { "enabled": false, "tariff": 20, "minLaufende": 3 },
    "bettel": { "enabled": false, "tariff": 20, "minLaufende": 3 },
    "ramsch": { "enabled": true, "tariff": 10, "minLaufende": 3 }
  },
  "schneider": 10,
  "schwarz": 10,
  "laufende": 10,
  "tout": { "enabled": true, "multiplier": 2 },
  "sie": { "enabled": false, "multiplier": 4 },
  "jungfrauMultiplier": 2
}
$config$::jsonb);

-- ── Per-game tariff ─────────────────────────────────────────────────────────
-- Each game snapshots the global tariff when it is created, so changing the
-- default later never rescores a game that already exists. A column default
-- may not contain a subquery, but it may call a function. Adding the column
-- evaluates the default once per existing row, which is the backfill.

create function public.current_scoring_config()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select scoring_config from public.schafkopf_settings;
$$;

alter table public."Tables"
  add column scoring_config jsonb not null default public.current_scoring_config(),
  add constraint tables_scoring_config_is_object check (jsonb_typeof(scoring_config) = 'object');

-- ── Round facts ─────────────────────────────────────────────────────────────
-- Flat columns rather than jsonb so statistics are plain SQL. game_mode is
-- null for every round recorded before this migration.

alter table public."Rounds"
  add column game_mode public.schafkopf_game_mode,
  add column suit public.schafkopf_suit,
  add column declarer_won boolean,
  add column schneider boolean not null default false,
  add column schwarz boolean not null default false,
  add column laufende smallint not null default 0,
  add column klopfer smallint not null default 0,
  add column kontra boolean not null default false,
  add column re boolean not null default false,
  add column tout boolean not null default false,
  add column sie boolean not null default false,
  add column jungfrau boolean not null default false,
  add column durchmarsch boolean not null default false,
  add constraint rounds_schwarz_is_schneider check (not schwarz or schneider),
  add constraint rounds_re_after_kontra check (not re or kontra),
  add constraint rounds_laufende_range check (laufende between 0 and 14),
  add constraint rounds_klopfer_range check (klopfer between 0 and 4);

-- Null for legacy and manual rounds.
alter table public.round_scores add column role public.round_role;

-- Rounds could only ever be inserted; editing a round's facts needs updates.
create policy "Enable update for all users"
  on public."Rounds" for update
  to anon
  using (true)
  with check (true);

-- ── save_round ──────────────────────────────────────────────────────────────
-- Writes a round's facts and every player's score in one transaction. The old
-- flow created an empty round and then upserted cells one by one, which left
-- 0/0/0/0 rounds behind whenever nobody filled them in.
--
-- Without p_round_id it inserts the next round (numbered under the same
-- per-table lock as add_round); with it, that round is updated in place. It is
-- last and defaulted so the generated types make it optional rather than a
-- `number` that cannot be null.

create function public.save_round(
  p_table_id bigint,
  p_round jsonb,
  p_scores jsonb,
  p_round_id bigint default null
)
returns public."Rounds"
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_facts public."Rounds";
  v_round public."Rounds";
  v_sum bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended('public.add_round:' || p_table_id::text, 0));

  if jsonb_typeof(p_scores) is distinct from 'array' then
    raise exception 'p_scores must be an array' using errcode = '22023';
  end if;

  select coalesce(sum((s ->> 'raw_score')::bigint), 0)
  into v_sum
  from jsonb_array_elements(p_scores) as s;

  if v_sum <> 0 then
    raise exception 'Round scores must sum to zero (got %)', v_sum using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_scores) as s
    where not exists (
      select 1
      from public.table_players as tp
      where tp.table_id = p_table_id
        and tp.player_id = (s ->> 'player_id')::bigint
    )
  ) then
    raise exception 'Every scored player must be at table %', p_table_id using errcode = '22023';
  end if;

  v_facts := jsonb_populate_record(null::public."Rounds", p_round);

  if p_round_id is null then
    insert into public."Rounds" (
      table_id, round_number, game_mode, suit, declarer_won, schneider, schwarz,
      laufende, klopfer, kontra, re, tout, sie, jungfrau, durchmarsch
    )
    select
      p_table_id, coalesce(max(r.round_number), 0) + 1, v_facts.game_mode, v_facts.suit,
      v_facts.declarer_won, v_facts.schneider, v_facts.schwarz, v_facts.laufende,
      v_facts.klopfer, v_facts.kontra, v_facts.re, v_facts.tout, v_facts.sie,
      v_facts.jungfrau, v_facts.durchmarsch
    from public."Rounds" as r
    where r.table_id = p_table_id
    returning * into v_round;
  else
    update public."Rounds"
    set game_mode = v_facts.game_mode,
        suit = v_facts.suit,
        declarer_won = v_facts.declarer_won,
        schneider = v_facts.schneider,
        schwarz = v_facts.schwarz,
        laufende = v_facts.laufende,
        klopfer = v_facts.klopfer,
        kontra = v_facts.kontra,
        re = v_facts.re,
        tout = v_facts.tout,
        sie = v_facts.sie,
        jungfrau = v_facts.jungfrau,
        durchmarsch = v_facts.durchmarsch
    where id = p_round_id
      and table_id = p_table_id
    returning * into v_round;

    if not found then
      raise exception 'Round % is not at table %', p_round_id, p_table_id using errcode = '22023';
    end if;
  end if;

  insert into public.round_scores (round_id, player_id, raw_score, role)
  select
    v_round.id,
    (s ->> 'player_id')::bigint,
    (s ->> 'raw_score')::bigint,
    (s ->> 'role')::public.round_role
  from jsonb_array_elements(p_scores) as s
  on conflict (round_id, player_id) do update
  set raw_score = excluded.raw_score,
      role = excluded.role;

  return v_round;
end;
$$;

grant execute on function public.save_round(bigint, jsonb, jsonb, bigint) to anon, authenticated;

-- ── set_table_scoring_config ────────────────────────────────────────────────
-- Changes one game's tariff and rewrites the scores it changes, atomically. The
-- client computes the new scores (the rules live in TypeScript, in one place)
-- and passes only the rounds that differ: [{ round_id, scores: [...] }].

create function public.set_table_scoring_config(
  p_table_id bigint,
  p_config jsonb,
  p_rounds jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('public.add_round:' || p_table_id::text, 0));

  if jsonb_typeof(p_rounds) is distinct from 'array' then
    raise exception 'p_rounds must be an array' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_rounds) as r
    where not exists (
      select 1
      from public."Rounds" as ro
      where ro.id = (r ->> 'round_id')::bigint
        and ro.table_id = p_table_id
    )
    or (
      select coalesce(sum((s ->> 'raw_score')::bigint), 0)
      from jsonb_array_elements(r -> 'scores') as s
    ) <> 0
  ) then
    raise exception 'Every round must be at table % and sum to zero', p_table_id
      using errcode = '22023';
  end if;

  update public."Tables"
  set scoring_config = p_config
  where id = p_table_id;

  if not found then
    raise exception 'Table % does not exist', p_table_id using errcode = '22023';
  end if;

  insert into public.round_scores (round_id, player_id, raw_score, role)
  select
    (r ->> 'round_id')::bigint,
    (s ->> 'player_id')::bigint,
    (s ->> 'raw_score')::bigint,
    (s ->> 'role')::public.round_role
  from jsonb_array_elements(p_rounds) as r
  cross join lateral jsonb_array_elements(r -> 'scores') as s
  on conflict (round_id, player_id) do update
  set raw_score = excluded.raw_score,
      role = excluded.role;
end;
$$;

grant execute on function public.set_table_scoring_config(bigint, jsonb, jsonb)
  to anon, authenticated;
