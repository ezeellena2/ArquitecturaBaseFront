import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCountdown } from "@/shared/hooks/useCountdown";
import { server } from "@/test/mocks/server";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { responseFormId } from "@/test/responseFixtures";
import type { ResponseColumn, ResponseQuery } from "../responses";
import { ResponseExportDialog } from "./ResponseExportDialog";

vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"), useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));
vi.mock("@/shared/hooks/usePrivateFormFile", async () => ({ ...await vi.importActual<typeof import("@/shared/hooks/usePrivateFormFile")>("@/shared/hooks/usePrivateFormFile"), savePrivateBlob: vi.fn() }));
beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => vi.restoreAllMocks());

const supplier: ResponseColumn = { fieldId: "supplier", type: "shortText", label: "Proveedor", options: [], introducedInVersion: 1 };
const status: ResponseColumn = { fieldId: "status", type: "choice", label: "Estado", options: [], introducedInVersion: 1 };
const block: ResponseColumn = { fieldId: "items", type: "group", label: "Artículos", options: [], introducedInVersion: 1, questions: [status] };
const all: ResponseQuery = { page: 1, pageSize: 20 };

function Export({ filter = all, total = 2, columns = [supplier, block], visible = columns, filterLabels = [] }: {
  filter?: ResponseQuery; total?: number; columns?: readonly ResponseColumn[]; visible?: readonly ResponseColumn[]; filterLabels?: readonly string[];
}) {
  const cooldown = useCountdown(0);
  return <ResponseExportDialog formId={responseFormId} prefix="RMP" filter={filter} total={total} ready cooldown={cooldown} columns={columns} visible={visible}
    filterLabels={filterLabels} onClose={vi.fn()} onForbidden={vi.fn()} />;
}

async function show(props: Parameters<typeof Export>[0] = {}) {
  await act(async () => { renderWithProviders(<Export {...props} />); });
  return screen.findByRole("dialog", { name: "Exportar respuestas a Excel" });
}

/// The value next to a datum of a `DataList`; the datum can carry its (i).
function valueOf(dialog: HTMLElement, label: string): HTMLElement {
  const term = Array.from(dialog.querySelectorAll("dt")).find(item => item.textContent?.startsWith(label));
  if (!term) throw new Error(`No datum ${label}`);
  return term.nextElementSibling as HTMLElement;
}

describe("ResponseExportDialog (EX1-A)", () => {
  it("reads what goes out in two columns, with the filters as the chips of the sheet without their cross", async () => {
    const dialog = await show({ filterLabels: ["Estado: Dañado (en algún ítem de Artículos)"] });

    expect(valueOf(dialog, "Respuestas")).toHaveTextContent("2");
    expect(valueOf(dialog, "Filtros")).toHaveTextContent("Estado: Dañado (en algún ítem de Artículos)");
    expect(within(valueOf(dialog, "Filtros")).queryByRole("button")).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("list")).not.toBeInTheDocument();
  });

  it("says Ninguno in the place of the filters when there are none", async () => {
    const dialog = await show();

    expect(valueOf(dialog, "Filtros")).toHaveTextContent("Ninguno");
  });

  it("names its group of options Columnas, with what always goes in its (i), and keeps Solo las visibles off with its reason when nothing is hidden", async () => {
    const dialog = await show();

    expect(within(dialog).getByRole("radiogroup", { name: "Columnas" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Más información sobre Columnas" }))
      .toHaveAccessibleDescription("Número, recibida, cargó y canal van siempre. De los archivos van la cantidad y los nombres.");
    const visible = within(dialog).getByRole("radio", { name: /Solo las visibles/ });
    expect(visible).toHaveAttribute("aria-disabled", "true");
    expect(visible).toHaveAccessibleDescription("Se ven todas las columnas.");
  });

  it("lets both options be chosen with hidden columns, each saying how many columns it takes", async () => {
    const dialog = await show({ visible: [supplier] });

    expect(within(dialog).getByRole("radio", { name: "Todas las preguntas (3 columnas)" })).not.toHaveAttribute("aria-disabled");
    expect(within(dialog).getByRole("radio", { name: "Solo las visibles (1 columna)" })).not.toHaveAttribute("aria-disabled");
  });

  it("says the file and how its rows go: one per item of the block, with its (i), or one per response when the block stays out", async () => {
    const dialog = await show({ visible: [supplier] });

    expect(valueOf(dialog, "Archivo")).toHaveTextContent(/^RMP-\d{8}\.xlsx$/);
    expect(valueOf(dialog, "Filas")).toHaveTextContent("Una por ítem de Artículos");
    expect(within(dialog).getByRole("button", { name: "Más información sobre Filas" }))
      .toHaveAccessibleDescription("Los datos de cada respuesta se repiten en sus ítems. Una respuesta sin ítems ocupa una fila. Hasta 100.000 filas.");
    await userEvent.click(within(dialog).getByRole("radio", { name: /Solo las visibles/ }));

    expect(valueOf(dialog, "Filas")).toHaveTextContent("Una por respuesta");
    expect(within(dialog).queryByRole("button", { name: "Más información sobre Filas" })).not.toBeInTheDocument();
  });

  it("says one row per response for a form without a block", async () => {
    const dialog = await show({ columns: [supplier] });

    expect(valueOf(dialog, "Filas")).toHaveTextContent("Una por respuesta");
  });

  it("says the voided go too when they are asked for, with what they add in the (i), and leaves them out with a state chosen", async () => {
    const dialog = await show();
    const include = within(dialog).getByRole("checkbox", { name: "Incluir las anuladas" });

    expect(include).toHaveAccessibleDescription("Suma la columna «Anulada».");
    await userEvent.click(include);

    expect(valueOf(dialog, "Respuestas")).toHaveTextContent("2 y las anuladas");
  });

  it("does not offer the voided with a state chosen in the sheet (CW11-A)", async () => {
    const dialog = await show({ filter: { ...all, state: "Received" } });

    expect(within(dialog).queryByRole("checkbox", { name: "Incluir las anuladas" })).not.toBeInTheDocument();
  });

  it("writes a large count of responses with the separators of the language", async () => {
    const dialog = await show({ total: 12430 });

    expect(valueOf(dialog, "Respuestas")).toHaveTextContent("12.430");
  });

  it("shows the reason of an Excel with more than 100.000 rows that the server sends", async () => {
    const reason = "El Excel tendría más de 100.000 filas, una por ítem. Acotá los filtros o sacá el bloque de las columnas.";
    server.use(http.post("/api/forms/definitions/:id/records/export", () => HttpResponse.json(
      { title: "Bad Request", status: 400, code: "Forms.Record.ExportTooManyRows", detail: reason, traceId: "trace" },
      { status: 400, headers: { "Content-Type": "application/problem+json" } })));
    const dialog = await show();

    await userEvent.click(within(dialog).getByRole("button", { name: "Exportar a Excel" }));

    expect(await screen.findByText(reason)).toBeInTheDocument();
  });
});
