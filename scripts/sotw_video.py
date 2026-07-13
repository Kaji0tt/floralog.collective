"""
sotw_video.py  –  FloraLog „Scan der Woche" Slot-Machine-Video
==============================================================
Zieht automatisch alle Scans einer Kalenderwoche aus Supabase
und erstellt daraus ein 1080×1080 Slot-Machine-MP4.

Voraussetzungen (venv):
    pip install supabase python-dotenv opencv-python numpy Pillow requests

Aufruf (PowerShell, aus dem Projektverzeichnis):
    .\\venv\\Scripts\\Activate.ps1
    python scripts\\sotw_video.py            # aktuelle KW
    python scripts\\sotw_video.py --kw 27    # KW 27 des aktuellen Jahres
    python scripts\\sotw_video.py --kw 27 --year 2026
"""

import argparse
import os
import sys
import time
import math
import random
from datetime import datetime, timezone, timedelta
from pathlib import Path

import requests
import numpy as np
from PIL import Image

# ── .env.local laden (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) ─────────────

def load_env(env_path: Path):
    """Liest KEY=VALUE-Zeilen aus .env.local ohne externe Bibliothek."""
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


PROJECT_ROOT = Path(__file__).resolve().parent.parent   # …/base44-floralog
_env = load_env(PROJECT_ROOT / ".env.local")

SUPABASE_URL = _env.get("VITE_SUPABASE_URL") or os.environ.get("SUPABASE_URL", "")

# Service Role Key umgeht RLS (nötig um UserPlantDiscovery zu lesen).
# Einmalig in .env.local hinzufügen (ist gitignored):
#   SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_KEY = (
    _env.get("SUPABASE_SERVICE_ROLE_KEY")
    or _env.get("SERVICE_ROLE_KEY")
    or os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
)

if not SUPABASE_URL or not SUPABASE_KEY:
    print("[FEHLER] Supabase-URL oder Service Role Key fehlen.")
    print()
    print("  Füge folgende Zeile in .env.local ein (gitignored, sicher):")
    print("  SUPABASE_SERVICE_ROLE_KEY=eyJ...")
    print()
    print("  Den Key findest du in:")
    print("  Supabase Dashboard -> Project Settings -> API -> service_role (secret)")
    sys.exit(1)

# ── Video-Konfiguration ────────────────────────────────────────────────────────

VIDEO_WIDTH   = 1080
VIDEO_HEIGHT  = 1080
FPS           = 30

FAST_DURATION        = 4.0    # s – schnelles Rattern
SLOW_DURATION        = 5.0    # s – Verlangsamung
FINAL_HOLD           = 2.0    # s – letztes Bild stehen lassen
MIN_FRAMES_PER_IMAGE = 1      # schnellste Phase
MAX_FRAMES_PER_IMAGE = 45     # langsamste Phase

# ── Kalenderwoche → ISO-Timestamps ────────────────────────────────────────────

def week_bounds(kw: int, year: int):
    """Gibt (week_start, week_end) als ISO-8601-Strings zurück (UTC, Montag 00:00)."""
    monday = datetime.fromisocalendar(year, kw, 1)   # Python ≥ 3.8
    monday = monday.replace(tzinfo=timezone.utc)
    sunday_end = monday + timedelta(days=7)
    # PostgREST versteht 'Z' zuverlässiger als '+00:00'
    fmt = lambda d: d.strftime("%Y-%m-%dT%H:%M:%SZ")
    return fmt(monday), fmt(sunday_end)


# ── Supabase REST-Abfrage ──────────────────────────────────────────────────────

def supabase_get(table: str, params: dict) -> list:
    """Einfacher REST-GET ohne supabase-py Dependency."""
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Accept": "application/json",
        "Prefer": "count=none",
        "Range": "0-999",        # max 1000 Zeilen
    }
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    r = requests.get(url, headers=headers, params=params, timeout=20)
    r.raise_for_status()
    return r.json()


