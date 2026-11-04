import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { AppProviders } from "@/app/providers";
import { queryClient } from "@/shared/api/queryClient";
import i18n from "@/shared/i18n";
import type { AssistantProposalCardProps } from "@/shared/hooks/assistantProposalContext";
import { notify } from "@/shared/ui/notifications";
import { server } from "@/test/mocks/server";
import { proposalCapabilities } from "../../assistantProposalCapabilities";
import { FormsProposalCard } from "./FormsProposalCard";
vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"), useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));
vi.mock("@/shared/ui/notifications", async () => ({ ...await vi.importActual<typeof import("@/shared/ui/notifications")>("@/shared/ui/notifications"), notify: vi.fn() }));
const operator = "01990000-0000-7000-8000-000000000022";
const requestId = "01990000-0000-7000-8000-000000000051";
const proposalId = "01990000-0000-7000-8000-000000000052";
const createdId = "01990000-0000-7000-8000-000000000053";
const form = { culture: "es", name: "Control de carga", prefix: "CCC", submitLabel: "Enviar", questions: [
  { label: "Patente", type: "shortText", required: true, options: [], catalog: null },
  { label: "Campo", type: "catalog", required: false, options: [], catalog: { id: "01990000-0000-7000-8000-000000000031", name: "Campos" } },
] };
const catalog = { culture: "es", name: "Transportistas", description: "Empresas que traen la carga", valueType: "text", code: "CUIT", option: "Razón social",
  fields: [{ name: "Teléfono", type: "text" }] };
let created: string | null;
let posted: unknown[];
let failure: { status: number; code: string; detail: string } | null;
function props(capability: string, content: unknown, extra: Partial<AssistantProposalCardProps> = {}): AssistantProposalCardProps {
  return { requestId, proposal: { id: proposalId, capability, version: 1, content }, previous: null, replaced: false, ...extra };
}
async function mount(card: AssistantProposalCardProps, permissions = ["formtemplates.read", "formtemplates.manage", "formcatalogs.read", "formcatalogs.manage"]) {
  const status = (key: string) => () => HttpResponse.json({ proposalId, [key]: created });
  const create = (key: string) => async ({ request }: { request: Request }) => {
    posted.push(await request.json());
    if (failure) return HttpResponse.json({ title: "Error", status: failure.status, detail: failure.detail, code: failure.code }, { status: failure.status });
    created = createdId;
    return HttpResponse.json({ proposalId, [key]: createdId }, { status: 201 });
  };
  server.use(http.get("/api/me", () => HttpResponse.json({ id: operator, displayName: "Ana Pérez", email: "ana@example.com", emailConfirmed: true, phoneNumber: null, formattedPhoneNumber: null, maskedPhoneNumber: null, phoneNumberConfirmed: false, hasGoogleLogin: false, culture: "es", timeZoneId: "America/Argentina/Buenos_Aires", lastLoginAtUtc: null, roles: [], permissions })),
    http.get("/api/forms/definitions/assistant-proposals/" + proposalId, status("definitionId")),
    http.post("/api/forms/definitions/assistant-proposals", create("definitionId")),
    http.get("/api/forms/catalogs/assistant-proposals/" + proposalId, status("catalogId")),
    http.post("/api/forms/catalogs/assistant-proposals", create("catalogId")));
  const router = createMemoryRouter([{ path: "/", element: <FormsProposalCard {...card} /> }, { path: "/formularios/:formId", element: <p>Editor</p> },
    { path: "/catalogos/:catalogId", element: <p>Catálogo</p> }], { initialEntries: ["/"] });
  await act(async () => { render(<AppProviders><RouterProvider router={router} /></AppProviders>); });
  return router;
}
beforeEach(async () => { queryClient.clear(); vi.mocked(notify).mockReset(); created = null; posted = []; failure = null; await i18n.changeLanguage("es"); });
afterEach(() => { cleanup(); queryClient.clear(); });

