insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'game-photos',
  'game-photos',
  true,
  524288,
  array['image/jpeg']::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anonymous users can upload game photos" on storage.objects;
drop policy if exists "Anonymous users can delete game photos" on storage.objects;

create policy "Anonymous users can upload game photos"
on storage.objects
for insert
to anon
with check (
  bucket_id = 'game-photos'
  and name ~* '^[0-9]+/(before|after)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'
  and exists (
    select 1
    from public."Tables" as game_table
    where game_table.id::text = (storage.foldername(storage.objects.name))[1]
  )
);

create policy "Anonymous users can delete game photos"
on storage.objects
for delete
to anon
using (
  bucket_id = 'game-photos'
  and name ~* '^[0-9]+/(before|after)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'
);
