# The Cheese Vault website

Public Ethereum Sepolia (chain ID **11155111**) frontend. This is the dedicated website repository, not a contract deployment repository.

The five pages are Home, Cheese Farm, My Portfolio, How to Play and Swarm Proof. Features include persistent Light/Dark mode, original hamster artwork and receipt-gated bite animation, injected wallet discovery/connection, approval/deposit/withdraw/claim review and receipts, transaction history, four pool cards, APR hover/tap breakdowns, IMD conversion readiness, and per-asset TVL.

## Honest readiness

- Pool targets: CHEESE 40%, ETH 20%, sIMD 20%, SQK 20%. Actual on-chain allocations are shown separately.
- SQK token is verified on Sepolia, but its farm has no deployed/configured address in this release. SQK transaction controls remain disabled.
- The sIMD asset and official Sepolia IMD conversion contracts remain unverified/unconfigured. Conversion is disabled, with no assumed rate, fee or output.
- APR shows N/A when reliable prices/history are missing. USD TVL is unavailable; verified deposited quantities are shown in their own asset units.
- No wallet secrets are required. No automatic owner operations, activation, deployment or financial transactions are included.

## Run and validate

Use Node.js 22.12+ (Node 22 LTS selected by `.node-version`).

```sh
npm ci
npm run typecheck
npm test
npm run check:contracts
npm run build
npm run check:export
npm run preview
```

Preview: http://127.0.0.1:5174. For browser QA, keep the preview running and run `npm run test:browser:install`, then `npm run test:browser`. On Linux, `PLAYWRIGHT_BROWSERS_PATH="$PWD/.playwright" npx playwright install --with-deps chromium` installs required system libraries as well. Browser tests intentionally block outside network requests; UI transaction tests use explicit fixtures and do not sign or broadcast.

Latest local validation: 33 core tests, 81 UI/verification tests, 14 Chromium scenarios, TypeScript, ABI provenance and the production build passed. Production pages perform their original real RPC reads. The main bundle retains a size warning, not a build failure.

## Cloudflare Pages

| Setting | Value |
| --- | --- |
| Repository | `konrewz/cheese-vault-website` |
| Production branch | `main` |
| Project | `cheese-vault-v2` |
| Framework | React (Vite) |
| Root directory | Repository root; leave blank in Dashboard (`/`) |
| Build command | `npm run build` |
| Output directory | `dist` |
| Node version | 22 |

See [CLOUDFLARE.md](CLOUDFLARE.md) for native Git integration, the supported existing-project fallback, and both custom domains. The included GitHub workflow validates each `main` push. Its deployment step is disabled until the required Cloudflare credentials and enable variable are configured. Do not enable native Git automatic deployments and the Actions publisher simultaneously.

This repository contains only the selected frontend source, tests, public ABIs/evidence, assets/licenses and build/deployment configuration. Private audit evidence, wallets, keystores, environment files, previous private history and the separate Solidity development workspace are excluded. `dist/` is generated during builds and is not committed.

## Provenance

Based on the [original Swarm website](https://github.com/identity-md-launches/launch-3143-build-cheese-vault-complete), upstream commit `25d2762b2ee6c83ec81c07e3fa490df32261bf3e`, with the completed local theme, proof, four-pool, guide and TVL updates. The production frontend source/artwork is copied without logic changes. Official ABI provenance is recorded in `official/provenance.json`; licenses and notices remain in `LICENSES/`.

The original proof links are preserved:

- [Smart contracts Swarm job](https://explorer.imd.fun/jobs/3c7de646-4d13-45f5-ba32-3c57c559d8e8)
- [Website Swarm job](https://explorer.imd.fun/jobs/8c2f3489-1625-4e4b-805e-66cabdde9fee)
