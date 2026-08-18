/**
 * Family Hub email agent.
 *
 * This is NOT part of the Vite build — it's the source for a separate Google
 * Apps Script project, kept here for version control. See README.md in this
 * folder for how to deploy it. Bound to Trey's own Google account (not
 * simpsonfamilyhubapp@gmail.com) because Google Tasks lists can't be shared
 * across accounts — simpsonfamilyhubapp@gmail.com is just the intake address; Gmail forwarding
 * + a filter deliver its mail into Trey's inbox with the LABEL_INBOX label
 * below, which is what this script actually polls.
 */

const LABEL_INBOX = 'Family Agent';
const LABEL_DONE = 'Family Agent/Done';
const LABEL_REVIEW = 'Family Agent/Needs Review';

// Must match the list titles in src/lib/googleTasks.js (PERSON_LISTS / STORE_LISTS).
const TASK_LISTS = { trey: 'Trey', beryl: 'Beryl', kids: 'Kids', family: 'Family' };
const GROCERY_LISTS = { grocery: 'Grocery', costco: 'Costco', other: 'Other' };

const TIME_ZONE = 'America/Denver';
const GEMINI_MODEL = 'gemini-3.6-flash';

// ---- Budget (T-11) ----
// Separate intake from the family-request agent above: card-alert emails
// arrive directly in Trey's inbox from the bank itself (no forwarding through
// simpsonfamilyhubapp@gmail.com needed), so this polls its own label instead.
const BUDGET_LABEL_INBOX = 'Budget Agent';
const BUDGET_LABEL_DONE = 'Budget Agent/Done';
const BUDGET_LABEL_REVIEW = 'Budget Agent/Needs Review';
const BUDGET_SHEET_PROPERTY = 'BUDGET_SHEET_ID';
const TRANSACTIONS_TAB = 'Transactions';
const BUDGET_TARGETS_TAB = 'Budget Targets';
const FIXED_BILLS_TAB = 'Fixed Bills';
// "one-time" (major, non-recurring, e.g. an HVAC replacement) and "trey-work"
// (reimbursable — money that comes back) are both excluded from the regular
// monthly total/category totals so they don't distort them, and are shown
// as their own separate lines instead. "other" is a fallback for anything
// genuinely unclear. The rest are Trey's actual household categories.
const TRANSACTION_CATEGORIES = [
  'groceries', 'dining', 'gas-auto', 'travel', 'household', 'entertainment',
  'healthcare', 'kids-activities', 'kids-other', 'bills-utilities', 'subscriptions',
  'beryl-personal', 'trey-personal', 'shopping', 'trey-work', 'one-time', 'other',
];
const EXCLUDED_FROM_BUDGET = ['one-time', 'trey-work'];
const FUN_MONEY_TAB = 'Fun Money';
// Ledger-style: current balance per person is just the sum of all their rows
// ever (allowances and spends), so "leftover rolls to next month" needs no
// special logic — it falls out automatically as long as a new allowance row
// gets added each month.
const FUN_MONEY_MONTHLY_AMOUNT = { trey: 250, beryl: 250 };

// ---- Amazon order itemization (T-11 Phase B) ----
// Amazon's order-status emails only give item counts per coarse category
// (e.g. "2 Beverages, 3 Grocery"), not per-item prices, so this tags the
// whole order with its majority category rather than splitting the dollar
// amount — see project doc for why true line-item splitting was ruled out
// (no automatable, ToS-safe way to get it). One email can list several
// orders; each is matched to an existing Transactions row by amount and
// updated in place, never appended as a new row.
const AMAZON_LABEL_INBOX = 'Amazon Orders';
const AMAZON_LABEL_DONE = 'Amazon Orders/Done';
const AMAZON_LABEL_REVIEW = 'Amazon Orders/Needs Review';
// Excludes one-time/trey-work: an item-count digest (or a receipt itemized
// by department) gives no signal that a purchase is a major one-off or a
// reimbursable work expense. Shared by Amazon and Target itemization below.
const ITEMIZED_CATEGORIES = TRANSACTION_CATEGORIES.filter((c) => c !== 'one-time' && c !== 'trey-work');

// ---- Target order itemization (T-11 Phase E) ----
// Unlike Amazon, a Target.com order confirmation email lists real per-item
// prices, so a mixed order can be genuinely split across categories instead
// of tagged with just a majority guess -- the matching Transactions row
// (already created by processBudgetEmails from the card alert) gets deleted
// and replaced with one row per category, each holding that category real
// share of the total (see splitTransactionRow_), so a plain SUM still nets
// to the same charge amount.
const TARGET_LABEL_INBOX = 'Target Orders';
const TARGET_LABEL_DONE = 'Target Orders/Done';
const TARGET_LABEL_REVIEW = 'Target Orders/Needs Review';

// ---- Target in-store receipt import (T-11 Phase E) ----
// In-store purchases scanned with the Target Circle wallet are not emailed
// automatically -- there is no forwarding pipeline possible here. Instead,
// a screenshot of the itemized purchase-detail screen in the Target app
// (or a photo of a paper receipt) is emailed to simpsonfamilyhubapp@gmail.com
// like any other family request and parsed the same way processStatementImports
// parses a PDF: Gemini image/document understanding directly on the inline
// attachment, no OCR step needed. routeReceiptImage_ (called from
// processFamilyAgentEmails) is what actually gets it labeled here -- no
// manual labeling needed, and since it goes through the shared intake
// address, Beryl can send one too, not just whoever owns this script.
const TARGET_RECEIPT_LABEL_INBOX = 'Target Receipt';
const TARGET_RECEIPT_LABEL_DONE = 'Target Receipt/Done';
const TARGET_RECEIPT_LABEL_REVIEW = 'Target Receipt/Needs Review';

// ---- Costco in-store receipt (T-11 Phase E) ----
// Costco has no order-confirmation emails at all (unlike Target.com) and no
// per-item API/export, so like Target's in-store path this is entirely a
// manual screenshot/photo of the paper receipt, routed the same way via
// routeReceiptImage_/classifyReceiptImageWithGemini_. Mirrors
// processTargetReceiptImports exactly (see comment there) -- the only real
// difference is the parsing prompt, since Costco receipts show terse
// abbreviated item names and number codes rather than a department-labeled
// purchase-history screen, so mapping a line to a category leans more on
// Gemini's general knowledge of what a cryptic Costco item name usually is.
const COSTCO_RECEIPT_LABEL_INBOX = 'Costco Receipt';
const COSTCO_RECEIPT_LABEL_DONE = 'Costco Receipt/Done';
const COSTCO_RECEIPT_LABEL_REVIEW = 'Costco Receipt/Needs Review';

// ---- Statement import / reconciliation (T-11 Phase E) ----
// Manual, infrequent (monthly), so no forwarding complexity like Amazon
// orders: Trey (or Beryl) downloads the statement PDF from the card issuer's
// site and emails it as an attachment, applying this label. Doubles as both
// the one-time historical backfill and the ongoing monthly reconciliation
// check, since it is the same operation either way — extract every real
// transaction from the PDF, skip ones already captured live (matched by
// date + amount), and append the rest as new Transactions rows.
const STATEMENT_LABEL_INBOX = 'Statement Import';
const STATEMENT_LABEL_DONE = 'Statement Import/Done';
const STATEMENT_LABEL_REVIEW = 'Statement Import/Needs Review';

// ---- Merchant memory (T-11 Phase D) ----
// Written from the Hub app when Trey/Beryl manually recategorize a
// transaction (see src/context/AppContext.jsx recategorizeTransaction).
// Consulted here before trusting Gemini's category guess, so a correction
// becomes a standing rule for that merchant instead of re-guessing (and
// possibly re-guessing wrong) every time. Matched on exact normalized
// (lowercased, trimmed) merchant text — not fuzzy/substring — to avoid a
// false match pulling in an unrelated merchant.
const MERCHANT_MEMORY_TAB = 'Merchant Memory';

// ---- Merchant display names (T-11 Phase D) ----
// Separate from Merchant Memory (category): this renames cryptic raw
// merchant text (e.g. "SONDERMIND INC") to something readable (e.g.
// "Beryl's Therapy") for every future transaction from that source. Written
// from the Hub app (src/context/AppContext.jsx renameMerchant). Applied
// after category-memory lookup and always keyed on the ORIGINAL raw
// merchant text, so renaming a merchant never breaks its own category
// memory entry. Note: renaming "Amazon.com" specifically would break
// applyAmazonOrder_'s merchant match (it looks for "amazon" in the
// Transactions sheet) — avoid renaming that one.
const MERCHANT_NAMES_TAB = 'Merchant Names';

// ---- Order item detail (T-11 Phase E) ----
// Whenever a Target order or receipt is genuinely itemized (real per-item
// names, not just a category guess), Gemini already sees the actual item
// names -- this captures them instead of throwing them away once the
// category subtotal is computed, so the Hub app can show a "Details" view
// on that transaction. Keyed on EmailId (not order number), which works
// uniformly for both Target order confirmations and in-store receipt
// imports (receipts have no order number). Amazon itemization and
// statement import never write here, since neither pipeline gets real
// per-item names from Gemini (Amazon only gives item counts per category;
// statements only give merchant + amount). Read by the Hub app
// (src/lib/googleSheets.js fetchOrderItems) -- never read back by this
// script.
const ORDER_ITEMS_TAB = 'Order Items';

// Guards a trigger-invoked function against overlapping runs -- without
// this, two runs (a 5-minute trigger firing again while the previous run is
// still mid-flight, or a manual "Run" from the editor overlapping a trigger
// fire) can both read the same still-labeled thread before either moves it
// to Done, and both append a row/entry for it. Caught for real: an Amex
// alert got added to Transactions twice with the same EmailId (2026-08-17).
// One shared script-wide lock (not a per-function one) is intentional --
// these functions all read/write the same Budget spreadsheet and Gmail
// labels, so serializing all of them is simpler and safer than reasoning
// about which pairs can safely run concurrently, and none of them are slow
// enough for that serialization to matter. If the lock is already held,
// this pass is silently skipped -- nothing is lost, the next trigger fire
// picks up the same still-labeled threads.
function withLock_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    fn();
  } finally {
    lock.releaseLock();
  }
}

