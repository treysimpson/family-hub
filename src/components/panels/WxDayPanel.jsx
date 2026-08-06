import { useApp } from '../../context/AppContext';

export default function WxDayPanel() {
  const { wxDayPanel, closeWxDay } = useApp();
  const d = wxDayPanel.data;

  const stats = d ? [
    ['Humidity', d.humidity], ['Wind', d.wind], ['UV Index', d.uv],
    ['Sunrise', d.sunrise], ['Sunset', d.sunset],
  ] : [];

  return (
    <div id="wx-day-panel" className={wxDayPanel.open ? 'open' : ''}>
      <div className="wx-dp-header">
        <div className="wx-dp-icon">{d?.icon || '☀️'}</div>
        <div>
          <div className="wx-dp-day">{d?.name || 'Day'}</div>
          <div className="wx-dp-desc">{d?.desc || 'Condition'}</div>
        </div>
        <div className="wx-dp-close" onClick={closeWxDay}>✕</div>
      </div>
      <div className="wx-dp-body">
        <div className="wx-dp-temps">
          <div className="wx-dp-temp-block"><div className="wx-dp-temp-label">High</div><div className="wx-dp-temp-val">{d ? `${d.hi}°` : '—'}</div></div>
          <div className="wx-dp-temp-block"><div className="wx-dp-temp-label">Low</div><div className="wx-dp-temp-val">{d ? `${d.lo}°` : '—'}</div></div>
        </div>
        <div className="wx-dp-stats">
          {stats.map(([label, val]) => (
            <div className="wx-dp-stat" key={label}>
              <div className="wx-dp-stat-label">{label}</div>
              <div className="wx-dp-stat-val">{val}</div>
            </div>
          ))}
        </div>
        <div>
          <div className="wx-dp-section-label">Hourly</div>
          <div className="wx-dp-hourly">
            {(d?.hourly || []).map(([t, ic, temp, pop], i) => (
              <div className="wx-dp-hour-row" key={i}>
                <span className="wx-dp-hour-time">{t}</span>
                <span className="wx-dp-hour-ic">{ic}</span>
                <span className="wx-dp-hour-temp">{temp}</span>
                {pop && <span className="wx-dp-hour-pop">💧{pop}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
