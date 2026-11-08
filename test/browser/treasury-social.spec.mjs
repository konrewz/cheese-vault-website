import { test, expect } from '@playwright/test';
test.beforeEach(async({page})=>{await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());});
for(const width of [320,390,1440])for(const theme of ['light','dark'])test(`Treasury and X ${width} ${theme}`,async({page})=>{
  await page.setViewportSize({width,height:900});await page.emulateMedia({colorScheme:theme});await page.goto('/#/treasury');
  await expect(page.locator('main h1')).toHaveText('A little cheese.Full transparency.');
  await expect(page.locator('.main-nav a')).toHaveCount(6);
  await expect(page.locator('.treasury-assets .treasury-asset')).toHaveCount(4);
  await expect(page.locator('.treasury-fee-grid article')).toHaveCount(4);
  await expect(page.locator('main')).not.toContainText('24.5%');
  await expect(page.locator('main').getByRole('button',{name:/connect|approve|deposit|claim|activate|sign/i})).toHaveCount(0);
  const link=page.locator('.floating-x');await expect(link).toBeVisible();await expect(link).toHaveAttribute('href','https://x.com/cheesevaultfun');await link.focus();await expect(page.locator('.social-tooltip')).toBeVisible();
  await expect(page.locator('.footer-x')).toHaveAttribute('href','https://x.com/cheesevaultfun');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  for(const route of ['home','farm','portfolio','treasury','how-to-play','proof']){
    await page.locator(`.main-nav a[href="#/${route}"]`).click();await expect(link).toBeVisible();
  }
  await page.locator('header').getByRole('button',{name:'Connect wallet'}).click();await expect(page.locator('dialog')).toBeVisible();await expect(link).toBeHidden();
  await page.keyboard.press('Escape');await expect(link).toBeVisible();
  await page.locator('.main-nav a[href="#/treasury"]').click();await page.screenshot({path:`qa/screenshots/treasury-${width}-${theme}.png`,fullPage:true});
});
test('mobile floating X clears interactive controls near the footer',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/#/farm');await page.locator('.site-footer').scrollIntoViewIfNeeded();await page.waitForTimeout(200);
  const collisions=await page.evaluate(()=>{const a=document.querySelector('.floating-x').getBoundingClientRect();return [...document.querySelectorAll('button,a:not(.floating-x),input,select,summary')].filter(x=>!x.closest('.floating-x')).map(x=>x.getBoundingClientRect()).filter(b=>b.width&&b.height&&b.left<a.right&&b.right>a.left&&b.top<a.bottom&&b.bottom>a.top).length;});expect(collisions).toBe(0);
});
