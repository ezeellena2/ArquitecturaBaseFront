import { expect, test } from "@playwright/test";

for (const language of ["es", "en"] as const) {
  test(`the shared message catalog loads delivery labels in ${language} at 320px`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto(`/src/test/visual/index.html?screen=/catalogo&lang=${language}`);
    const examples = page.getByLabel(language === "es" ? "Ejemplos de mensajes" : "Message examples", { exact: true });
    const labels = language === "es"
      ? ["En cola", "Aceptado por WhatsApp", "Entregado", "Leído", "No se pudo enviar", "Envío sin confirmar", "Revisado por el operador", "Estado no informado"]
      : ["Queued", "Accepted by WhatsApp", "Delivered", "Read", "Could not send", "Unconfirmed delivery", "Reviewed by operator", "Status unavailable"];
    for (const label of labels) await expect(examples.getByText(label, { exact: true })).toBeAttached();
    await examples.getByText(labels.at(-1)!, { exact: true }).scrollIntoViewIfNeeded();
    await expect(examples.getByText(labels.at(-1)!, { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(321);
    await page.screenshot({ path: `test-results/visual/message-catalog-${language}-320.png`, fullPage: true });
  });
}

for (const language of ["es", "en"] as const) for (const width of [1440, 390, 320]) {
  test(`WhatsApp chat at ${width}px in ${language} preserves usable history and composer`, async ({ page }) => {
    const text = language === "es" ? { title: "Chat de WhatsApp", reply: "Respuesta al cliente", delivered: "Entregado", send: "Enviar", back: "Chats", incoming: "Mensaje recibido", outgoing: "Mensaje saliente" }
      : { title: "WhatsApp chat", reply: "Reply to customer", delivered: "Delivered", send: "Send", back: "Chats", incoming: "Incoming message", outgoing: "Outgoing message" };
    await page.setViewportSize({ width, height: 900 });
    await page.clock.install({ time: new Date("2026-10-02T12:10:00Z") });
    await page.goto(`/src/test/visual/index.html?screen=/whatsapp/chat&scenario=chat&lang=${language}`);
    await page.getByRole("button", { name: language === "es" ? "Menú de Ana Pérez" : "Ana Pérez's menu", exact: true }).waitFor({ state: "visible" });
    await expect(page.getByRole("heading", { name: text.title })).toBeVisible();
    const menuToggle = page.getByRole("button", { name: language === "es" ? "Menú de navegación" : "Navigation menu", exact: true });
    if (width < 768) await menuToggle.click();
    const navigation = page.getByRole("navigation", { name: language === "es" ? "Navegación principal" : "Main navigation", exact: true });
    const home = navigation.getByRole("link", { name: language === "es" ? "Inicio" : "Home", exact: true });
    await expect(home.locator("svg")).toBeVisible();
    const whatsapp = navigation.getByRole("button", { name: "WhatsApp", exact: true });
    const administration = navigation.getByRole("button", { name: language === "es" ? "Administración" : "Administration", exact: true });
    const separator = await whatsapp.evaluate(element => {
      const group = element.closest("nav > div")!;
      const style = getComputedStyle(group);
      return { width: style.borderTopWidth, color: style.borderTopColor, y: group.getBoundingClientRect().top };
    });
    const adminSeparator = await administration.evaluate(element => {
      const style = getComputedStyle(element.closest("nav > div")!);
      return { width: style.borderTopWidth, color: style.borderTopColor };
    });
    expect(separator.width).toBe("1px");
    expect(separator.color).toBe(adminSeparator.color);
    expect(separator.width).toBe(adminSeparator.width);
    const homeBox = (await home.boundingBox())!;
    expect(separator.y).toBeGreaterThanOrEqual(homeBox.y + homeBox.height);
    expect(separator.y).toBeLessThan((await whatsapp.boundingBox())!.y);
    if (width < 768) await menuToggle.click();
    await page.getByRole("button", { name: "Ana Martínez", exact: true }).click();
    await expect(page.getByLabel(text.reply)).toBeEnabled();
    await expect(page.getByText(text.delivered, { exact: true })).toBeVisible();
    const incoming = page.getByRole("article", { name: text.incoming }).first();
    const outgoing = page.getByRole("article", { name: text.outgoing }).first();
    await expect(incoming.locator(".message-bubble")).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect(outgoing.locator(".message-bubble")).toHaveCSS("background-color", "rgb(217, 239, 205)");
    const boxes = await outgoing.evaluate(node => ({ bubble: node.querySelector(".message-bubble")!.getBoundingClientRect().toJSON(), metadata: node.querySelector(".message-metadata")!.getBoundingClientRect().toJSON() }));
    expect(boxes.metadata.top).toBeGreaterThanOrEqual(boxes.bubble.bottom);
    const inBox = await incoming.boundingBox();
    const outBox = await outgoing.boundingBox();
    expect(outBox!.x + outBox!.width).toBeGreaterThan(inBox!.x + inBox!.width);
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
    await page.getByLabel(text.reply).fill("Respuesta que todavía no envié");
    await expect(page.getByRole("button", { name: text.send, exact: true })).toBeEnabled();
    await page.screenshot({ path: `test-results/visual/whatsapp-${language}-${width}.png`, fullPage: true });
    await expect(page).toHaveScreenshot(`whatsapp-${language}-${width}.png`, { fullPage: true });
    if (width < 768) {
      await page.getByRole("button", { name: text.back, exact: true }).click();
      await expect(page.getByRole("button", { name: "Ana Martínez", exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Ana Martínez", exact: true }).click();
      await expect(page.getByLabel(text.reply)).toHaveValue("Respuesta que todavía no envié");
    }
  });
}

test("delivery details and recovery stay usable at 320px without overwriting the draft", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.clock.install({ time: new Date("2026-10-02T12:10:00Z") });
  await page.goto("/src/test/visual/index.html?screen=/whatsapp/chat&scenario=chat-states");
  await page.getByRole("button", { name: "Ana Martínez", exact: true }).click();
  await expect(page.getByText("Estado no informado", { exact: true })).toBeAttached();
  await expect(page.getByText("Revisado por el operador", { exact: true })).toBeAttached();
  await expect(page.locator('.message-delivery[data-state="read"]')).toHaveCSS("color", "rgb(18, 106, 133)");
  await expect(page.getByLabel("Respuesta al cliente")).toBeDisabled();
  const recover = page.getByRole("button", { name: "Usar este texto en el borrador" }).last();
  await recover.click();
  await expect(page.getByLabel("Respuesta al cliente")).toHaveValue("Pedido anterior 2");
  await expect(page.getByRole("button", { name: "Usar este texto en el borrador" }).first()).toBeDisabled();
  await page.getByRole("button", { name: "Ya revisé el WhatsApp", exact: true }).click();
  await page.getByRole("button", { name: "Confirmar que revisé", exact: true }).click();
  await expect(page.getByLabel("Respuesta al cliente")).toBeEnabled();
  await expect(page.getByLabel("Respuesta al cliente")).toHaveValue("Pedido anterior 2");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(321);
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(page.getByText("En cola", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Enviar", exact: true })).toBeDisabled();
  await page.screenshot({ path: "test-results/visual/whatsapp-states-320.png", fullPage: true });
});

test("history pagination and incoming polling preserve the reading position", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.clock.install({ time: new Date("2026-10-02T12:10:00Z") });
  await page.goto("/src/test/visual/index.html?screen=/whatsapp/chat&scenario=chat-history");
  await page.getByRole("button", { name: "Ana Martínez", exact: true }).click();
  await expect(page.getByText("Mensaje 49", { exact: true })).toBeVisible();
  const viewport = page.getByLabel("Historial de mensajes", { exact: true });
  await viewport.evaluate(node => { node.scrollTop = 0; });
  await expect(page.getByRole("button", { name: "Ir a los mensajes recientes", exact: true })).toBeVisible();
  const anchor = page.getByText("Mensaje 10", { exact: true });
  const before = (await anchor.boundingBox())!.y;
  await page.getByRole("button", { name: "Cargar mensajes anteriores", exact: true }).click();
  await expect(page.getByText("Mensaje 0", { exact: true })).toBeAttached();
  await expect.poll(async () => Math.abs((await anchor.boundingBox())!.y - before)).toBeLessThan(2);
  const scrollBefore = await viewport.evaluate(node => node.scrollTop);
  await page.evaluate(() => {
    const fetch = window.fetch;
    window.fetch = async (input, init) => {
      const response = await fetch(input, init);
      const url = new URL(input instanceof Request ? input.url : String(input), location.origin);
      if (url.pathname === "/api/whatsapp/chats/chat-ana/messages" && !url.searchParams.has("beforeId") && (!init?.method || init.method === "GET")) {
        const thread = await response.json();
        thread.messages.push({ ...thread.messages.at(-1), id: "new-incoming", body: "Nuevo mensaje mientras leo", occurredAtUtc: "2026-10-02T12:10:00Z", inboundSequence: 51 });
        return new Response(JSON.stringify(thread), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return response;
    };
  });
  await page.clock.runFor(5100);
  await expect(page.getByText("Nuevo mensaje mientras leo", { exact: true })).toBeAttached();
  expect(await viewport.evaluate(node => node.scrollTop)).toBeCloseTo(scrollBefore, 0);
  await page.getByRole("button", { name: "Ir a los mensajes recientes", exact: true }).click();
  await expect(page.getByText("Nuevo mensaje mientras leo", { exact: true })).toBeVisible();
});

test("incoming polling during a pending history page preserves the visible message", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.clock.install({ time: new Date("2026-10-02T12:10:00Z") });
  await page.goto("/src/test/visual/index.html?screen=/whatsapp/chat&scenario=chat-history");
  await page.getByRole("button", { name: "Ana Martínez", exact: true }).click();
  await expect(page.getByText("Mensaje 49", { exact: true })).toBeVisible();
  const viewport = page.getByLabel("Historial de mensajes", { exact: true });
  await viewport.evaluate(node => { node.scrollTop = 100; });
  await expect(page.getByRole("button", { name: "Ir a los mensajes recientes", exact: true })).toBeVisible();
  const anchor = page.getByText("Mensaje 10", { exact: true });
  await page.evaluate(() => {
    const fetch = window.fetch;
    window.fetch = async (input, init) => {
      const response = await fetch(input, init);
      const url = new URL(input instanceof Request ? input.url : String(input), location.origin);
      if (url.pathname === "/api/whatsapp/chats/chat-ana/messages") {
        if (url.searchParams.has("beforeId")) await new Promise<void>(resolve => window.addEventListener("release-history", () => resolve(), { once: true }));
        else if (!init?.method || init.method === "GET") {
          const thread = await response.json();
          thread.messages.push({ ...thread.messages.at(-1), id: "incoming-during-history", body: "Llegó mientras cargaba", occurredAtUtc: "2026-10-02T12:10:00Z", inboundSequence: 51 });
          return new Response(JSON.stringify(thread), { status: 200, headers: { "Content-Type": "application/json" } });
        }
      }
      return response;
    };
  });
  await page.getByRole("button", { name: "Cargar mensajes anteriores", exact: true }).click();
  await expect(page.getByRole("button", { name: "Cargar mensajes anteriores", exact: true })).toBeDisabled();
  // Keep reading while the previous page is loading, after clicking scrolled its button into view.
  await viewport.evaluate(node => { node.scrollTop = 100; });
  const before = (await anchor.boundingBox())!.y;
  await page.clock.runFor(5100);
  await expect(page.getByText("Llegó mientras cargaba", { exact: true })).toBeAttached();
  await page.evaluate(() => window.dispatchEvent(new Event("release-history")));
  await expect(page.getByText("Mensaje 0", { exact: true })).toBeAttached();
  await expect.poll(async () => Math.abs((await anchor.boundingBox())!.y - before)).toBeLessThan(2);
});
