import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { expect, it } from "vitest";
import { server } from "@/test/mocks/server";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { readFormReply } from "../api/formReplies";
import { toFormReplyPresentation } from "../lib/formReplyPresentation";
import { FormReplyValues } from "./FormReplyValues";

it("renders captured multi labels in order through the real private adapter, never as files or scalars", () => {
  const id = "01990000-0000-7000-8000-000000000901";
  const second = "01990000-0000-7000-8000-000000000902";
  let reads = 0;
  server.use(http.get("/api/forms/catalogs/:id", () => { reads++; return HttpResponse.json({}, { status: 500 }); }),
    http.get("/api/forms/records/:id/files/:fileId", () => { reads++; return HttpResponse.json({}, { status: 500 }); }));
  const reply = readFormReply({ state: "Completed", definitionId: id, versionId: second, versionNumber: 1, name: "Visita",
    recordId: id, number: "VIS-000001", values: [{ fieldId: second, key: "faults", label: "Fallas", type: "multiChoice", value: [
      { choiceId: second, label: "Ruido", catalogId: id, catalogName: "Fallas anteriores", detail: "Capturado primero", value: "9007199254740993.0123", valueType: "Decimal" },
      { choiceId: id, label: "Frío" },
    ] }] }, true);
  const presentation = toFormReplyPresentation(reply);
  if (!presentation || presentation.state !== "Completed" || !presentation.values) throw new Error("Expected a permitted captured reply.");
  const view = renderWithProviders(<FormReplyValues rows={presentation.values} actor="reader" recordId={id} number="VIS-000001"/>);
  expect(screen.getByRole("definition")).toHaveTextContent("Ruido, Frío");
  expect(screen.queryByText(/9007199254740993|9\.007\.199/)).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Descargar|Ver foto/ })).not.toBeInTheDocument();
  expect(reads).toBe(0);
  view.rerender(<FormReplyValues rows={[]}/>);
  expect(screen.queryByText(/Ruido|Frío|Fallas anteriores/)).not.toBeInTheDocument();
});
