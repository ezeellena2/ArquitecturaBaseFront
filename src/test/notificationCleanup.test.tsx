import { act, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { describe, expect, it, onTestFinished } from "vitest";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import { renderWithProviders } from "./utils/renderWithProviders";

// Sonner keeps its notices in module state that outlives the Toaster of each test, and removes a notice that is leaving with
// a Node timer that unmounting does not cancel. On 2026-11-27 that timer fired after jsdom was closed ("window is not defined"
// in sonner, ChatAudio) and failed a CI run whose tests had all passed. The tests run in order: each one reads what the
// previous one left.
describe("notices between tests", () => {
  it("leaves a notice on screen at the end of a test", async () => {
    renderWithProviders(<p>Pantalla</p>);
    act(() => { notify({ id: "harness:left-open", kind: "error", message: "Quedó abierto" }); });
    expect(await screen.findByText("Quedó abierto")).toBeVisible();
  });

  it("does not bring the notice of the previous test", async () => {
    renderWithProviders(<p>Pantalla</p>);
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });

    expect(toast.getToasts()).toEqual([]);
    expect(screen.queryByText("Quedó abierto")).not.toBeInTheDocument();
  });

  it("lets a notice that is leaving at the end of a test finish leaving before unmounting", async () => {
    renderWithProviders(<p>Pantalla</p>);
    act(() => { notify({ id: "harness:leaving", kind: "error", message: "Se va" }); });
    const notice = (await screen.findByText("Se va")).closest("[data-sonner-toast]");
    const region = notice?.closest("section");
    act(() => dismissNotification("harness:leaving"));
    await waitFor(() => expect(notice).toHaveAttribute("data-removed", "true"));

    // After unmounting, the region keeps what was on screen the last time the Toaster rendered.
    onTestFinished(() => expect(region?.querySelector("[data-sonner-toast]")).toBeNull());
  });
});
