import { test, expect } from '@playwright/test';
const routes = ['home', 'farm', 'portfolio', 'how-to-play', 'proof'];
const links = [
  'https://explorer.imd.fun/jobs/3c7de646-4d13-45f5-ba32-3c57c559d8e8',
  'https://explorer.imd.fun/jobs/8c2f3489-1625-4e4b-805e-66cabdde9fee',
  'https://github.com/identity-md-launches/launch-3140-cheese-v2-official',
  'https://github.com/identity-md-launches/launch-3143-build-cheese-vault-complete',
];
test.beforeEach(async ({ page }) => {
  // Deterministic offline UI checks. No fabricated RPC results or signatures.
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
});
for (const width of [1440, 390, 320]) for (const theme of ['light', 'dark']) {
  test(`${width}px ${theme}: five pages, navigation, wallet and proof`, async ({ page }) => {
    await page.setViewportSize({ width, height: 950 });
    await page.emulateMedia({ colorScheme: theme });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    for (const route of routes) {
      await page.locator(`.main-nav a[href="#/${route}"]`).click();
      await expect(page.locator('main h1')).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await expect(page.locator('.theme-toggle')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `qa/screenshots/${width}-${theme}-${route}.png`, fullPage: true });
    }
    for (const href of links) {
      const link = page.locator(`main a[href="${href}"]`);
      await expect(link).toBeVisible(); await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', /noreferrer/);
    }
    await expect(page.locator('.contract-details')).not.toHaveAttribute('open', '');
    await page.locator('.contract-details summary').click();
    await expect(page.locator('.contract-row')).toHaveCount(5);
    await expect(page.locator('.contract-row').first()).toBeVisible();
    await page.locator('.contract-details summary').click();
    await page.locator('header').getByRole('button', { name: 'Connect wallet' }).click();
    await expect(page.locator('dialog')).toBeVisible();
    await expect(page.locator('dialog')).toHaveCSS('background-color', theme === 'dark' ? 'rgb(42, 35, 28)' : 'rgb(255, 253, 248)');
    await page.screenshot({ path: `qa/screenshots/${width}-${theme}-wallet.png` });
    await page.keyboard.press('Escape');
    await expect(page.locator('dialog')).not.toBeVisible();
    await page.getByRole('button', { name: `Switch to ${theme === 'light' ? 'dark' : 'light'} mode` }).click();
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme === 'light' ? 'dark' : 'light');
    expect(errors).toEqual([]);
  });
}
test('theme bootstrap runs before the application bundle, preventing a light flash', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.route('**/assets/*.js', route => route.abort());
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(23, 20, 17)');
  await page.evaluate(() => localStorage.setItem('cheese-vault:theme', 'light'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});
test('text palettes meet WCAG AA contrast in both themes; reduced motion is respected', async ({ page }) => {
  for (const theme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('main h1')).toBeVisible();
    const ratios = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      const color = name => {
        const el = document.createElement('span'); el.style.color = `var(${name})`; document.body.append(el);
        const rgb = getComputedStyle(el).color.match(/[\d.]+/g).slice(0,3).map(Number); el.remove();
        const v = rgb.map(n => { n /= 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4; });
        return v[0] * .2126 + v[1] * .7152 + v[2] * .0722;
      };
      return ['--color-bg-page', '--color-bg-surface', '--color-bg-raised', '--color-bg-sunken'].flatMap(bg =>
        ['--color-text-primary', '--color-text-secondary', '--color-accent-text'].map(fg => {
          const a = color(bg), b = color(fg);
          return { bg, fg, ratio: (Math.max(a,b)+.05)/(Math.min(a,b)+.05), theme: root.colorScheme };
        }));
    });
    for (const pair of ratios) expect(pair.ratio, JSON.stringify(pair)).toBeGreaterThanOrEqual(4.5);
    await expect(page.locator('.theme-toggle')).toHaveCSS('transition-duration', '0s');
    await expect(page.locator('.hero-image')).toHaveCSS('animation-name', 'none');
  }
});
