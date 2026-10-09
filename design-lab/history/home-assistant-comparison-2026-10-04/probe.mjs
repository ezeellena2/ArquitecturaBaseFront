import { chromium } from '../../../node_modules/@playwright/test/index.mjs';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
await fs.mkdir('evidence',{recursive:true});
const errors=[];page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error') errors.push(message.text().slice(0,500));});
for(const library of ['assistant-ui','ai-elements','copilotkit','chatkit']){
  const start=errors.length;
  await page.goto(`http://127.0.0.1:5184/design-lab/home-assistant/libraries/index.html?library=${library}&lang=es&scene=answer`);
  await page.waitForTimeout(library==='chatkit'?12000:4500);
  await page.screenshot({path:`evidence/${library}-answer-es-1440.png`,fullPage:true});
  process.stdout.write(JSON.stringify({library,errors:errors.slice(start),text:(await page.locator('body').innerText()).slice(-2000),frames:page.frames().map(frame=>frame.url())})+'\n');
}
await browser.close();
