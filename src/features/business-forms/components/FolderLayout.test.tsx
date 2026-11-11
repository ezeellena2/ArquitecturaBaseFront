import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter, useLocation } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { currentUser } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { useListingFolders } from "../hooks/useFormFolders";
import { FolderLayout } from "./FolderLayout";

vi.mock("react-oidc-context", async () => {
  const actual = await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context");
  return { ...actual, useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "t" } }) };
});

// Synthetic folders for the screen's behavior; the HTTP contract test consumes the backend capture separately.
const billing = "0199a0c0-0000-7000-8000-0000000000f1";
const delivery = "0199a0c0-0000-7000-8000-0000000000f2";
const north = "0199a0c0-0000-7000-8000-0000000000f3";
const folder = (id: string, parentId: string | null, name: string, revision = 1) => ({ id, parentId, name, revision, menuPlacement: "None", menuIcon: null });
const levels = Array.from({ length: 5 }, (_, index) => `0199a0c0-0000-7000-8000-00000000020${index}`);

function Listing() {
  const folders = useListingFolders("catalogs");
  const location = useLocation();
  return <FolderLayout folders={folders}><p data-testid="search">{location.search}</p><p data-testid="label">{folders.label ?? "—"}</p></FolderLayout>;
}
function renderAt(path: string, permissions: string[], tree: { folders: ReturnType<typeof folder>[]; canManage: boolean }) {
  server.use(
    http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions })),
    http.get("/api/forms/folders", () => HttpResponse.json(tree)),
  );
  return renderWithProviders(<MemoryRouter initialEntries={[path]}><Listing /></MemoryRouter>);
}
const panel = async () => within(await screen.findByRole("region", { name: "Carpetas" }));

