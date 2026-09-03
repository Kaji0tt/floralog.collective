import { useEffect, useRef, useState } from "react";
import { Bell, Send, Loader2, Plus, Calendar, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Query } from "@/api/entities";
import { supabase } from "@/api/supabaseClient";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useUiTheme } from "@/lib/UiThemeContext";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";

/**
 * Scrollable modal for viewing and broadcasting Server-News.
 */
export default function ServerNewsDialog({ open, onOpenChange, user, onNewsViewed }) {
  const queryClient = useQueryClient();
  const { isLightUi } = useUiTheme();
  const lastReportedNewsDateRef = useRef(null);

  const [showCreateNews, setShowCreateNews] = useState(false);
  const [adminNewsTitle, setAdminNewsTitle] = useState("");
  const [adminNewsText, setAdminNewsText] = useState("");

  const isAdmin = String(user?.role || "").trim().toLowerCase() === "admin";

  const { data: news = [], isLoading } = useQuery({
    queryKey: ["news"],
    queryFn: () => Query.News.list("-created_date"),
    enabled: Boolean(open),
  });

  useEffect(() => {
    if (!open || isLoading) return;

    const latestNewsDate = news.reduce((latestDate, item) => {
      const candidate = item.created_date || item.created_at;
      if (!candidate || Number.isNaN(new Date(candidate).getTime())) return latestDate;
      return !latestDate || new Date(candidate) > new Date(latestDate) ? candidate : latestDate;
    }, null);

    if (!latestNewsDate || lastReportedNewsDateRef.current === latestNewsDate) return;
    lastReportedNewsDateRef.current = latestNewsDate;
    onNewsViewed?.(latestNewsDate);
  }, [isLoading, news, onNewsViewed, open]);

  const broadcastNewsMutation = useMutation({
    mutationFn: async ({ title, text }) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const { data, error } = await supabase.functions.invoke("broadcastNews", {
        body: { title, text, createdBy: user?.email },
        headers: session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {},
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["news"] });
      setAdminNewsTitle("");
      setAdminNewsText("");
      setShowCreateNews(false);
    },
  });

  const formatDate = (dateString) => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      if (Number.isNaN(date.getTime())) return dateString;
      return new Intl.DateTimeFormat("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
    } catch {
      return dateString;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`max-w-2xl max-h-[85vh] sm:max-h-[80vh] flex flex-col p-0 overflow-hidden border shadow-2xl ${
          isLightUi
            ? "bg-stone-50/95 text-stone-800 border-[#c8ac62]/40"
            : "bg-[#121814] text-stone-100 border-[#f0e5a5]/30"
        }`}
      >
        {/* Fixed Modal Header */}
        <div
          className={`p-4 sm:p-5 border-b shrink-0 flex items-center justify-between gap-3 ${
            isLightUi
              ? "bg-white/80 border-stone-200"
              : "bg-[#18211b]/80 border-[#f0e5a5]/20"
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`p-2 rounded-xl shrink-0 ${
                isLightUi
                  ? "bg-amber-100 text-amber-800"
                  : "bg-amber-500/15 text-amber-300 border border-amber-400/30"
              }`}
            >
              <Bell className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle
                className={`text-base sm:text-lg font-bold truncate ${
                  isLightUi ? "text-stone-900" : "text-stone-100"
                }`}
              >
                Server-News & Ankündigungen
              </DialogTitle>
              <DialogDescription
                className={`text-xs truncate ${
                  isLightUi ? "text-stone-500" : "text-stone-400"
                }`}
              >
                Aktuelle Updates und Neuigkeiten vom Floralog-Team
              </DialogDescription>
            </div>
          </div>

          {isAdmin && (
            <Button
              size="sm"
              variant={showCreateNews ? "secondary" : "default"}
              onClick={() => setShowCreateNews(!showCreateNews)}
              className="shrink-0 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {showCreateNews ? (
                <X className="w-3.5 h-3.5" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">
                {showCreateNews ? "Abbrechen" : "Verfassen"}
              </span>
            </Button>
          )}
        </div>

        {/* Scrollable Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 min-h-0">
          {/* Admin Broadcast Form */}
          {isAdmin && showCreateNews && (
            <Card
              className={`border-2 p-4 space-y-3 ${
                isLightUi
                  ? "bg-emerald-50/80 border-emerald-300"
                  : "bg-emerald-950/30 border-emerald-500/40"
              }`}
            >
              <h4 className="text-sm font-bold flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                <Send className="w-4 h-4" />
                Neue Server-Ankündigung erstellen
              </h4>
              <div>
                <label className="text-xs font-medium mb-1 block">Titel</label>
                <Input
                  value={adminNewsTitle}
                  onChange={(e) => setAdminNewsTitle(e.target.value)}
                  placeholder="z.B. Neues Update verfügbar!"
                  className={`text-sm ${
                    isLightUi
                      ? "bg-white"
                      : "bg-stone-900 border-stone-700 text-stone-100"
                  }`}
                />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Text</label>
                <Textarea
                  value={adminNewsText}
                  onChange={(e) => setAdminNewsText(e.target.value)}
                  placeholder="Inhalt der Ankündigung..."
                  rows={3}
                  className={`text-sm resize-none ${
                    isLightUi
                      ? "bg-white"
                      : "bg-stone-900 border-stone-700 text-stone-100"
                  }`}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowCreateNews(false)}
                >
                  Abbrechen
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    if (!adminNewsTitle.trim() || !adminNewsText.trim()) return;
                    broadcastNewsMutation.mutate({
                      title: adminNewsTitle.trim(),
                      text: adminNewsText.trim(),
                    });
                  }}
                  disabled={
                    broadcastNewsMutation.isPending ||
                    !adminNewsTitle.trim() ||
                    !adminNewsText.trim()
                  }
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {broadcastNewsMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                  ) : (
                    <Send className="w-4 h-4 mr-1.5" />
                  )}
                  An alle senden
                </Button>
              </div>
            </Card>
          )}

          {/* News List */}
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2
                className={`w-8 h-8 animate-spin ${
                  isLightUi ? "text-stone-400" : "text-stone-500"
                }`}
              />
            </div>
          ) : news.length === 0 ? (
            <div className="text-center py-12 px-4">
              <Bell
                className={`w-12 h-12 mx-auto mb-3 ${
                  isLightUi ? "text-stone-300" : "text-stone-600"
                }`}
              />
              <p
                className={`text-base font-semibold ${
                  isLightUi ? "text-stone-700" : "text-stone-300"
                }`}
              >
                Keine Server-News vorhanden
              </p>
              <p
                className={`text-xs mt-1 ${
                  isLightUi ? "text-stone-500" : "text-stone-400"
                }`}
              >
                Hier erscheinen zukünftig wichtige Ankündigungen und Updates.
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {news.map((item, index) => {
                const rawDate = item.created_date || item.created_at;
                const dateObj = rawDate ? new Date(rawDate) : null;
                const hasValidDate = dateObj && !Number.isNaN(dateObj.getTime());

                return (
                  <Card
                    key={item.id || index}
                    className={`border transition-all ${
                      isLightUi
                        ? "bg-white/90 border-stone-200/90 shadow-sm hover:border-[#c8ac62]/60"
                        : "bg-[#18211b]/70 border-[#f0e5a5]/20 hover:border-[#f0e5a5]/40"
                    }`}
                  >
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              index === 0 ? "bg-emerald-500" : "bg-amber-500/60"
                            }`}
                          />
                          <h3
                            className={`text-sm sm:text-base font-bold truncate ${
                              isLightUi ? "text-stone-900" : "text-stone-100"
                            }`}
                          >
                            {item.title || "Ankündigung"}
                          </h3>
                        </div>
                        {hasValidDate && (
                          <Badge
                            variant="outline"
                            className={`text-[10px] shrink-0 font-normal ${
                              isLightUi
                                ? "border-stone-300 text-stone-600 bg-stone-50"
                                : "border-stone-700 text-stone-400 bg-stone-900/50"
                            }`}
                          >
                            <Calendar className="w-3 h-3 mr-1 opacity-70" />
                            {formatDate(rawDate)}
                          </Badge>
                        )}
                      </div>

                      <p
                        className={`text-xs sm:text-sm leading-relaxed whitespace-pre-wrap ${
                          isLightUi ? "text-stone-700" : "text-stone-300/90"
                        }`}
                      >
                        {item.text}
                      </p>

                      {hasValidDate && (
                        <p
                          className={`text-[10px] text-right italic ${
                            isLightUi ? "text-stone-400" : "text-stone-500"
                          }`}
                        >
                          {formatDistanceToNow(dateObj, {
                            addSuffix: true,
                            locale: de,
                          })}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
