-- Allow authenticated users to read accepted friendship rows of their direct friends.
-- Existing policy friend_select_participant only allows rows where the viewer is a participant.
-- This additional SELECT policy allows use cases like FriendFriendsList:
-- viewer Marie is direct friend of Kaji0tt -> viewer may read accepted Friend rows that include Kaji0tt.
--
-- The policy is intentionally limited to accepted friendships only.

create policy "friend_select_direct_friends_friendlist"
  on public."Friend"
  for select
  to authenticated
  using (
    lower(coalesce(status, '')) = 'accepted'
    and exists (
      select 1
      from public."Friend" viewer_friend
      where lower(coalesce(viewer_friend.status, '')) = 'accepted'
        and (
          lower(coalesce(viewer_friend.request_sent_by, '')) = lower(coalesce((auth.jwt() ->> 'email'), ''))
          or lower(coalesce(viewer_friend.request_sent_to, '')) = lower(coalesce((auth.jwt() ->> 'email'), ''))
        )
        and (
          lower(coalesce(request_sent_by, '')) = lower(
            case
              when lower(coalesce(viewer_friend.request_sent_by, '')) = lower(coalesce((auth.jwt() ->> 'email'), ''))
                then coalesce(viewer_friend.request_sent_to, '')
              else coalesce(viewer_friend.request_sent_by, '')
            end
          )
          or lower(coalesce(request_sent_to, '')) = lower(
            case
              when lower(coalesce(viewer_friend.request_sent_by, '')) = lower(coalesce((auth.jwt() ->> 'email'), ''))
                then coalesce(viewer_friend.request_sent_to, '')
              else coalesce(viewer_friend.request_sent_by, '')
            end
          )
        )
    )
  );
