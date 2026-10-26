import { describe, it, expect } from 'vitest';
import { matchesTrackedTeam } from './sports';

function event(homeName, awayName) {
  return { home: { name: homeName, abbr: homeName.slice(0, 3).toUpperCase() }, away: { name: awayName, abbr: awayName.slice(0, 3).toUpperCase() } };
}

describe('matchesTrackedTeam', () => {
  it('matches a loose substring, case-insensitively, against either team', () => {
    const e = event('Denver Broncos', 'Kansas City Chiefs');
    expect(matchesTrackedTeam(e, ['broncos'])).toBe(true);
    expect(matchesTrackedTeam(e, ['Chiefs'])).toBe(true);
    expect(matchesTrackedTeam(e, ['Avalanche'])).toBe(false);
  });

  it('matches by abbreviation too', () => {
    const e = event('Denver Broncos', 'Kansas City Chiefs');
    expect(matchesTrackedTeam(e, ['DEN'])).toBe(true);
  });

  it('returns false with no tracked teams configured', () => {
    const e = event('Denver Broncos', 'Kansas City Chiefs');
    expect(matchesTrackedTeam(e, [])).toBe(false);
  });

  it('matches if any one of several tracked names fits', () => {
    const e = event('Denver Broncos', 'Kansas City Chiefs');
    expect(matchesTrackedTeam(e, ['Avalanche', 'Broncos', 'Nuggets'])).toBe(true);
  });
});
