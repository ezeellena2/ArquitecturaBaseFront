import { describe, expect, it } from "vitest";
import type { CatalogDetail } from "./api/catalogResponse";
import { catalogDraftBody, catalogDraftUpdateBody, loadCatalogDraftItems, openCatalogDraft, pendingFieldTexts, stageCatalogDraftItem, stageCatalogDraftMove } from "./catalogDraft";
import { withCatalogFieldValue } from "./catalogItemEdits";

const catalog: CatalogDetail = { valueType: "Text" as const, proposal: null, id: "01990000-0000-7000-8000-000000000020", key: "01990000000070008000000000000020", kind: "Manual", name: { es: "Clientes", en: "Customers" }, description: { es: "Visitas", en: "Visits" }, revision: 1, isActive: true, itemsCount: 3, usageCount: 0, originalCulture: "es", unavailableReasonCode: null, filters: null, fields: [], presentation: null, presentationCheck: { cultures: [{ culture: "es", titleTooLongCount: 0, titleExamples: [], descriptionTooLongCount: 0, descriptionExamples: [] }, { culture: "en", titleTooLongCount: 0, titleExamples: [], descriptionTooLongCount: 0, descriptionExamples: [] }] } };
const item = { value: null, id: "01990000-0000-7000-8000-000000000021", code: "C1", text: { es: "Cliente", en: null }, detail: { es: null, en: null }, position: 1, isActive: true, fields: {}, fieldTexts: {} };

describe("Catalog draft body by identity", () => {
  it("sends only touched identities across loaded pages and preserves nullable optional text", () => {
    const loaded = loadCatalogDraftItems(loadCatalogDraftItems(openCatalogDraft(catalog), [item]), [{ ...item, id: "01990000-0000-7000-8000-000000000022", position: 2 }]);
    const changed = stageCatalogDraftItem(loaded, { ...Object.values(loaded.items.originals)[0]!, code: "C2" });
    const body = catalogDraftBody(changed);
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({ itemId: item.id, code: "C2", text: { es: "Cliente", en: null } });
    expect(body.items[0]!.localId).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
    expect(body).not.toHaveProperty("expectedRevision");
  });
  it("discards the prior catalog item baseline and changes when adopting a confirmed revision or another identity", () => {
    const loaded = loadCatalogDraftItems(openCatalogDraft(catalog), [item]);
    const changed = stageCatalogDraftItem(loaded, { ...Object.values(loaded.items.originals)[0]!, isActive: false });
    expect(catalogDraftBody(changed).items).toHaveLength(1);
    for (const next of [{ ...catalog, revision: 2 }, { ...catalog, id: "01990000-0000-7000-8000-000000000023" }]) {
      const fresh = openCatalogDraft(next);
      expect(fresh.items).toEqual({ originals: {}, changes: {} });
      expect(catalogDraftBody(fresh).items).toEqual([]);
    }
  });
  it("does not fill a missing language of the metadata or of an item from the other", () => {
    const empty = openCatalogDraft();
    expect(empty.name).toEqual({ es: "", en: "" });
    expect(empty.description).toEqual({ es: "", en: "" });
    const changed = stageCatalogDraftItem(empty, { value: null, localId: "new-one", itemId: null, label: { es: "Cliente", en: null }, detail: {}, code: "C1", isActive: false, position: 1 });
    expect(catalogDraftBody(changed).items[0]).toMatchObject({ itemId: null, text: { es: "Cliente", en: null }, isActive: false });
  });
  it("omits a blank description from the save body", () => {
    expect(catalogDraftBody(openCatalogDraft()).description).toEqual({});
    const described = { ...openCatalogDraft(catalog), description: { es: "  Visitas  ", en: " " } };
    expect(catalogDraftBody(described).description).toEqual({ es: "Visitas" });
    expect(catalogDraftUpdateBody(described).description).toEqual({ es: "Visitas" });
  });
  it("sends the name in the languages it has, keeping the existing translation", () => {
    expect(catalogDraftBody({ ...openCatalogDraft(undefined, "Manual", "Text", "en"), name: { es: "", en: " Customers " } }).name).toEqual({ en: "Customers" });
    const translated = { ...openCatalogDraft(catalog, "Manual", "Text", "en"), name: { es: "Clientes", en: "Our customers" } };
    expect(catalogDraftUpdateBody(translated).name).toEqual({ es: "Clientes", en: "Our customers" });
    expect(catalogDraftUpdateBody({ ...translated, name: { es: "Clientes", en: "" } }).name).toEqual({ es: "Clientes" });
  });
  it("freezes the write body independently of later input changes", () => {
    const loaded = loadCatalogDraftItems(openCatalogDraft(catalog), [item]);
    const option = { ...Object.values(loaded.items.originals)[0]!, label: { es: "Otro", en: null } };
    const state = stageCatalogDraftItem(loaded, option);
    const body = catalogDraftBody(state);
    option.label.es = "Later";
    expect(body.items[0]!.text.es).toBe("Otro");
    expect(body.name).not.toBe(state.name);
  });
  it("does not serialize confirmed or provisional positions in item writes", () => {
    const loaded = loadCatalogDraftItems(openCatalogDraft(catalog), [item]);
    const changed = stageCatalogDraftItem(loaded, { ...Object.values(loaded.items.originals)[0]!, code: "C2", position: 999 });
    const body = catalogDraftBody(changed);
    expect(body.items[0]).not.toHaveProperty("position");
    expect(Object.values(changed.items.changes)[0]!.position).toBe(1);
    const added = stageCatalogDraftItem(openCatalogDraft(), { value: null, localId: "new", itemId: null, label: { es: "Nueva" }, detail: {}, code: "NEW", isActive: true, position: 999 });
    expect(Object.values(added.items.changes)[0]!.position).toBeNull();
    expect(catalogDraftBody(added).items[0]).not.toHaveProperty("position");
  });
  it("records multiple moves by persisted identity in order without inventing a new position", () => {
    const loaded = loadCatalogDraftItems(openCatalogDraft(catalog), [item]);
    const moved = stageCatalogDraftMove(stageCatalogDraftMove(loaded, item.id, "down"), item.id, "up");
    expect(catalogDraftUpdateBody(moved)).toMatchObject({ expectedRevision: 1, items: [], moves: [{ itemId: item.id, direction: "down" }, { itemId: item.id, direction: "up" }] });
    expect(Object.values(moved.items.originals)[0]!.position).toBe(1);
    expect(openCatalogDraft({ ...catalog, revision: 2 }).moves).toEqual([]);
  });
  it("does not move unknown identities or unsaved local options", () => {
    const empty = stageCatalogDraftItem(openCatalogDraft(catalog), { value: null, localId: "local-new", itemId: null, label: { es: "Nueva" }, detail: {}, code: "NEW", isActive: true, position: null });
    expect(stageCatalogDraftMove(empty, "local-new", "up").moves).toEqual([]);
    expect(stageCatalogDraftMove(empty, "01990000-0000-7000-8000-000000000099", "down").moves).toEqual([]);
  });
});


