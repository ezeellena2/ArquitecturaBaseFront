import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { responseDetailFixture } from "@/test/responseFixtures";
import type { FormEntry, FormEntryQuestion } from "../api/entries";
import type { ResponseDetail } from "../api/responses";
import type { EntryDraft } from "../entryForm";
import type { ResponseChoice } from "../responses";
import { ResponseForm } from "./ResponseForm";
vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"),
  useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));
// The photos never arrive: what is checked is which ones the viewer goes through, not their bytes.
vi.mock("@/shared/api/formFiles", async () => ({ ...await vi.importActual<typeof import("@/shared/api/formFiles")>("@/shared/api/formFiles"),
  readFormFile: vi.fn(() => new Promise<Blob>(() => {})) }));

const id = (n: number) => "0199a0c0-0000-7000-8000-" + String(n).padStart(12, "0");
const question = (n: number, type: FormEntryQuestion["type"], label: string, extra: Partial<FormEntryQuestion> = {}): FormEntryQuestion => ({
  fieldId: id(n), type, label, help: null, required: false, maxLength: null, options: null, selection: null, files: null, catalog: null, ...extra,
});
const catalog = (extra: Partial<NonNullable<FormEntryQuestion["catalog"]>> = {}) => ({ onlyOption: null, issue: null, missingData: null, ...extra });
const field = (n: number, label: string, value: string, role: "data" | "filter" = "data") => ({ fieldId: id(n), label, type: "text" as const, role, value });
const choice = (n: number, label: string, fields?: ResponseChoice["fields"]): ResponseChoice => ({ choiceId: id(n), label, fields });

// PED-000010: «Período desde» only shows for «Servicios», «Artículo» depends on «Tipo de artículo» (CW7) and the product of each
// item is chosen first by its «Rubro» (LD1-A).
const questions = [
  question(1, "choice", "Concepto", { required: true, options: [{ id: id(50), label: "Productos" }, { id: id(51), label: "Servicios" }] }),
  question(2, "date", "Período desde", { showWhen: { questionId: id(1), values: [id(51)] } }),
  question(3, "choice", "Tipo de artículo", { catalog: catalog() }),
  question(4, "choice", "Artículo", { catalog: catalog({ dependsOn: [id(3)] }) }),
  question(5, "group", "Artículos", { rows: { minRows: 0, maxRows: 10 } }),
  question(6, "choice", "Producto", { repeated: true, catalog: catalog({ groupBy: { fieldId: id(91), name: "Rubro" } }) }),
  question(7, "decimal", "Cantidad", { repeated: true }),
  question(8, "decimal", "Total", { calculation: { operation: "sum", operands: [id(7)] } }),
  question(9, "location", "Ubicación de entrega"),
];
const entry = { definitionId: id(100), versionId: id(101), versionNumber: 3, prefix: "PED", name: "Pedido de prueba", culture: "es", submitLabel: "Enviar",
  maxFileSizeMiB: 10, questions } satisfies FormEntry;
const draft: EntryDraft = { values: {}, choices: { [id(1)]: [{ id: id(50), title: "Productos", description: null }] }, files: {} };
const item = (product: ResponseChoice, quantity: string) => ({ values: [
  { fieldId: id(6), key: "product", type: "choice" as const, label: "Producto", value: product },
  { fieldId: id(7), key: "quantity", type: "decimal" as const, label: "Cantidad", value: quantity }] });
function record(): ResponseDetail {
  return { ...responseDetailFixture(), values: [
    { fieldId: id(1), key: "concept", type: "choice", label: "Concepto", value: choice(50, "Productos") },
    { fieldId: id(2), key: "since", type: "date", label: "Período desde", value: null },
    { fieldId: id(3), key: "kind", type: "choice", label: "Tipo de artículo", value: choice(61, "Agroquímicos") },
    { fieldId: id(4), key: "article", type: "choice", label: "Artículo", value: choice(60, "2 4 D 100%", [field(90, "Tipo", "Agroquímicos", "filter"), field(91, "Rubro", "Herbicidas")]) },
    { fieldId: id(5), key: "items", type: "group", label: "Artículos", value: [
      item(choice(60, "2 4 D 100%", [field(92, "Tipo", "Agroquímicos"), field(91, "Rubro", "Herbicidas")]), "2"),
      item(choice(62, "RIMON", [field(92, "Tipo", "Agroquímicos"), field(91, "Rubro", "Insecticidas")]), "1500.5")] },
    { fieldId: id(8), key: "total", type: "decimal", label: "Total", value: "1502.5" },
    { fieldId: id(9), key: "place", type: "location", label: "Ubicación de entrega", value: { latitude: -31.5, longitude: -61.25, accuracyMeters: 15 } },
  ] as never };
}
const render = (layout: "page" | "panel") => renderWithProviders(<ResponseForm entry={entry} draft={draft} record={record()} layout={layout} actor={id(1000)}
  onForbidden={() => {}} onError={() => {}}/>);

