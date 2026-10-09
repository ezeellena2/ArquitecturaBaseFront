import { toast } from "sonner";
import { afterEach, expect, it, vi } from "vitest";
import { dismissNotification, notify } from "./notifications";

afterEach(() => vi.restoreAllMocks());

it.each([["success", 4000], ["info", 4000], ["warning", 8000], ["error", 10000]] as const)("uses the shared duration for %s", (kind, duration) => {
  const emit = vi.spyOn(toast, kind);
  notify({ id: "operation:42", kind, message: "Result" });
  expect(emit).toHaveBeenCalledWith("Result", expect.objectContaining({ id: "operation:42", closeButton: true, duration }));
});

it("keeps an actionable notice until its owner retires it", () => {
  const emit = vi.spyOn(toast, "error");
  const dismiss = vi.spyOn(toast, "dismiss");
  const action = { label: "Retry", onClick: vi.fn() };
  notify({ id: "read:42", kind: "error", message: "Offline", action });
  expect(emit).toHaveBeenCalledWith("Offline", expect.objectContaining({ duration: Infinity, action }));
  dismissNotification("read:42");
  expect(dismiss).toHaveBeenCalledWith("read:42");
});
