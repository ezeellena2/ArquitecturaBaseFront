import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { Button } from "@/shared/ui/button";
import { ResponsePanelFrame } from "./ResponsePanelFrame";

const navigation = { previous: true, next: true, onMove: vi.fn(), onClose: vi.fn() };
const precedes = (first: Element, second: Element) => Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);

// The panel actions go at the right edge of its header, in the title row before ↑ ↓ ×, not in a row of their own under the subtitle.
it("puts the panel actions in the title row, before the navigation and above the subtitle", () => {
  renderWithProviders(<ResponsePanelFrame title="VIS-000001" subtitle="Registrar visita · Versión 2" navigation={navigation}
    actions={<><Button size="sm">Abrir en pantalla completa</Button><Button size="sm">Abrir conversación</Button></>}>
    <p>Respuesta</p>
  </ResponsePanelFrame>);
  const title = screen.getByRole("heading", { name: "VIS-000001" });
  const open = screen.getByRole("button", { name: "Abrir en pantalla completa" });
  const chat = screen.getByRole("button", { name: "Abrir conversación" });
  const previous = screen.getByRole("button", { name: "Anterior" });
  const subtitle = screen.getByText("Registrar visita · Versión 2");
  expect(precedes(title, open)).toBe(true);
  expect(precedes(open, chat)).toBe(true);
  expect(precedes(chat, previous)).toBe(true);
  expect(precedes(open, subtitle)).toBe(true);
});

// The keyboard shortcuts are not written at the foot (decision of 2026-10-31): they are in the tooltips of ↑ ↓ ×.
it("keeps only the position at the foot", () => {
  renderWithProviders(<ResponsePanelFrame title="VIS-000001" navigation={{ ...navigation, position: 1, count: 2 }}><p>Respuesta</p></ResponsePanelFrame>);
  expect(screen.getByText("1 de 2")).toBeVisible();
  expect(screen.queryByText(/otra respuesta/)).not.toBeInTheDocument();
});

it.each([["Anterior", "Anterior (↑)"], ["Siguiente", "Siguiente (↓)"], ["Cerrar", "Cerrar (Esc)"]])("tells the shortcut of %s in its tooltip", async (name, tooltip) => {
  renderWithProviders(<ResponsePanelFrame title="VIS-000001" navigation={{ ...navigation, position: 1, count: 2 }}><p>Respuesta</p></ResponsePanelFrame>);
  await userEvent.hover(screen.getByRole("button", { name }));
  expect(await screen.findByRole("tooltip")).toHaveTextContent(tooltip);
});

it("does not tell the shortcuts of a pending task at the foot either", () => {
  renderWithProviders(<ResponsePanelFrame title="VIS-000001" navigation={{ ...navigation, position: 1, count: 2, kind: "pending" }}><p>Respuesta</p></ResponsePanelFrame>);
  expect(screen.getByText("1 de 2 por aprobar")).toBeVisible();
  expect(screen.queryByText(/recorren lo que espera/)).not.toBeInTheDocument();
});

// While it reads another response, the panel says it is loading and dims what it still shows, out of reach.
it("shows it is loading and dims the previous response while it reads another one", () => {
  const view = renderWithProviders(<ResponsePanelFrame title="VIS-000001" navigation={{ ...navigation, busy: true }}><p>Respuesta anterior</p></ResponsePanelFrame>);
  expect(screen.getByRole("status")).toHaveTextContent("Cargando…");
  expect(screen.getByText("Respuesta anterior").closest("[inert]")).not.toBeNull();
  view.rerender(<ResponsePanelFrame title="VIS-000002" navigation={navigation}><p>Respuesta nueva</p></ResponsePanelFrame>);
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(screen.getByText("Respuesta nueva").closest("[inert]")).toBeNull();
});

it("says Reintentando… on its retry while the responses are read again", () => {
  const onRetry = vi.fn();
  const view = renderWithProviders(<ResponsePanelFrame title="VIS-000001" navigation={{ ...navigation, error: new Error("network"), onRetry }}><p>Respuesta</p></ResponsePanelFrame>);
  expect(screen.getByRole("button", { name: "Reintentar" })).toBeEnabled();
  view.rerender(<ResponsePanelFrame title="VIS-000001" navigation={{ ...navigation, error: new Error("network"), onRetry, retrying: true }}><p>Respuesta</p></ResponsePanelFrame>);
  expect(screen.getByRole("button", { name: "Reintentando…" })).toHaveAttribute("aria-busy", "true");
});
