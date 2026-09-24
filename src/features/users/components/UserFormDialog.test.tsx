import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { adminHandlers } from "../testData";
import { loginMethodsQueryKey, type LoginMethods } from "@/shared/api/loginMethods";
import { queryClient } from "@/shared/api/queryClient";
import { loginMethods, whatsappLoginMethods } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";

vi.mock("react-oidc-context", async () => {
  const actual = await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context");

  return { ...actual, useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "t" } }) };
});

const newUserId = "0199a0c0-0000-7000-8000-000000000001";

/// El listado de un admin, los medios de ingreso que se pidan y el alta, que guarda lo que recibió y responde lo que se
/// le pase (por defecto, el id de la cuenta nueva).
function withCreate(methods: LoginMethods, respond: () => Response = () => HttpResponse.json(newUserId)) {
  const created: unknown[] = [];

  server.use(
    ...adminHandlers(),
    http.get("/account/login-methods", () => HttpResponse.json(methods)),
    http.post("/api/users", async ({ request }) => {
      created.push(await request.json());

      return respond();
    }),
  );

  return created;
}

function problem(status: number, body: Record<string, unknown>) {
  return () => HttpResponse.json({ status, ...body }, { status });
}

/// Abre "Nuevo usuario" con los medios de ingreso ya cargados: antes de eso, que el número no esté no dice nada.
async function openNewUser() {
  renderRouteWithProviders("/usuarios");

  await userEvent.click(await screen.findByRole("button", { name: "Nuevo usuario" }));
  const dialog = await screen.findByRole("dialog", { name: "Nuevo usuario" });
  await waitFor(() => expect(queryClient.getQueryState(loginMethodsQueryKey)?.status).toBe("success"));

  return within(dialog);
}

/// Elige un rol en el combo del diálogo. Se abre por teclado y no con un clic: en jsdom, después de un test
/// que ya abrió un menú de Radix, el clic sobre el disparador deja de abrirlo (en el navegador no pasa).
async function pickRole(name: string) {
  const combo = await screen.findByRole("button", { name: "Roles" });
  combo.focus();
  await userEvent.keyboard("{Enter}");
  await userEvent.click(await screen.findByRole("menuitemcheckbox", { name: new RegExp(`^${name}`) }));
  await userEvent.keyboard("{Escape}");
}

/// Que un mensaje esté arriba de los botones y no atado a un campo: es un `alert` suelto, antes de "Crear".
function expectAboveTheButtons(dialog: ReturnType<typeof within>, message: string, submit: string) {
  const alert = dialog.getByRole("alert");
  expect(alert).toHaveTextContent(message);
  expect(alert.compareDocumentPosition(dialog.getByRole("button", { name: submit })) & Node.DOCUMENT_POSITION_FOLLOWING)
    .toBeTruthy();

  for (const field of dialog.getAllByRole("textbox")) {
    expect(field).not.toHaveAccessibleDescription(message);
  }
}

