import { notify, dismissNotification } from "@/shared/ui/notifications";
import { useEffect } from "react";
import { MemoryRouter } from "react-router";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, expect, it, vi } from "vitest";
import { queryClient } from "@/shared/api/queryClient";
import { server } from "@/test/mocks/server";
import { httpCohort } from "@/test/httpCohort";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { FormRulesSection } from "./FormRulesSection";
import { newRuleAction, type FormRule } from "../rules";
const id = "0199a0c0-0000-7000-8000-000000000010";
const actor = "0199a0c0-0000-7000-8000-000000000020";
const initial = () => ({ id: null, definitionId: id, revision: 0, originalCulture: "es", rules: [], createdAtUtc: null, author: null });
const scope = { actorId: actor, culture: "es" as const, permissions: ["formrules.manage"] };
function setup() {
  server.use(http.get("/api/forms/definitions/:id/rules", () => HttpResponse.json(initial())),
    http.get("/api/forms/definitions/:id/rules/options", () => HttpResponse.json({ definitionId: id, name: { es: "Visita", en: "Visit" }, originalCulture: "es", questions: [], conditionChoices: {}, roles: [{ id: actor, name: "Supervisor" }] })),
    http.get("/api/forms/definitions/:id/rules/revisions", () => HttpResponse.json({ items: [], page: 1, pageSize: 10, totalCount: 0, totalPages: 0, hasPrevious: false, hasNext: false })));
}
beforeEach(() => { vi.clearAllMocks(); queryClient.clear(); });
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
  await screen.findByRole("button", { name: "Releer reglas" });
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
  const writes = vi.fn();
  server.use(http.post("/api/forms/definitions/:id/rules", async ({ request }) => { const body = await request.json() as {rules: FormRule[]}; writes(body); return HttpResponse.json({...initial(), id:actor, revision:1, rules:body.rules, createdAtUtc:"2026-10-17T12:00:00Z"}); }));
  renderWithProviders(<FormRulesSection definitionId={id} definitionRevision={1} scope={scope} contentCulture="es" onDirtyChange={vi.fn()} />);
  await userEvent.click(await screen.findByRole("button", { name: "Agregar regla" }));
  await userEvent.click(screen.getByRole("button", { name: "Agregar condición" }));
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "Condición" }), "in");
  const picker = screen.getByRole("button", { name: "Valor" });
  picker.focus();
  await userEvent.keyboard("{Enter}");
  const choice = await screen.findByRole("menuitemcheckbox", { name: "Cliente elegido" });
  await userEvent.click(choice);
  expect(choice).toHaveAttribute("aria-checked", "true");
  await userEvent.keyboard("{Escape}");
  expect(picker).toHaveTextContent("Cliente elegido");
  await userEvent.click(screen.getByRole("button", {name:"Agregar acción"}));
  await userEvent.type(screen.getByRole("textbox", {name:"Mensaje"}), "Aviso");
  await userEvent.click(screen.getByRole("button", {name:"Guardar reglas"}));
  await waitFor(()=>expect(writes).toHaveBeenCalledOnce());
  expect(writes).toHaveBeenCalledWith(expect.objectContaining({rules:[expect.objectContaining({conditions:[{fieldId, operator:"in", values:[choiceId]}]})]}));
});
it("opens an immutable historical revision without adopting it", async () => {
  setup();
  const historyId = crypto.randomUUID();
  server.use(http.get("/api/forms/definitions/:id/rules/revisions", () => HttpResponse.json({ items: [{ id: historyId, revision: 1, createdAtUtc: "2026-10-16T12:00:00Z", author: { userId: actor, displayName: "Ana" }, hasApproval: false, changes: { addedRules: 1, updatedRules: 0, removedRules: 0, orderChanged: false } }], page: 1, pageSize: 10, totalCount: 1, totalPages: 1, hasPrevious: false, hasNext: false })),
    http.get("/api/forms/definitions/:id/rules/revisions/:revision", () => HttpResponse.json({ ...initial(), id: historyId, revision: 1, createdAtUtc: "2026-10-16T12:00:00Z", rules: [{ id: crypto.randomUUID(), event: "Received", conditions: [], actions: [{ ...newRuleAction("NotifyAuthor"), text: { es: "Mensaje histórico" } }] }] })));
  const dirty = vi.fn();
  renderWithProviders(<FormRulesSection definitionId={id} definitionRevision={1} scope={scope} contentCulture="es" onDirtyChange={dirty} />);
  const trigger = await screen.findByRole("button", { name: "Revisión 1" });
  await userEvent.click(trigger);
  const dialog = await screen.findByRole("dialog", { name: "Revisión 1" });
  expect(within(dialog).getByText(/Mensaje histórico/)).toBeInTheDocument();
  expect(within(dialog).queryByRole("textbox")).not.toBeInTheDocument();
  expect(dirty).toHaveBeenLastCalledWith(false);
  await userEvent.click(within(dialog).getByRole("button", { name: "Cerrar" }));
  await waitFor(() => expect(trigger).toHaveFocus());
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

vi.mock("@/shared/ui/notifications", async () => ({ ...await vi.importActual<typeof import("@/shared/ui/notifications")>("@/shared/ui/notifications"), notify: vi.fn(), dismissNotification: vi.fn() }));

it("notifies one rules save failure while retaining the editable draft", async () => {
  setup();
  server.use(http.post("/api/forms/definitions/:id/rules", () => HttpResponse.json({ code: "Test.Save", detail: "No pudimos guardar estas reglas." }, { status: 400 })));
  const view = renderWithProviders(<FormRulesSection definitionId={id} definitionRevision={1} scope={scope} contentCulture="es" onDirtyChange={vi.fn()} />);
  await userEvent.click(await screen.findByRole("button", { name: "Agregar regla" }));
  await userEvent.click(screen.getByRole("button", { name: "Agregar acción" }));
  await userEvent.type(screen.getByRole("textbox", { name: "Mensaje" }), "Mi regla conservada");
  await userEvent.click(screen.getByRole("button", { name: "Guardar reglas" }));
  await waitFor(() => expect(notify).toHaveBeenCalledOnce());
  const notice = vi.mocked(notify).mock.calls[0][0];
  expect(notice).toMatchObject({ kind: "error", message: "No pudimos guardar estas reglas." });
  expect(screen.queryByText(notice.message)).not.toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "Mensaje" })).toHaveValue("Mi regla conservada");
  expect(screen.getByRole("button", { name: "Guardar reglas" })).toBeEnabled();
  view.unmount();
  expect(dismissNotification).toHaveBeenCalledWith(notice.id);
});
it.each(["rules", "rules/revisions"])("uses the common notification owner for failed %s reads", async path => {
  setup();
  server.use(http.get("/api/forms/definitions/:id/" + path, () => HttpResponse.json({ code: "Test.Read", detail: "La lectura de reglas falló." }, { status: 400 })));
  renderWithProviders(<FormRulesSection definitionId={id} definitionRevision={1} scope={scope} contentCulture="es" onDirtyChange={vi.fn()} />);
  await waitFor(() => expect(notify).toHaveBeenCalledOnce());
  expect(vi.mocked(notify).mock.calls[0][0]).toMatchObject({ kind: "error", message: "La lectura de reglas falló." });
  expect(screen.queryByText("La lectura de reglas falló.")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
});

it("binds the unchanged exported role validation to its rule and focuses the marked field", async () => {
  setup();
  const cohort = httpCohort("rules");
  cohort.verify();
  const firstRuleId = crypto.randomUUID();
  const secondRuleId = crypto.randomUUID();
  const rules = [{ id: firstRuleId, event: "Received", conditions: [], actions: [{ ...newRuleAction("RequestApproval"), roleId: actor }] }, { id: secondRuleId, event: "Received", conditions: [], actions: [{ ...newRuleAction("NotifyAuthor"), text: { es: "Mensaje guardado" } }] }];
  const writes = vi.fn();
  server.use(http.get("/api/forms/definitions/:id/rules", () => HttpResponse.json({ ...initial(), id: crypto.randomUUID(), revision: 1, rules, createdAtUtc: "2026-10-16T12:00:00Z" })),
    http.post("/api/forms/definitions/:id/rules", async ({ request }) => { writes(await request.json()); return cohort.response("role-unavailable-es.json", 400, { "content-type": "application/problem+json" }); }));
  const dirty = vi.fn();
  renderWithProviders(<FormRulesSection definitionId={id} definitionRevision={1} scope={scope} contentCulture="es" onDirtyChange={dirty}/>);
  await userEvent.click(await screen.findByRole("button", { name: "Editar regla 2" }));
  await userEvent.type(screen.getByRole("textbox", { name: "Mensaje" }), " propio");
  await userEvent.click(screen.getByRole("button", { name: "Guardar reglas" }));
  const first = within(screen.getByRole("region", { name: "Regla 1" }));
  const role = await first.findByRole("combobox", { name: "Rol" });
  expect(role).toHaveAttribute("aria-invalid", "true");
  expect(first.getByRole("alert")).toHaveTextContent("El rol elegido ya no está disponible.");
  expect(role).toHaveAccessibleDescription("El rol elegido ya no está disponible.");
  await waitFor(() => expect(role).toHaveFocus());
  expect(screen.getByRole("button", { name: "Editar regla 1" })).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByRole("button", { name: "Editar regla 2" })).toHaveAttribute("aria-expanded", "false");
  expect(within(screen.getByRole("region", { name: "Regla 2" })).getByText(/Mensaje guardado propio/)).toBeInTheDocument();
  expect(dirty).toHaveBeenLastCalledWith(true);
  expect(writes).toHaveBeenCalledWith(expect.objectContaining({ expectedRevision: 1, rules: [expect.objectContaining({ id: firstRuleId }), expect.objectContaining({ id: secondRuleId, actions: [expect.objectContaining({ text: { es: "Mensaje guardado propio" } })] })] }));
  expect(notify).not.toHaveBeenCalled();
});

