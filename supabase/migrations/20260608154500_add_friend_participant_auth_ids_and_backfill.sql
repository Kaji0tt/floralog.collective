-- Add explicit participant auth IDs to Friendship records.
-- This keeps friendships stable across email changes.

alter table public."Friend"
  add column if not exists request_sent_by_auth_id uuid,
  add column if not exists request_sent_to_auth_id uuid;

create index if not exists idx_friend_request_sent_by_auth_id
  on public."Friend" (request_sent_by_auth_id);

create index if not exists idx_friend_request_sent_to_auth_id
  on public."Friend" (request_sent_to_auth_id);

create index if not exists idx_friend_auth_pair
  on public."Friend" (request_sent_by_auth_id, request_sent_to_auth_id);

-- Backfill sender auth_id from PublicProfile by sender email.
update public."Friend" f
set request_sent_by_auth_id = pp.auth_id
from public."PublicProfile" pp
where f.request_sent_by_auth_id is null
  and pp.auth_id is not null
  and lower(coalesce(pp.user_email, '')) = lower(coalesce(f.request_sent_by, ''));

-- Backfill recipient auth_id from PublicProfile by recipient email.
update public."Friend" f
set request_sent_to_auth_id = pp.auth_id
from public."PublicProfile" pp
where f.request_sent_to_auth_id is null
  and pp.auth_id is not null
  and lower(coalesce(pp.user_email, '')) = lower(coalesce(f.request_sent_to, ''));

-- Keep legacy auth_id populated for compatibility where possible.
update public."Friend" f
set auth_id = coalesce(f.auth_id, f.request_sent_by_auth_id, f.request_sent_to_auth_id)
where f.auth_id is null
  and (f.request_sent_by_auth_id is not null or f.request_sent_to_auth_id is not null);
