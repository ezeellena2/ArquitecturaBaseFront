import { screen } from "@testing-library/react";
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
