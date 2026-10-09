import { createInstance } from "i18next";
import { describe, expect, it } from "vitest";
import type { AccessEventKind } from "../api/chat";
import { accessSummary, previewText } from "./messagePresentation";
import es from "@/locales/es/whatsapp.json";
import en from "@/locales/en/whatsapp.json";

describe("message presentation", () => {
  it.each(["es", "en"])("keeps unknown access events safe in %s without reading their text", async language => {
    const i18n = createInstance();
    await i18n.init({ lng: language, resources: { es: { whatsapp: es }, en: { whatsapp: en } } });
    const t = i18n.getFixedT(language, "whatsapp");
    expect(previewText(t, "Access", "FutureEvent" as AccessEventKind, "123456 #t=secret"))
      .toBe(language === "es" ? "Evento de acceso" : "Access event");
    expect(accessSummary(t, null)).toBe(language === "es" ? "Evento de acceso" : "Access event");
  });
  it("preserves history without metadata and business phrases without inferring authentication", async () => {
    const i18n = createInstance();
    await i18n.init({ lng: "es", resources: { es: { whatsapp: es } } });
    const t = i18n.getFixedT("es", "whatsapp");
    expect(previewText(t, undefined, undefined, "Quiero entrar" )).toBe("Quiero entrar");
    expect(previewText(t, "Business", null, "CREATE_ACCOUNT")).toBe("CREATE_ACCOUNT");
    expect(previewText(t, "Unclassified", null, null)).toBe("Texto no disponible");
  });
});
