## Plan: Home-Architektur für KI-Wartbarkeit

Home ist aktuell eine God-Komponente. Empfohlen ist ein hybrider Ansatz: kurzfristig eine sichere Entkopplung von Home in Feature-Hooks und ein HomeFeatureRoot (geringes Regressionsrisiko), gleichzeitig mit einer langfristig skalierbaren Zielarchitektur (Domain-Hooks + klarer Orchestrator), damit spätere Features nicht erneut in Home kollabieren.

**Steps**
1. Phase A: Baseline und Sicherheitsnetz (abhängig von nichts)
2. Definiere in Home die Verantwortungsgrenzen als Architekturvertrag (User/Profile, Robot-Plant/Care, Quests, Discovery/Map, Social, Notifications, Embedded Panels, Navigation).
3. Dokumentiere bestehende Query-Keys, Mutation-Invalidierungen und Event-Subscriptions aus Home in einer zentralen Mapping-Datei als Referenz für den Refactor (nur Dokumentation, keine Logikänderung).
4. Definiere explizit In-Scope/Out-of-Scope für die erste Welle: In Scope ist 1:1-Extraktion ohne Verhaltensänderung; Out-of-Scope sind visuelle Redesigns, Produktlogik-Neuerfindung und globale Store-Einführung.
5. Phase B: Kurzfristige Entkopplung (1-2 Wochen, Low Risk, abhängig von Phase A)
6. Erzeuge einen HomeFeatureRoot als dünnen Orchestrator analog etablierter FeatureRoot-Muster, sodass Home.jsx nur noch Routing/Hülle enthält.
7. Extrahiere zuerst risikoarme Bereiche in dedizierte Hooks (parallelisierbar): Notifications-Queue, User/Profile-Laden inkl. Subscriptions, Migration/Referral-Flow.
8. Extrahiere danach mittlere Komplexität (abhängig von 7): Robot-Plant-Care-Flow und Quest-Aggregation; dabei Logik unverändert umziehen, nur Schnittstellen klären.
9. Halte Geolocation/Zonen als eigene Extraktionswelle (abhängig von 8), weil hier die größte Kopplung (Cache, localStorage, Context, Live-Location) liegt; zuerst stabilisieren, dann extrahieren.
10. Phase C: Langfristige Skalierung (3-6 Wochen, Medium/High Risk, abhängig von stabiler Phase B)
11. Führe Domain-orientierte Hook-Gruppen unter src/components/home/hooks/ ein (HomeUser, HomePlant, HomeQuest, HomeDiscovery, HomeSocial, HomeZones) plus einen kompositorischen useHomeFeatureContent-Hook als einzige Integrationsfläche.
12. Trenne UI-State explizit von Domain-State: Panel-/Header-/Nav-Zustand in eigene UI-Hooks, Domänenabfragen in Data-Hooks, Seiteneffekte in Action-Hooks.
13. Zentralisiere Query-Invalidierung (ein Invalidation-Mapping), damit Mutationen reproduzierbar und KI-lesbar bleiben.
14. Etabliere Architektur-Guidelines für neue Home-nahe Features: Neue Logik nur noch über Hook-Module, keine neuen großen Effekte im Orchestrator.
15. Phase D: Verifikation und Governance (läuft teilweise parallel mit B/C)
16. Bei jedem Extraktionsschritt Verhaltensparität prüfen: gleiche Query-Aufrufe, gleiche Invalidierungen, gleiche Navigationseffekte.
17. Lint/Typecheck als Gate verwenden; für kritische Flows eine manuelle Testmatrix (Login, Zone-Bootstrap, Scan-Feedback, Quest/Reward, Embedded-Panels, Friends/News, Settings).
18. Ergänze ein kurzes Architektur-README für Home (Verantwortlichkeiten, Hook-Übersicht, Erweiterungsregeln), damit künftige KI-Agenten konsistent arbeiten.

**Relevant files**
- `src/pages/Home.jsx` — aktueller Monolith; wird auf Shell/Orchestrator reduziert.
- `src/components/home/HomeBackgroundShell.jsx` — bleibt Präsentationsbaustein.
- `src/components/home/PlantHeroHealthPanel.jsx` — bestehender UI-Baustein für Care/Health.
- `src/components/achievements/hooks/useAchievementsFeatureContent.jsx` — Referenzmuster für Hook-zentrierten Feature-Schnitt.
- `src/components/friends/hooks/useFriendsFeatureContent.jsx` — Referenzmuster für Embedded-Mode + FeatureRoot.
- `src/api/entities.js` — Query-Wrapper-Konventionen, an die Home-Hooks gebunden bleiben sollten.
- `src/lib/AuthContext.jsx` — bestehende globale Zuständigkeiten (Zone/Session-nahe Daten) als Integrationsgrenze.
- `src/lib/locationSync.js` — Geolocation- und Caching-Hilfen für Zone-Extraktion.
- `src/lib/robotPlantEconomy.js` — Domänenberechnungen, die aus Home heraus verlagert/reused werden.

**Verification**
1. Statische Qualität: eslint + typecheck ohne neue Hook-Regelverletzungen.
2. Verhaltensparität: Vorher/Nachher-Vergleich zentraler User-Flows (manuelle Testmatrix pro Phase).
3. Datenkonsistenz: Query-Invalidierungen aus Mapping-Datei gegen reales Mutation-Verhalten prüfen.
4. Performance/UX: Initial-Load, Re-Render-Frequenz und Panel-Wechsel subjektiv + per DevTools vergleichen.
5. Betriebsstabilität: Fehlerlogs für Geolocation/Zonen und Subscription-Cleanup während Extraktion eng monitoren.

**Decisions**
- Kurzfristig (1-2 Wochen) Vorteile: geringes Risiko, schnelle Lesbarkeitsgewinne, gute Grundlage für KI-Agenten; Nachteile: technische Schulden bleiben teilweise bestehen.
- Strategisch (3-6 Wochen) Vorteile: klarere Domänengrenzen, bessere Team-/KI-Skalierung, geringere langfristige Änderungskosten; Nachteile: höheres Übergangsrisiko und mehr Koordinationsaufwand.
- Empfehlung: Hybrid. Zuerst sichere Entkopplung (Phase B), danach gezielte strategische Konsolidierung (Phase C).
- Enthalten: Architektur- und Modul-Schnitt, Wartbarkeitsfokus, Regressionsarme Reihenfolge.
- Ausgeschlossen: Produktfeatures neu designen, vollständige Datenlayer-Neuerfindung, visuelles Redesign.

**Further Considerations**
1. Query-Key-Konventionen vereinheitlichen: Option A minimal weiterführen, Option B zentrales Key-Factory-Modul. Empfehlung: Option B ab Phase C.
2. Teststrategie ausbauen: Option A nur manuell + lint/typecheck, Option B zusätzlich schrittweise Hook-Tests. Empfehlung: Option B für kritische Domain-Hooks.
3. Zonenlogik-Schnitt: Option A vollständig in Home-Domain, Option B teilweise in AuthContext belassen. Empfehlung: Option B (stabile globale Verantwortungen nicht unnötig verschieben).