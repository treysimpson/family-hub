// Quick reference for every way a transaction gets into the Budget page
// (T-23) — some automatic, some needing a receipt emailed in. Local to
// BudgetPage rather than a global AppContext-driven panel like Settings/
// Event, since it's Budget-specific and doesn't need to be reachable from
// other pages.

function formatCurrency(amount) {
  return amount.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

const INPUT_METHODS = [
  {
    title: 'Credit/debit card charges',
    mode: 'Automatic',
    detail: 'Every card alert email becomes a transaction within a few minutes, tagged with a best-guess category.',
  },
  {
    title: 'Target — online order',
    mode: 'Automatic',
    detail: 'Target.com order confirmations arrive with real per-item prices, so the charge gets genuinely split across categories, not just one guess.',
  },
  {
    title: 'Target — in-store purchase',
    mode: 'Email a photo',
    detail: 'Screenshot the itemized purchase in the Target app (or photograph a paper receipt) and email it to simpsonfamilyhubapp@gmail.com — it\'s recognized and split automatically, no label needed.',
  },
  {
    title: 'Costco — in-store purchase',
    mode: 'Email a photo',
    detail: 'Costco has no order emails at all — photograph the paper receipt and email it to simpsonfamilyhubapp@gmail.com the same way as a Target in-store receipt.',
  },
  {
    title: 'Amazon orders',
    mode: 'Automatic',
    detail: 'Order-status emails only give item counts per category (not per-item prices), so the whole order gets tagged with its majority category rather than split.',
  },
  {
    title: 'Fun money (Trey/Beryl personal spend)',
    mode: 'Message the agent',
    detail: 'Email simpsonfamilyhubapp@gmail.com something like "Beryl spent $120 on shoes" — it\'s deducted from her Fun Money balance, not the shared budget.',
  },
  {
    title: 'Statement import (backfill or monthly check)',
    mode: 'Email the PDF',
    detail: 'Download the statement PDF from the card issuer, email it to yourself, and apply the "Statement Import" label — fills in anything a card alert missed.',
  },
];

export default function HowToPanel({ open, onClose, missingReceiptTransactions }) {
  if (!open) return null;

  return (
    <div
      style={{
        position: 'absolute', inset: 0, zIndex: 30,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '2em',
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ maxWidth: '34em', maxHeight: '100%', width: '100%', overflowY: 'auto', padding: '1.2em 1.4em' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="fp-title" style={{ fontSize: '1.05em' }}>How to add transactions</div>
          <span style={{ cursor: 'pointer', fontSize: '1.1em', color: 'var(--text-muted)' }} onClick={onClose}>✕</span>
        </div>

        {INPUT_METHODS.map((m) => (
          <div key={m.title} style={{ marginTop: '0.9em' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5em', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 'var(--font-weight-heading)' }}>{m.title}</span>
              <span
                style={{
                  fontSize: '0.68em', textTransform: 'uppercase', letterSpacing: '0.05em',
                  color: m.mode === 'Automatic' ? 'var(--ev-teal-tx)' : 'var(--accent-primary)',
                }}
              >
                {m.mode}
              </span>
            </div>
            <div style={{ fontSize: '0.82em', color: 'var(--text-muted)', marginTop: '0.15em' }}>{m.detail}</div>
          </div>
        ))}

        <div className="task-section-head" style={{ marginTop: '1.2em' }}>
          Receipts not yet sent in ({missingReceiptTransactions.length})
        </div>
        <div style={{ fontSize: '0.78em', color: 'var(--text-muted)', marginBottom: '0.4em' }}>
          These are still just the card alert's best guess — a Target/Costco receipt or nothing at all for Amazon (which auto-matches instead).
        </div>
        {missingReceiptTransactions.map((t) => (
          <div key={t.row} className="task-item">
            <div>
              <div className="task-text">{t.merchant}</div>
              <div className="task-meta">
                <span className="task-due">{t.date}</span>
              </div>
            </div>
            <div style={{ marginLeft: 'auto', fontWeight: 'var(--font-weight-heading)' }}>
              {formatCurrency(t.amount)}
            </div>
          </div>
        ))}
        {!missingReceiptTransactions.length && (
          <div style={{ color: 'var(--text-muted)', padding: '0.6em 0' }}>
            All caught up — every Target/Costco/Amazon transaction has been matched or itemized.
          </div>
        )}
      </div>
    </div>
  );
}
