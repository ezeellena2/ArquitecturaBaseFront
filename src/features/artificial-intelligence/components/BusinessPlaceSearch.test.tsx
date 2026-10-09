import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import { server } from "@/test/mocks/server";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { BusinessPlaceSearch } from "./BusinessPlaceSearch";
describe("BusinessPlaceSearch", () => {
  it("debounces and selects only an ID while leaving saved business facts untouched", async () => {
    const requests: unknown[] = [], select = vi.fn();
    server.use(http.post("/api/ai/business-information/places/search", async ({ request }) => {
      requests.push(await request.json());
      return HttpResponse.json({ places: [{ placeId: "ChIJ_test", label: "Fictional clinic, Example City" }] });
    }));
    renderWithProviders(<MemoryRouter><BusinessPlaceSearch disabled={false} onSelect={select} /></MemoryRouter>);
    const input = screen.getByRole("combobox", { name: "Buscar un lugar" });
    await userEvent.type(input, "Cl");
    await new Promise(resolve => setTimeout(resolve, 400));
    expect(requests).toHaveLength(0);
    await userEvent.type(input, "inic Example City");
    await screen.findByRole("option", { name: "Fictional clinic, Example City" });
    expect(requests).toEqual([{ input: "Clinic Example City" }]);
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(select).toHaveBeenCalledWith("ChIJ_test");
    await waitFor(() => expect(screen.queryByRole("option")).not.toBeInTheDocument());
    expect(screen.getByText("Google Maps", { exact: true })).toHaveAttribute("translate", "no");
  });
  it("does not search when disabled", async () => {
    let calls = 0;
    server.use(http.post("/api/ai/business-information/places/search", () => { calls++; return HttpResponse.json({ places: [] }); }));
    renderWithProviders(<MemoryRouter><BusinessPlaceSearch disabled onSelect={() => {}} /></MemoryRouter>);
    expect(screen.getByRole("combobox")).toBeDisabled();
    expect(calls).toBe(0);
  });
  it("ignores a late response after the query changes", async () => {
    let release: (() => void) | undefined, calls = 0;
    server.use(http.post("/api/ai/business-information/places/search", async ({ request }) => {
      const body = await request.json() as { input: string }; calls++;
      if (body.input === "First clinic") await new Promise<void>(resolve => { release = resolve; });
      return HttpResponse.json({ places: [{ placeId: body.input === "First clinic" ? "ChIJ_old" : "ChIJ_new", label: body.input }] });
    }));
    renderWithProviders(<MemoryRouter><BusinessPlaceSearch disabled={false} onSelect={() => {}} /></MemoryRouter>);
    const input = screen.getByRole("combobox");
    await userEvent.type(input, "First clinic");
    await waitFor(() => expect(calls).toBe(1));
    await userEvent.clear(input); await userEvent.type(input, "Second clinic");
    await screen.findByRole("option", { name: "Second clinic" });
    release!();
    await new Promise(resolve => setTimeout(resolve, 40));
    expect(screen.queryByRole("option", { name: "First clinic" })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Second clinic" })).toBeVisible();
  });
  it("waits after 429 and never repeats automatically when the cooldown ends", async () => {
    let calls = 0;
    server.use(http.post("/api/ai/business-information/places/search", () => {
      calls++;
      return calls === 1 ? HttpResponse.json({ status: 429, code: "Ai.Places.RateLimited", detail: "Esperá antes de buscar.", retryAfter: 1 }, { status: 429 })
        : HttpResponse.json({ places: [] });
    }));
    renderWithProviders(<MemoryRouter><BusinessPlaceSearch disabled={false} onSelect={() => {}} /></MemoryRouter>);
    const input = screen.getByRole("combobox");
    await userEvent.type(input, "Clinic");
    await waitFor(() => expect(input).toBeDisabled());
    await waitFor(() => expect(input).toBeEnabled(), { timeout: 2000 });
    await new Promise(resolve => setTimeout(resolve, 450));
    expect(calls).toBe(1);
    await userEvent.click(screen.getByRole("button", { name: "Buscar otra vez" }));
    await waitFor(() => expect(calls).toBe(2));
    await screen.findByText("No encontramos lugares. Probá agregando la ciudad.");
  });
});
