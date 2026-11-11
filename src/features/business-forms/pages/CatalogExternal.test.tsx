import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { AppProviders } from "@/app/providers";
import { queryClient } from "@/shared/api/queryClient";
import i18n from "@/shared/i18n";
import { notify } from "@/shared/ui/notifications";
import { server } from "@/test/mocks/server";
import { CatalogEditorPage } from "./CatalogEditorPage";
vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"), useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));
vi.mock("@/shared/ui/notifications", async () => ({ ...await vi.importActual<typeof import("@/shared/ui/notifications")>("@/shared/ui/notifications"), notify: vi.fn() }));

// CA1 (etapa 3 de ARCA) with synthetic bodies of the current DTO source: a catalog a module keeps (External, read-only) and
// «Completar con …» in the options of a catalog a registry completes. The module is never named by the feature: its name comes
// from the lookup («ARCA»), as the server sends it.
const conditionsId = "01990000-0000-7000-8000-000000000401";
const customersId = "01990000-0000-7000-8000-000000000402";
const taxField = "01990000-0000-7000-8000-000000000403";
const conditionField = "01990000-0000-7000-8000-000000000404";
const addressField = "01990000-0000-7000-8000-000000000405";
const registered = "01990000-0000-7000-8000-000000000406";
const check = { cultures: [{ culture: "es", titleTooLongCount: 0, titleExamples: [], descriptionTooLongCount: 0, descriptionExamples: [] }] };
const emptyPage = { items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 0, hasPrevious: false, hasNext: false };
const conditionOption = { id: registered, code: "1", text: { es: "Responsable inscripto", en: "Registered taxpayer" }, detail: {}, value: "1", position: 1, isActive: true, fields: {}, fieldTexts: {} };
const conditions = (feed: { refreshedAtUtc: string | null; failedAtUtc: string | null; failureCode: string | null }) => ({ id: conditionsId, key: "arca.vat-conditions",
  name: { es: "Condición frente al IVA", en: "VAT condition" }, description: {}, originalCulture: "es", kind: "External", revision: 4, isActive: true, itemsCount: 1, usageCount: null,
  unavailableReasonCode: null, filters: null, proposal: null, valueType: "Integer", fields: [], presentation: null, presentationCheck: check, feed });
const field = (id: string, key: string, name: string, position: number, more: object = {}) => ({ id, key, name: { es: name }, type: "text", sourceCatalogId: null, required: false, unique: false,
  min: null, max: null, maxLength: null, role: "data", position, isActive: true, valuesCount: 0, usedBy: [], ...more });
const customers = { id: customersId, key: "arca.customers", name: { es: "Clientes" }, description: {}, originalCulture: "es", kind: "Manual", revision: 2, isActive: true, itemsCount: 0, usageCount: null,
  unavailableReasonCode: null, filters: null, proposal: null, valueType: "Text", presentation: null, presentationCheck: check,
  fields: [field(taxField, "tax_id", "CUIT", 1, { required: true }), field(conditionField, "vat_condition", "Condición frente al IVA", 2, { type: "catalog", sourceCatalogId: conditionsId, required: true }), field(addressField, "address", "Domicilio", 3)] };
let lookups: unknown[];
let lookupReads: number;

function mount(catalogId: string, answers: readonly object[] = []) {
  server.use(http.get("/api/me", () => HttpResponse.json({ id: "01990000-0000-7000-8000-000000000499", displayName: "Laura", email: "laura@example.com", emailConfirmed: true, phoneNumber: null, formattedPhoneNumber: null, maskedPhoneNumber: null, phoneNumberConfirmed: false, hasGoogleLogin: false, culture: "es", timeZoneId: "America/Argentina/Buenos_Aires", lastLoginAtUtc: null, roles: [], permissions: ["formcatalogs.read", "formcatalogs.manage"] })),
    http.get("/api/forms/catalogs/" + customersId, () => HttpResponse.json(customers)),
    http.get("/api/forms/catalogs/" + customersId + "/items", () => HttpResponse.json(emptyPage)),
    http.get("/api/forms/catalogs/:id/lookup", ({ params }) => { lookupReads++; return params.id === customersId ? HttpResponse.json({ name: { es: "ARCA", en: "ARCA" }, fieldId: taxField }) : HttpResponse.json({ title: "No", code: "Forms.Catalog.LookupUnavailable" }, { status: 404 }); }),
    http.post("/api/forms/catalogs/" + customersId + "/lookup", async ({ request }) => { lookups.push(await request.json()); return HttpResponse.json(answers[lookups.length - 1] ?? {}); }),
    http.get("/api/forms/catalogs/" + conditionsId + "/items", () => HttpResponse.json({ ...emptyPage, items: [conditionOption], totalCount: 1, totalPages: 1 })));
  const router = createMemoryRouter([{ path: "/catalogos/:catalogId", Component: CatalogEditorPage }], { initialEntries: ["/catalogos/" + catalogId] });
  return act(async () => { render(<AppProviders><RouterProvider router={router} /></AppProviders>); });
}
const feedDetail = (body: object) => server.use(http.get("/api/forms/catalogs/" + conditionsId, () => HttpResponse.json(body)));
beforeEach(async () => { queryClient.clear(); vi.mocked(notify).mockReset(); lookups = []; lookupReads = 0; await i18n.changeLanguage("es"); });
afterEach(() => { cleanup(); queryClient.clear(); });