function processFamilyAgentEmails() { withLock_(processFamilyAgentEmails_); }
function processFamilyAgentEmails_() {
  const inboxLabel = getOrCreateLabel_(LABEL_INBOX);
  const threads = inboxLabel.getThreads();

  threads.forEach((thread) => {
    try {
      const messages = thread.getMessages();
      const message = messages[messages.length - 1];

      // A receipt screenshot comes through this same shared intake address
      // rather than a self-addressed email, so anyone in the family can
      // send one. Route it to the right store-specific label instead of
      // running it through the task/event/grocery parser below, which
      // would just fail on it. If several receipts are attached to one
      // email (a same-store batch -- see processCostcoReceiptImports),
      // only the first is classified to decide routing; the store-specific
      // importer then processes every attachment on the message, not just
      // this one. Mixed stores in one email are not supported -- only the
      // first attachment's store is detected, so the rest would be parsed
      // with that same store's prompt.
      const receiptAttachments = findReceiptAttachments_(message);
      if (receiptAttachments.length && routeReceiptImage_(thread, inboxLabel, receiptAttachments[0])) return;

      const text = `${message.getSubject()}\n\n${message.getPlainBody()}`.trim();
      const results = parseWithGemini_(text); // array — one entry per requested item

      const actionable = results.filter(isActionable_);
      if (!actionable.length) {
        moveThread_(thread, inboxLabel, getOrCreateLabel_(LABEL_REVIEW));
        return;
      }

      actionable.forEach(applyAction_);
      // If some items parsed but weren't actionable, still flag for review even
      // though the good ones were already applied — better than losing them.
      const toLabel = actionable.length < results.length ? LABEL_REVIEW : LABEL_DONE;
      moveThread_(thread, inboxLabel, getOrCreateLabel_(toLabel));
    } catch (err) {
      Logger.log('Failed to process thread "%s": %s', thread.getFirstMessageSubject(), err);
      moveThread_(thread, inboxLabel, getOrCreateLabel_(LABEL_REVIEW));
    }
  });
}

// Finds every attachment worth trying as a receipt -- each a photo/
// screenshot (image/*) or a PDF (e.g. Safari's "print to PDF" on an
// itemized purchase-history page, or a saved digital receipt). Gemini's
// inline_data understanding handles both mime types identically, so every
// receipt call site shares this one lookup instead of each hand-filtering
// attachments by content type. Returns an array (possibly empty) so a
// same-store batch of several receipts in one email -- e.g. multiple Costco
// trips -- gets every attachment, not just the first (see the multi-receipt
// loop in processCostcoReceiptImports/processTargetReceiptImports).
function findReceiptAttachments_(message) {
  return message.getAttachments().filter((a) => {
    const type = a.getContentType();
    return type.indexOf('image/') === 0 || type === 'application/pdf';
  });
}

// message.getId() alone is the EmailId key for a single-receipt email (the
// common case), so historical Order Items/Transactions rows written before
// multi-receipt support are unaffected. A batch of several receipts in one
// email instead gets one distinct key per attachment ("<messageId>#<index>")
// so their item-detail rows don't collide under Order Items' EmailId lookup
// (src/context/AppContext.jsx's orderItemsByEmailId groups by this exact
// key).
function receiptEmailId_(messageId, index, total) {
  return total > 1 ? messageId + '#' + index : messageId;
}

// Classifies an image/PDF attachment and, if it is a recognized store
// receipt, moves the thread straight to that store's own label so its
// dedicated pipeline (processTargetReceiptImports for Target) picks it up on
// its next run. Returns true if it handled (moved) the thread -- the caller
// should skip the normal task/event/grocery parse in that case. Returns
// false for "not a recognized receipt," so the caller falls through to the
// normal parse as usual (e.g. a photo attached to an ordinary to-do request).
function routeReceiptImage_(thread, inboxLabel, image) {
  const classification = classifyReceiptImageWithGemini_(image);
  if (!classification || !classification.isReceipt) return false;

  if (classification.store === 'target') {
    moveThread_(thread, inboxLabel, getOrCreateLabel_(TARGET_RECEIPT_LABEL_INBOX));
    return true;
  }
  if (classification.store === 'costco') {
    moveThread_(thread, inboxLabel, getOrCreateLabel_(COSTCO_RECEIPT_LABEL_INBOX));
    return true;
  }
  // A receipt from an unrecognized/unsupported store -- flag for review
  // rather than wasting a second Gemini call on the task/event parser,
  // which would just fail on an email that is really just a photo.
  moveThread_(thread, inboxLabel, getOrCreateLabel_(LABEL_REVIEW));
  return true;
}

function isActionable_(result) {
  if (!result || result.action === 'unknown' || !result.title) return false;
  if (result.action === 'add_task' && !TASK_LISTS[result.list]) return false;
  if (result.action === 'add_grocery' && !GROCERY_LISTS[result.store || 'grocery']) return false;
  if (result.action === 'add_event' && !result.date) return false;
  if (result.action === 'fun_spend' || result.action === 'fun_return') {
    if (!['trey', 'beryl'].includes(result.list)) return false;
    if (typeof result.amount !== 'number' || result.amount <= 0) return false;
  }
  return true;
}

function applyAction_(result) {
  if (result.action === 'add_task') {
    insertGoogleTask_(TASK_LISTS[result.list], result.title, result.date, result.notes);
  } else if (result.action === 'add_grocery') {
    insertGoogleTask_(GROCERY_LISTS[result.store || 'grocery'], result.title, null, result.notes);
  } else if (result.action === 'add_event') {
    insertCalendarEvent_(result);
  } else if (result.action === 'fun_spend') {
    appendFunMoneyEntry_(result.list, 'spend', -Math.abs(result.amount), result.title);
  } else if (result.action === 'fun_return') {
    appendFunMoneyEntry_(result.list, 'return', Math.abs(result.amount), result.title);
  } else if (result.action === 'hide_transaction') {
    hideTransaction_(result.merchant, result.amount);
  }
}

// Hides a Transactions row from the Budget page entirely (not just the
// itemized list -- excluded from every total, category breakdown, and chart
// too, per Trey's call: a hidden transaction should not show up anywhere on
// the shared wall display, including as an unexplained bump in a category
// total). A bare "hide my last transaction" with no further detail hides
// simply the last row in the sheet -- safe given the short gap between
// making a purchase and messaging about it (same tradeoff already accepted
// by fun_spend/fun_return having no per-transaction disambiguation either).
// If a merchant/amount hint WAS given, it must actually match something --
// sheet row order is append order, not real-world purchase order (a receipt
// import or another pipeline can append after a delayed card alert), so
// falling back to "the last row" when a hint fails to match risks silently
// hiding the wrong transaction entirely, which happened in testing (asking
// to hide a vending-machine charge hid an unrelated Costco return instead,
// because the vending charge's raw merchant text didn't contain the hint
// and the old fallback grabbed whatever row happened to be last). No match
// is now a real no-op, logged so it's visible in Executions.
function hideTransaction_(merchantHint, amountHint) {
  const spreadsheet = getOrCreateBudgetSpreadsheet_();
  const sheet = getOrCreateTransactionsSheet_(spreadsheet);
  const rowIndex = findTransactionToHide_(sheet, merchantHint, amountHint);
  if (rowIndex === -1) {
    Logger.log('hide_transaction: no matching row found for merchant=%s amount=%s', merchantHint, amountHint);
    return;
  }
  sheet.getRange(rowIndex, 8).setValue(true); // column H = Hidden
}

function findTransactionToHide_(sheet, merchantHint, amountHint) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return -1;

  if (!merchantHint && typeof amountHint !== 'number') {
    return data.length; // no hint at all -- just the last row
  }

  // Raw card-alert merchant text is often cryptic (e.g. "USAT * VENDING"),
  // so a hint like "vending machine" is matched word-by-word rather than as
  // one exact phrase -- any hint word appearing in the row's merchant text
  // counts as a match.
  const normalizedMerchant = (merchantHint || '').toLowerCase().trim();
  const hintWords = normalizedMerchant.split(/\s+/).filter((w) => w.length > 2);
  for (let i = data.length - 1; i >= 1; i--) {
    const rowMerchant = String(data[i][2] || '').toLowerCase();
    const rowAmount = Number(data[i][3]);
    const merchantMatches = hintWords.some((w) => rowMerchant.indexOf(w) !== -1);
    const amountMatches = typeof amountHint === 'number' && Math.abs(Math.abs(rowAmount) - amountHint) <= 0.01;
    if (merchantMatches || amountMatches) return i + 1;
  }
  return -1; // a hint was given but nothing matched -- don't guess
}

// amount is always signed correctly here (negative for spend, positive for
// return/allowance) so the running-sum balance in AppContext.jsx stays
// correct with no extra logic — same pattern as Transactions' signed Amount.
function appendFunMoneyEntry_(person, type, amount, description) {
  const spreadsheet = getOrCreateBudgetSpreadsheet_();
  const sheet = getOrCreateFunMoneySheet_(spreadsheet);
  const today = Utilities.formatDate(new Date(), TIME_ZONE, 'yyyy-MM-dd');
  sheet.appendRow([today, capitalize_(person), type, amount, description]);
}

// Run manually or via a monthly time-driven trigger (day-of-month timer,
// day 1) to deposit each person's allowance into their Fun Money pool.
function addMonthlyFunMoneyAllowance() { withLock_(addMonthlyFunMoneyAllowance_); }
function addMonthlyFunMoneyAllowance_() {
  Object.entries(FUN_MONEY_MONTHLY_AMOUNT).forEach(([person, amount]) => {
    appendFunMoneyEntry_(person, 'allowance', amount, 'Monthly allowance');
  });
}

