import { act, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import type { ResponseCell } from "../responses";
import { ResponseValue } from "./ResponseValue";

it.each([false, true])("preserves the captured option label and detail without current catalog data (detail: %s)", async detail => {
  const cell: ResponseCell = { fieldId: "branch", type: "choice", state: "Answered", value: {
    choiceId: "historic-option", valueType: "Decimal", value: "9007199254740993.0123", label: "Sucursal histórica", detail: "Detalle capturado", catalogName: "Catálogo histórico",
  } };
  await act(async () => { renderWithProviders(<ResponseValue cell={cell} actor="reader" recordId="record" number="VIS-000001" label="Sucursal" detail={detail} detailLink="/formularios/form/respuestas/record" onForbidden={() => undefined} onError={() => undefined}/>); });
  expect(screen.getByText("Sucursal histórica", { exact: true })).toBeVisible();
  expect(screen.getByText("Detalle capturado", { exact: true })).toBeVisible();
  if (detail) expect(screen.getByText("Catálogo histórico", { exact: true })).toBeVisible();
  else expect(screen.queryByText("Catálogo histórico", { exact: true })).not.toBeInTheDocument();
  expect(screen.queryByText(/9007199254740993|9\.007\.199/)).not.toBeInTheDocument();
});



it.each([false, true])("shows every historical multi-choice label without numeric values or file controls (detail: %s)", async detail => {
  const cell: ResponseCell = { fieldId: "faults", type: "multiChoice", state: "Answered", value: [
    { choiceId: "noise", label: "Ruido", detail: "Capturado primero", catalogName: "Fallas anteriores", valueType: "Decimal", value: "9007199254740993.0123" },
    { choiceId: "cold", label: "Frío", detail: "Capturado segundo" },
  ] };
  await act(async () => { renderWithProviders(<ResponseValue cell={cell} actor="reader" recordId="record" number="VIS-000001" label="Fallas" detail={detail}
    detailLink="/formularios/form/respuestas/record" onForbidden={() => undefined} onError={() => undefined}/>); });
  if (detail) {
    expect(screen.getByText("Ruido", { exact: true })).toBeVisible();
    expect(screen.getByText("Frío", { exact: true })).toBeVisible();
    expect(screen.getByText("Capturado primero", { exact: true })).toBeVisible();
    expect(screen.getByText("Capturado segundo", { exact: true })).toBeVisible();
  } else {
    expect(screen.getByText("Ruido, Frío", { exact: true })).toBeVisible();
    expect(screen.queryByText("Capturado primero", { exact: true })).not.toBeInTheDocument();
  }
  expect(screen.queryByText(/9007199254740993|9\.007\.199/)).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Descargar|Ver foto/ })).not.toBeInTheDocument();
});

it.each(["choice", "multiChoice"] as const)("shows every sealed extra field only in the %s detail", async type => {
  const choice = { choiceId: "historic", label: "Proveedor histórico", fields: [{ fieldId: "tax", label: "CUIT histórico", type: "text" as const, role: "data" as const, value: "30-71234567-8" }, { fieldId: "zone", label: "Zona histórica", type: "catalog" as const, role: "filter" as const, value: "private-option-id", text: "Centro de entonces" }, { fieldId: "days", label: "Plazo", type: "integer" as const, role: "data" as const, value: "900719925474099123" }] };
  const cell: ResponseCell = { fieldId: "supplier", type, state: "Answered", value: type === "choice" ? choice : [choice] };
  await act(async () => { renderWithProviders(<ResponseValue cell={cell} actor="reader" recordId="record" number="VIS-1" label="Proveedor" detail detailLink="" onForbidden={() => undefined} onError={() => undefined}/>); });
  expect(screen.getByText("CUIT histórico")).toBeInTheDocument(); expect(screen.getByText("30-71234567-8")).toBeInTheDocument(); expect(screen.getByText("Zona histórica")).toBeInTheDocument(); expect(screen.getByText("Centro de entonces")).toBeInTheDocument(); expect(document.body).not.toHaveTextContent("private-option-id");
});
