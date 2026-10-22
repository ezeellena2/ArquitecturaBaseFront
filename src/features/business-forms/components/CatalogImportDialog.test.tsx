import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { queryClient } from "@/shared/api/queryClient";
import { ApiError } from "@/shared/api/ApiError";
import { catalogImportPreviewFixture } from "@/test/catalogImportFixtures";
import * as imports from "../api/catalogImports";
import * as catalogs from "../api/catalogs";
import type { CatalogDetail } from "../api/catalogResponse";
import { CatalogImportDialog } from "./CatalogImportDialog";
const catalog: CatalogDetail = { valueType: "Text", proposal: null, id: catalogImportPreviewFixture().catalogId, key: catalogImportPreviewFixture().catalogId.replaceAll("-", ""), name: { es: "Lista", en: "List" }, description: { es: "Prueba", en: "Test" }, kind: "Manual", revision: 7, isActive: true, itemsCount: 2, usageCount: null, unavailableReasonCode: null, filters: null };
const scope = { actorId: "actor", culture: "es" as const, permissions: ["formcatalogs.read", "formcatalogs.manage"] };
afterEach(() => { cleanup(); vi.restoreAllMocks(); queryClient.clear(); });
async function mount(initialSource: "file" | "paste" = "paste") {
  const onApplied = vi.fn(), onObserved = vi.fn(), onClose = vi.fn();
  const props = { scope, catalog, initialSource, onApplied, onObserved, onClose, onTemplate: vi.fn() };
  let view!: ReturnType<typeof renderWithProviders>;
  await act(async () => { view = renderWithProviders(<CatalogImportDialog {...props}/>); });
  return { ...view, props, user: userEvent.setup(), onApplied, onObserved, onClose };
}
it("reviews pasted rows through Append preview without saving, then requires the server confirmations before one explicit apply", async () => {
  const preview = { ...catalogImportPreviewFixture(), mode: "Append" as const, counts: { ...catalogImportPreviewFixture().counts, deactivated: 0 }, deactivated: [], confirmations: { deactivations: 0, emptySheet: false, manyErrors: true } };
  const check = vi.spyOn(imports, "previewCatalogImport").mockResolvedValue(preview);
  const apply = vi.spyOn(imports, "applyCatalogImport").mockResolvedValue({ catalog: { ...catalog, revision: 8 }, itemIdentityMap: {} });
  const { user, onApplied } = await mount();
  await user.type(screen.getByRole("textbox", { name: "Pegá las filas con encabezados" }), "Code\tText\nN\tNorte");
  await user.click(screen.getByRole("button", { name: "Revisar" }));
  await screen.findByText("Repetido: también está en la fila 2.");
  expect(check).toHaveBeenCalledExactlyOnceWith(catalog.id, expect.objectContaining({ file: expect.any(File), mode: "Append", expectedRevision: 7 }), expect.any(AbortSignal));
  expect(apply).not.toHaveBeenCalled();
  const button = screen.getByRole("button", { name: "Aplicar sin la fila con errores" });
  expect(button).toBeDisabled();
  await user.click(screen.getByText("Sí, aplicar sin las filas con errores"));
  await user.click(button);
  await waitFor(() => expect(onApplied).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ revision: 8 })));
  expect(apply).toHaveBeenCalledExactlyOnceWith(catalog.id, expect.objectContaining({ sheetSha256: preview.sheetSha256, confirmDeactivations: 0, confirmErrors: true, confirmEmpty: false, mode: "Append" }), expect.any(AbortSignal));
  expect(queryClient.getMutationCache().getAll()).toEqual([]);
});
it("rereads after a revision conflict without another automatic apply and preserves the same file", async () => {
  const check = vi.spyOn(imports, "previewCatalogImport").mockResolvedValue({ ...catalogImportPreviewFixture(), mode: "Append", confirmations: { deactivations: 0, manyErrors: false, emptySheet: false } });
  const apply = vi.spyOn(imports, "applyCatalogImport").mockRejectedValue(new ApiError(409, { code: "Forms.Catalog.RevisionConflict" }));
  const read = vi.spyOn(catalogs, "fetchCatalog").mockResolvedValue({ ...catalog, revision: 8 });
  const { user, onObserved } = await mount();
  await user.type(screen.getByRole("textbox", { name: "Pegá las filas con encabezados" }), "Code\tText\nN\tNorte");
  await user.click(screen.getByRole("button", { name: "Revisar" }));
  await user.click(await screen.findByRole("button", { name: "Aplicar sin la fila con errores" }));
  check.mockResolvedValue({ ...catalogImportPreviewFixture(), revision: 8, mode: "Append" });
  await user.click(await screen.findByRole("button", { name: "Revisar de nuevo" }));
  await waitFor(() => expect(check).toHaveBeenCalledTimes(2));
  expect(read).toHaveBeenCalledExactlyOnceWith(catalog.id, expect.any(AbortSignal));
  expect(check.mock.calls[1]![1]).toMatchObject({ expectedRevision: 8, file: check.mock.calls[0]![1].file });
  expect(onObserved).toHaveBeenCalledWith(expect.objectContaining({ revision: 8 }));
  expect(apply).toHaveBeenCalledTimes(1);
});
it("aborts a private preview on close and refuses a late result after permission is revoked", async () => {
  let resolve!: (value: imports.CatalogImportPreview) => void;
  const check = vi.spyOn(imports, "previewCatalogImport").mockImplementation(() => new Promise(done => { resolve = done; }));
  const { user, props, rerender, unmount, onApplied } = await mount();
  fireEvent.change(screen.getByRole("textbox", { name: "Pegá las filas con encabezados" }), { target: { value: "Code\tText\nN\tNorte" } });
  await user.click(screen.getByRole("button", { name: "Revisar" }));
  const signal = check.mock.calls[0]![2]!;
  rerender(<CatalogImportDialog {...props} scope={{ ...scope, permissions: [] }}/>);
  await waitFor(() => expect(signal.aborted).toBe(true));
  await act(async () => resolve(catalogImportPreviewFixture()));
  expect(screen.queryByText("Norte")).not.toBeInTheDocument(); expect(screen.queryByRole("textbox")).not.toBeInTheDocument(); expect(onApplied).not.toHaveBeenCalled();
  unmount(); expect(queryClient.getMutationCache().getAll()).toEqual([]);
});

