import { describe, it, expect } from 'vitest';
import { applyCardCredits, fixedBillKey } from './cardCredits';

function tx(overrides) {
  return { row: 1, date: '2026-08-21', card: '', merchant: 'HULU', amount: 32.61, category: 'subscriptions', notes: '', emailId: '', hidden: false, ...overrides };
}

describe('applyCardCredits', () => {
  it('adds an expected credit row for a matching charge', () => {
    const rule = { merchant: 'HULU', creditName: 'Amex Entertainment Credit', amount: 25, startsOn: '' };
    const result = applyCardCredits([tx({ row: 1 })], [rule]);
    expect(result).toHaveLength(2);
    const credit = result.find((t) => t.isExpectedCredit);
    expect(credit.amount).toBe(-25);
    expect(credit.creditForRow).toBe(1);
    expect(credit.category).toBe('subscriptions'); // follows the charge's category
  });

  it('caps the credit at the charge amount when the charge is smaller than the credit', () => {
    const rule = { merchant: 'HULU', creditName: 'Amex Entertainment Credit', amount: 25, startsOn: '' };
    const result = applyCardCredits([tx({ row: 1, amount: 10 })], [rule]);
    const credit = result.find((t) => t.isExpectedCredit);
    expect(credit.amount).toBe(-10);
  });

  it('covers the whole charge when the rule amount is 0/blank', () => {
    const rule = { merchant: 'WALMART.COM W+', creditName: 'Amex Walmart+ Credit', amount: 0, startsOn: '' };
    const result = applyCardCredits([tx({ row: 1, merchant: 'WALMART.COM W+', amount: 14.08 })], [rule]);
    const credit = result.find((t) => t.isExpectedCredit);
    expect(credit.amount).toBe(-14.08);
  });

  it('skips charges before the rule\'s startsOn date', () => {
    const rule = { merchant: 'HULU', creditName: 'Amex Entertainment Credit', amount: 25, startsOn: '2026-08-21' };
    const result = applyCardCredits([tx({ row: 1, date: '2026-08-01' })], [rule]);
    expect(result).toHaveLength(1); // no credit added
  });

  it('does not double-count when a real credit row already exists nearby (old statement imports)', () => {
    const rule = { merchant: 'HULU', creditName: 'Amex Entertainment Credit', amount: 25, startsOn: '' };
    const realCredit = tx({ row: 2, merchant: 'Amex Entertainment Credit', amount: -25, date: '2026-08-25' });
    const result = applyCardCredits([tx({ row: 1 }), realCredit], [rule]);
    expect(result).toHaveLength(2); // just the original two rows, no synthetic third
    expect(result.some((t) => t.isExpectedCredit)).toBe(false);
  });

  it('is a no-op with no rules', () => {
    const transactions = [tx({ row: 1 })];
    expect(applyCardCredits(transactions, [])).toBe(transactions);
  });

  it('matches merchant text regardless of case or extra whitespace', () => {
    const rule = { merchant: 'hulu', creditName: 'Credit', amount: 25, startsOn: '' };
    const result = applyCardCredits([tx({ row: 1, merchant: '  HULU   ' })], [rule]);
    expect(result.some((t) => t.isExpectedCredit)).toBe(true);
  });
});

describe('fixedBillKey', () => {
  it('uses the merchant for a regular transaction', () => {
    expect(fixedBillKey(tx({ merchant: 'Hulu' }))).toBe('hulu');
  });

  it('uses the original charge\'s merchant for an expected credit, so it buckets with the charge it offsets', () => {
    expect(fixedBillKey({ creditForMerchant: 'HULU', merchant: 'Amex Entertainment Credit' })).toBe('hulu');
  });
});
