import { useApp } from '../context/AppContext';

export default function WeatherPage() {
  const { openWxDay, weather, weatherError } = useApp();

  if (weatherError) {
    return (
      <div className="page active" id="page-weather" style={{ flexDirection: 'column', padding: '1.2em 1.6em', alignItems: 'center', justifyContent: 'center' }}>
        <div className="wx-hero-desc">Couldn't load weather — {weatherError}</div>
      </div>
    );
  }

  if (!weather) {
    return (
      <div className="page active" id="page-weather" style={{ flexDirection: 'column', padding: '1.2em 1.6em', alignItems: 'center', justifyContent: 'center' }}>
        <div className="wx-hero-desc">Loading weather…</div>
      </div>
    );
  }

  const { now, hourly, daily } = weather;

  return (
    <div className="page active" id="page-weather" style={{ flexDirection: 'column', padding: '1.2em 1.6em', gap: '1em' }}>
      <div className="wx-hero">
        <div className="wx-hero-icon">{now.icon}</div>
        <div className="wx-hero-temp">{now.temp}°</div>
        <div className="wx-hero-info">
          <div className="wx-hero-desc">{now.desc}</div>
          <div className="wx-hero-loc">{now.location}</div>
          <div className="wx-hero-feels">Feels like {now.feelsLike}° · High {now.high}° · Low {now.low}°</div>
        </div>
      </div>

      <div className="wx-stats">
        <div className="wx-stat"><div className="wx-stat-label">Humidity</div><div className="wx-stat-val">{now.humidity}</div></div>
        <div className="wx-stat"><div className="wx-stat-label">Wind</div><div className="wx-stat-val">{now.wind}</div></div>
        <div className="wx-stat"><div className="wx-stat-label">UV index</div><div className="wx-stat-val">{now.uv}</div></div>
        <div className="wx-stat"><div className="wx-stat-label">Visibility</div><div className="wx-stat-val">{now.visibility}</div></div>
        <div className="wx-stat"><div className="wx-stat-label">Sunrise</div><div className="wx-stat-val">{now.sunrise}</div></div>
        <div className="wx-stat"><div className="wx-stat-label">Sunset</div><div className="wx-stat-val">{now.sunset}</div></div>
      </div>

      <div>
        <div className="wx-section-label">Hourly</div>
        <div className="wx-hourly">
          {hourly.map((h, i) => (
            <div className="wx-hour" key={i}>
              <div className="wx-hour-time">{h.time}</div>
              <div className="wx-hour-ic">{h.icon}</div>
              <div className="wx-hour-temp">{h.temp}°</div>
              <div className="wx-hour-pop">{h.pop}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="wx-daily" style={{ flex: 1 }}>
        <div className="wx-section-label">
          7-day forecast <span style={{ fontSize: '0.85em', color: '#5f5e5a', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>· tap a day for details</span>
        </div>
        {daily.map((day, i) => (
          <div className="wx-day-row" key={i} onClick={() => openWxDay(day)}>
            <div className="wx-day-name">{day.day}</div>
            <div className="wx-day-ic">{day.icon}</div>
            <div className="wx-day-desc">{day.desc}</div>
            <div className="wx-bar-wrap">
              <div className="wx-bar" style={{ width: `${day.barWidth}%`, marginLeft: `${day.barOffset}%` }} />
            </div>
            <div className="wx-day-lo">{day.lo}°</div>
            <div className="wx-day-hi">{day.hi}°</div>
          </div>
        ))}
      </div>
    </div>
  );
}