function capitalize_(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function processBudgetEmails() { withLock_(processBudgetEmails_); }
function processBudgetEmails_() {
  const inboxLabel = getOrCreateLabel_(BUDGET_LABEL_INBOX);
  const threads = inboxLabel.getThreads();
  if (!threads.length) return;

  const spreadsheet = getOrCreateBudgetSpreadsheet_();
  const sheet = getOrCreateTransactionsSheet_(spreadsheet);

  threads.forEach((thread) => {
    try {
      const messages = thread.getMessages();
      const message = messages[messages.length - 1];
      const text = `${message.getSubject()}\n\n${message.getPlainBody()}`.trim();
      const transaction = parseTransactionWithGemini_(text);

      if (!transaction || !transaction.merchant || typeof transaction.amount !== 'number') {
        moveThread_(thread, inboxLabel, getOrCreateLabel_(BUDGET_LABEL_REVIEW));
        return;
      }

      // A past manual correction for this merchant overrides Gemini's guess.
      // Category lookup uses the raw merchant text; renaming is applied
      // after, so a rename never affects its own category memory entry.
      const remembered = lookupMerchantMemory_(spreadsheet, transaction.merchant);
      if (remembered) transaction.category = remembered;
      const friendlyName = lookupMerchantName_(spreadsheet, transaction.merchant);
      if (friendlyName) transaction.merchant = friendlyName;

      appendTransactionRow_(sheet, transaction, message.getId());
      moveThread_(thread, inboxLabel, getOrCreateLabel_(BUDGET_LABEL_DONE));
    } catch (err) {
      Logger.log('Failed to process budget thread "%s": %s', thread.getFirstMessageSubject(), err);
      moveThread_(thread, inboxLabel, getOrCreateLabel_(BUDGET_LABEL_REVIEW));
    }
  });
}

function processAmazonOrderEmails() { withLock_(processAmazonOrderEmails_); }
function processAmazonOrderEmails_() {
  const inboxLabel = getOrCreateLabel_(AMAZON_LABEL_INBOX);
  const threads = inboxLabel.getThreads();
  if (!threads.length) return;

  const spreadsheet = getOrCreateBudgetSpreadsheet_();
  const sheet = getOrCreateTransactionsSheet_(spreadsheet);

  threads.forEach((thread) => {
    try {
      const messages = thread.getMessages();
      const message = messages[messages.length - 1];
      const text = `${message.getSubject()}\n\n${message.getPlainBody()}`.trim();
      const orders = parseAmazonOrdersWithGemini_(text);

      if (!orders || !orders.length) {
        moveThread_(thread, inboxLabel, getOrCreateLabel_(AMAZON_LABEL_REVIEW));
        return;
      }

      // map (not every/some) so every order is attempted regardless of
      // whether an earlier one matched — applyAmazonOrder_ has side effects,
      // and every() would stop calling it as soon as one returned false.
      const results = orders.map((order) => applyAmazonOrder_(sheet, order));
      const allMatched = results.every(Boolean);
      if (allMatched) {
        moveThread_(thread, inboxLabel, getOrCreateLabel_(AMAZON_LABEL_DONE));
      }
      // If some orders had no matching Transactions row yet (e.g. the card
      // alert hasn't arrived), leave the thread labeled so the next 5-minute
      // run retries it — re-matching an already-applied order is a safe
      // no-op (applyAmazonOrder_ skips rows already tagged with that order
      // number), so this naturally retries only what's still unmatched.
    } catch (err) {
      Logger.log('Failed to process Amazon thread "%s": %s', thread.getFirstMessageSubject(), err);
      moveThread_(thread, inboxLabel, getOrCreateLabel_(AMAZON_LABEL_REVIEW));
    }
  });
}

// Finds a Transactions row for this order (by Amazon merchant + matching
// amount, not already tagged with this order number) and updates its
// Category/Notes in place — Amazon orders never get their own new row,
// since the card-alert email is what creates the row in the first place.
function applyAmazonOrder_(sheet, order) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const merchant = String(data[i][2] || '').toLowerCase();
    const amount = Number(data[i][3]);
    const notes = String(data[i][5] || '');
    if (merchant.indexOf('amazon') === -1) continue;
    if (Math.abs(amount - order.total) > 0.01) continue;
    if (notes.indexOf(order.orderNumber) !== -1) continue;
    sheet.getRange(i + 1, 5).setValue(order.category);
    sheet.getRange(i + 1, 6).setValue(notes ? notes + '; Order ' + order.orderNumber : 'Order ' + order.orderNumber);
    return true;
  }
  return false;
}

function processTargetOrderEmails() { withLock_(processTargetOrderEmails_); }
function processTargetOrderEmails_() {
  const inboxLabel = getOrCreateLabel_(TARGET_LABEL_INBOX);
  const threads = inboxLabel.getThreads();
  if (!threads.length) return;

  const spreadsheet = getOrCreateBudgetSpreadsheet_();
  const sheet = getOrCreateTransactionsSheet_(spreadsheet);

  threads.forEach((thread) => {
    try {
      const messages = thread.getMessages();
      const message = messages[messages.length - 1];
      const text = `${message.getSubject()}\n\n${message.getPlainBody()}`.trim();
      const orders = parseTargetOrderWithGemini_(text);

      if (!orders || !orders.length) {
        moveThread_(thread, inboxLabel, getOrCreateLabel_(TARGET_LABEL_REVIEW));
        return;
      }

      // map (not every/some), same reasoning as processAmazonOrderEmails --
      // every order in a multi-order email must be attempted regardless of
      // whether an earlier one matched.
      const results = orders.map((order) => applyTargetOrder_(sheet, order, message.getId()));
      // Only record item detail for orders that actually matched this run --
      // an unmatched order retries on the next run with a fresh Gemini parse,
      // so recording items here too would duplicate them once it does match.
      orders.forEach((order, i) => {
        if (results[i]) appendOrderItems_(spreadsheet, message.getId(), order.categories);
      });
      const allMatched = results.every(Boolean);
      if (allMatched) {
        moveThread_(thread, inboxLabel, getOrCreateLabel_(TARGET_LABEL_DONE));
      }
      // An unmatched order (card alert has not landed yet) leaves the thread
      // labeled so the next run retries it -- re-matching an already-split
      // order is a safe no-op since applyTargetOrder_ skips rows already
      // tagged with that order number.
    } catch (err) {
      Logger.log('Failed to process Target order thread "%s": %s', thread.getFirstMessageSubject(), err);
      moveThread_(thread, inboxLabel, getOrCreateLabel_(TARGET_LABEL_REVIEW));
    }
  });
}

// A Target order confirmation total sometimes does not exactly match the
// real card charge -- a quoted bag fee that ends up not being charged, a
// weight-based price adjustment on a grocery item, or a substituted/
// out-of-stock item are all common. $5 comfortably covers those without
// being so loose it risks grabbing an unrelated Target charge that happens
// to land nearby in amount.
const TARGET_ORDER_MATCH_TOLERANCE = 5;

// Finds a Transactions row for this order (Target merchant, not already
// tagged with this order number, amount within TARGET_ORDER_MATCH_TOLERANCE
// of the order total -- taking whichever candidate is closest, not just the
// first) and replaces it with one row per category holding that category
// real share of the total -- unlike applyAmazonOrder_, this is a genuine
// split, not a single in-place category update, since Target order emails
// give real per-item pricing. The split is computed against the row REAL
// charged amount, not the email order total, so a small discrepancy like a
// bag fee that was quoted but never charged is absorbed automatically
// rather than blocking the match or throwing off the reconciled total.
// emailId is the order confirmation email's own ID (not the original row's,
// which belongs to the bank's card-alert email) -- the new split rows use
// it so appendOrderItems_'s Details lookup (also keyed on that same ID) can
// actually find them.
function applyTargetOrder_(sheet, order, emailId) {
  const data = sheet.getDataRange().getValues();
  let bestIndex = -1;
  let bestDiff = Infinity;
  for (let i = 1; i < data.length; i++) {
    const merchant = String(data[i][2] || '').toLowerCase();
    const amount = Number(data[i][3]);
    const notes = String(data[i][5] || '');
    if (merchant.indexOf('target') === -1) continue;
    if (notes.indexOf(order.orderNumber) !== -1) continue;
    const diff = Math.abs(amount - order.total);
    if (diff > TARGET_ORDER_MATCH_TOLERANCE) continue;
    if (diff < bestDiff) { bestDiff = diff; bestIndex = i; }
  }
  if (bestIndex === -1) return false;
  const realTotal = Number(data[bestIndex][3]);
  splitTransactionRow_(sheet, bestIndex + 1, order.categories, realTotal, 'Order ' + order.orderNumber + '; Target itemized', emailId);
  return true;
}

