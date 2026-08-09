# Family Hub email agent (Apps Script)

Two skills in one script, both parsing emails with Gemini and writing to
Google services. Not part of the Vite app — this is a separate Google Apps
Script project. `family-agent.gs` is kept here for version control only;
Apps Script doesn't deploy from GitHub, so it has to be pasted in manually.

- **Family requests** (`processFamilyAgentEmails`) — emails sent to
  simpsonfamilyhubapp@gmail.com become Tasks/Calendar/Grocery entries.
- **Budget tracking** (`processBudgetEmails`, T-11) — credit card
  transaction-alert emails (sent directly to Trey's own inbox by the bank,
  no forwarding needed) become rows in an auto-created "Family Hub Budget"
  Google Sheet.

## Why this runs under Trey's account, not simpsonfamilyhubapp@gmail.com

Google Tasks lists can't be shared across accounts (Calendar can, Tasks
can't). All 7 of the app's task lists and the calendar already live under
wdsimpson3@gmail.com, so the script has to run as that account to write to
them directly — no sharing or delegation needed. simpsonfamilyhubapp@gmail.com stays
the address family members actually send/dictate to; a Gmail forward + filter
(set up already, see project doc) deliver its mail into Trey's own inbox with
a "Family Agent" label, which is what this script actually polls.

## One-time setup

1. **Get a Gemini API key** (done) — aistudio.google.com/apikey, tied to the
   `family-hub-504703` GCP project.
2. Go to **script.google.com** while signed into wdsimpson3@gmail.com → New
   project. Name it something like "Family Hub Agent".
3. Delete the default `Code.gs` boilerplate and paste in the contents of
   `family-agent.gs`.
4. **Enable the Tasks advanced service**: in the left sidebar, click the
   "Services" **+** icon → find "Tasks API" → Add. (Calendar and Gmail don't
   need this — `CalendarApp` and `GmailApp` are built in.)
5. **Add the API key as a Script Property** (keeps it out of the source):
   Project Settings (gear icon) → Script Properties → Add script property →
   name `GEMINI_API_KEY`, value = your key from step 1.
6. **Set the project time zone**: same Project Settings page → General →
   Time zone → the "Mountain Time - Denver" entry (America/Denver). It'll
   show as -06 or -07 depending on the time of year (DST) — that's normal,
   the named zone handles the seasonal shift automatically.
7. **Grant permissions**: back in the editor, select `processFamilyAgentEmails`
   in the function dropdown and click Run once. Google will show a one-time
   permission screen (Gmail, Calendar, Tasks) — approve it. It'll likely
   error out immediately (no matching threads yet), that's fine.
8. **Add the trigger**: clock icon (Triggers) in the left sidebar → Add
   Trigger → function `processFamilyAgentEmails` → Time-driven → Minutes
   timer → Every 5 minutes → Save.

## Budget setup (T-11)

9. **Gmail filter for card alerts**: in wdsimpson3@gmail.com → ⚙️ Settings →
   Filters and Blocked Addresses → Create a new filter. In the "From" field,
   enter your card issuer's alert sender address (check an actual alert email
   for the exact address — e.g. something like alerts@chase.com). Create
   filter → check "Apply the label" → New label → `Budget Agent` → also check
   "Skip the Inbox (Archive it)". Repeat for each card issuer (Chase, Amex,
   etc.) that sends alerts, adding each sender to the same filter/label.
10. **Add a second trigger**: same Triggers page as step 8 → Add Trigger →
    function `processBudgetEmails` → Time-driven → Minutes timer → Every 5
    minutes → Save.
11. **Re-run for permissions**: select `processBudgetEmails` in the function
    dropdown and Run once — this is the first time the script touches Google
    Sheets, so a new permission screen will appear; approve it. This run also
    auto-creates the "Family Hub Budget" spreadsheet in your Google Drive the
    first time it finds a matching email (check Executions for the
    "Created budget spreadsheet" log line, which includes its URL).
