import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { AppProviders } from "@/app/providers";
import { queryClient } from "@/shared/api/queryClient";
import i18n from "@/shared/i18n";
import { server } from "@/test/mocks/server";
import { notify } from "@/shared/ui/notifications";
import { CatalogEditorPage } from "./CatalogEditorPage";

vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"), useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));
vi.mock("@/shared/ui/notifications", async () => ({ ...await vi.importActual<typeof import("@/shared/ui/notifications")>("@/shared/ui/notifications"), notify: vi.fn() }));
const id = "01990000-0000-7000-8000-000000000020";
const firstId = "01990000-0000-7000-8000-000000000021";
const secondId = "01990000-0000-7000-8000-000000000022";
const initial = { valueType: "Text" as const, proposal: null, id, key: id.replaceAll("-", ""), name: { es: "Clientes" }, description: {}, kind: "Manual", revision: 1, isActive: true, itemsCount: 2, usageCount: null, originalCulture: "es" as const, unavailableReasonCode: null, filters: null, fields: [], presentation: null, presentationCheck: { cultures: [{ culture: "es" as const, titleTooLongCount: 0, titleExamples: [], descriptionTooLongCount: 0, descriptionExamples: [] }] } };
const first = { value: null, id: firstId, code: "C1", text: { es: "Pérez" }, detail: {}, position: 1, isActive: true, fields: {}, fieldTexts: {} };
const second = { ...first, id: secondId, code: "C2", text: { es: "López" }, position: 2 };
function setup(rows: () => readonly unknown[]) {
  server.use(http.get("/api/me", () => HttpResponse.json({ id: "actor", displayName: "Ana", email: "ana@example.com", emailConfirmed: true, phoneNumber: null, formattedPhoneNumber: null, maskedPhoneNumber: null, phoneNumberConfirmed: false, hasGoogleLogin: false, culture: "es", timeZoneId: "America/Argentina/Buenos_Aires", lastLoginAtUtc: null, roles: [], permissions: ["formcatalogs.read", "formcatalogs.manage"] })),
    http.get("/api/forms/catalogs/" + id, () => HttpResponse.json(initial)),
    http.get("/api/forms/catalogs/" + id + "/items", () => HttpResponse.json({ items: rows(), page: 1, pageSize: 20, totalCount: rows().length, totalPages: 1, hasPrevious: false, hasNext: false })));
}
async function mount() {
  const router = createMemoryRouter([{ path: "/catalogos/:catalogId", Component: CatalogEditorPage }], { initialEntries: ["/catalogos/" + id] });
  await act(async () => { render(<AppProviders><RouterProvider router={router} /></AppProviders>); });
}
async function markForDeletion(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole("button", { name: "Eliminar " + name }));
  await user.click(within(screen.getByRole("dialog", { name: "¿Eliminar «" + name + "»?" })).getByRole("button", { name: "Eliminar opción" }));
}
beforeEach(async () => { queryClient.clear(); vi.mocked(notify).mockClear(); await i18n.changeLanguage("es"); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); queryClient.clear(); });

describe("Deleting a saved option of a Manual catalog", () => {
  it("marks it after confirming, restores it, and deletes it on Save without its edits or moves", async () => {
    let rows: readonly unknown[] = [first, second]; const bodies: Record<string, unknown>[] = [];
    setup(() => rows);
    server.use(http.put("/api/forms/catalogs/" + id, async ({ request }) => {
      bodies.push(await request.json() as Record<string, unknown>); rows = [first];
      return HttpResponse.json({ catalog: { ...initial, revision: 2, itemsCount: 1 }, itemIdentityMap: {}, fieldIdentityMap: {} });
    }));
    await mount(); const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Editar López" }));
    const code = screen.getByRole("textbox", { name: "Código" }); await user.clear(code); await user.type(code, "C9");
    // The option is edited in the options modal; on the phone «Listo» is in its list.
    await user.click(screen.getByRole("button", { name: "Volver a la lista" }));
    await user.click(screen.getByRole("button", { name: "Listo" }));
    await markForDeletion(user, "López");
    expect(screen.getByText("Se elimina al guardar")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Código" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bajar Pérez" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Restaurar López" }));
    expect(screen.queryByText("Se elimina al guardar")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
    await markForDeletion(user, "López");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({ expectedRevision: 1, items: [], deleteItemIds: [secondId] });
    expect(bodies[0]).not.toHaveProperty("moves");
    await waitFor(() => expect(screen.queryByRole("button", { name: /López/ })).not.toBeInTheDocument());
  });

  it("cannot be marked while moves are pending", async () => {
    setup(() => [first, second]);
    await mount(); const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Bajar Pérez" }));
    expect(screen.getByRole("button", { name: "Eliminar López" })).toBeDisabled();
  });

  it("stays marked and says what uses it when the server cannot delete it", async () => {
    const message = "La opción está en uso y no se puede eliminar. Podés darla de baja.";
    setup(() => [first, second]);
    server.use(http.put("/api/forms/catalogs/" + id, () => HttpResponse.json({ code: "Forms.Catalog.ItemInUse", detail: message, errors: { "deleteItemIds[0]": [message] }, uses: ["records", "people"] }, { status: 409 })));
    await mount(); const user = userEvent.setup();
    await screen.findByRole("button", { name: "Editar Pérez" });
    await markForDeletion(user, "Pérez");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(await screen.findByText("No se puede eliminar: la eligió una respuesta y la tiene una persona en sus datos. Podés darla de baja.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restaurar Pérez" })).toBeInTheDocument();
    expect(vi.mocked(notify).mock.calls.filter(([feedback]) => feedback.kind === "error")).toHaveLength(0);
  });
});
