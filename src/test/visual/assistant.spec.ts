import { test, expect } from "@playwright/test";
import { assistantFixtureConversationId } from "./assistantFixtures";
type AssistantTestWindow = Window & {
  assistantTestState: { fail: boolean; reads: number; deletions: number };
};
const scenes = [
  "empty",
  "answer",
  "running",
  "cancel-requested",
  "paused",
  "missing",
  "model",
  "uncertain",
  "failed",
  "blocked",
  "load-error",
] as const;
for (const lang of ["es", "en"] as const)
  for (const width of [1440, 390, 320])
    for (const scene of scenes) {
      test(`assistant ${scene} ${lang} ${width}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.clock.install({ time: new Date("2026-10-04T15:00:00Z") });
        const existing = [
          "answer",
          "running",
          "cancel-requested",
          "uncertain",
          "failed",
          "blocked",
        ].includes(scene);
        const screen = existing
          ? `/?conversacion=${assistantFixtureConversationId}`
          : "/";
        await page.goto(
          `/src/test/visual/index.html?${new URLSearchParams({ screen, lang, scenario: `assistant-${scene}` })}`,
        );
        const label = lang === "es" ? "Tu pregunta" : "Your question";
        if (scene === "blocked")
          await expect(
            page.getByText(
              lang === "es"
                ? "Ya no tenés acceso al contenido de esta conversación"
                : "You no longer have access to this conversation's content",
            ),
          ).toBeVisible();
        else if (scene === "load-error")
          await expect(
            page.getByText(
              lang === "es"
                ? "No pudimos cargar la conversación"
                : "We could not load the conversation",
            ),
          ).toBeVisible();
        else
          await expect(
            page.getByRole("textbox", { name: label, exact: true }),
          ).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await expect(page).toHaveScreenshot(
          `assistant-${scene}-${lang}-${width}.png`,
          { fullPage: true },
        );
        if (scene === "empty") {
          const field = page.getByRole("textbox", { name: label, exact: true });
          await field.fill(
            lang === "es" ? "Borrador privado" : "Private draft",
          );
          if (width < 1024) await page.getByRole("button", { name: lang === "es" ? "Mostrar conversaciones" : "Show conversations", exact: true }).click();
          const trigger = page.getByRole("button", {
            name: lang === "es" ? "Nueva conversación" : "New conversation",
            exact: true,
          });
          await trigger.click();
          const dialog = page.getByRole("dialog", {
            name: lang === "es" ? "¿Empezar otra conversación?" : "Start another conversation?",
            exact: true,
          });
          await expect(dialog).toBeVisible();
          await dialog
            .getByRole("button", {
              name: lang === "es" ? "Seguir editando" : "Keep editing",
              exact: true,
            })
            .click();
          await expect(trigger).toBeFocused();
          if (width < 1024) await page.keyboard.press("Escape");
          await expect(field).toHaveValue(
            lang === "es" ? "Borrador privado" : "Private draft",
          );
          await field.focus();
          await page.keyboard.press("Enter");
          await expect(field).toHaveValue(
            (lang === "es" ? "Borrador privado" : "Private draft") + "\n",
          );
          await page.keyboard.press("Control+Enter");
          await expect(
            page.getByRole("heading", {
              name: lang === "es" ? "Fuentes verificadas" : "Verified sources",
              exact: true,
            }),
          ).toBeVisible();
          await expect(field).toHaveValue("");
        }
        if (scene === "answer") {
          if (width < 1024) {
            const history = page.getByRole("button", { name: lang === "es" ? "Mostrar conversaciones" : "Show conversations", exact: true });
            await history.click();
            await expect(page.getByRole("dialog", { name: lang === "es" ? "Conversaciones" : "Conversations", exact: true })).toBeVisible();
            await page.keyboard.press("Escape");
            await expect(history).toBeFocused();
          } else await expect(page.getByRole("complementary", { name: lang === "es" ? "Conversaciones" : "Conversations", exact: true })).toBeVisible();
          expect(
            await page
              .getByRole("link", {
                name: lang === "es" ? "Abrir fuente" : "Open source",
                exact: true,
              })
              .getAttribute("href"),
          ).toBe("/usuarios");
        }
      });
    }
for (const lang of ["es", "en"] as const)
  test(`assistant recover acceptance and cooldown ${lang}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    const base = `/src/test/visual/index.html?${new URLSearchParams({ screen: "/", lang, scenario: "assistant-acceptance" })}`;
    await page.goto(base);
    const field = page.getByRole("textbox", {
      name: lang === "es" ? "Tu pregunta" : "Your question",
      exact: true,
    });
    await field.fill("Private draft");
    await page
      .getByRole("button", {
        name: lang === "es" ? "Enviar" : "Send",
        exact: true,
      })
      .click();
    await expect(
      page.getByText(
        lang === "es"
          ? "Aceptación por confirmar"
          : "Acceptance awaiting confirmation",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(field).toHaveValue("Private draft");
    await page
      .getByRole("button", {
        name: lang === "es" ? "Consultar estado" : "Check status",
        exact: true,
      })
      .first()
      .click();
    await expect(
      page.getByRole("heading", {
        name: lang === "es" ? "Fuentes verificadas" : "Verified sources",
        exact: true,
      }),
    ).toBeVisible();
    await page.goto(
      `/src/test/visual/index.html?${new URLSearchParams({ screen: "/", lang, scenario: "assistant-429" })}`,
    );
    await field.fill("Wait draft");
    await page
      .getByRole("button", {
        name: lang === "es" ? "Enviar" : "Send",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("button", {
        name: lang === "es" ? "Enviar" : "Send",
        exact: true,
      }),
    ).toBeDisabled();
    await expect(field).toHaveValue("Wait draft");
    await expect(page.locator("[data-sonner-toast]")).toHaveCount(1);
  });

test("assistant preserves reading position and draft on a failed GET, and deletes only after confirmation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto(
    `/src/test/visual/index.html?${new URLSearchParams({ screen: `/?conversacion=${assistantFixtureConversationId}`, lang: "es", scenario: "assistant-scroll" })}`,
  );
  await expect(
    page.getByRole("button", { name: "Cancelar consulta", exact: true }),
  ).toBeVisible();
  const viewport = page.getByLabel("Conversación con el asistente", {
    exact: true,
  });
  await viewport.evaluate((element) => {
    element.scrollTop = 120;
  });
  const readingPosition = await viewport.evaluate(
    (element) => element.scrollTop,
  );
  await expect(
    page.getByText("New confirmed result.", { exact: false }),
  ).toBeVisible();
  expect(
    Math.abs(
      (await viewport.evaluate((element) => element.scrollTop)) -
        readingPosition,
    ),
  ).toBeLessThan(5);
  const field = page.getByRole("textbox", { name: "Tu pregunta", exact: true });
  await field.fill("Borrador que se conserva");
  await page.evaluate((conversationId) => {
    const testWindow = window as unknown as AssistantTestWindow;
    testWindow.assistantTestState = { fail: true, reads: 0, deletions: 0 };
    const fixtureFetch = window.fetch;
    window.fetch = async (input, init) => {
      const path = new URL(
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url,
        location.origin,
      ).pathname;
      const method =
        init?.method ?? (input instanceof Request ? input.method : "GET");
      if (method === "DELETE") testWindow.assistantTestState.deletions++;
      if (
        testWindow.assistantTestState.fail &&
        method === "GET" &&
        path === `/api/ai/assistant/conversations/${conversationId}`
      ) {
        testWindow.assistantTestState.reads++;
        return new Response(
          JSON.stringify({ code: "Unexpected", traceId: "visual-get" }),
          { status: 500, headers: { "content-type": "application/json" } },
        );
      }
      return fixtureFetch(input, init);
    };
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    window.dispatchEvent(new Event("visibilitychange"));
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    window.dispatchEvent(new Event("visibilitychange"));
    Reflect.deleteProperty(document, "visibilityState");
  }, assistantFixtureConversationId);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as AssistantTestWindow).assistantTestState.reads,
      ),
    )
    .toBeGreaterThan(0);
  await expect(field).toHaveValue("Borrador que se conserva");
  await expect(
    page.getByText("New confirmed result.", { exact: false }),
  ).toBeVisible();
  await page.evaluate(() => {
    (window as unknown as AssistantTestWindow).assistantTestState.fail = false;
  });
  await field.fill("");
  await page.getByRole("button", { name: "Mostrar conversaciones", exact: true }).click();
  const rowAction = page.getByRole("button", { name: /^Acciones de / });
  await rowAction.click();
  await page.getByRole("menuitem", { name: "Eliminar conversación", exact: true }).click();
  const confirm = page.getByRole("dialog", {
    name: "¿Eliminar esta conversación?",
    exact: true,
  });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Cancelar", exact: true }).click();
  expect(
    await page.evaluate(
      () =>
        (window as unknown as AssistantTestWindow).assistantTestState.deletions,
    ),
  ).toBe(0);
  await expect(rowAction).toBeFocused();
  await rowAction.click();
  await page.getByRole("menuitem", { name: "Eliminar conversación", exact: true }).click();
  await confirm
    .getByRole("button", { name: "Eliminar conversación", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "¿Qué querés consultar?", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        (window as unknown as AssistantTestWindow).assistantTestState.deletions,
    ),
  ).toBe(1);
});
