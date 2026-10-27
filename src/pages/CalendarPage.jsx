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
// 'all' is a meta/select-all control, not a real person -- kept out of the
// tracked Set itself (see togglePerson/the "on" check below) so its own
// highlighted state can be derived purely from whether every real person is
// selected, rather than needing to be kept in sync by every other toggle.
const PERSON_IDS = PERSON_PILLS.filter((p) => p.id !== 'all').map((p) => p.id);

export default function CalendarPage() {
  const { openEvent, calendarViews } = useApp();
  const [fcView, setFcView] = useState('week');
  const { monthGrid, weekDays, agendaGroups, live } = calendarViews;
  const monthLabel = live ? new Date().toLocaleDateString([], { month: 'long', year: 'numeric' }) : 'March / April 2026';
  // Person filter pills stay visual-only: a single primary Google Calendar has no
  // reliable per-family-member data to filter by (would need separate per-person
  // calendars merged together — a possible future enhancement).
  const [activePersons, setActivePersons] = useState(() => new Set(PERSON_IDS));

  const togglePerson = (id) => {
    setActivePersons((prev) => {
      const next = new Set(prev);
      if (id === 'all') {
        return next.size === PERSON_IDS.length ? new Set() : new Set(PERSON_IDS);
      }
      if (next.has(id)) next.delete(id); else next.add(id);
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

        <div
          style={{ display: 'flex', gap: '0.35em', marginBottom: '0.6em', flexShrink: 0 }}
          title="Visual only for now — one shared calendar has no per-person signal to actually filter by yet"
        >
          {PERSON_PILLS.map((p) => (
            <div
              key={p.id}
              className={`cpill ${p.cls}${(p.id === 'all' ? activePersons.size === PERSON_IDS.length : activePersons.has(p.id)) ? ' on' : ''}`}
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