it("shows a form proposal with its questions and creates its draft once, then opens it", async () => {
  const router = await mount(props(proposalCapabilities.form, form));
  const card = await screen.findByRole("region", { name: "Formulario: Control de carga" });
  expect(within(card).getByText("CCC · 2 preguntas")).toBeInTheDocument();
  expect(within(card).getByText("Texto corto · Obligatoria")).toBeInTheDocument();
  expect(within(card).getByText("Elegir de un catálogo · Campos, ya existe")).toBeInTheDocument();
  await userEvent.click(within(card).getByRole("button", { name: "Crear borrador" }));
  expect(await screen.findByText("Editor")).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/formularios/" + createdId);
  expect(posted).toEqual([{ requestId, proposalId }]);
});

it("folds a proposal that already created its draft, with the way to open it", async () => {
  created = createdId;
  await mount(props(proposalCapabilities.form, form));
  const card = await screen.findByRole("region", { name: "Formulario: Control de carga" });
  expect(await within(card).findByText("Borrador creado")).toBeInTheDocument();
  expect(within(card).getByRole("link", { name: "Abrir el borrador" })).toHaveAttribute("href", "/formularios/" + createdId);
  expect(within(card).queryByRole("button", { name: "Crear borrador" })).not.toBeInTheDocument();
});

it("folds a replaced proposal to one line without its buttons", async () => {
  await mount(props(proposalCapabilities.form, form, { replaced: true }));
  const card = await screen.findByRole("region", { name: "Formulario: Control de carga" });
  expect(within(card).getByText("Reemplazada")).toBeInTheDocument();
  expect(within(card).queryByRole("button")).not.toBeInTheDocument();
});

it("says on the card that the name is in use, and creates nothing", async () => {
  failure = { status: 400, code: "Forms.Definition.NameTaken", detail: "Ya hay un formulario con ese nombre." };
  const router = await mount(props(proposalCapabilities.form, form));
  const card = await screen.findByRole("region", { name: "Formulario: Control de carga" });
  await userEvent.click(within(card).getByRole("button", { name: "Crear borrador" }));
  expect(await within(card).findByRole("alert")).toHaveTextContent("Ya hay un formulario con ese nombre.");
  expect(router.state.location.pathname).toBe("/");
  expect(notify).not.toHaveBeenCalled();
});

it("shows how it looks before creating, and marks the questions that changed", async () => {
  const previous = { id: "01990000-0000-7000-8000-000000000054", capability: proposalCapabilities.form, version: 1, content: { ...form, questions: [form.questions[0]] } };
  await mount(props(proposalCapabilities.form, form, { previous }));
  const card = await screen.findByRole("region", { name: "Formulario: Control de carga" });
  expect(within(card).getAllByText("Nueva")).toHaveLength(1);
  await userEvent.click(within(card).getByRole("button", { name: "Ver cómo queda" }));
  const dialog = await screen.findByRole("dialog", { name: "Cómo queda · Control de carga" });
  expect(within(dialog).getByText("Patente")).toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: "Crear borrador" })).toBeInTheDocument();
  await userEvent.click(within(dialog).getAllByRole("button", { name: "Cerrar" }).at(-1)!);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("creates a Manual catalog and opens it; without managing catalogs there is nothing to create", async () => {
  const router = await mount(props(proposalCapabilities.catalog, catalog));
  const card = await screen.findByRole("region", { name: "Catálogo: Transportistas" });
  expect(within(card).getByText("Texto · 1 campo")).toBeInTheDocument();
  expect(within(card).getByText("Código · CUIT")).toBeInTheDocument();
  expect(within(card).getByText("Teléfono · Texto")).toBeInTheDocument();
  await userEvent.click(within(card).getByRole("button", { name: "Crear catálogo" }));
  expect(await screen.findByText("Catálogo")).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/catalogos/" + createdId);
  cleanup(); queryClient.clear(); created = null;
  await mount(props(proposalCapabilities.catalog, catalog), ["formcatalogs.read"]);
  const readOnly = await screen.findByRole("region", { name: "Catálogo: Transportistas" });
  expect(within(readOnly).queryByRole("button", { name: "Crear catálogo" })).not.toBeInTheDocument();
});
