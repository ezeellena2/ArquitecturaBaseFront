import { expect, test } from "@playwright/test";
import { contrastRatio } from "../../shared/lib/appearance";

test.beforeEach(async ({ page }) => {
  await page.route("**/connect/authorize?*", async route => {
    const request = new URL(route.request().url());
    expect(request.searchParams.get("prompt")).toBe("none");
    const callback = new URL(request.searchParams.get("redirect_uri")!);
    callback.searchParams.set("error", "login_required");
    callback.searchParams.set("state", request.searchParams.get("state")!);
    await route.fulfill({ status: 302, headers: { location: callback.href } });
  });
});

for (const language of ["es", "en"] as const) for (const width of [1440, 390, 320]) {
  test(`the public landing keeps access and content usable at ${width}px in ${language}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/src/test/visual/index.html?screen=/&scenario=landing&lang=${language}`);
    const title = language === "es" ? "Tu espacio de trabajo, en un solo lugar." : "Your workspace, all in one place.";
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible({ timeout: 15000 });
    await page.evaluate(() => document.fonts.ready);
    await expect(page.getByRole("article")).toHaveCount(3);
    await expect(page.getByRole("link", { name: language === "es" ? "Crear cuenta" : "Create account", exact: true })).toHaveCount(0);
    const access = page.getByRole("link", { name: language === "es" ? "Iniciar sesión" : "Sign in", exact: true });
    await expect(access).toHaveCount(2);
    for (const link of await access.all()) await expect(link).toHaveAttribute("href", "/login");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
    await expect(page).toHaveScreenshot(`landing-${language}-${width}.png`, { fullPage: true });
    await access.last().focus();
    await expect(access.last()).toBeFocused();
    await page.getByRole("button", { name: language === "es" ? "Inglés" : "Spanish", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: language === "es" ? "Your workspace, all in one place." : "Tu espacio de trabajo, en un solo lugar." })).toBeVisible();
    await page.getByRole("link", { name: language === "es" ? "Sign in" : "Iniciar sesión", exact: true }).last().click();
    await expect(page.getByRole("heading", { level: 1, name: language === "es" ? "Sign in" : "Iniciar sesión", exact: true })).toBeVisible();
  });
}

test("the landing brand keeps readable contrast with a customized dark header", async ({ page }) => {
  await page.goto("/src/test/visual/index.html?screen=/&scenario=dark-palette");
  const brand = page.getByRole("link", { name: "Tu organización", exact: true });
  await expect(brand).toBeVisible({ timeout: 15000 });
  await expect(page.locator("header")).toHaveCSS("--color-surface-header", "#000000");
  const colors = await brand.evaluate(node => ({
    text: getComputedStyle(node).color,
    header: getComputedStyle(node.closest("header")!).backgroundColor,
    initial: getComputedStyle(node.querySelector("span")!).color,
    tile: getComputedStyle(node.querySelector("span")!).backgroundColor,
  }));
  const hex = (color: string) => "#" + color.match(/[\d.]+/g)!.slice(0, 3)
    .map(channel => Math.round(Number(channel) * (color.startsWith("color(srgb") ? 255 : 1)).toString(16).padStart(2, "0")).join("");
  expect(contrastRatio(hex(colors.text), hex(colors.header))).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio(hex(colors.initial), hex(colors.tile))).toBeGreaterThanOrEqual(4.5);
});
