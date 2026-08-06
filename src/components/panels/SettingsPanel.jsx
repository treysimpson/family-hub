import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';

export default function SettingsPanel() {
  const { settingsPanelOpen, theme, setTheme } = useApp();
  const { isSignedIn, signIn, signOut, signingIn, authError } = useAuth();

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
      <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.4em' }}>
        <div className="settings-label">Google Account</div>
        <div style={{ fontSize: '0.78em', color: 'var(--text-muted)' }}>
          {isSignedIn ? 'Connected — Calendar & Tasks are live' : 'Not connected — showing sample data'}
        </div>
        <button
          className="add-btn"
          style={{ justifyContent: 'center', width: '100%' }}
          onClick={isSignedIn ? signOut : signIn}
          disabled={signingIn}
        >
          {signingIn ? 'Signing in…' : isSignedIn ? 'Sign out' : 'Sign in with Google'}
        </button>
        {authError && (
          <div style={{ fontSize: '0.72em', color: 'var(--ev-coral-tx)' }}>{authError}</div>
        )}
      </div>
    </div>
  );
}
