import "./BusinessInformationPage";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { queryClient } from "@/shared/api/queryClient";
import { server } from "@/test/mocks/server";
import { currentUser } from "@/test/mocks/handlers";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { cellUnder } from "@/test/utils/tableCells";
import type { BusinessInformation, BusinessSaveRequest } from "../api/businessInformation";
import { emptyBusinessDetails } from "../businessDetailsModel";
import { initialAppearance } from "@/shared/lib/appearance";
vi.mock("react-oidc-context", async () => ({ ...(await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context")), useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));
let current: BusinessInformation;
let writes: BusinessSaveRequest[];
beforeEach(() => {
  queryClient.clear(); writes = [];
  current = { name: "Shop", description: "Repairs", hours: "9–18", location: "Local", services: "", policies: "", faq: "", revision: 1 };
  server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["ai.business.read", "ai.business.manage"] })),
    http.get("/api/ai/business-information", () => HttpResponse.json(current)),
    http.put("/api/ai/business-information", async ({ request }) => {
      const body = await request.json() as BusinessSaveRequest; writes.push(body);
      current = { ...current, ...body, revision: current.revision + 1 };
      return HttpResponse.json({ requestId: body.requestId, revision: current.revision });
    }));
});
afterEach(() => { queryClient.clear(); toast.dismiss(); vi.restoreAllMocks(); });
const save = () => screen.getByRole("button", { name: "Guardar" });
// The state of a day, a time and the zone go in the shared piece for choosing (DS1-A, 2026-11-22); a time or the zone, with
// its search inside.
async function chooseStatus(label: string, status: string, container: HTMLElement = document.body) {
  await userEvent.click(within(container).getByRole("button", { name: new RegExp(`^${label} `) }));
  await userEvent.click(within(await screen.findByRole("listbox", { name: label })).getByRole("option", { name: status }));
}
async function pick(field: string, search: string, option: string, container: HTMLElement = document.body) {
  const trigger = within(container).getByRole("button", { name: new RegExp(`^${field} `) });
  await act(async () => { trigger.focus(); });
  await userEvent.keyboard("{Enter}");
  const list = await screen.findByRole("listbox", { name: field });
  await userEvent.type(screen.getByRole("combobox", { name: `Buscar en ${field}` }), search);
  await userEvent.click(within(list).getByRole("option", { name: option }));
}
const pickTime = (field: string, time: string, container?: HTMLElement) => pick(field, time, time, container);
// The week and the special dates read as tables (IN1-C, IN2 and IN3, 2026-11-22): a day is edited in its dialog, opened by the
// pencil of its row, like a special date.
async function openDay(day: string) {
  await userEvent.click(screen.getByRole("button", { name: `Editar el horario del ${day}` }));
  return screen.findByRole("dialog", { name: `Horario del ${day}` });
}
async function confirmDialog(dialog: HTMLElement, label = "Listo") {
  await userEvent.click(within(dialog).getByRole("button", { name: label }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
}
const week = () => screen.getByRole("table", { name: "Semana" });
const specialDates = () => screen.getByRole("table", { name: "Feriados y fechas especiales" });
const rowOf = (table: HTMLElement, first: string) => within(table).getByRole("row", { name: new RegExp(`^${first} `) });
const hoursOf = (table: HTMLElement, first: string) => cellUnder(table, rowOf(table, first), "Horario");
// A predefined question is chosen in the Picker, which invites to choose one and adds it; six, without the search.
const presets = () => screen.getByRole("button", { name: /^Agregar una pregunta predefinida / });
async function openPresets() {
  const trigger = presets();
  await act(async () => { trigger.focus(); });
  await userEvent.keyboard("{Enter}");
  return screen.findByRole("listbox", { name: "Agregar una pregunta predefinida" });
}
async function addPreset(question: string) {
  await userEvent.click(within(await openPresets()).getByRole("option", { name: question }));
}
// I7: the place search is offered only where the installation publishes `place-search` (it has the Google key).
const withPlaceSearch = (installed: boolean) => server.use(http.get("/api/settings/presentation", () => HttpResponse.json({ appearance: initialAppearance,
  defaultCulture: "es", defaultTimeZoneId: "America/Argentina/Buenos_Aires", defaultPageSize: 20, installedFeatures: installed ? ["place-search"] : [] })));
const field = () => screen.getByRole("textbox", { name: "Nombre del negocio" });
// The editor is long and several tests type into it: alone each takes 2 to 5 s, and with the whole suite they went past the 5 s.
describe("business information editor", { timeout: 15_000 }, () => {
  it("saves only the selected ID and manually entered address, without provider text or supplied URLs", async () => {
    current.details = emptyBusinessDetails("UTC");
    current.details.location = { mode: "local", address: "My address", reference: "", area: "", latitude: null, longitude: null };
    withPlaceSearch(true);
    server.use(http.post("/api/ai/business-information/places/search", () => HttpResponse.json({ places: [{ placeId: "ChIJ_example", label: "Provider name and address" }] })));
    renderRouteWithProviders("/configuracion/negocio");
    const search = await screen.findByRole("combobox", { name: "Buscar un lugar" });
    await userEvent.click(search);
    await userEvent.paste("Example clinic City");
    await userEvent.click(await screen.findByRole("option", { name: "Provider name and address" }));
    expect(screen.getByRole("textbox", { name: "Dirección del local" })).toHaveValue("My address");
    expect(writes).toHaveLength(0);
    await userEvent.click(save());
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0].details?.location).toEqual({ mode: "local", address: "My address", reference: "", area: "", latitude: null, longitude: null, placeId: "ChIJ_example" });
    expect(JSON.stringify(writes)).not.toContain("Provider name and address");
    expect(writes[0].details?.location).not.toHaveProperty("link");
  });
  it("does not offer the place search where the installation has no Google key, and the address stays manual", async () => {
    withPlaceSearch(false);
    let searches = 0;
    server.use(http.post("/api/ai/business-information/places/search", () => { searches++; return HttpResponse.json({ places: [] }); }));
    current.details = emptyBusinessDetails("UTC");
    current.details.location = { mode: "local", address: "My address", reference: "", area: "", latitude: null, longitude: null };
    renderRouteWithProviders("/configuracion/negocio");
    const address = await screen.findByRole("textbox", { name: "Dirección del local" });
    await userEvent.type(address, " 123");
    expect(screen.queryByRole("combobox", { name: "Buscar un lugar" })).not.toBeInTheDocument();
    expect(screen.queryByText("Google Maps")).not.toBeInTheDocument();
    expect(searches).toBe(0);
  });
  it("sends structured facts with one revision and no client supplied link", async () => {
    current.details = emptyBusinessDetails("UTC");
    current.details.location = { mode: "local", address: "Address", reference: "", area: "", latitude: -34.6037, longitude: -58.3816, link: "https://untrusted.invalid/" };
    renderRouteWithProviders("/configuracion/negocio");
    const address = await screen.findByRole("textbox", { name: "Dirección del local" });
    await userEvent.type(address, " Updated");
    expect(screen.getByRole("textbox", { name: "Enlace de la ubicación" })).toHaveValue("");
    const monday = await openDay("lunes");
    await chooseStatus("Atención", "24 horas", monday);
    await confirmDialog(monday);
    expect(hoursOf(week(), "Lunes")).toHaveTextContent("24 horas");
    expect(presets()).toHaveAccessibleName("Agregar una pregunta predefinida Elegí una pregunta");
    await addPreset("¿Hace falta reservar?");
    // The field invites to choose again, and the list no longer offers the question that was added.
    expect(presets()).toHaveAccessibleName("Agregar una pregunta predefinida Elegí una pregunta");
    expect(within(await openPresets()).queryByRole("option", { name: "¿Hace falta reservar?" })).not.toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    const answer = screen.getByRole("textbox", { name: "Respuesta del negocio" });
    expect(answer).toHaveValue("");
    await userEvent.type(answer, "Confirmed answer");
    await userEvent.click(save());
    await waitFor(() => expect(save()).toBeDisabled());
    expect(writes).toHaveLength(1);
    expect(writes[0].details?.location).toEqual({ mode: "local", address: "Address Updated", reference: "", area: "", latitude: null, longitude: null });
    expect(writes[0].details?.openingHours.days[0]).toMatchObject({ status: "allDay", periods: [] });
    expect(writes[0].details?.faq[0].answer).toBe("Confirmed answer");
    expect(writes[0].expectedRevision).toBe(1);
    expect(writes[0]).toMatchObject({ hours: "9–18", location: "Local" });
  });
  it("chooses where it serves among four radios, and serving only in an area leaves the store out", async () => {
    current.details = emptyBusinessDetails("UTC");
    current.details.location = { mode: "local", address: "Address", reference: "Por el portón", area: "", latitude: null, longitude: null };
    renderRouteWithProviders("/configuracion/negocio");
    // The four ways of attending go in the shared piece for choosing (DS1-A, 2026-11-22).
    await userEvent.click(await screen.findByRole("button", { name: "Dónde atendés En un local" }));
    const where = await screen.findByRole("listbox", { name: "Dónde atendés" });
    expect(within(where).getAllByRole("option").map(option => option.textContent)).toEqual(["Sin definir", "En un local", "Sólo en una zona", "Local y zona de atención"]);
    expect(within(where).getByRole("option", { name: "En un local" })).toHaveAttribute("aria-selected", "true");
    await userEvent.click(within(where).getByRole("option", { name: "Sólo en una zona" }));
    expect(screen.queryByRole("textbox", { name: "Dirección del local" })).not.toBeInTheDocument();
    await userEvent.type(screen.getByRole("textbox", { name: "Zona de atención o entrega" }), "Zona norte");
    await userEvent.click(save());
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0].details?.location).toMatchObject({ mode: "area", address: "", reference: "", area: "Zona norte", latitude: null, longitude: null });
  });
  it("takes the zone of the hours from the only list, by its city, and sends its identifier", async () => {
    current.details = emptyBusinessDetails("UTC");
    renderRouteWithProviders("/configuracion/negocio");
    expect(await screen.findByRole("button", { name: "Zona horaria del horario UTC" })).toBeInTheDocument();
    await pick("Zona horaria del horario", "Montev", "Montevideo");
    expect(screen.getByRole("button", { name: "Zona horaria del horario Montevideo" })).toBeInTheDocument();
    await userEvent.click(save());
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0].details?.openingHours.timeZoneId).toBe("America/Montevideo");
  });
  it("checks on Save what crosses from one day into the next, under the week, before making a request", async () => {
    current.details = emptyBusinessDetails("UTC");
    renderRouteWithProviders("/configuracion/negocio");
    await screen.findByRole("textbox", { name: "Nombre del negocio" });
    // Each day passes its own dialog: the Saturday closes at 2 the next day and the Sunday opens at 1.
    const saturday = await openDay("sábado");
    await chooseStatus("Atención", "Abierto", saturday);
    await pickTime("Sábado 1 · Desde", "20:00", saturday);
    await pickTime("Sábado 1 · Hasta", "02:00", saturday);
    await userEvent.click(within(saturday).getByRole("checkbox", { name: "Cierra al día siguiente" }));
    await confirmDialog(saturday);
    const sunday = await openDay("domingo");
    await chooseStatus("Atención", "Abierto", sunday);
    await pickTime("Domingo 1 · Desde", "01:00", sunday);
    await pickTime("Domingo 1 · Hasta", "08:00", sunday);
    await confirmDialog(sunday);
    expect(hoursOf(week(), "Sábado")).toHaveTextContent("20:00 – 02:00 del día siguiente");
    const hours = screen.getByRole("group", { name: "Horario de atención" });
    expect(hours).toHaveAttribute("aria-invalid", "false");
    await userEvent.click(save());
    expect(within(hours).getByRole("alert")).toHaveTextContent("Hay franjas superpuestas. Revisá también las que cierran al día siguiente.");
    expect(hours).toHaveFocus();
    expect(writes).toHaveLength(0);
  });
  it("marks an incomplete period of a day only on «Listo», keeps its dialog open and follows the correction", async () => {
    current.details = emptyBusinessDetails("UTC");
    renderRouteWithProviders("/configuracion/negocio");
    await screen.findByRole("textbox", { name: "Nombre del negocio" });
    const monday = await openDay("lunes");
    await chooseStatus("Atención", "Abierto", monday);
    // Abrir un día deja su franja por completar: no es un problema hasta tocar «Listo».
    expect(within(monday).queryByRole("alert")).not.toBeInTheDocument();
    await userEvent.click(within(monday).getByRole("button", { name: "Listo" }));
    expect(screen.getByRole("dialog")).toBe(monday);
    expect(within(monday).getByRole("alert")).toHaveTextContent("Elegí apertura y cierre para cada franja.");
    // Después del primer intento, el mensaje sigue lo que se corrige sin volver a tocar «Listo».
    await pickTime("Lunes 1 · Desde", "18:00", monday);
    await pickTime("Lunes 1 · Hasta", "09:00", monday);
    expect(within(monday).getByRole("alert")).toHaveTextContent("El cierre debe ser posterior");
    await pickTime("Lunes 1 · Hasta", "20:00", monday);
    expect(within(monday).queryByRole("alert")).not.toBeInTheDocument();
    await confirmDialog(monday);
    expect(hoursOf(week(), "Lunes")).toHaveTextContent("18:00 – 20:00");
    expect(writes).toHaveLength(0);
  });
  it("keeps «Agregar franja» in one place and gives its limit as the reason when there are four periods", async () => {
    current.details = emptyBusinessDetails("UTC");
    renderRouteWithProviders("/configuracion/negocio");
    await screen.findByRole("textbox", { name: "Nombre del negocio" });
    const monday = await openDay("lunes");
    await chooseStatus("Atención", "Abierto", monday);
    const add = within(monday).getByRole("button", { name: "Agregar franja · Lunes" });
    expect(add).toHaveTextContent("Agregar franja");
    expect(screen.queryByRole("button", { name: /^Quitar franja · Lunes/ })).not.toBeInTheDocument();
    // The same button, below the periods, with one, two and three of them: it neither moves nor changes its form.
    await userEvent.click(add);
    expect(screen.getByRole("button", { name: "Agregar franja · Lunes" })).toBe(add);
    expect(screen.getAllByRole("button", { name: /^Quitar franja · Lunes/ })).toHaveLength(2);
    await userEvent.click(add);
    expect(screen.getByRole("button", { name: "Agregar franja · Lunes" })).toBe(add);
    await userEvent.click(add);
    const limited = screen.getByRole("button", { name: "Agregar franja · Lunes" });
    expect(limited).toHaveAttribute("aria-disabled", "true");
    expect(limited).toHaveAccessibleDescription("Podés agregar hasta 4 franjas.");
    expect(screen.getAllByRole("button", { name: /^Lunes \d · Desde / })).toHaveLength(4);
    await userEvent.hover(limited);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Podés agregar hasta 4 franjas.");
  });
  it("lets Confirm validate a special date instead of disabling it", async () => {
    current.details = emptyBusinessDetails("UTC");
    renderRouteWithProviders("/configuracion/negocio");
    await screen.findByRole("textbox", { name: "Nombre del negocio" });
    await userEvent.click(screen.getByRole("button", { name: "Agregar fecha especial" }));
    const dialog = await screen.findByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: "Agregar fecha" });
    const date = within(dialog).getByLabelText("Fecha");
    await chooseStatus("Atención", "Abierto", dialog);
    // Confirmar está habilitado y la franja recién abierta no se marca antes de tocarlo.
    expect(confirm).toBeEnabled();
    expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
    await userEvent.click(confirm);
    expect(screen.getByRole("dialog")).toBe(dialog);
    expect(date).toHaveAccessibleDescription("Elegí la fecha.");
    expect(date).toHaveFocus();
    expect(within(dialog).getByText("Elegí apertura y cierre para cada franja.")).toHaveAttribute("role", "alert");
    // Después del intento, cada error se va mientras se corrige.
    await userEvent.type(date, "2026-10-24");
    expect(date).not.toHaveAccessibleDescription("Elegí la fecha.");
    await pickTime("Fecha 1 · Desde", "09:00", dialog);
    await pickTime("Fecha 1 · Hasta", "13:00", dialog);
    expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
    await userEvent.click(confirm);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    // The date with numbers only, day first in Spanish (2026-11-10), never as it is stored, and each piece in its column (IN3).
    const row = rowOf(specialDates(), "24/10/2026");
    expect(cellUnder(specialDates(), row, "Fecha")).toHaveTextContent("24/10/2026");
    expect(cellUnder(specialDates(), row, "Horario")).toHaveTextContent("09:00 – 13:00");
    expect(within(row).getByRole("button", { name: "Editar fecha 24/10/2026" })).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Quitar fecha 24/10/2026" })).toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });
  it("labels the state and the hours of a special date as fields, with the error of the hours in its field", async () => {
    current.details = emptyBusinessDetails("UTC");
    renderRouteWithProviders("/configuracion/negocio");
    await screen.findByRole("textbox", { name: "Nombre del negocio" });
    await userEvent.click(screen.getByRole("button", { name: "Agregar fecha especial" }));
    const dialog = await screen.findByRole("dialog", { name: "Horario de una fecha especial" });
    // Like the date, each part has its visible label (lista de chequeo, 2026-11-11): «Atención» names the state and
    // «Horario» its time slots, which appear only when the date is open.
    expect(within(dialog).getByText("Atención", { ignore: "button *, script, style" })).toBeVisible();
    expect(within(dialog).queryByRole("group", { name: "Horario" })).not.toBeInTheDocument();
    await chooseStatus("Atención", "Abierto", dialog);
    const hours = within(dialog).getByRole("group", { name: "Horario" });
    expect(within(dialog).getByText("Horario", { selector: "label" })).toBeVisible();
    expect(within(hours).getByRole("button", { name: "Fecha 1 · Desde Elegir" })).toBeInTheDocument();
    expect(within(hours).getByRole("button", { name: "Fecha 1 · Hasta Elegir" })).toBeInTheDocument();
    expect(within(hours).getByRole("button", { name: "Agregar franja · Fecha" })).toBeInTheDocument();
    expect(hours).not.toHaveAttribute("aria-invalid");
    await userEvent.type(within(dialog).getByLabelText("Fecha"), "2026-10-10");
    await userEvent.click(within(dialog).getByRole("button", { name: "Agregar fecha" }));
    // The problem of the time slots goes under «Horario» and describes its group, not loose at the end of the dialog.
    const problem = within(dialog).getByRole("alert");
    expect(problem).toHaveTextContent("Elegí apertura y cierre para cada franja.");
    expect(hours).toHaveAttribute("aria-invalid", "true");
    expect(hours).toHaveAccessibleDescription("Elegí apertura y cierre para cada franja.");
    expect(hours.parentElement).toContainElement(problem);
    await pickTime("Fecha 1 · Desde", "09:00", hours);
    await pickTime("Fecha 1 · Hasta", "13:00", hours);
    expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
    expect(hours).not.toHaveAttribute("aria-invalid");
    expect(hours).not.toHaveAccessibleDescription();
  });
  it("adds a special date over an incomplete weekly day and leaves that day for Save", async () => {
    // A saved Monday that opens without periods: the dialog of a day no longer lets one through, but saved data may bring it.
    current.details = emptyBusinessDetails("UTC");
    current.details.openingHours.days[0] = { weekday: 0, status: "open", periods: [] };
    renderRouteWithProviders("/configuracion/negocio");
    await screen.findByRole("textbox", { name: "Nombre del negocio" });
    await userEvent.click(screen.getByRole("button", { name: "Agregar fecha especial" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Fecha"), "2026-10-10");
    await userEvent.click(within(dialog).getByRole("button", { name: "Agregar fecha" }));
    // La franja vacía del lunes no es de esta fecha: el diálogo no la marca y la fecha cerrada entra.
    expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(hoursOf(specialDates(), "10/10/2026")).toHaveTextContent("Cerrado");
    const hours = screen.getByRole("group", { name: "Horario de atención" });
    expect(within(hours).queryByRole("alert")).not.toBeInTheDocument();
    // Lo que sí trae una fecha, como repetirla, se sigue marcando en el diálogo aunque el lunes siga incompleto.
    await userEvent.click(screen.getByRole("button", { name: "Agregar fecha especial" }));
    const repeated = await screen.findByRole("dialog");
    const repeatedDate = within(repeated).getByLabelText("Fecha");
    await userEvent.type(repeatedDate, "2026-10-10");
    await userEvent.click(within(repeated).getByRole("button", { name: "Agregar fecha" }));
    expect(repeatedDate).toHaveAccessibleDescription("Revisá las fechas especiales: no pueden repetirse y se admiten hasta 32.");
    await userEvent.click(within(repeated).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await userEvent.click(save());
    expect(within(hours).getByRole("alert")).toHaveTextContent("Elegí apertura y cierre para cada franja.");
    expect(hours).toHaveFocus();
    expect(writes).toHaveLength(0);
  });
  it("reads the week in a table, a day per row, with its periods or its state, and copies Monday to the weekdays", async () => {
    current.details = emptyBusinessDetails("UTC");
    current.details.openingHours.days = current.details.openingHours.days.map(day => day.weekday === 0 ? { ...day, status: "open" as const, periods: [{ start: "09:00", end: "13:00", nextDay: false }, { start: "16:00", end: "20:00", nextDay: false }] }
      : day.weekday === 1 ? { ...day, status: "allDay" as const } : day.weekday === 2 ? { ...day, status: "closed" as const }
      : day.weekday === 6 ? { ...day, status: "open" as const, periods: [{ start: "20:00", end: "02:00", nextDay: true }] } : day);
    renderRouteWithProviders("/configuracion/negocio");
    const table = await screen.findByRole("table", { name: "Semana" });
    expect(within(table).getAllByRole("columnheader").map(cell => cell.textContent)).toEqual(["Día", "Horario", "Acciones"]);
    expect(within(table).getAllByRole("row")).toHaveLength(8);
    // One piece of data per column: the periods of a day, one per line, or its state when it does not open.
    const monday = hoursOf(table, "Lunes");
    expect([...monday.querySelectorAll(":scope > span")].map(line => line.textContent)).toEqual(["09:00 – 13:00", "16:00 – 20:00"]);
    expect(hoursOf(table, "Martes")).toHaveTextContent("24 horas");
    expect(hoursOf(table, "Miércoles")).toHaveTextContent("Cerrado");
    expect(within(hoursOf(table, "Jueves")).getByText("Sin definir")).toHaveClass("text-[var(--color-content-muted)]");
    expect(hoursOf(table, "Domingo")).toHaveTextContent("20:00 – 02:00 del día siguiente");
    // The pencil of a row names its day; nothing in a row is a button with text (2026-11-20).
    expect(within(rowOf(table, "Lunes")).getAllByRole("button").map(button => button.getAttribute("aria-label") ?? button.textContent)).toEqual(["Editar el horario del lunes"]);
    await userEvent.click(screen.getByRole("button", { name: "Aplicar lunes a viernes" }));
    expect(hoursOf(table, "Viernes")).toHaveTextContent("16:00 – 20:00");
    expect(hoursOf(table, "Sábado")).toHaveTextContent("Sin definir");
  });
  it("edits a special date with «Listo», Cancel changes nothing and removing the last date takes its table", async () => {
    current.details = emptyBusinessDetails("UTC");
    current.details.openingHours.exceptions = [{ date: "2026-12-25", status: "closed", periods: [] }];
    renderRouteWithProviders("/configuracion/negocio");
    await userEvent.click(within(await screen.findByRole("table", { name: "Feriados y fechas especiales" })).getByRole("button", { name: "Editar fecha 25/12/2026" }));
    const dialog = await screen.findByRole("dialog", { name: "Horario de una fecha especial" });
    expect(within(dialog).getByLabelText("Fecha")).toHaveValue("2026-12-25");
    // Editing does not add: the button says «Listo».
    expect(within(dialog).queryByRole("button", { name: "Agregar fecha" })).not.toBeInTheDocument();
    await chooseStatus("Atención", "Abierto", dialog);
    await pickTime("Fecha 1 · Desde", "09:00", dialog);
    await pickTime("Fecha 1 · Hasta", "13:00", dialog);
    await confirmDialog(dialog);
    expect(hoursOf(specialDates(), "25/12/2026")).toHaveTextContent("09:00 – 13:00");
    const monday = await openDay("lunes");
    await chooseStatus("Atención", "24 horas", monday);
    await userEvent.click(within(monday).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(hoursOf(week(), "Lunes")).toHaveTextContent("Sin definir");
    await userEvent.click(screen.getByRole("button", { name: "Quitar fecha 25/12/2026" }));
    expect(screen.queryByRole("table", { name: "Feriados y fechas especiales" })).not.toBeInTheDocument();
    await userEvent.click(save());
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0].details?.openingHours.exceptions).toEqual([]);
  });
  it("keeps the business header without an unsaved status", async () => {
    renderRouteWithProviders("/configuracion/negocio");
    await userEvent.type(await screen.findByRole("textbox", { name: "Nombre del negocio" }), " Updated");
    const header = screen.getByRole("heading", { level: 1, name: "Información del negocio" }).closest("header") as HTMLElement;
    // Guardar habilitado ya dice que hay cambios: la banda tiene el título y sus acciones, sin estado del borrador.
    expect(within(header).getByRole("button", { name: "Guardar" })).toBeEnabled();
    expect(header.textContent).toBe("Información del negocioDescartarGuardar");
    expect(screen.queryByText("Cambios sin guardar")).not.toBeInTheDocument();
  });
  it("puts the recovery actions at the edge of their surface band", async () => {
    server.use(http.put("/api/ai/business-information", async ({ request }) => {
      writes.push(await request.json() as BusinessSaveRequest); current = { ...current, hours: "10–17", revision: 2 };
      return HttpResponse.json({ code: "Ai.BusinessInformation.RevisionConflict" }, { status: 409 });
    }));
    renderRouteWithProviders("/configuracion/negocio");
    await userEvent.type(await screen.findByRole("textbox", { name: "Nombre del negocio" }), " Updated");
    await userEvent.click(save());
    const review = await screen.findByRole("region", { name: "Revisar cambios de otro administrador" });
    // Revisar y elegir actúan sobre toda la recuperación: van en la banda de su superficie; el cuerpo explica el estado.
    const band = within(review).getByRole("heading", { level: 2, name: "Revisar cambios de otro administrador" }).parentElement as HTMLElement;
    await userEvent.click(within(band).getByRole("button", { name: "Revisar cambios" }));
    expect(await within(band).findByRole("button", { name: "Conservar mis cambios" })).toBeEnabled();
    expect(within(band).getAllByRole("button").map(button => button.textContent)).toEqual(["Revisar cambios", "Usar información actual", "Conservar mis cambios"]);
    expect(within(review).getAllByRole("button")).toEqual(within(band).getAllByRole("button"));
  });
  it("keeps structured facts frozen when an uncertain save is retried", async () => {
    current.details = emptyBusinessDetails("UTC");
    server.use(http.put("/api/ai/business-information", async ({ request }) => { writes.push(await request.json() as BusinessSaveRequest); return HttpResponse.error(); }),
      http.get("/api/ai/business-information/changes/:id", () => HttpResponse.json({ code: "Ai.BusinessInformation.ChangeNotFound" }, { status: 404 })));
    renderRouteWithProviders("/configuracion/negocio");
    await screen.findByRole("textbox", { name: "Nombre del negocio" });
    const mondayDialog = await openDay("lunes");
    await chooseStatus("Atención", "Cerrado", mondayDialog);
    await confirmDialog(mondayDialog);
    await userEvent.click(save());
    await userEvent.click(await screen.findByRole("button", { name: "Revisar guardado" }));
    expect(screen.getByRole("button", { name: "Editar el horario del lunes" })).toBeDisabled();
    expect(hoursOf(week(), "Lunes")).toHaveTextContent("Cerrado");
    await userEvent.click(await screen.findByRole("button", { name: "Reintentar el mismo guardado" }));
    await waitFor(() => expect(writes).toHaveLength(2));
    expect(writes[1]).toEqual(writes[0]);
    expect(writes[1].details?.openingHours.days[0].status).toBe("closed");
  });
  it("saves real fields with revision and returns to the saved state", async () => {
    renderRouteWithProviders("/configuracion/negocio");
    await userEvent.type(await screen.findByRole("textbox", { name: "Nombre del negocio" }), " Updated");
    await userEvent.click(save());
    await waitFor(() => expect(writes).toHaveLength(1));
    await waitFor(() => expect(save()).toBeDisabled());
    expect(writes[0]).toMatchObject({ name: "Shop Updated", expectedRevision: 1 });
    expect(writes[0].requestId).toMatch(/^[0-9a-f-]{36}$/);
  });
  it("validates beside the fields without a duplicate operational notice", async () => {
    const notice = vi.spyOn(toast, "error");
    renderRouteWithProviders("/configuracion/negocio");
    await userEvent.clear(await screen.findByRole("textbox", { name: "Nombre del negocio" }));
    await userEvent.click(save());
    expect(await screen.findByText("Ingresá el nombre del negocio.")).toBeInTheDocument();
    expect(field()).toHaveFocus();
    expect(writes).toHaveLength(0);
    expect(notice).not.toHaveBeenCalled();
  });
  it("confirms a lost reply by receipt without repeating the write", async () => {
    let id = "";
    server.use(http.put("/api/ai/business-information", async ({ request }) => {
      const body = await request.json() as BusinessSaveRequest; writes.push(body); id = body.requestId;
      current = { ...current, ...body, revision: 2 }; return HttpResponse.error();
    }), http.get("/api/ai/business-information/changes/:id", () => HttpResponse.json({ requestId: id, revision: 2 })));
    renderRouteWithProviders("/configuracion/negocio");
    await userEvent.type(await screen.findByRole("textbox", { name: "Nombre del negocio" }), " Updated");
    await userEvent.click(save());
    await userEvent.click(await screen.findByRole("button", { name: "Revisar guardado" }));
    await waitFor(() => expect(save()).toBeDisabled());
    expect(writes).toHaveLength(1);
    expect(field()).toHaveValue("Shop Updated");
  });
  // EP1-A (2026-11-06): the header says «Guardado por revisar»; nothing under it repeats it. Checking goes next to Save, and what the
  // zone explained is the reason of Save, off.
  it("checks an uncertain save from the header, with the reason on Save and no zone that repeats it", async () => {
    server.use(http.put("/api/ai/business-information", async ({ request }) => { writes.push(await request.json() as BusinessSaveRequest); return HttpResponse.error(); }),
      http.get("/api/ai/business-information/changes/:id", () => HttpResponse.json({ code: "Ai.BusinessInformation.ChangeNotFound" }, { status: 404 })));
    renderRouteWithProviders("/configuracion/negocio");
    await userEvent.type(await screen.findByRole("textbox", { name: "Nombre del negocio" }), " Updated");
    await userEvent.click(save());
    const check = await screen.findByRole("button", { name: "Revisar guardado" });
    const header = check.closest("header")!;
    expect(header).toHaveTextContent("Guardado por revisar");
    expect(screen.queryByRole("region", { name: "Guardado por revisar" })).not.toBeInTheDocument();
    expect(save()).toHaveAccessibleDescription("Tus cambios se conservan. Primero consultá el resultado de este guardado.");
    await userEvent.click(check);
    expect(await within(header).findByRole("button", { name: "Reintentar el mismo guardado" })).toBeEnabled();
    expect(save()).toHaveAccessibleDescription("No encontramos el comprobante. Esto no demuestra que el guardado haya fallado. Podés consultar otra vez o reintentar exactamente el mismo pedido.");
  });
  it("a missing receipt keeps the draft locked and explicit retry preserves the identical request", async () => {
    server.use(http.put("/api/ai/business-information", async ({ request }) => { writes.push(await request.json() as BusinessSaveRequest); return HttpResponse.error(); }),
      http.get("/api/ai/business-information/changes/:id", () => HttpResponse.json({ code: "Ai.BusinessInformation.ChangeNotFound" }, { status: 404 })));
    renderRouteWithProviders("/configuracion/negocio");
    await userEvent.type(await screen.findByRole("textbox", { name: "Nombre del negocio" }), " Updated");
    await userEvent.click(save());
    await userEvent.click(await screen.findByRole("button", { name: "Revisar guardado" }));
    await userEvent.click(await screen.findByRole("button", { name: "Reintentar el mismo guardado" }));
    await waitFor(() => expect(writes).toHaveLength(2));
    expect(writes[1]).toEqual(writes[0]);
    expect(field()).toBeDisabled();
    expect(field()).toHaveValue("Shop Updated");
  });
  // Each changed fact once, the saved value and the draft's in their columns (LR2-A): a day by its name, never «Lunes: Abierto…».
  it("reads a conflict side by side, with only the days that changed", async () => {
    current.details = emptyBusinessDetails("UTC");
    server.use(http.put("/api/ai/business-information", async ({ request }) => {
      writes.push(await request.json() as BusinessSaveRequest);
      const details = emptyBusinessDetails("UTC");
      current = { ...current, services: "Semillas", revision: 2, details: { ...details, openingHours: { ...details.openingHours,
        days: details.openingHours.days.map(day => day.weekday === 0 ? { ...day, status: "open" as const, periods: [{ start: "09:00", end: "18:00", nextDay: false }] } : day) } } };
      return HttpResponse.json({ code: "Ai.BusinessInformation.RevisionConflict" }, { status: 409 });
    }));
    renderRouteWithProviders("/configuracion/negocio");
    await screen.findByRole("textbox", { name: "Nombre del negocio" });
    const mondayDialog = await openDay("lunes");
    await chooseStatus("Atención", "Cerrado", mondayDialog);
    await confirmDialog(mondayDialog);
    await userEvent.click(save());
    const review = await screen.findByRole("region", { name: "Revisar cambios de otro administrador" });
    await userEvent.click(within(review).getByRole("button", { name: "Revisar cambios" }));
    const table = await within(review).findByRole("table");
    expect(within(table).getAllByRole("columnheader").map(header => header.textContent)).toEqual(["Qué cambió", "Dato", "Guardado actualmente", "Tu borrador"]);
    const services = within(table).getByRole("rowheader", { name: "Productos y servicios" }).closest("tr")!;
    expect(within(services).getAllByRole("cell").map(cell => cell.textContent)).toEqual(["Semillas", "Sin información"]);
    expect(within(table).getByRole("rowheader", { name: "Horario de atención" })).toBeInTheDocument();
    const monday = within(table).getByRole("rowheader", { name: "Lunes" }).closest("tr")!;
    expect(within(monday).getAllByRole("cell").map(cell => cell.textContent)).toEqual(["Abierto 09:00–18:00", "Cerrado"]);
    expect(within(table).queryByRole("rowheader", { name: "Martes" })).not.toBeInTheDocument();
    expect(table).not.toHaveTextContent("Lunes:");
  });
  it("reviews a conflict and merges untouched facts before an explicit new save", async () => {
    server.use(http.put("/api/ai/business-information", async ({ request }) => {
      writes.push(await request.json() as BusinessSaveRequest); current = { ...current, hours: "10–17", revision: 2 };
      return HttpResponse.json({ code: "Ai.BusinessInformation.RevisionConflict" }, { status: 409 });
    }));
    renderRouteWithProviders("/configuracion/negocio");
    await userEvent.type(await screen.findByRole("textbox", { name: "Nombre del negocio" }), " Updated");
    await userEvent.click(save());
    await userEvent.click(await screen.findByRole("button", { name: "Revisar cambios" }));
    await userEvent.click(await screen.findByRole("button", { name: "Conservar mis cambios" }));
    expect(field()).toHaveValue("Shop Updated");
    expect(screen.getByRole("textbox", { name: "Horario de atención" })).toHaveValue("10–17");
    expect(writes).toHaveLength(1);
    expect(save()).toBeEnabled();
  });
  // El límite es el motivo de los controles apagados (tooltip y descripción accesible), sin textos al lado.
  it("explains the limit of questions on the disabled ways to add one", async () => {
    current.details = { ...emptyBusinessDetails("UTC"), faq: Array.from({ length: 20 }, (_, index) => ({ id: crypto.randomUUID(), question: `Pregunta ${index + 1}`, answer: "Sí" })) };
    renderRouteWithProviders("/configuracion/negocio");
    const custom = await screen.findByRole("button", { name: "Escribir otra pregunta" });
    const preset = presets();
    expect(custom).toHaveAttribute("aria-disabled", "true");
    expect(custom).toHaveAccessibleDescription("Podés agregar hasta 20 preguntas.");
    expect(preset).toBeDisabled();
    expect(preset).toHaveAccessibleDescription("Podés agregar hasta 20 preguntas.");
    await userEvent.hover(custom);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Podés agregar hasta 20 preguntas.");
  });
  it("explains the limit of special dates on the disabled Add special date", async () => {
    const details = emptyBusinessDetails("UTC");
    const exceptions = Array.from({ length: 32 }, (_, index) => ({ date: new Date(Date.UTC(2026, 11, 1 + index)).toISOString().slice(0, 10), status: "closed" as const, periods: [] }));
    current.details = { ...details, openingHours: { ...details.openingHours, exceptions } };
    renderRouteWithProviders("/configuracion/negocio");
    const add = await screen.findByRole("button", { name: "Agregar fecha especial" });
    expect(add).toHaveAttribute("aria-disabled", "true");
    expect(add).toHaveAccessibleDescription("Podés agregar hasta 32 fechas especiales.");
    await userEvent.hover(add);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Podés agregar hasta 32 fechas especiales.");
  });
  it("read access shows facts without offering edit actions", async () => {
    server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["ai.business.read"] })));
    renderRouteWithProviders("/configuracion/negocio");
    expect(await screen.findByRole("textbox", { name: "Nombre del negocio" })).toHaveAttribute("readonly");
    expect(screen.queryByRole("button", { name: "Guardar" })).not.toBeInTheDocument();
    // «Sólo lectura» junto al título ya lo dice: sin un párrafo que lo repita.
    const header = screen.getByRole("heading", { level: 1, name: "Información del negocio" }).closest("header") as HTMLElement;
    expect(header.textContent).toBe("Información del negocioSólo lectura");
    expect(screen.queryByText(/Podés consultar esta información/)).not.toBeInTheDocument();
    // La semana se lee sin la columna del lápiz y sin los botones que cambian el horario (IN3).
    expect(within(week()).getAllByRole("columnheader").map(cell => cell.textContent)).toEqual(["Día", "Horario"]);
    expect(screen.queryByRole("button", { name: /^Editar el horario del / })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Aplicar lunes a viernes" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Agregar fecha especial" })).not.toBeInTheDocument();
  });
  it("leaves no legend under the fields and puts the four explanations in information icons", async () => {
    current.details = emptyBusinessDetails("UTC");
    current.details.location = { mode: "local", address: "Address", reference: "", area: "", latitude: null, longitude: null };
    current.details.faq = [{ id: crypto.randomUUID(), question: "¿Hace falta reservar?", answer: "" }, { id: crypto.randomUUID(), question: "¿Qué medios de pago aceptan?", answer: "Efectivo" }];
    withPlaceSearch(true);
    renderRouteWithProviders("/configuracion/negocio");
    const name = await screen.findByRole("textbox", { name: "Nombre del negocio" });
    await screen.findByRole("combobox", { name: "Buscar un lugar" });
    for (const control of [name, screen.getByRole("textbox", { name: "Qué hace el negocio" }), screen.getByRole("textbox", { name: "Productos y servicios" }),
      screen.getByRole("textbox", { name: "Políticas y condiciones" }), screen.getByRole("textbox", { name: "Dirección del local" }),
      screen.getByRole("combobox", { name: "Buscar un lugar" }), screen.getByRole("textbox", { name: "Enlace de la ubicación" })])
      expect(control).not.toHaveAccessibleDescription();
    for (const legend of [/Guardá los datos confirmados/, /Elegí cómo atendés cada día/, /Elegí preguntas habituales/, /Todavía no elegiste un lugar/, /Los feriados se consultan/])
      expect(screen.queryByText(legend)).not.toBeInTheDocument();
    // Sin fechas especiales no hay tabla ni un texto que lo diga: queda «Agregar fecha especial» (IN3).
    expect(screen.queryByText("Sin excepciones cargadas.")).not.toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Feriados y fechas especiales" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agregar fecha especial" })).toBeInTheDocument();
    // Lo que no es obvio va en la (i): los datos que no se cargan, la zona del horario, los textos anteriores y las preguntas sin respuesta.
    expect(screen.queryByText(/No cargues claves/, { selector: "p" })).toBeNull();
    expect(screen.getByRole("button", { name: "Más información sobre Datos del negocio" })).toHaveAccessibleDescription("Incluí sólo información confirmada. No cargues claves, códigos de acceso ni datos personales de clientes.");
    expect(screen.getByRole("button", { name: /^Zona horaria del horario/ })).toHaveAccessibleDescription("Los horarios y fechas especiales corresponden a esta zona; no cambia la configuración general.");
    const legacy = "Texto guardado anteriormente. Conservá lo que siga vigente y revisalo al completar las opciones nuevas; no se convierte automáticamente.";
    expect(screen.queryByText(legacy, { selector: "p" })).toBeNull();
    expect(screen.getByRole("textbox", { name: "Horario de atención" })).toHaveAccessibleDescription(legacy);
    expect(screen.getByRole("textbox", { name: "Ubicación o zona de atención" })).toHaveAccessibleDescription(legacy);
    expect(screen.queryByText(/sugerir mensajes/, { selector: "p" })).toBeNull();
    // Sólo la pregunta sin respuesta lleva la (i) que explica qué pasa con ella.
    expect(screen.getAllByRole("button", { name: "Más información sobre Sin respuesta" })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Más información sobre Sin respuesta" })).toHaveAccessibleDescription("Las preguntas sin respuesta no se usarán para sugerir mensajes.");
    // El diálogo de una fecha especial no explica debajo de su título.
    await userEvent.click(screen.getByRole("button", { name: "Agregar fecha especial" }));
    const dialog = await screen.findByRole("dialog", { name: "Horario de una fecha especial" });
    expect(dialog).not.toHaveAccessibleDescription();
    expect(within(dialog).queryByText(/Esta fecha reemplaza el horario semanal/)).not.toBeInTheDocument();
  });
  it("shows Save working with the spinner and «Guardando…»", async () => {
    let release: (() => void) | undefined;
    server.use(http.put("/api/ai/business-information", async ({ request }) => {
      const body = await request.json() as BusinessSaveRequest; writes.push(body);
      await new Promise<void>(resolve => { release = resolve; });
      current = { ...current, ...body, revision: current.revision + 1 };
      return HttpResponse.json({ requestId: body.requestId, revision: current.revision });
    }));
    renderRouteWithProviders("/configuracion/negocio");
    await userEvent.type(await screen.findByRole("textbox", { name: "Nombre del negocio" }), " Updated");
    await userEvent.click(save());
    expect(screen.getByRole("button", { name: "Guardando…" })).toHaveAttribute("aria-busy", "true");
    await waitFor(() => expect(release).toBeDefined());
    release!();
    await waitFor(() => expect(save()).toBeDisabled());
    expect(save()).not.toHaveAttribute("aria-busy");
  });
  it("shows the review of an uncertain save on its own button while Save keeps its name", async () => {
    let id = "";
    let release: (() => void) | undefined;
    server.use(http.put("/api/ai/business-information", async ({ request }) => {
      const body = await request.json() as BusinessSaveRequest; writes.push(body); id = body.requestId;
      current = { ...current, ...body, revision: 2 }; return HttpResponse.error();
    }), http.get("/api/ai/business-information/changes/:id", async () => { await new Promise<void>(resolve => { release = resolve; }); return HttpResponse.json({ requestId: id, revision: 2 }); }));
    renderRouteWithProviders("/configuracion/negocio");
    await userEvent.type(await screen.findByRole("textbox", { name: "Nombre del negocio" }), " Updated");
    await userEvent.click(save());
    await userEvent.click(await screen.findByRole("button", { name: "Revisar guardado" }));
    expect(screen.getByRole("button", { name: "Revisando…" })).toHaveAttribute("aria-busy", "true");
    // Revisar no guarda: el Guardar de la cabecera conserva su nombre y no muestra el aro.
    expect(save()).not.toHaveAttribute("aria-busy");
    expect(screen.queryByRole("button", { name: "Guardando…" })).not.toBeInTheDocument();
    await waitFor(() => expect(release).toBeDefined());
    release!();
    await waitFor(() => expect(save()).toBeDisabled());
    expect(writes).toHaveLength(1);
  });
  it("shows the review of another administrator's changes on its own button", async () => {
    let hold: Promise<void> | undefined;
    server.use(http.get("/api/ai/business-information", async () => { if (hold) await hold; return HttpResponse.json(current); }),
      http.put("/api/ai/business-information", async ({ request }) => {
        writes.push(await request.json() as BusinessSaveRequest); current = { ...current, hours: "10–17", revision: 2 };
        return HttpResponse.json({ code: "Ai.BusinessInformation.RevisionConflict" }, { status: 409 });
      }));
    renderRouteWithProviders("/configuracion/negocio");
    await userEvent.type(await screen.findByRole("textbox", { name: "Nombre del negocio" }), " Updated");
    await userEvent.click(save());
    const review = await screen.findByRole("region", { name: "Revisar cambios de otro administrador" });
    let release!: () => void;
    hold = new Promise<void>(resolve => { release = resolve; });
    await userEvent.click(within(review).getByRole("button", { name: "Revisar cambios" }));
    expect(within(review).getByRole("button", { name: "Revisando…" })).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByRole("button", { name: "Guardando…" })).not.toBeInTheDocument();
    release();
    expect(await within(review).findByRole("button", { name: "Conservar mis cambios" })).toBeEnabled();
    // La tabla y el Toaster de la elección ya dicen qué pasa: sin una explicación encima de la tabla.
    expect(screen.queryByText(/Compará los datos/)).not.toBeInTheDocument();
  });
  it("shows the retry of the same save on its own button, not on Save", async () => {
    let puts = 0;
    let release: (() => void) | undefined;
    server.use(http.put("/api/ai/business-information", async ({ request }) => {
      const body = await request.json() as BusinessSaveRequest; writes.push(body); puts++;
      if (puts === 1) return HttpResponse.error();
      await new Promise<void>(resolve => { release = resolve; });
      current = { ...current, ...body, revision: 2 };
      return HttpResponse.json({ requestId: body.requestId, revision: 2 });
    }), http.get("/api/ai/business-information/changes/:id", () => HttpResponse.json({ code: "Ai.BusinessInformation.ChangeNotFound" }, { status: 404 })));
    renderRouteWithProviders("/configuracion/negocio");
    await userEvent.type(await screen.findByRole("textbox", { name: "Nombre del negocio" }), " Updated");
    await userEvent.click(save());
    await userEvent.click(await screen.findByRole("button", { name: "Revisar guardado" }));
    await userEvent.click(await screen.findByRole("button", { name: "Reintentar el mismo guardado" }));
    // Una sola señal, en el botón que se tocó: el Guardar de la cabecera conserva su nombre.
    expect(screen.getAllByRole("button", { name: "Guardando…" })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Guardando…" })).toHaveAttribute("aria-busy", "true");
    expect(save()).not.toHaveAttribute("aria-busy");
    await waitFor(() => expect(release).toBeDefined());
    release!();
    await waitFor(() => expect(save()).toBeDisabled());
    expect(writes[1]).toEqual(writes[0]);
  });
  it("a denied route exposes no business content", async () => {
    server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["ai.read", "ai.manage"] })));
    renderRouteWithProviders("/configuracion/negocio");
    expect(await screen.findByRole("heading", { name: "No tenés permiso" })).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Shop")).not.toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });
  it("discarding edits requires a decision and restores the saved facts", async () => {
    renderRouteWithProviders("/configuracion/negocio");
    await userEvent.type(await screen.findByRole("textbox", { name: "Nombre del negocio" }), " Updated");
    await userEvent.click(screen.getByRole("button", { name: "Descartar" }));
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Descartar" }));
    expect(field()).toHaveValue("Shop");
    expect(writes).toHaveLength(0);
  });
});

