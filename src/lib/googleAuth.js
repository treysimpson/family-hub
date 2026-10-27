// Google Identity Services (GIS) browser token flow — no backend, no client secret.
// https://developers.google.com/identity/oauth2/web/guides/use-token-model

const CLIENT_ID = '214844293769-vrmfijk6r20969u86vkb4706e4p7gkrd.apps.googleusercontent.com';
// spreadsheets (not .readonly): the Budget page writes back manual category
// corrections and merchant-memory entries (T-11 Phase D).
// drive.readonly (added 2026-10-27, T-19): lets the screensaver read photos
// from a Drive folder Trey/Beryl drop family photos into -- see
// googlePhotos.js. Read-only, same reasoning as every other scope here.
const SCOPES = 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/tasks https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.readonly';
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

// The single shared tokenClient's .callback is reassigned by every call
// below, so if a second requestToken() starts before an earlier one's
// response arrives (e.g. the mount-time silent-renewal attempt still in
// flight when the user clicks "Sign in" on a slow connection), the earlier
// call's callback reference gets silently overwritten -- Google still
// calls back, but into the newer call's resolve/reject, so the earlier
// promise never settles at all. For an explicit signIn() that means
// AuthContext.jsx's "Signing in..." button stays stuck forever with no
// error, recoverable only by reloading the page. Tracked here so a new
// call can reject whichever call it's about to supersede instead of
// leaving it to hang.
let supersedePrevious = null;

// prompt: '' for silent renewal (no UI if the browser still has an active Google
// session), 'consent'/undefined for an explicit sign-in the user initiated.
function requestToken({ prompt } = {}) {
  supersedePrevious?.(new Error('Superseded by a newer sign-in request'));
  // Not an async executor: if getTokenClient() ever rejects (e.g. the GIS
  // script fails to load -- blocked by an ad blocker, no network), an async
  // executor's rejection has nowhere to go -- it doesn't call the outer
  // reject, so the returned promise would just hang forever and signIn()
  // would sit on "Signing in..." with no error ever shown. .catch(reject)
  // below routes that failure to the caller properly.
  return new Promise((resolve, reject) => {
    supersedePrevious = reject;
    const settle = (fn) => (arg) => {
      if (supersedePrevious === reject) supersedePrevious = null;
      fn(arg);
    };
    const resolveOnce = settle(resolve);
    const rejectOnce = settle(reject);
    getTokenClient().then((client) => {
      client.callback = (response) => {
        if (response.error) { rejectOnce(new Error(response.error)); return; }
        resolveOnce(storeToken(response.access_token, response.expires_in));
      };
      client.requestAccessToken({ prompt });
    }).catch(rejectOnce);
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
