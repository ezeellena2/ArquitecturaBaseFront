import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { chromium } from '../../../node_modules/@playwright/test/index.mjs';

const built = process.argv.includes('--built');
const base = `http://127.0.0.1:${built ? 5185 : 5186}`;
const server = built ? undefined : spawn(process.execPath, ['../../../node_modules/vite/bin/vite.js', '--config', 'vite.config.mjs', '--port', '5186'], { cwd: import.meta.dirname, stdio: 'pipe', windowsHide: true });
let serverLog = '';
server?.stdout.on('data', text => { serverLog += text; });
server?.stderr.on('data', text => { serverLog += text; });
let browser;
const failures = [];
const checks = [];
try {
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    try { ready = (await fetch(`${base}/design-lab/whatsapp-chat/libraries/index.html`)).ok; } catch { /* server still starting */ }
    if (ready) break;
    if (server && server.exitCode !== null) throw new Error(serverLog);
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert(ready, serverLog);
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ reducedMotion: 'reduce', timezoneId: 'America/Argentina/Buenos_Aires' });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => failures.push(error.message));
  page.on('console', message => { if (message.type() === 'error' || message.type() === 'warning') failures.push(message.text()); });
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.origin !== base && !['data:', 'blob:'].includes(url.protocol)) failures.push(`External request: ${url.href}`);
  });
  const path = `${base}/design-lab/whatsapp-chat/libraries/index.html`;
  await fs.mkdir(new URL('./evidence/', import.meta.url), { recursive: true });
  for (const library of ['chatscope', 'syncfusion']) {
    for (const lang of ['es', 'en']) {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto(`${path}?library=${library}&lang=${lang}`);
      const input = page.getByRole('textbox', { name: lang === 'es' ? 'Respuesta' : 'Reply', exact: true });
      await input.waitFor({ state: 'visible' });
      await page.locator(library === 'chatscope' ? '.kit-native-stage .cs-chat-container' : '.kit-native-stage .e-chat-ui').waitFor({ state: 'visible', timeout: 3000 });
      await page.evaluate(() => document.fonts.ready);
      for (const width of [1440, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.waitForTimeout(250);
        const latest = page.getByText(lang === 'es' ? 'Perfecto, te esperamos a las 17.' : 'Perfect, we will see you at 17.', { exact: true });
        const lastVisible = await latest.evaluate(element => {
          const viewport = element.closest('.e-message-wrapper, .cs-message-list__scroll-wrapper');
          return !viewport || element.getBoundingClientRect().bottom <= viewport.getBoundingClientRect().bottom + 1;
        });
        assert(lastVisible, `${library} ${lang} latest message clipped after resize to ${width}`);
        await page.screenshot({ path: `evidence/native-${library}-${lang}-${width}.png`, fullPage: true, animations: 'disabled' });
        assert(await input.isVisible(), `${library} ${lang} composer hidden at ${width}`);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${library} ${lang} overflow at ${width}`);
      }
      await input.fill('Borrador móvil');
      await page.getByRole('button', { name: lang === 'es' ? 'Chats' : 'Chats', exact: true }).click();
      await page.getByRole('button', { name: 'Juan Gómez', exact: true }).click();
      await page.getByRole('button', { name: 'Chats', exact: true }).click();
      await page.getByRole('button', { name: 'Ana Martínez', exact: true }).click();
      assert.equal(await input.evaluate(element => element.value ?? element.innerText), 'Borrador móvil');
      await page.setViewportSize({ width: 1440, height: 1000 });
      await input.fill('Borrador de prueba <texto>');
      await page.getByRole('button', { name: library === 'chatscope' ? 'Syncfusion' : 'Chatscope', exact: true }).click();
      assert.equal(await input.evaluate(element => element.value ?? element.innerText), 'Borrador de prueba <texto>');
      await page.getByRole('button', { name: library === 'chatscope' ? 'Chatscope' : 'Syncfusion', exact: true }).click();
      await page.getByRole('button', { name: 'Juan Gómez', exact: true }).click();
      await page.getByRole('button', { name: 'Ana Martínez', exact: true }).click();
      assert.equal(await input.evaluate(element => element.value ?? element.innerText), 'Borrador de prueba <texto>');
      await page.getByRole('button', { name: lang === 'es' ? 'Enviar' : 'Send', exact: true }).click();
      await page.getByText(lang === 'es' ? 'Respuesta guardada en la cola simulada.' : 'Reply saved to the simulated queue.', { exact: true }).waitFor();
      await page.getByText('Borrador de prueba <texto>', { exact: true }).waitFor();
      assert.equal(await page.locator('texto').count(), 0, 'Draft must render as plain text');
      assert.equal(await input.evaluate(element => element.value ?? element.innerText), '');
      const selector = page.getByRole('combobox', { name: lang === 'es' ? 'Estado de la maqueta' : 'Mockup state' });
      for (const scene of ['empty', 'loading', 'error', 'read-only', 'closed', 'states']) {
        await selector.selectOption(scene);
        await page.screenshot({ path: `evidence/native-${library}-${lang}-${scene}.png`, fullPage: true });
        if (scene === 'read-only' || scene === 'closed') {
          assert(await page.getByRole('button', { name: lang === 'es' ? 'Enviar' : 'Send', exact: true }).isDisabled());
        }
        if (scene === 'error') {
          await page.getByRole('button', { name: lang === 'es' ? 'Reintentar' : 'Retry', exact: true }).click();
          await input.waitFor({ state: 'visible' });
        }
        if (scene === 'states') {
          await page.getByRole('button', { name: lang === 'es' ? 'Revisar envío' : 'Review send', exact: true }).click();
          await page.getByRole('button', { name: lang === 'es' ? 'Confirmar revisión' : 'Confirm review', exact: true }).click();
          await page.getByText(lang === 'es' ? 'Revisado · entrega sin confirmar' : 'Reviewed · delivery unconfirmed', { exact: true }).waitFor();
          await input.fill('Respuesta después de revisar');
          assert(await page.getByRole('button', { name: lang === 'es' ? 'Enviar' : 'Send', exact: true }).isEnabled());
        }
      }
      checks.push(`${library} ${lang}: mobile layout, drafts across chats/libraries, plain text, queue, scenes, recovery and review`);
    }
  }
  if (built) {
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`${path}?library=chatscope-adapted&lang=es`);
      await page.getByRole('textbox', { name: 'Respuesta', exact: true }).waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `evidence/chatscope-adapted-es-${width}.png`, fullPage: true, animations: 'disabled' });
    }
  }
  assert.deepEqual(failures, [], 'Unexpected browser notices or external requests');
  await fs.writeFile(`evidence/${built ? 'built-' : ''}native-verification.json`, JSON.stringify({ checks, failures, license: 'Syncfusion original trial banner remains visible; no license registered.' }, null, 2));
  console.log(`${checks.length} complete journeys passed; no browser notices or external requests.`);
} finally {
  await browser?.close();
  server?.kill();
}
