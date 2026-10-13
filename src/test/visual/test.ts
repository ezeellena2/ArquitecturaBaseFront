import { test as base, expect } from "@playwright/test";

// A browser per case prevents accumulated Chromium networking resources from leaking
// across long visual runs. Playwright still applies the project context options and trace hooks.
export const test = base.extend({
  context: async ({ playwright, browserName, launchOptions, headless, channel }, provideContext) => {
    const browser = await playwright[browserName].launch({ ...launchOptions, headless, channel });
    try {
      const context = await browser.newContext();
      try {
        await provideContext(context);
      } finally {
        await context.close();
      }
    } finally {
      await browser.close();
    }
  },
});
export { expect };
export type * from "@playwright/test";