12. **Create the Budget Targets / Fixed Bills tabs**: select `setupBudgetSheets`
    in the function dropdown and Run once. This creates two more tabs in the
    same "Family Hub Budget" spreadsheet:
    - **Budget Targets** — one row per category, "Monthly Target" defaults to
      0. Edit the numbers directly in the sheet; the Budget page's category
      breakdown (tap the total) shows over/under once a target is non-zero.
    - **Fixed Bills** — empty, one merchant name per row. Add your recurring
      bills (however the merchant name shows up in a transaction alert, e.g.
      "NETFLIX.COM") to split fixed vs. discretionary spend on the Budget
      page. Leave it empty to skip this — the split just won't show.
    - **Fun Money** — ledger-style: each row is either an "allowance" deposit
      or a "spend" (negative amount). Current balance per person is just the
      sum of their rows, so leftover money automatically carries into next
      month with no extra logic needed.
    - **Merchant Memory** — empty, Merchant/Category columns. Written by the
      Hub app when you recategorize a transaction and choose "Always" (see
      Phase D below); read by this script to keep future transactions from
      that merchant consistent instead of re-guessing every time.
    - **Merchant Names** — empty, Raw Merchant/Display Name columns. Written
      by the Hub app when you rename a merchant (see Phase D below); read by
      this script to replace cryptic raw merchant text (e.g. "SONDERMIND
      INC") with a readable name (e.g. "Beryl's Therapy") on every future
      transaction from that same raw text.
    - **Order Items** — empty, EmailId/Item/Category columns. Written by
      `processTargetOrderEmails`/`processTargetReceiptImports` whenever a
      Target order or receipt is genuinely itemized, so the real item names
      Gemini already extracted aren't thrown away — the Budget page's
      "Details" control on a transaction reads this to show what was
      actually bought. Never written by Amazon itemization or statement
      import, since neither gets real item names from Gemini.
13. **Add the monthly allowance trigger**: Triggers page → Add Trigger →
    function `addMonthlyFunMoneyAllowance` → Time-driven → Month timer → day
    **1** → whatever time window you prefer → Save. This deposits $250 into
    both Trey's and Beryl's Fun Money pools on the 1st of each month. To
    change the amount, edit `FUN_MONEY_MONTHLY_AMOUNT` in `family-agent.gs`.
    You can also run this function manually any time to add an allowance
    immediately (e.g. to seed the first month).

## Amazon order itemization setup

Amazon's order-status emails only give item counts per coarse category (e.g.
"2 Beverages, 3 Grocery"), not per-item prices — there's no automatable,
ToS-safe way to get real line-item pricing (Amazon has no public order
history API; scraping the order-details page risks the account getting
flagged). So instead of splitting a charge, `processAmazonOrderEmails`
tags the whole order with its **majority** item category and updates the
matching row already created by `processBudgetEmails` (matched by amount) —
it never creates new rows.

14. **Gmail filter for Trey's own Amazon orders**: same as the card-alert
    filter (step 9) — Settings → Filters → Create a new filter → "From" =
    Amazon's order-status sender address (check a real email for the exact
    address) → Apply the label → New label → `Amazon Orders` → Skip the
    Inbox.
