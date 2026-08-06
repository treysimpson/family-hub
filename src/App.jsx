import { useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { AuthProvider } from './context/AuthContext';
import TopBar from './components/TopBar';
import SettingsPanel from './components/panels/SettingsPanel';
import AgentPanel from './components/panels/AgentPanel';
import EventPanel from './components/panels/EventPanel';
import WxDayPanel from './components/panels/WxDayPanel';
import Home from './pages/Home';
import CalendarPage from './pages/CalendarPage';
import TasksPage from './pages/TasksPage';
import GroceriesPage from './pages/GroceriesPage';
import ChoresPage from './pages/ChoresPage';
import HomeControlPage from './pages/HomeControlPage';
import WeatherPage from './pages/WeatherPage';

const PAGES = {
  home: Home,
  calendar: CalendarPage,
  tasks: TasksPage,
  groceries: GroceriesPage,
  chores: ChoresPage,
  'home-control': HomeControlPage,
  weather: WeatherPage,
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
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <Screen />
      </AppProvider>
    </AuthProvider>
  );
}
