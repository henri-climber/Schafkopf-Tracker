drop policy if exists "Anonymous users can upload game photos" on storage.objects;

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
