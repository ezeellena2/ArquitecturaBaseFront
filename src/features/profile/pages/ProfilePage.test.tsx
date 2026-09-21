import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queryClient } from "@/shared/api/queryClient";
import { changeLanguage } from "@/shared/i18n";
import { currentUser } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";

vi.mock("react-oidc-context", async () => {
  const actual = await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context");

  return { ...actual, useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "t" } }) };
});

interface ProfileBody {
  displayName: string | null;
  culture: string;
  timeZoneId: string;
}

/// Un `/api/me` que el PUT modifica de verdad: es lo que hace que el idioma recién guardado llegue a la
/// interfaz por el mismo camino que en la app (invalidar la consulta → volver a pedirla → aplicarlo).
function profileHandlers(saved: ProfileBody[]) {
  let profile = { ...currentUser };

  return [
    http.get("/api/me", () => HttpResponse.json(profile)),
    http.put("/api/me", async ({ request }) => {
      const body = (await request.json()) as ProfileBody;
      saved.push(body);
      profile = { ...profile, ...body };

      return new HttpResponse(null, { status: 204 });
    }),
  ];
}

describe("ProfilePage", () => {
  beforeEach(() => {
    queryClient.clear();
  });

  afterEach(async () => {
    await changeLanguage("es");
  });

  it("saves the name, the language and the time zone together", async () => {
    const saved: ProfileBody[] = [];
    server.use(...profileHandlers(saved));

    renderRouteWithProviders("/perfil");

    const name = await screen.findByRole("textbox", { name: "Nombre" });

    // El perfil no está en el menú lateral, pero las migas tienen que decir dónde está parada la persona.
    const breadcrumbs = screen.getByRole("navigation", { name: "Migas de pan" });
    expect(within(breadcrumbs).getByText("Mi perfil")).toBeInTheDocument();

    await userEvent.clear(name);
    await userEvent.type(name, "Ana María");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Zona horaria" }), "America/Montevideo");
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    // Los tres campos viajan siempre, aunque se haya tocado uno: el PUT reemplaza el perfil.
    await waitFor(() =>
      expect(saved).toEqual([{ displayName: "Ana María", culture: "es", timeZoneId: "America/Montevideo" }]),
    );
  });

  it("shows the time zone of the profile even if the browser spells it another way", async () => {
    server.use(...profileHandlers([]));

    renderRouteWithProviders("/perfil");

    // El navegador canoniza esa zona como "America/Buenos_Aires". Si la lista fueran solo las suyas, el
    // desplegable arrancaría sin nada elegido y guardar le cambiaría la zona horaria a la persona sin avisar.
    expect(await screen.findByRole("combobox", { name: "Zona horaria" })).toHaveValue(
      "America/Argentina/Buenos_Aires",
    );
  });

  it("switches the interface to the language it just saved", async () => {
    server.use(...profileHandlers([]));

    renderRouteWithProviders("/perfil");

    await userEvent.selectOptions(await screen.findByRole("combobox", { name: "Idioma" }), "en");
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    // Sin recargar nada: el perfil guardado vuelve a la caché y de ahí lo toma `useProfileLanguageSync`.
    expect(await screen.findByRole("heading", { name: "My profile" })).toBeInTheDocument();
  });

  it("follows the language when it is changed from the user menu, instead of reverting it on save", async () => {
    const saved: ProfileBody[] = [];
    server.use(...profileHandlers(saved));

    renderRouteWithProviders("/perfil");

    await screen.findByRole("textbox", { name: "Nombre" });

    // El idioma se cambia desde el menú del usuario, sin salir de la pantalla.
    const trigger = await screen.findByRole("button", { name: /ana/i });
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.click(await screen.findByRole("menuitemradio", { name: /inglés/i }));

    // El desplegable de la pantalla tiene que acompañar: antes seguía diciendo "Spanish" con la interfaz ya
    // en inglés, y el primer Guardar mandaba culture: "es" y devolvía la cuenta a español.
    const language = await screen.findByRole("combobox", { name: "Language" });
    await waitFor(() => expect(language).toHaveValue("en"));

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(saved.at(-1)).toEqual({
        displayName: "Ana",
        culture: "en",
        timeZoneId: "America/Argentina/Buenos_Aires",
      }),
    );
  });

  it("shows the message of the field the backend rejected, without losing what was typed", async () => {
    server.use(
      http.get("/api/me", () => HttpResponse.json(currentUser)),
      http.put("/api/me", () =>
        HttpResponse.json(
          {
            status: 400,
            code: "Validation.Failed",
            detail: "Revisá los datos ingresados.",
            errors: { displayName: ["El nombre no puede tener más de 128 caracteres."] },
          },
          { status: 400 },
        ),
      ),
    );

    renderRouteWithProviders("/perfil");

    const name = await screen.findByRole("textbox", { name: "Nombre" });
    await userEvent.clear(name);
    await userEvent.type(name, "Ana Larga");
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("El nombre no puede tener más de 128 caracteres.");
    // Lo escrito sigue ahí: el formulario no se recarga del perfil después de un error.
    expect(screen.getByRole("textbox", { name: "Nombre" })).toHaveValue("Ana Larga");
  });

  it("shows the last sign-in in the profile's time zone", async () => {
    server.use(
      http.get("/api/me", () => HttpResponse.json({ ...currentUser, lastLoginAtUtc: "2026-09-18T12:00:00Z" })),
    );

    renderRouteWithProviders("/perfil");

    // El perfil de prueba está en America/Argentina/Buenos_Aires: 12:00 UTC son las 9:00. Va acá y no en el
    // tablero (que va vacío a propósito): es un dato de la cuenta, y la cuenta se mira en su pantalla.
    expect(await screen.findByText("18 sept 2026, 9:00")).toBeInTheDocument();
  });

  it("says there is no last sign-in yet when the account never signed in", async () => {
    server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, lastLoginAtUtc: null })));

    renderRouteWithProviders("/perfil");

    expect(await screen.findByText("Todavía no hay ninguno.")).toBeInTheDocument();
  });
});