function processTargetReceiptImports() { withLock_(processTargetReceiptImports_); }
function processTargetReceiptImports_() {
  const inboxLabel = getOrCreateLabel_(TARGET_RECEIPT_LABEL_INBOX);
  const threads = inboxLabel.getThreads();
  if (!threads.length) return;

  const spreadsheet = getOrCreateBudgetSpreadsheet_();
  const sheet = getOrCreateTransactionsSheet_(spreadsheet);

  threads.forEach((thread) => {
    try {
      const messages = thread.getMessages();
      const message = messages[messages.length - 1];
      const images = findReceiptAttachments_(message);

      if (!images.length) {
        moveThread_(thread, inboxLabel, getOrCreateLabel_(TARGET_RECEIPT_LABEL_REVIEW));
        return;
      }

      // A same-store batch (e.g. several Target receipts forwarded in one
      // email) processes every attachment, not just the first -- each gets
      // its own EmailId (receiptEmailId_) so their Order Items rows don't
      // collide. If any attachment fails to parse, the successful ones are
      // still kept (not rolled back) but the thread goes to Needs Review
      // instead of Done, same "don't lose the good ones, but don't hide the
      // failure either" reasoning as processFamilyAgentEmails.
      let anySucceeded = false;
      let anyFailed = false;

      images.forEach((image, i) => {
        const receipt = parseTargetReceiptWithGemini_(image);
        if (!receipt || !receipt.categories || !receipt.categories.length) {
          anyFailed = true;
          return;
        }
        const emailId = receiptEmailId_(message.getId(), i, images.length);

        // A negative total means the receipt/photo is a return or refund
        // slip (see buildTargetReceiptPrompt_), not a purchase -- tag it
        // distinctly so the Hub app can flag it as a return rather than a
        // normal spend (BudgetPage.jsx's ITEMIZED_NOTES_MARKERS matches on
        // "return").
        const notesTag = receipt.total < 0 ? 'Target return' : 'Target receipt import';

        const existingRow = findTransactionRow_(sheet, receipt.date, receipt.total);
        if (existingRow !== -1) {
          // A card-alert email already created a single coarse row for this
          // charge -- replace it with the real itemized split instead of
          // double-counting the same charge. In practice this branch almost
          // never fires for a return, since a return's negative total will
          // essentially never match an existing (positive) purchase row.
          splitTransactionRow_(sheet, existingRow, receipt.categories, receipt.total, notesTag, emailId);
        } else {
          // No matching card-alert row (e.g. it has not arrived yet, or the
          // purchase was not on a card with alerts enabled) -- add the split
          // as new rows directly, same as how statement import fills a gap.
          // This is also the normal path for a return: it becomes its own new
          // negative-amount row(s) rather than editing whatever earlier
          // purchase it refunds, since reliably matching a return back to one
          // specific original purchase/line-item is not something this can
          // do robustly (dates differ, a return may cover only some items).
          // The Transactions total/category sums still net out correctly on
          // their own, since they're a plain SUM over signed amounts.
          computeCategorySplit_(receipt.categories, receipt.total).forEach((c) => {
            appendTransactionRow_(
              sheet,
              { date: receipt.date, card: '', merchant: 'Target', amount: c.amount, category: c.category, notes: notesTag },
              emailId
            );
          });
        }
        appendOrderItems_(spreadsheet, emailId, receipt.categories);
        anySucceeded = true;
      });

      moveThread_(thread, inboxLabel, getOrCreateLabel_(anySucceeded && !anyFailed ? TARGET_RECEIPT_LABEL_DONE : TARGET_RECEIPT_LABEL_REVIEW));
    } catch (err) {
      Logger.log('Failed to process Target receipt thread "%s": %s', thread.getFirstMessageSubject(), err);
      moveThread_(thread, inboxLabel, getOrCreateLabel_(TARGET_RECEIPT_LABEL_REVIEW));
    }
  });
}

// Mirrors processTargetReceiptImports exactly -- see its comment and the
// "Costco in-store receipt" comment above for why this is entirely a manual
// screenshot/photo path with no order-email pipeline. Kept as a separate
// function (rather than parameterizing one shared function over "Target" vs
// "Costco") since a future divergence -- e.g. Costco starting to email
// digital receipts -- would only need one of the two touched.
function processCostcoReceiptImports() { withLock_(processCostcoReceiptImports_); }
function processCostcoReceiptImports_() {
  const inboxLabel = getOrCreateLabel_(COSTCO_RECEIPT_LABEL_INBOX);
  const threads = inboxLabel.getThreads();
  if (!threads.length) return;

  const spreadsheet = getOrCreateBudgetSpreadsheet_();
  const sheet = getOrCreateTransactionsSheet_(spreadsheet);

  threads.forEach((thread) => {
    try {
      const messages = thread.getMessages();
      const message = messages[messages.length - 1];
      const images = findReceiptAttachments_(message);

      if (!images.length) {
        moveThread_(thread, inboxLabel, getOrCreateLabel_(COSTCO_RECEIPT_LABEL_REVIEW));
        return;
      }

      // See the matching comment in processTargetReceiptImports for the
      // same-store-batch reasoning (multiple Costco receipts in one email)
      // and the anySucceeded/anyFailed Done-vs-Review logic below.
      let anySucceeded = false;
      let anyFailed = false;

      images.forEach((image, i) => {
        const receipt = parseCostcoReceiptWithGemini_(image);
        if (!receipt || !receipt.categories || !receipt.categories.length) {
          anyFailed = true;
          return;
        }
        const emailId = receiptEmailId_(message.getId(), i, images.length);

        // A negative total means this is a return/refund slip, not a
        // purchase -- see the matching comment in processTargetReceiptImports.
        const notesTag = receipt.total < 0 ? 'Costco return' : 'Costco receipt import';

        const existingRow = findTransactionRow_(sheet, receipt.date, receipt.total);
        if (existingRow !== -1) {
          splitTransactionRow_(sheet, existingRow, receipt.categories, receipt.total, notesTag, emailId);
        } else {
          computeCategorySplit_(receipt.categories, receipt.total).forEach((c) => {
            appendTransactionRow_(
              sheet,
              { date: receipt.date, card: '', merchant: 'Costco', amount: c.amount, category: c.category, notes: notesTag },
              emailId
            );
          });
        }
        appendOrderItems_(spreadsheet, emailId, receipt.categories);
        anySucceeded = true;
      });

      moveThread_(thread, inboxLabel, getOrCreateLabel_(anySucceeded && !anyFailed ? COSTCO_RECEIPT_LABEL_DONE : COSTCO_RECEIPT_LABEL_REVIEW));
    } catch (err) {
      Logger.log('Failed to process Costco receipt thread "%s": %s', thread.getFirstMessageSubject(), err);
      moveThread_(thread, inboxLabel, getOrCreateLabel_(COSTCO_RECEIPT_LABEL_REVIEW));
    }
  });
}

// Allocates a total across categories in proportion to each category
// pre-tax subtotal (so tax/shipping -- the gap between the subtotals and
// the real total -- gets spread proportionally rather than dropped or
// dumped on one category), rounded to the cent with any leftover from
// rounding assigned to the largest share so the rows always sum to exactly
// the real charge amount.
function computeCategorySplit_(categories, total) {
  const subtotalSum = categories.reduce((sum, c) => sum + (Number(c.subtotal) || 0), 0);
  if (subtotalSum <= 0) {
    return [{ category: categories[0] ? categories[0].category : 'shopping', amount: total }];
  }
  const allocated = categories.map((c) => ({
    category: c.category,
    amount: Math.round((c.subtotal / subtotalSum) * total * 100) / 100,
  }));
  const allocatedSum = allocated.reduce((sum, a) => sum + a.amount, 0);
  const remainder = Math.round((total - allocatedSum) * 100) / 100;
  if (remainder !== 0) {
    let largest = 0;
    for (let i = 1; i < allocated.length; i++) {
      if (allocated[i].amount > allocated[largest].amount) largest = i;
    }
    allocated[largest].amount = Math.round((allocated[largest].amount + remainder) * 100) / 100;
  }
  return allocated;
}

// Replaces a single Transactions row (e.g. a coarse card-alert entry) with
// one row per category, preserving the original row's Date/Card/Merchant
// but NOT its EmailId -- emailId is passed in explicitly as the order/
// receipt email's own ID (not the original row's, which belongs to the
// bank's card-alert email that first created it), so these new rows'
// EmailId lines up with the same key appendOrderItems_ used for their item
// detail. Used by both Target order itemization and Target receipt import.
function splitTransactionRow_(sheet, rowIndex, categories, total, notesTag, emailId) {
  const row = sheet.getRange(rowIndex, 1, 1, 7).getValues()[0];
  const date = normalizeSheetDate_(row[0]);
  const card = row[1];
  const merchant = row[2];
  sheet.deleteRow(rowIndex);
  computeCategorySplit_(categories, total).forEach((c) => {
    appendTransactionRow_(sheet, { date, card, merchant, amount: c.amount, category: c.category, notes: notesTag }, emailId);
  });
}

// Finds the 1-indexed sheet row for an existing transaction matching this
// date and amount exactly (same date+amount matching key as
// buildExistingTransactionKeys_, for the same reason -- merchant text is not
// reliably consistent between a card alert and other sources), or -1 if
// none is found.
function findTransactionRow_(sheet, date, amount) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const rowDate = normalizeSheetDate_(data[i][0]);
    const rowAmount = Number(data[i][3]);
    if (rowDate === date && Math.abs(rowAmount - amount) <= 0.01) return i + 1;
  }
  return -1;
}

function processStatementImports() { withLock_(processStatementImports_); }
function processStatementImports_() {
  const inboxLabel = getOrCreateLabel_(STATEMENT_LABEL_INBOX);
  const threads = inboxLabel.getThreads();
  if (!threads.length) return;

  const spreadsheet = getOrCreateBudgetSpreadsheet_();
  const sheet = getOrCreateTransactionsSheet_(spreadsheet);
  const existingKeys = buildExistingTransactionKeys_(sheet);

  threads.forEach((thread) => {
    try {
      const messages = thread.getMessages();
      const message = messages[messages.length - 1];
      const pdf = message.getAttachments().find((a) => a.getContentType() === 'application/pdf');

      if (!pdf) {
        moveThread_(thread, inboxLabel, getOrCreateLabel_(STATEMENT_LABEL_REVIEW));
        return;
      }

      const transactions = parseStatementWithGemini_(pdf);
      if (!transactions || !transactions.length) {
        moveThread_(thread, inboxLabel, getOrCreateLabel_(STATEMENT_LABEL_REVIEW));
        return;
      }

      let added = 0;
      transactions.forEach((t) => {
        const key = t.date + '|' + t.amount.toFixed(2);
        if (existingKeys.has(key)) return; // already captured live (or by a previous import) — skip
        const remembered = lookupMerchantMemory_(spreadsheet, t.merchant);
        const category = remembered || t.category;
        const friendlyName = lookupMerchantName_(spreadsheet, t.merchant);
        const merchant = friendlyName || t.merchant;
        appendTransactionRow_(sheet, { ...t, merchant, category, notes: 'Statement import' }, message.getId());
        existingKeys.add(key);
        added += 1;
      });

      Logger.log(
        'Statement import "%s": added %s of %s transactions (rest already existed)',
        thread.getFirstMessageSubject(), added, transactions.length
      );
      moveThread_(thread, inboxLabel, getOrCreateLabel_(STATEMENT_LABEL_DONE));
    } catch (err) {
      Logger.log('Failed to process statement thread "%s": %s', thread.getFirstMessageSubject(), err);
      moveThread_(thread, inboxLabel, getOrCreateLabel_(STATEMENT_LABEL_REVIEW));
    }
  });
}

