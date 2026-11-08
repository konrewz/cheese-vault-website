# Existing Cloudflare deployment: Treasury and X update

The previous public main commit `345aeb8beef63d7c0dc90f95a5233dd0469d522c`
has a successful Cloudflare Pages check on GitHub. Its returned project is
**cheese-vault-website**, not the earlier requested but unverified `cheese-vault-v2`.
This current evidence supersedes the project-name assumption in the original
CLOUDFLARE.md handoff. Do not create another project or change DNS for this update.

Verified previous deployment preview:
https://66e489f2.cheese-vault-website.pages.dev

https://cheesevault.fun returned HTTP 200 with the previous release assets on
2026-11-08. That is not proof a later commit has deployed. The www hostname was
not resolvable from the execution environment. No domain or DNS changes were made.

1. Push the validated successor commit to `konrewz/cheese-vault-website`, `main`,
   without force. The existing native Cloudflare Git integration should deploy it.
2. On that exact commit, require a completed successful **Cloudflare Pages** check
   and open its returned preview URL. An older successful check does not count.
3. Verify Treasury in the six-page navigation, the official X links, both themes,
   live read states, and disabled unconfigured SQK/conversion controls.
4. Verify the production domain serves the same JS/CSS as that deployment before
   declaring the update live.

Expected settings: React (Vite), main, repository root (blank Root directory),
`npm run build`, output `dist`, Node 22. This session had no authenticated Cloudflare
API access to inspect Dashboard configuration directly.

The GitHub workflow now validates only. Cloudflare's existing native integration
owns deployment; the obsolete optional Wrangler step targeting cheese-vault-v2
was removed to prevent a competing deployment to the wrong project. No Cloudflare
secret is required by this workflow.

CI uses Ubuntu 24.04. The preceding run passed installation, TypeScript, tests,
ABIs and build, then failed at browser installation while ubuntu-latest was
migrating to Ubuntu 26. Pinning the supported runner removes that variable;
the exact old install failure could not be read without authenticated logs.
The new hosted CI run still needs verification after the push.

If the Cloudflare check is missing or fails, inspect the existing project's build
logs and linked repository/branch. Do not change DNS or create another Pages project
to repair a frontend build.

Reference: https://developers.cloudflare.com/pages/configuration/git-integration/
