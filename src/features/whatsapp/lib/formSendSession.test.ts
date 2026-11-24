import { createInstance } from "i18next";
import { describe, expect, it } from "vitest";
import es from "@/locales/es/whatsapp.json";
import en from "@/locales/en/whatsapp.json";
import { formOpening, freezeFormMessage, recipientChanged, selectedVersionChanged } from "./formSendSession";
const option = { definitionId: "a", versionId: "v1", versionNumber: 1, prefix: "VIS", name: { en: "Visit" }, questionCount: 2, submitLabel: { en: "Confirm" } };
const draft = { message: " Original text ", selection: option, recipientCulture: "es" as const, recipientContextRevision: "opaque-1", modeRevision: 7 };
describe("Form send intent", () => {
  it("freezes the complete intent and retains the operator text and opaque recipient revision", () => {
    const body = freezeFormMessage({...draft,messageEdited:true}, "request");
    expect(body).toEqual({ requestId: "request", definitionId: "a", versionId: "v1", expectedModeRevision: 7, expectedRecipientContextRevision: "opaque-1", message: " Original text " });
    expect(Object.isFrozen(body)).toBe(true);
  });
  it("detects a changed recipient or culture without rewriting the message or selection", () => {
    expect(recipientChanged(draft, "opaque-2", "es")).toBe(true);
    expect(recipientChanged(draft, "opaque-1", "en")).toBe(true);
    expect(recipientChanged(draft, "opaque-1", "es")).toBe(false);
    expect(draft.message).toBe(" Original text ");
    expect(draft.selection).toBe(option);
  });
  it("preserves a selection outside the current page but rejects its replaced published version", () => {
    expect(selectedVersionChanged(option, [])).toBe(false);
    expect(selectedVersionChanged(option, [{...option,definitionId:'other',versionId:'other-version'}])).toBe(false);
    expect(selectedVersionChanged(option, [{...option,versionId:'v2',versionNumber:2}])).toBe(true);
  });
});

it("freezes no explicit opening for an unedited default even after choosing a form", () => {
 expect(freezeFormMessage(draft, "request").message).toBeNull();
});

// The opening names the chosen form in the language it goes out in, like the server's default (2026-11-07).
describe("Form opening", () => {
  async function translate() {
    const i18n = createInstance();
    await i18n.init({ lng: "es", resources: { es: { whatsapp: es }, en: { whatsapp: en } }, interpolation: { escapeValue: false } });
    return i18n.getFixedT(null, "whatsapp");
  }
  const chosen = { ...option, name: { es: "Prueba renglones 1", en: "Rows test 1" }, submitLabel: { es: "Enviar", en: "Send" } };
  it("names the chosen form in the requested language", async () => {
    const t = await translate();
    expect(formOpening(t, "es", chosen)).toBe("Completá el formulario «Prueba renglones 1».");
    expect(formOpening(t, "en", chosen)).toBe("Complete the form “Rows test 1”.");
  });
  it("stays generic before a form is chosen", async () => {
    const t = await translate();
    expect(formOpening(t, "es")).toBe("Completá este formulario.");
    expect(formOpening(t, "en")).toBe("Complete this form.");
  });
  it("keeps a name with symbols as written", async () => {
    const t = await translate();
    expect(formOpening(t, "es", { ...chosen, name: { es: "Altas & bajas <2026>" } })).toBe("Completá el formulario «Altas & bajas <2026>».");
  });
});