describe("UserFormDialog", () => {
  beforeEach(() => {
    queryClient.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("the fields", () => {
    it("asks for an email, a WhatsApp number or both, with the country", async () => {
      withCreate(whatsappLoginMethods);

      const dialog = await openNewUser();

      expect(dialog.getByText("Cargá un correo, un número de WhatsApp o los dos: con uno alcanza.")).toBeInTheDocument();
      expect(dialog.getByRole("textbox", { name: "Correo electrónico" })).toBeInTheDocument();
      expect(dialog.getByRole("textbox", { name: "Número de WhatsApp" })).toBeInTheDocument();
      // El país arranca en el primero de los habilitados.
      expect(dialog.getByRole("combobox", { name: "País: Argentina, +54" })).toBeInTheDocument();
      expect(dialog.getByRole("textbox", { name: "Nombre" })).toHaveAccessibleDescription(
        "Opcional. Es el nombre que se muestra en el sistema.",
      );
      expect(dialog.getByRole("button", { name: "Roles" })).toBeInTheDocument();
      expect(dialog.getByRole("checkbox", { name: "Mandarle una invitación" })).not.toBeChecked();
      expect(dialog.getByRole("button", { name: "Crear" })).toBeInTheDocument();
    });

    it("shows the fields in the order of the board", async () => {
      withCreate(whatsappLoginMethods);

      const dialog = await openNewUser();

      const names = [
        dialog.getByRole("textbox", { name: "Correo electrónico" }),
        dialog.getByRole("textbox", { name: "Número de WhatsApp" }),
        dialog.getByRole("textbox", { name: "Nombre" }),
        dialog.getByRole("button", { name: "Roles" }),
        dialog.getByRole("checkbox", { name: "Mandarle una invitación" }),
      ];

      for (const [index, element] of names.slice(1).entries()) {
        expect(names[index].compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      }
    });

    it("hides the number and the WhatsApp channel when WhatsApp is off", async () => {
      withCreate({ google: true, whatsapp: false, whatsappCountries: [], whatsappNumber: null });

      const dialog = await openNewUser();

      expect(dialog.getByText("Dale de alta el correo. Después entra con su código, como todos.")).toBeInTheDocument();
      expect(dialog.queryByRole("textbox", { name: "Número de WhatsApp" })).not.toBeInTheDocument();

      await userEvent.click(dialog.getByRole("checkbox", { name: "Mandarle una invitación" }));

      expect(dialog.getByRole("radio", { name: "Por correo" })).toBeInTheDocument();
      expect(dialog.queryByRole("radio", { name: "Por WhatsApp" })).not.toBeInTheDocument();
    });

    it("asks for the email under its field when WhatsApp is off, without sending anything", async () => {
      const created = withCreate(loginMethods);

      const dialog = await openNewUser();
      await userEvent.click(dialog.getByRole("button", { name: "Crear" }));

      // Sin el número en pantalla, el correo es lo único que identifica a la cuenta. El backend contestaría "Cargá un
      // correo o un número de WhatsApp.", que nombra un campo que no está.
      const email = dialog.getByRole("textbox", { name: "Correo electrónico" });
      expect(email).toHaveAccessibleDescription("Ingresá un correo electrónico válido.");
      expect(email).toHaveAttribute("aria-invalid", "true");
      expect(dialog.queryByText("Cargá un correo o un número de WhatsApp.")).not.toBeInTheDocument();
      expect(created).toEqual([]);
    });

    it("creates a user with an email when WhatsApp is off", async () => {
      const created = withCreate(loginMethods);

      const dialog = await openNewUser();
      await userEvent.type(dialog.getByRole("textbox", { name: "Correo electrónico" }), "nueva@example.com");
      await pickRole("Admin");
      await userEvent.click(dialog.getByRole("button", { name: "Crear" }));

      await waitFor(() =>
        expect(created).toEqual([
          { email: "nueva@example.com", phone: null, displayName: null, roles: ["Admin"], invitation: null },
        ]),
      );
    });
  });

  describe("creating", () => {
    it("creates a user with only an email", async () => {
      const created = withCreate(whatsappLoginMethods);

      const dialog = await openNewUser();
      await userEvent.type(dialog.getByRole("textbox", { name: "Correo electrónico" }), "nueva@example.com");
      await pickRole("Admin");
      await userEvent.click(dialog.getByRole("button", { name: "Crear" }));

      await waitFor(() =>
        expect(created).toEqual([
          { email: "nueva@example.com", phone: null, displayName: null, roles: ["Admin"], invitation: null },
        ]),
      );
    });

    it("creates a user with only a number, as it was typed and with its country", async () => {
      const created = withCreate(whatsappLoginMethods);

      const dialog = await openNewUser();
      await userEvent.type(dialog.getByRole("textbox", { name: "Número de WhatsApp" }), "351 555-1234");
      await userEvent.type(dialog.getByRole("textbox", { name: "Nombre" }), "Laura Ríos");
      await userEvent.click(dialog.getByRole("button", { name: "Crear" }));

      await waitFor(() =>
        expect(created).toEqual([
          {
            email: null,
            phone: { country: "AR", number: "351 555-1234" },
            displayName: "Laura Ríos",
            roles: [],
            invitation: null,
          },
        ]),
      );
    });

    it("sends the country the admin picked", async () => {
      const created = withCreate(whatsappLoginMethods);

      const dialog = await openNewUser();
      // Con teclado, como los demás desplegables de Radix en los tests (ver UserMenu.test.tsx).
      dialog.getByRole("combobox", { name: "País: Argentina, +54" }).focus();
      await userEvent.keyboard("{Enter}");
      await userEvent.click(await screen.findByRole("option", { name: "Uruguay, +598" }));
      await userEvent.type(dialog.getByRole("textbox", { name: "Número de WhatsApp" }), "94 123 456");
      await userEvent.click(dialog.getByRole("button", { name: "Crear" }));

      await waitFor(() =>
        expect(created).toEqual([
          {
            email: null,
            phone: { country: "UY", number: "94 123 456" },
            displayName: null,
            roles: [],
            invitation: null,
          },
        ]),
      );
    });

    it("invites by email", async () => {
      const created = withCreate(whatsappLoginMethods);

      const dialog = await openNewUser();
      await userEvent.type(dialog.getByRole("textbox", { name: "Correo electrónico" }), "nueva@example.com");
      await userEvent.click(dialog.getByRole("checkbox", { name: "Mandarle una invitación" }));

      // Con correo y sin número, el único canal posible queda elegido.
      expect(dialog.getByRole("radio", { name: "Por correo" })).toBeChecked();
      expect(dialog.queryByRole("checkbox", { name: /aceptó recibir mensajes/ })).not.toBeInTheDocument();

      await userEvent.click(dialog.getByRole("button", { name: "Crear e invitar" }));

      await waitFor(() =>
        expect(created).toEqual([
          {
            email: "nueva@example.com",
            phone: null,
            displayName: null,
            roles: [],
            invitation: { channel: "Email", consent: false },
          },
        ]),
      );
    });

    it("invites by WhatsApp once the admin confirms the consent", async () => {
      const created = withCreate(whatsappLoginMethods);

      const dialog = await openNewUser();
      await userEvent.type(dialog.getByRole("textbox", { name: "Número de WhatsApp" }), "351 555-1234");
      await userEvent.type(dialog.getByRole("textbox", { name: "Nombre" }), "Laura Ríos");
      await userEvent.click(dialog.getByRole("checkbox", { name: "Mandarle una invitación" }));

      expect(dialog.getByRole("radio", { name: "Por WhatsApp" })).toBeChecked();

      const consent = dialog.getByRole("checkbox", {
        name: "Laura aceptó recibir mensajes de Arquitectura Base por WhatsApp.",
      });
      expect(consent).toHaveAccessibleDescription("Sin esto, WhatsApp no permite escribirle primero.");

      await userEvent.click(consent);
      await userEvent.click(dialog.getByRole("button", { name: "Crear e invitar" }));

      await waitFor(() =>
        expect(created).toEqual([
          {
            email: null,
            phone: { country: "AR", number: "351 555-1234" },
            displayName: "Laura Ríos",
            roles: [],
            invitation: { channel: "WhatsApp", consent: true },
          },
        ]),
      );
    });

    it("lets the admin pick WhatsApp when there are both an email and a number", async () => {
      const created = withCreate(whatsappLoginMethods);

      const dialog = await openNewUser();
      await userEvent.type(dialog.getByRole("textbox", { name: "Correo electrónico" }), "laura@example.com");
      await userEvent.type(dialog.getByRole("textbox", { name: "Número de WhatsApp" }), "351 555-1234");
      await userEvent.type(dialog.getByRole("textbox", { name: "Nombre" }), "Laura Ríos");
      await userEvent.click(dialog.getByRole("checkbox", { name: "Mandarle una invitación" }));

      expect(dialog.getByRole("radio", { name: "Por correo" })).toBeChecked();

      await userEvent.click(dialog.getByRole("radio", { name: "Por WhatsApp" }));
      await userEvent.click(dialog.getByRole("checkbox", { name: /aceptó recibir mensajes/ }));
      await userEvent.click(dialog.getByRole("button", { name: "Crear e invitar" }));

      await waitFor(() =>
        expect(created).toEqual([
          {
            email: "laura@example.com",
            phone: { country: "AR", number: "351 555-1234" },
            displayName: "Laura Ríos",
            roles: [],
            invitation: { channel: "WhatsApp", consent: true },
          },
        ]),
      );
    });
  });

  describe("the channels", () => {
    it("disables Por correo without an email, and says why", async () => {
      withCreate(whatsappLoginMethods);

      const dialog = await openNewUser();
      await userEvent.type(dialog.getByRole("textbox", { name: "Número de WhatsApp" }), "351 555-1234");
      await userEvent.click(dialog.getByRole("checkbox", { name: "Mandarle una invitación" }));

      const email = dialog.getByRole("radio", { name: "Por correo" });
      expect(email).toBeDisabled();
      expect(email).toHaveAccessibleDescription("Cargá un correo para usar esta opción.");
      expect(dialog.getByRole("radio", { name: "Por WhatsApp" })).toBeEnabled();
    });

    it("disables Por WhatsApp without a number, and says why", async () => {
      withCreate(whatsappLoginMethods);

      const dialog = await openNewUser();
      await userEvent.type(dialog.getByRole("textbox", { name: "Correo electrónico" }), "nueva@example.com");
      await userEvent.click(dialog.getByRole("checkbox", { name: "Mandarle una invitación" }));

      const whatsapp = dialog.getByRole("radio", { name: "Por WhatsApp" });
      expect(whatsapp).toBeDisabled();
      expect(whatsapp).toHaveAccessibleDescription("Cargá un número para usar esta opción.");
      expect(dialog.getByRole("radio", { name: "Por correo" })).toBeEnabled();
    });

    it("says that the person agreed when there is no name to say it with", async () => {
      withCreate(whatsappLoginMethods);

      const dialog = await openNewUser();
      await userEvent.type(dialog.getByRole("textbox", { name: "Número de WhatsApp" }), "351 555-1234");
      await userEvent.click(dialog.getByRole("checkbox", { name: "Mandarle una invitación" }));

      expect(
        dialog.getByRole("checkbox", { name: "La persona aceptó recibir mensajes de Arquitectura Base por WhatsApp." }),
      ).toBeInTheDocument();
    });
  });

  describe("the errors", () => {
    it("says above the buttons that an email or a number is missing", async () => {
      withCreate(
        whatsappLoginMethods,
        problem(400, { code: "Users.Identity.Required", detail: "Cargá un correo o un número de WhatsApp." }),
      );

      const dialog = await openNewUser();
      await userEvent.click(dialog.getByRole("button", { name: "Crear" }));

      await waitFor(() => expectAboveTheButtons(dialog, "Cargá un correo o un número de WhatsApp.", "Crear"));
      expect(screen.getByRole("dialog", { name: "Nuevo usuario" })).toBeInTheDocument();
    });

    it("puts a repeated email under the email", async () => {
      withCreate(
        whatsappLoginMethods,
        problem(409, { code: "Users.User.AlreadyExists", detail: "Ese correo ya tiene cuenta." }),
      );

      const dialog = await openNewUser();
      const email = dialog.getByRole("textbox", { name: "Correo electrónico" });
      await userEvent.type(email, "ana@example.com");
      await userEvent.click(dialog.getByRole("button", { name: "Crear" }));

      // El texto lo decide el `code`, no el `detail`.
      await waitFor(() => expect(email).toHaveAccessibleDescription("Ya existe una cuenta con ese correo."));
      expect(email).toHaveAttribute("aria-invalid", "true");
    });

    it("puts a repeated number under the number", async () => {
      withCreate(
        whatsappLoginMethods,
        problem(409, { code: "Users.Phone.AlreadyExists", detail: "Ese número ya tiene cuenta." }),
      );

      const dialog = await openNewUser();
      const number = dialog.getByRole("textbox", { name: "Número de WhatsApp" });
      await userEvent.type(number, "351 555-1234");
      await userEvent.click(dialog.getByRole("button", { name: "Crear" }));

      await waitFor(() => expect(number).toHaveAccessibleDescription("Ya existe una cuenta con ese número."));
    });

    it("puts a number that is not a mobile under the number", async () => {
      withCreate(whatsappLoginMethods, problem(400, { code: "Users.Phone.Invalid", detail: "El número no es válido." }));

      const dialog = await openNewUser();
      const number = dialog.getByRole("textbox", { name: "Número de WhatsApp" });
      await userEvent.type(number, "123");
      await userEvent.click(dialog.getByRole("button", { name: "Crear" }));

      await waitFor(() => expect(number).toHaveAccessibleDescription("Ingresá un número de celular válido."));
    });

    it("puts the missing consent under the checkbox", async () => {
      const message = "Confirmá que la persona aceptó recibir mensajes por WhatsApp.";
      withCreate(
        whatsappLoginMethods,
        problem(400, {
          code: "Users.Invitation.ConsentRequired",
          detail: message,
          errors: { "invitation.consent": [message] },
        }),
      );

      const dialog = await openNewUser();
      await userEvent.type(dialog.getByRole("textbox", { name: "Número de WhatsApp" }), "351 555-1234");
      await userEvent.type(dialog.getByRole("textbox", { name: "Nombre" }), "Laura Ríos");
      await userEvent.click(dialog.getByRole("checkbox", { name: "Mandarle una invitación" }));
      await userEvent.click(dialog.getByRole("button", { name: "Crear e invitar" }));

      const consent = dialog.getByRole("checkbox", { name: /aceptó recibir mensajes/ });
      await waitFor(() =>
        expect(consent).toHaveAccessibleDescription(`Sin esto, WhatsApp no permite escribirle primero. ${message}`),
      );
    });

    it("puts the missing name for a WhatsApp invitation under the name", async () => {
      const message = "Para invitar por WhatsApp, cargá el nombre de la persona.";
      withCreate(
        whatsappLoginMethods,
        problem(400, { code: "Users.Invitation.NameRequired", detail: message, errors: { displayName: [message] } }),
      );

      const dialog = await openNewUser();
      await userEvent.type(dialog.getByRole("textbox", { name: "Número de WhatsApp" }), "351 555-1234");
      await userEvent.click(dialog.getByRole("checkbox", { name: "Mandarle una invitación" }));
      await userEvent.click(dialog.getByRole("checkbox", { name: /aceptó recibir mensajes/ }));
      await userEvent.click(dialog.getByRole("button", { name: "Crear e invitar" }));

      await waitFor(() => expect(dialog.getByRole("textbox", { name: "Nombre" })).toHaveAccessibleDescription(message));
    });

    it("shows the message of the field the backend rejected", async () => {
      withCreate(
        whatsappLoginMethods,
        problem(400, {
          code: "Validation.Failed",
          detail: "Revisá los datos ingresados.",
          errors: { displayName: ["El nombre no puede tener más de 100 caracteres."] },
        }),
      );

      const dialog = await openNewUser();
      await userEvent.type(dialog.getByRole("textbox", { name: "Correo electrónico" }), "nueva@example.com");
      await userEvent.type(dialog.getByRole("textbox", { name: "Nombre" }), "Ana");
      await userEvent.click(dialog.getByRole("button", { name: "Crear" }));

      // Sin esto el diálogo quedaba abierto sin un solo mensaje, como si el botón no hiciera nada.
      expect(await dialog.findByRole("alert")).toHaveTextContent("El nombre no puede tener más de 100 caracteres.");
    });

    it("prefers the backend's message for the email over the generic one", async () => {
      withCreate(
        whatsappLoginMethods,
        problem(400, {
          code: "Validation.Failed",
          detail: "Revisá los datos ingresados.",
          errors: { email: ["El correo no puede tener más de 254 caracteres."] },
        }),
      );

      const dialog = await openNewUser();
      await userEvent.type(dialog.getByRole("textbox", { name: "Correo electrónico" }), "nueva@example.com");
      await userEvent.click(dialog.getByRole("button", { name: "Crear" }));

      // "Ingresá un correo electrónico válido" no explicaría qué pasó: el formato estaba bien.
      expect(await dialog.findByRole("alert")).toHaveTextContent("El correo no puede tener más de 254 caracteres.");
    });

    it("checks the format of the email before sending it", async () => {
      const created = withCreate(whatsappLoginMethods);

      const dialog = await openNewUser();
      const email = dialog.getByRole("textbox", { name: "Correo electrónico" });
      await userEvent.type(email, "no-es-un-correo");
      await userEvent.click(dialog.getByRole("button", { name: "Crear" }));

      expect(email).toHaveAccessibleDescription("Ingresá un correo electrónico válido.");
      expect(created).toEqual([]);
    });
  });

  it("gives the focus back to the button that opened the dialog", async () => {
    withCreate(whatsappLoginMethods);

    renderRouteWithProviders("/usuarios");

    const newUser = await screen.findByRole("button", { name: "Nuevo usuario" });
    newUser.focus();
    await userEvent.click(newUser);
    await screen.findByRole("dialog");

    await userEvent.keyboard("{Escape}");

    // Radix solo le devuelve el foco a un DialogTrigger propio, y acá lo abre un Button cualquiera: sin
    // `onCloseAutoFocus` el foco cae en <body> y el siguiente Tab arranca desde el principio del documento.
    await waitFor(() => expect(newUser).toHaveFocus());
  });
});
