// T-13 (sports scores & schedules). ESPN's undocumented "site API" --
// no key, no auth, used read-only here exactly the way Open-Meteo is used
// in weather.js. It's not an official public API and could change/break
// without notice; if it ever does, this is the one file to fix.
//
// Which teams a family actually follows can't be guessed, so rather than
// hardcoding anyone's teams, this fetches a whole league's scoreboard and
// lets settings (see getSportsSettings/saveSportsSettings below) pick which
// leagues to show and which team names to highlight -- a free-text match
// against ESPN's own team names, not a curated team-ID list, so typing
// "Broncos" or "Avalanche" just works without a lookup step.

export const LEAGUES = [
  { id: 'nfl', sport: 'football', league: 'nfl', label: 'NFL' },
  { id: 'college-football', sport: 'football', league: 'college-football', label: 'College Football' },
  { id: 'nba', sport: 'basketball', league: 'nba', label: 'NBA' },
  { id: 'mens-college-basketball', sport: 'basketball', league: 'mens-college-basketball', label: 'College Basketball' },
  { id: 'nhl', sport: 'hockey', league: 'nhl', label: 'NHL' },
  { id: 'mlb', sport: 'baseball', league: 'mlb', label: 'MLB' },
];

// Per-device setting, same localStorage-only pattern as the Budget PIN
// (src/components/PinGate.jsx) -- no Sheets/sync needed for "which leagues
// do we like," and it keeps this feature from touching the Budget
// spreadsheet or Apps Script at all.
const STORAGE_KEY = 'fh-sports-settings';

export function getSportsSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { leagueIds: [], teamNames: [] };
    const parsed = JSON.parse(raw);
    return { leagueIds: parsed.leagueIds || [], teamNames: parsed.teamNames || [] };
  } catch {
    return { leagueIds: [], teamNames: [] };
  }
}

export function saveSportsSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage full or blocked (private window, etc.) -- same non-fatal
    // reasoning as chores.js's save()/saveRedemptions()/saveChoreDefinitions():
    // the settings still work for the session via React state, they just
    // won't persist across a reload. Without this, SettingsPanel.jsx's
    // toggleLeague/addTeam/removeTeam would throw uncaught from a plain
    // onClick handler instead of failing soft like every other localStorage
    // writer in this codebase.
  }
}

function normalizeEvent(event) {
  const competition = event.competitions?.[0];
  const competitors = competition?.competitors || [];
  const home = competitors.find((c) => c.homeAway === 'home');
  const away = competitors.find((c) => c.homeAway === 'away');
  const team = (c) => (c ? {
    name: c.team?.displayName || c.team?.name || '',
    abbr: c.team?.abbreviation || '',
    score: c.score ?? null,
    winner: !!c.winner,
  } : null);

  const status = event.status || {};
  return {
    id: event.id,
    shortName: event.shortName || event.name || '',
    date: event.date,
    state: status.type?.state || 'pre', // 'pre' | 'in' | 'post'
    completed: !!status.type?.completed,
    detail: status.type?.shortDetail || '',
    home: team(home),
    away: team(away),
  };
}

// One league's full scoreboard for "today" per ESPN's own definition of the
// current slate (it spans late games correctly, unlike a naive local-date
// filter would).
export async function fetchScoreboard(leagueId) {
  const def = LEAGUES.find((l) => l.id === leagueId);
  if (!def) throw new Error(`Unknown league: ${leagueId}`);
  const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${def.sport}/${def.league}/scoreboard`);
  if (!res.ok) throw new Error(`Scoreboard request failed for ${def.label}: ${res.status}`);
  const data = await res.json();
  return (data.events || []).map(normalizeEvent);
}

// True if either side's name/abbreviation contains any tracked team name
// (case-insensitive) -- a loose match so "broncos" matches "Denver Broncos"
// without needing an exact team-ID lookup.
export function matchesTrackedTeam(event, teamNames) {
  if (!teamNames.length) return false;
  const needles = teamNames.map((n) => n.toLowerCase().trim()).filter(Boolean);
  const haystacks = [event.home?.name, event.home?.abbr, event.away?.name, event.away?.abbr]
    .filter(Boolean)
    .map((s) => s.toLowerCase());
  return needles.some((needle) => haystacks.some((h) => h.includes(needle)));
}
