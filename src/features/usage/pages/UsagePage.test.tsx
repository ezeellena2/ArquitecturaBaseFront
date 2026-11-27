import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { queryClient } from "@/shared/api/queryClient";
import { initialAppearance } from "@/shared/lib/appearance";
import aiUsage from "@/test/fixtures/usage-http/ai-usage.json" with { type: "json" };
import emptyAiUsage from "@/test/fixtures/usage-http/ai-usage-empty.json" with { type: "json" };
import priceConflict from "@/test/fixtures/usage-http/ai-price-conflict.json" with { type: "json" };
import priceInvalid from "@/test/fixtures/usage-http/ai-price-invalid.json" with { type: "json" };
import priceSaved from "@/test/fixtures/usage-http/ai-price-saved.json" with { type: "json" };
import whatsAppUsage from "@/test/fixtures/usage-http/whatsapp-usage.json" with { type: "json" };
import emptyWhatsAppUsage from "@/test/fixtures/usage-http/whatsapp-usage-empty.json" with { type: "json" };
import unavailable from "@/test/fixtures/usage-http/whatsapp-usage-unavailable.json" with { type: "json" };
import unconfigured from "@/test/fixtures/usage-http/whatsapp-usage-unconfigured.json" with { type: "json" };
import { currentUser } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import type { AiUsage } from "../api/usage";

