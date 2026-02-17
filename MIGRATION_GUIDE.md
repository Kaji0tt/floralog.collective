# Floralog - Benutzer-Migration von base44 zu Supabase

## Überblick

Dieser Guide erklärt, wie alte Floralog-Benutzer (aus base44) zu Supabase Auth migriert werden.

---

## Schritt 1: Supabase Database vorbereiten

Führe das SQL-Migrations-Script aus:

1. Gehe zu **Supabase Dashboard** → **SQL Editor**
2. Öffne die Datei: [migrations/001_add_auth_id_to_user.sql](../migrations/001_add_auth_id_to_user.sql)
3. Kopiere den Inhalt in den SQL Editor
4. Klick "Run"

Dies fügt die `auth_id` Spalte zur `User` Tabelle hinzu, um alte Benutzer mit neuen Supabase Auth Users zu verlinken.

---

## Schritt 2: Benutzer-Flow verstehen

### Für alte Benutzer (mit Konto bei base44):

```
1. Benutzer besucht /migration/login
   ↓
2. Gibt seine alte E-Mail ein
   ↓
3. System prüft ob E-Mail in "User" Tabelle existiert
   ↓
4. Wenn ja: OTP-Code wird per E-Mail versendet
   ↓
5. Benutzer gibt OTP-Code ein
   ↓
6. Nach Bestätigung: Benutzer setzt neues Passwort
   ↓
7. Neuer Supabase Auth User wird erstellt
   ↓
8. Alte "User" Tabelle wird mit auth_id verlinkt
   ↓
9. Benutzer wird zu /login weitergeleitet
```

### Für neue Benutzer:

- Direkt zu `/register` gehen
- Email + Passwort eingeben
- Neuer Account wird in Supabase Auth erstellt

### Für normale Login:

- `/login` verwenden
- Email + Passwort (nach Migration)

---

## Routing Setup in App.jsx

Füge folgende Routes in deine React Router Config ein:

```jsx
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import MigrateLogin from '@/pages/MigrateLogin';
import SetPassword from '@/pages/SetPassword';
import ProtectedRoute from '@/components/ProtectedRoute';

// In deiner Router Config:
<Routes>
  {/* Auth Routes - offen für alle */}
  <Route path="/login" element={<Login />} />
  <Route path="/register" element={<Register />} />
  <Route path="/migration/login" element={<MigrateLogin />} />
  <Route path="/migration/set-password" element={<SetPassword />} />
  
  {/* Protected Routes - nur authentifizierte User */}
  <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
  <Route path="/collection" element={<ProtectedRoute><Collection /></ProtectedRoute>} />
  <Route path="/quests" element={<ProtectedRoute><Quests /></ProtectedRoute>} />
  {/* ... weitere protected routes */}
</Routes>
```

---

## Migration Service API

### Funktionen in [src/api/migrationService.js](../src/api/migrationService.js):

#### 1. `checkLegacyUser(email)`
Prüft ob alt User in "User" Tabelle existiert

```javascript
const user = await checkLegacyUser('test@example.com');
```

#### 2. `sendOtpToLegacyUser(email)`
Sendet OTP-Code per Email

```javascript
await sendOtpToLegacyUser('test@example.com');
```

#### 3. `verifyOtpCode(email, token)`
Verifiziert OTP-Code

```javascript
await verifyOtpCode('test@example.com', '123456');
```

#### 4. `completeMigration(email, password)`
Erstellt Supabase Auth User und verlinkt alte "User" Tabelle

```javascript
await completeMigration('test@example.com', 'SecurePassword123!');
```

---

## Supabase Auth Setup

Stelle sicher dass Email OTP aktiviert ist:

1. **Supabase Dashboard** → **Authentication** → **Providers**
2. **Email** aktiviert? ✅
3. Unter "Email" → "Confirm email" oder "OTP" aktiviert? ✅

---

## Wichtige Hinweise

### Sicherheit:
- ✅ Alte Passwörter sind NICHT in Supabase (base44 hat sie)
- ✅ 2FA via OTP schützt vor unbefugten Migrationen
- ✅ Neue Passwörter werden mit Supabase Auth verschlüsselt
- ✅ Row-Level-Security Policies schützen User-Daten

### Testing:
```bash
# Lokal testen
npm run dev

# Gehe zu http://localhost:5173/migration/login
# Gib deine Test-Email ein
# Supabase sendet OTP an deine Email
# Bestätige OTP und setze Passwort
```

### Produktivität:
```bash
# Build
npm run build

# Deploy zu Cloudflare
wrangler pages deploy dist/
```

---

## Troubleshooting

### ❌ "Email nicht gefunden"
- Prüfen ob Email in `User` Tabelle existiert
- Email Case-Sensitivity? (test@example.com vs Test@example.com)

### ❌ "OTP nicht erhalte"
- Prüfen Spam-Folder
- Supabase Email Provider konfiguriert?
- Email OTP Provider in Supabase enabled?

### ❌ "Passwort speichern fehlgeschlagen"
- Password Requirements prüfen (mind. 8 Zeichen, Große+kleine Buchst., Zahlen)
- Supabase Fehlerlog checken

---

## Nächste Schritte

Nach der Migration für alle Benutzer:

1. ✅ Basis Auth funktioniert
2. ⏳ **base44.entities Calls ersetzen** (große Baustelle)
3. ⏳ Row-Level-Security Policies setzen
4. ⏳ Realtime Subscriptions nutzen
5. ⏳ Offline-First mit local caching

---

**Fragen?** 💬 Schreib mir!
