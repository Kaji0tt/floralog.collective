-- Public bucket for rendered social slides (Instagram/Pinterest fetch images by URL).
-- Only the aiSocialMediaUpload edge function writes here, using the service role.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('social-media', 'social-media', true, 8388608, array['image/jpeg'])
on conflict (id) do update
	set public = excluded.public,
		file_size_limit = excluded.file_size_limit,
		allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public."AiMediaUpload" (
	id uuid primary key default gen_random_uuid(),
	object_path text not null unique,
	byte_size integer not null check (byte_size > 0),
	uploaded_at timestamptz not null default now()
);

create index if not exists "AiMediaUpload_uploaded_at_idx"
	on public."AiMediaUpload" (uploaded_at desc);

alter table public."AiMediaUpload" enable row level security;
revoke all on table public."AiMediaUpload" from anon, authenticated;
grant select, insert on table public."AiMediaUpload" to service_role;
