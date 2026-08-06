import { useApp } from '../../context/AppContext';

const COLOR_MAP = { teal: '#5DCAA5', coral: '#F0997B', purple: '#AFA9EC' };

export default function EventPanel() {
  const { eventPanel, closeEvent } = useApp();
  const data = eventPanel.data || {};
  const borderColor = COLOR_MAP[data.color] || '#888';

  return (
    <div id="event-panel" className={eventPanel.open ? 'open' : ''}>
      <div className="ep-header">
        <span className="ep-close" onClick={closeEvent}>✕</span>
        <div
          className="ep-title"
          style={{ borderLeft: `3px solid ${borderColor}`, paddingLeft: '0.5em' }}
        >
          {data.title || 'Event title'}
        </div>
        <div className="ep-cal">Family Calendar</div>
      </div>
      <div className="ep-body">
        <div className="ep-row">
          <div className="ep-icon">🗓️</div>
          <div><div className="ep-label">Date</div><div className="ep-val">{data.date || '—'}</div></div>
        </div>
        <div className="ep-divider" />
        <div className="ep-row">
          <div className="ep-icon">🕐</div>
          <div><div className="ep-label">Time</div><div className="ep-val">{data.time || '—'}</div></div>
        </div>
        <div className="ep-divider" />
        <div className="ep-row">
          <div className="ep-icon">👤</div>
          <div><div className="ep-label">Who</div><div className="ep-val">{data.who || '—'}</div></div>
        </div>
        {data.location && (
          <>
            <div className="ep-divider" />
            <div className="ep-row">
              <div className="ep-icon">📍</div>
              <div><div className="ep-label">Location</div><div className="ep-val">{data.location}</div></div>
            </div>
          </>
        )}
        {data.notes && (
          <>
            <div className="ep-divider" />
            <div className="ep-row">
              <div className="ep-icon">📝</div>
              <div><div className="ep-label">Notes</div><div className="ep-val">{data.notes}</div></div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
