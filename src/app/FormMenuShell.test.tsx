import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { useContext, type MouseEvent } from "react";
import { MemoryRouter, useNavigate } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { initialAppearance } from "@/shared/lib/appearance";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { server } from "@/test/mocks/server";
import { currentUser } from "@/test/mocks/handlers";
import { FolderMenuNavigationContext, type FolderMenuAction } from "@/layouts/folderMenuNavigation";
import { Sidebar } from "@/layouts/components/Sidebar";
import { FormMenuShell } from "./FormMenuShell";
vi.mock("react-oidc-context", async () => { const actual = await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"); return { ...actual, useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "t" } }) }; });

// Synthetic menu for the composition; the HTTP contract test consumes the backend capture separately.
const route = "0199a0c0-0000-7000-8000-0000000000a1";
const menu = { canManage: false, menus: [{ folderId: "0199a0c0-0000-7000-8000-0000000000f2", name: "Repartos", icon: "truck", revision: 1, catalogCount: 0, forms: [{ id: route, name: "Hoja de ruta" }], groups: [] }] };
function Probe() {
  const value = useContext(FolderMenuNavigationContext);
  return <p data-testid="menu">{value?.pending ? "pending" : value?.content?.menus.map(section => `${section.label}:${section.links.map(link => link.to).join(",")}`).join(";") ?? "none"}</p>;
}
const presentation = (features: string[]) => http.get("/api/settings/presentation", () => HttpResponse.json({ appearance: initialAppearance, defaultCulture: "es", defaultTimeZoneId: "UTC", defaultPageSize: 20, installedFeatures: features }));

it.each([
  [["formrecords.read"], `Repartos:/formularios/${route}/respuestas`],
  [["formrecords.create"], `Repartos:/formularios/${route}/cargar`],
  // Whoever only administers forms also reads the menu, and a form opens its design (CM1).
  [["formtemplates.read", "formtemplates.manage"], `Repartos:/formularios/${route}`],
] as const)("reads the menu of the forms module and sends each form where the person can open it (%j)", async (permissions, expected) => {
  server.use(presentation(["forms"]), http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions })), http.get("/api/forms/menu", () => HttpResponse.json(menu)));
  renderWithProviders(<MemoryRouter><FormMenuShell><Probe /></FormMenuShell></MemoryRouter>);
  await waitFor(() => expect(screen.getByTestId("menu")).toHaveTextContent(expected));
});

it.each([
  ["without the forms module", [], ["formrecords.read"]],
  ["without a permission that opens or administers forms", ["forms"], ["formtemplates.read"]],
] as const)("does not read the menu %s", async (_case, features, permissions) => {
  const read = vi.fn();
  server.use(presentation([...features]), http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions })), http.get("/api/forms/menu", () => { read(); return HttpResponse.json(menu); }));
  renderWithProviders(<MemoryRouter><FormMenuShell><Probe /></FormMenuShell></MemoryRouter>);
  await waitFor(() => expect(screen.getByTestId("menu")).toHaveTextContent("none"));
  expect(read).not.toHaveBeenCalled();
});

