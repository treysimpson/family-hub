import { describe, it, expect, vi, afterEach } from 'vitest';
import { listScreensaverPhotos, fetchPhotoBlobUrl } from './googlePhotos';

afterEach(() => vi.restoreAllMocks());

// URLSearchParams encodes spaces as "+", not "%20" -- decodeURIComponent
// alone leaves those as literal plus signs.
function decodeQuery(url) {
  return decodeURIComponent(url.replace(/\+/g, ' '));
}

describe('listScreensaverPhotos', () => {
  it('looks up the "Family Hub Screensaver" folder, then lists its image files', async () => {
    const calls = [];
    global.fetch = vi.fn((url) => {
      calls.push(url);
      if (calls.length === 1) {
        // Folder lookup
        return Promise.resolve({ ok: true, json: async () => ({ files: [{ id: 'folder123', name: 'Family Hub Screensaver' }] }) });
      }
      // File listing within that folder
      return Promise.resolve({
        ok: true,
        json: async () => ({ files: [{ id: 'photo1', name: 'beach.jpg' }, { id: 'photo2', name: 'kids.png' }] }),
      });
    });

    const photos = await listScreensaverPhotos('token');
    expect(photos).toEqual([{ id: 'photo1', name: 'beach.jpg' }, { id: 'photo2', name: 'kids.png' }]);

    // First call searches for the folder by exact name.
    expect(decodeQuery(calls[0])).toContain("name='Family Hub Screensaver'");
    expect(decodeQuery(calls[0])).toContain("mimeType='application/vnd.google-apps.folder'");
    // Second call scopes to that folder's id and filters to images only.
    expect(decodeQuery(calls[1])).toContain("'folder123' in parents");
    expect(decodeQuery(calls[1])).toContain("mimeType contains 'image/'");
  });

  it('resolves to [] when no screensaver folder exists yet (not an error)', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ files: [] }) });
    expect(await listScreensaverPhotos('token')).toEqual([]);
  });

  it('fails soft to [] on any API error -- a missing scope/API or network issue should never break the screensaver', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 403 });
    expect(await listScreensaverPhotos('token')).toEqual([]);
  });

  it('fails soft to [] if fetch itself throws (e.g. offline)', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network down'));
    expect(await listScreensaverPhotos('token')).toEqual([]);
  });
});

describe('fetchPhotoBlobUrl', () => {
  it('sends the Bearer token and alt=media, returning an object URL for the fetched bytes', async () => {
    const fakeBlob = new Blob(['fake-image-bytes'], { type: 'image/jpeg' });
    global.fetch = vi.fn().mockResolvedValue({ ok: true, blob: async () => fakeBlob });
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake-url');

    const url = await fetchPhotoBlobUrl('token', 'photo1');

    expect(url).toBe('blob:fake-url');
    const [requestUrl, options] = global.fetch.mock.calls[0];
    expect(requestUrl).toBe('https://www.googleapis.com/drive/v3/files/photo1?alt=media');
    expect(options.headers.Authorization).toBe('Bearer token');
    expect(createObjectURLSpy).toHaveBeenCalledWith(fakeBlob);
  });

  it('throws (not fail-soft) on a failed fetch -- the caller decides how to handle a single bad photo', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    await expect(fetchPhotoBlobUrl('token', 'missing')).rejects.toThrow(/404/);
  });
});
