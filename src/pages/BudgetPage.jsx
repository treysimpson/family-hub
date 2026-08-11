import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { TRANSACTION_CATEGORIES } from '../lib/googleSheets';
import PinGate from '../components/PinGate';
import CategoryTrendChart from '../components/CategoryTrendChart';
import BudgetCharts from '../components/BudgetCharts';
import HowToPanel from '../components/panels/HowToPanel';

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

function daysInMonth(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

const TREND_MONTH_COUNT = 6;

function lastNMonthKeys(n, endMonthKey) {
  const months = [];
  let cursor = endMonthKey;
  for (let i = 0; i < n; i++) {
    months.unshift(cursor);
    cursor = shiftMonthKey(cursor, -1);
  }
  return months;
}

// Merchants that have a real itemization pipeline (Target/Costco receipt
// import, Amazon order matching) — the only ones where "send in a receipt"
// is actually an available fix, so the only ones worth flagging.
const RECEIPT_ELIGIBLE_MERCHANTS = ['target', 'costco', 'amazon'];
// Every itemization pipeline's apps-script/family-agent.gs tags its Notes
// column with one of these substrings (appendTransactionRow_ call sites:
// applyAmazonOrder_ writes "Order <n>", applyTargetOrder_ writes "Order
// <n>; Target itemized", the receipt-import paths write "<Store> receipt
// import"), so a row without any of them is still just the plain card-alert
// guess — heuristic, not a real flag column, so a coincidental "order" in a
// Gemini-extracted note on an unrelated purchase would false-negative here.
const ITEMIZED_NOTES_MARKERS = ['order ', 'itemized', 'receipt import'];

function isItemizedTransaction(t) {
  const notes = (t.notes || '').toLowerCase();
  return ITEMIZED_NOTES_MARKERS.some((marker) => notes.includes(marker));
}

// Flat $25 warning line rather than a percentage — both pools are $250/mo
// today, so this is ~10%; revisit if the monthly amounts ever diverge a lot.
const FUN_MONEY_LOW_THRESHOLD = 25;

export default function BudgetPage() {
  const { isSignedIn } = useAuth();
  const {
    budgetLive, budgetTransactions, budgetMonthTotal, budgetError,
    selectedBudgetMonth, setSelectedBudgetMonth, selectedMonthTransactions,
    selectedBudgetYear, setSelectedBudgetYear, yearCategoryTotals, yearTotal,
    budgetOneTimeTotal, budgetReimbursableTotal, budgetCategoryTotals, budgetTargets,
    budgetFixedTotal, budgetDiscretionaryTotal, fixedBillMerchants, recategorizeTransaction, renameMerchant, budgetActionError,
    funMoneyEntries, funMoneyBalances, orderItemsByEmailId,
  } = useApp();
  const [unlocked, setUnlocked] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [showTreyWork, setShowTreyWork] = useState(false);
  const [showYearView, setShowYearView] = useState(false);
  const [showCharts, setShowCharts] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);
  // Which person's fun-money card is expanded to show every entry below —
  // null, 'trey', or 'beryl'. Only one at a time; tapping the open one again
  // closes it.
  const [showFunMoneyFor, setShowFunMoneyFor] = useState(null);
  // Multi-select: tapping a category in "By category" toggles it in/out of
  // this set (e.g. kids-other + kids-activities together) rather than
  // picking exactly one.
  const [selectedTrendCategories, setSelectedTrendCategories] = useState(() => new Set());
  const [editingRow, setEditingRow] = useState(null);
  // Set once a category is picked, before the always/once scope is chosen.
  const [pendingCategory, setPendingCategory] = useState(null); // { row, category }
  const [renamingRow, setRenamingRow] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [detailsRow, setDetailsRow] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  // Custom date range is an alternative to the month selector for the
  // transaction list only — the sidebar totals (total spent, category
  // breakdown, fixed/discretionary, etc.) always stay tied to the month
  // selector, since that's the "standard" view Trey wanted kept.
  const [showRangePicker, setShowRangePicker] = useState(false);
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');

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

  // A custom date range is an alternative source for the transaction LIST
  // only — sidebar totals always stay tied to the month selector. All of
  // the selected month's transactions, not just a fixed recent count — the
  // month nav is what makes this "open all the details for that month"
  // rather than a rolling most-recent-10 list.
  const isRangeActive = showRangePicker && rangeStart && rangeEnd;
  const sourceTransactions = isRangeActive
    ? budgetTransactions.filter((t) => t.date >= rangeStart && t.date <= rangeEnd)
    : selectedMonthTransactions;
  const searchLower = searchQuery.trim().toLowerCase();
  const searchedTransactions = searchLower
    ? sourceTransactions.filter((t) => t.merchant.toLowerCase().includes(searchLower) || t.notes.toLowerCase().includes(searchLower))
    : sourceTransactions;
  // Selecting a category below (to show its trend chart) also narrows this
  // list down to just that category's transactions — same multi-select set,
  // so picking kids-other + kids-activities together shows both.
  const filteredTransactions = selectedTrendCategories.size
    ? searchedTransactions.filter((t) => selectedTrendCategories.has(t.category))
    : searchedTransactions;
  const monthTransactions = [...filteredTransactions].sort((a, b) => (a.date < b.date ? 1 : -1));
  const rangeTotal = isRangeActive ? monthTransactions.reduce((sum, t) => sum + t.amount, 0) : null;

  const categoryRows = Object.entries(budgetCategoryTotals).sort((a, b) => b[1] - a[1]);
  const yearCategoryRows = Object.entries(yearCategoryTotals).sort((a, b) => b[1] - a[1]);

  const toggleTrendCategory = (category) => {
    setSelectedTrendCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category); else next.add(category);
      return next;
    });
  };

  // Trailing 6 months ending at the selected month, per selected category —
  // small multiples rather than one shared-axis line chart, since
  // overlapping lines get unreadable past 2-3 categories with up to 14
  // possible ones.
  const trendMonths = lastNMonthKeys(TREND_MONTH_COUNT, selectedBudgetMonth);
  const trendDataByCategory = {};
  selectedTrendCategories.forEach((category) => {
    trendDataByCategory[category] = trendMonths.map((m) => ({
      month: formatMonthLabel(m).slice(0, 3),
      amount: budgetTransactions
        .filter((t) => t.category === category && t.date.startsWith(m))
        .reduce((sum, t) => sum + t.amount, 0),
    }));
  });

  // Total-spend line for the overview charts — must match
  // EXCLUDED_BUDGET_CATEGORIES in AppContext.jsx / EXCLUDED_FROM_CHARTS in
  // BudgetCharts.jsx, same "regular monthly spending" definition used
  // everywhere else on this page.
  const trendMonthLabels = trendMonths.map((m) => formatMonthLabel(m).slice(0, 3));
  const trendTotals = trendMonths.map((m) => budgetTransactions
    .filter((t) => !['one-time', 'trey-work'].includes(t.category) && t.date.startsWith(m))
    .reduce((sum, t) => sum + t.amount, 0));

  // All-time, not scoped to the selected month — reimbursements often lag
  // behind the purchase month, so this is meant as a full outstanding list
  // to reconcile against, not a monthly view. Trey tracks actual
  // reimbursement status himself outside the app for now (T-25).
  const treyWorkTransactions = [...budgetTransactions]
    .filter((t) => t.category === 'trey-work')
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  // Target/Costco/Amazon transactions still sitting as a plain card-alert
  // guess — no itemized split, no majority-category match — because no
  // receipt/order email has come in for them yet. All-time, same reasoning
  // as treyWorkTransactions above: this is a reconcile-against list, not a
  // monthly view, and the point is to catch old gaps too, not just this
  // month's.
  const missingReceiptTransactions = [...budgetTransactions]
    .filter((t) => RECEIPT_ELIGIBLE_MERCHANTS.some((m) => t.merchant.toLowerCase().includes(m)) && !isItemizedTransaction(t))
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const recentFunActivity = funMoneyEntries
    .filter((f) => f.type === 'spend' || f.type === 'return')
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 10);

  // All-time, every entry type (allowance/spend/return) — unlike
  // recentFunActivity above, this is the full ledger for one person, not
  // just a recent spend/return feed, so the running balance on the card
  // above is fully traceable back to individual entries.
  const selectedPersonFunEntries = showFunMoneyFor
    ? funMoneyEntries
      .filter((f) => f.person === showFunMoneyFor)
      .sort((a, b) => (a.date < b.date ? 1 : -1))
    : [];

  const isCurrentMonth = selectedBudgetMonth === currentMonthKey();

  // Pacing only makes sense for the month actually in progress — a past
  // month is already fully elapsed, and a future one has no spend yet.
  // Also needs at least one non-zero category target to compare against
  // (Budget Targets tab, defaults to 0 for every category until Trey fills
  // real numbers in).
  const totalBudgetTarget = Object.values(budgetTargets).reduce((sum, v) => sum + (Number(v) || 0), 0);
  const showPacing = isCurrentMonth && totalBudgetTarget > 0;
  const dayOfMonth = new Date().getDate();
  const monthLength = daysInMonth(selectedBudgetMonth);
  const elapsedPct = showPacing ? Math.round((dayOfMonth / monthLength) * 100) : 0;
  const spentPct = showPacing ? Math.round((budgetMonthTotal / totalBudgetTarget) * 100) : 0;
  // More than 10 points ahead of the month's pace reads as "spending faster
  // than the month is passing" — an early warning before actually going
  // over the full monthly target.
  const paceColor = spentPct - elapsedPct > 10 ? 'var(--ev-coral-tx)' : 'var(--ev-teal-tx)';

  return (
    <div className="page full-page active" id="page-budget">
      <div className="fp-sidebar">
        <div className="fp-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5em' }}>
          <span>Budget</span>
          <button
            className="add-btn"
            style={{ padding: '0.05em 0.6em', fontSize: '0.6em', position: 'relative' }}
            onClick={() => setShowHowTo(true)}
          >
            How to
            {!!missingReceiptTransactions.length && (
              <div
                className="notif-badge"
                style={{ position: 'absolute', top: '-0.5em', right: '-0.5em', width: '1.3em', height: '1.3em', fontSize: '0.85em' }}
              >
                {missingReceiptTransactions.length}
              </div>
            )}
          </button>
        </div>
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
          {!showYearView && (
            <button
              className="add-btn"
              style={{ padding: '0.05em 0.5em', fontSize: '0.75em', marginLeft: 'auto' }}
              onClick={() => setShowCharts((v) => !v)}
            >
              {showCharts ? 'Hide charts' : 'Charts'}
            </button>
          )}
          <button
            className="add-btn"
            style={{ padding: '0.05em 0.5em', fontSize: '0.75em', marginLeft: showYearView ? 'auto' : undefined }}
            onClick={() => setShowYearView((v) => !v)}
          >
            {showYearView ? 'Month view' : 'Year view'}
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

        {showPacing && (
          <div className="card" style={{ marginTop: '0.6em', padding: '0.6em 0.8em' }}>
            <div style={{ fontSize: '0.72em', color: 'var(--text-muted)' }}>
              Pace — {elapsedPct}% of month gone, {spentPct}% of budget spent
            </div>
            <div style={{ position: 'relative', height: '0.6em', marginTop: '0.4em', borderRadius: '4px', overflow: 'hidden', background: 'var(--border-divider)' }}>
              <div style={{ position: 'absolute', inset: 0, width: `${Math.min(spentPct, 100)}%`, background: paceColor, borderRadius: '4px' }} />
              <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${Math.min(elapsedPct, 100)}%`, width: '2px', background: 'var(--text-primary)' }} />
            </div>
          </div>
        )}

        {budgetOneTimeTotal > 0 && (
          <div className="card" style={{ marginTop: '0.6em', padding: '0.6em 0.8em' }}>
            <div style={{ fontSize: '0.72em', color: 'var(--text-muted)' }}>Major expenses this month</div>
            <div style={{ fontSize: '1.1em', fontWeight: 'var(--font-weight-heading)' }}>
              {formatCurrency(budgetOneTimeTotal)}
            </div>
          </div>
        )}

        {budgetReimbursableTotal > 0 && (
          <div
            className="card tappable"
            style={{ marginTop: '0.6em', padding: '0.6em 0.8em', cursor: 'pointer' }}
            onClick={() => setShowTreyWork((v) => !v)}
          >
            <div style={{ fontSize: '0.72em', color: 'var(--text-muted)' }}>
              Trey&apos;s work (pending reimbursement) — tap to view all
            </div>
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
            const isOpen = showFunMoneyFor === person;
            return (
              <div
                key={person}
                className="card tappable"
                style={{
                  flex: 1, padding: '0.6em', textAlign: 'center', cursor: 'pointer',
                  ...(low ? { borderColor: 'var(--ev-coral-tx)' } : {}),
                  ...(isOpen ? { borderColor: 'var(--accent-primary)' } : {}),
                }}
                onClick={() => setShowFunMoneyFor((prev) => (prev === person ? null : person))}
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

          {showYearView && (
            <>
              <div className="fp-subtitle" style={{ display: 'flex', alignItems: 'center', gap: '0.5em' }}>
                <button
                  className="add-btn"
                  style={{ padding: '0.05em 0.5em', fontSize: '1em' }}
                  onClick={() => setSelectedBudgetYear((y) => y - 1)}
                  aria-label="Previous year"
                >
                  ‹
                </button>
                <span>{selectedBudgetYear} year-to-date</span>
                <button
                  className="add-btn"
                  style={{ padding: '0.05em 0.5em', fontSize: '1em', visibility: selectedBudgetYear >= new Date().getFullYear() ? 'hidden' : 'visible' }}
                  onClick={() => setSelectedBudgetYear((y) => y + 1)}
                  aria-label="Next year"
                >
                  ›
                </button>
              </div>
              <div className="task-section-head" style={{ marginTop: '0.6em' }}>
                Total: {formatCurrency(yearTotal)}
              </div>
              {yearCategoryRows.map(([category, amount]) => (
                <div key={category} className="task-item">
                  <div className="task-text">{formatCategoryLabel(category)}</div>
                  <div style={{ marginLeft: 'auto', fontWeight: 'var(--font-weight-heading)' }}>
                    {formatCurrency(amount)}
                  </div>
                </div>
              ))}
              {!yearCategoryRows.length && (
                <div style={{ color: 'var(--text-muted)', padding: '1em' }}>No categorized spend yet for {selectedBudgetYear}.</div>
              )}
            </>
          )}

          {!showYearView && (
          <>
          {showCharts && (
            <BudgetCharts
              monthLabel={formatMonthLabel(selectedBudgetMonth)}
              monthTransactions={selectedMonthTransactions}
              categoryTotals={budgetCategoryTotals}
              fixedBillMerchants={fixedBillMerchants}
              trendMonths={trendMonthLabels}
              trendTotals={trendTotals}
            />
          )}

          {showCategories && (
            <>
              <div className="task-section-head">By category (tap to show a trend below)</div>
              {categoryRows.map(([category, amount]) => {
                const target = budgetTargets[category];
                const over = target > 0 && amount > target;
                const isSelected = selectedTrendCategories.has(category);
                return (
                  <div
                    key={category}
                    className="task-item"
                    style={{ cursor: 'pointer', ...(isSelected ? { borderColor: 'var(--accent-primary)' } : {}) }}
                    onClick={() => toggleTrendCategory(category)}
                  >
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
              {!!selectedTrendCategories.size && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.8em', padding: '0.8em 0' }}>
                  {[...selectedTrendCategories].map((category) => (
                    <div key={category}>
                      <div style={{ fontSize: '0.78em', color: 'var(--text-muted)', marginBottom: '0.2em' }}>
                        {formatCategoryLabel(category)} — last {TREND_MONTH_COUNT} months
                      </div>
                      <CategoryTrendChart
                        category={category}
                        data={trendDataByCategory[category]}
                        target={budgetTargets[category] || 0}
                      />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {showTreyWork && (
            <>
              <div className="task-section-head">
                All Trey&apos;s work transactions ({treyWorkTransactions.length}) — not counted in totals above
              </div>
              {treyWorkTransactions.map((t) => (
                <div key={t.row} className="task-item">
                  <div>
                    <div className="task-text">{t.merchant}</div>
                    <div className="task-meta">
                      <span className="task-due">{t.date}{t.card ? ` · ${t.card}` : ''}</span>
                    </div>
                  </div>
                  <div style={{ marginLeft: 'auto', fontWeight: 'var(--font-weight-heading)' }}>
                    {formatCurrency(t.amount)}
                  </div>
                </div>
              ))}
              {!treyWorkTransactions.length && (
                <div style={{ color: 'var(--text-muted)', padding: '1em' }}>No trey-work transactions yet.</div>
              )}
            </>
          )}

          <div className="task-section-head" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5em', justifyContent: 'space-between' }}>
            <span>
              {isRangeActive
                ? `${rangeStart} – ${rangeEnd} transactions (${monthTransactions.length} · ${formatCurrency(rangeTotal)})`
                : `${formatMonthLabel(selectedBudgetMonth)} transactions`}
              {!!selectedTrendCategories.size && ` — ${[...selectedTrendCategories].map(formatCategoryLabel).join(', ')} only`}
              {' '}(tap merchant to rename, tap elsewhere to recategorize)
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4em' }}>
              <input
                className="add-input"
                style={{ fontSize: '0.85em', padding: '0.15em 0.5em', height: 'auto', width: '9em' }}
                placeholder="Search merchant…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button
                className="add-btn"
                style={{ padding: '0.15em 0.5em', fontSize: '0.85em' }}
                onClick={() => setShowRangePicker((v) => !v)}
              >
                {showRangePicker ? 'Use month' : 'Custom range'}
              </button>
            </span>
          </div>
          {showRangePicker && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5em', padding: '0.4em 0 0.8em', fontSize: '0.85em' }}>
              <input
                type="date"
                className="add-input"
                style={{ padding: '0.15em 0.5em', height: 'auto' }}
                value={rangeStart}
                onChange={(e) => setRangeStart(e.target.value)}
              />
              <span style={{ color: 'var(--text-muted)' }}>to</span>
              <input
                type="date"
                className="add-input"
                style={{ padding: '0.15em 0.5em', height: 'auto' }}
                value={rangeEnd}
                onChange={(e) => setRangeEnd(e.target.value)}
              />
            </div>
          )}
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
              {searchLower
                ? `No transactions match "${searchQuery.trim()}".`
                : selectedTrendCategories.size
                  ? `No ${[...selectedTrendCategories].map(formatCategoryLabel).join(', ')} transactions ${isRangeActive ? `between ${rangeStart} and ${rangeEnd}` : `in ${formatMonthLabel(selectedBudgetMonth)}`}.`
                  : isRangeActive
                    ? `No transactions between ${rangeStart} and ${rangeEnd}.`
                    : isCurrentMonth
                      ? 'No transactions yet — they will show up here once the email agent processes a card alert.'
                      : `No transactions for ${formatMonthLabel(selectedBudgetMonth)}.`}
            </div>
          )}

          {!!showFunMoneyFor && (
            <>
              <div className="task-section-head">
                {formatCategoryLabel(showFunMoneyFor)}&apos;s fun money — all activity ({selectedPersonFunEntries.length})
              </div>
              {selectedPersonFunEntries.map((f, i) => (
                <div key={`${f.date}-${i}`} className="task-item">
                  <div>
                    <div className="task-text">{f.description || formatCategoryLabel(f.type)}</div>
                    <div className="task-meta">
                      <span className="task-due">{f.date}</span>
                      <span className="task-tag tag-family">{formatCategoryLabel(f.type)}</span>
                    </div>
                  </div>
                  <div style={{ marginLeft: 'auto', fontWeight: 'var(--font-weight-heading)', color: f.amount < 0 ? 'var(--ev-coral-tx)' : 'var(--ev-teal-tx)' }}>
                    {formatCurrency(f.amount)}
                  </div>
                </div>
              ))}
              {!selectedPersonFunEntries.length && (
                <div style={{ color: 'var(--text-muted)', padding: '1em' }}>
                  No fun-money activity yet for {formatCategoryLabel(showFunMoneyFor)}.
                </div>
              )}
            </>
          )}

          {!showFunMoneyFor && !!recentFunActivity.length && (
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
          </>
          )}
        </div>
      </div>
      <HowToPanel
        open={showHowTo}
        onClose={() => setShowHowTo(false)}
        missingReceiptTransactions={missingReceiptTransactions}
      />
    </div>
  );
}

// Only worth showing once the Fixed Bills sheet has actually been populated —
// otherwise "fixed" is always $0 and just clutters the total with a useless split.
function fixedBillsAvailable(fixedTotal, discretionaryTotal) {
  return fixedTotal > 0 && discretionaryTotal !== null;
}
