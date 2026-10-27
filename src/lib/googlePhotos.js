// T-19 screensaver photos, built 2026-10-27. Deliberately NOT the Google
// Photos Library/Picker API -- see family-hub-project.md's T-19 history for
// the full reasoning, short version: Google deprecated whole-library read
// access in March 2025, and the Picker API replacement needs a human to
// interactively re-pick roughly weekly, which Trey explicitly said he
// doesn't want. This uses Google *Drive* instead: Trey/Beryl drop family
// photos into one Drive folder whenever they feel like it (named exactly
// "Family Hub Screensaver", so there's nothing to configure in-app), and
// this reads whatever's in there -- no session, no expiry, no re-picking,
// ever. Same no-backend Bearer-token REST pattern as every other googleX.js
// file in this project.
//
// Needs Trey to do two one-time things in Google Cloud Console before this
// actually works (same category as the Sheets write-scope upgrade,
// 2026-08-17): enable the "Google Drive API" for the project, and add
// `.../auth/drive.readonly` under OAuth consent screen -> Data Access ->
// Scopes. Until then, Drive API calls below will fail and listScreensaverPhotos
// fails soft to [] (see its try/catch) -- Screensaver.jsx falls back to the
// plain clock/weather background exactly like it did before this existed.
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const SCREENSAVER_FOLDER_NAME = 'Family Hub Screensaver';

async function driveRequest_(accessToken, path) {
  const res = await fetch(`${DRIVE_API}${path}`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`Drive API request failed: ${res.status}`);
  return res.json();
}

async function findScreensaverFolderId_(accessToken) {
  // Escaped the same way Drive's own docs recommend for a literal in a `q`
  // filter -- not strictly needed for this fixed constant name (no quotes/
  // backslashes in it), but cheap insurance if the folder name ever changes.
  const safeName = SCREENSAVER_FOLDER_NAME.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const q = `mimeType='application/vnd.google-apps.folder' and name='${safeName}' and trashed=false`;
  const params = new URLSearchParams({ q, fields: 'files(id,name)', pageSize: '1' });
  const data = await driveRequest_(accessToken, `/files?${params}`);
  return data.files?.[0]?.id || null;
}

// Flat list of {id, name} for every image directly in the screensaver
// folder (not recursive into subfolders -- keeping the setup to "one
// folder, drop photos in" rather than something that needs explaining).
// Fails soft to [] for any reason (folder doesn't exist yet, Drive API/
// scope not enabled yet, network hiccup) -- a screensaver photo feed isn't
// essential, so Screensaver.jsx's existing clock/weather-only fallback is
// always the safe default rather than surfacing an error on a wall display.
export async function listScreensaverPhotos(accessToken) {
  try {
    const folderId = await findScreensaverFolderId_(accessToken);
    if (!folderId) return [];
    const q = `'${folderId}' in parents and trashed=false and mimeType contains 'image/'`;
    const params = new URLSearchParams({ q, fields: 'files(id,name)', pageSize: '1000' });
    const data = await driveRequest_(accessToken, `/files?${params}`);
    return (data.files || []).map((f) => ({ id: f.id, name: f.name }));
  } catch {
    return [];
  }
}

// Fetches one photo's actual bytes (not a pre-signed link -- Drive's
// thumbnailLink has its own undocumented expiry, the same class of problem
// that ruled out the Photos Picker API, so this just re-fetches with the
// app's own already-auto-refreshed accessToken instead) and returns a
// browser object URL for it. Caller owns revoking it (URL.revokeObjectURL)
// once it's done being displayed, to avoid leaking memory over a wall
// display's effectively-infinite uptime.
export async function fetchPhotoBlobUrl(accessToken, fileId) {
  const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Drive photo fetch failed: ${res.status}`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
