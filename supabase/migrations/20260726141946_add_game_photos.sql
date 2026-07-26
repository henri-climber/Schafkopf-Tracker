-- Add optional before/after photos without changing the app's public access model.
alter table public."Tables"
  add column before_photo_path text,
  add column after_photo_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'game-photos',
  'game-photos',
  true,
  524288,
  array['image/jpeg']::text[]
);

create policy "Anonymous users can upload game photos"
on storage.objects
for insert
to anon
with check (
  bucket_id = 'game-photos'
  and storage.extension(name) = 'jpg'
);

create policy "Anonymous users can delete game photos"
on storage.objects
for delete
to anon
using (bucket_id = 'game-photos');
