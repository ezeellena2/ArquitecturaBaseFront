import { act, cleanup, screen, waitFor, within } from "@testing-library/react";
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
import type { CatalogDetail, CatalogField } from "../api/catalogResponse";
import { CatalogImportDialog } from "./CatalogImportDialog";
const catalog: CatalogDetail = { valueType: "Text", proposal: null, id: catalogImportPreviewFixture().catalogId, key: catalogImportPreviewFixture().catalogId.replaceAll("-", ""), name: { es: "Lista", en: "List" }, description: { es: "Prueba", en: "Test" }, kind: "Manual", revision: 7, isActive: true, itemsCount: 2, usageCount: null, originalCulture: "es", unavailableReasonCode: null, filters: null, fields: [], presentation: null, presentationCheck: { cultures: [{ culture: "es", titleTooLongCount: 0, titleExamples: [], descriptionTooLongCount: 0, descriptionExamples: [] }, { culture: "en", titleTooLongCount: 0, titleExamples: [], descriptionTooLongCount: 0, descriptionExamples: [] }] } };
const scope = { actorId: "actor", culture: "es" as const, permissions: ["formcatalogs.read", "formcatalogs.manage"] };
const quiet = { deactivations: 0, emptySheet: false, manyErrors: false };
// A change of the review reads side by side (LR2-A): the column once, as the header of its row, before and after in theirs.
const change = (panel: ReturnType<typeof within>, column: string) => within(panel.getByRole("rowheader", { name: column }).closest("tr")!).getAllByRole("cell").slice(-2).map(cell => cell.textContent);
afterEach(async () => { cleanup(); vi.restoreAllMocks(); queryClient.clear(); await i18n.changeLanguage("es"); });
// It opens on the file; «Pegar desde Excel» in «Desde» turns it to the grid.
async function mount(source: "file" | "paste" = "paste", props: Partial<Parameters<typeof CatalogImportDialog>[0]> = {}) {
  const onApplied = vi.fn(), onObserved = vi.fn(), onClose = vi.fn();
  const all = { scope, catalog, onApplied, onObserved, onClose, onTemplate: vi.fn(), ...props };
  let view!: ReturnType<typeof renderWithProviders>;
  await act(async () => { view = renderWithProviders(<CatalogImportDialog {...all}/>); });
  const user = userEvent.setup();
  if (source === "paste") await user.click(screen.getByRole("button", { name: /^(Pegar desde Excel|Paste from Excel)$/ }));
  return { ...view, props: all, user, onApplied, onObserved, onClose };
}
// The empty grid's first cell takes the paste, as Ctrl+V or the phone's «Pegar» would.
async function paste(user: ReturnType<typeof userEvent.setup>, text: string, english = false) {
  await user.click(screen.getByRole("textbox", { name: english ? "Paste rows" : "Pegar filas" }));
  await user.paste(text);
}
const grid = (english = false) => screen.getByRole("region", { name: english ? "Pasted rows" : "Filas pegadas" });
const sentText = (check: { mock: { calls: unknown[][] } }, call = 0) => (check.mock.calls[call]![1] as { file: File }).file.text();

it("opens on the file with its origin in rows, the template in the band and the help in the (i), without notes or steps", async () => {
  const { user, props } = await mount("file");
  const dialog = screen.getByRole("dialog", { name: "Importar opciones a «Lista»" });
  for (const note of ["Archivo o filas pegadas, revisar y aplicar. No se guarda nada hasta aplicar.", "XLSX o CSV, hasta 10 MB y 10.000 filas. No se ejecutan fórmulas ni macros.", "Lo que no viene en la planilla se da de baja, no se borra. Vuelve a ofrecerse si aparece en otra importación."])
    // A help is the hidden description of its (i) (`InfoTip`), never a visible note.
    for (const text of within(dialog).queryAllByText(note)) expect(text).not.toBeVisible();
  expect(within(dialog).queryByRole("list")).not.toBeInTheDocument();
  expect(within(dialog).getByRole("heading", { name: "Origen" })).toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: "Subir un archivo" })).toHaveAttribute("aria-pressed", "true");
  expect(within(dialog).getByText("Ningún archivo elegido")).toBeInTheDocument();
  await user.hover(within(dialog).getByRole("button", { name: "Qué archivo sirve" }));
  expect(await screen.findByRole("tooltip")).toHaveTextContent("XLSX o CSV, hasta 10 MB y 10.000 filas. No se ejecutan fórmulas ni macros.");
  await user.click(within(dialog).getByRole("button", { name: "Descargar la plantilla" }));
  expect(props.onTemplate).toHaveBeenCalledOnce();
  // Without a file, «Revisar» marks the field, as before.
  await user.click(within(dialog).getByRole("button", { name: "Revisar" }));
  expect(screen.getByLabelText("Archivo", { exact: true })).toHaveAccessibleDescription("Elegí un archivo XLSX o CSV de hasta 10 MB.");
});

