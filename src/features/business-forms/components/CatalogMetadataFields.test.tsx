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
  it("shows origin and value type as one read-only line above name and an optional description", async () => {
    const view = await act(async () => renderWithProviders(<CatalogMetadataFields valueType="Text" name={{ es: "Clientes", en: "" }} description={{ es: "", en: "" }} culture="es" canManage onCultureChange={() => {}} onChange={() => {}} />));
    const line = screen.getByText("Escritas a mano · Texto", { exact: true });
    expect(line.tagName).toBe("P");
    expect(line.compareDocumentPosition(screen.getByRole("textbox", { name: "Nombre" })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "De dónde salen" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Tipo de valor" })).not.toBeInTheDocument();
    expect(screen.queryByText(/no se puede cambiar/i)).not.toBeInTheDocument();
    expect(screen.getByText("Nombre", { selector: "label" })).toHaveTextContent(/^Nombre \*$/);
    expect(screen.getByText("Descripción", { selector: "label" })).toHaveTextContent(/^Descripción$/);
    expect(screen.getByRole("textbox", { name: "Descripción" })).not.toHaveAttribute("aria-required");
    view.unmount();
    await act(async () => { renderWithProviders(<CatalogMetadataFields valueType="Text" origin="Filters" name={{ es: "Responsables", en: "" }} description={{ es: "", en: "" }} culture="es" canManage onCultureChange={() => {}} onChange={() => {}} />); });
    expect(screen.getByText("De la base · Texto", { exact: true })).toBeInTheDocument();
  });
  it("keeps fields read-only without Manage and binds translated field errors", async () => {
    await act(async () => { renderWithProviders(<CatalogMetadataFields valueType="Text" name={{ es: "Clientes", en: "Customers" }} description={{ es: "Visitas", en: "Visits" }} culture="es" canManage={false} onCultureChange={() => {}} onChange={() => {}} errors={{ "name.es": ["Revisá el nombre"] }} />); });
    expect(screen.getByRole("textbox", { name: "Nombre" })).toHaveAttribute("readonly");
    expect(screen.getByRole("textbox", { name: "Nombre" })).toHaveAccessibleDescription("Revisá el nombre");
    expect(screen.getByRole("alert")).toHaveTextContent("Revisá el nombre");
  });
});
