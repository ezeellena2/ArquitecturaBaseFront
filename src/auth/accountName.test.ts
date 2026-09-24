import { describe, expect, it } from "vitest";
import { accountDetailOf, accountNameOf, initialOf } from "./accountName";
import { currentUser, phoneOnlyUser } from "@/test/mocks/handlers";

describe("accountNameOf", () => {
  it("is the name when the account has one", () => {
    expect(accountNameOf(currentUser)).toBe("Ana");
  });

  it("falls back to the email", () => {
    expect(accountNameOf({ ...currentUser, displayName: null })).toBe("ana@example.com");
  });

  it("falls back to the number, formatted for reading, when the account has neither a name nor an email", () => {
    // Una cuenta creada desde WhatsApp: sin correo y sin nombre. El número nunca se muestra en E.164.
    expect(accountNameOf({ ...phoneOnlyUser, displayName: null })).toBe("+54 9 11 2345-6789");
  });

  it("is empty when there is nothing to show", () => {
    expect(accountNameOf({ ...currentUser, displayName: null, email: null, formattedPhoneNumber: null })).toBe("");
  });
});

describe("accountDetailOf", () => {
  it("is the email, or the number formatted for reading when there is no email", () => {
    expect(accountDetailOf(currentUser)).toBe("ana@example.com");
    expect(accountDetailOf(phoneOnlyUser)).toBe("+54 9 11 2345-6789");
    expect(accountDetailOf({ ...currentUser, email: null, formattedPhoneNumber: null })).toBeUndefined();
  });

  it("is left out when the account has no name, so the line below does not repeat the one above", () => {
    // Sin nombre, el renglón del nombre ya muestra el correo o el número: una cuenta creada desde WhatsApp
    // mostraba su número dos veces, una debajo de la otra.
    expect(accountDetailOf({ ...phoneOnlyUser, displayName: null })).toBeUndefined();
    expect(accountDetailOf({ ...currentUser, displayName: null })).toBeUndefined();
  });
});

describe("initialOf", () => {
  it("is the first letter, in upper case", () => {
    expect(initialOf("ana@example.com")).toBe("A");
    expect(initialOf("  Ñandú")).toBe("Ñ");
  });

  it("skips the signs a number starts with", () => {
    expect(initialOf("+54 9 11 2345-6789")).toBe("5");
  });

  it("is a question mark when there is nothing to take it from", () => {
    expect(initialOf("")).toBe("?");
    expect(initialOf("+ -")).toBe("?");
  });
});
