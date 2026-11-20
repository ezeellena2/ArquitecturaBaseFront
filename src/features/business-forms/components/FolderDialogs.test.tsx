import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { currentUser } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { fixtureLifecycle } from "@/test/visual/formFixtures";
import type { FormFolder } from "../api/folders";
import { useFolderScope } from "../hooks/useFormFolders";
import { FolderDeleteDialog } from "./FolderDeleteDialog";
import { FolderEditDialog } from "./FolderEditDialog";
import { FolderFormsDialog } from "./FolderFormsDialog";
import { FolderMoveDialog } from "./FolderMoveDialog";
import { ItemFoldersDialog } from "./ItemFoldersDialog";

vi.mock("react-oidc-context", async () => {
  const actual = await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context");
  return { ...actual, useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "t" } }) };
});

// Synthetic folders and forms for the dialogs' behavior; the HTTP contract test consumes the backend capture separately.
const billing = "0199a0c0-0000-7000-8000-0000000000f1";
const delivery = "0199a0c0-0000-7000-8000-0000000000f2";
const north = "0199a0c0-0000-7000-8000-0000000000f3";
const created = "0199a0c0-0000-7000-8000-0000000000f9";
const catalog = "0199a0c0-0000-7000-8000-0000000000c1";
const folder = (id: string, parentId: string | null, name: string, icon: FormFolder["icon"] = null, revision = 1): FormFolder => ({ id, parentId, name, revision, icon });
// Facturación and Repartos use the folder and the truck: the first free icon is the package.
const tree = [folder(billing, null, "Facturación", "folder"), folder(delivery, null, "Repartos", "truck"), folder(north, delivery, "Norte")];
const manager = ["formcatalogs.read", "formcatalogs.manage", "formtemplates.read", "formtemplates.manage"];

function WithScope({ children }: { children: (scope: ReturnType<typeof useFolderScope>) => React.ReactNode }) {
  const scope = useFolderScope();
  return scope.actorId ? <>{children(scope)}</> : null;
}
function renderDialog(children: (scope: ReturnType<typeof useFolderScope>) => React.ReactNode, canManage = true) {
  server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: manager })),
    http.get("/api/forms/folders", () => HttpResponse.json({ folders: tree, canManage })));
  return renderWithProviders(<MemoryRouter><WithScope>{children}</WithScope></MemoryRouter>);
}
const conflict = (code: string, detail: string) => HttpResponse.json({ code, detail }, { status: 409 });

