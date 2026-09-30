import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { adminHandlers, ana, carla, detailOf, juan, laura, pageOf } from "../testData";
import { userQueryKey, type LastInvitation, type UserDetail, type UserListItem } from "../api/users";
import { loginMethodsQueryKey, type LoginMethods } from "@/shared/api/loginMethods";
import { queryClient } from "@/shared/api/queryClient";
import { currentUser, loginMethods, whatsappLoginMethods } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";

vi.mock("react-oidc-context", async () => {
  const actual = await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context");

  return { ...actual, useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "t" } }) };
});

const onlyMethodWarning =
  "Es su único medio de ingreso. Si lo desvinculás, no va a poder entrar hasta que le cargues otro.";
const unverifiedHint = "Lo que carga un admin queda «Sin verificar» hasta que la persona entra con eso.";

/// Laura, como la dibuja el tablero "Editar usuario · B": entró con WhatsApp, y el correo se lo cargó un admin y
/// todavía no lo usó.
const invitedLaura: UserListItem = { ...laura, email: "laura.rios@gmail.com", phoneNumberConfirmed: true };

/// El listado con una sola persona, su detalle, los medios de ingreso y la edición, que guarda lo que recibió.
function withUser(
  user: UserListItem,
  detail: UserDetail = detailOf(user),
  methods: LoginMethods = whatsappLoginMethods,
  respond: () => Response | Promise<Response> = () => new HttpResponse(null, { status: 204 }),
) {
  const updates: unknown[] = [];

  server.use(
    ...adminHandlers([user]),
    http.get("/account/login-methods", () => HttpResponse.json(methods)),
    http.get(`/api/users/${user.id}`, () => HttpResponse.json(detail)),
    http.put(`/api/users/${user.id}`, async ({ request }) => {
      updates.push(await request.json());

      return respond();
    }),
  );

  return updates;
}

function problem(status: number, body: Record<string, unknown>) {
  return () => HttpResponse.json({ status, ...body }, { status });
}

/// Abre "Editar usuario" desde la fila, con el detalle y los medios de ingreso ya cargados.
async function openEdit(identifier: string) {
  renderRouteWithProviders("/usuarios");

  await userEvent.click(await screen.findByRole("button", { name: `Editar a ${identifier}` }));
  const dialog = await screen.findByRole("dialog", { name: "Editar usuario" });
  await within(dialog).findByRole("textbox", { name: "Nombre" });
  await waitFor(() => expect(queryClient.getQueryState(loginMethodsQueryKey)?.status).toBe("success"));

  return within(dialog);
}

/// La caja "Medios de ingreso" del diálogo.
function methodsOf(dialog: ReturnType<typeof within>) {
  return within(dialog.getByRole("region", { name: "Medios de ingreso" }));
}

/// La fila de un medio: el correo es la primera y WhatsApp, la segunda. Si la fila no está, falla: buscar en toda la
/// página haría pasar un "en su fila" con el campo dibujado en cualquier lado.
function rowOf(dialog: ReturnType<typeof within>, index: number) {
  const rows = methodsOf(dialog).getAllByRole("listitem");
  const row = rows.at(index);
  if (row === undefined) {
    throw new Error(`Expected a login method row at index ${index}, but the list has ${rows.length}.`);
  }

  return within(row);
}

async function pickRole(name: string) {
  const combo = await screen.findByRole("button", { name: "Roles" });
  combo.focus();
  await userEvent.keyboard("{Enter}");
  await userEvent.click(await screen.findByRole("menuitemcheckbox", { name: new RegExp(`^${name}`) }));
  await userEvent.keyboard("{Escape}");
}