it("remembers the form opened from the menu while its screens are open, and forgets it on leaving them", async () => {
  server.use(presentation(["forms"]), http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["formrecords.read"] })), http.get("/api/forms/menu", () => HttpResponse.json(menu)));
  function Entry() {
    const value = useContext(FolderMenuNavigationContext);
    const navigate = useNavigate();
    return <>
      <p data-testid="entry">{value?.entry?.formLabel ?? "none"}</p>
      <button type="button" onClick={() => { value?.enter({ key: "k", formId: route, panel: "folder-menu:x", menuLabel: "Repartos", formLabel: "Hoja de ruta" }); void navigate(`/formularios/${route}/respuestas`); }}>Abrir desde el menú</button>
      <button type="button" onClick={() => { void navigate(`/formularios/${route}/respuestas/registro`); }}>Abrir una respuesta</button>
      <button type="button" onClick={() => { void navigate("/"); }}>Volver a Inicio</button>
      <button type="button" onClick={() => { void navigate(`/formularios/${route}/respuestas`); }}>Abrir desde Formularios</button>
    </>;
  }
  renderWithProviders(<MemoryRouter><FormMenuShell><Entry /></FormMenuShell></MemoryRouter>);
  await userEvent.click(await screen.findByRole("button", { name: "Abrir desde el menú" }));
  await waitFor(() => expect(screen.getByTestId("entry")).toHaveTextContent("Hoja de ruta"));
  await userEvent.click(screen.getByRole("button", { name: "Abrir una respuesta" }));
  expect(screen.getByTestId("entry")).toHaveTextContent("Hoja de ruta");
  await userEvent.click(screen.getByRole("button", { name: "Volver a Inicio" }));
  await waitFor(() => expect(screen.getByTestId("entry")).toHaveTextContent("none"));
  await userEvent.click(screen.getByRole("button", { name: "Abrir desde Formularios" }));
  expect(screen.getByTestId("entry")).toHaveTextContent("none");
});

