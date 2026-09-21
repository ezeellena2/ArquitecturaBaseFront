import { describe, expect, it } from "vitest";
import { authConfig } from "./authConfig";

describe("authConfig", () => {
  it("leaves refresh-token renewal to the HTTP single-flight flow", () => {
    expect(authConfig.automaticSilentRenew).toBe(false);
  });
});
