import { describe, expect, it } from "vitest";

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
