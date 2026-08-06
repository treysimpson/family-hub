import { useState } from 'react';
import { initialChores, choreProgressColors, people } from '../data/mockData';

const PERSON_ORDER = ['trey', 'beryl', 'bryce', 'emery'];

export default function ChoresPage() {
  const [chores, setChores] = useState(initialChores);

  const toggleChore = (person, id) => {
    setChores((prev) => ({
      ...prev,
      [person]: prev[person].map((c) => (c.id === id ? { ...c, done: !c.done } : c)),
    }));
  };

  const totals = PERSON_ORDER.map((p) => {
    const list = chores[p];
    const done = list.filter((c) => c.done).length;
    return { person: p, done, total: list.length };
  });
  const overallDone = totals.reduce((sum, t) => sum + t.done, 0);
  const overallTotal = totals.reduce((sum, t) => sum + t.total, 0);

  return (
    <div className="page full-page active" id="page-chores">
      <div className="fp-sidebar">
        <div style={{ marginBottom: '0.4em' }}>
          <div className="fp-title">Chores</div>
          <div className="fp-subtitle">Week of Mar 20 · {overallDone} of {overallTotal} done</div>
        </div>

        <div className="chore-progress-box">
          <div className="chore-progress-label">Progress this week</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4em' }}>
            {totals.map(({ person, done, total }) => (
              <div key={person}>
                <div className="chore-progress-row">
                  <span>{people[person].name}</span>
                  <span style={{ color: done === total ? '#5DCAA5' : '#888780' }}>{done}/{total}</span>
                </div>
                <div className="chore-progress-track">
                  <div
                    className="chore-progress-fill"
                    style={{ width: `${total ? (done / total) * 100 : 0}%`, background: choreProgressColors[person] }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 'auto', paddingTop: '0.8em', borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
          <div className="chore-nav-label">Week navigation <span style={{ color: '#3a3a38' }}>· live in Phase 3</span></div>
          <div className="chore-nav-row">
            <button className="add-btn chore-nav-btn">← Prev</button>
            <button className="add-btn chore-nav-btn">Next →</button>
          </div>
        </div>
      </div>

      <div className="fp-main">
        <div className="chore-grid">
          {PERSON_ORDER.map((person) => {
            const { done, total } = totals.find((t) => t.person === person);
            return (
              <div className="chore-person" key={person}>
                <div className="chore-person-head">
                  <div className="chore-dot" style={{ background: people[person].color }} />
                  <div className="chore-person-name">{people[person].name}</div>
                  <div className="chore-score">{done} / {total}</div>
                </div>
                {chores[person].map((chore) => (
                  <div
                    key={chore.id}
                    className={`chore-item${chore.done ? ' done' : ''}`}
                    onClick={() => toggleChore(person, chore.id)}
                  >
                    <div className={`chore-cb${chore.done ? ' on' : ''}`} />
                    <div className="chore-text">{chore.text}</div>
                    <div className="chore-freq">{chore.freq}</div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