describe("the dialogs of the folders of the menu (CM2, CM4)", () => {
  const delivery = "0199a0c0-0000-7000-8000-0000000000f2";
  const north = "0199a0c0-0000-7000-8000-0000000000f3";
  const created = "0199a0c0-0000-7000-8000-0000000000f4";
  const managed = { canManage: true, menus: [{ folderId: delivery, name: "Repartos", icon: "truck", revision: 1, catalogCount: 0, forms: [],
    groups: [{ folderId: north, name: "Norte", revision: 1, forms: [] }] }] };
  const actions: readonly (readonly [string, FolderMenuAction])[] = [
    ["Crear", { kind: "create" }], ["Crear adentro", { kind: "createSubfolder", parentId: delivery }], ["Editar", { kind: "edit", folderId: delivery }],
    ["Mover", { kind: "move", folderId: north }], ["Borrar", { kind: "delete", folderId: delivery }], ["Agregar", { kind: "addForms", folderId: delivery }],
  ];
  // What the side menu does with the contract: ask with the element the focus goes back to.
  function Menu() {
    const value = useContext(FolderMenuNavigationContext);
    const ask = (action: FolderMenuAction) => (event: MouseEvent<HTMLButtonElement>) => value?.act?.(action, { current: event.currentTarget });
    return <>
      <p data-testid="actions">{value?.content ? value.act ? "offered" : "none" : "reading"}</p>
      <p data-testid="created">{value?.created ?? "none"}</p>
      {actions.map(([label, action]) => <button key={label} type="button" onClick={ask(action)}>{label}</button>)}
    </>;
  }
  const serve = (permissions: string[], menuBody: object) => server.use(presentation(["forms"]), http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions })),
    http.get("/api/forms/menu", () => HttpResponse.json(menuBody)),
    http.get(`/api/forms/folders/${delivery}/deletion`, () => HttpResponse.json({ revision: 1, subfolderCount: 1, formCount: 0, catalogCount: 0 })),
    http.get(`/api/forms/folders/${delivery}/forms`, () => HttpResponse.json({ formIds: [] })),
    http.get("/api/forms/definitions", () => HttpResponse.json({ items: [], page: 1, pageSize: 50, totalCount: 0, totalPages: 0, hasPrevious: false, hasNext: false })));
  const administers = ["formrecords.read", "formtemplates.read", "formtemplates.manage"];

  it.each([
    ["Crear", "Nueva carpeta"],
    ["Crear adentro", "Nueva subcarpeta en «Repartos»"],
    ["Editar", "Editar «Repartos»"],
    ["Mover", "Mover «Norte» a…"],
    ["Borrar", "¿Borrar «Repartos»?"],
    ["Agregar", "Formularios de «Repartos»"],
  ])("opens the dialog of «%s» and gives the focus back to what asked for it when it closes", async (label, title) => {
    serve(administers, managed);
    renderWithProviders(<MemoryRouter><FormMenuShell><Menu /></FormMenuShell></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId("actions")).toHaveTextContent("offered"));
    const ask = screen.getByRole("button", { name: label });
    await userEvent.click(ask);
    const dialog = await screen.findByRole("dialog", { name: title });
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(ask).toHaveFocus());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("tells the menu which folder was created, so it opens it", async () => {
    serve(administers, managed);
    server.use(http.post("/api/forms/folders", () => HttpResponse.json({ id: created, parentId: null, name: "Compras", revision: 1, icon: "package" })));
    renderWithProviders(<MemoryRouter><FormMenuShell><Menu /></FormMenuShell></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId("actions")).toHaveTextContent("offered"));
    await userEvent.click(screen.getByRole("button", { name: "Crear" }));
    const dialog = await screen.findByRole("dialog", { name: "Nueva carpeta" });
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Nombre" }), "Compras");
    await userEvent.click(within(dialog).getByRole("button", { name: "Crear" }));
    await waitFor(() => expect(screen.getByTestId("created")).toHaveTextContent(created));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("gives the focus back to the ⋮ of the side menu, whose item is gone, when the dialog it opened closes", async () => {
    serve(administers, managed);
    renderWithProviders(<MemoryRouter><FormMenuShell>
      <Sidebar collapsed={false} onToggleCollapsed={vi.fn()} isMobile={false} mobileOpen={false} onCloseMobile={vi.fn()} />
    </FormMenuShell></MemoryRouter>);
    const actor = userEvent.setup({ pointerEventsCheck: 0 });
    await actor.click(await screen.findByRole("button", { name: "Repartos" }));
    const trigger = within(screen.getByRole("navigation", { name: "Repartos" })).getByRole("button", { name: "Acciones de «Repartos»" });
    await actor.click(trigger);
    await actor.click(await screen.findByRole("menuitem", { name: "Editar…" }));
    const dialog = await screen.findByRole("dialog", { name: "Editar «Repartos»" });
    await actor.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  // The ⋮ that asked for the dialog leaves the document with its folder: the focus goes to «Nueva carpeta», which whoever
  // administers always has, instead of falling on the page (CM6).
  it.each([["on the desktop", false], ["in the drawer", true]] as const)("gives the focus to «Nueva carpeta» when the folder whose ⋮ asked for the dialog leaves the menu (%s)", async (_case, isMobile) => {
    let deleted = false;
    serve(administers, managed);
    server.use(http.get("/api/forms/menu", () => HttpResponse.json(deleted ? { canManage: true, menus: [] } : managed)),
      http.delete(`/api/forms/folders/${delivery}`, () => { deleted = true; return new HttpResponse(null, { status: 204 }); }));
    renderWithProviders(<MemoryRouter><FormMenuShell>
      <Sidebar collapsed={false} onToggleCollapsed={vi.fn()} isMobile={isMobile} mobileOpen={isMobile} onCloseMobile={vi.fn()} />
    </FormMenuShell></MemoryRouter>);
    const actor = userEvent.setup({ pointerEventsCheck: 0 });
    const folder = await screen.findByRole("button", { name: "Repartos" });
    if (!isMobile) await actor.click(folder);
    const where = screen.getByRole("navigation", { name: isMobile ? "Navegación principal" : "Repartos" });
    // Radix opens with the keyboard in jsdom: a click on the ⋮ of the drawer does not reach it.
    within(where).getByRole("button", { name: "Acciones de «Repartos»" }).focus();
    await actor.keyboard("{Enter}");
    await actor.click(await screen.findByRole("menuitem", { name: "Borrar" }));
    const dialog = await screen.findByRole("dialog", { name: "¿Borrar «Repartos»?" });
    await actor.click(await within(dialog).findByRole("button", { name: "Borrar carpeta" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Repartos" })).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole("button", { name: "Nueva carpeta" })).toHaveFocus());
  });

  it("offers no actions to whoever does not administer forms", async () => {
    serve(["formrecords.read"], menu);
    renderWithProviders(<MemoryRouter><FormMenuShell><Menu /></FormMenuShell></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId("actions")).toHaveTextContent("none"));
    expect(screen.getByTestId("created")).toHaveTextContent("none");
  });
});
