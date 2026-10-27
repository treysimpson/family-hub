import { useEffect, useState } from 'react';
import {
  isConfigured,
  getStoredToken,
  getValidAccessToken,
  fetchNowPlaying,
  controlPlayback,
  startAuthorization,
  signOut as spotifySignOut,
} from '../lib/spotify';

// T-20 (Spotify now playing / control). See spotify.js's own CLIENT_ID
// comment for the one-time Spotify Developer app setup this needs from
// Trey before any of this can go live -- everything below already works
// end-to-end against the real API once that's done, nothing here is a mock.
const NOW_PLAYING_REFRESH_MS = 5000;

const centeredStyle = {
  flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.6em', textAlign: 'center',
};
const mutedStyle = { fontSize: '0.85em', color: 'var(--text-muted)', maxWidth: '28em' };

function formatTime(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function MusicPage() {
  const [connected, setConnected] = useState(() => !!getStoredToken());
  const [nowPlaying, setNowPlaying] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  // Re-check in case a Spotify sign-in completed on this same page view
  // (handleRedirectCallback runs once in App.jsx, before this page may even
  // be mounted) -- cheap, local-storage-only read, not a network call.
  useEffect(() => {
    setConnected(!!getStoredToken());
  }, []);

  useEffect(() => {
    if (!connected) return;
    let cancelled = false;
    const load = async () => {
      try {
        const token = await getValidAccessToken();
        if (!token) { if (!cancelled) setConnected(false); return; }
        const np = await fetchNowPlaying(token);
        if (!cancelled) { setNowPlaying(np); setError(null); }
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    };
    load();
    const intervalId = setInterval(load, NOW_PLAYING_REFRESH_MS);
    return () => { cancelled = true; clearInterval(intervalId); };
  }, [connected]);

  const handleControl = async (action) => {
    setBusy(true);
    setError(null);
    try {
      const token = await getValidAccessToken();
      if (!token) { setConnected(false); return; }
      await controlPlayback(token, action);
      // Spotify needs a beat to actually apply play/pause/skip -- refetch
      // shortly after instead of waiting for the next full poll interval,
      // so the button's own state doesn't look stuck.
      setTimeout(async () => {
        try { setNowPlaying(await fetchNowPlaying(token)); } catch { /* next regular poll retries */ }
      }, 400);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = () => {
    spotifySignOut();
    setConnected(false);
    setNowPlaying(null);
  };

  if (!isConfigured()) {
    return (
      <div className="page active" id="page-music" style={centeredStyle}>
        <div className="wx-hero-desc">🎵 Music isn't connected yet</div>
        <div style={mutedStyle}>
          This needs a one-time Spotify Developer app registered under Trey's own account
          (developer.spotify.com/dashboard → Create app), then its Client ID pasted into
          <code style={{ margin: '0 0.3em' }}>src/lib/spotify.js</code>
          along with both redirect URIs listed in that file's comment. Nothing else needs to
          change — this page lights up the moment that's done.
        </div>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="page active" id="page-music" style={centeredStyle}>
        <div className="wx-hero-desc">🎵 Connect Spotify</div>
        <div style={mutedStyle}>See what's playing and control playback from the wall display.</div>
        <button className="add-btn" onClick={startAuthorization}>Connect Spotify</button>
      </div>
    );
  }

  return (
    <div className="page active" id="page-music" style={{ flexDirection: 'column', padding: '1.2em 1.6em', gap: '1.2em' }}>
      {error && <div style={{ color: 'var(--ev-coral-tx)' }}>Couldn't reach Spotify — {error}</div>}

      {nowPlaying ? (
        <div style={{ display: 'flex', gap: '1.2em', alignItems: 'center' }}>
          {nowPlaying.albumArtUrl && (
            <img
              src={nowPlaying.albumArtUrl}
              alt=""
              style={{ width: '8em', height: '8em', borderRadius: 'var(--card-radius)', objectFit: 'cover', flexShrink: 0 }}
            />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '1.3em', fontWeight: 'var(--font-weight-heading)' }}>{nowPlaying.trackName}</div>
            <div style={{ color: 'var(--text-muted)' }}>
              {nowPlaying.artistNames}{nowPlaying.albumName ? ` · ${nowPlaying.albumName}` : ''}
            </div>
            <div style={{ fontSize: '0.78em', color: 'var(--text-muted)', marginTop: '0.3em' }}>
              {formatTime(nowPlaying.progressMs)} / {formatTime(nowPlaying.durationMs)}
              {nowPlaying.deviceName ? ` · ${nowPlaying.deviceName}` : ''}
            </div>
          </div>
        </div>
      ) : (
        <div style={mutedStyle}>Connected — nothing playing right now. Start something on Spotify on any device and it'll show up here.</div>
      )}

      <div style={{ display: 'flex', gap: '0.6em' }}>
        <button className="add-btn" disabled={busy} onClick={() => handleControl('previous')} title="Previous">⏮</button>
        <button className="add-btn" disabled={busy} onClick={() => handleControl(nowPlaying?.isPlaying ? 'pause' : 'play')} title={nowPlaying?.isPlaying ? 'Pause' : 'Play'}>
          {nowPlaying?.isPlaying ? '⏸' : '▶'}
        </button>
        <button className="add-btn" disabled={busy} onClick={() => handleControl('next')} title="Next">⏭</button>
      </div>

      <button className="add-btn" style={{ marginTop: 'auto', alignSelf: 'flex-start' }} onClick={handleSignOut}>
        Disconnect Spotify
      </button>
    </div>
  );
}
