import { expect, test, type Page } from "@playwright/test";
import type { CurrentUser } from "../../auth/useCurrentUser";
import type { Chat, ChatMessage, Outgoing, Thread } from "../../features/whatsapp/api/chat";
import { initialAppearance } from "../../shared/lib/appearance";

// Exercise the real router, OIDC provider and chat components with HTTP-only test doubles.
async function installApi(page: Page, origin: string, permissions: string[], loseSendResponse = false) {
  const now = "2026-10-02T12:10:00Z";
  const profile: CurrentUser = {
    id: "session-admin", displayName: "Operador", email: "operator@example.com", emailConfirmed: true,
    phoneNumber: null, formattedPhoneNumber: null, maskedPhoneNumber: null, phoneNumberConfirmed: false,
    hasGoogleLogin: false, culture: "es", timeZoneId: "America/Argentina/Buenos_Aires", lastLoginAtUtc: null,
    roles: ["User"], permissions,
  };
  const contact: Chat = {
    id: "chat-ana", profileName: "Ana Martínez", phoneNumber: "+54 9 351 555-1234", mode: "Manual", modeRevision: 1,
    lastInboundAtUtc: now, lastInboundSequence: 1, unreadCount: 1, preview: "Hola, ¿tienen stock?", previewPurpose: "Business",
  };
  const messages: ChatMessage[] = [{
    id: "incoming-1", direction: "Inbound", kind: "Text", body: contact.preview, occurredAtUtc: now,
    inboundSequence: 1, operatorUserId: null, status: null, errorCode: null, purpose: "Business",
  }];
  const operations: Outgoing[] = [];
  const sends: { requestId: string; body: string }[] = [];
  const codeRequests: { country?: string; number: string }[] = [];
  let chatReads = 0;
  let signedOut = false;
  let nonce: string | null = null;
  await page.clock.install({ time: new Date(now) });
  await page.route(/^https?:\/\/[^/]+\/(api|account|connect|\.well-known)(\/|\?|$)/, async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const json = (body: unknown, status = 200) => route.fulfill({ status, json: body });
    if (path === "/.well-known/openid-configuration") return json({
      issuer: origin, authorization_endpoint: `${origin}/connect/authorize`, token_endpoint: `${origin}/connect/token`,
      end_session_endpoint: `${origin}/connect/logout`, userinfo_endpoint: `${origin}/connect/userinfo`,
    });
    if (path === "/connect/logout") { signedOut = true; return route.fulfill({ status: 200 }); }
    if (path === "/account/login-methods") return json({ google: false, whatsapp: true, whatsappCountries: ["AR"], registrationOpen: true });
    if (path === "/account/login-code/whatsapp") {
      codeRequests.push(request.postDataJSON());
      return json({ resendAfterSeconds: 60, phone: "+5493515551234", maskedPhone: "+54 9 351 •••• 1234" }, 202);
    }
    if (path === "/account/login-code/verify") return json({ returnUrl: request.postDataJSON().returnUrl });
    if (path === "/connect/authorize") {
      const url = new URL(request.url());
      nonce = url.searchParams.get("nonce");
      const callback = new URL(url.searchParams.get("redirect_uri")!);
      callback.searchParams.set("code", "browser-test-code");
      callback.searchParams.set("state", url.searchParams.get("state")!);
      return route.fulfill({ status: 302, headers: { location: callback.href } });
    }
    if (path === "/connect/token") {
      const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
      const token = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({
        sub: profile.id, iss: origin, aud: "web", exp: 4102444800, iat: 1790943000, ...(nonce ? { nonce } : {}),
      })}.test-signature`;
      return json({ access_token: "browser-test-token", id_token: token, token_type: "Bearer", expires_in: 3600, scope: "openid profile email roles offline_access api" });
    }
    if (path === "/connect/userinfo") return json({ sub: profile.id });
    if (path === "/api/me") return json({ ...profile, displayName: signedOut ? "Operador reingresado" : profile.displayName });
    if (path === "/api/settings/presentation") return json({
      appearance: initialAppearance, defaultCulture: "es", defaultTimeZoneId: profile.timeZoneId,
      defaultPageSize: 20, registrationMode: "Open", revision: 1,
    });
    if (path === "/api/whatsapp/chats") {
      chatReads++;
      return json({ page: { items: [contact], page: 1, pageSize: 20, totalCount: 1, totalPages: 1 }, allCount: 1, unreadCount: contact.unreadCount });
    }
    if (path.endsWith("/read")) { contact.unreadCount = 0; return route.fulfill({ status: 204 }); }
    if (path === "/api/whatsapp/chats/chat-ana/messages") {
      if (request.method() === "POST") {
        const body = request.postDataJSON() as { requestId: string; body: string };
        sends.push(body);
        const operation: Outgoing = {
          ...body, id: body.requestId, operatorUserId: profile.id, requestedAtUtc: now, state: "Pending", waMessageId: null,
        };
        operations.push(operation);
        return loseSendResponse ? route.abort("failed") : json(operation, 202);
      }
      const thread: Thread = { contact, messages, outgoing: operations, beforeAtUtc: null, beforeId: null };
      return json(thread);
    }
    if (path.includes("/outgoing/")) {
      const operation = operations.find(item => path.endsWith(`/${item.requestId}`));
      return operation ? json(operation) : json({ code: "WhatsApp.Chat.NotFound" }, 404);
    }
    throw new Error(`Unexpected browser test request: ${request.method()} ${path}`);
  });
  return {
    sends, codeRequests, contact, reads: () => chatReads,
    deliver() {
      const operation = operations.shift()!;
      messages.push({
        id: operation.id, direction: "Outbound", kind: "Text", body: operation.body, occurredAtUtc: now,
        inboundSequence: 0, operatorUserId: profile.id, status: "Delivered", errorCode: null, purpose: "Business",
      });
    },
  };
}

async function openChat(page: Page) {
  await page.goto("/src/test/visual/session.html?screen=/whatsapp/chat");
  await page.getByRole("button", { name: "Ana Martínez", exact: true }).click();
  return page.getByLabel("Respuesta al cliente", { exact: true });
}

test("manual sending reaches delivered without repeating the request and keeps multiline input", async ({ page, baseURL }) => {
  const api = await installApi(page, baseURL!, ["whatsapp.read", "whatsapp.send"]);
  const input = await openChat(page);
  await expect(input).toBeEnabled();
  await input.fill("Sí, tenemos stock.");
  await input.press("Enter");
  await input.press("End");
  await input.pressSequentially("Podemos coordinar la entrega.");
  await expect(input).toHaveValue("Sí, tenemos stock.\nPodemos coordinar la entrega.");
  expect(api.sends).toHaveLength(0);
  await input.press("Control+Enter");
  await expect(page.getByText("En cola", { exact: true })).toBeVisible();
  await expect(input).toHaveValue("");
  await expect(page.getByRole("button", { name: "Enviar", exact: true })).toBeDisabled();
  expect(api.sends).toHaveLength(1);
  expect(api.sends[0].requestId).toMatch(/^[0-9a-f-]{36}$/);
  api.deliver();
  await page.clock.runFor(6000);
  await expect(page.getByText("Entregado", { exact: true })).toBeVisible();
  await expect(input).toBeEnabled();
  expect(api.sends).toHaveLength(1);
  await page.screenshot({ path: "test-results/visual/whatsapp-flow-delivered.png", fullPage: true });
});

test("a lost send response is queried before allowing another send", async ({ page, baseURL }) => {
  const api = await installApi(page, baseURL!, ["whatsapp.read", "whatsapp.send"], true);
  const input = await openChat(page);
  await input.fill("Respuesta conservada");
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(input).toHaveValue("Respuesta conservada");
  await expect(input).toBeDisabled();
  await page.getByRole("region", { name: "Notificaciones alt+T", exact: true })
    .getByRole("button", { name: "Consultar envío", exact: true }).click();
  await expect(input).toHaveValue("");
  await expect(page.getByText("En cola", { exact: true })).toBeVisible();
  expect(api.sends).toHaveLength(1);
});

test("a read-only operator can open history but cannot compose or send", async ({ page, baseURL }) => {
  const api = await installApi(page, baseURL!, ["whatsapp.read"]);
  const input = await openChat(page);
  await expect(page.getByText("Hola, ¿tienen stock?", { exact: true }).last()).toBeVisible();
  await expect(input).toBeDisabled();
  await expect(page.getByRole("button", { name: "Enviar", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Enviar formulario", exact: true })).toHaveCount(0);
  expect(api.sends).toHaveLength(0);
});

test("an operator without read permission never requests the chat", async ({ page, baseURL }) => {
  const api = await installApi(page, baseURL!, []);
  await Promise.all([
    page.waitForResponse(response => response.request().method() === "GET" && new URL(response.url()).pathname === "/api/me"),
    page.goto("/src/test/visual/session.html?screen=/whatsapp/chat"),
  ]);
  await expect(page).toHaveURL(/\/sin-permiso$/);
  expect(api.reads()).toBe(0);
  expect(api.sends).toHaveLength(0);
});

test("WhatsApp code login completes OIDC while the business conversation remains manual", async ({ page, baseURL }) => {
  const api = await installApi(page, baseURL!, ["whatsapp.read", "whatsapp.send"]);
  await openChat(page);
  await page.getByRole("button", { name: "Menú de Operador", exact: true }).click();
  await page.getByRole("menuitem", { name: "Cerrar sesión" }).click();
  await page.getByRole("button", { name: "WhatsApp", exact: true }).click();
  await page.getByLabel("Número de WhatsApp", { exact: true }).fill("3515551234");
  await page.getByRole("button", { name: /código/i }).click();
  await expect.poll(() => api.codeRequests.length).toBe(1);
  await expect(page).toHaveURL(/\/login\/codigo\?/);
  const boxes = page.getByRole("textbox");
  for (let index = 0; index < 6; index++) await boxes.nth(index).fill("1");
  await Promise.all([
    page.waitForResponse(response => response.request().method() === "POST" && new URL(response.url()).pathname === "/connect/token"),
    page.getByRole("button", { name: /entrar|verificar/i }).click(),
  ]);
  await expect(page).toHaveURL(`${baseURL}/`);
  await expect(page.getByRole("button", { name: "Menú de Operador reingresado", exact: true })).toBeVisible();
  expect(api.contact.mode).toBe("Manual");
  expect(api.sends).toHaveLength(0);
});
