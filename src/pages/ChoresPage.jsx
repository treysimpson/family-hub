import { useState } from 'react';
import { initialChores, choreProgressColors, people } from '../data/mockData';
import { toDateKey, startOfWeek, addDays } from '../lib/dateGrid';
import { periodKeyFor, isChoreDone, toggleChoreDone, daysDoneInWeek, totalCompletions } from '../lib/chores';

const PERSON_ORDER = ['trey', 'beryl', 'bryce', 'emery'];

// Chore *definitions* (who has which chore, how often) still come from
// mockData -- only completion state is live now (see src/lib/chores.js).
// Adding/editing/removing chores themselves isn't built yet, same as before.
function formatWeekLabel(weekStart) {
  const end = addDays(weekStart, 6);
  const sameMonth = weekStart.getMonth() === end.getMonth();
  const startStr = weekStart.toLocaleDateString([], { month: 'short', day: 'numeric' });
  const endStr = end.toLocaleDateString([], sameMonth ? { day: 'numeric' } : { month: 'short', day: 'numeric' });
  return `Week of ${startStr}–${endStr}`;
}

export default function ChoresPage() {
  const today = new Date();
  const thisWeekStart = startOfWeek(today);
  const [selectedWeekStart, setSelectedWeekStart] = useState(thisWeekStart);
  // Bumped on every toggle to force a re-render -- completion state lives in
  // localStorage (src/lib/chores.js), not React state, so nothing else
  // would otherwise tell React this page needs to redraw.
  const [, forceRender] = useState(0);

  const isCurrentWeek = toDateKey(selectedWeekStart) === toDateKey(thisWeekStart);
  // The reference date each chore's period key is computed against: for the
  // current week that's literally today (so a Daily chore reflects today,
  // not "the Sunday of this week"); for any other week it's that week's
  // Sunday, which is also correct for Weekly/Monthly chores and is handled
  // separately for Daily ones via daysDoneInWeek below.
  const referenceDate = isCurrentWeek ? today : selectedWeekStart;

  const toggleChore = (personId, chore) => {
    if (!isCurrentWeek) return; // past/future weeks are a read-only record
    toggleChoreDone(personId, chore.id, periodKeyFor(chore.freq, referenceDate));
    forceRender((n) => n + 1);
  };

  // Same "is this chore done" rule as each row below -- a past-week Daily
  // chore only counts as done here if every one of its 7 days was.
  const isDoneForTotals = (personId, chore) => {
    if (!isCurrentWeek && chore.freq === 'Daily') {
      return daysDoneInWeek(personId, chore.id, selectedWeekStart) === 7;
    }
    return isChoreDone(personId, chore.id, periodKeyFor(chore.freq, referenceDate));
  };

  const totals = PERSON_ORDER.map((personId) => {
    const list = initialChores[personId];
    const done = list.filter((c) => isDoneForTotals(personId, c)).length;
    return { personId, done, total: list.length };
  });
  const overallDone = totals.reduce((sum, t) => sum + t.done, 0);
  const overallTotal = totals.reduce((sum, t) => sum + t.total, 0);

  return (
    <div className="page full-page active" id="page-chores">
      <div className="fp-sidebar">
        <div style={{ marginBottom: '0.4em' }}>
          <div className="fp-title">Chores</div>
          <div className="fp-subtitle">{formatWeekLabel(selectedWeekStart)} · {overallDone} of {overallTotal} done</div>
        </div>

        <div className="chore-progress-box" title="Daily chores reset each morning, Weekly each Sunday, Monthly each 1st — no need to re-check them, they just clear on their own">
          <div className="chore-progress-label">Progress this week</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4em' }}>
            {totals.map(({ personId, done, total }) => (
              <div key={personId}>
                <div className="chore-progress-row">
                  <span>{people[personId].name}</span>
                  <span style={{ color: done === total ? '#5DCAA5' : '#888780' }}>{done}/{total}</span>
                </div>
                <div className="chore-progress-track">
                  <div
                    className="chore-progress-fill"
                    style={{ width: `${total ? (done / total) * 100 : 0}%`, background: choreProgressColors[personId] }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: '1em' }} title="A simple running count of every chore ever checked off — not tied to a points or reward system yet">
          <div className="chore-progress-label">All-time completions</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3em', fontSize: '0.85em' }}>
            {PERSON_ORDER.map((personId) => (
              <div key={personId} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{people[personId].name}</span>
                <span style={{ color: 'var(--text-muted)' }}>{totalCompletions(personId)}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 'auto', paddingTop: '0.8em', borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
          <div className="chore-nav-label">
            Week navigation
            {!isCurrentWeek && (
              <span
                style={{ color: 'var(--fpill-teal-tx, #5DCAA5)', cursor: 'pointer', marginLeft: '0.5em' }}
                onClick={() => setSelectedWeekStart(thisWeekStart)}
              >
                · back to this week
              </span>
            )}
          </div>
          <div className="chore-nav-row">
            <button className="add-btn chore-nav-btn" onClick={() => setSelectedWeekStart((w) => addDays(w, -7))}>← Prev</button>
            <button className="add-btn chore-nav-btn" onClick={() => setSelectedWeekStart((w) => addDays(w, 7))}>Next →</button>
          </div>
        </div>
      </div>

      <div className="fp-main">
        {!isCurrentWeek && (
          <div style={{ fontSize: '0.78em', color: 'var(--text-muted)', marginBottom: '0.6em' }}>
            Viewing a past/future week — read-only record, not editable here.
          </div>
        )}
        <div className="chore-grid">
          {PERSON_ORDER.map((personId) => {
            const { done, total } = totals.find((t) => t.personId === personId);
            return (
              <div className="chore-person" key={personId}>
                <div className="chore-person-head">
                  <div className="chore-dot" style={{ background: people[personId].color }} />
                  <div className="chore-person-name">{people[personId].name}</div>
                  <div className="chore-score">{done} / {total}</div>
                </div>
                {initialChores[personId].map((chore) => {
                  const isDaily = chore.freq === 'Daily';
                  const dailyWeekCount = !isCurrentWeek && isDaily ? daysDoneInWeek(personId, chore.id, selectedWeekStart) : null;
                  // A single checkbox can't represent "5 of 7 days" -- only
                  // show it checked for a past-week Daily chore if every day
                  // was done; the real detail is in the "X/7 days" text.
                  const doneNow = dailyWeekCount !== null
                    ? dailyWeekCount === 7
                    : isChoreDone(personId, chore.id, periodKeyFor(chore.freq, referenceDate));
                  return (
                    <div
                      key={chore.id}
                      className={`chore-item${doneNow ? ' done' : ''}`}
                      style={!isCurrentWeek ? { cursor: 'default', opacity: 0.85 } : undefined}
                      onClick={() => toggleChore(personId, chore)}
                    >
                      <div className={`chore-cb${doneNow ? ' on' : ''}`} />
                      <div className="chore-text">{chore.text}</div>
                      <div className="chore-freq">{dailyWeekCount !== null ? `${dailyWeekCount}/7 days` : chore.freq}</div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
