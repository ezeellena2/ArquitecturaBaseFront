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
import i18n from "@/shared/i18n";
import { FormRulesSection } from "./FormRulesSection";
import { newRuleAction, type FormRule } from "../rules";
const id = "0199a0c0-0000-7000-8000-000000000010";
const actor = "0199a0c0-0000-7000-8000-000000000020";
const initial = () => ({ id: null, definitionId: id, revision: 0, originalCulture: "es", rules: [], createdAtUtc: null, author: null });
const scope = { actorId: actor, culture: "es" as const, permissions: ["formrules.manage"] };
/** What the message box shows, without the zero-width space that holds the cursor after a final tag. */
const messageText = (box: HTMLElement) => box.textContent?.replaceAll("​", "") ?? "";
/** Writes at the end of the message box, as after a click at its end: jsdom puts a click on an editable box at its start. */
async function writeAtEnd(box: HTMLElement, text: string) {
  box.focus();
  const range = document.createRange();
  range.selectNodeContents(box);
  range.collapse(false);
  document.getSelection()!.removeAllRanges();
  document.getSelection()!.addRange(range);
  await userEvent.keyboard(text);
}
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
  renderWithProviders(<FormRulesSection prefix="VIS" definitionId={id} definitionRevision={1} scope={scope} onDirtyChange={dirty} />);
  await userEvent.click(await screen.findByRole("button", { name: "Agregar regla" }));
  await userEvent.click(screen.getByRole("button", { name: "Agregar acción" }));
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "Acción 1" }), "NotifyAuthor");
  await writeAtEnd(screen.getByRole("textbox", { name: "Mensaje" }), "Recibimos ");
  await userEvent.click(screen.getByRole("button", { name: "Agregar dato" }));
  await userEvent.click(screen.getByRole("option", { name: "Número" }));
  await userEvent.keyboard(".");
  expect(dirty).toHaveBeenLastCalledWith(true);
  await userEvent.click(screen.getByRole("button", { name: "Guardar reglas" }));
  await waitFor(() => expect(saved).toHaveBeenCalledWith(expect.objectContaining({ expectedRevision: 0, rules: [expect.objectContaining({ event: "Received", actions: [expect.objectContaining({ kind: "NotifyAuthor", text: { es: "Recibimos {número}.", en: "" } })] })] })));
  await waitFor(() => expect(dirty).toHaveBeenLastCalledWith(false));
});
it("retains edits on a revision conflict and adopts the reread revision only explicitly", async () => {
  setup();
  server.use(http.post("/api/forms/definitions/:id/rules", () => HttpResponse.json({ code: "Forms.Rules.RevisionConflict", detail: "Cambió la revisión." }, { status: 409 })));
  renderWithProviders(<FormRulesSection prefix="VIS" definitionId={id} definitionRevision={1} scope={scope} onDirtyChange={vi.fn()} />);
  await userEvent.click(await screen.findByRole("button", { name: "Agregar regla" }));
  await userEvent.click(screen.getByRole("button", { name: "Agregar acción" }));
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "Acción 1" }), "NotifyAuthor");
  await writeAtEnd(screen.getByRole("textbox", { name: "Mensaje" }), "Mi borrador");
  await userEvent.click(screen.getByRole("button", { name: "Guardar reglas" }));
  await screen.findByRole("button", { name: "Releer reglas" });
  server.use(http.get("/api/forms/definitions/:id/rules", () => HttpResponse.json({ ...initial(), id: crypto.randomUUID(), revision: 2, rules: [{ id: crypto.randomUUID(), event: "Received", conditions: [], actions: [{ ...newRuleAction("NotifyAuthor"), text: { es: "Revisión actual" } }] }], createdAtUtc: "2026-10-16T12:00:00Z", author: null })));
  await userEvent.click(screen.getByRole("button", { name: "Releer reglas" }));
  await screen.findByRole("button", { name: "Usar la revisión actual" });
  expect(messageText(screen.getByRole("textbox", { name: "Mensaje" }))).toBe("Mi borrador");
  await userEvent.click(screen.getByRole("button", { name: "Usar la revisión actual" }));
  expect(screen.queryByDisplayValue("Mi borrador")).not.toBeInTheDocument();
  expect(screen.getByText(/Revisión actual/)).toBeInTheDocument();
});
it("does not request rules without their own permission", async () => {
  setup();
  const requested = vi.fn();
  server.use(http.get("/api/forms/definitions/:id/rules", () => { requested(); return HttpResponse.json(initial()); }));
  await act(async () => { renderWithProviders(<FormRulesSection prefix="VIS" definitionId={id} definitionRevision={1} scope={{ ...scope, permissions: ["formtemplates.read"] }} onDirtyChange={vi.fn()} />); });
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
  renderWithProviders(<FormRulesSection prefix="VIS" definitionId={id} definitionRevision={1} scope={scope} onDirtyChange={vi.fn()} />);
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
  await writeAtEnd(screen.getByRole("textbox", {name:"Mensaje"}), "Aviso");
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
  renderWithProviders(<FormRulesSection prefix="VIS" definitionId={id} definitionRevision={1} scope={scope} onDirtyChange={dirty} />);
  const history = await screen.findByRole("button", { name: "Historial" });
  await waitFor(() => expect(history).toBeEnabled());
  await userEvent.click(history);
  const panel = await screen.findByRole("dialog", { name: "Historial de las reglas" });
  await userEvent.click(within(panel).getByRole("button", { name: "Revisión 1" }));
  expect(await within(panel).findByRole("heading", { name: "Revisión 1" })).toBeInTheDocument();
  expect(within(panel).getByText(/Mensaje histórico/)).toBeInTheDocument();
  expect(within(panel).queryByRole("textbox")).not.toBeInTheDocument();
  expect(dirty).toHaveBeenLastCalledWith(false);
  // Into the revision the focus goes to the way back; back in the list, to the revision it left; closing, to «Historial».
  await waitFor(() => expect(within(panel).getByRole("button", { name: "Volver a las revisiones" })).toHaveFocus());
  await userEvent.click(within(panel).getByRole("button", { name: "Volver a las revisiones" }));
  await waitFor(() => expect(within(panel).getByRole("button", { name: "Revisión 1" })).toHaveFocus());
  await userEvent.click(within(panel).getByRole("button", { name: "Cerrar" }));
  await waitFor(() => expect(history).toHaveFocus());
});

it("removes rule text, history, and editor state after the server revokes rule access", async () => {
  setup();
  const privateText = "private rule content";
  server.use(http.get("/api/forms/definitions/:id/rules", () => HttpResponse.json({ ...initial(), id: crypto.randomUUID(), revision: 1, createdAtUtc: "2026-10-16T12:00:00Z", rules: [{ id: crypto.randomUUID(), event: "Received", conditions: [], actions: [{ ...newRuleAction("NotifyAuthor"), text: { es: privateText } }] }] })),
    http.post("/api/forms/definitions/:id/rules", () => HttpResponse.json({ code: "Forms.Rules.Forbidden" }, { status: 403 })));
  let client: QueryClient | undefined;
  function CacheProbe() { const current = useQueryClient(); useEffect(() => { client = current; }, [current]); return null; }
  renderWithProviders(<><CacheProbe /><FormRulesSection prefix="VIS" definitionId={id} definitionRevision={1} scope={scope} onDirtyChange={vi.fn()} /></>);
  expect(await screen.findByText(new RegExp(privateText))).toBeInTheDocument();
  expect(client?.getQueryCache().getAll().some(query => JSON.stringify(query.state.data)?.includes(privateText))).toBe(true);
  await userEvent.click(screen.getByRole("button", { name: "Editar regla 1" }));
  await writeAtEnd(screen.getByRole("textbox", { name: "Mensaje" }), " edited");
  await userEvent.click(screen.getByRole("button", { name: "Guardar reglas" }));
  await screen.findByText("Ya no tenés permiso para administrar las reglas.");
  expect(screen.queryByDisplayValue(new RegExp(privateText))).not.toBeInTheDocument();
  await waitFor(() => expect(client?.getQueryCache().getAll().some(query => JSON.stringify(query.state.data)?.includes(privateText))).toBe(false));
});

