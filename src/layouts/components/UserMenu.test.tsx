import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { MemoryRouter } from "react-router";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UserMenu } from "./UserMenu";
import i18n, { changeLanguage, languageStorageKey } from "@/shared/i18n";
import { server } from "@/test/mocks/server";
import { renderWithProviders } from "@/test/utils/renderWithProviders";

const signoutRedirect = vi.fn();

vi.mock("react-oidc-context", async () => {
  const actual = await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context");

  return {
    ...actual,
    useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "t" }, signoutRedirect }),
  };
});

// El menú ahora tiene un enlace a /perfil, y un Link necesita un router alrededor. Alcanza con uno de memoria:
// esto sigue siendo la prueba del menú, no la de la app entera.
function renderMenu() {
  return renderWithProviders(
    <MemoryRouter>
      <UserMenu />
    </MemoryRouter>,
  );
}

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
    vi.restoreAllMocks();
    await changeLanguage("es");
  });

  it("shows the user's name and email", async () => {
    renderMenu();

    await openMenu();

    expect(await screen.findByText("ana@example.com")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /cerrar sesión/i })).toBeInTheDocument();
  });

  it("links to the profile screen", async () => {
    renderMenu();

    await openMenu();

    expect(await screen.findByRole("menuitem", { name: "Mi perfil" })).toHaveAttribute("href", "/perfil");
  });

  it("changes the language and saves it in the profile", async () => {
    const saved: unknown[] = [];
    server.use(
      http.put("/api/me", async ({ request }) => {
        saved.push(await request.json());

        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderMenu();

    await openMenu();
    // "language.en" en español es "Inglés" (el nombre del idioma, no el gentilicio en ese idioma).
    await userEvent.click(await screen.findByRole("menuitemradio", { name: /inglés/i }));

    // Las dos cosas, no una sola: la interfaz cambia y la cuenta queda guardada. El perfil viaja entero
    // porque el PUT lo reemplaza.
    await waitFor(() => expect(i18n.language).toBe("en"));
    await waitFor(() =>
      expect(saved).toEqual([{ displayName: "Ana", culture: "en", timeZoneId: "America/Argentina/Buenos_Aires" }]),
    );
  });

  it("goes back to the previous language when the profile can't be saved", async () => {
    const toastError = vi.spyOn(toast, "error");
    server.use(
      http.put("/api/me", () =>
        HttpResponse.json(
          { status: 500, code: "General.Unexpected", detail: "Ocurrió un error inesperado." },
          { status: 500 },
        ),
      ),
    );

    renderMenu();

    await openMenu();
    await userEvent.click(await screen.findByRole("menuitemradio", { name: /inglés/i }));

    // Primero hay que esperar a que el guardado haya fallado: afirmar el idioma antes pasaría igual, sin haber
    // probado nada, porque arranca en "es".
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("No pudimos guardar el idioma en tu perfil. Probá de nuevo."),
    );
    expect(i18n.language).toBe("es");
    expect(globalThis.localStorage.getItem(languageStorageKey)).toBe("es");
  });

  it("clears the session and calls signoutRedirect when signing out", async () => {
    renderMenu();

    await openMenu();

    await userEvent.click(await screen.findByRole("menuitem", { name: /cerrar sesión/i }));

    expect(signoutRedirect).toHaveBeenCalledTimes(1);
  });
});
