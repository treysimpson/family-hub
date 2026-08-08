// Google Tasks API v1, plain REST via fetch.
// https://developers.google.com/tasks/reference/rest

// Real per-person / per-store filtering needs *some* signal Google Tasks
// doesn't give us on a single list (no custom fields) — so each category gets
// its own named task list, auto-created the first time someone signs in.
// These list names will show up in Google Tasks on Trey/Beryl's phones too.
export const PERSON_LISTS = { trey: 'Trey', beryl: 'Beryl', kids: 'Kids', family: 'Family' };
export const STORE_LISTS = { grocery: 'Grocery', costco: 'Costco', other: 'Other' };

const BASE = 'https://tasks.googleapis.com/tasks/v1';

async function api(accessToken, path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(`Tasks API request failed: ${res.status} ${path}`);
  if (res.status === 204) return null;
  return res.json();
}

export async function fetchTaskLists(accessToken) {
  const data = await api(accessToken, '/users/@me/lists?maxResults=100');
  return data.items || [];
}

export async function createTaskList(accessToken, title) {
  return api(accessToken, '/users/@me/lists', {
    method: 'POST',
    body: JSON.stringify({ title }),
  });
}

// Returns { key: listId } for every name in `wanted`, creating any missing lists.
export async function ensureTaskLists(accessToken, wanted) {
  const existing = await fetchTaskLists(accessToken);
  const byTitle = new Map(existing.map((l) => [l.title, l.id]));
  const result = {};
  for (const [key, title] of Object.entries(wanted)) {
    if (byTitle.has(title)) {
      result[key] = byTitle.get(title);
    } else {
      const created = await createTaskList(accessToken, title);
      result[key] = created.id;
    }
  }
  return result;
}

// showHidden is deliberately omitted: tasks.clear() only hides completed tasks
// rather than deleting them, so asking for hidden tasks here would bring
// "cleared" items right back after a refresh.
export async function fetchTasks(accessToken, listId) {
  const data = await api(accessToken, `/lists/${listId}/tasks?showCompleted=true&maxResults=100`);
  return data.items || [];
}

export async function insertTask(accessToken, listId, { title, due }) {
  return api(accessToken, `/lists/${listId}/tasks`, {
    method: 'POST',
    body: JSON.stringify({ title, ...(due ? { due } : {}) }),
  });
}

export async function setTaskStatus(accessToken, listId, taskId, completed) {
  return api(accessToken, `/lists/${listId}/tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: completed ? 'completed' : 'needsAction' }),
  });
}

export async function deleteTask(accessToken, listId, taskId) {
  return api(accessToken, `/lists/${listId}/tasks/${taskId}`, { method: 'DELETE' });
}

// Removes all completed tasks from a list in one call.
export async function clearCompletedTasks(accessToken, listId) {
  return api(accessToken, `/lists/${listId}/clear`, { method: 'POST' });
}

const STALE_COMPLETED_DAYS = 3;

// Permanently deletes completed items older than STALE_COMPLETED_DAYS so lists
// don't grow unbounded if "Clear checked items" isn't clicked regularly — the
// clear() endpoint only hides completed tasks, it doesn't delete them, so
// without this they'd sit there forever (see fetchTasks' showHidden comment).
// Returns the input list with the pruned items removed.
export async function pruneStaleCompleted(accessToken, listId, rawTasks) {
  const cutoff = Date.now() - STALE_COMPLETED_DAYS * 24 * 60 * 60 * 1000;
  const stale = rawTasks.filter((t) => t.status === 'completed' && t.completed && new Date(t.completed).getTime() < cutoff);
  for (const task of stale) {
    await deleteTask(accessToken, listId, task.id);
  }
  if (!stale.length) return rawTasks;
  const staleIds = new Set(stale.map((t) => t.id));
  return rawTasks.filter((t) => !staleIds.has(t.id));
}