describe("«Carpetas…» of a catalog (CP2-A, CM3)", () => {
  it("ticks the folders it is in, in two levels, and saves the whole set with the one it read", async () => {
    const saved: unknown[] = [];
    server.use(
      http.get(`/api/forms/catalogs/${catalog}/folders`, () => HttpResponse.json({ folderIds: [billing] })),
      http.put(`/api/forms/catalogs/${catalog}/folders`, async ({ request }) => { saved.push(await request.json()); return HttpResponse.json({ folderIds: [north] }); }),
    );
    const onClose = vi.fn();
    renderDialog(() => <ItemFoldersDialog kind="catalogs" id={catalog} name="Artículos" onClose={onClose} />);
    const dialog = await screen.findByRole("dialog", { name: "Carpetas de «Artículos»" });
    expect(await within(dialog).findByRole("checkbox", { name: "Facturación" })).toBeChecked();
    // A subfolder says where it lives (premise 5.3): two folders with the same name read differently.
    expect(within(dialog).getByRole("checkbox", { name: "Norte" })).toHaveAccessibleDescription("En Repartos");
    expect(within(dialog).getByRole("checkbox", { name: "Repartos" })).not.toHaveAccessibleDescription();
    const save = within(dialog).getByRole("button", { name: "Guardar" });
    expect(save).toBeDisabled();
    await userEvent.click(within(dialog).getByRole("checkbox", { name: "Facturación" }));
    await userEvent.click(within(dialog).getByRole("checkbox", { name: "Norte" }));
    await userEvent.click(save);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(saved).toEqual([{ expectedFolderIds: [billing], folderIds: [north] }]);
    expect(await screen.findByText("Guardamos las carpetas de «Artículos».")).toBeInTheDocument();
  });

  it("opens «Nueva carpeta» and leaves the folder it creates ticked", async () => {
    const posted: unknown[] = [];
    let folders = tree;
    server.use(
      http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: manager })),
      http.get("/api/forms/folders", () => HttpResponse.json({ folders, canManage: true })),
      http.get(`/api/forms/catalogs/${catalog}/folders`, () => HttpResponse.json({ folderIds: [] })),
      http.post("/api/forms/folders", async ({ request }) => {
        const body = await request.json() as { name: string; icon: FormFolder["icon"] };
        posted.push(body);
        const folderCreated = folder(created, null, body.name, body.icon);
        folders = [...tree, folderCreated];
        return HttpResponse.json(folderCreated);
      }),
    );
    renderWithProviders(<MemoryRouter><ItemFoldersDialog kind="catalogs" id={catalog} name="Artículos" onClose={vi.fn()} /></MemoryRouter>);
    const dialog = await screen.findByRole("dialog", { name: "Carpetas de «Artículos»" });
    await userEvent.click(await within(dialog).findByRole("button", { name: "Nueva carpeta" }));
    const create = await screen.findByRole("dialog", { name: "Nueva carpeta" });
    expect(within(create).getByRole("button", { name: "Ícono Paquete" })).toBeInTheDocument();
    await userEvent.type(within(create).getByRole("textbox", { name: "Nombre" }), "Compras{Enter}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Nueva carpeta" })).not.toBeInTheDocument());
    expect(posted).toEqual([{ parentId: null, name: "Compras", icon: "package" }]);
    expect(await within(dialog).findByRole("checkbox", { name: "Compras" })).toBeChecked();
    expect(within(dialog).getByRole("button", { name: "Guardar" })).toBeEnabled();
  });

  it("does not offer «Nueva carpeta» to whoever does not administer forms", async () => {
    server.use(http.get(`/api/forms/catalogs/${catalog}/folders`, () => HttpResponse.json({ folderIds: [] })));
    renderDialog(() => <ItemFoldersDialog kind="catalogs" id={catalog} name="Artículos" onClose={vi.fn()} />, false);
    const dialog = await screen.findByRole("dialog", { name: "Carpetas de «Artículos»" });
    await within(dialog).findByRole("checkbox", { name: "Facturación" });
    expect(within(dialog).queryByRole("button", { name: "Nueva carpeta" })).not.toBeInTheDocument();
  });

  it("keeps what is ticked when someone changed the set, and saves against the one read again", async () => {
    let current = [billing];
    const saved: unknown[] = [];
    server.use(
      http.get(`/api/forms/catalogs/${catalog}/folders`, () => HttpResponse.json({ folderIds: current })),
      http.put(`/api/forms/catalogs/${catalog}/folders`, async ({ request }) => {
        const body = await request.json() as { expectedFolderIds: string[]; folderIds: string[] };
        saved.push(body);
        return body.expectedFolderIds.join() === current.join() ? HttpResponse.json({ folderIds: body.folderIds })
          : conflict("Forms.Folder.SetChanged", "Las carpetas de este elemento cambiaron. Recargalas e intentá de nuevo.");
      }),
    );
    const onClose = vi.fn();
    renderDialog(() => <ItemFoldersDialog kind="catalogs" id={catalog} name="Artículos" onClose={onClose} />);
    const dialog = await screen.findByRole("dialog", { name: "Carpetas de «Artículos»" });
    await userEvent.click(await within(dialog).findByRole("checkbox", { name: "Repartos" }));
    current = [delivery];
    await userEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));
    expect(await screen.findByText("Las carpetas de este elemento cambiaron. Recargalas e intentá de nuevo.")).toBeInTheDocument();
    expect(within(dialog).getByRole("checkbox", { name: "Repartos" })).toBeChecked();
    expect(within(dialog).getByRole("checkbox", { name: "Facturación" })).toBeChecked();
    // The notice lives in the one Toaster, outside the modal dialog that jsdom leaves the rest of the page hidden for.
    await userEvent.click(screen.getByRole("button", { name: "Volver a leer", hidden: true }));
    await waitFor(() => expect(within(dialog).getByRole("checkbox", { name: "Facturación" })).toBeChecked());
    await userEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(saved.at(-1)).toEqual({ expectedFolderIds: [delivery], folderIds: [billing, delivery] });
  });
});

