import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/api/supabaseClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Trophy } from "lucide-react";

const RANK_MEDALS = { 1: "🥇", 2: "🥈", 3: "🥉" };

/**
 * Global modal that shows the weekly ranking result summary when a user taps the
 * "Platz X in der Wochenwertung" push/in-app notification. Reads its state from the
 * `weeklyRankModal` URL query params (set via the notification's actionUrl), so it
 * can be mounted once in Layout.jsx and works regardless of which page is active.
 */
export default function WeeklyRankingResultModal({ user }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const week = params.get("weeklyRankModal");
    if (!week) return;

    setSummary({
      week,
      rank: Number(params.get("rank")) || null,
      sparks: Number(params.get("sparks")) || null,
      weekStart: params.get("weekStart") || null,
    });
    setIsOpen(true);

    // Strip modal params from the URL so a refresh/back navigation doesn't reopen it.
    params.delete("weeklyRankModal");
    params.delete("rank");
    params.delete("sparks");
    params.delete("weekStart");
    const cleanedSearch = params.toString();
    navigate(
      { pathname: location.pathname, search: cleanedSearch ? `?${cleanedSearch}` : "" },
      { replace: true }
    );
  }, [location.search]);

  useEffect(() => {
    if (!summary?.weekStart) {
      setLeaderboard([]);
      return;
    }
    let cancelled = false;
    supabase
      .rpc("get_weekly_seed_leaderboard", { p_limit: 5, p_week_start: summary.weekStart })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.warn("[WeeklyRankingResultModal] leaderboard unavailable:", error.message);
          setLeaderboard([]);
          return;
        }
        setLeaderboard(Array.isArray(data) ? data : []);
      });
    return () => {
      cancelled = true;
    };
  }, [summary?.weekStart]);

  if (!summary) return null;

  const { rank, sparks, week } = summary;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Trophy className="w-5 h-5 text-amber-400" />
            {rank ? `Platz ${rank} in der Wochenwertung!` : "Wochenwertung"}
          </DialogTitle>
          <DialogDescription>
            {week ? `Woche ${week}` : null}
            {sparks ? ` · +${sparks} Funken erhalten` : ""}
          </DialogDescription>
        </DialogHeader>

        {leaderboard.length > 0 && (
          <div className="space-y-1.5 pt-1">
            {leaderboard.map((entry, index) => {
              const isOwnRow = entry.auth_id === user?.id;
              const entryRank = index + 1;
              return (
                <div
                  key={entry.auth_id || index}
                  className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                    isOwnRow
                      ? "bg-amber-500/15 border border-amber-400/40 font-semibold"
                      : "bg-black/20"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="w-5 text-center">{RANK_MEDALS[entryRank] || entryRank}</span>
                    {entry.display_name || entry.full_name || entry.user_email || "Spieler:in"}
                  </span>
                  <span>{entry.weekly_seed_total} 🌱</span>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
