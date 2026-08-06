import { useState } from 'react';
import { useApp } from '../context/AppContext';
import MonthView from '../components/calendar/MonthView';
import WeekView from '../components/calendar/WeekView';
import AgendaView from '../components/calendar/AgendaView';

const FC_VIEWS = [
  { id: 'month', label: 'Month' },
  { id: 'week', label: 'Week' },
  { id: 'agenda', label: 'Agenda' },
];

const PERSON_PILLS = [
  { id: 'all', label: 'All', cls: '' },
  { id: 'trey', label: 'Trey', cls: 'ctrey' },
  { id: 'beryl', label: 'Beryl', cls: 'cberyl' },
  { id: 'kids', label: 'Bryce & Emery', cls: 'ckids' },
  { id: 'family', label: 'Family', cls: 'cfamily' },
];

export default function CalendarPage() {
  const { openEvent, calendarViews } = useApp();
  const [fcView, setFcView] = useState('week');
  const { monthGrid, weekDays, agendaGroups, live } = calendarViews;
  const monthLabel = live ? new Date().toLocaleDateString([], { month: 'long', year: 'numeric' }) : 'March / April 2026';
  // Person filter pills stay visual-only: a single primary Google Calendar has no
  // reliable per-family-member data to filter by (would need separate per-person
  // calendars merged together — a possible future enhancement).
  const [activePersons, setActivePersons] = useState(() => new Set(PERSON_PILLS.map((p) => p.id)));

  const togglePerson = (id) => {
    setActivePersons((prev) => {
      const next = new Set(prev);
      if (id === 'all') {
        return next.size === PERSON_PILLS.length ? new Set() : new Set(PERSON_PILLS.map((p) => p.id));
      }
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="page active" id="page-calendar" style={{ flexDirection: 'column', padding: '1em' }}>
      <div className="card" style={{ flex: 1, minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5em', flexShrink: 0 }}>
          <div className="card-label" style={{ marginBottom: 0 }}>Calendar — {monthLabel}</div>
          <div style={{ display: 'flex', gap: '0.3em' }}>
            {FC_VIEWS.map((v) => (
              <div key={v.id} className={`tog${fcView === v.id ? ' on' : ''}`} onClick={() => setFcView(v.id)}>
                {v.label}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.35em', marginBottom: '0.6em', flexShrink: 0 }}>
          {PERSON_PILLS.map((p) => (
            <div
              key={p.id}
              className={`cpill ${p.cls}${activePersons.has(p.id) || (p.id === 'all' && activePersons.size === PERSON_PILLS.length) ? ' on' : ''}`}
              onClick={() => togglePerson(p.id)}
            >
              {p.label}
            </div>
          ))}
        </div>

        <div className="card-fill" style={{ display: 'flex', flexDirection: 'column' }}>
          {fcView === 'month' && <MonthView grid={monthGrid} onEventClick={openEvent} />}
          {fcView === 'week' && <WeekView days={weekDays} onEventClick={openEvent} />}
          {fcView === 'agenda' && <AgendaView groups={agendaGroups} onEventClick={openEvent} />}
        </div>
      </div>
    </div>
  );
}
