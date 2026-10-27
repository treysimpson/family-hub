import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchTaskLists, createTaskList, ensureTaskLists, fetchTasks, insertTask,
  setTaskStatus, deleteTask, clearCompletedTasks, pruneStaleCompleted,
} from './googleTasks';

function jsonResponse(body, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

beforeEach(() => {
  global.fetch = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('api() request wrapper (via any exported function)', () => {
  it('throws with the status and path on a failed request', async () => {
    global.fetch.mockResolvedValue(jsonResponse(null, false, 404));
    await expect(fetchTaskLists('token')).rejects.toThrow(/404.*\/users\/@me\/lists/);
  });

  it('treats a 204 No Content response as a null result, not a parse error', async () => {
    global.fetch.mockResolvedValue({ ok: true, status: 204, json: async () => { throw new Error('no body to parse'); } });
    await expect(deleteTask('token', 'list1', 'task1')).resolves.toBeNull();
  });
});

describe('fetchTaskLists / fetchTasks', () => {
  it('returns an empty array rather than undefined when the API omits items', async () => {
    global.fetch.mockResolvedValue(jsonResponse({}));
    expect(await fetchTaskLists('token')).toEqual([]);
    expect(await fetchTasks('token', 'list1')).toEqual([]);
  });

  it('fetchTasks requests completed tasks too (so checked-off items still show until cleared)', async () => {
    global.fetch.mockResolvedValue(jsonResponse({ items: [] }));
    await fetchTasks('token', 'list1');
    expect(global.fetch.mock.calls[0][0]).toContain('showCompleted=true');
  });
});

describe('ensureTaskLists', () => {
  it('reuses an existing list by title instead of creating a duplicate', async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse({ items: [{ id: 'abc', title: 'Trey' }] }));
    const result = await ensureTaskLists('token', { trey: 'Trey' });
    expect(result).toEqual({ trey: 'abc' });
    expect(global.fetch).toHaveBeenCalledTimes(1); // no create call made
  });

  it('creates only the lists that do not already exist', async () => {
    global.fetch
      .mockResolvedValueOnce(jsonResponse({ items: [{ id: 'abc', title: 'Trey' }] }))
      .mockResolvedValueOnce(jsonResponse({ id: 'xyz', title: 'Beryl' }));
    const result = await ensureTaskLists('token', { trey: 'Trey', beryl: 'Beryl' });
    expect(result).toEqual({ trey: 'abc', beryl: 'xyz' });
    expect(global.fetch).toHaveBeenCalledTimes(2);
    const [path, opts] = [global.fetch.mock.calls[1][0], global.fetch.mock.calls[1][1]];
    expect(path).toContain('/users/@me/lists');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual({ title: 'Beryl' });
  });
});

describe('createTaskList', () => {
  it('POSTs the given title', async () => {
    global.fetch.mockResolvedValue(jsonResponse({ id: 'abc', title: 'Kids' }));
    await createTaskList('token', 'Kids');
    const [, opts] = global.fetch.mock.calls[0];
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual({ title: 'Kids' });
  });
});

describe('insertTask', () => {
  it('omits the due field entirely when not provided, rather than sending due: undefined', async () => {
    global.fetch.mockResolvedValue(jsonResponse({ id: 't1' }));
    await insertTask('token', 'list1', { title: 'Buy milk' });
    const [, opts] = global.fetch.mock.calls[0];
    expect(JSON.parse(opts.body)).toEqual({ title: 'Buy milk' });
  });

  it('includes due when provided', async () => {
    global.fetch.mockResolvedValue(jsonResponse({ id: 't1' }));
    await insertTask('token', 'list1', { title: 'Buy milk', due: '2026-10-27T00:00:00Z' });
    const [, opts] = global.fetch.mock.calls[0];
    expect(JSON.parse(opts.body)).toEqual({ title: 'Buy milk', due: '2026-10-27T00:00:00Z' });
  });
});

describe('setTaskStatus', () => {
  it('maps true/false to the Tasks API\'s completed/needsAction strings', async () => {
    global.fetch.mockResolvedValue(jsonResponse({}));
    await setTaskStatus('token', 'list1', 'task1', true);
    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({ status: 'completed' });

    await setTaskStatus('token', 'list1', 'task1', false);
    expect(JSON.parse(global.fetch.mock.calls[1][1].body)).toEqual({ status: 'needsAction' });
  });
});

describe('clearCompletedTasks', () => {
  it('POSTs to the list\'s /clear endpoint', async () => {
    global.fetch.mockResolvedValue({ ok: true, status: 204, json: async () => null });
    await clearCompletedTasks('token', 'list1');
    const [path, opts] = global.fetch.mock.calls[0];
    expect(path).toContain('/lists/list1/clear');
    expect(opts.method).toBe('POST');
  });
});

describe('pruneStaleCompleted', () => {
  const now = Date.now();
  const recent = new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString(); // 1 day old
  const stale = new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(); // 10 days old, past the 3-day cutoff

  it('deletes and drops only completed tasks older than the cutoff', async () => {
    global.fetch.mockResolvedValue({ ok: true, status: 204, json: async () => null });
    const tasks = [
      { id: 'a', status: 'completed', completed: stale },
      { id: 'b', status: 'completed', completed: recent },
      { id: 'c', status: 'needsAction' },
    ];
    const result = await pruneStaleCompleted('token', 'list1', tasks);
    expect(result.map((t) => t.id)).toEqual(['b', 'c']);
    expect(global.fetch).toHaveBeenCalledTimes(1); // only the one stale task deleted
    expect(global.fetch.mock.calls[0][0]).toContain('/lists/list1/tasks/a');
  });

  it('returns the exact same array when nothing is stale (no unnecessary copy)', async () => {
    const tasks = [{ id: 'b', status: 'completed', completed: recent }];
    const result = await pruneStaleCompleted('token', 'list1', tasks);
    expect(result).toBe(tasks);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
