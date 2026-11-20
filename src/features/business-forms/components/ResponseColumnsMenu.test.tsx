import { useState } from "react";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, expect, it, vi } from "vitest";
import { currentUser } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { ResponseColumnsMenu } from "./ResponseColumnsMenu";
import type { ResponseResultColumn } from "../api/responses";
import type { ResponseColumn } from "../responses";
// The person is read only with a session: whoever only completes forms does not see «Cargó».
vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"),
  useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));
const column: ResponseColumn = { fieldId: "supplier", type: "multiChoice", label: "Proveedores", introducedInVersion: 1, options: [], fields: [{ fieldId: "tax", key: "tax", label: "CUIT", type: "text", role: "data" }, { fieldId: "zone", key: "zone", label: "Zona", type: "catalog", role: "filter" }] };
const results: ResponseResultColumn[] = [
  { id: "arca.invoice.voucher", source: "arca.invoice", sourceName: "Emitir comprobante en ARCA", key: "voucher", label: "Comprobante", kind: "text" },
  { id: "arca.invoice.expiresOn", source: "arca.invoice", sourceName: "Emitir comprobante en ARCA", key: "expiresOn", label: "Vencimiento del código", kind: "date" },
];
function Harness({ changed = vi.fn(), resultColumns = [] }: { changed?: (ids: readonly string[]) => void; resultColumns?: ResponseResultColumn[] }) {
  const [ids, setIds] = useState<readonly string[]>(["supplier", "supplier:tax", ...resultColumns.map(result => "result:" + result.id)]);
  return <ResponseColumnsMenu columns={[column]} visible={ids.includes("supplier") ? [column] : []}
    visibleCatalogFields={column.fields!.filter(field => ids.includes("supplier:" + field.fieldId)).map(field => ({ questionId: "supplier", fieldId: field.fieldId }))}
    resultColumns={resultColumns} visibleResults={resultColumns.filter(result => ids.includes("result:" + result.id))}
    onChange={next => { setIds(next); changed(next); }}/>;
}
// «Columnas» is the only piece to choose several with the button of the bar (DS1-A): its list opens with the keyboard, like the
// other Radix lists in the tests, and marking does not close it.
async function open(name: string) {
  const trigger = screen.getByRole("button", { name });
  await act(async () => { trigger.focus(); });
  await userEvent.keyboard("{Enter}");
  return within(await screen.findByRole("listbox", { name: "Columnas" }));
}
afterEach(() => { vi.restoreAllMocks(); });

it("keeps the base question and extra-field selections independent", async () => {
  const changed = vi.fn();
  await act(async () => { renderWithProviders(<Harness changed={changed}/>); });
  const list = await open("Columnas · 1 oculta");
  const zone = list.getByRole("option", { name: "Zona · filtro" }); expect(zone).toHaveAttribute("aria-selected", "false");
  await userEvent.click(zone); expect(changed).toHaveBeenLastCalledWith(["supplier", "supplier:tax", "supplier:zone"]); expect(zone).toHaveAttribute("aria-selected", "true");
  await userEvent.click(list.getByRole("option", { name: "Proveedores" })); expect(changed).toHaveBeenLastCalledWith(["supplier:tax", "supplier:zone"]);
  expect(list.getByRole("option", { name: "CUIT · dato" })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByRole("listbox", { name: "Columnas" })).toHaveAttribute("aria-multiselectable", "true");
  await userEvent.keyboard("{Escape}");
});

it("names how many columns are hidden in the trigger", async () => {
  await act(async () => { renderWithProviders(<Harness/>); });
  let list = await open("Columnas · 1 oculta");
  await userEvent.click(list.getByRole("option", { name: "Proveedores" }));
  await userEvent.keyboard("{Escape}");
  list = await open("Columnas · 2 ocultas");
  await userEvent.click(list.getByRole("option", { name: "Proveedores" }));
  await userEvent.click(list.getByRole("option", { name: "Zona · filtro" }));
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
  expect(screen.getByRole("button", { name: "Columnas" })).toBeInTheDocument();
});

