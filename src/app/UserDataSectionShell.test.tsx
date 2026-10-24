import { useContext } from "react";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, delay, http, type HttpHandler } from "msw";
import { expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { server } from "@/test/mocks/server";
import { currentUser } from "@/test/mocks/handlers";
import { initialAppearance } from "@/shared/lib/appearance";
import { UserDataSectionContext } from "@/shared/hooks/userDataSectionContext";
import { detailOf, juan, roles } from "@/features/users/testData";
import { UserDataSectionShell } from "./UserDataSectionShell";
vi.mock("react-oidc-context", async () => { const actual = await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"); return { ...actual, useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "t" } }) }; });
const personId = "01990000-0000-7000-8000-000000000002";
function Probe() { const extension = useContext(UserDataSectionContext); return <p>{extension ? "extension" : "without extension"}</p>; }
function Opener({ onClosed }: { onClosed?: () => void }) { const extension = useContext(UserDataSectionContext); return extension ? <button type="button" onClick={() => extension.openUser(personId, onClosed)}>Abrir persona</button> : null; }
const presentation = (features: string[]) => http.get("/api/settings/presentation", () => HttpResponse.json({ appearance: initialAppearance, defaultCulture: "es", defaultTimeZoneId: "UTC", defaultPageSize: 20, installedFeatures: features }));
async function mount(features: string[]) {
 server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["users.manage"] })), presentation(features));
 await act(async () => { renderWithProviders(<UserDataSectionShell><Probe /></UserDataSectionShell>); });
}
/** The real account editor with the optional section and no person attributes defined. */
const editorHandlers = (latency = 0) => [
 http.get(`/api/users/${personId}`, async () => { await delay(latency); return HttpResponse.json(detailOf({ ...juan, id: personId })); }),
 http.get("/api/roles", () => HttpResponse.json(roles)),
 http.get("/api/forms/person-attributes", () => HttpResponse.json({ items: [] })),
 http.get(`/api/forms/person-data/${personId}`, () => HttpResponse.json({ userId: personId, revision: null, values: {} })),
];
async function openPerson(person: HttpHandler[], onClosed?: () => void) {
 server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["users.manage", "users.read"] })), presentation(["forms"]), ...person);
 await act(async () => { renderWithProviders(<UserDataSectionShell><Opener onClosed={onClosed} /></UserDataSectionShell>); });
 await userEvent.click(await screen.findByRole("button", { name: "Abrir persona" }));
}
it("does not contribute data to accounts when the optional module is absent", async () => { await mount([]); expect(await screen.findByText("without extension")).toBeInTheDocument(); });
it("contributes a neutral account section only for an installed module", async () => { await mount(["forms"]); expect(await screen.findByText("extension")).toBeInTheDocument(); });
it("shows the person's loading inside the edit dialog", async () => {
 await openPerson([http.get(`/api/users/${personId}`, async () => { await delay("infinite"); return HttpResponse.json(null); })]);
 const dialog = await screen.findByRole("dialog", { name: "Editar usuario" });
 expect(within(dialog).getByRole("status")).toHaveTextContent("Cargando…");
});
it("explains a forbidden person inside the edit dialog", async () => {
 await openPerson([http.get(`/api/users/${personId}`, () => HttpResponse.json({ status: 403, title: "Forbidden", traceId: "trace" }, { status: 403 }))]);
 const dialog = within(await screen.findByRole("dialog", { name: "Editar usuario" }));
 expect(await dialog.findByText("No tenés permiso")).toBeInTheDocument();
 await userEvent.click(dialog.getAllByRole("button", { name: "Cerrar" })[0]);
 await waitFor(() => expect(screen.queryByRole("dialog", { name: "Editar usuario" })).not.toBeInTheDocument());
 expect(screen.getByRole("button", { name: "Abrir persona" })).toHaveFocus();
});
it("returns the focus to the opener after the editor that loaded inside the dialog closes", async () => {
 await openPerson(editorHandlers(200));
 expect(await screen.findByRole("dialog", { name: "Editar usuario" })).toBeInTheDocument();
 await screen.findByRole("textbox", { name: "Nombre" });
 await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
 await waitFor(() => expect(screen.queryByRole("dialog", { name: "Editar usuario" })).not.toBeInTheDocument());
 await waitFor(() => expect(screen.getByRole("button", { name: "Abrir persona" })).toHaveFocus());
});
it("notifies the opener once when the edit dialog closes", async () => {
 const closed = vi.fn();
 await openPerson(editorHandlers(), closed);
 await screen.findByRole("textbox", { name: "Nombre" });
 expect(closed).not.toHaveBeenCalled();
 await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
 await waitFor(() => expect(screen.queryByRole("dialog", { name: "Editar usuario" })).not.toBeInTheDocument());
 expect(closed).toHaveBeenCalledOnce();
});
