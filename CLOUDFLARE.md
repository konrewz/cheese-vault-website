> Current deployment evidence and update instructions: [DEPLOYMENT-UPDATE.md](DEPLOYMENT-UPDATE.md). The existing native Git deployment is now confirmed under project cheese-vault-website. The older setup alternatives below are historical; do not run a second publisher or change DNS for this update.

# Deploy this exact frontend to the existing Pages project

No deployment or domain connection is implied by these instructions. Verify the resulting commit, deployment URL, DNS and HTTPS after execution.

## 1. Inspect the existing project first

In Cloudflare Dashboard, open **Workers & Pages > cheese-vault-v2 > Settings > Builds**. Record the currently linked Git owner/repository and production branch. `tested-v2` has not been verified as containing this release. The desired source is `konrewz/cheese-vault-website`, branch `main`.

If the native Git connection already points to this repository, use this path:

1. In **Settings > Builds > Branch control**, select **main** as production branch. Enable production automatic deployments and select the intended preview policy.
2. In build configuration select **React (Vite)**, build command **npm run build**, output **dist**, and leave Root directory empty (repository root, `/`). `package.json` is at that root, not under the Windows project folder name.
3. Use Node 22 via `.node-version`; if an old `NODE_VERSION` override exists, change that project's build variable to `22`.
4. Trigger a production build for the published `main` commit. Check its exact commit SHA against GitHub and wait for deployment success. A retry of an old deployment may rebuild the old commit, so inspect the revision before accepting it.
5. Leave `CLOUDFLARE_DEPLOY_ENABLED` unset in GitHub when native Git automatic deployment is in use.

## 2. If the linked repository is different

Do not delete or recreate the Pages project or erase its domains. Do not assume changing the branch changes the repository. The documented supported alternative is to deploy using Wrangler to the existing Git-integrated project:

1. In Cloudflare **Settings > Builds > Branch control**, disable automatic production builds from the old repository and set preview deployments to **None**. Set the project's production branch to **main**. The native Git association may remain visible, but must no longer publish old source.
2. In GitHub, open **konrewz/cheese-vault-website > Settings > Secrets and variables > Actions**.
3. Create the repository secret **CLOUDFLARE_ACCOUNT_ID** using the account ID shown in your Cloudflare Dashboard.
4. In Cloudflare **My Profile > API Tokens > Create Token > Create Custom Token**, grant **Account > Cloudflare Pages > Edit**, scoped only to the account containing `cheese-vault-v2`. Use the resulting token as the GitHub repository secret **CLOUDFLARE_API_TOKEN**. Do not paste it into code, commits, chat, logs, build variables or public configuration. DNS is configured separately in Dashboard; this publisher needs no DNS-edit credential.
5. Add repository Actions **variable** **CLOUDFLARE_DEPLOY_ENABLED** with value **true**.
6. Open GitHub **Actions > Validate and deploy Cheese Vault > Run workflow**, choose **main**, then run it. This builds/tests this repository and calls pinned Wrangler for the existing `cheese-vault-v2` project, branch `main`, with the exact GitHub SHA. Later `main` pushes use the same workflow.
7. Verify Cloudflare classifies the result as **Production**, not Preview, and shows the same commit. Use the URL returned by that actual deployment. The direct-upload path changes who publishes the assets; it does not claim that the old native Git repository association was replaced.

If the Dashboard does not allow selecting `main`, an authenticated account administrator can use the documented Pages project PATCH endpoint to set only `production_branch` to `main`; do not recreate the project to change this field. Do not run a deployment until the read-back value is main.

Official references: [Git integration and disabling automatic deployments](https://developers.cloudflare.com/pages/configuration/git-integration/), [branch controls](https://developers.cloudflare.com/pages/configuration/branch-build-controls/), [direct uploads to existing Git-integrated projects](https://developers.cloudflare.com/pages/get-started/direct-upload/).

## 3. Connect cheesevault.fun and www.cheesevault.fun

1. Confirm **cheesevault.fun** is an active Cloudflare DNS zone in the same account as the Pages project. If the registrar is outside Cloudflare, set only the two nameservers assigned to this zone in its Overview page. Never guess nameservers. Preserve all existing DNS records, mail records and unrelated services.
2. Open **Workers & Pages > cheese-vault-v2 > Custom domains > Set up a domain**.
3. Enter **cheesevault.fun**, Continue, and accept the Pages-managed DNS record for this zone. If Cloudflare reports a conflicting record, inspect it before replacing anything; do not delete unrelated DNS records.
4. Repeat **Set up a domain** for **www.cheesevault.fun** and accept its Pages-managed record.
5. Wait for both custom domains to show **Active** and their certificates to be issued. Do not manually add an arbitrary A record or create a CNAME without the Pages association.
6. Visit both HTTPS URLs and the actual Pages deployment URL. Confirm all show the same new frontend, four pools, Night Mode, updated guide and proof links, with SQK/conversion still disabled. Check the deployment SHA and compare built asset hashes with the tested release. Test direct `#/farm`, `#/portfolio`, `#/how-to-play` and `#/proof` URLs.

An optional www-to-apex redirect is not necessary: both names may serve the same site. No redirect or unrelated DNS setting is changed by the workflow.

[Official custom-domain instructions](https://developers.cloudflare.com/pages/configuration/custom-domains/). Pages automatically creates the appropriate DNS records for a Cloudflare-managed zone after the domains are associated.

## 4. Release acceptance

- GitHub `main` matches the locally published commit, and is publicly accessible.
- Cloudflare's production deployment uses that commit and finishes successfully; record its real URL.
- Both custom domains resolve, serve HTTPS without certificate errors, and deliver that release.
- No Owner transaction, contract deployment, emission activation, wallet secret or IMD expenditure is required for this website publication.
