import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/auth/useCurrentUser";
import { queryClient } from "@/shared/api/queryClient";
import i18n, { changeLanguage } from "@/shared/i18n";
import { currentUser, phoneOnlyUser } from "@/test/mocks/handlers";
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

const conflictText = "La cuenta cambió mientras la editabas. Volvé a leerla y revisá tus cambios antes de guardar.";

/// Un `/api/me` que el PUT modifica de verdad: es lo que hace que el idioma recién guardado llegue a la
/// interfaz por el mismo camino que en la app (invalidar la consulta → volver a pedirla → aplicarlo). Como el servidor,
/// compara la revisión (N2): con una vieja responde 409, y con la vigente guarda; sólo un nombre distinto la avanza (el idioma
/// y la zona, no). `saved` junta los cuerpos sin la revisión; `account` deja cambiar el perfil como lo haría otra pestaña o
/// un administrador.
function profileHandlers(saved: ProfileBody[], account: { profile: CurrentUser } = { profile: { ...currentUser } }) {
  return [
    http.get("/api/me", () => HttpResponse.json(account.profile)),
    http.put("/api/me", async ({ request }) => {
      const { expectedRevision, ...body } = (await request.json()) as ProfileBody & { expectedRevision: number };

      if (expectedRevision !== account.profile.revision) {
        return HttpResponse.json({ status: 409, code: "Users.User.RevisionConflict", detail: conflictText }, { status: 409 });
      }

      saved.push(body);
      const revision = body.displayName === account.profile.displayName ? account.profile.revision : account.profile.revision + 1;
      account.profile = { ...account.profile, ...body, revision };

      return new HttpResponse(null, { status: 204 });
    }),
  ];
}

// The language (since 2026-11-22) and the time zone go in the shared piece for choosing (DS1-A), the zone with its search
// inside the list: each button names the field and the chosen one.
async function chooseLanguage(field: string, language: string) {
  await userEvent.click(await screen.findByRole("button", { name: new RegExp(`^${field} `) }));
  await userEvent.click(within(await screen.findByRole("listbox", { name: field })).getByRole("option", { name: language }));
}

async function openZones() {
  const trigger = await screen.findByRole("button", { name: /^Zona horaria/ });
  await act(async () => { trigger.focus(); });
  await userEvent.keyboard("{Enter}");
  return screen.findByRole("listbox", { name: "Zona horaria" });
}

/// The option the list opened on, found by the search's active one: naming each of some 420 options is slow.
function activeZone() {
  const search = screen.getByRole("combobox", { name: "Buscar en Zona horaria" });
  return document.getElementById(search.getAttribute("aria-activedescendant") ?? "");
}

