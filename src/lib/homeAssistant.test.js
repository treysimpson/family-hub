import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  getHomeAssistantSettings, saveHomeAssistantSettings, isConfigured,
  fetchStates, fetchState, callService,
  toggleLight, setLightBrightness, setThermostatTemperature, setCoverPosition,
} from './homeAssistant';

describe('getHomeAssistantSettings / saveHomeAssistantSettings', () => {
  beforeEach(() => {
    const store = new Map();
    global.localStorage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    };
  });

  it('defaults to blank fields with nothing saved yet', () => {
    expect(getHomeAssistantSettings()).toEqual({ baseUrl: '', accessToken: '' });
  });

  it('round-trips through localStorage', () => {
    saveHomeAssistantSettings({ baseUrl: 'http://homeassistant.local:8123', accessToken: 'tok' });
    expect(getHomeAssistantSettings()).toEqual({ baseUrl: 'http://homeassistant.local:8123', accessToken: 'tok' });
  });

  it('saveHomeAssistantSettings fails soft rather than throwing when storage is blocked', () => {
    global.localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
    expect(() => saveHomeAssistantSettings({ baseUrl: 'a', accessToken: 'b' })).not.toThrow();
  });
});

describe('isConfigured', () => {
  it('requires both baseUrl and accessToken', () => {
    expect(isConfigured({ baseUrl: '', accessToken: '' })).toBe(false);
    expect(isConfigured({ baseUrl: 'http://x', accessToken: '' })).toBe(false);
    expect(isConfigured({ baseUrl: 'http://x', accessToken: 'tok' })).toBe(true);
  });

  it('handles an undefined/missing settings object', () => {
    expect(isConfigured(undefined)).toBe(false);
  });
});

const settings = { baseUrl: 'http://homeassistant.local:8123', accessToken: 'my-token' };

describe('fetchStates / fetchState', () => {
  afterEach(() => vi.restoreAllMocks());

  it('sends the Bearer token and Content-Type to /api/states', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ([{ entity_id: 'light.kitchen', state: 'on' }]) });
    const states = await fetchStates(settings);
    expect(states).toEqual([{ entity_id: 'light.kitchen', state: 'on' }]);
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe('http://homeassistant.local:8123/api/states');
    expect(options.headers.Authorization).toBe('Bearer my-token');
    expect(options.headers['Content-Type']).toBe('application/json');
  });

  it('strips a trailing slash from baseUrl so the path never double-slashes', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ([]) });
    await fetchStates({ baseUrl: 'http://homeassistant.local:8123/', accessToken: 'tok' });
    expect(global.fetch.mock.calls[0][0]).toBe('http://homeassistant.local:8123/api/states');
  });

  it('fetchState encodes the entity id into the URL', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ entity_id: 'light.kitchen', state: 'on' }) });
    await fetchState(settings, 'light.kitchen');
    expect(global.fetch.mock.calls[0][0]).toBe('http://homeassistant.local:8123/api/states/light.kitchen');
  });

  it('throws with the status code on a non-ok response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 });
    await expect(fetchStates(settings)).rejects.toThrow(/401/);
  });
});

describe('callService and its convenience wrappers', () => {
  afterEach(() => vi.restoreAllMocks());

  it('POSTs to /api/services/<domain>/<service> with the given data as the JSON body', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    await callService(settings, 'light', 'turn_on', { entity_id: 'light.kitchen', brightness_pct: 80 });
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe('http://homeassistant.local:8123/api/services/light/turn_on');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ entity_id: 'light.kitchen', brightness_pct: 80 });
  });

  it('toggleLight calls light.turn_on or light.turn_off based on the boolean', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    await toggleLight(settings, 'light.kitchen', true);
    expect(global.fetch.mock.calls[0][0]).toBe('http://homeassistant.local:8123/api/services/light/turn_on');

    await toggleLight(settings, 'light.kitchen', false);
    expect(global.fetch.mock.calls[1][0]).toBe('http://homeassistant.local:8123/api/services/light/turn_off');
  });

  it('setLightBrightness sends brightness_pct on light.turn_on', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    await setLightBrightness(settings, 'light.kitchen', 55);
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe('http://homeassistant.local:8123/api/services/light/turn_on');
    expect(JSON.parse(options.body)).toEqual({ entity_id: 'light.kitchen', brightness_pct: 55 });
  });

  it('setThermostatTemperature calls climate.set_temperature', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    await setThermostatTemperature(settings, 'climate.living_room', 70);
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe('http://homeassistant.local:8123/api/services/climate/set_temperature');
    expect(JSON.parse(options.body)).toEqual({ entity_id: 'climate.living_room', temperature: 70 });
  });

  it('setCoverPosition calls cover.open_cover or cover.close_cover based on the boolean', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    await setCoverPosition(settings, 'cover.garage_door', true);
    expect(global.fetch.mock.calls[0][0]).toBe('http://homeassistant.local:8123/api/services/cover/open_cover');

    await setCoverPosition(settings, 'cover.garage_door', false);
    expect(global.fetch.mock.calls[1][0]).toBe('http://homeassistant.local:8123/api/services/cover/close_cover');
  });
});
