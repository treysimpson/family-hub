// Pure date math for building calendar grids from real dates + live events.
// No date library needed — just enough here to cover month/week/agenda views.

export function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function startOfWeek(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

export function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// 6 rows x 7 cols covering the full weeks containing the given month.
export function getMonthGrid(year, month, today = new Date()) {
  const firstOfMonth = new Date(year, month, 1);
  const gridStart = startOfWeek(firstOfMonth);
  const rows = [];
  let cursor = gridStart;
  for (let row = 0; row < 6; row++) {
    const week = [];
    for (let col = 0; col < 7; col++) {
      week.push({
        date: cursor,
        day: cursor.getDate(),
        otherMonth: cursor.getMonth() !== month,
        today: isSameDay(cursor, today),
      });
      cursor = addDays(cursor, 1);
    }
    rows.push(week);
  }
  return rows;
}

export function getWeekDays(anchorDate, today = new Date()) {
  const start = startOfWeek(anchorDate);
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(start, i);
    return { date, dow: date.toLocaleDateString([], { weekday: 'short' }), today: isSameDay(date, today) };
  });
}

export function getNextNDays(n, today = new Date()) {
  const start = startOfDay(today);
  return Array.from({ length: n }, (_, i) => {
    const date = addDays(start, i);
    return {
      date,
      dow: i === 0 ? `${date.toLocaleDateString([], { weekday: 'short' })} — Today` : date.toLocaleDateString([], { weekday: 'short' }),
      today: i === 0,
    };
  });
}

export function formatClock(date) {
  let h = date.getHours();
  const m = date.getMinutes();
  const suffix = h >= 12 ? 'p' : 'a';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, '0')}${suffix}`;
}

export function formatClockShort(date) {
  let h = date.getHours();
  const suffix = h >= 12 ? 'p' : 'a';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}${suffix}`;
}

export function groupByDateKey(events) {
  const map = new Map();
  for (const ev of events) {
    const key = toDateKey(ev.start);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(ev);
  }
  return map;
}
