import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, delay, http, type DefaultBodyType } from "msw";
import { StrictMode, type ReactNode } from "react";
import type { AuthContextProps } from "react-oidc-context";
import { RouterProvider, createMemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loginMethodsQueryKey, type LoginMethods } from "../api/loginCode";
import { AppProviders } from "@/app/providers";
import { routes } from "@/app/routes";
import { queryClient } from "@/shared/api/queryClient";
import { loginMethods } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";

/// Un redirect que sale bien no termina nunca: el navegador se va a `/connect/authorize` y la página deja de existir.
function leavesThePage() {
  return new Promise<void>(() => {});
}

// vi.hoisted porque el vi.mock de abajo se iza arriba de este archivo y ahí el mock todavía no existiría.
const { signinRedirect } = vi.hoisted(() => ({ signinRedirect: vi.fn((): Promise<void> => new Promise(() => {})) }));

// Lo único que se mira del OIDC acá es si, después del canje, el ingreso sigue con el redirect de siempre.
vi.mock("react-oidc-context", async () => {
  const actual = await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context");

  type AnonymousAuth = Pick<AuthContextProps, "isAuthenticated" | "isLoading" | "user" | "signinRedirect">;

  const auth: AnonymousAuth = { isAuthenticated: false, isLoading: false, user: undefined, signinRedirect };

  return {
    ...actual,
    AuthProvider: ({ children }: { children?: ReactNode }) => <>{children}</>,
    useAuth: () => auth as AuthContextProps,
  };
});

/// Un token con la forma de los de verdad: 32 bytes en base64url, 43 caracteres.
const token = "k7Qe2xV9-mB4_tLp0ZrH8sWc1YnJ6fGa3DuK5oXiE2q";

const ana = { displayName: "Ana Pérez", maskedPhone: "+54 9 11 •••• 6789" };

/// Otro enlace, de otra cuenta: el que llega después a la misma pestaña.
const otherToken = "Zp3Lm8Qw-Tx1_Rv6Ks0Nc4Hb7Yd2Fg9Ja5Ue1Wo3CiX";
const bruno = { displayName: "Bruno Díaz", maskedPhone: "+54 9 351 •••• 1234" };

/// La vista previa de cada enlace, según el token que llegó en el cuerpo.
function previewOf(body: DefaultBodyType) {
  return HttpResponse.json((body as { token?: string } | null)?.token === otherToken ? bruno : ana);
}

const whatsappOn: Partial<LoginMethods> = { whatsapp: true, whatsappCountries: ["AR"], whatsappNumber: "15551632662" };

const invalidLink = {
  status: 400,
  code: "Auth.LoginLink.Invalid",
  title: "Solicitud inválida",
  detail: "Este enlace ya no sirve.",
};

function problem(status: number, body: Record<string, unknown>) {
  return HttpResponse.json({ status, ...body }, { status });
}

function withLoginMethods(methods: Partial<LoginMethods>) {
  server.use(http.get("/account/login-methods", () => HttpResponse.json({ ...loginMethods, ...methods })));
}

type Respond = (body: DefaultBodyType) => Response | Promise<Response>;

/// Registra los cuerpos de los pedidos a un endpoint del enlace y responde lo que diga `respond`, que recibe el cuerpo.
function recordPosts(path: string, respond: Respond) {
  const bodies: DefaultBodyType[] = [];
  const urls: string[] = [];

  server.use(
    http.post(path, async ({ request }) => {
      const body = await request.json();
      urls.push(request.url);
      bodies.push(body);

      return respond(body);
    }),
  );

  return { bodies, urls };
}

function previewResponds(respond: Respond) {
  return recordPosts("/account/login-link/preview", respond);
}

function redeemResponds(respond: Respond) {
  return recordPosts("/account/login-link/redeem", respond);
}

/// Abre `/ingresar` como lo hace el botón Entrar del chat: el token en el fragmento de la barra de direcciones. La
/// barra es la de jsdom (`window.location`); el router de los tests es de memoria y no la mira.
function openLink(fragment = `#t=${token}`, historyState: unknown = null) {
  globalThis.history.replaceState(historyState, "", `/ingresar${fragment}`);

  return renderRouteWithProviders("/ingresar");
}

