import { describe, it, expect } from 'vitest';
import { buildAgendaGroups, buildMonthGrid, buildWeekDays, buildNextNDays } from './buildCalendarViews';

function ev(daysFromToday, today) {
  const d = new Date(today);
  d.setDate(d.getDate() + daysFromToday);
  return { start: d, end: d, title: `+${daysFromToday}d`, color: 'teal', who: '', location: '', notes: '' };
}

// Y/M/D/h/m constructor -- see dateGrid.test.js for why a bare ISO date
// *string* (no time part) is the wrong tool here: it parses as UTC and can
// land on the previous local day depending on timezone.
function d(y, m, day, h = 9, min = 0) {
  return new Date(y, m - 1, day, h, min);
}

function namedEvent(title, start, overrides = {}) {
  return { title, start, end: start, allDay: false, color: 'teal', who: 'Trey', location: '', notes: '', ...overrides };
}

describe('buildAgendaGroups', () => {
  // Regression test for a real bug (fixed 2026-10-26): `days` was declared
  // but never applied, so every future event showed up with no upper
  // bound at all, not just the intended ~2-week window.
  it('excludes events beyond the days horizon', () => {
    const today = new Date('2026-10-26T00:00:00');
    const events = [ev(1, today), ev(13, today), ev(15, today), ev(365, today)];
    const groups = buildAgendaGroups(events, today, 14);
    const titles = groups.flatMap((g) => g.items.map((i) => i.title));
    expect(titles).toEqual(['+1d', '+13d']);
  });

  it('excludes events that already ended', () => {
    const today = new Date('2026-10-26T00:00:00');
    const events = [ev(-1, today), ev(0, today)];
    const groups = buildAgendaGroups(events, today, 14);
    const titles = groups.flatMap((g) => g.items.map((i) => i.title));
    expect(titles).toEqual(['+0d']);
  });

  it('respects a custom days window', () => {
    const today = new Date('2026-10-26T00:00:00');
    const events = [ev(3, today), ev(10, today)];
    const groups = buildAgendaGroups(events, today, 5);
    const titles = groups.flatMap((g) => g.items.map((i) => i.title));
    expect(titles).toEqual(['+3d']);
  });
});

describe('buildMonthGrid', () => {
  // Note: this always builds the grid for the month *containing* `today`
  // -- there's no separate "target month" parameter, matching the real
  // app's current behavior (Month view has no month-navigation yet).
  it('places an event under the correct day cell', () => {
    const today = d(2026, 10, 26);
    const events = [namedEvent('Dentist', d(2026, 10, 26, 14, 0))];
    const grid = buildMonthGrid(events, today);
    const cell = grid.flat().find((c) => c.day === 26 && !c.otherMonth);
    expect(cell.events).toHaveLength(1);
    expect(cell.events[0].title).toBe('Dentist');
    expect(cell.events[0].label).toBe('2p Dentist'); // formatClockShort prefix for a timed event
  });

  it('labels an all-day event without a time prefix', () => {
    const today = d(2026, 10, 26);
    const events = [namedEvent('Spring break', d(2026, 10, 26), { allDay: true })];
    const grid = buildMonthGrid(events, today);
    const cell = grid.flat().find((c) => c.day === 26 && !c.otherMonth);
    expect(cell.events[0].label).toBe('Spring break');
  });

  it('leaves days with no events with an empty events array, not undefined', () => {
    const grid = buildMonthGrid([], d(2026, 10, 26));
    expect(grid.flat().every((c) => Array.isArray(c.events))).toBe(true);
  });
});

describe('buildWeekDays', () => {
  it('attaches weather by date key when provided', () => {
    const today = d(2026, 10, 26);
    const weatherByDate = new Map([['2026-10-26', { hi: 67, lo: 43, icon: '☀️' }]]);
    const days = buildWeekDays([], today, today, weatherByDate);
    const mon = days.find((dd) => dd.date === 26);
    expect(mon.hi).toBe(67);
    expect(mon.lo).toBe(43);
    expect(mon.wxIcon).toBe('☀️');
  });

  it('falls back to a dash icon and null hi/lo with no weather data', () => {
    const today = d(2026, 10, 26);
    const days = buildWeekDays([], today, today);
    expect(days[0].wxIcon).toBe('—');
    expect(days[0].hi).toBeNull();
  });

  it('places events on their own day only', () => {
    const today = d(2026, 10, 26);
    const events = [namedEvent('Soccer', d(2026, 10, 28, 16, 0))]; // Wednesday
    const days = buildWeekDays(events, today, today);
    const wed = days.find((dd) => dd.date === 28);
    const tue = days.find((dd) => dd.date === 27);
    expect(wed.events).toHaveLength(1);
    expect(tue.events).toHaveLength(0);
  });
});

describe('buildNextNDays', () => {
  it('returns n days starting today, each with its own events', () => {
    const today = d(2026, 10, 26);
    const events = [namedEvent('Bowling', d(2026, 10, 27, 18, 0))];
    const days = buildNextNDays(events, 5, today);
    expect(days).toHaveLength(5);
    expect(days[0].today).toBe(true);
    const withBowling = days.find((dd) => dd.events.length);
    expect(withBowling.events[0].title).toBe('Bowling');
  });

  it('only the first day is marked today', () => {
    const today = d(2026, 10, 26);
    const days = buildNextNDays([], 3, today);
    expect(days.filter((dd) => dd.today)).toHaveLength(1);
  });
});
