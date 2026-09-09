/**
 * JourneyGraph.jsx
 *
 * SVG-based radial node graph visualizing the user navigation journey.
 * Home is at the center; first-level destinations radiate outward;
 * sub-pages/actions radiate further from their parent node.
 *
 * Node radius and edge width scale with event frequency (count30d).
 * Nodes with no data are rendered as ghosts (low opacity).
 */

import { useMemo } from "react";

// ---------------------------------------------------------------------------
// Journey tree definition
// ---------------------------------------------------------------------------

const DEG = Math.PI / 180;

/** All nodes in the journey. angle = degrees from home center (0° = right). */
const JOURNEY_NODES = [
  // Level 0 – always visible hub
  { id: "home",                       label: "Home",           level: 0, parent: null,                    angle: 0,    color: "#15803d" },
  // Level 1 – direct from Home
  { id: "home_scan_click",            label: "Scannen",        level: 1, parent: "home",                  angle: -90,  color: "#22c55e" },
  { id: "home_customize_open",        label: "Anpassen",       level: 1, parent: "home",                  angle: -58,  color: "#d97706" },
  { id: "home_health_open",           label: "Gesundheit",     level: 1, parent: "home",                  angle: -26,  color: "#e11d48" },
  { id: "home_quiz_open",             label: "Quiz",           level: 1, parent: "home",                  angle: 4,    color: "#059669" },
  { id: "bottomnav_collection",       label: "Kollektion",     level: 1, parent: "home",                  angle: 34,   color: "#6366f1" },
  { id: "bottomnav_achievements",     label: "Aufgaben",       level: 1, parent: "home",                  angle: 70,   color: "#f59e0b" },
  { id: "bottomnav_social",           label: "Log",            level: 1, parent: "home",                  angle: 120,  color: "#10b981" },
  { id: "bottomnav_map",              label: "Karte",          level: 1, parent: "home",                  angle: 154,  color: "#06b6d4" },
  { id: "home_options_open",          label: "Optionen",       level: 1, parent: "home",                  angle: 186,  color: "#57534e" },
  { id: "home_event_stripe_weekly",   label: "Wochenaufgabe",  level: 1, parent: "home",                  angle: 220,  color: "#f59e0b" },
  { id: "home_event_stripe_monthly",  label: "Monatsaufgabe",  level: 1, parent: "home",                  angle: 250,  color: "#f97316" },
  { id: "bottomnav_home",             label: "Home-Button",    level: 1, parent: "home",                  angle: 282,  color: "#15803d" },
  { id: "home_panel_return",          label: "Header zurück",  level: 1, parent: "home",                  angle: 314,  color: "#94a3b8" },
  { id: "home_settings_open",         label: "Einstellungen",  level: 1, parent: "home",                  angle: 344,  color: "#78716c" },
  // Level 2 – from Anpassen
  { id: "home_badge_customize_open",  label: "Abzeichen",      level: 2, parent: "home_customize_open",   angle: -72,  color: "#ca8a04" },
  { id: "home_shop_stack_save",       label: "Speichern",      level: 2, parent: "home_customize_open",   angle: -42,  color: "#65a30d" },
  // Level 2 – from Optionen
  { id: "home_bug_report_open",       label: "Bugreport",      level: 2, parent: "home_options_open",     angle: 178,  color: "#dc2626" },
  { id: "home_server_news_open",      label: "Server-News",    level: 2, parent: "home_options_open",     angle: 196,  color: "#0284c7" },
  { id: "home_imprint_open",          label: "Impressum",      level: 2, parent: "home_options_open",     angle: 214,  color: "#64748b" },
  // Level 2 – from Aufgaben
  { id: "achievements_view_leaderboard", label: "Rangliste",  level: 2, parent: "bottomnav_achievements", angle: 48,   color: "#fbbf24" },
  { id: "achievements_view_quests",      label: "Aufgaben",   level: 2, parent: "bottomnav_achievements", angle: 70,   color: "#fb923c" },
  { id: "achievements_view_achievements",label: "Vergleiche", level: 2, parent: "bottomnav_achievements", angle: 92,   color: "#fdba74" },
  // Level 2 – from Log
  { id: "social_tab_explorer",        label: "Forscher-Log",   level: 2, parent: "bottomnav_social",       angle: 102,  color: "#34d399" },
  { id: "social_tab_news",            label: "Neuigkeiten",    level: 2, parent: "bottomnav_social",       angle: 120,  color: "#6ee7b7" },
  { id: "social_tab_friends",         label: "Freunde",        level: 2, parent: "bottomnav_social",       angle: 138,  color: "#a7f3d0" },
];