// Date cells come back as native JS Date objects here (Apps Script's own
// getValues(), unlike the REST API's UNFORMATTED_VALUE used on the React
// side, which sees a raw serial number instead — see normalizeDate in
// src/lib/googleSheets.js for that side of the same underlying quirk).
function normalizeSheetDate_(value) {
  if (value instanceof Date) return Utilities.formatDate(value, TIME_ZONE, 'yyyy-MM-dd');
  return String(value || '');
}

// Builds a set of "date|amount" keys already in the sheet, so statement
// transactions already captured live (or by a previous import) get skipped
// instead of duplicated. Matching on date+amount rather than merchant name,
// since a statement's merchant text often differs from the live alert's
// (e.g. "AMAZON.COM AMZN.COM/BI WA" vs "Amazon.com").
function buildExistingTransactionKeys_(sheet) {
  const data = sheet.getDataRange().getValues();
  const keys = new Set();
  for (let i = 1; i < data.length; i++) {
    const date = normalizeSheetDate_(data[i][0]);
    const amount = Number(data[i][3]);
    if (date && !isNaN(amount)) keys.add(date + '|' + amount.toFixed(2));
  }
  return keys;
}

// ---- Gemini: statement parsing ----

const STATEMENT_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      date: { type: 'STRING', description: 'YYYY-MM-DD' },
      merchant: { type: 'STRING' },
      amount: { type: 'NUMBER', description: 'Positive for a purchase, negative for a refund or credit' },
      category: { type: 'STRING', enum: TRANSACTION_CATEGORIES },
    },
    required: ['date', 'merchant', 'amount', 'category'],
  },
};

// Sends the PDF directly to Gemini as inline document data (native PDF
// understanding, no separate OCR step) alongside the parsing instructions.
function parseStatementWithGemini_(pdfBlob) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY script property is not set');

  const base64 = Utilities.base64Encode(pdfBlob.getBytes());

  const response = UrlFetchApp.fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'post',
      contentType: 'application/json',
      muteHttpExceptions: true,
      payload: JSON.stringify({
        contents: [{
          parts: [
            { text: buildStatementPrompt_() },
            { inline_data: { mime_type: 'application/pdf', data: base64 } },
          ],
        }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: STATEMENT_SCHEMA,
        },
      }),
    }
  );

  const raw = response.getContentText();
  const body = JSON.parse(raw);
  if (body.error) throw new Error('Gemini API error: ' + body.error.message);
  const jsonText = body.candidates && body.candidates[0] && body.candidates[0].content.parts[0].text;
  if (!jsonText) throw new Error('Gemini returned no candidates: ' + raw);
  return JSON.parse(jsonText);
}

function buildStatementPrompt_() {
  return [
    'You are given a credit card statement as a PDF. Extract every individual purchase and refund/credit line item as a JSON array. Do not include the statement summary, minimum payment due, interest charged section, or any "payment received" / "payment thank you" lines -- those are the cardholder paying down the balance, not purchases, and must be excluded entirely.',
    '',
    'For each transaction:',
    '- "date" is the transaction date in YYYY-MM-DD format.',
    '- "merchant" is the merchant or payee name as shown.',
    '- "amount" is a plain number. Use a positive number for a purchase or charge, and a negative number for a refund or credit tied to a specific purchase.',
    '- "category" is your best guess from this fixed list: ' + TRANSACTION_CATEGORIES.join(', ') + '. Apply these in order, using the first one that fits:',
    '  1. "trey-work": a work-related expense for Trey that will be reimbursed by his employer.',
    '  2. "one-time": a large, unusual, non-recurring expense such as a home repair, appliance replacement, or major purchase that should not count as regular monthly spending.',
    '  3. "kids-activities": sports, camps, lessons, or other extracurricular activities for the kids (Bryce or Emery).',
    '  4. "kids-other": clothing, toys, school supplies, or other kid-specific purchases not tied to an activity.',
    '  5. "beryl-personal" / "trey-personal": a purchase clearly personal to just one parent (not a shared household expense).',
    '  6. "groceries": routine grocery/food-for-home shopping.',
    '  7. "dining": restaurants, takeout, coffee shops.',
    '  8. "gas-auto": gas station fuel, car repair/maintenance, auto parts, DMV.',
    '  9. "travel": flights, hotels, rental cars, vacation-related.',
    '  10. "bills-utilities": recurring bills required to keep the household running -- electric, water, gas, internet, phone, insurance, mortgage/rent.',
    '  11. "subscriptions": recurring but optional subscription/membership charges -- streaming (Netflix, Hulu, Disney+), music (Spotify), apps (Duolingo), cloud storage, software, gym or club memberships. The test is "would this get cancelled before an essential bill would."',
    '  12. "household": home maintenance, home goods, furniture, routine (not major) home purchases.',
    '  13. "entertainment": one-off fun purchases -- movie tickets, concerts, hobbies -- not recurring subscriptions, which go under "subscriptions" above.',
    '  14. "healthcare": medical, dental, pharmacy.',
    '  15. "shopping": general retail that does not clearly fit any category above.',
    '  16. "other": genuinely unclear.',
  ].join('\n');
}

// ---- Gemini: Amazon order parsing ----

const AMAZON_ORDER_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      orderNumber: { type: 'STRING' },
      total: { type: 'NUMBER' },
      category: { type: 'STRING', enum: ITEMIZED_CATEGORIES },
    },
    required: ['orderNumber', 'total', 'category'],
  },
};

function parseAmazonOrdersWithGemini_(text) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY script property is not set');

  const prompt = buildAmazonPrompt_(text);

  const response = UrlFetchApp.fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'post',
      contentType: 'application/json',
      muteHttpExceptions: true,
      payload: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: AMAZON_ORDER_SCHEMA,
        },
      }),
    }
  );

  const raw = response.getContentText();
  const body = JSON.parse(raw);
  if (body.error) throw new Error('Gemini API error: ' + body.error.message);
  const jsonText = body.candidates && body.candidates[0] && body.candidates[0].content.parts[0].text;
  if (!jsonText) throw new Error('Gemini returned no candidates: ' + raw);
  return JSON.parse(jsonText);
}

function buildAmazonPrompt_(text) {
  return [
    'You are a parser for Amazon order status emails. One email can list several separate orders, each shown with an order number, a breakdown of item categories with counts (e.g. "2 Beverages, 3 Grocery"), and a Grand Total. Extract one entry per order as JSON.',
    '',
    'For each order:',
    '- "orderNumber" is the Amazon order number exactly as shown (e.g. "113-1214274-4085069").',
    '- "total" is the Grand Total as a plain number.',
    '- "category" is your best guess at which category the order mostly belongs to, based on whichever item category has the most items in that order. Choose from this fixed list: ' + ITEMIZED_CATEGORIES.join(', ') + '. Map the categories shown in the email onto this list, for example: Grocery or Beverages maps to groceries, Health and Personal Care or Beauty maps to healthcare, Toys or Baby maps to kids-other, Electronics or Home or Kitchen maps to household, Clothing or Shoes maps to shopping. Use "shopping" if genuinely unclear.',
    '',
    'Email:',
    '"""',
    text,
    '"""',
  ].join('\n');
}

// ---- Gemini: Target order parsing ----

const TARGET_ORDER_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      orderNumber: { type: 'STRING' },
      total: { type: 'NUMBER', description: 'The actual amount charged, including tax and shipping' },
      categories: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            category: { type: 'STRING', enum: ITEMIZED_CATEGORIES },
            subtotal: { type: 'NUMBER', description: 'Pre-tax subtotal of the items placed in this category' },
            items: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Plain item names placed in this category, no prices' },
          },
          required: ['category', 'subtotal', 'items'],
        },
      },
    },
    required: ['orderNumber', 'total', 'categories'],
  },
};

function parseTargetOrderWithGemini_(text) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY script property is not set');

  const prompt = buildTargetOrderPrompt_(text);

  const response = UrlFetchApp.fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'post',
      contentType: 'application/json',
      muteHttpExceptions: true,
      payload: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: TARGET_ORDER_SCHEMA,
        },
      }),
    }
  );

  const raw = response.getContentText();
  const body = JSON.parse(raw);
  if (body.error) throw new Error('Gemini API error: ' + body.error.message);
  const jsonText = body.candidates && body.candidates[0] && body.candidates[0].content.parts[0].text;
  if (!jsonText) throw new Error('Gemini returned no candidates: ' + raw);
  return JSON.parse(jsonText);
}