describe("a catalog a module keeps (External)", () => {
  it("opens read-only with when it was updated and its (i), without adding, importing or saving options", async () => {
    feedDetail(conditions({ refreshedAtUtc: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), failedAtUtc: null, failureCode: null }));
    server.use(http.get("/api/forms/catalogs/" + conditionsId + "/items", () => HttpResponse.json({ ...emptyPage, items: [conditionOption], totalCount: 1, totalPages: 1 })));
    await mount(conditionsId);
    expect(await screen.findByRole("heading", { name: "Condición frente al IVA" })).toBeInTheDocument();
    expect(screen.getByText("Actualizado hace 2 horas")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cuándo se actualiza" })).toHaveAccessibleDescription("Lo mantiene otro sistema, que lo actualiza una vez por día. No se edita a mano.");
    expect(screen.getByText("De otro sistema · Entero")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Nombre" })).toHaveAttribute("readonly");
    expect(await within(await screen.findByRole("table")).findByText("Responsable inscripto")).toBeInTheDocument();
    for (const name of ["Agregar opción", "Importar", "Guardar", "Descartar"]) expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    expect(screen.queryByRole("status", { name: /No se pudo actualizar/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/No se pudo actualizar/)).not.toBeInTheDocument();
    expect(lookupReads).toBe(0);
  });
  it("says the last update failed, with the day of the copy the forms keep, and the day it was updated", async () => {
    feedDetail(conditions({ refreshedAtUtc: "2026-11-08T13:00:00Z", failedAtUtc: "2026-11-11T14:45:00Z", failureCode: "Arca.Connection.Unavailable" }));
    await mount(conditionsId);
    expect(await screen.findByText("Actualizado el 08/11/2026")).toBeInTheDocument();
    const notice = screen.getByText((_, element) => element?.tagName === "P" && element.textContent === "No se pudo actualizar. El sistema que lo mantiene no responde. Los formularios siguen usando la copia del 08/11/2026; volvemos a probar cada 15 minutos.");
    expect(notice.closest("[role='status']")).not.toBeNull();
  });
});

describe("«Completar con …» in the options of a catalog a registry completes", () => {
  async function addCustomer(answers: readonly object[] = []) {
    feedDetail(conditions({ refreshedAtUtc: "2026-11-11T10:00:00Z", failedAtUtc: null, failureCode: null }));
    await mount(customersId, answers);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Agregar opción" }));
    const dialog = await screen.findByRole("dialog", { name: "Opciones nuevas de «Clientes»" });
    return { user, dialog: within(dialog), taxId: within(dialog).getByRole("textbox", { name: "CUIT" }) };
  }
  it("checks the tax id before asking, and then fills the text, the condition and the address, which can still change", async () => {
    const answer = { text: "Agro del Sur S.A.", fields: [{ fieldId: taxField, value: "30500010912" }, { fieldId: conditionField, value: registered }, { fieldId: addressField, value: "Ruta 5 km 3, Junín" }], failureCode: null, failureMessage: null };
    const { user, dialog, taxId } = await addCustomer([answer]);
    const complete = await dialog.findByRole("button", { name: "Completar con ARCA" });
    await user.type(taxId, "30-50001091-3");
    await user.click(complete);
    expect(await dialog.findByText("Revisá la CUIT: el último dígito no corresponde.")).toBeInTheDocument();
    expect(taxId).toHaveAttribute("aria-invalid", "true");
    await user.clear(taxId);
    expect(dialog.queryByText("Revisá la CUIT: el último dígito no corresponde.")).not.toBeInTheDocument();
    await user.click(complete);
    expect(await dialog.findByText("Escribí la CUIT.")).toBeInTheDocument();
    expect(lookups).toEqual([]);
    await user.type(taxId, "30-50001091-2");
    await user.click(complete);
    await waitFor(() => expect(dialog.getByRole("textbox", { name: "Texto" })).toHaveValue("Agro del Sur S.A."));
    expect(lookups).toEqual([{ taxId: "30-50001091-2" }]);
    expect(taxId).toHaveValue("30500010912");
    expect(dialog.getByRole("textbox", { name: "Domicilio" })).toHaveValue("Ruta 5 km 3, Junín");
    expect(dialog.getByRole("combobox", { name: "Condición frente al IVA" })).toHaveValue("Responsable inscripto");
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: "success", message: "Completamos los datos con ARCA." }));
    await user.type(dialog.getByRole("textbox", { name: "Domicilio" }), " (sucursal)");
    expect(dialog.getByRole("textbox", { name: "Domicilio" })).toHaveValue("Ruta 5 km 3, Junín (sucursal)");
  }, 20_000);
  it("says when the registry does not answer or does not know the tax id, and leaves the option to complete by hand", async () => {
    const { user, dialog, taxId } = await addCustomer([
      { text: null, fields: [], failureCode: "Arca.Connection.Unavailable", failureMessage: "ARCA no respondió." },
      { text: null, fields: [], failureCode: "Arca.Registry.PersonNotFound", failureMessage: "ARCA no tiene datos de esa CUIT en el padrón." }]);
    await user.type(taxId, "20123456786");
    await user.click(await dialog.findByRole("button", { name: "Completar con ARCA" }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: "warning", message: "ARCA no responde", description: "Probá de nuevo en un rato o completalo a mano." })));
    await user.click(dialog.getByRole("button", { name: "Completar con ARCA" }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: "warning", message: "ARCA no tiene esa CUIT." })));
    expect(dialog.getByRole("textbox", { name: "Texto" })).toHaveValue("");
    expect(taxId).toHaveValue("20123456786");
    expect(taxId).not.toHaveAttribute("aria-invalid");
  }, 20_000);
});
