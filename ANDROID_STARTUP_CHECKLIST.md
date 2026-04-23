# Android App Startup Checklist & Troubleshooting

**Build-Datum:** 22. April 2026
**Status:** ✅ Erfolgreich konfiguriert und gebaut

---

## ✅ Pre-Flight Checks

Alle diese Checks wurden automatisch durchgeführt und bestätigt:

- ✅ **manifest.json erstellt** - PWA-Konfiguration aktiv
- ✅ **AndroidManifest.xml aktualisiert** - Camera, Geolocation, Storage Permissions
- ✅ **Service-Worker registriert** - push-sw.js wird beim Start geladen
- ✅ **Vite Build erfolgreich** - 2.9MB+ JavaScript gepackt
- ✅ **Capacitor Sync erfolgreich** - Web Assets zu Android kopiert
- ✅ **Gradle Build erfolgreich** - 13.8MB APK erstellt
- ✅ **Assets vorhanden**:
  - `android/app/src/main/assets/public/index.html` ✓
  - `android/app/src/main/assets/public/manifest.json` ✓
  - `android/app/src/main/assets/public/assets/index-*.js` ✓
  - `android/app/src/main/assets/public/push-sw.js` ✓

---

## 🚀 App Starten

### Option 1: Android Studio (Empfohlen)
1. Öffnen Sie Android Studio (sollte bereits offen sein)
2. Klicken Sie auf den **Play-Button ▶** oben rechts
3. Wählen Sie "Android Emulator" oder verbundenes Gerät
4. Warten Sie auf die Installation & Start

### Option 2: Terminal
```powershell
cd c:\Users\jasch\Documents\GitHub\base44-floralog
npx cap run android
# Folgen Sie den Prompts zum Auswählen des Geräts
```

---

## 📊 Logs Überwachen

### Live Logs während App-Start:

**View → Tool Windows → Logcat** (oder **Alt + 6** in Android Studio)

#### Filter setzen:
```
Oben: Dropdown = "Verbose"
Oben rechts: Suche = "ERROR"
```

#### Was Sie sehen werden:

**✅ ERFOLGREICH (App startet normal):**
```
04-22 14:35:12.123 I/Capacitor: BridgeActivity starting...
04-22 14:35:13.456 I/System: Loading manifest.json
04-22 14:35:14.789 I/React: App initialized
04-22 14:35:15.012 I/System: Permissions granted
```

**❌ FEHLER (schwarzer Bildschirm):**
```
ERROR: Cannot find element with id "root"
ERROR: Failed to load /manifest.json: 404
ERROR: JavaScript TypeError: Cannot read property 'querySelector'
ERROR: WebView crashed
ERROR: Permission denied: android.permission.CAMERA
```

---

## 🔧 Häufige Probleme & Lösungen

### Problem 1: Schwarzer Bildschirm
**Wahrscheinliche Ursachen:**
- React mounted nicht in `<div id="root"></div>`
- Assets (JS/CSS) laden nicht
- JavaScript Fehler in main.jsx

**Lösung:**
1. Öffnen Sie **Logcat** (Alt + 6)
2. Suchen Sie nach `ERROR`
3. Senden Sie die Fehlermeldung

### Problem 2: Weiße Seite statt schwarze
**Wahrscheinliche Ursache:**
- App lädt erfolgreich, aber zeigt nur leere Seite

**Lösung:**
1. Überprüfen Sie Logcat auf JavaScript Fehler
2. Könnte ein Runtime-Fehler in App.jsx sein

### Problem 3: App stürzt sofort ab
**Wahrscheinliche Ursache:**
- Permissions nicht gewährt
- Supabase Verbindung fehlgeschlagen
- Auth-Problem

**Lösung:**
1. Geben Sie Permissions frei (Dialog beim Start)
2. Überprüfen Sie Supabase Verbindung in .env
3. Siehe Logcat für genaue Fehlermeldung

### Problem 4: Camera/Geolocation funktioniert nicht
**Wahrscheinliche Ursache:**
- Runtime Permissions nicht gewährt
- Plugin nicht richtig initialisiert

**Lösung:**
```javascript
// App fordert um Permissions, wenn Camera/Geolocation benutzt wird
// Geben Sie im Dialog "Allow" an
```

---

## 🔍 Debug-Tipps

### Logcat Spalten verstehen:
```
[Timestamp] [AppID] [Level] [Tag] [Message]
04-22 14:35:12 de.floralog.app I/React: App initialized
                                           ↑       ↑
                                        Level     Tag
```

**Log Level:**
- `I/` = Info (grün)
- `W/` = Warning (orange)
- `E/` = Error (rot) ← Wichtigst!
- `D/` = Debug (blau)

### JavaScript in WebView debuggen:
1. Device muss verbunden sein (oder Emulator läuft)
2. Chrome öffnen: `chrome://inspect`
3. Unter "Remote Target" sollte Ihre App auftauchen
4. Klicken Sie "inspect" zum Öffnen der DevTools

---

## 📞 Wenn es nicht funktioniert

Bitte sammeln Sie diese Informationen:

1. **Screenshot von Logcat** mit ERROR-Zeilen
2. **Fehlermeldung** (kopieren Sie die komplette Nachricht)
3. **Was Sie sahen**: 
   - ⬛ Schwarzer Bildschirm?
   - ⚪ Weiße Seite?
   - 💥 App-Crash?
4. **Was Sie gemacht haben** (z.B. auf welchen Button geklickt?)

---

## ✅ Build-Informationen

| Komponente | Status | Details |
|------------|--------|---------|
| Vite Build | ✅ | 19.66s, 2.9MB |
| Gradle Build | ✅ | 59s, 13.8MB APK |
| Capacitor Sync | ✅ | 256ms |
| Lint | ✅ | Alle Checks bestanden |
| Assets | ✅ | 300+KB Web-Resources |
| Plugins | ✅ | Camera, Geolocation |

---

**Version: 1.0**
**Letzte Aktualisierung: 22. April 2026**
