import assert from 'node:assert/strict';
import { chromium } from '../../../node_modules/@playwright/test/index.mjs';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage();
try {
  await page.route('https://cdn.platform.openai.com/deployments/chatkit/chatkit.js',route=>route.abort());
  await page.goto('http://127.0.0.1:5184/design-lab/home-assistant/libraries/index.html?library=chatkit&lang=es&scene=answer');
  await page.getByText('Vista no disponible',{exact:true}).waitFor();
  await page.getByText('No pudimos cargar este ejemplo.',{exact:true}).waitFor();
  assert.equal(await page.getByText('No pudimos cargar este ejemplo.',{exact:true}).count(),1);
  await page.getByRole('button',{name:'AI Elements',exact:true}).click();
  await page.getByRole('textbox').first().waitFor({state:'visible'});
  await page.goto('http://127.0.0.1:5182/design-lab/home-assistant/index.html?lang=es&scene=empty');
  await page.waitForURL('**:5184/design-lab/home-assistant/libraries/index.html?**');
  await page.getByRole('textbox').first().waitFor({state:'visible'});
  process.stdout.write('Passed isolated CDN failure recovery and previous preview redirect\n');
}finally {await browser.close();}
