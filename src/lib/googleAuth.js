// Google Identity Services (GIS) browser token flow — no backend, no client secret.
// https://developers.google.com/identity/oauth2/web/guides/use-token-model

const CLIENT_ID = '214844293769-vrmfljk6r20969u86vkb4706e4p7gkrd.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/tasks';
const STORAGE_KEY = 'fh-google-token';

let gisLoadPromise = null;
function loadGis() {
  if (gisLoadPromise) return gisLoadPromise;
  gisLoadPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) { resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });
  return gisLoadPromise;
}

function readStoredToken() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.accessToken || !parsed.expiresAt) return null;
    if (Date.now() >= parsed.expiresAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

function storeToken(accessToken, expiresInSeconds) {
  const expiresAt = Date.now() + expiresInSeconds * 1000;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ accessToken, expiresAt }));
  return { accessToken, expiresAt };
}

function clearStoredToken() {
  sessionStorage.removeItem(STORAGE_KEY);
}

let tokenClient = null;
async function getTokenClient() {
  await loadGis();
  if (!tokenClient) {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: () => {}, // overridden per-call below
    });
  }
  return tokenClient;
}

// prompt: '' for silent renewal (no UI if the browser still has an active Google
// session), 'consent'/undefined for an explicit sign-in the user initiated.
function requestToken({ prompt } = {}) {
  return new Promise(async (resolve, reject) => {
    const client = await getTokenClient();
    client.callback = (response) => {
      if (response.error) { reject(new Error(response.error)); return; }
      resolve(storeToken(response.access_token, response.expires_in));
    };
    client.requestAccessToken({ prompt });
  });
}

export function getStoredToken() {
  return readStoredToken();
}

export async function signIn() {
  return requestToken({ prompt: 'consent' });
}

export async function trySilentSignIn() {
  try {
    return await requestToken({ prompt: '' });
  } catch {
    return null;
  }
}

export function signOut() {
  const stored = readStoredToken();
  clearStoredToken();
  if (stored && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(stored.accessToken, () => {});
  }
}