def fetch_scans(week_start: str, week_end: str) -> list[dict]:
    """
    Gibt Liste von {image_url, auth_id} für alle Scans der Woche zurück
    (nur Einträge mit image_url).
    """
    rows = supabase_get("UserPlantDiscovery", {
        "select": "id,image_url,auth_id",
        "discovered_date": f"gte.{week_start}",
        "and": f"(discovered_date.lt.{week_end})",
        "image_url": "not.is.null",
        "order": "id.asc",
    })
    return [r for r in rows if r.get("image_url")]


def fetch_display_names(auth_ids: list[str]) -> dict[str, str]:
    """Gibt {auth_id → display_name} zurück."""
    if not auth_ids:
        return {}
    id_list = ",".join(auth_ids)
    rows = supabase_get("PublicProfile", {
        "select": "auth_id,display_name",
        "auth_id": f"in.({id_list})",
    })
    return {str(r["auth_id"]): r.get("display_name") or "" for r in rows}


def fetch_plant_names(plant_ids: list[str]) -> dict[str, str]:
    """Gibt {plant_id → species_name} zurück."""
    if not plant_ids:
        return {}
    id_list = ",".join(plant_ids)
    rows = supabase_get("Plant", {
        "select": "id,species_name",
        "id": f"in.({id_list})",
    })
    return {str(r["id"]): r.get("species_name") or "" for r in rows}


# ── Supabase-Abfrage mit korrekten PostgREST-Parametern ──────────────────────

def fetch_scans_v2(week_start: str, week_end: str) -> list[dict]:
    """
    Nutzt PostgREST horizontal-filter Syntax korrekt.
    """
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Accept": "application/json",
        "Prefer": "count=none",
        "Range": "0-999",
    }
    params = [
        ("select", "id,image_url,auth_id,plant_id"),
        ("discovered_date", f"gte.{week_start}"),
        ("discovered_date", f"lt.{week_end}"),
        ("image_url", "not.is.null"),
        ("order", "id.asc"),
    ]
    url = f"{SUPABASE_URL}/rest/v1/UserPlantDiscovery"
    r = requests.get(url, headers=headers, params=params, timeout=20)
    r.raise_for_status()
    rows = r.json()
    return [row for row in rows if row.get("image_url")]


# ── Bilder herunterladen ───────────────────────────────────────────────────────

def download_images(scans: list[dict], display_names: dict[str, str],
                    plant_names: dict[str, str],
                    dest_dir: Path) -> tuple[list[Path], dict[str, tuple]]:
    dest_dir.mkdir(parents=True, exist_ok=True)
    paths = []
    path_to_name = {}   # path → (player_name, plant_name)
    total = len(scans)
    for i, scan in enumerate(scans, 1):
        url = scan["image_url"]
        player = display_names.get(str(scan.get("auth_id", "")), "")
        plant  = plant_names.get(str(scan.get("plant_id", "")), "")
        filename = url.split("/")[-1].split("?")[0]
        if not filename.lower().endswith(".jpg"):
            filename += ".jpg"
        dest = dest_dir / filename
        path_to_name[str(dest)] = (player, plant)
        if dest.exists():
            paths.append(dest)
            print(f"[DL]  ({i}/{total}) Übersprungen: {filename}")
            continue
        try:
            resp = requests.get(url, timeout=15)
            resp.raise_for_status()
            dest.write_bytes(resp.content)
            paths.append(dest)
            print(f"[DL]  ({i}/{total}) ✓ {filename}")
        except Exception as e:
            print(f"[DL]  ({i}/{total}) ✗ Fehler: {e}")
        time.sleep(0.05)
    print(f"[DL]  {len(paths)} Bilder bereit.")
    return paths, path_to_name


# ── Bild auf Zielgröße skalieren (cover, zentriert) ───────────────────────────