it("reviews pasted rows through Append preview without saving, then requires the server confirmations before one explicit apply", async () => {
  const preview = { ...catalogImportPreviewFixture(), mode: "Append" as const, counts: { ...catalogImportPreviewFixture().counts, deactivated: 0 }, deactivated: [], confirmations: { deactivations: 0, emptySheet: false, manyErrors: true } };
  const check = vi.spyOn(imports, "previewCatalogImport").mockResolvedValue(preview);
  const apply = vi.spyOn(imports, "applyCatalogImport").mockResolvedValue({ catalog: { ...catalog, revision: 8 }, itemIdentityMap: {}, fieldIdentityMap: {} });
  const { user, onApplied } = await mount();
  await paste(user, "Code\tText\nN\tNorte");
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

// IM3-A: a grid with the catalog's columns; what is pasted shows as a table before reviewing.
it("pastes rows without headers into the catalog's columns and reviews only the pasted ones", async () => {
  const field: CatalogField = { id: "01990000-0000-7000-8000-000000000131", key: "zona", name: { es: "Zona" }, type: "text", sourceCatalogId: null, required: false, unique: false, min: null, max: null, maxLength: null, role: "data", position: 1, isActive: true, valuesCount: 0, usedBy: [] };
  const check = vi.spyOn(imports, "previewCatalogImport").mockResolvedValue({ ...catalogImportPreviewFixture(), mode: "Append" });
  const { user } = await mount("paste", { catalog: { ...catalog, fields: [field] } });
  expect(within(grid()).getAllByRole("columnheader").map(header => header.textContent)).toEqual(["Fila", "Código", "Texto", "Detalle", "Activa", "Zona"]);
  await paste(user, "N\tNorte\nS\tSur\n");
  expect(screen.queryByRole("textbox", { name: "Pegar filas" })).not.toBeInTheDocument();
  expect(within(grid()).getAllByRole("row").slice(1).map(row => within(row).getAllByRole("cell").slice(0, 3).map(cell => cell.textContent))).toEqual([["1", "N", "Norte"], ["2", "S", "Sur"]]);
  expect(screen.getByText("2 filas")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Revisar" }));
  await waitFor(() => expect(check).toHaveBeenCalledOnce());
  // Only the pasted columns travel, so an absent one keeps its values.
  expect(await sentText(check)).toBe('"Code","Text"\r\n"N","Norte"\r\n"S","Sur"');
});

// The first cell leaves with the paste; the focus is not lost: it goes to the filled grid, where another paste replaces the rows.
it("moves the focus to the filled grid, where another paste replaces the rows", async () => {
  const { user } = await mount();
  await paste(user, "N\tNorte\nS\tSur");
  expect(within(grid()).getByRole("region", { name: "Grilla para pegar" })).toHaveFocus();
  await user.paste("C\tCentro");
  expect(within(grid()).getAllByRole("row").slice(1).map(row => within(row).getAllByRole("cell").slice(0, 3).map(cell => cell.textContent))).toEqual([["1", "C", "Centro"]]);
  expect(screen.getByText("1 fila")).toBeInTheDocument();
});

it("places the pasted columns by their headers and says that a column outside the catalog is not imported", async () => {
  const check = vi.spyOn(imports, "previewCatalogImport").mockResolvedValue({ ...catalogImportPreviewFixture(), mode: "Append" });
  const { user } = await mount();
  await paste(user, "Texto\tCódigo\tTeléfono\nNorte\tN\t0342\n");
  expect(within(grid()).getAllByRole("columnheader").map(header => header.textContent)).toEqual(["Fila", "Código", "Texto", "Detalle", "Activa", "Teléfono"]);
  expect(screen.getByText("La columna «Teléfono» no es del catálogo: no se importa.")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Revisar" }));
  await waitFor(() => expect(check).toHaveBeenCalledOnce());
  expect(await sentText(check)).toBe('"Texto","Código"\r\n"Norte","N"');
});

it("empties the grid with «Limpiar» and asks to paste before reviewing", async () => {
  const check = vi.spyOn(imports, "previewCatalogImport");
  const { user } = await mount();
  await user.click(screen.getByRole("button", { name: "Revisar" }));
  expect(await screen.findByText("Pegá las filas en la grilla antes de revisar.")).toBeInTheDocument();
  await paste(user, "N\tNorte");
  await user.click(screen.getByRole("button", { name: "Limpiar" }));
  expect(screen.getByRole("textbox", { name: "Pegar filas" })).toBeInTheDocument();
  expect(screen.queryByText("1 fila")).not.toBeInTheDocument();
  expect(check).not.toHaveBeenCalled();
});

// While the template downloads, its link says so with its ring, like the menu of the options bar (LC1-A).
it("says «Descargando la plantilla…» with its ring while the template downloads", async () => {
  await mount("file", { downloadingTemplate: true });
  const link = screen.getByRole("button", { name: "Descargando la plantilla…" });
  expect(link).toBeDisabled();
  expect(link).toHaveAttribute("aria-busy", "true");
});

// IM2-A: while reading, the button says so and the review zone shows its skeleton; Cancel keeps working.
it("shows that it is reviewing with the button and a skeleton, and Cancel stops the reading", async () => {
  let resolve!: (value: imports.CatalogImportPreview) => void;
  const check = vi.spyOn(imports, "previewCatalogImport").mockImplementation(() => new Promise(done => { resolve = done; }));
  const { user, onClose } = await mount();
  await paste(user, "N\tNorte");
  await user.click(screen.getByRole("button", { name: "Revisar" }));
  expect(screen.getByRole("button", { name: "Revisando…" })).toBeDisabled();
  // The common busy button (LC1-A): its ring, without dimming.
  expect(screen.getByRole("button", { name: "Revisando…" })).toHaveAttribute("aria-busy", "true");
  expect(screen.getByRole("heading", { name: "Revisión" })).toBeInTheDocument();
  expect(screen.getByRole("status", { name: "Revisando…" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Pegar desde Excel" })).toBeDisabled();
  const cancel = screen.getByRole("button", { name: "Cancelar" });
  expect(cancel).toBeEnabled();
  await user.click(cancel);
  expect((check.mock.calls[0]![2] as AbortSignal).aborted).toBe(true);
  expect(onClose).toHaveBeenCalledOnce();
  await act(async () => resolve(catalogImportPreviewFixture()));
});

it("keeps Cancel and the close button in sight but off, with their reason, while applying", async () => {
  vi.spyOn(imports, "previewCatalogImport").mockResolvedValue({ ...catalogImportPreviewFixture(), mode: "Append", issues: [], deactivated: [], counts: { ...catalogImportPreviewFixture().counts, errorRows: 0, deactivated: 0 }, confirmations: quiet });
  let resolve!: (value: Awaited<ReturnType<typeof imports.applyCatalogImport>>) => void;
  vi.spyOn(imports, "applyCatalogImport").mockImplementation(() => new Promise(done => { resolve = done; }));
  const { user, onApplied } = await mount();
  await paste(user, "N\tNorte");
  await user.click(screen.getByRole("button", { name: "Revisar" }));
  await user.click(await screen.findByRole("button", { name: "Aplicar" }));
  expect(screen.getByRole("button", { name: "Aplicando…" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Aplicando…" })).toHaveAttribute("aria-busy", "true");
  for (const name of ["Cancelar", "Cerrar"]) {
    const control = screen.getByRole("button", { name });
    expect(control).toBeDisabled();
    expect(control).toHaveAccessibleDescription("Esperá a que termine de aplicar.");
  }
  await act(async () => resolve({ catalog: { ...catalog, revision: 8 }, itemIdentityMap: {}, fieldIdentityMap: {} }));
  await waitFor(() => expect(onApplied).toHaveBeenCalledOnce());
});

it("rereads after a revision conflict without another automatic apply and preserves the same file", async () => {
  const check = vi.spyOn(imports, "previewCatalogImport").mockResolvedValue({ ...catalogImportPreviewFixture(), mode: "Append", confirmations: quiet });
  const apply = vi.spyOn(imports, "applyCatalogImport").mockRejectedValue(new ApiError(409, { code: "Forms.Catalog.RevisionConflict" }));
  const read = vi.spyOn(catalogs, "fetchCatalog").mockResolvedValue({ ...catalog, revision: 8 });
  const { user, onObserved } = await mount();
  await paste(user, "Code\tText\nN\tNorte");
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
  await paste(user, "Code\tText\nN\tNorte");
  await user.click(screen.getByRole("button", { name: "Revisar" }));
  const signal = check.mock.calls[0]![2]!;
  rerender(<CatalogImportDialog {...props} scope={{ ...scope, permissions: [] }}/>);
  await waitFor(() => expect(signal.aborted).toBe(true));
  await act(async () => resolve(catalogImportPreviewFixture()));
  expect(screen.queryByText("Norte")).not.toBeInTheDocument(); expect(screen.queryByRole("textbox")).not.toBeInTheDocument(); expect(onApplied).not.toHaveBeenCalled();
  unmount(); expect(queryClient.getMutationCache().getAll()).toEqual([]);
});

it("keeps an already applied file as information and allows restoring it at the current revision", async () => {
  const base = catalogImportPreviewFixture();
  vi.spyOn(imports, "previewCatalogImport").mockResolvedValue({ ...base, mode: "Append", alreadyAppliedAtUtc: "2026-10-22T08:00:00Z", counts: { ...base.counts, errorRows: 0, deactivated: 0 }, issues: [], deactivated: [], confirmations: quiet });
  const apply = vi.spyOn(imports, "applyCatalogImport").mockResolvedValue({ catalog: { ...catalog, revision: 8 }, itemIdentityMap: {}, fieldIdentityMap: {} });
  const { user } = await mount();
  await paste(user, "Code\tText\nN\tNorte");
  await user.click(screen.getByRole("button", { name: "Revisar" }));
  expect(await screen.findByText(/Esta planilla ya se aplicó/)).toBeInTheDocument();
  const button = screen.getByRole("button", { name: "Aplicar" }); expect(button).toBeEnabled();
  await user.click(button); await waitFor(() => expect(apply).toHaveBeenCalledOnce());
  expect(apply.mock.calls[0]![1]).toMatchObject({ expectedRevision: 7, sheetSha256: base.sheetSha256 });
});

it("reviews a file in Replace mode and requires both empty-sheet and exact deactivation confirmations", async () => {
  const base = catalogImportPreviewFixture(); vi.spyOn(imports, "previewCatalogImport").mockResolvedValue({ ...base, rowsRead: 0, counts: { ...base.counts, added: 0, errorRows: 0 }, added: [], issues: [], confirmations: { deactivations: 1, emptySheet: true, manyErrors: false } });
  const apply = vi.spyOn(imports, "applyCatalogImport").mockResolvedValue({ catalog: { ...catalog, revision: 8 }, itemIdentityMap: {}, fieldIdentityMap: {} });
  const { user } = await mount("file"); const file = new File(["Code,Text"], "Vacia.csv", { type: "text/csv" });
  await user.upload(screen.getByLabelText("Archivo", { exact: true }), file);
  expect(screen.getByText("Vacia.csv")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Revisar" }));
  const button = await screen.findByRole("button", { name: "Aplicar" }); expect(button).toBeDisabled();
  // Confirming is in its zone; what deactivating means is the help of its (i).
  expect(screen.getByRole("heading", { name: "Antes de aplicar" })).toBeInTheDocument();
  await user.hover(screen.getByRole("button", { name: "Qué es dar de baja" }));
  expect(await screen.findByRole("tooltip")).toHaveTextContent("Lo que no viene en la planilla se da de baja, no se borra.");
  await user.click(screen.getByText("Sí, dar de baja 1 opción")); expect(button).toBeDisabled();
  await user.click(screen.getByText("Sí, aplicar esta planilla sin filas válidas")); expect(button).toBeEnabled();
  expect(apply).not.toHaveBeenCalled(); await user.click(button); await waitFor(() => expect(apply).toHaveBeenCalledOnce());
  expect(apply.mock.calls[0]![1]).toMatchObject({ mode: "Replace", file, confirmDeactivations: 1, confirmEmpty: true, confirmErrors: false });
});

it("removes the pasted rows and review on a forbidden write without retrying", async () => {
  const base = catalogImportPreviewFixture(); vi.spyOn(imports, "previewCatalogImport").mockResolvedValue({ ...base, mode: "Append", counts: { ...base.counts, deactivated: 0, errorRows: 0 }, issues: [], deactivated: [], confirmations: quiet });
  const apply = vi.spyOn(imports, "applyCatalogImport").mockRejectedValue(new ApiError(403, {})); const { user } = await mount();
  await paste(user, "Code\tText\nN\tNorte"); await user.click(screen.getByRole("button", { name: "Revisar" }));
  await user.click(await screen.findByRole("button", { name: "Aplicar" }));
  expect(await screen.findByText("Ya no tenés permiso para importar opciones.")).toBeInTheDocument(); expect(screen.queryByRole("region", { name: "Filas pegadas" })).not.toBeInTheDocument(); expect(screen.queryByRole("button", { name: "Aplicar" })).not.toBeInTheDocument(); expect(apply).toHaveBeenCalledOnce();
});

// The counts go in the tabs and the band, not as loose chips.
it("names the file, its sheet and the rows read in the band and puts each count in its tab", async () => {
  const base = catalogImportPreviewFixture();
  vi.spyOn(imports, "previewCatalogImport").mockResolvedValue({ ...base, mode: "Append" });
  const { user } = await mount();
  await paste(user, "Code\tText\nN\tNorte");
  await user.click(screen.getByRole("button", { name: "Revisar" }));
  const review = (await screen.findByRole("heading", { name: "Revisión" })).closest("section")!;
  expect(within(review).getByText(new RegExp("^Pegado\\.csv · " + base.sheetName + " · "))).toBeInTheDocument();
  expect(within(review).getByRole("tab", { name: "Errores y avisos " + base.issues.length })).toBeInTheDocument();
  expect(within(review).getByRole("tab", { name: "Altas " + base.counts.added })).toBeInTheDocument();
  expect(screen.queryByText(/^\d+ altas?$/)).not.toBeInTheDocument();
});

it.each([
  ["Decimal", "es", "1500.5", "1.500,5", "2500.75", "2.500,75"],
  ["Decimal", "en", "1500.5", "1,500.5", "2500.75", "2,500.75"],
  ["Date", "es", "2026-04-03", "03/04/2026", "2026-05-04", "04/05/2026"],
  ["Date", "en", "2026-04-03", "04/03/2026", "2026-05-04", "05/04/2026"],
] as const)("shows normalized %s values for added and changed rows in %s before applying", async (valueType, culture, before, shownBefore, after, shownAfter) => {
  await i18n.changeLanguage(culture);
  const base = catalogImportPreviewFixture(), english = culture === "en";
  vi.spyOn(imports, "previewCatalogImport").mockResolvedValue({ ...base, mode: "Append", issues: [], deactivated: [],
    added: [{ ...base.added[0]!, value: after }],
    changed: [{ row: 3, itemId: catalog.id, code: "C", changes: [{ column: "value", before, after }] }],
    counts: { ...base.counts, changed: 1, deactivated: 0, errorRows: 0 }, confirmations: quiet });
  const apply = vi.spyOn(imports, "applyCatalogImport");
  const { user } = await mount("paste", { scope: { ...scope, culture }, catalog: { ...catalog, valueType } });
  await paste(user, "Code\tText\tValue\nN\tNorte\t" + after, english);
  await user.click(screen.getByRole("button", { name: english ? "Review" : "Revisar" }));
  await user.click(await screen.findByRole("tab", { name: english ? /^New/ : /^Altas/ }));
  expect(within(screen.getByRole("tabpanel")).getByRole("cell", { name: shownAfter })).toBeInTheDocument();
  await user.click(screen.getByRole("tab", { name: english ? /^Changes/ : /^Cambios/ }));
  expect(change(within(screen.getByRole("tabpanel")), english ? "Value" : "Valor")).toEqual([shownBefore, shownAfter]);
  expect(apply).not.toHaveBeenCalled();
});

it.each([["es", "Supervisor"], ["en", "Supervisor"], ["es", "textEn"], ["en", "textEn"], ["es", "detailEn"], ["en", "detailEn"]] as const)("identifies errors and warnings with the original header and related row in %s %s", async (culture, header) => {
  await i18n.changeLanguage(culture);
  const base = catalogImportPreviewFixture(), english = culture === "en";
  const errorMessage = english ? "Duplicate: it is also in another row." : "Repetido: también está en otra fila.";
  const warningMessage = english ? "This column is not part of the catalog: it is ignored." : "Esta columna no es del catálogo: se ignora.";
  vi.spyOn(imports, "previewCatalogImport").mockResolvedValue({ ...base, mode: "Append", deactivated: [],
    counts: { ...base.counts, deactivated: 0, warnings: 1 },
    issues: [
      { row: 1, column: header, severity: "Warning", code: "Forms.CatalogImport.UnknownColumn", message: warningMessage, relatedRow: null, length: null },
      { ...base.issues[0]!, message: errorMessage },
    ], confirmations: quiet });
  const apply = vi.spyOn(imports, "applyCatalogImport");
  const { user } = await mount("paste", { scope: { ...scope, culture } });
  await paste(user, "Code\tText\t" + header + "\nN\tNorte\tAna", english);
  await user.click(screen.getByRole("button", { name: english ? "Review" : "Revisar" }));
  const panel = within(await screen.findByRole("tabpanel"));
  expect(panel.getByRole("columnheader", { name: english ? "Type" : "Tipo" })).toBeInTheDocument();
  const warningRow = panel.getByText(header).closest("tr")!;
  expect(within(warningRow).getByText(english ? "Warning" : "Aviso")).toBeInTheDocument();
  expect(within(warningRow).getByText(warningMessage)).toBeInTheDocument();
  const errorRow = panel.getByText(errorMessage).closest("tr")!;
  expect(within(errorRow).getByText("Error")).toBeInTheDocument();
  expect(within(errorRow).getByText(english ? "Row 2" : "Fila 2")).toBeInTheDocument();
  expect(apply).not.toHaveBeenCalled();
});

it.each(["es", "en"] as const)("labels the Spanish translation columns of an English original catalog in %s", async culture => {
  await i18n.changeLanguage(culture);
  const base = catalogImportPreviewFixture(), english = culture === "en";
  const text = english ? "Spanish text" : "Texto en español", detail = english ? "Spanish detail" : "Detalle en español";
  vi.spyOn(imports, "previewCatalogImport").mockResolvedValue({ ...base, mode: "Append", deactivated: [],
    issues: [{ row: 3, column: "textEs", severity: "Error", code: "Forms.CatalogImport.TextTooLong", message: "Too long", relatedRow: null, length: 31 }],
    changed: [{ row: 2, itemId: base.deactivated[0]!.itemId, code: "N", changes: [{ column: "textEs", before: "Norte", after: "Norte cambiado" }, { column: "detailEs", before: null, after: "Zona norte" }] }],
    counts: { ...base.counts, changed: 1, deactivated: 0 }, confirmations: quiet });
  const { user } = await mount("paste", { scope: { ...scope, culture }, catalog: { ...catalog, originalCulture: "en", name: { en: "List" } } });
  await paste(user, "Code\tText\t" + text + "\nN\tNorth\tNorte cambiado", english);
  // The translation column that came with its header has its place in the grid.
  expect(within(grid(english)).getByRole("columnheader", { name: text })).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: english ? "Review" : "Revisar" }));
  const errorRow = within(await screen.findByRole("tabpanel")).getByText("Too long").closest("tr")!;
  expect(within(errorRow).getByRole("cell", { name: text })).toBeInTheDocument();
  await user.click(screen.getByRole("tab", { name: english ? /^Changes/ : /^Cambios/ }));
  const panel = within(screen.getByRole("tabpanel"));
  expect(change(panel, text)).toEqual(["Norte", "Norte cambiado"]);
  expect(change(panel, detail)).toEqual(["—", "Zona norte"]);
  expect(screen.queryByText(/textEs|detailEs/)).not.toBeInTheDocument();
});

it("preserves the pasted rows after a preview conflict and rereads only on explicit review", async () => {
  const check = vi.spyOn(imports, "previewCatalogImport")
    .mockRejectedValueOnce(new ApiError(409, { code: "Forms.Catalog.RevisionConflict" }))
    .mockResolvedValue({ ...catalogImportPreviewFixture(), revision: 8, mode: "Append" });
  const read = vi.spyOn(catalogs, "fetchCatalog").mockResolvedValue({ ...catalog, revision: 8 });
  const apply = vi.spyOn(imports, "applyCatalogImport");
  const { user, onObserved } = await mount();
  await paste(user, "Code\tText\nN\tNorte");
  await user.click(screen.getByRole("button", { name: "Revisar" }));
  const retry = await screen.findByRole("button", { name: "Revisar de nuevo" });
  expect(within(grid()).getByRole("cell", { name: "Norte" })).toBeInTheDocument();
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
  ["es", "TooManyCells", "El archivo tiene demasiadas celdas, incluso vacías o con formato. Quitá las que no uses y volvé a cargarlo.", "Hoja «Detalle 2026»: El archivo tiene demasiadas celdas, incluso vacías o con formato. Quitá las que no uses y volvé a cargarlo."],
  ["en", "TooManyCells", "The file has too many cells, including empty or formatted cells. Remove unused cells and upload it again.", "Sheet “Detalle 2026”: The file has too many cells, including empty or formatted cells. Remove unused cells and upload it again."],
] as const)("names the offending sheet for a %s %s response without repeating the preview", async (culture, reason, detail, message) => {
  await i18n.changeLanguage(culture);
  const notice = vi.spyOn(notifications, "notify");
  const check = vi.spyOn(imports, "previewCatalogImport").mockRejectedValue(new ApiError(400, { code: "Forms.CatalogImport." + reason, detail, sheet: "Detalle 2026" }));
  const { user } = await mount("paste", { scope: { ...scope, culture } });
  await paste(user, "Code\tText\nN\tNorte", culture === "en");
  await user.click(screen.getByRole("button", { name: culture === "en" ? "Review" : "Revisar" }));
  await waitFor(() => expect(notice).toHaveBeenCalledOnce());
  expect(notice).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ kind: "error", message }));
  expect(check).toHaveBeenCalledOnce();
  expect(within(grid(culture === "en")).getByRole("cell", { name: "Norte" })).toBeInTheDocument();
});

it.each([
  ["Forms.CatalogImport.FileUnreadable", "Do not render this metadata"],
  ["Forms.CatalogImport.TooManyColumns", { private: "Do not render this metadata" }],
])("ignores unrelated or malformed sheet metadata for %s", async (code, sheet) => {
  const notice = vi.spyOn(notifications, "notify");
  vi.spyOn(imports, "previewCatalogImport").mockRejectedValue(new ApiError(400, { code, detail: "Revisá la planilla.", sheet }));
  const { user } = await mount();
  await paste(user, "Code\tText\nN\tNorte");
  await user.click(screen.getByRole("button", { name: "Revisar" }));
  await waitFor(() => expect(notice).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ kind: "error", message: "Revisá la planilla." })));
});

it.each(["es", "en"] as const)("sends the pasted rows as a localized file name in %s", async culture => {
  await i18n.changeLanguage(culture);
  const check = vi.spyOn(imports, "previewCatalogImport").mockResolvedValue({ ...catalogImportPreviewFixture(), mode: "Append" });
  const { user } = await mount("paste", { scope: { ...scope, culture } });
  await paste(user, "Code\tText\nN\tNorte", culture === "en");
  await user.click(screen.getByRole("button", { name: culture === "en" ? "Review" : "Revisar" }));
  await screen.findByRole("tab", { name: culture === "en" ? /^New/ : /^Altas/ });
  expect(check.mock.calls[0]![1].file.name).toBe(culture === "en" ? "Pasted.csv" : "Pegado.csv");
});

it.each([
  ["es", "columns"], ["en", "columns"], ["es", "bytes"], ["en", "bytes"],
] as const)("describes the pasted text limit without a file instruction in %s for %s", async (culture, limit) => {
  await i18n.changeLanguage(culture);
  const check = vi.spyOn(imports, "previewCatalogImport");
  const { user } = await mount("paste", { scope: { ...scope, culture } });
  if (limit === "bytes") vi.spyOn(Blob.prototype, "size", "get").mockReturnValue(10 * 1024 * 1024 + 1);
  await paste(user, limit === "columns" ? Array.from({ length: 65 }, () => "x").join("\t") : "Code\tText\nN\tNorte", culture === "en");
  if (limit === "bytes") await user.click(screen.getByRole("button", { name: culture === "en" ? "Review" : "Revisar" }));
  expect(screen.getByText(culture === "en" ? "Paste up to 10,000 rows and 64 columns, without exceeding 10 MB of text." : "Pegá hasta 10.000 filas y 64 columnas, sin superar 10 MB de texto.")).toBeInTheDocument();
  expect(check).not.toHaveBeenCalled();
});

it.each([
  ["es", "Text"], ["en", "Text"], ["es", "Decimal"], ["en", "Decimal"],
] as const)("labels every import review table with its actual %s %s columns", async (culture, valueType) => {
  await i18n.changeLanguage(culture);
  const base = catalogImportPreviewFixture(), english = culture === "en";
  vi.spyOn(imports, "previewCatalogImport").mockResolvedValue({ ...base, mode: "Append", issues: [],
    added: [{ ...base.added[0]!, value: valueType === "Text" ? null : "1500.5" }],
    changed: [{ row: 3, itemId: base.deactivated[0]!.itemId, code: "S", changes: [{ column: "active", before: "true", after: "false" }] }],
    counts: { ...base.counts, changed: 1, errorRows: 0 }, confirmations: { ...base.confirmations, manyErrors: false },
  });
  const { user } = await mount("paste", { scope: { ...scope, culture }, catalog: { ...catalog, valueType } });
  await paste(user, "Code\tText\tActive\nN\tNorte\tYes\nS\tSur\tNo", english);
  await user.click(screen.getByRole("button", { name: english ? "Review" : "Revisar" }));
  await user.click(await screen.findByRole("tab", { name: english ? /^New/ : /^Altas/ }));
  const headers = () => within(screen.getByRole("tabpanel")).getAllByRole("columnheader").map(node => node.textContent);
  expect(headers()).toEqual([english ? "Row" : "Fila", english ? "Code" : "Código", english ? "Text" : "Texto", ...(valueType === "Text" ? [] : [english ? "Value" : "Valor"])]);
  await user.click(screen.getByRole("tab", { name: english ? /^Changes/ : /^Cambios/ }));
  expect(headers()).toEqual([english ? "Row" : "Fila", english ? "Code" : "Código", english ? "Column" : "Columna", english ? "Before" : "Antes", english ? "After" : "Después"]);
  await user.click(screen.getByRole("tab", { name: english ? /^Deactivated/ : /^Bajas/ }));
  expect(headers()).toEqual([english ? "Code" : "Código", english ? "Text" : "Texto"]);
});

const extraId = "01990000-0000-7000-8000-000000000121";
const extraField: CatalogField = { id: extraId, key: "payment_days", name: { es: "Plazo", en: "Term" }, type: "integer", sourceCatalogId: null, required: false, unique: false, min: null, max: null, maxLength: null, role: "data", position: 1, isActive: true, valuesCount: 1, usedBy: [] };
it.each([
  ["es", "MissingColumn", "code", "Falta la columna «Código». Agregala y revisá de nuevo."],
  ["en", "MissingColumn", "code", "The “Code” column is missing. Add it and review again."],
  ["es", "DuplicateColumn", extraId, "La columna «Plazo» está repetida. Dejá una sola y revisá de nuevo."],
  ["en", "DuplicateColumn", extraId, "The “Term” column is repeated. Keep one and review again."],
] as const)("keeps the %s %s header error next to the pasted rows without a toast or lost input", async (culture, code, column, message) => {
  await i18n.changeLanguage(culture);
  const notice = vi.spyOn(notifications, "notify");
  const check = vi.spyOn(imports, "previewCatalogImport").mockRejectedValue(new ApiError(400, { code: "Forms.CatalogImport." + code, detail: "Generic server detail", column }));
  const { user } = await mount("paste", { scope: { ...scope, culture }, catalog: { ...catalog, fields: [extraField] } });
  await paste(user, "Code\tText\nN\tNorte", culture === "en");
  await user.click(screen.getByRole("button", { name: culture === "en" ? "Review" : "Revisar" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(message);
  expect(within(grid(culture === "en")).getByRole("table")).toHaveAccessibleDescription(message);
  expect(within(grid(culture === "en")).getByRole("cell", { name: "Norte" })).toBeInTheDocument();
  expect(notice).not.toHaveBeenCalled();
  expect(check).toHaveBeenCalledOnce();
});
it("keeps a missing header next to the selected file and can review it again", async () => {
  const notice = vi.spyOn(notifications, "notify");
  const check = vi.spyOn(imports, "previewCatalogImport").mockRejectedValueOnce(new ApiError(400, { code: "Forms.CatalogImport.MissingColumn", column: "text" })).mockResolvedValue(catalogImportPreviewFixture());
  const { user } = await mount("file");
  const file = new File(["Code\nN"], "catalog.csv", { type: "text/csv" });
  const input = screen.getByLabelText("Archivo", { exact: true });
  await user.upload(input, file);
  await user.click(screen.getByRole("button", { name: "Revisar" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Falta la columna «Texto». Agregala y revisá de nuevo.");
  expect(input).toHaveAccessibleDescription("Falta la columna «Texto». Agregala y revisá de nuevo.");
  expect(notice).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Revisar" }));
  await screen.findByRole("tab", { name: /^Altas/ });
  expect(check.mock.calls[1]![1].file).toBe(file);
});
it.each(["es", "en"] as const)("shows extra columns and their typed canonical values and names in every %s preview list", async culture => {
  await i18n.changeLanguage(culture);
  const fields: CatalogField[] = [extraField,
    { ...extraField, id: "01990000-0000-7000-8000-000000000122", key: "amount", name: { es: "Importe" }, type: "decimal", position: 2 },
    { ...extraField, id: "01990000-0000-7000-8000-000000000123", key: "confirmed", name: { es: "Confirmado", en: "Confirmed" }, type: "boolean", position: 3 },
    { ...extraField, id: "01990000-0000-7000-8000-000000000124", key: "retired", name: { es: "Retirado" }, isActive: false, position: 4 }];
  const base = catalogImportPreviewFixture();
  vi.spyOn(imports, "previewCatalogImport").mockResolvedValue({ ...base, mode: "Append", deactivated: [],
    issues: [{ row: 3, column: extraId, severity: "Error", code: "Forms.CatalogField.ValueInvalid", message: "Invalid value", relatedRow: null, length: null }],
    added: [{ ...base.added[0]!, fields: { [extraId]: "900719925474099301", [fields[1]!.id]: "0.001", [fields[2]!.id]: "false" } }],
    changed: [{ row: 4, itemId: base.deactivated[0]!.itemId, code: "S", changes: [{ column: extraId, before: "1", after: "900719925474099301" }] }],
    counts: { ...base.counts, changed: 1, deactivated: 0 }, confirmations: quiet });
  const { user } = await mount("paste", { scope: { ...scope, culture }, catalog: { ...catalog, fields } });
  await paste(user, "Code\tText\tpayment_days\nN\tNorte\t1", culture === "en");
  await user.click(screen.getByRole("button", { name: culture === "en" ? "Review" : "Revisar" }));
  const name = culture === "en" ? "Term" : "Plazo", integer = culture === "en" ? "900,719,925,474,099,301" : "900.719.925.474.099.301";
  expect(within(await screen.findByRole("tabpanel")).getByRole("cell", { name })).toBeInTheDocument();
  await user.click(screen.getByRole("tab", { name: culture === "en" ? /^New/ : /^Altas/ }));
  const panel = within(screen.getByRole("tabpanel"));
  expect(panel.getAllByRole("columnheader").map(node => node.textContent)).toEqual([culture === "en" ? "Row" : "Fila", culture === "en" ? "Code" : "Código", name, "Importe", culture === "en" ? "Confirmed" : "Confirmado", culture === "en" ? "Text" : "Texto"]);
  expect(panel.getByRole("cell", { name: integer })).toBeInTheDocument();
  expect(panel.getByRole("cell", { name: culture === "en" ? "0.001" : "0,001" })).toBeInTheDocument();
  expect(panel.getByRole("cell", { name: "No" })).toBeInTheDocument();
  expect(screen.queryByRole("columnheader", { name: "Retirado" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("tab", { name: culture === "en" ? /^Changes/ : /^Cambios/ }));
  expect(change(within(screen.getByRole("tabpanel")), name)).toEqual(["1", integer]);
});

it("aligns the numbers of the pasted rows and of every list of the review to the right", async () => {
  const branch: CatalogField = { ...extraField, id: "01990000-0000-7000-8000-000000000125", key: "branch", name: { es: "Sucursal" }, type: "text", position: 2 };
  const base = catalogImportPreviewFixture();
  vi.spyOn(imports, "previewCatalogImport").mockResolvedValue({ ...base, mode: "Append", deactivated: [],
    issues: [{ row: 3, column: branch.id, severity: "Warning", code: "Forms.CatalogImport.TextTooLong", message: "El texto es largo", relatedRow: null, length: null }],
    changed: [{ row: 4, itemId: base.deactivated[0]!.itemId, code: "S", changes: [{ column: extraId, before: "1", after: "30" }] }],
    added: [{ ...base.added[0]!, value: "1500.5", fields: { [extraId]: "30", [branch.id]: "Centro" } }], counts: { ...base.counts, changed: 1, deactivated: 0, errorRows: 0, warnings: 1 }, confirmations: quiet });
  const { user } = await mount("paste", { catalog: { ...catalog, valueType: "Decimal", fields: [extraField, branch] } });
  await paste(user, "Code\tText\tValue\tpayment_days\tbranch\nN\tNorte\t1500.5\t30\tCentro");
  const pasted = within(grid());
  for (const name of ["Valor", "Plazo"]) expect(pasted.getByRole("columnheader", { name })).toHaveClass("text-right");
  for (const name of ["1500.5", "30"]) expect(pasted.getByRole("cell", { name })).toHaveClass("text-right");
  expect(pasted.getByRole("columnheader", { name: "Sucursal" })).not.toHaveClass("text-right");
  expect(pasted.getByRole("cell", { name: "Centro" })).not.toHaveClass("text-right");
  await user.click(screen.getByRole("button", { name: "Revisar" }));
  await user.click(await screen.findByRole("tab", { name: /^Altas/ }));
  const added = within(screen.getByRole("tabpanel"));
  for (const name of ["Fila", "Plazo", "Valor"]) expect(added.getByRole("columnheader", { name })).toHaveClass("text-right");
  for (const name of ["2", "30", "1.500,5"]) expect(added.getByRole("cell", { name })).toHaveClass("text-right");
  for (const name of ["Código", "Sucursal", "Texto"]) expect(added.getByRole("columnheader", { name })).not.toHaveClass("text-right");
  expect(added.getByRole("cell", { name: "Centro" })).not.toHaveClass("text-right");
  for (const [tab, row, text] of [[/^Errores y avisos/, "3", "Columna"], [/^Cambios/, "4", "Código"]] as const) {
    await user.click(screen.getByRole("tab", { name: tab }));
    const list = within(screen.getByRole("tabpanel"));
    expect(list.getByRole("columnheader", { name: "Fila" })).toHaveClass("text-right");
    // In the changes, the row number heads the lines of its option.
    expect(list.getByRole(row === "4" ? "rowheader" : "cell", { name: new RegExp("^" + row) })).toHaveClass("text-right");
    expect(list.getByRole("columnheader", { name: text })).not.toHaveClass("text-right");
  }
});

it("keeps each code whole in the changes, which still wrap at their spaces", async () => {
  const taxId: CatalogField = { ...extraField, id: "01990000-0000-7000-8000-000000000126", key: "tax_id", name: { es: "CUIT" }, type: "text", position: 2 };
  const base = catalogImportPreviewFixture();
  vi.spyOn(imports, "previewCatalogImport").mockResolvedValue({ ...base, mode: "Append", deactivated: [], issues: [], added: [],
    changed: [{ row: 4, itemId: base.deactivated[0]!.itemId, code: "S", changes: [{ column: taxId.id, before: "30-71458236-9", after: "30-65432109-7" }] }],
    counts: { ...base.counts, added: 0, changed: 1, deactivated: 0, errorRows: 0 }, confirmations: quiet });
  const { user } = await mount("paste", { catalog: { ...catalog, fields: [taxId] } });
  await paste(user, "Code\tText\ttax_id\nS\tSur\t30-65432109-7");
  await user.click(screen.getByRole("button", { name: "Revisar" }));
  await user.click(await screen.findByRole("tab", { name: /^Cambios/ }));
  const row = within(screen.getByRole("tabpanel")).getByRole("rowheader", { name: "CUIT" }).closest("tr")!;
  expect(within(row).getAllByRole("cell").slice(-2).map(cell => Array.from(cell.querySelectorAll(".whitespace-nowrap"), node => node.textContent))).toEqual([["30-71458236-9"], ["30-65432109-7"]]);
});

it("shows the source option labels rather than their identities for added and changed catalog values", async () => {
  const sourceId = "01990000-0000-7000-8000-000000000221", optionId = "01990000-0000-7000-8000-000000000222";
  const field: CatalogField = { ...extraField, type: "catalog", sourceCatalogId: sourceId, name: { es: "Zona" } };
  const base = catalogImportPreviewFixture();
  vi.spyOn(imports, "previewCatalogImport").mockResolvedValue({ ...base, mode: "Append", issues: [], deactivated: [],
    added: [{ ...base.added[0]!, fields: { [extraId]: optionId }, fieldTexts: { [extraId]: "Centro" } }],
    changed: [{ row: 4, itemId: base.deactivated[0]!.itemId, code: "S", changes: [{ column: extraId, before: sourceId, beforeText: "Norte", after: optionId, afterText: "Centro" }] }],
    counts: { ...base.counts, changed: 1, deactivated: 0, errorRows: 0 }, confirmations: quiet });
  const { user } = await mount("paste", { catalog: { ...catalog, fields: [field] } });
  await paste(user, "Code\tText\tZona\nN\tNorte\tCentro");
  await user.click(screen.getByRole("button", { name: "Revisar" }));
  expect(within(await screen.findByRole("tabpanel")).getByRole("cell", { name: "Centro" })).toBeInTheDocument();
  expect(screen.queryByText(optionId)).not.toBeInTheDocument();
  await user.click(screen.getByRole("tab", { name: /^Cambios/ }));
  expect(change(within(screen.getByRole("tabpanel")), "Zona")).toEqual(["Norte", "Centro"]);
  expect(screen.queryByText(new RegExp(sourceId))).not.toBeInTheDocument();
});
