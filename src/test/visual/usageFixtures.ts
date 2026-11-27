import type { AiUsage } from "@/features/usage/api/usage";
import aiUsage from "../fixtures/usage-http/ai-usage.json" with { type: "json" };
import emptyAiUsage from "../fixtures/usage-http/ai-usage-empty.json" with { type: "json" };
import priceConflict from "../fixtures/usage-http/ai-price-conflict.json" with { type: "json" };
import whatsAppUsage from "../fixtures/usage-http/whatsapp-usage.json" with { type: "json" };
import emptyWhatsAppUsage from "../fixtures/usage-http/whatsapp-usage-empty.json" with { type: "json" };
import unavailable from "../fixtures/usage-http/whatsapp-usage-unavailable.json" with { type: "json" };
import unconfigured from "../fixtures/usage-http/whatsapp-usage-unconfigured.json" with { type: "json" };

/**
 * Consumo (CO1-B) without a server, with the bodies of the plan written by hand (`fixtures/usage-http`): November 2026 with both
 * zones and October without requests nor messages. `usage-loading` never answers, `usage-unavailable` is Meta that did not answer
 * (500 with its code), `usage-unconfigured` an installation without a number and `usage-conflict` a save of the prices that another
 * administrator got ahead of. The scenes fix the clock on 2026-11-27, so the current month is November.
 */
export function createUsageVisualFixtures(language: "es" | "en", scenario: string) {
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
  let ai = aiUsage as AiUsage;
  return {
    permissions: ["ai.read", "ai.manage", "settings.manage"],
    async handle(request: Request): Promise<Response | undefined> {
      const url = new URL(request.url);
      const month = url.searchParams.get("month");
      if (scenario === "usage-loading" && (url.pathname === "/api/ai/usage" || url.pathname === "/api/whatsapp/usage")) return new Promise<Response>(() => {});
      if (url.pathname === "/api/ai/usage") return json(month === "2026-11" ? ai : emptyAiUsage);
      if (url.pathname === "/api/whatsapp/usage") {
        // The server writes its detail in the language of the request.
        if (scenario === "usage-unavailable") return json(language === "en" ? { ...unavailable, detail: "Meta did not answer. Try again in a few minutes." } : unavailable, 500);
        if (scenario === "usage-unconfigured") return json(unconfigured);
        return json(month === "2026-11" ? whatsAppUsage : emptyWhatsAppUsage);
      }
      if (url.pathname === "/api/ai/usage/prices" && request.method === "PUT") {
        const body = await request.json() as { model: string; revision: number | null; inputUsdPerMillion: number | null; outputUsdPerMillion: number | null; audioUsdPerMinute: number | null };
        if (scenario === "usage-conflict" && body.revision === 2) {
          ai = { ...ai, models: [{ ...ai.models[0]!, price: { inputUsdPerMillion: 1.5, outputUsdPerMillion: 10, audioUsdPerMinute: null, revision: 3 } }, ai.models[1]!] };
          return json(priceConflict, 409);
        }
        return json({ provider: "OpenAI", ...body, revision: (body.revision ?? 0) + 1 });
      }
      return undefined;
    },
  };
}