/** Edges to draw. */
const JOURNEY_EDGES = JOURNEY_NODES
  .filter((n) => n.parent !== null)
  .map((n) => ({ from: n.parent, to: n.id }));

// ---------------------------------------------------------------------------
// Layout computation
// ---------------------------------------------------------------------------

const W = 900;
const H = 620;
const CX = W / 2;
const CY = H / 2 - 10;
const L1_R = 185;  // distance from home to level-1 nodes
const L2_R = 90;   // distance from level-1 to level-2 nodes

function nodeRadius(count, level) {
  if (level === 0) return 42;
  if (count <= 0) return level === 1 ? 8 : 6;
  const base = level === 1 ? 12 : 8;
  const max  = level === 1 ? 30 : 22;
  return Math.min(max, base + Math.sqrt(count) * (level === 1 ? 3.2 : 2.5));
}

function computePositions(countMap) {
  const positions = {};
  const nodeById  = Object.fromEntries(JOURNEY_NODES.map((n) => [n.id, n]));

  JOURNEY_NODES.forEach((node) => {
    const count = countMap[node.id] ?? 0;
    const r     = nodeRadius(count, node.level);

    if (node.level === 0) {
      // Home – total of all direct nav events as proxy
      const homeProxy = JOURNEY_NODES
        .filter((n) => n.level === 1)
        .reduce((s, n) => s + (countMap[n.id] ?? 0), 0);
      positions[node.id] = { x: CX, y: CY, r, count: homeProxy };
      return;
    }

    if (node.level === 1) {
      const a = node.angle * DEG;
      positions[node.id] = {
        x: CX + Math.cos(a) * L1_R,
        y: CY + Math.sin(a) * L1_R,
        r, count, angle: node.angle,
      };
      return;
    }

    // Level 2 – extend from parent position in the node's angle direction
    const parent = nodeById[node.parent];
    const parentPos = positions[parent?.id];
    if (!parentPos) return;

    const a = node.angle * DEG;
    positions[node.id] = {
      x: parentPos.x + Math.cos(a) * L2_R,
      y: parentPos.y + Math.sin(a) * L2_R,
      r, count,
    };
  });

  return positions;
}

// ---------------------------------------------------------------------------
// Label placement helpers
// ---------------------------------------------------------------------------

function labelAnchor(px, refX) {
  const dx = px - refX;
  if (dx > 12)  return "start";
  if (dx < -12) return "end";
  return "middle";
}

function labelBaseline(py, refY) {
  const dy = py - refY;
  if (dy > 12)  return "hanging";
  if (dy < -12) return "auto";
  return "central";
}

