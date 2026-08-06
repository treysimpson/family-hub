const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function MonthView({ grid, onEventClick }) {
  return (
    <div className="cal-grid">
      {DOW.map((d) => <div className="cal-dow" key={d}>{d}</div>)}
      {grid.flat().map((cell, i) => (
        <div
          key={i}
          className={`cal-cell${cell.otherMonth ? ' other' : ''}${cell.today ? ' today' : ''}`}
          style={cell.faded ? { opacity: 0.4 } : undefined}
        >
          <div className={`cal-num${cell.otherMonth ? ' other-num' : ''}${cell.today ? ' today-num' : ''}`}>
            {cell.day}
          </div>
          {(cell.events || []).map((ev, j) => (
            <div
              key={j}
              className={`cal-ev ev-${ev.color}`}
              onClick={(e) => { e.stopPropagation(); onEventClick?.(ev); }}
            >
              {ev.label}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