it("keeps an already applied file as information and allows restoring it at the current revision", async () => {
  const base=catalogImportPreviewFixture();
  vi.spyOn(imports,"previewCatalogImport").mockResolvedValue({...base,mode:"Append",alreadyAppliedAtUtc:"2026-10-22T08:00:00Z",counts:{...base.counts,errorRows:0,deactivated:0},issues:[],deactivated:[],confirmations:{deactivations:0,emptySheet:false,manyErrors:false}});
  const apply=vi.spyOn(imports,"applyCatalogImport").mockResolvedValue({catalog:{...catalog,revision:8},itemIdentityMap:{}});
  const {user}=await mount();
  await user.type(screen.getByRole("textbox",{name:"Pegá las filas con encabezados"}),"Code\tText\nN\tNorte");
  await user.click(screen.getByRole("button",{name:"Revisar"}));
  expect(await screen.findByText(/Esta planilla ya se aplicó/)).toBeInTheDocument();
  const button=screen.getByRole("button",{name:"Aplicar"}); expect(button).toBeEnabled();
  await user.click(button);await waitFor(()=>expect(apply).toHaveBeenCalledOnce());
  expect(apply.mock.calls[0]![1]).toMatchObject({expectedRevision:7,sheetSha256:base.sheetSha256});
});

it("reviews a file in Replace mode and requires both empty-sheet and exact deactivation confirmations",async()=>{
 const base=catalogImportPreviewFixture();vi.spyOn(imports,"previewCatalogImport").mockResolvedValue({...base,rowsRead:0,counts:{...base.counts,added:0,errorRows:0},added:[],issues:[],confirmations:{deactivations:1,emptySheet:true,manyErrors:false}});
 const apply=vi.spyOn(imports,"applyCatalogImport").mockResolvedValue({catalog:{...catalog,revision:8},itemIdentityMap:{}});
 const {user}=await mount("file");const file=new File(["Code,Text"],"Vacia.csv",{type:"text/csv"});
 await user.upload(screen.getByLabelText("Archivo",{exact:true}),file);await user.click(screen.getByRole("button",{name:"Revisar"}));
 const button=await screen.findByRole("button",{name:"Aplicar"});expect(button).toBeDisabled();
 await user.click(screen.getByText("Sí, dar de baja 1 opción"));expect(button).toBeDisabled();
 await user.click(screen.getByText("Sí, aplicar esta planilla sin filas válidas"));expect(button).toBeEnabled();
 expect(apply).not.toHaveBeenCalled();await user.click(button);await waitFor(()=>expect(apply).toHaveBeenCalledOnce());
 expect(apply.mock.calls[0]![1]).toMatchObject({mode:"Replace",file,confirmDeactivations:1,confirmEmpty:true,confirmErrors:false});
});
it("removes the pasted text and review on a forbidden write without retrying",async()=>{
 const base=catalogImportPreviewFixture();vi.spyOn(imports,"previewCatalogImport").mockResolvedValue({...base,mode:"Append",counts:{...base.counts,deactivated:0,errorRows:0},issues:[],deactivated:[],confirmations:{deactivations:0,emptySheet:false,manyErrors:false}});
 const apply=vi.spyOn(imports,"applyCatalogImport").mockRejectedValue(new ApiError(403,{}));const {user}=await mount();
 await user.type(screen.getByRole("textbox",{name:"Pegá las filas con encabezados"}),"Code\tText\nN\tNorte");await user.click(screen.getByRole("button",{name:"Revisar"}));
 await user.click(await screen.findByRole("button",{name:"Aplicar"}));
 expect(await screen.findByText("Ya no tenés permiso para importar opciones.")).toBeInTheDocument();expect(screen.queryByRole("textbox")).not.toBeInTheDocument();expect(screen.queryByRole("button",{name:"Aplicar"})).not.toBeInTheDocument();expect(apply).toHaveBeenCalledOnce();
});
