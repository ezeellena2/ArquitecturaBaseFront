import { describe, expect, it } from "vitest";
import { copyCatalogQuestionSource, normalizeCatalogQuestionSource, sameCatalogQuestionSource } from "./catalogQuestionSource";
import type { DraftQuestionSource, FormQuestionSource } from "./model";

const catalog = "0199f0a1-0000-7000-8000-000000000001";
const firstField = "0199f0a1-0000-7000-8000-000000000002";
const secondField = "0199f0a1-0000-7000-8000-000000000003";
const attribute = "0199f0a1-0000-7000-8000-000000000004";

describe("catalog question source", () => {
  it("preserves the serialized source of an existing question without optional settings", () => {
    expect(JSON.stringify(normalizeCatalogQuestionSource({ catalog }))).toBe(JSON.stringify({ catalog }));
    expect(normalizeCatalogQuestionSource({ catalog, match: [], presentation: null })).toEqual({ catalog });
    expect(normalizeCatalogQuestionSource({ catalog, match: null })).toEqual({ catalog });
  });

  it("orders filters by field identity without changing the draft or presentation order", () => {
    const source: FormQuestionSource = {
      catalog,
      match: [{ fieldId: secondField, personAttributeId: attribute }, { fieldId: firstField, value: "north" }],
      presentation: { title: ["code", "text"], description: [secondField, firstField] },
    };
    const normalized = normalizeCatalogQuestionSource(source);
    expect(normalized).toEqual({
      catalog,
      match: [{ fieldId: firstField, value: "north" }, { fieldId: secondField, personAttributeId: attribute }],
      presentation: { title: ["code", "text"], description: [secondField, firstField] },
    });
    expect(source.match?.[0]?.fieldId).toBe(secondField);
    expect(normalized.match).not.toBe(source.match);
    expect(normalized.match?.[0]).not.toBe(source.match?.[1]);
    expect(normalized.presentation?.title).not.toBe(source.presentation?.title);
    expect(normalized.presentation?.description).not.toBe(source.presentation?.description);
  });

  it("preserves unfinished values and an unfinished catalog for validation in the editor", () => {
    const source: DraftQuestionSource = {
      catalog: null,
      match: [{ fieldId: secondField, personAttributeId: null }, { fieldId: firstField, value: null }],
      presentation: { title: [], description: [] },
    };
    expect(normalizeCatalogQuestionSource(source)).toEqual({
      catalog: null,
      match: [{ fieldId: firstField, value: null }, { fieldId: secondField, personAttributeId: null }],
      presentation: { title: [], description: [] },
    });
  });

  it("copies every mutable collection while retaining the current editing order", () => {
    const source: DraftQuestionSource = {
      catalog,
      match: [{ fieldId: secondField, value: "south" }, { fieldId: firstField, personAttributeId: attribute }],
      presentation: { title: ["text"], description: ["code", secondField] },
    };
    const copied = copyCatalogQuestionSource(source);
    expect(copied).toEqual(source);
    expect(copied).not.toBe(source);
    expect(copied.match).not.toBe(source.match);
    expect(copied.match?.[0]).not.toBe(source.match?.[0]);
    expect(copied.presentation).not.toBe(source.presentation);
    expect(copied.presentation?.title).not.toBe(source.presentation?.title);
    expect(copied.presentation?.description).not.toBe(source.presentation?.description);
  });

  it("compares filter identities and values independently of object keys and filter order", () => {
    const left: FormQuestionSource = { catalog, match: [{ fieldId: firstField, value: "north" }, { fieldId: secondField, personAttributeId: attribute }] };
    const right: FormQuestionSource = { match: [{ personAttributeId: attribute, fieldId: secondField }, { value: "north", fieldId: firstField }], catalog };
    expect(sameCatalogQuestionSource(left, right)).toBe(true);
    expect(sameCatalogQuestionSource({ catalog }, { catalog, match: [], presentation: null })).toBe(true);
    expect(sameCatalogQuestionSource(undefined, null)).toBe(true);
    expect(sameCatalogQuestionSource({ catalog }, null)).toBe(false);
  });

  it("detects a different catalog, fixed value, attribute, or filter kind", () => {
    const source: FormQuestionSource = { catalog, match: [{ fieldId: firstField, value: "north" }] };
    expect(sameCatalogQuestionSource(source, { catalog: attribute, match: source.match })).toBe(false);
    expect(sameCatalogQuestionSource(source, { catalog, match: [{ fieldId: firstField, value: "south" }] })).toBe(false);
    expect(sameCatalogQuestionSource(source, { catalog, match: [{ fieldId: firstField, personAttributeId: "north" }] })).toBe(false);
    expect(sameCatalogQuestionSource({ catalog, match: [{ fieldId: firstField, personAttributeId: attribute }] }, { catalog, match: [{ fieldId: firstField, personAttributeId: catalog }] })).toBe(false);
  });

  it("treats presentation order and explicit presentation as part of the source", () => {
    const source: FormQuestionSource = { catalog, presentation: { title: ["text", "code"], description: [firstField, secondField] } };
    expect(sameCatalogQuestionSource(source, { catalog, presentation: { title: ["code", "text"], description: [firstField, secondField] } })).toBe(false);
    expect(sameCatalogQuestionSource(source, { catalog, presentation: { title: ["text", "code"], description: [secondField, firstField] } })).toBe(false);
    expect(sameCatalogQuestionSource({ catalog }, { catalog, presentation: { title: ["text"], description: ["detail"] } })).toBe(false);
  });
});
