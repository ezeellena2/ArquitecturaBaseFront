import { useState } from "react";
import { act, cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import i18n from "@/shared/i18n";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { CatalogMetadataFields } from "./CatalogMetadataFields";
import type { FormCulture } from "../model";

afterEach(async () => { cleanup(); await i18n.changeLanguage("es"); });
describe("Bilingual catalog metadata", () => {
  for (const language of ["es", "en"] as const) it("edits the selected content language without filling the other in " + language, async () => {
    await i18n.changeLanguage(language);
    function Host() {
      const [culture, setCulture] = useState<FormCulture>("es");
      const [value, setValue] = useState({ name: { es: "Clientes", en: "" }, description: { es: "Visitas", en: "" } });
      return <CatalogMetadataFields valueType="Text" {...value} culture={culture} canManage onCultureChange={setCulture} onChange={change => setValue(previous => ({ ...previous, ...change }))} />;
    }
    await act(async () => { renderWithProviders(<Host />); });
    const user = userEvent.setup();
    const nameLabel = language === "es" ? "Nombre" : "Name";
    const descriptionLabel = language === "es" ? "Descripción" : "Description";
    expect(screen.getByRole("textbox", { name: nameLabel })).toHaveValue("Clientes");
    await user.click(screen.getByRole("button", { name: language === "es" ? "Inglés" : "English" }));
    expect(screen.getByRole("textbox", { name: nameLabel })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: descriptionLabel })).toHaveValue("");
    await user.type(screen.getByRole("textbox", { name: nameLabel }), "Customers");
    await user.type(screen.getByRole("textbox", { name: descriptionLabel }), "Visits");
    await user.click(screen.getByRole("button", { name: language === "es" ? "Español" : "Spanish" }));
    expect(screen.getByRole("textbox", { name: nameLabel })).toHaveValue("Clientes");
    expect(screen.getByRole("textbox", { name: descriptionLabel })).toHaveValue("Visitas");
    await user.click(screen.getByRole("button", { name: language === "es" ? "Inglés" : "English" }));
    expect(screen.getByRole("textbox", { name: nameLabel })).toHaveValue("Customers");
    expect(screen.getByRole("textbox", { name: descriptionLabel })).toHaveValue("Visits");
  });
  it("keeps fields read-only without Manage and binds translated field errors", async () => {
    await act(async () => { renderWithProviders(<CatalogMetadataFields valueType="Text" name={{ es: "Clientes", en: "Customers" }} description={{ es: "Visitas", en: "Visits" }} culture="es" canManage={false} onCultureChange={() => {}} onChange={() => {}} errors={{ "name.es": ["Revisá el nombre"] }} />); });
    expect(screen.getByRole("textbox", { name: "Nombre" })).toHaveAttribute("readonly");
    expect(screen.getByRole("textbox", { name: "Nombre" })).toHaveAccessibleDescription("Revisá el nombre");
    expect(screen.getByRole("alert")).toHaveTextContent("Revisá el nombre");
  });
});