// MA1-A: what the sheet always shows is marked and off with its reason, first and apart from the questions.
it("puts the fixed columns first, marked and off with their reason, and a line before the questions", async () => {
  const changed = vi.fn();
  await act(async () => { renderWithProviders(<Harness changed={changed}/>); });
  const list = await open("Columnas · 1 oculta");
  const options = list.getAllByRole("option");
  expect(options).toHaveLength(6);
  ["N°", "Recibida", "Cargó", "Proveedores", "CUIT · dato", "Zona · filtro"].forEach((name, index) => expect(options[index]).toHaveAccessibleName(name));
  for (const name of ["N°", "Recibida", "Cargó"]) {
    const fixed = list.getByRole("option", { name });
    expect(fixed).toHaveAttribute("aria-selected", "true");
    expect(fixed).toHaveAttribute("aria-disabled", "true");
    expect(fixed).toHaveAccessibleDescription("Siempre se ve.");
  }
  expect(list.getByRole("option", { name: "Cargó" }).previousElementSibling).toHaveAttribute("role", "option");
  expect(list.getByRole("option", { name: "Proveedores" }).previousElementSibling).toHaveAttribute("role", "presentation");
  await userEvent.click(list.getByRole("option", { name: "N°" }));
  expect(changed).not.toHaveBeenCalled();
  // A subcolumn of a catalog question says its question in grey.
  expect(list.getByRole("option", { name: "Zona · filtro" })).toHaveAccessibleDescription("Proveedores");
  await userEvent.keyboard("{Escape}");
});

// RE1-A: the data of an external action go after the questions, behind a line, each one with its origin in grey.
it("says the origin of each result datum in grey, after a line, and hides one", async () => {
  const changed = vi.fn();
  await act(async () => { renderWithProviders(<Harness changed={changed} resultColumns={results}/>); });
  const list = await open("Columnas · 1 oculta");
  const voucher = list.getByRole("option", { name: "Comprobante" });
  expect(voucher.previousElementSibling).toHaveAttribute("role", "presentation");
  expect(voucher).toHaveAccessibleDescription("Emitir comprobante en ARCA");
  expect(list.getByRole("option", { name: "Vencimiento del código" })).toHaveAccessibleDescription("Emitir comprobante en ARCA");
  expect(list.getByRole("option", { name: "Vencimiento del código" }).previousElementSibling).toHaveAttribute("role", "option");
  await userEvent.click(list.getByRole("option", { name: "Vencimiento del código" }));
  expect(changed).toHaveBeenLastCalledWith(["supplier", "supplier:tax", "result:arca.invoice.voucher"]);
  await userEvent.keyboard("{Escape}");
});

// CW6-C: whoever only completes forms does not see «Cargó» in the sheet, so it is not among what is always shown.
it("leaves Cargó out of the fixed columns for whoever only completes forms", async () => {
  server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["formrecords.create"] })));
  await act(async () => { renderWithProviders(<Harness/>); });
  const list = await open("Columnas · 1 oculta");
  await waitFor(() => expect(list.queryByRole("option", { name: "Cargó" })).not.toBeInTheDocument());
  expect(list.getByRole("option", { name: "Recibida" })).toHaveAttribute("aria-disabled", "true");
  await userEvent.keyboard("{Escape}");
});

it("on the phone applies the marks with «Listo»", async () => {
  vi.spyOn(globalThis, "matchMedia").mockImplementation(query => ({ matches: query === "(width < 640px)", media: query, onchange: null, addListener: vi.fn(),
    removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));
  const changed = vi.fn();
  await act(async () => { renderWithProviders(<Harness changed={changed}/>); });
  await userEvent.click(screen.getByRole("button", { name: "Columnas · 1 oculta" }));
  const dialog = await screen.findByRole("dialog", { name: "Columnas" });
  await userEvent.click(within(dialog).getByRole("option", { name: "Zona · filtro" }));
  expect(changed).not.toHaveBeenCalled();
  // The three fixed columns are marked too.
  await userEvent.click(within(dialog).getByRole("button", { name: "Listo (6)" }));
  expect(changed).toHaveBeenLastCalledWith(["supplier", "supplier:tax", "supplier:zone"]);
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(screen.getByRole("button", { name: "Columnas" })).toBeInTheDocument();
});
