import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';

// T-19. Full-screen idle display (see SCREENSAVER_IDLE_MS / screensaverActive
// in AppContext.jsx and #screensaver in index.css). This is the honest
// "photos not wired in yet" version -- clock, date and current weather, no
// fake or placeholder photos pretending to be real ones. Once
// src/lib/googlePhotos.js has a real implementation (needs Trey to enable
// the Photos Library API + scope -- flagged, not done here), this becomes
// the place to cycle fetched photos behind the same clock/weather overlay
// rather than the plain gradient background.
export default function Screensaver() {
  const { screensaverActive, weather } = useApp();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    if (!screensaverActive) return undefined;
    const id = setInterval(() => setNow(new Date()), 1000 * 15);
    return () => clearInterval(id);
  }, [screensaverActive]);

  // Rendering nothing while inactive (rather than just relying on the CSS
  // opacity/pointer-events toggle) means the 15s clock tick never runs in
  // the common case, not just while hidden.
  if (!screensaverActive) return null;

  const time = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const date = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div id="screensaver" className={screensaverActive ? 'show' : ''}>
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
