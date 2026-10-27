import { useEffect, useState } from 'react';
import { getSolarSettings, isConfigured, fetchSystemSummary } from '../lib/solar';

// T-14 (solar generation). Polls slowly on purpose -- unlike Sports scores
// or Spotify playback, solar production genuinely doesn't change second to
// second, and Enphase's free "Watt" developer plan has tighter rate limits
// than the paid tiers (see solar.js's module comment).
const SUMMARY_REFRESH_MS = 5 * 60 * 1000;

const centeredStyle = {
  flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.6em', textAlign: 'center',
};
const mutedStyle = { fontSize: '0.85em', color: 'var(--text-muted)', maxWidth: '30em' };

function formatEnergy(wh) {
  if (wh >= 1000000) return `${(wh / 1000000).toFixed(2)} MWh`;
  if (wh >= 1000) return `${(wh / 1000).toFixed(1)} kWh`;
  return `${wh} Wh`;
}

function formatPower(w) {
  if (w >= 1000) return `${(w / 1000).toFixed(2)} kW`;
  return `${w} W`;
}

export default function SolarPage() {
  const [settings] = useState(() => getSolarSettings());
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const [tokenExpired, setTokenExpired] = useState(false);

  const configured = isConfigured(settings);

  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    const load = async () => {
      try {
        const result = await fetchSystemSummary(settings);
        if (!cancelled) { setSummary(result); setError(null); setTokenExpired(false); }
      } catch (err) {
        if (cancelled) return;
        if (err.code === 'TOKEN_EXPIRED') setTokenExpired(true);
        else setError(err.message);
      }
    };
    load();
    const intervalId = setInterval(load, SUMMARY_REFRESH_MS);
    return () => { cancelled = true; clearInterval(intervalId); };
    // settings is read once on mount (same pattern as Sports) -- Settings
    // panel changes take effect on next page visit, which remounts this
    // component (see PAGES in App.jsx).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured]);

  if (!configured) {
    return (
      <div className="page active" id="page-solar" style={centeredStyle}>
        <div className="wx-hero-desc">☀️ Solar isn't connected yet</div>
        <div style={mutedStyle}>
          This needs a one-time Enphase Enlighten developer signup (developer-v4.enphase.com, free
          "Watt" plan) and a manual OAuth consent to get an API Key, Access Token, and your System ID
          — Enphase's token exchange requires a Client Secret that can't safely live in this app's
          public code, so unlike Google/Spotify this can't complete sign-in by itself (see
          <code style={{ margin: '0 0.3em' }}>src/lib/solar.js</code>
          for the full reasoning). Once you have those three values, paste them into ⚙️ Settings →
          Solar. The Access Token expires after about a day, so plan on refreshing it there
          periodically the same way.
        </div>
      </div>
    );
  }

  if (tokenExpired) {
    return (
      <div className="page active" id="page-solar" style={centeredStyle}>
        <div className="wx-hero-desc">☀️ Solar access token expired</div>
        <div style={mutedStyle}>
          Enphase access tokens are only valid for about a day. Get a fresh one (your Refresh Token
          is good for about a month) and paste it into ⚙️ Settings → Solar.
        </div>
      </div>
    );
  }

  return (
    <div className="page active" id="page-solar" style={{ flexDirection: 'column', padding: '1.2em 1.6em', gap: '1em' }}>
      {error && <div style={{ color: 'var(--ev-coral-tx)' }}>Couldn't reach Enphase — {error}</div>}
      {summary ? (
        <>
          <div style={{ display: 'flex', gap: '1.5em', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '0.78em', color: 'var(--text-muted)' }}>Current output</div>
              <div style={{ fontSize: '1.8em', fontWeight: 'var(--font-weight-heading)' }}>{formatPower(summary.currentPowerW)}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.78em', color: 'var(--text-muted)' }}>Today</div>
              <div style={{ fontSize: '1.8em', fontWeight: 'var(--font-weight-heading)' }}>{formatEnergy(summary.energyTodayWh)}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.78em', color: 'var(--text-muted)' }}>Lifetime</div>
              <div style={{ fontSize: '1.8em', fontWeight: 'var(--font-weight-heading)' }}>{formatEnergy(summary.energyLifetimeWh)}</div>
            </div>
          </div>
          <div style={{ fontSize: '0.78em', color: 'var(--text-muted)' }}>
            Status: {summary.status || 'unknown'}
            {summary.lastReportAt && ` · as of ${summary.lastReportAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}
          </div>
        </>
      ) : (
        !error && <div style={mutedStyle}>Loading solar production…</div>
      )}
    </div>
  );
}
