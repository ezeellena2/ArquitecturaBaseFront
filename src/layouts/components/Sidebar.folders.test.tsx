import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { useState, type RefObject } from "react";
import { MemoryRouter, useLocation } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { Sidebar } from "./Sidebar";
import { Breadcrumbs } from "./Breadcrumbs";
import { FolderMenuNavigationContext, type FolderMenuAction, type FolderMenuContent, type FolderMenuEntry, type FolderMenuGroup, type FolderMenuSection } from "../folderMenuNavigation";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { currentUser } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";

vi.mock("react-oidc-context", async () => {
  const actual = await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context");
  return { ...actual, useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "t" } }) };
});

const route = "0199a0c0-0000-7000-8000-0000000000a1";
const visit = "0199a0c0-0000-7000-8000-0000000000a2";
const north: FolderMenuGroup = { id: "north", label: "Norte", revision: 1, links: [{ id: visit, label: "Visita", to: `/formularios/${visit}/respuestas` }] };
const south: FolderMenuGroup = { id: "south", label: "Sur", revision: 1, links: [] };
const delivery: FolderMenuSection = { id: "delivery", label: "Repartos", icon: "truck", revision: 1, catalogCount: 0,
  links: [{ id: route, label: "Hoja de ruta", to: `/formularios/${route}/respuestas` }], groups: [north] };
const purchases: FolderMenuSection = { id: "purchases", label: "Compras", icon: "package", revision: 1, catalogCount: 0, links: [], groups: [] };
const sowing: FolderMenuSection = { id: "sowing", label: "Siembra", icon: "leaf", revision: 1, catalogCount: 1234, links: [], groups: [south] };
// Whoever only loads gets the folders with something to open; whoever administers, every folder, also the empty ones (CM1).
const loads: FolderMenuContent = { canManage: false, menus: [delivery] };
const manages: FolderMenuContent = { canManage: true, menus: [purchases, { ...delivery, groups: [north, south] }, sowing] };
const administers = ["formrecords.read", "formtemplates.read", "formtemplates.manage"];

type Actor = (action: FolderMenuAction, returnFocus: RefObject<HTMLElement | null>) => void;
// Where the focus goes back when the dialog closes: what asked for it, while it is in the document.
const back = (element: unknown) => expect.objectContaining({ current: element });
interface State { content?: FolderMenuContent; pending?: boolean; failed?: boolean; retry?: () => void; act?: Actor; created?: string | null }
interface ShellProps { state: State; collapsed?: boolean; isMobile?: boolean; onCloseMobile?: () => void; sidebarKey?: number }

function Where() { return <p data-testid="where">{useLocation().pathname}</p>; }
function Shell({ state, collapsed = false, isMobile = false, onCloseMobile = vi.fn(), sidebarKey = 1 }: ShellProps) {
  const [entry, setEntry] = useState<FolderMenuEntry | null>(null);
  return (
    <FolderMenuNavigationContext.Provider value={{ content: state.content, pending: state.pending ?? false, failed: state.failed ?? false,
      retry: state.retry ?? (() => undefined), entry, enter: setEntry, act: state.act, created: state.created ?? null }}>
      <Breadcrumbs />
      <Sidebar key={sidebarKey} collapsed={collapsed} onToggleCollapsed={vi.fn()} isMobile={isMobile} mobileOpen={isMobile} onCloseMobile={onCloseMobile} />
      <Where />
    </FolderMenuNavigationContext.Provider>
  );
}
const tree = (props: ShellProps, path = "/") => <MemoryRouter initialEntries={[path]}><Shell {...props} /></MemoryRouter>;
const renderShell = (props: ShellProps, path = "/") => renderWithProviders(tree(props, path));
const signIn = (permissions: string[]) => server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions })));
// Radix leaves the page without pointer events for a moment after a menu closes.
const user = () => userEvent.setup({ pointerEventsCheck: 0 });
const mainMenu = () => screen.findByRole("navigation", { name: "Navegación principal" });
const listOf = (branch: HTMLElement) => document.getElementById(branch.getAttribute("aria-controls") ?? "") as HTMLElement;

