import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchEvents } from './googleCalendar';

function rawEvent(overrides) {
  return {
    id: 'evt1',
    summary: 'Dentist',
    start: { dateTime: '2026-10-26T14:00:00-06:00' },
    end: { dateTime: '2026-10-26T15:00:00-06:00' },
    ...overrides,
  };
}

function mockEvents(items) {
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items }) });
}

beforeEach(() => {
  global.fetch = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetchEvents request shape', () => {
  it('sends the expected query params and bearer token', async () => {
    mockEvents([]);
    const timeMin = new Date('2026-10-26T00:00:00-06:00');
    const timeMax = new Date('2026-11-02T00:00:00-06:00');
    await fetchEvents('token123', timeMin, timeMax);
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toContain(`timeMin=${encodeURIComponent(timeMin.toISOString())}`);
    expect(url).toContain(`timeMax=${encodeURIComponent(timeMax.toISOString())}`);
    expect(url).toContain('singleEvents=true');
    expect(url).toContain('orderBy=startTime');
    expect(url).toContain('maxResults=250');
    expect(opts.headers.Authorization).toBe('Bearer token123');
  });

  it('throws on a failed request', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    await expect(fetchEvents('token', new Date(), new Date())).rejects.toThrow(/Calendar request failed: 500/);
  });

  it('returns an empty array rather than undefined when the API omits items', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({}) });
    expect(await fetchEvents('token', new Date(), new Date())).toEqual([]);
  });
});

describe('event normalization', () => {
  it('marks an event all-day only when start uses date, not dateTime', async () => {
    mockEvents([
      rawEvent({ id: 'timed', start: { dateTime: '2026-10-26T14:00:00-06:00' }, end: { dateTime: '2026-10-26T15:00:00-06:00' } }),
      rawEvent({ id: 'allday', start: { date: '2026-10-26' }, end: { date: '2026-10-27' } }),
    ]);
    const [timed, allday] = await fetchEvents('token', new Date(), new Date());
    expect(timed.allDay).toBe(false);
    expect(allday.allDay).toBe(true);
  });

  it('falls back to "(untitled event)" when summary is missing', async () => {
    mockEvents([rawEvent({ summary: undefined })]);
    const [ev] = await fetchEvents('token', new Date(), new Date());
    expect(ev.title).toBe('(untitled event)');
  });

  it('prefers the organizer\'s display name over their email, and falls back to blank with no organizer', async () => {
    mockEvents([
      rawEvent({ id: 'a', organizer: { displayName: 'Trey', email: 'trey@example.com' } }),
      rawEvent({ id: 'b', organizer: { email: 'beryl@example.com' } }),
      rawEvent({ id: 'c' }),
    ]);
    const [withName, emailOnly, noOrganizer] = await fetchEvents('token', new Date(), new Date());
    expect(withName.who).toBe('Trey');
    expect(emailOnly.who).toBe('beryl@example.com');
    expect(noOrganizer.who).toBe('');
  });

  it('maps a known Google colorId to the app\'s palette consistently', async () => {
    mockEvents([
      rawEvent({ id: 'a', colorId: '1' }), // -> purple
      rawEvent({ id: 'b', colorId: '4' }), // -> coral
      rawEvent({ id: 'c', colorId: '2' }), // -> teal
    ]);
    const [a, b, c] = await fetchEvents('token', new Date(), new Date());
    expect(a.color).toBe('purple');
    expect(b.color).toBe('coral');
    expect(c.color).toBe('teal');
  });

  it('picks a deterministic fallback color (from the 3-color palette) for an event with no colorId', async () => {
    mockEvents([rawEvent({ id: 'no-color-event', colorId: undefined })]);
    const [ev1] = await fetchEvents('token', new Date(), new Date());
    mockEvents([rawEvent({ id: 'no-color-event', colorId: undefined })]);
    const [ev2] = await fetchEvents('token', new Date(), new Date());
    expect(['teal', 'coral', 'purple']).toContain(ev1.color);
    expect(ev1.color).toBe(ev2.color); // same event id -> same color every time
  });
});
