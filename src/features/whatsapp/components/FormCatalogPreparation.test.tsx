import { useQuery } from "@tanstack/react-query";
import { act, cleanup, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import i18n from "@/shared/i18n";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import type { ChatFormPreparation } from "../api/forms";
import { FormCatalogPreparation } from "./FormCatalogPreparation";

afterEach(async () => { cleanup(); await i18n.changeLanguage("es"); });
it.each([
  ["es", "Zonas: a esta persona le tocarían más de 20 opciones. Filtrá el catálogo o usá una pregunta de una sola opción."],
  ["en", "Zonas: this person would get more than 20 options. Filter the catalog or use a single-choice question."],
] as const)("explains the multiple-choice catalog limit and recovery in %s", async (culture, message) => {
  await i18n.changeLanguage(culture);
  const preparation: ChatFormPreparation = { culture, recipientContextRevision: "test-context", preparation: {
    canSend: false, catalogs: [], issues: [{ fieldId: "01990000-0000-7000-8000-000000000001", label: "Zonas", code: "Forms.Record.CatalogTooLargeForMultiple", catalogName: "Zonas", invalidOptionCount: null, missingData: null }],
  } };
  function PreparedForm() {
    const query = useQuery({ queryKey: ["catalog-limit"], queryFn: async () => preparation });
    return <FormCatalogPreparation query={query} waitReason={null} hasCatalogQuestions recipientName="Juan Gómez"/>;
  }
  await act(async () => { renderWithProviders(<PreparedForm/>); });
  expect(await screen.findByText(message)).toBeInTheDocument();
});
it.each([
  ["es", "Zona", "Proveedores a consultar", "No se puede mandar: Pablo Sosa no tiene Zona, y «Proveedores a consultar» muestra las opciones según ese dato. Cargáselo en «Editar usuario» y volvé a mandarlo."],
  ["en", "Zone", "Suppliers to ask", "Cannot send: Pablo Sosa has no Zone, and “Suppliers to ask” shows its options based on that data. Add it in “Edit user” and send it again."],
] as const)("names the person and the missing data when the recipient lacks a filter value (%s)", async (culture, missingData, label, message) => {
  await i18n.changeLanguage(culture);
  const preparation: ChatFormPreparation = { culture, recipientContextRevision: "test-context", preparation: {
    canSend: false, catalogs: [], issues: [{ fieldId: "01990000-0000-7000-8000-000000000002", label, code: "Forms.Record.RecipientDataMissing", catalogName: null, invalidOptionCount: null, missingData }],
  } };
  function PreparedForm() {
    const query = useQuery({ queryKey: ["recipient-data-missing", culture], queryFn: async () => preparation });
    return <FormCatalogPreparation query={query} waitReason={null} hasCatalogQuestions recipientName="Pablo Sosa"/>;
  }
  await act(async () => { renderWithProviders(<PreparedForm/>); });
  expect(await screen.findByText(message)).toBeInTheDocument();
});
