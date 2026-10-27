import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { getSolarSettings, saveSolarSettings, isConfigured, normalizeSummary, fetchSystemSummary } from './solar';

describe('getSolarSettings / saveSolarSettings', () => {
  beforeEach(() => {
    const store = new Map();
    global.localStorage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    };
  });

  it('defaults to blank fields with nothing saved yet', () => {
    expect(getSolarSettings()).toEqual({ apiKey: '', accessToken: '', systemId: '' });
  });

  it('round-trips through localStorage', () => {
    saveSolarSettings({ apiKey: 'key1', accessToken: 'tok1', systemId: '12345' });
    expect(getSolarSettings()).toEqual({ apiKey: 'key1', accessToken: 'tok1', systemId: '12345' });
  });

  it('saveSolarSettings fails soft rather than throwing when storage is blocked', () => {
    global.localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
    expect(() => saveSolarSettings({ apiKey: 'a', accessToken: 'b', systemId: 'c' })).not.toThrow();
  });
});

describe('isConfigured', () => {
  it('is false unless apiKey, accessToken, and systemId are all present', () => {
    expect(isConfigured({ apiKey: '', accessToken: '', systemId: '' })).toBe(false);
    expect(isConfigured({ apiKey: 'a', accessToken: '', systemId: 'c' })).toBe(false);
    expect(isConfigured({ apiKey: 'a', accessToken: 'b', systemId: 'c' })).toBe(true);
  });

  it('handles an undefined/missing settings object', () => {
    expect(isConfigured(undefined)).toBe(false);
  });
});

describe('normalizeSummary', () => {
  it('returns null for no data', () => {
    expect(normalizeSummary(null)).toBeNull();
  });

  it('extracts the real Enphase v4 summary field names', () => {
    const raw = {
      system_id: 12345,
      current_power: 3420,
      energy_today: 18500,
      energy_lifetime: 9123456,
      status: 'normal',
      last_report_at: 1793203200,
    };
    const result = normalizeSummary(raw);
    expect(result.currentPowerW).toBe(3420);
    expect(result.energyTodayWh).toBe(18500);
    expect(result.energyLifetimeWh).toBe(9123456);
    expect(result.status).toBe('normal');
    expect(result.lastReportAt).toEqual(new Date(1793203200 * 1000));
  });

  it('defaults missing numeric fields to 0 rather than undefined', () => {
    const result = normalizeSummary({ status: 'normal' });
    expect(result.currentPowerW).toBe(0);
    expect(result.energyTodayWh).toBe(0);
    expect(result.energyLifetimeWh).toBe(0);
    expect(result.lastReportAt).toBeNull();
  });
});

describe('fetchSystemSummary', () => {
  afterEach(() => vi.restoreAllMocks());

  it('sends the access token as a Bearer header and the api key as the "key" header', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ current_power: 100, energy_today: 200, energy_lifetime: 300, status: 'normal' }),
    });
    await fetchSystemSummary({ apiKey: 'my-api-key', accessToken: 'my-token', systemId: '999' });
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe('https://api.enphaseenergy.com/api/v4/systems/999/summary');
    expect(options.headers.Authorization).toBe('Bearer my-token');
    expect(options.headers.key).toBe('my-api-key');
  });

  it('throws a specific TOKEN_EXPIRED-coded error on a 401, distinct from other failures', async () => {
    global.fetch = vi.fn().mockResolvedValue({ status: 401, ok: false });
    await expect(fetchSystemSummary({ apiKey: 'a', accessToken: 'b', systemId: 'c' })).rejects.toMatchObject({ code: 'TOKEN_EXPIRED' });
  });

  it('throws a generic error on other failure statuses', async () => {
    global.fetch = vi.fn().mockResolvedValue({ status: 500, ok: false });
    await expect(fetchSystemSummary({ apiKey: 'a', accessToken: 'b', systemId: 'c' })).rejects.toThrow(/500/);
  });
});
