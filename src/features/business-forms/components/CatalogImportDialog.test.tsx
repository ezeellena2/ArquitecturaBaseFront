import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { queryClient } from "@/shared/api/queryClient";
import i18n from "@/shared/i18n";
import * as notifications from "@/shared/ui/notifications";
import { ApiError } from "@/shared/api/ApiError";
import { catalogImportPreviewFixture } from "@/test/catalogImportFixtures";
import * as imports from "../api/catalogImports";
import * as catalogs from "../api/catalogs";
import type { CatalogDetail } from "../api/catalogResponse";
import { CatalogImportDialog } from "./CatalogImportDialog";
const catalog: CatalogDetail = { valueType: "Text", proposal: null, id: catalogImportPreviewFixture().catalogId, key: catalogImportPreviewFixture().catalogId.replaceAll("-", ""), name: { es: "Lista", en: "List" }, description: { es: "Prueba", en: "Test" }, kind: "Manual", revision: 7, isActive: true, itemsCount: 2, usageCount: null, unavailableReasonCode: null, filters: null };
const scope = { actorId: "actor", culture: "es" as const, permissions: ["formcatalogs.read", "formcatalogs.manage"] };
afterEach(async () => { cleanup(); vi.restoreAllMocks(); queryClient.clear(); await i18n.changeLanguage("es"); });
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
  await screen.findByText("Repetido: también está en otra fila.");
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

it.each([
  ["Decimal", "es", "1500.5", "1.500,5", "2500.75", "2.500,75"],
  ["Decimal", "en", "1500.5", "1,500.5", "2500.75", "2,500.75"],
  ["Date", "es", "2026-04-03", "3 abr 2026", "2026-05-04", "4 may 2026"],
  ["Date", "en", "2026-04-03", "Apr 3, 2026", "2026-05-04", "May 4, 2026"],
] as const)("shows normalized %s values for added and changed rows in %s before applying", async (valueType, culture, before, shownBefore, after, shownAfter) => {
  await i18n.changeLanguage(culture);
  const base = catalogImportPreviewFixture();
  vi.spyOn(imports, "previewCatalogImport").mockResolvedValue({ ...base, mode: "Append", issues: [], deactivated: [],
    added: [{ ...base.added[0]!, value: after }],
    changed: [{ row: 3, itemId: catalog.id, code: "C", changes: [{ column: "value", before, after }] }],
    counts: { ...base.counts, changed: 1, deactivated: 0, errorRows: 0 }, confirmations: { deactivations: 0, emptySheet: false, manyErrors: false } });
  const apply = vi.spyOn(imports, "applyCatalogImport");
  const user = userEvent.setup();
  await act(async () => { renderWithProviders(<CatalogImportDialog scope={{ ...scope, culture }} catalog={{ ...catalog, valueType }} initialSource="paste" onApplied={vi.fn()} onObserved={vi.fn()} onClose={vi.fn()} onTemplate={vi.fn()}/>); });
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Code\tText\tValue\nN\tNorte\t" + after } });
  await user.click(screen.getByRole("button", { name: culture === "en" ? "Review" : "Revisar" }));
  await user.click(await screen.findByRole("tab", { name: culture === "en" ? "New" : "Altas" }));
  expect(within(screen.getByRole("tabpanel")).getByRole("cell", { name: shownAfter })).toBeInTheDocument();
  await user.click(screen.getByRole("tab", { name: culture === "en" ? "Changes" : "Cambios" }));
  expect(within(screen.getByRole("tabpanel")).getByText(`${culture === "en" ? "Value" : "Valor"}: ${shownBefore} → ${shownAfter}`)).toBeInTheDocument();
  expect(apply).not.toHaveBeenCalled();
});

it.each(["es", "en"] as const)("identifies errors and warnings with the original header and related row in %s", async culture => {
  await i18n.changeLanguage(culture);
  const base = catalogImportPreviewFixture(), english = culture === "en";
  const errorMessage = english ? "Duplicate: it is also in another row." : "Repetido: también está en otra fila.";
  const warningMessage = english ? "This column is not part of the catalog: it is ignored." : "Esta columna no es del catálogo: se ignora.";
  vi.spyOn(imports, "previewCatalogImport").mockResolvedValue({ ...base, mode: "Append", deactivated: [],
    counts: { ...base.counts, deactivated: 0, warnings: 1 },
    issues: [
      { row: 1, column: "Supervisor", severity: "Warning", code: "Forms.CatalogImport.UnknownColumn", message: warningMessage, relatedRow: null, length: null },
      { ...base.issues[0]!, message: errorMessage },
    ], confirmations: { deactivations: 0, emptySheet: false, manyErrors: false } });
  const apply = vi.spyOn(imports, "applyCatalogImport");
  const { user } = await mount();
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Code\tText\tSupervisor\nN\tNorte\tAna" } });
  await user.click(screen.getByRole("button", { name: english ? "Review" : "Revisar" }));
  expect(await screen.findByRole("columnheader", { name: english ? "Type" : "Tipo" })).toBeInTheDocument();
  const warningRow = screen.getByText("Supervisor").closest("tr")!;
  expect(within(warningRow).getByText(english ? "Warning" : "Aviso")).toBeInTheDocument();
  expect(within(warningRow).getByText(warningMessage)).toBeInTheDocument();
  const errorRow = screen.getByText(errorMessage).closest("tr")!;
  expect(within(errorRow).getByText("Error")).toBeInTheDocument();
  expect(within(errorRow).getByText(english ? "Row 2" : "Fila 2")).toBeInTheDocument();
  expect(apply).not.toHaveBeenCalled();
});

