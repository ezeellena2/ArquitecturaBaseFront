import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, expect, it, vi } from "vitest";
import { queryClient } from "@/shared/api/queryClient";
import { server } from "@/test/mocks/server";
import { currentUser } from "@/test/mocks/handlers";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { cellUnder } from "@/test/utils/tableCells";
import { responseDetailFixture, responseFormId, responseSheetFixture, responseWorkflowFixture } from "@/test/responseFixtures";
import { responseColumnSelection, visibleResponseColumnDescriptors, visibleResponseResultColumns } from "../responses";
vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"),
  useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));
vi.mock("@/shared/hooks/usePrivateFormFile", async () => ({ ...await vi.importActual<typeof import("@/shared/hooks/usePrivateFormFile")>("@/shared/hooks/usePrivateFormFile"),
  savePrivateBlob: vi.fn() }));
// Each test reads the person and the sheet again: the session of another test does not carry its permissions over.
beforeEach(() => { queryClient.clear(); });

// RE1-A: a column per datum an external action left, after the questions, that «Columnas» hides and shows; «—» without it.
const resultColumns = [
  { id: "arca.invoice.voucher", source: "arca.invoice", sourceName: "Emitir comprobante en ARCA", key: "voucher", label: "Comprobante", kind: "text" },
  { id: "arca.invoice.expiresOn", source: "arca.invoice", sourceName: "Emitir comprobante en ARCA", key: "expiresOn", label: "Vencimiento del código", kind: "date" },
] as const;

function sheetWithResults() {
  const sheet = responseSheetFixture();
  return { ...sheet, resultColumns,
    records: { ...sheet.records, items: sheet.records.items.map((row, index) => index === 0 ? { ...row, results: { "arca.invoice.voucher": "Factura C 0004-00000012", "arca.invoice.expiresOn": "2026-11-19" } } : row) } };
}

it("shows the result data after the questions, «—» in a response without them, and hides one from «Columnas»", async () => {
  const sheet = sheetWithResults();
  server.use(http.get("/api/forms/approvals", () => HttpResponse.json({ items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 0, hasPrevious: false, hasNext: false })),
    http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["formrecords.read"] })),
    http.post("/api/forms/definitions/:id/records/search", () => HttpResponse.json(sheet)),
    http.get("/api/forms/records/:id/workflow", ({ params }) => HttpResponse.json(responseWorkflowFixture(String(params.id)))),
    http.get("/api/forms/records/:id", ({ params }) => HttpResponse.json(responseDetailFixture(String(params.id)))));

  const { router } = renderRouteWithProviders("/formularios/" + responseFormId + "/respuestas");

  // The first render pays the lazy page: with the machine loaded it takes more than a second.
  await screen.findByRole("columnheader", { name: "Comprobante" }, { timeout: 10_000 });
  const table = screen.getByRole("table");
  const headers = within(table).getAllByRole("columnheader").map(header => header.textContent);
  expect(headers.indexOf("Comprobante")).toBeGreaterThan(headers.indexOf(sheet.columns.at(-1)!.label));
  const [first, second] = within(table).getAllByRole("row").slice(1);
  expect(cellUnder(table, first!, "Comprobante")).toHaveTextContent("Factura C 0004-00000012");
  expect(cellUnder(table, first!, "Vencimiento del código")).toHaveTextContent("19/11/2026");
  expect(cellUnder(table, second!, "Comprobante")).toHaveTextContent("—");

  await userEvent.click(screen.getByRole("button", { name: /^Columnas/ }));
  const group = await screen.findByRole("menu");
  expect(within(group).getByText("Emitir comprobante en ARCA")).toBeInTheDocument();
  await userEvent.click(within(group).getByRole("menuitemcheckbox", { name: "Vencimiento del código" }));
  // The open menu hides the page from the accessibility tree: close it before reading the table.
  await userEvent.keyboard("{Escape}");

  await waitFor(() => expect(screen.queryByRole("columnheader", { name: "Vencimiento del código" })).not.toBeInTheDocument());
  expect(new URLSearchParams(router.state.location.search).get("columns")).not.toContain("result:arca.invoice.expiresOn");
  expect(screen.getByRole("columnheader", { name: "Comprobante" })).toBeInTheDocument();
});

it("keeps every result column shown by default and only the chosen ones in a selection", () => {
  const sheet = sheetWithResults();
  const questions = sheet.columns.map(column => column.fieldId);
  expect(responseColumnSelection(sheet.columns, [...questions, "result:arca.invoice.voucher", "result:arca.invoice.expiresOn"], resultColumns)).toBeNull();
  const selection = responseColumnSelection(sheet.columns, [...questions, "result:arca.invoice.voucher"], resultColumns);
  expect(selection).toContain("result:arca.invoice.voucher");
  expect(visibleResponseResultColumns(resultColumns, selection).map(column => column.id)).toEqual(["arca.invoice.voucher"]);
  expect(visibleResponseResultColumns(resultColumns, null)).toHaveLength(2);
  expect(visibleResponseResultColumns(undefined, null)).toEqual([]);
});

// The Excel of «Solo las visibles» (2026-11-11): with only a result datum hidden in «Columnas» it can be chosen, and it sends the
// ids of the data that are seen.
it("lets the Excel take only the result data that are seen, also when only one of them is hidden", async () => {
  const sheet = sheetWithResults();
  let sent: unknown;
  server.use(http.get("/api/forms/approvals", () => HttpResponse.json({ items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 0, hasPrevious: false, hasNext: false })),
    http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["formrecords.read", "formrecords.export"] })),
    http.post("/api/forms/definitions/:id/records/search", () => HttpResponse.json(sheet)),
    http.post("/api/forms/definitions/:id/records/export", async ({ request }) => {
      sent = await request.json();
      return new HttpResponse(new Uint8Array([80, 75]), { headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": "attachment; filename*=UTF-8''TEST.xlsx" } });
    }));
  const shown = [...visibleResponseColumnDescriptors(sheet.columns, null).map(column => column.id), "result:arca.invoice.voucher"];
  renderRouteWithProviders("/formularios/" + responseFormId + "/respuestas?columns=" + encodeURIComponent(responseColumnSelection(sheet.columns, shown, resultColumns)!));

  await screen.findByRole("columnheader", { name: "Comprobante" }, { timeout: 10_000 });
  await userEvent.click(screen.getByRole("button", { name: "Exportar a Excel" }));
  const dialog = await screen.findByRole("dialog", { name: "Exportar respuestas a Excel" });
  const visible = within(dialog).getByRole("radio", { name: /Solo las visibles/ });
  expect(visible).not.toHaveAttribute("aria-disabled");
  await userEvent.click(visible);
  await userEvent.click(within(dialog).getByRole("button", { name: "Exportar a Excel" }));
  await waitFor(() => expect(sent).toMatchObject({ resultColumns: ["arca.invoice.voucher"] }));
}, 15_000);
