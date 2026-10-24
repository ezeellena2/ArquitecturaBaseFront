import { act, cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import i18n from "@/shared/i18n";
import { FormReplyValues, type FormReplyDisplayRow } from "./FormReplyValues";

const rows: readonly FormReplyDisplayRow[] = [
  { id: "client", label: "Cliente", answer: { type: "choice", value: "Distribuidora Norte" } },
  { id: "date", label: "Fecha de la visita", answer: { type: "date", value: "2026-10-08" } },
  { id: "note", label: "Observaciones", answer: { type: "longText", value: "All good, the client signed." } },
  { id: "bool", label: "¿Se entregó todo?", answer: { type: "boolean", value: false } },
  { id: "zero", label: "Bultos devueltos", answer: { type: "decimal", value: "0" } },
  { id: "amount", label: "Importe cobrado", answer: { type: "decimal", value: "125500.00" } },
  { id: "none", label: "Teléfono de contacto", answer: { type: "shortText", value: null } },
];
describe("FormReplyValues presentation", () => {
  it("shows three answers before expanding and preserves every historical value", () => {
    renderWithProviders(<FormReplyValues rows={rows} />);
    expect(screen.getByText("Distribuidora Norte")).toBeInTheDocument();
    expect(screen.getByText("08/10/2026")).toBeInTheDocument();
    expect(screen.getByText("All good, the client signed.")).toBeInTheDocument();
    expect(screen.queryByText("125.500,00")).not.toBeInTheDocument();
    const toggle = screen.getByRole("button", { name: "Ver las 7 respuestas" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(screen.getByText("No", { exact: true })).toBeInTheDocument();
    expect(screen.getByText("0", { exact: true })).toBeInTheDocument();
    expect(screen.getByText("Sin respuesta", { exact: true })).toBeInTheDocument();
    expect(screen.getByText("125.500,00")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mostrar menos" })).toHaveAttribute("aria-expanded", "true");
    expect(toggle.getAttribute("aria-label")).toBeNull();
    fireEvent.click(toggle);
    expect(screen.queryByText("125.500,00")).not.toBeInTheDocument();
  });
  it("folds a long answer without changing its text and delegates viewport preservation", () => {
    const value = "First line\n" + "Entered text remains unchanged. ".repeat(30);
    const preserveViewport = vi.fn((change: () => void) => change());
    renderWithProviders(<FormReplyValues rows={[{ id: "long", label: "Observaciones", answer: { type: "longText", value } }]} preserveViewport={preserveViewport} />);
    const toggle = screen.getByRole("button", { name: "Ver la respuesta completa" });
    const answer = screen.getByText(/Entered text remains unchanged/);
    expect(answer.textContent).toBe(value);
    expect(answer).toHaveClass("line-clamp-3");
    fireEvent.click(toggle);
    expect(answer.textContent).toBe(value);
    expect(answer).not.toHaveClass("line-clamp-3");
    expect(preserveViewport).toHaveBeenCalledOnce();
  });
  it("omits private values completely when its caller removes the authorized rows", () => {
    const view = renderWithProviders(<FormReplyValues rows={rows} />);
    fireEvent.click(screen.getByRole("button", { name: "Ver las 7 respuestas" }));
    view.rerender(<FormReplyValues rows={[]} />);
    expect(screen.queryByText("Distribuidora Norte")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
  it("does not display raw or partial values from malformed presentation input", () => {
    renderWithProviders(<FormReplyValues rows={[...rows, { id: "bad", label: "Importe", answer: { type: "decimal", value: "invalid private raw" } }]} />);
    expect(screen.getByText("No se pudieron mostrar las respuestas.")).toBeInTheDocument();
    expect(screen.queryByText("Distribuidora Norte")).not.toBeInTheDocument();
    expect(screen.queryByText("invalid private raw")).not.toBeInTheDocument();
  });
  it("keeps values out of section and button accessible names", () => {
    renderWithProviders(<FormReplyValues rows={rows} />);
    const group = screen.getByRole("group", { name: "Respuestas del formulario" });
    expect(group).toHaveAttribute("aria-label", "Respuestas del formulario");
    expect(within(group).getByRole("button")).toHaveAccessibleName("Ver las 7 respuestas");
  });
});

afterEach(async () => { cleanup(); await i18n.changeLanguage("es"); });
it.each(["es", "en"] as const)("shows a multi-choice catalog once and associates each captured detail with its choice in %s", async culture => {
  await i18n.changeLanguage(culture);
  const choices: readonly FormReplyDisplayRow[] = [{ id: "faults", label: "Fallas", answer: { type: "multiChoice", value: [
    { label: "Frío", catalogName: "Fallas de heladeras", detail: "No enfría" },
    { label: "Ruido", catalogName: "Fallas de heladeras", detail: "Motor ruidoso" },
    { label: "Luz", catalogName: "Fallas de heladeras", detail: null },
  ] } }];
  let view!: ReturnType<typeof renderWithProviders>;
  await act(async () => { view = renderWithProviders(<FormReplyValues rows={choices}/>); });
  expect(screen.getAllByText("Fallas de heladeras", { exact: false })).toHaveLength(1);
  expect(screen.getByText("Frío, Ruido, Luz")).toBeInTheDocument();
  expect(screen.getByText("Frío: No enfría")).toBeInTheDocument();
  expect(screen.getByText("Ruido: Motor ruidoso")).toBeInTheDocument();
  view.rerender(<FormReplyValues rows={[]}/>);
  expect(screen.queryByText("Fallas de heladeras")).not.toBeInTheDocument();
  expect(screen.queryByText("Frío: No enfría")).not.toBeInTheDocument();
});
