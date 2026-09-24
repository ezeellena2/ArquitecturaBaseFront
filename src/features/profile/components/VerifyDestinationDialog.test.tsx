import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/auth/useCurrentUser";
import { queryClient } from "@/shared/api/queryClient";
import { currentUser, loginMethods, phoneOnlyUser, whatsappLoginMethods } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";

vi.mock("react-oidc-context", async () => {
  const actual = await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context");

  return { ...actual, useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "t" } }) };
});

const phone = "+5491123456789";
const maskedPhone = "+54 9 11 •••• 6789";

/// Lo que llega al servidor en cada pedido, para mirar qué se mandó.
interface Calls {
  codeRequests: unknown[];
  confirmations: unknown[];
}

/// La espera que responde el pedido de código número `count` (desde 1): la que toca en `waits`, o la última si hubo
/// más pedidos. Así un test arranca sin espera y ve que el reenvío vuelve a esperar.
function nthWait(waits: readonly number[], count: number): number {
  return waits[Math.min(count, waits.length) - 1] ?? 0;
}

/// Un `/api/me` que la confirmación modifica de verdad: es lo que prueba que el diálogo refresca el perfil y que la
/// fila muestra lo que se acaba de agregar.
function linkWhatsAppServer({ resendAfterSeconds = [45] }: { resendAfterSeconds?: readonly number[] } = {}): Calls {
  const calls: Calls = { codeRequests: [], confirmations: [] };
  let profile: CurrentUser = currentUser;

  server.use(
    http.get("/api/me", () => HttpResponse.json(profile)),
    http.get("/account/login-methods", () => HttpResponse.json(whatsappLoginMethods)),
    http.post("/api/me/whatsapp/code", async ({ request }) => {
      calls.codeRequests.push(await request.json());

      return HttpResponse.json(
        { resendAfterSeconds: nthWait(resendAfterSeconds, calls.codeRequests.length), phone, maskedPhone },
        { status: 202 },
      );
    }),
    http.put("/api/me/whatsapp", async ({ request }) => {
      calls.confirmations.push(await request.json());
      profile = {
        ...profile,
        phoneNumber: phone,
        formattedPhoneNumber: "+54 9 11 2345-6789",
        maskedPhoneNumber: maskedPhone,
        phoneNumberConfirmed: true,
      };

      return new HttpResponse(null, { status: 204 });
    }),
  );

  return calls;
}

function addEmailServer({ resendAfterSeconds = [45] }: { resendAfterSeconds?: readonly number[] } = {}): Calls {
  const calls: Calls = { codeRequests: [], confirmations: [] };
  let profile: CurrentUser = phoneOnlyUser;

  server.use(
    http.get("/api/me", () => HttpResponse.json(profile)),
    http.get("/account/login-methods", () => HttpResponse.json(loginMethods)),
    http.post("/api/me/email/code", async ({ request }) => {
      calls.codeRequests.push(await request.json());

      return HttpResponse.json(
        { resendAfterSeconds: nthWait(resendAfterSeconds, calls.codeRequests.length) },
        { status: 202 },
      );
    }),
    http.put("/api/me/email", async ({ request }) => {
      calls.confirmations.push(await request.json());
      profile = { ...profile, email: "ana@example.com", emailConfirmed: true };

      return new HttpResponse(null, { status: 204 });
    }),
  );

  return calls;
}

function problem(status: number, body: Record<string, unknown>) {
  return HttpResponse.json({ status, ...body }, { status });
}

/// Una respuesta que llega cuando el test lo dice, para mirar el diálogo mientras el pedido está en vuelo.
function heldResponse() {
  let release = () => {};
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });

  return { released, release: () => release() };
}

async function openDialog(button: string, title: string) {
  renderRouteWithProviders("/perfil");

  const region = await screen.findByRole("region", { name: "Medios de ingreso" });
  await userEvent.click(await within(region).findByRole("button", { name: button }));

  return screen.findByRole("dialog", { name: title });
}

async function typeCode(dialog: HTMLElement, code: string) {
  await userEvent.type(within(dialog).getByRole("textbox", { name: "Código 1" }), code);
}

