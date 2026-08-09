import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { TRANSACTION_CATEGORIES } from '../lib/googleSheets';
import PinGate from '../components/PinGate';

function formatCurrency(amount) {
  return amount.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

function formatCategoryLabel(category) {
  return category.split('-').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function formatMonthLabel(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString(undefined, { month: 'long', year: 'numeric' });
}

function shiftMonthKey(monthKey, delta) {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// Flat $25 warning line rather than a percentage — both pools are $250/mo
// today, so this is ~10%; revisit if the monthly amounts ever diverge a lot.
const FUN_MONEY_LOW_THRESHOLD = 25;

export default function BudgetPage() {
  const { isSignedIn } = useAuth();
  const {
    budgetLive, budgetMonthTotal, budgetError,
    selectedBudgetMonth, setSelectedBudgetMonth, selectedMonthTransactions,
    budgetOneTimeTotal, budgetReimbursableTotal, budgetCategoryTotals, budgetTargets,
    budgetFixedTotal, budgetDiscretionaryTotal, recategorizeTransaction, renameMerchant, budgetActionError,
    funMoneyEntries, funMoneyBalances, orderItemsByEmailId,
  } = useApp();
  const [unlocked, setUnlocked] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  // Set once a category is picked, before the always/once scope is chosen.
  const [pendingCategory, setPendingCategory] = useState(null); // { row, category }
  const [renamingRow, setRenamingRow] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [detailsRow, setDetailsRow] = useState(null);

  if (!isSignedIn) {
    return (
      <div className="page active" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          Sign in with Google in Settings to see your budget.
        </div>
      </div>
    );
  }

  if (!unlocked) {
    return <PinGate onUnlock={() => setUnlocked(true)} />;
  }

  if (budgetError) {
    return (
      <div className="page active" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'var(--ev-coral-tx)' }}>{budgetError}</div>
      </div>
    );
  }

  if (!budgetLive) {
    return (
      <div className="page active" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--text-muted)' }}>Loading…</div>
      </div>
    );
  }

  // All of the selected month's transactions, not just a fixed recent
  // count — the month nav below is what makes this "open all the details
  // for that month" rather than a rolling most-recent-10 list.
  const monthTransactions = [...selectedMonthTransactions].sort((a, b) => (a.date < b.date ? 1 : -1));

  const categoryRows = Object.entries(budgetCategoryTotals).sort((a, b) => b[1] - a[1]);

  const recentFunActivity = funMoneyEntries
    .filter((f) => f.type === 'spend' || f.type === 'return')
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 10);

  const isCurrentMonth = selectedBudgetMonth === currentMonthKey();

  return (
    <div className="page full-page active" id="page-budget">
      <div className="fp-sidebar">
        <div className="fp-title">Budget</div>
        <div className="fp-subtitle" style={{ display: 'flex', alignItems: 'center', gap: '0.5em' }}>
          <button
            className="add-btn"
            style={{ padding: '0.05em 0.5em', fontSize: '1em' }}
            onClick={() => setSelectedBudgetMonth(shiftMonthKey(selectedBudgetMonth, -1))}
            aria-label="Previous month"
          >
            ‹
          </button>
          <span>{formatMonthLabel(selectedBudgetMonth)}</span>
          <button
            className="add-btn"
            style={{ padding: '0.05em 0.5em', fontSize: '1em', visibility: isCurrentMonth ? 'hidden' : 'visible' }}
            onClick={() => setSelectedBudgetMonth(shiftMonthKey(selectedBudgetMonth, 1))}
            aria-label="Next month"
          >
            ›
          </button>
        </div>

        <div
          className="card tappable"
          style={{ marginTop: '1em', padding: '0.8em', textAlign: 'center', cursor: 'pointer' }}
          onClick={() => setShowCategories((v) => !v)}
        >
          <div style={{ fontSize: '0.75em', color: 'var(--text-muted)' }}>Total spent (tap for categories)</div>
          <div style={{ fontSize: '1.8em', fontWeight: 'var(--font-weight-heading)' }}>
            {formatCurrency(budgetMonthTotal)}
          </div>
          {fixedBillsAvailable(budgetFixedTotal, budgetDiscretionaryTotal) && (
            <div style={{ fontSize: '0.72em', color: 'var(--text-muted)', marginTop: '0.3em' }}>
              {formatCurrency(budgetFixedTotal)} fixed · {formatCurrency(budgetDiscretionaryTotal)} discretionary
            </div>
          )}
        </div>

        {budgetOneTimeTotal > 0 && (
          <div className="card" style={{ marginTop: '0.6em', padding: '0.6em 0.8em' }}>
            <div style={{ fontSize: '0.72em', color: 'var(--text-muted)' }}>Major expenses this month</div>
            <div style={{ fontSize: '1.1em', fontWeight: 'var(--font-weight-heading)' }}>
              {formatCurrency(budgetOneTimeTotal)}
            </div>
          </div>
        )}

        {budgetReimbursableTotal > 0 && (
          <div className="card" style={{ marginTop: '0.6em', padding: '0.6em 0.8em' }}>
            <div style={{ fontSize: '0.72em', color: 'var(--text-muted)' }}>Trey&apos;s work (pending reimbursement)</div>
            <div style={{ fontSize: '1.1em', fontWeight: 'var(--font-weight-heading)' }}>
              {formatCurrency(budgetReimbursableTotal)}
            </div>
          </div>
        )}

        <div className="fp-subtitle" style={{ marginTop: '1em' }}>Fun money</div>
        <div style={{ display: 'flex', gap: '0.5em', marginTop: '0.4em' }}>
          {['trey', 'beryl'].map((person) => {
            const balance = funMoneyBalances[person];
            const low = balance < FUN_MONEY_LOW_THRESHOLD;
            return (
              <div
                key={person}
                className="card"
                style={{ flex: 1, padding: '0.6em', textAlign: 'center', ...(low ? { borderColor: 'var(--ev-coral-tx)' } : {}) }}
              >
                <div style={{ fontSize: '0.72em', color: 'var(--text-muted)' }}>{formatCategoryLabel(person)}</div>
                <div style={{ fontSize: '1.2em', fontWeight: 'var(--font-weight-heading)', color: low ? 'var(--ev-coral-tx)' : undefined }}>
                  {formatCurrency(balance)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="fp-main" style={{ overflow: 'hidden' }}>
        <div className="task-scroll">
          {budgetActionError && (
            <div style={{ color: 'var(--ev-coral-tx)', padding: '0.6em 0', fontSize: '0.85em' }}>
              Could not save that change: {budgetActionError}
            </div>
          )}

          {showCategories && (
            <>
              <div className="task-section-head">By category</div>
              {categoryRows.map(([category, amount]) => {
                const target = budgetTargets[category];
                const over = target > 0 && amount > target;
                return (
                  <div key={category} className="task-item">
                    <div>
                      <div className="task-text">{formatCategoryLabel(category)}</div>
                      {target > 0 && (
                        <div className="task-meta">
                          <span className={`task-due${over ? ' overdue' : ''}`}>
                            {over ? `Over by ${formatCurrency(amount - target)}` : `${formatCurrency(target - amount)} left`}
                          </span>
                        </div>
                      )}
                    </div>
                    <div style={{ marginLeft: 'auto', fontWeight: 'var(--font-weight-heading)' }}>
                      {formatCurrency(amount)}
                    </div>
                  </div>
                );
              })}
              {!categoryRows.length && (
                <div style={{ color: 'var(--text-muted)', padding: '1em' }}>No categorized spend yet this month.</div>
              )}
            </>
          )}

          <div className="task-section-head">
            {formatMonthLabel(selectedBudgetMonth)} transactions (tap merchant to rename, tap elsewhere to recategorize)
          </div>
          {monthTransactions.map((t) => {
            const isRenaming = renamingRow === t.row;
            const isPendingScope = pendingCategory?.row === t.row;
            const isEditingCategory = editingRow === t.row && !isPendingScope;
            // Only Target order/receipt splits ever have entries here — Amazon
            // itemization and statement import never get real per-item names
            // from Gemini, so those transactions just have no Details control.
            // A source email's items span every category it got split into,
            // so filter down to just this row's own category — otherwise the
            // Household row would show the Kids Other items too.
            const items = (orderItemsByEmailId[t.emailId] || []).filter((i) => i.category === t.category);
            const hasDetails = !!items.length;
            const showingDetails = detailsRow === t.row;

            const startRename = (e) => {
              e.stopPropagation();
              setRenamingRow(t.row);
              setRenameValue(t.merchant);
              setEditingRow(null);
              setPendingCategory(null);
            };
            const confirmRename = () => {
              const trimmed = renameValue.trim();
              if (trimmed && trimmed !== t.merchant) renameMerchant(t, trimmed);
              setRenamingRow(null);
            };

            return (
              <div
                key={t.row}
                className="task-item"
                onClick={() => { if (!isRenaming) setEditingRow(editingRow === t.row ? null : t.row); }}
                style={{ cursor: 'pointer' }}
              >
                <div>
                  {isRenaming ? (
                    <input
                      className="add-input"
                      style={{ fontSize: '1em', padding: '0.1em 0.3em', height: 'auto' }}
                      value={renameValue}
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && confirmRename()}
                      onBlur={confirmRename}
                    />
                  ) : (
                    <div className="task-text" onClick={startRename}>{t.merchant}</div>
                  )}
                  <div className="task-meta">
                    <span className="task-due">{t.date}{t.card ? ` · ${t.card}` : ''}</span>
                    {isPendingScope ? (
                      <span style={{ display: 'inline-flex', gap: '0.4em' }} onClick={(e) => e.stopPropagation()}>
                        <button
                          className="add-btn"
                          style={{ padding: '0.15em 0.5em', fontSize: '0.85em' }}
                          onClick={() => { recategorizeTransaction(t, pendingCategory.category, false); setPendingCategory(null); }}
                        >
                          Just this once
                        </button>
                        <button
                          className="add-btn"
                          style={{ padding: '0.15em 0.5em', fontSize: '0.85em' }}
                          onClick={() => { recategorizeTransaction(t, pendingCategory.category, true); setPendingCategory(null); }}
                        >
                          Always for {t.merchant}
                        </button>
                      </span>
                    ) : isEditingCategory ? (
                      <select
                        className="add-input"
                        style={{ fontSize: '1em', padding: '0.1em 0.3em', height: 'auto' }}
                        value={t.category}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => { setPendingCategory({ row: t.row, category: e.target.value }); setEditingRow(null); }}
                      >
                        {TRANSACTION_CATEGORIES.map((c) => (
                          // Most browsers render the open dropdown list as a native
                          // popup that ignores the page's dark theme but still
                          // inherits .add-input's light text color, producing
                          // invisible light-on-white text — force safe colors here.
                          <option key={c} value={c} style={{ color: '#1a1a1a', background: '#fff' }}>
                            {formatCategoryLabel(c)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="task-tag tag-family">{formatCategoryLabel(t.category)}</span>
                    )}
                    {hasDetails && (
                      <span
                        className="task-due"
                        style={{ cursor: 'pointer', textDecoration: 'underline' }}
                        onClick={(e) => { e.stopPropagation(); setDetailsRow(showingDetails ? null : t.row); }}
                      >
                        {showingDetails ? 'Hide details' : 'Details'}
                      </span>
                    )}
                  </div>
                  {hasDetails && showingDetails && (
                    <div style={{ fontSize: '0.78em', color: 'var(--text-muted)', marginTop: '0.4em' }} onClick={(e) => e.stopPropagation()}>
                      {items.map((i) => i.item).join(', ')}
                    </div>
                  )}
                </div>
                <div style={{ marginLeft: 'auto', fontWeight: 'var(--font-weight-heading)' }}>
                  {formatCurrency(t.amount)}
                </div>
              </div>
            );
          })}
          {!monthTransactions.length && (
            <div style={{ color: 'var(--text-muted)', padding: '1em' }}>
              {isCurrentMonth
                ? 'No transactions yet — they will show up here once the email agent processes a card alert.'
                : `No transactions for ${formatMonthLabel(selectedBudgetMonth)}.`}
            </div>
          )}

          {!!recentFunActivity.length && (
            <>
              <div className="task-section-head">Recent fun-money activity</div>
              {recentFunActivity.map((f, i) => (
                <div key={`${f.date}-${f.person}-${i}`} className="task-item">
                  <div>
                    <div className="task-text">{f.description}{f.type === 'return' ? ' (returned)' : ''}</div>
                    <div className="task-meta">
                      <span className="task-due">{f.date}</span>
                      <span className="task-tag tag-family">{formatCategoryLabel(f.person)}</span>
                    </div>
                  </div>
                  <div style={{ marginLeft: 'auto', fontWeight: 'var(--font-weight-heading)', color: f.type === 'return' ? 'var(--ev-teal-tx)' : undefined }}>
                    {formatCurrency(f.amount)}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Only worth showing once the Fixed Bills sheet has actually been populated —
// otherwise "fixed" is always $0 and just clutters the total with a useless split.
function fixedBillsAvailable(fixedTotal, discretionaryTotal) {
  return fixedTotal > 0 && discretionaryTotal !== null;
}
