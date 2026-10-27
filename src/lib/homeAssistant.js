// T-10 (Phase 4, Home Assistant smart-home control). Built 2026-10-27 ahead
// of the actual Raspberry Pi existing -- same "prepare the code now, wire
// it in the moment the real thing is reachable" pattern already used for
// Spotify/Enphase/the screensaver's Drive folder. Real, documented REST API
// shape (developers.home-assistant.io -> contributors.home-assistant.io,
// confirmed before writing this, not guessed): every request needs
// `Authorization: Bearer <long-lived access token>` (created once in the
// HA user profile's Security tab, valid 10 years) and
// `Content-Type: application/json`. No OAuth flow -- a long-lived token is
// pasted directly into Settings, same shape as Solar's now-shelved
// API-key/token fields.
//
// COMPLETELY UNTESTED against a real Home Assistant instance -- there is no
// Pi reachable from here yet (Trey: "I'll deal with the Pi later"). Every
// function below is verified against Home Assistant's own documented
// request/response shapes and covered by mocked-fetch tests
// (homeAssistant.test.js), not a live round-trip. Treat the first real
// connection attempt as the actual test, the same honest caveat already
// applied to T-17's Paprika import before Trey's first real export.
//
// Also unresolved, and worth deciding before this goes live on the actual
// wall display (not a code problem, an architecture one): this app is
// hosted on GitHub Pages over HTTPS, and a browser generally blocks an
// HTTPS page from calling a plain HTTP address on the local network (mixed-
// content blocking) -- which is what a Home Assistant instance's default
// local REST API is. Calling it from `npm run dev` (plain http://localhost)
// during development hits no such restriction, so everything below is
// buildable and testable now regardless -- but the production kiosk will
// need either HTTPS enabled on Home Assistant itself (a local cert) or some
// other resolution before `baseUrl` can be a real external-facing URL.
// Flagged, not solved here -- Trey's call once the Pi exists.

// Per-device setting, same localStorage-only pattern as Sports/the former
// Solar scaffold -- nothing here touches Sheets or Apps Script.
const STORAGE_KEY = 'fh-home-assistant-settings';

export function getHomeAssistantSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { baseUrl: '', accessToken: '' };
    const parsed = JSON.parse(raw);
    return { baseUrl: parsed.baseUrl || '', accessToken: parsed.accessToken || '' };
  } catch {
    return { baseUrl: '', accessToken: '' };
  }
}

export function saveHomeAssistantSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage full/blocked -- same fail-soft shape as every other
    // localStorage writer in this codebase.
  }
}

export function isConfigured(settings) {
  return !!(settings?.baseUrl && settings?.accessToken);
}

// Base URL is user-entered (e.g. "http://homeassistant.local:8123" or a Pi's
// local IP) -- trims any trailing slash so callers can always append
// "/api/..." directly without a double slash.
function apiBase_(baseUrl) {
  return baseUrl.replace(/\/+$/, '');
}

async function haRequest_(settings, path, options = {}) {
  const res = await fetch(`${apiBase_(settings.baseUrl)}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${settings.accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(`Home Assistant request failed: ${res.status}`);
  return res.json();
}

// Every entity's current state across the whole Home Assistant instance --
// {entity_id, state, attributes, last_changed, ...}. Domain-grouping
// (lights vs. climate vs. covers) happens in the caller, since the plain
// REST API gives a flat list with no "room" concept built in (that's HA's
// separate Areas feature -- not used here, since there's no live instance
// to confirm an Areas-based design actually fits how Trey's real devices
// end up organized).
export async function fetchStates(settings) {
  return haRequest_(settings, '/api/states');
}

export async function fetchState(settings, entityId) {
  return haRequest_(settings, `/api/states/${encodeURIComponent(entityId)}`);
}

// Calls any Home Assistant service, e.g. callService(settings, 'light',
// 'turn_on', { entity_id: 'light.kitchen', brightness_pct: 80 }) or
// callService(settings, 'climate', 'set_temperature', { entity_id: '...',
// temperature: 70 }). `data` must include entity_id (or target.entity_id);
// not defaulted here since some services act on more than one entity or
// none at all.
export async function callService(settings, domain, service, data) {
  return haRequest_(settings, `/api/services/${domain}/${service}`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Convenience wrappers for the specific actions HomeControlPage.jsx needs --
// thin, but keep the domain/service names and payload shapes (which this
// project has no other reason to memorize) in one place.
export function toggleLight(settings, entityId, turnOn) {
  return callService(settings, 'light', turnOn ? 'turn_on' : 'turn_off', { entity_id: entityId });
}

export function setLightBrightness(settings, entityId, brightnessPct) {
  return callService(settings, 'light', 'turn_on', { entity_id: entityId, brightness_pct: brightnessPct });
}

export function setThermostatTemperature(settings, entityId, temperature) {
  return callService(settings, 'climate', 'set_temperature', { entity_id: entityId, temperature });
}

// Garage doors (and similar) are Home Assistant's generic "cover" domain.
export function setCoverPosition(settings, entityId, open) {
  return callService(settings, 'cover', open ? 'open_cover' : 'close_cover', { entity_id: entityId });
}
