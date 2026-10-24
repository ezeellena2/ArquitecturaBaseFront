import { act, cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it } from "vitest";
import i18n from "@/shared/i18n";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { CatalogPreview } from "./CatalogPreview";
import type { CatalogManualItemValue } from "../catalogItemEdits";
const items: readonly CatalogManualItemValue[] = [{ localId: "a", itemId: "a", code: "A", value: "1500.5", position: 1, label: { es: "Norte", en: "North" }, detail: { es: "Zona norte", en: "North area" }, isActive: true }, { localId: "b", itemId: "b", code: "B", value: null, position: 2, label: { es: "Retirada" }, detail: {}, isActive: false }];
afterEach(async () => { cleanup(); await i18n.changeLanguage("es"); });
it.each(["es", "en"] as const)("starts closed, opens single-choice options and closes after selecting or returning in %s without changing the catalog", async language => {
  await i18n.changeLanguage(language);
  await act(async () => { renderWithProviders(<CatalogPreview items={items} name="Zonas" culture={language}/>); });
  const user = userEvent.setup(), english = language === "en";
  expect(screen.getByText(english ? "Each form question decides this. This switch changes only the preview." : "Lo decide cada pregunta del formulario. Este selector cambia solo la vista previa.")).toBeInTheDocument();
  expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: english ? "Choose an option" : "Elegí una opción" }));
  const option = screen.getByRole("radio", { name: english ? "North" : "Norte" });
  expect(screen.queryByText("Retirada")).not.toBeInTheDocument();
  await user.click(option);
  expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: english ? "North" : "Norte" }));
  await user.click(screen.getByRole("button", { name: english ? "Back" : "Volver" }));
  expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  expect(screen.getByText(/200/)).toBeInTheDocument(); expect(items[0]!.label.es).toBe("Norte");
  expect(screen.queryByText("1500.5")).not.toBeInTheDocument();
});
it("lists an option written only in the other language with that text", async () => {
  const english: readonly CatalogManualItemValue[] = [{ localId: "n", itemId: "n", code: "N", value: null, position: 1, label: { en: "North" }, detail: { en: "North side" }, isActive: true }];
  await act(async () => { renderWithProviders(<CatalogPreview items={english} name="Zonas" culture="es"/>); });
  await userEvent.click(screen.getByRole("button", { name: "Elegí una opción" }));
  expect(screen.getByRole("radio", { name: "North" })).toBeInTheDocument();
  expect(screen.getByText("North side")).toBeInTheDocument();
});
it("switches only the illustrative preview to checkboxes while leaving catalog data untouched", async () => {
  await act(async () => { renderWithProviders(<CatalogPreview items={items} name="Zonas" culture="es"/>); });
  await userEvent.click(screen.getByRole("button", { name: "Varias" }));
  expect(screen.getByRole("checkbox", { name: "Norte" })).not.toBeChecked();
  await userEvent.click(screen.getByText("Norte")); expect(screen.getByRole("checkbox", { name: "Norte" })).toBeChecked();
  expect(items[0]).not.toHaveProperty("selected");
});

it.each(["es", "en"] as const)("describes the correct WhatsApp option limit for each preview mode in %s", async language => {
  await i18n.changeLanguage(language);
  await act(async () => { renderWithProviders(<CatalogPreview items={items} name="Zonas" culture={language}/>); });
  expect(screen.getByText(/WhatsApp.*200/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: language === "en" ? "Multiple" : "Varias" }));
  expect(screen.queryByText(/WhatsApp.*200/)).not.toBeInTheDocument();
  expect(screen.getByText(/WhatsApp.*20/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: language === "en" ? "One option" : "Una opción" }));
  expect(screen.getByText(/WhatsApp.*200/)).toBeInTheDocument();
});
