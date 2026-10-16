import { useEffect } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, expect, it, vi } from "vitest";
import { queryClient } from "@/shared/api/queryClient";
import { server } from "@/test/mocks/server";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { FormRulesSection } from "./FormRulesSection";
import { newRuleAction } from "../rules";
const id = "0199a0c0-0000-7000-8000-000000000010";
const actor = "0199a0c0-0000-7000-8000-000000000020";
const initial = () => ({ id: null, definitionId: id, revision: 0, originalCulture: "es", rules: [], createdAtUtc: null, author: null });
const scope = { actorId: actor, culture: "es" as const, permissions: ["formrules.manage"] };
function setup() {
  server.use(http.get("/api/forms/definitions/:id/rules", () => HttpResponse.json(initial())),
    http.get("/api/forms/definitions/:id/rules/options", () => HttpResponse.json({ definitionId: id, name: { es: "Visita", en: "Visit" }, originalCulture: "es", questions: [], conditionChoices: {}, roles: [{ id: actor, name: "Supervisor" }] })),
    http.get("/api/forms/definitions/:id/rules/revisions", () => HttpResponse.json({ items: [], page: 1, pageSize: 10, totalCount: 0, totalPages: 0, hasPrevious: false, hasNext: false })));
}
beforeEach(() => { queryClient.clear(); });
it("saves rules independently using only the original language and records the new revision", async () => {
  setup();
  const saved = vi.fn();
  server.use(http.post("/api/forms/definitions/:id/rules", async ({ request }) => {
    const body = await request.json() as { rules: unknown[] };
    saved(body);
    return HttpResponse.json({ ...initial(), id: crypto.randomUUID(), revision: 1, rules: body.rules, createdAtUtc: "2026-10-16T12:00:00Z", author: { userId: actor, displayName: "Ana" } });
  }));
  const dirty = vi.fn();
  renderWithProviders(<FormRulesSection definitionId={id} definitionRevision={1} scope={scope} contentCulture="es" onDirtyChange={dirty} />);
  await userEvent.click(await screen.findByRole("button", { name: "Agregar regla" }));
  await userEvent.click(screen.getByRole("button", { name: "Agregar acción" }));
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "Acción 1" }), "NotifyAuthor");
  await userEvent.type(screen.getByRole("textbox", { name: "Mensaje" }), "Recibimos {{número}.");
  expect(dirty).toHaveBeenLastCalledWith(true);
  await userEvent.click(screen.getByRole("button", { name: "Guardar reglas" }));
  await waitFor(() => expect(saved).toHaveBeenCalledWith(expect.objectContaining({ expectedRevision: 0, rules: [expect.objectContaining({ event: "Received", actions: [expect.objectContaining({ kind: "NotifyAuthor", text: { es: "Recibimos {número}.", en: "" } })] })] })));
  await waitFor(() => expect(dirty).toHaveBeenLastCalledWith(false));
});
it("retains edits on a revision conflict and adopts the reread revision only explicitly", async () => {
  setup();
  server.use(http.post("/api/forms/definitions/:id/rules", () => HttpResponse.json({ code: "Forms.Rules.RevisionConflict", detail: "Cambió la revisión." }, { status: 409 })));
  renderWithProviders(<FormRulesSection definitionId={id} definitionRevision={1} scope={scope} contentCulture="es" onDirtyChange={vi.fn()} />);
  await userEvent.click(await screen.findByRole("button", { name: "Agregar regla" }));
  await userEvent.click(screen.getByRole("button", { name: "Agregar acción" }));
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "Acción 1" }), "NotifyAuthor");
  await userEvent.type(screen.getByRole("textbox", { name: "Mensaje" }), "Mi borrador");
  await userEvent.click(screen.getByRole("button", { name: "Guardar reglas" }));
  await screen.findByText("Cambió la revisión.");
  server.use(http.get("/api/forms/definitions/:id/rules", () => HttpResponse.json({ ...initial(), id: crypto.randomUUID(), revision: 2, rules: [{ id: crypto.randomUUID(), event: "Received", conditions: [], actions: [{ ...newRuleAction("NotifyAuthor"), text: { es: "Revisión actual" } }] }], createdAtUtc: "2026-10-16T12:00:00Z", author: null })));
  await userEvent.click(screen.getByRole("button", { name: "Releer reglas" }));
  await screen.findByRole("button", { name: "Usar la revisión actual" });
  expect(screen.getByRole("textbox", { name: "Mensaje" })).toHaveValue("Mi borrador");
  await userEvent.click(screen.getByRole("button", { name: "Usar la revisión actual" }));
  expect(screen.queryByDisplayValue("Mi borrador")).not.toBeInTheDocument();
  expect(screen.getByText(/Revisión actual/)).toBeInTheDocument();
});
it("does not request rules without their own permission", async () => {
  setup();
  const requested = vi.fn();
  server.use(http.get("/api/forms/definitions/:id/rules", () => { requested(); return HttpResponse.json(initial()); }));
  await act(async () => { renderWithProviders(<FormRulesSection definitionId={id} definitionRevision={1} scope={{ ...scope, permissions: ["formtemplates.read"] }} contentCulture="es" onDirtyChange={vi.fn()} />); });
  expect(requested).not.toHaveBeenCalled();
  expect(within(document.body).queryByRole("button", { name: "Guardar reglas" })).not.toBeInTheDocument();
});

