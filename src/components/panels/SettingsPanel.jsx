import { useApp } from '../../context/AppContext';

export default function SettingsPanel() {
  const { settingsPanelOpen, theme, setTheme } = useApp();

  return (
    <div id="settings-panel" className={settingsPanelOpen ? 'show' : ''}>
      <div className="settings-title">Settings</div>
      <div className="settings-row">
        <div className="settings-label">Theme</div>
        <div className="theme-toggle">
          <div className={`theme-btn${theme === 'dark' ? ' active' : ''}`} onClick={() => setTheme('dark')}>🌙 Dark</div>
          <div className={`theme-btn${theme === 'light' ? ' active' : ''}`} onClick={() => setTheme('light')}>☀️ Light</div>
        </div>
      </div>
    </div>
  );
}
