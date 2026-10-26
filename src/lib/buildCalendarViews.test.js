import { describe, it, expect } from 'vitest';
import { buildAgendaGroups } from './buildCalendarViews';

function ev(daysFromToday, today) {
  const d = new Date(today);
  d.setDate(d.getDate() + daysFromToday);
  return { start: d, end: d, title: `+${daysFromToday}d`, color: 'teal', who: '', location: '', notes: '' };
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