function buildTargetOrderPrompt_(text) {
  return [
    'You are a parser for Target.com order confirmation emails. One email is usually a single order but may occasionally reference more than one order number -- extract one entry per distinct order number as a JSON array.',
    '',
    'For each order:',
    '- "orderNumber" is the Target order number exactly as shown.',
    '- "total" is the actual amount charged, including tax and any shipping, as a plain number.',
    '- "categories" breaks down the items in the order, before tax and shipping, into subtotals per category. Place every line item into exactly one of these categories: ' + ITEMIZED_CATEGORIES.join(', ') + '. Map common Target departments onto this list, for example: Grocery or Food and Beverage maps to groceries, Beauty or Health maps to healthcare, Toys or Baby or Kids Clothing maps to kids-other, Home or Electronics or Kitchen maps to household, Apparel or Shoes maps to shopping. The subtotal for a category is the sum of the pre-tax prices of the items placed in that category. Do not include tax or shipping in any category subtotal -- the gap between the sum of your subtotals and the order total will be treated separately as tax and shipping. "items" is a plain list of the item names placed in that category, exactly as shown in the order, with no prices included.',
    '',
    'Email:',
    '"""',
    text,
    '"""',
  ].join('\n');
}

// ---- Gemini: receipt image classification ----
// A cheap first pass on any image attachment routeReceiptImage_ finds on a
// Family Agent email -- separate from the detailed per-item extraction in
// parseTargetReceiptWithGemini_ below, since that prompt is Target-specific
// and would be the wrong tool for "is this even a receipt, and if so from
// where."

const RECEIPT_CLASSIFY_SCHEMA = {
  type: 'OBJECT',
  properties: {
    isReceipt: { type: 'BOOLEAN', description: 'True if the image is a purchase receipt, order confirmation, itemized purchase-history screenshot, or a return/refund receipt' },
    store: { type: 'STRING', enum: ['target', 'costco', 'other'], nullable: true, description: 'Which store the receipt is from, based on logos, headers, or formatting -- "other" if it is a receipt but not clearly one of the named stores' },
  },
  required: ['isReceipt'],
};

function classifyReceiptImageWithGemini_(imageBlob) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY script property is not set');

  const base64 = Utilities.base64Encode(imageBlob.getBytes());
  const mimeType = imageBlob.getContentType();
  const prompt = [
    'You are given an image or PDF attached to a family household email. Determine whether it is a purchase receipt, order confirmation, itemized purchase-history screenshot, or a return/refund receipt (money credited back for returned items), as opposed to some other kind of photo or document entirely (for example a family photo, a school flyer, or a screenshot unrelated to shopping). A return/refund receipt still counts as a receipt here -- it just represents money coming back rather than being spent.',
    '',
    'If it is a receipt of that kind, also identify which store it is from based on logos, headers, or formatting.',
  ].join('\n');

  const response = UrlFetchApp.fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'post',
      contentType: 'application/json',
      muteHttpExceptions: true,
      payload: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType, data: base64 } },
          ],
        }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: RECEIPT_CLASSIFY_SCHEMA,
        },
      }),
    }
  );

  const raw = response.getContentText();
  const body = JSON.parse(raw);
  if (body.error) throw new Error('Gemini API error: ' + body.error.message);
  const jsonText = body.candidates && body.candidates[0] && body.candidates[0].content.parts[0].text;
  if (!jsonText) throw new Error('Gemini returned no candidates: ' + raw);
  return JSON.parse(jsonText);
}

// ---- Gemini: Target receipt parsing ----

const TARGET_RECEIPT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    date: { type: 'STRING', description: 'YYYY-MM-DD' },
    total: { type: 'NUMBER', description: 'The actual amount charged, including tax -- NEGATIVE if this is a return/refund receipt rather than a purchase' },
    categories: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          category: { type: 'STRING', enum: ITEMIZED_CATEGORIES },
          subtotal: { type: 'NUMBER', description: 'Pre-tax subtotal of the items placed in this category, as a POSITIVE number even on a return -- only the top-level "total" carries the sign' },
          items: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Plain item names placed in this category, no prices' },
        },
        required: ['category', 'subtotal', 'items'],
      },
    },
  },
  required: ['date', 'total', 'categories'],
};

// Sends the screenshot/photo directly to Gemini as inline image data (same
// native document/image understanding used by parseStatementWithGemini_ for
// PDFs), so no separate OCR step is needed.
function parseTargetReceiptWithGemini_(imageBlob) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY script property is not set');

  const base64 = Utilities.base64Encode(imageBlob.getBytes());
  const mimeType = imageBlob.getContentType();

  const response = UrlFetchApp.fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'post',
      contentType: 'application/json',
      muteHttpExceptions: true,
      payload: JSON.stringify({
        contents: [{
          parts: [
            { text: buildTargetReceiptPrompt_() },
            { inline_data: { mime_type: mimeType, data: base64 } },
          ],
        }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: TARGET_RECEIPT_SCHEMA,
        },
      }),
    }
  );

  const raw = response.getContentText();
  const body = JSON.parse(raw);
  if (body.error) throw new Error('Gemini API error: ' + body.error.message);
  const jsonText = body.candidates && body.candidates[0] && body.candidates[0].content.parts[0].text;
  if (!jsonText) throw new Error('Gemini returned no candidates: ' + raw);
  return JSON.parse(jsonText);
}

function buildTargetReceiptPrompt_() {
  return [
    'You are given a screenshot of an itemized Target purchase or return from the Target app purchase history screen, or a photo of a paper Target receipt or return slip. Extract it as JSON.',
    '',
    'Rules:',
    '- "date" is the purchase or return date in YYYY-MM-DD format.',
    '- If this is a RETURN or REFUND (money credited back for returned items, e.g. headed "Return", "Refund", or showing a credit rather than a charge), make "total" the refunded amount as a NEGATIVE number. Otherwise (a normal purchase), "total" is the actual amount charged, including tax, as a positive number.',
    '- "categories" breaks down the items on the receipt, before tax, into subtotals per category. Place every line item into exactly one of these categories: ' + ITEMIZED_CATEGORIES.join(', ') + '. Map common Target departments onto this list, for example: Grocery or Food and Beverage maps to groceries, Beauty or Health maps to healthcare, Toys or Baby or Kids Clothing maps to kids-other, Home or Electronics or Kitchen maps to household, Apparel or Shoes maps to shopping. The subtotal for a category is the sum of the pre-tax prices of the items placed in that category, as a POSITIVE number even on a return -- only the top-level "total" carries the negative sign. Do not include tax in any category subtotal -- the gap between the sum of your subtotals and the total will be treated separately as tax. "items" is a plain list of the item names placed in that category, exactly as shown on the receipt, with no prices included.',
  ].join('\n');
}

// ---- Gemini: Costco receipt parsing ----
// Same schema/shape as the Target receipt parse above -- only the prompt
// differs, since Costco's paper receipt format needs different guidance.

const COSTCO_RECEIPT_SCHEMA = TARGET_RECEIPT_SCHEMA;

// Sends the photo directly to Gemini as inline image data, same as
// parseTargetReceiptWithGemini_.
function parseCostcoReceiptWithGemini_(imageBlob) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY script property is not set');

  const base64 = Utilities.base64Encode(imageBlob.getBytes());
  const mimeType = imageBlob.getContentType();

  const response = UrlFetchApp.fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'post',
      contentType: 'application/json',
      muteHttpExceptions: true,
      payload: JSON.stringify({
        contents: [{
          parts: [
            { text: buildCostcoReceiptPrompt_() },
            { inline_data: { mime_type: mimeType, data: base64 } },
          ],
        }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: COSTCO_RECEIPT_SCHEMA,
        },
      }),
    }
  );

  const raw = response.getContentText();
  const body = JSON.parse(raw);
  if (body.error) throw new Error('Gemini API error: ' + body.error.message);
  const jsonText = body.candidates && body.candidates[0] && body.candidates[0].content.parts[0].text;
  if (!jsonText) throw new Error('Gemini returned no candidates: ' + raw);
  return JSON.parse(jsonText);
}

function buildCostcoReceiptPrompt_() {
  return [
    'You are given a photo of a paper Costco warehouse receipt, which may be a purchase or a return/refund slip from the membership desk. Extract it as JSON.',
    '',
    'Costco receipts print terse abbreviated item names and a numeric item code, not a department header the way a Target receipt does (e.g. "ORG SPINACH", "KS BATH TISSU", "ROTISS CHKN") -- there is also no separate tax line for most grocery items (food is generally untaxed), but non-food items usually do have tax, and an "E" printed after a line\'s price marks it as exempt from tax, everything else is generally taxable. Use general knowledge of what a cryptic Costco item name usually refers to (e.g. "KS" prefix means Kirkland Signature, Costco\'s store brand, not a category by itself -- categorize by what the product actually is) to decide its category. A membership renewal charge, if present as its own line, is "bills-utilities". Gas station fuel purchases (separate from the warehouse receipt, if included) are "gas-auto".',
    '- "date" is the purchase or return date in YYYY-MM-DD format.',
    '- If this is a RETURN or REFUND (a membership-desk return slip, or any receipt showing money credited back rather than charged), make "total" the refunded amount as a NEGATIVE number. Otherwise (a normal warehouse purchase), "total" is the actual amount charged, including tax, as a positive number.',
    '- "categories" breaks down the items on the receipt, before tax, into subtotals per category. Place every line item into exactly one of these categories: ' + ITEMIZED_CATEGORIES.join(', ') + '. For example: fresh food, pantry items, and beverages map to groceries; vitamins, medicine, and personal care map to healthcare; diapers, kids clothing, and toys map to kids-other; electronics, home goods, and cleaning supplies map to household; adult clothing map to shopping. The subtotal for a category is the sum of the pre-tax prices of the items placed in that category, as a POSITIVE number even on a return -- only the top-level "total" carries the negative sign. Do not include tax in any category subtotal -- the gap between the sum of your subtotals and the total will be treated separately as tax. "items" is a plain list of the item names placed in that category, exactly as shown on the receipt (abbreviated is fine), with no prices included.',
  ].join('\n');
}

// ---- Google Sheets ----

