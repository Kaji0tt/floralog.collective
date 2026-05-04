# iOS OTA Update - .ipa Erstellung & WhatsApp-Verteilung

## 🚀 Voraussetzungen
- **Mac mit macOS** (Windows kann kein iOS bauen!)
- Xcode 14+
- Apple Developer Account (kostenpflichtig für App Store, aber kostenlos für Ad Hoc Builds)
- iOS Provisioning Profile & Certificate

---

## 📋 Schritt 1: Vorbereitung auf dem Mac

### 1.1 Repo auf Mac klonen
```bash
git clone https://github.com/Kaji0tt/base44-floralog.git
cd base44-floralog
npm install
npm run build  # Erstellt dist/
```

### 1.2 iOS-Projekt aktualisieren
```bash
npx cap sync ios
```

---

## 🔨 Schritt 2: In Xcode bauen

### 2.1 Xcode öffnen
```bash
open ios/App/App.xcworkspace  # Wichtig: .xcworkspace, nicht .xcodeproj!
```

### 2.2 Signing einrichten
1. **Xcode → App → Signing & Capabilities**
2. **Team** wählen (dein Apple Developer Account)
3. **Bundle Identifier** ggf. anpassen: `de.floralog.app`
4. **Provisioning Profile** wird automatisch erstellt

### 2.3 Build für physisches Gerät
```bash
# Oder in Xcode UI:
Product → Scheme → Edit Scheme
→ Run → Info → Destination: physisches iPhone wählen
→ Build
```

---

## 📦 Schritt 3: .ipa-Datei erstellen

### Option A: Ad Hoc Build (für Tester, kleine Gruppen)
**Beste Option für WhatsApp-Verteilung!**

```bash
xcodebuild archive \
  -workspace ios/App/App.xcworkspace \
  -scheme App \
  -configuration Release \
  -archivePath ./build/App.xcarchive

# Archive zu .ipa konvertieren
xcodebuild -exportArchive \
  -archivePath ./build/App.xcarchive \
  -exportOptionsPlist ios/ExportOptions.plist \
  -exportPath ./build/Releases
```

### Option B: Manuell über Xcode UI
1. **Product → Archive**
2. **Window → Organizer** öffnen
3. App-Archive auswählen → **Distribute App**
4. **Ad Hoc** wählen
5. **Next** → Team/Signing auswählen
6. **Export** → Speicherort wählen

Die `.ipa` wird dann generiert z.B. als `build/Releases/App.ipa`

---

## ⚙️ Schritt 4: ExportOptions.plist erstellen

Erstelle `ios/ExportOptions.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>ad-hoc</string>
    <key>teamID</key>
    <string>YOUR_TEAM_ID</string>
    <key>signingStyle</key>
    <string>automatic</string>
    <key>stripSwiftSymbols</key>
    <true/>
    <key>thinning</key>
    <string>&lt;none&gt;</string>
</dict>
</plist>
```

> **Hinweis:** `YOUR_TEAM_ID` findest du in Xcode unter **Preferences → Accounts → Team ID** oder auf der Apple Developer Website.

---

## 📱 Schritt 5: iPhone vorbereiten

### 5.1 UDID des iPhones finden
```bash
# Mac mit iPhone verbunden:
system_profiler SPUSBDataType | grep "Serial Number"
# Oder über Apple Configurator 2
```