it("refreshes saved question options while preserving unsaved rules after the draft revision changes", async () => {
  setup();
  const dirty = vi.fn();
  const rendered = renderWithProviders(<FormRulesSection prefix="VIS" definitionId={id} definitionRevision={1} scope={scope} onDirtyChange={dirty} />);
  await userEvent.click(await screen.findByRole("button", { name: "Agregar regla" }));
  await userEvent.click(screen.getByRole("button", { name: "Agregar acción" }));
  await writeAtEnd(screen.getByRole("textbox", { name: "Mensaje" }), "Reglas todavía sin guardar");
  expect(screen.getByRole("button", { name: "Agregar condición" })).toBeDisabled();
  const fieldId = "0199a0c0-0000-7000-8000-000000000030";
  server.use(http.get("/api/forms/definitions/:id/rules/options", () => HttpResponse.json({ definitionId: id, name: { es: "Visita" }, originalCulture: "es", questions: [{ fieldId, key: "field_" + fieldId.replaceAll("-", ""), type: "decimal", label: { es: "Pregunta guardada" }, help: null, required: false, maxLength: null, options: null }], conditionChoices: {}, roles: [] })));
  rendered.rerender(<FormRulesSection prefix="VIS" definitionId={id} definitionRevision={2} scope={scope} onDirtyChange={dirty} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Agregar condición" })).toBeEnabled());
  expect(messageText(screen.getByRole("textbox", { name: "Mensaje" }))).toBe("Reglas todavía sin guardar");
  expect(dirty).toHaveBeenLastCalledWith(true);
  await userEvent.click(screen.getByRole("button", { name: "Agregar condición" }));
  expect(screen.getByRole("option", { name: "Pregunta guardada" })).toBeInTheDocument();
});

vi.mock("@/shared/ui/notifications", async () => ({ ...await vi.importActual<typeof import("@/shared/ui/notifications")>("@/shared/ui/notifications"), notify: vi.fn(), dismissNotification: vi.fn() }));

it("notifies one rules save failure while retaining the editable draft", async () => {
  setup();
  server.use(http.post("/api/forms/definitions/:id/rules", () => HttpResponse.json({ code: "Test.Save", detail: "No pudimos guardar estas reglas." }, { status: 400 })));
  const view = renderWithProviders(<FormRulesSection prefix="VIS" definitionId={id} definitionRevision={1} scope={scope} onDirtyChange={vi.fn()} />);
  await userEvent.click(await screen.findByRole("button", { name: "Agregar regla" }));
  await userEvent.click(screen.getByRole("button", { name: "Agregar acción" }));
  await writeAtEnd(screen.getByRole("textbox", { name: "Mensaje" }), "Mi regla conservada");
  await userEvent.click(screen.getByRole("button", { name: "Guardar reglas" }));
  await waitFor(() => expect(notify).toHaveBeenCalledOnce());
  const notice = vi.mocked(notify).mock.calls[0][0];
  expect(notice).toMatchObject({ kind: "error", message: "No pudimos guardar estas reglas." });
  expect(screen.queryByText(notice.message)).not.toBeInTheDocument();
  expect(messageText(screen.getByRole("textbox", { name: "Mensaje" }))).toBe("Mi regla conservada");
  expect(screen.getByRole("button", { name: "Guardar reglas" })).toBeEnabled();
  view.unmount();
  expect(dismissNotification).toHaveBeenCalledWith(notice.id);
});
it.each(["rules", "rules/revisions"])("uses the common notification owner for failed %s reads", async path => {
  setup();
  server.use(http.get("/api/forms/definitions/:id/" + path, () => HttpResponse.json({ code: "Test.Read", detail: "La lectura de reglas falló." }, { status: 400 })));
  renderWithProviders(<FormRulesSection prefix="VIS" definitionId={id} definitionRevision={1} scope={scope} onDirtyChange={vi.fn()} />);
  await waitFor(() => expect(notify).toHaveBeenCalledOnce());
  expect(vi.mocked(notify).mock.calls[0][0]).toMatchObject({ kind: "error", message: "La lectura de reglas falló." });
  expect(screen.queryByText("La lectura de reglas falló.")).not.toBeInTheDocument();
  if (path === "rules/revisions") await userEvent.click(screen.getByRole("button", { name: "Historial" }));
  expect(await screen.findByRole("button", { name: "Reintentar" })).toBeInTheDocument();
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
  renderWithProviders(<FormRulesSection prefix="VIS" definitionId={id} definitionRevision={1} scope={scope} onDirtyChange={dirty}/>);
  await userEvent.click(await screen.findByRole("button", { name: "Editar regla 2" }));
  await writeAtEnd(screen.getByRole("textbox", { name: "Mensaje" }), " propio");
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

// The band of a surface: its title, the (i) of its help and its actions.
const bandOf = (title: string) => screen.getByRole("heading", { name: title }).closest("section")!.firstElementChild as HTMLElement;
const rulesHelp = "Se guardan aparte: cambiarlas no crea otra versión ni toca WhatsApp. Lo que ya pasó con cada respuesta no cambia.";
function storedRule(message = "Mensaje guardado"): FormRule {
  return { id: crypto.randomUUID(), event: "Received", conditions: [], actions: [{ ...newRuleAction("NotifyAuthor"), text: { es: message } }] };
}
const noRevisions = "Todavía no hay revisiones.";
function serveRules(rules: readonly FormRule[], revision = 1) {
  server.use(http.get("/api/forms/definitions/:id/rules", () => HttpResponse.json({ ...initial(), id: actor, revision, rules, createdAtUtc: "2026-10-17T12:00:00Z" })));
}
it("keeps the rules header to Add and Save without draft state, revision or explanations", async () => {
  setup(); serveRules([storedRule()], 3);
  renderWithProviders(<FormRulesSection prefix="VIS" definitionId={id} definitionRevision={1} scope={scope} onDirtyChange={vi.fn()}/>);
  const save = await screen.findByRole("button", { name: "Guardar reglas" });
  // Besides the title, the band has only its (i), whose help is hidden until it is asked for, and the two actions.
  const band = bandOf("Cuando llega una respuesta");
  expect(within(band).getAllByRole("button").map(button => button.getAttribute("aria-label") ?? button.textContent)).toEqual(["Más información sobre Cuando llega una respuesta", "Historial", "Agregar regla", "Guardar reglas"]);
  const visible = () => band.textContent!.replace(rulesHelp, "").replace(noRevisions, "");
  expect(visible()).toBe("Cuando llega una respuestaHistorialAgregar reglaGuardar reglas");
  expect(save).toBeDisabled();
  expect(save).not.toHaveAccessibleDescription();
  await userEvent.click(screen.getByRole("button", { name: "Editar regla 1" }));
  await writeAtEnd(screen.getByRole("textbox", { name: "Mensaje" }), " propio");
  expect(visible()).toBe("Cuando llega una respuestaHistorialAgregar reglaGuardar reglas");
  expect(save).toBeEnabled();
  expect(screen.queryByText("Cambios sin guardar")).not.toBeInTheDocument();
  expect(screen.queryByText(/revisión 3/i)).not.toBeInTheDocument();
});
it("marks an incomplete new rule only after trying to save and then corrects it live without a request", async () => {
  setup();
  const writes = vi.fn();
  server.use(http.post("/api/forms/definitions/:id/rules", () => { writes(); return HttpResponse.json(initial()); }));
  renderWithProviders(<FormRulesSection prefix="VIS" definitionId={id} definitionRevision={1} scope={scope} onDirtyChange={vi.fn()}/>);
  await userEvent.click(await screen.findByRole("button", { name: "Agregar regla" }));
  const region = within(screen.getByRole("region", { name: "Regla 1" }));
  expect(region.queryByText("Completá este dato.")).not.toBeInTheDocument();
  expect(region.getByRole("button", { name: "Agregar acción" })).not.toHaveAttribute("aria-invalid");
  await userEvent.click(region.getByRole("button", { name: "Listo" }));
  const save = screen.getByRole("button", { name: "Guardar reglas" });
  expect(save).toBeEnabled();
  await userEvent.click(save);
  expect(screen.getByRole("button", { name: "Editar regla 1" })).toHaveAttribute("aria-expanded", "true");
  const addAction = region.getByRole("button", { name: "Agregar acción" });
  expect(addAction).toHaveAttribute("aria-invalid", "true");
  expect(addAction).toHaveAccessibleDescription("Completá este dato.");
  await waitFor(() => expect(addAction).toHaveFocus());
  await userEvent.click(addAction);
  const message = region.getByRole("textbox", { name: "Mensaje" });
  expect(message).toHaveAttribute("aria-invalid", "true");
  expect(message).toHaveAccessibleDescription("Con «Agregar dato», el mensaje lleva el número o lo que respondieron. Debajo se ve cómo llega, con datos de ejemplo. Completá este dato.");
  await writeAtEnd(message, "Recibimos tu respuesta.");
  expect(message).not.toHaveAttribute("aria-invalid");
  expect(region.queryByText("Completá este dato.")).not.toBeInTheDocument();
  expect(save).toBeEnabled();
  expect(writes).not.toHaveBeenCalled();
});
it("does not mark the empty message of a new action before trying to save and then focuses it", async () => {
  setup();
  const writes = vi.fn();
  server.use(http.post("/api/forms/definitions/:id/rules", () => { writes(); return HttpResponse.json(initial()); }));
  renderWithProviders(<FormRulesSection prefix="VIS" definitionId={id} definitionRevision={1} scope={scope} onDirtyChange={vi.fn()}/>);
  await userEvent.click(await screen.findByRole("button", { name: "Agregar regla" }));
  const region = within(screen.getByRole("region", { name: "Regla 1" }));
  await userEvent.click(region.getByRole("button", { name: "Agregar acción" }));
  const message = region.getByRole("textbox", { name: "Mensaje" });
  expect(message).not.toHaveAttribute("aria-invalid");
  expect(region.queryByText("Completá este dato.")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Guardar reglas" }));
  expect(message).toHaveAttribute("aria-invalid", "true");
  expect(message).toHaveAccessibleDescription("Con «Agregar dato», el mensaje lleva el número o lo que respondieron. Debajo se ve cómo llega, con datos de ejemplo. Completá este dato.");
  await waitFor(() => expect(message).toHaveFocus());
  expect(writes).not.toHaveBeenCalled();
});
it("focuses the first question of conditions to review after trying to save", async () => {
  setup(); const fieldId = crypto.randomUUID();
  serveRules([storedRule()]);
  server.use(http.get("/api/forms/definitions/:id/rules/options", () => HttpResponse.json({ definitionId: id, name: { es: "Visita" }, originalCulture: "es", questions: [{ fieldId, key: "field_" + fieldId.replaceAll("-", ""), type: "decimal", label: { es: "Importe" }, help: null, required: false, maxLength: null, options: null }], conditionChoices: {}, roles: [] })));
  renderWithProviders(<FormRulesSection prefix="VIS" definitionId={id} definitionRevision={1} scope={scope} onDirtyChange={vi.fn()}/>);
  await userEvent.click(await screen.findByRole("button", { name: "Editar regla 1" }));
  await userEvent.click(screen.getByRole("button", { name: "Agregar condición" }));
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "Condición" }), "gte");
  expect(screen.queryByText("Revisá los valores de las condiciones.")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Guardar reglas" }));
  const question = screen.getByRole("combobox", { name: "Pregunta" });
  expect(question).toHaveAccessibleDescription("Revisá los valores de las condiciones.");
  await waitFor(() => expect(question).toHaveFocus());
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
  renderWithProviders(<FormRulesSection prefix="VIS" definitionId={id} definitionRevision={1} scope={scope} onDirtyChange={vi.fn()}/>);
  await userEvent.click(await screen.findByRole("button", { name: "Editar regla 1" }));
  await writeAtEnd(screen.getByRole("textbox", { name: "Mensaje" }), " propio");
  await userEvent.click(screen.getByRole("button", { name: "Guardar reglas" }));
  await userEvent.click(await screen.findByRole("button", { name: "Releer reglas" }));
  const keep = await screen.findByRole("button", { name: "Conservar mis cambios" });
  expect(screen.getByRole("button", {name:"Guardar reglas"})).toHaveAccessibleDescription("Releé y elegí qué conservar antes de guardar.");
  expect(screen.queryByText(/revisión 2/i)).not.toBeInTheDocument();
  await userEvent.click(keep);
  expect(messageText(screen.getByRole("textbox", { name: "Mensaje" }))).toBe("Mensaje guardado propio");
  expect(writes).toHaveLength(1);
  await userEvent.click(screen.getByRole("button", { name: "Guardar reglas" }));
  await waitFor(() => expect(writes).toHaveLength(2));
  expect(writes[1]).toEqual({ expectedRevision: 2, rules: [{ ...mine, actions: [{ ...mine.actions[0], text: { es: "Mensaje guardado propio" } }] }] });
  expect(screen.queryByText("Reglas de otra persona")).not.toBeInTheDocument();
});
it("returns focus from Done to the same rule and from removal to its surviving neighbor", async () => {
  setup(); serveRules([storedRule("Primera"), storedRule("Segunda")]);
  renderWithProviders(<FormRulesSection prefix="VIS" definitionId={id} definitionRevision={1} scope={scope} onDirtyChange={vi.fn()}/>);
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
  renderWithProviders(<FormRulesSection prefix="VIS" definitionId={id} definitionRevision={1} scope={scope} onDirtyChange={vi.fn()}/>);
  await userEvent.click(await screen.findByRole("button", { name: "Editar regla 1" }));
  await userEvent.click(screen.getByRole("button", { name: "Bajar acción 1" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Subir acción 2" })).toHaveFocus());
  expect(screen.getByRole("status")).toHaveTextContent("Acción 2: posición 2 de 2");
  expect(screen.getAllByRole("textbox", { name: "Mensaje" }).map(input => messageText(input))).toEqual(["Segundo aviso", "Mensaje guardado"]);
});
it("summarizes saved rule conditions with their shared readable values and operators", async () => {
  setup(); const fieldId = crypto.randomUUID(); const choiceId = crypto.randomUUID(); const rule = { ...storedRule(), conditions: [{ fieldId, operator: "in", values: [choiceId] }] };
  serveRules([rule]);
  server.use(http.get("/api/forms/definitions/:id/rules/options", () => HttpResponse.json({ definitionId: id, name: { es: "Visita" }, originalCulture: "es", questions: [{ fieldId, key: "field_" + fieldId.replaceAll("-", ""), type: "choice", label: { es: "Cliente" }, help: null, required: true, maxLength: null, options: null, source: { catalog: actor } }], conditionChoices: { [fieldId]: [{ id: choiceId, label: "Cliente elegido" }] }, roles: [] })));
  renderWithProviders(<FormRulesSection prefix="VIS" definitionId={id} definitionRevision={1} scope={scope} onDirtyChange={vi.fn()}/>);
  const value = await screen.findByText("Cliente elegido");
  expect(value.closest("li")).toHaveTextContent("Cliente es Cliente elegido");
  expect(value.closest("dd")?.previousElementSibling).toHaveTextContent("Si");
});
it("shows rule history change counts and order without loading each revision", async () => {
  setup(); let details = 0;
  server.use(http.get("/api/forms/definitions/:id/rules/revisions", () => HttpResponse.json({ items: [{ id: actor, revision: 2, createdAtUtc: "2026-10-17T12:00:00Z", author: null, hasApproval: false, changes: { addedRules: 1, updatedRules: 2, removedRules: 1, orderChanged: true } }], page: 1, pageSize: 10, totalCount: 1, totalPages: 1, hasPrevious: false, hasNext: false })),
    http.get("/api/forms/definitions/:id/rules/revisions/:revision", () => { details++; return HttpResponse.json(initial()); }));
  renderWithProviders(<FormRulesSection prefix="VIS" definitionId={id} definitionRevision={1} scope={scope} onDirtyChange={vi.fn()}/>);
  const history = await screen.findByRole("button", { name: "Historial" });
  await waitFor(() => expect(history).toBeEnabled());
  await userEvent.click(history);
  await within(await screen.findByRole("dialog", { name: "Historial de las reglas" })).findByRole("button", { name: "Revisión 2" });
  expect(screen.getByText(/1 regla agregada/)).toBeVisible(); expect(screen.getByText(/2 reglas actualizadas/)).toBeVisible(); expect(screen.getByText(/1 regla quitada/)).toBeVisible(); expect(screen.getByText(/Cambió el orden/)).toBeVisible();
  expect(details).toBe(0);
});

const onlyApproved = "El PDF se adjunta sólo cuando se aprueba una respuesta.";
const pdfFirst = "Para adjuntarlo, «Armar el PDF» tiene que ir antes de este mensaje.";
it("keeps an attached PDF when the event changes, tells why under it and turns off only once unchecked", async () => {
  setup(); const notice = { ...newRuleAction("NotifyAuthor"), includePdf: true, text: { es: "Aviso" } }; const rule: FormRule = { id: actor, event: "Approved", conditions: [], actions: [newRuleAction("GeneratePdf"), notice] }; serveRules([rule]);
  const writes = vi.fn(); server.use(http.post("/api/forms/definitions/:id/rules", async ({request}) => { const body = await request.json() as {rules:FormRule[]}; writes(body); return HttpResponse.json({...initial(),id:actor,revision:2,rules:body.rules,createdAtUtc:"2026-10-17T12:00:00Z"}); }));
  renderWithProviders(<MemoryRouter><FormRulesSection prefix="VIS" definitionId={id} definitionRevision={1} scope={scope} onDirtyChange={vi.fn()}/></MemoryRouter>);
  await userEvent.click(await screen.findByRole("button",{name:"Editar regla 1"}));
  await userEvent.selectOptions(screen.getByRole("combobox",{name:"Cuándo"}),"Rejected");
  const attach = screen.getByRole("checkbox",{name:"Adjuntar el PDF"});
  // The choice stays and the reason is next to it right away, without trying to save; no button can fix the event.
  expect(attach).toBeChecked(); expect(attach).toBeEnabled();
  expect(screen.getByRole("alert")).toHaveTextContent(onlyApproved);
  expect(screen.queryByRole("button",{name:/«Armar el PDF»/})).not.toBeInTheDocument();
  await userEvent.click(attach);
  // Turned off, the box goes inside the wrapper of its reason: it is a new element.
  const off = screen.getByRole("checkbox",{name:"Adjuntar el PDF"});
  expect(off).not.toBeChecked(); expect(off).toBeDisabled();
  expect(off).toHaveAccessibleDescription(onlyApproved);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button",{name:"Quitar acción 1"}));
  await userEvent.click(screen.getByRole("button",{name:"Guardar reglas"}));
  await waitFor(()=>expect(writes).toHaveBeenCalledOnce());
  expect(writes).toHaveBeenCalledWith({expectedRevision:1,rules:[{...rule,event:"Rejected",actions:[{...notice,includePdf:false}]}]});
});
it("returns focus from action removal to a neighbor and then to Add action", async () => {
  setup();const first=storedRule();const rule={...first,actions:[...first.actions,{...newRuleAction("NotifyAuthor"),text:{es:"Segundo aviso"}}]};serveRules([rule]);
  renderWithProviders(<FormRulesSection prefix="VIS" definitionId={id} definitionRevision={1} scope={scope} onDirtyChange={vi.fn()}/>);
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
  renderWithProviders(<FormRulesSection prefix="VIS" definitionId={id} definitionRevision={1} scope={scope} onDirtyChange={vi.fn()}/>);
  await userEvent.click(await screen.findByRole("button",{name:"Editar regla 1"}));
  await userEvent.click(screen.getByRole("button",{name:"Quitar condición 1"}));
  const remaining=screen.getByRole("combobox",{name:"Pregunta"});expect(remaining).toHaveValue(second);
  await waitFor(()=>expect(remaining).toHaveFocus());
  await userEvent.click(screen.getByRole("button",{name:"Quitar condición 1"}));
  await waitFor(()=>expect(screen.getByRole("button",{name:"Agregar condición"})).toHaveFocus());
});
it.each([["remove","Quitar acción 1","Agregar «Armar el PDF» antes"],["move","Bajar acción 1","Subir «Armar el PDF»"]] as const)("keeps the attachment when its PDF stops coming first and puts the PDF back before it with one button: %s", async (_, change, fix) => {
  setup();const notice={...newRuleAction("NotifyAuthor"),includePdf:true,text:{es:"Aviso"}};const pdf=newRuleAction("GeneratePdf");const rule:FormRule={...storedRule(),event:"Approved",actions:[pdf,notice]};serveRules([rule]);
  renderWithProviders(<MemoryRouter><FormRulesSection prefix="VIS" definitionId={id} definitionRevision={1} scope={scope} onDirtyChange={vi.fn()}/></MemoryRouter>);
  await userEvent.click(await screen.findByRole("button",{name:"Editar regla 1"}));
  await userEvent.click(screen.getByRole("button",{name:change}));
  expect(screen.getByRole("checkbox",{name:"Adjuntar el PDF"})).toBeChecked();
  expect(screen.getByRole("alert")).toHaveTextContent(pdfFirst);
  await userEvent.click(screen.getByRole("button",{name:fix}));
  expect(screen.getByRole("combobox",{name:"Acción 1"})).toHaveValue("GeneratePdf");
  expect(screen.getByRole("combobox",{name:"Acción 2"})).toHaveValue("NotifyAuthor");
  const attach=screen.getByRole("checkbox",{name:"Adjuntar el PDF"});
  expect(attach).toBeChecked(); expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  await waitFor(()=>expect(attach).toHaveFocus());
});
it("tells right away why a checked attachment needs a PDF before it, without trying to save", async () => {
  setup();
  renderWithProviders(<MemoryRouter><FormRulesSection prefix="VIS" definitionId={id} definitionRevision={1} scope={scope} onDirtyChange={vi.fn()}/></MemoryRouter>);
  await userEvent.click(await screen.findByRole("button",{name:"Agregar regla"}));
  await userEvent.selectOptions(screen.getByRole("combobox",{name:"Cuándo"}),"Approved");
  await userEvent.click(screen.getByRole("button",{name:"Agregar acción"}));
  await userEvent.click(screen.getByRole("checkbox",{name:"Adjuntar el PDF"}));
  expect(screen.getByRole("alert")).toHaveTextContent(pdfFirst);
  await userEvent.click(screen.getByRole("button",{name:"Agregar «Armar el PDF» antes"}));
  expect(screen.getByRole("combobox",{name:"Acción 1"})).toHaveValue("GeneratePdf");
  expect(screen.getByRole("checkbox",{name:"Adjuntar el PDF"})).toBeChecked();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
it("keeps the written message and the chosen role when an action changes kind", async () => {
  setup();const rule:FormRule={...storedRule("Aviso escrito")};serveRules([rule]);
  renderWithProviders(<MemoryRouter><FormRulesSection prefix="VIS" definitionId={id} definitionRevision={1} scope={scope} onDirtyChange={vi.fn()}/></MemoryRouter>);
  await userEvent.click(await screen.findByRole("button",{name:"Editar regla 1"}));
  const kind=screen.getByRole("combobox",{name:"Acción 1"});
  await userEvent.selectOptions(kind,"NotifyRole");
  expect(messageText(screen.getByRole("textbox",{name:"Mensaje"}))).toBe("Aviso escrito");
  await userEvent.selectOptions(screen.getByRole("combobox",{name:"Rol"}),actor);
  await userEvent.selectOptions(kind,"GeneratePdf");
  expect(screen.queryByRole("textbox",{name:"Mensaje"})).not.toBeInTheDocument();
  await userEvent.selectOptions(kind,"RequestApproval");
  expect(screen.getByRole("combobox",{name:"Rol"})).toHaveValue(actor);
  await userEvent.selectOptions(kind,"NotifyAuthor");
  expect(messageText(screen.getByRole("textbox",{name:"Mensaje"}))).toBe("Aviso escrito");
});
it("requires a new reread after a second conflict instead of reusing the previous current revision", async () => {
  setup();const mine=storedRule();let revision=1;const writes:unknown[]=[];
  server.use(http.get("/api/forms/definitions/:id/rules",()=>HttpResponse.json({...initial(),id:actor,revision,rules:revision===1?[mine]:[storedRule("Actual")],createdAtUtc:"2026-10-17T12:00:00Z"})),http.post("/api/forms/definitions/:id/rules",async({request})=>{writes.push(await request.json());revision++;return HttpResponse.json({code:"Forms.Rules.RevisionConflict"},{status:409});}));
  renderWithProviders(<FormRulesSection prefix="VIS" definitionId={id} definitionRevision={1} scope={scope} onDirtyChange={vi.fn()}/>);
  await userEvent.click(await screen.findByRole("button",{name:"Editar regla 1"}));await writeAtEnd(screen.getByRole("textbox",{name:"Mensaje"})," propio");
  await userEvent.click(screen.getByRole("button",{name:"Guardar reglas"}));await userEvent.click(await screen.findByRole("button",{name:"Releer reglas"}));await userEvent.click(await screen.findByRole("button",{name:"Conservar mis cambios"}));
  await userEvent.click(screen.getByRole("button",{name:"Guardar reglas"}));await screen.findByRole("button",{name:"Releer reglas"});
  expect(screen.queryByRole("button",{name:"Conservar mis cambios"})).not.toBeInTheDocument();expect(screen.queryByRole("button",{name:"Usar la revisión actual"})).not.toBeInTheDocument();
  expect(messageText(screen.getByRole("textbox",{name:"Mensaje"}))).toBe("Mensaje guardado propio");
  await userEvent.click(screen.getByRole("button",{name:"Releer reglas"}));await screen.findByRole("button",{name:"Conservar mis cambios"});
  expect(writes).toEqual([{expectedRevision:1,rules:[{...mine,actions:[{...mine.actions[0],text:{es:"Mensaje guardado propio"}}]}]},{expectedRevision:2,rules:[{...mine,actions:[{...mine.actions[0],text:{es:"Mensaje guardado propio"}}]}]}]);
});
it("puts a conflict in its own titled surface with reread and the choices at the right of its header", async () => {
  setup(); const mine = storedRule(); let revision = 1;
  server.use(http.get("/api/forms/definitions/:id/rules", () => HttpResponse.json({ ...initial(), id: actor, revision, rules: revision === 1 ? [mine] : [storedRule("Actual")], createdAtUtc: "2026-10-17T12:00:00Z" })),
    http.post("/api/forms/definitions/:id/rules", () => { revision = 2; return HttpResponse.json({ code: "Forms.Rules.RevisionConflict" }, { status: 409 }); }));
  renderWithProviders(<FormRulesSection prefix="VIS" definitionId={id} definitionRevision={1} scope={scope} onDirtyChange={vi.fn()}/>);
  await userEvent.click(await screen.findByRole("button", { name: "Editar regla 1" }));
  await writeAtEnd(screen.getByRole("textbox", { name: "Mensaje" }), " propio");
  await userEvent.click(screen.getByRole("button", { name: "Guardar reglas" }));
  const review = await screen.findByRole("region", { name: "Revisión de las reglas" });
  const band = within(review).getByRole("heading", { name: "Revisión de las reglas" }).parentElement!;
  expect(within(band).getAllByRole("button").map(button => button.textContent)).toEqual(["Releer reglas"]);
  expect(within(review).getByRole("alert")).toHaveTextContent("Las reglas cambiaron. Releé la revisión actual para revisarla.");
  await userEvent.click(within(band).getByRole("button", { name: "Releer reglas" }));
  await waitFor(() => expect(within(band).getAllByRole("button").map(button => button.textContent)).toEqual(["Releer reglas", "Usar la revisión actual", "Conservar mis cambios"]));
  const rules = bandOf("Cuando llega una respuesta");
  expect(within(rules).getAllByRole("button").map(button => button.getAttribute("aria-label") ?? button.textContent)).toEqual(["Más información sobre Cuando llega una respuesta", "Historial", "Agregar regla", "Guardar reglas"]);
  await userEvent.click(within(band).getByRole("button", { name: "Conservar mis cambios" }));
  expect(screen.queryByRole("region", { name: "Revisión de las reglas" })).not.toBeInTheDocument();
  expect(messageText(screen.getByRole("textbox", { name: "Mensaje" }))).toBe("Mensaje guardado propio");
});

it("tells the server cooldown, not an in-flight save, as the disabled reason once without discarding the draft", async () => {
  setup();serveRules([storedRule()]);let release!:()=>void;const pending=new Promise<void>(resolve=>{release=resolve;});
  server.use(http.post("/api/forms/definitions/:id/rules",async()=>{await pending;return HttpResponse.json({code:"RateLimit.Exceeded",detail:"Esperá antes de volver a guardar.",retryAfter:60},{status:429});}));
  renderWithProviders(<FormRulesSection prefix="VIS" definitionId={id} definitionRevision={1} scope={scope} onDirtyChange={vi.fn()}/>);
  await userEvent.click(await screen.findByRole("button",{name:"Editar regla 1"}));await writeAtEnd(screen.getByRole("textbox",{name:"Mensaje"})," propio");
  await userEvent.click(screen.getByRole("button",{name:"Guardar reglas"}));
  const saving=screen.getByRole("button",{name:"Guardando reglas…"});expect(saving).toBeDisabled();expect(saving).toHaveAttribute("aria-busy","true");expect(saving).not.toHaveAccessibleDescription();
  await act(async()=>{release();});const save=await screen.findByRole("button",{name:"Guardar reglas"});
  expect(save).toBeDisabled();expect(save).toHaveAccessibleDescription(/Esperá [0-9]+ segundos para volver a intentar./);
  expect(screen.getAllByText(/Esperá [0-9]+ segundos para volver a intentar./)).toHaveLength(1);
  expect(messageText(screen.getByRole("textbox",{name:"Mensaje"}))).toBe("Mensaje guardado propio");
});


it("clears the previous condition values when changing its question and saves only the new condition", async () => {
  setup(); const decimalId = crypto.randomUUID(); const textId = crypto.randomUUID();
  serveRules([{ ...storedRule(), conditions: [{ fieldId: decimalId, operator: "gte", values: ["12"] }] }]);
  server.use(http.get("/api/forms/definitions/:id/rules/options", () => HttpResponse.json({ definitionId: id, name: { es: "Visita" }, originalCulture: "es", questions: [
    { fieldId: decimalId, key: "field_" + decimalId.replaceAll("-", ""), type: "decimal", label: { es: "Importe" }, help: null, required: false, maxLength: null, options: null },
    { fieldId: textId, key: "field_" + textId.replaceAll("-", ""), type: "shortText", label: { es: "Notas" }, help: null, required: false, maxLength: 80, options: null },
  ], conditionChoices: {}, roles: [] })));
  const writes = vi.fn();
  server.use(http.post("/api/forms/definitions/:id/rules", async ({ request }) => { const body = await request.json() as { rules: FormRule[] }; writes(body); return HttpResponse.json({ ...initial(), id: actor, revision: 2, rules: body.rules, createdAtUtc: "2026-10-17T12:00:00Z" }); }));
  renderWithProviders(<FormRulesSection prefix="VIS" definitionId={id} definitionRevision={1} scope={scope} onDirtyChange={vi.fn()}/>);
  await userEvent.click(await screen.findByRole("button", { name: "Editar regla 1" }));
  expect(screen.getByRole("textbox", { name: "Valor" })).toHaveValue("12");
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "Pregunta" }), textId);
  expect(screen.getByRole("combobox", { name: "Condición" })).toHaveValue("answered");
  expect(screen.queryByRole("textbox", { name: "Valor" })).not.toBeInTheDocument();
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "Condición" }), "contains");
  expect(screen.getByRole("textbox", { name: "Valor" })).toHaveValue("");
  await userEvent.type(screen.getByRole("textbox", { name: "Valor" }), "nueva nota");
  await userEvent.click(screen.getByRole("button", { name: "Guardar reglas" }));
  await waitFor(() => expect(writes).toHaveBeenCalledWith(expect.objectContaining({ rules: [expect.objectContaining({ conditions: [{ fieldId: textId, operator: "contains", values: ["nueva nota"] }] })] })));
});
it("edits a rule message in the menu language with the original as reference", async () => {
  setup(); serveRules([storedRule("Hola")]);
  const writes = vi.fn();
  server.use(http.post("/api/forms/definitions/:id/rules", async ({ request }) => { const body = await request.json() as { rules: FormRule[] }; writes(body); return HttpResponse.json({ ...initial(), id: actor, revision: 2, rules: body.rules, createdAtUtc: "2026-10-17T12:00:00Z" }); }));
  await act(async () => { await i18n.changeLanguage("en"); });
  try {
    renderWithProviders(<FormRulesSection prefix="VIS" definitionId={id} definitionRevision={1} scope={{ ...scope, culture: "en" }} onDirtyChange={vi.fn()}/>);
    await userEvent.click(await screen.findByRole("button", { name: "Edit rule 1" }));
    const message = screen.getByRole("textbox", { name: "Message" });
    expect(messageText(message)).toBe("");
    expect(message).toHaveAccessibleDescription("With “Add data”, the message carries the number or what was answered. Below you see how it arrives, with example data. Original (Spanish): Hola");
    expect(message).toHaveAttribute("aria-placeholder", "Untranslated");
    await writeAtEnd(message, "Hello");
    await userEvent.click(screen.getByRole("button", { name: "Save rules" }));
    await waitFor(() => expect(writes).toHaveBeenCalledWith(expect.objectContaining({ rules: [expect.objectContaining({ actions: [expect.objectContaining({ text: { es: "Hola", en: "Hello" } })] })] })));
  } finally { await act(async () => { await i18n.changeLanguage("es"); }); }
});
it("shows a save error of the translation under the original message, with its language", async () => {
  setup(); serveRules([storedRule("Hola")]);
  server.use(http.post("/api/forms/definitions/:id/rules", () => HttpResponse.json({ code: "General.Validation", errors: { "rules[0].actions[0].text.en": ["El texto es demasiado largo."] } }, { status: 400 })));
  renderWithProviders(<FormRulesSection prefix="VIS" definitionId={id} definitionRevision={1} scope={scope} onDirtyChange={vi.fn()}/>);
  await userEvent.click(await screen.findByRole("button", { name: "Editar regla 1" }));
  const message = screen.getByRole("textbox", { name: "Mensaje" });
  expect(message).toHaveAccessibleDescription("Con «Agregar dato», el mensaje lleva el número o lo que respondieron. Debajo se ve cómo llega, con datos de ejemplo.");
  expect(message).not.toHaveAttribute("aria-placeholder");
  await writeAtEnd(message, ", ¿cómo estás?");
  await userEvent.click(screen.getByRole("button", { name: "Guardar reglas" }));
  await waitFor(() => expect(message).toHaveAttribute("aria-invalid", "true"));
  expect(message).toHaveAccessibleDescription("Con «Agregar dato», el mensaje lleva el número o lo que respondieron. Debajo se ve cómo llega, con datos de ejemplo. En inglés: El texto es demasiado largo.");
  await waitFor(() => expect(message).toHaveFocus());
  expect(notify).not.toHaveBeenCalled();
});
// A limit or a rule that is not obvious is the reason of the disabled add button: tooltip and accessible description.
it("explains why no action can follow an approval request", async () => {
  setup();
  renderWithProviders(<FormRulesSection prefix="VIS" definitionId={id} definitionRevision={1} scope={scope} onDirtyChange={vi.fn()}/>);
  await userEvent.click(await screen.findByRole("button", { name: "Agregar regla" }));
  await userEvent.click(screen.getByRole("button", { name: "Agregar acción" }));
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "Acción 1" }), "RequestApproval");
  const addAction = screen.getByRole("button", { name: "Agregar acción" });
  const reason = "Pedir aprobación tiene que ser la última acción. Lo que sigue va en «Se aprueba» o «Se rechaza».";
  expect(addAction).toBeDisabled();
  expect(addAction).toHaveAccessibleDescription(reason);
  await userEvent.hover(addAction);
  expect(await screen.findByRole("tooltip")).toHaveTextContent(reason);
});
it("explains the limits of rules and of actions in a rule", async () => {
  setup();
  const full = { ...storedRule(), actions: Array.from({ length: 10 }, () => ({ ...newRuleAction("NotifyAuthor"), text: { es: "Hola" } })) };
  serveRules([full, ...Array.from({ length: 19 }, () => storedRule())]);
  renderWithProviders(<FormRulesSection prefix="VIS" definitionId={id} definitionRevision={1} scope={scope} onDirtyChange={vi.fn()}/>);
  const addRule = await screen.findByRole("button", { name: "Agregar regla" });
  expect(addRule).toBeDisabled();
  expect(addRule).toHaveAccessibleDescription("Se alcanzó el límite.");
  await userEvent.click(screen.getByRole("button", { name: "Editar regla 1" }));
  const addAction = screen.getByRole("button", { name: "Agregar acción" });
  expect(addAction).toBeDisabled();
  expect(addAction).toHaveAccessibleDescription("Se alcanzó el límite.");
});
// «Agregar condición» (shared with suggestions) also gives its reason: a form without questions or the limit of conditions.
it("explains why a condition cannot be added to a form without questions", async () => {
  setup();
  renderWithProviders(<FormRulesSection prefix="VIS" definitionId={id} definitionRevision={1} scope={scope} onDirtyChange={vi.fn()}/>);
  await userEvent.click(await screen.findByRole("button", { name: "Agregar regla" }));
  const addCondition = screen.getByRole("button", { name: "Agregar condición" });
  expect(addCondition).toBeDisabled();
  expect(addCondition).toHaveAccessibleDescription("El formulario todavía no tiene preguntas.");
  await userEvent.hover(addCondition);
  expect(await screen.findByRole("tooltip")).toHaveTextContent("El formulario todavía no tiene preguntas.");
});
it("explains the limit of conditions in a rule", async () => {
  setup(); const fieldId = crypto.randomUUID();
  serveRules([{ ...storedRule(), conditions: Array.from({ length: 10 }, () => ({ fieldId, operator: "answered", values: [] })) }]);
  server.use(http.get("/api/forms/definitions/:id/rules/options", () => HttpResponse.json({ definitionId: id, name: { es: "Visita" }, originalCulture: "es", questions: [{ fieldId, key: "field_" + fieldId.replaceAll("-", ""), type: "decimal", label: { es: "Importe" }, help: null, required: false, maxLength: null, options: null }], conditionChoices: {}, roles: [] })));
  renderWithProviders(<FormRulesSection prefix="VIS" definitionId={id} definitionRevision={1} scope={scope} onDirtyChange={vi.fn()}/>);
  await userEvent.click(await screen.findByRole("button", { name: "Editar regla 1" }));
  const addCondition = screen.getByRole("button", { name: "Agregar condición" });
  expect(addCondition).toBeDisabled();
  expect(addCondition).toHaveAccessibleDescription("Se alcanzó el límite.");
  await userEvent.hover(addCondition);
  expect(await screen.findByRole("tooltip")).toHaveTextContent("Se alcanzó el límite.");
});

