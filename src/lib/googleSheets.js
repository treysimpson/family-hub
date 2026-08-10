// Google Sheets API v4, plain REST via fetch. Mostly read — the Apps Script
// agent (apps-script/family-agent.gs) does the vast majority of writing —
// except manual category corrections and merchant-memory entries (T-11
// Phase D), which the Hub app writes directly since they originate from a
// person tapping a transaction in the UI, not from an email.

const BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

export const BUDGET_SPREADSHEET_ID = '1e_W-BPgI9OIHKNJsxCnfqGvltpNAKuCFiUOFqhyU8Kk';

// Must match TRANSACTION_CATEGORIES in apps-script/family-agent.gs.
export const TRANSACTION_CATEGORIES = [
  'groceries', 'dining', 'gas-auto', 'travel', 'household', 'entertainment',
  'healthcare', 'kids-activities', 'kids-other', 'bills-utilities', 'subscriptions',
  'beryl-personal', 'trey-personal', 'shopping', 'trey-work', 'one-time', 'other',
];

// Column order must match appendTransactionRow_ in apps-script/family-agent.gs.
const TRANSACTIONS_RANGE = 'Transactions!A2:G';
const BUDGET_TARGETS_RANGE = 'Budget Targets!A2:B';
const FIXED_BILLS_RANGE = 'Fixed Bills!A2:A';
const FUN_MONEY_RANGE = 'Fun Money!A2:E';
const MERCHANT_MEMORY_RANGE = 'Merchant Memory!A2:B';
const MERCHANT_NAMES_RANGE = 'Merchant Names!A2:B';
const ORDER_ITEMS_RANGE = 'Order Items!A2:C';

// Sheets auto-detects date-shaped strings and stores them as its own date
// type even when written via appendRow, not just manual entry — so with
// valueRenderOption=UNFORMATTED_VALUE a "date" cell comes back as a raw
// serial number (days since Dec 30 1899 UTC) rather than the "YYYY-MM-DD"
// string that was written. Handle both so the app is not tied to Sheets'
// internal choice.
function normalizeDate(value) {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') {
    const ms = Date.UTC(1899, 11, 30) + Math.round(value) * 86400000;
    return new Date(ms).toISOString().slice(0, 10);
  }
  return '';
}

async function fetchRange_(accessToken, spreadsheetId, range) {
  const url = `${BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueRenderOption=UNFORMATTED_VALUE`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(`Sheets API request failed: ${res.status} ${body?.error?.message || ''}`.trim());
  }
  const data = await res.json();
  return data.values || [];
}

