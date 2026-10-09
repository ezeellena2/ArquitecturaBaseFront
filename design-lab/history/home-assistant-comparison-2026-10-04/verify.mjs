import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from '../../../node_modules/@playwright/test/index.mjs';

const browser=await chromium.launch({headless:true});
const context=await browser.newContext();
// SDK telemetry is outside these UI tests. Only fictional local API fixtures are exercised.
await context.route('https://browser-intake-datadoghq.com/**',route=>route.fulfill({status:204,body:''}));
const page=await context.newPage();
const failures=[]; const notices=[]; const checks=[];
page.on('pageerror',error=>{
  if(error.stack?.includes('chatgpt.com/ces') || error.message==='Failed to fetch') notices.push(error.message);
  else failures.push(error.stack??error.message);
});
page.on('console',message=>{
  if(message.type()==='error'){
    const text=message.text();
    if(/chatgpt\.com\/ces|net::ERR_FAILED|^Failed to fetch$/.test(text)) notices.push(text);
    else failures.push(text);
  }
});
page.on('request',request=>{
  const url=new URL(request.url());
  if(url.host==='127.0.0.1:5184' || url.protocol==='data:' || url.protocol==='blob:')return;
  if(url.hostname==='cdn.platform.openai.com'||url.hostname==='chatgpt.com')return;
  if(url.hostname==='cdn.jsdelivr.net'&&url.pathname==='/npm/@fontsource-variable/public-sans@5.3.0/files/public-sans-latin-wght-normal.woff2')return;
  if(url.hostname==='browser-intake-datadoghq.com'){notices.push('SDK telemetry intercepted by test fixture');return;}
  failures.push(`Unexpected external request: ${url.origin}${url.pathname}`);
});
await fs.mkdir('evidence',{recursive:true});
async function surface(library){
  if(library!=='chatkit') return page;
  await page.waitForFunction(()=>customElements.get('openai-chatkit'));
  for(let attempt=0;attempt<50;attempt++){
    const frame=page.frames().find(candidate=>candidate.url().startsWith('https://cdn.platform.openai.com/deployments/chatkit/index-'));
    if(frame && await frame.getByRole('textbox').count()) return frame;
    await page.waitForTimeout(200);
  }
  throw new Error('ChatKit composer did not mount');
}
try {
  for(const library of ['assistant-ui','ai-elements','copilotkit','chatkit']){
    for(const lang of ['es','en']) for(const scene of ['empty','answer']) {
      await page.setViewportSize({width:1440,height:1000});
      await page.goto(`http://127.0.0.1:5184/design-lab/home-assistant/libraries/index.html?library=${library}&lang=${lang}&scene=${scene}`);
      const ui=await surface(library);
      await ui.getByRole('textbox').first().waitFor({state:'visible'});
      await page.waitForTimeout(700);
      for(const width of [1440,390,320]) {
        await page.setViewportSize({width,height:1000});await page.waitForTimeout(250);
        const geometry=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
        assert.ok(geometry.scroll<=geometry.width,`${library}/${scene}/${lang}/${width}: horizontal overflow`);
        const editor=await ui.getByRole('textbox').first().boundingBox();
        assert.ok(editor && editor.width>50 && editor.x>=0,`${library}: composer missing`);
        await page.screenshot({path:`evidence/${library}-${scene}-${lang}-${width}.png`,fullPage:true});
        checks.push({library,lang,scene,width,geometry});
      }
      if(lang==='es' && scene==='empty'){
        const editor=ui.getByRole('textbox').first();
        await editor.fill('¿Cuántos usuarios activos hay?');await editor.press('Enter');
        await ui.getByText('Hay 3 usuarios activos de un total de 4.',{exact:false}).first().waitFor({state:'visible'});
        assert.equal(await editor.inputValue().catch(()=>editor.textContent()),'');
        await editor.fill('¿Qué permisos tiene Soporte?');await editor.press('Enter');
        await ui.getByText('El rol Soporte tiene estos permisos:',{exact:false}).first().waitFor({state:'visible'});
        await page.getByRole('button',{name:'Historial',exact:true}).click();
        await page.getByRole('dialog').waitFor({state:'visible'});await page.keyboard.press('Escape');
        await page.getByRole('button',{name:'Nueva conversación',exact:true}).click();
        await page.getByRole('button',{name:'Seguir escribiendo',exact:true}).click();
        await ui.getByRole('textbox').first().waitFor({state:'visible'});
      }
    }
    process.stdout.write(`${library}: states and interactions checked\n`);
  }
  assert.deepEqual(failures,[]);
  await fs.writeFile('evidence/verification.json',JSON.stringify({states:checks.length,interactions:'send, followup, clear editor, history, Escape, cancel new conversation',failures,externalSdkNotices:[...new Set(notices)],checks},null,2));
  process.stdout.write(`Passed ${checks.length} states and four library interaction flows\n`);
}finally{await browser.close();}
