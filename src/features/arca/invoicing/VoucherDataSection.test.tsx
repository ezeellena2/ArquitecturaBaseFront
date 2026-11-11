import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { server } from "@/test/mocks/server";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import type { ArcaConnection } from "../connection/api";
import type { ArcaInvoicingSettings } from "./api";
import { VoucherDataSection } from "./VoucherDataSection";

const connection = { status: "Active" } as ArcaConnection;
let settings: ArcaInvoicingSettings;
let saved: unknown[];
beforeEach(() => {
  settings = { pointOfSale: 5, grossIncomeNumber: null, activityStartOn: null, revision: 1 };
  saved = [];
  server.use(
    http.get("/api/arca/invoicing/settings", () => HttpResponse.json(settings)),
    http.put("/api/arca/invoicing/voucher-data", async ({ request }) => {
      const body = await request.json() as { grossIncomeNumber: string; activityStartOn: string; expectedRevision: number };
      saved.push(body);
      settings = { ...settings, grossIncomeNumber: body.grossIncomeNumber, activityStartOn: body.activityStartOn, revision: settings.revision + 1 };
      return HttpResponse.json(settings);
    }),
  );
});
afterEach(() => { toast.dismiss(); });

const render = (canManage = true, onConflict = () => {}) =>
  renderWithProviders(<MemoryRouter><VoucherDataSection connection={connection} canManage={canManage} onConflict={onConflict} /></MemoryRouter>);
const zone = () => screen.getByRole("region", { name: /Facturación · Datos del comprobante/ });

describe("voucher data", () => {
  it("loads the gross income number and the activity start, trimmed, with the revision it read, and shows the day with numbers", async () => {
    render();
    expect(await screen.findAllByText("Sin cargar")).toHaveLength(2);

    await userEvent.click(within(zone()).getByRole("button", { name: "Cargar" }));
    expect(within(zone()).getByRole("button", { name: "Guardar" })).toBeDisabled();
    await userEvent.type(screen.getByRole("textbox", { name: "Ingresos brutos" }), "  901-123456-7 ");
    await userEvent.type(screen.getByLabelText("Inicio de actividades"), "2019-03-01");
    await userEvent.click(within(zone()).getByRole("button", { name: "Guardar" }));

    expect(await within(zone()).findByText("901-123456-7")).toBeInTheDocument();
    expect(within(zone()).getByText("01/03/2019")).toBeInTheDocument();
    expect(saved).toEqual([{ grossIncomeNumber: "901-123456-7", activityStartOn: "2019-03-01", expectedRevision: 1 }]);
    expect(within(zone()).getByRole("button", { name: "Cambiar" })).toBeInTheDocument();
  });

  it("marks a missing field without saving and keeps what was there on cancel", async () => {
    settings = { pointOfSale: 5, grossIncomeNumber: "901-123456-7", activityStartOn: "2019-03-01", revision: 2 };
    render();
    await userEvent.click(await within(await screen.findByRole("region", { name: /Datos del comprobante/ })).findByRole("button", { name: "Cambiar" }));

    await userEvent.clear(screen.getByRole("textbox", { name: "Ingresos brutos" }));
    await userEvent.click(within(zone()).getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText("Escribí el número de ingresos brutos, de hasta 30 caracteres.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Ingresos brutos" })).toHaveFocus();
    expect(saved).toEqual([]);
    await userEvent.click(within(zone()).getByRole("button", { name: "Cancelar" }));
    expect(within(zone()).getByText("901-123456-7")).toBeInTheDocument();
  });

  it("shows under its field what the server rejected", async () => {
    server.use(http.put("/api/arca/invoicing/voucher-data", () => HttpResponse.json(
      { code: "Validation.Failed", errors: { activityStartOn: ["Elegí la fecha de inicio de actividades."] } }, { status: 400 })));
    render();
    await userEvent.click(await within(await screen.findByRole("region", { name: /Datos del comprobante/ })).findByRole("button", { name: "Cargar" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Ingresos brutos" }), "901-123456-7");
    await userEvent.type(screen.getByLabelText("Inicio de actividades"), "2019-03-01");

    await userEvent.click(within(zone()).getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText("Elegí la fecha de inicio de actividades.")).toBeInTheDocument();
    expect(screen.getByLabelText("Inicio de actividades")).toHaveFocus();
  });

  it("opens the review when someone else saved first", async () => {
    server.use(http.put("/api/arca/invoicing/voucher-data", () => HttpResponse.json({ code: "Arca.Invoicing.SettingsRevisionConflict" }, { status: 409 })));
    const onConflict = vi.fn();
    render(true, onConflict);
    await userEvent.click(await within(await screen.findByRole("region", { name: /Datos del comprobante/ })).findByRole("button", { name: "Cargar" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Ingresos brutos" }), "901-123456-7");
    await userEvent.type(screen.getByLabelText("Inicio de actividades"), "2019-03-01");

    await userEvent.click(within(zone()).getByRole("button", { name: "Guardar" }));

    await vi.waitFor(() => expect(onConflict).toHaveBeenCalledTimes(1));
  });

  it("says when the settings could not be read and offers nothing to load until they are", async () => {
    let fail = true;
    server.use(http.get("/api/arca/invoicing/settings", () => fail ? HttpResponse.json({}, { status: 500 }) : HttpResponse.json(settings)));
    render();

    expect(await within(await screen.findByRole("region", { name: /Datos del comprobante/ })).findByText("No pudimos leer la configuración de Facturación."))
      .toBeInTheDocument();
    expect(within(zone()).queryByRole("button", { name: /Cargar|Cambiar/ })).not.toBeInTheDocument();
    expect(within(zone()).queryByText("Sin cargar")).not.toBeInTheDocument();
    fail = false;
    await userEvent.click(within(zone()).getByRole("button", { name: "Reintentar" }));

    expect(await within(zone()).findByRole("button", { name: "Cargar" })).toBeInTheDocument();
    expect(within(zone()).getAllByText("Sin cargar")).toHaveLength(2);
  });

  it("shows the data without buttons to someone who only reads", async () => {
    settings = { pointOfSale: 5, grossIncomeNumber: "901-123456-7", activityStartOn: "2019-03-01", revision: 2 };
    render(false);
    expect(await screen.findByText("01/03/2019")).toBeInTheDocument();
    expect(within(zone()).queryByRole("button", { name: /Cambiar|Cargar/ })).not.toBeInTheDocument();
  });
});
