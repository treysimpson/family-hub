import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchTransactions, fetchBudgetTargets, fetchFixedBills, fetchCardCredits,
  fetchOrderItems, fetchFunMoney, updateTransactionCategory, upsertMerchantMemory,
} from './googleSheets';

// Mocks the global fetch this module calls directly (no fetch-mocking infra
// existed before this file) rather than hitting the real Sheets API.
function mockFetchOnce(values, ok = true, status = 200) {
  global.fetch = vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => (ok ? { values } : { error: { message: 'boom' } }),
  });
}

beforeEach(() => {
  global.fetch = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetchTransactions', () => {
  it('normalizes a plain date string as-is', async () => {
    mockFetchOnce([['2026-10-26', 'Chase', 'Costco', '42.50', 'groceries', '', 'e1', false]]);
    const txs = await fetchTransactions('token');
    expect(txs[0].date).toBe('2026-10-26');
  });

  it('normalizes a Sheets serial-number date (UNFORMATTED_VALUE) to the same yyyy-MM-dd string', async () => {
    // 2026-10-26 is serial day 46321 from the Sheets epoch (Dec 30 1899).
    mockFetchOnce([[46321, 'Chase', 'Costco', '42.50', 'groceries', '', 'e1', false]]);
    const txs = await fetchTransactions('token');
    expect(txs[0].date).toBe('2026-10-26');
  });

  it('filters out hidden transactions entirely, not just by a flag', async () => {
    mockFetchOnce([
      ['2026-10-26', '', 'Visible Store', '10', 'other', '', 'e1', false],
      ['2026-10-26', '', 'Hidden Store', '20', 'other', '', 'e2', true],
    ]);
    const txs = await fetchTransactions('token');
    expect(txs).toHaveLength(1);
    expect(txs[0].merchant).toBe('Visible Store');
  });

  it('drops rows missing a date or merchant (incomplete/blank rows)', async () => {
    mockFetchOnce([
      ['', '', '', '', '', '', '', false],
      ['2026-10-26', '', 'Real Store', '10', 'other', '', 'e1', false],
    ]);
    const txs = await fetchTransactions('token');
    expect(txs).toHaveLength(1);
  });

  it('computes "row" as the 1-indexed sheet row accounting for the header, before hidden-filtering', async () => {
    mockFetchOnce([
      ['2026-10-26', '', 'Hidden', '10', 'other', '', 'e1', true], // sheet row 2
      ['2026-10-26', '', 'Kept', '20', 'other', '', 'e2', false], // sheet row 3
    ]);
    const txs = await fetchTransactions('token');
    expect(txs[0].merchant).toBe('Kept');
    expect(txs[0].row).toBe(3); // not re-numbered to 2 after the hidden row was dropped
  });

  it('throws on an API failure rather than failing soft', async () => {
    mockFetchOnce(null, false, 403);
    await expect(fetchTransactions('token')).rejects.toThrow(/Sheets API request failed: 403/);
  });
});

describe('reference-tab fetchers fail soft to empty (unlike fetchTransactions)', () => {
  it('fetchBudgetTargets resolves to {} on an API failure', async () => {
    mockFetchOnce(null, false, 500);
    expect(await fetchBudgetTargets('token')).toEqual({});
  });

  it('fetchFixedBills resolves to [] on an API failure', async () => {
    mockFetchOnce(null, false, 500);
    expect(await fetchFixedBills('token')).toEqual([]);
  });

  it('fetchCardCredits resolves to [] on an API failure', async () => {
    mockFetchOnce(null, false, 500);
    expect(await fetchCardCredits('token')).toEqual([]);
  });

  it('fetchOrderItems resolves to [] on an API failure', async () => {
    mockFetchOnce(null, false, 500);
    expect(await fetchOrderItems('token')).toEqual([]);
  });

  it('fetchFunMoney resolves to [] on an API failure', async () => {
    mockFetchOnce(null, false, 500);
    expect(await fetchFunMoney('token')).toEqual([]);
  });
});

describe('fetchBudgetTargets', () => {
  it('lowercases the category key and coerces the amount to a number', async () => {
    mockFetchOnce([['Groceries', '600']]);
    const targets = await fetchBudgetTargets('token');
    expect(targets.groceries).toBe(600);
  });
});

describe('fetchFixedBills', () => {
  it('excludes a merchant explicitly marked "excluded"', async () => {
    mockFetchOnce([['Hulu', 'monthly'], ['Old Gym Membership', 'excluded']]);
    const bills = await fetchFixedBills('token');
    expect(bills).toEqual(['hulu']);
  });
});

describe('fetchCardCredits', () => {
  it('defaults an unlabeled credit name and takes the absolute value of amount', async () => {
    mockFetchOnce([['Hulu', '', '-25', '2026-08-21']]);
    const credits = await fetchCardCredits('token');
    expect(credits[0]).toEqual({ merchant: 'Hulu', creditName: 'Card credit', amount: 25, startsOn: '2026-08-21' });
  });
});

describe('updateTransactionCategory', () => {
  it('PUTs to the exact row/column E for the given row', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    await updateTransactionCategory('token', 42, 'dining');
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toContain(encodeURIComponent('Transactions!E42'));
    expect(opts.method).toBe('PUT');
    expect(JSON.parse(opts.body)).toEqual({ values: [['dining']] });
  });
});

describe('upsertMerchantMemory (shared upsertKeyValue_ logic)', () => {
  it('updates the existing row in place when the merchant (case/whitespace-insensitive) is already there', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ values: [['  Hulu  ', 'subscriptions']] }) }) // fetch existing
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) }); // the write
    await upsertMerchantMemory('token', 'hulu', 'entertainment');
    const [url, opts] = global.fetch.mock.calls[1];
    expect(url).toContain(encodeURIComponent('Merchant Memory!B2')); // row 0 -> sheet row 2
    expect(opts.method).toBe('PUT');
  });

  it('appends a new row when the merchant has no existing entry', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ values: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    await upsertMerchantMemory('token', 'Trader Joes', 'groceries');
    const [url, opts] = global.fetch.mock.calls[1];
    expect(url).toContain(':append');
    expect(JSON.parse(opts.body)).toEqual({ values: [['Trader Joes', 'groceries']] });
  });
});
