import { describe, expect, it } from "vitest";
import type { WhatsAppSettings } from "../api/whatsappSettings";
import { changedFields, draftFromSettings, mergeDrafts, newCountries, saveRequest, validateDraft, type WhatsAppSettingsDraft } from "./whatsappSettingsDraft";

const settings: WhatsAppSettings = { revision: 4, flowSessionLifetimeHours: 24, allowedCountries: ["UY", "AR", "AR"], messageRetentionDays: 90 };
const draft = (next: Partial<WhatsAppSettingsDraft> = {}): WhatsAppSettingsDraft => ({ ...draftFromSettings(settings), ...next });

describe("the draft of Configuración › WhatsApp", () => {
  it("starts from the saved values, with each country once and in order", () => {
    expect(draftFromSettings(settings)).toEqual({ flowSessionLifetimeHours: "24", allowedCountries: ["AR", "UY"], messageRetentionDays: "90" });
  });

  it("sends the three values as numbers, with the revision that was read", () => {
    expect(saveRequest(draft({ flowSessionLifetimeHours: " 48 ", allowedCountries: ["UY", "BR", "AR"] }), settings))
      .toEqual({ expectedRevision: 4, flowSessionLifetimeHours: 48, allowedCountries: ["AR", "BR", "UY"], messageRetentionDays: 90 });
  });

  it("does not take the order of the countries as a change", () => {
    expect(changedFields(draft({ allowedCountries: ["UY", "AR"] }), draft())).toEqual([]);
    expect(changedFields(draft({ allowedCountries: ["AR"], messageRetentionDays: "30" }), draft())).toEqual(["allowedCountries", "messageRetentionDays"]);
  });

  it("keeps what was edited and takes what the other person saved in the rest", () => {
    const base = draft();
    const theirs = draft({ flowSessionLifetimeHours: "12", allowedCountries: ["AR", "BR", "UY"] });
    expect(mergeDrafts(draft({ messageRetentionDays: "30", allowedCountries: ["AR"] }), base, theirs))
      .toEqual({ flowSessionLifetimeHours: "12", allowedCountries: ["AR"], messageRetentionDays: "30" });
  });

  it.each(["0", "169", "1.5", "", "doce"])("asks for a number of hours between 1 and 168 instead of %j", value => {
    expect(validateDraft(draft({ flowSessionLifetimeHours: value })))
      .toEqual({ flowSessionLifetimeHours: { key: "settings.validation.range", values: { min: 1, max: 168 } } });
  });

  it.each(["0", "3651", "-2"])("asks for a number of days between 1 and 3650 instead of %j", value => {
    expect(validateDraft(draft({ messageRetentionDays: value })))
      .toEqual({ messageRetentionDays: { key: "settings.validation.range", values: { min: 1, max: 3650 } } });
  });

  it("asks for at least one country and accepts the limits of each number", () => {
    expect(validateDraft(draft({ allowedCountries: [] }))).toEqual({ allowedCountries: { key: "settings.validation.countriesRequired" } });
    expect(validateDraft(draft({ flowSessionLifetimeHours: "168", messageRetentionDays: "1" }))).toEqual({});
    expect(validateDraft(draft({ flowSessionLifetimeHours: "1", messageRetentionDays: "3650" }))).toEqual({});
  });

  it("names as new only the countries that were neither chosen nor saved", () => {
    // A saved country quitted and chosen again is not a new cost, nor is quitting one.
    expect(newCountries(["AR", "UY", "BR"], ["AR", "UY"], ["AR", "UY"])).toEqual(["BR"]);
    expect(newCountries(["AR", "UY"], ["AR"], ["AR", "UY"])).toEqual([]);
    expect(newCountries(["AR"], ["AR", "UY"], ["AR", "UY"])).toEqual([]);
  });
});
