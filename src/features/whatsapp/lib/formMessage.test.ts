import { describe, expect, it } from "vitest";
import { formMessageIssue } from "./formMessage";

describe("Form message validation", () => {
  it("requires accompanying text instead of sending an opening button alone", () => {
    expect(formMessageIssue("")).toBe("required");
    expect(formMessageIssue(" \n\t ")).toBe("required");
  });
  it("accepts the shorter interactive body limit without changing what the operator wrote", () => {
    const message = "a".repeat(1024);
    expect(formMessageIssue(message)).toBeUndefined();
    expect(message).toHaveLength(1024);
    expect(formMessageIssue("a".repeat(1025))).toBe("tooLong");
  });
  it("counts leading and trailing characters instead of trimming past the transport limit", () => {
    expect(formMessageIssue(" " + "a".repeat(1023))).toBeUndefined();
    expect(formMessageIssue(" " + "a".repeat(1024))).toBe("tooLong");
  });
});
