import { useApp } from '../../context/AppContext';
import { agentInbox } from '../../data/mockData';

export default function AgentPanel() {
  const { agentPanelOpen } = useApp();

  return (
    <div id="agent-panel" className={agentPanelOpen ? 'show' : ''}>
      <div className="agent-panel-title">Agent inbox · {agentInbox.length} new</div>
      {agentInbox.map((item, i) => (
        <div className="agent-item" key={i}>
          <div className="agent-from">{item.from}</div>
          <div className="agent-msg">{item.msg}</div>
        </div>
      ))}
    </div>
  );
}
