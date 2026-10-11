import { beforeAll, describe, expect, it } from "vitest";
import i18n from "@/shared/i18n";

// El equivalente de ResourceParityTests en el backend: una clave que existe en un idioma existe en el otro.
// import.meta.glob toma los archivos que haya, así que cada namespace nuevo queda cubierto sin tocar este test.
const resources = import.meta.glob<Record<string, unknown>>("./*/*.json", { eager: true, import: "default" });

function flatten(value: unknown, prefix: string): string[] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return [prefix];
  }

  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    flatten(child, prefix === "" ? key : `${prefix}.${key}`),
  );
}

function namespacesOf(language: string): string[] {
  return Object.keys(resources)
    .filter((path) => path.startsWith(`./${language}/`))
    .map((path) => path.slice(`./${language}/`.length).replace(".json", ""))
    .sort();
}

function keysOf(language: string, namespace: string): string[] {
  const resource = resources[`./${language}/${namespace}.json`];

  return resource === undefined ? [] : flatten(resource, "").sort();
}

describe("locales", () => {
  it("has at least one namespace", () => {
    expect(namespacesOf("es").length).toBeGreaterThan(0);
  });

  it("has the same namespaces in both languages", () => {
    expect(namespacesOf("en")).toEqual(namespacesOf("es"));
  });

  it.each(namespacesOf("es"))("has the same keys in both languages for %s", (namespace) => {
    expect(keysOf("en", namespace)).toEqual(keysOf("es", namespace));
  });
});


beforeAll(async () => { await i18n.loadLanguages(["es", "en"]); });

it.each([
  ["es", 0, "Versión 1 · 0 preguntas"],
  ["es", 1, "Versión 1 · 1 pregunta"],
  ["es", 2, "Versión 1 · 2 preguntas"],
  ["en", 0, "Version 1 · 0 questions"],
  ["en", 1, "Version 1 · 1 question"],
  ["en", 2, "Version 1 · 2 questions"],
] as const)("pluralizes the form selection description in %s for %i questions", (language, count, expected) => {
  expect(i18n.getFixedT(language, "whatsapp")("forms.optionDescription", {version:1, count})).toBe(expected);
});
