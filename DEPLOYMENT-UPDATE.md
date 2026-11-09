# Verified Sepolia extension frontend update

Deploy frontend only. No contract deployment, Owner action, activation, wallet file or signing executor is included.

The verified test sIMD wrapper and SQK Farm addresses are in `src/contracts/extensions.json`; public receipts are in `public/evidence/extensions/deployments.json`.
All four farms are registered at 400/200/200/200. The frontend still verifies runtime, asset and registration before allowing extension transactions.
Activation does not imply new rewards: actual certified Squeek Blocks must advance. APR and USD TVL remain unavailable without reliable pricing/history.

Node 22.12+, root directory `/`, production branch `main`, build `npm run build`, output `dist`.
The existing Cloudflare Git integration should deploy after the validated commit reaches GitHub. Do not change DNS.

Validation: TypeScript; 33 core tests; 109 UI tests; 25 browser scenarios; official ABI provenance and production build.
Browser fixtures do not sign. Live Sepolia testing is recorded privately in the original workspace, separately from this frontend release.
