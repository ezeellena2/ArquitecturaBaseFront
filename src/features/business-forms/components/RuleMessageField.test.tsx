import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import type { RuleEvent } from "../rules";
import type { RuleMessageQuestion } from "../ruleMessage";
import { RuleMessageField } from "./RuleMessageField";

const remito = "0199a0c0-0000-7000-8000-000000000001", photo = "0199a0c0-0000-7000-8000-000000000002", supplier = "0199a0c0-0000-7000-8000-000000000003";
const questions: RuleMessageQuestion[] = [
  { fieldId: remito, type: "shortText", label: { es: "N° de remito", en: "Delivery note" } },
  { fieldId: photo, type: "photo", label: { es: "Foto del remito", en: "Delivery note photo" } },
  { fieldId: supplier, type: "choice", label: { es: "Proveedor", en: "Supplier" }, options: null },
];
const choices = { [supplier]: [{ id: "0199a0c0-0000-7000-8000-000000000100", label: "Distribuidora Norte" }] };
const message = `Llegó el remito {${remito}} de {${supplier}}. Revisá la recepción {número}.`;

function Field({ initial = "", event = "Received", disabled = false, onChange }: { initial?: string; event?: RuleEvent; disabled?: boolean; onChange?: (value: string) => void }) {
  const [value, setValue] = useState(initial);
  return <RuleMessageField label="Mensaje" help="Cómo se arma el mensaje." value={value} onChange={next => { setValue(next); onChange?.(next); }}
    culture="es" original="es" questions={questions} choices={choices} event={event} prefix="REC" disabled={disabled} />;
}
const editor = () => screen.findByRole("textbox", { name: "Mensaje" });
/** Puts the cursor inside the box, as a click would. */
function placeCaret(node: Node, offset: number) {
  const range = document.createRange();
  range.setStart(node, offset);
  range.collapse(true);
  document.getSelection()!.removeAllRanges();
  document.getSelection()!.addRange(range);
}
const optionNames = () => within(screen.getByRole("listbox", { name: "Agregar dato" })).getAllByRole("option").map(option => option.textContent);

describe("RuleMessageField", () => {
  it("shows each datum as a tag with the current name of its question", async () => {
    renderWithProviders(<Field initial={message} />);
    const box = await editor();
    expect(box).toHaveTextContent("Llegó el remito N° de remito de Proveedor. Revisá la recepción Número.");
    for (const name of ["N° de remito", "Proveedor", "Número"]) expect(within(box).getByText(name)).toHaveAttribute("contenteditable", "false");
  });

  it("offers the number and the questions in order without photos or documents, and the reason only when rejecting", async () => {
    const { unmount } = renderWithProviders(<Field />);
    await userEvent.click(await screen.findByRole("button", { name: "Agregar dato" }));
    expect(optionNames()).toEqual(["Número", "N° de remito", "Proveedor"]);
    expect(screen.getByRole("group", { name: "De la respuesta" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Preguntas" })).toBeInTheDocument();
    unmount();
    renderWithProviders(<Field event="Rejected" />);
    await userEvent.click(await screen.findByRole("button", { name: "Agregar dato" }));
    expect(optionNames()).toEqual(["Número", "Motivo del rechazo", "N° de remito", "Proveedor"]);
  });

  it("filters the list with its search box", async () => {
    renderWithProviders(<Field />);
    await userEvent.click(await screen.findByRole("button", { name: "Agregar dato" }));
    const search = screen.getByRole("combobox", { name: "Buscar una pregunta" });
    expect(search).toHaveFocus();
    await userEvent.type(search, "prov");
    expect(optionNames()).toEqual(["Proveedor"]);
    await userEvent.clear(search);
    await userEvent.type(search, "remito zzz");
    expect(screen.getByText("Ningún dato coincide con la búsqueda.")).toBeInTheDocument();
  });

  it("puts the chosen datum where the cursor was and leaves the cursor right after it", async () => {
    const changed = vi.fn();
    renderWithProviders(<Field initial="Llegó de hoy" onChange={changed} />);
    const box = await editor();
    box.focus();
    placeCaret(box.firstChild!, 6);
    await userEvent.click(screen.getByRole("button", { name: "Agregar dato" }));
    await userEvent.click(screen.getByRole("option", { name: "Proveedor" }));
    expect(changed).toHaveBeenLastCalledWith(`Llegó {${supplier}}de hoy`);
    expect(box).toHaveFocus();
    await userEvent.keyboard("x");
    expect(changed).toHaveBeenLastCalledWith(`Llegó {${supplier}}xde hoy`);
  });

  it("chooses with the keyboard from the search box", async () => {
    const changed = vi.fn();
    renderWithProviders(<Field onChange={changed} />);
    await userEvent.click(await screen.findByRole("button", { name: "Agregar dato" }));
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(changed).toHaveBeenLastCalledWith(`{${remito}}`);
  });

  it("erases a tag whole with Backspace right after it", async () => {
    const changed = vi.fn();
    renderWithProviders(<Field initial={`Hola {${remito}}`} onChange={changed} />);
    const box = await editor();
    box.focus();
    placeCaret(box, 2);
    await userEvent.keyboard("{Backspace}");
    expect(changed).toHaveBeenLastCalledWith("Hola ");
    expect(within(box).queryByText("N° de remito")).not.toBeInTheDocument();
  });

  it("leaves braces out of what is written", async () => {
    const changed = vi.fn();
    renderWithProviders(<Field onChange={changed} />);
    await userEvent.type(await editor(), "Hola {{mundo}");
    expect(changed).toHaveBeenLastCalledWith("Hola mundo");
  });

  it("shows a question that is no longer in the form as an unavailable tag", async () => {
    renderWithProviders(<Field initial="Llegó {0199a0c0-0000-7000-8000-000000000999}" />);
    expect(within(await editor()).getByText("Pregunta no disponible")).toBeInTheDocument();
  });

  it("shows how the message arrives with example data, and nothing while it is empty", async () => {
    const { unmount } = renderWithProviders(<Field initial={message} />);
    expect(await screen.findByRole("figure", { name: "Así llega" })).toHaveTextContent("Llegó el remito Ejemplo de respuesta de Distribuidora Norte. Revisá la recepción REC-000001.");
    unmount();
    renderWithProviders(<Field />);
    await editor();
    expect(screen.queryByRole("figure", { name: "Así llega" })).not.toBeInTheDocument();
  });

  it("cannot be written or completed while it is disabled", async () => {
    renderWithProviders(<Field initial={message} disabled />);
    const box = await editor();
    expect(box).toHaveAttribute("contenteditable", "false");
    expect(box).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: "Agregar dato" })).toBeDisabled();
  });
});
