import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./ApiError";
import { queryClient } from "./queryClient";
import i18n from "@/shared/i18n";

/// Dispara una consulta que siempre falla con el ApiError dado, para ejercitar el onError del QueryCache.
function FailingQuery({ queryKey, error }: { queryKey: string; error: ApiError }) {
  useQuery({ queryKey: [queryKey], queryFn: () => Promise.reject(error), retry: false });

  return null;
}

describe("queryClient", () => {
  afterEach(() => {
    queryClient.clear();
    vi.restoreAllMocks();
  });

  it("shows the backend's traceId, not an invented message, when a query fails with a 500", async () => {
    const toastError = vi.spyOn(toast, "error");
    const error = new ApiError(500, {
      code: "General.Unexpected",
      detail: "Ocurrió un error inesperado.",
      traceId: "trace-abc-123",
    });

    render(
      <QueryClientProvider client={queryClient}>
        <FailingQuery queryKey="fails-500" error={error} />
      </QueryClientProvider>,
    );

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(i18n.t("errors.unexpected", { traceId: "trace-abc-123" })),
    );
    expect(toastError.mock.calls[0]?.[0]).toContain("trace-abc-123");
  });

  it("shows the backend's translated detail for a business error", async () => {
    const toastError = vi.spyOn(toast, "error");
    const error = new ApiError(409, { code: "Users.Email.AlreadyTaken", detail: "Ese correo ya está en uso." });

    render(
      <QueryClientProvider client={queryClient}>
        <FailingQuery queryKey="fails-409" error={error} />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Ese correo ya está en uso."));
  });

  it("shows no toast when a query fails with a 403", async () => {
    const toastError = vi.spyOn(toast, "error");
    const error = new ApiError(403, { code: "Auth.Forbidden" });

    render(
      <QueryClientProvider client={queryClient}>
        <FailingQuery queryKey="fails-403" error={error} />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(queryClient.getQueryState(["fails-403"])?.status).toBe("error"));
    expect(toastError).not.toHaveBeenCalled();
  });
});
