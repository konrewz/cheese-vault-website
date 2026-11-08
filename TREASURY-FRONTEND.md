# Treasury and official X update

The existing website now has six primary pages: Home, Cheese Farm, My Portfolio,
Treasury, How to Play and Swarm Proof. No existing transaction logic or contract
was changed. The Treasury page itself has no wallet/signing dependency or admin controls.

Treasury: `0xdea11b3a70b77134424d436f6eb455f1abbd4449` on Ethereum Sepolia (11155111).
The page checks the actual Controller Treasury and flags a mismatch. It displays
the intended wallet's balances explicitly rather than silently switching recipients.
CHEESE, Controller, farm and SQK runtimes are checked against verified identities.
sIMD remains unavailable until a canonical Sepolia asset is independently approved.
SQK balance reads are available; the SQK farm remains undeployed/disabled.

Current balances are separate from revenue. The fee ledger scans the known
deployment-to-snapshot range, deduplicates logs, follows Treasury address changes,
and reconciles deferred fees against each farm's `treasuryOwed()`. `Withdrawn`
assigns the actual Treasury amount, including final-depositor and retained-fee-cap
behavior. `TreasuryPaymentDeferred` removes it from received cash; later
`TreasuryPaid` adds a cash receipt without counting a new assigned fee. Ordinary
transfers, premints and surplus skims are excluded. Assets are never summed into USD.

Totals require a complete scan, canonical snapshot and successful reconciliation.
Errors produce unavailable states, not invented zero balances. The browser scan is
bounded at 200,000 blocks; beyond that, an independently verified indexer is needed
before cumulative totals can be displayed. The history list shows the latest 50
fee events, while totals use the entire checked range. A failed read hides stale
totals. No token-price API or API credentials are required.

Premint confirmation requires the successful recorded deployment receipt at block
12089810 and all three actual zero-address token Transfer events plus Preminted.
The initial 63M/63M/84M allocations were all minted to the same wallet. They are
not described as three current balances. The public evidence file contains only
public addresses, hashes, blocks and decoded constructor events.

The floating X control and footer link point only to https://x.com/cheesevaultfun.
The icon uses the official brand path, supports both themes and keyboard focus,
and includes a tooltip. On mobile it moves clear of nearby interactive controls;
it is hidden while wallet/transaction dialogs are open. No social tracking script
is loaded.

Development: `npm run dev -- --port 5174 --strictPort`.
Production preview: `npm run build` followed by `npm run preview`.
Validation: `npm run typecheck`, `npm test`, `npm run check:contracts`,
`npm run build`, `npm run check:export`, `npm run test:browser`.
On this Windows machine, set the process environment variable CHEESE_TEST_BROWSER
to the installed Chrome executable when using browser tests without a downloaded
Playwright browser. Test fixtures and mocked network tests are never live transactions.

Publication uses the existing sanitized main history in `.publication/cheese-vault-website`.
The local setup report and private QA evidence are not included in the frontend release.
No smart-contract configuration, DNS or domain settings are part of this update.
