import { useApp } from '../../context/AppContext';
import { agentInbox } from '../../data/mockData';

// Was "Agent inbox · 2 new" with a hardcoded "2" badge on the bell icon in
// TopBar.jsx -- implying real unread notifications, but agentInbox has
// always been illustrative mock data (the email agent writes straight to
// Tasks/Calendar/Sheets, there's no live activity feed for the app to read).
// Relabeled honestly as a reference for what to send, not a notification
// center, and the fake unread badge was removed from the bell.
export default function AgentPanel() {
  const { agentPanelOpen } = useApp();

  return (
    <div id="agent-panel" className={agentPanelOpen ? 'show' : ''}>
      <div className="agent-panel-title">What you can email the agent</div>
      <div style={{ fontSize: '0.78em', color: 'var(--text-muted)', marginBottom: '0.7em' }}>
        Email or voice-dictate to <strong>simpsonfamilyhubapp@gmail.com</strong> — these are examples of what it understands, not real activity.
      </div>
      {agentInbox.map((item, i) => (
        <div className="agent-item" key={i}>
          <div className="agent-from">{item.from}</div>
          <div className="agent-msg">{item.msg}</div>
        </div>
      ))}
      <div style={{ fontSize: '0.72em', color: 'var(--text-muted)', marginTop: '0.6em' }}>
        Receipts, bug reports, and card/budget alerts go to the same address — see Settings → Report a problem, or the Budget page's "How to" button for the full list.
      </div>
    </div>
  );
}