/// Una respuesta que llega cuando el test lo dice, para mirar la pantalla mientras el pedido está en vuelo.
function heldResponse() {
  let release = () => {};
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });

  return { released, release: () => release() };
}

/// Lo que hace el navegador cuando en la misma pestaña se abre otro enlace a `/ingresar` (pegado en la barra, o porque
/// reusa la pestaña): la dirección cambia solo en el fragmento, así que no recarga la página. Suma una entrada al
/// historial y avisa con `hashchange`, y la pantalla que ya estaba sigue montada.
function openAnotherLinkInTheSameTab(fragment: string) {
  globalThis.location.hash = fragment;
}

/// Lo que hace el navegador cuando trae la página de vuelta de su caché (bfcache), por ejemplo con Atrás.
function restoreFromBackForwardCache() {
  act(() => {
    globalThis.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
  });
}

/// Espera a que la pantalla haya recibido la respuesta de `login-methods`. Sin esto, "no aparece Volver a WhatsApp"
/// pasaría también mientras el pedido está en vuelo, y el test no probaría nada.
async function loginMethodsSettled() {
  await waitFor(() => expect(queryClient.getQueryState(loginMethodsQueryKey)?.status).not.toBe("pending"));
  // La consulta le avisa a la pantalla en el tick siguiente.
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
}

function storedValues(storage: Storage): string {
  return Array.from({ length: storage.length }, (_, index) => {
    const key = storage.key(index) ?? "";

    return `${key}=${storage.getItem(key) ?? ""}`;
  }).join("\n");
}

async function expectLinkNoLongerValid() {
  expect(await screen.findByRole("heading", { name: "Este enlace ya no sirve" })).toBeInTheDocument();
  expect(
    screen.getByText(
      "Los enlaces sirven una sola vez y vencen a los 10 minutos. Pedí otro desde el chat o entrá con tu número.",
    ),
  ).toBeInTheDocument();
  // Los botones aparecen cuando se sabe si hay chat al que volver (`login-methods`), así que se esperan.
  expect(await screen.findByRole("link", { name: "Ir al ingreso" })).toHaveAttribute("href", "/login");
  expect(screen.queryByRole("button", { name: "Continuar" })).not.toBeInTheDocument();
}