function storedRule(message = "Mensaje guardado"): FormRule {
  return { id: crypto.randomUUID(), event: "Received", conditions: [], actions: [{ ...newRuleAction("NotifyAuthor"), text: { es: message } }] };
}
function serveRules(rules: readonly FormRule[], revision = 1) {
  server.use(http.get("/api/forms/definitions/:id/rules", () => HttpResponse.json({ ...initial(), id: actor, revision, rules, createdAtUtc: "2026-10-17T12:00:00Z" })));
}
it("explains unchanged and invalid rules beside the disabled save control", async () => {
  setup();
  renderWithProviders(<FormRulesSection definitionId={id} definitionRevision={1} scope={scope} contentCulture="es" onDirtyChange={vi.fn()}/>);
  const save = await screen.findByRole("button", { name: "Guardar reglas" });
  expect(save).toBeDisabled();
  expect(save).toHaveAccessibleDescription("No hay cambios para guardar.");
  expect(screen.getByText("No hay cambios para guardar.")).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Agregar regla" }));
  expect(save).toBeDisabled();
  expect(save).toHaveAccessibleDescription("Revisá los datos marcados antes de guardar.");
});
it("keeps the whole own rules draft after rereading a conflict and saves it explicitly over the current revision", async () => {
  setup();
  const mine = storedRule();
  const theirs = storedRule("Reglas de otra persona");
  let revision = 1;
  const writes: unknown[] = [];
  server.use(http.get("/api/forms/definitions/:id/rules", () => HttpResponse.json({ ...initial(), id: actor, revision, rules: revision === 1 ? [mine] : [theirs], createdAtUtc: "2026-10-17T12:00:00Z" })),
    http.post("/api/forms/definitions/:id/rules", async ({ request }) => {
      const body = await request.json() as { rules: FormRule[] }; writes.push(body);
      if (writes.length === 1) { revision = 2; return HttpResponse.json({ code: "Forms.Rules.RevisionConflict" }, { status: 409 }); }
      return HttpResponse.json({ ...initial(), id: actor, revision: 3, rules: body.rules, createdAtUtc: "2026-10-17T13:00:00Z" });
    }));
  renderWithProviders(<FormRulesSection definitionId={id} definitionRevision={1} scope={scope} contentCulture="es" onDirtyChange={vi.fn()}/>);
  await userEvent.click(await screen.findByRole("button", { name: "Editar regla 1" }));
  await userEvent.type(screen.getByRole("textbox", { name: "Mensaje" }), " propio");
  await userEvent.click(screen.getByRole("button", { name: "Guardar reglas" }));
  await userEvent.click(await screen.findByRole("button", { name: "Releer reglas" }));
  const keep = await screen.findByRole("button", { name: "Conservar mis cambios" });
  expect(screen.getByRole("button", {name:"Guardar reglas"})).toHaveAccessibleDescription("Releé y elegí qué conservar antes de guardar.");
  expect(screen.getByText(/reemplazará las reglas de la revisión 2/)).toBeVisible();
  await userEvent.click(keep);
  expect(screen.getByRole("textbox", { name: "Mensaje" })).toHaveValue("Mensaje guardado propio");
  expect(writes).toHaveLength(1);
  await userEvent.click(screen.getByRole("button", { name: "Guardar reglas" }));
  await waitFor(() => expect(writes).toHaveLength(2));
  expect(writes[1]).toEqual({ expectedRevision: 2, rules: [{ ...mine, actions: [{ ...mine.actions[0], text: { es: "Mensaje guardado propio" } }] }] });
  expect(screen.queryByText("Reglas de otra persona")).not.toBeInTheDocument();
});
it("returns focus from Done to the same rule and from removal to its surviving neighbor", async () => {
  setup(); serveRules([storedRule("Primera"), storedRule("Segunda")]);
  renderWithProviders(<FormRulesSection definitionId={id} definitionRevision={1} scope={scope} contentCulture="es" onDirtyChange={vi.fn()}/>);
  const edit = await screen.findByRole("button", { name: "Editar regla 1" });
  const neighbor = screen.getByRole("button", { name: "Editar regla 2" });
  await userEvent.click(edit);
  await userEvent.click(screen.getByRole("button", { name: "Listo" }));
  await waitFor(() => expect(edit).toHaveFocus());
  await userEvent.click(screen.getByRole("button", { name: "Quitar regla 1" }));
  await waitFor(() => expect(neighbor).toHaveFocus());
  await userEvent.click(screen.getByRole("button", { name: "Quitar regla 1" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Agregar regla" })).toHaveFocus());
});
it("keeps focus on a moved action identity and announces its new position", async () => {
  setup(); const first = storedRule(); const rule = { ...first, actions: [...first.actions, { ...newRuleAction("NotifyAuthor"), text: { es: "Segundo aviso" } }] }; serveRules([rule]);
  renderWithProviders(<FormRulesSection definitionId={id} definitionRevision={1} scope={scope} contentCulture="es" onDirtyChange={vi.fn()}/>);
  await userEvent.click(await screen.findByRole("button", { name: "Editar regla 1" }));
  await userEvent.click(screen.getByRole("button", { name: "Bajar acción 1" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Subir acción 2" })).toHaveFocus());
  expect(screen.getByRole("status")).toHaveTextContent("Acción 2: posición 2 de 2");
  expect(screen.getAllByRole("textbox", { name: "Mensaje" }).map(input => (input as HTMLTextAreaElement).value)).toEqual(["Segundo aviso", "Mensaje guardado"]);
});
it("summarizes saved rule conditions with their shared readable values and operators", async () => {
  setup(); const fieldId = crypto.randomUUID(); const choiceId = crypto.randomUUID(); const rule = { ...storedRule(), conditions: [{ fieldId, operator: "in", values: [choiceId] }] };
  serveRules([rule]);
  server.use(http.get("/api/forms/definitions/:id/rules/options", () => HttpResponse.json({ definitionId: id, name: { es: "Visita" }, originalCulture: "es", questions: [{ fieldId, key: "field_" + fieldId.replaceAll("-", ""), type: "choice", label: { es: "Cliente" }, help: null, required: true, maxLength: null, options: null, source: { catalog: actor } }], conditionChoices: { [fieldId]: [{ id: choiceId, label: "Cliente elegido" }] }, roles: [] })));
  renderWithProviders(<FormRulesSection definitionId={id} definitionRevision={1} scope={scope} contentCulture="es" onDirtyChange={vi.fn()}/>);
  expect(await screen.findByText("Si: Cliente: Cliente elegido")).toBeVisible();
});
it("shows rule history change counts and order without loading each revision", async () => {
  setup(); let details = 0;
  server.use(http.get("/api/forms/definitions/:id/rules/revisions", () => HttpResponse.json({ items: [{ id: actor, revision: 2, createdAtUtc: "2026-10-17T12:00:00Z", author: null, hasApproval: false, changes: { addedRules: 1, updatedRules: 2, removedRules: 1, orderChanged: true } }], page: 1, pageSize: 10, totalCount: 1, totalPages: 1, hasPrevious: false, hasNext: false })),
    http.get("/api/forms/definitions/:id/rules/revisions/:revision", () => { details++; return HttpResponse.json(initial()); }));
  renderWithProviders(<FormRulesSection definitionId={id} definitionRevision={1} scope={scope} contentCulture="es" onDirtyChange={vi.fn()}/>);
  await screen.findByRole("button", { name: "Revisión 2" });
  expect(screen.getByText(/1 regla agregada/)).toBeVisible(); expect(screen.getByText(/2 reglas actualizadas/)).toBeVisible(); expect(screen.getByText(/1 regla quitada/)).toBeVisible(); expect(screen.getByText(/Cambió el orden/)).toBeVisible();
  expect(details).toBe(0);
});

it("clears an attached PDF when changing the event and saves the remaining notice without that attachment", async () => {
  setup(); const notice = { ...newRuleAction("NotifyAuthor"), includePdf: true, text: { es: "Aviso" } }; const rule: FormRule = { id: actor, event: "Approved", conditions: [], actions: [newRuleAction("GeneratePdf"), notice] }; serveRules([rule]);
  const writes = vi.fn(); server.use(http.post("/api/forms/definitions/:id/rules", async ({request}) => { const body = await request.json() as {rules:FormRule[]}; writes(body); return HttpResponse.json({...initial(),id:actor,revision:2,rules:body.rules,createdAtUtc:"2026-10-17T12:00:00Z"}); }));
  renderWithProviders(<MemoryRouter><FormRulesSection definitionId={id} definitionRevision={1} scope={scope} contentCulture="es" onDirtyChange={vi.fn()}/></MemoryRouter>);
  await userEvent.click(await screen.findByRole("button",{name:"Editar regla 1"}));
  expect(screen.getByRole("checkbox",{name:"Adjuntar el PDF"})).toBeChecked();
  await userEvent.selectOptions(screen.getByRole("combobox",{name:"Cuándo"}),"Rejected");
  expect(screen.getByRole("checkbox",{name:"Adjuntar el PDF"})).not.toBeChecked();
  expect(screen.getByRole("checkbox",{name:"Adjuntar el PDF"})).toBeDisabled();
  await userEvent.click(screen.getByRole("button",{name:"Quitar acción 1"}));
  await userEvent.click(screen.getByRole("button",{name:"Guardar reglas"}));
  await waitFor(()=>expect(writes).toHaveBeenCalledOnce());
  expect(writes).toHaveBeenCalledWith({expectedRevision:1,rules:[{...rule,event:"Rejected",actions:[{...notice,includePdf:false}]}]});
});
it("returns focus from action removal to a neighbor and then to Add action", async () => {
  setup();const first=storedRule();const rule={...first,actions:[...first.actions,{...newRuleAction("NotifyAuthor"),text:{es:"Segundo aviso"}}]};serveRules([rule]);
  renderWithProviders(<FormRulesSection definitionId={id} definitionRevision={1} scope={scope} contentCulture="es" onDirtyChange={vi.fn()}/>);
  await userEvent.click(await screen.findByRole("button",{name:"Editar regla 1"}));
  const next=screen.getByRole("combobox",{name:"Acción 2"});
  await userEvent.click(screen.getByRole("button",{name:"Quitar acción 1"}));
  await waitFor(()=>expect(next).toHaveFocus());
  await userEvent.click(screen.getByRole("button",{name:"Quitar acción 1"}));
  await waitFor(()=>expect(screen.getByRole("button",{name:"Agregar acción"})).toHaveFocus());
});

it("focuses the next remaining condition and then Add condition after removing the last one", async () => {
  setup();const first=crypto.randomUUID();const second=crypto.randomUUID();const rule={...storedRule(),conditions:[{fieldId:first,operator:"answered",values:[]},{fieldId:second,operator:"answered",values:[]}]};serveRules([rule]);
  server.use(http.get("/api/forms/definitions/:id/rules/options",()=>HttpResponse.json({definitionId:id,name:{es:"Visita"},originalCulture:"es",questions:[first,second].map((fieldId,index)=>({fieldId,key:"field_"+fieldId.replaceAll("-",""),type:"decimal",label:{es:index===0?"Primera pregunta":"Segunda pregunta"},help:null,required:false,maxLength:null,options:null})),conditionChoices:{},roles:[]})));
  renderWithProviders(<FormRulesSection definitionId={id} definitionRevision={1} scope={scope} contentCulture="es" onDirtyChange={vi.fn()}/>);
  await userEvent.click(await screen.findByRole("button",{name:"Editar regla 1"}));
  await userEvent.click(screen.getByRole("button",{name:"Quitar condición 1"}));
  const remaining=screen.getByRole("combobox",{name:"Pregunta"});expect(remaining).toHaveValue(second);
  await waitFor(()=>expect(remaining).toHaveFocus());
  await userEvent.click(screen.getByRole("button",{name:"Quitar condición 1"}));
  await waitFor(()=>expect(screen.getByRole("button",{name:"Agregar condición"})).toHaveFocus());
});
it.each(["remove","move"] as const)("clears orphaned PDF attachments when their generator changes: %s", async kind => {
  setup();const notice={...newRuleAction("NotifyAuthor"),includePdf:true,text:{es:"Aviso"}};const pdf=newRuleAction("GeneratePdf");const rule:FormRule={...storedRule(),event:"Approved",actions:[pdf,notice]};serveRules([rule]);
  renderWithProviders(<MemoryRouter><FormRulesSection definitionId={id} definitionRevision={1} scope={scope} contentCulture="es" onDirtyChange={vi.fn()}/></MemoryRouter>);
  await userEvent.click(await screen.findByRole("button",{name:"Editar regla 1"}));
  await userEvent.click(screen.getByRole("button",{name:kind==="remove"?"Quitar acción 1":"Bajar acción 1"}));
  expect(screen.getByRole("checkbox",{name:"Adjuntar el PDF"})).not.toBeChecked();
  expect(screen.getByRole("button",{name:"Guardar reglas"})).toBeEnabled();
});
it("requires a new reread after a second conflict instead of reusing the previous current revision", async () => {
  setup();const mine=storedRule();let revision=1;const writes:unknown[]=[];
  server.use(http.get("/api/forms/definitions/:id/rules",()=>HttpResponse.json({...initial(),id:actor,revision,rules:revision===1?[mine]:[storedRule("Actual")],createdAtUtc:"2026-10-17T12:00:00Z"})),http.post("/api/forms/definitions/:id/rules",async({request})=>{writes.push(await request.json());revision++;return HttpResponse.json({code:"Forms.Rules.RevisionConflict"},{status:409});}));
  renderWithProviders(<FormRulesSection definitionId={id} definitionRevision={1} scope={scope} contentCulture="es" onDirtyChange={vi.fn()}/>);
  await userEvent.click(await screen.findByRole("button",{name:"Editar regla 1"}));await userEvent.type(screen.getByRole("textbox",{name:"Mensaje"})," propio");
  await userEvent.click(screen.getByRole("button",{name:"Guardar reglas"}));await userEvent.click(await screen.findByRole("button",{name:"Releer reglas"}));await userEvent.click(await screen.findByRole("button",{name:"Conservar mis cambios"}));
  await userEvent.click(screen.getByRole("button",{name:"Guardar reglas"}));await screen.findByRole("button",{name:"Releer reglas"});
  expect(screen.queryByRole("button",{name:"Conservar mis cambios"})).not.toBeInTheDocument();expect(screen.queryByRole("button",{name:"Usar la revisión actual"})).not.toBeInTheDocument();
  expect(screen.getByRole("textbox",{name:"Mensaje"})).toHaveValue("Mensaje guardado propio");
  await userEvent.click(screen.getByRole("button",{name:"Releer reglas"}));await screen.findByText(/reemplazará las reglas de la revisión 3/);
  expect(writes).toEqual([{expectedRevision:1,rules:[{...mine,actions:[{...mine.actions[0],text:{es:"Mensaje guardado propio"}}]}]},{expectedRevision:2,rules:[{...mine,actions:[{...mine.actions[0],text:{es:"Mensaje guardado propio"}}]}]}]);
});

it("explains an in-flight save and its server cooldown once without discarding the draft", async () => {
  setup();serveRules([storedRule()]);let release!:()=>void;const pending=new Promise<void>(resolve=>{release=resolve;});
  server.use(http.post("/api/forms/definitions/:id/rules",async()=>{await pending;return HttpResponse.json({code:"RateLimit.Exceeded",detail:"Esperá antes de volver a guardar.",retryAfter:60},{status:429});}));
  renderWithProviders(<FormRulesSection definitionId={id} definitionRevision={1} scope={scope} contentCulture="es" onDirtyChange={vi.fn()}/>);
  await userEvent.click(await screen.findByRole("button",{name:"Editar regla 1"}));await userEvent.type(screen.getByRole("textbox",{name:"Mensaje"})," propio");
  await userEvent.click(screen.getByRole("button",{name:"Guardar reglas"}));
  expect(screen.getByRole("button",{name:"Guardando reglas…"})).toHaveAccessibleDescription("Esperá a que termine la operación.");
  await act(async()=>{release();});const save=await screen.findByRole("button",{name:"Guardar reglas"});
  expect(save).toBeDisabled();expect(save).toHaveAccessibleDescription(/Esperá [0-9]+ segundos para volver a intentar./);
  expect(screen.getAllByText(/Esperá [0-9]+ segundos para volver a intentar./)).toHaveLength(1);
  expect(screen.getByRole("textbox",{name:"Mensaje"})).toHaveValue("Mensaje guardado propio");
});
