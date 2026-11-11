import { expect, test, type Locator, type Page } from "@playwright/test";

// MA1-A (2026-11-09) in the UI catalog: what is off says why on the same control, with the mouse, the focus, a click or
// a touch, and nothing goes next to it. Evidence es/en at 1440 and 390 px, without golden: the captures go to
// test-results to compare them with the board «MA1-A · Sobre el control, y que responda al tocarlo».
const copy = {
  es: {
    title: "Motivo de lo apagado", multiple: "Permitir elegir varias", multipleReason: "En un bloque se elige una sola opción.",
    publish: "Publicar en WhatsApp", publishReason: "Hay una publicación en curso.", up: "Subir Cantidad",
    upReason: "Cantidad: posición 1 de 3", info: "Más información sobre Máximo", infoText: "En WhatsApp se cargan hasta 10 ítems.",
    sample: "Como si lo recibiera", sampleReason: "Guardá el formulario para probar con una persona.",
    place: "Dónde va", other: "Compras", self: "Ventas", selfReason: "No puede ir adentro de sí misma ni de sus subcarpetas.",
  },
  en: {
    title: "Reason for what is off", multiple: "Allow choosing several", multipleReason: "A block picks a single option.",
    publish: "Publish on WhatsApp", publishReason: "A publication is in progress.", up: "Move Quantity up",
    upReason: "Quantity: position 1 of 3", info: "More about Maximum", infoText: "WhatsApp loads up to 10 items.",
    sample: "As if received by", sampleReason: "Save the form to try it with a person.",
    place: "Where it goes", other: "Purchases", self: "Sales", selfReason: "It cannot go inside itself or its subfolders.",
  },
} as const;
type Lang = keyof typeof copy;

async function open(page: Page, lang: Lang, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`/src/test/visual/index.html?screen=/catalogo&scenario=disabled-reasons&lang=${lang}`);
  const region = page.getByRole("region", { name: copy[lang].title, exact: true });
  await region.scrollIntoViewIfNeeded();
  await page.evaluate(() => document.fonts.ready);
  return region;
}

// To a corner of the zone's band, where nothing has a tooltip: on the way the pointer may cross another control off.
async function away(page: Page, region: Locator) {
  const box = (await region.boundingBox())!;
  await page.mouse.move(box.x + box.width - 8, box.y + 8, { steps: 12 });
  await expect(page.locator('[data-slot="tooltip-content"]')).toHaveCount(0);
}

// The capture takes the zone and some room around it, so a tooltip that goes past its edge is seen whole.
async function evidence(page: Page, region: Locator, name: string) {
  const box = (await region.boundingBox())!, view = page.viewportSize()!;
  const x = Math.max(0, box.x - 160), y = Math.max(0, box.y - 60);
  await page.screenshot({ path: `test-results/${name}.png`, clip: { x, y, width: Math.min(view.width - x, box.width + 320), height: box.height + 80 } });
}

// To the right of a text, still on its row: only the area of the option that stretches over the row is there.
const rightOf = async (target: Locator) => {
  const box = (await target.boundingBox())!;
  return { x: box.x + box.width + 48, y: box.y + box.height / 2 };
};

