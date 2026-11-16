import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import i18n from "@/shared/i18n";
import { useWaitText } from "./useWaitText";

// N7: el servidor puede pedir esperar hasta un día (los topes diarios del correo y de WhatsApp). Hasta una hora la espera
// va en segundos, como la cuenta regresiva de siempre; desde una hora, en horas y minutos, redondeada para arriba al
// minuto como la cuenta lo hace al segundo, y con los números de la región del idioma.
describe("useWaitText", () => {
  afterEach(async () => {
    await i18n.changeLanguage("es");
  });

  it.each([
    [45, "45 s"],
    [3599, "3.599 s"],
    [3600, "1 h"],
    [3601, "1 h 1 min"],
    [82345, "22 h 53 min"],
    [86400, "24 h"],
  ])("writes a wait of %i seconds as %s", (seconds, text) => {
    const { result } = renderHook(() => useWaitText());

    expect(result.current(seconds)).toBe(text);
  });

  it("writes the numbers with the region of the language", async () => {
    await i18n.changeLanguage("en");
    const { result } = renderHook(() => useWaitText());

    expect(result.current(1234)).toBe("1,234 s");
    expect(result.current(82345)).toBe("22 h 53 min");
  });
});
