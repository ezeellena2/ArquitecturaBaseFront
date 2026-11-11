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
  amounts: [{ label: { es: "Neto gravado", en: "Taxed net" }, value: "616000" }, { label: { es: "IVA 21 %", en: "VAT 21 %" }, value: "109200" },
    { label: { es: "IVA 10,5 %", en: "VAT 10.5 %" }, value: "10080" }, { label: { es: "Exento", en: "Exempt" }, value: "15000" }],
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
    expect(within(dialog).getByText("IVA 10,5 %")).toBeInTheDocument();
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
});
