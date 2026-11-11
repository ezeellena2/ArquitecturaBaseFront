import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { useState } from "react";
import { MemoryRouter, useLocation } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Sidebar } from "./Sidebar";
import { Breadcrumbs } from "./Breadcrumbs";
import { FolderMenuNavigationContext, type FolderMenuContent, type FolderMenuEntry } from "../folderMenuNavigation";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { currentUser } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";

vi.mock("react-oidc-context", async () => {
  const actual = await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context");
  return { ...actual, useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "t" } }) };
});

const route = "0199a0c0-0000-7000-8000-0000000000a1";
const visit = "0199a0c0-0000-7000-8000-0000000000a2";
const invoice = "0199a0c0-0000-7000-8000-0000000000a3";
const content: FolderMenuContent = {
  sections: [{ id: "delivery", label: "Repartos", icon: "truck", links: [{ id: route, label: "Hoja de ruta", to: `/formularios/${route}/respuestas` }],
    groups: [{ id: "north", label: "Norte", links: [{ id: visit, label: "Visita", to: `/formularios/${visit}/respuestas` }] }] }],
  formsGroups: [{ id: "sowing", label: "Siembra", links: [{ id: route, label: "Hoja de ruta", to: `/formularios/${route}/respuestas` }] }],
  administrationGroups: [{ id: "billing", label: "Facturación", links: [{ id: invoice, label: "Factura", to: `/formularios/${invoice}/respuestas` }] }],
};

function Where() { return <p data-testid="where">{useLocation().pathname}</p>; }
function Shell({ state, collapsed = false, isMobile = false }: { state: Partial<{ content: FolderMenuContent; pending: boolean; failed: boolean; retry: () => void }>; collapsed?: boolean; isMobile?: boolean }) {
  const [entry, setEntry] = useState<FolderMenuEntry | null>(null);
  return (
    <FolderMenuNavigationContext.Provider value={{ content: state.content, pending: state.pending ?? false, failed: state.failed ?? false, retry: state.retry ?? (() => undefined), entry, enter: setEntry }}>
      <Breadcrumbs />
      <Sidebar collapsed={collapsed} onToggleCollapsed={vi.fn()} isMobile={isMobile} mobileOpen={isMobile} onCloseMobile={vi.fn()} />
      <Where />
    </FolderMenuNavigationContext.Provider>
  );
}
const renderShell = (props: Parameters<typeof Shell>[0], path = "/") => renderWithProviders(<MemoryRouter initialEntries={[path]}><Shell {...props} /></MemoryRouter>);

describe("the folders in the side menu (CP5-A)", () => {
  beforeEach(() => {
    server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["formrecords.read", "users.read"] })));
  });

  it("puts a menu of its own below Inicio that opens its panel, and keeps it open with the form marked after choosing it", async () => {
    renderShell({ state: { content } });
    const menu = await screen.findByRole("button", { name: "Repartos" });
    await userEvent.click(menu);
    const panel = screen.getByRole("navigation", { name: "Repartos" });
    expect(within(panel).getAllByRole("link").map(link => link.textContent)).toEqual(["Hoja de ruta"]);
    await userEvent.click(within(panel).getByRole("button", { name: "Norte" }));
    expect(within(panel).getByRole("link", { name: "Visita" })).toHaveAttribute("href", `/formularios/${visit}/respuestas`);
    await userEvent.click(within(panel).getByRole("link", { name: "Hoja de ruta" }));
    expect(screen.getByTestId("where")).toHaveTextContent(`/formularios/${route}/respuestas`);
    const open = screen.getByRole("navigation", { name: "Repartos" });
    expect(within(open).getByRole("link", { name: "Hoja de ruta" })).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("navigation", { name: "Gestión de formularios" })).not.toBeInTheDocument();
    const crumbs = within(screen.getByRole("navigation", { name: /migas de pan/i })).getAllByRole("listitem").map(item => item.textContent);
    expect(crumbs).toEqual(["Inicio", "Repartos", "Hoja de ruta"]);
  });

  it("adds a folder as a group at the end of «Gestión de formularios» and of «Administración»", async () => {
    renderShell({ state: { content } }, "/formularios/respuestas");
    const forms = await screen.findByRole("navigation", { name: "Gestión de formularios" });
    const groups = within(forms).getAllByRole("button").map(button => button.textContent);
    expect(groups.at(-1)).toBe("Siembra");
    await userEvent.click(within(forms).getByRole("button", { name: "Siembra" }));
    expect(within(forms).getByRole("link", { name: "Hoja de ruta" })).not.toHaveAttribute("aria-current");
    await userEvent.click(screen.getByRole("button", { name: /^administración$/i }));
    const admin = screen.getByRole("navigation", { name: "Administración" });
    expect(within(admin).getAllByRole("button").map(button => button.textContent).at(-1)).toBe("Facturación");
  });

  it("shows a menu of its own as its icon with its name when collapsed, and as a group of the drawer on the phone", async () => {
    const { unmount } = renderShell({ state: { content }, collapsed: true });
    await userEvent.click(await screen.findByRole("button", { name: "Repartos" }));
    expect(screen.getByRole("navigation", { name: "Repartos" })).toBeInTheDocument();
    unmount();
    renderShell({ state: { content }, isMobile: true });
    const group = await screen.findByRole("button", { name: "Repartos" });
    expect(group).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(group);
    expect(screen.getByRole("link", { name: "Hoja de ruta" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Norte" })).toBeInTheDocument();
  });

  // «Lo que carga no mueve lo que ya se ve» (2026-11-05): a block in the place of the menus of their own would leave when
  // there are none, the usual case, and lift «Gestión de formularios» and everything below it.
  it("keeps nothing in the place of the menus of their own while reading and offers Reintentar when it could not", async () => {
    const { unmount, container } = renderShell({ state: { pending: true } });
    // With the profile read, the rows that depend on it are there: the menu read alone adds no block.
    await screen.findByRole("button", { name: "Gestión de formularios" });
    expect(container.querySelectorAll("[data-slot='skeleton']")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Repartos" })).not.toBeInTheDocument();
    unmount();
    const retry = vi.fn();
    renderShell({ state: { failed: true, retry } });
    expect(await screen.findByText("No pudimos cargar tu menú.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(retry).toHaveBeenCalled();
  });
});
