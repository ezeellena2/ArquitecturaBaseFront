import { describe, expect, it } from "vitest";
import { formatFormReplyValue } from "./formReplyValue";

const es = { missing: "Sin respuesta", yes: "Sí", no: "No" };
const en = { missing: "No answer", yes: "Yes", no: "No" };
describe("form reply value presentation", () => {
  it("distinguishes zero, false and absence", () => {
    expect(formatFormReplyValue({ type: "decimal", value: "0" }, "es", es)).toBe("0");
    expect(formatFormReplyValue({ type: "boolean", value: false }, "es", es)).toBe("No");
    expect(formatFormReplyValue({ type: "boolean", value: null }, "es", es)).toBe("Sin respuesta");
    expect(formatFormReplyValue({ type: "shortText", value: "" }, "es", es)).toBe("");
  });
  it("localizes platform text in the operator culture without translating entered text", () => {
    expect(formatFormReplyValue({ type: "boolean", value: true }, "en", en)).toBe("Yes");
    expect(formatFormReplyValue({ type: "shortText", value: "All good, the client signed." }, "es", es)).toBe("All good, the client signed.");
    expect(formatFormReplyValue({ type: "longText", value: "  First line\nSecond line  " }, "es", es)).toBe("  First line\nSecond line  ");
    expect(formatFormReplyValue({ type: "date", value: "2026-10-08" }, "es", es)).toBe("08/10/2026");
    expect(formatFormReplyValue({ type: "decimal", value: "125500.00" }, "es", es)).toBe("125.500,00");
  });
  it("groups a decimal below five digits with the shared format", () => {
    expect(formatFormReplyValue({ type: "decimal", value: "1500.5" }, "es", es)).toBe("1.500,5");
  });
  it("uses the historical choice label supplied by the authorized snapshot", () => {
    expect(formatFormReplyValue({ type: "choice", value: "Distribuidora Norte" }, "es", es)).toBe("Distribuidora Norte");
    expect(formatFormReplyValue({ type: "choice", value: null }, "en", en)).toBe("No answer");
  });
  it("does not turn a malformed value into absence or raw content", () => {
    expect(formatFormReplyValue({ type: "date", value: "2026-04-31" }, "es", es)).toBeNull();
    expect(formatFormReplyValue({ type: "decimal", value: "1e3" }, "es", es)).toBeNull();
  });
});

it("joins historical multi-choice labels in order and presents an empty selection as unanswered", () => {
  expect(formatFormReplyValue({ type: "multiChoice", value: [{ label: "Ruido" }, { label: "Frío", detail: "Histórico" }] }, "es", es)).toBe("Ruido, Frío");
  expect(formatFormReplyValue({ type: "multiChoice", value: [] }, "es", es)).toBe("Sin respuesta");
  expect(formatFormReplyValue({ type: "multiChoice", value: [] }, "en", en)).toBe("No answer");
});

it("shows an omitted multi answer as unanswered without converting it to an empty list", () => {
  expect(formatFormReplyValue({ type: "multiChoice", value: null }, "en", en)).toBe("No answer");
});
