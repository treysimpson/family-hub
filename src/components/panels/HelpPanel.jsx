// Global "how does this work" reference, opened from Settings. Complements
// (doesn't replace) Budget's own HowToPanel, which goes into more detail on
// transaction input methods specifically — this one is the app-wide
// starting point: the one email address basically everything funnels
// through, plus a one-line note per page that isn't self-explanatory.
const AGENT_EXAMPLES = [
  { you: '"Add dentist appt for Emery Mar 21 at 2pm"', does: 'Adds it to the shared calendar' },
  { you: '"Add milk to groceries"', does: 'Adds it to the Grocery list' },
  { you: '"Beryl spent $120 on shoes"', does: 'Deducts it from her Fun Money balance' },
  { you: 'A Target/Costco receipt photo', does: 'Itemizes and splits it across Budget categories' },
  { you: 'A bug report (or use Settings → Report a problem)', does: 'Lands for Trey to read — no reply is sent' },
];

const PAGE_NOTES = [
  { page: 'Calendar', note: 'The person filter pills (Trey/Beryl/Kids/Family) are visual only for now — one shared calendar has no per-person signal to actually filter by yet.' },
  { page: 'Budget', note: 'PIN-protected. Tap the "How to" button there for the full list of ways a transaction gets in, including where to send receipts and statements.' },
  { page: 'Chores', note: 'Daily chores reset each morning, Weekly each Sunday, Monthly each 1st, automatically — no need to re-check anything. "All-time completions" is a simple running count, not tied to a rewards system yet.' },
  { page: 'Home Control', note: 'Preview only — not connected to real devices yet (needs the planned Phase 4 Raspberry Pi).' },
  { page: 'Sports', note: 'Pick leagues and your teams in Settings below — nothing shows until you do.' },
];

export default function HelpPanel({ open, onClose }) {
  if (!open) return null;

  return (
    <div
      style={{
        position: 'absolute', inset: 0, zIndex: 40,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '2em',
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ maxWidth: '36em', maxHeight: '100%', width: '100%', overflowY: 'auto', padding: '1.2em 1.4em' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="fp-title" style={{ fontSize: '1.05em' }}>How this works</div>
          <span style={{ cursor: 'pointer', fontSize: '1.1em', color: 'var(--text-muted)' }} onClick={onClose}>✕</span>
        </div>

        <div className="task-section-head" style={{ marginTop: '1em' }}>Email simpsonfamilyhubapp@gmail.com for...</div>
        {AGENT_EXAMPLES.map((e) => (
          <div key={e.you} style={{ marginTop: '0.6em' }}>
            <div style={{ fontWeight: 'var(--font-weight-heading)', fontSize: '0.9em' }}>{e.you}</div>
            <div style={{ fontSize: '0.8em', color: 'var(--text-muted)' }}>→ {e.does}</div>
          </div>
        ))}
        <div style={{ fontSize: '0.74em', color: 'var(--text-muted)', marginTop: '0.6em' }}>
          Voice-dictate via Siri/Google Assistant to that address works the same as typing an email.
        </div>

        <div className="task-section-head" style={{ marginTop: '1.2em' }}>Page-by-page notes</div>
        {PAGE_NOTES.map((p) => (
          <div key={p.page} style={{ marginTop: '0.6em' }}>
            <div style={{ fontWeight: 'var(--font-weight-heading)', fontSize: '0.9em' }}>{p.page}</div>
            <div style={{ fontSize: '0.8em', color: 'var(--text-muted)' }}>{p.note}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
