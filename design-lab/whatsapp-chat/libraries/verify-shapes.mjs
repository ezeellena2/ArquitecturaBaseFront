import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from '../../../node_modules/@playwright/test/index.mjs';

const base = 'http://127.0.0.1:5185';
const path = `${base}/design-lab/whatsapp-chat/libraries/shapes.html`;
const errors = [];
const results = [];
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ reducedMotion: 'reduce', timezoneId: 'America/Argentina/Buenos_Aires' });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (['error', 'warning'].includes(message.type())) errors.push(message.text()); });
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.origin !== base && !['data:', 'blob:'].includes(url.protocol)) errors.push(`External request: ${url.href}`);
    if (/syncfusion|chat-kits/.test(url.pathname)) errors.push(`Provider styles/runtime in real chat preview: ${url.pathname}`);
  });
  await fs.mkdir(new URL('./evidence/', import.meta.url), { recursive: true });
  for (const language of ['es', 'en']) {
    const current = language === 'es' ? 'Actuales' : 'Current';
    const rounded = language === 'es' ? 'Redondeadas' : 'Rounded';
    const reply = page.getByRole('textbox', { name: language === 'es' ? 'Respuesta al cliente' : 'Reply to customer', exact: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${path}?lang=${language}&shape=current`);
    await reply.waitFor({ state: 'visible' });
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator('.message-bubble').count(), 6);
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.getByRole('button', { name: current, exact: true }).click();
      await page.waitForTimeout(180);
      const original = await page.locator('.shape-lab-screen').evaluate(root => {
        window.labComposer = root.querySelector('#chat-reply');
        return [...root.querySelectorAll('*')].map(element => {
          const css = getComputedStyle(element);
          const box = element.getBoundingClientRect();
          return {
            tag: element.tagName, color: css.color, background: css.backgroundColor,
            borderColor: css.borderColor, borderWidth: css.borderWidth,
            font: css.fontFamily, size: css.fontSize, lineHeight: css.lineHeight,
            padding: css.padding, margin: css.margin,
            radius: element.classList.contains('message-bubble') ? 'variant' : css.borderRadius,
            geometry: [box.x, box.y, box.width, box.height],
          };
        });
      });
      await page.screenshot({ path: `evidence/shape-current-${language}-${width}.png`, fullPage: true, animations: 'disabled' });
      await page.getByRole('button', { name: rounded, exact: true }).click();
      const updated = await page.locator('.shape-lab-screen').evaluate(root => [...root.querySelectorAll('*')].map(element => {
        const css = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        return {
          tag: element.tagName, color: css.color, background: css.backgroundColor,
          borderColor: css.borderColor, borderWidth: css.borderWidth,
          font: css.fontFamily, size: css.fontSize, lineHeight: css.lineHeight,
          padding: css.padding, margin: css.margin,
          radius: element.classList.contains('message-bubble') ? 'variant' : css.borderRadius,
          geometry: [box.x, box.y, box.width, box.height],
        };
      }));
      assert.deepEqual(updated, original, `${language}/${width}: actual screen changed beyond bubble silhouettes`);
      assert(await page.evaluate(() => window.labComposer === document.querySelector('#chat-reply')), 'Composer remounted');
      assert.equal(await page.locator('.message-bubble').first().evaluate(element => getComputedStyle(element, '::before').content), 'none');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${language}/${width}: horizontal overflow`);
      await page.screenshot({ path: `evidence/shape-rounded-${language}-${width}.png`, fullPage: true, animations: 'disabled' });
      if (width < 768) {
        await reply.scrollIntoViewIfNeeded();
        await page.screenshot({ path: `evidence/shape-rounded-${language}-${width}-editor.png`, fullPage: true, animations: 'disabled' });
      }
      results.push({ language, width, identicalPaletteTypographyControlsAndGeometry: true });
    }
    await reply.fill('Borrador con <texto>');
    await page.getByRole('button', { name: current, exact: true }).click();
    assert.equal(await reply.inputValue(), 'Borrador con <texto>');
    await page.getByRole('button', { name: 'Chats', exact: true }).click();
    await page.getByRole('button', { name: 'Luis Pérez', exact: true }).click();
    assert.equal(await reply.inputValue(), '');
    assert.equal(await page.locator('.shape-lab-screen h2').innerText(), 'Luis Pérez');
    await page.getByRole('button', { name: 'Chats', exact: true }).click();
    await page.getByRole('button', { name: 'Ana Martínez', exact: true }).click();
    assert.equal(await reply.inputValue(), 'Borrador con <texto>');
    await page.getByRole('button', { name: rounded, exact: true }).click();
    await page.getByRole('button', { name: language === 'es' ? 'Enviar' : 'Send', exact: true }).click();
    await page.locator('.message-bubble').filter({ hasText: 'Borrador con <texto>' }).waitFor();
    assert(await reply.isDisabled(), 'Unresolved request must block another send');
    assert(await page.getByText(language === 'es' ? 'En cola' : 'Queued', { exact: true }).isVisible());
    for (const scenario of ['read-only', 'closed', 'chat-states', 'chat-access']) {
      await page.goto(`${path}?lang=${language}&scenario=${scenario}`);
      await reply.waitFor({ state: 'visible' });
      await page.evaluate(() => document.fonts.ready);
      if (['read-only', 'closed', 'chat-states'].includes(scenario)) assert(await reply.isDisabled(), `${scenario} must block sending`);
      if (scenario === 'chat-access') assert(!await page.getByText('123456 https://ejemplo.invalid/#t=secret', { exact: true }).count(), 'Secret leaked');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${scenario}: overflow`);
      await page.screenshot({ path: `evidence/shape-${scenario}-${language}-320.png`, fullPage: true, animations: 'disabled' });
    }
    await page.goto(`${path}?lang=${language}&scenario=chat-states`);
    await page.getByRole('button', { name: language === 'es' ? 'Ya revisé el WhatsApp' : 'I checked WhatsApp', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: language === 'es' ? 'Confirmar que revisé' : 'Confirm I checked', exact: true }).click();
    await page.getByText(language === 'es' ? 'Revisado por el operador' : 'Reviewed by operator', { exact: true }).last().waitFor();
    await page.goto(`${path}?lang=${language}&scenario=chat-history`);
    await reply.waitFor({ state: 'visible' });
    const history = page.locator('.message-history');
    await history.evaluate(element => { element.scrollTop = 0; });
    await page.getByRole('button', { name: language === 'es' ? 'Cargar mensajes anteriores' : 'Load earlier messages', exact: true }).click();
    await page.locator('.message-bubble').filter({ hasText: language === 'es' ? 'Mensaje 0' : 'Message 0' }).waitFor({ state: 'attached' });
    assert.equal(await page.locator('.message-bubble').count(), 50);
    for (const scenario of ['empty', 'loading']) {
      await page.goto(`${path}?lang=${language}&scenario=${scenario}`);
      await page.getByText(scenario === 'empty'
        ? language === 'es' ? 'Todavía no llegaron mensajes a este WhatsApp.' : 'No messages have arrived at this WhatsApp yet.'
        : language === 'es' ? 'Cargando conversaciones…' : 'Loading conversations…', { exact: true }).waitFor();
      assert.equal(await page.locator('.message-bubble').count(), 0);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: `evidence/shape-${scenario}-${language}-320.png`, fullPage: true, animations: 'disabled' });
    }
  }
  assert.deepEqual(errors, []);
  await fs.writeFile(new URL('./evidence/shape-verification.json', import.meta.url), JSON.stringify({ errors, results, checked: ['real page and hooks', 'no provider CSS/runtime', 'drafts across shapes and chats', 'pending without delivery', 'read-only and closed', 'secure access summaries', 'review', 'older history', 'empty and loading'] }, null, 2));
  console.log(`PASS: ${results.length} geometry/palette comparisons, drafts, queue, states, review and history; no console errors or external requests.`);
} finally {
  await browser.close();
}