// Each control has its own sign (2026-10-31): rereading and opening a revision say so on themselves, and Save says it saves
// only while it saves.
it("rereads with its own sign without making Save say it saves", async () => {
  setup(); serveRules([storedRule()]);
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  server.use(http.post("/api/forms/definitions/:id/rules", () => HttpResponse.json({ code: "Forms.Rules.RevisionConflict" }, { status: 409 })));
  renderWithProviders(<FormRulesSection prefix="VIS" definitionId={id} definitionRevision={1} scope={scope} onDirtyChange={vi.fn()}/>);
  await userEvent.click(await screen.findByRole("button", { name: "Editar regla 1" }));
  await writeAtEnd(screen.getByRole("textbox", { name: "Mensaje" }), " propio");
  await userEvent.click(screen.getByRole("button", { name: "Guardar reglas" }));
  const reread = await screen.findByRole("button", { name: "Releer reglas" });
  server.use(http.get("/api/forms/definitions/:id/rules", async () => { await gate; return HttpResponse.json({ ...initial(), id: actor, revision: 2, rules: [storedRule("Actual")], createdAtUtc: "2026-10-17T12:00:00Z" }); }));
  await userEvent.click(reread);
  const rereading = await screen.findByRole("button", { name: "Releyendo…" });
  expect(rereading).toHaveAttribute("aria-busy", "true");
  expect(screen.getByRole("button", { name: "Guardar reglas" })).not.toHaveAttribute("aria-busy");
  expect(screen.queryByRole("button", { name: "Guardando reglas…" })).not.toBeInTheDocument();
  await act(async () => release());
  expect(await screen.findByRole("button", { name: "Usar la revisión actual" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Releer reglas" })).not.toHaveAttribute("aria-busy");
});

it("opens a revision with its own sign without making Save say it saves", async () => {
  setup();
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  server.use(http.get("/api/forms/definitions/:id/rules/revisions", () => HttpResponse.json({ items: [{ id: actor, revision: 1, createdAtUtc: "2026-10-16T12:00:00Z", author: null, hasApproval: false, changes: { addedRules: 1, updatedRules: 0, removedRules: 0, orderChanged: false } }], page: 1, pageSize: 10, totalCount: 1, totalPages: 1, hasPrevious: false, hasNext: false })),
    http.get("/api/forms/definitions/:id/rules/revisions/:revision", async () => { await gate; return HttpResponse.json({ ...initial(), id: actor, revision: 1, createdAtUtc: "2026-10-16T12:00:00Z", rules: [] }); }));
  renderWithProviders(<FormRulesSection prefix="VIS" definitionId={id} definitionRevision={1} scope={scope} onDirtyChange={vi.fn()}/>);
  const history = await screen.findByRole("button", { name: "Historial" });
  await waitFor(() => expect(history).toBeEnabled());
  await userEvent.click(history);
  const panel = await screen.findByRole("dialog", { name: "Historial de las reglas" });
  const trigger = within(panel).getByRole("button", { name: "Revisión 1" });
  await userEvent.click(trigger);
  await waitFor(() => expect(trigger).toHaveAttribute("aria-busy", "true"));
  expect(screen.getByRole("button", { name: "Guardar reglas", hidden: true })).not.toHaveAttribute("aria-busy");
  expect(screen.queryByRole("button", { name: "Guardando reglas…", hidden: true })).not.toBeInTheDocument();
  await act(async () => release());
  expect(await within(panel).findByRole("heading", { name: "Revisión 1" })).toBeInTheDocument();
});

// No notes in the rules (2026-10-31): that they are saved apart is the (i) of the title, the conditions and the message have
// their (i), the PDF action keeps only «Ver el diseño» and the history has no note under it.
it("explains the rules in their (i) instead of notes", async () => {
  setup(); serveRules([{ id: crypto.randomUUID(), event: "Approved", conditions: [], actions: [newRuleAction("GeneratePdf"), { ...newRuleAction("NotifyAuthor"), text: { es: "Hola" } }] }]);
  renderWithProviders(<MemoryRouter><FormRulesSection prefix="VIS" definitionId={id} definitionRevision={1} scope={scope} onDirtyChange={vi.fn()}/></MemoryRouter>);
  await userEvent.click(await screen.findByRole("button", { name: "Editar regla 1" }));
  const hidden = { ignore: "script, style, [hidden]" };
  expect(screen.queryByText(rulesHelp, hidden)).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Más información sobre Cuando llega una respuesta" })).toHaveAccessibleDescription(rulesHelp);
  const always = "Sin condición, la regla corre siempre. Las condiciones usan las preguntas del formulario.";
  expect(screen.queryByText(always, hidden)).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Más información sobre Si (opcional)" })).toHaveAccessibleDescription(always);
  expect(screen.queryByText("Armar el PDF con el diseño vigente.")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Ver el diseño" })).toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "Mensaje" })).toHaveAccessibleDescription("Con «Agregar dato», el mensaje lleva el número o lo que respondieron. Debajo se ve cómo llega, con datos de ejemplo.");
  expect(screen.queryByText("Con «Agregar dato», el mensaje lleva el número o lo que respondieron. Debajo se ve cómo llega, con datos de ejemplo.", hidden)).not.toBeInTheDocument();
  expect(screen.queryByText("Cada respuesta recuerda con qué revisión se procesó. Los cambios se aplican a las respuestas nuevas.")).not.toBeInTheDocument();
  expect(await screen.findByText("Todavía no hay revisiones.")).toBeInTheDocument();
});

// Board HI1-A: no column with an empty history; «Historial» is off with its reason until there is a revision.
it("keeps «Historial» off with its reason while there are no revisions", async () => {
  setup();
  renderWithProviders(<FormRulesSection prefix="VIS" definitionId={id} definitionRevision={1} scope={scope} onDirtyChange={vi.fn()}/>);
  const history = await screen.findByRole("button", { name: "Historial" });
  await waitFor(() => expect(history).toBeDisabled());
  expect(history).toHaveAccessibleDescription(noRevisions);
  expect(screen.queryByRole("heading", { name: "Historial de las reglas" })).not.toBeInTheDocument();
  await userEvent.hover(history);
  expect(await screen.findByRole("tooltip")).toHaveTextContent(noRevisions);
});

// Board TL2-A: each rule reads in rows with their label (when, if, do); the role and the PDF go after the action, and the
// message goes whole in its box, with the data it brings marked.
it("reads a rule by when, if and do, with the role, the PDF and the whole message", async () => {
  setup(); const fieldId = crypto.randomUUID(), lot = crypto.randomUUID();
  serveRules([{ id: crypto.randomUUID(), event: "Approved", conditions: [{ fieldId, operator: "gte", values: ["50"] }], actions: [
    { ...newRuleAction("NotifyRole"), roleId: actor, text: { es: "Revisá {número}" } },
    { ...newRuleAction("GeneratePdf") },
    { ...newRuleAction("NotifyAuthor"), includePdf: true, text: { es: `Se aprobó tu registro {número} del {${lot}}` } }] }]);
  server.use(http.get("/api/forms/definitions/:id/rules/options", () => HttpResponse.json({ definitionId: id, name: { es: "Visita" }, originalCulture: "es", questions: [
    { fieldId, key: "field_" + fieldId.replaceAll("-", ""), type: "decimal", label: { es: "Hectáreas aplicadas" }, help: null, required: true, maxLength: null, options: null },
    { fieldId: lot, key: "field_" + lot.replaceAll("-", ""), type: "shortText", label: { es: "Lote" }, help: null, required: true, maxLength: 80, options: null }], conditionChoices: {}, roles: [{ id: actor, name: "Agrónomo" }] })));
  renderWithProviders(<FormRulesSection prefix="VIS" definitionId={id} definitionRevision={1} scope={scope} onDirtyChange={vi.fn()}/>);
  const rule = await screen.findByRole("region", { name: "Regla 1" });
  expect([...rule.querySelectorAll("dt")].map(term => term.textContent)).toEqual(["Cuándo", "Si", "Hacer"]);
  expect(within(rule).getByText("Se aprueba una respuesta")).toBeVisible();
  expect(within(rule).getByText("50").closest("li")).toHaveTextContent("Hectáreas aplicadas desde 50");
  const actions = [...rule.querySelectorAll("ol > li")];
  expect(actions.map(item => item.textContent)).toEqual([
    "1Avisar a las personas con un rol · AgrónomoRevisá Número",
    "2Armar el PDF",
    "3Mandarle un mensaje a quien la cargó · con el PDFSe aprobó tu registro Número del Lote"]);
  expect(within(rule).getAllByText("Número")).toHaveLength(2);
  expect(within(rule).getByText("Lote")).toBeVisible();
});

// Board MD1-A: the data of a message are tags with the current name of their question, «Así llega» shows the message with
// example data, and a question that is no longer in the form is told before saving.
const supplier = "0199a0c0-0000-7000-8000-000000000031";
function serveSupplier(label: string) {
  server.use(http.get("/api/forms/definitions/:id/rules/options", () => HttpResponse.json({ definitionId: id, name: { es: "Recepción" }, originalCulture: "es", questions: [
    { fieldId: supplier, key: "field_" + supplier.replaceAll("-", ""), type: "choice", label: { es: label, en: "Supplier" }, help: null, required: true, maxLength: null, options: [{ choiceId: crypto.randomUUID(), label: { es: "Distribuidora Norte", en: "North distributor" } }] }],
  conditionChoices: {}, roles: [{ id: actor, name: "Compras" }] })));
}
it("shows the data of a message with the current name of its question in the list and in the editor, with how it arrives", async () => {
  setup(); serveRules([storedRule(`Llegó con problemas lo de {${supplier}}. Revisá {número}.`)]); serveSupplier("Proveedor del remito");
  renderWithProviders(<FormRulesSection prefix="REC" definitionId={id} definitionRevision={1} scope={scope} onDirtyChange={vi.fn()}/>);
  const rule = await screen.findByRole("region", { name: "Regla 1" });
  expect(within(rule).getByText("Proveedor del remito")).toBeVisible();
  expect(rule.querySelector("ol > li")).toHaveTextContent("Llegó con problemas lo de Proveedor del remito. Revisá Número.");
  await userEvent.click(screen.getByRole("button", { name: "Editar regla 1" }));
  const message = screen.getByRole("textbox", { name: "Mensaje" });
  expect(messageText(message)).toBe("Llegó con problemas lo de Proveedor del remito. Revisá Número.");
  expect(screen.getByRole("figure", { name: "Así llega" })).toHaveTextContent("Llegó con problemas lo de Distribuidora Norte. Revisá REC-000001.");
});
it("does not save a message with a question that is no longer in the form and says so under it", async () => {
  setup(); const gone = crypto.randomUUID(); serveRules([storedRule(`Llegó {${gone}}`)]); serveSupplier("Proveedor");
  const writes = vi.fn();
  server.use(http.post("/api/forms/definitions/:id/rules", () => { writes(); return HttpResponse.json(initial()); }));
  renderWithProviders(<FormRulesSection prefix="REC" definitionId={id} definitionRevision={1} scope={scope} onDirtyChange={vi.fn()}/>);
  await userEvent.click(await screen.findByRole("button", { name: "Editar regla 1" }));
  const message = screen.getByRole("textbox", { name: "Mensaje" });
  expect(within(message).getByText("Pregunta no disponible")).toBeInTheDocument();
  await writeAtEnd(message, " hoy");
  await userEvent.click(screen.getByRole("button", { name: "Guardar reglas" }));
  await waitFor(() => expect(message).toHaveAttribute("aria-invalid", "true"));
  expect(message).toHaveAccessibleDescription(/Quitá el dato que ya no está en el formulario\.$/);
  expect(writes).not.toHaveBeenCalled();
});
it("shows the original with the names of its data while the message is translated", async () => {
  setup(); serveRules([storedRule(`Llegó {${supplier}}: {número}`)]); serveSupplier("Proveedor");
  await act(async () => { await i18n.changeLanguage("en"); });
  try {
    renderWithProviders(<FormRulesSection prefix="REC" definitionId={id} definitionRevision={1} scope={{ ...scope, culture: "en" }} onDirtyChange={vi.fn()}/>);
    await userEvent.click(await screen.findByRole("button", { name: "Edit rule 1" }));
    expect(screen.getByRole("textbox", { name: "Message" })).toHaveAccessibleDescription(/Original \(Spanish\): Llegó Proveedor: Número$/);
  } finally { await act(async () => { await i18n.changeLanguage("es"); }); }
});
