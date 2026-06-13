-- =============================================================================
-- PHASE 0 — READ-ONLY DB DISCOVERY
-- Diese Queries veraendern NICHTS. Im Supabase SQL-Editor ausfuehren und den
-- Output sichten, bevor die tt_-Tabellen (siehe tt_schema.sql) angelegt werden.
-- Ziel: bestehende Struktur, Beziehungen und v.a. RLS-Policies exakt spiegeln,
-- da das Frontend den Anon-Key direkt verwendet.
-- =============================================================================

-- 1) Alle Tabellen im public-Schema
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;

-- 2) Spalten + Typen + Defaults aller bestehenden Tabellen
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;

-- 3) Primary Keys & Foreign Keys (Beziehungen)
select tc.table_name, tc.constraint_type, kcu.column_name,
       ccu.table_name  as references_table,
       ccu.column_name as references_column
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
left join information_schema.constraint_column_usage ccu
  on tc.constraint_name = ccu.constraint_name and tc.table_schema = ccu.table_schema
where tc.table_schema = 'public'
  and tc.constraint_type in ('PRIMARY KEY','FOREIGN KEY')
order by tc.table_name, tc.constraint_type;

-- 4) Ist RLS pro Tabelle aktiviert?
select relname as table_name, relrowsecurity as rls_enabled
from pg_class
where relnamespace = 'public'::regnamespace and relkind = 'r'
order by relname;

-- 5) Bestehende RLS-Policies (DAS Vorbild fuer die tt_-Tabellen)
select schemaname, tablename, policyname, cmd, roles,
       qual as using_expr, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
