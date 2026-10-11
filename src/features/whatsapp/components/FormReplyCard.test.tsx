import { fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import i18n from "@/shared/i18n";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { FormReplyCard, type FormReplyPresentation } from "./FormReplyCard";

const completed: FormReplyPresentation = { state: "Completed", name: "Registrar visita", recordNumber: "VIS-000001", values: [
  { id: "client", label: "Cliente", answer: { type: "shortText", value: "Private answer marker" } },
] };
beforeAll(async () => { await i18n.loadLanguages(["es", "en"]); });
afterEach(async () => { await i18n.changeLanguage("es"); });
describe("form reply capture presentation", () => {
  it.each(["Pending", "Rejected", "Unrecognized"] as const)("shows %s without a record number or values even if extraneous private properties are supplied", state => {
    renderWithProviders(<FormReplyCard reply={{ ...completed, state }} />);
    expect(screen.queryByText("Private answer marker")).not.toBeInTheDocument();
    expect(screen.queryByText("VIS-000001")).not.toBeInTheDocument();
    expect(screen.queryByText(/Guardada como/)).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Respuestas del formulario" })).not.toBeInTheDocument();
  });
  it("shows a confirmed receipt with values and retains it when the channel message was removed", () => {
    renderWithProviders(<FormReplyCard reply={{ ...completed, messageRemoved: true }} />);
    expect(screen.getByText("Private answer marker")).toBeInTheDocument();
    expect(screen.getByText("Guardada como VIS-000001")).toBeInTheDocument();
    expect(screen.getByText("El mensaje de WhatsApp ya no está disponible. La respuesta sigue guardada.")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Respuesta del formulario Registrar visita, guardada como VIS-000001" })).toBeInTheDocument();
  });
  it("retains only the authorized receipt metadata for read-only and revoked values", () => {
    const view = renderWithProviders(<FormReplyCard reply={{ ...completed, values: null }} />);
    expect(screen.getByText("Guardada como VIS-000001")).toBeInTheDocument();
    expect(screen.getByText("No tenés permiso para ver las respuestas de este formulario.")).toBeInTheDocument();
    expect(screen.queryByText("Private answer marker")).not.toBeInTheDocument();
    view.rerender(<FormReplyCard reply={{ ...completed, values: null, valuesRevoked: true }} />);
    expect(screen.getByText("Ya no tenés permiso para ver estas respuestas.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
  it("removes displayed values and their expansion when authorization is withdrawn", () => {
    const view = renderWithProviders(<FormReplyCard reply={{ ...completed, values: Array.from({length: 5}, (_, n) => ({ ...completed.values![0], id: String(n) })) }} />);
    fireEvent.click(screen.getByRole("button", { name: "Ver las 5 respuestas" }));
    view.rerender(<FormReplyCard reply={{ ...completed, values: null, valuesRevoked: true }} />);
    expect(screen.queryByText("Private answer marker")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
  it("localizes platform copy for English without changing entered text", async () => {
    await i18n.changeLanguage("en");
    renderWithProviders(<FormReplyCard reply={{ ...completed, name: "Register visit" }} />);
    expect(screen.getByText("Saved as VIS-000001")).toBeInTheDocument();
    expect(screen.getByText("Private answer marker")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Form reply Register visit, saved as VIS-000001" })).toBeInTheDocument();
  });
});