function labelOffset(pos, refX, refY) {
  const dx = pos.x - refX;
  const dy = pos.y - refY;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const gap = pos.r + 11;
  return {
    lx: pos.x + (dx / dist) * gap,
    ly: pos.y + (dy / dist) * gap,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function JourneyGraph({ countMap = {} }) {
  const positions = useMemo(() => computePositions(countMap), [countMap]);
  const maxCount  = useMemo(() => Math.max(1, ...Object.values(countMap)), [countMap]);
  const nodeById  = useMemo(() => Object.fromEntries(JOURNEY_NODES.map((n) => [n.id, n])), []);

  const totalEvents = useMemo(
    () => JOURNEY_NODES.filter((n) => n.level > 0).reduce((s, n) => s + (countMap[n.id] ?? 0), 0),
    [countMap]
  );

  return (
    <div className="w-full">
      {totalEvents === 0 && (
        <p className="text-center text-sm text-stone-400 mb-3">
          Noch keine Navigationsdaten. Die Knoten füllen sich mit den ersten Nutzer-Aktionen.
        </p>
      )}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ maxHeight: 520 }}
        aria-label="User Journey Knotengraph"
      >
        <defs>
          <filter id="jgShadow" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.12" />
          </filter>
          <radialGradient id="homeGrad" cx="50%" cy="40%" r="60%">
            <stop offset="0%"   stopColor="#4ade80" />
            <stop offset="100%" stopColor="#15803d" />
          </radialGradient>
        </defs>

        {/* ── Edges ── */}
        {JOURNEY_EDGES.map(({ from, to }) => {
          const p1 = positions[from];
          const p2 = positions[to];
          if (!p1 || !p2) return null;
          const count  = countMap[to] ?? 0;
          const ratio  = count / maxCount;
          const sw     = count > 0 ? Math.max(1.5, Math.min(6, 1.5 + ratio * 5)) : 1;
          const op     = count > 0 ? 0.30 + ratio * 0.55 : 0.10;
          const color  = nodeById[to]?.color ?? "#d6d3d1";
          // Gentle quadratic bezier – control point slightly toward center
          const qx     = (p1.x + p2.x) / 2 + (CX - (p1.x + p2.x) / 2) * 0.12;
          const qy     = (p1.y + p2.y) / 2 + (CY - (p1.y + p2.y) / 2) * 0.12;
          return (
            <path
              key={`${from}-${to}`}
              d={`M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} Q ${qx.toFixed(1)} ${qy.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`}
              fill="none"
              stroke={color}
              strokeWidth={sw}
              strokeOpacity={op}
              strokeLinecap="round"
            />
          );
        })}

        {/* ── Nodes ── */}
        {JOURNEY_NODES.map((node) => {
          const pos   = positions[node.id];
          if (!pos) return null;
          const count  = pos.count ?? 0;
          const isHome = node.id === "home";
          const active = isHome || count > 0;

          // Label position
          const refX = isHome ? CX : (node.level === 2 ? (positions[node.parent]?.x ?? CX) : CX);
          const refY = isHome ? CY : (node.level === 2 ? (positions[node.parent]?.y ?? CY) : CY);
          const { lx, ly }       = labelOffset(pos, refX, refY);
          const anchor            = labelAnchor(lx, pos.x);
          const baseline          = labelBaseline(ly, pos.y);
          const labelFontSize     = node.level === 0 ? 13 : node.level === 1 ? 11 : 10;
          const countFontSize     = Math.max(8, Math.min(14, pos.r * 0.62));

          return (
            <g key={node.id} filter={active ? "url(#jgShadow)" : undefined} role="img" aria-label={`${node.label}: ${count} Events`}>
              <title>{node.label}: {count.toLocaleString("de-DE")} Events (30 Tage)</title>

              {/* Node circle */}
              <circle
                cx={pos.x}
                cy={pos.y}
                r={pos.r}
                fill={isHome ? "url(#homeGrad)" : node.color}
                fillOpacity={active ? 0.90 : 0.18}
                stroke={node.color}
                strokeWidth={isHome ? 3.5 : active ? 1.5 : 1}
                strokeOpacity={active ? 0.45 : 0.2}
              />

              {/* Count / icon inside node */}
              {active && (
                <text
                  x={pos.x}
                  y={pos.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={countFontSize}
                  fill="white"
                  fontWeight="700"
                  style={{ pointerEvents: "none" }}
                >
                  {isHome ? "🏠" : count.toLocaleString("de-DE")}
                </text>
              )}

              {/* Label outside node */}
              <text
                x={lx}
                y={ly}
                textAnchor={anchor}
                dominantBaseline={baseline}
                fontSize={labelFontSize}
                fill={active ? "#1c1917" : "#a8a29e"}
                fontWeight={active ? "600" : "400"}
                style={{ pointerEvents: "none" }}
              >
                {node.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 justify-center text-[10px] text-stone-500">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full" style={{ background: "#16a34a" }} />
          Ebene 1 (direkt von Home)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full" style={{ background: "#94a3b8" }} />
          Ebene 2 (Sub-Navigation)
        </span>
        <span className="flex items-center gap-1 italic">Knotengröße und Linienstärke = Klickhäufigkeit (30 Tage)</span>
      </div>
    </div>
  );
}
