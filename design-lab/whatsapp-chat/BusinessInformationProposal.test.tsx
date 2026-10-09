import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, Link, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/shared/i18n";
import { TooltipProvider } from "@/shared/ui/tooltip";
import * as notifications from "@/shared/ui/notifications";
import { BusinessInformationProposal } from "./BusinessInformationProposal";
import { businessInformationCopy } from "./businessInformationCopy";

beforeEach(async () => {
  for (const language of ["es", "en"] as const) i18n.addResourceBundle(language, "businessInformationProposal", businessInformationCopy[language]);
  await i18n.changeLanguage("es");
  vi.spyOn(notifications, "notify").mockImplementation(() => "business-mock-notice");
});
afterEach(() => vi.restoreAllMocks());

function openPreview() {
  const router = createMemoryRouter([
    { path: "/configuracion/negocio", element: <><Link to="/configuracion">General</Link><BusinessInformationProposal /></> },
    { path: "/configuracion", element: <h1>General</h1> },
  ], { initialEntries: ["/configuracion/negocio"] });
  render(<TooltipProvider><RouterProvider router={router} /></TooltipProvider>);
  return userEvent.setup();
}

describe("Business information mockup", () => {
  it("keeps missing business facts empty and puts validation beside the fields", async () => {
    const user = openPreview();
    await user.selectOptions(screen.getByLabelText("Estado de la maqueta"), "empty");
    expect(screen.getByLabelText("Horario de atención")).toHaveValue("");
    await user.type(screen.getByRole("textbox", { name: "Nombre del negocio" }), " ");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(screen.getByRole("textbox", { name: "Nombre del negocio" })).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Ingresá el nombre del negocio.")).toHaveAttribute("role", "alert");
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it("preserves the draft when saving fails and emits one operational error", async () => {
    const user = openPreview();
    await user.selectOptions(screen.getByLabelText("Estado de la maqueta"), "saveError");
    await user.clear(screen.getByLabelText("Horario de atención"));
    await user.type(screen.getByLabelText("Horario de atención"), "Sólo los martes.");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(notifications.notify).toHaveBeenCalledWith(expect.objectContaining({ kind: "error", message: businessInformationCopy.es.saveFailed })));
    expect(screen.getByLabelText("Horario de atención")).toHaveValue("Sólo los martes.");
    expect(screen.getByRole("button", { name: "Guardar" })).toBeEnabled();
    expect(notifications.notify).toHaveBeenCalledTimes(1);
  });

  it("merges unedited facts from a new revision without saving the operator's draft", async () => {
    const user = openPreview();
    await user.selectOptions(screen.getByLabelText("Estado de la maqueta"), "conflict");
    await user.clear(screen.getByLabelText("Productos y servicios"));
    await user.type(screen.getByLabelText("Productos y servicios"), "Reparación de frenos.");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await screen.findByRole("heading", { name: "Revisar cambios de otro administrador" });
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Conservar mis cambios" }));
    expect(screen.getByLabelText("Productos y servicios")).toHaveValue("Reparación de frenos.");
    expect(screen.getByLabelText("Horario de atención")).toHaveValue(businessInformationCopy.es.otherHours);
    expect(screen.getByLabelText("Ubicación o zona de atención")).toHaveValue(businessInformationCopy.es.otherLocation);
    expect(screen.getByRole("button", { name: "Guardar" })).toBeEnabled();
    expect(notifications.notify).not.toHaveBeenCalledWith(expect.objectContaining({ kind: "success" }));
  });

  it("keeps an uncertain save locked until its receipt confirms the result", async () => {
    const user = openPreview();
    await user.selectOptions(screen.getByLabelText("Estado de la maqueta"), "uncertain");
    await user.type(screen.getByRole("textbox", { name: "Nombre del negocio" }), " editado");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await screen.findByText("Guardado por revisar");
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Descartar" })).toBeDisabled();
    expect(notifications.notify).toHaveBeenCalledWith(expect.objectContaining({ kind: "error" }));
    await user.click(screen.getByRole("button", { name: "Revisar guardado" }));
    await waitFor(() => expect(screen.queryByText("Guardado por revisar")).not.toBeInTheDocument());
    expect(screen.getByRole("textbox", { name: "Nombre del negocio" })).toHaveValue("Tu negocio editado");
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
    expect(notifications.notify).toHaveBeenCalledWith(expect.objectContaining({ kind: "success", message: businessInformationCopy.es.confirmed }));
  });

  it("does not infer rollback when reviewing a save still returns no receipt", async () => {
    const user = openPreview();
    await user.selectOptions(screen.getByLabelText("Estado de la maqueta"), "unresolved");
    await user.type(screen.getByRole("textbox", { name: "Nombre del negocio" }), " pendiente");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    await screen.findByText("Guardado por revisar");
    await user.click(screen.getByRole("button", { name: "Revisar guardado" }));
    await waitFor(() => expect(notifications.notify).toHaveBeenCalledWith(expect.objectContaining({ message: businessInformationCopy.es.unresolvedMessage })));
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Nombre del negocio" })).toHaveValue("Tu negocio pendiente");
    expect(notifications.notify).not.toHaveBeenCalledWith(expect.objectContaining({ kind: "success" }));
  });

  it("can stay in a dirty editor or explicitly leave after confirming", async () => {
    const user = openPreview();
    await user.type(screen.getByRole("textbox", { name: "Nombre del negocio" }), " editado");
    await user.click(screen.getByRole("link", { name: "General" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Seguir editando" }));
    expect(screen.getByRole("textbox", { name: "Nombre del negocio" })).toHaveValue("Tu negocio editado");
    await user.click(screen.getByRole("link", { name: "General" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Descartar" }));
    expect(await screen.findByRole("heading", { name: "General" })).toBeInTheDocument();
  });

  it("shows facts without editing actions in read-only mode and hides them without read permission", async () => {
    const user = openPreview();
    await user.selectOptions(screen.getByLabelText("Estado de la maqueta"), "readOnly");
    expect(screen.getByRole("textbox", { name: "Nombre del negocio" })).toHaveAttribute("readonly");
    expect(screen.queryByRole("button", { name: "Guardar" })).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Estado de la maqueta"), "denied");
    expect(screen.queryByRole("textbox", { name: "Nombre del negocio" })).not.toBeInTheDocument();
    expect(screen.getByText("No tenés permiso para consultar esta información")).toBeInTheDocument();
    expect(notifications.notify).not.toHaveBeenCalled();
  });
});
