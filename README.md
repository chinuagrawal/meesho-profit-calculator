# Meesho Profit Calculator

Local-first analysis of Meesho payment spreadsheets using React, TypeScript and Vite. Phone OTP authentication protects access. Calculator data is cached per account on the device and automatically saved to private Cloud Firestore snapshots.

## Development

Use Node.js 22. Run `npm ci`, then `npm run dev`.

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

Export JSON regularly. Signed-in account data syncs through Firestore; original legacy browser data must be explicitly restored into an account. Restore validates the format and revives dates before modifying storage. Imported record collections are written together in one IndexedDB transaction. Restore rolls back settings if record persistence fails. Version 1 backups and compatible older unversioned backups are supported.

## Meesho advertising amounts

The Meesho Ads Cost sheet has a title on row 1, actual column headers on row 2, and an explanatory formula row on row 3. Only numeric transaction rows are imported. Dates are never parsed as money; summary rows are excluded. In Meesho's combined Credits / Waivers / Discounts format, net cost, GST and Total Ads Cost are signed settlement deductions. Their signs are reversed once for expense reporting, retaining refunds as expense reductions. Raw source cells remain unchanged for audit and legacy normalization.

Older imports containing only the title column `Ads Cost` are malformed and excluded with an incomplete-data warning. Reimport every original report in merge mode to rebuild advertising expenses while preserving existing orders and SKU purchase costs. Reimported valid entries are deduplicated.

## Firebase backend setup

Phone OTP still uses Firebase Authentication's browser SDK. Calculator data travels through the same-origin Vercel `/api/cloud` endpoint. The Node.js backend verifies the Firebase ID token (including revocation), derives the user ID from that token, validates uploads, and uses the Firebase Admin SDK for Firestore. There is no direct browser Firestore access in the new code. Use Node.js 22 for deployment and CI.

### Vercel environment variable

In Vercel project Settings → Environment Variables, add `FIREBASE_SERVICE_ACCOUNT_KEY`. Its value is the complete contents of the downloaded Firebase service-account JSON, not a filename or path. Do not add extra quotes around the JSON. Select Production and Preview as appropriate, mark the variable Sensitive, save, and redeploy. Never prefix it with `VITE_`, commit the JSON, or send its contents in chat. The variable is read only by `server/firebaseAdmin.ts` at runtime. Alternatively, set the three server-only variables `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY`; use one credential format, not both. The configured project must match `meesho-profit-calculator-99652` unless both the server and public client configuration are intentionally changed.

The credential needs Firestore data access and permission to inspect Firebase Authentication users for revocation checks. Do not grant project Owner merely to make the app work. See [Admin SDK setup](https://firebase.google.com/docs/admin/setup).

### Safe deployment order

1. Set the server environment variable, push this code, and deploy to Vercel. The public web config is already included. Existing snapshots and account-specific device caches retain the same format.
2. Test phone sign-in and a cloud save/reload on the deployed app. This validates the new API before disabling the older direct-client path.
3. Publish the updated `firestore.rules` using `firebase deploy --only firestore:rules --project meesho-profit-calculator-99652` or the Console Rules editor. The updated file denies all browser access. The Admin SDK bypasses these rules, so authorization is enforced inside the API. Do not publish the new rules while the production app still uses the previous direct-Firestore code.

Only source/config files have changed locally; the previously deployed owner-only rules are deliberately left in place until the backend deployment succeeds. No data migration is necessary for existing cloud snapshots.

Authentication → Authorized domains must include `meesho-profit-calculator-atd.vercel.app`. Phone sign-in, SMS region policy, and linked billing must be configured in Firebase. Firebase test numbers avoid sending real SMS while testing. See [phone authentication](https://firebase.google.com/docs/auth/web/phone-auth) and [billing requirements](https://firebase.google.com/docs/auth/faq-and-troubleshooting).

### Local development

Install dependencies with `npm ci`. Run `npm run dev:api` and `npm run dev` in separate terminals. Vite proxies `/api` to the API process on `127.0.0.1:3001`. For server configuration, put the JSON variable in ignored `.env.local` (a single-quoted JSON value is supported by Node's env-file parser). Vercel environment variables do not automatically appear in local terminals. A Vite-only preview cannot serve the backend.

### Existing browser data

The login screen can download older local calculator data as a JSON backup. Sign in, then restore that JSON in Settings to copy it into your account. Unscoped browser data is never silently uploaded. Each UID has its own IndexedDB and local-storage caches. Signing out hides the dashboard but retains that account's device cache.

### Cloud synchronization

Saves use immutable chunks and a transactionally updated revision pointer. API requests stay below Vercel's payload limit. The server owns upload-session IDs, checks expiry, validates chunk sizes, validates the complete dataset and checksum, and rechecks the revision at commit. It never accepts a target user ID from the browser. Newer changes from another device pause syncing instead of being overwritten. Download a device backup and load the cloud version in Settings to resolve conflicts. Old snapshots are retained; clearing the active dataset does not purge historical snapshots.

### Verification

`npm run check` type-checks both frontend and backend, runs lint/tests, and builds the frontend. Security-rule integration tests use the Firestore emulator: `npx firebase-tools@14.17.0 emulators:exec --only firestore --project demo-meesho-profit "npm run test:rules"`. The tests verify direct-client access is denied. Backend tests verify token scoping, conflict handling, validation, immutable chunks, and existing snapshot compatibility. Real SMS and production service-account permissions must be verified after deployment.

### Read-only developer administration

The `/admin` workspace lists Firebase Authentication accounts and reads their latest committed calculator snapshots through `/api/admin`. Sign in normally using the owner account, then choose **Admin panel** in the account toolbar. The owner UID explicitly authorized for this project is configured only in `api/admin.ts`. Optionally set server-only `FIREBASE_ADMIN_UIDS` to a comma-separated replacement allowlist; an explicitly empty value disables access. Never infer admin rights from a phone number, URL parameter, client storage or a browser-only role.

The backend verifies revoked tokens and checks the allowlist on every request. Admin API operations are GET-only and do not alter accounts or reports. Ordinary `/api/cloud` requests remain scoped to the signed-in user. Admin viewing uses component memory, not customer IndexedDB or the owner's cloud-sync provider. Selecting another account aborts the old request and clears its report. All account listings, account views and chunk reads create `adminAudit` records containing the verified actor UID, target UID (when applicable), snapshot ID and server timestamp. Failed audit writes prevent returning data. Do not add browser access to the audit collection.

The service account needs Firebase Authentication list/get permissions in addition to the existing Firestore access. The panel shows imported rows, raw source fields and calculations, not original Excel files (these are not stored), historical snapshots or unsynced device changes. Login and dashboard notices disclose read-only developer support access. Restrict this support access to troubleshooting and protect the admin phone login. For production verification, sign in with the authorized owner account, open a saved report, inspect its corresponding `adminAudit` records, and confirm a normal user receives 403 from `/api/admin?action=users`.

### Vercel cold-start compatibility

The backend pins Firebase Admin 13.10.0. The Firebase Admin 14 / jwks-rsa 4 / jose 6 dependency chain failed during module loading under the Vercel loader with `ERR_REQUIRE_ESM`. Every production build now imports the actual Admin SDK auth and Firestore entrypoints in a subprocess with CommonJS-to-ESM require support disabled. This reproduces the deployment constraint even on a newer development Node version and fails the build before a broken function can ship. Do not upgrade this dependency without passing `npm run check:server`.
