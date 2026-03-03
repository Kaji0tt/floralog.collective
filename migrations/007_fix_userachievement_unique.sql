-- Fix unique constraint on UserAchievement
-- Aktuell existiert (laut Fehlermeldung) ein Unique-Constraint "UserAchievement_auth_id_key",
-- der pro auth_id nur eine Zeile erlaubt. Das verhindert mehrere Achievements pro User.
-- Stattdessen soll pro (auth_id, achievement_id) nur EINE Zeile existieren.

alter table public."UserAchievement"
  drop constraint if exists "UserAchievement_auth_id_key";

-- Optional: falls noch kein eindeutiger Index auf (auth_id, achievement_id) existiert,
-- diesen erstellen. So kann ein User jedes Achievement genau einmal haben.
create unique index if not exists "UserAchievement_auth_achievement_unique"
  on public."UserAchievement" ("auth_id", "achievement_id");