it("preserves the file after a preview conflict and rereads only on explicit review", async () => {
  const check = vi.spyOn(imports, "previewCatalogImport")
    .mockRejectedValueOnce(new ApiError(409, { code: "Forms.Catalog.RevisionConflict" }))
    .mockResolvedValue({ ...catalogImportPreviewFixture(), revision: 8, mode: "Append" });
  const read = vi.spyOn(catalogs, "fetchCatalog").mockResolvedValue({ ...catalog, revision: 8 });
  const apply = vi.spyOn(imports, "applyCatalogImport");
  const { user, onObserved } = await mount();
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Code\tText\nN\tNorte" } });
  await user.click(screen.getByRole("button", { name: "Revisar" }));
  const retry = await screen.findByRole("button", { name: "Revisar de nuevo" });
  expect(screen.getByRole("textbox")).toHaveValue("Code\tText\nN\tNorte");
  expect(check).toHaveBeenCalledOnce();
  expect(read).not.toHaveBeenCalled();
  await user.click(retry);
  await waitFor(() => expect(check).toHaveBeenCalledTimes(2));
  expect(read).toHaveBeenCalledExactlyOnceWith(catalog.id, expect.any(AbortSignal));
  expect(check.mock.calls[1]![1]).toMatchObject({ file: check.mock.calls[0]![1].file, expectedRevision: 8, mode: "Append" });
  expect(onObserved).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ revision: 8 }));
  expect(apply).not.toHaveBeenCalled();
});

it.each([
  ["es", "TooManyColumns", "La planilla tiene demasiadas columnas.", "Hoja «Detalle 2026»: La planilla tiene demasiadas columnas."],
  ["en", "TooManyColumns", "The spreadsheet has too many columns.", "Sheet “Detalle 2026”: The spreadsheet has too many columns."],
  ["es", "TooManyRows", "La planilla tiene demasiadas filas.", "Hoja «Detalle 2026»: La planilla tiene demasiadas filas."],
  ["en", "TooManyRows", "The spreadsheet has too many rows.", "Sheet “Detalle 2026”: The spreadsheet has too many rows."],
] as const)("names the offending sheet for a %s %s response without repeating the preview", async (culture, reason, detail, message) => {
  await i18n.changeLanguage(culture);
  const notice = vi.spyOn(notifications, "notify");
  const check = vi.spyOn(imports, "previewCatalogImport").mockRejectedValue(new ApiError(400, { code: "Forms.CatalogImport." + reason, detail, sheet: "Detalle 2026" }));
  const { user } = await mount();
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Code\tText\nN\tNorte" } });
  await user.click(screen.getByRole("button", { name: culture === "en" ? "Review" : "Revisar" }));
  await waitFor(() => expect(notice).toHaveBeenCalledOnce());
  expect(notice).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ kind: "error", message }));
  expect(check).toHaveBeenCalledOnce();
  expect(screen.getByRole("textbox")).toHaveValue("Code\tText\nN\tNorte");
});

it.each([
  ["Forms.CatalogImport.FileUnreadable", "Do not render this metadata"],
  ["Forms.CatalogImport.TooManyColumns", { private: "Do not render this metadata" }],
])("ignores unrelated or malformed sheet metadata for %s", async (code, sheet) => {
  const notice = vi.spyOn(notifications, "notify");
  vi.spyOn(imports, "previewCatalogImport").mockRejectedValue(new ApiError(400, { code, detail: "Revisá la planilla.", sheet }));
  const { user } = await mount();
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Code\tText\nN\tNorte" } });
  await user.click(screen.getByRole("button", { name: "Revisar" }));
  await waitFor(() => expect(notice).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ kind: "error", message: "Revisá la planilla." })));
});

it.each(["es", "en"] as const)("uses localized pasted-row steps and filenames in %s", async culture => {
  await i18n.changeLanguage(culture);
  const base = catalogImportPreviewFixture();
  const check = vi.spyOn(imports, "previewCatalogImport").mockResolvedValue({ ...base, mode: "Append" });
  const { user } = await mount();
  expect(screen.getAllByRole("listitem")[0]).toHaveTextContent(culture === "en" ? "Rows" : "Filas");
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Code\tText\nN\tNorte" } });
  await user.click(screen.getByRole("button", { name: culture === "en" ? "Review" : "Revisar" }));
  await screen.findByRole("tab", { name: culture === "en" ? "New" : "Altas" });
  const filename = culture === "en" ? "Pasted.csv" : "Pegado.csv";
  expect(check.mock.calls[0]![1].file.name).toBe(filename);
  expect(screen.getByText(new RegExp(filename.replace(".", "\\.")))).toBeInTheDocument();
});

it.each([
  ["es", "columns"], ["en", "columns"], ["es", "bytes"], ["en", "bytes"],
] as const)("describes the pasted text limit without a file instruction in %s for %s", async (culture, limit) => {
  await i18n.changeLanguage(culture);
  const check = vi.spyOn(imports, "previewCatalogImport");
  if (limit === "bytes") vi.spyOn(Blob.prototype, "size", "get").mockReturnValue(10 * 1024 * 1024 + 1);
  const { user } = await mount();
  fireEvent.change(screen.getByRole("textbox"), { target: { value: limit === "columns" ? Array.from({ length: 65 }, () => "Header").join("\t") : "Code\tText\nN\tNorte" } });
  await user.click(screen.getByRole("button", { name: culture === "en" ? "Review" : "Revisar" }));
  expect(screen.getByText(culture === "en" ? "Paste up to 10,000 rows and 64 columns, without exceeding 10 MB of text." : "Pegá hasta 10.000 filas y 64 columnas, sin superar 10 MB de texto.")).toBeInTheDocument();
  expect(check).not.toHaveBeenCalled();
});
