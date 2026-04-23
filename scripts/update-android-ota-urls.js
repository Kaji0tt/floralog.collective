// Dieses Skript liest .env.ota.local und aktualisiert ota_urls.xml für Android
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.ota.local');
const xmlPath = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res', 'values', 'ota_urls.xml');

if (!fs.existsSync(envPath)) {
  console.error('.env.ota.local nicht gefunden!');
  process.exit(1);
}

const env = fs.readFileSync(envPath, 'utf-8');
const manifestUrl = env.match(/^VITE_OTA_MANIFEST_URL=(.*)$/m)?.[1] || '';
const bundleUrl = env.match(/^VITE_OTA_BUNDLE_URL=(.*)$/m)?.[1] || '';

if (!manifestUrl || !bundleUrl) {
  console.error('OTA URLs nicht gefunden!');
  process.exit(1);
}

const xml = `<?xml version='1.0' encoding='utf-8'?>\n<resources>\n    <string name="ota_manifest_url">${manifestUrl}</string>\n    <string name="ota_bundle_url">${bundleUrl}</string>\n</resources>\n`;

fs.writeFileSync(xmlPath, xml);
console.log('ota_urls.xml aktualisiert!');
