import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { adminHandlers, ana, carla, detailOf, juan, laura, pageOf } from "../testData";
import { userQueryKey, type UserDetail, type UserListItem } from "../api/users";
import { loginMethodsQueryKey, type LoginMethods } from "@/shared/api/loginMethods";
import { queryClient } from "@/shared/api/queryClient";
import { loginMethods, whatsappLoginMethods } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";

vi.mock("react-oidc-context", async () => {
  const actual = await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context");

  return { ...actual, useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "t" } }) };
});

const onlyMethodWarning =
  "Es su único medio de ingreso. Si lo desvinculás, no va a poder entrar hasta que le cargues otro.";
const unverifiedHint = "Lo que carga un admin queda «Sin verificar» hasta que la persona entra con eso.";

/// El listado con una sola persona, su detalle, los medios de ingreso y la edición, que guarda lo que recibió.
function withUser(
  user: UserListItem,
  detail: UserDetail = detailOf(user),
  methods: LoginMethods = whatsappLoginMethods,
  respond: () => Response = () => new HttpResponse(null, { status: 204 }),
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

/// La sección "Medios de ingreso" del diálogo.
function methodsOf(dialog: ReturnType<typeof within>) {
  return within(dialog.getByRole("group", { name: "Medios de ingreso" }));
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

  it("opens from Editar with the name, the roles and the login methods", async () => {
    withUser(juan);

    const dialog = await openEdit("+54 9 11 2345-6789");

    // Debajo del título, a quién se está editando.
    expect(screen.getByRole("dialog", { name: "Editar usuario" })).toHaveAccessibleDescription("Juan Gómez");
    expect(dialog.getByRole("textbox", { name: "Nombre" })).toHaveValue("Juan Gómez");
    expect(dialog.getByRole("button", { name: "Roles" })).toBeInTheDocument();
    expect(dialog.getByRole("group", { name: "Medios de ingreso" })).toBeInTheDocument();
    expect(dialog.getByRole("button", { name: "Guardar" })).toBeInTheDocument();
  });

  describe("the login methods", () => {
    it("shows an account without email, with its number verified and the warning that it is the only way in", async () => {
      withUser(juan);

      const methods = methodsOf(await openEdit("+54 9 11 2345-6789"));

      expect(methods.getByText("Sin correo")).toBeInTheDocument();
      expect(methods.getByRole("button", { name: "Agregar correo" })).toHaveTextContent("Agregar");
      expect(methods.getByText("+54 9 11 2345-6789")).toBeInTheDocument();
      expect(methods.getByText("Verificado")).toBeInTheDocument();
      expect(methods.getByRole("button", { name: "Desvincular" })).toBeInTheDocument();
      expect(methods.getByRole("status")).toHaveTextContent(onlyMethodWarning);
      expect(methods.getByText(unverifiedHint)).toBeInTheDocument();
    });

    it("says that a number the admin loaded is not verified", async () => {
      withUser(laura);

      const methods = methodsOf(await openEdit("+54 9 351 555-1234"));

      expect(methods.getByText("+54 9 351 555-1234")).toBeInTheDocument();
      expect(methods.getByText("Sin verificar")).toBeInTheDocument();
      expect(methods.queryByText("Verificado")).not.toBeInTheDocument();
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

      const methods = methodsOf(await openEdit("ana@example.com"));

      expect(methods.getByText("Sin número")).toBeInTheDocument();
      expect(methods.getByRole("button", { name: "Agregar número" })).toHaveTextContent("Agregar");
    });

    it("does not offer to add a number when WhatsApp is off", async () => {
      withUser(ana, detailOf(ana), loginMethods);

      const methods = methodsOf(await openEdit("ana@example.com"));

      expect(methods.queryByText("Sin número")).not.toBeInTheDocument();
      expect(methods.queryByRole("button", { name: "Agregar número" })).not.toBeInTheDocument();
    });

    it("still shows a number to unlink when WhatsApp is off", async () => {
      withUser(juan, detailOf(juan), loginMethods);

      const methods = methodsOf(await openEdit("+54 9 11 2345-6789"));

      expect(methods.getByText("+54 9 11 2345-6789")).toBeInTheDocument();
      expect(methods.getByRole("button", { name: "Desvincular" })).toBeInTheDocument();
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

      const number = dialog.getByRole("textbox", { name: "Número de WhatsApp" });
      expect(number).toHaveFocus();
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

    it("puts an email of another account under the email", async () => {
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

  describe("unlinking the WhatsApp", () => {
    it("says that an account without email is left without a way in", async () => {
      withUser(juan);

      const dialog = await openEdit("+54 9 11 2345-6789");
      await userEvent.click(dialog.getByRole("button", { name: "Desvincular" }));

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
      await userEvent.click(dialog.getByRole("button", { name: "Desvincular" }));

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
      await userEvent.click(dialog.getByRole("button", { name: "Desvincular" }));
      const confirmation = await screen.findByRole("dialog", { name: /desvincular el whatsapp/i });
      await userEvent.click(within(confirmation).getByRole("button", { name: "Desvincular" }));

      await waitFor(() => expect(unlinked).toBe(1));
      await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Desvinculamos su WhatsApp."));
      // El detalle vuelve sin el número, y el diálogo de edición sigue abierto para seguir trabajando.
      expect(await methodsOf(dialog).findByText("Sin número")).toBeInTheDocument();
      expect(methodsOf(dialog).queryByText("+54 9 11 5555-4444")).not.toBeInTheDocument();
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
      await userEvent.click(dialog.getByRole("button", { name: "Desvincular" }));
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
      await userEvent.click(dialog.getByRole("button", { name: "Desvincular" }));
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
