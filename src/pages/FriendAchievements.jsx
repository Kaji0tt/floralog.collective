import { Navigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function FriendAchievements() {
  const urlParams = new URLSearchParams(window.location.search);
  const friendEmail = urlParams.get("email") || "";
  return (
    <Navigate
      replace
      to={createPageUrl(`FriendProfile?email=${encodeURIComponent(friendEmail)}&tab=achievements`)}
    />
  );
}