const center = async (target: Locator) => {
  const box = (await target.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

// The reason opens above its control and over its middle, never next to it.
async function expectReasonAbove(page: Page, control: Locator, reason: string) {
  const tooltip = page.locator('[data-slot="tooltip-content"]');
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText(reason);
  const [box, tip] = [(await control.boundingBox())!, (await tooltip.boundingBox())!];
  expect(tip.y + tip.height).toBeLessThanOrEqual(box.y + 1);
  const middle = box.x + box.width / 2;
  expect(tip.x).toBeLessThanOrEqual(middle);
  expect(tip.x + tip.width).toBeGreaterThanOrEqual(middle);
}

for (const lang of ["es", "en"] as const) {
  test(`what is off says why with the mouse, a click and the keyboard ${lang} at 1440px`, async ({ page }) => {
    const text = copy[lang];
    const region = await open(page, lang, 1440);
    const checkbox = region.getByRole("checkbox", { name: text.multiple, exact: true });
    const label = region.getByText(text.multiple, { exact: true });
    const publish = region.getByRole("button", { name: text.publish, exact: true });
    const before = await publish.boundingBox();

    // The whole box answers: its text shows the reason above the square, and a click on it does not mark it.
    const onText = await center(label);
    await page.mouse.move(onText.x, onText.y);
    await expectReasonAbove(page, checkbox, text.multipleReason);
    await evidence(page, region, `disabled-reasons-text-${lang}-1440`);
    await page.mouse.click(onText.x, onText.y);
    await expectReasonAbove(page, checkbox, text.multipleReason);
    await expect(checkbox).toHaveAttribute("aria-checked", "false");
    // Leaving with the mouse closes it: Radix closes it with a move out of its grace area, so the pointer leaves in steps.
    await away(page, region);

    // A click on the button shows the reason and keeps it open; nothing is added next to it and it does not move.
    const onPublish = await center(publish);
    await page.mouse.click(onPublish.x, onPublish.y);
    await expectReasonAbove(page, publish, text.publishReason);
    expect(await publish.boundingBox()).toEqual(before);
    await evidence(page, region, `disabled-reasons-click-${lang}-1440`);
    await away(page, region);

    // An option of a group answers on its whole row too, like the box: its text shows the reason above the dot and a click
    // there does not choose it; an option that can be chosen is chosen from anywhere on its row.
    await region.getByRole("radiogroup", { name: text.place, exact: true }).scrollIntoViewIfNeeded();
    const self = region.getByRole("radio", { name: text.self, exact: true });
    const onSelf = await center(region.getByText(text.self, { exact: true }));
    await page.mouse.move(onSelf.x, onSelf.y);
    await expectReasonAbove(page, self, text.selfReason);
    await evidence(page, region, `disabled-reasons-option-${lang}-1440`);
    await page.mouse.click(onSelf.x, onSelf.y);
    await expectReasonAbove(page, self, text.selfReason);
    await expect(self).toHaveAttribute("aria-checked", "false");
    const besideSelf = await rightOf(region.getByText(text.self, { exact: true }));
    await page.mouse.move(besideSelf.x, besideSelf.y, { steps: 4 });
    await expectReasonAbove(page, self, text.selfReason);
    await away(page, region);
    const besideOther = await rightOf(region.getByText(text.other, { exact: true }));
    await page.mouse.click(besideOther.x, besideOther.y);
    await expect(region.getByRole("radio", { name: text.other, exact: true })).toHaveAttribute("aria-checked", "true");

    // With the keyboard the control itself takes the focus, after the box, with no stop on a wrapper; Enter shows the
    // reason again and Escape closes it.
    await checkbox.focus();
    await page.keyboard.press("Tab");
    await expect(publish).toBeFocused();
    await expect(publish).toHaveAttribute("aria-disabled", "true");
    await expectReasonAbove(page, publish, text.publishReason);
    await page.keyboard.press("Escape");
    await expect(page.locator('[data-slot="tooltip-content"]')).toHaveCount(0);
    await page.keyboard.press("Enter");
    await expectReasonAbove(page, publish, text.publishReason);
    await page.keyboard.press("Tab");
    await expect(region.getByRole("button", { name: text.up, exact: true })).toBeFocused();
    await expectReasonAbove(page, region.getByRole("button", { name: text.up, exact: true }), text.upReason);

    // A field off is reached by its wrapper, named by the field's label.
    const sample = region.getByRole("group", { name: text.sample, exact: true });
    await sample.focus();
    await expectReasonAbove(page, sample, text.sampleReason);
    await evidence(page, region, `disabled-reasons-field-${lang}-1440`);
  });

  test.describe(() => {
    test.use({ hasTouch: true });

    test(`what is off and the (i) open with a touch ${lang} at 390px`, async ({ page }) => {
      const text = copy[lang];
      const region = await open(page, lang, 390);
      const checkbox = region.getByRole("checkbox", { name: text.multiple, exact: true });

      // Touching the text of the box shows the reason above the square and does not mark it.
      const onText = await center(region.getByText(text.multiple, { exact: true }));
      await page.touchscreen.tap(onText.x, onText.y);
      await expectReasonAbove(page, checkbox, text.multipleReason);
      await expect(checkbox).toHaveAttribute("aria-checked", "false");
      await evidence(page, region, `disabled-reasons-tap-text-${lang}-390`);

      // The button and the (i) open with a touch too; touching outside closes it.
      const publish = region.getByRole("button", { name: text.publish, exact: true });
      const onPublish = await center(publish);
      await page.touchscreen.tap(onPublish.x, onPublish.y);
      await expectReasonAbove(page, publish, text.publishReason);
      await evidence(page, region, `disabled-reasons-tap-button-${lang}-390`);
      const info = region.getByRole("button", { name: text.info, exact: true });
      const onInfo = await center(info);
      await page.touchscreen.tap(onInfo.x, onInfo.y);
      await expectReasonAbove(page, info, text.infoText);
      await evidence(page, region, `disabled-reasons-tap-info-${lang}-390`);
      // Touching the row of an option, beside its text, chooses it; touching the text of one that cannot be chosen shows
      // its reason above the dot, over the option above, and does not choose it.
      await region.getByRole("radiogroup", { name: text.place, exact: true }).scrollIntoViewIfNeeded();
      const besideOther = await rightOf(region.getByText(text.other, { exact: true }));
      await page.touchscreen.tap(besideOther.x, besideOther.y);
      await expect(region.getByRole("radio", { name: text.other, exact: true })).toHaveAttribute("aria-checked", "true");
      const self = region.getByRole("radio", { name: text.self, exact: true });
      const onSelf = await center(region.getByText(text.self, { exact: true }));
      await page.touchscreen.tap(onSelf.x, onSelf.y);
      await expectReasonAbove(page, self, text.selfReason);
      await expect(self).toHaveAttribute("aria-checked", "false");
      await evidence(page, region, `disabled-reasons-tap-option-${lang}-390`);
      const onTitle = await center(region.getByRole("heading", { name: text.title, exact: true }));
      await page.touchscreen.tap(onTitle.x, onTitle.y);
      await expect(page.locator('[data-slot="tooltip-content"]')).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    });
  });
}