### 5.2 Device in Provisioning Profile registrieren
1. [Apple Developer Portal](https://developer.apple.com/) öffnen
2. **Certificates, Identifiers & Profiles** → **Devices**
3. **+** → iPhone UDID eintragen
4. **Provisioning Profile** aktualisieren

---

## 📤 Schritt 6: WhatsApp-Verteilung

### Option 1: Direkt WhatsApp Chat
```bash
# .ipa in komprimiertes Verzeichnis packen (max 100 MB für WhatsApp)
# Einzelne .ipa ist normalerweise 50-150 MB, funktioniert also!

# Datei hochladen:
1. Öffne WhatsApp Desktop/Web
2. Chat mit Tester öffnen
3. .ipa-Datei anhängen
4. Senden
```

### Option 2: Cloud-Link (empfohlen für große Dateien)
```bash
# .ipa auf Firebase Storage, Dropbox, oder S3 hochladen
# Link teilen:

firebase storage:upload build/Releases/App.ipa \
  --token=$(gcloud auth application-default print-access-token)

# Oder einfach in Google Drive hochladen:
# 1. Drive Link generieren
# 2. In WhatsApp teilen
# 3. Empfänger kann direkt downloaden
```

### Option 3: Testflight (sicherer für größere Gruppen)
```bash
# .ipa zu Testflight hochladen:
1. App Store Connect → Apps → base44-app
2. Testflight → Builds
3. .ipa hochladen
4. Tester via Email einladen
# Vorteil: Installation über App Store, keine Signatur-Probleme
```

---

## 📥 Schritt 7: Installation auf dem iPhone

### Installation via Ad Hoc .ipa (direkter Download)
1. iPhone erhält .ipa via WhatsApp/Link
2. Tippe auf .ipa-Datei
3. → "In Dateien speichern"
4. **Dateien App** → .ipa anwählen
5. → Sollte automatisch installieren

**ODER via Xcode:**
```bash
xcodebuild -installPhoneBuild \
  build/Releases/App.ipa \
  -destination 'generic/platform=iOS'
```

**ODER manuell (iOS 13.0+):**
```bash
# .ipa via iTunes importieren (älter)
# Oder direkt am Mac:
open build/Releases/App.ipa  # Xcode öffnet → auf iPhone installieren
```

---

## 🔐 Wichtige Sicherheitshinweise

- **Ad Hoc Builds laufen nur auf registrierten Geräten** (max 100 Devices pro Year)
- **Provisioning Profile verfallen nach 1 Jahr**
- **Nicht im App Store veröffentlicht** (passt für interne Tester)
- **.ipa-Datei signiert mit deinem Developer Certificate** (kann nicht beliebig weitergegeben werden)

---

## 🧪 Testen vor Verteilung

```bash
# .ipa prüfen:
# 1. Mit imazing/Xcode auf echtem iPhone installieren
# 2. OTA-Feature testen:
#    - Home-Screen öffnen
#    - OTA-Banner sollte erscheinen (falls neue Version verfügbar)
#    - Update herunterladen & installieren
#    - App sollte neu mit neuem Bundle laden
```

---

## 🚨 Troubleshooting

| Problem | Lösung |
|---------|--------|
| "Developer not trusted" auf iPhone | Settings → General → VPN & Device Management → Certificate vertrauen |
| .ipa won't install | UDID fehlt im Provisioning Profile → neu generieren |
| "no provisioning profile" Error | Team auswählen + Auto Signing aktivieren |
| App stürzt direkt ab | Swift-Syntax-Fehler prüfen, Logs in Xcode ansehen |
| OTA-Bundle wird nicht geladen | `.ota_active_path` in UserDefaults prüfen |

---

## 📚 Tipps

- **Versionsnummering:** In Xcode `Info.plist` → `Bundle versions string, short` + `Bundle version`
- **Icon/Launch Screen:** Assets in `ios/App/App/Assets.xcassets` hinzufügen
- **Capabilities:** Geolocation, Camera etc. in "Signing & Capabilities" aktivieren
- **Logs prüfen:** `Xcode → Window → Devices and Simulators → Console`

---

## ✅ Checkliste vor Release

- [ ] OTA Plugin kompiliert ohne Fehler
- [ ] .ipa erfolgreich erstellt
- [ ] Auf physischem iPhone installierbar
- [ ] OTA-Check funktioniert (Banner erscheint)
- [ ] Update-Download & Installation funktioniert
- [ ] App reloaded mit neuem Bundle

---

**Fertig!** 🎉 Deine .ipa ist bereit für WhatsApp-Verteilung.
