# SOTW – Scan der Woche Video

Slot-Machine-MP4 mit allen Scan-Bildern einer Woche.

## Einmalige Einrichtung

Folgenden Key in `.env.local` eintragen (gitignored, sicher):

```
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

→ Supabase Dashboard → Project Settings → API → `service_role` (secret)

---

## Wöchentlicher Ablauf

```powershell
# Terminal öffnen im Projektverzeichnis, venv aktivieren:
.\venv\Scripts\Activate.ps1

# Video für KW 28 generieren:
python scripts\sotw_video.py --kw 28

# Oder mit explizitem Jahr:
python scripts\sotw_video.py --kw 28 --year 2026
```

Kein Argument = aktuelle Kalenderwoche.

---

## Was das Script macht

1. Berechnet den Zeitraum der KW (Montag–Sonntag)
2. Fragt Supabase ab – alle `UserPlantDiscovery`-Scans mit `image_url`
3. Lädt `display_name` aus `PublicProfile`
4. Lädt Bilder herunter (werden pro KW gecacht)
5. Mischt zufällig – jeder Aufruf ergibt einen anderen Gewinner
6. Rendert das MP4 (Slot-Machine: schnell → langsam → Halt)

---

## Ausgabe

```
scripts/
├── sotw_images_kw28_2026/    ← Bilder-Cache (bleibt erhalten)
└── sotw_kw28_2026.mp4        ← fertiges Video
```

---

## Anforderungen (venv)

```
opencv-python, numpy, Pillow, requests
```

Bereits installiert in `venv/`.
