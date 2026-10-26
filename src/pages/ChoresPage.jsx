import { useState } from 'react';
import { initialChores, choreProgressColors, people, REWARD_KIDS, rewardCatalog } from '../data/mockData';
import { toDateKey, startOfWeek, addDays } from '../lib/dateGrid';
import {
  periodKeyFor, isChoreDone, toggleChoreDone, daysDoneInWeek, totalCompletions,
  pointsBalance, redeemReward,
} from '../lib/chores';

const PERSON_ORDER = ['trey', 'beryl', 'bryce', 'emery'];

// Chore *definitions* (who has which chore, how often, which routine, how
// many points) still come from mockData -- only completion state (and now
// redemptions) is live, in localStorage. Adding/editing chores or rewards
// in-app isn't built yet, same as before.
const CHORE_ICONS = {
  ch1: '🗑️', ch2: '🧹', ch3: '🌿', ch4: '🚪',
  ch5: '🧺', ch6: '🛒', ch7: '🚿', ch8: '🍱', ch9: '🍳',
  ch10: '🛏️', ch11: '🍽️', ch12: '🧸', ch13: '🐕',
  ch14: '🛏️', ch15: '🍽️', ch16: '🧸', ch17: '🪴', ch18: '🧽',
};

function formatWeekLabel(weekStart) {
  const end = addDays(weekStart, 6);
  const sameMonth = weekStart.getMonth() === end.getMonth();
  const startStr = weekStart.toLocaleDateString([], { month: 'short', day: 'numeric' });
  const endStr = end.toLocaleDateString([], sameMonth ? { day: 'numeric' } : { month: 'short', day: 'numeric' });
  return `Week of ${startStr}–${endStr}`;
}

// Groups a person's chores by `routine` (the T-36 mockup's grouping),
// preserving definition order; chores with no routine come back under
// `standalone` instead, shown by frequency the way the page always has.
function groupByRoutine(chores) {
  const routines = [];
  const byName = new Map();
  const standalone = [];
  chores.forEach((c) => {
    if (!c.routine) { standalone.push(c); return; }
    if (!byName.has(c.routine)) {
      const group = { name: c.routine, chores: [] };
      byName.set(c.routine, group);
      routines.push(group);
    }
    byName.get(c.routine).chores.push(c);
  });
  return { routines, standalone };
}

function RingIcon({ done, total, color }) {
  const frac = total ? done / total : 0;
  const circumference = 2 * Math.PI * 15.5;
  const dash = circumference * frac;
  return (
    <svg width="22" height="22" viewBox="0 0 36 36" style={{ flexShrink: 0 }}>
      <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--border-divider)" strokeWidth="3" />
      <circle
        cx="18" cy="18" r="15.5" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round"
        strokeDasharray={`${dash} ${circumference}`} transform="rotate(-90 18 18)"
      />
    </svg>
  );
}

