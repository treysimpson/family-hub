// Google Calendar API v3, plain REST via fetch — no client library needed.
// https://developers.google.com/calendar/api/v3/reference/events/list

// Google event colorId (1-11) -> our teal/coral/purple palette. Approximate —
// Google's palette doesn't map cleanly onto ours, this just gives visual
// variety until events can be color-coded per family member (would need
// separate per-person calendars, a future enhancement).
const COLOR_ID_MAP = {
  1: 'purple', 3: 'purple', 9: 'purple', 5: 'purple', 8: 'purple',
  2: 'teal', 10: 'teal', 7: 'teal',
  4: 'coral', 6: 'coral', 11: 'coral',
};
const PALETTE = ['teal', 'coral', 'purple'];

function colorForEvent(ev) {
  if (ev.colorId && COLOR_ID_MAP[ev.colorId]) return COLOR_ID_MAP[ev.colorId];
  let hash = 0;
  for (const ch of ev.id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

function normalizeEvent(raw) {
  const allDay = !raw.start.dateTime;
  const start = new Date(raw.start.dateTime || raw.start.date);
  const end = new Date(raw.end.dateTime || raw.end.date);
  return {
    id: raw.id,
    title: raw.summary || '(untitled event)',
    allDay,
    start,
    end,
    location: raw.location || '',
    notes: raw.description || '',
    who: raw.organizer?.displayName || raw.organizer?.email || '',
    color: colorForEvent(raw),
    htmlLink: raw.htmlLink,
  };
}

export async function fetchEvents(accessToken, timeMin, timeMax) {
  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  });
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Calendar request failed: ${res.status}`);
  const data = await res.json();
  return (data.items || []).map(normalizeEvent);
}