describe("the folders are menus of the side menu (CM1 to CM6)", () => {
  it("go after WhatsApp and before Administración, in the order the server sends them and in a section of their own", async () => {
    signIn([...administers, "whatsapp.read", "users.read"]);
    renderShell({ state: { content: manages, act: vi.fn() } });
    const nav = await mainMenu();
    await within(nav).findByRole("button", { name: "Administración" });
    expect([...nav.querySelectorAll("a, button")].map(element => element.textContent))
      .toEqual(["Inicio", "Gestión de formularios", "WhatsApp", "Compras", "Repartos", "Siembra", "Nueva carpeta", "Administración"]);
    // The line of always separates them from WhatsApp and from Administración.
    const section = within(nav).getByRole("button", { name: "Compras" }).closest(".border-t");
    expect(section).toContainElement(within(nav).getByRole("button", { name: "Nueva carpeta" }));
    expect(section).not.toContainElement(within(nav).getByRole("button", { name: "WhatsApp" }));
    expect(section).not.toContainElement(within(nav).getByRole("button", { name: "Administración" }));
  });

  it("offer whoever administers «Nueva carpeta», the ⋮, «Agregar formularios» and what is empty", async () => {
    signIn(administers);
    renderShell({ state: { content: manages, act: vi.fn() } });
    await user().click(await screen.findByRole("button", { name: "Compras" }));
    let panel = screen.getByRole("navigation", { name: "Compras" });
    expect(within(panel).getByRole("button", { name: "Acciones de «Compras»" })).toBeInTheDocument();
    expect(within(panel).getByText("Todavía no hay formularios en «Compras»")).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Agregar formularios" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nueva carpeta" })).toBeInTheDocument();
    // Without a form, neither its own nor in its groups, it leads to its catalogs instead of saying it is empty.
    await user().click(screen.getByRole("button", { name: "Siembra" }));
    panel = screen.getByRole("navigation", { name: "Siembra" });
    expect(within(panel).getByRole("link", { name: "Ver sus 1.234 catálogos" })).toHaveAttribute("href", "/catalogos?carpeta=sowing");
    expect(within(panel).queryByText(/Todavía no hay formularios/)).not.toBeInTheDocument();
    // An empty subfolder has its ⋮ and its own «Agregar formularios» inside its group.
    const group = within(panel).getByRole("button", { name: "Sur" });
    expect(within(panel).getByRole("button", { name: "Acciones de «Sur»" })).toBeInTheDocument();
    await user().click(group);
    expect(within(listOf(group)).getByRole("button", { name: "Agregar formularios" })).toBeInTheDocument();
  });

  it("show whoever only loads none of that and nothing empty", async () => {
    signIn(["formrecords.create"]);
    renderShell({ state: { content: loads } });
    await user().click(await screen.findByRole("button", { name: "Repartos" }));
    const panel = screen.getByRole("navigation", { name: "Repartos" });
    await user().click(within(panel).getByRole("button", { name: "Norte" }));
    expect(within(panel).getByRole("link", { name: "Visita" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Nueva carpeta" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Acciones de/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Agregar formularios" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Todavía no hay formularios/)).not.toBeInTheDocument();
  });

  it("ask app for each action with its kind, its folder and the element the focus goes back to", async () => {
    signIn(administers);
    const act = vi.fn<Actor>();
    renderShell({ state: { content: manages, act } });
    const actor = user();
    const create = await screen.findByRole("button", { name: "Nueva carpeta" });
    await actor.click(create);
    expect(act).toHaveBeenLastCalledWith({ kind: "create" }, back(create));
    await actor.click(screen.getByRole("button", { name: "Repartos" }));
    const panel = screen.getByRole("navigation", { name: "Repartos" });
    const choose = async (trigger: HTMLElement, item: string | RegExp) => {
      await actor.click(trigger);
      await actor.click(await screen.findByRole("menuitem", { name: item }));
    };
    const folder = within(panel).getByRole("button", { name: "Acciones de «Repartos»" });
    await choose(folder, "Editar…");
    expect(act).toHaveBeenLastCalledWith({ kind: "edit", folderId: "delivery" }, back(folder));
    await choose(folder, "Nueva subcarpeta…");
    expect(act).toHaveBeenLastCalledWith({ kind: "createSubfolder", parentId: "delivery" }, back(folder));
    await choose(folder, "Borrar");
    expect(act).toHaveBeenLastCalledWith({ kind: "delete", folderId: "delivery" }, back(folder));
    // With subfolders it cannot go into another one: «Mover a…» is off, with its reason.
    await actor.click(folder);
    const move = await screen.findByRole("menuitem", { name: /^Mover a…/ });
    expect(move).toHaveAttribute("aria-disabled", "true");
    expect(move).toHaveTextContent("Tiene subcarpetas: no puede ir adentro de otra.");
    act.mockClear();
    await actor.click(move);
    expect(act).not.toHaveBeenCalled();
    await actor.keyboard("{Escape}");
    const group = within(panel).getByRole("button", { name: "Acciones de «Norte»" });
    await choose(group, "Editar…");
    expect(act).toHaveBeenLastCalledWith({ kind: "edit", folderId: "north" }, back(group));
    await choose(group, "Agregar formularios…");
    expect(act).toHaveBeenLastCalledWith({ kind: "addForms", folderId: "north" }, back(group));
    await choose(group, "Mover a…");
    expect(act).toHaveBeenLastCalledWith({ kind: "move", folderId: "north" }, back(group));
    await choose(group, "Borrar");
    expect(act).toHaveBeenLastCalledWith({ kind: "delete", folderId: "north" }, back(group));
    const add = within(panel).getByRole("button", { name: "Agregar formularios" });
    await actor.click(add);
    expect(act).toHaveBeenLastCalledWith({ kind: "addForms", folderId: "delivery" }, back(add));
    // A folder without subfolders can move.
    await actor.click(screen.getByRole("button", { name: "Compras" }));
    await choose(within(screen.getByRole("navigation", { name: "Compras" })).getByRole("button", { name: "Acciones de «Compras»" }), "Mover a…");
    expect(act).toHaveBeenLastCalledWith({ kind: "move", folderId: "purchases" }, back(expect.any(HTMLElement)));
  });

  it("are their icons with their names in a tooltip when collapsed, and «Nueva carpeta» is a +", async () => {
    signIn(administers);
    // One tooltip per drawing: in jsdom the first one keeps the pointer's grace area and the next one does not open.
    const first = renderShell({ state: { content: manages, act: vi.fn() }, collapsed: true });
    const actor = user();
    await actor.hover(await screen.findByRole("button", { name: "Nueva carpeta" }));
    expect(await screen.findByRole("tooltip", { name: "Nueva carpeta" })).toBeInTheDocument();
    first.unmount();
    renderShell({ state: { content: manages, act: vi.fn() }, collapsed: true });
    const folder = await screen.findByRole("button", { name: "Repartos" });
    await actor.hover(folder);
    expect(await screen.findByRole("tooltip", { name: "Repartos" })).toBeInTheDocument();
    await actor.click(folder);
    expect(screen.getByRole("navigation", { name: "Repartos" })).toBeInTheDocument();
  });

  it("are groups of the drawer, with their forms, their subfolders and the ⋮ of each for whoever administers", async () => {
    signIn(administers);
    const onCloseMobile = vi.fn();
    renderShell({ state: { content: manages, act: vi.fn() }, isMobile: true, onCloseMobile });
    const actor = user();
    const folder = await screen.findByRole("button", { name: "Repartos" });
    expect(folder).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "Acciones de «Repartos»" })).toBeInTheDocument();
    await actor.click(folder);
    const list = listOf(folder);
    expect(within(list).getByRole("button", { name: "Norte" })).toBeInTheDocument();
    expect(within(list).getByRole("button", { name: "Acciones de «Norte»" })).toBeInTheDocument();
    expect(within(list).getByRole("button", { name: "Acciones de «Sur»" })).toBeInTheDocument();
    const rows = [...list.querySelectorAll(":scope > li")].map(row => row.textContent);
    expect(rows[0]).toBe("Hoja de ruta");
    expect(rows.at(-1)).toBe("Agregar formularios");
    // «Nueva carpeta» goes after the folders, and choosing a form closes the drawer.
    const nav = await mainMenu();
    const names = [...nav.querySelectorAll("a, button")].map(element => element.textContent);
    expect(names.indexOf("Nueva carpeta")).toBeGreaterThan(names.indexOf("Siembra"));
    await actor.click(within(list).getByRole("link", { name: "Hoja de ruta" }));
    expect(onCloseMobile).toHaveBeenCalled();
  });

  it("leave the drawer open when an Escape closes the ⋮ of a folder, and close it with the next one", async () => {
    signIn(administers);
    const onCloseMobile = vi.fn();
    renderShell({ state: { content: manages, act: vi.fn() }, isMobile: true, onCloseMobile });
    const actor = user();
    (await screen.findByRole("button", { name: "Acciones de «Repartos»" })).focus();
    await actor.keyboard("{Enter}");
    expect(await screen.findByRole("menu")).toBeInTheDocument();
    await actor.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(onCloseMobile).not.toHaveBeenCalled();
    // From a row without a tooltip: the one of ⋮, back with the focus, would take the next Escape first.
    screen.getByRole("button", { name: "Repartos" }).focus();
    await actor.keyboard("{Escape}");
    expect(onCloseMobile).toHaveBeenCalledTimes(1);
  });

  // «Lo que carga no mueve lo que ya se ve» (2026-11-05): a block in the place of the folders would leave when there are none
  // and lift what is below it.
  it("take no place while reading or with nothing to show, and offer Reintentar when the menu could not be read", async () => {
    signIn(["formrecords.create"]);
    const pending = renderShell({ state: { pending: true } });
    let nav = await mainMenu();
    await within(nav).findByRole("button", { name: "Gestión de formularios" });
    expect(pending.container.querySelectorAll("[data-slot='skeleton']")).toHaveLength(0);
    // Only the line above «Gestión de formularios».
    expect(nav.querySelectorAll(".border-t")).toHaveLength(1);
    pending.unmount();
    const empty = renderShell({ state: { content: { canManage: false, menus: [] } } });
    nav = await mainMenu();
    await within(nav).findByRole("button", { name: "Gestión de formularios" });
    expect(nav.querySelectorAll(".border-t")).toHaveLength(1);
    empty.unmount();
    const retry = vi.fn();
    renderShell({ state: { failed: true, retry } });
    expect(await screen.findByText("No pudimos cargar tu menú.")).toBeInTheDocument();
    await user().click(screen.getByRole("button", { name: "Reintentar" }));
    expect(retry).toHaveBeenCalled();
  });

  it("show whoever administers and has no folders only «Nueva carpeta»", async () => {
    signIn(administers);
    renderShell({ state: { content: { canManage: true, menus: [] }, act: vi.fn() } });
    const nav = await mainMenu();
    const create = await within(nav).findByRole("button", { name: "Nueva carpeta" });
    expect(create.closest(".border-t")?.querySelectorAll("a, button")).toHaveLength(1);
  });

  it("open the folder just created as soon as it arrives, also in the drawer, and close the panel of the one deleted", async () => {
    signIn(administers);
    const act = vi.fn<Actor>();
    const view = renderShell({ state: { content: manages, act } });
    await user().click(await screen.findByRole("button", { name: "Compras" }));
    expect(screen.getByRole("navigation", { name: "Compras" })).toBeInTheDocument();
    const remaining: FolderMenuContent = { ...manages, menus: manages.menus.filter(menu => menu.id !== purchases.id) };
    view.rerender(tree({ state: { content: remaining, act } }));
    expect(screen.queryByRole("navigation", { name: "Compras" })).not.toBeInTheDocument();
    const tools: FolderMenuSection = { id: "tools", label: "Herramientas", icon: "wrench", revision: 1, catalogCount: 0, links: [], groups: [] };
    view.rerender(tree({ state: { content: remaining, act, created: tools.id } }));
    expect(screen.queryByRole("navigation", { name: "Herramientas" })).not.toBeInTheDocument();
    const arrived: FolderMenuContent = { ...remaining, menus: [...remaining.menus, tools] };
    view.rerender(tree({ state: { content: arrived, act, created: tools.id } }));
    expect(await screen.findByRole("navigation", { name: "Herramientas" })).toBeInTheDocument();
    view.unmount();
    const drawer = renderShell({ state: { content: remaining, act }, isMobile: true });
    expect(await screen.findByRole("button", { name: "Repartos" })).toBeInTheDocument();
    drawer.rerender(tree({ state: { content: arrived, act, created: tools.id }, isMobile: true }));
    expect(await screen.findByRole("button", { name: "Herramientas" })).toHaveAttribute("aria-expanded", "true");
  });

  it("keep the panel open with the form marked, its group open and the breadcrumbs naming the folder after choosing it", async () => {
    signIn(["formrecords.read", "users.read"]);
    const view = renderShell({ state: { content: loads } });
    const actor = user();
    await actor.click(await screen.findByRole("button", { name: "Repartos" }));
    let panel = screen.getByRole("navigation", { name: "Repartos" });
    expect(within(panel).getAllByRole("link").map(link => link.textContent)).toEqual(["Hoja de ruta"]);
    const group = within(panel).getByRole("button", { name: "Norte" });
    expect(group).toHaveAttribute("aria-expanded", "false");
    await actor.click(group);
    await actor.click(within(panel).getByRole("link", { name: "Visita" }));
    expect(screen.getByTestId("where")).toHaveTextContent(`/formularios/${visit}/respuestas`);
    // Drawn again while on its screens (the menu's own state is gone), the group of the open form starts open.
    view.rerender(tree({ state: { content: loads }, sidebarKey: 2 }));
    panel = await screen.findByRole("navigation", { name: "Repartos" });
    expect(within(panel).getByRole("button", { name: "Norte" })).toHaveAttribute("aria-expanded", "true");
    expect(within(panel).getByRole("link", { name: "Visita" })).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("navigation", { name: "Gestión de formularios" })).not.toBeInTheDocument();
    const crumbs = within(screen.getByRole("navigation", { name: /migas de pan/i })).getAllByRole("listitem").map(item => item.textContent);
    expect(crumbs).toEqual(["Inicio", "Repartos", "Visita"]);
  });
});
