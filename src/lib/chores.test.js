import { describe, it, expect, beforeEach } from 'vitest';
import { periodKeyFor, isChoreDone, toggleChoreDone, daysDoneInWeek, totalCompletions } from './chores';

// Y/M/D constructor, matching how the app itself builds dates (new Date()
// with no args, then date-math via setDate()) -- an ISO date *string* like
// "2026-10-26" parses as UTC midnight, which can land on the previous local
// day depending on timezone. Month is 0-indexed, so Oct = 9.
function d(y, m, day) {
  return new Date(y, m - 1, day);
}

// vitest runs in plain Node by default (no jsdom) -- a minimal in-memory
// localStorage is enough for these pure-logic tests, without pulling in a
// full DOM environment dependency just for this.
beforeEach(() => {
  const store = new Map();
  global.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
});

describe('periodKeyFor', () => {
  it('Daily uses the exact date', () => {
    expect(periodKeyFor('Daily', d(2026, 10, 26))).toBe('2026-10-26');
  });

  it('Weekly uses that week\'s Sunday (matching the Calendar page\'s Sun-Sat week)', () => {
    // 2026-10-26 is a Monday; its week starts Sunday 2026-10-25.
    expect(periodKeyFor('Weekly', d(2026, 10, 26))).toBe('2026-10-25');
  });

  it('Monthly uses the year-month', () => {
    expect(periodKeyFor('Monthly', d(2026, 10, 26))).toBe('2026-10');
  });
});

describe('toggleChoreDone / isChoreDone', () => {
  it('toggles on then off, and persists via localStorage', () => {
    expect(isChoreDone('bryce', 'ch10', '2026-10-26')).toBe(false);
    expect(toggleChoreDone('bryce', 'ch10', '2026-10-26')).toBe(true);
    expect(isChoreDone('bryce', 'ch10', '2026-10-26')).toBe(true);
    expect(toggleChoreDone('bryce', 'ch10', '2026-10-26')).toBe(false);
    expect(isChoreDone('bryce', 'ch10', '2026-10-26')).toBe(false);
  });

  it('keeps different people/chores/periods independent', () => {
    toggleChoreDone('trey', 'ch1', '2026-10-25');
    expect(isChoreDone('beryl', 'ch1', '2026-10-25')).toBe(false); // different person
    expect(isChoreDone('trey', 'ch2', '2026-10-25')).toBe(false); // different chore
    expect(isChoreDone('trey', 'ch1', '2026-11-01')).toBe(false); // different period
  });
});

describe('daysDoneInWeek', () => {
  it('counts only the days actually marked done within that week', () => {
    const weekStart = d(2026, 10, 25); // Sunday
    toggleChoreDone('emery', 'ch18', '2026-10-25');
    toggleChoreDone('emery', 'ch18', '2026-10-27');
    toggleChoreDone('emery', 'ch18', '2026-11-05'); // outside this week -- shouldn't count
    expect(daysDoneInWeek('emery', 'ch18', weekStart)).toBe(2);
  });
});

describe('totalCompletions', () => {
  it('is a flat count across every chore and period, never negative or stuck', () => {
    expect(totalCompletions('bryce')).toBe(0);
    toggleChoreDone('bryce', 'ch10', '2026-10-26');
    toggleChoreDone('bryce', 'ch11', '2026-10-26');
    expect(totalCompletions('bryce')).toBe(2);
    toggleChoreDone('bryce', 'ch10', '2026-10-26'); // un-toggle
    expect(totalCompletions('bryce')).toBe(1);
  });
});
