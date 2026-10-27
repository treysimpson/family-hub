import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { listScreensaverPhotos, fetchPhotoBlobUrl } from '../lib/googlePhotos';

// T-19. Full-screen idle display (see SCREENSAVER_IDLE_MS / screensaverActive
// in AppContext.jsx and #screensaver in index.css) -- clock, date and
// current weather, now with a rotating photo background behind it when
// signed in and a Drive "Family Hub Screensaver" folder has photos in it
// (see googlePhotos.js for the full reasoning on why Drive, not the Photos
// API). Falls back to the plain --bg-screen gradient exactly like before
// this existed whenever signed out, not yet set up, or the folder's empty.
const PHOTO_ROTATE_MS = 30 * 1000;

export default function Screensaver() {
  const { screensaverActive, weather } = useApp();
  const { isSignedIn, accessToken } = useAuth();
  const [now, setNow] = useState(new Date());
  const [photos, setPhotos] = useState([]);
  const [photoUrl, setPhotoUrl] = useState(null);
  const photoIndexRef = useRef(0);
  const currentBlobUrlRef = useRef(null);

  useEffect(() => {
    if (!screensaverActive) return undefined;
    const id = setInterval(() => setNow(new Date()), 1000 * 15);
    return () => clearInterval(id);
  }, [screensaverActive]);

  // Re-checks the Drive folder every time the screensaver activates --
  // cheap, and naturally picks up photos added since the last activation
  // without needing a page reload.
  useEffect(() => {
    if (!screensaverActive || !isSignedIn || !accessToken) return;
    let cancelled = false;
    listScreensaverPhotos(accessToken).then((list) => {
      if (!cancelled) setPhotos(list);
    });
    return () => { cancelled = true; };
  }, [screensaverActive, isSignedIn, accessToken]);

  // Cycles through the fetched list, fetching a fresh blob URL for each
  // photo on the way in and revoking the previous one on the way out --
  // this runs for as long as the screensaver stays up (hours, on a wall
  // display), so leaking a blob URL per photo would add up.
  useEffect(() => {
    if (!screensaverActive || !photos.length || !accessToken) return undefined;
    let cancelled = false;

    const showNext = async () => {
      const photo = photos[photoIndexRef.current % photos.length];
      photoIndexRef.current += 1;
      try {
        const url = await fetchPhotoBlobUrl(accessToken, photo.id);
        if (cancelled) { URL.revokeObjectURL(url); return; }
        if (currentBlobUrlRef.current) URL.revokeObjectURL(currentBlobUrlRef.current);
        currentBlobUrlRef.current = url;
        setPhotoUrl(url);
      } catch {
        // A single missing/corrupt photo shouldn't stall the whole
        // rotation -- the next tick just tries the next one in the list.
      }
    };

    showNext();
    const id = setInterval(showNext, PHOTO_ROTATE_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [screensaverActive, photos, accessToken]);

  // Releases the current photo and resets rotation once the screensaver
  // goes inactive, so returning later starts clean instead of briefly
  // showing a stale frozen frame.
  useEffect(() => {
    if (screensaverActive) return;
    if (currentBlobUrlRef.current) {
      URL.revokeObjectURL(currentBlobUrlRef.current);
      currentBlobUrlRef.current = null;
    }
    setPhotoUrl(null);
    photoIndexRef.current = 0;
  }, [screensaverActive]);

  // Rendering nothing while inactive (rather than just relying on the CSS
  // opacity/pointer-events toggle) means the 15s clock tick never runs in
  // the common case, not just while hidden.
  if (!screensaverActive) return null;

  const time = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const date = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div id="screensaver" className={`show${photoUrl ? ' ss-has-photo' : ''}`}>
      {photoUrl && <div className="ss-photo-bg" style={{ backgroundImage: `url(${photoUrl})` }} />}
      <div className="ss-time">{time}</div>
      <div className="ss-date">{date}</div>
      {weather && (
        <div className="ss-wx">
          <span>{weather.now.icon}</span>
          <span>{weather.now.temp}°F</span>
        </div>
      )}
      <div className="ss-note">Family Hub</div>
    </div>
  );
}
