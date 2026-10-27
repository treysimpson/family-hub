import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { hasBudgetPin, resetBudgetPin } from '../PinGate';
import { LEAGUES, getSportsSettings, saveSportsSettings } from '../../lib/sports';
import { getHomeAssistantSettings, saveHomeAssistantSettings } from '../../lib/homeAssistant';
import { buildBugReportMailto } from '../../lib/bugReport';
import HelpPanel from './HelpPanel';

export default function SettingsPanel() {
  const { settingsPanelOpen, theme, setTheme, page } = useApp();
  const { isSignedIn, signIn, signOut, signingIn, authError } = useAuth();
  const [pinReset, setPinReset] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [sportsSettings, setSportsSettings] = useState(() => getSportsSettings());
  const [teamInput, setTeamInput] = useState('');
  const [haSettings, setHaSettings] = useState(() => getHomeAssistantSettings());
  const [bugText, setBugText] = useState('');
  const [bugSent, setBugSent] = useState(false);

  const sendBugReport = () => {
    if (!bugText.trim()) return;
    window.location.href = buildBugReportMailto(bugText, { page, theme });
    setBugSent(true);
    setBugText('');
  };

  const toggleLeague = (id) => {
    const next = {
      ...sportsSettings,
      leagueIds: sportsSettings.leagueIds.includes(id)
        ? sportsSettings.leagueIds.filter((l) => l !== id)
        : [...sportsSettings.leagueIds, id],
    };
    setSportsSettings(next);
    saveSportsSettings(next);
  };

  const addTeam = () => {
    const name = teamInput.trim();
    if (!name || sportsSettings.teamNames.includes(name)) { setTeamInput(''); return; }
    const next = { ...sportsSettings, teamNames: [...sportsSettings.teamNames, name] };
    setSportsSettings(next);
    saveSportsSettings(next);
    setTeamInput('');
  };

  const removeTeam = (name) => {
    const next = { ...sportsSettings, teamNames: sportsSettings.teamNames.filter((t) => t !== name) };
    setSportsSettings(next);
    saveSportsSettings(next);
  };

  const updateHaField = (field, value) => {
    const next = { ...haSettings, [field]: value };
    setHaSettings(next);
    saveHomeAssistantSettings(next);
  };

  return (
    <>
    <div id="settings-panel" className={settingsPanelOpen ? 'show' : ''}>
      <div className="settings-title">Settings</div>
      <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.3em' }}>
        <button className="add-btn" style={{ justifyContent: 'center', width: '100%' }} onClick={() => setHelpOpen(true)}>
          ❔ How this works
        </button>
      </div>
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
      <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.4em' }}>
        <div className="settings-label">Budget PIN</div>
        <div style={{ fontSize: '0.78em', color: 'var(--text-muted)' }}>
          {hasBudgetPin() ? 'A PIN is set for the Budget section.' : 'No PIN set yet — one will be requested the first time you open Budget.'}
        </div>
        {hasBudgetPin() && (
          <button
            className="add-btn"
            style={{ justifyContent: 'center', width: '100%' }}
            onClick={() => { resetBudgetPin(); setPinReset(true); }}
          >
            Forgot PIN — reset it
          </button>
        )}
        {pinReset && (
          <div style={{ fontSize: '0.72em', color: 'var(--text-muted)' }}>
            PIN cleared — you'll be asked to set a new one next time you open Budget.
          </div>
        )}
      </div>
      <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.4em' }}>
        <div className="settings-label">Sports — leagues to follow</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4em' }}>
          {LEAGUES.map((l) => (
            <div
              key={l.id}
              className={`fpill${sportsSettings.leagueIds.includes(l.id) ? ' on' : ''}`}
              onClick={() => toggleLeague(l.id)}
            >
              {l.label}
            </div>
          ))}
        </div>
        <div className="settings-label" style={{ marginTop: '0.4em' }}>Your teams (highlighted at the top of Sports)</div>
        <div style={{ display: 'flex', gap: '0.4em' }}>
          <input
            className="add-input"
            style={{ flex: 1 }}
            placeholder="e.g. Broncos, Avalanche…"
            value={teamInput}
            onChange={(e) => setTeamInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTeam()}
          />
          <button className="add-btn" onClick={addTeam}>Add</button>
        </div>
        {!!sportsSettings.teamNames.length && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4em' }}>
            {sportsSettings.teamNames.map((name) => (
              <div key={name} className="fpill on" style={{ cursor: 'pointer' }} onClick={() => removeTeam(name)} title="Tap to remove">
                {name} ✕
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.4em' }}>
        <div className="settings-label">Home Control (Home Assistant)</div>
        <div style={{ fontSize: '0.78em', color: 'var(--text-muted)' }}>
          For when the Phase 4 Pi exists — a local network address and a Long-Lived Access Token from your Home Assistant profile's Security tab. Home Control stays in preview mode until both are filled in and reachable.
        </div>
        <input
          className="add-input"
          placeholder="Home Assistant URL (e.g. http://homeassistant.local:8123)"
          value={haSettings.baseUrl}
          onChange={(e) => updateHaField('baseUrl', e.target.value)}
        />
        <input
          className="add-input"
          placeholder="Long-Lived Access Token"
          value={haSettings.accessToken}
          onChange={(e) => updateHaField('accessToken', e.target.value)}
        />
      </div>
      <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.4em' }}>
        <div className="settings-label">Report a problem</div>
        <div style={{ fontSize: '0.78em', color: 'var(--text-muted)' }}>
          Describe what went wrong — this opens your email app addressed to the family agent, same inbox as everything else.
        </div>
        <textarea
          className="add-input"
          style={{ height: 'auto', minHeight: '3.5em', resize: 'vertical', fontFamily: 'inherit' }}
          placeholder="e.g. the Groceries list didn't save my item…"
          value={bugText}
          onChange={(e) => { setBugText(e.target.value); setBugSent(false); }}
        />
        <button
          className="add-btn"
          style={{ justifyContent: 'center', width: '100%' }}
          onClick={sendBugReport}
          disabled={!bugText.trim()}
        >
          Email this report
        </button>
        {bugSent && (
          <div style={{ fontSize: '0.72em', color: 'var(--text-muted)' }}>
            Opened your email app with the report filled in — tap send there to finish.
          </div>
        )}
      </div>
    </div>
    {/* Rendered as a sibling of #settings-panel (a narrow sidebar box), not
        nested inside it, so HelpPanel's full-screen overlay positions
        against .aspect-wrap like Screensaver does, instead of being
        clipped to the settings sidebar's own small bounding box. */}
    <HelpPanel open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );
}
