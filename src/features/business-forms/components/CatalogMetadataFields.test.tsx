import { useState } from "react";
import { act, cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import i18n from "@/shared/i18n";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { CatalogMetadataFields } from "./CatalogMetadataFields";

afterEach(async () => { cleanup(); await i18n.changeLanguage("es"); });
describe("Catalog metadata in the menu language", () => {
  it("edits the original in the menu language without a language selector", async () => {
    const changes = vi.fn();
    function Host() {
      const [value, setValue] = useState({ name: { es: "", en: "" }, description: { es: "", en: "" } });
      return <CatalogMetadataFields valueType="Text" {...value} culture="es" original="es" canManage onChange={change => { changes(change); setValue(previous => ({ ...previous, ...change })); }} />;
    }
    await act(async () => { renderWithProviders(<Host />); });
    const user = userEvent.setup();
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    expect(screen.getByText("Nombre", { selector: "label" })).toHaveTextContent(/^Nombre \*$/);
    expect(screen.getByRole("textbox", { name: "Nombre" })).not.toHaveAttribute("placeholder");
    expect(screen.getByRole("textbox", { name: "Descripción" })).toHaveAccessibleDescription("La leen las personas para saber cuándo usarlo.");
    await user.type(screen.getByRole("textbox", { name: "Nombre" }), "Clientes");
    await user.type(screen.getByRole("textbox", { name: "Descripción" }), "Visitas");
    expect(changes).toHaveBeenCalledWith({ name: { es: "Clientes", en: "" } });
    expect(changes).toHaveBeenLastCalledWith({ description: { es: "Visitas", en: "" } });
  });
  it("edits the optional translation with the original as reference and keeps the original", async () => {
    await i18n.changeLanguage("en");
    const changes = vi.fn();
    function Host() {
      const [value, setValue] = useState({ name: { es: "Clientes", en: "" }, description: { es: "Visitas", en: "" } });
      return <CatalogMetadataFields valueType="Text" {...value} culture="en" original="es" canManage onChange={change => { changes(change); setValue(previous => ({ ...previous, ...change })); }} />;
    }
    await act(async () => { renderWithProviders(<Host />); });
    const user = userEvent.setup();
    const name = screen.getByRole("textbox", { name: "Name" }), description = screen.getByRole("textbox", { name: "Description" });
    expect(screen.getByText("Name", { selector: "label" })).toHaveTextContent(/^Name$/);
    expect(name).toHaveValue(""); expect(name).toHaveAttribute("placeholder", "Untranslated");
    expect(name).toHaveAccessibleDescription("Original (Spanish): Clientes");
    expect(description).toHaveValue(""); expect(description).toHaveAttribute("placeholder", "Untranslated");
    expect(description).toHaveAccessibleDescription("Original (Spanish): Visitas");
    await user.type(name, "Customers");
    expect(changes).toHaveBeenLastCalledWith({ name: { es: "Clientes", en: "Customers" } });
    expect(name).toHaveValue("Customers"); expect(name).toHaveAccessibleDescription("Original (Spanish): Clientes");
  });
  it("keeps the description hint while the original has no description to translate", async () => {
    await act(async () => { renderWithProviders(<CatalogMetadataFields valueType="Text" name={{ es: "Clientes", en: "" }} description={{ es: "", en: "" }} culture="en" original="es" canManage onChange={() => {}} />); });
    const description = screen.getByRole("textbox", { name: "Descripción" });
    expect(description).not.toHaveAttribute("placeholder");
    expect(description).toHaveAccessibleDescription("La leen las personas para saber cuándo usarlo.");
  });
  it("shows origin and value type as one read-only line above name and an optional description", async () => {
    const view = await act(async () => renderWithProviders(<CatalogMetadataFields valueType="Text" name={{ es: "Clientes", en: "" }} description={{ es: "", en: "" }} culture="es" original="es" canManage onChange={() => {}} />));
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
    await act(async () => { renderWithProviders(<CatalogMetadataFields valueType="Text" origin="Filters" name={{ es: "Responsables", en: "" }} description={{ es: "", en: "" }} culture="es" original="es" canManage onChange={() => {}} />); });
    expect(screen.getByText("De la base · Texto", { exact: true })).toBeInTheDocument();
  });
  it("keeps fields read-only without Manage and binds translated field errors", async () => {
    await act(async () => { renderWithProviders(<CatalogMetadataFields valueType="Text" name={{ es: "Clientes", en: "Customers" }} description={{ es: "Visitas", en: "Visits" }} culture="es" original="es" canManage={false} onChange={() => {}} errors={{ "name.es": ["Revisá el nombre"] }} />); });
    expect(screen.getByRole("textbox", { name: "Nombre" })).toHaveAttribute("readonly");
    expect(screen.getByRole("textbox", { name: "Nombre" })).toHaveAccessibleDescription("Revisá el nombre");
    expect(screen.getByRole("alert")).toHaveTextContent("Revisá el nombre");
  });
  it("shows an error of the other language under the same field, naming its language", async () => {
    await act(async () => { renderWithProviders(<CatalogMetadataFields valueType="Text" name={{ es: "", en: "Customers" }} description={{ es: "", en: "" }} culture="es" original="en" canManage onChange={() => {}} errors={{ "name.en": ["Revisá el nombre"], "description.en": ["Revisá la descripción"] }} />); });
    expect(screen.getByRole("textbox", { name: "Nombre" })).toHaveAccessibleDescription("En inglés: Revisá el nombre");
    expect(screen.getByRole("textbox", { name: "Nombre" })).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("textbox", { name: "Descripción" })).toHaveAccessibleDescription("En inglés: Revisá la descripción");
  });
});
