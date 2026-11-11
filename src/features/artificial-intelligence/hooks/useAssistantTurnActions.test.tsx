import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { createQueryClient } from "@/shared/api/queryClient";
import { ApiError } from "@/shared/api/ApiError";
import { configureHttpClient, resetHttpClient } from "@/shared/api/httpClient";
import { server } from "@/test/mocks/server";
import { http, HttpResponse } from "msw";
import { assistantApi } from "../api/assistant";
import type { AssistantSubmit } from "../api/assistant";
import { useAssistantTurnActions } from "./useAssistantTurnActions";
vi.mock("@/shared/ui/notifications", () => ({
  notify: vi.fn(),
  dismissNotification: vi.fn(),
}));
const accepted = {
  conversationId: "0199a0c0-0000-7000-8000-000000000111",
  requestId: "0199a0c0-0000-7000-8000-000000000333",
  conversationRevision: 1,
  turnRevision: 1,
  state: "pending" as const,
  stage: "pending" as const,
  submittedAtUtc: "2026-10-04T12:00:00Z",
  serverNowUtc: "2026-10-04T12:00:00Z",
  pollingAfterSeconds: 2,
};
beforeEach(() => {
  vi.restoreAllMocks();
  resetHttpClient();
});
function setup() {
  const client = createQueryClient();
  const onAccepted = vi.fn();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return {
    ...renderHook(
      () =>
        useAssistantTurnActions({
          userId: "u1",
          onAccepted,
          onForbidden: vi.fn(),
        }),
      { wrapper },
    ),
    client,
    onAccepted,
  };
}
describe("durable assistant acceptance", () => {
  it("uses common 401 renewal with identical UUID/body and Accept-Language", async () => {
    const sent: AssistantSubmit[] = [];
    const languages: (string | null)[] = [];
    let token = "expired";
    const renewal = vi.fn(async () => {
      token = "fresh";
      return token;
    });
    configureHttpClient({
      getAccessToken: () => token,
      renewSession: renewal,
      getLanguage: () => "en",
    });
    server.use(
      http.post("/api/ai/assistant/turns", async ({ request }) => {
        sent.push((await request.json()) as AssistantSubmit);
        languages.push(request.headers.get("Accept-Language"));
        return request.headers.get("Authorization") === "Bearer fresh"
          ? HttpResponse.json(accepted, { status: 202 })
          : new HttpResponse(null, { status: 401 });
      }),
    );
    const test = setup();
    await act(() => test.result.current.submit("private", 7));
    expect(renewal).toHaveBeenCalledTimes(1);
    expect(sent).toHaveLength(2);
    expect(sent[1]).toEqual(sent[0]);
    expect(languages).toEqual(["en", "en"]);
    expect(test.onAccepted).toHaveBeenCalledTimes(1);
    resetHttpClient();
  });
  it("refreshes confirmed revision conflicts and allows a new explicit submission", async () => {
    const submit = vi
      .spyOn(assistantApi, "submit")
      .mockRejectedValueOnce(
        new ApiError(409, { code: "Ai.Assistant.RevisionConflict" }),
      )
      .mockResolvedValue(accepted);
    const test = setup();
    const refresh = vi.spyOn(test.client, "invalidateQueries");
    await act(() =>
      test.result.current.submit("question", 7, { id: "c1", revision: 1 }),
    );
    expect(test.result.current.uncertain).toBe(false);
    expect(refresh).toHaveBeenCalledWith({ queryKey: ["assistant", "u1"] });
    await act(() =>
      test.result.current.submit("question", 7, { id: "c1", revision: 2 }),
    );
    expect(submit).toHaveBeenCalledTimes(2);
    expect(submit.mock.calls[1]![0].requestId).not.toEqual(
      submit.mock.calls[0]![0].requestId,
    );
  });
  it("ignores a previous owner's acceptance after the user changes in the same mounted hook", async () => {
    let release!: (value: typeof accepted) => void;
    vi.spyOn(assistantApi, "submit").mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const client = createQueryClient();
    const onAccepted = vi.fn();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const test = renderHook(
      ({ userId }) =>
        useAssistantTurnActions({ userId, onAccepted, onForbidden: vi.fn() }),
      { wrapper, initialProps: { userId: "u1" } },
    );
    let submit!: Promise<boolean>;
    act(() => {
      submit = test.result.current.submit("private", 7);
    });
    test.rerender({ userId: "u2" });
    await act(async () => {
      release(accepted);
      expect(await submit).toBe(false);
    });
    expect(onAccepted).not.toHaveBeenCalled();
  });
  it("does not publish a cancellation response after its private scope is unmounted", async () => {
    let release!: (
      value: Awaited<ReturnType<typeof assistantApi.cancel>>,
    ) => void;
    vi.spyOn(assistantApi, "cancel").mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const test = setup();
    test.client.setQueryData(["assistant", "u1", "turn", "r1", "es"], {
      question: "private",
    });
    const publish = vi.spyOn(test.client, "setQueriesData");
    let cancel!: Promise<boolean>;
    act(() => {
      cancel = test.result.current.cancel("r1");
    });
    test.unmount();
    test.client.removeQueries({ queryKey: ["assistant", "u1"] });
    await act(async () => {
      release({
        ...accepted,
        turnId: "0199a0c0-0000-7000-8000-000000000222",
        ordinal: 1,
        state: "canceled",
        stage: "finished",
        contentAccess: "allowed",
        question: "private",
        answer: null,
        evidences: [],
        // Like the backend: a confirmed cancellation keeps its request time and the Canceled failure.
        failure: { code: "Ai.Assistant.Canceled", detail: "Cancelación confirmada.", recovery: "newAttempt" },
        usage: null,
        culture: "es",
        timeZoneId: "UTC",
        cancelRequestedAtUtc: "2026-10-04T12:00:02Z",
      });
      expect(await cancel).toBe(false);
    });
    expect(publish).not.toHaveBeenCalled();
    expect(
      test.client.getQueryCache().findAll({ queryKey: ["assistant", "u1"] }),
    ).toHaveLength(0);
  });
  it("does not use acceptance recovery after an uncertain deletion", async () => {
    vi.spyOn(assistantApi, "remove").mockRejectedValue(ApiError.network());
    const test = setup();
    await act(() => test.result.current.remove("c1"));
    expect(test.result.current.uncertain).toBe(false);
  });
  it("does not confuse an uncertain cancellation with an uncertain acceptance", async () => {
    vi.spyOn(assistantApi, "cancel").mockRejectedValue(ApiError.network());
    const test = setup();
    await waitFor(() => expect(test.result.current).not.toBeNull());
    await act(() => test.result.current.cancel("r1"));
    expect(test.result.current.uncertain).toBe(false);
  });
  it("does not repeat an uncertain POST automatically and explicitly repeats the frozen body", async () => {
    const sent: unknown[] = [];
    vi.spyOn(assistantApi, "submit").mockImplementation(async (body) => {
      sent.push(body);
      if (sent.length === 1) throw ApiError.network();
      return { ...accepted, requestId: body.requestId };
    });
    vi.spyOn(assistantApi, "turn").mockRejectedValue(new ApiError(404, {}));
    const test = setup();
    await waitFor(() => expect(test.result.current).not.toBeNull());
    await act(() => test.result.current.submit(" pregunta ", 7));
    expect(sent).toHaveLength(1);
    expect(test.result.current.uncertain).toBe(true);
    await act(() => test.result.current.recover());
    expect(sent).toHaveLength(1);
    expect(test.result.current.uncertain).toBe(true);
    await act(() => test.result.current.retryIdentical());
    expect(sent).toHaveLength(2);
    expect(sent[1]).toEqual(sent[0]);
    expect(test.client.getMutationCache().getAll()).toHaveLength(0);
  });
  it("sends a turn with a spreadsheet, says how much went up and repeats the same body and file only when asked", async () => {
    const file = new File(["Código,Cliente"], "clientes.csv", { type: "text/csv" });
    const sent: { body: AssistantSubmit; file: File }[] = [];
    let release!: () => void;
    vi.spyOn(assistantApi, "submitFile").mockImplementation(async (body, chosen, onProgress) => {
      sent.push({ body, file: chosen });
      onProgress(0.4);
      if (sent.length === 1) throw ApiError.network();
      await new Promise<void>((resolve) => { release = resolve; });
      return { ...accepted, requestId: body.requestId };
    });
    const submit = vi.spyOn(assistantApi, "submit");
    const test = setup();
    await act(() => test.result.current.submit("", 7, undefined, undefined, file));
    expect(test.result.current.uncertain).toBe(true);
    expect(test.result.current.progress).toBeUndefined();
    let retry!: Promise<boolean>;
    act(() => { retry = test.result.current.retryIdentical(); });
    await waitFor(() => expect(test.result.current.progress).toBe(0.4));
    await act(async () => { release(); expect(await retry).toBe(true); });
    expect(sent).toHaveLength(2);
    expect(sent[1].body).toEqual(sent[0].body);
    expect(sent[1].file).toBe(file);
    expect(submit).not.toHaveBeenCalled();
    expect(test.result.current.progress).toBeUndefined();
    expect(test.onAccepted).toHaveBeenCalledOnce();
  });
  it("keeps why the server did not read the file for the composer, and the next attempt is another request", async () => {
    const file = new File(["xls"], "clientes.xlsx", { type: "application/vnd.ms-excel" });
    const reason = "No se puede leer un Excel viejo (.xls). Guardalo como Libro de Excel (.xlsx) o como CSV UTF-8.";
    const submitFile = vi.spyOn(assistantApi, "submitFile")
      .mockRejectedValueOnce(new ApiError(400, { code: "Ai.Assistant.AttachmentLegacy", detail: reason, errors: { file: [reason] } }))
      .mockResolvedValue(accepted);
    const test = setup();
    expect(await act(() => test.result.current.submit("", 7, undefined, undefined, file))).toBe(false);
    expect(test.result.current.fileError).toBe(reason);
    expect(test.result.current.fieldError).toBeUndefined();
    act(() => test.result.current.clearFileError());
    expect(test.result.current.fileError).toBeUndefined();
    await act(() => test.result.current.submit("", 7, undefined, undefined, file));
    expect(submitFile.mock.calls[1]![0].requestId).not.toEqual(submitFile.mock.calls[0]![0].requestId);
  });
  it("says under the composer that this person can no longer attach, without closing Home", async () => {
    const remedy = "Para adjuntar planillas, pedile a quien administra la instalación el permiso de administrar catálogos.";
    vi.spyOn(assistantApi, "submitFile").mockRejectedValue(new ApiError(403, { code: "Ai.Assistant.AttachmentForbidden", detail: remedy }));
    const onForbidden = vi.fn();
    const client = createQueryClient();
    const refresh = vi.spyOn(client, "invalidateQueries");
    const test = renderHook(() => useAssistantTurnActions({ userId: "u1", onAccepted: vi.fn(), onForbidden }),
      { wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> });
    await act(() => test.result.current.submit("", 7, undefined, undefined, new File(["x"], "clientes.csv")));
    expect(test.result.current.fileError).toBe(remedy);
    expect(onForbidden).not.toHaveBeenCalled();
    expect(refresh).toHaveBeenCalledWith({ queryKey: ["assistant", "u1"] });
  });
  it("blocks concurrent submit callbacks before React can render busy", async () => {
    let release!: () => void;
    const spy = vi
      .spyOn(assistantApi, "submit")
      .mockImplementation(async (body) => {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        return { ...accepted, requestId: body.requestId };
      });
    const test = setup();
    let first!: Promise<boolean>;
    act(() => {
      first = test.result.current.submit("one", 7);
      void test.result.current.submit("two", 7);
    });
    expect(spy).toHaveBeenCalledTimes(1);
    await act(async () => {
      release();
      await first;
    });
    expect(test.onAccepted).toHaveBeenCalledTimes(1);
  });
});
