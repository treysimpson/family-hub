// Chores rebuild (mentioned in family-hub-project.md's "Resume on a new
// machine" section as "discussed but not yet started") -- localStorage-based
// recurrence, replacing the old mock page where checking a chore just set
// in-memory React state that reset on every refresh.
//
// Completions are stored per "period" so each recurrence resets on its own
// natural boundary without any cron/reset job needed -- a Daily chore's
// period is just today's date, so it's automatically "undone" again the
// moment the date rolls over; Weekly/Monthly work the same way one level up.
import { toDateKey, startOfWeek, addDays } from './dateGrid';

const STORAGE_KEY = 'fh-chores-completions';

// Which "instance" of a recurring chore a given date falls into. Weekly
// uses the Sunday that starts its week, matching the Calendar page's
// Sun-Sat week (dateGrid.js's startOfWeek) so "this week" means the same
// thing everywhere in the app.
export function periodKeyFor(freq, date) {
  if (freq === 'Daily') return toDateKey(date);
  if (freq === 'Monthly') return toDateKey(date).slice(0, 7); // YYYY-MM
  return toDateKey(startOfWeek(date)); // Weekly (default)
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function save(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage full or blocked (private window, etc.) -- the chore board
    // still works for the session, it just won't persist across a reload.
  }
}

// data shape: { [personId]: { [choreId]: { [periodKey]: true } } }
export function isChoreDone(personId, choreId, periodKey) {
  const data = load();
  return !!data[personId]?.[choreId]?.[periodKey];
}

export function toggleChoreDone(personId, choreId, periodKey) {
  const data = load();
  if (!data[personId]) data[personId] = {};
  if (!data[personId][choreId]) data[personId][choreId] = {};
  const wasDone = !!data[personId][choreId][periodKey];
  if (wasDone) delete data[personId][choreId][periodKey];
  else data[personId][choreId][periodKey] = true;
  save(data);
  return !wasDone;
}

// For a Daily chore on a non-current week, one checkbox can't represent 7
// different days -- this counts how many of that week's 7 days have a
// completion recorded, for a "5/7" style display instead.
export function daysDoneInWeek(personId, choreId, weekStart) {
  const data = load();
  const record = data[personId]?.[choreId] || {};
  let count = 0;
  for (let i = 0; i < 7; i++) {
    if (record[toDateKey(addDays(weekStart, i))]) count += 1;
  }
  return count;
}

// All-time completion count across every chore -- a simple, honest "things
// this person has checked off" running total, not a designed points/reward
// system (what a completion is worth, and whether it ties to a reward, is
// still an open question -- see T-36 in family-hub-project.md). Flat +1 per
// completion, derived from the completion log itself rather than a separate
// stored counter, so it can never drift out of sync with the actual record.
export function totalCompletions(personId) {
  const data = load();
  const chores = data[personId] || {};
  return Object.values(chores).reduce((sum, periods) => sum + Object.keys(periods).length, 0);
}
