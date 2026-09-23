import { describe, expect, it } from "vitest";
import { accountDetailOf, accountNameOf, initialOf } from "./accountName";
import { currentUser } from "@/test/mocks/handlers";

describe("accountNameOf", () => {
  it("is the name when the account has one", () => {
    expect(accountNameOf(currentUser)).toBe("Ana");
  });

  it("falls back to the email", () => {
    expect(accountNameOf({ ...currentUser, displayName: null })).toBe("ana@example.com");
  });

  it("falls back to the number when the account has neither a name nor an email", () => {
    // Una cuenta creada desde WhatsApp: sin correo y sin nombre.
    expect(accountNameOf({ ...currentUser, displayName: null, email: null, phoneNumber: "+5493511234567" })).toBe(
      "+5493511234567",
    );
  });

  it("is empty when there is nothing to show", () => {
    expect(accountNameOf({ ...currentUser, displayName: null, email: null, phoneNumber: null })).toBe("");
  });
});

describe("accountDetailOf", () => {
  it("is the email, or the number when there is no email", () => {
    expect(accountDetailOf(currentUser)).toBe("ana@example.com");
    expect(accountDetailOf({ ...currentUser, email: null, phoneNumber: "+5493511234567" })).toBe("+5493511234567");
    expect(accountDetailOf({ ...currentUser, email: null, phoneNumber: null })).toBeUndefined();
  });
});

describe("initialOf", () => {
  it("is the first letter, in upper case", () => {
    expect(initialOf("ana@example.com")).toBe("A");
    expect(initialOf("  Ñandú")).toBe("Ñ");
  });

  it("skips the signs a number starts with", () => {
    expect(initialOf("+5493511234567")).toBe("5");
  });

  it("is a question mark when there is nothing to take it from", () => {
    expect(initialOf("")).toBe("?");
    expect(initialOf("+ -")).toBe("?");
  });
});
