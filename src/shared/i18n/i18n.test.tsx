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

  // Como el anterior, va antes de cualquier cambio de idioma: el primer valor tiene que ser el que se fijó al
  // arrancar, no el que dejó otro test.
  it("keeps the document language in step with the interface", async () => {
    expect(document.documentElement.lang).toBe("es");

    await i18n.changeLanguage("en");
    expect(document.documentElement.lang).toBe("en");

    await i18n.changeLanguage("es");
    expect(document.documentElement.lang).toBe("es");
  });

  // FORMATO ÚNICO DE NÚMEROS (2026-11-12): todo número que entra en un texto va con la región de su idioma (es-AR, en-US),
  // también el de un plural; lo que llega como texto, como un identificador, queda como está.
  it("writes the numbers of a text with the region of its language and leaves a text as it is", async () => {
    await i18n.loadNamespaces(["common", "forms"]);

    expect(i18n.t("common:pagination.range", { lng: "es", from: 1, to: 20, total: 1210 })).toBe("1–20 de 1.210");
    expect(i18n.t("common:pagination.range", { lng: "en", from: 1, to: 20, total: 1210 })).toBe("1–20 of 1,210");
    expect(i18n.t("common:pagination.range", { lng: "es", from: "0001", to: "0020", total: "1210" })).toBe("0001–0020 de 1210");
    expect(i18n.t("forms:catalogs.fields.missingValues", { lng: "es", count: 1210 })).toBe("Faltan valores en 1.210 opciones activas.");
    expect(i18n.t("forms:catalogs.fields.missingValues", { lng: "en", count: 1210 })).toBe("Values are missing from 1,210 active options.");
  });

  it("translates the same key to English", async () => {
    await i18n.changeLanguage("en");
    renderWithProviders(<Greeting />);

    expect(await screen.findByText("Cancel")).toBeInTheDocument();
    expect(screen.queryByText("Cancelar")).not.toBeInTheDocument();
  });
});
