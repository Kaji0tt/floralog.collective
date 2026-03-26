-- Emergency rollback for recursive Friend RLS policy.
-- If 016 was applied, this removes the policy that references public."Friend"
-- from inside a policy on public."Friend", which can break selects.

drop policy if exists "friend_select_direct_friends_friendlist" on public."Friend";
