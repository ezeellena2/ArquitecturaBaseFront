import { describe, expect, it } from "vitest";
import type { CatalogDetail } from "./api/catalogResponse";
import { catalogDraftBody, catalogDraftUpdateBody, loadCatalogDraftItems, openCatalogDraft, stageCatalogDraftItem, stageCatalogDraftMove } from "./catalogDraft";

const catalog: CatalogDetail = { proposal: null, id: "01990000-0000-7000-8000-000000000020", key: "01990000000070008000000000000020", kind: "Manual", name: { es: "Clientes", en: "Customers" }, description: { es: "Visitas", en: "Visits" }, revision: 1, isActive: true, itemsCount: 3, usageCount: 0, unavailableReasonCode: null, filters: null };
const item = { id: "01990000-0000-7000-8000-000000000021", code: "C1", text: { es: "Cliente", en: null }, detail: { es: null, en: null }, position: 1, isActive: true };

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
  it("does not fill required bilingual metadata or optional item English from Spanish", () => {
    const empty = openCatalogDraft();
    expect(empty.name).toEqual({ es: "", en: "" });
    expect(empty.description).toEqual({ es: "", en: "" });
    const changed = stageCatalogDraftItem(empty, { localId: "new-one", itemId: null, label: { es: "Cliente", en: null }, detail: {}, code: "C1", isActive: false, position: 1 });
    expect(catalogDraftBody(changed).items[0]).toMatchObject({ itemId: null, text: { es: "Cliente", en: null }, isActive: false });
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
    const added = stageCatalogDraftItem(openCatalogDraft(), { localId: "new", itemId: null, label: { es: "Nueva" }, detail: {}, code: "NEW", isActive: true, position: 999 });
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
    const empty = stageCatalogDraftItem(openCatalogDraft(catalog), { localId: "local-new", itemId: null, label: { es: "Nueva" }, detail: {}, code: "NEW", isActive: true, position: null });
    expect(stageCatalogDraftMove(empty, "local-new", "up").moves).toEqual([]);
    expect(stageCatalogDraftMove(empty, "01990000-0000-7000-8000-000000000099", "down").moves).toEqual([]);
  });
});
