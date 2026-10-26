import { useEffect, useState } from 'react';
import { LEAGUES, fetchScoreboard, getSportsSettings, matchesTrackedTeam } from '../lib/sports';

// Refetched often enough that a live score on the wall display doesn't look
// stuck, without hammering ESPN's API every render -- only runs while this
// page is actually mounted (see the weather/budget pattern in AppContext.jsx
// for the alternative "always polling in the background" approach; scores
// aren't needed anywhere outside this page, so that would just be wasted
// fetches most of the day).
const SCORES_REFRESH_MS = 60 * 1000;

function formatGameTime(iso) {
  return new Date(iso).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });
}

function GameRow({ event }) {
  const { home, away, state, detail } = event;
  const live = state === 'in';
  return (
    <div className="task-item">
      <div>
        <div className="task-text">
          {away?.name} @ {home?.name}
        </div>
        <div className="task-meta">
          <span className="task-due">
            {state === 'pre' ? formatGameTime(event.date) : detail}
          </span>
          {live && (
            <span className="task-tag" style={{ background: 'var(--ev-coral-bg)', color: 'var(--ev-coral-tx)' }}>
              ● Live
            </span>
          )}
        </div>
      </div>
      {state !== 'pre' && (
        <div style={{ marginLeft: 'auto', textAlign: 'right', fontWeight: 'var(--font-weight-heading)' }}>
          <div style={{ opacity: event.completed && !away?.winner ? 0.6 : 1 }}>
            {away?.abbr} {away?.score}
          </div>
          <div style={{ opacity: event.completed && !home?.winner ? 0.6 : 1 }}>
            {home?.abbr} {home?.score}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SportsPage() {
  const [settings, setSettings] = useState(() => getSportsSettings());
  const [scoresByLeague, setScoresByLeague] = useState({});
  const [error, setError] = useState(null);

  // Settings only change via the Settings panel (a separate component), so
  // re-read on focus/mount isn't enough -- but this page gets unmounted and
  // remounted on every nav switch (see PAGES in App.jsx), which already
  // covers "re-read after visiting Settings" for the common case.
  useEffect(() => {
    setSettings(getSportsSettings());
  }, []);

  useEffect(() => {
    if (!settings.leagueIds.length) return;
    let cancelled = false;
    const load = async () => {
      try {
        const results = await Promise.all(
          settings.leagueIds.map((id) => fetchScoreboard(id).then((events) => [id, events])),
        );
        if (!cancelled) {
          setScoresByLeague(Object.fromEntries(results));
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    };
    load();
    const intervalId = setInterval(load, SCORES_REFRESH_MS);
    return () => { cancelled = true; clearInterval(intervalId); };
  }, [settings.leagueIds]);

  if (!settings.leagueIds.length) {
    return (
      <div className="page active" id="page-sports" style={{ flexDirection: 'column', padding: '1.2em 1.6em', alignItems: 'center', justifyContent: 'center', gap: '0.5em' }}>
        <div className="wx-hero-desc">No leagues selected yet.</div>
        <div style={{ fontSize: '0.85em', color: 'var(--text-muted)' }}>Pick leagues to follow (and optionally your teams) in ⚙️ Settings.</div>
      </div>
    );
  }

  const trackedGames = settings.teamNames.length
    ? Object.values(scoresByLeague).flat().filter((e) => matchesTrackedTeam(e, settings.teamNames))
    : [];
  const trackedIds = new Set(trackedGames.map((e) => e.id));

  return (
    <div className="page full-page active" id="page-sports">
      <div className="fp-sidebar">
        <div className="fp-title">Sports</div>
        <div className="fp-subtitle">
          {settings.leagueIds.map((id) => LEAGUES.find((l) => l.id === id)?.label).join(' · ')}
        </div>
        {!!settings.teamNames.length && (
          <div style={{ marginTop: '1em' }}>
            <div className="filter-section-label">Your teams</div>
            <div style={{ fontSize: '0.85em', color: 'var(--text-muted)' }}>{settings.teamNames.join(', ')}</div>
          </div>
        )}
        <div style={{ marginTop: 'auto', fontSize: '0.72em', color: 'var(--text-muted)' }}>
          Scores via ESPN · refreshes every minute
        </div>
      </div>

      <div className="fp-main" style={{ overflow: 'hidden' }}>
        {error && <div style={{ color: 'var(--ev-coral-tx)', marginBottom: '0.8em' }}>Couldn't load scores — {error}</div>}

        {!!trackedGames.length && (
          <>
            <div className="task-section-head">Your teams</div>
            {trackedGames.map((e) => <GameRow key={e.id} event={e} />)}
          </>
        )}

        {settings.leagueIds.map((id) => {
          const league = LEAGUES.find((l) => l.id === id);
          // Already shown above in "Your teams" -- don't repeat it here.
          const events = (scoresByLeague[id] || []).filter((e) => !trackedIds.has(e.id));
          return (
            <div key={id}>
              <div className="task-section-head">{league?.label}</div>
              {events.map((e) => <GameRow key={e.id} event={e} />)}
              {!events.length && (
                <div style={{ color: 'var(--text-muted)', padding: '1em' }}>No games today.</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