vi.mock("react-oidc-context", async () => ({ ...(await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context")), useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "t" } }) }));
vi.setConfig({ testTimeout: 15_000 });

// Consumo (CO1-B, 2026-11-27) with the bodies of the plan, written by hand until the exporter of the backend replaces them.
const everything = ["ai.read", "ai.manage", "settings.manage"];
let permissions: string[];
let features: string[];
let reads: string[];
let puts: unknown[];
function serve(ai: (month: string) => Response, whatsapp: (month: string) => Response) {
  server.use(
    http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions })),
    http.get("/api/settings/presentation", () => HttpResponse.json({ appearance: initialAppearance, defaultCulture: "es", defaultTimeZoneId: "America/Argentina/Buenos_Aires", defaultPageSize: 20, installedFeatures: features })),
    http.get("/api/ai/usage", ({ request }) => { const month = new URL(request.url).searchParams.get("month")!; reads.push("ai " + month); return ai(month); }),
    http.get("/api/whatsapp/usage", ({ request }) => { const month = new URL(request.url).searchParams.get("month")!; reads.push("whatsapp " + month); return whatsapp(month); }),
  );
}
beforeEach(() => {
  queryClient.clear(); permissions = everything; features = ["assistant", "whatsapp"]; reads = []; puts = [];
  // The 27th of November in Buenos Aires: the month of the business is 2026-11.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-27T15:00:00Z"));
  serve(month => HttpResponse.json(month === "2026-11" ? aiUsage : emptyAiUsage), month => HttpResponse.json(month === "2026-11" ? whatsAppUsage : emptyWhatsAppUsage));
});
afterEach(() => { vi.useRealTimers(); queryClient.clear(); toast.dismiss(); vi.restoreAllMocks(); });

const aiTable = () => screen.findByRole("table", { name: "Consumo de la inteligencia artificial de 11/2026" });
const whatsAppTable = () => screen.findByRole("table", { name: "Mensajes de WhatsApp de 11/2026" });
// Each row as its cells read, the header row included as an empty one: the row «Total» is a row header and then cells.
const rows = (table: HTMLElement) => within(table).getAllByRole("row").map(row => [...within(row).queryAllByRole("rowheader"), ...within(row).queryAllByRole("cell")].map(cell => cell.textContent));
async function openMonths() {
  const trigger = await screen.findByRole("button", { name: /^Mes / });
  await act(async () => { trigger.focus(); });
  await userEvent.keyboard("{Enter}");
  return screen.findByRole("listbox", { name: "Mes" });
}
async function openPrices(model: string) {
  await userEvent.click(await screen.findByRole("button", { name: `Precios de ${model}` }));
  return screen.findByRole("dialog", { name: `Precios de ${model}` });
}

describe("UsagePage", () => {
  it("shows the summary of the month, the AI per model and WhatsApp per kind of message, as the board", async () => {
    const { router } = renderRouteWithProviders("/configuracion/consumo");
    expect(await screen.findByRole("heading", { level: 1, name: "Consumo" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /^Mes / })).toHaveAccessibleName("Mes 11/2026");
    expect(rows(await aiTable())).toEqual([
      [],
      ["gpt-6.1-sol", "1.284", "2.315.400", "186.250", "—", "USD 4,76", ""],
      ["gpt-transcribe", "118", "—", "—", "96,5 min", "Sin precio", ""],
      ["Total", "1.402", "2.315.400", "186.250", "96,5 min", "USD 4,76", ""],
    ]);
    expect(screen.getByText("Un modelo sin precio no suma al total. 3 pedidos no informaron su uso y no suman tokens. El importe que cobra el proveedor está en su panel.")).toBeVisible();
    expect(rows(await whatsAppTable())).toEqual([
      [],
      ["Marketing", "120", "USD 7,42"],
      ["Utilidad", "310", "USD 4,96"],
      ["Autenticación (códigos de ingreso)", "18", "USD 0,52"],
      ["Atención (respuestas dentro de las 24 h)", "2.480", "USD 0,00"],
      ["Total", "2.928", "USD 12,90"],
    ]);
    const whatsapp = screen.getByRole("region", { name: "WhatsApp" });
    expect(within(whatsapp).getByText("Número").nextElementSibling).toHaveTextContent("+54 9 3406 40-1234");
    const summary = screen.getByRole("region", { name: "Resumen de 11/2026" });
    expect(summary).toHaveTextContent("Inteligencia artificialUSD 4,76Estimado con tus precios");
    expect(summary).toHaveTextContent("WhatsAppUSD 12,90Según Meta");
    expect(summary).toHaveTextContent("Total del mesUSD 17,66Sólo si las dos van en dólares");
    expect(router.state.location.search).toBe("");
    expect(reads).toEqual(["ai 2026-11", "whatsapp 2026-11"]);
  });

  it("offers the last twelve months and keeps the chosen one in the address", async () => {
    const { router } = renderRouteWithProviders("/configuracion/consumo");
    await aiTable();
    const list = await openMonths();
    const options = within(list).getAllByRole("option");
    expect(options.map(option => option.textContent)).toEqual(["11/2026", "10/2026", "09/2026", "08/2026", "07/2026", "06/2026", "05/2026", "04/2026", "03/2026", "02/2026", "01/2026", "12/2025"]);
    await userEvent.click(within(list).getByRole("option", { name: "10/2026" }));
    await waitFor(() => expect(router.state.location.search).toBe("?mes=2026-10"));
    // A month without requests and without messages says so in each zone; what it cost is zero.
    expect(await screen.findByText("En 10/2026 no hubo pedidos a la IA")).toBeVisible();
    expect(await screen.findByText("En 10/2026 Meta no informa mensajes entregados")).toBeVisible();
    const summary = screen.getByRole("region", { name: "Resumen de 10/2026" });
    expect(summary).toHaveTextContent("Inteligencia artificialUSD 0,00");
    expect(summary).toHaveTextContent("Total del mesUSD 0,00");
    expect(reads).toEqual(["ai 2026-11", "whatsapp 2026-11", "ai 2026-10", "whatsapp 2026-10"]);
  });

  it("opens the month of the address, and the current one for a month the list does not offer", async () => {
    renderRouteWithProviders("/configuracion/consumo?mes=2026-10");
    expect(await screen.findByRole("button", { name: /^Mes / })).toHaveAccessibleName("Mes 10/2026");
    await screen.findByText("En 10/2026 no hubo pedidos a la IA");
    queryClient.clear();
    renderRouteWithProviders("/configuracion/consumo?mes=2024-01");
    await waitFor(() => expect(screen.getAllByRole("button", { name: /^Mes / }).at(-1)).toHaveAccessibleName("Mes 11/2026"));
  });

  it("shows only the zone of the AI to whoever reads the AI and not the settings", async () => {
    permissions = ["ai.read"];
    renderRouteWithProviders("/configuracion/consumo");
    await aiTable();
    expect(screen.queryByRole("region", { name: "WhatsApp" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Resumen de 11/2026" })).not.toHaveTextContent("Total del mes");
    // Without «ai.manage» there is no pencil.
    expect(screen.queryByRole("button", { name: "Precios de gpt-6.1-sol" })).not.toBeInTheDocument();
    expect(reads).toEqual(["ai 2026-11"]);
  });

  it("shows only the zone of WhatsApp to whoever manages the settings without the AI", async () => {
    permissions = ["settings.manage"];
    renderRouteWithProviders("/configuracion/consumo");
    await whatsAppTable();
    expect(screen.queryByRole("region", { name: "Inteligencia artificial" })).not.toBeInTheDocument();
    expect(reads).toEqual(["whatsapp 2026-11"]);
  });

  it.each([
    ["without either permission", [] as string[], ["assistant", "whatsapp"]],
    ["with the permissions but without the modules", everything, [] as string[]],
  ])("says «No tenés permiso» %s", async (_, granted, installed) => {
    permissions = granted; features = installed;
    renderRouteWithProviders("/configuracion/consumo");
    expect(await screen.findByText("No tenés permiso")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Consumo" })).toBeInTheDocument();
    expect(reads).toEqual([]);
  });

  it("says that Meta did not answer, with the cause in one notice, and reads it again", async () => {
    const error = vi.spyOn(toast, "error");
    let failed = false;
    serve(() => HttpResponse.json(aiUsage), () => { if (failed) return HttpResponse.json(whatsAppUsage); failed = true; return HttpResponse.json(unavailable, { status: 500 }); });
    renderRouteWithProviders("/configuracion/consumo");
    const zone = await screen.findByRole("region", { name: "WhatsApp" });
    expect(await within(zone).findByText("No pudimos leer el consumo de Meta")).toBeVisible();
    await waitFor(() => expect(error).toHaveBeenCalledWith("Meta no respondió. Probá de nuevo en unos minutos.", expect.objectContaining({ id: "usage:whatsapp" })));
    expect(error).toHaveBeenCalledTimes(1);
    // The zone of the AI keeps working, and the summary says «—» for WhatsApp.
    await aiTable();
    expect(screen.getByRole("region", { name: "Resumen de 11/2026" })).toHaveTextContent("WhatsApp—Según Meta");
    await userEvent.click(within(zone).getByRole("button", { name: "Reintentar" }));
    await whatsAppTable();
  });

  it("says when the installation has no WhatsApp number", async () => {
    serve(() => HttpResponse.json(aiUsage), () => HttpResponse.json(unconfigured));
    renderRouteWithProviders("/configuracion/consumo");
    expect(await screen.findByText("Esta instalación todavía no tiene un número de WhatsApp")).toBeVisible();
    await aiTable();
    const summary = screen.getByRole("region", { name: "Resumen de 11/2026" });
    expect(summary).toHaveTextContent("WhatsApp—Según Meta");
    expect(summary).not.toHaveTextContent("Total del mes");
  });

  it("saves the prices of a model written with a comma, with the revision read, and reads the month again", async () => {
    const success = vi.spyOn(toast, "success");
    server.use(http.put("/api/ai/usage/prices", async ({ request }) => { puts.push(await request.json()); return HttpResponse.json(priceSaved); }));
    renderRouteWithProviders("/configuracion/consumo");
    await aiTable();
    const dialog = await openPrices("gpt-transcribe");
    const save = within(dialog).getByRole("button", { name: "Guardar" });
    expect(save).toBeDisabled();
    const audio = within(dialog).getByRole("textbox", { name: "Audio" });
    expect(audio).toHaveAccessibleDescription(/Vacío: este modelo no cobra por minuto\./);
    await userEvent.type(audio, "0,006");
    await userEvent.click(save);
    await waitFor(() => expect(puts).toEqual([{ provider: "OpenAI", model: "gpt-transcribe", inputUsdPerMillion: null, outputUsdPerMillion: null, audioUsdPerMinute: 0.006, revision: null }]));
    await waitFor(() => expect(success).toHaveBeenCalledWith("Guardamos los precios de gpt-transcribe.", expect.anything()));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(reads.filter(read => read === "ai 2026-11")).toHaveLength(2));
  });

  it("marks a price out of range under its field, before and after sending", async () => {
    server.use(http.put("/api/ai/usage/prices", async ({ request }) => { puts.push(await request.json()); return HttpResponse.json(priceInvalid, { status: 400 }); }));
    renderRouteWithProviders("/configuracion/consumo");
    await aiTable();
    const dialog = await openPrices("gpt-6.1-sol");
    const input = within(dialog).getByRole("textbox", { name: "Entrada" });
    expect(input).toHaveValue("1,25");
    expect(within(dialog).getByRole("textbox", { name: "Salida" })).toHaveValue("10,00");
    await userEvent.clear(input);
    await userEvent.type(input, "1000,5");
    await userEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));
    expect(input).toHaveAccessibleDescription(/Escribí un precio de 0 a 1\.000, con hasta 6 decimales\./);
    expect(input).toHaveFocus();
    expect(puts).toEqual([]);
    await userEvent.clear(input);
    await userEvent.type(input, "2");
    await userEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(within(dialog).getByRole("textbox", { name: "Salida" })).toHaveAccessibleDescription(/El precio va de 0 a 1\.000, con hasta 6 decimales\./));
    expect(puts).toEqual([{ provider: "OpenAI", model: "gpt-6.1-sol", inputUsdPerMillion: 2, outputUsdPerMillion: 10, audioUsdPerMinute: null, revision: 2 }]);
  });

  it("compares with what another person saved after a conflict, and saves again with the revision read", async () => {
    const error = vi.spyOn(toast, "error");
    let current = aiUsage as AiUsage;
    server.use(http.put("/api/ai/usage/prices", async ({ request }) => {
      const body = await request.json() as { revision: number };
      puts.push(body);
      if (body.revision === 2) {
        current = { ...current, models: [{ ...current.models[0]!, price: { inputUsdPerMillion: 1.5, outputUsdPerMillion: 10, audioUsdPerMinute: null, revision: 3 } }, current.models[1]!] };
        return HttpResponse.json(priceConflict, { status: 409 });
      }
      return HttpResponse.json({ provider: "OpenAI", model: "gpt-6.1-sol", inputUsdPerMillion: 1.5, outputUsdPerMillion: 12, audioUsdPerMinute: null, revision: 4 });
    }));
    serve(() => HttpResponse.json(current), () => HttpResponse.json(whatsAppUsage));
    renderRouteWithProviders("/configuracion/consumo");
    await aiTable();
    const dialog = await openPrices("gpt-6.1-sol");
    const output = within(dialog).getByRole("textbox", { name: "Salida" });
    await userEvent.clear(output);
    await userEvent.type(output, "12");
    await userEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(error).toHaveBeenCalledWith("Otra persona cambió los precios de gpt-6.1-sol. Revisá los valores actuales.", expect.anything()));
    // Guardar waits for the choice, with its reason, even after the notice closes.
    expect(within(dialog).getByRole("button", { name: "Guardar" })).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(within(dialog).getByRole("button", { name: "Revisar valores actuales" }));
    const review = await within(dialog).findByRole("region", { name: "Revisar cambios" });
    // Only what differs between what is saved and what would stay: the input that the other person changed is taken as is.
    expect(within(review).getByRole("table")).toHaveTextContent(/Salida\s*10,00\s*12/);
    expect(within(review).queryByText("Entrada")).not.toBeInTheDocument();
    await userEvent.click(within(review).getByRole("button", { name: "Conservar mis cambios" }));
    expect(within(dialog).getByRole("textbox", { name: "Entrada" })).toHaveValue("1,50");
    expect(output).toHaveValue("12");
    await userEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(puts).toHaveLength(2));
    expect(puts[1]).toEqual({ provider: "OpenAI", model: "gpt-6.1-sol", inputUsdPerMillion: 1.5, outputUsdPerMillion: 12, audioUsdPerMinute: null, revision: 3 });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
