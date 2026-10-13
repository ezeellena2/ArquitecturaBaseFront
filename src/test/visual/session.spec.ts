import { expect, test } from "@playwright/test";
import { initialAppearance } from "../../shared/lib/appearance";

for (const screen of ["/", "/usuarios", "/configuracion"]) {
  test(`changing accounts after signing out from ${screen} lands on home`, async ({ page, baseURL }) => {
    const origin = baseURL!;
    let signedOut = false;
    let nonce: string | null = null;
    await page.route(/^https?:\/\/[^/]+\/(api|account|connect|\.well-known)(\/|\?|$)/, async route => {
      const request = route.request();
      const url = new URL(request.url());
      const json = (body: unknown, status = 200) => route.fulfill({ status, json: body });
      if (url.pathname === "/.well-known/openid-configuration") return json({
        issuer: origin, authorization_endpoint: `${origin}/connect/authorize`, token_endpoint: `${origin}/connect/token`,
        end_session_endpoint: `${origin}/connect/logout`, userinfo_endpoint: `${origin}/connect/userinfo`,
      });
      if (url.pathname === "/connect/logout") { signedOut = true; return route.fulfill({ status: 200 }); }
      if (url.pathname === "/account/login-methods") return json({ google: false, whatsapp: false, registrationOpen: true });
      if (url.pathname === "/account/login-code") return json({ resendAfterSeconds: 0 }, 202);
      if (url.pathname === "/account/login-code/verify") return json({ returnUrl: request.postDataJSON().returnUrl });
      if (url.pathname === "/connect/authorize") {
        nonce = url.searchParams.get("nonce");
        const callback = new URL(url.searchParams.get("redirect_uri")!);
        callback.searchParams.set("code", "session-test-code");
        callback.searchParams.set("state", url.searchParams.get("state")!);
        return route.fulfill({ status: 302, headers: { location: callback.href } });
      }
      if (url.pathname === "/connect/token") {
        const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
        const idToken = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({
          sub: "session-member", iss: origin, aud: "web", exp: 4102444800, iat: Math.floor(Date.now() / 1000), ...(nonce ? { nonce } : {}),
        })}.test-signature`;
        return json({ access_token: "session-member", id_token: idToken, token_type: "Bearer", expires_in: 3600, scope: "openid profile email roles offline_access api" });
      }
      if (url.pathname === "/connect/userinfo") return json({ sub: "session-member" });
      if (url.pathname === "/api/me") return json({
        id: signedOut ? "session-member" : "session-admin", displayName: signedOut ? "Member" : "Admin", email: signedOut ? "member@example.com" : "admin@example.com",
        emailConfirmed: true, phoneNumber: null, formattedPhoneNumber: null, maskedPhoneNumber: null, phoneNumberConfirmed: false,
        hasGoogleLogin: false, culture: "es", timeZoneId: "America/Argentina/Buenos_Aires", lastLoginAtUtc: null,
        roles: signedOut ? ["User"] : ["Admin"], permissions: signedOut ? [] : ["users.read", "users.manage", "settings.manage"],
      });
      const settings = { appearance: initialAppearance, defaultCulture: "es", defaultTimeZoneId: "America/Argentina/Buenos_Aires", defaultPageSize: 20, registrationMode: "Open", revision: 1 };
      if (url.pathname === "/api/settings/presentation" || url.pathname === "/api/settings") return json(settings);
      if (url.pathname === "/api/users/filter-counts") return json({ status: { all: 0, active: 0, inactive: 0 }, roles: [], createdWithin: [] });
      if (url.pathname === "/api/roles") return json([]);
      if (url.pathname === "/api/users") return json({ items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 0, hasPrevious: false, hasNext: false });
      throw new Error(`Missing session fixture: ${request.method()} ${url.pathname}`);
    });
    await page.goto(`/src/test/visual/session.html?screen=${encodeURIComponent(screen)}`);
    await page.getByRole("button", { name: "Menú de Admin", exact: true }).click();
    await page.getByRole("menuitem", { name: "Cerrar sesión" }).click();
    await page.getByLabel("Correo electrónico", { exact: true }).fill("member@example.com");
    const destination = await page.evaluate(() => {
      const returnUrl = new URLSearchParams(location.search).get("returnUrl")!;
      const state = new URL(returnUrl, location.origin).searchParams.get("state");
      return JSON.parse(sessionStorage.getItem(`oidc.${state}`)!).data.returnTo;
    });
    expect(destination).toBe("/");
    await page.getByRole("button", { name: /código/i }).click();
    const boxes = page.getByRole("textbox");
    for (let index = 0; index < 6; index++) await boxes.nth(index).fill("1");
    // El callback carga otro documento; preparar el canje sin esperar el destino que se verifica abajo.
    await Promise.all([
      page.waitForResponse(response => response.request().method() === "POST" && new URL(response.url()).pathname === "/connect/token"),
      page.getByRole("button", { name: /entrar|verificar/i }).click(),
    ]);
    await expect(page).toHaveURL(`${origin}/`);
    await expect(page.getByRole("heading", { name: "Inicio", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Menú de Member", exact: true })).toBeVisible();
    await expect(page.getByText("No tenés permiso", { exact: true })).toHaveCount(0);
  });
}
