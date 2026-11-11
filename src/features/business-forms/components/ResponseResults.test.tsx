import { screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { ResponseResults } from "./ResponseResults";

// RE1-A with EM1-A: what an external action left, its data in sight in the zone «Comprobante», and «—» for one without a value.
const result = {
  source: "arca.invoice", name: "Comprobante de ARCA", recordedAtUtc: "2026-11-09T20:00:00Z",
  values: [
    { key: "voucher", label: "Comprobante", kind: "text" as const, value: "Factura C" },
    { key: "caeDueOn", label: "Vence el CAE", kind: "date" as const, value: "2026-11-19" },
    { key: "total", label: "Total", kind: "number" as const, value: null },
  ],
};

it("shows each result as a group named after it, with its labels and values in the shared formats", () => {
  renderWithProviders(<ResponseResults results={[result]} />);
  const group = screen.getByRole("group", { name: "Comprobante de ARCA" });
  expect(within(group).getByText("Comprobante")).toBeInTheDocument();
  expect(within(group).getByText("Factura C")).toBeInTheDocument();
  expect(within(group).getByText("19/11/2026")).toBeInTheDocument();
  expect(within(group).getByText("—")).toBeInTheDocument();
});

it("keeps two results of the same source apart, in the order they came (the credit note after the invoice)", () => {
  const creditNote = { ...result, recordedAtUtc: "2026-11-10T20:00:00Z", values: [{ ...result.values[0], value: "Nota de crédito C" }] };
  renderWithProviders(<ResponseResults results={[result, creditNote]} />);
  expect(screen.getAllByRole("group", { name: "Comprobante de ARCA" }).map(group => within(group).getAllByRole("definition")[0].textContent)).toEqual(["Factura C", "Nota de crédito C"]);
});

it("shows nothing without results", () => {
  renderWithProviders(<ResponseResults results={undefined} />);
  expect(screen.queryByText("Comprobante de ARCA")).not.toBeInTheDocument();
});
