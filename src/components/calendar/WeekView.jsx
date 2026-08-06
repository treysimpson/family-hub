export default function WeekView({ days, onEventClick, todayLabel }) {
  return (
    <div className={`week-grid days${days.length}`} style={{ height: '100%' }}>
      {days.map((day, i) => (
        <div className="week-day-col" key={i}>
          <div className={`week-day-header${day.today ? ' is-today' : ''}`}>
            <div className="week-header-top">
              <span className="week-dow">{day.today && todayLabel ? todayLabel : day.dow}</span>
              <span className="week-date">{day.date}</span>
            </div>
            <div className="week-wx">
              <span className="wx-ic">{day.wxIcon}</span>
              <span className="wx-hi">{day.hi}°</span>
              <span className="wx-sep">/</span>
              <span className="wx-lo">{day.lo}°</span>
            </div>
          </div>
          <div className="week-events">
            {day.events.map((ev, j) => (
              <div
                key={j}
                className={`week-ev ev-${ev.color}`}
                onClick={() => onEventClick?.({
                  title: ev.title, date: ev.date, time: ev.fullTime, who: ev.who,
                  color: ev.color, location: ev.location, notes: ev.notes,
                })}
              >
                <span className="ev-time">{ev.time}</span>
                <span className="ev-title">{ev.title}</span>
                {ev.who && <span className="ev-who">{ev.who}</span>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