it("keeps the chosen type immutable, formats loaded values and writes only canonical deltas", () => {
  const fresh = openCatalogDraft(undefined, "Manual", "Decimal", "es");
  expect(fresh.valueType).toBe("Decimal");
  const typed = { ...catalog, valueType: "Decimal" as const };
  const loaded = loadCatalogDraftItems(openCatalogDraft(typed, "Manual", "Text", "es"), [{ ...item, value: "1500.5" }]);
  expect(loaded.valueType).toBe("Decimal");
  const original = Object.values(loaded.items.originals)[0]!;
  expect(original.value).toBe("1.500,5");
  const changed = stageCatalogDraftItem(loaded, { ...original, value: "2.500,75" });
  expect(catalogDraftBody(stageCatalogDraftItem(fresh, { ...original, localId: "new-value", itemId: null, value: "2.500,75" }))).toMatchObject({ valueType: "Decimal", items: [expect.objectContaining({ value: "2500.75" })] });
  const body = catalogDraftUpdateBody(changed);
  expect(body).not.toHaveProperty("valueType");
  expect(body.items[0]).toMatchObject({ itemId: item.id, value: "2500.75" });
});

it("keeps what an unedited saved option or yes/no showed while its field changes to another type", () => {
  const zone = { id: "01990000-0000-7000-8000-000000000031", key: "zone", name: { es: "Zona" }, type: "catalog" as const, sourceCatalogId: "01990000-0000-7000-8000-000000000040", required: false, unique: false, min: null, max: null, maxLength: null, role: "data" as const, position: 1, isActive: true, valuesCount: 1, usedBy: [] };
  const gps = { ...zone, id: "01990000-0000-7000-8000-000000000032", key: "gps", name: { es: "Con GPS" }, type: "boolean" as const, sourceCatalogId: null, position: 2 };
  const saved = loadCatalogDraftItems(openCatalogDraft({ ...catalog, fields: [zone, gps] }), [{ ...item, fields: { [zone.id]: "01990000-0000-7000-8000-000000000041", [gps.id]: "true" }, fieldTexts: { [zone.id]: { es: "Sur", en: "South" } } }]);
  const pending = { ...saved, fields: saved.fields.map(field => ({ ...field, type: "text" as const })) };
  const option = Object.values(saved.items.originals)[0]!, labels = { yes: "Sí", no: "No" };
  expect(pendingFieldTexts(pending, option, "es", labels)).toEqual({ [zone.id]: "Sur", [gps.id]: "Sí" });
  expect(pendingFieldTexts(pending, option, "en", { yes: "Yes", no: "No" })).toEqual({ [zone.id]: "South", [gps.id]: "Yes" });
  expect(pendingFieldTexts(saved, option, "es", labels)).toEqual({});
  // Clearing a value, or writing another one, is editing it: it travels and shows as written.
  expect(pendingFieldTexts(pending, withCatalogFieldValue(option, gps.id, null), "es", labels)).toEqual({ [zone.id]: "Sur" });
  expect(pendingFieldTexts(pending, withCatalogFieldValue(option, gps.id, "false"), "es", labels)).toEqual({ [zone.id]: "Sur" });
  expect(pendingFieldTexts(pending, { ...option, localId: "new", itemId: null }, "es", labels)).toEqual({});
});

it("sends alphabetical ordering as one explicit command without reconstructing thousands of moves", () => {
  const draft = { ...openCatalogDraft(catalog), sortAlphabetically: true };
  expect(catalogDraftUpdateBody(draft)).toMatchObject({ sortAlphabetically: true, items: [] });
  expect(catalogDraftUpdateBody(draft)).not.toHaveProperty("moves");
});
