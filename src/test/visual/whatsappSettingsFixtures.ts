import type { WhatsAppSettings, WhatsAppSettingsSaveRequest } from "@/features/whatsapp/api/whatsappSettings";

// Configuración › WhatsApp (RC3-A) without a server: the values of today (24 hours, Argentina and Uruguay, 90 days) and, in
// `whatsapp-settings-conflict`, a save that another administrator got ahead of, with 60 days.
export function createWhatsAppSettingsVisualFixtures(scenario: string) {
  let settings: WhatsAppSettings = { revision: 1, flowSessionLifetimeHours: 24, allowedCountries: ["AR", "UY"], messageRetentionDays: 90 };
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
  return {
    async handle(request: Request): Promise<Response | undefined> {
      if (new URL(request.url).pathname !== "/api/whatsapp/settings") return undefined;
      if (request.method === "GET") return json(settings);
      const { expectedRevision, ...values } = await request.json() as WhatsAppSettingsSaveRequest;
      if (scenario === "whatsapp-settings-conflict" && expectedRevision === 1) {
        settings = { ...settings, messageRetentionDays: 60, revision: 2 };
        return json({ status: 409, code: "WhatsApp.Settings.RevisionConflict" }, 409);
      }
      settings = { ...values, revision: settings.revision + 1 };
      return json(settings);
    },
  };
}
