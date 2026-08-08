import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';

const NAV_ITEMS = [
  { id: 'home', label: 'Home' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'groceries', label: 'Groceries' },
  { id: 'chores', label: 'Chores' },
  { id: 'home-control', label: 'Home Control' },
  { id: 'weather', label: 'Weather' },
  { id: 'budget', label: 'Budget' },
];

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000 * 15);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function TopBar() {
  const { page, setPage, toggleAgentPanel, toggleSettingsPanel, weather } = useApp();
  const now = useClock();

  const time = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const date = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="topbar">
      <div className="topbar-left">
        <span className="time">{time}</span>
        <span className="date">{date}</span>
      </div>
      <div className="topbar-center">
        {NAV_ITEMS.map((item) => (
          <div
            key={item.id}
            className={`nav-pill${page === item.id ? ' active' : ''}`}
            onClick={() => setPage(item.id)}
          >
            {item.label}
          </div>
        ))}
      </div>
      <div className="topbar-right">
        <div className="weather-inline" onClick={() => setPage('weather')}>
          <span style={{ fontSize: '1.4em' }}>{weather ? weather.now.icon : '—'}</span>
          <div>
            <div className="weather-temp">{weather ? `${weather.now.temp}°F` : '--°F'}</div>
            <div className="weather-sub">Westminster</div>
          </div>
        </div>
        <div className="notif-btn" onClick={toggleAgentPanel}>
          <svg width="55%" height="55%" viewBox="0 0 16 16" fill="none">
            <path d="M8 1.5C5.79 1.5 4 3.29 4 5.5v2.5L2.5 10h11L12 8V5.5C12 3.29 10.21 1.5 8 1.5Z" stroke="#888780" strokeWidth="1.2" strokeLinejoin="round" />
            <path d="M6.5 11.5a1.5 1.5 0 0 0 3 0" stroke="#888780" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <div className="notif-badge">2</div>
        </div>
        <div className="settings-btn" onClick={toggleSettingsPanel} title="Settings">⚙️</div>
      </div>
    </div>
  );
}
