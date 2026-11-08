import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const install = process.argv.includes('--install');
const result = spawnSync(process.execPath,
  ['node_modules/@playwright/test/cli.js', ...(install ? ['install', 'chromium'] : ['test', ...process.argv.slice(2)])],
  { stdio: 'inherit', env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: fileURLToPath(new URL('../.playwright', import.meta.url)) } });
process.exit(result.status ?? 1);