async function pickZone(city: string) {
  const list = await openZones();
  await userEvent.type(screen.getByRole("combobox", { name: "Buscar en Zona horaria" }), city);
  await userEvent.click(within(list).getByRole("option", { name: city }));
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
    await pickZone("Montevideo");
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    // Los tres campos viajan siempre, aunque se haya tocado uno: el PUT reemplaza el perfil.
    await waitFor(() =>
      expect(saved).toEqual([{ displayName: "Ana María", culture: "es", timeZoneId: "America/Montevideo" }]),
    );
  });

  // Guardar acts on the whole surface: it goes in the band of «Datos del perfil», level with the title, not in a footer.
  it("saves the profile from the details header", async () => {
    const saved: ProfileBody[] = [];
    server.use(...profileHandlers(saved));

    renderRouteWithProviders("/perfil");

    const details = await screen.findByRole("region", { name: "Datos del perfil" });
    const band = within(details).getByRole("heading", { name: "Datos del perfil" }).parentElement!;
    const save = within(band).getByRole("button", { name: "Guardar" });
    expect(within(details).getAllByRole("button", { name: "Guardar" })).toEqual([save]);

    const name = within(details).getByRole("textbox", { name: "Nombre" });
    await userEvent.clear(name);
    await userEvent.type(name, "Ana María");
    await userEvent.click(save);

    await waitFor(() =>
      expect(saved).toEqual([{ displayName: "Ana María", culture: "es", timeZoneId: currentUser.timeZoneId }]),
    );
  });

  it("says it is saving, and takes no second click, while the profile is on its way", async () => {
    let release = () => {};
    const answered = new Promise<void>((resolve) => {
      release = resolve;
    });
    let puts = 0;
    server.use(
      http.get("/api/me", () => HttpResponse.json(currentUser)),
      http.put("/api/me", async () => {
        puts += 1;
        await answered;

        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderRouteWithProviders("/perfil");

    await userEvent.type(await screen.findByRole("textbox", { name: "Nombre" }), " Pérez");
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    const saving = await screen.findByRole("button", { name: "Guardando…" });
    expect(saving).toHaveAttribute("aria-busy", "true");
    expect(saving).toBeDisabled();
    await userEvent.click(saving);
    expect(puts).toBe(1);

    release();
    // Lo guardado es la base nueva: no queda nada que guardar.
    expect(await screen.findByRole("button", { name: "Guardar" })).toBeDisabled();
  });

  it("does not let the name grow past what the backend accepts", async () => {
    server.use(...profileHandlers([]));

    renderRouteWithProviders("/perfil");

    expect(await screen.findByRole("textbox", { name: "Nombre" })).toHaveAttribute("maxlength", "100");
  });

  it("shows the time zone of the profile even if the browser spells it another way", async () => {
    server.use(...profileHandlers([]));

    renderRouteWithProviders("/perfil");

    // El navegador canoniza esa zona como "America/Buenos_Aires". Si la lista fueran solo las suyas, el
    // campo arrancaría sin nada elegido y guardar le cambiaría la zona horaria a la persona sin avisar.
    expect(await screen.findByRole("button", { name: "Zona horaria Buenos Aires" })).toBeInTheDocument();
    await openZones();
    expect(activeZone()).toHaveAccessibleName("Buenos Aires");
    expect(activeZone()).toHaveAttribute("aria-selected", "true");
  });

  it("switches the interface to the language it just saved", async () => {
    server.use(...profileHandlers([]));

    renderRouteWithProviders("/perfil");

    await chooseLanguage("Idioma", "Inglés");
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    // Sin recargar nada: el perfil guardado vuelve a la caché y de ahí lo toma `useProfileLanguageSync`.
    expect(await screen.findByRole("heading", { name: "My profile" })).toBeInTheDocument();
  });

  it("saves twice in a row with the revision each save left", async () => {
    const saved: ProfileBody[] = [];
    server.use(...profileHandlers(saved));

    renderRouteWithProviders("/perfil");

    const name = await screen.findByRole("textbox", { name: "Nombre" });
    await userEvent.clear(name);
    await userEvent.type(name, "Ana María");
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(saved).toHaveLength(1));
    await waitFor(() => expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled());

    await userEvent.type(name, " Paz");
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(saved.at(-1)).toEqual({ displayName: "Ana María Paz", culture: "es", timeZoneId: currentUser.timeZoneId }));
  });

  it("keeps the draft on a conflict and keeps my changes over what changed elsewhere (N2)", async () => {
    const saved: ProfileBody[] = [];
    const account = { profile: { ...currentUser } };
    server.use(...profileHandlers(saved, account));

    renderRouteWithProviders("/perfil");

    await pickZone("Montevideo");
    const zone = screen.getByRole("button", { name: /^Zona horaria/ });
    // Un administrador le cambió el nombre mientras tanto.
    account.profile = { ...account.profile, displayName: "Ana Paz", revision: 2 };
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText(conflictText)).toBeInTheDocument();
    expect(zone).toHaveAccessibleName("Zona horaria Montevideo");
    const main = within(screen.getByRole("main"));
    expect(main.getByRole("button", { name: "Guardar" })).toHaveAttribute("aria-disabled", "true");

    await userEvent.click(main.getByRole("button", { name: "Revisar valores actuales" }));

    const comparison = await screen.findByRole("region", { name: "Revisar cambios" });
    await waitFor(() => expect(within(comparison).getByRole("heading", { name: "Revisar cambios" })).toHaveFocus());
    // «Mi borrador» es lo que quedaría al conservar: el nombre que cambió el otro y no toqué no se pisa, así que no está.
    expect(within(comparison).getAllByRole("rowheader").map((header) => header.textContent)).toEqual(["Zona horaria"]);
    // La zona se nombra como en su lista, por su ciudad.
    expect(within(comparison).getByRole("cell", { name: "Buenos Aires" })).toBeInTheDocument();
    expect(within(comparison).getByRole("cell", { name: "Montevideo" })).toBeInTheDocument();

    await userEvent.click(within(comparison).getByRole("button", { name: "Conservar mis cambios" }));

    expect(screen.getByRole("textbox", { name: "Nombre" })).toHaveValue("Ana Paz");
    expect(zone).toHaveAccessibleName("Zona horaria Montevideo");
    await userEvent.click(main.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(saved).toEqual([{ displayName: "Ana Paz", culture: "es", timeZoneId: "America/Montevideo" }]));
  });

  it("saves without a comparison when the conflict did not touch the name (N2)", async () => {
    const saved: ProfileBody[] = [];
    const account = { profile: { ...currentUser } };
    server.use(...profileHandlers(saved, account));

    renderRouteWithProviders("/perfil");

    await pickZone("Montevideo");
    // Un administrador le desactivó y volvió a activar la cuenta: avanza la revisión sin tocar lo que el PUT reemplaza.
    account.profile = { ...account.profile, revision: 2 };
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(saved).toEqual([{ displayName: "Ana", culture: "es", timeZoneId: "America/Montevideo" }]));
    expect(screen.queryByText(conflictText)).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Revisar cambios" })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled());
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

    // El idioma de la pantalla tiene que acompañar: antes seguía diciendo "Spanish" con la interfaz ya
    // en inglés, y el primer Guardar mandaba culture: "es" y devolvía la cuenta a español.
    expect(await screen.findByRole("button", { name: "Language English" })).toBeInTheDocument();
    await waitFor(() => expect(saved).toEqual([{ displayName: "Ana", culture: "en", timeZoneId: currentUser.timeZoneId }]));
    // El idioma no avanza la revisión: la pantalla lo sigue aparte, y Guardar no queda prendido por él.
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();

    await userEvent.type(screen.getByRole("textbox", { name: "Name" }), " Paz");
    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toBeEnabled();
    await userEvent.click(save);

    await waitFor(() => expect(saved).toHaveLength(2));
    expect(saved[1]).toEqual({ displayName: "Ana Paz", culture: "en", timeZoneId: currentUser.timeZoneId });
    await waitFor(() => expect(i18n.language).toBe("en"));
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
    expect(await screen.findByText("18/09/2026, 9:00")).toBeInTheDocument();
  });

  it("says there is no last sign-in yet when the account never signed in", async () => {
    server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, lastLoginAtUtc: null })));

    renderRouteWithProviders("/perfil");

    expect(await screen.findByText("Todavía no hay ninguno")).toBeInTheDocument();
  });

  /// Tablero PF1-A: como Configuración, una zona debajo de la otra. Los datos que se editan van primero y en un renglón;
  /// el correo y el último ingreso son datos de los medios de ingreso, no campos.
  it("puts the details first and the sign-in methods, with the last sign-in, below them", async () => {
    server.use(
      http.get("/api/me", () => HttpResponse.json({ ...currentUser, lastLoginAtUtc: "2026-09-18T12:00:00Z" })),
    );

    renderRouteWithProviders("/perfil");

    const detailsZone = await screen.findByRole("region", { name: "Datos del perfil" });
    const methodsZone = screen.getByRole("region", { name: "Medios de ingreso" });
    const details = within(detailsZone);
    const methods = within(methodsZone);

    expect(detailsZone.compareDocumentPosition(methodsZone) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(methods.getByText("ana@example.com")).toBeInTheDocument();
    expect(details.queryByText("ana@example.com")).not.toBeInTheDocument();
    expect(methods.getByText("Último ingreso")).toBeInTheDocument();
    expect(methods.getByText("18/09/2026, 9:00")).toBeInTheDocument();
    expect(details.queryByText("Último ingreso")).not.toBeInTheDocument();

    // Sin leyendas debajo de los campos.
    expect(details.getByRole("textbox", { name: "Nombre" })).not.toHaveAccessibleDescription();
    expect(details.getByRole("button", { name: /^Idioma / })).not.toHaveAccessibleDescription();
    expect(details.getByRole("button", { name: "Zona horaria Buenos Aires" })).not.toHaveAccessibleDescription();
  });

  it("keeps Save off until something changes, and off again when it goes back to what is saved", async () => {
    renderRouteWithProviders("/perfil");

    const name = await screen.findByRole("textbox", { name: "Nombre" });
    const save = screen.getByRole("button", { name: "Guardar" });
    expect(save).toBeDisabled();

    await userEvent.type(name, "s");
    expect(save).toBeEnabled();

    await userEvent.type(name, "{Backspace}");
    expect(save).toBeDisabled();
  });

  /// La lista única de zonas, como en Configuración (DS1-A): la ciudad y, en gris, la hora de su país y el desfase; lo
  /// que se guarda sigue siendo el identificador de IANA.
  it("names the time zone by its city, with the time of its country in grey, and saves its identifier", async () => {
    const saved: ProfileBody[] = [];
    server.use(...profileHandlers(saved));
    renderRouteWithProviders("/perfil");

    expect(await screen.findByRole("button", { name: "Zona horaria Buenos Aires" })).toHaveTextContent("Buenos Aires");
    const list = await openZones();
    expect(activeZone()).toHaveAccessibleDescription(/Argentina · GMT-3$/);

    // The search finds a zone by its country too.
    await userEvent.type(screen.getByRole("combobox", { name: "Buscar en Zona horaria" }), "Urug");
    await userEvent.click(within(list).getByRole("option", { name: "Montevideo" }));
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(saved).toEqual([{ displayName: "Ana", culture: "es", timeZoneId: "America/Montevideo" }]));
  });

  it("opens for an account created with WhatsApp, without an empty email", async () => {
    // Sin correo y sin nombre: la fila del correo invita a agregarlo en vez de mostrar un correo vacío.
    server.use(http.get("/api/me", () => HttpResponse.json({ ...phoneOnlyUser, displayName: null })));

    renderRouteWithProviders("/perfil");

    const details = within(await screen.findByRole("region", { name: "Datos del perfil" }));
    expect(details.getByRole("textbox", { name: "Nombre" })).toHaveValue("");

    const methods = within(screen.getByRole("region", { name: "Medios de ingreso" }));
    expect(methods.getByText("Sin correo")).toBeInTheDocument();
    expect(methods.getByText("+54 9 11 2345-6789")).toBeInTheDocument();
  });
});