function getOrCreateBudgetSpreadsheet_() {
  const props = PropertiesService.getScriptProperties();
  const existingId = props.getProperty(BUDGET_SHEET_PROPERTY);
  if (existingId) return SpreadsheetApp.openById(existingId);

  const spreadsheet = SpreadsheetApp.create('Family Hub Budget');
  props.setProperty(BUDGET_SHEET_PROPERTY, spreadsheet.getId());
  Logger.log('Created budget spreadsheet: ' + spreadsheet.getUrl());
  return spreadsheet;
}

function getOrCreateTransactionsSheet_(spreadsheet) {
  let sheet = spreadsheet.getSheetByName(TRANSACTIONS_TAB);
  if (!sheet) {
    // The first tab in a freshly-created spreadsheet is an untitled default
    // sheet — reuse it instead of leaving it sitting around empty.
    const isFresh = spreadsheet.getSheets().length === 1 && !spreadsheet.getSheetByName(TRANSACTIONS_TAB);
    sheet = isFresh ? spreadsheet.getSheets()[0] : spreadsheet.insertSheet();
    sheet.setName(TRANSACTIONS_TAB);
    sheet.appendRow(['Date', 'Card', 'Merchant', 'Amount', 'Category', 'Notes', 'EmailId', 'Hidden']);
    sheet.setFrozenRows(1);
  } else if (sheet.getLastColumn() < 8) {
    // Migration for a sheet created before the Hidden column (hide-surprise-
    // transactions, T-11) existed -- existing rows are left blank in column
    // H, which reads as "not hidden" everywhere that checks it.
    sheet.getRange(1, 8).setValue('Hidden');
  }
  return sheet;
}

// User-curated reference data (not written by the agent) — created empty so
// Trey can fill in real numbers/merchant names directly in the sheet.
function getOrCreateBudgetTargetsSheet_(spreadsheet) {
  let sheet = spreadsheet.getSheetByName(BUDGET_TARGETS_TAB);
  if (!sheet) {
    sheet = spreadsheet.insertSheet();
    sheet.setName(BUDGET_TARGETS_TAB);
    sheet.appendRow(['Category', 'Monthly Target']);
    sheet.setFrozenRows(1);
    TRANSACTION_CATEGORIES.filter((c) => !EXCLUDED_FROM_BUDGET.includes(c)).forEach((c) => sheet.appendRow([c, 0]));
  }
  return sheet;
}

function getOrCreateFixedBillsSheet_(spreadsheet) {
  let sheet = spreadsheet.getSheetByName(FIXED_BILLS_TAB);
  if (!sheet) {
    sheet = spreadsheet.insertSheet();
    sheet.setName(FIXED_BILLS_TAB);
    sheet.appendRow(['Merchant']);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// Written by fun_spend actions (from processFamilyAgentEmails) and by
// addMonthlyFunMoneyAllowance — not by processBudgetEmails.
function getOrCreateFunMoneySheet_(spreadsheet) {
  let sheet = spreadsheet.getSheetByName(FUN_MONEY_TAB);
  if (!sheet) {
    sheet = spreadsheet.insertSheet();
    sheet.setName(FUN_MONEY_TAB);
    sheet.appendRow(['Date', 'Person', 'Type', 'Amount', 'Description']);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// Written by the Hub app (src/context/AppContext.jsx recategorizeTransaction)
// when Trey/Beryl manually fix a category — never by this script directly.
function getOrCreateMerchantMemorySheet_(spreadsheet) {
  let sheet = spreadsheet.getSheetByName(MERCHANT_MEMORY_TAB);
  if (!sheet) {
    sheet = spreadsheet.insertSheet();
    sheet.setName(MERCHANT_MEMORY_TAB);
    sheet.appendRow(['Merchant', 'Category']);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// Exact normalized match only (see comment on MERCHANT_MEMORY_TAB above).
// Returns null if there is no memory for this merchant, so callers fall
// back to whatever Gemini guessed.
function lookupMerchantMemory_(spreadsheet, merchant) {
  const sheet = spreadsheet.getSheetByName(MERCHANT_MEMORY_TAB);
  if (!sheet) return null;
  const key = String(merchant || '').toLowerCase().trim();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0] || '').toLowerCase().trim() === key) return data[i][1];
  }
  return null;
}

// Written by the Hub app (src/context/AppContext.jsx renameMerchant).
function getOrCreateMerchantNamesSheet_(spreadsheet) {
  let sheet = spreadsheet.getSheetByName(MERCHANT_NAMES_TAB);
  if (!sheet) {
    sheet = spreadsheet.insertSheet();
    sheet.setName(MERCHANT_NAMES_TAB);
    sheet.appendRow(['Raw Merchant', 'Display Name']);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// Same exact-match approach as lookupMerchantMemory_, keyed on the raw
// merchant text as it appears in the alert/statement (not any already-
// renamed display text).
function lookupMerchantName_(spreadsheet, merchant) {
  const sheet = spreadsheet.getSheetByName(MERCHANT_NAMES_TAB);
  if (!sheet) return null;
  const key = String(merchant || '').toLowerCase().trim();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0] || '').toLowerCase().trim() === key) return data[i][1];
  }
  return null;
}

function getOrCreateOrderItemsSheet_(spreadsheet) {
  let sheet = spreadsheet.getSheetByName(ORDER_ITEMS_TAB);
  if (!sheet) {
    sheet = spreadsheet.insertSheet();
    sheet.setName(ORDER_ITEMS_TAB);
    sheet.appendRow(['EmailId', 'Item', 'Category']);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// One row per item across every category in the order/receipt, so a
// transaction's Details view (looked up by EmailId in the Hub app) shows
// the full item list regardless of which of the split Transactions rows it
// was opened from. Skips if this email already has rows here -- makes it
// safe to call more than once for the same email (e.g. a backfill re-run),
// without creating duplicate item rows.
function appendOrderItems_(spreadsheet, emailId, categories) {
  const sheet = getOrCreateOrderItemsSheet_(spreadsheet);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0] || '') === emailId) return;
  }
  categories.forEach((c) => {
    (c.items || []).forEach((item) => sheet.appendRow([emailId, item, c.category]));
  });
}

// One-time backfill for Target orders/receipts that were already processed
// (moved to .../Done) before the Order Items tab existed -- re-parses each
// with Gemini and records item names without touching the Transactions
// rows at all, which were already split correctly by the original run.
// Safe to run more than once (appendOrderItems_ skips emails it has already
// recorded). Run manually from the editor whenever needed, no trigger.
function backfillTargetOrderItems() { withLock_(backfillTargetOrderItems_); }
function backfillTargetOrderItems_() {
  const doneLabel = getOrCreateLabel_(TARGET_LABEL_DONE);
  const spreadsheet = getOrCreateBudgetSpreadsheet_();
  doneLabel.getThreads().forEach((thread) => {
    try {
      const messages = thread.getMessages();
      const message = messages[messages.length - 1];
      const text = `${message.getSubject()}\n\n${message.getPlainBody()}`.trim();
      const orders = parseTargetOrderWithGemini_(text) || [];
      orders.forEach((order) => appendOrderItems_(spreadsheet, message.getId(), order.categories));
    } catch (err) {
      Logger.log('Failed to backfill items for Target order thread "%s": %s', thread.getFirstMessageSubject(), err);
    }
  });
}

function backfillTargetReceiptItems() { withLock_(backfillTargetReceiptItems_); }
function backfillTargetReceiptItems_() {
  const doneLabel = getOrCreateLabel_(TARGET_RECEIPT_LABEL_DONE);
  const spreadsheet = getOrCreateBudgetSpreadsheet_();
  doneLabel.getThreads().forEach((thread) => {
    try {
      const messages = thread.getMessages();
      const message = messages[messages.length - 1];
      const images = findReceiptAttachments_(message);
      images.forEach((image, i) => {
        const receipt = parseTargetReceiptWithGemini_(image);
        if (receipt && receipt.categories) {
          appendOrderItems_(spreadsheet, receiptEmailId_(message.getId(), i, images.length), receipt.categories);
        }
      });
    } catch (err) {
      Logger.log('Failed to backfill items for Target receipt thread "%s": %s', thread.getFirstMessageSubject(), err);
    }
  });
}

// Mirrors backfillTargetReceiptItems -- see its comment.
function backfillCostcoReceiptItems() { withLock_(backfillCostcoReceiptItems_); }
function backfillCostcoReceiptItems_() {
  const doneLabel = getOrCreateLabel_(COSTCO_RECEIPT_LABEL_DONE);
  const spreadsheet = getOrCreateBudgetSpreadsheet_();
  doneLabel.getThreads().forEach((thread) => {
    try {
      const messages = thread.getMessages();
      const message = messages[messages.length - 1];
      const images = findReceiptAttachments_(message);
      images.forEach((image, i) => {
        const receipt = parseCostcoReceiptWithGemini_(image);
        if (receipt && receipt.categories) {
          appendOrderItems_(spreadsheet, receiptEmailId_(message.getId(), i, images.length), receipt.categories);
        }
      });
    } catch (err) {
      Logger.log('Failed to backfill items for Costco receipt thread "%s": %s', thread.getFirstMessageSubject(), err);
    }
  });
}

// Run manually once from the Apps Script editor (function dropdown ->
// setupBudgetSheets -> Run) to create the Budget Targets, Fixed Bills, Fun
// Money, Merchant Memory, Merchant Names, and Order Items tabs ahead of
// time, so they are ready without waiting for the next email.
function setupBudgetSheets() {
  const spreadsheet = getOrCreateBudgetSpreadsheet_();
  getOrCreateTransactionsSheet_(spreadsheet);
  getOrCreateBudgetTargetsSheet_(spreadsheet);
  getOrCreateFixedBillsSheet_(spreadsheet);
  getOrCreateFunMoneySheet_(spreadsheet);
  getOrCreateMerchantMemorySheet_(spreadsheet);
  getOrCreateMerchantNamesSheet_(spreadsheet);
  getOrCreateOrderItemsSheet_(spreadsheet);
  Logger.log('Budget sheets ready: ' + spreadsheet.getUrl());
}

