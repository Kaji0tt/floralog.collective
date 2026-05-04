#!/bin/bash
# iOS OTA Build Script
# Automatisiert das Erstellen der .ipa-Datei

set -e

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="$REPO_ROOT/build"
RELEASES_DIR="$BUILD_DIR/Releases"
ARCHIVE_PATH="$BUILD_DIR/App.xcarchive"

echo "🔨 iOS OTA Build Script"
echo "======================="

# 1. Prüfe ob auf Mac
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "❌ Dieses Skript muss auf macOS ausgeführt werden!"
    exit 1
fi

# 2. Prüfe ob Xcode installiert
if ! command -v xcodebuild &> /dev/null; then
    echo "❌ Xcode ist nicht installiert. Bitte installiere Xcode von der App Store."
    exit 1
fi

# 3. Erstelle Build-Verzeichnisse
mkdir -p "$BUILD_DIR"
mkdir -p "$RELEASES_DIR"

echo "✅ Umgebung validiert"

# 4. npm build (falls nötig)
echo "📦 Baue Web-Assets..."
if [ ! -d "$REPO_ROOT/dist" ]; then
    cd "$REPO_ROOT"
    npm install --legacy-peer-deps
    npm run build
    echo "✅ Web-Assets gebaut"
else
    echo "✅ dist/ existiert bereits"
fi

# 5. Capacitor sync
echo "🔄 Synchronisiere Capacitor..."
cd "$REPO_ROOT"
npx cap sync ios

# 6. Prüfe ExportOptions.plist
if ! grep -q "YOUR_TEAM_ID_HERE" "$REPO_ROOT/ios/ExportOptions.plist"; then
    echo "✅ ExportOptions.plist konfiguriert"
else
    echo "⚠️  WARNUNG: YOUR_TEAM_ID_HERE in ExportOptions.plist nicht ersetzt!"
    echo "📝 Bitte bearbeite ios/ExportOptions.plist und ersetze YOUR_TEAM_ID_HERE mit deiner Team ID"
    echo "   Team ID findest du in Xcode: Preferences → Accounts → Copy Team ID"
fi

# 7. Archive erstellen
echo "🏗️  Erstelle Archive..."
xcodebuild archive \
    -workspace "$REPO_ROOT/ios/App/App.xcworkspace" \
    -scheme App \
    -configuration Release \
    -archivePath "$ARCHIVE_PATH" \
    -allowProvisioningUpdates

echo "✅ Archive erstellt: $ARCHIVE_PATH"

# 8. .ipa exportieren
echo "📤 Exportiere .ipa..."
xcodebuild -exportArchive \
    -archivePath "$ARCHIVE_PATH" \
    -exportOptionsPlist "$REPO_ROOT/ios/ExportOptions.plist" \
    -exportPath "$RELEASES_DIR"

echo "✅ .ipa exportiert"

# 9. Finde und zeige .ipa-Datei
IPA_FILE=$(find "$RELEASES_DIR" -name "*.ipa" -type f | head -1)

if [ -n "$IPA_FILE" ]; then
    IPA_SIZE=$(du -h "$IPA_FILE" | cut -f1)
    echo ""
    echo "🎉 Erfolgreich!"
    echo "===================="
    echo "📁 Datei: $IPA_FILE"
    echo "📊 Größe: $IPA_SIZE"
    echo ""
    echo "📱 Nächste Schritte:"
    echo "1. iPhone via USB verbinden"
    echo "2. open \"$IPA_FILE\"  # Xcode öffnet die Installationsansicht"
    echo "3. Auf Installieren klicken"
    echo ""
    echo "📤 Oder für WhatsApp-Verteilung:"
    echo "1. cp \"$IPA_FILE\" ~/Desktop/"
    echo "2. In Google Drive hochladen oder über Mail/Cloud teilen"
else
    echo "❌ .ipa-Datei nicht gefunden!"
    exit 1
fi
