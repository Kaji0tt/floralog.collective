import { Navigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function FriendFriendsList() {
  const urlParams = new URLSearchParams(window.location.search);
  const friendEmail = urlParams.get("email") || "";
  return (
    <Navigate
      replace
      to={createPageUrl(`FriendProfile?email=${encodeURIComponent(friendEmail)}&tab=friends`)}
    />
  );
}
