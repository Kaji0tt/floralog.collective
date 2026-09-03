-- Persist the latest server-news item a player has viewed.
alter table public."PublicProfile"
  add column if not exists server_news_seen_at timestamptz not null default now();

comment on column public."PublicProfile".server_news_seen_at is
  'Timestamp of the newest server-news announcement viewed by the player.';

notify pgrst, 'reload schema';