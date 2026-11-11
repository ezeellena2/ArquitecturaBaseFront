import { screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { ResponseResults } from "./ResponseResults";

// RE1-A: the zone of an external action above the answers, with its data in sight and «—» for one without a value.
const result = {
  source: "arca.invoice", name: "Emitir comprobante en ARCA", recordedAtUtc: "2026-11-09T20:00:00Z",
  values: [
    { key: "voucher", label: "Comprobante", kind: "text" as const, value: "Factura C 0004-00000012" },
    { key: "expiresOn", label: "Vencimiento del código", kind: "date" as const, value: "2026-11-19" },
    { key: "total", label: "Total", kind: "number" as const, value: null },
  ],
};

it("shows each action as a zone named after it, with its labels and values in the shared formats", () => {
  renderWithProviders(<ResponseResults results={[result]} />);
  const zone = screen.getByRole("region", { name: "Emitir comprobante en ARCA" });
  expect(within(zone).getByText("Comprobante")).toBeInTheDocument();
  expect(within(zone).getByText("Factura C 0004-00000012")).toBeInTheDocument();
  expect(within(zone).getByText("19/11/2026")).toBeInTheDocument();
  expect(within(zone).getByText("—")).toBeInTheDocument();
});

it("shows nothing without results", () => {
  renderWithProviders(<ResponseResults results={undefined} />);
  expect(screen.queryByText("Emitir comprobante en ARCA")).not.toBeInTheDocument();
});