def fit_image(img_path: Path, width: int, height: int) -> np.ndarray:
    try:
        img = Image.open(img_path).convert("RGB")
        iw, ih = img.size
        scale = max(width / iw, height / ih)
        nw, nh = int(iw * scale), int(ih * scale)
        img = img.resize((nw, nh), Image.LANCZOS)
        left = (nw - width) // 2
        top  = (nh - height) // 2
        img = img.crop((left, top, left + width, top + height))
        return np.array(img)
    except Exception as e:
        print(f"[IMG] Fehler: {img_path.name}: {e}")
        return np.zeros((height, width, 3), dtype=np.uint8)


# ── Slot-Machine-Timing ────────────────────────────────────────────────────────

def build_frame_schedule(n_images, fast_dur, slow_dur, final_hold,
                         fps, min_fpb, max_fpb):
    schedule = []
    fast_frames = int(fast_dur * fps)
    slow_frames = int(slow_dur * fps)

    frames_used = 0
    idx = 0
    while frames_used < fast_frames:
        schedule.append((idx % n_images, min_fpb))
        frames_used += min_fpb
        idx += 1

    frames_spent = 0
    while frames_spent < slow_frames:
        t = frames_spent / slow_frames
        fpb = int(min_fpb + (max_fpb - min_fpb) * (t ** 1.8))
        fpb = max(min_fpb, min(max_fpb, fpb))
        schedule.append((idx % n_images, fpb))
        frames_spent += fpb
        idx += 1

    last_idx = schedule[-1][0]
    schedule.append((last_idx, int(final_hold * fps)))
    return schedule


# ── Video rendern ──────────────────────────────────────────────────────────────

