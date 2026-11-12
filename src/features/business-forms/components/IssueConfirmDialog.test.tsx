import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { readFormEntry, readFormIssuePreview, type FormIssuePreview } from "../api/entries";
import { IssueConfirmDialog } from "./IssueConfirmDialog";
import { IssueTotals } from "./IssueTotals";

const invoiceA: FormIssuePreview = {
  document: { es: "Factura A", en: "Invoice A" }, receiver: "Agro del Sur S.A.", total: "750280", failureCode: null, failureMessage: null,
  info: { es: "Lo decide el sistema: sos responsable inscripto y tu cliente también.", en: "The system decides it." }, date: "2026-11-09",
  amounts: [{ label: { es: "Neto gravado", en: "Taxed net" }, value: "616000" }, { label: { es: "IVA 21%", en: "VAT 21%" }, value: "109200" },
    { label: { es: "IVA 10,5%", en: "VAT 10.5%" }, value: "10080" }, { label: { es: "Exento", en: "Exempt" }, value: "15000" }],
};

describe("issue preview contract", () => {
  it("reads a form that issues and a preview with its amounts or why it cannot be issued", () => {
    const entry = { definitionId: crypto.randomUUID(), versionId: crypto.randomUUID(), versionNumber: 1, prefix: "FAC", name: "Factura", culture: "es",
      submitLabel: "Enviar", maxFileSizeMiB: 10, questions: [] };
    expect(readFormEntry({ ...entry, issuePreview: true }).issuePreview).toBe(true);
    expect(readFormEntry(entry).issuePreview).toBeUndefined();
    expect(() => readFormEntry({ ...entry, issuePreview: false })).toThrow();
    expect(readFormIssuePreview(invoiceA).amounts).toHaveLength(4);
    expect(readFormIssuePreview({ document: null, receiver: null, total: null, failureCode: "Arca.Registry.PersonNotFound", failureMessage: "ARCA no tiene esa CUIT." }).failureCode)
      .toBe("Arca.Registry.PersonNotFound");
  });
});

describe("«¿La emito?» (EM2-A, IV3)", () => {
  it("shows the document with why, the customer, the date, each amount and the total, and «Emitir factura» sends", async () => {
    const onConfirm = vi.fn(), onClose = vi.fn();
    renderWithProviders(<IssueConfirmDialog preview={invoiceA} sending={false} retrying={false} onConfirm={onConfirm} onRetry={vi.fn()} onClose={onClose}/>);
    const dialog = await screen.findByRole("dialog", { name: "¿Emitimos la factura?" });
    expect(within(dialog).getByText("Factura A")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Por qué este comprobante" })).toBeInTheDocument();
    expect(within(dialog).getByText("Agro del Sur S.A.")).toBeInTheDocument();
    expect(within(dialog).getByText("09/11/2026")).toBeInTheDocument();
    expect(within(dialog).getByText("IVA 10,5%")).toBeInTheDocument();
    expect(within(dialog).getByText("$ 750.280")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Emitir factura" }));
    expect(onConfirm).toHaveBeenCalledOnce();
    await userEvent.click(within(dialog).getByRole("button", { name: "Volver" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("tells why it cannot be issued and offers to try again, without «Emitir factura»", async () => {
    const onRetry = vi.fn();
    renderWithProviders(<IssueConfirmDialog preview={{ document: null, receiver: null, total: null, failureCode: "Arca.Connection.Unavailable", failureMessage: "ARCA no responde." }}
      sending={false} retrying={false} onConfirm={vi.fn()} onRetry={onRetry} onClose={vi.fn()}/>);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("ARCA no responde.")).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Emitir factura" })).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Volver a probar" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  // 4.7: after a 429, «Volver a probar» goes off with the seconds left as its reason.
  it("turns «Volver a probar» off while the wait of a 429 lasts, with the seconds as its reason", async () => {
    renderWithProviders(<IssueConfirmDialog preview={{ document: null, receiver: null, total: null, failureCode: "Arca.Connection.Unavailable", failureMessage: "ARCA no responde." }}
      sending={false} retrying={false} retryWait={12} onConfirm={vi.fn()} onRetry={vi.fn()} onClose={vi.fn()}/>);
    const retry = within(await screen.findByRole("dialog")).getByRole("button", { name: "Volver a probar" });
    expect(retry).toHaveAttribute("aria-disabled", "true");
    expect(retry).toHaveAccessibleDescription("Esperá 12 segundos para volver a intentar.");
  });

  // 5.10: the amounts read with tabular figures, in the same grid as the zone «Comprobante».
  it("writes the amounts with tabular figures", async () => {
    renderWithProviders(<IssueConfirmDialog preview={invoiceA} sending={false} retrying={false} onConfirm={vi.fn()} onRetry={vi.fn()} onClose={vi.fn()}/>);
    const dialog = await screen.findByRole("dialog", { name: "¿Emitimos la factura?" });
    expect(within(dialog).getByText("$ 616.000")).toHaveClass("tabular-nums");
    expect(within(dialog).getByText("Agro del Sur S.A.")).not.toHaveClass("tabular-nums");
  });
});

describe("the itemized total while loading (IV1-A)", () => {
  it("shows the amounts the issuer itemizes and the total", () => {
    renderWithProviders(<IssueTotals totals={invoiceA} pending={false}/>);
    expect(screen.getByText("Neto gravado")).toBeInTheDocument();
    expect(screen.getByText("$ 616.000")).toBeInTheDocument();
    expect(screen.getByText("$ 750.280")).toBeInTheDocument();
  });

  it("shows nothing for a document that itemizes nothing, and a sign while it waits", () => {
    const { rerender } = renderWithProviders(<IssueTotals totals={{ ...invoiceA, amounts: undefined }} pending={false}/>);
    expect(screen.queryByText("Total")).not.toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "Calculando el total" })).not.toBeInTheDocument();
    rerender(<IssueTotals totals={null} pending/>);
    expect(screen.getByRole("status", { name: "Calculando el total" })).toBeInTheDocument();
  });

  // 4.6: a reading that failed says so, with «Volver a probar», instead of going away without a word.
  it("says the total could not be worked out and tries again", async () => {
    const onRetry = vi.fn();
    renderWithProviders(<IssueTotals totals={null} pending={false} failed onRetry={onRetry}/>);
    expect(screen.getByRole("status")).toHaveTextContent("No pudimos calcular el total. Al enviar se calcula igual.");
    await userEvent.click(screen.getByRole("button", { name: "Volver a probar" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
