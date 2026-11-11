import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { currentUser } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import type { FormFolder } from "../api/folders";
import { useFolderScope } from "../hooks/useFormFolders";
import { FolderDeleteDialog } from "./FolderDeleteDialog";
import { FolderMenuDialog } from "./FolderMenuDialog";
import { FolderMoveDialog } from "./FolderMoveDialog";
import { ItemFoldersDialog } from "./ItemFoldersDialog";

vi.mock("react-oidc-context", async () => {
  const actual = await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context");
  return { ...actual, useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "t" } }) };
});

// Synthetic folders for the dialogs' behavior; the HTTP contract test consumes the backend capture separately.
const billing = "0199a0c0-0000-7000-8000-0000000000f1";
const delivery = "0199a0c0-0000-7000-8000-0000000000f2";
const north = "0199a0c0-0000-7000-8000-0000000000f3";
const catalog = "0199a0c0-0000-7000-8000-0000000000c1";
const folder = (id: string, parentId: string | null, name: string, revision = 1): FormFolder => ({ id, parentId, name, revision, menuPlacement: "None", menuIcon: null });
const tree = [folder(billing, null, "Facturación"), folder(delivery, null, "Repartos"), folder(north, delivery, "Norte")];
const manager = ["formcatalogs.read", "formcatalogs.manage", "formtemplates.read", "formtemplates.manage"];

function WithScope({ children }: { children: (scope: ReturnType<typeof useFolderScope>) => React.ReactNode }) {
  const scope = useFolderScope();
  return scope.actorId ? <>{children(scope)}</> : null;
}
function renderDialog(children: (scope: ReturnType<typeof useFolderScope>) => React.ReactNode) {
  server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: manager })),
    http.get("/api/forms/folders", () => HttpResponse.json({ folders: tree, canManage: true })));
  return renderWithProviders(<MemoryRouter><WithScope>{children}</WithScope></MemoryRouter>);
}

describe("«Carpetas…» of a catalog (CP2-A)", () => {
  it("ticks the folders it is in, creates one right there and saves the whole set with the one it read", async () => {
    const saved: unknown[] = [];
    server.use(
      http.get(`/api/forms/catalogs/${catalog}/folders`, () => HttpResponse.json({ folderIds: [billing] })),
      http.post("/api/forms/folders", async ({ request }) => HttpResponse.json(folder("0199a0c0-0000-7000-8000-0000000000f9", null, (await request.json() as { name: string }).name))),
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

  it("keeps what is ticked when someone changed the set, and saves against the one read again", async () => {
    let current = [billing];
    const saved: unknown[] = [];
    server.use(
      http.get(`/api/forms/catalogs/${catalog}/folders`, () => HttpResponse.json({ folderIds: current })),
      http.put(`/api/forms/catalogs/${catalog}/folders`, async ({ request }) => {
        const body = await request.json() as { expectedFolderIds: string[]; folderIds: string[] };
        saved.push(body);
        return body.expectedFolderIds.join() === current.join() ? HttpResponse.json({ folderIds: body.folderIds })
          : HttpResponse.json({ code: "Forms.Folder.SetChanged", detail: "Las carpetas de este elemento cambiaron. Recargalas e intentá de nuevo." }, { status: 409 });
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

describe("the «…» of a folder (CP3-A, CP5-A)", () => {
  it("moves anywhere but into itself or its subfolders", async () => {
    const moved: unknown[] = [];
    server.use(http.put(`/api/forms/folders/${delivery}`, async ({ request }) => { moved.push(await request.json()); return HttpResponse.json(folder(delivery, billing, "Repartos", 2)); }));
    const onClose = vi.fn();
    renderDialog(scope => <FolderMoveDialog scope={scope} folders={tree} folder={tree[1]} onClose={onClose} />);
    const dialog = await screen.findByRole("dialog", { name: "Mover «Repartos» a…" });
    expect(within(dialog).getByRole("radio", { name: "Arriba de todo" })).toBeChecked();
    expect(within(dialog).getByRole("radio", { name: "Repartos" })).toHaveAttribute("aria-disabled", "true");
    expect(within(dialog).getByRole("radio", { name: "Norte" })).toHaveAttribute("aria-disabled", "true");
    expect(within(dialog).getByText("En Repartos")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("radio", { name: "Facturación" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Mover" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(moved).toEqual([{ expectedRevision: 1, name: "Repartos", parentId: billing }]);
  });

  it("counts what deleting loses before asking, and deletes with the revision it read", async () => {
    const deleted: unknown[] = [];
    server.use(
      http.get(`/api/forms/folders/${delivery}/deletion`, () => HttpResponse.json({ revision: 4, subfolderCount: 2, formCount: 5, catalogCount: 4 })),
      http.delete(`/api/forms/folders/${delivery}`, async ({ request }) => { deleted.push(await request.json()); return new HttpResponse(null, { status: 204 }); }),
    );
    const onDeleted = vi.fn();
    const onClose = vi.fn();
    renderDialog(scope => <FolderDeleteDialog scope={scope} folders={tree} folder={tree[1]} selection={{ kind: "folder", id: north }} onDeleted={onDeleted} onClose={onClose} />);
    const dialog = await screen.findByRole("dialog", { name: "¿Borrar «Repartos»?" });
    expect(await within(dialog).findByText("También se borran sus 2 subcarpetas.")).toBeInTheDocument();
    expect(within(dialog).getByText("Los 9 formularios y catálogos quedan en sus otras carpetas o en «Sin carpeta».")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Borrar carpeta" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(deleted).toEqual([{ expectedRevision: 4 }]);
    expect(onDeleted).toHaveBeenCalledWith(true);
  });

  it("puts a folder in a menu of its own with the folder icon by default", async () => {
    const placed: unknown[] = [];
    server.use(http.put(`/api/forms/folders/${delivery}/menu`, async ({ request }) => { placed.push(await request.json()); return HttpResponse.json({ ...folder(delivery, null, "Repartos", 2), menuPlacement: "Own", menuIcon: "folder" }); }));
    const onClose = vi.fn();
    renderDialog(scope => <FolderMenuDialog scope={scope} folder={tree[1]} onClose={onClose} />);
    const dialog = await screen.findByRole("dialog", { name: "«Repartos» en el menú" });
    expect(within(dialog).getByRole("radio", { name: "Fuera del menú" })).toBeChecked();
    expect(within(dialog).getByRole("button", { name: "Guardar" })).toBeDisabled();
    await userEvent.click(within(dialog).getByRole("radio", { name: "Un menú propio" }));
    expect(within(dialog).getByRole("combobox", { name: /Ícono/ })).toHaveTextContent("Carpeta");
    await userEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(placed).toEqual([{ expectedRevision: 1, placement: "Own", icon: "folder" }]);
    expect(await screen.findByText("Guardamos el lugar de «Repartos» en el menú.")).toBeInTheDocument();
  });
});
