import { test, expect } from '@playwright/test';
test.use({ hasTouch: true });
for (const width of [1440, 390, 320]) for (const theme of ['light', 'dark']) {
  test(`four pools ${width}px ${theme}`, async ({ page }) => {
    await page.setViewportSize({width,height:950}); await page.emulateMedia({colorScheme:theme});
    await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    await page.goto('/');
    for (const route of ['home','farm','portfolio']) {
      await page.locator(`.main-nav a[href="#/${route}"]`).click();
      await expect(page.locator('main .pool-card')).toHaveCount(4);
      await expect(page.locator('main .apr-trigger')).toHaveCount(4);
      await expect(page.getByRole('heading', {name:'SQK Pool'})).toBeVisible();
      if (route !== 'portfolio') {
        await expect(page.getByRole('region',{name:'Total value locked'})).toBeVisible();
        await expect(page.locator('.tvl-usd')).toContainText('Unavailable');
        await expect(page.locator('.tvl-asset')).toHaveCount(4);
      }
      for (const action of ['Deposit','Withdraw','Claim','MAX'])
        await expect(page.locator('.pool-sqk').getByRole('button',{name:action,exact:true})).toBeDisabled();
    }
    await page.locator('.main-nav a[href="#/farm"]').click();
    const apr = page.locator('.pool-sqk .apr-trigger');
    await (width < 640 ? apr.tap() : apr.click()); await expect(page.locator('.pool-sqk [role="tooltip"]')).toBeVisible();
    await (width < 640 ? apr.tap() : apr.click()); await expect(page.locator('.pool-sqk [role="tooltip"]')).not.toBeVisible();
    await page.getByRole('button',{name:'Deposit IMD (Auto Convert)',exact:true}).click();
    await expect(page.getByRole('button',{name:'Convert IMD and deposit'})).toBeDisabled();
    await expect(page.getByRole('button',{name:'Conversion unavailable',exact:true})).toBeDisabled();
    await expect(page.getByLabel('IMD amount')).toBeDisabled();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({path:`qa/screenshots/four-pools-${width}-${theme}.png`,fullPage:true});
    await page.locator('.main-nav a[href="#/how-to-play"]').click();
    for (const title of ['Connect Your Wallet','Choose a Pool','Earn CHEESE','Claim or Withdraw','Two Ways to Earn','When Someone Withdraws, Everyone Else Benefits.'])
      await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();
    await expect(page.getByText(/not directly transferred to their wallets/)).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