describe("the folders of a listing (CP1-A, CP3-A, CP4)", () => {
  it("shows «Todos», «Sin carpeta» and the tree, and puts the chosen folder in the address back on page 1", async () => {
    renderAt("/catalogos?page=3&search=urea", ["formcatalogs.read"], { folders: [folder(billing, null, "Facturación"), folder(delivery, null, "Repartos"), folder(north, delivery, "Norte")], canManage: false });
    const folders = await panel();
    expect(await folders.findByRole("button", { name: "Repartos" })).toBeInTheDocument();
    expect(folders.getByRole("button", { name: "Todos" })).toHaveAttribute("aria-current", "true");
    expect(folders.queryByRole("button", { name: "Norte" })).not.toBeInTheDocument();
    await userEvent.click(folders.getByRole("button", { name: "Desplegar Repartos" }));
    await userEvent.click(folders.getByRole("button", { name: "Norte" }));
    await waitFor(() => expect(screen.getByTestId("search")).toHaveTextContent(`?search=urea&carpeta=${north}`));
    expect(screen.getByTestId("label")).toHaveTextContent("Norte");
    await userEvent.click(folders.getByRole("button", { name: "Sin carpeta" }));
    await waitFor(() => expect(screen.getByTestId("search")).toHaveTextContent("carpeta=sin-carpeta"));
    // Whoever only reads sees the tree without the + nor the «…».
    expect(folders.queryByRole("button", { name: "Agregar carpeta" })).not.toBeInTheDocument();
    expect(folders.queryByRole("button", { name: /^Acciones de/ })).not.toBeInTheDocument();
  });

  it("opens the folder of the address with its parents unfolded", async () => {
    renderAt(`/catalogos?carpeta=${north}`, ["formcatalogs.read"], { folders: [folder(delivery, null, "Repartos"), folder(north, delivery, "Norte")], canManage: false });
    const folders = await panel();
    expect(await folders.findByRole("button", { name: "Norte" })).toHaveAttribute("aria-current", "true");
    expect(folders.getByRole("button", { name: "Plegar Repartos" })).toHaveAttribute("aria-expanded", "true");
  });

  it("goes back to «Todos» with a notice when the folder of the address no longer exists", async () => {
    renderAt(`/catalogos?carpeta=${north}`, ["formcatalogs.read"], { folders: [folder(billing, null, "Facturación")], canManage: false });
    expect(await screen.findByText("La carpeta de la dirección ya no existe. Te mostramos todos.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("search")).toHaveTextContent(""));
    expect((await panel()).getByRole("button", { name: "Todos" })).toHaveAttribute("aria-current", "true");
  });

  it("keeps the listing with «Todos» and offers Reintentar in the panel when the tree cannot be read", async () => {
    let fail = true;
    server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["formcatalogs.read"] })),
      http.get("/api/forms/folders", () => fail ? HttpResponse.json({ code: "Boom", detail: "No pudimos." }, { status: 500 }) : HttpResponse.json({ folders: [folder(billing, null, "Facturación")], canManage: false })));
    renderWithProviders(<MemoryRouter initialEntries={[`/catalogos?carpeta=${north}`]}><Listing /></MemoryRouter>);
    const folders = await panel();
    expect(await folders.findByText("No pudimos cargar las carpetas.")).toBeInTheDocument();
    expect(screen.getByTestId("label")).toHaveTextContent("—");
    fail = false;
    await userEvent.click(folders.getByRole("button", { name: "Reintentar" }));
    expect(await folders.findByRole("button", { name: "Facturación" })).toBeInTheDocument();
  });

  it("adds a folder in place, with the name error beside it, and offers «Agregar carpeta» when there are none", async () => {
    const created: unknown[] = [];
    let folders: ReturnType<typeof folder>[] = [];
    server.use(http.post("/api/forms/folders", async ({ request }) => {
      const body = await request.json() as { parentId: string | null; name: string };
      created.push(body);
      if (body.name === "Repartos") return HttpResponse.json({ code: "Forms.Folder.NameTaken", detail: "Ya hay una carpeta con ese nombre en este lugar.", errors: { name: ["Ya hay una carpeta con ese nombre en este lugar."] } }, { status: 400 });
      folders = [folder(billing, null, body.name)];
      return HttpResponse.json(folders[0]);
    }));
    server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["formcatalogs.read", "formcatalogs.manage"] })),
      http.get("/api/forms/folders", () => HttpResponse.json({ folders, canManage: true })));
    renderWithProviders(<MemoryRouter initialEntries={["/catalogos"]}><Listing /></MemoryRouter>);
    const list = await panel();
    const addButtons = await list.findAllByRole("button", { name: "Agregar carpeta" });
    expect(addButtons).toHaveLength(2);
    await userEvent.click(addButtons[1]);
    const name = list.getByRole("textbox", { name: "Nombre de la carpeta nueva" });
    await userEvent.keyboard("{Enter}");
    expect(await list.findByText("Escribí un nombre.")).toBeInTheDocument();
    await userEvent.type(name, "Repartos{Enter}");
    expect(await list.findByText("Ya hay una carpeta con ese nombre en este lugar.")).toBeInTheDocument();
    expect(name).toHaveAttribute("aria-invalid", "true");
    await userEvent.clear(name);
    await userEvent.type(name, "Facturación{Enter}");
    expect(await list.findByRole("button", { name: "Facturación" })).toBeInTheDocument();
    expect(created).toEqual([{ parentId: null, name: "Repartos" }, { parentId: null, name: "Facturación" }]);
    expect(await screen.findByText("Agregamos la carpeta «Facturación».")).toBeInTheDocument();
  });

  it("turns off «Agregar subcarpeta» on the fifth level, with its reason inside the item", async () => {
    renderAt(`/catalogos?carpeta=${levels[4]}`, ["formcatalogs.read", "formcatalogs.manage"], { folders: levels.map((id, index) => folder(id, index === 0 ? null : levels[index - 1], `Nivel ${index + 1}`)), canManage: true });
    const folders = await panel();
    const actions = await folders.findByRole("button", { name: "Acciones de «Nivel 5»" });
    actions.focus();
    await userEvent.keyboard("{Enter}");
    const item = await screen.findByRole("menuitem", { name: /Agregar subcarpeta/ });
    expect(item).toHaveAttribute("aria-disabled", "true");
    expect(item).toHaveTextContent("Las carpetas llegan hasta cinco niveles.");
  });

  it("renames in place and keeps the name written when the folder changed in between", async () => {
    let revision = 1;
    let reads = 0;
    server.use(http.put(`/api/forms/folders/${billing}`, async ({ request }) => {
      const body = await request.json() as { expectedRevision: number; name: string };
      if (body.expectedRevision !== revision) return HttpResponse.json({ code: "Forms.Folder.RevisionConflict", detail: "La carpeta cambió. Recargala e intentá de nuevo." }, { status: 409 });
      return HttpResponse.json(folder(billing, null, body.name, revision + 1));
    }));
    server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["formcatalogs.read", "formcatalogs.manage"] })),
      http.get("/api/forms/folders", () => { reads++; return HttpResponse.json({ folders: [folder(billing, null, "Facturación", revision)], canManage: true }); }));
    renderWithProviders(<MemoryRouter initialEntries={["/catalogos"]}><Listing /></MemoryRouter>);
    const folders = await panel();
    const actions = await folders.findByRole("button", { name: "Acciones de «Facturación»" });
    revision = 2; // someone else renamed it after this tree was read
    actions.focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.click(await screen.findByRole("menuitem", { name: "Renombrar" }));
    const name = await folders.findByRole("textbox", { name: "Nombre de «Facturación»" });
    await userEvent.clear(name);
    await userEvent.type(name, "Cobranzas{Enter}");
    expect(await screen.findByText("La carpeta cambió. Recargala e intentá de nuevo.")).toBeInTheDocument();
    expect(name).toHaveValue("Cobranzas");
    await userEvent.click(screen.getByRole("button", { name: "Volver a leer" }));
    await waitFor(() => expect(reads).toBe(2));
    await userEvent.click(folders.getByRole("button", { name: "Guardar el nombre" }));
    // The same notice changes from the conflict to the result, so it is read again until it says so.
    await waitFor(() => expect(screen.getByText("Ahora la carpeta se llama «Cobranzas».")).toBeInTheDocument());
    // The focus goes back to the folder's row, not to the page (premise 5.8); this tree double keeps its first name.
    await waitFor(() => expect(folders.getByRole("button", { name: "Facturación" })).toHaveFocus());
  });

  it("takes the focus back to the folder's row when a rename is cancelled", async () => {
    server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["formcatalogs.read", "formcatalogs.manage"] })),
      http.get("/api/forms/folders", () => HttpResponse.json({ folders: [folder(billing, null, "Facturación", 1)], canManage: true })));
    renderWithProviders(<MemoryRouter initialEntries={["/catalogos"]}><Listing /></MemoryRouter>);
    const folders = await panel();
    const actions = await folders.findByRole("button", { name: "Acciones de «Facturación»" });
    actions.focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.click(await screen.findByRole("menuitem", { name: "Renombrar" }));
    await folders.findByRole("textbox", { name: "Nombre de «Facturación»" });
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(folders.getByRole("button", { name: "Facturación" })).toHaveFocus());
  });
});
