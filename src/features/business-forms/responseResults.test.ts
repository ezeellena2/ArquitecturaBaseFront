import { expect, it } from "vitest";
import { responseResultColumnLabel, responseResultText } from "./responseResults";

it("shows dates and numbers in the shared format and text as it came", () => {
  expect(responseResultText("date", "2026-11-19", "es")).toBe("19/11/2026");
  expect(responseResultText("date", "2026-11-19", "en")).toBe("11/19/2026");
  expect(responseResultText("text", "Factura C 0004-00000012", "es")).toBe("Factura C 0004-00000012");
  expect(responseResultText("number", "1234.5", "es")).toBe("1.234,5");
  // H29: an amount always has two decimals.
  expect(responseResultText("amount", "1234.5", "es")).toBe("1.234,50");
});

it("leaves an empty value for the dash", () => {
  expect(responseResultText("text", null, "es")).toBeNull();
  expect(responseResultText("number", "", "es")).toBeNull();
});

it("names the action next to a label two actions share", () => {
  const columns = [{ label: "Comprobante", sourceName: "ARCA" }, { label: "Comprobante", sourceName: "Correo" }, { label: "Código", sourceName: "ARCA" }];
  expect(responseResultColumnLabel(columns[0]!, columns)).toBe("Comprobante · ARCA");
  expect(responseResultColumnLabel(columns[2]!, columns)).toBe("Código");
});
