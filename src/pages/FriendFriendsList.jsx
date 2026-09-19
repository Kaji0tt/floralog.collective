import { Navigate, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Query } from "@/api/entities";
import { createPageUrl } from "@/utils";

export default function FriendFriendsList() {
  const urlParams = new URLSearchParams(window.location.search);
  const friendAuthId = urlParams.get("auth_id") || "";
  const friendEmail = urlParams.get("email") || "";
  const target = friendAuthId
    ? `FriendProfile?auth_id=${encodeURIComponent(friendAuthId)}&tab=friends`
    : `FriendProfile?email=${encodeURIComponent(friendEmail)}&tab=friends`;

  return <Navigate replace to={createPageUrl(target)} />;
}
