import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/mocks/server";
import { fetchWhatsAppSettings, saveWhatsAppSettings, type WhatsAppSettings, type WhatsAppSettingsSaveRequest } from "./whatsappSettings";

// Configuración › WhatsApp (RC3-A): the same body for the read and the save, closed.
const settings: WhatsAppSettings = { revision: 2, flowSessionLifetimeHours: 24, allowedCountries: ["AR", "UY"], messageRetentionDays: 90 };
const save: WhatsAppSettingsSaveRequest = { expectedRevision: 2, flowSessionLifetimeHours: 48, allowedCountries: ["AR", "UY"], messageRetentionDays: 30 };

describe("the WhatsApp settings contract", () => {
  it("reads the three values with their revision", async () => {
    server.use(http.get("/api/whatsapp/settings", () => HttpResponse.json(settings)));
    expect(await fetchWhatsAppSettings()).toStrictEqual(settings);
  });

  it.each([
    ["an unknown key", { ...settings, phone: "PRIVATE" }],
    ["a country that is not a code", { ...settings, allowedCountries: ["Argentina"] }],
    ["a missing value", { revision: 2, flowSessionLifetimeHours: 24, allowedCountries: ["AR"] }],
    ["a number that is not whole", { ...settings, messageRetentionDays: 1.5 }],
  ])("rejects %s without keeping the payload", async (_name, body) => {
    server.use(http.get("/api/whatsapp/settings", () => HttpResponse.json(body)));
    const error = await fetchWhatsAppSettings().catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("Unsupported WhatsApp settings response.");
    expect(JSON.stringify(error)).not.toContain("PRIVATE");
  });

  it("puts the three values with the revision read and returns them as saved", async () => {
    let sent: unknown;
    server.use(http.put("/api/whatsapp/settings", async ({ request }) => {
      sent = await request.json();
      return HttpResponse.json({ revision: 3, flowSessionLifetimeHours: 48, allowedCountries: ["AR", "UY"], messageRetentionDays: 30 });
    }));
    expect((await saveWhatsAppSettings(save)).revision).toBe(3);
    expect(sent).toStrictEqual(save);
  });

  it("rejects a saved answer that does not follow the contract", async () => {
    server.use(http.put("/api/whatsapp/settings", () => HttpResponse.json({ revision: 3 })));
    await expect(saveWhatsAppSettings(save)).rejects.toThrow("Unsupported WhatsApp settings response.");
  });
});
