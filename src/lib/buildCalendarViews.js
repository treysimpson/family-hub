import { getMonthGrid, getWeekDays, getNextNDays, groupByDateKey, toDateKey, formatClock, formatClockShort } from './dateGrid';

const AGENDA_DOT_COLOR = { teal: 'var(--accent-teal)', coral: 'var(--accent-coral)', purple: 'var(--accent-purple)' };

function toPanelData(ev) {
  return {
    title: ev.title,
    date: ev.start.toLocaleDateString([], { month: 'short', day: 'numeric' }),
    time: ev.allDay ? 'All day' : `${formatClock(ev.start)} – ${formatClock(ev.end)}`,
    who: ev.who,
    color: ev.color,
    location: ev.location,
    notes: ev.notes,
  };
}

export function buildMonthGrid(events, today = new Date()) {
  const byDate = groupByDateKey(events);
  const grid = getMonthGrid(today.getFullYear(), today.getMonth(), today);
  return grid.map((week) => week.map((cell) => {
    const dayEvents = byDate.get(toDateKey(cell.date)) || [];
    return {
      day: cell.day,
      otherMonth: cell.otherMonth,
      today: cell.today,
      events: dayEvents.map((ev) => ({
        label: ev.allDay ? ev.title : `${formatClockShort(ev.start)} ${ev.title}`,
        color: ev.color,
        ...toPanelData(ev),
      })),
    };
  }));
}

export function buildWeekDays(events, anchorDate, today = new Date(), weatherByDate = new Map()) {
  const byDate = groupByDateKey(events);
  return getWeekDays(anchorDate, today).map((day) => {
    const key = toDateKey(day.date);
    const dayEvents = byDate.get(key) || [];
    const wx = weatherByDate.get(key);
    return {
      dow: day.dow,
      date: day.date.getDate(),
      today: day.today,
      hi: wx?.hi ?? null,
      lo: wx?.lo ?? null,
      wxIcon: wx?.icon ?? '—',
      events: dayEvents.map((ev) => ({
        color: ev.color,
        time: ev.allDay ? 'All day' : formatClockShort(ev.start),
        title: ev.title,
        who: ev.who,
        date: ev.start.toLocaleDateString([], { month: 'short', day: 'numeric' }),
        fullTime: ev.allDay ? 'All day' : `${formatClock(ev.start)} – ${formatClock(ev.end)}`,
        location: ev.location,
        notes: ev.notes,
      })),
    };
  });
}

export function buildNextNDays(events, n, today = new Date(), weatherByDate = new Map()) {
  const byDate = groupByDateKey(events);
  return getNextNDays(n, today).map((day) => {
    const key = toDateKey(day.date);
    const dayEvents = byDate.get(key) || [];
    const wx = weatherByDate.get(key);
    return {
      dow: day.dow,
      date: day.date.getDate(),
      today: day.today,
      hi: wx?.hi ?? null,
      lo: wx?.lo ?? null,
      wxIcon: wx?.icon ?? '—',
      events: dayEvents.map((ev) => ({
        color: ev.color,
        time: ev.allDay ? 'All day' : formatClockShort(ev.start),
        title: ev.title,
        who: ev.who,
        date: ev.start.toLocaleDateString([], { month: 'short', day: 'numeric' }),
        fullTime: ev.allDay ? 'All day' : `${formatClock(ev.start)} – ${formatClock(ev.end)}`,
        location: ev.location,
        notes: ev.notes,
      })),
    };
  });
}

export function buildAgendaGroups(events, today = new Date(), days = 14) {
  const upcoming = events
    .filter((ev) => ev.end >= today)
    .sort((a, b) => a.start - b.start);

  const groups = new Map();
  for (const ev of upcoming) {
    const dayLabel = ev.start.toDateString() === today.toDateString()
      ? `Today — ${ev.start.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}`
      : ev.start.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
    if (!groups.has(dayLabel)) groups.set(dayLabel, []);
    groups.get(dayLabel).push({
      time: ev.allDay ? 'All day' : formatClock(ev.start),
      color: AGENDA_DOT_COLOR[ev.color] || AGENDA_DOT_COLOR.purple,
      title: ev.title,
      who: ev.who,
      date: ev.start.toLocaleDateString([], { month: 'short', day: 'numeric' }),
      fullTime: ev.allDay ? 'All day' : `${formatClock(ev.start)} – ${formatClock(ev.end)}`,
      person: ev.who,
      location: ev.location,
      notes: ev.notes,
    });
  }
  return Array.from(groups, ([day, items]) => ({ day, items }));
}
