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
import { initialChores } from '../data/mockData';

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

// All-time completion count across every chore -- a simple "things checked
// off" running total, independent of points (a Daily chore checked off 20
// times counts 20 here even though it's worth the same points each time).
export function totalCompletions(personId) {
  const data = load();
  const chores = data[personId] || {};
  return Object.values(chores).reduce((sum, periods) => sum + Object.keys(periods).length, 0);
}

// ---- Rewards (T-36, added 2026-10-26) ----
// First pass at the points/reward half mockData.js's `rewardCatalog`
// pairs with -- flat points per chore (from each chore's own `points`
// field), spent against a reward catalog Trey curates. Retune-later by
// design: point values and what's on the reward list are both just a
// starting guess, not a finished point economy.

const REDEMPTIONS_KEY = 'fh-chores-redemptions';

function loadRedemptions() {
  try {
    const raw = localStorage.getItem(REDEMPTIONS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveRedemptions(data) {
  try {
    localStorage.setItem(REDEMPTIONS_KEY, JSON.stringify(data));
  } catch {
    // Same reasoning as save() above -- non-fatal if storage is unavailable.
  }
}

// Needs the chore *list* (not just ids) since the completion log only
// stores {choreId: {period: true}}, not each chore's point value -- that
// lives in mockData.js's initialChores, which the caller already has.
export function pointsEarned(personId, chores) {
  const data = load();
  const record = data[personId] || {};
  return chores.reduce((sum, c) => {
    const periods = record[c.id];
    return sum + (periods ? Object.keys(periods).length * (c.points || 0) : 0);
  }, 0);
}

export function pointsSpent(personId) {
  const redemptions = loadRedemptions();
  return (redemptions[personId] || []).reduce((sum, r) => sum + r.cost, 0);
}

export function pointsBalance(personId, chores) {
  return pointsEarned(personId, chores) - pointsSpent(personId);
}

export function redemptionHistory(personId) {
  return [...(loadRedemptions()[personId] || [])].sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function redeemReward(personId, reward) {
  const redemptions = loadRedemptions();
  if (!redemptions[personId]) redemptions[personId] = [];
  redemptions[personId].push({
    rewardId: reward.id,
    title: reward.title,
    cost: reward.cost,
    date: toDateKey(new Date()),
  });
  saveRedemptions(redemptions);
}

// ---- Chore definitions (added 2026-10-26) ----
// Who has which chore, how often, which routine, how many points -- was
// hardcoded in mockData.js with no way to change it in-app. Stored in
// localStorage now, seeded from mockData's initialChores as the starting
// set rather than an unchangeable ceiling; mockData.js stays the source of
// the *default* list (useful for a from-scratch setup, or reference), this
// is the *live, editable* one. Deliberately not synced to Google Sheets --
// this is a per-device kiosk setting, same spirit as the Budget PIN.

const DEFINITIONS_KEY = 'fh-chores-definitions';

export function getChoreDefinitions() {
  try {
    const raw = localStorage.getItem(DEFINITIONS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // fall through to defaults
  }
  return initialChores;
}

function saveChoreDefinitions(data) {
  try {
    localStorage.setItem(DEFINITIONS_KEY, JSON.stringify(data));
  } catch {
    // Non-fatal -- same reasoning as save()/saveRedemptions() above.
  }
}

export function addChore(personId, { text, freq, routine, points }) {
  const data = getChoreDefinitions();
  const chore = {
    id: `custom-${Date.now()}-${Math.round(Math.random() * 1000)}`,
    text: text.trim(),
    freq,
    routine: routine?.trim() || null,
    points: Number(points) || 5,
  };
  const next = { ...data, [personId]: [...(data[personId] || []), chore] };
  saveChoreDefinitions(next);
  return next;
}

export function removeChore(personId, choreId) {
  const data = getChoreDefinitions();
  const next = { ...data, [personId]: (data[personId] || []).filter((c) => c.id !== choreId) };
  saveChoreDefinitions(next);
  return next;
}
