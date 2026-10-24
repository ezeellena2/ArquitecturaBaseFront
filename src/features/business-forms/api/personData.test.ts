import { afterEach, expect, it, vi } from "vitest";
import { api } from "@/shared/api/httpClient";
import { createPersonAttribute, fetchPersonAttributeOptions, fetchPersonData, fetchPersonDataPage, fetchPersonAttributes, readPersonAttribute, readPersonAttributes, readPersonData, readPersonDataPage, savePersonData, updatePersonAttribute } from "./personData";
// Synthetic responses matching the E2 DTO source; real HTTP bodies are qualified by the final joint export.
const id = "01990000-0000-7000-8000-000000000121", userId = "01990000-0000-7000-8000-000000000122", sourceId = "01990000-0000-7000-8000-000000000123";
const attribute = { id, key: "zone", name: { es: "Zona" }, originalCulture: "es", type: "Catalog", sourceCatalogId: sourceId, sourceCatalogName: "Zonas", position: 0, isActive: true, revision: 1, usedBy: [] };
const person = { userId, revision: 1, values: { [id]: { value: sourceId, text: "Centro" } } };
const page = <T,>(items: T[]) => ({ items, page: 1, pageSize: 20, totalCount: items.length, totalPages: items.length ? 1 : 0, hasPrevious: false, hasNext: false });
afterEach(() => vi.restoreAllMocks());
it("reads original-only attribute names and rejects unsupported definitions without retaining zod issues", () => {
  expect(readPersonAttributes({ items: [attribute] })).toEqual({ items: [attribute] });
  for (const value of [{ ...attribute, private: "PRIVATE" }, { ...attribute, type: "Other" }, { ...attribute, type: "Text" }, { ...attribute, sourceCatalogId: null }, { ...attribute, revision: 0 }]) {
    expect(() => readPersonAttribute(value)).toThrow("Unsupported person data response.");
  }
  try { readPersonAttribute({ ...attribute, private: "PRIVATE" }); } catch (error) { expect(JSON.stringify(error)).not.toContain("PRIVATE"); expect(error).not.toHaveProperty("issues"); }
});
it("accepts a person attribute named only in English", () => {
  const english = { ...attribute, type: "Text", sourceCatalogId: null, sourceCatalogName: null, name: { en: "Branch" }, originalCulture: "en" };
  expect(readPersonAttribute(english)).toEqual(english);
  expect(readPersonAttributes({ items: [english] })).toEqual({ items: [english] });
  const withoutOriginal = Object.fromEntries(Object.entries(english).filter(([key]) => key !== "originalCulture"));
  for (const value of [withoutOriginal, { ...english, originalCulture: "fr" }, { ...english, name: {} }, { ...english, name: { en: " " } }])
    expect(() => readPersonAttribute(value)).toThrow("Unsupported person data response.");
});
it("reads private person values and a nullable initial revision while checking the expected identity", () => {
  expect(readPersonData(person, userId)).toEqual(person);
  expect(readPersonData({ userId, revision: null, values: {} }, userId)).toEqual({ userId, revision: null, values: {} });
  for (const body of [{ ...person, userId: sourceId }, { ...person, values: { [id]: { value: null, text: "Centro" } } }, { ...person, values: { invalid: { value: "PRIVATE", text: "PRIVATE" } } }, { ...person, email: "PRIVATE" }]) {
    expect(() => readPersonData(body, userId)).toThrow("Unsupported person data response.");
  }
});
it("reads the people table with a nullable display name, only declared private columns and one missing count per attribute", () => {
  const row = { userId, displayName: null, values: person.values }, missing = [{ attributeId: id, count: 2 }];
  expect(readPersonDataPage({ ...page([row]), missing })).toEqual({ ...page([row]), missing });
  for (const body of [{ ...page([{ ...row, email: "private@example.invalid" }]), missing }, page([row]), { ...page([row]), missing: [...missing, { attributeId: id, count: 1 }] }, { ...page([row]), missing: [{ attributeId: id, count: -1 }] }, { ...page([row]), missing: [{ ...missing[0], userId }] }]) {
    expect(() => readPersonDataPage(body)).toThrow("Unsupported person data response.");
  }
});
it("sends a private delta with the captured revision and validates its own commit without another person or a stale response", async () => {
  const signal = new AbortController().signal, body = { expectedRevision: 1, values: { [id]: null } };
  const saved = { userId, revision: 2, values: {} };
  const put = vi.spyOn(api, "put").mockResolvedValue(saved);
  expect(await savePersonData(userId, body, signal)).toEqual(saved);
  expect(put).toHaveBeenCalledExactlyOnceWith("/api/forms/person-data/" + userId, body, { signal, cache: "no-store" });
  for (const response of [{ ...saved, userId: sourceId }, { ...saved, revision: 1 }, { ...saved, revision: null }]) {
    put.mockResolvedValue(response);
    await expect(savePersonData(userId, body, signal)).rejects.toThrow("Unsupported person data response.");
  }
});
it("checks first-save and attribute write identities and revisions without adding user or actor properties", async () => {
  const signal = new AbortController().signal;
  const put = vi.spyOn(api, "put").mockResolvedValue(person);
  expect(await savePersonData(userId, { expectedRevision: null, values: { [id]: sourceId } }, signal)).toEqual(person);
  const post = vi.spyOn(api, "post").mockResolvedValue(attribute);
  const create = { key: "zone", name: { es: "Zona" }, type: "Catalog" as const, sourceCatalogId: sourceId };
  expect(await createPersonAttribute(create, signal)).toEqual(attribute);
  expect(post).toHaveBeenCalledExactlyOnceWith("/api/forms/person-attributes", create, { signal, cache: "no-store" });
  post.mockResolvedValue({ ...attribute, key: "other" });
  await expect(createPersonAttribute(create)).rejects.toThrow("Unsupported person data response.");
  put.mockResolvedValue({ ...attribute, revision: 2 });
  const update = { expectedRevision: 1, name: { es: "Región" }, type: "Catalog" as const, sourceCatalogId: sourceId, position: 0, isActive: true };
  expect(await updatePersonAttribute(id, update, signal)).toMatchObject({ id, revision: 2 });
  expect(put).toHaveBeenLastCalledWith("/api/forms/person-attributes/" + id, update, { signal, cache: "no-store" });
});
it("uses the narrow paged option endpoint without accepting catalog internals or putting private search in a write", async () => {
  const signal = new AbortController().signal, get = vi.spyOn(api, "get").mockResolvedValue(page([{ id: sourceId, text: "Centro" }]));
  expect(await fetchPersonAttributeOptions(id, { page: 1, pageSize: 20, search: "Centro" }, signal)).toEqual(page([{ id: sourceId, text: "Centro" }]));
  expect(get).toHaveBeenCalledExactlyOnceWith("/api/forms/person-attributes/" + id + "/options?page=1&pageSize=20&search=Centro", { signal, cache: "no-store" });
  get.mockResolvedValue(page([{ id: sourceId, text: "Centro", fields: {} }]));
  await expect(fetchPersonAttributeOptions(id, { page: 1, pageSize: 20 })).rejects.toThrow("Unsupported person data response.");
});
it("reads metadata and private values with no-store and cancellation and rejects an invalid route identity before transport", async () => {
  const signal = new AbortController().signal, get = vi.spyOn(api, "get").mockResolvedValue({ items: [attribute] });
  await fetchPersonAttributes(signal);
  expect(get).toHaveBeenLastCalledWith("/api/forms/person-attributes", { signal, cache: "no-store" });
  get.mockResolvedValue(person); await fetchPersonData(userId, signal);
  expect(get).toHaveBeenLastCalledWith("/api/forms/person-data/" + userId, { signal, cache: "no-store" });
  get.mockResolvedValue({ ...page([]), missing: [] }); await fetchPersonDataPage({ page: 1, pageSize: 20, sort: "displayName" }, signal);
  expect(get).toHaveBeenLastCalledWith("/api/forms/person-data?page=1&pageSize=20&sort=displayName", { signal, cache: "no-store" });
  const calls = get.mock.calls.length;
  await expect(fetchPersonData("not-an-id", signal)).rejects.toThrow("Unsupported person data response.");
  expect(get).toHaveBeenCalledTimes(calls);
});
