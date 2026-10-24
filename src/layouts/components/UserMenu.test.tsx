import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { HttpResponse, http } from "msw";
import { MemoryRouter, RouterProvider, createMemoryRouter } from "react-router";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UserMenu } from "./UserMenu";
import { useUnsavedChangesGuard } from "@/shared/hooks/useUnsavedChangesGuard";
import i18n, { changeLanguage, languageStorageKey } from "@/shared/i18n";
import { phoneOnlyUser } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import { renderWithProviders } from "@/test/utils/renderWithProviders";

const { endServerSession, removeUser } = vi.hoisted(() => ({ endServerSession: vi.fn(), removeUser: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/auth/accessRequests", async () => ({ ...await vi.importActual("@/auth/accessRequests"), endServerSession }));

vi.mock("react-oidc-context", async () => {
  const actual = await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context");

  return {
    ...actual,
    useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "t", id_token: "identity-token" }, removeUser }),
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

// Una pantalla con cambios sin guardar junto al menú. `remountsOnLanguageChange` es la de un editor cuya clave
// lleva la cultura, que pierde lo escrito al cambiar el idioma.
function DirtyScreen({ remountsOnLanguageChange }: { remountsOnLanguageChange: boolean }) {
  useUnsavedChangesGuard(true, { remountsOnLanguageChange });

  return <h1>Pantalla con cambios</h1>;
}

function renderMenuWith(page: ReactElement) {
  const router = createMemoryRouter([{ path: "/", element: <><UserMenu />{page}</> }]);

  return renderWithProviders(<RouterProvider router={router} />);
}

// Los perfiles que el menú guarda con PUT /api/me.
function captureProfileSaves(): unknown[] {
  const saved: unknown[] = [];
  server.use(
    http.put("/api/me", async ({ request }) => {
      saved.push(await request.json());

      return new HttpResponse(null, { status: 204 });
    }),
  );

  return saved;
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
    endServerSession.mockReset();
    removeUser.mockClear();
    vi.restoreAllMocks();
    await changeLanguage("es");
  });

  it("shows the user's name and email", async () => {
    renderMenu();

    await openMenu();

    expect(await screen.findByText("ana@example.com")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /cerrar sesión/i })).toBeInTheDocument();
  });

  it("names an account without email nor name by its number, formatted for reading", async () => {
    // Una cuenta creada desde WhatsApp: `/api/me` trae el correo y el nombre en null. El número nunca en E.164.
    server.use(http.get("/api/me", () => HttpResponse.json({ ...phoneOnlyUser, displayName: null })));
    renderMenu();

    const trigger = await screen.findByRole("button", { name: "Menú de +54 9 11 2345-6789" });
    // El avatar va primero: su inicial es la primera cifra del número, no el "+".
    expect(trigger).toHaveTextContent(/^5Menú de/);

    trigger.focus();
    await userEvent.keyboard("{Enter}");

    // Una sola vez: sin nombre, el número va en el renglón del nombre y el de abajo no lo repite.
    expect(await screen.findByText("+54 9 11 2345-6789")).toBeInTheDocument();
    expect(screen.queryByText("+5491123456789")).not.toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /cerrar sesión/i })).toBeInTheDocument();
  });

  it("shows the number where the email would go when the account has a name but no email", async () => {
    server.use(http.get("/api/me", () => HttpResponse.json(phoneOnlyUser)));
    renderMenu();

    await openMenu();

    expect(await screen.findByText("+54 9 11 2345-6789")).toBeInTheDocument();
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

  it("asks before changing the menu language while an editor that remounts with it has unsaved changes", async () => {
    // Los editores cuya clave lleva la cultura se vuelven a montar en el idioma nuevo: cambiarlo sin preguntar
    // perdería lo escrito.
    const saved = captureProfileSaves();
    renderMenuWith(<DirtyScreen remountsOnLanguageChange />);

    await openMenu();
    await userEvent.click(await screen.findByRole("menuitemradio", { name: /inglés/i }));

    const dialog = await screen.findByRole("dialog", { name: "¿Descartar los cambios?" });
    expect(i18n.language).toBe("es");
    await userEvent.click(within(dialog).getByRole("button", { name: "Seguir editando" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(i18n.language).toBe("es");
    expect(saved).toEqual([]);

    await openMenu();
    await userEvent.click(await screen.findByRole("menuitemradio", { name: /inglés/i }));
    await userEvent.click(within(await screen.findByRole("dialog", { name: "¿Descartar los cambios?" })).getByRole("button", { name: "Descartar cambios" }));

    await waitFor(() => expect(i18n.language).toBe("en"));
    await waitFor(() =>
      expect(saved).toEqual([{ displayName: "Ana", culture: "en", timeZoneId: "America/Argentina/Buenos_Aires" }]),
    );
  });

  it("changes the language without asking when the screen with unsaved changes keeps them in the new language", async () => {
    // Roles, Configuración o el chat no se vuelven a montar con el idioma: lo escrito sigue ahí, no hay nada que descartar.
    const saved = captureProfileSaves();
    renderMenuWith(<DirtyScreen remountsOnLanguageChange={false} />);

    await openMenu();
    await userEvent.click(await screen.findByRole("menuitemradio", { name: /inglés/i }));

    await waitFor(() => expect(i18n.language).toBe("en"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(saved).toEqual([{ displayName: "Ana", culture: "en", timeZoneId: "America/Argentina/Buenos_Aires" }]),
    );
  });

  it("does nothing when the chosen language is the one the menu already has, even with unsaved changes", async () => {
    // Radix avisa también al elegir el ítem que ya está marcado: no hay idioma que cambiar ni cambios que descartar.
    const saved = captureProfileSaves();
    renderMenuWith(<DirtyScreen remountsOnLanguageChange />);

    await openMenu();
    await userEvent.click(await screen.findByRole("menuitemradio", { name: /español/i }));

    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(i18n.language).toBe("es");
    expect(saved).toEqual([]);
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
      expect(toastError).toHaveBeenCalledWith("No pudimos guardar el idioma en tu perfil. Probá de nuevo.", expect.objectContaining({ id: expect.any(String), closeButton: true, duration: 10000 })),
    );
    expect(i18n.language).toBe("es");
    expect(globalThis.localStorage.getItem(languageStorageKey)).toBe("es");
  });

  it("ends the server session before removing the user without a document redirect", async () => {
    renderMenu();

    await openMenu();

    await userEvent.click(await screen.findByRole("menuitem", { name: /cerrar sesión/i }));

    await waitFor(() => expect(removeUser).toHaveBeenCalled());
    expect(endServerSession).toHaveBeenCalledWith("identity-token");
  });
});