// Amount is signed: positive for a purchase, negative for a refund/credit, so
// a plain SUM in the sheet gives the correct net total with no extra logic.
function appendTransactionRow_(sheet, t, emailId) {
  sheet.appendRow([t.date, t.card || '', t.merchant, t.amount, t.category || 'other', t.notes || '', emailId]);
}

// ---- Gemini: transaction parsing ----

const TRANSACTION_SCHEMA = {
  type: 'OBJECT',
  properties: {
    date: { type: 'STRING', description: 'YYYY-MM-DD' },
    card: { type: 'STRING', nullable: true, description: 'Issuer plus last 4, e.g. "Chase Prime Visa ...2365"' },
    merchant: { type: 'STRING' },
    amount: { type: 'NUMBER', description: 'Positive for a purchase, negative for a refund or credit' },
    category: { type: 'STRING', enum: TRANSACTION_CATEGORIES },
    notes: { type: 'STRING', nullable: true },
  },
  required: ['date', 'merchant', 'amount', 'category'],
};

function parseTransactionWithGemini_(text) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY script property is not set');

  const prompt = buildTransactionPrompt_(text);

  const response = UrlFetchApp.fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'post',
      contentType: 'application/json',
      muteHttpExceptions: true,
      payload: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: TRANSACTION_SCHEMA,
        },
      }),
    }
  );

  const raw = response.getContentText();
  const body = JSON.parse(raw);
  if (body.error) throw new Error('Gemini API error: ' + body.error.message);
  const jsonText = body.candidates && body.candidates[0] && body.candidates[0].content.parts[0].text;
  if (!jsonText) throw new Error('Gemini returned no candidates: ' + raw);
  return JSON.parse(jsonText);
}

function buildTransactionPrompt_(text) {
  return [
    'You are a parser for credit card transaction-alert emails. Extract the transaction as JSON.',
    '',
    'Rules:',
    '- "date" is the transaction date in YYYY-MM-DD format.',
    '- "card" identifies the account if shown, e.g. issuer plus last 4 digits (e.g. "Chase Prime Visa ...2365"). Omit if not shown.',
    '- "merchant" is the merchant or payee name as shown.',
    '- "amount" is a plain number. Use a positive number for a purchase or charge, and a negative number for a refund or credit.',
    '- "category" is your best guess from this fixed list: ' + TRANSACTION_CATEGORIES.join(', ') + '. Apply these in order, using the first one that fits:',
    '  1. "trey-work": a work-related expense for Trey that will be reimbursed by his employer.',
    '  2. "one-time": a large, unusual, non-recurring expense such as a home repair, appliance replacement, or major purchase that should not count as regular monthly spending.',
    '  3. "kids-activities": sports, camps, lessons, or other extracurricular activities for the kids (Bryce or Emery).',
    '  4. "kids-other": clothing, toys, school supplies, or other kid-specific purchases not tied to an activity.',
    '  5. "beryl-personal" / "trey-personal": a purchase clearly personal to just one parent (not a shared household expense).',
    '  6. "groceries": routine grocery/food-for-home shopping.',
    '  7. "dining": restaurants, takeout, coffee shops.',
    '  8. "gas-auto": gas station fuel, car repair/maintenance, auto parts, DMV.',
    '  9. "travel": flights, hotels, rental cars, vacation-related.',
    '  10. "bills-utilities": recurring bills required to keep the household running — electric, water, gas, internet, phone, insurance, mortgage/rent.',
    '  11. "subscriptions": recurring but optional subscription/membership charges — streaming (Netflix, Hulu, Disney+), music (Spotify), apps (Duolingo), cloud storage, software, gym or club memberships. The test is "would this get cancelled before an essential bill would."',
    '  12. "household": home maintenance, home goods, furniture, routine (not major) home purchases.',
    '  13. "entertainment": one-off fun purchases — movie tickets, concerts, hobbies — not recurring subscriptions, which go under "subscriptions" above.',
    '  14. "healthcare": medical, dental, pharmacy.',
    '  15. "shopping": general retail that does not clearly fit any category above.',
    '  16. "other": genuinely unclear.',
    '- "notes" can capture anything else potentially useful, or omit if nothing extra applies.',
    '',
    'Email:',
    '"""',
    text,
    '"""',
  ].join('\n');
}

// ---- Gemini: family requests ----

const RESPONSE_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      action: { type: 'STRING', enum: ['add_task', 'add_event', 'add_grocery', 'fun_spend', 'fun_return', 'hide_transaction', 'unknown'] },
      person: { type: 'STRING', nullable: true },
      list: { type: 'STRING', enum: ['trey', 'beryl', 'kids', 'family'], nullable: true },
      store: { type: 'STRING', enum: ['grocery', 'costco', 'other'], nullable: true },
      title: { type: 'STRING' },
      date: { type: 'STRING', nullable: true, description: 'YYYY-MM-DD' },
      time: { type: 'STRING', nullable: true, description: '24-hour HH:MM, omit for all-day' },
      amount: { type: 'NUMBER', nullable: true, description: 'Positive dollar amount, for fun_spend/fun_return, or an amount hint for hide_transaction' },
      merchant: { type: 'STRING', nullable: true, description: 'Merchant name hint, only used for hide_transaction, if one was mentioned' },
      notes: { type: 'STRING', nullable: true },
    },
    required: ['action', 'title'],
  },
};

function parseWithGemini_(text) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY script property is not set');

  const today = Utilities.formatDate(new Date(), TIME_ZONE, 'EEEE, yyyy-MM-dd');
  const prompt = buildPrompt_(text, today);

  const response = UrlFetchApp.fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'post',
      contentType: 'application/json',
      muteHttpExceptions: true,
      payload: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
    }
  );

  const raw = response.getContentText();
  const body = JSON.parse(raw);
  if (body.error) throw new Error('Gemini API error: ' + body.error.message);
  const jsonText = body.candidates && body.candidates[0] && body.candidates[0].content.parts[0].text;
  if (!jsonText) throw new Error('Gemini returned no candidates: ' + raw);
  return JSON.parse(jsonText);
}

function buildPrompt_(text, today) {
  return [
    'You are an intake parser for a family household planner. Turn the email below into a JSON array of structured actions, one entry per distinct request. Most emails are a single request (one-element array). A message naming multiple separate items, e.g. a grocery list like "add milk, eggs, and bread", must be split into one add_grocery entry per item, not combined into one. Today is ' + today + ' (America/Denver).',
    '',
    'Rules:',
    '- action "add_task": a to-do / reminder with no specific clock time. Set "list" to whichever of trey/beryl/kids/family it belongs to. Use "kids" for anything about Bryce or Emery individually or together, "family" for shared household items, "trey"/"beryl" only when clearly personal to that parent. "date" is an optional due date.',
    '- action "add_event": a calendar appointment with a specific day (and usually a time). Put the name of the person involved in "person" if mentioned (e.g. "Bryce") so it can be included in the event title. "date" is required.',
    '- action "add_grocery": an item to buy. "store" is grocery (default), costco, or other, based on context; default to "grocery" if unclear.',
    '- action "fun_spend": a message reporting that Trey or Beryl spent their personal fun-money on something, e.g. "Beryl spent $120 on shoes" or "I spent 40 bucks on a movie" (from Trey). Set "list" to trey or beryl, whichever person spent it, "amount" to the dollar figure, and "title" to a short description of the purchase.',
    '- action "fun_return": a message reporting that a fun-money purchase was returned or refunded, e.g. "Beryl returned the shoes for $120" or "I got a refund for the movie tickets, $40". Credits the amount back to that person instead of deducting it. Same fields as fun_spend.',
    '- action "hide_transaction": a request to hide a recent card charge from the shared Budget display, e.g. "hide my last transaction", "hide the Target charge", or "hide the $45 charge at Amazon" -- typically sent right after buying a gift or something else meant to be a surprise. Set "title" to a short description (not otherwise used). If a specific merchant and/or dollar amount was mentioned, set "merchant" and/or "amount" as a hint for finding the right one; if the message just says "last transaction" with no further detail, leave both null.',
    '- action "unknown": the email is not a clear request for any of the above.',
    '- Resolve relative dates such as Thursday or tomorrow against the current date given above.',
    '',
    'Email:',
    '"""',
    text,
    '"""',
  ].join('\n');
}

// ---- Google Tasks (requires the "Tasks API" advanced service enabled) ----

function insertGoogleTask_(listTitle, title, dueDate, notes) {
  const listId = findTaskListId_(listTitle);
  const resource = { title: title };
  if (dueDate) resource.due = dueDate + 'T00:00:00.000Z';
  if (notes) resource.notes = notes;
  Tasks.Tasks.insert(resource, listId);
}

function findTaskListId_(title) {
  const lists = Tasks.Tasklists.list().items || [];
  const match = lists.find((l) => l.title === title);
  if (!match) throw new Error('Task list "' + title + '" not found — sign into the Hub app once to auto-create it');
  return match.id;
}

// ---- Calendar ----

function insertCalendarEvent_(result) {
  const cal = CalendarApp.getDefaultCalendar();
  const title = result.person ? result.person + ': ' + result.title : result.title;
  const parts = result.date.split('-').map(Number);
  const year = parts[0], month = parts[1], day = parts[2];

  if (!result.time) {
    cal.createAllDayEvent(title, new Date(year, month - 1, day), { description: result.notes || '' });
    return;
  }

  const timeParts = result.time.split(':').map(Number);
  const start = new Date(year, month - 1, day, timeParts[0], timeParts[1]);
  const end = new Date(start.getTime() + 60 * 60 * 1000); // default 1-hour duration
  cal.createEvent(title, start, end, { description: result.notes || '' });
}

// ---- Labels ----

function getOrCreateLabel_(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

function moveThread_(thread, fromLabel, toLabel) {
  thread.removeLabel(fromLabel);
  thread.addLabel(toLabel);
  thread.markRead();
}
