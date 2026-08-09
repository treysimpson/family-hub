import { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { fetchWeather } from '../lib/weather';
import { fetchEvents } from '../lib/googleCalendar';
import { buildMonthGrid, buildWeekDays, buildNextNDays, buildAgendaGroups } from '../lib/buildCalendarViews';
import { startOfWeek, addDays } from '../lib/dateGrid';
import {
  PERSON_LISTS, STORE_LISTS, ensureTaskLists, fetchTasks,
  insertTask, setTaskStatus, deleteTask, clearCompletedTasks, pruneStaleCompleted,
} from '../lib/googleTasks';
import {
  fetchTransactions, fetchBudgetTargets, fetchFixedBills, fetchFunMoney, fetchOrderItems,
  updateTransactionCategory, upsertMerchantMemory, updateTransactionMerchant, upsertMerchantName,
} from '../lib/googleSheets';
import { useAuth } from './AuthContext';
import {
  monthGrid as mockMonthGrid, weekDays as mockWeekDays, next5Days as mockNext5Days,
  agendaGroups as mockAgendaGroups,
} from '../data/mockData';

const AppContext = createContext(null);
const WEATHER_REFRESH_MS = 15 * 60 * 1000;
const CALENDAR_REFRESH_MS = 5 * 60 * 1000;
const TASKS_REFRESH_MS = 30 * 1000;
const BUDGET_REFRESH_MS = 5 * 60 * 1000;
// Must match EXCLUDED_FROM_BUDGET in apps-script/family-agent.gs.
const EXCLUDED_BUDGET_CATEGORIES = ['one-time', 'trey-work'];
const ALL_LISTS = { ...PERSON_LISTS, ...STORE_LISTS };

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function normalizeTask(raw, listKey, listId) {
  return {
    id: raw.id,
    listId,
    key: listKey,
    text: raw.title,
    done: raw.status === 'completed',
    due: raw.due ? raw.due.slice(0, 10) : null,
  };
}

export function AppProvider({ children }) {
  const { isSignedIn, accessToken } = useAuth();
  const [theme, setThemeState] = useState(() => localStorage.getItem('fh-theme') || 'dark');
  const [page, setPageState] = useState('home');
  const [eventPanel, setEventPanel] = useState({ open: false, data: null });
  const [wxDayPanel, setWxDayPanel] = useState({ open: false, data: null });
  const [agentPanelOpen, setAgentPanelOpen] = useState(false);
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);
  const [weather, setWeather] = useState(null);
  const [weatherError, setWeatherError] = useState(null);
  const [calendarEvents, setCalendarEvents] = useState(null);
  const [calendarError, setCalendarError] = useState(null);
  const [taskListIds, setTaskListIds] = useState(null);
  const [rawTasks, setRawTasks] = useState(null); // flat array across all 7 lists
  const [tasksError, setTasksError] = useState(null);
  const taskListIdsRef = useRef(null); // mirrors taskListIds for the interval below, which must see live updates
  const [budgetTransactions, setBudgetTransactions] = useState(null);
  const [budgetError, setBudgetError] = useState(null);
  // Separate from budgetError: that gates the whole Budget page on a fetch
  // failure, this is transient feedback for a single failed recategorize
  // action, shown inline rather than replacing the page content.
  const [budgetActionError, setBudgetActionError] = useState(null);
  const [budgetTargets, setBudgetTargets] = useState({});
  const [fixedBillMerchants, setFixedBillMerchants] = useState([]);
  // "YYYY-MM" of the calendar month currently shown on the Budget page —
  // fixed, navigable boundaries rather than an implicit "always whatever
  // now is" window. Fun Money is intentionally not scoped to this; it's a
  // ledger-style running balance, not a monthly total.
  const [selectedBudgetMonth, setSelectedBudgetMonth] = useState(currentMonthKey);
  const [funMoneyEntries, setFunMoneyEntries] = useState([]);
  const [orderItems, setOrderItems] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchWeather()
        .then((data) => { if (!cancelled) { setWeather(data); setWeatherError(null); } })
        .catch((err) => { if (!cancelled) setWeatherError(err.message); });
    };
    load();
    const id = setInterval(load, WEATHER_REFRESH_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  useEffect(() => {
    if (!isSignedIn || !accessToken) { setCalendarEvents(null); return; }
    let cancelled = false;
    const load = () => {
      const today = new Date();
      const gridStart = startOfWeek(new Date(today.getFullYear(), today.getMonth(), 1));
      const timeMin = addDays(gridStart, -1);
      const agendaEnd = addDays(today, 14);
      const gridEnd = addDays(gridStart, 42);
      const timeMax = agendaEnd > gridEnd ? agendaEnd : gridEnd;
      fetchEvents(accessToken, timeMin, timeMax)
        .then((events) => { if (!cancelled) { setCalendarEvents(events); setCalendarError(null); } })
        .catch((err) => { if (!cancelled) setCalendarError(err.message); });
    };
    load();
    const id = setInterval(load, CALENDAR_REFRESH_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [isSignedIn, accessToken]);

  useEffect(() => {
    if (!isSignedIn || !accessToken) { taskListIdsRef.current = null; setTaskListIds(null); setRawTasks(null); return; }
    let cancelled = false;

    const loadAll = async (listIds) => {
      const all = [];
      for (const [key, listId] of Object.entries(listIds)) {
        const rawItems = await fetchTasks(accessToken, listId);
        const items = await pruneStaleCompleted(accessToken, listId, rawItems);
        all.push(...items.map((raw) => normalizeTask(raw, key, listId)));
      }
      if (!cancelled) { setRawTasks(all); setTasksError(null); }
    };

    (async () => {
      try {
        const listIds = taskListIdsRef.current || await ensureTaskLists(accessToken, ALL_LISTS);
        if (cancelled) return;
        taskListIdsRef.current = listIds;
        setTaskListIds(listIds);
        await loadAll(listIds);
      } catch (err) {
        if (!cancelled) setTasksError(err.message);
      }
    })();

    // Reads taskListIdsRef (not the taskListIds state) so this still sees the
    // list IDs once they're ready, despite the interval closing over the
    // values from whenever this effect last ran.
    const id = setInterval(() => { if (taskListIdsRef.current) loadAll(taskListIdsRef.current); }, TASKS_REFRESH_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [isSignedIn, accessToken]);

  useEffect(() => {
    if (!isSignedIn || !accessToken) { setBudgetTransactions(null); return; }
    let cancelled = false;
    const load = () => {
      fetchTransactions(accessToken)
        .then((data) => { if (!cancelled) { setBudgetTransactions(data); setBudgetError(null); } })
        .catch((err) => { if (!cancelled) setBudgetError(err.message); });
      // Targets/fixed bills are user-curated and change rarely — best-effort,
      // never surfaced as a hard error (see fetchBudgetTargets/fetchFixedBills).
      fetchBudgetTargets(accessToken).then((data) => { if (!cancelled) setBudgetTargets(data); });
      fetchFixedBills(accessToken).then((data) => { if (!cancelled) setFixedBillMerchants(data); });
      fetchFunMoney(accessToken).then((data) => { if (!cancelled) setFunMoneyEntries(data); });
      fetchOrderItems(accessToken).then((data) => { if (!cancelled) setOrderItems(data); });
    };
    load();
    const id = setInterval(load, BUDGET_REFRESH_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [isSignedIn, accessToken]);

  // Updates the transaction's category, and — unless remember is false —
  // saves it as a standing rule for future transactions from this merchant
  // (apps-script/family-agent.gs consults it; this just writes the sheet,
  // the agent does the reading). remember should be false for merchants
  // known to span multiple categories (e.g. Target: groceries one trip,
  // clothes another) where a blanket rule would be wrong most of the time —
  // see BudgetPage's "just this once" vs "always" prompt. Optimistic local
  // update, rolled back on failure so the UI never shows a category that
  // was not actually saved (e.g. if the write scope has not been granted
  // yet — the read-only -> read/write OAuth upgrade is a separate manual
  // Cloud Console step).
  const recategorizeTransaction = useCallback(async (transaction, category, remember = true) => {
    const previousCategory = transaction.category;
    setBudgetTransactions((prev) => prev.map((t) => (t.row === transaction.row ? { ...t, category } : t)));
    try {
      await updateTransactionCategory(accessToken, transaction.row, category);
    } catch (err) {
      setBudgetTransactions((prev) => prev.map((t) => (t.row === transaction.row ? { ...t, category: previousCategory } : t)));
      setBudgetActionError(err.message);
      return;
    }
    setBudgetActionError(null);
    if (!remember) return;
    // Best-effort: the category update above is the part the user actually
    // sees and cares about, so a memory-write failure (e.g. the Merchant
    // Memory tab doesn't exist yet because setupBudgetSheets hasn't been run)
    // shouldn't surface as if the whole action failed.
    try {
      await upsertMerchantMemory(accessToken, transaction.merchant, category);
    } catch (err) {
      console.error('Failed to save merchant memory:', err);
    }
  }, [accessToken]);

  // Renames every existing transaction sharing this raw merchant text (not
  // just the one tapped), and remembers the mapping so future transactions
  // come in already renamed too (apps-script/family-agent.gs looks this up).
  // Unlike recategorize, there is no "just this once" option — a cryptic raw
  // merchant string (e.g. "SONDERMIND INC") is essentially always worth
  // translating permanently, for every occurrence of it.
  const renameMerchant = useCallback(async (transaction, displayName) => {
    const previousMerchant = transaction.merchant;
    const normalizedPrev = previousMerchant.toLowerCase().trim();
    const matches = budgetTransactions.filter((t) => t.merchant.toLowerCase().trim() === normalizedPrev);

    setBudgetTransactions((prev) => prev.map((t) => (
      t.merchant.toLowerCase().trim() === normalizedPrev ? { ...t, merchant: displayName } : t
    )));

    const results = await Promise.allSettled(
      matches.map((t) => updateTransactionMerchant(accessToken, t.row, displayName)),
    );
    const failedRows = new Set(
      results.map((r, i) => (r.status === 'rejected' ? matches[i].row : null)).filter((row) => row !== null),
    );
    if (failedRows.size) {
      // Roll back only the rows whose write actually failed — the rest
      // already saved successfully, so leave their optimistic update in place.
      setBudgetTransactions((prev) => prev.map((t) => (
        failedRows.has(t.row) ? { ...t, merchant: previousMerchant } : t
      )));
      setBudgetActionError(`Could not rename ${failedRows.size} of ${matches.length} matching transactions`);
    } else {
      setBudgetActionError(null);
    }

    // Best-effort, same reasoning as recategorize's merchant-memory upsert.
    try {
      await upsertMerchantName(accessToken, previousMerchant, displayName);
    } catch (err) {
      console.error('Failed to save merchant name:', err);
    }
  }, [accessToken, budgetTransactions]);

  const refetchTasks = useCallback(async () => {
    if (!accessToken || !taskListIds) return;
    const all = [];
    for (const [key, listId] of Object.entries(taskListIds)) {
      const rawItems = await fetchTasks(accessToken, listId);
      const items = await pruneStaleCompleted(accessToken, listId, rawItems);
      all.push(...items.map((raw) => normalizeTask(raw, key, listId)));
    }
    setRawTasks(all);
  }, [accessToken, taskListIds]);

  const toggleTaskLive = useCallback(async (task) => {
    setRawTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t)));
    await setTaskStatus(accessToken, task.listId, task.id, !task.done);
  }, [accessToken]);

  const addTaskLive = useCallback(async (listKey, text, due) => {
    const listId = taskListIds[listKey];
    const created = await insertTask(accessToken, listId, { title: text, due });
    setRawTasks((prev) => [...prev, normalizeTask(created, listKey, listId)]);
  }, [accessToken, taskListIds]);

  const deleteTaskLive = useCallback(async (task) => {
    setRawTasks((prev) => prev.filter((t) => t.id !== task.id));
    await deleteTask(accessToken, task.listId, task.id);
  }, [accessToken]);

  const clearCheckedLive = useCallback(async (listKey) => {
    const listId = taskListIds[listKey];
    setRawTasks((prev) => prev.filter((t) => !(t.key === listKey && t.done)));
    await clearCompletedTasks(accessToken, listId);
  }, [accessToken, taskListIds]);

  const weatherByDate = useMemo(() => {
    const map = new Map();
    for (const day of weather?.daily || []) map.set(day.date, day);
    return map;
  }, [weather]);

  const calendarViews = useMemo(() => {
    if (!isSignedIn || !calendarEvents) {
      return { monthGrid: mockMonthGrid, weekDays: mockWeekDays, next5Days: mockNext5Days, agendaGroups: mockAgendaGroups, live: false };
    }
    const today = new Date();
    return {
      monthGrid: buildMonthGrid(calendarEvents, today),
      weekDays: buildWeekDays(calendarEvents, today, today, weatherByDate),
      next5Days: buildNextNDays(calendarEvents, 5, today, weatherByDate),
      agendaGroups: buildAgendaGroups(calendarEvents, today),
      live: true,
    };
  }, [isSignedIn, calendarEvents, weatherByDate]);

  const tasksLive = isSignedIn && !!rawTasks;
  const personTasks = useMemo(
    () => (rawTasks || []).filter((t) => t.key in PERSON_LISTS),
    [rawTasks],
  );
  const groceryTasks = useMemo(
    () => (rawTasks || []).filter((t) => t.key in STORE_LISTS),
    [rawTasks],
  );

  const budgetLive = isSignedIn && !!budgetTransactions;

  // All transactions dated within selectedBudgetMonth (a fixed "YYYY-MM"
  // calendar-month boundary, not a rolling window anchored to today).
  const selectedMonthTransactions = useMemo(() => {
    if (!budgetTransactions) return [];
    return budgetTransactions.filter((t) => t.date.startsWith(selectedBudgetMonth));
  }, [budgetTransactions, selectedBudgetMonth]);

  const budgetMonthTotal = useMemo(() => {
    if (!budgetTransactions) return null;
    return selectedMonthTransactions
      .filter((t) => !EXCLUDED_BUDGET_CATEGORIES.includes(t.category))
      .reduce((sum, t) => sum + t.amount, 0);
  }, [budgetTransactions, selectedMonthTransactions]);

  // "one-time" (major, non-recurring, e.g. an HVAC replacement) and
  // "trey-work" (reimbursable) are both excluded from the regular monthly
  // total/category breakdown above so they don't distort it — each gets its
  // own separate total instead.
  const budgetOneTimeTotal = useMemo(
    () => selectedMonthTransactions.filter((t) => t.category === 'one-time').reduce((sum, t) => sum + t.amount, 0),
    [selectedMonthTransactions],
  );

  const budgetReimbursableTotal = useMemo(
    () => selectedMonthTransactions.filter((t) => t.category === 'trey-work').reduce((sum, t) => sum + t.amount, 0),
    [selectedMonthTransactions],
  );

  const budgetCategoryTotals = useMemo(() => {
    const totals = {};
    selectedMonthTransactions
      .filter((t) => !EXCLUDED_BUDGET_CATEGORIES.includes(t.category))
      .forEach((t) => { totals[t.category] = (totals[t.category] || 0) + t.amount; });
    return totals;
  }, [selectedMonthTransactions]);

  const budgetFixedTotal = useMemo(() => {
    if (!fixedBillMerchants.length) return 0;
    return selectedMonthTransactions
      .filter((t) => !EXCLUDED_BUDGET_CATEGORIES.includes(t.category) && fixedBillMerchants.includes(t.merchant.toLowerCase()))
      .reduce((sum, t) => sum + t.amount, 0);
  }, [selectedMonthTransactions, fixedBillMerchants]);

  const budgetDiscretionaryTotal = budgetMonthTotal === null ? null : budgetMonthTotal - budgetFixedTotal;

  // Ledger-style balance: sum of every allowance/spend row ever for that
  // person, so unspent money automatically carries into next month without
  // any month-boundary logic — see fetchFunMoney in googleSheets.js.
  const funMoneyBalances = useMemo(() => {
    const balances = { trey: 0, beryl: 0 };
    funMoneyEntries.forEach((f) => {
      if (f.person in balances) balances[f.person] += f.amount;
    });
    return balances;
  }, [funMoneyEntries]);

  // Groups item-detail rows by EmailId so a transaction's Details view (only
  // ever shown for Target order/receipt splits — see fetchOrderItems) can
  // look up the full item list in O(1) regardless of which split row it was
  // opened from.
  const orderItemsByEmailId = useMemo(() => {
    const map = {};
    orderItems.forEach((r) => {
      (map[r.emailId] ||= []).push({ item: r.item, category: r.category });
    });
    return map;
  }, [orderItems]);

  const setTheme = useCallback((t) => {
    setThemeState(t);
    localStorage.setItem('fh-theme', t);
  }, []);

  const closeEvent = useCallback(() => setEventPanel({ open: false, data: null }), []);
  const closeWxDay = useCallback(() => setWxDayPanel({ open: false, data: null }), []);

  const openEvent = useCallback((data) => {
    setWxDayPanel({ open: false, data: null });
    setEventPanel({ open: true, data });
  }, []);

  const openWxDay = useCallback((data) => {
    setEventPanel({ open: false, data: null });
    setWxDayPanel({ open: true, data });
  }, []);

  const setPage = useCallback((p) => {
    setPageState(p);
    setAgentPanelOpen(false);
    setEventPanel({ open: false, data: null });
    setWxDayPanel({ open: false, data: null });
  }, []);

  // Used by Home's week view: jump to the Calendar tab and open the event there.
  const navToEvent = useCallback((data) => {
    setPageState('calendar');
    setAgentPanelOpen(false);
    setWxDayPanel({ open: false, data: null });
    setTimeout(() => setEventPanel({ open: true, data }), 50);
  }, []);

  const toggleAgentPanel = useCallback(() => {
    setAgentPanelOpen((v) => !v);
    setSettingsPanelOpen(false);
  }, []);

  const toggleSettingsPanel = useCallback(() => {
    setSettingsPanelOpen((v) => !v);
    setAgentPanelOpen(false);
  }, []);

  const value = {
    theme, setTheme,
    page, setPage,
    eventPanel, openEvent, closeEvent, navToEvent,
    wxDayPanel, openWxDay, closeWxDay,
    agentPanelOpen, toggleAgentPanel,
    settingsPanelOpen, toggleSettingsPanel,
    weather, weatherError,
    calendarViews, calendarError,
    tasksLive, personTasks, groceryTasks, tasksError,
    toggleTaskLive, addTaskLive, deleteTaskLive, clearCheckedLive, refetchTasks,
    budgetLive, budgetTransactions, budgetMonthTotal, budgetError,
    selectedBudgetMonth, setSelectedBudgetMonth, selectedMonthTransactions,
    budgetOneTimeTotal, budgetReimbursableTotal, budgetCategoryTotals, budgetTargets,
    budgetFixedTotal, budgetDiscretionaryTotal, recategorizeTransaction, renameMerchant, budgetActionError,
    funMoneyEntries, funMoneyBalances, orderItemsByEmailId,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
