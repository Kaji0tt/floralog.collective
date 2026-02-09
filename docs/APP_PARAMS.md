# app-params (runtime config)

This document explains `src/lib/app-params.js` and the runtime parameters used by the frontend.

Purpose
- Centralize short-lived runtime parameters that can be provided via URL query parameters, persisted to `localStorage`, or defaulted from build-time environment variables.

Where the code lives
- `src/lib/app-params.js` — function `getAppParams()` and exported `appParams` object.

Common parameters
- `app_id` (VITE_BASE44_APP_ID): optional application id for Base44 initialization.
- `server_url` (VITE_BASE44_BACKEND_URL): backend base URL used by the SDK / API client.
- `access_token`: a short-lived access token that can be provided on the URL and will be stored to localStorage.
- `from_url`: the original URL the user came from (used for deep links and redirects).
- `functions_version`: optional version tag for serverless functions.

Behavior
- The helper reads query params first and writes them to localStorage (prefix `base44_`).
- If a query param is provided with `removeFromUrl: true`, it will be removed from the browser URL (for tokens).
- If no value is found, the helper falls back to Vite's `import.meta.env` defaults.

Recommendations
- Document required ENV keys in `.env.example` (VITE_BASE44_BACKEND_URL, VITE_BASE44_APP_ID).
- Use `appParams.serverUrl` as the single source of truth for API base URL in `src/api/base44Client`.
- Avoid scattering `import.meta.env` directly in many components — read config from `app-params`.

Example usage
```js
import { appParams } from '@/lib/app-params';
console.log('Backend URL:', appParams.serverUrl);
```
