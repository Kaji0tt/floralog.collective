import { Navigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function FriendAchievements() {
  const urlParams = new URLSearchParams(window.location.search);
  const friendAuthId = urlParams.get("auth_id") || "";
  const friendEmail = urlParams.get("email") || "";
  const target = friendAuthId
    ? `FriendProfile?auth_id=${encodeURIComponent(friendAuthId)}&tab=achievements`
    : `FriendProfile?email=${encodeURIComponent(friendEmail)}&tab=achievements`;

  return <Navigate replace to={createPageUrl(target)} />;
}
