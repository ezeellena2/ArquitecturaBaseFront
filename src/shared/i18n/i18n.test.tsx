import { screen } from "@testing-library/react";
import { useTranslation } from "react-i18next";
import { describe, expect, it } from "vitest";
import i18n from "./index";
import { renderWithProviders } from "@/test/utils/renderWithProviders";

function Greeting() {
  const { t } = useTranslation();

  return <p>{t("app.name")}</p>;
}

describe("i18n", () => {
  it("uses Spanish by default", async () => {
    renderWithProviders(<Greeting />);

    expect(await screen.findByText("Arquitectura Base")).toBeInTheDocument();
  });

  it("translates the same key to English", async () => {
    await i18n.changeLanguage("en");
    renderWithProviders(<Greeting />);

    expect(await screen.findByText("Arquitectura Base")).toBeInTheDocument();
    expect(i18n.t("actions.cancel")).toBe("Cancel");

    await i18n.changeLanguage("es");
    expect(i18n.t("actions.cancel")).toBe("Cancelar");
  });
});
