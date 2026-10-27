// T-20 (Spotify now playing / control). PKCE Authorization Code flow --
// no backend, no client secret, same backend-less shape as googleAuth.js's
// token model (https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow).
//
// CLIENT_ID is deliberately empty: this needs a one-time Spotify Developer
// app registration under Trey's own account (developer.spotify.com/dashboard
// -> Create app), which is an account action, not something to do from here
// -- same category as T-14's Enlighten key and T-19's Photos OAuth scope.
// Once Trey has a Client ID, paste it in below and add both
// `http://localhost:5183/family-hub/` and the real GitHub Pages URL
// (`https://treysimpson.github.io/family-hub/`) as Redirect URIs in the
// Spotify app's dashboard settings -- they must match REDIRECT_URI below
// exactly, including the trailing slash. Nothing else needs to change;
// isConfigured() flips true the moment CLIENT_ID is non-empty, which is all
// MusicPage.jsx checks to leave its "not connected yet" state.
const CLIENT_ID = '';
const SCOPES = 'user-read-currently-playing user-read-playback-state user-modify-playback-state';

// Computed lazily (not a module-scope const) since `window` doesn't exist
// under vitest's plain-Node test environment (no jsdom here -- see
// chores.test.js) -- only startAuthorization()/handleRedirectCallback()
// below ever call this, and neither is exercised by the pure-function/
// mocked-fetch tests in spotify.test.js.
function redirectUri() {
  return `${window.location.origin}${import.meta.env.BASE_URL}`;
}

const STORAGE_KEY = 'fh-spotify-token';
const VERIFIER_KEY = 'fh-spotify-pkce-verifier';
// Spotify access tokens live ~1hr; refresh a little early so a poll never
// has to deal with a just-expired token mid-request.
const REFRESH_MARGIN_MS = 60 * 1000;

export function isConfigured() {
  return !!CLIENT_ID;
}

function base64UrlEncode(bytes) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function generateCodeVerifier() {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(64)));
}

export async function generateCodeChallenge(verifier) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64UrlEncode(new Uint8Array(digest));
}

function readStoredToken() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStoredToken(token) {
  try {
    // Kiosk-style long-running tab, not a browser session you'd expect to
    // sign out of by closing it -- localStorage (not sessionStorage, unlike
    // googleAuth.js's shorter-lived Google token) so playback control
    // survives a page reload without re-authorizing every time.
    localStorage.setItem(STORAGE_KEY, JSON.stringify(token));
  } catch {
    // Storage full/blocked -- same fail-soft reasoning as every other
    // localStorage writer in this codebase (chores.js, sports.js). Playback
    // still works for the current session via the returned token value,
    // it just won't survive a reload.
  }
}

export function getStoredToken() {
  return readStoredToken();
}

export function signOut() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to roll back to -- a blocked removeItem just means a stale
    // token sits in storage; getValidAccessToken() below still refreshes
    // or fails safely the next time it's read.
  }
}

// Kicks off the redirect-based auth flow. Nothing to await on the caller's
// side -- this navigates the whole page away to Spotify's own consent
// screen, same as a plain link click.
export async function startAuthorization() {
  const verifier = generateCodeVerifier();
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  const challenge = await generateCodeChallenge(verifier);
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: redirectUri(),
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  });
  window.location.href = `https://accounts.spotify.com/authorize?${params}`;
}

// Call once on app mount (see AppContext.jsx). A no-op whenever the current
// URL has no `?code=` -- i.e. every normal page load that isn't the one
// Spotify redirects back to right after the user approves access.
export async function handleRedirectCallback() {
  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');
  if (!code) return null;

  // Strip the one-time auth params from the visible URL either way, so a
  // reload doesn't try to redeem an already-used (or abandoned) code again.
  url.searchParams.delete('code');
  url.searchParams.delete('state');
  window.history.replaceState({}, '', url.toString());

  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  sessionStorage.removeItem(VERIFIER_KEY);
  // Lost verifier -- e.g. the tab was closed/reloaded mid-flow, clearing
  // sessionStorage, before Spotify redirected back. Can't complete this
  // exchange; the user just clicks "Connect Spotify" again.
  if (!verifier) return null;

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri(),
    client_id: CLIENT_ID,
    code_verifier: verifier,
  });
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`Spotify token exchange failed: ${res.status}`);
  const json = await res.json();
  const token = {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  writeStoredToken(token);
  return token;
}

export async function refreshAccessToken(refreshToken) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: CLIENT_ID,
  });
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`Spotify token refresh failed: ${res.status}`);
  const json = await res.json();
  const token = {
    accessToken: json.access_token,
    // Spotify doesn't always rotate the refresh token on a refresh -- keep
    // the existing one when a new one isn't issued.
    refreshToken: json.refresh_token || refreshToken,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  writeStoredToken(token);
  return token;
}

// The one function callers should actually use before hitting any Spotify
// API below -- returns null when signed out or a refresh genuinely fails
// (e.g. access was revoked from Spotify's own account settings), so callers
// can treat "no token" and "needs to connect" as the same UI state.
export async function getValidAccessToken() {
  const stored = readStoredToken();
  if (!stored) return null;
  if (Date.now() < stored.expiresAt - REFRESH_MARGIN_MS) return stored.accessToken;
  try {
    const refreshed = await refreshAccessToken(stored.refreshToken);
    return refreshed.accessToken;
  } catch {
    signOut();
    return null;
  }
}

export function normalizeNowPlaying(raw) {
  if (!raw || !raw.item) return null;
  const { item } = raw;
  const images = item.album?.images || [];
  return {
    isPlaying: !!raw.is_playing,
    trackName: item.name || '',
    artistNames: (item.artists || []).map((a) => a.name).filter(Boolean).join(', '),
    albumName: item.album?.name || '',
    albumArtUrl: images[0]?.url || null,
    progressMs: raw.progress_ms ?? 0,
    durationMs: item.duration_ms ?? 0,
    deviceName: raw.device?.name || '',
  };
}

export async function fetchNowPlaying(accessToken) {
  const res = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  // 204/202: valid request, nothing is currently playing on any device --
  // not an error, just "no now-playing data to show."
  if (res.status === 204 || res.status === 202) return null;
  if (!res.ok) throw new Error(`Spotify now-playing request failed: ${res.status}`);
  const json = await res.json();
  return normalizeNowPlaying(json);
}

const PLAYBACK_ENDPOINTS = {
  play: { method: 'PUT', path: 'play' },
  pause: { method: 'PUT', path: 'pause' },
  next: { method: 'POST', path: 'next' },
  previous: { method: 'POST', path: 'previous' },
};

export async function controlPlayback(accessToken, action) {
  const endpoint = PLAYBACK_ENDPOINTS[action];
  if (!endpoint) throw new Error(`Unknown playback action: ${action}`);
  const res = await fetch(`https://api.spotify.com/v1/me/player/${endpoint.path}`, {
    method: endpoint.method,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  // 404 here specifically means no active Spotify Connect device (nothing
  // playing anywhere, e.g. all speakers idle) -- a real, expected state on
  // a family's accounts, not a bug, so it's surfaced as its own message
  // rather than a generic failure.
  if (res.status === 404) throw new Error('No active Spotify device');
  if (!res.ok && res.status !== 204) throw new Error(`Spotify ${action} failed: ${res.status}`);
}
