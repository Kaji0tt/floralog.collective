import { Navigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";

const TAB_TO_TARGET = {
  map: "Friends?tab=explorer",
  weekly: "Friends?tab=explorer",
  collections: "Achievements?tab=quests&filter=exploration",
};

export default function Quests() {
  const [searchParams] = useSearchParams();
  const legacyTab = (searchParams.get("tab") || "").toLowerCase();
  const target = TAB_TO_TARGET[legacyTab] || "Achievements?tab=quests";

  return <Navigate to={createPageUrl(target)} replace />;
}
