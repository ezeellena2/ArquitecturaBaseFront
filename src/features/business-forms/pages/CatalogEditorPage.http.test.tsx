import { act, cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter } from "react-router";
import { render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { AppProviders } from "@/app/providers";
import { queryClient } from "@/shared/api/queryClient";
import i18n from "@/shared/i18n";
import { server } from "@/test/mocks/server";
import capturedOptionsRaw from "@/test/fixtures/catalogs-http/filters/options.json?raw";
import capturedDetailRaw from "@/test/fixtures/catalogs-http/filters/detail.json?raw";
import capturedPreviewRequest from "@/test/fixtures/catalogs-http/filters/preview-request.json";
import capturedPreviewRaw from "@/test/fixtures/catalogs-http/filters/preview.json?raw";
import { readCatalog, readCatalogFilterOptions, readCatalogFilterPreview } from "../api/catalogResponse";
import { CatalogEditorPage } from "./CatalogEditorPage";

vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"), useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));
vi.mock("@/shared/ui/notifications", async () => ({ ...await vi.importActual<typeof import("@/shared/ui/notifications")>("@/shared/ui/notifications"), notify: vi.fn() }));
// Whole-value configuration cases do not exercise character-by-character search behavior.
async function pasteText(user: ReturnType<typeof userEvent.setup>, control: HTMLElement, text: string) {
  await user.click(control);
  await user.paste(text);
}

async function mount(path: string) {
  const router = createMemoryRouter([{ path: "/catalogos/:catalogId", Component: CatalogEditorPage }], { initialEntries: [path] });
  await act(async () => { render(<AppProviders><RouterProvider router={router} /></AppProviders>); });
}
function setup() {
  server.use(http.get("/api/me", () => HttpResponse.json({ id: "actor", displayName: "Ana", email: "ana@example.com", emailConfirmed: true, phoneNumber: null, formattedPhoneNumber: null, maskedPhoneNumber: null, phoneNumberConfirmed: false, hasGoogleLogin: false, culture: "es", timeZoneId: "America/Argentina/Buenos_Aires", lastLoginAtUtc: null, roles: [], permissions: ["formcatalogs.read", "formcatalogs.manage"] })));
}
beforeEach(async () => { queryClient.clear(); await i18n.changeLanguage("es"); });
afterEach(() => { cleanup(); queryClient.clear(); });
// It opens the whole editor and fills each condition: with the full suite or the backend running it went past the 5 s.
it("renders unchanged real K4 detail/options and the result of the captured preview request", async () => {
  setup(); const detail = readCatalog(JSON.parse(capturedDetailRaw)); const options = readCatalogFilterOptions(JSON.parse(capturedOptionsRaw)); const preview = readCatalogFilterPreview(JSON.parse(capturedPreviewRaw));
  const person = options.sampleUsers!.items.find(person => person.id === capturedPreviewRequest.sampleUserId)!;
  const json = (body: string) => new HttpResponse(body, { headers: { "content-type": "application/json" } });
  const received: unknown[] = [];
  server.use(http.get("/api/forms/catalogs/" + detail.id, () => json(capturedDetailRaw)), http.get("/api/forms/catalog-filter-options", () => json(capturedOptionsRaw)), http.post("/api/forms/catalog-previews", async ({ request }) => { received.push(await request.json()); return json(capturedPreviewRaw); }));
  await mount("/catalogos/" + detail.id); const user = userEvent.setup();
  expect(await screen.findByRole("textbox", { name: "Nombre" })).toHaveValue(detail.name.es);
  // The Picker opens with the keyboard and chooses by the option's name: the page names the columns and the comparisons, and the
  // choices are the server's (909 roles: the name is found by its text, without the accessible name of every option).
  const pick = async (name: string, option: string) => {
    const trigger = screen.getByRole("button", { name: new RegExp("^" + name + " ") }); await act(async () => { trigger.focus(); }); await user.keyboard("{Enter}");
    await user.click(within(await screen.findByRole("listbox")).getByText(option, { exact: true }));
  };
  const column = (key: string) => i18n.t("forms:catalogs.filters.columnLabels." + key);
  await screen.findByRole("button", { name: /^Texto de cada opción / });
  await pick("Texto de cada opción", column(capturedPreviewRequest.filters.textColumn));
  await pick("Detalle", capturedPreviewRequest.filters.detailColumn ? column(capturedPreviewRequest.filters.detailColumn) : i18n.t("forms:catalogs.filters.noDetail"));
  for (const [index, condition] of capturedPreviewRequest.filters.conditions.entries()) {
    await user.click(screen.getByRole("button", { name: "Agregar condición" })); await pick("Columna de la condición " + (index + 1), column(condition.column));
    await pick("Comparación de la condición " + (index + 1), i18n.t("forms:catalogs.filters.operatorLabels." + condition.operator));
    const label = "Valor de la condición " + (index + 1); const choice = options.columns.find(item => item.key === condition.column)?.choices?.find(item => item.key === condition.value);
    if (choice) await pick(label, choice.label); else await pasteText(user, screen.getByRole("textbox", { name: label }), condition.value);
  }
  await user.click(screen.getByRole("combobox", { name: "Como si lo recibiera" })); await user.click(screen.getByRole("option", { name: person.name }));
  await user.click(screen.getByRole("button", { name: "Probar" }));
  await screen.findByText(preview.items[0]!.text, { exact: true }); expect(screen.getByText(preview.items[0]!.detail!, { exact: true })).toBeInTheDocument(); expect(received).toEqual([capturedPreviewRequest]);
}, 20_000);
