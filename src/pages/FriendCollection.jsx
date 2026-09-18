import { Navigate, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Query } from "@/api/entities";
import { createPageUrl } from "@/utils";

export default function FriendCollection() {
  const urlParams = new URLSearchParams(window.location.search);
  const friendEmail = urlParams.get("email");
  const friendAuthId = urlParams.get("auth_id");
  const navigate = useNavigate();

  const { data: publicProfiles = [] } = useQuery({
    queryKey: ["publicProfilesByEmailLegacy", friendEmail],
    queryFn: () => Query.PublicProfile.list(),
    enabled: !!friendEmail && !friendAuthId,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (friendAuthId) return;
    if (!friendEmail) return;
    const resolvedProfile = (publicProfiles || []).find(
      (profile) => profile?.user_email?.toLowerCase() === friendEmail.toLowerCase()
    );
    if (resolvedProfile?.auth_id) {
      navigate(
        createPageUrl(`FriendProfile?auth_id=${encodeURIComponent(resolvedProfile.auth_id)}&tab=collection`),
        { replace: true }
      );
    }
  }, [friendAuthId, friendEmail, navigate, publicProfiles]);

  if (friendAuthId) {
    return (
      <Navigate
        replace
        to={createPageUrl(`FriendProfile?auth_id=${encodeURIComponent(friendAuthId)}&tab=collection`)}
      />
    );
  }

  if (!friendEmail) {
    return <Navigate replace to={createPageUrl("Friends")} />;
  }

  return <Navigate replace to={createPageUrl("Friends")} />;
}