it("reads each question in its control with what was answered, and leaves out what its condition hides", () => {
  render("page");

  expect(screen.getByRole("textbox", { name: "Concepto" })).toHaveValue("Productos");
  expect(screen.getByRole("textbox", { name: "Concepto" })).toHaveAttribute("readonly");
  expect(screen.queryByText("Período desde")).toBeNull();
  expect(screen.getByRole("textbox", { name: "Tipo de artículo" })).toHaveValue("Agroquímicos");
  expect(screen.getByRole("textbox", { name: "Total" })).toHaveValue("1.502,5");
});

// What was answered reads in the text colour also in a long text; a datum of the catalog keeps the grey of what cannot be written.
it("reads a long text that was answered in the text colour, and a datum of the catalog in grey", () => {
  const notes = { ...entry, questions: [...questions, question(10, "longText", "Observaciones")] } satisfies FormEntry;
  const answered = { ...record(), values: [...record().values,
    { fieldId: id(10), key: "notes", type: "longText", label: "Observaciones", value: "Entregar por la tarde" }] } as never as ResponseDetail;
  renderWithProviders(<ResponseForm entry={notes} draft={draft} record={answered} layout="page" actor={id(1000)}
    onForbidden={() => {}} onError={() => {}}/>);

  const text = screen.getByRole("textbox", { name: "Observaciones" });
  expect(text).toHaveValue("Entregar por la tarde");
  expect(text).not.toHaveClass("read-only:text-[var(--color-content-muted)]");
  expect(screen.getByRole("textbox", { name: "Artículo · Rubro" })).toHaveClass("read-only:text-[var(--color-content-muted)]");
});

// The viewer opened from a question goes through its photos, with its name: not through those of another question.
it("opens the photos of a question with its name, without those of another question", async () => {
  const photo = (n: number, name: string) => ({ fileId: id(n), name, contentType: "image/jpeg", size: 20, hasThumbnail: true });
  const files = { minFiles: 0, maxFiles: 10, photoSource: null };
  const photos = { ...entry, questions: [question(20, "photo", "Fotos de la entrega", { files }), question(21, "photo", "Fotos del remito", { files })] } satisfies FormEntry;
  const delivery = [photo(70, "entrega.jpg")];
  const slip = [photo(71, "remito-1.jpg"), photo(72, "remito-2.jpg")];
  const taken = { ...responseDetailFixture(), values: [
    { fieldId: id(20), key: "delivery", type: "photo", label: "Fotos de la entrega", value: delivery },
    { fieldId: id(21), key: "slip", type: "photo", label: "Fotos del remito", value: slip }] } as never as ResponseDetail;
  renderWithProviders(<ResponseForm entry={photos} draft={{ values: {}, choices: {}, files: {} }} record={taken} layout="page" actor={id(1000)}
    onForbidden={() => {}} onError={() => {}}/>);

  await userEvent.click(screen.getByRole("button", { name: /entrega\.jpg/ }));

  expect(await screen.findByRole("dialog", { name: "Fotos de la entrega" })).toHaveAccessibleDescription("Foto 1 de 1");
});

it("puts each datum of the option chosen in a field of its own, never under its value", () => {
  render("page");

  expect(screen.getByRole("textbox", { name: "Artículo" })).toHaveValue("2 4 D 100%");
  expect(screen.getByRole("textbox", { name: "Artículo · Rubro" })).toHaveValue("Herbicidas");
  // «Tipo» is the answer «Tipo de artículo» (CW7): it is not repeated.
  expect(screen.queryByRole("textbox", { name: "Artículo · Tipo" })).toBeNull();
});

it("reads the location in one line, with its accuracy beside it and the map", () => {
  render("page");

  const place = screen.getByRole("group", { name: "Ubicación de entrega" });
  expect(place).toHaveTextContent("-31.500000, -61.250000± 15 mVer en el mapa");
  expect(within(place).getByRole("link", { name: /Ver en el mapa/ })).toHaveAttribute("target", "_blank");
});

it("reads the block as the table of the load, with a column per datum and nothing to change", () => {
  render("page");

  const block = screen.getByRole("region", { name: "Artículos" });
  expect(within(block).getAllByRole("columnheader").map(header => header.textContent)).toEqual(["Ítem", "Rubro", "Producto", "Producto · Tipo", "Cantidad"]);
  const rows = within(block).getAllByRole("row").slice(1);
  expect(rows.map(row => within(row).getAllByRole("textbox").map(box => (box as HTMLInputElement).value)))
    .toEqual([["Herbicidas", "2 4 D 100%", "Agroquímicos", "2"], ["Insecticidas", "RIMON", "Agroquímicos", "1.500,5"]]);
  expect(within(block).queryByRole("button")).toBeNull();
  expect(screen.queryByRole("button", { name: "Agregar ítem" })).toBeNull();
});

it("reads the block in boxes in the panel, each datum with its name", () => {
  render("panel");

  const second = screen.getByRole("region", { name: "Ítem 2" });
  expect(within(second).getByRole("textbox", { name: "Rubro" })).toHaveValue("Insecticidas");
  expect(within(second).getByRole("textbox", { name: "Producto · Tipo" })).toHaveValue("Agroquímicos");
  expect(within(second).queryByRole("button")).toBeNull();
});
