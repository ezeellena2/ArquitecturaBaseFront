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
import { CatalogFieldsSection } from "./CatalogFieldsSection";

// The detail and the 409 come unchanged from FormCatalogFieldInUseIntegrationTests: the uses PostgreSQL read from a form's draft and active version.
const cohort = httpCohort("manualCatalogs");
const detail = readCatalog(cohort.json("fields-usage-detail.json"));
const permissions = ["formcatalogs.read", "formcatalogs.manage", "formtemplates.read"] as const;
const [zone] = detail.fields!;
const form = zone!.usedBy[0]!.definitionId!, question = zone!.usedBy[0]!.questionId!;

function Harness({ errors = {}, feedback = null }: { errors?: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>; feedback?: ReturnType<typeof readCatalogFieldFeedback> }) {
  const [fields, setFields] = useState<readonly CatalogFieldDraft[]>(() => detail.fields!.map(field => openCatalogField(field, "es")));
  return <CatalogFieldsSection fields={fields} presentation={detail.presentation} culture="es" original={detail.originalCulture} scope={{ actorId: "editor", culture: "es", permissions }} readOnly={false} confirmedRemovals={[]} errors={errors} feedback={feedback} onChange={next => setFields(next)} />;
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
    await user.click(screen.getByRole("button", { name: "Quitar " + name }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("El campo está en uso. Sacá esos usos para poder quitarlo.")).toBeInTheDocument();
    const items = within(dialog).getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent(text);
    expect(within(items[0]!).getByRole("link", { name: "Ir a la pregunta «Proveedor» de Pedir repuesto" })).toHaveTextContent("Ir a la pregunta");
    expect(within(dialog).queryByRole("button", { name: "Quitar el campo" })).not.toBeInTheDocument();
    if (name === "kind") break;
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  }
  await user.click(within(screen.getByRole("dialog")).getByRole("link", { name: "Ir a la pregunta «Proveedor» de Pedir repuesto" }));
  expect(router.state.location.pathname).toBe("/formularios/" + form);
  expect(router.state.location.state).toEqual({ questionFieldId: question });
});

it("shows the catalog's own use of a field as its «En WhatsApp», not as a form", async () => {
  await mount(<Harness />);
  await userEvent.click(screen.getByRole("button", { name: "Quitar tax_id" }));
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).queryByRole("listitem")).not.toBeInTheDocument();
  expect(within(dialog).getByText("También se saca de «En WhatsApp» de este catálogo.")).toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: "Quitar el campo" })).toBeInTheDocument();
});

it("shows the uses of the real FieldInUse rejection next to the removed field, with its stage and link", async () => {
  const problem = cohort.json("fields-in-use.json") as { errors: Record<string, string[]> };
  const removed = detail.fields!.map((field, index) => ({ ...openCatalogField(field, "es"), isActive: index === 0 ? false : field.isActive }));
  // The page maps fields[0].isActive to the field the request sent first, as CatalogEditorPage does.
  const errors: Record<string, Record<string, readonly string[]>> = {};
  for (const issue of indexedValidationIssues(removed, problem.errors, "fields")) (errors[issue.localId] ??= {})[issue.relativePath] = issue.messages;
  expect(Object.keys(errors)).toEqual([zone!.id]);
  function Rejected() {
    const [fields, setFields] = useState<readonly CatalogFieldDraft[]>(removed);
    return <CatalogFieldsSection fields={fields} presentation={detail.presentation} culture="es" original={detail.originalCulture} scope={{ actorId: "editor", culture: "es", permissions }} readOnly={false} confirmedRemovals={[zone!.id]} errors={errors} feedback={readCatalogFieldFeedback(problem)} onChange={next => setFields(next)} />;
  }
  const router = await mount(<Rejected />);
  const alert = screen.getByRole("alert");
  expect(alert).toHaveTextContent(problem.errors["fields[0].isActive"]![0]!);
  expect(within(alert).getByRole("listitem")).toHaveTextContent("«Proveedor» en Pedir repuesto, en la versión activa y en el borrador");
  expect(screen.getByRole("button", { name: "Restaurar el campo" })).toBeInTheDocument();
  await userEvent.click(within(alert).getByRole("link", { name: "Ir a la pregunta «Proveedor» de Pedir repuesto" }));
  expect(router.state.location.pathname).toBe("/formularios/" + form);
  expect(router.state.location.state).toEqual({ questionFieldId: question });
});
