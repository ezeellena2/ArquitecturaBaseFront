import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./ApiError";
import { createQueryClient, queryClient } from "./queryClient";
import i18n from "@/shared/i18n";

/// Dispara una consulta que siempre falla con el ApiError dado, para ejercitar el onError del QueryCache.
function FailingQuery({ queryKey, error }: { queryKey: string; error: ApiError }) {
  useQuery({ queryKey: [queryKey], queryFn: () => Promise.reject(error), retry: false });

  return null;
}

describe("queryClient", () => {
  it.each([new SyntaxError("Malformed JSON"), ApiError.network()])("stops failed reads after three attempts (%s)", async (error) => {
    const client = createQueryClient();
    const queryKey = ["bounded-retry"];
    const read = vi.fn(() => {
      // Stop the broken policy too, so a regression fails instead of hanging the suite.
      if (read.mock.calls.length === 4) queueMicrotask(() => void client.cancelQueries({ queryKey }));
      return Promise.reject(error);
    });
    try {
      await expect(client.fetchQuery({ queryKey, queryFn: read, retryDelay: 0 })).rejects.toBe(error);
      expect(read).toHaveBeenCalledTimes(3);
    } finally {
      client.clear();
    }
  });

  it.each([400, 401, 403, 409, 429, 500])("does not automatically retry HTTP %s", async (status) => {
    const client = createQueryClient();
    const error = new ApiError(status, {});
    const read = vi.fn(() => Promise.reject(error));
    try {
      await expect(client.fetchQuery({ queryKey: ["terminal", status], queryFn: read, retryDelay: 0 })).rejects.toBe(error);
      expect(read).toHaveBeenCalledTimes(1);
    } finally {
      client.clear();
    }
  });

  afterEach(() => {
    queryClient.clear();
    vi.restoreAllMocks();
  });

  it("retires an actionable error when its last observer leaves", async () => {
    const dismiss = vi.spyOn(toast, "dismiss");
    const errorToast = vi.spyOn(toast, "error");
    const client = createQueryClient();
    const view = render(<QueryClientProvider client={client}><FailingQuery queryKey="orphan" error={ApiError.network()} /></QueryClientProvider>);
    await waitFor(() => expect(errorToast).toHaveBeenCalledTimes(1));
    const id = errorToast.mock.calls[0]?.[1]?.id;
    view.unmount();
    expect(dismiss).toHaveBeenCalledWith(id);
    client.clear();
  });

  it("reports one failure for a query shared by two observers", async () => {
    const errorToast = vi.spyOn(toast, "error");
    const error = new ApiError(500, {});
    render(<QueryClientProvider client={queryClient}><FailingQuery queryKey="shared" error={error} /><FailingQuery queryKey="shared" error={error} /></QueryClientProvider>);
    await waitFor(() => expect(errorToast).toHaveBeenCalledTimes(1));
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
      expect(toastError).toHaveBeenCalledWith(i18n.t("errors.unexpected", { traceId: "trace-abc-123" }), expect.objectContaining({ id: expect.any(String) })),
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

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Ese correo ya está en uso.", expect.objectContaining({ duration: 10000 })));
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
