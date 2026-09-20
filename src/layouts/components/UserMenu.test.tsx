import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UserMenu } from "./UserMenu";
import i18n, { changeLanguage } from "@/shared/i18n";
import { renderWithProviders } from "@/test/utils/renderWithProviders";

const signoutRedirect = vi.fn();

vi.mock("react-oidc-context", async () => {
  const actual = await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context");

  return {
    ...actual,
    useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "t" }, signoutRedirect }),
  };
});

// Abrimos el menú con teclado (Enter sobre el trigger enfocado) en vez de con userEvent.click: es lo que pide
// la sección de accesibilidad (navegable con teclado) y evita una descoordinación de userEvent con el
// pointerdown de Radix cuando se abre más de un DropdownMenu en el mismo archivo de test.
async function openMenu() {
  const trigger = await screen.findByRole("button", { name: /ana/i });
  trigger.focus();
  await userEvent.keyboard("{Enter}");

  return trigger;
}

describe("UserMenu", () => {
  afterEach(async () => {
    signoutRedirect.mockClear();
    await changeLanguage("es");
  });

  it("shows the user's name and email", async () => {
    renderWithProviders(<UserMenu />);

    await openMenu();

    expect(await screen.findByText("ana@example.com")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /cerrar sesión/i })).toBeInTheDocument();
  });

  it("switches the language", async () => {
    renderWithProviders(<UserMenu />);

    await openMenu();

    // "language.en" en español es "Inglés" (el nombre del idioma, no el gentilicio en ese idioma).
    await userEvent.click(await screen.findByRole("menuitemradio", { name: /inglés/i }));

    await waitFor(() => expect(i18n.language).toBe("en"));
  });

  it("clears the session and calls signoutRedirect when signing out", async () => {
    renderWithProviders(<UserMenu />);

    await openMenu();

    await userEvent.click(await screen.findByRole("menuitem", { name: /cerrar sesión/i }));

    expect(signoutRedirect).toHaveBeenCalledTimes(1);
  });
});