// PUTs a single row of values starting at the given range (e.g. "Sheet!B5").
async function writeRange_(accessToken, spreadsheetId, range, values) {
  const url = `${BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [values] }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(`Sheets API write failed: ${res.status} ${body?.error?.message || ''}`.trim());
  }
}

// Appends a row to the end of a sheet (range just needs to name the sheet).
async function appendRange_(accessToken, spreadsheetId, sheetName, values) {
  const url = `${BASE}/${spreadsheetId}/values/${encodeURIComponent(sheetName)}:append?valueInputOption=RAW`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [values] }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(`Sheets API append failed: ${res.status} ${body?.error?.message || ''}`.trim());
  }
}

// "row" is the 1-indexed sheet row (accounting for the header), so a
// recategorize action can target the exact cell without re-scanning the
// sheet for a match.
export async function fetchTransactions(accessToken, spreadsheetId = BUDGET_SPREADSHEET_ID) {
  const rows = await fetchRange_(accessToken, spreadsheetId, TRANSACTIONS_RANGE);
  return rows
    .map((row, i) => ({
      row: i + 2,
      date: normalizeDate(row[0]),
      card: row[1] || '',
      merchant: row[2] || '',
      amount: Number(row[3]) || 0,
      category: row[4] || 'other',
      notes: row[5] || '',
      emailId: row[6] || '',
    }))
    .filter((t) => t.date && t.merchant);
}

// Category lives in column E of Transactions.
export async function updateTransactionCategory(accessToken, row, category, spreadsheetId = BUDGET_SPREADSHEET_ID) {
  await writeRange_(accessToken, spreadsheetId, `Transactions!E${row}`, [category]);
}

// Merchant lives in column C of Transactions.
export async function updateTransactionMerchant(accessToken, row, merchant, spreadsheetId = BUDGET_SPREADSHEET_ID) {
  await writeRange_(accessToken, spreadsheetId, `Transactions!C${row}`, [merchant]);
}

// Shared by upsertMerchantMemory/upsertMerchantName: updates the existing
// row for this key (exact normalized match, same as the Apps Script's
// lookupMerchantMemory_/lookupMerchantName_) if one exists, else appends.
async function upsertKeyValue_(accessToken, spreadsheetId, sheetName, range, key, value) {
  const normalizedKey = key.toLowerCase().trim();
  const rows = await fetchRange_(accessToken, spreadsheetId, range);
  const existingIndex = rows.findIndex((row) => String(row[0] || '').toLowerCase().trim() === normalizedKey);
  if (existingIndex !== -1) {
    await writeRange_(accessToken, spreadsheetId, `${sheetName}!B${existingIndex + 2}`, [value]);
  } else {
    await appendRange_(accessToken, spreadsheetId, sheetName, [key, value]);
  }
}

export async function upsertMerchantMemory(accessToken, merchant, category, spreadsheetId = BUDGET_SPREADSHEET_ID) {
  await upsertKeyValue_(accessToken, spreadsheetId, 'Merchant Memory', MERCHANT_MEMORY_RANGE, merchant, category);
}

export async function upsertMerchantName(accessToken, merchant, displayName, spreadsheetId = BUDGET_SPREADSHEET_ID) {
  await upsertKeyValue_(accessToken, spreadsheetId, 'Merchant Names', MERCHANT_NAMES_RANGE, merchant, displayName);
}

// Budget Targets and Fixed Bills are user-curated reference tabs (see
// setupBudgetSheets in the Apps Script) — they may not exist yet if that
// hasn't been run, so these resolve to empty rather than throwing, since
// their absence shouldn't break the rest of the Budget page.

export async function fetchBudgetTargets(accessToken, spreadsheetId = BUDGET_SPREADSHEET_ID) {
  try {
    const rows = await fetchRange_(accessToken, spreadsheetId, BUDGET_TARGETS_RANGE);
    const targets = {};
    rows.forEach((row) => {
      if (row[0]) targets[String(row[0]).toLowerCase()] = Number(row[1]) || 0;
    });
    return targets;
  } catch {
    return {};
  }
}

export async function fetchFixedBills(accessToken, spreadsheetId = BUDGET_SPREADSHEET_ID) {
  try {
    const rows = await fetchRange_(accessToken, spreadsheetId, FIXED_BILLS_RANGE);
    return rows.map((row) => String(row[0] || '').toLowerCase().trim()).filter(Boolean);
  } catch {
    return [];
  }
}

// Item-level detail behind a Target order/receipt split (see the Order
// Items tab created by setupBudgetSheets in the Apps Script) — keyed by
// EmailId so a transaction's Details view can look up every item from the
// same source email regardless of which of the split category rows it was
// opened from. Fails soft to empty like the other reference tabs: the tab
// may not exist yet, and Amazon/statement-import transactions never have
// entries here at all, since neither pipeline gets real per-item names from
// Gemini (Amazon only sees item counts per category; statements only see
// merchant + amount).
export async function fetchOrderItems(accessToken, spreadsheetId = BUDGET_SPREADSHEET_ID) {
  try {
    const rows = await fetchRange_(accessToken, spreadsheetId, ORDER_ITEMS_RANGE);
    return rows
      .map((row) => ({ emailId: row[0] || '', item: row[1] || '', category: row[2] || '' }))
      .filter((r) => r.emailId && r.item);
  } catch {
    return [];
  }
}

// Ledger-style: each row is either an "allowance" deposit or a "spend"
// (Amount is signed — spends are negative), so a running balance per person
// is just the sum of their rows, no month-boundary logic needed. Resolves
// to empty if the tab doesn't exist yet, same reasoning as the two above.
export async function fetchFunMoney(accessToken, spreadsheetId = BUDGET_SPREADSHEET_ID) {
  try {
    const rows = await fetchRange_(accessToken, spreadsheetId, FUN_MONEY_RANGE);
    return rows
      .map((row) => ({
        date: normalizeDate(row[0]),
        person: String(row[1] || '').toLowerCase(),
        type: row[2] || '',
        amount: Number(row[3]) || 0,
        description: row[4] || '',
      }))
      .filter((f) => f.date && f.person);
  } catch {
    return [];
  }
}
