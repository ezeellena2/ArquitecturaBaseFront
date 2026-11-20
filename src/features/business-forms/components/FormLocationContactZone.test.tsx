import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { deliveryDefinition, deliveryIds } from "@/test/visual/locationContactFixtures";
import { openDraftSession } from "../draftSession";
import type { CanonicalQuestion, DraftEditorValue, FormDefinitionSnapshot } from "../model";
import { FormLocationContactZone } from "./FormLocationContactZone";

// W3 (UC1-A): «Ubicación y contacto» in the editor of «Registrar entrega». Each row offers «Ninguna» and the text questions outside the
// block; the one another row took is off, saying what it receives; with a question «Ubicación» the location row is off with its reason.
function Harness({ definition, readOnly = false, onValue }: { definition: FormDefinitionSnapshot; readOnly?: boolean; onValue?: (value: DraftEditorValue) => void }) {
  const [value, setValue] = useState(() => openDraftSession({ actorId: "actor", editorId: "editor" }, definition).value);
  return <FormLocationContactZone value={value} onChange={next => { setValue(next); onValue?.(next); }} readOnly={readOnly} culture="es" />;
}
const ids = deliveryIds;
const guid = (n: number) => "01990000-0000-7000-8000-" + String(n).padStart(12, "0");
const key = (id: string) => "field_" + id.replaceAll("-", "");
// The items of a block, whose questions do not receive anything: they repeat.
const withBlock = (definition: FormDefinitionSnapshot): FormDefinitionSnapshot => ({ ...definition, draft: { ...definition.draft, fields: [...definition.draft.fields,
  { fieldId: guid(990), key: key(guid(990)), type: "group", label: { es: "Bultos" }, help: null, required: true, rows: { minRows: 1, maxRows: 5 } },
  { fieldId: guid(991), key: key(guid(991)), type: "shortText", label: { es: "Detalle del bulto" }, help: null, required: false, maxLength: 80, repeated: true }] as CanonicalQuestion[] } });
// «Observaciones» shows only when the delivery did not arrive complete (CO1-A): WhatsApp does not prefill it.
const withCondition = (definition: FormDefinitionSnapshot): FormDefinitionSnapshot => ({ ...definition, draft: { ...definition.draft, fields: [
  ...definition.draft.fields.filter(question => question.fieldId !== ids.notes),
  { fieldId: guid(992), key: key(guid(992)), type: "boolean", label: { es: "¿Llegó completo?" }, help: null, required: true },
  { ...definition.draft.fields.find(question => question.fieldId === ids.notes)!, showWhen: { questionId: guid(992), values: ["false"] } }] as CanonicalQuestion[] } });
// The options of a Picker as they read, with the reason after the name, and whether they are off; it opens the list and closes it.
const options = async (trigger: HTMLElement) => {
  const list = await openList(trigger);
  const text = (ids: string | null) => (ids ?? "").split(" ").filter(Boolean).map(id => document.getElementById(id)?.textContent ?? "").join(" ");
  const read = within(list).getAllByRole("option").map(option => {
    const reason = text(option.getAttribute("aria-describedby"));
    return [text(option.getAttribute("aria-labelledby")) + (reason ? " · " + reason : ""), option.getAttribute("aria-disabled") === "true"] as [string, boolean];
  });
  await userEvent.keyboard("{Escape}");
  return read;
};
const received = (value: DraftEditorValue | undefined) => value?.draft.fields.flatMap(question => "receives" in question && question.receives ? [[question.localId, question.receives]] : []);
afterEach(() => { vi.restoreAllMocks(); });

