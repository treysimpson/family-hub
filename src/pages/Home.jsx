import { useState } from 'react';
import { useApp } from '../context/AppContext';
import MonthView from '../components/calendar/MonthView';
import WeekView from '../components/calendar/WeekView';
import AgendaView from '../components/calendar/AgendaView';
import { people, familySummary, homeGroceryTeaser } from '../data/mockData';

const CAL_VIEWS = [
  { id: 'month', label: 'Month' },
  { id: 'week', label: 'Week' },
  { id: 'next5', label: 'Next 5 days' },
  { id: 'agenda', label: 'Agenda' },
];

// Google Tasks only has 4 lists (Trey/Beryl/Kids/Family, no separate Bryce or
// Emery lists), unlike the mock's 4 individual family members — so the live
// version groups by list, not by person, and shows open-item counts instead
// of a "next event" (no per-person calendar signal exists to source that from).
const FAMILY_GROUPS = [
  { key: 'trey', label: 'Trey', color: 'var(--tag-trey-tx)' },
  { key: 'beryl', label: 'Beryl', color: 'var(--tag-beryl-tx)' },
  { key: 'kids', label: 'Kids', color: 'var(--tag-kids-tx)' },
  { key: 'family', label: 'Family', color: 'var(--tag-family-tx)' },
];

export default function Home() {
  const { setPage, navToEvent, calendarViews, tasksLive, personTasks, groceryTasks, toggleTaskLive } = useApp();
  const [calView, setCalView] = useState('week');
  const { monthGrid, weekDays, next5Days, agendaGroups, live } = calendarViews;
  const monthLabel = live ? new Date().toLocaleDateString([], { month: 'long', year: 'numeric' }) : 'March 2026';

  const groceryPreview = tasksLive
    ? groceryTasks.filter((t) => t.key === 'grocery').slice(0, 6)
    : homeGroceryTeaser.map((item, i) => ({ id: `mock-${i}`, text: item.text, done: item.done }));

  const familyGroups = tasksLive
    ? FAMILY_GROUPS.map((g) => ({ ...g, open: personTasks.filter((t) => t.key === g.key && !t.done) }))
    : null;

  return (
    <div className="page active" id="page-home">
      <div className="main-col">
        <div className="card cal-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6em', flexShrink: 0 }}>
            <div className="card-label" style={{ marginBottom: 0 }}>Calendar — {monthLabel}</div>
            <div style={{ display: 'flex', gap: '0.3em' }}>
              {CAL_VIEWS.map((v) => (
                <div key={v.id} className={`tog${calView === v.id ? ' on' : ''}`} onClick={() => setCalView(v.id)}>
                  {v.label}
                </div>
              ))}
            </div>
          </div>
          <div className="card-fill" style={{ display: 'flex', flexDirection: 'column' }}>
            {calView === 'month' && <MonthView grid={monthGrid} />}
            {calView === 'week' && <WeekView days={weekDays} onEventClick={navToEvent} />}
            {calView === 'next5' && <WeekView days={next5Days} onEventClick={navToEvent} />}
            {calView === 'agenda' && <AgendaView groups={agendaGroups.slice(0, 3)} />}
          </div>
        </div>
      </div>

      <div className="side-col">
        <div className="card">
          <div className="card-label">Family</div>
          {tasksLive
            ? familyGroups.map((group) => (
                <div className="person-card" key={group.key}>
                  <div className="person-header">
                    <div className="person-dot" style={{ background: group.color }} />
                    <div className="person-name">{group.label}</div>
                    <div className="person-next">{group.open.length ? `${group.open.length} open` : 'All done'}</div>
                  </div>
                  {group.open.slice(0, 3).map((task) => (
                    <div className="person-todo tappable" key={task.id} onClick={() => setPage('tasks')}>
                      <div className="mini-check" />{task.text}
                    </div>
                  ))}
                </div>
              ))
            : familySummary.map((entry) => {
                const person = people[entry.person];
                return (
                  <div className="person-card" key={entry.person}>
                    <div className="person-header">
                      <div className="person-dot" style={{ background: person.color }} />
                      <div className="person-name">{person.name}</div>
                      <div className="person-next">{entry.next}</div>
                    </div>
                    {entry.todos.map((todo) => (
                      <div className="person-todo tappable" key={todo} onClick={() => setPage('tasks')}>
                        <div className="mini-check" />{todo}
                      </div>
                    ))}
                  </div>
                );
              })}
        </div>

        <div className="card" style={{ flex: 1 }}>
          <div className="card-label">Groceries</div>
          {groceryPreview.map((item) => (
            <div
              className="g-item tappable"
              key={item.id}
              onClick={() => (tasksLive ? toggleTaskLive(item) : setPage('groceries'))}
            >
              <div className={`check-box${item.done ? ' done' : ''}`} />
              <span className={`g-text${item.done ? ' done' : ''}`}>{item.text}</span>
            </div>
          ))}
          <div className="add-row">
            <input className="add-input" placeholder="Add item..." onClick={() => setPage('groceries')} readOnly />
            <button className="add-btn" onClick={() => setPage('groceries')}>Add</button>
          </div>
        </div>
      </div>
    </div>
  );
}