it("edits catalog choice conditions from rule metadata without catalog or response permissions", async () => {
  setup();
  const fieldId = "0199a0c0-0000-7000-8000-000000000030";
  const choiceId = "0199a0c0-0000-7000-8000-000000000040";
  server.use(http.get("/api/forms/definitions/:id/rules/options", () => HttpResponse.json({ definitionId: id, name: { es: "Visita" }, originalCulture: "es", questions: [{ fieldId, key: "field_" + fieldId.replaceAll("-", ""), type: "choice", label: { es: "Cliente" }, help: null, required: true, maxLength: null, options: null, source: { catalog: actor } }], conditionChoices: { [fieldId]: [{ id: choiceId, label: "Cliente elegido" }] }, roles: [] })));
  renderWithProviders(<FormRulesSection definitionId={id} definitionRevision={1} scope={scope} contentCulture="es" onDirtyChange={vi.fn()} />);
  await userEvent.click(await screen.findByRole("button", { name: "Agregar regla" }));
  await userEvent.click(screen.getByRole("button", { name: "Agregar condición" }));
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "Condición" }), "in");
  expect(screen.getByRole("option", { name: "Cliente elegido" })).toHaveValue(choiceId);
  await userEvent.selectOptions(screen.getByRole("listbox", { name: "Valor" }), choiceId);
  expect(screen.getByRole("option", { name: "Cliente elegido" })).toHaveProperty("selected", true);
});
it("opens an immutable historical revision without adopting it", async () => {
  setup();
  const historyId = crypto.randomUUID();
  server.use(http.get("/api/forms/definitions/:id/rules/revisions", () => HttpResponse.json({ items: [{ id: historyId, revision: 1, createdAtUtc: "2026-10-16T12:00:00Z", author: { userId: actor, displayName: "Ana" }, hasApproval: false }], page: 1, pageSize: 10, totalCount: 1, totalPages: 1, hasPrevious: false, hasNext: false })),
    http.get("/api/forms/definitions/:id/rules/revisions/:revision", () => HttpResponse.json({ ...initial(), id: historyId, revision: 1, createdAtUtc: "2026-10-16T12:00:00Z", rules: [{ id: crypto.randomUUID(), event: "Received", conditions: [], actions: [{ ...newRuleAction("NotifyAuthor"), text: { es: "Mensaje histórico" } }] }] })));
  const dirty = vi.fn();
  renderWithProviders(<FormRulesSection definitionId={id} definitionRevision={1} scope={scope} contentCulture="es" onDirtyChange={dirty} />);
  await userEvent.click(await screen.findByRole("button", { name: "Revisión 1" }));
  const dialog = await screen.findByRole("dialog", { name: "Revisión 1" });
  expect(within(dialog).getByText(/Mensaje histórico/)).toBeInTheDocument();
  expect(within(dialog).queryByRole("textbox")).not.toBeInTheDocument();
  expect(dirty).toHaveBeenLastCalledWith(false);
});

