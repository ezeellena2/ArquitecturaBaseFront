import { describe, expect, it } from "vitest";
import { changedPriceFields, draftFromPrice, isPriceDraftDirty, keepPriceDraftChanges, priceValues, valuesOf } from "./priceDraft";

const price = { inputUsdPerMillion: 1.25, outputUsdPerMillion: 10, audioUsdPerMinute: null, revision: 2 };

// The prices of a model (the board «Precios»): three optional fields, written with the decimal sign of the language.
describe("the draft of the prices", () => {
  it("starts from the saved prices, with the decimal sign of the language", () => {
    expect(draftFromPrice(price, "es")).toEqual({ input: "1,25", output: "10,00", audio: "" });
    expect(draftFromPrice(price, "en")).toEqual({ input: "1.25", output: "10.00", audio: "" });
    expect(draftFromPrice({ ...price, audioUsdPerMinute: 0.006 }, "es").audio).toBe("0,006");
    expect(draftFromPrice(null, "es")).toEqual({ input: "", output: "", audio: "" });
  });

  it("reads a price with a comma in Spanish and with a point in English, and an empty field as no price", () => {
    expect(priceValues({ input: "1,25", output: " 10 ", audio: "" }, "es")).toEqual({ values: { input: 1.25, output: 10, audio: null } });
    expect(priceValues({ input: "1.25", output: "0.000001", audio: "0.006" }, "en")).toEqual({ values: { input: 1.25, output: 0.000001, audio: 0.006 } });
  });

  it("marks what is not a price of the range the server takes", () => {
    expect(priceValues({ input: "-1", output: "1,2,3", audio: "abc" }, "es")).toEqual({ errors: { input: "invalid", output: "invalid", audio: "invalid" } });
    expect(priceValues({ input: "1000,5", output: "1000", audio: "10,01" }, "es")).toEqual({ errors: { input: "invalid", audio: "invalid" } });
    expect(priceValues({ input: "0,1234567", output: "1,25", audio: "" }, "es")).toEqual({ errors: { input: "invalid" } });
    expect(priceValues({ input: "1,25", output: "", audio: "" }, "en")).toEqual({ errors: { input: "invalid" } });
  });

  it("knows when something changed from what was saved", () => {
    const base = valuesOf(price);
    expect(isPriceDraftDirty({ input: "1,250", output: "10", audio: "" }, base, "es")).toBe(false);
    expect(isPriceDraftDirty({ input: "1,30", output: "10", audio: "" }, base, "es")).toBe(true);
    expect(isPriceDraftDirty({ input: "x", output: "10", audio: "" }, base, "es")).toBe(true);
    expect(isPriceDraftDirty({ input: "", output: "", audio: "" }, valuesOf(null), "es")).toBe(false);
  });

  it("names the prices that differ between two versions", () => {
    expect(changedPriceFields(valuesOf(price), { input: 1.25, output: 12, audio: 0.006 })).toEqual(["output", "audio"]);
    expect(changedPriceFields(valuesOf(price), valuesOf(price))).toEqual([]);
  });

  it("keeps what the draft changed and takes the rest from what another person saved", () => {
    const current = { inputUsdPerMillion: 2, outputUsdPerMillion: 12, audioUsdPerMinute: null, revision: 3 };
    expect(keepPriceDraftChanges({ input: "1,25", output: "11", audio: "0,01" }, valuesOf(price), current, "es"))
      .toEqual({ input: "2,00", output: "11", audio: "0,01" });
  });
});
