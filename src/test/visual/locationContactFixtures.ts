import type { CanonicalQuestion, FormCulture, FormDefinitionSnapshot } from "@/features/business-forms/model";

// W3 (UC1-A): synthetic examples for «Ubicación y contacto», the boards' «Registrar entrega»: its address, who received it and their
// phone receive what the person shares in the chat; with a question «Ubicación», the location goes there (W1-A) and the address
// receives nothing. Fictional data: the real contract arrives with the backend's export (task 20).
const guid = (n: number) => "01990000-0000-7000-8000-" + String(n).padStart(12, "0");
const key = (id: string) => "field_" + id.replaceAll("-", "");
/** The form of the editor's scenes: the same identity as the store's fixture form. */
export const deliveryFormId = guid(1);
export const deliveryIds = { address: guid(980), receiver: guid(981), phone: guid(982), photo: guid(983), notes: guid(984), location: guid(985) };

export function deliveryDefinition(culture: FormCulture, { location = false }: { location?: boolean } = {}): FormDefinitionSnapshot {
  const ids = deliveryIds;
  const question = (fieldId: string, es: string, en: string, rest: object, required = false) => ({ fieldId, key: key(fieldId), label: { es, en }, help: null, required, ...rest }) as unknown as CanonicalQuestion;
  return { offerWhen: null, id: deliveryFormId, name: { es: "Registrar entrega", en: "Register delivery" }, prefix: "ENT", prefixLocked: false, revision: 1,
    draft: { format: 1, culture, submitLabel: { es: "Enviar", en: "Submit" }, fields: [
      question(ids.address, "Dirección de entrega", "Delivery address", { type: "shortText", maxLength: 120, ...location ? {} : { receives: "location" } }, true),
      question(ids.receiver, "Recibió", "Received by", { type: "shortText", maxLength: 80, receives: "contactName" }, true),
      question(ids.phone, "Teléfono de quien recibe", "Recipient's phone", { type: "shortText", maxLength: 30, receives: "contactPhone" }),
      question(ids.photo, "Foto del remito", "Delivery note photo", { type: "photo", files: { minFiles: 1, maxFiles: 1, photoSource: "cameraOrGallery" } }, true),
      question(ids.notes, "Observaciones", "Notes", { type: "longText", maxLength: 600 }),
      ...location ? [question(ids.location, "Ubicación", "Location", { type: "location" }, true)] : [],
    ] } };
}