describe("creating and editing a folder (CM2, CM4)", () => {
  it("creates a folder of the first level with its name and the first free icon, which can be another", async () => {
    const posted: unknown[] = [];
    server.use(http.post("/api/forms/folders", async ({ request }) => {
      const body = await request.json() as { name: string; icon: FormFolder["icon"] };
      posted.push(body);
      return HttpResponse.json(folder(created, null, body.name, body.icon));
    }));
    const onSaved = vi.fn();
    const onClose = vi.fn();
    renderDialog(scope => <FolderEditDialog scope={scope} folders={tree} target={{ kind: "create", parent: null }} onSaved={onSaved} onClose={onClose} />);
    const dialog = await screen.findByRole("dialog", { name: "Nueva carpeta" });
    const name = within(dialog).getByRole("textbox", { name: "Nombre" });
    expect(name).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(await within(dialog).findByText("Escribí un nombre.")).toBeInTheDocument();
    expect(posted).toEqual([]);
    await userEvent.click(within(dialog).getByRole("button", { name: "Ícono Paquete" }));
    await userEvent.click(await screen.findByRole("option", { name: "Hoja" }));
    await userEvent.type(name, "Compras{Enter}");
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(posted).toEqual([{ parentId: null, name: "Compras", icon: "leaf" }]);
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: created, name: "Compras" }));
    expect(await screen.findByText("Agregamos la carpeta «Compras».")).toBeInTheDocument();
  });

  it("creates a subfolder with only its name", async () => {
    const posted: unknown[] = [];
    server.use(http.post("/api/forms/folders", async ({ request }) => { posted.push(await request.json()); return HttpResponse.json(folder(created, delivery, "Sur")); }));
    const onClose = vi.fn();
    renderDialog(scope => <FolderEditDialog scope={scope} folders={tree} target={{ kind: "create", parent: tree[1] }} onClose={onClose} />);
    const dialog = await screen.findByRole("dialog", { name: "Nueva subcarpeta en «Repartos»" });
    expect(within(dialog).queryByRole("button", { name: /^Ícono/ })).not.toBeInTheDocument();
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Nombre" }), "Sur");
    await userEvent.click(within(dialog).getByRole("button", { name: "Crear" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(posted).toEqual([{ parentId: delivery, name: "Sur", icon: null }]);
  });

  it("edits the name and the icon of a folder of the first level, with Guardar once something changed", async () => {
    const saved: unknown[] = [];
    server.use(http.put(`/api/forms/folders/${delivery}`, async ({ request }) => { saved.push(await request.json()); return HttpResponse.json(folder(delivery, null, "Repartos", "package", 2)); }));
    const onClose = vi.fn();
    renderDialog(scope => <FolderEditDialog scope={scope} folders={tree} target={{ kind: "edit", folder: tree[1] }} onClose={onClose} />);
    const dialog = await screen.findByRole("dialog", { name: "Editar «Repartos»" });
    expect(within(dialog).getByRole("textbox", { name: "Nombre" })).toHaveValue("Repartos");
    expect(within(dialog).getByRole("button", { name: "Ícono Camión" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Guardar" })).toBeDisabled();
    await userEvent.click(within(dialog).getByRole("button", { name: "Ícono Camión" }));
    await userEvent.click(await screen.findByRole("option", { name: "Paquete" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(saved).toEqual([{ expectedRevision: 1, name: "Repartos", parentId: null, icon: "package" }]);
    expect(await screen.findByText("Guardamos la carpeta «Repartos».")).toBeInTheDocument();
  });

  it("edits only the name of a subfolder, says a repeated name under it and keeps what was written when it changed in between", async () => {
    const revision = 2;
    const saved: unknown[] = [];
    server.use(http.put(`/api/forms/folders/${north}`, async ({ request }) => {
      const body = await request.json() as { expectedRevision: number; name: string };
      saved.push(body);
      if (body.name === "Sur") return HttpResponse.json({ code: "Forms.Folder.NameTaken", detail: "Ya hay una carpeta con ese nombre en este lugar.", errors: { name: ["Ya hay una carpeta con ese nombre en este lugar."] } }, { status: 400 });
      return body.expectedRevision === revision ? HttpResponse.json(folder(north, delivery, body.name, null, revision + 1))
        : conflict("Forms.Folder.RevisionConflict", "La carpeta cambió. Recargala e intentá de nuevo.");
    }));
    const onClose = vi.fn();
    renderDialog(scope => <FolderEditDialog scope={scope} folders={tree} target={{ kind: "edit", folder: tree[2] }} onClose={onClose} />);
    const dialog = await screen.findByRole("dialog", { name: "Editar «Norte»" });
    expect(within(dialog).queryByRole("button", { name: /^Ícono/ })).not.toBeInTheDocument();
    const name = within(dialog).getByRole("textbox", { name: "Nombre" });
    await userEvent.clear(name);
    await userEvent.type(name, "Sur{Enter}");
    expect(await within(dialog).findByText("Ya hay una carpeta con ese nombre en este lugar.")).toBeInTheDocument();
    expect(name).toHaveAttribute("aria-invalid", "true");
    await userEvent.clear(name);
    await userEvent.type(name, "Zona norte{Enter}");
    expect(await screen.findByText("La carpeta cambió. Recargala e intentá de nuevo.")).toBeInTheDocument();
    expect(name).toHaveValue("Zona norte");
    expect(screen.getByRole("button", { name: "Volver a leer", hidden: true })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(saved).toEqual([{ expectedRevision: 1, name: "Sur", parentId: delivery, icon: null }, { expectedRevision: 1, name: "Zona norte", parentId: delivery, icon: null }]);
  });
});

describe("moving and deleting a folder (CM4)", () => {
  it("moves a subfolder to the menu as a folder of its own, starting where it is", async () => {
    const moved: unknown[] = [];
    server.use(http.put(`/api/forms/folders/${north}`, async ({ request }) => { moved.push(await request.json()); return HttpResponse.json(folder(north, null, "Norte", "package", 2)); }));
    const onClose = vi.fn();
    renderDialog(scope => <FolderMoveDialog scope={scope} folders={tree} folder={tree[2]} onClose={onClose} />);
    const dialog = await screen.findByRole("dialog", { name: "Mover «Norte» a…" });
    expect(within(dialog).getAllByRole("radio")).toHaveLength(3);
    expect(within(dialog).getByRole("radio", { name: "Adentro de «Repartos»" })).toBeChecked();
    expect(within(dialog).getByRole("radio", { name: "Adentro de «Facturación»" })).not.toBeChecked();
    expect(within(dialog).getByRole("button", { name: "Mover" })).toBeDisabled();
    await userEvent.click(within(dialog).getByRole("radio", { name: "Al menú, como carpeta propia" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Mover" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(moved).toEqual([{ expectedRevision: 1, name: "Norte", parentId: null, icon: null }]);
  });

  it("does not let a folder with subfolders go into another, and says why", async () => {
    renderDialog(scope => <FolderMoveDialog scope={scope} folders={tree} folder={tree[1]} onClose={vi.fn()} />);
    const dialog = await screen.findByRole("dialog", { name: "Mover «Repartos» a…" });
    expect(within(dialog).getByRole("radio", { name: "Al menú, como carpeta propia" })).toBeChecked();
    expect(within(dialog).queryByRole("radio", { name: "Adentro de «Repartos»" })).not.toBeInTheDocument();
    const into = within(dialog).getByRole("radio", { name: "Adentro de «Facturación»" });
    expect(into).toHaveAttribute("aria-disabled", "true");
    expect(into).toHaveAccessibleDescription("Tiene subcarpetas: no puede ir adentro de otra.");
  });

  it("says that a folder of the first level leaves the menu, counts what is lost and deletes with the revision it read", async () => {
    const deleted: unknown[] = [];
    server.use(
      http.get(`/api/forms/folders/${delivery}/deletion`, () => HttpResponse.json({ revision: 4, subfolderCount: 2, formCount: 5, catalogCount: 4 })),
      http.delete(`/api/forms/folders/${delivery}`, async ({ request }) => { deleted.push(await request.json()); return new HttpResponse(null, { status: 204 }); }),
    );
    const onClose = vi.fn();
    renderDialog(scope => <FolderDeleteDialog scope={scope} folders={tree} folder={tree[1]} onClose={onClose} />);
    const dialog = await screen.findByRole("dialog", { name: "¿Borrar «Repartos»?" });
    expect(await within(dialog).findByText("Sale del menú. También se borran sus 2 subcarpetas. Los 9 formularios y catálogos quedan en sus otras carpetas o sin carpeta.")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Borrar carpeta" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(deleted).toEqual([{ expectedRevision: 4 }]);
  });

  it("says that a subfolder leaves its folder", async () => {
    server.use(http.get(`/api/forms/folders/${north}/deletion`, () => HttpResponse.json({ revision: 1, subfolderCount: 0, formCount: 1, catalogCount: 0 })));
    renderDialog(scope => <FolderDeleteDialog scope={scope} folders={tree} folder={tree[2]} onClose={vi.fn()} />);
    const dialog = await screen.findByRole("dialog", { name: "¿Borrar «Norte»?" });
    expect(await within(dialog).findByText("Sale de «Repartos». El formulario queda en sus otras carpetas o sin carpeta.")).toBeInTheDocument();
  });
});

describe("the forms of a folder (CM2)", () => {
  const formId = (n: number) => `0199a0c0-0000-7000-8000-0000000000a${n}`;
  const row = (n: number, name: string, activeVersionNumber: number | null) => ({ id: formId(n), name: { es: name }, prefix: `F${n}`, questionCount: 2, activeVersionNumber,
    displayState: activeVersionNumber ? "Published" : "Draft", lastChangedAtUtc: "2026-11-10T12:00:00Z", lastChangedBy: null, canEdit: true, lifecycle: fixtureLifecycle() });
  // Alphabetical, as the server sends them; «Visita» is already in the folder and a deactivated form (5) is too, unlisted.
  const rows = [row(1, "Control de carga", 2), row(2, "Entrega", null), row(3, "Visita", 1)];
  const page = { items: rows, page: 1, pageSize: 50, totalCount: 3, totalPages: 1, hasPrevious: false, hasNext: false };

  it("puts the forms already in it first, tags a draft and saves what was read plus the ticked minus the unticked", async () => {
    let current = [formId(3), formId(5)];
    const saved: unknown[] = [];
    const listings: URLSearchParams[] = [];
    server.use(
      http.get("/api/forms/definitions", ({ request }) => { listings.push(new URL(request.url).searchParams); return HttpResponse.json(page); }),
      http.get(`/api/forms/folders/${delivery}/forms`, () => HttpResponse.json({ formIds: current })),
      http.put(`/api/forms/folders/${delivery}/forms`, async ({ request }) => {
        const body = await request.json() as { expectedFormIds: string[]; formIds: string[] };
        saved.push(body);
        if ([...body.expectedFormIds].sort().join() !== [...current].sort().join()) return conflict("Forms.Folder.SetChanged", "Los formularios de la carpeta cambiaron. Recargalos e intentá de nuevo.");
        current = body.formIds;
        return HttpResponse.json({ formIds: body.formIds });
      }),
    );
    const onClose = vi.fn();
    renderDialog(scope => <FolderFormsDialog scope={scope} folder={{ id: delivery, name: "Repartos" }} onClose={onClose} />);
    const dialog = await screen.findByRole("dialog", { name: "Formularios de «Repartos»" });
    await within(dialog).findByRole("checkbox", { name: "Visita" });
    expect(within(dialog).getAllByRole("checkbox").map(box => document.querySelector(`label[for="${box.id}"]`)?.textContent)).toEqual(["Visita", "Control de carga", "Entrega"]);
    expect(within(dialog).getByRole("checkbox", { name: "Visita" })).toBeChecked();
    expect(within(dialog).getByRole("checkbox", { name: "Entrega" })).toHaveAccessibleDescription("Borrador");
    expect(within(dialog).getByRole("checkbox", { name: "Control de carga" })).not.toHaveAccessibleDescription();
    expect(listings[0].get("publicationFilter")).toBe("Active");
    expect(within(dialog).getByRole("searchbox", { name: "Buscar formularios" })).toBeInTheDocument();
    const save = within(dialog).getByRole("button", { name: "Guardar" });
    expect(save).toBeDisabled();
    await userEvent.click(within(dialog).getByRole("checkbox", { name: "Entrega" }));
    await userEvent.click(within(dialog).getByRole("checkbox", { name: "Visita" }));
    // Someone added «Control de carga» in between: the set read is no longer the current one.
    current = [formId(3), formId(5), formId(1)];
    await userEvent.click(save);
    expect(await screen.findByText("Los formularios de la carpeta cambiaron. Recargalos e intentá de nuevo.")).toBeInTheDocument();
    expect(within(dialog).getByRole("checkbox", { name: "Entrega" })).toBeChecked();
    expect(within(dialog).getByRole("checkbox", { name: "Visita" })).not.toBeChecked();
    await userEvent.click(screen.getByRole("button", { name: "Volver a leer", hidden: true }));
    await waitFor(() => expect(within(dialog).getByRole("checkbox", { name: "Control de carga" })).toBeChecked());
    // «Volver a leer» closes its notice, which has to be gone before the result takes its place.
    await waitFor(() => expect(screen.queryByText("Los formularios de la carpeta cambiaron. Recargalos e intentá de nuevo.")).not.toBeInTheDocument());
    await userEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    // The deactivated form, which is not listed, stays in the folder.
    expect(saved).toEqual([
      { expectedFormIds: [formId(3), formId(5)], formIds: [formId(5), formId(2)] },
      { expectedFormIds: [formId(3), formId(5), formId(1)], formIds: [formId(5), formId(1), formId(2)] },
    ]);
    expect(await screen.findByText("Guardamos los formularios de «Repartos».")).toBeInTheDocument();
  });

  it("brings the next page with «Ver más»", async () => {
    server.use(
      http.get("/api/forms/definitions", ({ request }) => {
        const second = new URL(request.url).searchParams.get("page") === "2";
        return HttpResponse.json(second ? { ...page, items: [row(4, "Zona", 1)], page: 2, hasPrevious: true } : { ...page, totalCount: 4, totalPages: 2, hasNext: true });
      }),
      http.get(`/api/forms/folders/${delivery}/forms`, () => HttpResponse.json({ formIds: [] })),
    );
    renderDialog(scope => <FolderFormsDialog scope={scope} folder={{ id: delivery, name: "Repartos" }} onClose={vi.fn()} />);
    const dialog = await screen.findByRole("dialog", { name: "Formularios de «Repartos»" });
    await within(dialog).findByRole("checkbox", { name: "Visita" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Ver más" }));
    expect(await within(dialog).findByRole("checkbox", { name: "Zona" })).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Ver más" })).not.toBeInTheDocument();
  });
});