it("removes rule text, history, and editor state after the server revokes rule access", async () => {
  setup();
  const privateText = "private rule content";
  server.use(http.get("/api/forms/definitions/:id/rules", () => HttpResponse.json({ ...initial(), id: crypto.randomUUID(), revision: 1, createdAtUtc: "2026-10-16T12:00:00Z", rules: [{ id: crypto.randomUUID(), event: "Received", conditions: [], actions: [{ ...newRuleAction("NotifyAuthor"), text: { es: privateText } }] }] })),
    http.post("/api/forms/definitions/:id/rules", () => HttpResponse.json({ code: "Forms.Rules.Forbidden" }, { status: 403 })));
  let client: QueryClient | undefined;
  function CacheProbe() { const current = useQueryClient(); useEffect(() => { client = current; }, [current]); return null; }
  renderWithProviders(<><CacheProbe /><FormRulesSection definitionId={id} definitionRevision={1} scope={scope} contentCulture="es" onDirtyChange={vi.fn()} /></>);
  expect(await screen.findByText(new RegExp(privateText))).toBeInTheDocument();
  expect(client?.getQueryCache().getAll().some(query => JSON.stringify(query.state.data)?.includes(privateText))).toBe(true);
  await userEvent.click(screen.getByRole("button", { name: "Editar regla 1" }));
  await userEvent.type(screen.getByRole("textbox", { name: "Mensaje" }), " edited");
  await userEvent.click(screen.getByRole("button", { name: "Guardar reglas" }));
  await screen.findByText("Ya no tenés permiso para administrar las reglas.");
  expect(screen.queryByDisplayValue(new RegExp(privateText))).not.toBeInTheDocument();
  await waitFor(() => expect(client?.getQueryCache().getAll().some(query => JSON.stringify(query.state.data)?.includes(privateText))).toBe(false));
});

it("refreshes saved question options while preserving unsaved rules after the draft revision changes", async () => {
  setup();
  const dirty = vi.fn();
  const rendered = renderWithProviders(<FormRulesSection definitionId={id} definitionRevision={1} scope={scope} contentCulture="es" onDirtyChange={dirty} />);
  await userEvent.click(await screen.findByRole("button", { name: "Agregar regla" }));
  await userEvent.click(screen.getByRole("button", { name: "Agregar acción" }));
  await userEvent.type(screen.getByRole("textbox", { name: "Mensaje" }), "Reglas todavía sin guardar");
  expect(screen.getByRole("button", { name: "Agregar condición" })).toBeDisabled();
  const fieldId = "0199a0c0-0000-7000-8000-000000000030";
  server.use(http.get("/api/forms/definitions/:id/rules/options", () => HttpResponse.json({ definitionId: id, name: { es: "Visita" }, originalCulture: "es", questions: [{ fieldId, key: "field_" + fieldId.replaceAll("-", ""), type: "decimal", label: { es: "Pregunta guardada" }, help: null, required: false, maxLength: null, options: null }], conditionChoices: {}, roles: [] })));
  rendered.rerender(<FormRulesSection definitionId={id} definitionRevision={2} scope={scope} contentCulture="es" onDirtyChange={dirty} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Agregar condición" })).toBeEnabled());
  expect(screen.getByRole("textbox", { name: "Mensaje" })).toHaveValue("Reglas todavía sin guardar");
  expect(dirty).toHaveBeenLastCalledWith(true);
  await userEvent.click(screen.getByRole("button", { name: "Agregar condición" }));
  expect(screen.getByRole("option", { name: "Pregunta guardada" })).toBeInTheDocument();
});
