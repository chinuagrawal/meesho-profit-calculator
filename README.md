# Meesho Profit Calculator

Local-first analysis of Meesho payment spreadsheets using React, TypeScript and Vite. Data stays in IndexedDB and local storage in the current browser.

## Development

Use Node.js 20 or later. Run `npm ci`, then `npm run dev`.

- `npm run check`: lint, regression tests and production build
- `npm test`: calculation, import and backup regression tests
- `npm run build`: build into `dist`
- `npm run preview`: preview the production build

## Import behavior

Review new, updated, unchanged and rejected order counts before importing. Rows require an order number, SKU, positive whole quantity and settlement. Download issue details for rejected row numbers. Reimported orders update by sub-order number; exact duplicate supplemental payments are deduplicated by content, ignoring generated IDs and import timestamps. Distinct payments with identical contents cannot be distinguished without a source transaction identifier. Overwrite replaces imported records.

## Profit definitions

- Basic cash profit: final settlement minus effective purchase cost, including GST. Fees already included in settlement are not deducted twice.
- Attributed order/SKU profit: basic cash profit minus allocated advertising. Allocation stays within the calendar month of the order and advertising deduction. A missing advertising date can use an unambiguous single-month deduction period; multi-month or unresolved periods are shown separately as undated spend and never treated as a calendar month. Undated spend remains in all-time business profit. Value weighting uses nonnegative settlement values; when every value is nonpositive it falls back to equal weighting. Cancelled and RTO orders are excluded from allocation.
- Business cash profit: basic cash profit minus actual advertising spend in the selected period, plus separate referral and net compensation payments. Advertising remains an expense even when allocation is disabled or there are no eligible orders.
- Monthly profit: basic cash profit minus actual advertising in that month; separate referral and compensation payments are excluded.
- Missing costs/settlements produce partial totals. The dashboard shows calculation coverage. Undated records are excluded from bounded date filters.

New installations default to equal advertising allocation. Existing saved preferences are preserved. Returns marked usable and RTO configured as recovered inventory have zero effective purchase cost and corresponding cost/GST components. Output GST remains an estimate unless explicitly present in the report.

## Pricing scenarios

Break-even accepts zero desired profit. Packaging, overhead and expected return loss can be added per unit. Expected return loss is return probability multiplied by loss per return. Avoid adding costs already covered by historical settlements. Estimates use the historical fee ratio; without sales history a 15% assumption is used. No estimate is shown for a ratio of 100% or more.

## Backups

Export JSON regularly: browser data does not sync across devices. Restore validates the format and revives dates before modifying storage. Imported record collections are written together in one IndexedDB transaction. Restore rolls back settings if record persistence fails. Version 1 backups and compatible older unversioned backups are supported.

## Meesho advertising amounts

The Meesho Ads Cost sheet has a title on row 1, actual column headers on row 2, and an explanatory formula row on row 3. Only numeric transaction rows are imported. Dates are never parsed as money; summary rows are excluded. In Meesho's combined Credits / Waivers / Discounts format, net cost, GST and Total Ads Cost are signed settlement deductions. Their signs are reversed once for expense reporting, retaining refunds as expense reductions. Raw source cells remain unchanged for audit and legacy normalization.

Older imports containing only the title column `Ads Cost` are malformed and excluded with an incomplete-data warning. Reimport every original report in merge mode to rebuild advertising expenses while preserving existing orders and SKU purchase costs. Reimported valid entries are deduplicated.
