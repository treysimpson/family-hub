// T-19 (Google Photos screensaver) -- NOT WIRED YET. The Photos Library API
// and its OAuth scope (https://www.googleapis.com/auth/photoslibrary.readonly)
// aren't enabled on the project's existing GCP client yet, and enabling a
// new OAuth scope is exactly the kind of change the project's autonomous
// loop flags for Trey rather than pushing live on its own (see
// family-hub-project.md, "Right now").
//
// Once that scope exists, this is where a real implementation goes: call
// https://photoslibrary.googleapis.com/v1/mediaItems:search (a saved album
// ID, or a date-range search) with the existing accessToken pattern already
// used in googleCalendar.js/googleSheets.js, and return a flat array of
// {id, baseUrl} the same shape fetchScreensaverPhotos stubs out below so
// Screensaver.jsx doesn't need to change when this gets filled in.
export async function fetchScreensaverPhotos() {
  return [];
}