describe("the zone «Ubicación y contacto»", () => {
  it("shows one row per datum with «Ninguna» and the text questions outside the block, the ones another row took off with what they receive", async () => {
    renderWithProviders(<Harness definition={withBlock(deliveryDefinition("es"))} />);
    const zone = screen.getByRole("region", { name: "Ubicación y contacto" });
    const location = within(zone).getByRole("button", { name: "Ubicación Dirección de entrega (pregunta 1)" });
    expect(within(zone).getByRole("button", { name: "Nombre del contacto Recibió (pregunta 2)" })).toBeInTheDocument();
    expect(within(zone).getByRole("button", { name: "Teléfono del contacto Teléfono de quien recibe (pregunta 3)" })).toBeInTheDocument();
    // Neither the photo nor the question of the block is offered.
    expect(await options(location)).toEqual([["Ninguna", false], ["Dirección de entrega (pregunta 1)", false], ["Recibió (pregunta 2) · Recibe el nombre del contacto", true],
      ["Teléfono de quien recibe (pregunta 3) · Recibe el teléfono del contacto", true], ["Observaciones (pregunta 5)", false]]);
    expect((await options(within(zone).getByRole("button", { name: /^Teléfono del contacto / }))).map(([text]) => text)).toEqual(["Ninguna",
      "Dirección de entrega (pregunta 1) · Recibe la ubicación", "Recibió (pregunta 2) · Recibe el nombre del contacto", "Teléfono de quien recibe (pregunta 3)", "Observaciones (pregunta 5)"]);
    // How it works goes in the (i) of the title, never as a legend.
    await userEvent.hover(within(zone).getByRole("button", { name: "Más información sobre Ubicación y contacto" }));
    expect(await screen.findByRole("tooltip")).toHaveTextContent("La ubicación o el contacto que la persona comparte en el chat completan estas preguntas del formulario que tiene abierto");
  });

  it("does not offer a text question that shows by a condition, which WhatsApp does not prefill", async () => {
    renderWithProviders(<Harness definition={withCondition(deliveryDefinition("es"))} />);
    expect((await options(screen.getByRole("button", { name: /^Ubicación / }))).map(([text]) => text)).toEqual(["Ninguna", "Dirección de entrega (pregunta 1)",
      "Recibió (pregunta 2) · Recibe el nombre del contacto", "Teléfono de quien recibe (pregunta 3) · Recibe el teléfono del contacto"]);
  });

  it("does not offer a text question with the fixed validation of a library standard", async () => {
    const definition = deliveryDefinition("es");
    const taxId = { fieldId: guid(994), key: key(guid(994)), type: "shortText", label: { es: "CUIT de quien recibe" }, help: null, required: false, maxLength: 13, validation: "taxId" } as CanonicalQuestion;
    renderWithProviders(<Harness definition={{ ...definition, draft: { ...definition.draft, fields: [...definition.draft.fields, taxId] } }} />);
    const phones = await options(screen.getByRole("button", { name: /^Teléfono del contacto / }));
    expect(phones.map(([text]) => text)).not.toContain("CUIT de quien recibe (pregunta 6)");
    expect(phones).toHaveLength(5);
  });

  it("gives the datum to the question chosen, frees the one that had it, and «Ninguna» leaves it on none", async () => {
    const onValue = vi.fn();
    renderWithProviders(<Harness definition={deliveryDefinition("es")} onValue={onValue} />);
    const location = screen.getByRole("button", { name: /^Ubicación / });
    await pick(location, "Observaciones (pregunta 5)");
    expect(location).toHaveAccessibleName("Ubicación Observaciones (pregunta 5)");
    expect(received(onValue.mock.lastCall?.[0])).toEqual([[ids.receiver, "contactName"], [ids.phone, "contactPhone"], [ids.notes, "location"]]);
    // The other rows now offer the address, and the notes say what they receive.
    const names = await options(screen.getByRole("button", { name: /^Nombre del contacto / }));
    expect(names).toContainEqual(["Dirección de entrega (pregunta 1)", false]);
    expect(names).toContainEqual(["Observaciones (pregunta 5) · Recibe la ubicación", true]);
    await pick(/^Teléfono del contacto /, "Ninguna");
    expect(screen.getByRole("button", { name: "Teléfono del contacto Ninguna" })).toBeInTheDocument();
    expect(received(onValue.mock.lastCall?.[0])).toEqual([[ids.receiver, "contactName"], [ids.notes, "location"]]);
  });

  it("names a question still without a text by its number", async () => {
    const definition = deliveryDefinition("es");
    const blank = { fieldId: guid(993), key: key(guid(993)), type: "shortText", label: { es: "" }, help: null, required: false, maxLength: 80 } as CanonicalQuestion;
    renderWithProviders(<Harness definition={{ ...definition, draft: { ...definition.draft, fields: [...definition.draft.fields, blank] } }} />);
    expect((await options(screen.getByRole("button", { name: /^Ubicación / }))).at(-1)).toEqual(["Pregunta 6", false]);
  });

  it("with a question «Ubicación» still without a text, names it by its number, also in the reason", () => {
    const definition = deliveryDefinition("es", { location: true });
    const fields = definition.draft.fields.map(question => question.type === "location" ? { ...question, label: { es: "" } } : question);
    renderWithProviders(<Harness definition={{ ...definition, draft: { ...definition.draft, fields } }} />);
    const location = screen.getByRole("button", { name: "Ubicación Pregunta 6" });
    expect(location).toHaveAccessibleDescription("La ubicación va a la pregunta 6, que se pide antes de mandar el formulario.");
  });

  it("with a question «Ubicación», leaves the location row off with its reason above it, and the contact still chooses", async () => {
    renderWithProviders(<Harness definition={deliveryDefinition("es", { location: true })} />);
    const location = screen.getByRole("button", { name: "Ubicación Ubicación (pregunta 6)" });
    expect(location).toBeDisabled();
    // The row keeps its place and its shape: the reason opens over it, from its envelope, which the keyboard reaches.
    await userEvent.hover(screen.getByRole("group", { name: "Ubicación" }));
    expect(await screen.findByRole("tooltip")).toHaveTextContent("La ubicación va a la pregunta «Ubicación», que se pide antes de mandar el formulario.");
    expect(location).toHaveAccessibleDescription("La ubicación va a la pregunta «Ubicación», que se pide antes de mandar el formulario.");
    const name = screen.getByRole("button", { name: /^Nombre del contacto / });
    expect(name).toBeEnabled();
    // The question «Ubicación» receives nothing else.
    expect((await options(name)).map(([text]) => text)).toEqual(["Ninguna", "Dirección de entrega (pregunta 1)", "Recibió (pregunta 2)",
      "Teléfono de quien recibe (pregunta 3) · Recibe el teléfono del contacto", "Observaciones (pregunta 5)"]);
  });

  it("read only, says the question of each row or «Ninguna», without lists", () => {
    const definition = deliveryDefinition("es");
    const withoutPhone = { ...definition, draft: { ...definition.draft, fields: definition.draft.fields.map(question => question.fieldId === ids.phone
      ? (({ receives: _phone, ...rest }) => rest)(question as typeof question & { receives?: string }) as CanonicalQuestion : question) } };
    renderWithProviders(<Harness definition={withoutPhone} readOnly />);
    const zone = screen.getByRole("region", { name: "Ubicación y contacto" });
    expect(within(zone).queryAllByRole("button", { name: /^(Ubicación|Nombre del contacto|Teléfono del contacto) / })).toHaveLength(0);
    expect(within(zone).getAllByRole("term").map(term => term.textContent)).toEqual(["Ubicación", "Nombre del contacto", "Teléfono del contacto"]);
    expect(within(zone).getAllByRole("definition").map(value => value.textContent)).toEqual(["Dirección de entrega (pregunta 1)", "Recibió (pregunta 2)", "Ninguna"]);
  });

  it("read only with a question «Ubicación», says that the location goes there", () => {
    renderWithProviders(<Harness definition={deliveryDefinition("es", { location: true })} readOnly />);
    expect(screen.getAllByRole("definition").map(value => value.textContent)).toEqual(["Ubicación (pregunta 6)", "Recibió (pregunta 2)", "Teléfono de quien recibe (pregunta 3)"]);
  });

  it("on the phone, the lists are 44 px tall to touch", () => {
    vi.spyOn(globalThis, "matchMedia").mockImplementation(query => ({ matches: query === "(max-width: 639px)", media: query, onchange: null,
      addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));
    renderWithProviders(<Harness definition={deliveryDefinition("es", { location: true })} />);
    for (const button of screen.getAllByRole("button", { name: /^(Ubicación|Nombre del contacto|Teléfono del contacto) / })) expect(button).toHaveClass("h-11");
  });
});

// The Picker opens with the keyboard, like the other Radix lists in the tests; its button says the label and the chosen one.
async function openList(trigger: string | RegExp | HTMLElement) {
  const button = trigger instanceof HTMLElement ? trigger : screen.getByRole("button", { name: trigger });
  await act(async () => { button.focus(); });
  await userEvent.keyboard("{Enter}");
  return screen.findByRole("listbox");
}
async function pick(trigger: string | RegExp | HTMLElement, option: string | RegExp) {
  await userEvent.click(within(await openList(trigger)).getByRole("option", { name: option }));
}
