import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useSyncExternalStore, type ReactNode } from "react";
import type { User } from "oidc-client-ts";
import type { AuthContextProps } from "react-oidc-context";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppProviders } from "@/app/providers";
import { routes } from "@/app/routes";
import { queryClient } from "@/shared/api/queryClient";

const channelName = "arquitecturabase.sign-out";

/// Un BroadcastChannel como el del navegador, que jsdom no trae: entrega en otra tarea a los canales del mismo
/// nombre abiertos al momento de mandar, nunca al que manda, y no guarda nada para los que se abren después.
class FakeBroadcastChannel {
  static readonly open = new Set<FakeBroadcastChannel>();
  readonly name: string;
  readonly received: unknown[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;

  constructor(name: string) {
    this.name = name;
    FakeBroadcastChannel.open.add(this);
  }

  postMessage(data: unknown): void {
    if (!FakeBroadcastChannel.open.has(this)) {
      throw new DOMException("The channel is closed.", "InvalidStateError");
    }

    for (const target of FakeBroadcastChannel.open) {
      if (target !== this && target.name === this.name) {
        setTimeout(() => {
          if (FakeBroadcastChannel.open.has(target)) {
            target.received.push(data);
            target.onmessage?.(new MessageEvent("message", { data }));
          }
        });
      }
    }
  }

  close(): void {
    FakeBroadcastChannel.open.delete(this);
  }
}

const { endServerSession, waitForSessionRenewal } = vi.hoisted(() => ({
  endServerSession: vi.fn<(idToken: string | undefined) => Promise<void>>(),
  waitForSessionRenewal: vi.fn<() => Promise<void>>(),
}));
vi.mock("@/auth/accessRequests", async () => ({ ...await vi.importActual("@/auth/accessRequests"), endServerSession }));
vi.mock("@/shared/api/httpClient", async () => ({ ...await vi.importActual("@/shared/api/httpClient"), waitForSessionRenewal }));

// Una pantalla de la sesión que falla al dibujarse: su error lo toma el límite de la rama de `SessionRecovery`.
vi.mock("@/app/AuthenticatedHome", () => ({
  AuthenticatedHome: () => {
    throw new Error("The home screen could not be rendered.");
  },
}));

const signinSilent = vi.fn<() => Promise<User | null>>();
const removeUser = vi.fn<() => Promise<void>>();

type FakeAuth = Pick<AuthContextProps, "isAuthenticated" | "isLoading" | "activeNavigator" | "user" | "signinSilent" | "removeUser">;

/// La sesión como la publica react-oidc-context: un objeto nuevo en cada cambio, que vuelve a dibujar a quien la usa.
let auth: FakeAuth;
const authListeners = new Set<() => void>();

function setAuth(changes: Partial<FakeAuth>): void {
  auth = { ...auth, ...changes };

  for (const listener of authListeners) {
    listener();
  }
}

function subscribeToAuth(listener: () => void): () => void {
  authListeners.add(listener);

  return () => authListeners.delete(listener);
}

function useFakeAuth(): AuthContextProps {
  return useSyncExternalStore(subscribeToAuth, () => auth) as AuthContextProps;
}

function signedInUser(): User {
  return { access_token: "token-123", id_token: "identity-token" } as User;
}

// Como en SessionRecovery.test: el AuthProvider real armaría un UserManager y saldría a la red.
vi.mock("react-oidc-context", async () => {
  const actual = await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context");

  return {
    ...actual,
    AuthProvider: ({ children }: { children?: ReactNode }) => <>{children}</>,
    useAuth: () => useFakeAuth(),
  };
});

/// La app entera, como `renderRouteWithProviders`, pero con el `RouterProvider` de producción (`react-router/dom`):
/// el cierre confirma `/login` con `flushSync`, y sin él gana el `returnTo` del guard.
function renderApp(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });

  return { router, ...render(<AppProviders><RouterProvider router={router} /></AppProviders>) };
}

/// Lo que haría otra pestaña del mismo navegador con su propio canal.
function openOtherTab(): FakeBroadcastChannel {
  return new FakeBroadcastChannel(channelName);
}

/// Deja correr las entregas pendientes del canal, que salen en otra tarea.
async function deliverPendingMessages(): Promise<void> {
  await act(() => new Promise((resolve) => setTimeout(resolve, 10)));
}

async function signOutFromTheMenu(): Promise<void> {
  const trigger = await screen.findByRole("button", { name: "Menú de Ana" });
  trigger.focus();
  await userEvent.keyboard("{Enter}");
  await userEvent.click(await screen.findByRole("menuitem", { name: "Cerrar sesión" }));
}

