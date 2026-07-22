"""
Diagnose: Scan-Reward für einen bestimmten User prüfen.
Liest die letzten N Wallet-Ledger-Einträge mit Reward-Breakdown aus der DB.

Verwendung:
    python scripts\diagnose_scan_reward.py --display_name "Julian Voß"
    python scripts\diagnose_scan_reward.py --display_name "Julian Voß" --limit 5
"""

import os, sys, json, argparse
from pathlib import Path
import requests

# ── .env.local laden ──────────────────────────────────────────────────────────
def load_env(env_path: Path):
    env = {}
    if not env_path.exists():
        return env
    with open(env_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            env[key.strip()] = val.strip().strip('"').strip("'")
    return env

PROJECT_ROOT = Path(__file__).resolve().parent.parent
_env = load_env(PROJECT_ROOT / ".env.local")

SUPABASE_URL = _env.get("VITE_SUPABASE_URL") or os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = (
    _env.get("SUPABASE_SERVICE_ROLE_KEY")
    or _env.get("SERVICE_ROLE_KEY")
    or os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
)

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌  SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY nicht gefunden. Bitte .env.local prüfen.")
    sys.exit(1)

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

def supabase_get(path: str, params: dict = None, raw_query: str = None):
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    if raw_query:
        url = f"{url}?{raw_query}"
        resp = requests.get(url, headers=HEADERS, timeout=30)
    else:
        resp = requests.get(url, headers=HEADERS, params=params, timeout=30)
    resp.raise_for_status()
    return resp.json()

# ── Argumente ─────────────────────────────────────────────────────────────────
parser = argparse.ArgumentParser(description="Diagnose Scan-Reward für einen User")
parser.add_argument("--display_name", required=True, help='Anzeigename, z.B. "Julian Voß"')
parser.add_argument("--limit", type=int, default=3, help="Anzahl der letzten Scans (Standard: 3)")
args = parser.parse_args()

# ── 1. Profile finden ─────────────────────────────────────────────────────────
print(f"\n🔍  Suche Profil für: {args.display_name!r}")
import urllib.parse
profiles = supabase_get(
    "PublicProfile",
    raw_query=f"display_name=ilike.%25{urllib.parse.quote(args.display_name)}%25&select=auth_id,display_name,user_email&limit=5",
)
if not profiles:
    print("❌  Kein Profil gefunden.")
    sys.exit(1)

profile = profiles[0]
auth_id = profile["auth_id"]
print(f"✅  Gefunden: {profile['display_name']!r}  |  auth_id: {auth_id}")

# ── 2. Letzte N Scans ─────────────────────────────────────────────────────────
print(f"\n📋  Letzte {args.limit} Scans (UserPlantDiscovery):")
discoveries = supabase_get(
    "UserPlantDiscovery",
    {
        "auth_id": f"eq.{auth_id}",
        "select": "id,plant_id,discovered_date,discovery_location",
        "order": "discovered_date.desc",
        "limit": args.limit,
    },
)
for d in discoveries:
    print(f"  • {d['discovered_date']}  plant_id={d['plant_id']}  id={d['id']}")

# ── 3. Wallet-Ledger für diese Scans ──────────────────────────────────────────
print(f"\n💰  Wallet-Ledger-Einträge (letzte {args.limit} Scan-Rewards):")
ledger_entries = supabase_get(
    "RobotPlantWalletLedger",
    {
        "auth_id": f"eq.{auth_id}",
        "event_source": "in.(scan,new_scan,new_global_scan,new_season_scan,season_rediscovery)",
        "select": "id,event_source,event_reference,amount,created_at,metadata",
        "order": "created_at.desc",
        "limit": args.limit,
    },
)

if not ledger_entries:
    print("  Keine Einträge gefunden.")
else:
    for entry in ledger_entries:
        print(f"\n  ── {entry['created_at']}  source={entry['event_source']}  amount={entry['amount']} ──")
        print(f"     event_reference: {entry['event_reference']}")
        md = entry.get("metadata") or {}
        rb = md.get("reward_breakdown") or {}
        if rb:
            print(f"     Breakdown:")
            print(f"       baseReward:              {rb.get('baseReward')}")
            print(f"       healthStateLabel:        {rb.get('healthStateLabel')}  (bonus: {rb.get('healthStateBonus')})")
            print(f"       adjustedBaseReward:      {rb.get('adjustedBaseReward')}")
            print(f"       zoneMultiplier:          {rb.get('zoneMultiplier')}")
            print(f"       rarityMultiplier:        {rb.get('rarityMultiplier')}")
            print(f"       noveltyMultiplier:       {rb.get('noveltyMultiplier')}")
            print(f"       careMultiplier:          {rb.get('careMultiplier')}")
            print(f"       firstScanOfDayMult:      {rb.get('firstScanOfDayMultiplier')}")
            print(f"       streakMultiplier:        {rb.get('streakMultiplier')}")
            print(f"       preStreakReward:         {rb.get('preStreakReward')}  ← nach absoluteMaxReward-Cap (350)")
            print(f"       preTileClaimReward:      {rb.get('preTileClaimReward')}")
            print(f"       tileClaimMultiplier:     {rb.get('tileClaimMultiplier')}")
            print(f"       finalReward:             {rb.get('finalReward')}")
            # Berechne was OHNE Cap rausgekommen wäre
            adj = rb.get('adjustedBaseReward') or 0
            zm = rb.get('zoneMultiplier') or 1
            rm = rb.get('rarityMultiplier') or 1
            nm = rb.get('noveltyMultiplier') or 1
            cm = rb.get('careMultiplier') or 1
            fsm = rb.get('firstScanOfDayMultiplier') or 1
            sm = rb.get('streakMultiplier') or 1
            tc = rb.get('tileClaimMultiplier') or 1
            uncapped_pre = adj * zm * rm * nm * cm * fsm
            uncapped_final = uncapped_pre * sm * tc
            capped_at = rb.get('preStreakReward') or 0
            cap_loss = uncapped_final - (rb.get('finalReward') or 0)
            if capped_at == 350 and uncapped_pre > 350:
                print(f"\n     ⚠️  CAP GETROFFEN!")
                print(f"        Ohne 350er-Cap wäre preStreak = {uncapped_pre:.1f}")
                print(f"        Ungecapptes finalReward ≈ {uncapped_final:.0f}")
                print(f"        Verlust durch Cap: ~{cap_loss:.0f} Sparks")
        else:
            print(f"     (kein reward_breakdown in metadata)")

# ── 4. RobotPlant-State zum Zeitpunkt ─────────────────────────────────────────
print(f"\n🤖  Aktueller RobotPlant-State:")
rp_rows = supabase_get(
    "RobotPlant",
    {
        "auth_id": f"eq.{auth_id}",
        "select": "energy,data_quality,care,streak_days,claimed_tiles_count,updated_at",
    },
)
if rp_rows:
    rp = rp_rows[0]
    print(f"   energy={rp['energy']}  data_quality={rp['data_quality']}  care={rp['care']}  streak_days={rp['streak_days']}  tiles={rp.get('claimed_tiles_count')}  updated={rp['updated_at']}")
else:
    print("   Kein RobotPlant-Eintrag gefunden (defaults werden verwendet).")
