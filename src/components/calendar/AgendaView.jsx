export default function AgendaView({ groups, onEventClick }) {
  return (
    <div className="agenda">
      {groups.map((group, i) => (
        <div key={i}>
          <div className="ag-day">{group.day}</div>
          {group.items.map((item, j) => (
            <div
              className="ag-row"
              key={j}
              onClick={() => onEventClick?.({
                title: item.title, date: item.date, time: item.fullTime, who: item.person || item.who,
                color: null, location: item.location, notes: item.notes,
              })}
            >
              <div className="ag-time">{item.time}</div>
              <div className="ag-dot" style={{ background: item.color }} />
              <div>
                <div className="ag-text">{item.title}</div>
                <div className="ag-who">{item.who}</div>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
