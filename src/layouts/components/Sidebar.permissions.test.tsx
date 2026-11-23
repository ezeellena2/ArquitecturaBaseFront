import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { MemoryRouter } from "react-router";
import { expect, it, vi } from "vitest";
import { currentUser } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { FolderMenuNavigationContext, type FolderMenuContent } from "../folderMenuNavigation";
import { Sidebar } from "./Sidebar";

vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"),
  useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));

it.each([
  [["formrecords.read"], true],
  [["formapprovals.decide"], true],
  [["formrecords.read", "formapprovals.decide"], true],
  [["formtemplates.read"], true],
  [["formcatalogs.read"], false],
] as const)("uses the same alternative permission rule in the menu for %j", async (permissions, allowed) => {
  server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions })));
  renderWithProviders(<MemoryRouter><Sidebar collapsed={false} onToggleCollapsed={vi.fn()} isMobile={false} mobileOpen={false} onCloseMobile={vi.fn()} /></MemoryRouter>);
  const sidebar = await screen.findByRole("complementary");
  await within(sidebar).findByText("ana@example.com");
  await userEvent.click(within(sidebar).getByRole("button", { name: /^gestión de formularios$/i }));
  // FU2-A: one entry for whoever designs, loads, reads or decides.
  if (allowed) expect(await screen.findByRole("link", { name: "Formularios" })).toHaveAttribute("href", "/formularios");
  else {
    expect(await screen.findByRole("link", { name: "Catálogos" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Formularios" })).not.toBeInTheDocument();
  }
});

// DOC5-A: «Ver documentos recibidos» alone opens «Gestión de formularios» with its entry.
it("shows «Documentos recibidos» with only its permission", async () => {
  server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["formdocuments.read"] })));
  renderWithProviders(<MemoryRouter><Sidebar collapsed={false} onToggleCollapsed={vi.fn()} isMobile={false} mobileOpen={false} onCloseMobile={vi.fn()} /></MemoryRouter>);
  const sidebar = await screen.findByRole("complementary");
  await within(sidebar).findByText("ana@example.com");
  await userEvent.click(within(sidebar).getByRole("button", { name: /^gestión de formularios$/i }));
  expect(await screen.findByRole("link", { name: "Documentos recibidos" })).toHaveAttribute("href", "/formularios/documentos");
  expect(screen.queryByRole("link", { name: "Formularios" })).not.toBeInTheDocument();
});

// FU1-B: «Formularios» and «Documentos recibidos» together, a line, and the pages used to build forms.
it("groups the pages of every day above a line and the ones to build forms below it", async () => {
  server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["formrecords.read", "formtemplates.read", "formtemplates.manage", "formdocuments.read", "formcatalogs.read"] })));
  renderWithProviders(<MemoryRouter><Sidebar collapsed={false} onToggleCollapsed={vi.fn()} isMobile={false} mobileOpen={false} onCloseMobile={vi.fn()} /></MemoryRouter>);
  const sidebar = await screen.findByRole("complementary");
  await within(sidebar).findByText("ana@example.com");
  await userEvent.click(within(sidebar).getByRole("button", { name: /^gestión de formularios$/i }));
  const panel = await screen.findByRole("navigation", { name: "Gestión de formularios" });
  await within(panel).findByRole("link", { name: /^Documentos recibidos/ });
  const [daily, build] = within(panel).getAllByRole("list");
  expect(within(daily).getAllByRole("link").map(link => link.getAttribute("href"))).toEqual(["/formularios", "/formularios/documentos"]);
  expect(within(build).getAllByRole("link").map(link => link.textContent)).toEqual(["Catálogos", "Formularios que faltan"]);
  expect(daily.nextElementSibling).toHaveClass("border-t");
});

it("draws no line when there is nothing to build forms with", async () => {
  server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["formrecords.create"] })));
  renderWithProviders(<MemoryRouter><Sidebar collapsed={false} onToggleCollapsed={vi.fn()} isMobile={false} mobileOpen={false} onCloseMobile={vi.fn()} /></MemoryRouter>);
  const sidebar = await screen.findByRole("complementary");
  await within(sidebar).findByText("ana@example.com");
  await userEvent.click(within(sidebar).getByRole("button", { name: /^gestión de formularios$/i }));
  const panel = await screen.findByRole("navigation", { name: "Gestión de formularios" });
  await within(panel).findByRole("link", { name: "Formularios" });
  expect(panel.querySelector(".border-t.my-2")).toBeNull();
});

// DOC5-A: the folders arrive after the profile (FormMenuShell). Each one is a menu of its own (CM1), so «Documentos recibidos»
// keeps its place in «Gestión de formularios».
it("keeps «Documentos recibidos» in its place when the folders arrive", async () => {
  server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["formrecords.read", "formtemplates.read", "formtemplates.manage", "formdocuments.read"] })));
  const form = "0199a0c0-0000-7000-8000-0000000000a1";
  const folders: FolderMenuContent = { canManage: true, menus: [{ id: "sowing", label: "Siembra", icon: "leaf", revision: 1, catalogCount: 0,
    links: [{ id: form, label: "Hoja de ruta", to: `/formularios/${form}/respuestas` }], groups: [] }] };
  const shell = (content?: FolderMenuContent) => <MemoryRouter>
    <FolderMenuNavigationContext.Provider value={{ content, pending: !content, failed: false, retry: () => undefined, entry: null, enter: vi.fn() }}>
      <Sidebar collapsed={false} onToggleCollapsed={vi.fn()} isMobile={false} mobileOpen={false} onCloseMobile={vi.fn()} />
    </FolderMenuNavigationContext.Provider>
  </MemoryRouter>;
  const view = renderWithProviders(shell());
  const sidebar = await screen.findByRole("complementary");
  await within(sidebar).findByText("ana@example.com");
  await userEvent.click(within(sidebar).getByRole("button", { name: /^gestión de formularios$/i }));
  const panel = await screen.findByRole("navigation", { name: "Gestión de formularios" });
  const entry = await within(panel).findByRole("link", { name: /^Documentos recibidos/ });
  const above = within(panel).getAllByRole("link").slice(0, within(panel).getAllByRole("link").indexOf(entry)).map(link => link.textContent);
  view.rerender(shell(folders));
  await within(sidebar).findByRole("button", { name: "Siembra" });
  // Nothing was added above it, and the folder is a menu, not a group of this panel.
  expect(within(panel).getAllByRole("link").slice(0, within(panel).getAllByRole("link").indexOf(entry)).map(link => link.textContent)).toEqual(above);
  expect(within(panel).queryByRole("link", { name: "Hoja de ruta" })).not.toBeInTheDocument();
});