describe("UserEditDialog", () => {
  beforeEach(() => {
    queryClient.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends a verification code when linking the signed-in user's number from administration", async () => {
    const self = { ...carla, phoneNumber: null, formattedPhoneNumber: null, maskedPhoneNumber: null };
    withUser(self);
    const requests: unknown[] = [];
    server.use(
      http.get("/api/me", () => HttpResponse.json({ ...currentUser, id: self.id, permissions: ["users.read", "users.manage"] })),
      http.post("/api/me/whatsapp/code", async ({ request }) => {
        requests.push(await request.json());
        return HttpResponse.json({ phone: "+5491123456789", maskedPhone: "+54 9 11 •••• 6789", resendAfterSeconds: 60 }, { status: 202 });
      }),
    );
    const dialog = await openEdit(self.email!);
    await userEvent.click(dialog.getByRole("button", { name: "Agregar número" }));
    const verification = await screen.findByRole("dialog", { name: "Vincular WhatsApp" });
    await userEvent.type(within(verification).getByRole("textbox", { name: "Número de WhatsApp" }), "11 2345-6789");
    await userEvent.click(within(verification).getByRole("button", { name: "Enviar código" }));
    expect(await within(verification).findByRole("group", { name: "Código" })).toBeInTheDocument();
    expect(requests).toEqual([{ country: "AR", number: "11 2345-6789" }]);
  });

  it("offers verification for the signed-in user's previously saved unverified number", async () => {
    const self = { ...juan, phoneNumberConfirmed: false };
    withUser(self);
    server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, id: self.id, permissions: ["users.read", "users.manage"] })));
    const dialog = await openEdit(self.formattedPhoneNumber!);
    await userEvent.click(dialog.getByRole("button", { name: "Verificar" }));
    const verification = await screen.findByRole("dialog", { name: "Vincular WhatsApp" });
    expect(within(verification).getByRole("textbox", { name: "Número de WhatsApp" })).toHaveValue(self.phoneNumber);
  });

  it("opens from Editar with the name, the roles and the login methods", async () => {
    withUser(juan);

    const dialog = await openEdit("+54 9 11 2345-6789");

    // Debajo del título, a quién se está editando.
    expect(screen.getByRole("dialog", { name: "Editar usuario" })).toHaveAccessibleDescription("Juan Gómez");
    expect(dialog.getByRole("textbox", { name: "Nombre" })).toHaveValue("Juan Gómez");
    expect(dialog.getByRole("button", { name: "Roles" })).toBeInTheDocument();
    expect(dialog.getByRole("region", { name: "Medios de ingreso" })).toBeInTheDocument();
    expect(dialog.getByRole("button", { name: "Guardar" })).toBeInTheDocument();
  });

  it("does not let the name grow past what the backend accepts", async () => {
    withUser(juan);

    const dialog = await openEdit("+54 9 11 2345-6789");

    expect(dialog.getByRole("textbox", { name: "Nombre" })).toHaveAttribute("maxlength", "100");
  });

  describe("the login methods", () => {
    it("shows each method as a row with its value, its badge and its action", async () => {
      withUser(invitedLaura, detailOf(invitedLaura, { emailConfirmed: false }));

      const dialog = await openEdit("laura.rios@gmail.com");

      // Tablero B, punto 1: qué es, su valor, la insignia en su columna y la acción con su texto.
      expect(methodsOf(dialog).getAllByRole("listitem")).toHaveLength(2);

      const email = rowOf(dialog, 0);
      expect(email.getByText("Correo electrónico")).toBeInTheDocument();
      expect(email.getByText("laura.rios@gmail.com")).toBeInTheDocument();
      // La explicación de "Sin verificar" está a la vista, al pie de la caja, y la insignia la lleva como descripción.
      expect(email.getByText("Sin verificar")).toHaveAccessibleDescription(unverifiedHint);
      expect(email.queryByRole("button")).not.toBeInTheDocument();

      const whatsApp = rowOf(dialog, 1);
      expect(whatsApp.getByText("WhatsApp")).toBeInTheDocument();
      expect(whatsApp.getByText("+54 9 351 555-1234")).toBeInTheDocument();
      expect(whatsApp.getByText("Verificado")).toBeInTheDocument();
      // El botón dice su medio y a quién: "Desvincular" solo, entre varias filas, no dice qué se desvincula.
      expect(whatsApp.getByRole("button", { name: "Desvincular el WhatsApp de Laura Ríos" })).toHaveTextContent(
        "Desvincular",
      );

      expect(methodsOf(dialog).queryByRole("status")).not.toBeInTheDocument();
    });

    it("shows an account without email, with its number verified and the warning that it is the only way in", async () => {
      withUser(juan);

      const dialog = await openEdit("+54 9 11 2345-6789");
      const methods = methodsOf(dialog);

      const email = rowOf(dialog, 0);
      expect(email.getByText("Sin correo")).toBeInTheDocument();
      expect(email.getByRole("button", { name: "Agregar correo" })).toHaveTextContent("Agregar correo");

      const whatsApp = rowOf(dialog, 1);
      expect(whatsApp.getByText("+54 9 11 2345-6789")).toBeInTheDocument();
      expect(whatsApp.getByText("Verificado")).toBeInTheDocument();
      expect(whatsApp.getByRole("button", { name: "Desvincular el WhatsApp de Juan Gómez" })).toBeInTheDocument();

      expect(methods.getByRole("status")).toHaveTextContent(onlyMethodWarning);
      // Nada está sin verificar: no hay nada que explicar (tablero B, punto 2).
      expect(methods.queryByText(unverifiedHint)).not.toBeInTheDocument();
    });

    it("says that a number the admin loaded is not verified, and explains it", async () => {
      withUser(laura);

      const dialog = await openEdit("+54 9 351 555-1234");
      const whatsApp = rowOf(dialog, 1);

      expect(whatsApp.getByText("+54 9 351 555-1234")).toBeInTheDocument();
      expect(whatsApp.getByText("Sin verificar")).toHaveAccessibleDescription(unverifiedHint);
      expect(whatsApp.queryByText("Verificado")).not.toBeInTheDocument();
      expect(methodsOf(dialog).getByRole("status")).toHaveTextContent(onlyMethodWarning);
    });

    it("shows the email with whether it is verified, and does not warn when there is one", async () => {
      withUser(carla, detailOf(carla, { emailConfirmed: false }));

      const methods = methodsOf(await openEdit("carla@example.com"));

      expect(methods.getByText("carla@example.com")).toBeInTheDocument();
      expect(methods.getByText("Sin verificar")).toBeInTheDocument();
      expect(methods.getByText("Verificado")).toBeInTheDocument();
      expect(methods.queryByText(onlyMethodWarning)).not.toBeInTheDocument();
      expect(methods.queryByRole("button", { name: "Agregar correo" })).not.toBeInTheDocument();
    });

    it("offers to add a number when WhatsApp is on", async () => {
      withUser(ana);

      const dialog = await openEdit("ana@example.com");
      const whatsApp = rowOf(dialog, 1);

      expect(whatsApp.getByText("Sin número")).toBeInTheDocument();
      expect(whatsApp.getByRole("button", { name: "Agregar número" })).toHaveTextContent("Agregar número");
    });

    it("does not offer to add a number when WhatsApp is off", async () => {
      withUser(ana, detailOf(ana), loginMethods);

      const methods = methodsOf(await openEdit("ana@example.com"));

      expect(methods.getAllByRole("listitem")).toHaveLength(1);
      expect(methods.queryByText("Sin número")).not.toBeInTheDocument();
      expect(methods.queryByRole("button", { name: "Agregar número" })).not.toBeInTheDocument();
    });

    it("still shows a number to unlink when WhatsApp is off", async () => {
      withUser(juan, detailOf(juan), loginMethods);

      const methods = methodsOf(await openEdit("+54 9 11 2345-6789"));

      expect(methods.getByText("+54 9 11 2345-6789")).toBeInTheDocument();
      expect(methods.getByRole("button", { name: "Desvincular el WhatsApp de Juan Gómez" })).toBeInTheDocument();
    });

    it("opens the email in its own row, focused and explained, and keeps the warning until saving", async () => {
      withUser(juan);

      const dialog = await openEdit("+54 9 11 2345-6789");
      await userEvent.click(dialog.getByRole("button", { name: "Agregar correo" }));

      // Tablero B, punto 3: la fila se abre en su campo, con el foco puesto; la ayuda de "Sin verificar" va con él.
      const email = rowOf(dialog, 0).getByRole("textbox", { name: "Correo electrónico" });
      expect(email).toHaveFocus();
      expect(email).toHaveAccessibleDescription(unverifiedHint);
      expect(methodsOf(dialog).getByRole("status")).toHaveTextContent(onlyMethodWarning);
    });
  });

  describe("saving", () => {
    it("saves the roles of a user without erasing the name, and sends nothing else", async () => {
      const updates = withUser(ana, detailOf(ana, { roles: ["User"] }));

      const dialog = await openEdit("ana@example.com");
      await pickRole("Admin");
      await userEvent.click(dialog.getByRole("button", { name: "Guardar" }));

      // El PUT reemplaza nombre y roles: el nombre que ya tenía tiene que volver tal cual. El correo y el número no
      // cambian, así que no viajan.
      await waitFor(() => expect(updates).toEqual([{ displayName: "Ana", roles: ["User", "Admin"] }]));
    });

    it("says it is saving and turns the button off meanwhile", async () => {
      let release: () => void = () => {};
      const answered = new Promise<void>((resolve) => {
        release = resolve;
      });
      withUser(ana, detailOf(ana), whatsappLoginMethods, async () => {
        await answered;

        return new HttpResponse(null, { status: 204 });
      });

      const dialog = await openEdit("ana@example.com");
      await userEvent.click(dialog.getByRole("button", { name: "Guardar" }));

      expect(await dialog.findByRole("button", { name: "Guardando…" })).toBeDisabled();

      release();
      await waitFor(() => expect(screen.queryByRole("dialog", { name: "Editar usuario" })).not.toBeInTheDocument());
    });

    it("adds an email in the same dialog and sends it", async () => {
      const updates = withUser(juan);

      const dialog = await openEdit("+54 9 11 2345-6789");
      await userEvent.click(dialog.getByRole("button", { name: "Agregar correo" }));

      // El botón se fue: el foco pasa al campo nuevo, no a <body>.
      const email = dialog.getByRole("textbox", { name: "Correo electrónico" });
      expect(email).toHaveFocus();

      await userEvent.type(email, "juan@example.com");
      await userEvent.click(dialog.getByRole("button", { name: "Guardar" }));

      await waitFor(() =>
        expect(updates).toEqual([{ displayName: "Juan Gómez", roles: ["User"], email: "juan@example.com" }]),
      );
    });

    it("adds a number in the same dialog and sends it with its country", async () => {
      const updates = withUser(ana);

      const dialog = await openEdit("ana@example.com");
      await userEvent.click(dialog.getByRole("button", { name: "Agregar número" }));

      const number = rowOf(dialog, 1).getByRole("textbox", { name: "Número de WhatsApp" });
      expect(number).toHaveFocus();
      expect(number).toHaveAccessibleDescription(unverifiedHint);
      expect(dialog.getByRole("combobox", { name: "País: Argentina, +54" })).toBeInTheDocument();

      await userEvent.type(number, "11 2345-6789");
      await userEvent.click(dialog.getByRole("button", { name: "Guardar" }));

      await waitFor(() =>
        expect(updates).toEqual([
          { displayName: "Ana", roles: ["Admin"], phone: { country: "AR", number: "11 2345-6789" } },
        ]),
      );
    });

    it("sends the country the admin picked for the number", async () => {
      const updates = withUser(ana);

      const dialog = await openEdit("ana@example.com");
      await userEvent.click(dialog.getByRole("button", { name: "Agregar número" }));
      // Con teclado, como los demás desplegables de Radix en los tests (ver UserMenu.test.tsx).
      dialog.getByRole("combobox", { name: "País: Argentina, +54" }).focus();
      await userEvent.keyboard("{Enter}");
      await userEvent.click(await screen.findByRole("option", { name: "Uruguay, +598" }));
      await userEvent.type(dialog.getByRole("textbox", { name: "Número de WhatsApp" }), "94 123 456");
      await userEvent.click(dialog.getByRole("button", { name: "Guardar" }));

      await waitFor(() =>
        expect(updates).toEqual([{ displayName: "Ana", roles: ["Admin"], phone: { country: "UY", number: "94 123 456" } }]),
      );
    });

    describe("when the account gets the method while the dialog is open", () => {
      // La persona lo vincula desde su perfil, u otro admin se lo carga, y el detalle se vuelve a consultar (al volver a
      // la pestaña, por ejemplo). El campo que se había abierto se va, y lo que quedó escrito en él no puede viajar:
      // el backend reemplazaría el número verificado por uno sin verificar, y un error sobre él no tendría dónde verse.
      const linked = {
        ...ana,
        phoneNumber: "+5491155550000",
        phoneNumberConfirmed: true,
        formattedPhoneNumber: "+54 9 11 5555-0000",
      };

      it("does not send a number that is no longer on screen", async () => {
        let hasPhone = false;
        const updates = withUser(ana);
        server.use(http.get(`/api/users/${ana.id}`, () => HttpResponse.json(detailOf(hasPhone ? linked : ana))));

        const dialog = await openEdit("ana@example.com");
        await userEvent.click(dialog.getByRole("button", { name: "Agregar número" }));
        await userEvent.type(dialog.getByRole("textbox", { name: "Número de WhatsApp" }), "11 5555-0000");

        hasPhone = true;
        await act(() => queryClient.invalidateQueries({ queryKey: userQueryKey(ana.id) }));

        expect(await methodsOf(dialog).findByText("+54 9 11 5555-0000")).toBeInTheDocument();
        expect(dialog.queryByRole("textbox", { name: "Número de WhatsApp" })).not.toBeInTheDocument();

        await userEvent.click(dialog.getByRole("button", { name: "Guardar" }));

        await waitFor(() => expect(updates).toEqual([{ displayName: "Ana", roles: ["Admin"] }]));
      });

      it("does not send an email that is no longer on screen", async () => {
        let hasEmail = false;
        const updates = withUser(juan);
        server.use(
          http.get(`/api/users/${juan.id}`, () =>
            HttpResponse.json(detailOf(hasEmail ? { ...juan, email: "juan@example.com" } : juan)),
          ),
        );

        const dialog = await openEdit("+54 9 11 2345-6789");
        await userEvent.click(dialog.getByRole("button", { name: "Agregar correo" }));
        await userEvent.type(dialog.getByRole("textbox", { name: "Correo electrónico" }), "otro@example.com");

        hasEmail = true;
        await act(() => queryClient.invalidateQueries({ queryKey: userQueryKey(juan.id) }));

        expect(await methodsOf(dialog).findByText("juan@example.com")).toBeInTheDocument();
        expect(dialog.queryByRole("textbox", { name: "Correo electrónico" })).not.toBeInTheDocument();

        await userEvent.click(dialog.getByRole("button", { name: "Guardar" }));

        await waitFor(() => expect(updates).toEqual([{ displayName: "Juan Gómez", roles: ["User"] }]));
      });
    });

    it("gives the focus back to the row's Editar after adding an email, though the row is named by it now", async () => {
      let saved = false;
      withUser(juan);
      // Aparte y después: dentro de un mismo `server.use`, gana el primero que coincide, y `withUser` ya trae su propio
      // `/api/users` y su PUT.
      server.use(
        http.get("/api/users", () =>
          HttpResponse.json(pageOf([saved ? { ...juan, email: "juan@example.com" } : juan])),
        ),
        http.put(`/api/users/${juan.id}`, () => {
          saved = true;

          return new HttpResponse(null, { status: 204 });
        }),
      );

      const dialog = await openEdit("+54 9 11 2345-6789");
      await userEvent.click(dialog.getByRole("button", { name: "Agregar correo" }));
      await userEvent.type(dialog.getByRole("textbox", { name: "Correo electrónico" }), "juan@example.com");
      await userEvent.click(dialog.getByRole("button", { name: "Guardar" }));

      // La fila ahora se nombra por el correo. El botón que abrió el diálogo tiene que seguir siendo el mismo: si no,
      // el foco cae en <body> y el siguiente Tab arranca desde el principio de la página.
      await waitFor(() => expect(screen.queryByRole("dialog", { name: "Editar usuario" })).not.toBeInTheDocument());
      await waitFor(() => expect(screen.getByRole("button", { name: "Editar a juan@example.com" })).toHaveFocus());
    });

    it("does not send an email field that was opened and left empty", async () => {
      const updates = withUser(juan);

      const dialog = await openEdit("+54 9 11 2345-6789");
      await userEvent.click(dialog.getByRole("button", { name: "Agregar correo" }));
      await userEvent.click(dialog.getByRole("button", { name: "Guardar" }));

      await waitFor(() => expect(updates).toEqual([{ displayName: "Juan Gómez", roles: ["User"] }]));
    });

    it("puts an email of another account under the email, and keeps what was written", async () => {
      withUser(
        juan,
        detailOf(juan),
        whatsappLoginMethods,
        problem(409, { code: "Users.User.AlreadyExists", detail: "Ese correo ya tiene cuenta." }),
      );

      const dialog = await openEdit("+54 9 11 2345-6789");
      await userEvent.click(dialog.getByRole("button", { name: "Agregar correo" }));
      const email = dialog.getByRole("textbox", { name: "Correo electrónico" });
      await userEvent.type(email, "ana@example.com");
      await userEvent.click(dialog.getByRole("button", { name: "Guardar" }));

      await waitFor(() => expect(email).toHaveAccessibleDescription("Ya existe una cuenta con ese correo."));
      expect(email).toHaveValue("ana@example.com");
      expect(screen.getByRole("dialog", { name: "Editar usuario" })).toBeInTheDocument();
    });

    it("puts a number of another account under the number", async () => {
      withUser(
        ana,
        detailOf(ana),
        whatsappLoginMethods,
        problem(409, { code: "Users.Phone.AlreadyExists", detail: "Ese número ya tiene cuenta." }),
      );

      const dialog = await openEdit("ana@example.com");
      await userEvent.click(dialog.getByRole("button", { name: "Agregar número" }));
      const number = dialog.getByRole("textbox", { name: "Número de WhatsApp" });
      await userEvent.type(number, "11 2345-6789");
      await userEvent.click(dialog.getByRole("button", { name: "Guardar" }));

      await waitFor(() => expect(number).toHaveAccessibleDescription("Ya existe una cuenta con ese número."));
    });

    it("puts a number that is not a mobile under the number", async () => {
      withUser(
        ana,
        detailOf(ana),
        whatsappLoginMethods,
        problem(400, { code: "Users.Phone.Invalid", detail: "El número no es válido." }),
      );

      const dialog = await openEdit("ana@example.com");
      await userEvent.click(dialog.getByRole("button", { name: "Agregar número" }));
      const number = dialog.getByRole("textbox", { name: "Número de WhatsApp" });
      await userEvent.type(number, "123");
      await userEvent.click(dialog.getByRole("button", { name: "Guardar" }));

      await waitFor(() => expect(number).toHaveAccessibleDescription("Ingresá un número de celular válido."));
    });

    it("explains the protection rule above the buttons", async () => {
      withUser(
        ana,
        detailOf(ana),
        whatsappLoginMethods,
        problem(409, { code: "Users.User.LastAdmin", detail: "Tiene que quedar un administrador." }),
      );

      const dialog = await openEdit("ana@example.com");
      await userEvent.click(dialog.getByRole("button", { name: "Guardar" }));

      expect(await dialog.findByRole("alert")).toHaveTextContent(
        "No podés dejar al sistema sin administradores. Asigná el rol Admin a otra cuenta activa y volvé a intentar.",
      );
    });

    it("explains the error and offers to retry when the user detail cannot be loaded", async () => {
      server.use(
        ...adminHandlers([ana]),
        http.get("/api/users/1", () =>
          HttpResponse.json(
            { status: 404, code: "Users.User.NotFound", detail: "No encontramos la cuenta." },
            { status: 404 },
          ),
        ),
      );

      renderRouteWithProviders("/usuarios");

      await userEvent.click(await screen.findByRole("button", { name: "Editar a ana@example.com" }));

      // Pasa de verdad con dos administradores a la vez: uno elimina la cuenta y el otro abre el diálogo desde
      // un listado viejo. Antes quedaban dos bloques grises para siempre, sin mensaje ni reintento.
      const dialog = await screen.findByRole("dialog");
      expect(await within(dialog).findByRole("alert")).toHaveTextContent("No encontramos la cuenta.");
      expect(within(dialog).getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
    });
  });

  describe("the last invitation", () => {
    // La hora queda quieta: la espera para reenviar se cuenta desde la hora de la invitación, y el texto tiene que dar
    // siempre el mismo número. Solo se congela `Date`; los timers siguen siendo los de verdad.
    const now = new Date("2026-09-24T14:05:15Z");

    /// Una invitación por WhatsApp del 22/9 a las 10:42 de Buenos Aires, la zona del perfil de los tests.
    function invitation(overrides: Partial<LastInvitation> = {}): LastInvitation {
      return { channel: "WhatsApp", sentAtUtc: "2026-09-22T13:42:00Z", deliveryStatus: "Delivered", ...overrides };
    }

    /// El reenvío, que guarda lo que recibió. Después de uno aceptado, el detalle trae la invitación nueva, pendiente.
    function withResend(
      user: UserListItem,
      detail: UserDetail,
      respond: () => Response | Promise<Response> = () => new HttpResponse(null, { status: 202 }),
    ) {
      const sent: unknown[] = [];
      let accepted = false;
      withUser(user, detail);
      server.use(
        http.get(`/api/users/${user.id}`, () =>
          HttpResponse.json(
            accepted
              ? { ...detail, lastInvitation: invitation({ sentAtUtc: now.toISOString(), deliveryStatus: "Pending" }) }
              : detail,
          ),
        ),
        http.post(`/api/users/${user.id}/invitation`, async ({ request }) => {
          sent.push(await request.json());
          const response = await respond();
          accepted ||= response.status === 202;

          return response;
        }),
      );

      return sent;
    }

    function stripOf(dialog: ReturnType<typeof within>) {
      return within(dialog.getByRole("region", { name: "Última invitación" }));
    }

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(now);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("does not show anything when the account was never invited from here", async () => {
      withUser(juan);

      const dialog = await openEdit("+54 9 11 2345-6789");

      expect(dialog.queryByRole("region", { name: "Última invitación" })).not.toBeInTheDocument();
      expect(dialog.queryByRole("button", { name: "Reenviar invitación" })).not.toBeInTheDocument();
    });

    it("shows a delivered invitation by WhatsApp apart from the methods, with its date and status", async () => {
      withUser(invitedLaura, detailOf(invitedLaura, { lastInvitation: invitation() }));

      const dialog = await openEdit("laura.rios@gmail.com");
      const strip = stripOf(dialog);

      expect(strip.getByText("Invitación por WhatsApp")).toBeInTheDocument();
      expect(strip.getByText(/22 sept 2026, 10:42/)).toBeInTheDocument();
      expect(strip.getByText("Entregada")).toBeInTheDocument();
      expect(strip.getByRole("button", { name: "Reenviar invitación" })).toBeEnabled();
      // Es un envío, no un medio de ingreso: va debajo de la caja, no adentro.
      expect(methodsOf(dialog).queryByText("Invitación por WhatsApp")).not.toBeInTheDocument();
    });

    it.each([
      ["Pending", "Pendiente"],
      ["Sent", "Enviada"],
      ["Read", "Leída"],
    ] as const)("says a WhatsApp invitation that is %s", async (deliveryStatus, text) => {
      withUser(invitedLaura, detailOf(invitedLaura, { lastInvitation: invitation({ deliveryStatus }) }));

      const strip = stripOf(await openEdit("laura.rios@gmail.com"));

      expect(strip.getByText(text)).toBeInTheDocument();
    });

    it("says why an invitation did not arrive, and still waits the minute before resending it", async () => {
      // "No llegó" junta dos casos que el detalle no distingue: la cola no la tomó (el backend no hace esperar) o el
      // webhook de Meta avisó que falló, como el 131049 del límite de marketing (el backend sí hace esperar, y ese es el
      // caso común). Ofrecerla enseguida terminaría en un 429: se espera el minuto, como con cualquier otra.
      withUser(
        invitedLaura,
        detailOf(invitedLaura, {
          lastInvitation: invitation({ sentAtUtc: "2026-09-24T14:05:00Z", deliveryStatus: "Failed" }),
        }),
      );

      const strip = stripOf(await openEdit("laura.rios@gmail.com"));

      expect(strip.getByText("No llegó")).toBeInTheDocument();
      expect(
        strip.getByText("WhatsApp no la entregó: puede ser el límite de mensajes de Meta o un rechazo."),
      ).toBeInTheDocument();
      const resend = strip.getByRole("button", { name: "Reenviar invitación" });
      expect(resend).toBeDisabled();
      expect(resend).toHaveAccessibleDescription("Podés reenviar en 45 s");
    });

    it("shows only the date of an invitation by email, which has no delivery status", async () => {
      withUser(
        invitedLaura,
        detailOf(invitedLaura, { lastInvitation: invitation({ channel: "Email", deliveryStatus: null }) }),
      );

      const strip = stripOf(await openEdit("laura.rios@gmail.com"));

      expect(strip.getByText("Invitación por correo")).toBeInTheDocument();
      expect(strip.getByText("22 sept 2026, 10:42")).toBeInTheDocument();
      for (const status of ["Pendiente", "Enviada", "Entregada", "Leída", "No llegó"]) {
        expect(strip.queryByText(status)).not.toBeInTheDocument();
      }
    });

    it("says an invitation by email did not go out, the same way as one by WhatsApp, and why", async () => {
      // Por correo no hay estado que seguir, salvo uno: la cola de correo no la tomó (el backend dice `Failed`).
      withUser(
        invitedLaura,
        detailOf(invitedLaura, { lastInvitation: invitation({ channel: "Email", deliveryStatus: "Failed" }) }),
      );

      const strip = stripOf(await openEdit("laura.rios@gmail.com"));

      expect(strip.getByText("Invitación por correo")).toBeInTheDocument();
      expect(strip.getByText("No llegó")).toBeInTheDocument();
      expect(strip.getByText("El correo no salió: no pudimos mandarlo en ese momento.")).toBeInTheDocument();
      // La explicación de WhatsApp no corresponde: no fue Meta.
      expect(strip.queryByText(/WhatsApp no la entregó/)).not.toBeInTheDocument();
    });

    it.each([
      [
        "offers WhatsApp when it is on and there is a number",
        whatsappLoginMethods,
        "Por correo no salió. Podés probar de nuevo o mandarla por WhatsApp.",
      ],
      ["does not offer WhatsApp when it is off", loginMethods, "Por correo no salió. Podés probar de nuevo."],
    ] as const)("says why it is resending one by email that did not go out: %s", async (_, methods, text) => {
      withUser(
        invitedLaura,
        detailOf(invitedLaura, { lastInvitation: invitation({ channel: "Email", deliveryStatus: "Failed" }) }),
        methods,
      );

      const dialog = await openEdit("laura.rios@gmail.com");
      await userEvent.click(stripOf(dialog).getByRole("button", { name: "Reenviar invitación" }));

      const panel = within(dialog.getByRole("region", { name: "Reenviar la invitación" }));
      expect(panel.getByText(text)).toBeInTheDocument();
      expect(panel.queryByText(/Por WhatsApp no llegó/)).not.toBeInTheDocument();
    });

    it("waits a minute from the time of the last invitation before offering to resend it", async () => {
      withUser(
        invitedLaura,
        detailOf(invitedLaura, {
          lastInvitation: invitation({ sentAtUtc: "2026-09-24T14:05:00Z", deliveryStatus: "Pending" }),
        }),
      );

      const strip = stripOf(await openEdit("laura.rios@gmail.com"));

      const resend = strip.getByRole("button", { name: "Reenviar invitación" });
      expect(resend).toBeDisabled();
      expect(resend).toHaveAccessibleDescription("Podés reenviar en 45 s");
    });

    it("counts down by itself and turns Reenviar invitación back on when the minute is over", async () => {
      withUser(
        invitedLaura,
        detailOf(invitedLaura, {
          lastInvitation: invitation({ sentAtUtc: "2026-09-24T14:05:00Z", deliveryStatus: "Pending" }),
        }),
      );

      const strip = stripOf(await openEdit("laura.rios@gmail.com"));
      const resend = strip.getByRole("button", { name: "Reenviar invitación" });
      expect(resend).toHaveAccessibleDescription("Podés reenviar en 45 s");

      // La cuenta mira la hora en cada vuelta: se adelanta la hora y se espera la vuelta siguiente, que es de verdad.
      vi.setSystemTime(new Date(now.getTime() + 3_000));
      await waitFor(() => expect(resend).toHaveAccessibleDescription("Podés reenviar en 42 s"), { timeout: 2_500 });

      vi.setSystemTime(new Date(now.getTime() + 45_000));
      await waitFor(() => expect(resend).toBeEnabled(), { timeout: 2_500 });
      expect(strip.queryByText(/Podés reenviar/)).not.toBeInTheDocument();
    });

    it("counts the minute with this machine's clock when it is behind the server's", async () => {
      // El reloj de la máquina va tres minutos atrasado: la invitación de recién parece del futuro. La espera es de un
      // minuto desde que llegó el detalle, y cuenta: no se queda en 60 s mientras dure el atraso.
      withUser(
        invitedLaura,
        detailOf(invitedLaura, {
          lastInvitation: invitation({ sentAtUtc: "2026-09-24T14:08:05Z", deliveryStatus: "Pending" }),
        }),
      );

      const strip = stripOf(await openEdit("laura.rios@gmail.com"));
      const resend = strip.getByRole("button", { name: "Reenviar invitación" });
      expect(resend).toHaveAccessibleDescription("Podés reenviar en 60 s");

      vi.setSystemTime(new Date(now.getTime() + 3_000));
      await waitFor(() => expect(resend).toHaveAccessibleDescription("Podés reenviar en 57 s"), { timeout: 2_500 });

      vi.setSystemTime(new Date(now.getTime() + 60_000));
      await waitFor(() => expect(resend).toBeEnabled(), { timeout: 2_500 });
    });

    it("keeps counting after a turn that finds the clock where it was", async () => {
      // La hora del servidor trae fracciones, así que la espera no cae en un segundo justo: la primera vuelta llega a
      // los 50 ms. Con la hora quieta la encuentra donde estaba, como en un navegador que redondea la hora (Firefox
      // con resistFingerprinting) o con la máquina cargada entre el render y el `setSystemTime` de un test. Esa vuelta
      // no cambia el número, pero tiene que dejar armada la siguiente: si no, la cuenta se queda quieta para siempre.
      withUser(
        invitedLaura,
        detailOf(invitedLaura, {
          lastInvitation: invitation({ sentAtUtc: "2026-09-24T14:05:00.050Z", deliveryStatus: "Pending" }),
        }),
      );

      const strip = stripOf(await openEdit("laura.rios@gmail.com"));
      const resend = strip.getByRole("button", { name: "Reenviar invitación" });
      expect(resend).toHaveAccessibleDescription("Podés reenviar en 46 s");

      await act(() => new Promise<void>((resolve) => setTimeout(resolve, 200)));

      vi.setSystemTime(new Date(now.getTime() + 3_000));
      await waitFor(() => expect(resend).toHaveAccessibleDescription("Podés reenviar en 43 s"));
    });

    describe("resending it", () => {
      it("opens in place with the channel and the consent, and sends what was chosen", async () => {
        const toastSuccess = vi.spyOn(toast, "success");
        const sent = withResend(
          invitedLaura,
          detailOf(invitedLaura, { lastInvitation: invitation({ deliveryStatus: "Failed" }) }),
        );

        const dialog = await openEdit("laura.rios@gmail.com");
        await userEvent.click(stripOf(dialog).getByRole("button", { name: "Reenviar invitación" }));

        // Sin otro diálogo: la franja se abre en el lugar (tablero B, punto 4).
        expect(screen.getAllByRole("dialog")).toHaveLength(1);
        const panel = within(dialog.getByRole("region", { name: "Reenviar la invitación" }));
        expect(
          panel.getByText(
            "Por WhatsApp no llegó: puede ser el límite de Meta o un rechazo. Podés probar de nuevo o mandarla por correo.",
          ),
        ).toBeInTheDocument();

        const channels = panel.getByRole("radiogroup", { name: "Por dónde" });
        const byEmail = within(channels).getByRole("radio", { name: "Por correo" });
        const byWhatsApp = within(channels).getByRole("radio", { name: "Por WhatsApp" });
        expect(byEmail).toHaveAccessibleDescription("laura.rios@gmail.com");
        expect(byWhatsApp).toHaveAccessibleDescription("+54 9 351 555-1234");
        // Arranca en el canal de la última, con el foco puesto.
        expect(byWhatsApp).toBeChecked();
        expect(byWhatsApp).toHaveFocus();

        const consent = panel.getByRole("checkbox", {
          name: "Laura aceptó recibir mensajes por WhatsApp.",
        });
        expect(consent).not.toBeChecked();
        expect(consent).toHaveAccessibleDescription("Sin esto, WhatsApp no permite escribirle primero.");

        await userEvent.click(consent);
        await userEvent.click(panel.getByRole("button", { name: "Reenviar la invitación" }));

        await waitFor(() => expect(sent).toEqual([{ channel: "WhatsApp", consent: true }]));
        await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Reenviamos la invitación."));

        // Vuelve la franja, con la invitación nueva pendiente y un minuto de espera.
        const strip = stripOf(dialog);
        expect(await strip.findByText("Pendiente")).toBeInTheDocument();
        expect(strip.getByText(/24 sept 2026, 11:05/)).toBeInTheDocument();
        const resend = strip.getByRole("button", { name: "Reenviar invitación" });
        expect(resend).toBeDisabled();
        expect(resend).toHaveAccessibleDescription("Podés reenviar en 60 s");
        // El botón apagado no toma el foco: lo toma la franja, que dice qué pasó.
        expect(dialog.getByRole("region", { name: "Última invitación" })).toHaveFocus();
      });

      it("sends it by email without asking for the consent", async () => {
        const sent = withResend(invitedLaura, detailOf(invitedLaura, { lastInvitation: invitation() }));

        const dialog = await openEdit("laura.rios@gmail.com");
        await userEvent.click(stripOf(dialog).getByRole("button", { name: "Reenviar invitación" }));
        const panel = within(dialog.getByRole("region", { name: "Reenviar la invitación" }));
        await userEvent.click(panel.getByRole("radio", { name: "Por correo" }));

        expect(panel.queryByRole("checkbox")).not.toBeInTheDocument();

        await userEvent.click(panel.getByRole("button", { name: "Reenviar la invitación" }));

        await waitFor(() => expect(sent).toEqual([{ channel: "Email", consent: false }]));
      });

      it("turns off the channel the account cannot use, and says why", async () => {
        withUser(laura, detailOf(laura, { lastInvitation: invitation() }));

        const dialog = await openEdit("+54 9 351 555-1234");
        await userEvent.click(stripOf(dialog).getByRole("button", { name: "Reenviar invitación" }));
        const panel = within(dialog.getByRole("region", { name: "Reenviar la invitación" }));

        const byEmail = panel.getByRole("radio", { name: "Por correo" });
        expect(byEmail).toBeDisabled();
        expect(byEmail).toHaveAccessibleDescription("Cargá un correo para usar esta opción.");
        expect(panel.getByRole("radio", { name: "Por WhatsApp" })).toBeChecked();
      });

      it("puts the missing consent under the checkbox and stays open", async () => {
        const toastError = vi.spyOn(toast, "error");
        const sent = withResend(
          invitedLaura,
          detailOf(invitedLaura, { lastInvitation: invitation() }),
          problem(400, {
            code: "Users.Invitation.ConsentRequired",
            detail: "Confirmá que la persona aceptó recibir mensajes por WhatsApp.",
            errors: { consent: ["Confirmá que la persona aceptó recibir mensajes por WhatsApp."] },
          }),
        );

        const dialog = await openEdit("laura.rios@gmail.com");
        await userEvent.click(stripOf(dialog).getByRole("button", { name: "Reenviar invitación" }));
        const panel = within(dialog.getByRole("region", { name: "Reenviar la invitación" }));
        // Sin marcar la casilla: el que la exige es el backend.
        await userEvent.click(panel.getByRole("button", { name: "Reenviar la invitación" }));

        await waitFor(() => expect(sent).toEqual([{ channel: "WhatsApp", consent: false }]));
        const consent = panel.getByRole("checkbox", { name: /aceptó recibir mensajes/ });
        await waitFor(() =>
          expect(consent).toHaveAccessibleDescription(
            "Sin esto, WhatsApp no permite escribirle primero. Confirmá que la persona aceptó recibir mensajes por WhatsApp.",
          ),
        );
        expect(consent).toBeInvalid();
        expect(toastError).not.toHaveBeenCalled();

        // Marcarla saca el error.
        await userEvent.click(consent);
        expect(consent).toBeValid();
      });

      it("explains in the panel that the name has to be saved first", async () => {
        withResend(
          invitedLaura,
          detailOf(invitedLaura, { lastInvitation: invitation() }),
          problem(400, {
            code: "Users.Invitation.NameRequired",
            detail: "Para invitar por WhatsApp, cargá el nombre de la persona.",
            errors: { displayName: ["Para invitar por WhatsApp, cargá el nombre de la persona."] },
          }),
        );

        const dialog = await openEdit("laura.rios@gmail.com");
        await userEvent.click(stripOf(dialog).getByRole("button", { name: "Reenviar invitación" }));
        const panel = within(dialog.getByRole("region", { name: "Reenviar la invitación" }));
        await userEvent.click(panel.getByRole("checkbox", { name: /aceptó recibir mensajes/ }));
        await userEvent.click(panel.getByRole("button", { name: "Reenviar la invitación" }));

        expect(await panel.findByRole("alert")).toHaveTextContent(
          "Para invitar por WhatsApp hace falta su nombre: cargalo en «Nombre» y guardá antes de reenviar.",
        );
      });

      it("says an inactive account cannot be invited with a toast", async () => {
        const toastError = vi.spyOn(toast, "error");
        withResend(
          invitedLaura,
          detailOf(invitedLaura, { lastInvitation: invitation() }),
          problem(400, {
            code: "Users.Invitation.UserInactive",
            detail: "La cuenta está desactivada: activala antes de invitarla.",
          }),
        );

        const dialog = await openEdit("laura.rios@gmail.com");
        await userEvent.click(stripOf(dialog).getByRole("button", { name: "Reenviar invitación" }));
        const panel = within(dialog.getByRole("region", { name: "Reenviar la invitación" }));
        await userEvent.click(panel.getByRole("radio", { name: "Por correo" }));
        await userEvent.click(panel.getByRole("button", { name: "Reenviar la invitación" }));

        await waitFor(() =>
          expect(toastError).toHaveBeenCalledWith("La cuenta está desactivada: activala antes de invitarla."),
        );
      });

      it("waits what the server says after a 429", async () => {
        const toastError = vi.spyOn(toast, "error");
        withResend(
          invitedLaura,
          detailOf(invitedLaura, { lastInvitation: invitation() }),
          problem(429, {
            code: "Users.Invitation.TooManyRequests",
            detail: "Esperá un minuto antes de volver a invitar a esta persona.",
            retryAfter: 42,
          }),
        );

        const dialog = await openEdit("laura.rios@gmail.com");
        await userEvent.click(stripOf(dialog).getByRole("button", { name: "Reenviar invitación" }));
        const panel = within(dialog.getByRole("region", { name: "Reenviar la invitación" }));
        await userEvent.click(panel.getByRole("radio", { name: "Por correo" }));
        await userEvent.click(panel.getByRole("button", { name: "Reenviar la invitación" }));

        await waitFor(() =>
          expect(toastError).toHaveBeenCalledWith("Esperá un minuto antes de volver a invitar a esta persona."),
        );
        const resend = stripOf(dialog).getByRole("button", { name: "Reenviar invitación" });
        expect(resend).toBeDisabled();
        expect(resend).toHaveAccessibleDescription("Podés reenviar en 42 s");
      });

      it("closes with Cancelar and gives the focus back to Reenviar invitación", async () => {
        const sent = withResend(invitedLaura, detailOf(invitedLaura, { lastInvitation: invitation() }));

        const dialog = await openEdit("laura.rios@gmail.com");
        await userEvent.click(stripOf(dialog).getByRole("button", { name: "Reenviar invitación" }));
        const panel = within(dialog.getByRole("region", { name: "Reenviar la invitación" }));
        await userEvent.click(panel.getByRole("button", { name: "Cancelar" }));

        expect(dialog.queryByRole("region", { name: "Reenviar la invitación" })).not.toBeInTheDocument();
        expect(stripOf(dialog).getByRole("button", { name: "Reenviar invitación" })).toHaveFocus();
        // El diálogo de edición sigue abierto: Cancelar era del reenvío.
        expect(screen.getByRole("dialog", { name: "Editar usuario" })).toBeInTheDocument();
        expect(sent).toEqual([]);
      });

      it("gives the focus to the strip when it was cancelled with the resend on its way and the answer turns the button off", async () => {
        let release: () => void = () => {};
        const answered = new Promise<void>((resolve) => {
          release = resolve;
        });
        const sent = withResend(invitedLaura, detailOf(invitedLaura, { lastInvitation: invitation() }), async () => {
          await answered;

          return new HttpResponse(null, { status: 202 });
        });

        const dialog = await openEdit("laura.rios@gmail.com");
        await userEvent.click(stripOf(dialog).getByRole("button", { name: "Reenviar invitación" }));
        const panel = within(dialog.getByRole("region", { name: "Reenviar la invitación" }));
        await userEvent.click(panel.getByRole("radio", { name: "Por correo" }));
        await userEvent.click(panel.getByRole("button", { name: "Reenviar la invitación" }));
        await waitFor(() => expect(sent).toEqual([{ channel: "Email", consent: false }]));

        // Cancelar con el envío en camino: el foco vuelve a "Reenviar invitación", que todavía se puede tocar.
        await userEvent.click(panel.getByRole("button", { name: "Cancelar" }));
        const resend = stripOf(dialog).getByRole("button", { name: "Reenviar invitación" });
        expect(resend).toHaveFocus();

        release();

        // El 202 lo apaga por un minuto: el foco no puede quedarse en un botón apagado, y lo toma la franja.
        await waitFor(() => expect(resend).toBeDisabled());
        expect(dialog.getByRole("region", { name: "Última invitación" })).toHaveFocus();
      });

      it("gives the focus to the strip when Cancelar closes the panel and the button was turned off meanwhile", async () => {
        withUser(invitedLaura, detailOf(invitedLaura, { lastInvitation: invitation() }));

        const dialog = await openEdit("laura.rios@gmail.com");
        await userEvent.click(stripOf(dialog).getByRole("button", { name: "Reenviar invitación" }));
        const panel = within(dialog.getByRole("region", { name: "Reenviar la invitación" }));

        // Con el panel abierto, otro admin se la reenvía y el detalle se vuelve a pedir (al volver a la ventana, por
        // ejemplo): trae la invitación de recién, que hace esperar un minuto.
        server.use(
          http.get(`/api/users/${invitedLaura.id}`, () =>
            HttpResponse.json(
              detailOf(invitedLaura, {
                lastInvitation: invitation({ sentAtUtc: now.toISOString(), deliveryStatus: "Pending" }),
              }),
            ),
          ),
        );
        await act(() => queryClient.invalidateQueries({ queryKey: userQueryKey(invitedLaura.id) }));

        await userEvent.click(panel.getByRole("button", { name: "Cancelar" }));

        const resend = stripOf(dialog).getByRole("button", { name: "Reenviar invitación" });
        expect(resend).toBeDisabled();
        expect(resend).toHaveAccessibleDescription("Podés reenviar en 60 s");
        // El botón apagado no puede tomar el foco: lo toma la franja, que dice qué pasó.
        expect(dialog.getByRole("region", { name: "Última invitación" })).toHaveFocus();
      });

      it.each([
        [
          "the missing consent",
          {
            code: "Users.Invitation.ConsentRequired",
            detail: "Confirmá que la persona aceptó recibir mensajes por WhatsApp.",
            errors: { consent: ["Confirmá que la persona aceptó recibir mensajes por WhatsApp."] },
          },
          "Confirmá que la persona aceptó recibir mensajes por WhatsApp.",
        ],
        [
          "the missing name",
          {
            code: "Users.Invitation.NameRequired",
            detail: "Para invitar por WhatsApp, cargá el nombre de la persona.",
            errors: { displayName: ["Para invitar por WhatsApp, cargá el nombre de la persona."] },
          },
          "Para invitar por WhatsApp hace falta su nombre: cargalo en «Nombre» y guardá antes de reenviar.",
        ],
        [
          "a channel it cannot use",
          {
            code: "Validation.Failed",
            detail: "Revisá los datos ingresados.",
            errors: { channel: ["Cargá un correo para usar esta opción."] },
          },
          "Cargá un correo para usar esta opción.",
        ],
      ])("says %s with a toast when it was cancelled with the resend on its way", async (_, body, message) => {
        const toastError = vi.spyOn(toast, "error");
        let release: () => void = () => {};
        const answered = new Promise<void>((resolve) => {
          release = resolve;
        });
        const sent = withResend(invitedLaura, detailOf(invitedLaura, { lastInvitation: invitation() }), async () => {
          await answered;

          return problem(400, body)();
        });

        const dialog = await openEdit("laura.rios@gmail.com");
        await userEvent.click(stripOf(dialog).getByRole("button", { name: "Reenviar invitación" }));
        const panel = within(dialog.getByRole("region", { name: "Reenviar la invitación" }));
        await userEvent.click(panel.getByRole("button", { name: "Reenviar la invitación" }));
        await waitFor(() => expect(sent).toHaveLength(1));

        // Cancelar cierra el panel, pero el envío ya salió y la respuesta llega igual.
        await userEvent.click(panel.getByRole("button", { name: "Cancelar" }));
        expect(dialog.queryByRole("region", { name: "Reenviar la invitación" })).not.toBeInTheDocument();

        release();

        // Sin el panel no hay dónde ponerlo: va a un aviso, como la respuesta buena, y no se pierde en silencio.
        await waitFor(() => expect(toastError).toHaveBeenCalledWith(message));
      });
    });
  });

  describe("unlinking the WhatsApp", () => {
    it("says that an account without email is left without a way in", async () => {
      withUser(juan);

      const dialog = await openEdit("+54 9 11 2345-6789");
      await userEvent.click(dialog.getByRole("button", { name: "Desvincular el WhatsApp de Juan Gómez" }));

      const confirmation = await screen.findByRole("dialog", { name: "¿Desvincular el WhatsApp de Juan Gómez?" });
      expect(confirmation).toHaveAccessibleDescription(
        "Se cierran sus sesiones abiertas y ya no va a poder entrar con +54 9 11 2345-6789. Como no tiene correo, se queda sin forma de entrar hasta que le cargues un número o un correo.",
      );
      expect(within(confirmation).getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
      expect(within(confirmation).getByRole("button", { name: "Desvincular" })).toBeInTheDocument();
    });

    it("says that an account with email keeps entering with it, and names it by the email without a name", async () => {
      const nameless = { ...carla, displayName: null };
      withUser(nameless);

      const dialog = await openEdit("carla@example.com");
      await userEvent.click(dialog.getByRole("button", { name: "Desvincular el WhatsApp de carla@example.com" }));

      const confirmation = await screen.findByRole("dialog", {
        name: "¿Desvincular el WhatsApp de carla@example.com?",
      });
      expect(confirmation).toHaveAccessibleDescription(
        "Se cierran sus sesiones abiertas y ya no va a poder entrar con +54 9 11 5555-4444. Va a poder seguir entrando con su correo.",
      );
    });

    it("unlinks, says so and shows the account without the number", async () => {
      const toastSuccess = vi.spyOn(toast, "success");
      let unlinked = 0;
      let listRequests = 0;
      // Aparte y después: dentro de un mismo `server.use`, gana el primero que coincide, y `adminHandlers` ya trae su
      // propio `/api/users`.
      server.use(...adminHandlers([carla]));
      server.use(
        http.get("/api/users", () => {
          listRequests += 1;

          return HttpResponse.json({
            items: [unlinked === 0 ? carla : { ...carla, phoneNumber: null, formattedPhoneNumber: null }],
            page: 1,
            pageSize: 20,
            totalCount: 1,
            totalPages: 1,
            hasPrevious: false,
            hasNext: false,
          });
        }),
        http.get("/account/login-methods", () => HttpResponse.json(whatsappLoginMethods)),
        http.get(`/api/users/${carla.id}`, () =>
          HttpResponse.json(
            unlinked === 0
              ? detailOf(carla)
              : detailOf({ ...carla, phoneNumber: null, phoneNumberConfirmed: false, formattedPhoneNumber: null }),
          ),
        ),
        http.delete(`/api/users/${carla.id}/whatsapp`, () => {
          unlinked += 1;

          return new HttpResponse(null, { status: 204 });
        }),
      );

      const dialog = await openEdit("carla@example.com");
      const requestsBefore = listRequests;
      await userEvent.click(dialog.getByRole("button", { name: "Desvincular el WhatsApp de Carla Paz" }));
      const confirmation = await screen.findByRole("dialog", { name: /desvincular el whatsapp/i });
      await userEvent.click(within(confirmation).getByRole("button", { name: "Desvincular" }));

      await waitFor(() => expect(unlinked).toBe(1));
      await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Desvinculamos su WhatsApp."));
      // El detalle vuelve sin el número, y el diálogo de edición sigue abierto para seguir trabajando.
      expect(await methodsOf(dialog).findByText("Sin número")).toBeInTheDocument();
      expect(methodsOf(dialog).queryByText("+54 9 11 5555-4444")).not.toBeInTheDocument();
      // El botón de la fila es el mismo, ahora con "Agregar número": el foco se quedó en él.
      expect(dialog.getByRole("button", { name: "Agregar número" })).toHaveFocus();
      // El listado también se vuelve a pedir: su fila tenía el ícono del teléfono.
      await waitFor(() => expect(listRequests).toBeGreaterThan(requestsBefore));
    });

    it("gives the focus back to the row's Editar after unlinking, though the row is named by the name now", async () => {
      let unlinked = false;
      const withoutPhone = { ...juan, phoneNumber: null, phoneNumberConfirmed: false, formattedPhoneNumber: null };
      withUser(juan);
      server.use(
        http.get("/api/users", () => HttpResponse.json(pageOf([unlinked ? withoutPhone : juan]))),
        http.get(`/api/users/${juan.id}`, () => HttpResponse.json(detailOf(unlinked ? withoutPhone : juan))),
        http.delete(`/api/users/${juan.id}/whatsapp`, () => {
          unlinked = true;

          return new HttpResponse(null, { status: 204 });
        }),
      );

      const dialog = await openEdit("+54 9 11 2345-6789");
      await userEvent.click(dialog.getByRole("button", { name: "Desvincular el WhatsApp de Juan Gómez" }));
      const confirmation = await screen.findByRole("dialog", { name: /desvincular el whatsapp/i });
      await userEvent.click(within(confirmation).getByRole("button", { name: "Desvincular" }));

      // Sin correo ni número, la fila se nombra por el nombre de la persona. Con el diálogo abierto, el resto de la
      // página está oculto para el lector (`hidden`).
      expect(await screen.findByRole("button", { name: "Editar a Juan Gómez", hidden: true })).toBeInTheDocument();
      await waitFor(() => expect(screen.queryByRole("dialog", { name: /desvincular el whatsapp/i })).not.toBeInTheDocument());

      await userEvent.keyboard("{Escape}");

      await waitFor(() => expect(screen.queryByRole("dialog", { name: "Editar usuario" })).not.toBeInTheDocument());
      await waitFor(() => expect(screen.getByRole("button", { name: "Editar a Juan Gómez" })).toHaveFocus());
    });

    it("shows the server's reason when it refuses", async () => {
      const toastError = vi.spyOn(toast, "error");
      withUser(juan);
      server.use(
        http.delete(`/api/users/${juan.id}/whatsapp`, () =>
          HttpResponse.json(
            {
              status: 409,
              code: "Users.User.LastLoginMethod",
              detail: "Es tu único medio de ingreso: para desvincularlo, primero agregá un correo.",
            },
            { status: 409 },
          ),
        ),
      );

      const dialog = await openEdit("+54 9 11 2345-6789");
      await userEvent.click(dialog.getByRole("button", { name: "Desvincular el WhatsApp de Juan Gómez" }));
      const confirmation = await screen.findByRole("dialog", { name: /desvincular el whatsapp/i });
      await userEvent.click(within(confirmation).getByRole("button", { name: "Desvincular" }));

      await waitFor(() =>
        expect(toastError).toHaveBeenCalledWith(
          "Es tu único medio de ingreso: para desvincularlo, primero agregá un correo.",
        ),
      );
    });
  });
});
