import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { queryClient } from "@/shared/api/queryClient";

vi.mock("react-oidc-context", async () => {
  const actual = await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context");

  return { ...actual, useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "t" } }) };
});

// Simula una pantalla chica (sección 7.2 del spec, <768px): la sidebar pasa a ser un cajón deslizable.
function mockMobileViewport() {
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        matches: query.includes("max-width"),
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList,
  );
}

describe("Topbar", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    queryClient.clear();
  });

  it("announces whether the mobile drawer is open and closes it with Escape", async () => {
    mockMobileViewport();
    renderRouteWithProviders("/");

    const toggle = await screen.findByRole("button", { name: /menú de navegación/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    await userEvent.keyboard("{Escape}");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });
});
