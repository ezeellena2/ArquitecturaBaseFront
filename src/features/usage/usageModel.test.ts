import { describe, expect, it } from "vitest";
import aiUsage from "@/test/fixtures/usage-http/ai-usage.json" with { type: "json" };
import emptyAiUsage from "@/test/fixtures/usage-http/ai-usage-empty.json" with { type: "json" };
import whatsAppUsage from "@/test/fixtures/usage-http/whatsapp-usage.json" with { type: "json" };
import unconfigured from "@/test/fixtures/usage-http/whatsapp-usage-unconfigured.json" with { type: "json" };
import type { AiModelUsage, AiUsage, WhatsAppUsage } from "./api/usage";
import { aiEstimatedCost, aiTotals, categoryKey, chosenMonth, currentMonth, monthTotal, recentMonths } from "./usageModel";

const ai = aiUsage as AiUsage;
const whatsapp = whatsAppUsage as WhatsAppUsage;
const model = (changes: Partial<AiModelUsage>): AiModelUsage => ({ ...ai.models[0]!, ...changes });

// Consumo (CO1-B): the month of the business, in the time zone of the general settings (PR16).
describe("the months", () => {
  it("takes the current month in the time zone of the business, not in UTC", () => {
    // 02:00 UTC of December 1 is still November 30 in Buenos Aires (UTC-3).
    expect(currentMonth(new Date("2026-12-01T02:00:00Z"), "America/Argentina/Buenos_Aires")).toBe("2026-11");
    expect(currentMonth(new Date("2026-12-01T02:00:00Z"), "UTC")).toBe("2026-12");
  });

  it("offers the last twelve months, the current one first and across a year", () => {
    expect(recentMonths("2026-03")).toEqual([
      "2026-03", "2026-02", "2026-01", "2025-12", "2025-11", "2025-10", "2025-09", "2025-08", "2025-07", "2025-06", "2025-05", "2025-04",
    ]);
  });

  it("shows the month of the address only when it is one of those offered", () => {
    const months = recentMonths("2026-11");
    expect(chosenMonth("2026-10", months)).toBe("2026-10");
    expect(chosenMonth(null, months)).toBe("2026-11");
    expect(chosenMonth("2025-11", months)).toBe("2026-11");
    expect(chosenMonth("2026-12", months)).toBe("2026-11");
    expect(chosenMonth("noviembre", months)).toBe("2026-11");
  });
});

describe("the AI of a month", () => {
  it("adds up the requests, the tokens and the audio of every model", () => {
    expect(aiTotals(ai.models)).toEqual({ requests: 1402, inputTokens: 2315400, outputTokens: 186250, audioSeconds: 5790 });
  });

  it("leaves a total unknown only when no model reported it", () => {
    expect(aiTotals([model({ inputTokens: null, outputTokens: null, audioSeconds: null })]))
      .toEqual({ requests: 1284, inputTokens: null, outputTokens: null, audioSeconds: null });
    expect(aiTotals([])).toEqual({ requests: 0, inputTokens: null, outputTokens: null, audioSeconds: null });
  });

  it("estimates the cost with the models that have a price", () => {
    expect(aiEstimatedCost(ai)).toBe(4.76);
    expect(aiEstimatedCost(emptyAiUsage as AiUsage)).toBe(0);
  });

  it("has no estimate when no model of the month has a price", () => {
    const unpriced: AiUsage = { ...ai, models: [model({ price: null, estimatedCostUsd: null })], totalEstimatedCostUsd: 0, unpricedModels: 1 };
    expect(aiEstimatedCost(unpriced)).toBeNull();
  });
});

describe("the total of the month", () => {
  it("adds the AI and WhatsApp when both arrived and WhatsApp is in dollars", () => {
    expect(monthTotal(ai, whatsapp)).toBeCloseTo(17.66, 10);
  });

  it("is not shown without one of the two zones", () => {
    expect(monthTotal(undefined, whatsapp)).toBeNull();
    expect(monthTotal(ai, undefined)).toBeNull();
  });

  it("is not shown when WhatsApp is in another currency or has no number", () => {
    expect(monthTotal(ai, { ...whatsapp, currency: "ARS" })).toBeNull();
    expect(monthTotal(ai, unconfigured as WhatsAppUsage)).toBeNull();
  });

  it("is not shown when the AI has no estimate", () => {
    expect(monthTotal({ ...ai, models: [model({ price: null, estimatedCostUsd: null })], totalEstimatedCostUsd: 0, unpricedModels: 1 }, whatsapp)).toBeNull();
  });
});

describe("the kinds of WhatsApp messages", () => {
  it("names the categories of Meta it knows", () => {
    expect(["MARKETING", "MARKETING_LITE", "UTILITY", "AUTHENTICATION", "AUTHENTICATION_INTERNATIONAL", "SERVICE", "REFERRAL_CONVERSION"].map(categoryKey))
      .toEqual(["marketing", "marketingLite", "utility", "authentication", "authenticationInternational", "service", "referralConversion"]);
  });

  it("leaves one it does not know as Meta sends it", () => {
    expect(categoryKey("FREE_ENTRY_POINT")).toBeNull();
    expect(categoryKey("toString")).toBeNull();
  });
});
