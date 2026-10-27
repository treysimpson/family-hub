import { useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { AuthProvider } from './context/AuthContext';
import { handleRedirectCallback as handleSpotifyRedirect } from './lib/spotify';
import TopBar from './components/TopBar';
import SettingsPanel from './components/panels/SettingsPanel';
import AgentPanel from './components/panels/AgentPanel';
import EventPanel from './components/panels/EventPanel';
import WxDayPanel from './components/panels/WxDayPanel';
import Screensaver from './components/Screensaver';
import Home from './pages/Home';
import CalendarPage from './pages/CalendarPage';
import TasksPage from './pages/TasksPage';
import GroceriesPage from './pages/GroceriesPage';
import ChoresPage from './pages/ChoresPage';
import HomeControlPage from './pages/HomeControlPage';
import WeatherPage from './pages/WeatherPage';
import BudgetPage from './pages/BudgetPage';
import SportsPage from './pages/SportsPage';
import MusicPage from './pages/MusicPage';
import DinnerPage from './pages/DinnerPage';
// SolarPage is deliberately not wired into PAGES/nav below -- T-14 is
// shelved (see family-hub-project.md's "Shelved for later" section).
// src/pages/SolarPage.jsx and src/lib/solar.js are untouched and ready to
// re-add with two lines here + the TopBar nav entry if it's ever revived.

const PAGES = {
  home: Home,
  calendar: CalendarPage,
  tasks: TasksPage,
  groceries: GroceriesPage,
  chores: ChoresPage,
  'home-control': HomeControlPage,
  weather: WeatherPage,
  budget: BudgetPage,
  sports: SportsPage,
  music: MusicPage,
  dinner: DinnerPage,
};

function Screen() {
  const { theme, page } = useApp();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const ActivePage = PAGES[page] || Home;

  return (
    <div className="aspect-wrap">
      <div className="screen">
        <TopBar />
        <ActivePage />
      </div>
      <SettingsPanel />
      <AgentPanel />
      <EventPanel />
      <WxDayPanel />
      <Screensaver />
    </div>
  );
}

export default function App() {
  // Runs once per load. A no-op the overwhelming majority of the time (no
  // `?code=` in the URL) -- only does real work on the one page load right
  // after a user approves Spotify access and gets redirected back here (see
  // spotify.js's REDIRECT_URI, which points at this same app root, not a
  // dedicated callback route).
  useEffect(() => {
    handleSpotifyRedirect().catch(() => {});
  }, []);

  return (
    <AuthProvider>
      <AppProvider>
        <Screen />
      </AppProvider>
    </AuthProvider>
  );
}
