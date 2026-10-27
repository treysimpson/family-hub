import { describe, it, expect, beforeEach } from 'vitest';
import {
  periodKeyFor, isChoreDone, toggleChoreDone, daysDoneInWeek, totalCompletions,
  pointsEarned, pointsSpent, pointsBalance, redeemReward, redemptionHistory,
  getChoreDefinitions, addChore, removeChore,
} from './chores';

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

describe('points and rewards (T-36)', () => {
  const chores = [{ id: 'ch10', points: 5 }, { id: 'ch11', points: 10 }];

  it('sums each completion by that chore\'s own point value', () => {
    toggleChoreDone('bryce', 'ch10', '2026-10-25'); // +5
    toggleChoreDone('bryce', 'ch10', '2026-10-26'); // +5 (a different period, both count)
    toggleChoreDone('bryce', 'ch11', '2026-10-26'); // +10
    expect(pointsEarned('bryce', chores)).toBe(20);
  });

  it('ignores a chore\'s points if a different chore with that id isn\'t passed in', () => {
    toggleChoreDone('bryce', 'ch10', '2026-10-26');
    expect(pointsEarned('bryce', [])).toBe(0); // caller didn't pass ch10's point value at all
  });

  it('redeeming deducts from the balance and is reflected in history', () => {
    toggleChoreDone('emery', 'ch10', '2026-10-26'); // +5
    toggleChoreDone('emery', 'ch11', '2026-10-26'); // +10
    expect(pointsBalance('emery', chores)).toBe(15);

    redeemReward('emery', { id: 'r1', title: 'Pick movie night', cost: 10 });
    expect(pointsSpent('emery')).toBe(10);
    expect(pointsBalance('emery', chores)).toBe(5);
    expect(redemptionHistory('emery')).toHaveLength(1);
    expect(redemptionHistory('emery')[0].title).toBe('Pick movie night');
  });

  it('keeps balances independent per person', () => {
    toggleChoreDone('bryce', 'ch11', '2026-10-26'); // +10
    redeemReward('bryce', { id: 'r2', title: 'x', cost: 5 });
    expect(pointsBalance('bryce', chores)).toBe(5);
    expect(pointsBalance('emery', chores)).toBe(0); // untouched
  });
});

describe('chore definitions (add/remove)', () => {
  it('falls back to mockData defaults until something is saved', () => {
    const defs = getChoreDefinitions();
    expect(defs.bryce.some((c) => c.id === 'ch10')).toBe(true); // "Make bed" from mockData
  });

  it('adding a chore appears in later reads, with a generated id and defaults filled in', () => {
    addChore('bryce', { text: 'Walk the dog', freq: 'Daily', routine: 'Morning routine', points: '8' });
    const defs = getChoreDefinitions();
    const added = defs.bryce.find((c) => c.text === 'Walk the dog');
    expect(added).toBeTruthy();
    expect(added.freq).toBe('Daily');
    expect(added.routine).toBe('Morning routine');
    expect(added.points).toBe(8); // coerced from the string an <input> would give
    expect(added.id).toBeTruthy();
  });

  it('keeps an explicit 0 points value, rather than silently defaulting it to 5 (the add-chore form\'s input allows min="0")', () => {
    addChore('bryce', { text: 'Say good morning', freq: 'Daily', routine: '', points: 0 });
    const added = getChoreDefinitions().bryce.find((c) => c.text === 'Say good morning');
    expect(added.points).toBe(0);
  });

  it('still defaults to 5 points for a genuinely blank or invalid points field', () => {
    addChore('bryce', { text: 'Blank points', freq: 'Daily', routine: '', points: '' });
    expect(getChoreDefinitions().bryce.find((c) => c.text === 'Blank points').points).toBe(5);
    addChore('bryce', { text: 'Invalid points', freq: 'Daily', routine: '', points: 'abc' });
    expect(getChoreDefinitions().bryce.find((c) => c.text === 'Invalid points').points).toBe(5);
  });

  it('an empty/blank routine is stored as null, not an empty string', () => {
    addChore('emery', { text: 'Pack lunch', freq: 'Daily', routine: '  ', points: 5 });
    const added = getChoreDefinitions().emery.find((c) => c.text === 'Pack lunch');
    expect(added.routine).toBeNull();
  });

  it('removing a chore drops only that one, leaving the rest untouched', () => {
    const before = getChoreDefinitions().trey.length;
    removeChore('trey', 'ch1'); // "Take out trash"
    const after = getChoreDefinitions();
    expect(after.trey).toHaveLength(before - 1);
    expect(after.trey.some((c) => c.id === 'ch1')).toBe(false);
    expect(after.trey.some((c) => c.id === 'ch2')).toBe(true); // untouched
  });

  it('adding/removing for one person never touches another person\'s list', () => {
    addChore('bryce', { text: 'x', freq: 'Daily', routine: '', points: 5 });
    const after = getChoreDefinitions();
    expect(after.emery).toHaveLength(5); // mockData's original Emery count, untouched
  });
});
