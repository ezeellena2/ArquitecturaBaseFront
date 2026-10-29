import { useState, type ReactElement } from "react";
import { RouterProvider, createMemoryRouter } from "react-router";
import { act, cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it } from "vitest";
import i18n from "@/shared/i18n";
import { httpCohort } from "@/test/httpCohort";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { readCatalogFieldFeedback } from "../api/catalogFieldFeedback";
import { readCatalog } from "../api/catalogResponse";
import { openCatalogField, type CatalogFieldDraft } from "../catalogFields";
import { indexedValidationIssues } from "../validationPaths";
import { CatalogFieldsDialog } from "./CatalogFieldsDialog";
import { CatalogFieldsButton, CatalogFieldsNotice } from "./CatalogFieldsNotice";

// The detail and the 409 come unchanged from FormCatalogFieldInUseIntegrationTests: the uses PostgreSQL read from a form's draft and active version.
const cohort = httpCohort("manualCatalogs");
const detail = readCatalog(cohort.json("fields-usage-detail.json"));
const permissions = ["formcatalogs.read", "formcatalogs.manage", "formtemplates.read"] as const;
const [zone] = detail.fields!;
const form = zone!.usedBy[0]!.definitionId!, question = zone!.usedBy[0]!.questionId!;

// As in the catalog editor: «Agregar campos» in the options header, the notice above the table and the modal while open.
function Harness({ initial = detail.fields!.map(field => openCatalogField(field, "es")), confirmedRemovals = [], errors = {}, feedback = null }: { initial?: readonly CatalogFieldDraft[]; confirmedRemovals?: readonly string[]; errors?: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>; feedback?: ReturnType<typeof readCatalogFieldFeedback> }) {
  const [fields, setFields] = useState<readonly CatalogFieldDraft[]>(initial);
  const [open, setOpen] = useState<{ fieldId: string | null } | null>(null);
  return <>
    <CatalogFieldsButton fields={fields} errors={errors} canManage onOpen={() => setOpen({ fieldId: null })} />
    <CatalogFieldsNotice fields={fields} errors={errors} feedback={feedback} culture="es" onReview={fieldId => setOpen({ fieldId })} />
    {open ? <CatalogFieldsDialog catalogName="Proveedores" fields={fields} presentation={detail.presentation} culture="es" original={detail.originalCulture} scope={{ actorId: "editor", culture: "es", permissions }} readOnly={false} confirmedRemovals={confirmedRemovals} errors={errors} feedback={feedback} initialFieldId={open.fieldId} onApply={next => setFields(next)} onClose={() => setOpen(null)} /> : null}
  </>;
}
// Opens the fields from «Agregar campos», chooses one and asks to remove it.
async function askToRemove(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole("button", { name: /^Agregar campos/ }));
  await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Editar " + name }));
  await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Quitar campo" }));
  return screen.getByRole("dialog", { name: "Quitar «" + name + "»" });
}
async function mount(element: ReactElement) {
  const router = createMemoryRouter([
    { path: "/catalogos/:id", element },
    { path: "/formularios/:id", element: <p>Formulario</p> },
  ], { initialEntries: ["/catalogos/" + detail.id] });
  await act(async () => { renderWithProviders(<RouterProvider router={router} />); });
  return router;
}
beforeEach(async () => { await i18n.changeLanguage("es"); });
afterEach(() => { cleanup(); });

it("draws each real use of a field with its stage and the link to its question", async () => {
  const router = await mount(<Harness />);
  const user = userEvent.setup();
  for (const [name, text] of [["zone", "«Proveedor» en Pedir repuesto, en la versión activa y en el borrador"], ["kind", "«Proveedor» en Pedir repuesto, en la versión activa"]] as const) {
    const dialog = await askToRemove(user, name);
    expect(within(dialog).getByText("El campo está en uso. Sacá esos usos para poder quitarlo.")).toBeInTheDocument();
    const items = within(dialog).getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent(text);
    expect(within(items[0]!).getByRole("link", { name: "Ir a la pregunta «Proveedor» de Pedir repuesto" })).toHaveTextContent("Ir a la pregunta");
    expect(within(dialog).queryByRole("button", { name: "Quitar el campo" })).not.toBeInTheDocument();
    if (name === "kind") break;
    // Esc closes the confirmation and then the modal.
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Quitar «zone»" })).not.toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  }
  await user.click(within(screen.getByRole("dialog", { name: "Quitar «kind»" })).getByRole("link", { name: "Ir a la pregunta «Proveedor» de Pedir repuesto" }));
  expect(router.state.location.pathname).toBe("/formularios/" + form);
  expect(router.state.location.state).toEqual({ questionFieldId: question });
});

it("shows the catalog's own use of a field as its «En WhatsApp», not as a form", async () => {
  await mount(<Harness />);
  const dialog = await askToRemove(userEvent.setup(), "tax_id");
  expect(within(dialog).queryByRole("listitem")).not.toBeInTheDocument();
  expect(within(dialog).getByText("También se saca de «En WhatsApp» de este catálogo.")).toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: "Quitar el campo" })).toBeInTheDocument();
});

it("shows the uses of the real FieldInUse rejection with the removed field, with its stage and link", async () => {
  const problem = cohort.json("fields-in-use.json") as { errors: Record<string, string[]> };
  const removed = detail.fields!.map((field, index) => ({ ...openCatalogField(field, "es"), isActive: index === 0 ? false : field.isActive }));
  // The page maps fields[0].isActive to the field the request sent first, as CatalogEditorPage does.
  const errors: Record<string, Record<string, readonly string[]>> = {};
  for (const issue of indexedValidationIssues(removed, problem.errors, "fields")) (errors[issue.localId] ??= {})[issue.relativePath] = issue.messages;
  expect(Object.keys(errors)).toEqual([zone!.id]);
  const router = await mount(<Harness initial={removed} confirmedRemovals={[zone!.id]} errors={errors} feedback={readCatalogFieldFeedback(problem)} />);
  const notice = screen.getByRole("alert");
  expect(notice).toHaveTextContent(problem.errors["fields[0].isActive"]![0]!);
  await userEvent.click(within(notice).getByRole("button", { name: "Revisar" }));
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByText(problem.errors["fields[0].isActive"]![0]!)).toBeInTheDocument();
  expect(within(dialog).getByRole("listitem")).toHaveTextContent("«Proveedor» en Pedir repuesto, en la versión activa y en el borrador");
  expect(within(dialog).getByRole("button", { name: "Restaurar el campo" })).toBeInTheDocument();
  await userEvent.click(within(dialog).getByRole("link", { name: "Ir a la pregunta «Proveedor» de Pedir repuesto" }));
  expect(router.state.location.pathname).toBe("/formularios/" + form);
  expect(router.state.location.state).toEqual({ questionFieldId: question });
});