describe("LoginLinkPage", () => {
  // AppProviders usa el queryClient de la app (un singleton): sin esto, la vista previa y los medios de ingreso de
  // un test quedarían cacheados para el siguiente.
  beforeEach(() => {
    queryClient.clear();
    signinRedirect.mockReset();
    signinRedirect.mockImplementation(leavesThePage);
    globalThis.history.replaceState(null, "", "/");
  });

  describe("the token", () => {
    it("reads it from the fragment, takes it off the address bar and sends it in the body of the preview", async () => {
      const preview = previewResponds(() => HttpResponse.json(ana));
      // La entrada del historial es la del router del navegador (`createBrowserRouter` guarda ahí `idx` y `key`).
      const routerEntry = { idx: 0, key: "entrada" };
      const entries = globalThis.history.length;
      openLink(`#t=${token}`, routerEntry);

      expect(await screen.findByRole("heading", { name: "Entrar a Arquitectura Base" })).toBeInTheDocument();
      expect(preview.bodies).toEqual([{ token }]);
      // En la barra queda `/ingresar`, sin el fragmento.
      expect(globalThis.location.pathname).toBe("/ingresar");
      expect(globalThis.location.hash).toBe("");
      // Reemplazando la entrada (`history.replaceState`), no sumando otra: con una entrada nueva (`pushState` o
      // `location.hash = ""`), la anterior seguiría teniendo el token y Atrás lo traería de vuelta a la barra. Y sin
      // pisar el estado del router, que es de quien se lo pone.
      expect(globalThis.history.length).toBe(entries);
      expect(globalThis.history.state).toEqual(routerEntry);
      // Ni en la dirección del pedido, ni en la de la barra, ni guardado en el navegador: solo en memoria.
      expect(preview.urls.join()).not.toContain(token);
      expect(globalThis.location.href).not.toContain(token);
      expect(storedValues(globalThis.sessionStorage)).not.toContain(token);
      expect(storedValues(globalThis.localStorage)).not.toContain(token);
    });

    it("survives the double mount of StrictMode, although the first one already took it off the bar", async () => {
      const preview = previewResponds(() => HttpResponse.json(ana));
      globalThis.history.replaceState(null, "", `/ingresar#t=${token}`);

      // Como en desarrollo (`main.tsx`): StrictMode monta, desmonta y vuelve a montar, y el segundo montaje ya no
      // encuentra el token en la barra.
      render(
        <StrictMode>
          <AppProviders>
            <RouterProvider router={createMemoryRouter(routes, { initialEntries: ["/ingresar"] })} />
          </AppProviders>
        </StrictMode>,
      );

      expect(await screen.findByRole("button", { name: "Continuar" })).toBeEnabled();
      expect(preview.bodies).toContainEqual({ token });
      expect(globalThis.location.hash).toBe("");
    });

    it("reads a new link opened in the same tab, takes it off the bar too and signs in with that one", async () => {
      const preview = previewResponds(previewOf);
      const redeem = redeemResponds(() => new HttpResponse(null, { status: 204 }));
      openLink();

      await screen.findByText("Ana Pérez");

      openAnotherLinkInTheSameTab(`#t=${otherToken}`);

      // Emitir un enlace nuevo invalida el anterior: la pantalla pasa a hablar del nuevo, y no se queda con el viejo.
      await screen.findByText("Bruno Díaz");
      const account = screen.getByRole("group", { name: "Vas a entrar como" });
      expect(within(account).getByText("Bruno Díaz")).toBeInTheDocument();
      expect(screen.queryByText("Ana Pérez")).not.toBeInTheDocument();
      expect(preview.bodies).toEqual([{ token }, { token: otherToken }]);
      // Y tampoco el nuevo queda en la barra.
      expect(globalThis.location.hash).toBe("");
      expect(globalThis.location.href).not.toContain(otherToken);

      await userEvent.click(screen.getByRole("button", { name: "Continuar" }));

      await waitFor(() => expect(signinRedirect).toHaveBeenCalledTimes(1));
      expect(redeem.bodies).toEqual([{ token: otherToken }]);
    });

    it("reads a new link opened in the same tab after saying the previous one no longer works", async () => {
      const preview = previewResponds(previewOf);
      openLink("");

      await expectLinkNoLongerValid();

      // "Pedí otro desde el chat": el enlace nuevo puede llegar a esta misma pestaña.
      openAnotherLinkInTheSameTab(`#t=${otherToken}`);

      const account = await screen.findByRole("group", { name: "Vas a entrar como" });
      expect(within(account).getByText("Bruno Díaz")).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Este enlace ya no sirve" })).not.toBeInTheDocument();
      expect(preview.bodies).toEqual([{ token: otherToken }]);
      expect(globalThis.location.hash).toBe("");
    });

    it("says the link no longer works, without asking the server, when the address has no token", async () => {
      const preview = previewResponds(() => HttpResponse.json(ana));
      withLoginMethods(whatsappOn);
      openLink("");

      await expectLinkNoLongerValid();
      expect(preview.bodies).toEqual([]);
      // Es otra rama que la del enlace rechazado, y también ofrece volver al chat.
      expect(await screen.findByRole("link", { name: "Volver a WhatsApp" })).toHaveAttribute(
        "href",
        "https://wa.me/15551632662",
      );
    });

    it("draws the buttons once it knows whether there is a chat to go back to, so that none moves under a finger", async () => {
      const loginMethodsAnswer = heldResponse();
      server.use(
        http.get("/account/login-methods", async () => {
          await loginMethodsAnswer.released;

          return HttpResponse.json({ ...loginMethods, ...whatsappOn });
        }),
      );
      openLink("");

      // La pantalla ya dice qué pasó, pero todavía no ofrece nada: "Volver a WhatsApp" va arriba, y si llegara
      // después correría "Ir al ingreso" justo cuando la persona lo está por tocar.
      expect(await screen.findByRole("heading", { name: "Este enlace ya no sirve" })).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Ir al ingreso" })).not.toBeInTheDocument();

      loginMethodsAnswer.release();

      await screen.findByRole("link", { name: "Volver a WhatsApp" });
      expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual(["Volver a WhatsApp", "Ir al ingreso"]);
    });

    it("treats an empty token as no token", async () => {
      const preview = previewResponds(() => HttpResponse.json(ana));
      openLink("#t=");

      await expectLinkNoLongerValid();
      expect(preview.bodies).toEqual([]);
    });
  });

  describe("who is going to sign in", () => {
    it("shows a sober loading state while the preview is on its way, without waiting for a chunk", () => {
      previewResponds(async () => {
        await delay("infinite");

        return HttpResponse.json(ana);
      });
      openLink();

      // Sin `findBy`: las pantallas del ingreso no son `lazy`, así que la pantalla pinta en el mismo render.
      expect(screen.getByRole("status")).toHaveTextContent("Cargando…");
      expect(screen.queryByRole("button", { name: "Continuar" })).not.toBeInTheDocument();
    });

    it("shows the initial, the name and the masked number, and waits for Continuar", async () => {
      previewResponds(() => HttpResponse.json(ana));
      const redeem = redeemResponds(() => new HttpResponse(null, { status: 204 }));
      openLink();

      const account = await screen.findByRole("group", { name: "Vas a entrar como" });

      expect(within(account).getByText("A")).toBeInTheDocument();
      expect(within(account).getByText("Ana Pérez")).toBeInTheDocument();
      expect(within(account).getByText("+54 9 11 •••• 6789")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Continuar" })).toBeEnabled();
      expect(
        screen.getByText("¿No pediste entrar? Cerrá esta página: si no tocás Continuar, no pasa nada."),
      ).toBeInTheDocument();
      // Abrir el enlace no abre la sesión: eso lo hace Continuar.
      expect(redeem.bodies).toEqual([]);
      expect(signinRedirect).not.toHaveBeenCalled();
    });

    it("shows only the number when the account has no name", async () => {
      previewResponds(() => HttpResponse.json({ displayName: null, maskedPhone: "+54 9 11 •••• 6789" }));
      openLink();

      const account = await screen.findByRole("group", { name: "Vas a entrar como" });

      // Una sola vez, en el lugar del nombre; y la inicial es la primera cifra, no el "+".
      expect(within(account).getAllByText("+54 9 11 •••• 6789")).toHaveLength(1);
      expect(within(account).getByText("5")).toBeInTheDocument();
    });
  });

  describe("Continuar", () => {
    it("redeems the link once, although it is tapped twice, and then starts the sign-in", async () => {
      const order: string[] = [];
      previewResponds(() => HttpResponse.json(ana));
      const redeem = redeemResponds(() => {
        order.push("redeem");

        return new HttpResponse(null, { status: 204 });
      });
      signinRedirect.mockImplementation(() => {
        order.push("signinRedirect");

        return leavesThePage();
      });
      openLink();

      const continueButton = await screen.findByRole("button", { name: "Continuar" });

      // Dos clics en el mismo tick, como un doble toque. TanStack Query le avisa a la pantalla que el canje salió
      // recién en el tick siguiente, así que el segundo clic encuentra el botón todavía habilitado. `userEvent`
      // espera entre un clic y otro, y no lo mostraría.
      fireEvent.click(continueButton);
      fireEvent.click(continueButton);

      const status = await screen.findByRole("status");
      expect(within(status).getByRole("heading", { name: "Iniciando sesión…" })).toBeInTheDocument();
      expect(status).toHaveTextContent("Esto puede tardar unos segundos.");

      await waitFor(() => expect(signinRedirect).toHaveBeenCalledTimes(1));
      expect(signinRedirect).toHaveBeenCalledWith({ state: { returnTo: "/" } });
      expect(redeem.bodies).toEqual([{ token }]);
      expect(order).toEqual(["redeem", "signinRedirect"]);
    });

    it("says it is signing in while the redeem is on its way, without Continuar, and takes the focus there", async () => {
      previewResponds(() => HttpResponse.json(ana));
      const redeemAnswer = heldResponse();
      redeemResponds(async () => {
        await redeemAnswer.released;

        return new HttpResponse(null, { status: 204 });
      });
      openLink();

      await userEvent.click(await screen.findByRole("button", { name: "Continuar" }));

      // Todavía sin respuesta del canje: el pantallazo 2 es lo que se ve mientras corre, no lo que viene después.
      const status = await screen.findByRole("status");
      const title = within(status).getByRole("heading", { name: "Iniciando sesión…" });
      expect(status).toHaveTextContent("Esto puede tardar unos segundos.");
      expect(screen.queryByRole("button", { name: "Continuar" })).not.toBeInTheDocument();
      // El botón tocado se fue con la pantalla: el foco no cae en `<body>`, pasa al título del estado nuevo.
      expect(title).toHaveFocus();

      redeemAnswer.release();

      await waitFor(() => expect(signinRedirect).toHaveBeenCalledTimes(1));
    });

    it("does not stay signing in forever when the sign-in can not start", async () => {
      previewResponds(() => HttpResponse.json(ana));
      redeemResponds(() => new HttpResponse(null, { status: 204 }));
      signinRedirect.mockImplementation(() => Promise.reject(new Error("The metadata could not be loaded.")));
      openLink();

      await userEvent.click(await screen.findByRole("button", { name: "Continuar" }));

      expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos iniciar tu sesión.");
      // El servidor ya tiene la cookie: desde el ingreso, el OIDC entra sin pedir nada.
      expect(screen.getByRole("link", { name: "Ir al ingreso" })).toHaveAttribute("href", "/login");
      expect(screen.queryByRole("heading", { name: "Iniciando sesión…" })).not.toBeInTheDocument();
    });

    it("does not stay signing in forever when the sign-in resolves without leaving the page", async () => {
      previewResponds(() => HttpResponse.json(ana));
      redeemResponds(() => new HttpResponse(null, { status: 204 }));
      // Lo que hace react-oidc-context cuando el OIDC no puede arrancar (por ejemplo, no pudo leer el discovery):
      // no rechaza, avisa el error por su estado y resuelve. La página sigue acá.
      signinRedirect.mockImplementation(() => Promise.resolve());
      openLink();

      await userEvent.click(await screen.findByRole("button", { name: "Continuar" }));

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("No pudimos iniciar tu sesión.");
      expect(alert).toHaveFocus();
      expect(screen.getByRole("link", { name: "Ir al ingreso" })).toHaveAttribute("href", "/login");
      expect(screen.queryByRole("heading", { name: "Iniciando sesión…" })).not.toBeInTheDocument();
    });

    it("says the link was already used when the browser brings the page back after the sign-in", async () => {
      withLoginMethods(whatsappOn);
      previewResponds(() => HttpResponse.json(ana));
      redeemResponds(() => new HttpResponse(null, { status: 204 }));
      // Como `RedirectNavigator` de oidc-client-ts: se va, y resuelve recién si el navegador trae la página de vuelta
      // de su caché (Atrás desde el inicio, con la sesión ya abierta).
      signinRedirect.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            globalThis.addEventListener("pageshow", () => resolve(), { once: true });
          }),
      );
      openLink();

      await userEvent.click(await screen.findByRole("button", { name: "Continuar" }));
      await waitFor(() => expect(signinRedirect).toHaveBeenCalledTimes(1));

      restoreFromBackForwardCache();

      // El enlace ya se canjeó: lo mismo que diría la página recargada, que ya no tiene el token.
      await expectLinkNoLongerValid();
      expect(screen.queryByRole("heading", { name: "Iniciando sesión…" })).not.toBeInTheDocument();
    });

    it("signs in as usual when the browser brought the page back from its cache before Continuar", async () => {
      previewResponds(() => HttpResponse.json(ana));
      const redeem = redeemResponds(() => new HttpResponse(null, { status: 204 }));
      openLink();

      const continueButton = await screen.findByRole("button", { name: "Continuar" });

      // Se fue a otra página antes de entrar y volvió con Atrás: el enlace todavía no se usó.
      restoreFromBackForwardCache();
      await userEvent.click(continueButton);
      await waitFor(() => expect(signinRedirect).toHaveBeenCalledTimes(1));
      // La pantalla se entera de que el canje salió en el tick siguiente al redirect.
      await act(() => new Promise((resolve) => setTimeout(resolve, 0)));

      expect(redeem.bodies).toEqual([{ token }]);
      expect(screen.getByRole("heading", { name: "Iniciando sesión…" })).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Este enlace ya no sirve" })).not.toBeInTheDocument();
    });
  });

  describe("a link that no longer works", () => {
    it.each([
      ["expired, used, invalidated or made up", invalidLink],
      [
        "without the shape of a token",
        {
          status: 400,
          code: "Validation.Failed",
          title: "Solicitud inválida",
          detail: "Revisá los campos marcados.",
          errors: { token: ["El enlace está incompleto. Abrilo de nuevo desde el chat."] },
        },
      ],
    ])("says so when the preview rejects it (%s)", async (_case, body) => {
      withLoginMethods(whatsappOn);
      previewResponds(() => problem(400, body));
      openLink();

      await expectLinkNoLongerValid();
      expect(await screen.findByRole("link", { name: "Volver a WhatsApp" })).toHaveAttribute(
        "href",
        "https://wa.me/15551632662",
      );
      expect(signinRedirect).not.toHaveBeenCalled();
    });

    it("says so when the redeem rejects it", async () => {
      withLoginMethods(whatsappOn);
      previewResponds(() => HttpResponse.json(ana));
      redeemResponds(() => problem(400, invalidLink));
      openLink();

      await userEvent.click(await screen.findByRole("button", { name: "Continuar" }));

      await expectLinkNoLongerValid();
      expect(await screen.findByRole("link", { name: "Volver a WhatsApp" })).toHaveAttribute(
        "href",
        "https://wa.me/15551632662",
      );
      expect(signinRedirect).not.toHaveBeenCalled();
      // Llega por Continuar y no tiene región viva: el foco en el título es lo que hace que se lea.
      expect(screen.getByRole("heading", { name: "Este enlace ya no sirve" })).toHaveFocus();
    });

    it("does not offer to go back to WhatsApp when the server has no bot number", async () => {
      previewResponds(() => problem(400, invalidLink));
      openLink();

      await expectLinkNoLongerValid();
      await loginMethodsSettled();

      expect(screen.queryByRole("link", { name: "Volver a WhatsApp" })).not.toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Ir al ingreso" })).toBeInTheDocument();
    });
  });

  describe("an account that can not sign in", () => {
    it.each([
      [
        "disabled",
        403,
        "Auth.Account.Disabled",
        "Tu cuenta está deshabilitada. Contactá a un administrador.",
      ],
      [
        "locked out",
        429,
        "Auth.Account.LockedOut",
        "Tu cuenta está bloqueada por unos minutos por demasiados intentos fallidos.",
      ],
    ])("says it when the account is %s, after Continuar", async (_case, status, code, message) => {
      // Con el número del bot: sin él, "Volver a WhatsApp" no podría aparecer en ninguna pantalla, y mirar que no
      // está no probaría nada.
      withLoginMethods(whatsappOn);
      previewResponds(() => HttpResponse.json(ana));
      redeemResponds(() => problem(status, { code, title: "Error", detail: "Texto del servidor." }));
      openLink();

      await userEvent.click(await screen.findByRole("button", { name: "Continuar" }));

      const title = await screen.findByRole("heading", { name: "No podés entrar" });
      expect(title).toBeInTheDocument();
      expect(title).toHaveFocus();
      expect(screen.getByRole("alert")).toHaveTextContent(message);
      expect(screen.getByRole("link", { name: "Ir al ingreso" })).toHaveAttribute("href", "/login");
      expect(screen.queryByRole("button", { name: "Continuar" })).not.toBeInTheDocument();
      await loginMethodsSettled();
      expect(screen.queryByRole("link", { name: "Volver a WhatsApp" })).not.toBeInTheDocument();
      expect(signinRedirect).not.toHaveBeenCalled();
    });
  });

  describe("errors that pass", () => {
    it("asks to try again when the server limits the requests, and gives Continuar back when the wait is over", async () => {
      previewResponds(() => HttpResponse.json(ana));
      let redeems = 0;
      redeemResponds(() => {
        redeems += 1;

        return redeems === 1
          ? problem(429, {
              code: "Http.TooManyRequests",
              title: "Demasiadas solicitudes",
              detail: "Hiciste demasiadas solicitudes. Esperá un momento y volvé a intentar.",
              retryAfter: 1,
            })
          : new HttpResponse(null, { status: 204 });
      });
      openLink();

      await userEvent.click(await screen.findByRole("button", { name: "Continuar" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Hiciste demasiadas solicitudes. Esperá un momento y volvé a intentar.",
      );
      // Sigue en la misma pantalla, con la cuenta a la vista, y Continuar espera lo que dijo el servidor.
      expect(screen.getByRole("group", { name: "Vas a entrar como" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Reintentá en 1 s" })).toBeDisabled();

      const continueButton = await screen.findByRole("button", { name: "Continuar" }, { timeout: 2500 });
      expect(continueButton).toBeEnabled();

      await userEvent.click(continueButton);

      await waitFor(() => expect(signinRedirect).toHaveBeenCalledTimes(1));
      expect(redeems).toBe(2);
    });

    it("shows a generic error with the option to retry when the preview can not reach the server", async () => {
      let previews = 0;
      previewResponds(() => {
        previews += 1;

        return previews === 1 ? HttpResponse.error() : HttpResponse.json(ana);
      });
      openLink();

      expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos conectarnos. Revisá tu conexión.");
      // Sin reintentos solos: el error se muestra enseguida, y reintentar lo decide la persona.
      expect(previews).toBe(1);

      await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));

      expect(await screen.findByRole("group", { name: "Vas a entrar como" })).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it.each([
      ["arrives", () => HttpResponse.json(ana), "Entrar a Arquitectura Base"],
      ["says the link no longer works", () => problem(400, invalidLink), "Este enlace ya no sirve"],
      ["fails again", () => HttpResponse.error(), "Entrar a Arquitectura Base"],
    ])(
      "takes the focus to the title of what comes after Reintentar when the preview %s",
      async (_case, secondAnswer, heading) => {
        let previews = 0;
        previewResponds(() => {
          previews += 1;

          return previews === 1 ? HttpResponse.error() : secondAnswer();
        });
        openLink();

        expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos conectarnos. Revisá tu conexión.");
        // Al abrir la página, el foco no se mueve: nadie tocó nada todavía.
        expect(screen.getByRole("heading", { name: "Entrar a Arquitectura Base" })).not.toHaveFocus();

        await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));

        // El botón tocado se va con la pantalla: el foco no cae en `<body>`, pasa al título de lo que vino después.
        await waitFor(() => expect(screen.getByRole("heading", { name: heading })).toHaveFocus());
        expect(previews).toBe(2);
      },
    );

    it("waits what the server says before asking for the preview again when it limits the requests", async () => {
      let previews = 0;
      previewResponds(() => {
        previews += 1;

        return previews === 1
          ? problem(429, {
              code: "Http.TooManyRequests",
              title: "Demasiadas solicitudes",
              detail: "Hiciste demasiadas solicitudes. Esperá un momento y volvé a intentar.",
              retryAfter: 1,
            })
          : HttpResponse.json(ana);
      });
      openLink();

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Hiciste demasiadas solicitudes. Esperá un momento y volvé a intentar.",
      );
      // El texto pide esperar: el botón no invita a lo contrario, y dice cuánto falta.
      expect(screen.getByRole("button", { name: "Reintentá en 1 s" })).toBeDisabled();

      const retryButton = await screen.findByRole("button", { name: "Reintentar" }, { timeout: 2500 });
      expect(retryButton).toBeEnabled();

      await userEvent.click(retryButton);

      expect(await screen.findByRole("group", { name: "Vas a entrar como" })).toBeInTheDocument();
      expect(previews).toBe(2);
    });

    it("shows a generic error and keeps Continuar when the redeem can not reach the server", async () => {
      previewResponds(() => HttpResponse.json(ana));
      let redeems = 0;
      redeemResponds(() => {
        redeems += 1;

        return redeems === 1 ? HttpResponse.error() : new HttpResponse(null, { status: 204 });
      });
      openLink();

      await userEvent.click(await screen.findByRole("button", { name: "Continuar" }));

      expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos conectarnos. Revisá tu conexión.");
      // La cuenta vuelve a la vista después de "Iniciando sesión…": el foco va al título, y de ahí el Tab sigue.
      expect(screen.getByRole("heading", { name: "Entrar a Arquitectura Base" })).toHaveFocus();

      await userEvent.click(screen.getByRole("button", { name: "Continuar" }));

      await waitFor(() => expect(signinRedirect).toHaveBeenCalledTimes(1));
      expect(redeems).toBe(2);
    });
  });
});
