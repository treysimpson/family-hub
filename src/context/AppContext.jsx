import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { fetchWeather } from '../lib/weather';
import { fetchEvents } from '../lib/googleCalendar';
import { buildMonthGrid, buildWeekDays, buildNextNDays, buildAgendaGroups } from '../lib/buildCalendarViews';
import { startOfWeek, addDays } from '../lib/dateGrid';
import { useAuth } from './AuthContext';
import {
  monthGrid as mockMonthGrid, weekDays as mockWeekDays, next5Days as mockNext5Days,
  agendaGroups as mockAgendaGroups,
} from '../data/mockData';

const AppContext = createContext(null);
const WEATHER_REFRESH_MS = 15 * 60 * 1000;
const CALENDAR_REFRESH_MS = 5 * 60 * 1000;

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
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
