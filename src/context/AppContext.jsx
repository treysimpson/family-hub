import { createContext, useContext, useState, useCallback } from 'react';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [theme, setThemeState] = useState(() => localStorage.getItem('fh-theme') || 'dark');
  const [page, setPageState] = useState('home');
  const [eventPanel, setEventPanel] = useState({ open: false, data: null });
  const [wxDayPanel, setWxDayPanel] = useState({ open: false, data: null });
  const [agentPanelOpen, setAgentPanelOpen] = useState(false);
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);

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
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
