// T-14 (solar generation, Enphase/Enlighten). Deliberately NOT a full
// in-app OAuth flow like googleAuth.js (GIS) or spotify.js (PKCE) -- both
// of those were chosen specifically because they're public-client flows
// with no secret to protect. Enphase's own v4 API docs
// (developer-v4.enphase.com/docs/quickstart.html) only document a
// confidential-client flow: exchanging an authorization code (or refreshing
// a token) requires sending Client ID *and* Client Secret in a Basic Auth
// header to https://api.enphaseenergy.com/oauth/token. There is no
// documented PKCE/public-client alternative. Embedding that secret in this
// app's bundle would mean shipping it in plain text to GitHub Pages, where
// anyone can view-source it -- the exact thing this project's other
// integrations were deliberately designed to avoid. So this file never
// attempts that exchange itself; see SolarPage.jsx's "not connected" state
// for the one-time manual steps this needs from Trey instead (sign up for
// Enlighten's free "Watt" developer plan, create an app, complete the OAuth
// consent once via a plain curl command to get an access_token, then paste
// API Key / Access Token / System ID into Settings like Sports' leagues).
//
// Real endpoint, confirmed against Enphase's own v4 API field names (not
// guessed): GET /api/v4/systems/{system_id}/summary, Authorization: Bearer
// <access_token>, header `key: <api_key>`. Returns current_power (W),
// energy_today / energy_lifetime (Wh), status, last_report_at.
const API_BASE = 'https://api.enphaseenergy.com/api/v4';

// Per-device setting, same localStorage-only pattern as Sports
// (src/lib/sports.js) and the Budget PIN -- nothing here touches Sheets or
// Apps Script. accessToken is short-lived (Enphase: ~1 day) and has to be
// refreshed by Trey manually re-running the one-time token exchange
// (refresh_token lasts ~1 month) -- there's no way around that without
// either embedding the client secret here or standing up a backend, both
// bigger architecture changes than this optional backlog item warrants on
// its own. See SolarPage.jsx for how an expired token is surfaced.
const STORAGE_KEY = 'fh-solar-settings';

export function getSolarSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { apiKey: '', accessToken: '', systemId: '' };
    const parsed = JSON.parse(raw);
    return { apiKey: parsed.apiKey || '', accessToken: parsed.accessToken || '', systemId: parsed.systemId || '' };
  } catch {
    return { apiKey: '', accessToken: '', systemId: '' };
  }
}

export function saveSolarSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage full/blocked -- same fail-soft shape as sports.js's
    // saveSportsSettings and chores.js's save* functions.
  }
}

export function isConfigured(settings) {
  return !!(settings?.apiKey && settings?.accessToken && settings?.systemId);
}

export function normalizeSummary(raw) {
  if (!raw) return null;
  return {
    currentPowerW: raw.current_power ?? 0,
    energyTodayWh: raw.energy_today ?? 0,
    energyLifetimeWh: raw.energy_lifetime ?? 0,
    status: raw.status || '',
    lastReportAt: raw.last_report_at ? new Date(raw.last_report_at * 1000) : null,
  };
}

export async function fetchSystemSummary({ apiKey, accessToken, systemId }) {
  const res = await fetch(`${API_BASE}/systems/${systemId}/summary`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      key: apiKey,
    },
  });
  if (res.status === 401) {
    // Expired/invalid access_token specifically -- distinguished from a
    // generic failure so the UI can say "get a fresh token" instead of a
    // vague error (see the module comment above on why this can't just
    // silently refresh itself).
    const err = new Error('Solar access token expired or invalid');
    err.code = 'TOKEN_EXPIRED';
    throw err;
  }
  if (!res.ok) throw new Error(`Solar summary request failed: ${res.status}`);
  const json = await res.json();
  return normalizeSummary(json);
}
