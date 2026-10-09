import { describe, expect, it } from "vitest";
import { draftFrom, changeProvider, dirty, mergeReview, saveRequest } from "./model";
import type { AiConnection } from "./api/aiConnection";

const current: AiConnection = { provider: "OpenAI", model: "fictional-model", hasCredential: true, enabled: true, revision: 3, providers: ["OpenAI", "Anthropic"] };
describe("AI connection draft", () => {
  it("clears the candidate key and pauses when changing providers", () => {
    const next = changeProvider({ ...draftFrom(current), apiKey: "fictional-key", credentialChange: "Replace" }, "Anthropic");
    expect(next.apiKey).toBe("");
    expect(next.model).toBe("");
    expect(next.credentialChange).toBe("Remove");
    expect(next.enabled).toBe(false);
  });
  it("never echoes an existing key and uses an explicit replacement operation", () => {
    const draft = draftFrom(current);
    expect(dirty(draft, current)).toBe(false);
    const request = saveRequest(draft, current.revision, "request-id");
    expect(request.apiKey).toBeNull();
    expect(request.credentialChange).toBe("Keep");
  });
  it("preserves the provider associated with a candidate key when reviewing a conflict", () => {
    const draft = { ...draftFrom(current), credentialChange: "Replace" as const, apiKey: "fictional-openai-key" };
    const next = mergeReview(draft, current, { ...current, provider: "Anthropic", revision: 4 });
    expect(next.provider).toBe("OpenAI");
    expect(next.apiKey).toBe("fictional-openai-key");
  });
  it("adopts other changes while preserving explicitly edited fields", () => {
    const draft = { ...draftFrom(current), model: "my-model" };
    const next = mergeReview(draft, current, { ...current, enabled: false, model: "other-model", revision: 4 });
    expect(next.model).toBe("my-model");
    expect(next.enabled).toBe(false);
  });
});