export default function ChoresPage() {
  const today = new Date();
  const thisWeekStart = startOfWeek(today);
  const [selectedWeekStart, setSelectedWeekStart] = useState(thisWeekStart);
  const [redeemPromptId, setRedeemPromptId] = useState(null);
  // Bumped on every toggle/redeem to force a re-render -- completion/
  // redemption state lives in localStorage (src/lib/chores.js), not React
  // state, so nothing else would otherwise tell React this page needs to
  // redraw.
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

  // A single checkbox can't represent "5 of 7 days" for a past-week Daily
  // chore -- counts as done here only if every day was; the per-row display
  // falls back to the real "X/7 days" text instead of a checkbox in that case.
  const isDoneFor = (personId, chore) => {
    if (!isCurrentWeek && chore.freq === 'Daily') {
      return daysDoneInWeek(personId, chore.id, selectedWeekStart) === 7;
    }
    return isChoreDone(personId, chore.id, periodKeyFor(chore.freq, referenceDate));
  };

  const totals = PERSON_ORDER.map((personId) => {
    const list = initialChores[personId];
    const done = list.filter((c) => isDoneFor(personId, c)).length;
    return { personId, done, total: list.length };
  });
  const overallDone = totals.reduce((sum, t) => sum + t.done, 0);
  const overallTotal = totals.reduce((sum, t) => sum + t.total, 0);

  const handleRedeem = (personId, reward) => {
    redeemReward(personId, reward);
    setRedeemPromptId(null);
    forceRender((n) => n + 1);
  };

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

        <div style={{ marginTop: '1em' }} title="A simple running count of every chore ever checked off, independent of points">
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
            const { routines, standalone } = groupByRoutine(initialChores[personId]);
            const chip = (chore) => {
              const doneNow = isDoneFor(personId, chore);
              const dailyWeekCount = !isCurrentWeek && chore.freq === 'Daily'
                ? daysDoneInWeek(personId, chore.id, selectedWeekStart) : null;
              return (
                <div
                  key={chore.id}
                  className={`chore-item${doneNow ? ' done' : ''}`}
                  style={!isCurrentWeek ? { cursor: 'default', opacity: 0.85 } : undefined}
                  onClick={() => toggleChore(personId, chore)}
                >
                  <div className={`chore-cb${doneNow ? ' on' : ''}`} />
                  <span style={{ marginRight: '0.3em' }}>{CHORE_ICONS[chore.id]}</span>
                  <div className="chore-text">{chore.text}</div>
                  <div className="chore-freq">
                    {dailyWeekCount !== null ? `${dailyWeekCount}/7 days` : chore.freq}
                    {' · '}<span style={{ color: 'var(--ev-teal-tx, #5DCAA5)' }}>+{chore.points || 0}</span>
                  </div>
                </div>
              );
            };
            return (
              <div className="chore-person" key={personId}>
                <div className="chore-person-head">
                  <div className="chore-dot" style={{ background: people[personId].color }} />
                  <div className="chore-person-name">{people[personId].name}</div>
                  <div className="chore-score">{done} / {total}</div>
                </div>

                {routines.map((group) => {
                  const groupDone = group.chores.filter((c) => isDoneFor(personId, c)).length;
                  return (
                    <div key={group.name} style={{ marginBottom: '0.6em' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4em', padding: '0.3em 0.3em 0.2em' }}>
                        <RingIcon done={groupDone} total={group.chores.length} color={people[personId].color} />
                        <span style={{ fontSize: '0.78em', fontWeight: 'var(--font-weight-heading)', color: 'var(--text-muted)' }}>
                          {group.name} · {groupDone}/{group.chores.length}
                        </span>
                      </div>
                      {group.chores.map(chip)}
                    </div>
                  );
                })}
                {!!standalone.length && standalone.map(chip)}
              </div>
            );
          })}
        </div>

        <div className="task-section-head" style={{ marginTop: '1.4em' }}>Redeem points</div>
        <div className="card" style={{ padding: '0.9em 1em' }}>
          <div style={{ fontSize: '0.78em', color: 'var(--text-muted)', marginBottom: '0.7em' }}>
            A first pass — which rewards are on offer and what they cost is easy to retune later.
          </div>
          <div style={{ display: 'flex', gap: '0.6em', flexWrap: 'wrap', marginBottom: '0.9em' }}>
            {REWARD_KIDS.map((personId) => (
              <div
                key={personId}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4em', borderRadius: '999px',
                  padding: '0.3em 0.7em 0.3em 0.4em', background: 'var(--bg-card-hover)', fontSize: '0.85em', fontWeight: 'var(--font-weight-heading)',
                }}
              >
                <span className="chore-dot" style={{ background: people[personId].color, width: '0.7em', height: '0.7em' }} />
                {people[personId].name} — {pointsBalance(personId, initialChores[personId])} pts
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(13em, 1fr))', gap: '0.6em' }}>
            {rewardCatalog.map((reward) => {
              const affordableBy = REWARD_KIDS.filter((p) => pointsBalance(p, initialChores[p]) >= reward.cost);
              const isPrompting = redeemPromptId === reward.id;
              return (
                <div key={reward.id} className="task-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.4em', cursor: 'default' }}>
                  <div style={{ fontSize: '0.88em', fontWeight: 'var(--font-weight-heading)' }}>{reward.title}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.78em', color: 'var(--ev-teal-tx, #5DCAA5)' }}>{reward.cost} pts</span>
                    {!affordableBy.length && (
                      <span style={{ fontSize: '0.72em', color: 'var(--text-muted)' }}>Not affordable yet</span>
                    )}
                  </div>
                  {!!affordableBy.length && !isPrompting && (
                    <button className="add-btn" style={{ justifyContent: 'center' }} onClick={() => setRedeemPromptId(reward.id)}>
                      Redeem
                    </button>
                  )}
                  {isPrompting && (
                    <div style={{ display: 'flex', gap: '0.3em', flexWrap: 'wrap' }}>
                      {affordableBy.map((p) => (
                        <button key={p} className="add-btn" style={{ fontSize: '0.8em' }} onClick={() => handleRedeem(p, reward)}>
                          For {people[p].name}
                        </button>
                      ))}
                      <button className="add-btn" style={{ fontSize: '0.8em' }} onClick={() => setRedeemPromptId(null)}>Cancel</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
