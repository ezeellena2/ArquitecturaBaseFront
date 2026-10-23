import { act, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { FormPreview } from "./FormPreview";
import type { CatalogQuestionPreview, DraftEditorValue } from "../model";
const source = { catalog: "catalog", match: [{ fieldId: "zone", personAttributeId: "zone-data" }] };
const value: DraftEditorValue = { name: { es: "Pedido" }, prefix: "PED", offerWhen: null, draft: { format: 1, culture: "es", submitLabel: { es: "Enviar" }, fields: [{ localId: "q", fieldId: null, replacesFieldId: null, type: "multiChoice", required: false, selection: { minSelected: 0, maxSelected: 3 }, source, label: { es: "Proveedores" }, help: null }] } };
const preview: CatalogQuestionPreview = { source, culture: "es", state: "Ready", options: [{ id: "north", title: "Frío Norte · 30-12345678-9", description: "Entrega hoy" }] };
async function mount(current = value, shown = preview) { await act(async () => { renderWithProviders(<FormPreview value={current} culture="es" catalogPreviews={{ q: shown }}/>); }); }
it("shows only the composed options from the matching recipient preview", async () => { await mount(); expect(screen.getByRole("checkbox", { name: "Frío Norte · 30-12345678-9" })).toBeInTheDocument(); expect(screen.getByText("Entrega hoy")).toBeInTheDocument(); });
it("does not show a former recipient’s options after a source change", async () => { const changed = { ...value, draft: { ...value.draft, fields: value.draft.fields.map(field => field.type === "multiChoice" && field.source ? { ...field, source: { ...source, match: [] } } : field) } }; await mount(changed); expect(screen.queryByRole("checkbox")).not.toBeInTheDocument(); });
it("keeps a missing-data preview closed instead of showing all catalog options", async () => { await mount(value, { ...preview, state: "RecipientDataMissing", options: [] }); expect(screen.queryByRole("checkbox")).not.toBeInTheDocument(); expect(screen.getByText(/La persona no tiene el dato necesario/)).toBeInTheDocument(); });