15. **Beryl's Amazon orders need actual forwarding**, not just a filter,
    since her orders land in her own inbox, which this script (bound to
    Trey's account) cannot see at all. Do **not** route them through
    simpsonfamilyhubapp@gmail.com — that address auto-forwards everything to
    Trey's inbox where the broader "Family Agent" filter would also catch
    them and Gemini would try (and fail) to parse them as task/calendar
    requests. Instead, on Beryl's own Gmail:
    - Settings → Forwarding and POP/IMAP → Add a forwarding address →
      wdsimpson3@gmail.com → Trey checks his inbox for the confirmation
      code/link and approves it.
    - Settings → Filters → Create a new filter → "From" = the same Amazon
      order-status sender address → check "Forward it to" → select
      wdsimpson3@gmail.com. This forwards only her Amazon emails, not her
      whole inbox.
    - In Trey's inbox, the existing "Amazon Orders" filter from step 14
      (matching the same sender) picks these up automatically once forwarded.
16. **Add a third trigger**: Triggers page → Add Trigger → function
    `processAmazonOrderEmails` → Time-driven → Minutes timer → Every 5
    minutes → Save.

## Statement import / reconciliation setup (T-11 Phase E)

`processStatementImports` reads a credit card statement PDF directly —
Gemini has native PDF document understanding, so no OCR service or
separate text-extraction step is needed. It extracts every real purchase
and refund line item, skips anything already in the Transactions tab
(matched by date + amount, since a statement's merchant text often differs
slightly from the live alert's), and appends the rest as new rows. This is
both the one-time historical backfill (old statements from before the
agent existed) and the ongoing monthly reconciliation check (catches any
month where a card-alert email never arrived) — same operation either way.

17. **No filter needed** — this is a manual, infrequent (monthly) action,
    not a recurring sender to watch for. To import a statement: download the
    PDF from your card issuer's website, email it to yourself as an
    attachment (subject doesn't matter), and manually apply the label
    `Statement Import` to that email.
18. **Add a fourth trigger** (optional — you can also just run it manually
    right after uploading a statement, since it's infrequent): Triggers page
    → Add Trigger → function `processStatementImports` → Time-driven →
    Minutes timer → Every 5 minutes → Save.
19. **Re-run for permissions**: if this is the first time the script reads
    an email attachment, select `processStatementImports` in the function
    dropdown and Run once — approve any new permission prompt.

To import last month's statement right now: download the PDF, email it to
yourself with the `Statement Import` label applied, then either wait for
the trigger or run `processStatementImports` manually from the editor.

## Target order & receipt itemization setup (T-11 Phase E)

Two separate pipelines, both writing genuinely itemized category splits
(not a single majority-category guess like Amazon) since both a Target.com
order confirmation and an in-store purchase-detail screen show real
per-item prices:

- **`processTargetOrderEmails`** — Target.com online orders. Works like
  Amazon order itemization (matches an existing Transactions row by amount,
  never creates a new one), but since the email shows real per-item prices,
  it deletes that single row and replaces it with one row per category,
  each holding that category's real share of the total (tax/shipping
  prorated across categories by their subtotal share) — a genuine split,
  not a single tag.
- **`processTargetReceiptImports`** — in-store purchases scanned with the
  Target Circle wallet at checkout. Target does not email a receipt for
  these automatically (unlike online orders) — the itemized detail only
  shows up in the Target app's Purchase History (90-day window). So this is
  a manual step: screenshot that itemized purchase-detail screen (or photo
  a paper receipt) and email the image in. Gemini has native image
  understanding, the same capability `processStatementImports` already uses
  for PDFs, so no OCR step is needed. If a matching Transactions row already
  exists (the bank's card alert got there first), it gets replaced with the
  itemized split, same as the online-order path; if not, the split is
  appended as new rows directly, same as how statement import fills a gap.

**Getting a receipt screenshot labeled** (added 2026-08-09): email it to
**simpsonfamilyhubapp@gmail.com**, the same shared address everything else
in the app uses — not yourself. `processFamilyAgentEmails` now checks any
image attachment on a Family Agent email with a cheap Gemini classification
pass (`routeReceiptImage_`/`classifyReceiptImageWithGemini_`) before trying
to parse it as a task/event/grocery request: if it recognizes a Target
receipt, the thread gets moved straight to the `Target Receipt` label with
no manual labeling needed, and it works for Beryl too, not just whoever
owns this script (self-addressing a screenshot only ever worked for Trey).
A Costco receipt is recognized as well and parked under its own `Costco
Receipt` label, ready for whenever a `processCostcoReceiptImports` gets
built — nothing processes that label yet. Anything else (a genuinely
unclear receipt, or an image that is not a receipt at all) falls through to
`Family Agent/Needs Review` or the normal task/event parse as before.
Manually applying the `Target Receipt` label directly still works too, if
you'd rather not rely on the classification step.

20. **Gmail filter for Target.com order confirmations**: Settings → Filters
    → Create a new filter → "From" = Target's order-confirmation sender
    address (check a real email for the exact address) → Apply the label →
    New label → `Target Orders` → Skip the Inbox. If Beryl also orders from
    Target.com, set up the same sender-specific forwarding from her Gmail to
    Trey's as described for Amazon in step 15 (do not route through
    simpsonfamilyhubapp@gmail.com).
21. **Add a trigger**: Triggers page → Add Trigger → function
    `processTargetOrderEmails` → Time-driven → Minutes timer → Every 5
    minutes → Save.
22. **No filter or label needed for in-store receipts** — email the
    screenshot to simpsonfamilyhubapp@gmail.com like any other family
    request (see above); `processFamilyAgentEmails` handles the routing.
23. **Add a trigger**: Triggers page → Add Trigger → function
    `processTargetReceiptImports` → Time-driven → Minutes timer → Every 5
    minutes → Save.

## Manual recategorize / merchant memory / merchant rename (T-11 Phase D)

The Apps Script side needs nothing new here beyond step 12's Merchant
Memory and Merchant Names tabs — `lookupMerchantMemory_` and
`lookupMerchantName_` in `family-agent.gs` already read them (in both
`processBudgetEmails` and `processStatementImports`, applied in that order
so a rename never affects its own category memory entry, since category
lookup always happens on the original raw merchant text first). If you
already ran `setupBudgetSheets` once before the Merchant Names tab was
added, **run it again** — it's safe to re-run and will just add the
missing tab without touching the others.

The rest lives in the React app: tapping a transaction's category on the
Budget page and picking a new one writes directly to the sheet, then asks
whether to apply it "Just this once" (updates only that row) or "Always for
[merchant]" (also upserts a Merchant Memory rule). This scope choice exists
because some merchants — Target being the obvious one — legitimately span
multiple categories (groceries one trip, clothes another), so a blanket
rule from a single correction would often be wrong. Separately, tapping a
transaction's merchant name lets you rename it (e.g. "SONDERMIND INC" →
"Beryl's Therapy") — this always remembers, since a cryptic raw merchant
string is essentially always worth translating permanently; there's no
"just this once" option for renames.

All three writes (category, merchant memory, merchant rename) need a
**broader OAuth scope** than before (`.../auth/spreadsheets` instead of
`.../auth/spreadsheets.readonly`, since it's now writing, not just
reading).

24. **Add the new scope to the OAuth consent screen**: Google Cloud Console
    → the `family-hub-504703` project → Google Auth Platform → Data Access
    → Add or remove scopes → find **Google Sheets API** → check the
    `.../auth/spreadsheets` scope (not the `.readonly` one, which is likely
    already there from before) → Update → Save.
25. **Re-authorize the app**: in the Hub app, Settings → Sign out → Sign in
    with Google again, so the new session actually has the broader scope.
    (The code side — `SCOPES` in `src/lib/googleAuth.js` — is already
    updated; this step is purely about the Cloud Console declaration and
    getting a fresh token.)

## Testing

Send (or voice-dictate via Siri/Gemini) an email to simpsonfamilyhubapp@gmail.com, e.g.
"add a dentist appointment for Bryce Thursday at 8am". Within 5 minutes it
should appear on your Calendar. Check the Gmail labels under "Family Agent"
in your inbox:
- **Family Agent** — not yet processed (wait for the next trigger run, or
  run `processFamilyAgentEmails` manually from the Apps Script editor).
- **Family Agent/Done** — successfully applied.
- **Family Agent/Needs Review** — Gemini couldn't confidently parse it, or
  something errored (check Executions in the left sidebar for the log).

For the budget skill, once a real transaction alert lands and gets labeled
"Budget Agent," run `processBudgetEmails` manually (or wait for its trigger)
and check the "Transactions" tab of the auto-created "Family Hub Budget"
spreadsheet for a new row. Labels behave the same way: **Budget Agent** (not
yet processed), **Budget Agent/Done**, **Budget Agent/Needs Review**.

For fun money, send an email to simpsonfamilyhubapp@gmail.com like "Beryl
spent $120 on shoes" — it goes through the same `processFamilyAgentEmails`
pipeline as tasks/calendar/groceries (not the budget one), and should show
up as a new row in the "Fun Money" tab within 5 minutes, with Beryl's
balance on the Budget page dropping by $120. If something bought with fun
money gets returned, email something like "Beryl returned the shoes for
$120" (action `fun_return`) to credit it back — same pipeline, opposite sign.

For Amazon itemization: once an order email lands labeled "Amazon Orders",
run `processAmazonOrderEmails` manually (or wait for its trigger) and check
that the matching Transactions row's Category changed and its Notes now
includes "Order 113-...". If the Chase alert for that order has not landed
yet, the thread stays labeled "Amazon Orders" (not moved) and retries
automatically on the next run — this is expected, not a failure.

For Target order itemization: once an order confirmation lands labeled
"Target Orders", run `processTargetOrderEmails` manually (or wait for its
trigger) and check the Transactions tab — the single row the card alert
created should be gone, replaced by one row per category (e.g. groceries,
household), each with its own share of the total and "Order ...; Target
itemized" in Notes, and those new rows should sum to the same total as the
original single row. Same retry behavior as Amazon: if the card alert has
not landed yet, the thread stays labeled and retries on the next run.

For Target receipt import: email a screenshot of an itemized in-store
purchase to simpsonfamilyhubapp@gmail.com (no label needed), run
`processFamilyAgentEmails` manually (or wait for its trigger), and check
that the thread moved to the "Target Receipt" label — that confirms
`routeReceiptImage_` recognized it as a Target receipt. Then run
`processTargetReceiptImports` manually (or wait for its trigger) and check
the Transactions tab for new rows tagged "Target receipt import" in Notes,
one per category, summing to the purchase total. If a card-alert row for
that same date/amount already existed, it should be gone (replaced by the
split); if not, the split rows are simply new additions. To sanity-check
the classification step itself, try a non-receipt photo — it should fall
through to "Family Agent/Needs Review" (or the normal task/event parse, if
Gemini decides it is not a receipt) rather than getting stuck anywhere.

For item detail: after either of the two Target flows above completes
successfully, check the Order Items tab for new rows — one per item, keyed
by EmailId. On the Budget page, that transaction (or any of the split rows
from the same order) should show a "Details" link; tapping it should
expand to the item names grouped by category, no prices.

**Backfilling item detail for orders/receipts processed before Order Items
existed**: `processTargetOrderEmails`/`processTargetReceiptImports` only
ever look at threads still under the `Target Orders`/`Target Receipt`
label — anything already moved to `.../Done` won't be touched by a normal
re-run, and by that point its Transactions row is already split, so even
manually re-labeling it back would fail to match anything. Instead, run
`backfillTargetOrderItems` and/or `backfillTargetReceiptItems` manually
from the editor — these read the `.../Done` label directly, re-parse each
email with Gemini, and record item names only (never touching Transactions,
since that split already happened correctly the first time). Safe to run
more than once; `appendOrderItems_` skips any email that already has rows.

For statement import: after labeling a statement email "Statement Import"
and running `processStatementImports` (or waiting for its trigger), check
the Executions log for a line like "Statement import ... added N of M
transactions" — N is how many were genuinely new, M minus N is how many
were already captured live and correctly skipped. Then check the
Transactions tab for new rows with "Statement import" in the Notes column.

For recategorize/merchant memory: on the Budget page, tap a transaction in
"Recent transactions" and pick a different category from the dropdown that
appears, then choose "Always for [merchant]". Check the Transactions tab —
that row's Category should update immediately. Check the Merchant Memory
tab — a new row (or an updated existing one) should appear for that
merchant. Then trigger a *new* transaction from the same merchant (or
manually re-run `processBudgetEmails` against a fresh test alert) and
confirm it comes in already tagged with the corrected category, not
Gemini's original guess. Picking "Just this once" instead should update
only that one row and leave Merchant Memory untouched.

For merchant rename: tap a transaction's merchant name (not its category)
in "Recent transactions" — it should turn into a text box. Type a new name
and press Enter (or tap away). Check the Transactions tab — every existing
row sharing that same raw merchant text should update, not just the one
you tapped. Check the Merchant Names tab — a new row (or an updated
existing one) should appear, keyed on the *original* raw merchant text.
Then trigger a new transaction from the same raw merchant and confirm it
comes in already renamed.

## Changing the category list

`TRANSACTION_CATEGORIES` in `family-agent.gs` is Trey's real household
categories (set 2026-08-06: groceries, dining, gas-auto, travel, household,
entertainment, healthcare, kids-activities, kids-other, bills-utilities,
beryl-personal, trey-personal, shopping, trey-work, plus the structural
one-time/other). `EXCLUDED_FROM_BUDGET` lists which categories don't count
toward the regular monthly total (currently one-time and trey-work, since
one is a major expense and the other gets reimbursed).

The **Budget Targets** tab is only auto-populated with category rows the
first time it's created — changing the category list later does not update
an existing tab. To pick up a category change: delete the "Budget Targets"
tab from the spreadsheet (note down any target numbers you'd already
entered first), then re-run `setupBudgetSheets` to recreate it with the
current category list.

## Known limitations (v1)

- Multiple items in one email (e.g. a grocery list) are split into separate
  actions, but if Gemini only manages to parse some of them the thread is
  flagged "Needs Review" even though the successful ones were already applied
  — check the email before assuming nothing happened.
- No confirmation/reply is sent back to the requester either way; check the
  Gmail labels to see what happened.
- Calendar events are single-account, so there's no per-kid calendar — event
  titles get prefixed with the person's name instead (e.g. "Bryce: Dentist").
- Budget categories (including "one-time" for major expenses) are a
  best-effort Gemini guess from merchant name alone (no line-item detail),
  correctable via the Budget page's recategorize UI (T-11 Phase D), which
  also writes a merchant-memory rule so future transactions from that
  merchant come in already correct — but merchant memory needs an *exact*
  normalized match, so slightly different merchant text for the same real
  merchant (e.g. a different card statement format) will not match.
- Refunds/credits are stored as negative amounts in the same Amount column as
  purchases, so a plain SUM nets correctly — don't expect a positive number
  for a return.
- Amazon itemization tags the whole order with its majority item category —
  it does not split a mixed order's dollar amount across categories, since
  Amazon's emails only give item counts per category, not per-item prices.
  If a matching Transactions row is never found (e.g. the order was on a
  card without alerts enabled), the Amazon email just sits labeled "Amazon
  Orders" indefinitely rather than erroring — worth an occasional manual
  check if totals seem off.
- Statement import de-duplicates by date + amount, not a stronger identifier
  (statements don't expose one) — in the rare case two unrelated purchases
  on the same card land on the same day for the exact same amount, one
  would be silently skipped as a false "already captured" match. Low risk
  in practice, but worth knowing about if a total looks slightly short.
- Statement import currently only reads the first PDF attachment found on
  an email — if you attach multiple statement PDFs to one email, only one
  gets processed. Send them as separate emails for now.
- Don't rename "Amazon.com" (or however it appears in your statements) via
  the merchant rename feature — `applyAmazonOrder_` matches Amazon order
  emails to Transactions rows by looking for "amazon" in the merchant text,
  and a rename would break that match for all future orders. Same caution
  applies to renaming "Target".
- Target order/receipt itemization splits tax and shipping proportionally
  across categories by each category's pre-tax subtotal share, rather than
  its own category — a $100 order that is $90 groceries / $10 household
  will show tax split roughly 90/10 between those two rows, not as a
  separate line. This keeps the rows summing to the real charge without
  adding a 17th category just for tax.
- `processTargetOrderEmails` matches an order to its card-alert row within
  $5 (`TARGET_ORDER_MATCH_TOLERANCE`), not an exact amount — Target order
  confirmations sometimes quote a bag fee or other adjustment that does not
  end up on the actual charge (confirmed during testing: a confirmation
  showing $93.27 with a $1 bag fee that was never actually charged, real
  charge $92.27). The split is always computed against the real charged
  amount, not the email total, so this kind of gap is absorbed rather than
  blocking the match. If you ever have two separate real Target charges
  within $5 of each other in the same window, the closer one wins the
  match — low risk for a household budget, but worth knowing about.
- Target receipt import's duplicate protection is weaker than statement
  import's: once a receipt is processed, the original single-row match is
  replaced by several split rows, so if the exact same screenshot were
  accidentally emailed and labeled a second time, `findTransactionRow_`
  would no longer find a single row to match against and would append a
  second set of split rows instead of detecting the duplicate. In practice
  this only happens if you manually re-apply the "Target Receipt" label to
  an already-processed thread — normal use (label once, let it move to
  Target Receipt/Done) does not hit this.
