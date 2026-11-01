import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { newCatalogField } from "../catalogFields";
import { CatalogExtraFieldInput } from "./CatalogExtraFieldInput";

it("explains an unsaved field as help of its disabled cell instead of a message below it", async () => {
  await act(async () => { renderWithProviders(<><CatalogExtraFieldInput field={newCatalogField("new", 1)} label="CUIT" value={null} culture="es" readOnly={false} onChange={vi.fn()} /><CatalogExtraFieldInput field={{ ...newCatalogField("flag", 2), type: "boolean" }} label="Con GPS" value={null} culture="es" readOnly={false} onChange={vi.fn()} /></>); });
  const input = screen.getByRole("textbox", { name: "CUIT" });
  expect(input).toBeDisabled();
  // No text under the cell: the reason is the control's description and its tooltip, on hover or on keyboard focus.
  expect(input).toHaveAccessibleDescription("Guardá para cargar valores");
  expect(screen.getAllByText("Guardá para cargar valores").every(node => node.closest("[hidden]"))).toBe(true);
  await userEvent.hover(input);
  expect(await screen.findByRole("tooltip")).toHaveTextContent("Guardá para cargar valores");
  await userEvent.unhover(input);
  await userEvent.tab();
  expect(input.parentElement).toHaveFocus();
  expect(await screen.findByRole("tooltip")).toHaveTextContent("Guardá para cargar valores");
  const checkbox = screen.getByRole("checkbox", { name: "Con GPS" });
  expect(checkbox).toBeDisabled();
  expect(checkbox).toHaveAccessibleDescription("Guardá para cargar valores");
});
it("keeps the description of an unsaved field's cell together with the one its owner gives", async () => {
  await act(async () => { renderWithProviders(<><CatalogExtraFieldInput field={newCatalogField("new", 1)} label="Fila 1 · CUIT" value={null} culture="es" aria-describedby="row-note" readOnly={false} onChange={vi.fn()} /><p id="row-note">Fila 1 · CUIT: falta.</p></>); });
  expect(screen.getByRole("textbox", { name: "Fila 1 · CUIT" })).toHaveAccessibleDescription("Fila 1 · CUIT: falta. Guardá para cargar valores");
});
it("preserves invalid typed input and is described by the error its owner shows, without numeric coercion", async () => {
  const change = vi.fn();
  await act(async () => { renderWithProviders(<><CatalogExtraFieldInput field={{ ...newCatalogField("saved", 1), id: "01990000-0000-7000-8000-000000000001", type: "integer" }} label="Fila 1 · Plazo" value="30 días" culture="es" aria-invalid aria-describedby="row-problem" readOnly={false} onChange={change} /><p id="row-problem">Fila 1 · Plazo: «30 días» no es un número entero.</p></>); });
  const input = screen.getByRole("textbox", { name: "Fila 1 · Plazo" });
  expect(input).toHaveValue("30 días");
  expect(input).toHaveAttribute("aria-invalid", "true");
  expect(input).toHaveAccessibleDescription("Fila 1 · Plazo: «30 días» no es un número entero.");
  expect(screen.getAllByText(/no es un número entero/)).toHaveLength(1);
  await userEvent.type(input, "x");
  expect(change).toHaveBeenLastCalledWith("30 díasx");
});
it("can clear an optional boolean without turning the empty value into false", async () => {
  const change = vi.fn();
  await act(async () => { renderWithProviders(<CatalogExtraFieldInput field={{ ...newCatalogField("saved", 1), id: "01990000-0000-7000-8000-000000000001", type: "boolean" }} label="Confirmado" value="false" culture="es" readOnly={false} onChange={change} />); });
  await userEvent.click(screen.getByRole("button", { name: "Limpiar Confirmado" }));
  expect(change).toHaveBeenCalledWith(null);
});
it("shows no option text once the source value is cleared", async () => {
  const sourceId = "01990000-0000-7000-8000-000000000040", centro = "01990000-0000-7000-8000-000000000041";
  server.use(http.get("/api/forms/catalogs/" + sourceId, () => HttpResponse.json({ valueType: "Text", proposal: null, id: sourceId, key: sourceId.replaceAll("-", ""), name: { es: "Zonas", en: "Zones" }, description: { es: "Zonas", en: "Zones" }, kind: "Manual", revision: 1, isActive: true, itemsCount: 1, usageCount: null, originalCulture: "es", unavailableReasonCode: null, filters: null, fields: [], presentation: null, presentationCheck: { cultures: [{ culture: "es", titleTooLongCount: 0, titleExamples: [], descriptionTooLongCount: 0, descriptionExamples: [] }, { culture: "en", titleTooLongCount: 0, titleExamples: [], descriptionTooLongCount: 0, descriptionExamples: [] }] } })),
    http.get("/api/forms/catalogs/" + sourceId + "/items", () => HttpResponse.json({ items: [{ value: null, id: centro, code: "C", text: { es: "Centro", en: null }, detail: { es: null, en: null }, position: 1, isActive: true, fields: {}, fieldTexts: {} }], page: 1, pageSize: 20, totalCount: 1, totalPages: 1, hasPrevious: false, hasNext: false })));
  const field = { ...newCatalogField("saved", 1), id: "01990000-0000-7000-8000-000000000001", type: "catalog" as const, sourceCatalogId: sourceId };
  await act(async () => { renderWithProviders(<CatalogExtraFieldInput field={field} scope={{ actorId: "author", culture: "es", permissions: ["formcatalogs.read", "formcatalogs.manage"] }} label="Fila 1 · Zona" value={null} texts={{ es: "Centro" }} culture="es" readOnly={false} onChange={vi.fn()} />); });
  const input = screen.getByRole("combobox", { name: "Fila 1 · Zona" });
  await waitFor(() => expect(input).toBeEnabled());
  expect(input).toHaveValue("");
});
// A field that picks from another catalog: its source and options arrive, and each search reads them again.
const zones = "01990000-0000-7000-8000-000000000040";
const zonesDetail = { valueType: "Text", proposal: null, id: zones, key: zones.replaceAll("-", ""), name: { es: "Zonas", en: "Zones" }, description: { es: "Zonas", en: "Zones" }, kind: "Manual", revision: 1, isActive: true, itemsCount: 2, usageCount: null, originalCulture: "es", unavailableReasonCode: null, filters: null, fields: [], presentation: null, presentationCheck: { cultures: [{ culture: "es", titleTooLongCount: 0, titleExamples: [], descriptionTooLongCount: 0, descriptionExamples: [] }, { culture: "en", titleTooLongCount: 0, titleExamples: [], descriptionTooLongCount: 0, descriptionExamples: [] }] } };
const zoneItem = (id: string, text: string, position: number) => ({ value: null, id, code: text.slice(0, 1), text: { es: text, en: null }, detail: { es: null, en: null }, position, isActive: true, fields: {}, fieldTexts: {} });
const zoneItems = [zoneItem("01990000-0000-7000-8000-000000000041", "Centro", 1), zoneItem("01990000-0000-7000-8000-000000000042", "Norte", 2)];
const zoneField = { ...newCatalogField("saved", 1), id: "01990000-0000-7000-8000-000000000001", type: "catalog" as const, sourceCatalogId: zones };
const zoneScope = { actorId: "author", culture: "es" as const, permissions: ["formcatalogs.read", "formcatalogs.manage"] };
function zoneItemsPage(search: string) {
  const items = zoneItems.filter(item => item.text.es.toLowerCase().includes(search.toLowerCase()));
  return HttpResponse.json({ items, page: 1, pageSize: 20, totalCount: items.length, totalPages: 1, hasPrevious: false, hasNext: false });
}
it("says in its open list that the options load and then that a search reads them, instead of the previous ones", async () => {
  let releaseDetail: (() => void) | undefined, releaseSearch: (() => void) | undefined;
  server.use(http.get("/api/forms/catalogs/" + zones, async () => { await new Promise<void>(resolve => { releaseDetail = resolve; }); return HttpResponse.json(zonesDetail); }),
    http.get("/api/forms/catalogs/" + zones + "/items", async ({ request }) => {
      const search = new URL(request.url).searchParams.get("search") ?? "";
      if (search === "Nor") await new Promise<void>(resolve => { releaseSearch = resolve; });
      return zoneItemsPage(search);
    }));
  await act(async () => { renderWithProviders(<CatalogExtraFieldInput field={zoneField} scope={zoneScope} label="Fila 1 · Zona" value={null} culture="es" readOnly={false} onChange={vi.fn()} />); });
  const input = screen.getByRole("combobox", { name: "Fila 1 · Zona" }), user = userEvent.setup();
  await user.click(input);
  expect(await screen.findByRole("listbox", { name: "Fila 1 · Zona" })).toHaveTextContent("Cargando…");
  await waitFor(() => expect(releaseDetail).toBeDefined());
  await act(async () => { releaseDetail!(); });
  expect(await screen.findByRole("option", { name: "Centro" })).toBeInTheDocument();
  await user.type(input, "Nor");
  expect(await screen.findByRole("listbox", { name: "Fila 1 · Zona" })).toHaveTextContent("Buscando…");
  expect(screen.queryByRole("option", { name: "Centro" })).not.toBeInTheDocument();
  await waitFor(() => expect(releaseSearch).toBeDefined());
  await act(async () => { releaseSearch!(); });
  expect(await screen.findByRole("option", { name: "Norte" })).toBeInTheDocument();
  expect(screen.queryByText("Buscando…")).not.toBeInTheDocument();
  // Its list searches options: no foot that offers to search a catalog.
  expect(screen.queryByText("Buscar catálogo")).not.toBeInTheDocument();
  await user.clear(input); await user.type(input, "Sur");
  await waitFor(() => expect(screen.getByRole("listbox", { name: "Fila 1 · Zona" })).toHaveTextContent("No hay opciones que coincidan."));
});
it("keeps Retry in place, working, while the source is read again", async () => {
  let fail = true, release: (() => void) | undefined;
  server.use(http.get("/api/forms/catalogs/" + zones, async () => {
    if (fail) return HttpResponse.json({ code: "General.Unexpected", status: 503 }, { status: 503 });
    await new Promise<void>(resolve => { release = resolve; });
    return HttpResponse.json(zonesDetail);
  }), http.get("/api/forms/catalogs/" + zones + "/items", ({ request }) => zoneItemsPage(new URL(request.url).searchParams.get("search") ?? "")));
  await act(async () => { renderWithProviders(<CatalogExtraFieldInput field={zoneField} scope={zoneScope} label="Fila 1 · Zona" value={null} culture="es" readOnly={false} onChange={vi.fn()} />); });
  const retry = await screen.findByRole("button", { name: "Reintentar" }), user = userEvent.setup();
  expect(screen.getByRole("combobox", { name: "Fila 1 · Zona" })).toBeDisabled();
  fail = false;
  await user.click(retry);
  const retrying = screen.getByRole("button", { name: "Reintentando…" });
  expect(retrying).toHaveAttribute("aria-busy", "true");
  await waitFor(() => expect(release).toBeDefined());
  await act(async () => { release!(); });
  await waitFor(() => expect(screen.queryByRole("button", { name: /^Reintent/ })).not.toBeInTheDocument());
  await waitFor(() => expect(screen.getByRole("combobox", { name: "Fila 1 · Zona" })).toBeEnabled());
});
it.each([["boolean", "Con GPS"], ["date", "30 días"]] as const)("shows a saved value the %s control cannot hold as it is until it is cleared", async (type, saved) => {
  const change = vi.fn();
  await act(async () => { renderWithProviders(<CatalogExtraFieldInput field={{ ...newCatalogField("saved", 1), id: "01990000-0000-7000-8000-000000000001", type, required: true }} label="Fila 1 · Dato" value={saved} culture="es" readOnly={false} onChange={change} />); });
  const input = screen.getByRole("textbox", { name: "Fila 1 · Dato" });
  expect(input).toHaveValue(saved);
  expect(input).toHaveAttribute("readonly");
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Limpiar Fila 1 · Dato" }));
  expect(change).toHaveBeenCalledWith(null);
});