def render_video(image_paths, path_to_name, output_path, width, height, fps,
                 fast_dur, slow_dur, final_hold, min_fpb, max_fpb):
    try:
        import cv2
    except ImportError:
        print("[FEHLER] opencv-python fehlt. Bitte: pip install opencv-python")
        sys.exit(1)

    n = len(image_paths)
    schedule = build_frame_schedule(n, fast_dur, slow_dur, final_hold,
                                    fps, min_fpb, max_fpb)
    total_frames = sum(f for _, f in schedule)
    print(f"[VID] {len(schedule)} Slots, {total_frames} Frames, ~{total_frames/fps:.1f} s")

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(str(output_path), fourcc, fps, (width, height))

    print("[VID] Lade Bilder in Cache...")
    cache = {}
    for i, path in enumerate(image_paths):
        cache[i] = fit_image(path, width, height)
        if (i + 1) % 20 == 0:
            print(f"       {i+1}/{n} gecacht")

    last_slot_pos = len(schedule) - 1
    winner_info = path_to_name.get(str(image_paths[schedule[-1][0] % n]), ("", ""))
    winner_player, winner_plant = winner_info
    print(f"[VID] Gewinner: {winner_player or '(unbekannt)'}  –  {winner_plant or '(Pflanze unbekannt)'}")

    def add_name_overlay(frame_bgr, player, plant):
        if not player and not plant:
            return frame_bgr
        overlay = frame_bgr.copy()
        h, w = overlay.shape[:2]
        # Zwei Zeilen → etwas höheres Band
        band_h = max(80, h // 9)
        cv2.rectangle(overlay, (0, h - band_h), (w, h), (0, 0, 0), -1)
        result = cv2.addWeighted(overlay, 0.75, frame_bgr, 0.25, 0)
        font = cv2.FONT_HERSHEY_SIMPLEX
        # Zeile 1: Pflanzenname (größer, oben im Band)
        scale1 = band_h / 55
        thick1 = max(1, int(scale1 * 2))
        if plant:
            ts1, _ = cv2.getTextSize(plant, font, scale1, thick1)
            tx1 = (w - ts1[0]) // 2
            ty1 = h - band_h + ts1[1] + max(8, band_h // 8)
            cv2.putText(result, plant, (tx1, ty1), font, scale1,
                        (200, 255, 180), thick1, cv2.LINE_AA)
        # Zeile 2: Spielername (kleiner, unten im Band)
        scale2 = band_h / 80
        thick2 = max(1, int(scale2 * 2))
        if player:
            label = f"von {player}"
            ts2, _ = cv2.getTextSize(label, font, scale2, thick2)
            tx2 = (w - ts2[0]) // 2
            ty2 = h - max(10, band_h // 8)
            cv2.putText(result, label, (tx2, ty2), font, scale2,
                        (200, 200, 200), thick2, cv2.LINE_AA)
        return result

    print("[VID] Rendere...")
    frame_count = 0
    for slot_i, (img_idx, n_frames) in enumerate(schedule):
        frame_rgb = cache[img_idx % n]
        frame_bgr = cv2.cvtColor(frame_rgb, cv2.COLOR_RGB2BGR)
        if slot_i == last_slot_pos:
            frame_bgr = add_name_overlay(frame_bgr, winner_player, winner_plant)
        for _ in range(n_frames):
            writer.write(frame_bgr)
            frame_count += 1
        if (slot_i + 1) % 50 == 0:
            print(f"       Slot {slot_i+1}/{len(schedule)}  ({frame_count/total_frames*100:.0f}%)")

    writer.release()
    print(f"\n✅  Video gespeichert: {output_path}")


# ── CLI ────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="FloraLog SOTW Slot-Machine-Video")
    parser.add_argument("--kw",   type=int, default=None, help="Kalenderwoche (1–53)")
    parser.add_argument("--year", type=int, default=None, help="Jahr (Standard: aktuelles Jahr)")
    args = parser.parse_args()

    now = datetime.now(tz=timezone.utc)
    year = args.year or now.year
    kw   = args.kw   or now.isocalendar().week

    week_start, week_end = week_bounds(kw, year)
    print(f"=== FloraLog SOTW  –  KW {kw}/{year} ===")
    print(f"    Zeitraum: {week_start[:10]} → {week_end[:10]}\n")

    # Ausgabe-Pfade – alles unter scripts/sotw/ (ist in .gitignore)
    out_dir   = PROJECT_ROOT / "scripts" / "sotw" / f"kw{kw:02d}_{year}"
    out_video = PROJECT_ROOT / "scripts" / "sotw" / f"kw{kw:02d}_{year}.mp4"

    # 1. Scans holen
    print("[DB]  Lade Scans aus Supabase...")
    scans = fetch_scans_v2(week_start, week_end)
    print(f"[DB]  Query: discovered_date gte {week_start} / lt {week_end}")
    if not scans:
        print("[DB]  Keine Scans mit Bild in dieser Woche gefunden. Abbruch.")
        sys.exit(0)
    print(f"[DB]  {len(scans)} Scans gefunden.")

    # 2. Display-Namen und Pflanzennamen holen
    auth_ids  = list({str(s["auth_id"])  for s in scans if s.get("auth_id")})
    plant_ids = list({str(s["plant_id"]) for s in scans if s.get("plant_id")})
    display_names = fetch_display_names(auth_ids)
    plant_names   = fetch_plant_names(plant_ids)
    print(f"[DB]  {len(display_names)} Profile, {len(plant_names)} Pflanzen geladen.")

    # 3. Bilder laden
    paths, path_to_name = download_images(scans, display_names, plant_names, out_dir)
    if not paths:
        print("Keine Bilder verfügbar. Abbruch.")
        sys.exit(1)

    # Zufällig mischen – letztes Bild = zufälliger "Gewinner"
    combined = list(zip(paths, [path_to_name[str(p)] for p in paths]))
    random.shuffle(combined)
    paths, infos = zip(*combined)
    path_to_name = {str(p): info for p, info in zip(paths, infos)}

    # 4. Video erstellen
    render_video(
        image_paths   = list(paths),
        path_to_name  = path_to_name,
        output_path   = out_video,
        width         = VIDEO_WIDTH,
        height        = VIDEO_HEIGHT,
        fps           = FPS,
        fast_dur      = FAST_DURATION,
        slow_dur      = SLOW_DURATION,
        final_hold    = FINAL_HOLD,
        min_fpb       = MIN_FRAMES_PER_IMAGE,
        max_fpb       = MAX_FRAMES_PER_IMAGE,
    )


if __name__ == "__main__":
    main()
