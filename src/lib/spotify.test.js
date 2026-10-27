import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  isConfigured,
  generateCodeChallenge,
  normalizeNowPlaying,
  getStoredToken,
  signOut,
  getValidAccessToken,
  fetchNowPlaying,
  controlPlayback,
} from './spotify';

describe('isConfigured', () => {
  it('is true now that Trey has registered a Spotify app and CLIENT_ID is filled in', () => {
    // Flips with CLIENT_ID (see spotify.js) -- was false before 2026-10-27,
    // documented that way until Trey completed the one-time app registration.
    expect(isConfigured()).toBe(true);
  });
});

describe('generateCodeChallenge', () => {
  it('matches the RFC 7636 appendix B PKCE S256 test vector', async () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    expect(await generateCodeChallenge(verifier)).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });
});

describe('normalizeNowPlaying', () => {
  it('returns null when nothing is playing', () => {
    expect(normalizeNowPlaying(null)).toBeNull();
    expect(normalizeNowPlaying({})).toBeNull();
  });

  it('extracts track/artist/album/art from a playing response', () => {
    const raw = {
      is_playing: true,
      progress_ms: 45000,
      device: { name: "Trey's Echo" },
      item: {
        name: 'Clair de Lune',
        duration_ms: 300000,
        artists: [{ name: 'Claude Debussy' }],
        album: { name: 'Suite Bergamasque', images: [{ url: 'https://img/large.jpg' }, { url: 'https://img/small.jpg' }] },
      },
    };
    expect(normalizeNowPlaying(raw)).toEqual({
      isPlaying: true,
      trackName: 'Clair de Lune',
      artistNames: 'Claude Debussy',
      albumName: 'Suite Bergamasque',
      albumArtUrl: 'https://img/large.jpg',
      progressMs: 45000,
      durationMs: 300000,
      deviceName: "Trey's Echo",
    });
  });

  it('joins multiple artists and handles a missing album image gracefully', () => {
    const raw = {
      is_playing: false,
      item: {
        name: 'Collab Track',
        artists: [{ name: 'Artist A' }, { name: 'Artist B' }],
        album: { name: 'Some Album', images: [] },
      },
    };
    const result = normalizeNowPlaying(raw);
    expect(result.artistNames).toBe('Artist A, Artist B');
    expect(result.albumArtUrl).toBeNull();
    expect(result.isPlaying).toBe(false);
  });
});

describe('token storage', () => {
  beforeEach(() => {
    const store = new Map();
    global.localStorage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    };
  });

  it('getStoredToken returns null with nothing saved yet', () => {
    expect(getStoredToken()).toBeNull();
  });

  it('signOut clears the stored token', () => {
    localStorage.setItem('fh-spotify-token', JSON.stringify({ accessToken: 'abc', refreshToken: 'r', expiresAt: Date.now() + 10000 }));
    signOut();
    expect(getStoredToken()).toBeNull();
  });
});

describe('getValidAccessToken', () => {
  beforeEach(() => {
    const store = new Map();
    global.localStorage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    };
  });

  afterEach(() => vi.restoreAllMocks());

  it('returns null when signed out', async () => {
    expect(await getValidAccessToken()).toBeNull();
  });

  it('returns the stored access token directly when it is not near expiry', async () => {
    localStorage.setItem('fh-spotify-token', JSON.stringify({ accessToken: 'still-good', refreshToken: 'r', expiresAt: Date.now() + 10 * 60 * 1000 }));
    global.fetch = vi.fn();
    expect(await getValidAccessToken()).toBe('still-good');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('refreshes when the stored token is expired, and persists the new one', async () => {
    localStorage.setItem('fh-spotify-token', JSON.stringify({ accessToken: 'stale', refreshToken: 'refresh-me', expiresAt: Date.now() - 1000 }));
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'fresh', refresh_token: 'refresh-me-2', expires_in: 3600 }),
    });
    expect(await getValidAccessToken()).toBe('fresh');
    expect(JSON.parse(localStorage.getItem('fh-spotify-token')).accessToken).toBe('fresh');
  });

  it('signs out and returns null when a refresh attempt fails (e.g. access revoked)', async () => {
    localStorage.setItem('fh-spotify-token', JSON.stringify({ accessToken: 'stale', refreshToken: 'revoked', expiresAt: Date.now() - 1000 }));
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 400 });
    expect(await getValidAccessToken()).toBeNull();
    expect(getStoredToken()).toBeNull();
  });
});

describe('fetchNowPlaying', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns null on a 204 (nothing playing)', async () => {
    global.fetch = vi.fn().mockResolvedValue({ status: 204, ok: true });
    expect(await fetchNowPlaying('tok')).toBeNull();
  });

  it('normalizes a real 200 response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ is_playing: true, item: { name: 'Song', artists: [{ name: 'Artist' }], album: { images: [] } } }),
    });
    const result = await fetchNowPlaying('tok');
    expect(result.trackName).toBe('Song');
  });

  it('throws on a real error status', async () => {
    global.fetch = vi.fn().mockResolvedValue({ status: 401, ok: false });
    await expect(fetchNowPlaying('tok')).rejects.toThrow(/401/);
  });
});

describe('controlPlayback', () => {
  afterEach(() => vi.restoreAllMocks());

  it('succeeds on a 204 response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ status: 204, ok: false });
    await expect(controlPlayback('tok', 'play')).resolves.toBeUndefined();
  });

  it('throws a specific "no active device" error on a 404', async () => {
    global.fetch = vi.fn().mockResolvedValue({ status: 404, ok: false });
    await expect(controlPlayback('tok', 'pause')).rejects.toThrow('No active Spotify device');
  });

  it('rejects an unknown action before making any request', async () => {
    global.fetch = vi.fn();
    await expect(controlPlayback('tok', 'rewind')).rejects.toThrow(/Unknown playback action/);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
