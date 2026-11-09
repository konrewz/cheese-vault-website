import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());});
for(const width of [390,1440])for(const theme of ['light','dark'])test(`Extension readiness ${width} ${theme}`,async({page})=>{
 await page.setViewportSize({width,height:900});await page.emulateMedia({colorScheme:theme});await page.goto('/#/farm');
 await expect(page.locator('.farm-grid > article')).toHaveCount(4);
 await page.getByRole('button',{name:'Deposit IMD (Auto Convert)',exact:true}).click();
 await expect(page.getByRole('button',{name:'Review next transaction',exact:true})).toBeDisabled();
 await expect(page.getByRole('heading',{name:'SQK Pool',exact:true})).toBeVisible();
 // RPC is blocked in this failure-state browser fixture, so verified addresses
 // must not imply ready transactions or successful conversion.
 await expect(page.locator('.conversion-status')).toContainText('Verification unavailable');
 await expect(page.locator('.conversion-status')).toContainText('not official production sIMD');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.goto('/#/proof');await page.locator('.contract-details summary').click();
 await expect(page.getByRole('heading',{name:'Sepolia test extensions'})).toBeVisible();
 await expect(page.getByRole('link',{name:'0xcb93f154d9ab512753964c49ad8be507ecec677f',exact:true})).toHaveAttribute('href','https://sepolia.etherscan.io/address/0xcb93f154d9ab512753964c49ad8be507ecec677f');
 await expect(page.getByRole('link',{name:'0x247a2dabba2b4f5e97d8f5f9a12c9e17b1c1b920',exact:true})).toHaveAttribute('href','https://sepolia.etherscan.io/address/0x247a2dabba2b4f5e97d8f5f9a12c9e17b1c1b920');
});
