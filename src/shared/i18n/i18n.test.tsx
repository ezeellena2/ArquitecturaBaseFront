import { screen } from "@testing-library/react";
import { useTranslation } from "react-i18next";
import { afterEach, describe, expect, it } from "vitest";
import i18n from "./index";
import { renderWithProviders } from "@/test/utils/renderWithProviders";

// Se muestra una clave que dice cosas distintas en cada idioma. "app.name" es la misma palabra en los dos,
// así que afirmarla no distinguiría un idioma del otro ni notaría que la traducción dejó de aplicarse.
function Greeting() {
  const { t } = useTranslation();

  return <p>{t("actions.cancel")}</p>;
}

describe("i18n", () => {
  afterEach(async () => {
    await i18n.changeLanguage("es");
  });

  it("uses Spanish by default", async () => {
    expect(i18n.language).toBe("es");
    renderWithProviders(<Greeting />);

    expect(await screen.findByText("Cancelar")).toBeInTheDocument();
  });

  it("translates the same key to English", async () => {
    await i18n.changeLanguage("en");
    renderWithProviders(<Greeting />);

    expect(await screen.findByText("Cancel")).toBeInTheDocument();
    expect(screen.queryByText("Cancelar")).not.toBeInTheDocument();
  });
});
