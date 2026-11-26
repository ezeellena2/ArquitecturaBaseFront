import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import type { AuthContextProps } from "react-oidc-context";
import { afterEach, describe, expect, it, vi } from "vitest";
import i18n, { publicLanguageStorageKey } from "@/shared/i18n";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";

// Nobody is signed in on the access pages.
vi.mock("react-oidc-context", async () => {
  const actual = await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context");
  const auth = { isAuthenticated: false, isLoading: false, user: undefined, signinRedirect: vi.fn(() => Promise.resolve()) };

  return { ...actual, AuthProvider: ({ children }: { children?: ReactNode }) => <>{children}</>, useAuth: () => auth as unknown as AuthContextProps };
});

afterEach(async () => { await i18n.changeLanguage("es"); });

describe("AuthLayout", () => {
  // O50 (2026-11-25): what is chosen, in the standard piece to choose (the front's rule), not two buttons with aria-pressed.
  it("chooses the language of the access pages with the piece to choose, and keeps it for the next visit", async () => {
    renderRouteWithProviders("/login");
    const footer = (await screen.findByRole("contentinfo"));

    expect(within(footer).queryByRole("button", { pressed: true })).not.toBeInTheDocument();
    await userEvent.click(within(footer).getByRole("button", { name: "Idioma Español" }));
    const list = await screen.findByRole("listbox", { name: "Idioma" });
    expect(within(list).getByRole("option", { name: "Español" })).toHaveAttribute("aria-selected", "true");
    await userEvent.click(within(list).getByRole("option", { name: "Inglés" }));

    await waitFor(() => expect(i18n.language).toBe("en"));
    expect(await within(footer).findByRole("button", { name: "Language English" })).toBeInTheDocument();
    expect(globalThis.localStorage.getItem(publicLanguageStorageKey)).toBe("en");
  });
});
