import { describe, it, expect } from 'vitest';
import {
  toDateKey, isSameDay, addDays, startOfWeek, startOfDay,
  getMonthGrid, getWeekDays, getNextNDays, formatClock, formatClockShort, groupByDateKey,
} from './dateGrid';

// Y/M/D constructor -- an ISO date *string* parses as UTC and can land on
// the previous local day depending on timezone (hit this for real writing
// chores.test.js earlier this session). Month is 0-indexed, so Oct = 9.
function d(y, m, day, h = 0, min = 0) {
  return new Date(y, m - 1, day, h, min);
}

describe('toDateKey', () => {
  it('pads single-digit month and day', () => {
    expect(toDateKey(d(2026, 3, 5))).toBe('2026-03-05');
  });
  it('does not pad a two-digit month/day', () => {
    expect(toDateKey(d(2026, 10, 26))).toBe('2026-10-26');
  });
});

describe('isSameDay', () => {
  it('is true for the same calendar day at different times', () => {
    expect(isSameDay(d(2026, 10, 26, 1, 0), d(2026, 10, 26, 23, 59))).toBe(true);
  });
  it('is false for a different day, month, or year', () => {
    expect(isSameDay(d(2026, 10, 26), d(2026, 10, 27))).toBe(false);
    expect(isSameDay(d(2026, 10, 26), d(2026, 11, 26))).toBe(false);
    expect(isSameDay(d(2026, 10, 26), d(2025, 10, 26))).toBe(false);
  });
});

describe('addDays', () => {
  it('adds and subtracts days, including across a month boundary', () => {
    expect(toDateKey(addDays(d(2026, 10, 30), 3))).toBe('2026-11-02');
    expect(toDateKey(addDays(d(2026, 10, 2), -5))).toBe('2026-09-27');
  });
  it('does not mutate the input date', () => {
    const original = d(2026, 10, 26);
    addDays(original, 5);
    expect(toDateKey(original)).toBe('2026-10-26');
  });
});

describe('startOfWeek', () => {
  it('rolls a mid-week date back to that week\'s Sunday', () => {
    expect(toDateKey(startOfWeek(d(2026, 10, 26)))).toBe('2026-10-25'); // Monday -> Sunday
  });
  it('leaves an already-Sunday date on the same day', () => {
    expect(toDateKey(startOfWeek(d(2026, 10, 25)))).toBe('2026-10-25');
  });
  it('zeroes the time of day', () => {
    const start = startOfWeek(d(2026, 10, 26, 15, 30));
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
  });
});

describe('startOfDay', () => {
  it('zeroes the time but keeps the same date', () => {
    const start = startOfDay(d(2026, 10, 26, 15, 30));
    expect(toDateKey(start)).toBe('2026-10-26');
    expect(start.getHours()).toBe(0);
  });
});

describe('getMonthGrid', () => {
  it('returns a 6x7 grid', () => {
    const grid = getMonthGrid(2026, 9, d(2026, 10, 26)); // October 2026 (month index 9)
    expect(grid).toHaveLength(6);
    grid.forEach((week) => expect(week).toHaveLength(7));
  });
  it('flags days outside the target month', () => {
    const grid = getMonthGrid(2026, 9, d(2026, 10, 26));
    const flat = grid.flat();
    expect(flat[0].otherMonth).toBe(true); // Oct 2026 starts on a Thursday, so the grid's first cell is a September day
    const oct26 = flat.find((c) => c.day === 26 && !c.otherMonth);
    expect(oct26.otherMonth).toBe(false);
  });
  it('flags exactly one cell as today', () => {
    const grid = getMonthGrid(2026, 9, d(2026, 10, 26));
    const todays = grid.flat().filter((c) => c.today);
    expect(todays).toHaveLength(1);
    expect(todays[0].day).toBe(26);
  });
});

describe('getWeekDays', () => {
  it('returns 7 days starting from that week\'s Sunday', () => {
    const days = getWeekDays(d(2026, 10, 26), d(2026, 10, 26));
    expect(days).toHaveLength(7);
    expect(toDateKey(days[0].date)).toBe('2026-10-25');
    expect(toDateKey(days[6].date)).toBe('2026-10-31');
  });
  it('flags today correctly within the week', () => {
    const days = getWeekDays(d(2026, 10, 26), d(2026, 10, 26));
    expect(days.filter((dd) => dd.today)).toHaveLength(1);
    expect(days[1].today).toBe(true); // Monday is index 1 from a Sunday start
  });
});

describe('getNextNDays', () => {
  it('starts from today and returns n consecutive days', () => {
    const days = getNextNDays(5, d(2026, 10, 26));
    expect(days).toHaveLength(5);
    expect(toDateKey(days[0].date)).toBe('2026-10-26');
    expect(toDateKey(days[4].date)).toBe('2026-10-30');
  });
  it('labels only the first day as Today', () => {
    const days = getNextNDays(3, d(2026, 10, 26));
    expect(days[0].dow).toContain('Today');
    expect(days[0].today).toBe(true);
    expect(days[1].dow).not.toContain('Today');
    expect(days[1].today).toBe(false);
  });
});

describe('formatClock', () => {
  it('formats standard times with am/pm and zero-padded minutes', () => {
    expect(formatClock(d(2026, 10, 26, 14, 5))).toBe('2:05p');
    expect(formatClock(d(2026, 10, 26, 9, 30))).toBe('9:30a');
  });
  it('handles the midnight/noon 12-hour edge cases', () => {
    expect(formatClock(d(2026, 10, 26, 0, 0))).toBe('12:00a');
    expect(formatClock(d(2026, 10, 26, 12, 0))).toBe('12:00p');
  });
});

describe('formatClockShort', () => {
  it('omits minutes', () => {
    expect(formatClockShort(d(2026, 10, 26, 14, 45))).toBe('2p');
    expect(formatClockShort(d(2026, 10, 26, 0, 15))).toBe('12a');
  });
});

describe('groupByDateKey', () => {
  it('groups events under their start date, preserving order within a day', () => {
    const events = [
      { title: 'a', start: d(2026, 10, 26, 9, 0) },
      { title: 'b', start: d(2026, 10, 27, 9, 0) },
      { title: 'c', start: d(2026, 10, 26, 15, 0) },
    ];
    const grouped = groupByDateKey(events);
    expect(grouped.get('2026-10-26').map((e) => e.title)).toEqual(['a', 'c']);
    expect(grouped.get('2026-10-27').map((e) => e.title)).toEqual(['b']);
  });
  it('returns an empty map for no events', () => {
    expect(groupByDateKey([]).size).toBe(0);
  });
});
