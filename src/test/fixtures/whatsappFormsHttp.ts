import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const captures = import.meta.glob<string>("./whatsapp-forms-http/*/*.json", { eager: true, query: "?raw", import: "default" });
const input = process.env.WHATSAPP_FORMS_HTTP_CONTRACT_INPUT;

// Responses stay byte-for-byte controller output, including known product failures.
export function whatsappFormsHttpBody(culture: "es" | "en", name: string): string {
  const value = input ? readFileSync(resolve(input, culture, name + ".json"), "utf8")
    : captures["./whatsapp-forms-http/" + culture + "/" + name + ".json"];
  if (value === undefined) throw new Error("Missing WhatsApp form HTTP capture: " + culture + "/" + name);
  return value;
}
export function whatsappFormsHttpJson<T = unknown>(culture: "es" | "en", name: string): T {
  return JSON.parse(whatsappFormsHttpBody(culture, name)) as T;
}