describe("linking WhatsApp", () => {
  beforeEach(() => {
    queryClient.clear();
  });

  async function openAndSendNumber(number = "11 2345-6789") {
    const dialog = await openDialog("Vincular", "Vincular WhatsApp");
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Número de WhatsApp" }), number);
    await userEvent.click(within(dialog).getByRole("button", { name: "Enviar código" }));

    return dialog;
  }

  it("asks for the number, with the country first", async () => {
    linkWhatsAppServer();

    const dialog = await openDialog("Vincular", "Vincular WhatsApp");

    expect(dialog).toHaveAccessibleDescription("Te mandamos un código a ese número para comprobar que es tuyo.");
    expect(within(dialog).getByRole("combobox", { name: "País: Argentina, +54" })).toHaveTextContent("AR +54");
    expect(within(dialog).getByRole("textbox", { name: "Número de WhatsApp" })).toHaveAttribute("type", "tel");
    expect(within(dialog).getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Enviar código" })).toBeInTheDocument();
  });

  it("checks that there is a number before sending", async () => {
    const calls = linkWhatsAppServer();

    const dialog = await openDialog("Vincular", "Vincular WhatsApp");
    await userEvent.click(within(dialog).getByRole("button", { name: "Enviar código" }));

    expect(within(dialog).getByRole("textbox", { name: "Número de WhatsApp" })).toHaveAccessibleDescription(
      "Ingresá un número de celular válido.",
    );
    expect(calls.codeRequests).toEqual([]);
  });

  it("asks for the code in the same dialog, saying where it went", async () => {
    const calls = linkWhatsAppServer();

    const dialog = await openAndSendNumber();

    expect(await within(dialog).findByRole("group", { name: "Código" })).toBeInTheDocument();
    expect(calls.codeRequests).toEqual([{ country: "AR", number: "11 2345-6789" }]);
    expect(screen.getByRole("dialog", { name: "Vincular WhatsApp" })).toBe(dialog);
    expect(dialog).toHaveTextContent("Te mandamos un código al +54 9 11 •••• 6789. Vence en 10 minutos.");
    expect(dialog).toHaveTextContent("Llega al WhatsApp de tu celular. En WhatsApp Web no se muestra.");
    expect(within(dialog).getByRole("button", { name: "Verificar" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Reenviar en 45 s" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Usar otro número" })).toBeInTheDocument();
  });

  it("ties the code to where it went, since the focus jumps straight to the first box", async () => {
    // La descripción de un diálogo se lee al entrar en él, no cuando cambia: sin esto, el lector de pantalla dice
    // "Código, Código 1" y no a qué número llegó, que vence ni que en WhatsApp Web no se ve.
    linkWhatsAppServer();

    const dialog = await openAndSendNumber();

    const code = await within(dialog).findByRole("group", { name: "Código" });
    expect(code).toHaveAccessibleDescription(
      "Te mandamos un código al +54 9 11 •••• 6789. Vence en 10 minutos. " +
        "Llega al WhatsApp de tu celular. En WhatsApp Web no se muestra.",
    );
    expect(within(code).getByRole("textbox", { name: "Código 1" })).toHaveFocus();
  });

  it("links the number, closes and refreshes the profile", async () => {
    const calls = linkWhatsAppServer();

    const dialog = await openAndSendNumber();
    await within(dialog).findByRole("group", { name: "Código" });
    await typeCode(dialog, "482913");
    await userEvent.click(within(dialog).getByRole("button", { name: "Verificar" }));

    expect(await screen.findByText("Vinculamos tu WhatsApp.")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(calls.confirmations).toEqual([{ phone, code: "482913" }]);

    const region = screen.getByRole("region", { name: "Medios de ingreso" });
    expect(await within(region).findByText("+54 9 11 2345-6789")).toBeInTheDocument();
  });

  it("gives the focus back to the row, which now offers to unlink", async () => {
    // La cuenta tiene un correo verificado: con el número, la fila ofrece desvincularlo en el mismo lugar.
    linkWhatsAppServer();

    const dialog = await openAndSendNumber();
    await within(dialog).findByRole("group", { name: "Código" });
    await typeCode(dialog, "482913");
    await userEvent.click(within(dialog).getByRole("button", { name: "Verificar" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const region = screen.getByRole("region", { name: "Medios de ingreso" });
    await waitFor(() => expect(within(region).getByRole("button", { name: "Desvincular" })).toHaveFocus());
  });

  it("resends the code to the number the server read, and waits again", async () => {
    const calls = linkWhatsAppServer({ resendAfterSeconds: [0, 45] });

    const dialog = await openAndSendNumber();
    await userEvent.click(await within(dialog).findByRole("button", { name: "Reenviar código" }));

    // Con el "+" adelante, el servidor no necesita el país.
    await waitFor(() => expect(calls.codeRequests).toEqual([{ country: "AR", number: "11 2345-6789" }, { number: phone }]));
    expect(await within(dialog).findByRole("button", { name: "Reenviar en 45 s" })).toBeDisabled();
  });

  it("starts over with the new code after resending", async () => {
    linkWhatsAppServer({ resendAfterSeconds: [0, 45] });
    server.use(
      http.put("/api/me/whatsapp", () =>
        problem(400, { code: "Auth.LoginCode.Invalid", detail: "El código no es válido.", attemptsLeft: 3 }),
      ),
    );

    const dialog = await openAndSendNumber();
    await within(dialog).findByRole("group", { name: "Código" });
    await typeCode(dialog, "482915");
    await userEvent.click(within(dialog).getByRole("button", { name: "Verificar" }));
    await within(dialog).findByRole("alert");

    await userEvent.click(within(dialog).getByRole("button", { name: "Reenviar código" }));

    await waitFor(() => expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument());
    for (const box of within(dialog).getAllByRole("textbox")) {
      expect(box).toHaveValue("");
      expect(box).not.toHaveAttribute("aria-invalid");
    }
  });

  it("marks the boxes and says how many attempts are left when the code is wrong", async () => {
    linkWhatsAppServer();
    server.use(
      http.put("/api/me/whatsapp", () =>
        problem(400, { code: "Auth.LoginCode.Invalid", detail: "El código no es válido.", attemptsLeft: 3 }),
      ),
    );

    const dialog = await openAndSendNumber();
    await within(dialog).findByRole("group", { name: "Código" });
    await typeCode(dialog, "482915");
    await userEvent.click(within(dialog).getByRole("button", { name: "Verificar" }));

    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent("El código no es válido.");
    expect(alert).toHaveTextContent("Te quedan 3 intentos");
    for (const box of within(dialog).getAllByRole("textbox")) {
      expect(box).toHaveAttribute("aria-invalid", "true");
    }
    // El diálogo sigue abierto: se puede escribir otro.
    expect(screen.getByRole("dialog", { name: "Vincular WhatsApp" })).toBeInTheDocument();
  });

  it("takes the last error away while verifying again, so the same error is said again", async () => {
    // Dos fallas iguales seguidas (sin conexión, las dos veces): si el cartel quedara montado, el texto no cambiaría y
    // el lector de pantalla no diría nada la segunda vez; y mientras se verifica, se vería el error del intento
    // anterior. Como en el ingreso (LoginCodePage).
    linkWhatsAppServer();
    const second = heldResponse();
    let confirmations = 0;
    server.use(
      http.put("/api/me/whatsapp", async () => {
        confirmations++;

        if (confirmations === 2) {
          await second.released;
        }

        return HttpResponse.error();
      }),
    );

    const dialog = await openAndSendNumber();
    await within(dialog).findByRole("group", { name: "Código" });
    await typeCode(dialog, "482913");
    await userEvent.click(within(dialog).getByRole("button", { name: "Verificar" }));
    const firstAlert = await within(dialog).findByRole("alert");
    expect(firstAlert).toHaveTextContent("No pudimos conectarnos. Revisá tu conexión.");

    await userEvent.click(within(dialog).getByRole("button", { name: "Verificar" }));

    await waitFor(() => expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument());

    second.release();
    const secondAlert = await within(dialog).findByRole("alert");
    expect(secondAlert).toHaveTextContent("No pudimos conectarnos. Revisá tu conexión.");
    expect(secondAlert).not.toBe(firstAlert);
  });

  it("asks for another code when this one ran out of attempts", async () => {
    linkWhatsAppServer({ resendAfterSeconds: [0, 45] });
    server.use(
      http.put("/api/me/whatsapp", () =>
        problem(400, {
          code: "Auth.LoginCode.TooManyAttempts",
          detail: "Superaste los intentos para este código. Pedí uno nuevo.",
        }),
      ),
    );

    const dialog = await openAndSendNumber();
    await within(dialog).findByRole("group", { name: "Código" });
    await typeCode(dialog, "482915");
    await userEvent.click(within(dialog).getByRole("button", { name: "Verificar" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Superaste los intentos para este código. Pedí uno nuevo.",
    );
    // Los seis dígitos siguen escritos, pero este código ya no sirve: queda pedir otro.
    expect(within(dialog).getByRole("button", { name: "Verificar" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Reenviar código" })).toBeEnabled();

    await userEvent.click(within(dialog).getByRole("button", { name: "Reenviar código" }));
    await waitFor(() => expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument());
    await typeCode(dialog, "482913");

    expect(within(dialog).getByRole("button", { name: "Verificar" })).toBeEnabled();
  });

  it("waits the time the server says before resending", async () => {
    linkWhatsAppServer({ resendAfterSeconds: [0] });
    let requests = 0;
    server.use(
      http.post("/api/me/whatsapp/code", () => {
        requests++;

        return requests === 1
          ? HttpResponse.json({ resendAfterSeconds: 0, phone, maskedPhone }, { status: 202 })
          : problem(429, {
              code: "Auth.LoginCode.TooManyRequests",
              detail: "Pediste demasiados códigos. Probá de nuevo más tarde.",
              retryAfter: 42,
            });
      }),
    );

    const dialog = await openAndSendNumber();
    await userEvent.click(await within(dialog).findByRole("button", { name: "Reenviar código" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Pediste demasiados códigos. Probá de nuevo más tarde.",
    );
    expect(within(dialog).getByRole("button", { name: "Reenviar en 42 s" })).toBeDisabled();
  });

  it("says the number belongs to another account, only after a correct code", async () => {
    linkWhatsAppServer();
    server.use(
      http.put("/api/me/whatsapp", () =>
        problem(409, { code: "Users.Phone.AlreadyExists", detail: "Ya existe una cuenta con ese número." }),
      ),
    );

    const dialog = await openAndSendNumber();
    await within(dialog).findByRole("group", { name: "Código" });
    await typeCode(dialog, "482913");
    await userEvent.click(within(dialog).getByRole("button", { name: "Verificar" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Este número ya está vinculado a otra cuenta. Si es tuyo, pedile a un administrador que lo libere.",
    );
    // El código ya se gastó: verificar de nuevo no cambia nada. Queda usar otro número.
    expect(within(dialog).getByRole("button", { name: "Verificar" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Usar otro número" })).toBeEnabled();
  });

  it("shows what the server says about the number under the field", async () => {
    linkWhatsAppServer();
    server.use(http.post("/api/me/whatsapp/code", () => problem(400, { code: "Users.Phone.Invalid" })));

    const dialog = await openAndSendNumber("11 2345");

    const number = within(dialog).getByRole("textbox", { name: "Número de WhatsApp" });
    await waitFor(() => expect(number).toHaveAccessibleDescription("Ingresá un número de celular válido."));
    expect(number).toHaveAttribute("aria-invalid", "true");
  });

  it("forgets what the server said about the number when the country changes", async () => {
    // Un número que no es de un país casi siempre se arregla eligiendo el país: el reproche ya no vale.
    linkWhatsAppServer();
    server.use(http.post("/api/me/whatsapp/code", () => problem(400, { code: "Users.Phone.Invalid" })));

    const dialog = await openAndSendNumber();
    const number = within(dialog).getByRole("textbox", { name: "Número de WhatsApp" });
    await waitFor(() => expect(number).toHaveAttribute("aria-invalid", "true"));

    // Con teclado, como los demás desplegables de Radix en los tests (ver UserMenu.test.tsx).
    within(dialog).getByRole("combobox", { name: "País: Argentina, +54" }).focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.click(await screen.findByRole("option", { name: "Uruguay, +598" }));

    expect(number).not.toHaveAttribute("aria-invalid");
    expect(number).not.toHaveAccessibleDescription();
  });

  it("does not bring back an old error about the number when coming back from the code", async () => {
    // El primer pedido no prospera y el segundo, con el mismo número, sí: el error viejo no es de este número.
    const calls = linkWhatsAppServer();
    let requests = 0;
    server.use(
      http.post("/api/me/whatsapp/code", async ({ request }) => {
        requests++;
        calls.codeRequests.push(await request.json());

        return requests === 1
          ? problem(400, { code: "Users.Phone.Invalid" })
          : HttpResponse.json({ resendAfterSeconds: 45, phone, maskedPhone }, { status: 202 });
      }),
    );

    const dialog = await openAndSendNumber();
    await waitFor(() =>
      expect(within(dialog).getByRole("textbox", { name: "Número de WhatsApp" })).toHaveAttribute("aria-invalid", "true"),
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "Enviar código" }));
    await userEvent.click(await within(dialog).findByRole("button", { name: "Usar otro número" }));

    const number = within(dialog).getByRole("textbox", { name: "Número de WhatsApp" });
    expect(number).toHaveValue("11 2345-6789");
    expect(number).not.toHaveAttribute("aria-invalid");
    expect(number).not.toHaveAccessibleDescription();
  });

  it("waits the time the server says before asking again", async () => {
    linkWhatsAppServer();
    server.use(
      http.post("/api/me/whatsapp/code", () =>
        problem(429, {
          code: "Auth.LoginCode.TooManyRequests",
          detail: "Pediste demasiados códigos. Probá de nuevo más tarde.",
          retryAfter: 42,
        }),
      ),
    );

    const dialog = await openAndSendNumber();

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Pediste demasiados códigos. Probá de nuevo más tarde.",
    );
    expect(within(dialog).getByRole("button", { name: "Reintentá en 42 s" })).toBeDisabled();
  });

  it("goes back to the number, as it was typed, to use another one", async () => {
    linkWhatsAppServer();

    const dialog = await openAndSendNumber();
    await userEvent.click(await within(dialog).findByRole("button", { name: "Usar otro número" }));

    expect(within(dialog).getByRole("textbox", { name: "Número de WhatsApp" })).toHaveValue("11 2345-6789");
    expect(within(dialog).queryByRole("group", { name: "Código" })).not.toBeInTheDocument();
  });

  it("closes with Cancel without asking for anything", async () => {
    const calls = linkWhatsAppServer();

    const dialog = await openDialog("Vincular", "Vincular WhatsApp");
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(calls.codeRequests).toEqual([]);
  });
});

describe("adding an email", () => {
  beforeEach(() => {
    queryClient.clear();
  });

  async function openAndSendEmail(email = "ana@example.com") {
    const dialog = await openDialog("Agregar correo", "Agregar correo");
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Correo electrónico" }), email);
    await userEvent.click(within(dialog).getByRole("button", { name: "Enviar código" }));

    return dialog;
  }

  it("asks for the email", async () => {
    addEmailServer();

    const dialog = await openDialog("Agregar correo", "Agregar correo");

    expect(dialog).toHaveAccessibleDescription("Te mandamos un código a ese correo para comprobar que es tuyo.");
    expect(within(dialog).getByRole("textbox", { name: "Correo electrónico" })).toHaveAttribute("type", "email");
    expect(within(dialog).getByRole("button", { name: "Enviar código" })).toBeInTheDocument();
  });

  it("checks the email before sending", async () => {
    const calls = addEmailServer();

    const dialog = await openAndSendEmail("ana@");

    expect(within(dialog).getByRole("textbox", { name: "Correo electrónico" })).toHaveAccessibleDescription(
      "Ingresá un correo electrónico válido.",
    );
    expect(calls.codeRequests).toEqual([]);
  });

  it("adds the email with the code sent to it, closes and refreshes the profile", async () => {
    const calls = addEmailServer();

    const dialog = await openAndSendEmail();
    await within(dialog).findByRole("group", { name: "Código" });

    expect(calls.codeRequests).toEqual([{ email: "ana@example.com" }]);
    expect(dialog).toHaveTextContent("Te mandamos un código a ana@example.com. Vence en 10 minutos.");
    expect(within(dialog).getByRole("group", { name: "Código" })).toHaveAccessibleDescription(
      "Te mandamos un código a ana@example.com. Vence en 10 minutos.",
    );
    expect(within(dialog).getByRole("button", { name: "Usar otro correo" })).toBeInTheDocument();
    // El aviso de WhatsApp Web es solo del código por WhatsApp.
    expect(dialog).not.toHaveTextContent("WhatsApp Web");

    await typeCode(dialog, "482913");
    await userEvent.click(within(dialog).getByRole("button", { name: "Verificar" }));

    expect(await screen.findByText("Agregamos tu correo.")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(calls.confirmations).toEqual([{ email: "ana@example.com", code: "482913" }]);

    const region = screen.getByRole("region", { name: "Medios de ingreso" });
    expect(await within(region).findByText("ana@example.com")).toBeInTheDocument();
  });

  it("moves the focus to the title of the surface, since the button that opened it is gone", async () => {
    // Con el correo agregado, la fila ya no ofrece "Agregar correo": devolverle el foco a ese botón lo dejaría en
    // `<body>`, y el siguiente Tab arrancaría desde el principio de la página.
    addEmailServer();

    const dialog = await openAndSendEmail();
    await within(dialog).findByRole("group", { name: "Código" });
    await typeCode(dialog, "482913");
    await userEvent.click(within(dialog).getByRole("button", { name: "Verificar" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const region = screen.getByRole("region", { name: "Medios de ingreso" });
    expect(await within(region).findByText("ana@example.com")).toBeInTheDocument();
    await waitFor(() => expect(within(region).getByRole("heading", { name: "Medios de ingreso" })).toHaveFocus());
  });

  it("resends the code to the same email, and waits again", async () => {
    const calls = addEmailServer({ resendAfterSeconds: [0, 45] });

    const dialog = await openAndSendEmail();
    await userEvent.click(await within(dialog).findByRole("button", { name: "Reenviar código" }));

    await waitFor(() => expect(calls.codeRequests).toEqual([{ email: "ana@example.com" }, { email: "ana@example.com" }]));
    expect(await within(dialog).findByRole("button", { name: "Reenviar en 45 s" })).toBeDisabled();
  });

  it("says the email belongs to another account, only after a correct code", async () => {
    addEmailServer();
    server.use(
      http.put("/api/me/email", () =>
        problem(409, { code: "Users.User.AlreadyExists", detail: "Ya existe una cuenta con ese correo." }),
      ),
    );

    const dialog = await openAndSendEmail();
    await within(dialog).findByRole("group", { name: "Código" });
    await typeCode(dialog, "482913");
    await userEvent.click(within(dialog).getByRole("button", { name: "Verificar" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Este correo ya está en otra cuenta. Si es tuyo, pedile a un administrador que lo libere.",
    );
    expect(within(dialog).getByRole("button", { name: "Verificar" })).toBeDisabled();
  });

  it("shows what the validation says about the email under the field", async () => {
    addEmailServer();
    server.use(
      http.post("/api/me/email/code", () =>
        problem(400, {
          code: "Validation.Failed",
          detail: "Revisá los datos ingresados.",
          errors: { email: ["El correo es demasiado largo."] },
        }),
      ),
    );

    const dialog = await openAndSendEmail();

    await waitFor(() =>
      expect(within(dialog).getByRole("textbox", { name: "Correo electrónico" })).toHaveAccessibleDescription(
        "El correo es demasiado largo.",
      ),
    );
  });
});
