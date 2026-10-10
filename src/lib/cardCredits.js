// Card credits (e.g. the Amex Platinum Walmart+ / Digital Entertainment /
// Uber One credits) that reimburse a specific recurring charge. Live card
// alerts only ever report the charge, never the statement credit that
// cancels it, so without this every covered subscription would count at
// full price. Each Card Credits rule (see fetchCardCredits in
// googleSheets.js) names a charge's merchant text and the credit that
// covers it; applyCardCredits adds an "expected credit" row for every
// matching charge, so every total, chart and the fixed/discretionary split
// net out without any of them needing to know credits exist.
//
// Old statement/clean imports already include the real credit as its own
// negative row, so an expected credit is skipped when a real one is already
// there: a negative row whose merchant mentions "credit", for the same
// amount, within CREDIT_MATCH_DAYS of the charge. That keeps past months
// from being double-counted.

const CREDIT_MATCH_DAYS = 10;
const DAY_MS = 86400000;

function daysBetween(a, b) {
  return Math.abs(Date.parse(a) - Date.parse(b)) / DAY_MS;
}

// Raw alert text pads with runs of spaces ("UBER ONE      help.uber.com  CA"),
// so a rule typed with single spaces still matches.
function normalizeMerchant(text) {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

// rules: [{ merchant, creditName, amount, startsOn }]. amount is the most
// the credit covers per charge (Walmart+ covers all $14.08, the $25
// entertainment credit covers part of a $32.61 Hulu charge); 0/blank means
// the whole charge. startsOn ("YYYY-MM-DD", optional) skips older charges:
// credits change over the years (Uber One had none in 2024, entertainment
// was $20), and the imported statements already hold the real ones.
export function applyCardCredits(transactions, rules) {
  if (!rules.length) return transactions;
  const rulesByMerchant = new Map(rules.map((r) => [normalizeMerchant(r.merchant), r]));
  const realCredits = transactions.filter((t) => t.amount < 0 && /credit/i.test(t.merchant));
  const usedRealCredits = new Set();

  const expected = [];
  transactions.forEach((t) => {
    if (t.amount <= 0) return;
    const rule = rulesByMerchant.get(normalizeMerchant(t.merchant));
    if (!rule || (rule.startsOn && t.date < rule.startsOn)) return;
    const applied = Math.round(Math.min(t.amount, rule.amount > 0 ? rule.amount : t.amount) * 100) / 100;
    const real = realCredits.find((c) => !usedRealCredits.has(c.row)
      && Math.abs(-c.amount - applied) < 0.005
      && daysBetween(c.date, t.date) <= CREDIT_MATCH_DAYS);
    if (real) { usedRealCredits.add(real.row); return; }
    expected.push({
      row: `credit-${t.row}`,
      date: t.date,
      card: t.card,
      merchant: rule.creditName,
      amount: -applied,
      // Follows the charge's category so the category total nets to what
      // was actually paid.
      category: t.category,
      notes: 'Expected card credit',
      emailId: '',
      hidden: false,
      isExpectedCredit: true,
      creditForRow: t.row,
      creditForMerchant: t.merchant,
    });
  });
  return expected.length ? [...transactions, ...expected] : transactions;
}

// Merchant text a transaction is matched against Fixed Bills with. An
// expected credit counts as fixed exactly when the charge it offsets does,
// so a fixed subscription's credit lands in the same bucket and nets it out.
export function fixedBillKey(t) {
  return (t.creditForMerchant || t.merchant).toLowerCase().trim();
}
