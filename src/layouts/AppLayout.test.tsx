import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cancelSignOut } from "@/auth/signOutStatus";
import { queryClient } from "@/shared/api/queryClient";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";

const { endServerSession, removeUser } = vi.hoisted(() => ({ endServerSession: vi.fn(), removeUser: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/auth/accessRequests", async () => ({ ...await vi.importActual("@/auth/accessRequests"), endServerSession }));

vi.mock("react-oidc-context", async () => {
  const actual = await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context");

  return {
    ...actual,
    useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "t", id_token: "identity-token" }, removeUser }),
  };
});

// Igual que UserMenu.test.tsx: con teclado (foco + Enter), no userEvent.click, para no chocar con el
// pointerdown de Radix.
async function signOut() {
  const trigger = await screen.findByRole("button", { name: /ana/i });
  trigger.focus();
  await userEvent.keyboard("{Enter}");

  await userEvent.click(await screen.findByRole("menuitem", { name: /cerrar sesión/i }));
}

describe("AppLayout", () => {
  beforeEach(() => {
    queryClient.clear();
    endServerSession.mockReset();
  });

  afterEach(() => {
    // El store de signOutStatus es un módulo compartido (a propósito, para no sumar un provider): sin esto,
    // un cierre de sesión que quedó "en curso" en un test se filtra al siguiente.
    cancelSignOut();
  });

  it("shows the sign-out transition instead of the layout with empty data", async () => {
    // endServerSession real navega afuera de la SPA y nunca resuelve desde el punto de vista de React: una
    // promesa que no se resuelve reproduce eso.
    endServerSession.mockReturnValue(new Promise(() => {}));

    renderRouteWithProviders("/");

    expect(await screen.findByRole("complementary")).toBeInTheDocument();

    await signOut();

    expect(await screen.findByText("Cerrando sesión…")).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
    // Reemplaza todo el layout, no lo deja dibujado con los datos vacíos.
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });

  it("preserves the application shell when navigating away from home and back", async () => {
    const { router } = renderRouteWithProviders("/");
    const sidebar = await screen.findByRole("complementary");
    await act(() => router.navigate("/perfil"));
    await screen.findByRole("heading", { level: 1, name: "Mi perfil" });
    expect(screen.getByRole("complementary")).toBe(sidebar);
    await act(() => router.navigate("/"));
    await screen.findByRole("heading", { level: 1, name: "Inicio" });
    expect(screen.getByRole("complementary")).toBe(sidebar);
  });

  // Re Pág, Av Pág, Espacio y las flechas mueven lo que tiene el foco, y el que scrollea es `main`: con el foco en el
  // menú o en ninguna parte no movían nada hasta hacer clic en el contenido. jsdom no scrollea: acá se prueba que la
  // tecla le pasa el foco al contenido, y `design.spec` prueba en el navegador que la misma tecla lo mueve.
  it("hands the scrolling keys to the content while nothing has the focus", async () => {
    renderRouteWithProviders("/perfil");
    await screen.findByRole("heading", { level: 1, name: "Mi perfil" });
    expect(document.body).toHaveFocus();

    await userEvent.keyboard("{PageDown}");

    expect(screen.getByRole("main")).toHaveFocus();
  });

  it("hands the scrolling keys to the content from a link of the menu, Space included", async () => {
    renderRouteWithProviders("/perfil");
    const home = within(await screen.findByRole("complementary")).getByRole("link", { name: "Inicio" });

    home.focus();
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("main")).toHaveFocus();

    // Un enlace no usa Espacio: en una página común, Espacio baja la pantalla.
    home.focus();
    await userEvent.keyboard(" ");
    expect(screen.getByRole("main")).toHaveFocus();
  });

  it("leaves Space to a button of the menu, which it presses", async () => {
    renderRouteWithProviders("/perfil");
    // Con los permisos todavía en camino, en su lugar hay un bloque de carga.
    const administration = await within(await screen.findByRole("complementary")).findByRole("button", { name: "Administración" });
    const expanded = administration.getAttribute("aria-expanded");

    administration.focus();
    await userEvent.keyboard(" ");

    expect(administration).toHaveFocus();
    expect(administration).not.toHaveAttribute("aria-expanded", expanded);
  });

  // Ya pasaba antes del cambio; queda para que el contenido nunca le saque las teclas a un campo.
  it("leaves the keys to a field of the content", async () => {
    renderRouteWithProviders("/perfil");
    const name = await screen.findByRole("textbox", { name: /nombre/i });

    name.focus();
    await userEvent.keyboard("{Home}{PageDown}{ArrowUp} ");

    expect(name).toHaveFocus();
  });

  it("reverts the transition and lets the layout render again if signing out fails", async () => {
    // El rechazo (y el cancelSignOut del catch) puede resolverse en el mismo lote de microtareas que el
    // click: lo que importa es el estado final, no alcanzar a ver la transición a mitad de camino.
    endServerSession.mockRejectedValue(new Error("no se pudo cerrar la sesión"));

    renderRouteWithProviders("/");

    expect(await screen.findByRole("complementary")).toBeInTheDocument();

    await signOut();

    await waitFor(() => expect(screen.getByRole("complementary")).toBeInTheDocument());
    expect(screen.queryByText("Cerrando sesión…")).not.toBeInTheDocument();
  });
});