/// Una recuperación silenciosa que se completa a mano, como la marca react-oidc-context: cargando y con `signinSilent`
/// como navegador activo hasta que llega el usuario, o hasta que termina sin sesión.
function recoverSessionByHand(): { complete: (user: User | null) => void } {
  let finish: (user: User | null) => void = () => {
    throw new Error("signinSilent has not been called yet: there is no recovery in progress to complete.");
  };
  signinSilent.mockImplementation(() => {
    setAuth({ isLoading: true, activeNavigator: "signinSilent" });

    return new Promise<User | null>((resolve) => {
      finish = (user) => {
        setAuth({ isAuthenticated: user !== null, isLoading: false, activeNavigator: undefined, user: user ?? undefined });
        resolve(user);
      };
    });
  });

  return { complete: (user) => act(() => finish(user)) };
}

describe("sign-out across tabs", () => {
  beforeEach(() => {
    queryClient.clear();
    vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
    auth = { isAuthenticated: true, isLoading: false, activeNavigator: undefined, user: signedInUser(), signinSilent, removeUser };
    signinSilent.mockReset().mockResolvedValue(null);
    removeUser.mockReset().mockImplementation(() => {
      setAuth({ isAuthenticated: false, user: undefined });

      return Promise.resolve();
    });
    endServerSession.mockReset().mockResolvedValue(undefined);
    waitForSessionRenewal.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    FakeBroadcastChannel.open.clear();
    authListeners.clear();
    // El Toaster es uno solo: el error de un test no puede aparecer en el siguiente.
    toast.dismiss();
  });

  it("closes this tab, revoking its own authorization, when another tab signs out", async () => {
    const { router } = renderApp("/perfil");
    await screen.findByRole("button", { name: "Menú de Ana" });
    const otherTab = openOtherTab();

    otherTab.postMessage("signed-out");

    // Como el cierre voluntario, termina en `/login` sin `returnTo`: el próximo ingreso no vuelve a la pantalla de
    // la cuenta anterior.
    await waitFor(() => expect(router.state.location).toMatchObject({ pathname: "/login", state: null }));
    // Su propia autorización, con su id_token_hint: la de la otra pestaña ya la revocó el servidor.
    expect(endServerSession).toHaveBeenCalledExactlyOnceWith("identity-token");
    expect(removeUser).toHaveBeenCalledOnce();
    // Y no vuelve a avisar: sin bucles entre pestañas.
    await deliverPendingMessages();
    expect(otherTab.received).toEqual([]);
  });

  it("still closes this tab when its own revocation fails", async () => {
    endServerSession.mockRejectedValue(new Error("The server session could not be closed."));
    const { router } = renderApp("/perfil");
    await screen.findByRole("button", { name: "Menú de Ana" });

    openOtherTab().postMessage("signed-out");

    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
    expect(removeUser).toHaveBeenCalledOnce();
  });

  it("closes a tab that is on the page that does not exist", async () => {
    const { router } = renderApp("/no-existe");
    await screen.findByRole("heading", { name: "No encontramos esta página" });

    openOtherTab().postMessage("signed-out");

    // Si no, al volver atrás seguiría adentro con la cuenta anterior.
    await waitFor(() => expect(router.state.location).toMatchObject({ pathname: "/login", state: null }));
    expect(endServerSession).toHaveBeenCalledExactlyOnceWith("identity-token");
    expect(removeUser).toHaveBeenCalledOnce();
  });

  it("keeps listening when a session screen fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      const { router } = renderApp("/");
      await screen.findByRole("heading", { name: "No pudimos abrir esta pantalla" });

      openOtherTab().postMessage("signed-out");

      await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
      expect(endServerSession).toHaveBeenCalledExactlyOnceWith("identity-token");
      expect(removeUser).toHaveBeenCalledOnce();
    } finally {
      consoleError.mockRestore();
    }
  });

  it("closes the session that a recovery in progress brings back after the notice", async () => {
    setAuth({ isAuthenticated: false, user: undefined });
    const recovery = recoverSessionByHand();
    const { router } = renderApp("/perfil");
    await waitFor(() => expect(signinSilent).toHaveBeenCalledOnce());

    openOtherTab().postMessage("signed-out");
    await deliverPendingMessages();
    // Todavía no hay nada que revocar: el id_token llega con el usuario.
    expect(endServerSession).not.toHaveBeenCalled();
    recovery.complete(signedInUser());

    await waitFor(() => expect(router.state.location).toMatchObject({ pathname: "/login", state: null }));
    expect(endServerSession).toHaveBeenCalledExactlyOnceWith("identity-token");
    expect(removeUser).toHaveBeenCalledOnce();
  });

  it("does not close a session that comes in after the notice", async () => {
    // La recuperación termina sin sesión: el aviso no queda pendiente para el ingreso que viene después.
    setAuth({ isAuthenticated: false, user: undefined });
    const recovery = recoverSessionByHand();
    const { router } = renderApp("/perfil");
    await waitFor(() => expect(signinSilent).toHaveBeenCalledOnce());
    openOtherTab().postMessage("signed-out");
    await deliverPendingMessages();
    recovery.complete(null);
    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));

    act(() => setAuth({ isAuthenticated: true, user: signedInUser() }));
    await act(() => router.navigate("/perfil"));
    await screen.findByRole("button", { name: "Menú de Ana" });
    await deliverPendingMessages();

    expect(endServerSession).not.toHaveBeenCalled();
    expect(removeUser).not.toHaveBeenCalled();
    expect(router.state.location.pathname).toBe("/perfil");
  });

  it("tells the other tabs once when this tab signs out, after the server closed the session", async () => {
    const otherTab = openOtherTab();
    const { router } = renderApp("/perfil");
    await screen.findByRole("button", { name: "Menú de Ana" });
    const thisTab = [...FakeBroadcastChannel.open].find((channel) => channel !== otherTab);

    await signOutFromTheMenu();

    await waitFor(() => expect(router.state.location).toMatchObject({ pathname: "/login", state: null }));
    await deliverPendingMessages();
    expect(otherTab.received).toEqual(["signed-out"]);
    // El aviso sale por el canal en el que escucha esta pestaña, que no se lo entrega a sí mismo: por otro, le llegaría.
    expect(thisTab?.received).toEqual([]);
    expect(endServerSession).toHaveBeenCalledOnce();
  });

  it("does not tell the other tabs when the server could not close the session", async () => {
    endServerSession.mockRejectedValue(new Error("The server session could not be closed."));
    const otherTab = openOtherTab();
    const { router } = renderApp("/perfil");

    await signOutFromTheMenu();

    expect(await screen.findByText("No pudimos cerrar la sesión. Probá de nuevo.")).toBeInTheDocument();
    await deliverPendingMessages();
    expect(otherTab.received).toEqual([]);
    expect(router.state.location.pathname).toBe("/perfil");
  });

  it("still closes this tab when its own sign-out fails after another tab signed out", async () => {
    let failOwnSignOut: () => void = () => {
      throw new Error("endServerSession has not been called yet.");
    };
    endServerSession.mockImplementationOnce(() => new Promise<void>((_, reject) => {
      failOwnSignOut = () => reject(new Error("The server session could not be closed."));
    }));
    const otherTab = openOtherTab();
    const { router } = renderApp("/perfil");
    await signOutFromTheMenu();
    await waitFor(() => expect(endServerSession).toHaveBeenCalledOnce());

    otherTab.postMessage("signed-out");
    await deliverPendingMessages();
    failOwnSignOut();

    // La cookie ya la borró la otra pestaña: esta cierra de forma local, sin el error y sin volver a avisar.
    await waitFor(() => expect(router.state.location).toMatchObject({ pathname: "/login", state: null }));
    expect(removeUser).toHaveBeenCalledOnce();
    expect(screen.queryByText("No pudimos cerrar la sesión. Probá de nuevo.")).not.toBeInTheDocument();
    await deliverPendingMessages();
    expect(otherTab.received).toEqual([]);
    expect(endServerSession).toHaveBeenCalledOnce();
  });

  it("waits for a session renewal in flight before dropping the tokens", async () => {
    let finishRenewal: () => void = () => undefined;
    waitForSessionRenewal.mockImplementationOnce(() => new Promise<void>((resolve) => {
      finishRenewal = resolve;
    }));
    const { router } = renderApp("/perfil");

    await signOutFromTheMenu();
    await waitFor(() => expect(waitForSessionRenewal).toHaveBeenCalledOnce());

    // La renovación guardaría el usuario después de borrarlo: los tokens se dejan cuando terminó.
    expect(removeUser).not.toHaveBeenCalled();
    finishRenewal();
    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
    expect(removeUser).toHaveBeenCalledOnce();
  });

  it("ignores the notice in a tab without a session", async () => {
    setAuth({ isAuthenticated: false, user: undefined });
    const { router } = renderApp("/");
    await waitFor(() => expect(signinSilent).toHaveBeenCalledOnce());

    openOtherTab().postMessage("signed-out");
    await deliverPendingMessages();

    expect(endServerSession).not.toHaveBeenCalled();
    expect(router.state.location.pathname).toBe("/");
  });

  it("closes its channel when the app unmounts", async () => {
    const { unmount } = renderApp("/perfil");
    await screen.findByRole("button", { name: "Menú de Ana" });
    expect(FakeBroadcastChannel.open.size).toBe(1);

    unmount();

    expect(FakeBroadcastChannel.open.size).toBe(0);
  });

  it("signs out without telling anyone when the browser has no BroadcastChannel", async () => {
    vi.stubGlobal("BroadcastChannel", undefined);
    const { router } = renderApp("/perfil");

    await signOutFromTheMenu();

    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
    expect(endServerSession).toHaveBeenCalledExactlyOnceWith("identity-token");
  });
});
